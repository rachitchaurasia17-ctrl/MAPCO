-- MAPCO V2: token-scoped client-link maps and complete authenticated listing.
-- The public browser never receives the dealer's map catalog. The Edge broker
-- calls the service-role-only function below after the ordinary token resolver
-- has validated status, expiry, account state and rate limits.

create or replace function public.plotmap_resolve_client_link_maps(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_link public.share_links%rowtype;
  v_property record;
  v_placement_map public.prebuilt_maps%rowtype;
  v_master_id text;
  v_sector_id text;
  v_placement_id text;
  v_x numeric;
  v_y numeric;
  v_binding jsonb;
  v_bindings jsonb := '[]'::jsonb;
  v_map_ids text[] := '{}';
  v_maps jsonb := '[]'::jsonb;
begin
  if auth.role() <> 'service_role' then
    return null;
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_link
  from public.share_links s
  where s.token_hash = encode(extensions.digest(lower(p_token), 'sha256'), 'hex')
    and s.target_type = 'client_link'
    and s.status = 'active'
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > timezone('utc', now()))
    and public.plotmap_dealer_is_active(s.dealer_id)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  -- Precise location OFF is a hard boundary: no map IDs, assets or coordinates.
  if coalesce(v_link.metadata -> 'client_snapshot' -> 'visibility' ->> 'location', 'area') <> 'exact' then
    return jsonb_build_object('ok', true, 'maps', '[]'::jsonb, 'bindings', '[]'::jsonb);
  end if;

  for v_property in
    select x.ord - 1 as index, r.payload,
      v_link.metadata -> 'client_snapshot' -> 'properties' -> (x.ord - 1)::integer as snapshot_property
    from unnest(v_link.property_ids) with ordinality as x(id, ord)
    join public.crm_records r
      on r.id = x.id
     and r.dealer_id = v_link.dealer_id
     and r.entity_type = 'properties'
     and coalesce(r.deleted, false) = false
    order by x.ord
  loop
    v_master_id := null;
    v_sector_id := null;
    v_placement_id := nullif(trim(coalesce(
      v_property.snapshot_property -> 'placement' ->> 'mapId',
      v_property.payload -> 'mapPlacement' ->> 'mapId'
    )), '');
    v_x := null;
    v_y := null;
    v_placement_map := null;

    select m.id into v_master_id
    from public.prebuilt_maps m
    where m.id = nullif(trim(coalesce(v_property.snapshot_property ->> 'masterplanId', v_property.payload ->> 'masterplanId')), '')
      and m.dealer_id = v_link.dealer_id
      and m.kind = 'masterplan' and m.status = 'published'
      and m.client_visible = true and coalesce(m.deleted, false) = false;

    select m.id into v_sector_id
    from public.prebuilt_maps m
    where m.id = nullif(trim(coalesce(v_property.snapshot_property ->> 'sectorMapId', v_property.payload ->> 'sectorMapId')), '')
      and m.dealer_id = v_link.dealer_id
      and m.kind = 'sector' and m.status = 'published'
      and m.client_visible = true and coalesce(m.deleted, false) = false;

    if v_placement_id is not null then
      select * into v_placement_map
      from public.prebuilt_maps m
      where m.id = v_placement_id
        and m.dealer_id = v_link.dealer_id
        and m.status = 'published'
        and m.client_visible = true
        and coalesce(m.deleted, false) = false;
      if v_placement_map.id is null then v_placement_id := null; end if;
    end if;

    if v_placement_map.id is not null and v_placement_map.kind = 'sector' and v_sector_id is null then
      v_sector_id := v_placement_map.id;
    elsif v_placement_map.id is not null and v_placement_map.kind = 'masterplan' and v_master_id is null then
      v_master_id := v_placement_map.id;
    end if;

    if v_master_id is null and v_sector_id is not null then
      select parent.id into v_master_id
      from public.prebuilt_maps sector
      join public.prebuilt_maps parent
        on parent.id = sector.parent_map_id
       and parent.dealer_id = sector.dealer_id
       and parent.kind = 'masterplan'
       and parent.status = 'published'
       and parent.client_visible = true
       and coalesce(parent.deleted, false) = false
      where sector.id = v_sector_id and sector.dealer_id = v_link.dealer_id;
    end if;

    if v_placement_id is not null
       and coalesce(v_property.snapshot_property -> 'placement' ->> 'x', v_property.payload -> 'mapPlacement' ->> 'x', '') ~ '^[0-9]+([.][0-9]+)?$'
       and coalesce(v_property.snapshot_property -> 'placement' ->> 'y', v_property.payload -> 'mapPlacement' ->> 'y', '') ~ '^[0-9]+([.][0-9]+)?$' then
      v_x := coalesce(v_property.snapshot_property -> 'placement' ->> 'x', v_property.payload -> 'mapPlacement' ->> 'x')::numeric;
      v_y := coalesce(v_property.snapshot_property -> 'placement' ->> 'y', v_property.payload -> 'mapPlacement' ->> 'y')::numeric;
      if v_x < 0 or v_x > 1 or v_y < 0 or v_y > 1 then
        v_x := null; v_y := null;
      end if;
    end if;

    v_binding := jsonb_strip_nulls(jsonb_build_object(
      'index', v_property.index,
      'masterplanId', v_master_id,
      'sectorMapId', v_sector_id,
      'placement', case when v_placement_id is not null and v_x is not null and v_y is not null
        then jsonb_build_object('mapId', v_placement_id, 'x', v_x, 'y', v_y)
        else null end
    ));
    v_bindings := v_bindings || jsonb_build_array(v_binding);
    if v_master_id is not null then v_map_ids := array_append(v_map_ids, v_master_id); end if;
    if v_sector_id is not null then v_map_ids := array_append(v_map_ids, v_sector_id); end if;
    if v_placement_id is not null then v_map_ids := array_append(v_map_ids, v_placement_id); end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', m.id,
    'kind', m.kind,
    'city', left(m.city, 80),
    'sector', left(m.sector, 120),
    'area', left(m.area, 120),
    'label', left(m.label, 160),
    'parentMapId', m.parent_map_id,
    'raster', coalesce(m.assets -> 'original' ->> 'path', m.raster),
    'assets', jsonb_strip_nulls(jsonb_build_object(
      'original', case when coalesce(m.assets -> 'original' ->> 'path', m.raster) ~ '^https://'
        then jsonb_strip_nulls(jsonb_build_object(
          'path', coalesce(m.assets -> 'original' ->> 'path', m.raster),
          'w', coalesce((m.assets -> 'original' ->> 'w')::integer, (m.dims -> 'original' ->> 'w')::integer),
          'h', coalesce((m.assets -> 'original' ->> 'h')::integer, (m.dims -> 'original' ->> 'h')::integer)
        )) else null end,
      'threeD', case when coalesce(m.assets -> 'threeD' ->> 'path', '') ~ '^https://'
        then jsonb_strip_nulls(jsonb_build_object(
          'path', m.assets -> 'threeD' ->> 'path',
          'w', coalesce((m.assets -> 'threeD' ->> 'w')::integer, (m.dims -> 'threeD' ->> 'w')::integer),
          'h', coalesce((m.assets -> 'threeD' ->> 'h')::integer, (m.dims -> 'threeD' ->> 'h')::integer)
        )) else null end
    )),
    'dims', jsonb_strip_nulls(jsonb_build_object(
      'original', m.dims -> 'original',
      'threeD', case when coalesce(m.assets -> 'threeD' ->> 'path', '') ~ '^https://' then m.dims -> 'threeD' else null end
    ))
  )) order by case when m.kind = 'masterplan' then 0 else 1 end, m.id), '[]'::jsonb)
  into v_maps
  from public.prebuilt_maps m
  where m.id in (select distinct unnest(v_map_ids))
    and m.dealer_id = v_link.dealer_id
    and m.status = 'published'
    and m.client_visible = true
    and coalesce(m.deleted, false) = false
    and coalesce(m.assets -> 'original' ->> 'path', m.raster, '') ~ '^https://';

  return jsonb_build_object('ok', true, 'maps', v_maps, 'bindings', v_bindings);
