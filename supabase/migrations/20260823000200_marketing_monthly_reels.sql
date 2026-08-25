-- ============================================================
-- MAPCO Marketing · monthly entitlements and canonical Reel Jobs
-- Target: MAPCO-DEV
--
-- New production authority:
--   one period / dealer / calendar month
--   exactly 30 Post entitlements + exactly 8 Reel submissions
--
-- Legacy marketing_weekly_plans/output_slots remain intact as historical
-- compatibility records. New work uses marketing_periods and
-- marketing_post_slots, then rejoins the existing canonical context →
-- creative → schedule → publication pipeline. No parallel creative or
-- publishing system is introduced.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- canonical creative type ----------
alter table public.marketing_creatives
  add column if not exists creative_type text not null default 'post';
alter table public.marketing_creatives
  drop constraint if exists marketing_creatives_creative_type_check;
alter table public.marketing_creatives
  add constraint marketing_creatives_creative_type_check
  check (creative_type in ('post', 'reel'));
create index if not exists marketing_creatives_library_idx
  on public.marketing_creatives (dealer_id, creative_type, created_at desc);

-- ---------- monthly period / usage authority ----------
create table if not exists public.marketing_periods (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  period_start date not null,
  period_end date not null,
  period_kind text not null default 'calendar_month'
    check (period_kind in ('calendar_month', 'billing_cycle')),
  -- V1 calendar months start on day 1. This column makes a future billing
  -- anchor a data migration rather than a table replacement.
  anchor_day integer not null default 1 check (anchor_day between 1 and 28),
  posts_entitled integer not null default 30,
  reels_entitled integer not null default 8,
  timezone text not null default 'Asia/Kolkata',
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint marketing_period_dates_check check (period_end >= period_start),
  constraint marketing_period_posts_v1_check check (posts_entitled = 30),
  constraint marketing_period_reels_v1_check check (reels_entitled = 8),
  unique (dealer_id, period_start)
);
create index if not exists marketing_periods_dealer_idx
  on public.marketing_periods (dealer_id, period_start desc);

