-- ============================================================
-- MAPCO · Property Intelligence v3 (finalized two-phase architecture)
-- ------------------------------------------------------------
-- Supersedes the v2 shape created by 20260818000100. That migration
-- stored a fixed 6 Day-to-Day + 6 City Reach result. The finalized
-- architecture stores:
--
--   Phase 1 high-recall universe  → candidate_universe
--   Phase 2 judgment              → phase2_output
--   Phase 3 enriched cards        → local_categories / city_places
--
-- plus everything needed to reconstruct a generation without paying a
-- provider again, and everything needed to audit what it cost.
--
-- NEW GLOBAL (non-tenant) STATE — the two caches that make MAPCO get
-- cheaper as it learns more of a city:
--   place_registry                one Google Place Photo per PLACE,
--                                 reused by every property near it
--   property_intelligence_routes  one route per origin+destination
--
-- Both are deliberately NOT dealer-scoped: a Place Photo of a hospital
-- is not one dealer's data, and duplicating it per dealer would mean
-- paying Google again for a byte-identical image. Neither table is
-- readable or writable by `authenticated`; only the trusted server
-- (service_role) touches them, and the browser only ever sees the
-- resulting public CDN URL embedded in its own dealer-scoped row.
--
-- SECURITY FIX included: plotmap_property_intelligence_get previously
-- checked only that a dealer id existed, so a `viewer` and a member of
-- a suspended dealer could read intelligence — and the property's
-- canonical coordinates — that every sibling read model denies them.
--
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- No destructive drops of existing data.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. property_intelligence — extend to the v3 shape
-- ============================================================

alter table public.property_intelligence
  add column if not exists pipeline_version text,
  add column if not exists phase1_prompt_version text,
  add column if not exists phase2_prompt_version text,
  add column if not exists locality text,
  add column if not exists city text,
  add column if not exists candidate_universe jsonb not null default '[]'::jsonb,
  add column if not exists phase2_output jsonb,
  add column if not exists local_categories jsonb not null default '[]'::jsonb,
  add column if not exists city_places jsonb not null default '[]'::jsonb,
  add column if not exists generation_status text not null default 'idle',
  add column if not exists generation_stage text,
  add column if not exists generation_run_id text,
  add column if not exists generation_started_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists failure_detail text,
  add column if not exists last_cost_inr numeric(10,2),
  add column if not exists last_cost_micro_usd bigint;

-- The v2 result columns stay in place (nothing is dropped) but are no
-- longer written. New rows carry local_categories / city_places.
alter table public.property_intelligence
  alter column day_to_day set default '[]'::jsonb,
  alter column city_reach set default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'property_intelligence_generation_status_check'
  ) then
    alter table public.property_intelligence
      add constraint property_intelligence_generation_status_check
      check (generation_status in ('idle', 'running', 'complete', 'failed'));
  end if;
end$$;

-- The candidate universe is the largest payload (70–110 candidates).
-- 512 KB is generous for that and still bounds a pathological response.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'property_intelligence_universe_size_check'
  ) then
    alter table public.property_intelligence
      add constraint property_intelligence_universe_size_check
      check (octet_length(candidate_universe::text) <= 524288);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'property_intelligence_local_size_check'
  ) then
    alter table public.property_intelligence
      add constraint property_intelligence_local_size_check
      check (octet_length(local_categories::text) <= 262144);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'property_intelligence_city_places_size_check'
  ) then
    alter table public.property_intelligence
      add constraint property_intelligence_city_places_size_check
      check (octet_length(city_places::text) <= 262144);
  end if;
end$$;

create index if not exists property_intelligence_generation_idx
  on public.property_intelligence (generation_status, generation_started_at desc);

-- ============================================================
-- 2. place_registry — ONE Google Place Photo per place, globally
-- ------------------------------------------------------------
-- MAPCO holds written Google approval (Young Founder programme) for
-- persistent storage and reuse of Place Photos; see
-- docs/google-place-photos-approval.md. That approval is why this table
-- is keyed by place_id and NOT by property: the same hospital photo is
-- downloaded once and then served from MAPCO storage to every property
-- near it, for every dealer, forever.
--
-- The cached place FACTS (display name, coordinate, address) live here
-- too. Without them a reused place would still cost a paid Place
-- Details call just to recover the coordinate the route needs.
-- ============================================================
create table if not exists public.place_registry (
  place_id text primary key,
  display_name text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  address text,
  primary_type text,
  google_photo_name text,
  source text not null default 'GOOGLE_PLACE_PHOTO'
    check (source in ('GOOGLE_PLACE_PHOTO')),
  storage_path text,
  public_url text,
  mime_type text,
  width_px integer,
  height_px integer,
  attributions jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('stored', 'unavailable', 'pending')),
  retrieved_at timestamptz,
  -- How many times this stored asset has been reused instead of re-fetched.
  reuse_count bigint not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists place_registry_status_idx
  on public.place_registry (status, updated_at desc);

