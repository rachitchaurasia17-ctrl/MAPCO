-- ============================================================
-- MAPCO AI · Deterministic context builder
-- ------------------------------------------------------------
-- The rule this file enforces:
--
--   Database owns facts.
--   MAPCO analytics owns calculations.
--   AI owns interpretation.
--   MAPCO owns actions and UI.
--
-- No AI request ever queries the database. It receives ONLY the
-- compact, bounded, deterministic fact object produced here.
--
-- Privacy invariants baked into the projection:
--   • No customer name, phone, note or client id.
--   • No owner/seller identity, no commission, no payment data.
--   • No raw or hinted client-link token, no session identifier.
--   • Client Presentation and Client Link activity are represented as
--     ANONYMOUS counts. There is no identity resolution, and the object
--     states that explicitly so a model cannot infer a known buyer.
--   • Every array is capped, so the payload stays small and cheap.
--
-- Safe to re-run. Reads only; creates no rows.
-- ============================================================

-- Presentation-event scans are always (dealer_id, created_at) bounded.
create index if not exists presentation_events_dealer_created_idx
  on public.presentation_events (dealer_id, created_at desc);

create index if not exists crm_records_dealer_entity_created_idx
  on public.crm_records (dealer_id, entity_type, created_at desc);

-- ---------- fact builder ----------
-- Returns a single jsonb object. Bounded work: one window plus the
-- immediately preceding window of the same length, for real comparison.
create or replace function public.plotmap_ai_context_facts_for(
  p_dealer_id text,
  p_window_days integer default 7,
  p_top integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_days integer := least(greatest(coalesce(p_window_days, 7), 1), 90);
  v_top integer := least(greatest(coalesce(p_top, 20), 1), 50);
  v_now timestamptz := timezone('utc'::text, now());
  v_from timestamptz;
  v_prev_from timestamptz;
  v_presentation jsonb;
  v_links jsonb;
  v_inventory jsonb;
  v_maps jsonb;
  v_coverage jsonb;
begin
  if v_dealer = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_dealer');
  end if;

  v_from := v_now - make_interval(days => v_days);
  v_prev_from := v_from - make_interval(days => v_days);

  -- ── Client Presentation activity (anonymous) ──────────────────
  with scoped as materialized (
    select e.event_type, e.area, e.sector, e.map_id, e.property_id, e.session_id,
           (e.created_at >= v_from) as in_window
    from public.presentation_events e
    where e.dealer_id = v_dealer
      and e.created_at >= v_prev_from
      and coalesce(e.metadata->>'env', '') <> 'local'
  ),
  totals as (
    select
      count(*) filter (where in_window) as events,
      count(*) filter (where not in_window) as previous_events,
      count(distinct session_id) filter (where in_window and coalesce(session_id, '') <> '') as sessions
    from scoped
  ),
  by_area as (
    select area,
           count(*) filter (where in_window) as opens,
           count(*) filter (where not in_window) as previous_opens
    from scoped where coalesce(area, '') <> '' group by area
  ),
  by_sector as (
    select sector,
           count(*) filter (where in_window) as opens,
           count(*) filter (where not in_window) as previous_opens
    from scoped where coalesce(sector, '') <> '' group by sector
  ),
  by_property as (
    select property_id,
           count(*) filter (where in_window) as opens,
           count(*) filter (where not in_window) as previous_opens
    from scoped where coalesce(property_id, '') <> '' group by property_id
  ),
  by_map as (
    select map_id, count(*) filter (where in_window) as opens
    from scoped where coalesce(map_id, '') <> '' group by map_id
  ),
  by_type as (
    select event_type, count(*) filter (where in_window) as events
    from scoped group by event_type
  )
  select jsonb_build_object(
    'anonymous', true,
    'totals', (select jsonb_build_object(
        'events', t.events, 'sessions', t.sessions, 'previousEvents', t.previous_events
      ) from totals t),
    'byArea', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('area', a.area, 'opens', a.opens, 'previousOpens', a.previous_opens) as x
        from by_area a where a.opens > 0 or a.previous_opens > 0
        order by a.opens desc, a.area asc limit v_top) s), '[]'::jsonb),
    'bySector', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('sector', b.sector, 'opens', b.opens, 'previousOpens', b.previous_opens) as x
        from by_sector b where b.opens > 0 or b.previous_opens > 0
        order by b.opens desc, b.sector asc limit v_top) s), '[]'::jsonb),
    'byProperty', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('propertyId', p.property_id, 'opens', p.opens, 'previousOpens', p.previous_opens) as x
        from by_property p where p.opens > 0 or p.previous_opens > 0
        order by p.opens desc, p.property_id asc limit v_top) s), '[]'::jsonb),
    'byMap', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('mapId', m.map_id, 'opens', m.opens) as x
        from by_map m where m.opens > 0 order by m.opens desc, m.map_id asc limit v_top) s), '[]'::jsonb),
    'byEventType', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('eventType', e.event_type, 'events', e.events) as x
        from by_type e where e.events > 0 order by e.events desc, e.event_type asc limit v_top) s), '[]'::jsonb)
  ) into v_presentation;

  -- ── Private Client Link activity (anonymous) ──────────────────
  -- Link ids are internal references only. No label, token hint, customer
  -- id or session hash is projected — a link is a channel, not a person.
  with links as materialized (
    select l.id, l.status, l.created_at, l.last_opened_at,
           coalesce(array_length(l.property_ids, 1), 0) as property_count,
           l.property_ids
    from public.share_links l
    where l.dealer_id = v_dealer and l.target_type = 'client_link'
  ),
  events as materialized (
    select ev.link_id, ev.event_type, ev.session_hash, ev.property_public_id,
           (ev.created_at >= v_from) as in_window
    from public.client_link_events ev
    where ev.dealer_id = v_dealer and ev.created_at >= v_prev_from
  ),
  totals as (
    select
      (select count(*) from links) as link_count,
      (select count(*) from links where status = 'active') as active_links,
      (select count(*) from links where created_at >= v_from) as created_in_window,
      count(*) filter (where in_window and event_type = 'opened') as opens,
      count(*) filter (where not in_window and event_type = 'opened') as previous_opens,
      count(*) filter (where in_window and event_type = 'audio_played') as audio_plays,
      count(*) filter (where in_window and event_type = 'call_clicked') as calls,
      count(*) filter (where in_window and event_type = 'whatsapp_clicked') as whatsapp,
      count(*) filter (where in_window and event_type = 'visit_requested') as visits
    from events
  ),
  per_link as (
    select e.link_id,
           count(*) filter (where e.in_window and e.event_type = 'opened') as opens,
           count(distinct e.session_hash) filter (where e.in_window and e.event_type = 'opened') as distinct_sessions
    from events e group by e.link_id
  ),
  per_property as (
    select e.property_public_id as property_id, count(*) filter (where e.in_window) as opens
    from events e where coalesce(e.property_public_id, '') <> '' group by e.property_public_id
  )
  select jsonb_build_object(
    'anonymous', true,
    'totals', (select jsonb_build_object(
        'links', t.link_count, 'activeLinks', t.active_links, 'createdInWindow', t.created_in_window,
        'opens', t.opens, 'previousOpens', t.previous_opens, 'audioPlays', t.audio_plays,
        'calls', t.calls, 'whatsapp', t.whatsapp, 'visitRequests', t.visits
      ) from totals t),
    'topLinks', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object(
          'linkId', pl.link_id, 'opens', pl.opens, 'distinctSessions', pl.distinct_sessions,
          'propertyCount', l.property_count, 'propertyIds', to_jsonb(coalesce(l.property_ids, '{}'::text[])),
          'status', l.status, 'createdAt', l.created_at, 'lastOpenedAt', l.last_opened_at,
          -- Several opens from several sessions is a real repeat-interest
          -- signal; several opens from one session is not.
          'repeatOpened', (pl.opens > pl.distinct_sessions)
        ) as x
        from per_link pl join links l on l.id = pl.link_id
        where pl.opens > 0 order by pl.opens desc, pl.link_id asc limit v_top) s), '[]'::jsonb),
    'byProperty', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('propertyId', pp.property_id, 'opens', pp.opens) as x
        from per_property pp where pp.opens > 0 order by pp.opens desc, pp.property_id asc limit v_top) s), '[]'::jsonb)
  ) into v_links;

  -- ── Inventory (dealer-owned records) ──────────────────────────
  -- Only structural metadata. No owner block, no notes, no photos.
  -- Every payload read is total: a single malformed record must never be
  -- able to break the whole fact build. jsonb comparison instead of ::boolean,
  -- regex-guarded numerics, type-checked array lengths.
  with props as materialized (
    select r.id,
           coalesce(r.payload->>'city', '') as city,
           coalesce(r.payload->>'area', '') as area,
           coalesce(r.payload->>'sector', '') as sector,
           coalesce(r.payload->>'want', '') as want,
           coalesce(r.payload->>'type', '') as type,
           coalesce((r.payload->'published') = 'true'::jsonb, false) as published,
           coalesce((r.payload->'sold') = 'true'::jsonb, false) as sold,
           case when r.payload->>'price' ~ '^[0-9]+(\.[0-9]+)?$'
                then (r.payload->>'price')::numeric else 0 end as price,
           (case when jsonb_typeof(r.payload->'photos') = 'array'
                 then jsonb_array_length(r.payload->'photos') else 0 end)
           + (case when jsonb_typeof(r.payload->'photoStorage') = 'array'
                   then jsonb_array_length(r.payload->'photoStorage') else 0 end) as photo_count,
           (r.payload ? 'mapPlacement') as placed,
           (r.payload ? 'location') as geo_located,
           r.created_at, r.updated_at
    from public.crm_records r
    where r.dealer_id = v_dealer and r.entity_type = 'properties' and r.deleted = false
  ),
  engaged as (
    select coalesce(p.property_id, '') as property_id, count(*) as opens
    from public.presentation_events p
    where p.dealer_id = v_dealer and p.created_at >= v_from and coalesce(p.property_id, '') <> ''
    group by 1
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'properties', (select count(*) from props),
      'published', (select count(*) from props where published and not sold),
      'sold', (select count(*) from props where sold),
      'unpublished', (select count(*) from props where not published and not sold),
      'withoutPhotos', (select count(*) from props where photo_count = 0 and not sold),
      'withoutMapPlacement', (select count(*) from props where not placed and not sold),
      'withoutGeoLocation', (select count(*) from props where not geo_located and not sold),
      'addedInWindow', (select count(*) from props where created_at >= v_from)
    ),
    'byCity', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('city', c.city, 'total', c.total, 'available', c.available) as x
        from (select city, count(*) as total, count(*) filter (where published and not sold) as available
              from props where city <> '' group by city) c
        order by c.available desc, c.city asc limit v_top) s), '[]'::jsonb),
    'byWant', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('want', w.want, 'total', w.total, 'available', w.available) as x
        from (select want, count(*) as total, count(*) filter (where published and not sold) as available
              from props where want <> '' group by want) w
        order by w.available desc, w.want asc limit v_top) s), '[]'::jsonb),
    'priceBands', coalesce((select jsonb_agg(x order by x->>'band') from (
        select jsonb_build_object('band', b.band, 'available', b.available) as x
        from (select case
                       when price <= 0 then 'unpriced'
                       when price < 5000000 then 'under-50L'
                       when price < 10000000 then '50L-1Cr'
                       when price < 25000000 then '1Cr-2.5Cr'
                       when price < 50000000 then '2.5Cr-5Cr'
                       else 'above-5Cr'
                     end as band,
                     count(*) filter (where published and not sold) as available
              from props group by 1) b
        where b.available > 0) s), '[]'::jsonb),
    -- Published stock that received zero presentation opens in the window.
    -- This is the raw fact behind "underexposed inventory"; the label is
    -- MAPCO's, the interpretation is the model's.
    'noEngagementInWindow', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object(
          'propertyId', p.id, 'city', p.city, 'sector', p.sector, 'want', p.want,
          'photoCount', p.photo_count, 'placed', p.placed, 'addedAt', p.created_at) as x
        from props p left join engaged e on e.property_id = p.id
        where p.published and not p.sold and coalesce(e.opens, 0) = 0
        order by p.created_at asc limit v_top) s), '[]'::jsonb)
  ) into v_inventory;

  -- ── Map catalog ───────────────────────────────────────────────
  select jsonb_build_object(
    'published', count(*) filter (where status = 'published' and not deleted),
    'clientVisible', count(*) filter (where status = 'published' and client_visible and not deleted),
    'masterplans', count(*) filter (where kind = 'masterplan' and not deleted),
    'sectors', count(*) filter (where kind = 'sector' and not deleted)
  ) into v_maps
  from public.prebuilt_maps where dealer_id = v_dealer;

  -- ── Interest vs stock coverage ────────────────────────────────
  -- A deterministic join, not a judgement: areas with attention and no
  -- available stock, and available stock in areas with no attention.
  with interest as (
    select e.area, count(*) as opens
    from public.presentation_events e
    where e.dealer_id = v_dealer and e.created_at >= v_from and coalesce(e.area, '') <> ''
    group by e.area
  ),
  stock as (
    select coalesce(r.payload->>'city', '') as area, count(*) as available
    from public.crm_records r
    where r.dealer_id = v_dealer and r.entity_type = 'properties' and r.deleted = false
      and coalesce((r.payload->'published') = 'true'::jsonb, false)
      and not coalesce((r.payload->'sold') = 'true'::jsonb, false)
    group by 1
  )
  select jsonb_build_object(
    'interestWithoutStock', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('area', i.area, 'opens', i.opens, 'available', coalesce(s.available, 0)) as x
        from interest i left join stock s on s.area = i.area
        where coalesce(s.available, 0) = 0 and i.opens > 0
        order by i.opens desc limit v_top) t), '[]'::jsonb),
    'stockWithoutInterest', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('area', s.area, 'available', s.available, 'opens', coalesce(i.opens, 0)) as x
        from stock s left join interest i on i.area = s.area
        where s.area <> '' and coalesce(i.opens, 0) = 0
        order by s.available desc limit v_top) t), '[]'::jsonb)
  ) into v_coverage;

  return jsonb_build_object(
    'ok', true,
    'schemaVersion', 'facts-v1',
    'dealerId', v_dealer,
    'generatedAt', v_now,
    'window', jsonb_build_object('days', v_days, 'from', v_from, 'to', v_now),
    'previousWindow', jsonb_build_object('from', v_prev_from, 'to', v_from),
    -- Stated explicitly so an interpreting model cannot invent a person
    -- behind an event. MAPCO knows the activity, not the visitor.
    'identity', jsonb_build_object(
      'presentationVisitorsIdentified', false,
      'clientLinkVisitorsIdentified', false,
      'note', 'Presentation and Client Link activity is anonymous. Counts describe activity, never a known individual.'
    ),
    'presentation', coalesce(v_presentation, '{}'::jsonb),
    'clientLinks', coalesce(v_links, '{}'::jsonb),
    'inventory', coalesce(v_inventory, '{}'::jsonb),
    'maps', coalesce(v_maps, '{}'::jsonb),
    'coverage', coalesce(v_coverage, '{}'::jsonb)
  );
