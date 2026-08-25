-- ============================================================
-- MAPCO · Property Intelligence (Day-to-Day + City Reach)
-- ------------------------------------------------------------
-- Persists the verified location-proof for a property so Gemini +
-- Google are paid ONCE per property, then served from cache:
--
--   property_intelligence       one current result per dealer+property
--   property_intelligence_runs  append-only cost / usage audit
--
-- Security posture is identical to the rest of MAPCO and the AI
-- foundation this reuses:
--   • dealer_id is the tenant key, always derived from auth.uid()
--     via plotmap_current_dealer_id(). No caller-facing RPC accepts
--     a dealer id; the store/record RPCs are service-role only.
--   • RLS on both tables; authenticated callers SELECT their own rows
--     only. All writes go through SECURITY DEFINER RPCs / service role
--     inside the Edge Function.
--   • No provider credential is ever stored in the database.
--   • Both tables cascade from dealer_settings, so a dealer purge
--     removes every intelligence row.
--
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY
-- IF EXISTS only. No drops, deletes or truncates.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. cached result (one current row per dealer+property) ----------
create table if not exists public.property_intelligence (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  property_id text not null,
  schema_version integer not null,
  provider text not null,
  model text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- When Property.location last changed — part of the invalidation identity.
  location_updated_at timestamptz,
  -- sha256 of (dealer, property, coordinate, updatedAt, schema, provider, model).
  input_digest text not null,
  status text not null default 'ready' check (status in ('ready', 'unavailable')),
  reason text,
  day_to_day jsonb not null default '[]'::jsonb,
  city_reach jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint property_intelligence_day_size_check check (octet_length(day_to_day::text) <= 32768),
  constraint property_intelligence_city_size_check check (octet_length(city_reach::text) <= 32768),
  unique (dealer_id, property_id)
);

-- ---------- 2. append-only cost / usage audit ----------
-- One row per generation attempt (and per cache hit), mirroring the
-- ai_executions cost spine: enough to compute real cost per property.
create table if not exists public.property_intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  property_id text not null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  grounding_queries integer not null default 0,
  places_calls integer not null default 0,
  matrix_elements integer not null default 0,
  route_calls integer not null default 0,
  repair_attempts integer not null default 0,
  cost_micro_usd bigint not null default 0 check (cost_micro_usd >= 0),
  cache_outcome text not null check (cache_outcome in ('hit', 'miss', 'refresh', 'stale_refresh')),
  refresh_reason text,
  latency_ms integer,
  status text not null check (status in ('succeeded', 'unavailable', 'failed')),
  error text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists property_intelligence_runs_dealer_idx
  on public.property_intelligence_runs (dealer_id, property_id, created_at desc);

-- ---------- 3. RLS: read-own-rows only ----------
alter table public.property_intelligence enable row level security;
alter table public.property_intelligence_runs enable row level security;

revoke all on table public.property_intelligence from public, anon, authenticated;
revoke all on table public.property_intelligence_runs from public, anon, authenticated;

grant select on table public.property_intelligence to authenticated;
grant select on table public.property_intelligence_runs to authenticated;

drop policy if exists "property intelligence dealer read" on public.property_intelligence;
create policy "property intelligence dealer read"
  on public.property_intelligence for select to authenticated
  using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "property intelligence runs dealer read" on public.property_intelligence_runs;
create policy "property intelligence runs dealer read"
  on public.property_intelligence_runs for select to authenticated
  using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

-- ---------- 4. Caller-facing read (dealer derived from auth.uid) ----------
-- Returns the property's canonical location (authoritative — the server
-- never trusts a client-supplied coordinate) and the current cached result,
-- so the Edge Function can decide hit vs regenerate. SECURITY DEFINER but
-- re-derives the dealer, so a caller can only ever read their own property.
create or replace function public.plotmap_property_intelligence_get(p_property_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_loc jsonb;
  v_cached public.property_intelligence%rowtype;
begin
  if v_dealer is null or v_dealer = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_dealer');
  end if;

  select r.payload -> 'location'
    into v_loc
  from public.crm_records r
  where r.id = p_property_id
    and r.entity_type = 'properties'
    and r.dealer_id = v_dealer
    and r.deleted = false
  limit 1;

  select *
    into v_cached
  from public.property_intelligence
  where dealer_id = v_dealer and property_id = p_property_id
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'dealerId', v_dealer,
    'propertyId', p_property_id,
    'location', v_loc,
    'cached', case when v_cached.id is null then null else jsonb_build_object(
      'inputDigest', v_cached.input_digest,
      'schemaVersion', v_cached.schema_version,
      'provider', v_cached.provider,
      'model', v_cached.model,
      'status', v_cached.status,
      'reason', v_cached.reason,
      'generatedAt', v_cached.generated_at,
      'dayToDay', v_cached.day_to_day,
      'cityReach', v_cached.city_reach
    ) end
  );