create table if not exists public.marketing_post_slots (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  period_id uuid not null references public.marketing_periods(id) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 30),
  slot_ref text not null check (slot_ref ~ '^P[0-9]{3}$'),
  state text not null default 'waiting_for_input' check (state in (
    'waiting_for_input', 'in_production', 'ready_for_review', 'approved',
    'scheduled', 'published', 'failed', 'replacement_needed'
  )),
  property_id text,
  scheduled_for date,
  entitlement_consumed boolean not null default false,
  consumed_at timestamptz,
  idempotency_key text,
  request_hash text,
  caption text,
  operator_note text,
  selected_channels jsonb not null default '[]'::jsonb,
  content_context_id uuid references public.marketing_content_contexts(id) on delete set null,
  creative_id uuid references public.marketing_creatives(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint marketing_post_slot_consumption_check check (
    (entitlement_consumed and consumed_at is not null and idempotency_key is not null and request_hash is not null)
    or (not entitlement_consumed and consumed_at is null and idempotency_key is null and request_hash is null)
  ),
  constraint marketing_post_slot_channels_check check (
    jsonb_typeof(selected_channels) = 'array'
    and jsonb_array_length(selected_channels) <= 4
    and octet_length(selected_channels::text) <= 256
  ),
  unique (period_id, slot_number),
  unique (period_id, slot_ref)
);
create unique index if not exists marketing_post_slots_idempotency_uidx
  on public.marketing_post_slots (dealer_id, period_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists marketing_post_slots_usage_idx
  on public.marketing_post_slots (dealer_id, period_id, entitlement_consumed, slot_number);

-- Reuse the canonical returned-asset register for both legacy weekly and
-- monthly Post slots. Existing rows keep their legacy slot_id.
alter table public.marketing_creative_results
  alter column slot_id drop not null;
alter table public.marketing_creative_results
  add column if not exists monthly_post_slot_id uuid
    references public.marketing_post_slots(id) on delete cascade;
alter table public.marketing_creative_results
  drop constraint if exists marketing_creative_results_source_check;
alter table public.marketing_creative_results
  add constraint marketing_creative_results_source_check
  check (num_nonnulls(slot_id, monthly_post_slot_id) = 1);
create unique index if not exists marketing_creative_results_monthly_current_uidx
  on public.marketing_creative_results (monthly_post_slot_id)
  where monthly_post_slot_id is not null and superseded = false;

-- ---------- canonical Reel Job and media lineage ----------
create table if not exists public.marketing_reel_jobs (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  period_id uuid not null references public.marketing_periods(id) on delete cascade,
  quota_number integer not null check (quota_number between 1 and 8),
  property_id text not null,
  dealer_note text,
  state text not null default 'awaiting_upload' check (state in (
    'awaiting_upload', 'received', 'in_editing', 'ready', 'failed', 'replacement_needed'
  )),
  submission_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  quota_consumed boolean not null default true,
  creative_id uuid references public.marketing_creatives(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  received_at timestamptz,
  editing_at timestamptz,
  ready_at timestamptz,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint marketing_reel_note_size_check check (char_length(coalesce(dealer_note, '')) <= 1000),
  unique (period_id, quota_number),
  unique (dealer_id, period_id, submission_key)
);
create index if not exists marketing_reel_jobs_dealer_idx
  on public.marketing_reel_jobs (dealer_id, period_id, state, created_at);

create table if not exists public.marketing_reel_assets (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  reel_job_id uuid not null references public.marketing_reel_jobs(id) on delete cascade,
  asset_kind text not null check (asset_kind in ('raw', 'finished', 'poster')),
  state text not null default 'pending' check (state in ('pending', 'ready', 'superseded', 'failed')),
  upload_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  storage_bucket text not null check (storage_bucket in ('marketing-reel-raw', 'marketing-reel-finished')),
  storage_path text not null check (char_length(storage_path) between 1 and 500 and storage_path !~ '(^/|\.\.)'),
  mime_type text not null check (mime_type in ('video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 262144000),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  duration_seconds numeric check (duration_seconds is null or duration_seconds between 0 and 21600),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (reel_job_id, asset_kind, upload_key),
  unique (storage_bucket, storage_path)
);
create unique index if not exists marketing_reel_assets_active_uidx
  on public.marketing_reel_assets (reel_job_id, asset_kind)
  where state = 'ready';
create index if not exists marketing_reel_assets_job_idx
  on public.marketing_reel_assets (dealer_id, reel_job_id, asset_kind, state);

-- ---------- direct table boundary ----------
alter table public.marketing_periods enable row level security;
alter table public.marketing_post_slots enable row level security;
alter table public.marketing_reel_jobs enable row level security;
alter table public.marketing_reel_assets enable row level security;

revoke all on table public.marketing_periods from public, anon, authenticated;
revoke all on table public.marketing_post_slots from public, anon, authenticated;
revoke all on table public.marketing_reel_jobs from public, anon, authenticated;
revoke all on table public.marketing_reel_assets from public, anon, authenticated;

-- ---------- private media buckets ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-reel-raw', 'marketing-reel-raw', false, 262144000,
  array['video/mp4', 'video/quicktime', 'video/webm']::text[]
)
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-reel-finished', 'marketing-reel-finished', false, 157286400,
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- safe property / period helpers ----------
create or replace function public.plotmap_marketing_property_is_marketable(
  p_dealer_id text, p_property_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crm_records r
     where r.dealer_id = p_dealer_id and r.entity_type = 'properties'
       and r.id = p_property_id and r.deleted = false
       and coalesce(r.payload->>'lifecycle',
         case when coalesce((r.payload->'sold') = 'true'::jsonb, false) then 'sold'
              when coalesce((r.payload->'published') = 'true'::jsonb, false) then 'on-sale'
              else 'draft' end) = 'on-sale'
       and coalesce((r.payload->'published') = 'true'::jsonb, false)
       and not coalesce((r.payload->'sold') = 'true'::jsonb, false)
  );
$$;

-- Replaces the old price-bearing projection for all new Marketing work.
-- Historical contexts are retained; no private value is copied forward.
create or replace function public.plotmap_ai_marketing_facts_for(
  p_dealer_id text, p_property_id text
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
  if not public.plotmap_marketing_property_is_marketable(v_dealer, p_property_id) then
    return jsonb_build_object('ok', false, 'reason', 'property_not_marketable');
  end if;
  v_payload := coalesce(v_row.payload, '{}'::jsonb);
  select d.brand_name, d.brand_tagline, d.support_phone, d.whatsapp_number
    into v_brand_name, v_brand_tagline, v_brand_phone, v_brand_whatsapp
    from public.dealer_settings d where d.dealer_id = v_dealer;
  return jsonb_build_object(
    'ok', true, 'schemaVersion', 'marketing-facts-v2',
    'dealerId', v_dealer, 'propertyId', v_row.id,
    'property', jsonb_build_object(
      'type', v_payload->>'type', 'want', v_payload->>'want',
      'city', v_payload->>'city', 'area', v_payload->>'area',
      'sector', v_payload->>'sector', 'size', v_payload->>'size',
      'facing', v_payload->>'facing', 'position', v_payload->>'position',
      'approvals', case when jsonb_typeof(v_payload->'approvals') = 'array' then v_payload->'approvals' else '[]'::jsonb end,
      'landmarks', case when jsonb_typeof(v_payload->'landmarks') = 'array' then v_payload->'landmarks' else '[]'::jsonb end
    ),
    'photoRefs', case when jsonb_typeof(v_payload->'photoStorage') = 'array' then v_payload->'photoStorage' else '[]'::jsonb end,
    'brand', jsonb_build_object('name', v_brand_name, 'tagline', v_brand_tagline,
      'phone', v_brand_phone, 'whatsapp', v_brand_whatsapp),
    'excluded', jsonb_build_array(
      'price', 'askingPrice', 'owner', 'seller', 'sellerPhone', 'commission',
      'notes', 'documents', 'buyerData', 'location', 'coordinates', 'mapPlacement'
    )
  );
end;
$$;

create or replace function public.plotmap_marketing_ensure_period_for(
  p_dealer_id text, p_as_of date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', coalesce(p_as_of, current_date))::date;
  v_end date := (date_trunc('month', coalesce(p_as_of, current_date)) + interval '1 month - 1 day')::date;
  v_period uuid;
  v_timezone text;
begin
  if coalesce(trim(p_dealer_id), '') = '' or not public.plotmap_dealer_is_active(p_dealer_id) then
    raise exception 'invalid_dealer';
  end if;
  perform pg_advisory_xact_lock(hashtext('mapco:marketing:period:' || p_dealer_id || ':' || v_start::text));
  select coalesce(nullif(trim(s.timezone), ''), 'Asia/Kolkata') into v_timezone
    from public.marketing_settings s where s.dealer_id = p_dealer_id;
  insert into public.marketing_periods (
    dealer_id, period_start, period_end, period_kind, anchor_day,
    posts_entitled, reels_entitled, timezone
  ) values (
    p_dealer_id, v_start, v_end, 'calendar_month', 1, 30, 8,
    coalesce(v_timezone, 'Asia/Kolkata')
  ) on conflict (dealer_id, period_start) do nothing
  returning id into v_period;
  if v_period is null then
    select id into v_period from public.marketing_periods
     where dealer_id = p_dealer_id and period_start = v_start;
  end if;
  insert into public.marketing_post_slots (dealer_id, period_id, slot_number, slot_ref)
  select p_dealer_id, v_period, n, 'P' || lpad(n::text, 3, '0')
    from generate_series(1, 30) n
  on conflict (period_id, slot_number) do nothing;
  if (select count(*) from public.marketing_post_slots where period_id = v_period) <> 30 then
    raise exception 'monthly post slot invariant violated';
  end if;
  return v_period;
end;
$$;

create or replace function public.plotmap_marketing_open_period(
  p_dealer_id text, p_as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_period uuid; v_row public.marketing_periods%rowtype;
begin
  if not public.plotmap_marketing_can_operate(p_dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  v_period := public.plotmap_marketing_ensure_period_for(p_dealer_id, p_as_of);
  select * into v_row from public.marketing_periods where id = v_period;
  return jsonb_build_object('ok', true, 'periodId', v_period,
    'periodStart', v_row.period_start, 'periodEnd', v_row.period_end,
    'postsEntitled', v_row.posts_entitled, 'reelsEntitled', v_row.reels_entitled);
end;
$$;

-- ---------- reusable usage contract ----------
create or replace function public.plotmap_marketing_usage_for(
  p_actor uuid, p_as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_dealer text; v_period uuid; v_row public.marketing_periods%rowtype;
declare v_posts integer; v_reels integer;
begin
  select p.dealer_id into v_dealer from public.profiles p
   where p.id = p_actor and p.status = 'active' and p.role in ('owner', 'manager');
  if v_dealer is null or not public.plotmap_dealer_is_active(v_dealer) then
    return jsonb_build_object('ok', false, 'reason', 'dealer_marketing_access_required');
  end if;
  v_period := public.plotmap_marketing_ensure_period_for(v_dealer, p_as_of);
  select * into v_row from public.marketing_periods where id = v_period;
  select count(*) into v_posts from public.marketing_post_slots
   where period_id = v_period and entitlement_consumed;
  select count(*) into v_reels from public.marketing_reel_jobs
   where period_id = v_period and quota_consumed;
  return jsonb_build_object('ok', true, 'dealerId', v_dealer,
    'periodId', v_period, 'periodStart', v_row.period_start, 'periodEnd', v_row.period_end,
    'postsEntitled', v_row.posts_entitled, 'postsUsed', v_posts,
    'postsRemaining', greatest(0, v_row.posts_entitled - v_posts),
    'reelsEntitled', v_row.reels_entitled, 'reelsUsed', v_reels,
    'reelsRemaining', greatest(0, v_row.reels_entitled - v_reels));
end;
$$;

create or replace function public.plotmap_marketing_usage()
returns jsonb
language sql
security definer
set search_path = public
as $$ select public.plotmap_marketing_usage_for(auth.uid(), current_date); $$;

-- ---------- monthly Post production ----------
create or replace function public.plotmap_marketing_claim_post_slot(
  p_dealer_id text,
  p_property_id text,
  p_idempotency_key text,
  p_scheduled_for date default null,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_period uuid; v_period_row public.marketing_periods%rowtype;
declare v_slot public.marketing_post_slots%rowtype; v_hash text;
begin
  if not public.plotmap_marketing_can_operate(p_dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if coalesce(p_idempotency_key, '') !~ '^[A-Za-z0-9_.:-]{8,120}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_idempotency_key');
  end if;
  if not public.plotmap_marketing_property_is_marketable(p_dealer_id, p_property_id) then
    return jsonb_build_object('ok', false, 'reason', 'property_not_marketable');
  end if;
  v_period := public.plotmap_marketing_ensure_period_for(p_dealer_id, p_as_of);
  select * into v_period_row from public.marketing_periods where id = v_period;
  if p_scheduled_for is not null and p_scheduled_for not between v_period_row.period_start and v_period_row.period_end then
    return jsonb_build_object('ok', false, 'reason', 'scheduled_date_outside_period');
  end if;
  v_hash := encode(digest(convert_to(jsonb_build_object(
    'propertyId', p_property_id, 'scheduledFor', p_scheduled_for)::text, 'utf8'), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtext('mapco:marketing:posts:' || p_dealer_id || ':' || v_period::text));
  select * into v_slot from public.marketing_post_slots
   where dealer_id = p_dealer_id and period_id = v_period
     and idempotency_key = p_idempotency_key for update;
  if found then
    if v_slot.request_hash <> v_hash then
      return jsonb_build_object('ok', false, 'reason', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', true, 'idempotent', true,
      'slotId', v_slot.id, 'slotRef', v_slot.slot_ref, 'state', v_slot.state);
  end if;
  select * into v_slot from public.marketing_post_slots
   where period_id = v_period and not entitlement_consumed
   order by slot_number for update skip locked limit 1;
  if not found then return jsonb_build_object('ok', false, 'reason', 'post_quota_exhausted'); end if;
  update public.marketing_post_slots set
    property_id = p_property_id, scheduled_for = p_scheduled_for,
    entitlement_consumed = true, consumed_at = timezone('utc'::text, now()),
    idempotency_key = p_idempotency_key, request_hash = v_hash,
    state = 'in_production', updated_at = timezone('utc'::text, now())
   where id = v_slot.id returning * into v_slot;
  return jsonb_build_object('ok', true, 'idempotent', false,
    'slotId', v_slot.id, 'slotRef', v_slot.slot_ref, 'state', v_slot.state);
end;
$$;

create or replace function public.plotmap_marketing_record_monthly_post_result(
  p_slot_id uuid, p_asset_path text, p_mime text, p_bytes integer,
  p_width integer, p_height integer, p_content_hash text,
  p_caption text default null, p_channels jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare v_slot public.marketing_post_slots%rowtype; v_period_start date;
begin
  select * into v_slot from public.marketing_post_slots where id = p_slot_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.plotmap_marketing_can_operate(v_slot.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if v_slot.state in ('approved', 'scheduled', 'published') then
    return jsonb_build_object('ok', false, 'reason', 'protected_slot');
  end if;
  if p_mime not in ('image/png', 'image/jpeg', 'image/webp')
     or p_bytes not between 1 and 15728640
     or coalesce(p_content_hash, '') !~ '^[0-9a-f]{64}$'
     or length(coalesce(p_caption, '')) > 2200 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_asset');
  end if;
  if jsonb_typeof(coalesce(p_channels, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_channels, '[]'::jsonb)) > 4
     or exists (select 1 from jsonb_array_elements_text(coalesce(p_channels, '[]'::jsonb)) c
                 where c not in ('instagram', 'facebook_page', 'google_business', 'whatsapp_business')) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_channels');
  end if;
  select period_start into v_period_start from public.marketing_periods where id = v_slot.period_id;
  if left(coalesce(p_asset_path, ''), length(v_slot.dealer_id || '/' || v_period_start || '/' || v_slot.slot_ref || '/'))
       <> v_slot.dealer_id || '/' || v_period_start || '/' || v_slot.slot_ref || '/'
     or not exists (select 1 from storage.objects o
                     where o.bucket_id = 'marketing-creatives' and o.name = p_asset_path) then
    return jsonb_build_object('ok', false, 'reason', 'asset_not_found');
  end if;
  update public.marketing_creative_results set superseded = true
   where monthly_post_slot_id = p_slot_id and not superseded;
  insert into public.marketing_creative_results (
    dealer_id, slot_id, monthly_post_slot_id, slot_ref, asset_bucket, asset_path,
    mime, bytes, width, height, content_hash, uploaded_by
  ) values (
    v_slot.dealer_id, null, p_slot_id, v_slot.slot_ref, 'marketing-creatives', p_asset_path,
    p_mime, p_bytes, nullif(p_width, 0), nullif(p_height, 0), p_content_hash, auth.uid()
  );
  update public.marketing_post_slots set state = 'ready_for_review',
    caption = nullif(trim(coalesce(p_caption, '')), ''),
    selected_channels = (select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
      from (select distinct value x from jsonb_array_elements_text(coalesce(p_channels, '[]'::jsonb))) q),
    updated_at = timezone('utc'::text, now()) where id = p_slot_id;
  return jsonb_build_object('ok', true, 'slotId', p_slot_id, 'state', 'ready_for_review');
end;
$$;

-- Creates a new version only when the current frozen context is not the same
-- safe projection. This deliberately leaves old history untouched.
create or replace function public.plotmap_marketing_safe_context_for(
  p_dealer_id text, p_property_id text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_pack jsonb; v_facts jsonb; v_photos jsonb; v_hash text;
declare v_existing public.marketing_content_contexts%rowtype; v_id uuid; v_version integer;
begin
  perform pg_advisory_xact_lock(hashtext('mapco:marketing:context:' || p_dealer_id || ':' || p_property_id));
  v_pack := public.plotmap_ai_marketing_facts_for(p_dealer_id, p_property_id);
  if coalesce(v_pack->'ok', 'false'::jsonb) <> 'true'::jsonb then raise exception 'property_not_marketable'; end if;
  v_facts := jsonb_build_object('schemaVersion', v_pack->'schemaVersion',
    'property', v_pack->'property', 'brand', v_pack->'brand', 'excluded', v_pack->'excluded');
  v_photos := coalesce(v_pack->'photoRefs', '[]'::jsonb);
  v_hash := encode(digest(convert_to(jsonb_build_object('facts', v_facts, 'photos', v_photos)::text, 'utf8'), 'sha256'), 'hex');
  select * into v_existing from public.marketing_content_contexts
   where dealer_id = p_dealer_id and property_id = p_property_id and status = 'current' for update;
  if found and v_existing.content_hash = v_hash then return v_existing.id; end if;
  select coalesce(max(version), 0) + 1 into v_version from public.marketing_content_contexts
   where dealer_id = p_dealer_id and property_id = p_property_id;
  update public.marketing_content_contexts set status = 'superseded',
    updated_at = timezone('utc'::text, now())
   where dealer_id = p_dealer_id and property_id = p_property_id and status = 'current';
  insert into public.marketing_content_contexts (
    dealer_id, property_id, version, status, facts, photo_refs, content_hash
  ) values (p_dealer_id, p_property_id, v_version, 'current', v_facts, v_photos, v_hash)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.plotmap_marketing_approve_monthly_post(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_slot public.marketing_post_slots%rowtype;
declare v_result public.marketing_creative_results%rowtype;
declare v_period public.marketing_periods%rowtype;
declare v_context uuid; v_creative uuid; v_channel text; v_when timestamptz;
begin
  select * into v_slot from public.marketing_post_slots where id = p_slot_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.plotmap_marketing_can_operate(v_slot.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if v_slot.creative_id is not null and v_slot.state in ('approved', 'scheduled', 'published') then
    return jsonb_build_object('ok', true, 'idempotent', true, 'creativeId', v_slot.creative_id);
  end if;
  if v_slot.state <> 'ready_for_review' then
    return jsonb_build_object('ok', false, 'reason', 'slot_not_reviewable');
  end if;
  if not public.plotmap_marketing_property_is_marketable(v_slot.dealer_id, v_slot.property_id) then
    return jsonb_build_object('ok', false, 'reason', 'property_not_marketable');
  end if;
  select * into v_result from public.marketing_creative_results
   where monthly_post_slot_id = p_slot_id and not superseded;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_asset_uploaded'); end if;
  select * into v_period from public.marketing_periods where id = v_slot.period_id;
  v_context := public.plotmap_marketing_safe_context_for(v_slot.dealer_id, v_slot.property_id);
  insert into public.marketing_creatives (
    dealer_id, content_context_id, property_id, creative_type, design_key,
    design_version, channel, format, status, copy, asset, approved_by, approved_at
  ) values (
    v_slot.dealer_id, v_context, v_slot.property_id, 'post', 'operator-external',
    'v1', 'generic', 'portrait', 'approved',
    jsonb_build_object('caption', coalesce(v_slot.caption, '')),
    jsonb_build_object('bucket', v_result.asset_bucket, 'path', v_result.asset_path,
      'mime', v_result.mime, 'w', v_result.width, 'h', v_result.height, 'bytes', v_result.bytes),
    auth.uid(), timezone('utc'::text, now())
  ) returning id into v_creative;
  v_when := case when v_slot.scheduled_for is null then timezone('utc'::text, now())
    else (v_slot.scheduled_for::text || ' 09:00:00+05:30')::timestamptz end;
  for v_channel in select value from jsonb_array_elements_text(v_slot.selected_channels) loop
    insert into public.marketing_schedule_items (
      dealer_id, creative_id, channel, slot_key, scheduled_for, status,
      approval_required, approved_by, approved_at
    ) values (
      v_slot.dealer_id, v_creative, v_channel,
      v_period.period_start || '-' || v_slot.slot_ref || '-' || v_channel,
      v_when, 'approved', true, auth.uid(), timezone('utc'::text, now())
    ) on conflict (dealer_id, channel, slot_key) do update set
      creative_id = excluded.creative_id, scheduled_for = excluded.scheduled_for,
      status = 'approved', approved_by = excluded.approved_by,
      approved_at = excluded.approved_at, updated_at = timezone('utc'::text, now());
  end loop;
  update public.marketing_post_slots set state = 'approved', content_context_id = v_context,
    creative_id = v_creative, approved_by = auth.uid(),
    approved_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
   where id = p_slot_id;
  return jsonb_build_object('ok', true, 'idempotent', false,
    'creativeId', v_creative, 'creativeType', 'post', 'state', 'approved');
end;
$$;

create or replace function public.plotmap_marketing_request_post_replacement(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_slot public.marketing_post_slots%rowtype;
begin
  select * into v_slot from public.marketing_post_slots where id = p_slot_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.plotmap_marketing_can_operate(v_slot.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if v_slot.state not in ('failed', 'replacement_needed', 'ready_for_review') then
    return jsonb_build_object('ok', false, 'reason', 'replacement_not_allowed');
  end if;
  update public.marketing_post_slots set state = 'in_production',
    updated_at = timezone('utc'::text, now()) where id = p_slot_id;
  return jsonb_build_object('ok', true, 'slotId', p_slot_id,
    'state', 'in_production', 'entitlementConsumed', true);
end;
$$;

-- ---------- Reel submission / replacement / completion ----------
create or replace function public.plotmap_marketing_reel_extension(p_mime text)
returns text
language sql
immutable
set search_path = public
as $$ select case p_mime when 'video/mp4' then 'mp4' when 'video/quicktime' then 'mov' when 'video/webm' then 'webm' else null end; $$;

create or replace function public.plotmap_marketing_reserve_reel(
  p_property_id text, p_submission_key text, p_note text,
  p_mime text, p_bytes bigint, p_content_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_dealer text := public.plotmap_current_dealer_id(); v_period uuid;
declare v_period_row public.marketing_periods%rowtype; v_job public.marketing_reel_jobs%rowtype;
declare v_asset public.marketing_reel_assets%rowtype; v_count integer; v_hash text;
declare v_job_id uuid := gen_random_uuid(); v_asset_id uuid := gen_random_uuid(); v_path text; v_ext text;
begin
  if auth.uid() is null or v_dealer = '' or not public.plotmap_can_edit_crm()
     or not public.plotmap_dealer_is_active(v_dealer) then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if coalesce(p_submission_key, '') !~ '^[A-Za-z0-9_.:-]{8,120}$'
     or length(coalesce(p_note, '')) > 1000
     or p_mime not in ('video/mp4', 'video/quicktime', 'video/webm')
     or p_bytes not between 1 and 262144000
     or coalesce(p_content_hash, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_submission');
  end if;
  if not public.plotmap_marketing_property_is_marketable(v_dealer, p_property_id) then
    return jsonb_build_object('ok', false, 'reason', 'property_not_marketable');
  end if;
  v_period := public.plotmap_marketing_ensure_period_for(v_dealer, current_date);
  select * into v_period_row from public.marketing_periods where id = v_period;
  v_hash := encode(digest(convert_to(jsonb_build_object('propertyId', p_property_id,
    'note', nullif(trim(coalesce(p_note, '')), ''), 'mime', p_mime,
    'bytes', p_bytes, 'contentHash', p_content_hash)::text, 'utf8'), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtext('mapco:marketing:reels:' || v_dealer || ':' || v_period::text));
  select * into v_job from public.marketing_reel_jobs
   where dealer_id = v_dealer and period_id = v_period and submission_key = p_submission_key for update;
  if found then
    if v_job.request_hash <> v_hash then
      return jsonb_build_object('ok', false, 'reason', 'idempotency_conflict');
    end if;
    select * into v_asset from public.marketing_reel_assets
     where reel_job_id = v_job.id and asset_kind = 'raw'
     order by created_at desc limit 1;
    return jsonb_build_object('ok', true, 'idempotent', true, 'jobId', v_job.id,
      'quotaNumber', v_job.quota_number, 'state', v_job.state,
      'assetId', v_asset.id, 'upload', jsonb_build_object('bucket', v_asset.storage_bucket, 'path', v_asset.storage_path));
  end if;
  select count(*) into v_count from public.marketing_reel_jobs
   where period_id = v_period and quota_consumed;
  if v_count >= v_period_row.reels_entitled then
    return jsonb_build_object('ok', false, 'reason', 'reel_quota_exhausted');
  end if;
  v_ext := public.plotmap_marketing_reel_extension(p_mime);
  v_path := v_dealer || '/' || v_period_row.period_start || '/' || v_job_id || '/raw/' || v_asset_id || '-' || p_content_hash || '.' || v_ext;
  insert into public.marketing_reel_jobs (
    id, dealer_id, period_id, quota_number, property_id, dealer_note,
    state, submission_key, request_hash, quota_consumed
  ) values (
    v_job_id, v_dealer, v_period, v_count + 1, p_property_id,
    nullif(trim(coalesce(p_note, '')), ''), 'awaiting_upload', p_submission_key, v_hash, true
  ) returning * into v_job;
  insert into public.marketing_reel_assets (
    id, dealer_id, reel_job_id, asset_kind, state, upload_key, request_hash,
    storage_bucket, storage_path, mime_type, size_bytes, content_hash
  ) values (
    v_asset_id, v_dealer, v_job_id, 'raw', 'pending', p_submission_key, v_hash,
    'marketing-reel-raw', v_path, p_mime, p_bytes, p_content_hash
  ) returning * into v_asset;
  return jsonb_build_object('ok', true, 'idempotent', false, 'jobId', v_job.id,
    'quotaNumber', v_job.quota_number, 'state', v_job.state,
    'assetId', v_asset.id, 'upload', jsonb_build_object('bucket', v_asset.storage_bucket, 'path', v_asset.storage_path));
end;
$$;

create or replace function public.plotmap_marketing_replace_reel_raw(
  p_job_id uuid, p_replacement_key text, p_mime text, p_bytes bigint, p_content_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_job public.marketing_reel_jobs%rowtype; v_period_start date;
declare v_asset public.marketing_reel_assets%rowtype; v_asset_id uuid := gen_random_uuid();
declare v_hash text; v_path text; v_ext text;
begin
  select * into v_job from public.marketing_reel_jobs where id = p_job_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not ((public.plotmap_current_dealer_id() = v_job.dealer_id and public.plotmap_can_edit_crm())
          or public.plotmap_marketing_can_operate(v_job.dealer_id)) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if coalesce(p_replacement_key, '') !~ '^[A-Za-z0-9_.:-]{8,120}$'
     or p_mime not in ('video/mp4', 'video/quicktime', 'video/webm')
     or p_bytes not between 1 and 262144000
     or coalesce(p_content_hash, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_asset');
  end if;
  v_hash := encode(digest(convert_to(jsonb_build_object('mime', p_mime,
    'bytes', p_bytes, 'contentHash', p_content_hash)::text, 'utf8'), 'sha256'), 'hex');
  select * into v_asset from public.marketing_reel_assets where reel_job_id = p_job_id
    and asset_kind = 'raw' and upload_key = p_replacement_key;
  if found then
    if v_asset.request_hash <> v_hash then return jsonb_build_object('ok', false, 'reason', 'idempotency_conflict'); end if;
    return jsonb_build_object('ok', true, 'idempotent', true, 'jobId', p_job_id,
      'assetId', v_asset.id, 'upload', jsonb_build_object('bucket', v_asset.storage_bucket, 'path', v_asset.storage_path));
  end if;
  select period_start into v_period_start from public.marketing_periods where id = v_job.period_id;
  v_ext := public.plotmap_marketing_reel_extension(p_mime);
  v_path := v_job.dealer_id || '/' || v_period_start || '/' || v_job.id || '/raw/' || v_asset_id || '-' || p_content_hash || '.' || v_ext;
  insert into public.marketing_reel_assets (
    id, dealer_id, reel_job_id, asset_kind, state, upload_key, request_hash,
    storage_bucket, storage_path, mime_type, size_bytes, content_hash
  ) values (
    v_asset_id, v_job.dealer_id, v_job.id, 'raw', 'pending', p_replacement_key, v_hash,
    'marketing-reel-raw', v_path, p_mime, p_bytes, p_content_hash
  ) returning * into v_asset;
  update public.marketing_reel_jobs set state = 'awaiting_upload',
    updated_at = timezone('utc'::text, now()) where id = p_job_id;
  return jsonb_build_object('ok', true, 'idempotent', false, 'jobId', p_job_id,
    'assetId', v_asset.id, 'entitlementConsumed', true,
    'upload', jsonb_build_object('bucket', v_asset.storage_bucket, 'path', v_asset.storage_path));
end;
$$;

create or replace function public.plotmap_marketing_can_upload_reel_path(
  p_bucket text, p_path text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.marketing_reel_assets a
    join public.marketing_reel_jobs j on j.id = a.reel_job_id
    where a.storage_bucket = p_bucket and a.storage_path = p_path and a.state = 'pending'
      and (
        (a.asset_kind = 'raw' and public.plotmap_current_dealer_id() = a.dealer_id
          and public.plotmap_can_edit_crm() and public.plotmap_dealer_is_active(a.dealer_id))
        or public.plotmap_marketing_can_operate(a.dealer_id)
      )
  );
$$;

drop policy if exists "marketing reel raw upload" on storage.objects;
create policy "marketing reel raw upload" on storage.objects for insert to authenticated
with check (bucket_id = 'marketing-reel-raw'
  and public.plotmap_marketing_can_upload_reel_path(bucket_id, name));
drop policy if exists "marketing reel finished upload" on storage.objects;
create policy "marketing reel finished upload" on storage.objects for insert to authenticated
with check (bucket_id = 'marketing-reel-finished'
  and public.plotmap_marketing_can_upload_reel_path(bucket_id, name));

create or replace function public.plotmap_marketing_finalize_reel_asset(
  p_job_id uuid, p_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare v_job public.marketing_reel_jobs%rowtype; v_asset public.marketing_reel_assets%rowtype;
declare v_object storage.objects%rowtype; v_cleanup jsonb;
begin
  select * into v_job from public.marketing_reel_jobs where id = p_job_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select * into v_asset from public.marketing_reel_assets
   where id = p_asset_id and reel_job_id = p_job_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'asset_not_found'); end if;
  if not ((v_asset.asset_kind = 'raw' and public.plotmap_current_dealer_id() = v_job.dealer_id
           and public.plotmap_can_edit_crm())
          or public.plotmap_marketing_can_operate(v_job.dealer_id)) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if v_asset.state = 'ready' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'jobId', p_job_id, 'assetId', p_asset_id);
  end if;
  if v_asset.state <> 'pending' then return jsonb_build_object('ok', false, 'reason', 'asset_not_pending'); end if;
  select * into v_object from storage.objects o
   where o.bucket_id = v_asset.storage_bucket and o.name = v_asset.storage_path;
  if not found then return jsonb_build_object('ok', false, 'reason', 'upload_not_found'); end if;
  if coalesce((v_object.metadata->>'size')::bigint, -1) <> v_asset.size_bytes
     or coalesce(v_object.metadata->>'mimetype', '') <> v_asset.mime_type then
    return jsonb_build_object('ok', false, 'reason', 'uploaded_asset_mismatch');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('bucket', storage_bucket, 'path', storage_path)), '[]'::jsonb)
    into v_cleanup from public.marketing_reel_assets
   where reel_job_id = p_job_id and asset_kind = v_asset.asset_kind and state = 'ready';
  update public.marketing_reel_assets set state = 'superseded',
    updated_at = timezone('utc'::text, now())
   where reel_job_id = p_job_id and asset_kind = v_asset.asset_kind and state = 'ready';
  update public.marketing_reel_assets set state = 'ready', uploaded_by = auth.uid(),
    uploaded_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
   where id = p_asset_id;
  if v_asset.asset_kind = 'raw' then
    update public.marketing_reel_jobs set state = 'received',
      received_at = coalesce(received_at, timezone('utc'::text, now())),
      updated_at = timezone('utc'::text, now()) where id = p_job_id;
  end if;
  return jsonb_build_object('ok', true, 'idempotent', false, 'jobId', p_job_id,
    'assetId', p_asset_id, 'state', case when v_asset.asset_kind = 'raw' then 'received' else v_job.state end,
    'cleanup', v_cleanup);
end;
$$;

create or replace function public.plotmap_marketing_mark_reel_in_editing(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_job public.marketing_reel_jobs%rowtype;
begin
  select * into v_job from public.marketing_reel_jobs where id = p_job_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.plotmap_marketing_can_operate(v_job.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if v_job.state = 'in_editing' then return jsonb_build_object('ok', true, 'idempotent', true, 'state', 'in_editing'); end if;
  if v_job.state <> 'received' then return jsonb_build_object('ok', false, 'reason', 'invalid_transition'); end if;
  update public.marketing_reel_jobs set state = 'in_editing',
    editing_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
   where id = p_job_id;
  return jsonb_build_object('ok', true, 'idempotent', false, 'state', 'in_editing');
end;
$$;

create or replace function public.plotmap_marketing_prepare_finished_reel(
  p_job_id uuid, p_upload_key text, p_mime text, p_bytes bigint,
  p_content_hash text, p_duration_seconds numeric default null,
  p_width integer default null, p_height integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_job public.marketing_reel_jobs%rowtype; v_period_start date;
declare v_asset public.marketing_reel_assets%rowtype; v_asset_id uuid := gen_random_uuid();
declare v_hash text; v_path text; v_ext text;
begin
  select * into v_job from public.marketing_reel_jobs where id = p_job_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.plotmap_marketing_can_operate(v_job.dealer_id) then return jsonb_build_object('ok', false, 'reason', 'not_authorised'); end if;
  if v_job.state not in ('received', 'in_editing', 'replacement_needed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition');
  end if;
  if coalesce(p_upload_key, '') !~ '^[A-Za-z0-9_.:-]{8,120}$'
     or p_mime not in ('video/mp4', 'video/quicktime', 'video/webm')
     or p_bytes not between 1 and 157286400
     or coalesce(p_content_hash, '') !~ '^[0-9a-f]{64}$'
     or (p_duration_seconds is not null and p_duration_seconds not between 0 and 21600) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_asset');
  end if;
  v_hash := encode(digest(convert_to(jsonb_build_object('mime', p_mime, 'bytes', p_bytes,
    'contentHash', p_content_hash, 'duration', p_duration_seconds,
    'width', p_width, 'height', p_height)::text, 'utf8'), 'sha256'), 'hex');
  select * into v_asset from public.marketing_reel_assets
   where reel_job_id = p_job_id and asset_kind = 'finished' and upload_key = p_upload_key;
  if found then
    if v_asset.request_hash <> v_hash then return jsonb_build_object('ok', false, 'reason', 'idempotency_conflict'); end if;
    return jsonb_build_object('ok', true, 'idempotent', true, 'assetId', v_asset.id,
      'upload', jsonb_build_object('bucket', v_asset.storage_bucket, 'path', v_asset.storage_path));
  end if;
  select period_start into v_period_start from public.marketing_periods where id = v_job.period_id;
  v_ext := public.plotmap_marketing_reel_extension(p_mime);
  v_path := v_job.dealer_id || '/' || v_period_start || '/' || v_job.id || '/finished/' || v_asset_id || '-' || p_content_hash || '.' || v_ext;
  insert into public.marketing_reel_assets (
    id, dealer_id, reel_job_id, asset_kind, state, upload_key, request_hash,
    storage_bucket, storage_path, mime_type, size_bytes, content_hash,
    duration_seconds, width, height
  ) values (
    v_asset_id, v_job.dealer_id, v_job.id, 'finished', 'pending', p_upload_key, v_hash,
    'marketing-reel-finished', v_path, p_mime, p_bytes, p_content_hash,
    p_duration_seconds, p_width, p_height
  ) returning * into v_asset;
  return jsonb_build_object('ok', true, 'idempotent', false, 'assetId', v_asset.id,
    'upload', jsonb_build_object('bucket', v_asset.storage_bucket, 'path', v_asset.storage_path));
end;
$$;

create or replace function public.plotmap_marketing_mark_reel_ready(
  p_job_id uuid, p_asset_id uuid, p_caption text default null,
  p_channels jsonb default '[]'::jsonb, p_scheduled_for timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_job public.marketing_reel_jobs%rowtype; v_asset public.marketing_reel_assets%rowtype;
declare v_period public.marketing_periods%rowtype; v_context uuid; v_creative uuid; v_channel text;
begin
  select * into v_job from public.marketing_reel_jobs where id = p_job_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.plotmap_marketing_can_operate(v_job.dealer_id) then return jsonb_build_object('ok', false, 'reason', 'not_authorised'); end if;
  if v_job.creative_id is not null and v_job.state = 'ready' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'creativeId', v_job.creative_id, 'creativeType', 'reel');
  end if;
  if v_job.state not in ('received', 'in_editing', 'replacement_needed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition');
  end if;
  if not public.plotmap_marketing_property_is_marketable(v_job.dealer_id, v_job.property_id) then
    return jsonb_build_object('ok', false, 'reason', 'property_not_marketable');
  end if;
  select * into v_asset from public.marketing_reel_assets
   where id = p_asset_id and reel_job_id = p_job_id and asset_kind = 'finished' and state = 'ready';
  if not found then return jsonb_build_object('ok', false, 'reason', 'finished_asset_not_ready'); end if;
  if length(coalesce(p_caption, '')) > 2200
     or jsonb_typeof(coalesce(p_channels, '[]'::jsonb)) <> 'array'
     or exists (select 1 from jsonb_array_elements_text(coalesce(p_channels, '[]'::jsonb)) c
       where c not in ('instagram', 'facebook_page')) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_metadata');
  end if;
  if exists (select 1 from jsonb_array_elements_text(coalesce(p_channels, '[]'::jsonb)) c
    where not exists (select 1 from public.marketing_channel_accounts a
      where a.dealer_id = v_job.dealer_id and a.provider = c and a.status = 'connected')) then
    return jsonb_build_object('ok', false, 'reason', 'channel_unavailable');
  end if;
  select * into v_period from public.marketing_periods where id = v_job.period_id;
  v_context := public.plotmap_marketing_safe_context_for(v_job.dealer_id, v_job.property_id);
  insert into public.marketing_creatives (
    dealer_id, content_context_id, property_id, creative_type, design_key,
    design_version, channel, format, status, copy, asset, approved_by, approved_at
  ) values (
    v_job.dealer_id, v_context, v_job.property_id, 'reel', 'operator-edited-reel',
    'v1', 'generic', 'story', 'approved',
    jsonb_build_object('caption', coalesce(p_caption, '')),
    jsonb_build_object('bucket', v_asset.storage_bucket, 'path', v_asset.storage_path,
      'mime', v_asset.mime_type, 'w', v_asset.width, 'h', v_asset.height,
      'bytes', v_asset.size_bytes, 'durationSeconds', v_asset.duration_seconds),
    auth.uid(), timezone('utc'::text, now())
  ) returning id into v_creative;
  for v_channel in select value from jsonb_array_elements_text(coalesce(p_channels, '[]'::jsonb)) loop
    insert into public.marketing_schedule_items (
      dealer_id, creative_id, channel, slot_key, scheduled_for, status,
      approval_required, approved_by, approved_at
    ) values (
      v_job.dealer_id, v_creative, v_channel,
      v_period.period_start || '-R' || lpad(v_job.quota_number::text, 3, '0') || '-' || v_channel,
      coalesce(p_scheduled_for, timezone('utc'::text, now())), 'approved', true,
      auth.uid(), timezone('utc'::text, now())
    ) on conflict (dealer_id, channel, slot_key) do update set
      creative_id = excluded.creative_id, scheduled_for = excluded.scheduled_for,
      status = 'approved', approved_by = excluded.approved_by,
      approved_at = excluded.approved_at, updated_at = timezone('utc'::text, now());
  end loop;
  update public.marketing_reel_jobs set state = 'ready', creative_id = v_creative,
    ready_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
   where id = p_job_id;
  return jsonb_build_object('ok', true, 'idempotent', false,
    'creativeId', v_creative, 'creativeType', 'reel', 'state', 'ready');
end;
$$;

-- ---------- broker projections: no raw paths to browsers ----------
create or replace function public.plotmap_marketing_ops_reels_for(
  p_actor uuid, p_dealer_id text, p_period_start date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.plotmap_marketing_actor_can_operate(p_actor, p_dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  return jsonb_build_object('ok', true, 'dealerId', p_dealer_id,
    'jobs', coalesce((select jsonb_agg(jsonb_build_object(
      'id', j.id, 'periodStart', p.period_start, 'quotaNumber', j.quota_number,
      'propertyId', j.property_id,
      'propertyLabel', coalesce(nullif(trim(r.payload->>'area'), ''), r.payload->>'type', j.property_id)
        || case when coalesce(trim(r.payload->>'size'), '') <> '' then ' · ' || (r.payload->>'size') else '' end,
      'note', j.dealer_note, 'state', j.state, 'createdAt', j.created_at,
      'receivedAt', j.received_at, 'editingAt', j.editing_at, 'readyAt', j.ready_at,
      'rawReady', exists (select 1 from public.marketing_reel_assets a
        where a.reel_job_id = j.id and a.asset_kind = 'raw' and a.state = 'ready'),
      'finishedReady', exists (select 1 from public.marketing_reel_assets a
        where a.reel_job_id = j.id and a.asset_kind = 'finished' and a.state = 'ready'),
      'creativeId', j.creative_id
    ) order by p.period_start desc, j.quota_number)
      from public.marketing_reel_jobs j
      join public.marketing_periods p on p.id = j.period_id
      join public.crm_records r on r.id = j.property_id and r.dealer_id = j.dealer_id
     where j.dealer_id = p_dealer_id
       and (p_period_start is null or p.period_start = p_period_start)), '[]'::jsonb));
end;
$$;

create or replace function public.plotmap_marketing_reel_media_for(
  p_actor uuid, p_job_id uuid, p_kind text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_job public.marketing_reel_jobs%rowtype; v_asset public.marketing_reel_assets%rowtype;
declare v_actor_dealer text; v_operator boolean;
begin
  if p_kind not in ('raw', 'finished') then return jsonb_build_object('ok', false, 'reason', 'invalid_kind'); end if;
  select * into v_job from public.marketing_reel_jobs where id = p_job_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  v_operator := public.plotmap_marketing_actor_can_operate(p_actor, v_job.dealer_id);
  select dealer_id into v_actor_dealer from public.profiles where id = p_actor and status = 'active';
  if not v_operator and not (p_kind = 'finished' and v_job.state = 'ready' and v_actor_dealer = v_job.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  select * into v_asset from public.marketing_reel_assets
   where reel_job_id = p_job_id and asset_kind = p_kind and state = 'ready';
  if not found then return jsonb_build_object('ok', false, 'reason', 'asset_not_ready'); end if;
  return jsonb_build_object('ok', true, 'jobId', p_job_id, 'kind', p_kind,
    'bucket', v_asset.storage_bucket, 'path', v_asset.storage_path,
    'mime', v_asset.mime_type, 'bytes', v_asset.size_bytes,
    'durationSeconds', v_asset.duration_seconds, 'width', v_asset.width, 'height', v_asset.height);
end;
$$;

-- Feed now reads every canonical creative, whether it came from a legacy
-- weekly slot, a monthly Post slot, or a Reel Job.
create or replace function public.plotmap_marketing_dealer_feed_for(p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_dealer text; v_period uuid; v_usage jsonb;
begin
  select p.dealer_id into v_dealer from public.profiles p
   where p.id = p_actor and p.status = 'active' and p.role in ('owner', 'manager');
  if v_dealer is null or not public.plotmap_dealer_is_active(v_dealer) then
    return jsonb_build_object('ok', false, 'reason', 'dealer_marketing_access_required');
  end if;
  v_period := public.plotmap_marketing_ensure_period_for(v_dealer, current_date);
  v_usage := public.plotmap_marketing_usage_for(p_actor, current_date);
  return jsonb_build_object(
    'ok', true, 'dealerId', v_dealer, 'usage', v_usage - 'ok' - 'dealerId',
    'creatives', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'creativeType', c.creative_type,
      'slotRef', coalesce(ms.slot_ref, ws.slot_ref,
        case when rj.id is not null then 'R' || lpad(rj.quota_number::text, 3, '0') else null end),
      'localDate', coalesce(ms.scheduled_for, ws.local_date, rj.ready_at::date, c.approved_at::date),
      'status', c.status, 'propertyId', c.property_id,
      'propertyLabel', coalesce(nullif(trim(ctx.facts#>>'{property,area}'), ''),
        ctx.facts#>>'{property,type}', c.property_id)
        || case when coalesce(trim(ctx.facts#>>'{property,size}'), '') <> ''
          then ' · ' || (ctx.facts#>>'{property,size}') else '' end,
      'caption', c.copy->>'caption', 'approvedAt', c.approved_at,
      'readyAt', coalesce(rj.ready_at, c.approved_at),
      'durationSeconds', case when c.creative_type = 'reel' then c.asset->'durationSeconds' else null end,
      'channels', coalesce((select jsonb_agg(si.channel order by si.channel)
        from public.marketing_schedule_items si where si.creative_id = c.id), '[]'::jsonb),
      'asset', jsonb_build_object('bucket', c.asset->>'bucket', 'path', c.asset->>'path',
        'mime', c.asset->>'mime', 'width', c.asset->'w', 'height', c.asset->'h',
        'bytes', c.asset->'bytes', 'durationSeconds', c.asset->'durationSeconds'),
      'publicationStates', coalesce((select jsonb_agg(jsonb_build_object(
        'channel', p.channel, 'status', p.status,
        'publishedAt', case when p.status = 'succeeded' then p.created_at else null end)
        order by p.created_at) from public.marketing_publications p where p.creative_id = c.id), '[]'::jsonb)
    ) order by coalesce(rj.ready_at, c.approved_at, c.created_at) desc)
      from public.marketing_creatives c
      join public.marketing_content_contexts ctx on ctx.id = c.content_context_id
      left join public.marketing_post_slots ms on ms.creative_id = c.id
      left join public.marketing_output_slots ws on ws.creative_id = c.id
      left join public.marketing_reel_jobs rj on rj.creative_id = c.id
     where c.dealer_id = v_dealer and c.status in ('approved', 'published')), '[]'::jsonb),
    'performance', coalesce((select jsonb_agg(jsonb_build_object(
      'provider', m.provider, 'scope', m.scope, 'periodStart', m.period_start,
      'periodEnd', m.period_end, 'metrics', m.metrics) order by m.period_end desc)
      from public.external_performance_metrics m where m.dealer_id = v_dealer), '[]'::jsonb),
    'connections', coalesce((select jsonb_agg(jsonb_build_object(
      'provider', a.provider, 'displayName', a.display_name, 'status', a.status,
      'connectedAt', a.connected_at) order by a.provider)
      from public.marketing_channel_accounts a where a.dealer_id = v_dealer), '[]'::jsonb)
  );
end;
$$;

-- ---------- grants ----------
revoke all on function public.plotmap_marketing_property_is_marketable(text, text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_ensure_period_for(text, date) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_safe_context_for(text, text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_reel_extension(text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_usage_for(uuid, date) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_ops_reels_for(uuid, text, date) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_reel_media_for(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_dealer_feed_for(uuid) from public, anon, authenticated;

revoke all on function public.plotmap_marketing_open_period(text, date) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_usage() from public, anon, authenticated;
revoke all on function public.plotmap_marketing_claim_post_slot(text, text, text, date, date) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_record_monthly_post_result(uuid, text, text, integer, integer, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_approve_monthly_post(uuid) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_request_post_replacement(uuid) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_reserve_reel(text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_replace_reel_raw(uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_can_upload_reel_path(text, text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_finalize_reel_asset(uuid, uuid) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_mark_reel_in_editing(uuid) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_prepare_finished_reel(uuid, text, text, bigint, text, numeric, integer, integer) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_mark_reel_ready(uuid, uuid, text, jsonb, timestamptz) from public, anon, authenticated;

grant execute on function public.plotmap_marketing_open_period(text, date) to authenticated;
grant execute on function public.plotmap_marketing_usage() to authenticated;
grant execute on function public.plotmap_marketing_claim_post_slot(text, text, text, date, date) to authenticated;
grant execute on function public.plotmap_marketing_record_monthly_post_result(uuid, text, text, integer, integer, integer, text, text, jsonb) to authenticated;
grant execute on function public.plotmap_marketing_approve_monthly_post(uuid) to authenticated;
grant execute on function public.plotmap_marketing_request_post_replacement(uuid) to authenticated;
grant execute on function public.plotmap_marketing_reserve_reel(text, text, text, text, bigint, text) to authenticated;
grant execute on function public.plotmap_marketing_replace_reel_raw(uuid, text, text, bigint, text) to authenticated;
grant execute on function public.plotmap_marketing_can_upload_reel_path(text, text) to authenticated;
grant execute on function public.plotmap_marketing_finalize_reel_asset(uuid, uuid) to authenticated;
grant execute on function public.plotmap_marketing_mark_reel_in_editing(uuid) to authenticated;
grant execute on function public.plotmap_marketing_prepare_finished_reel(uuid, text, text, bigint, text, numeric, integer, integer) to authenticated;
grant execute on function public.plotmap_marketing_mark_reel_ready(uuid, uuid, text, jsonb, timestamptz) to authenticated;

grant execute on function public.plotmap_marketing_usage_for(uuid, date) to service_role;
grant execute on function public.plotmap_marketing_ops_reels_for(uuid, text, date) to service_role;
grant execute on function public.plotmap_marketing_reel_media_for(uuid, uuid, text) to service_role;
grant execute on function public.plotmap_marketing_dealer_feed_for(uuid) to service_role;

comment on table public.marketing_periods is
  'Canonical entitlement period. V1 is calendar-month; anchor_day/period_kind allow later billing-cycle alignment.';
comment on table public.marketing_post_slots is
  'Exactly 30 Post entitlement slots per dealer/month. A consumed slot remains consumed through failure, retry, and replacement.';
comment on table public.marketing_weekly_plans is
  'Legacy Marketing V1 production-pack history. New entitlement work uses marketing_periods; do not create new weekly dealer entitlements.';
comment on table public.marketing_output_slots is
  'Legacy Marketing V1 weekly Post-slot history. New monthly Posts use marketing_post_slots and the same canonical creative pipeline.';
comment on table public.marketing_reel_jobs is
  'One quota-consuming dealer submission. Replacement media stays on the same job and never consumes a second entitlement.';
comment on table public.marketing_reel_assets is
  'Private raw/finished media lineage. Only one ready asset per job/kind; superseded object paths are returned for service-role cleanup.';
