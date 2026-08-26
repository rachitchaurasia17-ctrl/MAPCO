-- ============================================================
-- MAPCO Desk · Client Link activity + dealer read models
-- ------------------------------------------------------------
-- The private client-link backend (20260801001500) records five event
-- kinds. The approved Desk surfaces three more that the product genuinely
-- supports and can attribute to a specific property:
--
--   property_viewed   a buyer opened one property inside the link
--   photos_viewed     they moved through that property's photos
--   map_opened        they opened the map / MAPCO Earth view
--
-- Everything here is a REAL interaction the client page performs. Nothing
-- infers interest, scores a buyer, or manufactures activity: a follow-up
-- exists only because something factual happened (or failed to happen,
-- like a link never being opened).
--
-- Also adds two dealer-private read models so Client Links stops issuing
-- a query per link:
--
--   plotmap_client_link_directory   All Links + Follow-ups in one trip
--   plotmap_client_link_workspace   one link with per-property activity
--
-- Safe to re-run. Creates no demo rows.
-- ============================================================

-- ---------- 1. the three additional real event kinds ----------

alter table public.client_link_events
  drop constraint if exists client_link_events_event_type_check;
alter table public.client_link_events
  add constraint client_link_events_event_type_check check (
    event_type in (
      'opened', 'audio_played', 'call_clicked', 'whatsapp_clicked', 'visit_requested',
      'property_viewed', 'photos_viewed', 'map_opened'
    )
  );

-- Per-property activity is read constantly by the link detail view.
create index if not exists client_link_events_link_property_idx
  on public.client_link_events (link_id, property_public_id, created_at desc);

-- ---------- 2. All Links / Follow-ups read model ----------
-- One round trip for the whole screen: every link with its client, its
-- status, its counts, and the facts a follow-up can be built from.

create or replace function public.plotmap_client_link_directory()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_is_active_member()
     or public.plotmap_current_role() = 'viewer'
     or not public.plotmap_dealer_is_active(v_dealer)
  then raise exception 'client link access denied'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc)
    from (
      select
        s.id,
        s.client_id,
        c.payload->>'name'  as client_name,
        c.payload->>'phone' as client_phone,
        s.property_ids,
        s.status,
        s.expires_at,
        s.created_at,
        s.revoked_at,
        coalesce(ev.opens, 0)            as opens,
        coalesce(ev.property_views, 0)   as property_views,
        coalesce(ev.photo_views, 0)      as photo_views,
        coalesce(ev.map_opens, 0)        as map_opens,
        coalesce(ev.audio_plays, 0)      as audio_plays,
        coalesce(ev.calls, 0)            as calls,
        coalesce(ev.whatsapp, 0)         as whatsapp,
        coalesce(ev.visits, 0)           as visit_requests,
        ev.last_activity_at,
        ev.first_opened_at
      from public.share_links s
      left join public.crm_records c
        on c.id = s.client_id and c.dealer_id = s.dealer_id
       and c.entity_type = 'clients' and not c.deleted
      left join lateral (
        select
          count(*) filter (where e.event_type = 'opened')          as opens,
          count(*) filter (where e.event_type = 'property_viewed') as property_views,
          count(*) filter (where e.event_type = 'photos_viewed')   as photo_views,
          count(*) filter (where e.event_type = 'map_opened')      as map_opens,
          count(*) filter (where e.event_type = 'audio_played')    as audio_plays,
          count(*) filter (where e.event_type = 'call_clicked')    as calls,
          count(*) filter (where e.event_type = 'whatsapp_clicked') as whatsapp,
          count(*) filter (where e.event_type = 'visit_requested') as visits,
          max(e.created_at)                                        as last_activity_at,
          min(e.created_at) filter (where e.event_type = 'opened') as first_opened_at
        from public.client_link_events e
        where e.link_id = s.id and e.dealer_id = v_dealer
      ) ev on true
      where s.dealer_id = v_dealer
        and s.target_type = 'client_link'
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.plotmap_client_link_directory() from public, anon;
grant execute on function public.plotmap_client_link_directory() to authenticated;

-- ---------- 3. one link, with per-property activity ----------

create or replace function public.plotmap_client_link_workspace(p_link_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_link public.share_links%rowtype;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_is_active_member()
     or public.plotmap_current_role() = 'viewer'
     or not public.plotmap_dealer_is_active(v_dealer)
  then raise exception 'client link access denied'; end if;

  select * into v_link from public.share_links
    where id = p_link_id and dealer_id = v_dealer and target_type = 'client_link';
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  return jsonb_build_object(
    'ok', true,
    'link', jsonb_build_object(
      'id', v_link.id, 'clientId', v_link.client_id, 'status', v_link.status,
      'propertyIds', v_link.property_ids, 'createdAt', v_link.created_at,
      'expiresAt', v_link.expires_at, 'revokedAt', v_link.revoked_at),
    'client', (select jsonb_build_object('id', c.id, 'payload', c.payload)
      from public.crm_records c where c.dealer_id = v_dealer and c.id = v_link.client_id
        and c.entity_type = 'clients' and not c.deleted),
    -- Per-property activity: what the buyer actually did, property by property.
    'properties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'propertyId', p.id,
        'name', coalesce(nullif(trim(p.payload->>'title'), ''), p.payload->>'area', 'Property'),
        'loc', p.payload->>'loc',
        'price', p.payload->'price',
        'lifecycle', coalesce(p.payload->>'lifecycle', 'draft'),
        'views', coalesce(a.views, 0),
        'photoViews', coalesce(a.photo_views, 0),
        'mapOpens', coalesce(a.map_opens, 0),
        'lastViewedAt', a.last_viewed_at))
      from unnest(v_link.property_ids) as pid
      join public.crm_records p on p.id = pid and p.dealer_id = v_dealer
        and p.entity_type = 'properties' and not p.deleted
      left join lateral (
        select
          count(*) filter (where e.event_type = 'property_viewed') as views,
          count(*) filter (where e.event_type = 'photos_viewed')   as photo_views,
          count(*) filter (where e.event_type = 'map_opened')      as map_opens,
          max(e.created_at) filter (where e.event_type = 'property_viewed') as last_viewed_at
        from public.client_link_events e
        where e.link_id = v_link.id and e.property_public_id = p.id
      ) a on true
    ), '[]'::jsonb),
    -- Chronological history. Real events only, newest first.
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', e.event_type,
        'propertyId', e.property_public_id,
        'at', e.created_at) order by e.created_at desc)
      from public.client_link_events e
      where e.link_id = v_link.id and e.dealer_id = v_dealer
      limit 200
    ), '[]'::jsonb));
end;
$$;
revoke all on function public.plotmap_client_link_workspace(uuid) from public, anon;
grant execute on function public.plotmap_client_link_workspace(uuid) to authenticated;