end;
$$;

revoke all on function public.plotmap_resolve_client_link_maps(text) from public, anon, authenticated;
grant execute on function public.plotmap_resolve_client_link_maps(text) to service_role;

-- Return enough authenticated metadata for dealer/client/property interlinking.
-- This function remains dealer-scoped and is not executable by anon.
create or replace function public.plotmap_list_client_links(p_property_id text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or not public.plotmap_is_active_member() then '[]'::jsonb
    else coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'label', s.label,
      'clientId', s.client_id,
      'clientName', coalesce(
        (select left(r.payload ->> 'name', 80) from public.crm_records r
          where r.id = s.client_id and r.dealer_id = s.dealer_id
            and r.entity_type = 'clients' and coalesce(r.deleted, false) = false),
        s.metadata -> 'client_snapshot' -> 'customer' ->> 'name',
        'Client'
      ),
      'propertyIds', to_jsonb(s.property_ids),
      'propertyNames', coalesce((
        select jsonb_agg(coalesce(p.item ->> 'title', 'Property') order by p.ord)
        from jsonb_array_elements(s.metadata -> 'client_snapshot' -> 'properties')
          with ordinality as p(item, ord)
      ), '[]'::jsonb),
      'status', case
        when s.revoked_at is not null or s.status = 'revoked' then 'revoked'
        when s.expires_at is not null and s.expires_at <= timezone('utc', now()) then 'expired'
        else s.status
      end,
      'propertyCount', cardinality(s.property_ids),
      'priceVisibility', s.metadata -> 'client_snapshot' -> 'visibility' ->> 'price',
      'locationVisibility', s.metadata -> 'client_snapshot' -> 'visibility' ->> 'location',
      'tokenHint', s.token_hint,
      'expiresAt', s.expires_at,
      'createdAt', s.created_at,
      'openedAt', s.opened_at,
      'lastOpenedAt', s.last_opened_at,
      'hasAudio', nullif(s.metadata ->> 'audio_object_path', '') is not null,
      'audioSeconds', coalesce((s.metadata ->> 'audio_seconds')::integer, 0),
      'events', jsonb_build_object(
        'opens', (select count(*) from public.client_link_events e where e.link_id = s.id and e.event_type = 'opened'),
        'audioPlays', (select count(*) from public.client_link_events e where e.link_id = s.id and e.event_type = 'audio_played'),
        'calls', (select count(*) from public.client_link_events e where e.link_id = s.id and e.event_type = 'call_clicked'),
        'whatsapp', (select count(*) from public.client_link_events e where e.link_id = s.id and e.event_type = 'whatsapp_clicked'),
        'visits', (select count(*) from public.client_link_events e where e.link_id = s.id and e.event_type = 'visit_requested')
      )
    ) order by s.created_at desc), '[]'::jsonb)
  end
  from public.share_links s
  where s.dealer_id = public.plotmap_current_dealer_id()
    and s.target_type = 'client_link'
    and (p_property_id is null or p_property_id = any(s.property_ids));
$$;

revoke all on function public.plotmap_list_client_links(text) from public, anon, authenticated;
grant execute on function public.plotmap_list_client_links(text) to authenticated;
