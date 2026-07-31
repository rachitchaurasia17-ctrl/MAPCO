-- ============================================================
-- MAPCO V2 · Base core tables (reconstructed)
-- ------------------------------------------------------------
-- The migration-kit is an INCREMENTAL set that assumed a base
-- `supabase_setup.sql` (deliberately retired for recreating
-- permissive public policies). On a fresh project those base
-- tables are missing, so migration 000200+ fail with
-- "relation public.crm_records does not exist".
--
-- This migration recreates ONLY the base objects the incremental
-- migrations reference, reconstructed from:
--   • docs/v2-blueprint/08_DATA_MODEL_AND_ADAPTERS.md (schemas)
--   • the exact column contracts in 000500_multi_dealer_rpc_setup
--     (plotmap_client_properties / _maps / _overlays / _record_event)
--
-- Security posture: RLS is ENABLED on every table but NO permissive
-- policy is added here — the later enforced migrations attach the
-- real dealer-scoped policies. Until then every table fails closed.
-- No permissive `using(true)` anywhere. Idempotent (IF NOT EXISTS).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- crm_records: polymorphic CRM backbone ----------
-- properties / customers / deals / demand / followups / ... keyed by entity_type.
create table if not exists public.crm_records (
  id text primary key,
  dealer_id text not null,
  entity_type text not null,
  payload jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists crm_records_dealer_idx on public.crm_records (dealer_id);
create index if not exists crm_records_dealer_entity_idx on public.crm_records (dealer_id, entity_type);
alter table public.crm_records enable row level security;

-- ---------- presentation_events: append-only usage analytics ----------
-- Written only through plotmap_record_presentation_event (anon RPC). id is text
-- ('pevt-...') with idempotent on-conflict-do-nothing at the RPC.
create table if not exists public.presentation_events (
  id text primary key,
  dealer_id text not null,
  session_id text not null default '',
  event_type text not null default 'unknown',
  area text,
  sector text,
  map_id text,
  property_id text,
  client_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists presentation_events_dealer_idx on public.presentation_events (dealer_id);
create index if not exists presentation_events_created_idx on public.presentation_events (created_at);
alter table public.presentation_events enable row level security;

-- ---------- prebuilt_maps: dealer map registry ----------
-- plotmap_client_maps filters status='published' and client_visible=true.
create table if not exists public.prebuilt_maps (
  id text primary key,
  dealer_id text not null,
  kind text not null default 'masterplan',
  city text,
  sector text,
  label text,
  raster text,
  dims jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  client_visible boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists prebuilt_maps_dealer_idx on public.prebuilt_maps (dealer_id);
alter table public.prebuilt_maps enable row level security;

-- ---------- map_overlays: marks / highlight sets on a map ----------
-- plotmap_client_overlays filters status='published' and client_visible=true and deleted=false.
create table if not exists public.map_overlays (
  id text primary key,
  dealer_id text not null,
  map_id text,
  name text,
  kind text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  client_visible boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists map_overlays_dealer_idx on public.map_overlays (dealer_id);
create index if not exists map_overlays_map_idx on public.map_overlays (dealer_id, map_id);
alter table public.map_overlays enable row level security;

-- ---------- client_safe_properties: client-safe projection VIEW ----------
-- Projects ONLY buyer-safe columns out of crm_records properties. NEVER exposes
-- price, seller name/phone, commission, or internal notes — matching the V2
-- ClientSafePayload boundary. security_invoker=true so direct selects still obey
-- crm_records RLS; the public SECURITY DEFINER read RPC filters by dealer.
create or replace view public.client_safe_properties
with (security_invoker = true) as
  select
    r.id,
    r.dealer_id,
    coalesce(
      nullif(r.payload->>'status', ''),
      case when coalesce((r.payload->>'published')::boolean, false) then 'published' else 'draft' end
    ) as status,
    coalesce(
      (r.payload->>'client_visible')::boolean,
      (r.payload->>'published')::boolean,
      false
    ) as client_visible,
    r.payload->>'type'      as type,
    r.payload->>'want'      as want,
    r.payload->>'city'      as city,
    r.payload->>'area'      as area,
    r.payload->>'loc'       as loc,
    r.payload->>'sector'    as sector,
    r.payload->>'size'      as size,
    r.payload->>'facing'    as facing,
    r.payload->>'position'  as position,
    coalesce(r.payload->'approvals', '[]'::jsonb) as approvals,
    coalesce(r.payload->'landmarks', '[]'::jsonb) as landmarks,
    coalesce(r.payload->'photos', '[]'::jsonb)    as photos,
    r.created_at,
    r.updated_at
  from public.crm_records r
  where r.entity_type = 'properties'
    and r.deleted = false
    and coalesce((r.payload->>'published')::boolean, false) = true
    and coalesce((r.payload->>'sold')::boolean, false) = false;