-- ============================================================
-- 3. property_intelligence_routes — route cache
-- ------------------------------------------------------------
-- Keyed by origin (the property's canonical coordinate, rounded to
-- ~1.1 m, plus a route-contract version) and destination (a stable
-- Google Place ID). Global for the same reason as place_registry: the
-- route from a coordinate to a hospital is not tenant data.
--
-- A property that MOVES produces a different origin key, so its routes
-- are recomputed rather than silently reused — which is exactly the
-- invalidation the finalized architecture requires.
-- ============================================================
create table if not exists public.property_intelligence_routes (
  origin_key text not null,
  destination_key text not null,
  distance_meters integer not null check (distance_meters >= 0),
  duration_seconds integer not null check (duration_seconds >= 0),
  encoded_polyline text not null,
  travel_mode text not null default 'DRIVE' check (travel_mode in ('DRIVE', 'WALK')),
  computed_at timestamptz not null default timezone('utc'::text, now()),
  reuse_count bigint not null default 0,
  primary key (origin_key, destination_key)
);

create index if not exists property_intelligence_routes_computed_idx
  on public.property_intelligence_routes (computed_at desc);

-- ============================================================
-- 4. property_intelligence_cost_events — the ledger
-- ------------------------------------------------------------
-- One row per billable (or cache-avoided) operation. Cache hits are
-- recorded with zero cost so the SAVING is measurable rather than
-- invisible. Aggregatable by generation, property, dealer, day,
-- provider and operation.
--
-- estimated_* is explicitly named: providers report usage units, not
-- money. MAPCO never claims an actual billed cost.
-- ============================================================
create table if not exists public.property_intelligence_cost_events (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  event_index integer not null check (event_index >= 0),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  property_id text not null,
  provider text not null,
  operation text not null,
  requests integer not null default 0 check (requests >= 0),
  units numeric(14,2) not null default 0 check (units >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_hit boolean not null default false,
  estimated_micro_usd bigint not null default 0 check (estimated_micro_usd >= 0),
  estimated_inr numeric(12,4) not null default 0 check (estimated_inr >= 0),
  avoided_micro_usd bigint not null default 0 check (avoided_micro_usd >= 0),
  avoided_inr numeric(12,4) not null default 0 check (avoided_inr >= 0),
  pricing_version text not null,
  inr_per_usd numeric(10,4) not null,
  detail text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint property_intelligence_cost_events_run_event_key unique (run_id, event_index)
);

create index if not exists pi_cost_events_dealer_day_idx
  on public.property_intelligence_cost_events (dealer_id, created_at desc);
create index if not exists pi_cost_events_run_idx
  on public.property_intelligence_cost_events (run_id);
create index if not exists pi_cost_events_property_idx
  on public.property_intelligence_cost_events (dealer_id, property_id, created_at desc);

-- ============================================================
-- 5. property_intelligence_runs — extend for the v3 lifecycle
-- ============================================================
alter table public.property_intelligence_runs
  add column if not exists run_id text,
  add column if not exists pipeline_version text,
  add column if not exists phase1_prompt_version text,
  add column if not exists phase2_prompt_version text,
  add column if not exists stage text,
  add column if not exists candidate_count integer not null default 0,
  add column if not exists resolved_count integer not null default 0,
  add column if not exists selected_count integer not null default 0,
  add column if not exists photos_reused integer not null default 0,
  add column if not exists photos_fetched integer not null default 0,
  add column if not exists routes_reused integer not null default 0,
  add column if not exists routes_computed integer not null default 0,
  add column if not exists estimated_inr numeric(12,4) not null default 0,
  add column if not exists pricing_version text;

create unique index if not exists property_intelligence_runs_run_unique_idx
  on public.property_intelligence_runs (run_id)
  where run_id is not null;

-- ============================================================
-- 6. RLS — align with every sibling MAPCO read model
-- ------------------------------------------------------------
-- The v2 policies checked only plotmap_is_active_member(). Every other
-- dealer read model added, in 20260814000400, a viewer exclusion and an
-- account-state gate. Property Intelligence never received them, so a
-- Presentation-only viewer and a suspended dealer could read cached
-- intelligence and run cost data. Fixed here.
-- ============================================================
alter table public.property_intelligence enable row level security;
alter table public.property_intelligence_runs enable row level security;
alter table public.place_registry enable row level security;
alter table public.property_intelligence_routes enable row level security;
alter table public.property_intelligence_cost_events enable row level security;

drop policy if exists "property intelligence dealer read" on public.property_intelligence;
create policy "property intelligence dealer read"
  on public.property_intelligence for select to authenticated
  using (
    public.plotmap_is_active_member()
    and public.plotmap_current_role() <> 'viewer'
    and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
    and dealer_id = public.plotmap_current_dealer_id()
  );

drop policy if exists "property intelligence runs dealer read" on public.property_intelligence_runs;
create policy "property intelligence runs dealer read"
  on public.property_intelligence_runs for select to authenticated
  using (
    public.plotmap_is_active_member()
    and public.plotmap_current_role() in ('owner', 'manager')
    and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
    and dealer_id = public.plotmap_current_dealer_id()
  );

-- Cost is commercial information: owners and managers only.
drop policy if exists "property intelligence cost read" on public.property_intelligence_cost_events;
create policy "property intelligence cost read"
  on public.property_intelligence_cost_events for select to authenticated
  using (
    public.plotmap_is_active_member()
    and public.plotmap_current_role() in ('owner', 'manager')
    and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
    and dealer_id = public.plotmap_current_dealer_id()
  );

-- Dealer reads use the narrow SECURITY DEFINER RPCs below. Direct table
-- access stays closed so commercial cost columns and canonical origins are
-- never exposed merely because a future browser query names the table.
revoke all on table public.property_intelligence from public, anon, authenticated;
revoke all on table public.property_intelligence_runs from public, anon, authenticated;

-- The two global caches are server-only. RLS is enabled with NO policy for
-- authenticated, so PostgREST returns nothing even if a grant regresses.
revoke all on table public.place_registry from public, anon, authenticated;
revoke all on table public.property_intelligence_routes from public, anon, authenticated;
revoke all on table public.property_intelligence_cost_events from public, anon, authenticated;

-- 20260801002200 grants service_role ALL on future public tables. Narrow the
-- three v3 tables explicitly so the ledger remains append-only and cache
-- deletion cannot happen through generic PostgREST table access.
revoke all on table public.place_registry from service_role;
revoke all on table public.property_intelligence_routes from service_role;
revoke all on table public.property_intelligence_cost_events from service_role;
revoke all on table public.property_intelligence from service_role;
revoke all on table public.property_intelligence_runs from service_role;
grant select on table public.property_intelligence to service_role;
grant select, insert on table public.property_intelligence_runs to service_role;
grant select, insert, update on table public.place_registry to service_role;
grant select, insert, update on table public.property_intelligence_routes to service_role;
grant select, insert on table public.property_intelligence_cost_events to service_role;

-- ============================================================
-- 7. Caller-facing read — dealer derived from auth.uid()
-- ------------------------------------------------------------
-- Returns the property's canonical location (authoritative; the server
-- never trusts a client-supplied coordinate) plus the current stored
-- result, so the Edge Function can decide hit vs regenerate.
-- ============================================================
create or replace function public.plotmap_property_intelligence_get(p_property_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dealer text := nullif(public.plotmap_current_dealer_id(), '');
  v_prop record;
  v_cached public.property_intelligence%rowtype;
begin
  -- Same gate as every sibling Desk read model: an active member, not a
  -- Presentation-only viewer, on an account that is actually active.
  if auth.uid() is null
     or v_dealer is null
     or not public.plotmap_is_active_member()
     or public.plotmap_current_role() = 'viewer'
     or not public.plotmap_dealer_is_active(v_dealer) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  select r.payload as payload
    into v_prop
  from public.crm_records r
  where r.id = p_property_id
    and r.entity_type = 'properties'
    and r.dealer_id = v_dealer
    and coalesce(r.deleted, false) = false
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'property_not_found');
  end if;

  select *
    into v_cached
  from public.property_intelligence
  where dealer_id = v_dealer and property_id = p_property_id
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'dealerId', v_dealer,
    'propertyId', p_property_id,
    'location', v_prop.payload -> 'location',
    'locality', coalesce(
      nullif(trim(v_prop.payload ->> 'sector'), ''),
      nullif(trim(v_prop.payload ->> 'area'), ''), ''),
    'city', coalesce(nullif(trim(v_prop.payload ->> 'city'), ''), ''),
    'propertyType', coalesce(nullif(trim(v_prop.payload ->> 'type'), ''), ''),
    'cached', case when v_cached.id is null then null else jsonb_build_object(
      'inputDigest', v_cached.input_digest,
      'schemaVersion', v_cached.schema_version,
      'pipelineVersion', v_cached.pipeline_version,
      'phase1PromptVersion', v_cached.phase1_prompt_version,
      'phase2PromptVersion', v_cached.phase2_prompt_version,
      'provider', v_cached.provider,
      'model', v_cached.model,
      'status', v_cached.status,
      'reason', v_cached.reason,
      'generationStatus', v_cached.generation_status,
      'generationStage', v_cached.generation_stage,
      'generationStartedAt', v_cached.generation_started_at,
      'failureReason', v_cached.failure_reason,
      'generatedAt', v_cached.generated_at,
      'origin', case
        when v_cached.latitude is null then null
        else jsonb_build_object('latitude', v_cached.latitude, 'longitude', v_cached.longitude)
      end,
      'local', v_cached.local_categories,
      'city', v_cached.city_places
    ) end
  );