end;
$$;

-- Authenticated self-scoped wrapper. Takes no dealer id: the tenant is
-- always derived from the session, never from the caller's argument.
create or replace function public.plotmap_ai_context_facts(
  p_window_days integer default 7,
  p_top integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
begin
  if v_dealer = '' or not public.plotmap_is_active_member() then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  return public.plotmap_ai_context_facts_for(v_dealer, p_window_days, p_top);
end;
$$;

-- Stable digest of a fact object, used as a cache/reuse key and stored on
-- every execution and artifact for auditability. Volatile fields (the
-- generation timestamp and window bounds) are stripped first so identical
-- underlying facts produce an identical digest.
-- Uses core sha256() (PostgreSQL 11+), not pgcrypto's digest(), so the
-- function has no extension-schema dependency and stays search_path safe.
create or replace function public.plotmap_ai_facts_digest(p_facts jsonb)
returns text
language sql
immutable
as $$
  select encode(
    sha256(
      convert_to(
        (coalesce(p_facts, '{}'::jsonb) - 'generatedAt' - 'window' - 'previousWindow')::text,
        'UTF8'
      )
    ),
    'hex'
  );
$$;

-- ---------- grants ----------
revoke all on function public.plotmap_ai_context_facts_for(text, integer, integer) from public, anon, authenticated;
revoke all on function public.plotmap_ai_context_facts(integer, integer) from public, anon, authenticated;
revoke all on function public.plotmap_ai_facts_digest(jsonb) from public, anon;

-- Dealers may inspect the facts MAPCO would send about their own business.
grant execute on function public.plotmap_ai_context_facts(integer, integer) to authenticated;
grant execute on function public.plotmap_ai_facts_digest(jsonb) to authenticated;

-- The cross-dealer variant is reachable only by the service role inside an
-- Edge Function. It is never exposed to a browser session.
grant execute on function public.plotmap_ai_context_facts_for(text, integer, integer) to service_role;
grant execute on function public.plotmap_ai_facts_digest(jsonb) to service_role;
