-- ============================================================
-- MAPCO Marketing · Domain foundation
-- ------------------------------------------------------------
-- Structure only. This migration creates NO creative, NO schedule
-- entry and NO channel connection — there is nothing to display and
-- nothing fake anywhere.
--
-- The domain boundary it establishes:
--
--   property (crm_records)
--     → marketing_content_contexts   frozen, marketing-safe facts + photo refs
--       → marketing_creatives        one rendered asset + structured copy
--         → marketing_schedule_items rotation slot, approval, channel
--           → marketing_publications outcome of one publish attempt
--
--   marketing_channel_accounts       provider-neutral channel connection
--   external_performance_metrics     provider-neutral inbound performance
--
-- Marketing depends on a property only through a content context. It
-- never reads the Properties UI, the dealer Home, or a channel-specific
-- API shape, so a new channel is a new row value, not a redesign.
--
-- Credentials: NO access token or secret is ever stored in these tables.
-- A channel account holds a non-secret external reference plus a
-- credential_ref naming a secret held in the Edge secret store.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. content context ----------
-- A frozen, versioned snapshot of the marketing-safe facts for one
-- property. Freezing matters: a creative published last week must remain
-- explainable even after the property's price or photos change.
create table if not exists public.marketing_content_contexts (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  property_id text not null,
  version integer not null default 1 check (version >= 1),
  status text not null default 'current' check (status in ('current', 'superseded', 'invalid')),
  -- Marketing-safe property facts only. Never owner/seller identity,
  -- commission, internal notes, documents or private buyer data.
  facts jsonb not null default '{}'::jsonb,
  -- Canonical photo references, unchanged. MAPCO inserts the dealer's real
  -- photo into a creative; it never regenerates or restyles the photograph.
  photo_refs jsonb not null default '[]'::jsonb,
  -- sha256 of facts+photo_refs. Identical content ⇒ no regeneration needed.
  content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint marketing_context_facts_size_check check (octet_length(facts::text) <= 65536),
  constraint marketing_context_photos_size_check check (octet_length(photo_refs::text) <= 32768)
);

create unique index if not exists marketing_content_contexts_version_uidx
  on public.marketing_content_contexts (dealer_id, property_id, version);
create unique index if not exists marketing_content_contexts_current_uidx
  on public.marketing_content_contexts (dealer_id, property_id)
  where status = 'current';
create index if not exists marketing_content_contexts_dealer_idx
  on public.marketing_content_contexts (dealer_id, updated_at desc);