end;
$$;

-- ============================================================
-- 8. Generation lease — idempotency and duplicate-spend protection
-- ------------------------------------------------------------
-- A double-click, a refresh loop or two tabs must not start two paid
-- pipelines for the same property. A run CLAIMS the property with a
-- lease; a second caller is told to wait rather than spending again.
-- The lease expires so a crashed run cannot wedge a property forever.
-- ============================================================
create or replace function public.plotmap_property_intelligence_claim(
  p_dealer_id text,
  p_property_id text,
  p_run_id text,
  p_lease_seconds integer default 180
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_existing public.property_intelligence%rowtype;
  v_lease interval := make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 180), 900)));
begin
  if v_dealer = '' or coalesce(trim(p_property_id), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Serialize claims for this dealer so two concurrent callers cannot both
  -- observe "idle" and both start a paid generation.
  perform pg_advisory_xact_lock(hashtext('pi_claim:' || v_dealer || ':' || p_property_id));

  select * into v_existing
  from public.property_intelligence
  where dealer_id = v_dealer and property_id = p_property_id
  for update;

  if found
     and v_existing.generation_status = 'running'
     and v_existing.generation_started_at is not null
     and v_existing.generation_started_at > timezone('utc'::text, now()) - v_lease then
    return jsonb_build_object(
      'ok', false, 'reason', 'already_running',
      'runId', v_existing.generation_run_id,
      'startedAt', v_existing.generation_started_at
    );
  end if;

  if found then
    update public.property_intelligence
      set generation_status = 'running',
          generation_stage = 'queued',
          generation_run_id = p_run_id,
          generation_started_at = timezone('utc'::text, now()),
          updated_at = timezone('utc'::text, now())
      where id = v_existing.id;
  else
    insert into public.property_intelligence (
      dealer_id, property_id, schema_version, provider, model,
      latitude, longitude, input_digest, status,
      generation_status, generation_stage, generation_run_id, generation_started_at
    ) values (
      v_dealer, p_property_id, 0, 'pending', 'pending',
      0, 0, '', 'unavailable',
      'running', 'queued', p_run_id, timezone('utc'::text, now())
    );
  end if;

  return jsonb_build_object('ok', true, 'runId', p_run_id);
end;
$$;

create or replace function public.plotmap_property_intelligence_release(
  p_dealer_id text,
  p_property_id text,
  p_run_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
begin
  if v_dealer = '' then return; end if;
  update public.property_intelligence
    set generation_status = case when generation_status = 'running' then 'idle' else generation_status end,
        updated_at = timezone('utc'::text, now())
    where dealer_id = v_dealer
      and property_id = p_property_id
      and generation_run_id = p_run_id
      and generation_status = 'running';
end;
$$;

-- ============================================================
-- 9. Service-role writers (Edge Function only)
-- ============================================================
create or replace function public.plotmap_property_intelligence_store_v3(
  p_dealer_id text,
  p_property_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_run_id text := nullif(trim(coalesce(p_payload ->> 'runId', '')), '');
  v_id uuid;
begin
  if v_dealer = '' or coalesce(trim(p_property_id), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_run_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_run_id');
  end if;

  -- Fencing token: only the worker that owns the CURRENT lease may publish.
  -- An expired/stale worker can still finish a provider call, but it cannot
  -- overwrite a newer generation that has since claimed this property.
  update public.property_intelligence
     set schema_version = coalesce((p_payload ->> 'schemaVersion')::integer, 0),
         pipeline_version = p_payload ->> 'pipelineVersion',
         phase1_prompt_version = p_payload ->> 'phase1PromptVersion',
         phase2_prompt_version = p_payload ->> 'phase2PromptVersion',
         provider = coalesce(p_payload ->> 'provider', 'unknown'),
         model = coalesce(p_payload ->> 'model', 'unknown'),
         latitude = coalesce((p_payload -> 'origin' ->> 'latitude')::double precision, 0),
         longitude = coalesce((p_payload -> 'origin' ->> 'longitude')::double precision, 0),
         location_updated_at = nullif(p_payload ->> 'locationUpdatedAt', '')::timestamptz,
         locality = p_payload ->> 'locality',
         city = p_payload ->> 'city',
         input_digest = coalesce(p_payload ->> 'inputDigest', ''),
         status = coalesce(p_payload ->> 'status', 'unavailable'),
         reason = p_payload ->> 'reason',
         candidate_universe = coalesce(p_payload -> 'candidateUniverse', '[]'::jsonb),
         phase2_output = p_payload -> 'phase2Output',
         local_categories = coalesce(p_payload -> 'local', '[]'::jsonb),
         city_places = coalesce(p_payload -> 'cityPlaces', '[]'::jsonb),
         generation_status = coalesce(p_payload ->> 'generationStatus', 'complete'),
         generation_stage = p_payload ->> 'generationStage',
         failure_reason = p_payload ->> 'failureReason',
         failure_detail = left(coalesce(p_payload ->> 'failureDetail', ''), 500),
         last_cost_inr = nullif(p_payload ->> 'costInr', '')::numeric,
         last_cost_micro_usd = nullif(p_payload ->> 'costMicroUsd', '')::bigint,
         generated_at = timezone('utc'::text, now()),
         updated_at = timezone('utc'::text, now())
   where dealer_id = v_dealer
     and property_id = p_property_id
     and generation_status = 'running'
     and generation_run_id = v_run_id
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'stale_generation');
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'runId', v_run_id);
end;
$$;

-- Batched place-registry read. Also bumps reuse_count so the value of the
-- global photo cache is measurable rather than assumed.
create or replace function public.plotmap_place_registry_get(p_place_ids text[])
returns setof public.place_registry
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_place_ids is null or array_length(p_place_ids, 1) is null then
    return;
  end if;
  update public.place_registry
    set reuse_count = reuse_count + 1
    where place_id = any(p_place_ids) and status = 'stored';
  return query
    select * from public.place_registry where place_id = any(p_place_ids);
end;
$$;

create or replace function public.plotmap_place_registry_put(p_payload jsonb)
returns public.place_registry
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.place_registry;
begin
  insert into public.place_registry as pr (
    place_id, display_name, latitude, longitude, address, primary_type,
    google_photo_name, storage_path, public_url, mime_type,
    width_px, height_px, attributions, status, retrieved_at, updated_at
  ) values (
    p_payload ->> 'placeId',
    p_payload ->> 'displayName',
    nullif(p_payload ->> 'latitude', '')::double precision,
    nullif(p_payload ->> 'longitude', '')::double precision,
    p_payload ->> 'address',
    p_payload ->> 'primaryType',
    p_payload ->> 'googlePhotoName',
    p_payload ->> 'storagePath',
    p_payload ->> 'publicUrl',
    p_payload ->> 'mimeType',
    nullif(p_payload ->> 'widthPx', '')::integer,
    nullif(p_payload ->> 'heightPx', '')::integer,
    coalesce(p_payload -> 'attributions', '[]'::jsonb),
    coalesce(p_payload ->> 'status', 'pending'),
    nullif(p_payload ->> 'retrievedAt', '')::timestamptz,
    timezone('utc'::text, now())
  )
  on conflict (place_id) do update set
    display_name = coalesce(excluded.display_name, pr.display_name),
    latitude = coalesce(excluded.latitude, pr.latitude),
    longitude = coalesce(excluded.longitude, pr.longitude),
    address = coalesce(excluded.address, pr.address),
    primary_type = coalesce(excluded.primary_type, pr.primary_type),
    google_photo_name = coalesce(excluded.google_photo_name, pr.google_photo_name),
    -- Never downgrade a stored asset to unavailable on a later failure.
    storage_path = case when excluded.status = 'stored' then excluded.storage_path else pr.storage_path end,
    public_url = case when excluded.status = 'stored' then excluded.public_url else pr.public_url end,
    mime_type = coalesce(excluded.mime_type, pr.mime_type),
    width_px = coalesce(excluded.width_px, pr.width_px),
    height_px = coalesce(excluded.height_px, pr.height_px),
    attributions = case when jsonb_array_length(excluded.attributions) > 0
                        then excluded.attributions else pr.attributions end,
    status = case when pr.status = 'stored' then 'stored' else excluded.status end,
    retrieved_at = coalesce(excluded.retrieved_at, pr.retrieved_at),
    updated_at = timezone('utc'::text, now())
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.plotmap_pi_routes_get(
  p_origin_key text, p_destination_keys text[]
)
returns setof public.property_intelligence_routes
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_origin_key is null or p_destination_keys is null
     or array_length(p_destination_keys, 1) is null then
    return;
  end if;
  update public.property_intelligence_routes
    set reuse_count = reuse_count + 1
    where origin_key = p_origin_key and destination_key = any(p_destination_keys);
  return query
    select * from public.property_intelligence_routes
    where origin_key = p_origin_key and destination_key = any(p_destination_keys);
end;
$$;

create or replace function public.plotmap_pi_routes_put(
  p_origin_key text,
  p_destination_key text,
  p_distance_meters integer,
  p_duration_seconds integer,
  p_encoded_polyline text,
  p_travel_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.property_intelligence_routes as r (
    origin_key, destination_key, distance_meters, duration_seconds,
    encoded_polyline, travel_mode, computed_at
  ) values (
    p_origin_key, p_destination_key, greatest(0, coalesce(p_distance_meters, 0)),
    greatest(0, coalesce(p_duration_seconds, 0)), coalesce(p_encoded_polyline, ''),
    case when upper(coalesce(p_travel_mode, 'DRIVE')) = 'WALK' then 'WALK' else 'DRIVE' end,
    timezone('utc'::text, now())
  )
  on conflict (origin_key, destination_key) do update set
    distance_meters = excluded.distance_meters,
    duration_seconds = excluded.duration_seconds,
    encoded_polyline = excluded.encoded_polyline,
    travel_mode = excluded.travel_mode,
    computed_at = excluded.computed_at;
end;
$$;

-- Append the whole ledger for one run in a single call.
create or replace function public.plotmap_pi_record_cost(
  p_dealer_id text,
  p_property_id text,
  p_run_id text,
  p_pricing_version text,
  p_inr_per_usd numeric,
  p_events jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_count integer := 0;
begin
  if v_dealer = '' or p_events is null or jsonb_typeof(p_events) <> 'array' then
    return 0;
  end if;
  insert into public.property_intelligence_cost_events (
    run_id, event_index, dealer_id, property_id, provider, operation, requests, units,
    input_tokens, output_tokens, cache_hit, estimated_micro_usd,
    estimated_inr, avoided_micro_usd, avoided_inr,
    pricing_version, inr_per_usd, detail
  )
  select
    p_run_id, event_index::integer, v_dealer, p_property_id,
    coalesce(e ->> 'provider', 'unknown'),
    coalesce(e ->> 'operation', 'unknown'),
    coalesce((e ->> 'requests')::integer, 0),
    coalesce((e ->> 'units')::numeric, 0),
    coalesce((e ->> 'inputTokens')::integer, 0),
    coalesce((e ->> 'outputTokens')::integer, 0),
    coalesce((e ->> 'cacheHit')::boolean, false),
    coalesce((e ->> 'estimatedMicroUsd')::bigint, 0),
    coalesce((e ->> 'estimatedInr')::numeric, 0),
    coalesce((e ->> 'avoidedMicroUsd')::bigint, 0),
    coalesce((e ->> 'avoidedInr')::numeric, 0),
    coalesce(p_pricing_version, 'unknown'),
    coalesce(p_inr_per_usd, 0),
    left(coalesce(e ->> 'detail', ''), 200)
  from jsonb_array_elements(p_events) with ordinality as event(e, event_index)
  where jsonb_typeof(e) = 'object'
  on conflict (run_id, event_index) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- One idempotent lifecycle row per generation or persisted-result cache hit.
-- Unlike the legacy v2 recorder this captures all v3 counts and versions.
create or replace function public.plotmap_property_intelligence_record_run_v3(
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_payload ->> 'dealerId', '')));
  v_run_id text := nullif(trim(coalesce(p_payload ->> 'runId', '')), '');
  v_id uuid;
begin
  if v_dealer = '' or v_run_id is null
     or coalesce(trim(p_payload ->> 'propertyId'), '') = '' then
    return null;
  end if;

  insert into public.property_intelligence_runs as pir (
    run_id, dealer_id, property_id, provider, model,
    pipeline_version, phase1_prompt_version, phase2_prompt_version, stage,
    input_tokens, output_tokens, grounding_queries, places_calls,
    matrix_elements, route_calls, repair_attempts, cost_micro_usd,
    estimated_inr, pricing_version, cache_outcome, refresh_reason,
    latency_ms, status, error, candidate_count, resolved_count,
    selected_count, photos_reused, photos_fetched, routes_reused,
    routes_computed
  ) values (
    v_run_id, v_dealer, p_payload ->> 'propertyId',
    coalesce(p_payload ->> 'provider', 'unknown'),
    coalesce(p_payload ->> 'model', 'unknown'),
    p_payload ->> 'pipelineVersion',
    p_payload ->> 'phase1PromptVersion',
    p_payload ->> 'phase2PromptVersion',
    p_payload ->> 'stage',
    greatest(0, coalesce((p_payload ->> 'inputTokens')::integer, 0)),
    greatest(0, coalesce((p_payload ->> 'outputTokens')::integer, 0)),
    greatest(0, coalesce((p_payload ->> 'groundingQueries')::integer, 0)),
    greatest(0, coalesce((p_payload ->> 'placesCalls')::integer, 0)),
    0,
    greatest(0, coalesce((p_payload ->> 'routeCalls')::integer, 0)),
    greatest(0, coalesce((p_payload ->> 'repairAttempts')::integer, 0)),
    greatest(0::bigint, coalesce((p_payload ->> 'costMicroUsd')::bigint, 0)),
    greatest(0::numeric, coalesce((p_payload ->> 'estimatedInr')::numeric, 0)),
    coalesce(p_payload ->> 'pricingVersion', 'unknown'),
    coalesce(p_payload ->> 'cacheOutcome', 'miss'),
    p_payload ->> 'refreshReason',
    greatest(0, coalesce((p_payload ->> 'latencyMs')::integer, 0)),
    coalesce(p_payload ->> 'status', 'failed'),
    left(coalesce(p_payload ->> 'error', ''), 500),
    greatest(0, coalesce((p_payload ->> 'candidateCount')::integer, 0)),
    greatest(0, coalesce((p_payload ->> 'resolvedCount')::integer, 0)),
    greatest(0, coalesce((p_payload ->> 'selectedCount')::integer, 0)),
    greatest(0, coalesce((p_payload ->> 'photosReused')::integer, 0)),
    greatest(0, coalesce((p_payload ->> 'photosFetched')::integer, 0)),
    greatest(0, coalesce((p_payload ->> 'routesReused')::integer, 0)),
    greatest(0, coalesce((p_payload ->> 'routesComputed')::integer, 0))
  )
  on conflict (run_id) where run_id is not null do update set
    provider = excluded.provider,
    model = excluded.model,
    pipeline_version = excluded.pipeline_version,
    phase1_prompt_version = excluded.phase1_prompt_version,
    phase2_prompt_version = excluded.phase2_prompt_version,
    stage = excluded.stage,
    input_tokens = excluded.input_tokens,
    output_tokens = excluded.output_tokens,
    grounding_queries = excluded.grounding_queries,
    places_calls = excluded.places_calls,
    route_calls = excluded.route_calls,
    repair_attempts = excluded.repair_attempts,
    cost_micro_usd = excluded.cost_micro_usd,
    estimated_inr = excluded.estimated_inr,
    pricing_version = excluded.pricing_version,
    cache_outcome = excluded.cache_outcome,
    refresh_reason = excluded.refresh_reason,
    latency_ms = excluded.latency_ms,
    status = excluded.status,
    error = excluded.error,
    candidate_count = excluded.candidate_count,
    resolved_count = excluded.resolved_count,
    selected_count = excluded.selected_count,
    photos_reused = excluded.photos_reused,
    photos_fetched = excluded.photos_fetched,
    routes_reused = excluded.routes_reused,
    routes_computed = excluded.routes_computed
  returning id into v_id;
  return v_id;
end;
$$;

-- ============================================================
-- 10. Dealer-facing cost rollup (owner/manager)
-- ============================================================
create or replace function public.plotmap_pi_cost_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dealer text := nullif(public.plotmap_current_dealer_id(), '');
  v_since timestamptz := timezone('utc'::text, now())
    - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_result jsonb;
begin
  if auth.uid() is null
     or v_dealer is null
     or not public.plotmap_is_active_member()
     or public.plotmap_current_role() not in ('owner', 'manager')
     or not public.plotmap_dealer_is_active(v_dealer) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  select jsonb_build_object(
    'ok', true,
    'sinceDays', greatest(1, least(coalesce(p_days, 30), 365)),
    'totalInr', coalesce(round(sum(estimated_inr), 2), 0),
    'savedInr', coalesce(round(sum(avoided_inr), 2), 0),
    'generations', count(distinct run_id),
    'properties', count(distinct property_id),
    'cacheHits', count(*) filter (where cache_hit),
    'byOperation', coalesce(jsonb_agg(distinct jsonb_build_object('operation', operation)) , '[]'::jsonb)
  )
  into v_result
  from public.property_intelligence_cost_events
  where dealer_id = v_dealer and created_at >= v_since;

  return coalesce(v_result, jsonb_build_object('ok', true, 'totalInr', 0));
end;
$$;

-- ============================================================
-- 11. Storage — place-media bucket (public read, service-role write)
-- ------------------------------------------------------------
-- Google Place Photos are GLOBAL content: the same image serves every
-- property near that place, for every dealer. Nothing in this bucket is
-- tenant data, so it is public-read and CDN-served — which is also what
-- makes reuse free. Writes are service_role only; no browser and no
-- `authenticated` role can put an object here.
--
-- This is deliberately NOT the same posture as the legacy `maps` bucket,
-- which is public and holds DRAFT DEALER MAPS. That one is a genuine
-- problem; this one is not.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'place-media', 'place-media', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "place media service insert" on storage.objects;
create policy "place media service insert"
  on storage.objects for insert to service_role
  with check (bucket_id = 'place-media');

drop policy if exists "place media service update" on storage.objects;
create policy "place media service update"
  on storage.objects for update to service_role
  using (bucket_id = 'place-media')
  with check (bucket_id = 'place-media');

drop policy if exists "place media service delete" on storage.objects;
create policy "place media service delete"
  on storage.objects for delete to service_role
  using (bucket_id = 'place-media');

-- ============================================================
-- 12. Grants
-- ============================================================
revoke all on function public.plotmap_property_intelligence_get(text) from public, anon, authenticated;
grant execute on function public.plotmap_property_intelligence_get(text) to authenticated;

revoke all on function public.plotmap_pi_cost_summary(integer) from public, anon, authenticated;
grant execute on function public.plotmap_pi_cost_summary(integer) to authenticated;

revoke all on function public.plotmap_property_intelligence_claim(text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.plotmap_property_intelligence_claim(text, text, text, integer) to service_role;

revoke all on function public.plotmap_property_intelligence_release(text, text, text)
  from public, anon, authenticated;
grant execute on function public.plotmap_property_intelligence_release(text, text, text) to service_role;

revoke all on function public.plotmap_property_intelligence_store_v3(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.plotmap_property_intelligence_store_v3(text, text, jsonb) to service_role;

revoke all on function public.plotmap_place_registry_get(text[]) from public, anon, authenticated;
grant execute on function public.plotmap_place_registry_get(text[]) to service_role;

revoke all on function public.plotmap_place_registry_put(jsonb) from public, anon, authenticated;
grant execute on function public.plotmap_place_registry_put(jsonb) to service_role;

revoke all on function public.plotmap_pi_routes_get(text, text[]) from public, anon, authenticated;
grant execute on function public.plotmap_pi_routes_get(text, text[]) to service_role;

revoke all on function public.plotmap_pi_routes_put(text, text, integer, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.plotmap_pi_routes_put(text, text, integer, integer, text, text) to service_role;

revoke all on function public.plotmap_pi_record_cost(text, text, text, text, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.plotmap_pi_record_cost(text, text, text, text, numeric, jsonb) to service_role;

revoke all on function public.plotmap_property_intelligence_record_run_v3(jsonb)
  from public, anon, authenticated;
grant execute on function public.plotmap_property_intelligence_record_run_v3(jsonb) to service_role;

-- NOTE: property_intelligence, property_intelligence_runs and
-- property_intelligence_cost_events all cascade from dealer_settings, so
-- plotmap_admin_delete_dealer removes every intelligence row when a dealer
-- is purged. place_registry and property_intelligence_routes deliberately
-- do NOT cascade: they hold no tenant data and their value is that they
-- outlive any one dealer.

-- ============================================================
-- 13. Client-link Property Intelligence (buyer surface)
-- ------------------------------------------------------------
-- A buyer holding a valid client link may see Property Intelligence for
-- the properties on that link. This RPC is the ONLY path to it and is
-- service_role only: it is called by the resolve-client-link Edge
-- Function, which then applies the buyer-safe projection in TypeScript
-- (toBuyerSafeIntelligence) before anything reaches the browser.
--
-- What this returns is deliberately NOT buyer-safe yet — it is the stored
-- dealer payload plus the link's location visibility, so the projection
-- has the information it needs to decide what to strip. Nothing here is
-- reachable by anon or authenticated.
--
-- Results are returned in the link's own property order, so the caller
-- can align them with the frozen client snapshot by index without ever
-- exposing a real property id to the buyer.
-- ============================================================
create or replace function public.plotmap_client_link_intelligence(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_link record;
  v_items jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select s.id, s.dealer_id, s.property_ids, s.status, s.expires_at,
         coalesce(s.metadata -> 'client_snapshot' -> 'visibility' ->> 'location', 'area') as location_visibility
    into v_link
  from public.share_links s
  where s.token_hash = encode(extensions.digest(lower(p_token), 'sha256'), 'hex')
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_link.status is distinct from 'active' then
    return jsonb_build_object('ok', false, 'reason', 'revoked');
  end if;
  if v_link.expires_at is not null and v_link.expires_at < timezone('utc'::text, now()) then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  -- A suspended or expired dealer stops serving intelligence, exactly as
  -- every other dealer surface does.
  if not public.plotmap_dealer_is_active(v_link.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;

  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
    into v_items
  from (
    select x.ord,
           jsonb_build_object(
             'index', x.ord - 1,
             'status', coalesce(pi.status, 'unavailable'),
             'generatedAt', pi.generated_at,
             'local', coalesce(pi.local_categories, '[]'::jsonb),
             'city', coalesce(pi.city_places, '[]'::jsonb),
             'origin', case
               when pi.latitude is null then null
               else jsonb_build_object('latitude', pi.latitude, 'longitude', pi.longitude)
             end
           ) as item
    from unnest(v_link.property_ids) with ordinality as x(id, ord)
    left join public.property_intelligence pi
      on pi.dealer_id = v_link.dealer_id
     and pi.property_id = x.id
     -- Only a property that is still client-visible may carry intelligence
     -- to a buyer; a sold or unpublished property is dropped here as well
     -- as in the snapshot resolver.
    left join public.crm_records r
      on r.dealer_id = v_link.dealer_id
     and r.id = x.id
     and r.entity_type = 'properties'
     and coalesce(r.deleted, false) = false
    where r.id is not null
      and lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'
      and lower(coalesce(r.payload ->> 'clientVisible', 'true')) = 'true'
  ) rows;

  return jsonb_build_object(
    'ok', true,
    'locationVisibility', v_link.location_visibility,
    'properties', coalesce(v_items, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.plotmap_client_link_intelligence(text)
  from public, anon, authenticated;
grant execute on function public.plotmap_client_link_intelligence(text) to service_role;