end;
$$;

-- ---------- 5. Service-role writers (Edge Function only) ----------
create or replace function public.plotmap_property_intelligence_store(
  p_dealer_id text,
  p_property_id text,
  p_schema_version integer,
  p_provider text,
  p_model text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_updated_at timestamptz,
  p_input_digest text,
  p_status text,
  p_reason text,
  p_day_to_day jsonb,
  p_city_reach jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_id uuid;
begin
  if v_dealer = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_dealer');
  end if;

  insert into public.property_intelligence as pi (
    dealer_id, property_id, schema_version, provider, model,
    latitude, longitude, location_updated_at, input_digest,
    status, reason, day_to_day, city_reach, generated_at, updated_at
  ) values (
    v_dealer, p_property_id, p_schema_version, p_provider, p_model,
    p_latitude, p_longitude, p_location_updated_at, p_input_digest,
    coalesce(p_status, 'ready'), p_reason,
    coalesce(p_day_to_day, '[]'::jsonb), coalesce(p_city_reach, '[]'::jsonb),
    timezone('utc'::text, now()), timezone('utc'::text, now())
  )
  on conflict (dealer_id, property_id) do update set
    schema_version = excluded.schema_version,
    provider = excluded.provider,
    model = excluded.model,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    location_updated_at = excluded.location_updated_at,
    input_digest = excluded.input_digest,
    status = excluded.status,
    reason = excluded.reason,
    day_to_day = excluded.day_to_day,
    city_reach = excluded.city_reach,
    generated_at = excluded.generated_at,
    updated_at = timezone('utc'::text, now())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.plotmap_property_intelligence_record_run(
  p_dealer_id text,
  p_property_id text,
  p_provider text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_grounding_queries integer,
  p_places_calls integer,
  p_matrix_elements integer,
  p_route_calls integer,
  p_repair_attempts integer,
  p_cost_micro_usd bigint,
  p_cache_outcome text,
  p_refresh_reason text,
  p_latency_ms integer,
  p_status text,
  p_error text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_id uuid;
begin
  if v_dealer = '' then return null; end if;
  insert into public.property_intelligence_runs (
    dealer_id, property_id, provider, model,
    input_tokens, output_tokens, grounding_queries, places_calls,
    matrix_elements, route_calls, repair_attempts, cost_micro_usd,
    cache_outcome, refresh_reason, latency_ms, status, error
  ) values (
    v_dealer, p_property_id, p_provider, p_model,
    coalesce(p_input_tokens, 0), coalesce(p_output_tokens, 0),
    coalesce(p_grounding_queries, 0), coalesce(p_places_calls, 0),
    coalesce(p_matrix_elements, 0), coalesce(p_route_calls, 0),
    coalesce(p_repair_attempts, 0), coalesce(p_cost_micro_usd, 0),
    coalesce(p_cache_outcome, 'miss'), p_refresh_reason, p_latency_ms,
    coalesce(p_status, 'succeeded'), p_error
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- 6. Grants ----------
revoke all on function public.plotmap_property_intelligence_get(text) from public, anon, authenticated;
grant execute on function public.plotmap_property_intelligence_get(text) to authenticated;

revoke all on function public.plotmap_property_intelligence_store(
  text, text, integer, text, text, double precision, double precision, timestamptz, text, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.plotmap_property_intelligence_store(
  text, text, integer, text, text, double precision, double precision, timestamptz, text, text, text, jsonb, jsonb
) to service_role;

revoke all on function public.plotmap_property_intelligence_record_run(
  text, text, text, text, integer, integer, integer, integer, integer, integer, integer, bigint, text, text, integer, text, text
) from public, anon, authenticated;
grant execute on function public.plotmap_property_intelligence_record_run(
  text, text, text, text, integer, integer, integer, integer, integer, integer, integer, bigint, text, text, integer, text, text
) to service_role;

-- NOTE: both tables ON DELETE CASCADE from dealer_settings, so
-- plotmap_admin_delete_dealer already removes every intelligence row when a
-- dealer is purged; only its returned summary counts would need extending.