-- ---------- 2. creatives ----------
-- design_key names an INTERNAL MAPCO design. The dealer never sees, picks
-- or names a template — the key exists so a rendered asset stays traceable
-- to the design that produced it.
create table if not exists public.marketing_creatives (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  content_context_id uuid not null references public.marketing_content_contexts(id) on delete cascade,
  property_id text not null,
  design_key text not null check (char_length(design_key) between 1 and 80),
  design_version text not null default 'v1' check (char_length(design_version) between 1 and 40),
  -- Provider-neutral surface. 'generic' renders once and is reusable.
  channel text not null default 'generic' check (channel in (
    'generic', 'instagram', 'google_business', 'whatsapp'
  )),
  format text not null default 'square' check (format in ('square', 'portrait', 'landscape', 'story')),
  status text not null default 'draft' check (status in (
    'draft', 'rendering', 'ready', 'approved', 'rejected', 'published', 'failed', 'archived'
  )),
  -- Structured, validated copy: {headline, subhead, caption, hashtags[], cta}.
  -- Never a single blob of unstructured model prose.
  copy jsonb not null default '{}'::jsonb,
  -- Storage reference for the rendered asset: {bucket, path, w, h, bytes}.
  asset jsonb,
  execution_id uuid references public.ai_executions(id) on delete set null,
  job_id uuid references public.ai_jobs(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  error_message text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint marketing_creative_copy_size_check check (octet_length(copy::text) <= 16384),
  constraint marketing_creative_asset_size_check check (asset is null or octet_length(asset::text) <= 4096)
);

create index if not exists marketing_creatives_dealer_status_idx
  on public.marketing_creatives (dealer_id, status, created_at desc);
create index if not exists marketing_creatives_property_idx
  on public.marketing_creatives (dealer_id, property_id, created_at desc);

-- ---------- 3. rotation / schedule ----------
-- The daily rotation selects a slot; the dealer approves it; only then may
-- a publication be attempted. Approval is a stored state, not a UI habit.
create table if not exists public.marketing_schedule_items (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  creative_id uuid references public.marketing_creatives(id) on delete cascade,
  channel text not null check (channel in ('instagram', 'google_business', 'whatsapp')),
  slot_key text not null check (char_length(slot_key) between 1 and 60),
  scheduled_for timestamptz not null,
  status text not null default 'awaiting_approval' check (status in (
    'awaiting_approval', 'approved', 'rejected', 'publishing', 'published', 'skipped', 'failed', 'expired'
  )),
  approval_required boolean not null default true,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- One slot per dealer/channel/day-key: the rotation cannot double-book.
create unique index if not exists marketing_schedule_slot_uidx
  on public.marketing_schedule_items (dealer_id, channel, slot_key);
create index if not exists marketing_schedule_due_idx
  on public.marketing_schedule_items (status, scheduled_for);

-- ---------- 4. publication attempts (append-only outcome log) ----------
create table if not exists public.marketing_publications (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  schedule_item_id uuid references public.marketing_schedule_items(id) on delete cascade,
  creative_id uuid references public.marketing_creatives(id) on delete set null,
  channel text not null,
  status text not null check (status in ('attempted', 'succeeded', 'failed')),
  -- Provider's own id for the published item, e.g. an Instagram media id.
  external_ref text,
  external_url text,
  error_code text,
  error_message text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists marketing_publications_dealer_idx
  on public.marketing_publications (dealer_id, created_at desc);

-- ---------- 5. channel accounts (no secrets) ----------
create table if not exists public.marketing_channel_accounts (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  provider text not null check (provider in ('instagram', 'google_business', 'whatsapp')),
  -- Non-secret public identifier (page id, location id, business number).
  external_account_ref text,
  display_name text,
  status text not null default 'disconnected' check (status in (
    'disconnected', 'pending', 'connected', 'error', 'revoked'
  )),
  -- NAME of a secret held in the Edge secret store — never the secret.
  credential_ref text,
  scopes jsonb not null default '[]'::jsonb,
  connected_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint marketing_channel_metadata_size_check check (octet_length(metadata::text) <= 8192),
  -- Structural defence against anyone ever putting a token in this table.
  constraint marketing_channel_credential_ref_check
    check (credential_ref is null or credential_ref ~ '^[A-Za-z0-9_.:-]{1,120}$')
);

create unique index if not exists marketing_channel_accounts_uidx
  on public.marketing_channel_accounts (dealer_id, provider);

-- ---------- 6. external performance (provider-neutral) ----------
-- Inbound facts from Instagram, Google Business Profile, Search Console or
-- any later source. metrics is a flat name→number map, so a new provider
-- adds rows rather than columns, and MAPCO Intelligence can consume them
-- without knowing which platform produced them.
create table if not exists public.external_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  provider text not null check (char_length(provider) between 1 and 40),
  -- What the numbers describe: the whole account, one post, one listing…
  scope text not null check (scope in ('account', 'publication', 'listing', 'property', 'search')),
  -- Empty string rather than NULL so the uniqueness key stays a plain
  -- column list and idempotent re-ingest needs no expression inference.
  external_ref text not null default '',
  publication_id uuid references public.marketing_publications(id) on delete set null,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  source_version text,
  ingested_at timestamptz not null default timezone('utc'::text, now()),
  constraint external_performance_period_check check (period_end >= period_start),
  constraint external_performance_metrics_size_check check (octet_length(metrics::text) <= 16384)
);

-- Re-ingesting the same period for the same scope updates rather than
-- duplicating, so a retried sync stays idempotent.
create unique index if not exists external_performance_unique_idx
  on public.external_performance_metrics (
    dealer_id, provider, scope, external_ref, period_start, period_end
  );
create index if not exists external_performance_dealer_idx
  on public.external_performance_metrics (dealer_id, period_end desc);

-- ---------- 7. RLS ----------
alter table public.marketing_content_contexts enable row level security;
alter table public.marketing_creatives enable row level security;
alter table public.marketing_schedule_items enable row level security;
alter table public.marketing_publications enable row level security;
alter table public.marketing_channel_accounts enable row level security;
alter table public.external_performance_metrics enable row level security;

revoke all on table public.marketing_content_contexts from public, anon, authenticated;
revoke all on table public.marketing_creatives from public, anon, authenticated;
revoke all on table public.marketing_schedule_items from public, anon, authenticated;
revoke all on table public.marketing_publications from public, anon, authenticated;
revoke all on table public.marketing_channel_accounts from public, anon, authenticated;
revoke all on table public.external_performance_metrics from public, anon, authenticated;

grant select on table public.marketing_content_contexts to authenticated;
grant select on table public.marketing_creatives to authenticated;
grant select on table public.marketing_schedule_items to authenticated;
grant select on table public.marketing_publications to authenticated;
grant select on table public.external_performance_metrics to authenticated;
-- Column-level grant: credential_ref, scopes, metadata and last_error are
-- absent from the browser-readable projection, not merely hidden by a query.
grant select (
  id, dealer_id, provider, external_account_ref, display_name,
  status, connected_at, last_checked_at, created_at, updated_at
) on table public.marketing_channel_accounts to authenticated;

drop policy if exists "marketing contexts dealer read" on public.marketing_content_contexts;
create policy "marketing contexts dealer read"
on public.marketing_content_contexts for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "marketing creatives dealer read" on public.marketing_creatives;
create policy "marketing creatives dealer read"
on public.marketing_creatives for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "marketing schedule dealer read" on public.marketing_schedule_items;
create policy "marketing schedule dealer read"
on public.marketing_schedule_items for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "marketing publications dealer read" on public.marketing_publications;
create policy "marketing publications dealer read"
on public.marketing_publications for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "marketing channels dealer read" on public.marketing_channel_accounts;
create policy "marketing channels dealer read"
on public.marketing_channel_accounts for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

drop policy if exists "external performance dealer read" on public.external_performance_metrics;
create policy "external performance dealer read"
on public.external_performance_metrics for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

-- ---------- 8. marketing-safe property context builder ----------
-- The single place that decides what a marketing surface may know about a
-- property. Everything downstream (copy generation, creative rendering,
-- publishing) reads this projection and nothing else.
create or replace function public.plotmap_ai_marketing_facts_for(
  p_dealer_id text,
  p_property_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_row public.crm_records%rowtype;
  v_payload jsonb;
  -- Scalars rather than a record variable: a dealer with no settings row
  -- must yield NULL brand fields, not an unassigned-record error.
  v_brand_name text;
  v_brand_tagline text;
  v_brand_phone text;
  v_brand_whatsapp text;
begin
  if v_dealer = '' or coalesce(trim(p_property_id), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  select * into v_row from public.crm_records r
   where r.dealer_id = v_dealer and r.entity_type = 'properties'
     and r.id = p_property_id and r.deleted = false;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  v_payload := coalesce(v_row.payload, '{}'::jsonb);

  -- Sold or unpublished stock is never marketable.
  if coalesce((v_payload->'sold') = 'true'::jsonb, false) then
    return jsonb_build_object('ok', false, 'reason', 'sold');
  end if;
  if not coalesce((v_payload->'published') = 'true'::jsonb, false) then
    return jsonb_build_object('ok', false, 'reason', 'not_published');
  end if;

  select d.brand_name, d.brand_tagline, d.support_phone, d.whatsapp_number
    into v_brand_name, v_brand_tagline, v_brand_phone, v_brand_whatsapp
    from public.dealer_settings d where d.dealer_id = v_dealer;

  return jsonb_build_object(
    'ok', true,
    'schemaVersion', 'marketing-facts-v1',
    'dealerId', v_dealer,
    'propertyId', v_row.id,
    -- Allow-listed projection. Adding a field here is a deliberate act;
    -- nothing is copied wholesale out of the property payload.
    'property', jsonb_build_object(
      'type', v_payload->>'type',
      'want', v_payload->>'want',
      'city', v_payload->>'city',
      'area', v_payload->>'area',
      'sector', v_payload->>'sector',
      'size', v_payload->>'size',
      'facing', v_payload->>'facing',
      'position', v_payload->>'position',
      'price', case when v_payload->>'price' ~ '^[0-9]+(\.[0-9]+)?$' then (v_payload->>'price')::numeric else null end,
      'approvals', case when jsonb_typeof(v_payload->'approvals') = 'array' then v_payload->'approvals' else '[]'::jsonb end,
      'landmarks', case when jsonb_typeof(v_payload->'landmarks') = 'array' then v_payload->'landmarks' else '[]'::jsonb end
    ),
    'photoRefs', case when jsonb_typeof(v_payload->'photoStorage') = 'array' then v_payload->'photoStorage' else '[]'::jsonb end,
    'brand', jsonb_build_object(
      'name', v_brand_name,
      'tagline', v_brand_tagline,
      'phone', v_brand_phone,
      'whatsapp', v_brand_whatsapp
    ),
    -- Stated so downstream copy generation cannot invent an owner story.
    'excluded', jsonb_build_array('owner', 'sellerPhone', 'commission', 'notes', 'documents', 'buyerData')
  );
end;
$$;

create or replace function public.plotmap_ai_marketing_facts(p_property_id text)
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
  return public.plotmap_ai_marketing_facts_for(v_dealer, p_property_id);
end;
$$;

-- ---------- 9. content-context write RPC (service role) ----------
create or replace function public.plotmap_ai_store_marketing_context(
  p_dealer_id text,
  p_property_id text,
  p_facts jsonb,
  p_photo_refs jsonb default '[]'::jsonb,
  p_content_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_prop text := trim(coalesce(p_property_id, ''));
  v_existing public.marketing_content_contexts%rowtype;
  v_version integer;
  v_id uuid;
begin
  if v_dealer = '' or v_prop = '' then raise exception 'invalid_input'; end if;
  if p_facts is null or jsonb_typeof(p_facts) <> 'object' then raise exception 'facts_must_be_object'; end if;
  if not public.plotmap_ai_is_enabled(v_dealer) then raise exception 'ai_disabled'; end if;

  perform pg_advisory_xact_lock(hashtext('plotmap:marketing:context:' || v_dealer || ':' || v_prop));

  select * into v_existing from public.marketing_content_contexts c
   where c.dealer_id = v_dealer and c.property_id = v_prop and c.status = 'current';

  -- Unchanged content ⇒ reuse the existing context. This is the first line
  -- of cost control: no regeneration when nothing about the property moved.
  if found and p_content_hash is not null and v_existing.content_hash = p_content_hash then
    return jsonb_build_object('ok', true, 'id', v_existing.id, 'version', v_existing.version, 'reused', true);
  end if;

  select coalesce(max(c.version), 0) + 1 into v_version
    from public.marketing_content_contexts c
    where c.dealer_id = v_dealer and c.property_id = v_prop;

  update public.marketing_content_contexts
     set status = 'superseded', updated_at = timezone('utc'::text, now())
   where dealer_id = v_dealer and property_id = v_prop and status = 'current';

  insert into public.marketing_content_contexts (
    dealer_id, property_id, version, status, facts, photo_refs, content_hash
  ) values (
    v_dealer, v_prop, v_version, 'current', p_facts,
    case when jsonb_typeof(coalesce(p_photo_refs, '[]'::jsonb)) = 'array' then p_photo_refs else '[]'::jsonb end,
    case when p_content_hash ~ '^[0-9a-f]{64}$' then p_content_hash else null end
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'version', v_version, 'reused', false);
end;
$$;

-- ---------- 10. external performance ingest (service role) ----------
create or replace function public.plotmap_ai_ingest_external_metrics(
  p_dealer_id text,
  p_provider text,
  p_scope text,
  p_period_start date,
  p_period_end date,
  p_metrics jsonb,
  p_external_ref text default null,
  p_publication_id uuid default null,
  p_source_version text default null
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
  if v_dealer = '' then raise exception 'dealer_required'; end if;
  if p_metrics is null or jsonb_typeof(p_metrics) <> 'object' then raise exception 'metrics_must_be_object'; end if;
  if p_period_end < p_period_start then raise exception 'invalid_period'; end if;
  if not exists (select 1 from public.dealer_settings d where d.dealer_id = v_dealer) then
    raise exception 'unknown dealer';
  end if;

  insert into public.external_performance_metrics as m (
    dealer_id, provider, scope, external_ref, publication_id,
    period_start, period_end, metrics, source_version
  ) values (
    v_dealer, left(trim(p_provider), 40), p_scope, left(trim(coalesce(p_external_ref, '')), 200),
    p_publication_id, p_period_start, p_period_end, p_metrics,
    nullif(left(trim(coalesce(p_source_version, '')), 40), '')
  )
  on conflict (dealer_id, provider, scope, external_ref, period_start, period_end)
  do update set metrics = excluded.metrics,
                publication_id = coalesce(excluded.publication_id, m.publication_id),
                source_version = excluded.source_version,
                ingested_at = timezone('utc'::text, now())
  returning m.id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ---------- 11. grants ----------
revoke all on function public.plotmap_ai_marketing_facts_for(text, text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_marketing_facts(text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_store_marketing_context(text, text, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.plotmap_ai_ingest_external_metrics(text, text, text, date, date, jsonb, text, uuid, text) from public, anon, authenticated;

grant execute on function public.plotmap_ai_marketing_facts(text) to authenticated;

grant execute on function public.plotmap_ai_marketing_facts_for(text, text) to service_role;
grant execute on function public.plotmap_ai_store_marketing_context(text, text, jsonb, jsonb, text) to service_role;
grant execute on function public.plotmap_ai_ingest_external_metrics(text, text, text, date, date, jsonb, text, uuid, text) to service_role;

-- ---------- 12. dealer purge coverage ----------
-- Every new table cascades from dealer_settings, so a purge already removes
-- them. The delete function is redefined here only so its returned summary
-- still reports a row count for each table it is responsible for.
create or replace function public.plotmap_admin_delete_dealer(
  p_dealer_id text,
  p_confirm text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_admin uuid := auth.uid();
  v_brand text;
  v_confirm text := lower(trim(coalesce(p_confirm, '')));
  v_auth_ids uuid[] := '{}';
  v_summary jsonb := '{}'::jsonb;
  v_op uuid := gen_random_uuid();
  v_n bigint;
  v_existing public.dealer_deletion_log%rowtype;
  -- Child tables precede their referenced parents. Each table is guarded so
  -- the migration remains compatible with installations missing an optional
  -- feature table.
  v_tables text[] := array[
    'external_performance_metrics',
    'marketing_publications',
    'marketing_schedule_items',
    'marketing_creatives',
    'marketing_content_contexts',
    'marketing_channel_accounts',
    'ai_action_audit',
    'ai_action_proposals',
    'ai_artifacts',
    'ai_usage_daily',
    'ai_executions',
    'ai_jobs',
    'ai_quotas',
    'ai_settings',
    'predictive_usage_events',
    'predictive_transition_summaries',
    'presentation_events',
    'map_overlays',
    'prebuilt_maps',
    'plotmap_daily_usage',
    'crm_records',
    'audit_logs',
    'share_links',
    'dealer_activation_requests',
    'dealer_access_codes',
    'dealer_devices',
    'dealer_passcodes',
    'dealer_provisioning_attempts'
  ];
  v_t text;
begin
  if not public.plotmap_is_platform_admin() then
    raise exception 'platform admin required';
  end if;

  if v_dealer = '' then
    raise exception 'dealer id required';
  end if;

  perform pg_advisory_xact_lock(hashtext('plotmap:delete:dealer:' || v_dealer));

  if not exists (
    select 1 from public.dealer_settings d where d.dealer_id = v_dealer
  ) then
    if v_confirm <> v_dealer then
      raise exception 'confirmation mismatch';
    end if;

    select *
      into v_existing
      from public.dealer_deletion_log l
      where l.dealer_id = v_dealer
      limit 1;

    if found then
      select coalesce(array_agg(u.id), '{}')
        into v_auth_ids
        from auth.users u
        where u.id = any(coalesce(v_existing.auth_user_ids, '{}'));

      return jsonb_build_object(
        'dealer_id', v_dealer,
        'already_deleted', true,
        'operation_id', v_existing.operation_id,
        'deleted', v_existing.summary,
        'auth_user_ids', to_jsonb(v_auth_ids)
      );
    end if;

    raise exception 'unknown dealer';
  end if;

  select d.brand_name
    into v_brand
    from public.dealer_settings d
    where d.dealer_id = v_dealer;

  if v_confirm <> v_dealer
     and v_confirm <> lower(trim(coalesce(v_brand, ''))) then
    raise exception 'confirmation mismatch';
  end if;

  if exists (
    select 1
    from public.profiles p
    join public.platform_admins pa on pa.profile_id = p.id
    where p.dealer_id = v_dealer
  ) then
    raise exception 'dealer contains a protected platform administrator';
  end if;

  select coalesce(array_agg(p.id), '{}')
    into v_auth_ids
    from public.profiles p
    where p.dealer_id = v_dealer
      and p.id is not null
      and p.id <> v_admin
      and not exists (
        select 1 from public.platform_admins pa where pa.profile_id = p.id
      );

  foreach v_t in array v_tables loop
    if to_regclass('public.' || v_t) is not null then
      execute format('delete from public.%I where dealer_id = $1', v_t)
        using v_dealer;
      get diagnostics v_n = row_count;
      v_summary := v_summary || jsonb_build_object(v_t, v_n);
    end if;
  end loop;

  delete from public.profiles
  where dealer_id = v_dealer
    and id = any(v_auth_ids);
  get diagnostics v_n = row_count;
  v_summary := v_summary || jsonb_build_object('profiles', v_n);

  delete from public.dealer_settings where dealer_id = v_dealer;
  get diagnostics v_n = row_count;
  v_summary := v_summary || jsonb_build_object('dealer_settings', v_n);

  insert into public.dealer_deletion_log (
    operation_id, dealer_id, deleted_by, summary, auth_user_ids
  ) values (
    v_op, v_dealer, v_admin, v_summary, v_auth_ids
  );

  return jsonb_build_object(
    'dealer_id', v_dealer,
    'already_deleted', false,
    'operation_id', v_op,
    'deleted', v_summary,
    'auth_user_ids', to_jsonb(v_auth_ids)
  );
end;
$$;

revoke all on function public.plotmap_admin_delete_dealer(text, text)
  from public, anon, authenticated;
grant execute on function public.plotmap_admin_delete_dealer(text, text)
  to authenticated;
