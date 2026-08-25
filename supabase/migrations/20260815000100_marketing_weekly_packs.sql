-- ============================================================
-- MAPCO Marketing Operations · weekly production
-- ------------------------------------------------------------
-- NOT YET APPLIED. Authored for review.
--
-- Extends 20260812000400_marketing_foundation.sql rather than
-- replacing it. That migration modelled the domain well but left it
-- INERT: all six tables are SELECT-only, and only two write RPCs exist,
-- so creatives/schedule/publications have no write path at all.
--
-- V1 IS HUMAN-DIRECTED. An internal MAPCO operator is the creative
-- director and produces the final images in consumer ChatGPT. MAPCO
-- prepares data, tracks production and keeps dealers isolated. MAPCO
-- does NOT choose a template, a creative angle, an objective or the
-- property behind any single output — so none of those are modelled.
--
-- Adds:
--   marketing_settings           per-dealer weekly configuration
--   marketing_operator_dealers   which operator may work which dealer
--   marketing_weekly_plans       one week per dealer, idempotent
--   marketing_output_slots       28 empty output slots (7 × 4)
--   marketing_creative_results   the finished image the operator returns
--
-- Reuses, and does not duplicate:
--   • marketing_content_contexts — frozen verified facts + photo refs
--   • marketing_creatives        — the dealer-visible approved asset
--   • marketing_schedule_items   — the dealer-facing pipeline
--   • ai_jobs                    — queue, idempotency keys, leases
--
-- Writes go through SECURITY DEFINER RPCs, matching the existing
-- pattern: no table below carries an INSERT/UPDATE policy.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 1. per-dealer weekly configuration ----------
create table if not exists public.marketing_settings (
  dealer_id          text primary key
                     references public.dealer_settings(dealer_id) on delete cascade,
  automation_enabled boolean not null default false,   -- opt-in
  timezone           text not null default 'Asia/Kolkata',
  -- Local weekday + time the week is opened for production. 1 = Monday.
  prepare_weekday    integer not null default 1 check (prepare_weekday between 1 and 7),
  prepare_at_local   time not null default '06:00',
  -- The hard business requirement: 4 outputs per day.
  per_day            integer not null default 4 check (per_day between 1 and 8),
  updated_at         timestamptz not null default timezone('utc'::text, now())
);

alter table public.marketing_settings enable row level security;

create policy "marketing settings dealer read"
on public.marketing_settings for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

-- ---------- 2. operator → dealer assignment ----------
-- Enforced in RLS and again in every RPC, so a UI bug cannot cross dealers.
create table if not exists public.marketing_operator_dealers (
  id          uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles(id) on delete cascade,
  dealer_id   text not null references public.dealer_settings(dealer_id) on delete cascade,
  assigned_at timestamptz not null default timezone('utc'::text, now()),
  unique (operator_id, dealer_id)
);

alter table public.marketing_operator_dealers enable row level security;

create policy "operators read their own assignments"
on public.marketing_operator_dealers for select to authenticated
using (operator_id = auth.uid());

-- True when the caller may operate this dealer.
create or replace function public.plotmap_marketing_can_operate(p_dealer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.marketing_operator_dealers a
     where a.operator_id = auth.uid() and a.dealer_id = p_dealer_id
  ) or public.plotmap_is_platform_admin();
$$;

revoke all on function public.plotmap_marketing_can_operate(text) from public;
grant execute on function public.plotmap_marketing_can_operate(text) to authenticated;

-- ---------- 3. the week ----------
create table if not exists public.marketing_weekly_plans (
  id           uuid primary key default gen_random_uuid(),
  dealer_id    text not null references public.dealer_settings(dealer_id) on delete cascade,
  week_id      text not null check (week_id ~ '^[0-9]{4}-W[0-9]{2}$'),
  week_start   date not null,
  timezone     text not null,
  per_day      integer not null default 4 check (per_day between 1 and 8),
  target_count integer not null check (target_count > 0),
  status       text not null default 'open'
               check (status in ('open', 'complete', 'archived')),
  -- When the operator last took this dealer's AI marketing pack.
  pack_downloaded_at timestamptz,
  -- Optional queue provenance. V1 does not activate dormant AI jobs.
  job_id       uuid,
  created_at   timestamptz not null default timezone('utc'::text, now())
);

-- THE idempotency guarantee: a retried or duplicated scheduler run
-- conflicts here instead of creating a second week.
create unique index if not exists marketing_weekly_plans_uidx
  on public.marketing_weekly_plans (dealer_id, week_id);
create index if not exists marketing_weekly_plans_dealer_idx
  on public.marketing_weekly_plans (dealer_id, week_start desc);

alter table public.marketing_weekly_plans enable row level security;

create policy "weekly plans dealer read"
on public.marketing_weekly_plans for select to authenticated
using (public.plotmap_is_active_member() and dealer_id = public.plotmap_current_dealer_id());

create policy "weekly plans operator read"
on public.marketing_weekly_plans for select to authenticated
using (public.plotmap_marketing_can_operate(dealer_id));

-- ---------- 4. output slots (the production tracker) ----------
-- An EMPTY box to be filled. No property, template, angle or objective
-- at planning time — the operator decides all of that in ChatGPT and
-- records it when the finished image is uploaded.
create table if not exists public.marketing_output_slots (
  id           uuid primary key default gen_random_uuid(),
  dealer_id    text not null references public.dealer_settings(dealer_id) on delete cascade,
  plan_id      uuid not null references public.marketing_weekly_plans(id) on delete cascade,
  slot_ref     text not null check (slot_ref ~ '^C[0-9]{3}$'),
  day_index    integer not null check (day_index between 0 and 6),
  slot_index   integer not null check (slot_index between 0 and 7),
  local_date   date not null,

  -- Recorded on upload. A creative may legitimately feature more than one.
  property_ids  jsonb not null default '[]'::jsonb,
  caption       text,
  operator_note text,

  content_context_id uuid references public.marketing_content_contexts(id) on delete set null,
  -- The dealer-visible creative, once approved.
  creative_id        uuid references public.marketing_creatives(id) on delete set null,

  status       text not null default 'waiting' check (status in (
                 'waiting', 'uploaded', 'reviewed', 'approved',
                 'ready', 'posted', 'failed')),
  uploaded_by  uuid references public.profiles(id) on delete set null,
  uploaded_at  timestamptz,
  approved_by  uuid references public.profiles(id) on delete set null,
  approved_at  timestamptz,
  created_at   timestamptz not null default timezone('utc'::text, now()),
  updated_at   timestamptz not null default timezone('utc'::text, now()),

  unique (plan_id, slot_ref),
  unique (plan_id, day_index, slot_index)
);

create index if not exists marketing_output_slots_dealer_idx
  on public.marketing_output_slots (dealer_id, local_date);
create index if not exists marketing_output_slots_status_idx
  on public.marketing_output_slots (dealer_id, status);

alter table public.marketing_output_slots enable row level security;

-- The DEALER only ever sees work that reached approval. Internal
-- production state stays inside the ops team.
create policy "output slots dealer read approved"
on public.marketing_output_slots for select to authenticated
using (
  public.plotmap_is_active_member()
  and dealer_id = public.plotmap_current_dealer_id()
  and status in ('approved', 'ready', 'posted')
);

-- The OPERATOR sees every slot for a dealer they are assigned to.
create policy "output slots operator read"
on public.marketing_output_slots for select to authenticated
using (public.plotmap_marketing_can_operate(dealer_id));

-- ---------- 5. returned creative images ----------
-- Stored as a private storage reference, never a blob in a CRM record.
create table if not exists public.marketing_creative_results (
  id             uuid primary key default gen_random_uuid(),
  dealer_id      text not null references public.dealer_settings(dealer_id) on delete cascade,
  slot_id        uuid not null references public.marketing_output_slots(id) on delete cascade,
  slot_ref       text not null,
  asset_bucket   text not null default 'marketing-creatives',
  asset_path     text not null,
  mime           text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  bytes          integer not null check (bytes > 0 and bytes <= 15728640),
  width          integer, height integer,
  -- sha256 — catches the same file being uploaded twice.
  content_hash   text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  uploaded_by    uuid references public.profiles(id) on delete set null,
  uploaded_at    timestamptz not null default timezone('utc'::text, now()),
  superseded     boolean not null default false
);

-- One current image per slot; a re-upload supersedes rather than duplicates.
create unique index if not exists marketing_creative_results_current_uidx
  on public.marketing_creative_results (slot_id) where superseded = false;

alter table public.marketing_creative_results enable row level security;

create policy "creative results operator read"
on public.marketing_creative_results for select to authenticated
using (public.plotmap_marketing_can_operate(dealer_id));

-- ============================================================
-- WRITE PATH — SECURITY DEFINER RPCs
-- Each re-derives the caller from the JWT and checks operator
-- assignment. No table above has an INSERT/UPDATE policy.
-- ============================================================

-- Open a dealer's week and create its 28 empty slots. Idempotent: a
-- second call returns the existing week and never disturbs work.
create or replace function public.plotmap_marketing_open_week(
  p_dealer_id text,
  p_week_id text,
  p_week_start date,
  p_timezone text,
  p_per_day integer default 4
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_created boolean := false;
  v_day integer;
  v_slot integer;
  v_n integer := 0;
  v_per_day integer := greatest(1, least(8, coalesce(p_per_day, 4)));
begin
  if not public.plotmap_marketing_can_operate(p_dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;

  select id into v_plan_id from public.marketing_weekly_plans
   where dealer_id = p_dealer_id and week_id = p_week_id;

  if v_plan_id is null then
    insert into public.marketing_weekly_plans (
      dealer_id, week_id, week_start, timezone, per_day, target_count)
    values (p_dealer_id, p_week_id, p_week_start, p_timezone,
            v_per_day, v_per_day * 7)
    returning id into v_plan_id;
    v_created := true;

    for v_day in 0..6 loop
      for v_slot in 0..(v_per_day - 1) loop
        v_n := v_n + 1;
        insert into public.marketing_output_slots (
          dealer_id, plan_id, slot_ref, day_index, slot_index, local_date)
        values (
          p_dealer_id, v_plan_id,
          'C' || lpad(v_n::text, 3, '0'),
          v_day, v_slot, p_week_start + v_day)
        on conflict (plan_id, slot_ref) do nothing;
      end loop;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true, 'planId', v_plan_id, 'created', v_created, 'idempotent', not v_created);
end;
$$;

revoke all on function public.plotmap_marketing_open_week(text, text, date, text, integer) from public;
grant execute on function public.plotmap_marketing_open_week(text, text, date, text, integer) to authenticated;

-- Record the finished image the operator returned from ChatGPT, plus
-- the property association THEY chose. Supersedes any prior upload.
create or replace function public.plotmap_marketing_record_result(
  p_slot_id uuid,
  p_asset_path text,
  p_mime text,
  p_bytes integer,
  p_width integer,
  p_height integer,
  p_content_hash text,
  p_property_ids jsonb default '[]'::jsonb,
  p_caption text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.marketing_output_slots%rowtype;
begin
  select * into v_slot from public.marketing_output_slots where id = p_slot_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not public.plotmap_marketing_can_operate(v_slot.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;

  update public.marketing_creative_results
     set superseded = true
   where slot_id = p_slot_id and superseded = false;

  insert into public.marketing_creative_results (
    dealer_id, slot_id, slot_ref, asset_path, mime, bytes,
    width, height, content_hash, uploaded_by)
  values (v_slot.dealer_id, p_slot_id, v_slot.slot_ref, p_asset_path, p_mime,
          p_bytes, p_width, p_height, p_content_hash, auth.uid());

  update public.marketing_output_slots
     set status = 'uploaded',
         property_ids = coalesce(p_property_ids, property_ids),
         caption = coalesce(p_caption, caption),
         uploaded_by = auth.uid(),
         uploaded_at = timezone('utc'::text, now()),
         updated_at = timezone('utc'::text, now())
   where id = p_slot_id;

  return jsonb_build_object('ok', true, 'slotRef', v_slot.slot_ref);
end;
$$;

revoke all on function public.plotmap_marketing_record_result(
  uuid, text, text, integer, integer, integer, text, jsonb, text) from public;
grant execute on function public.plotmap_marketing_record_result(
  uuid, text, text, integer, integer, integer, text, jsonb, text) to authenticated;

-- Approve a slot and release it into the dealer's OWN Marketing
-- pipeline by writing the marketing_creatives row the dealer sees.
-- Nothing here publishes: no connector exists, so the honest terminal
-- state is 'ready' (ready to publish).
create or replace function public.plotmap_marketing_approve_slot(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.marketing_output_slots%rowtype;
  v_result public.marketing_creative_results%rowtype;
  v_creative_id uuid;
begin
  select * into v_slot from public.marketing_output_slots where id = p_slot_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if not public.plotmap_marketing_can_operate(v_slot.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;

  select * into v_result from public.marketing_creative_results
   where slot_id = p_slot_id and superseded = false;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_image_uploaded');
  end if;

  -- Reuse the EXISTING dealer-facing table rather than a second store.
  insert into public.marketing_creatives (
    dealer_id, content_context_id, property_id,
    design_key, design_version, channel, format, status, copy, asset,
    approved_by, approved_at)
  values (
    v_slot.dealer_id,
    v_slot.content_context_id,
    coalesce(v_slot.property_ids->>0, ''),
    'operator-chatgpt', 'v1', 'generic', 'portrait', 'approved',
    jsonb_build_object('caption', coalesce(v_slot.caption, '')),
    jsonb_build_object('bucket', v_result.asset_bucket, 'path', v_result.asset_path,
                       'w', v_result.width, 'h', v_result.height, 'bytes', v_result.bytes),
    auth.uid(), timezone('utc'::text, now()))
  returning id into v_creative_id;

  update public.marketing_output_slots
     set status = 'ready',
         creative_id = v_creative_id,
         approved_by = auth.uid(),
         approved_at = timezone('utc'::text, now()),
         updated_at = timezone('utc'::text, now())
   where id = p_slot_id;

  return jsonb_build_object('ok', true, 'creativeId', v_creative_id, 'state', 'ready_to_publish');
end;
$$;

revoke all on function public.plotmap_marketing_approve_slot(uuid) from public;
grant execute on function public.plotmap_marketing_approve_slot(uuid) to authenticated;

-- Record that the operator took this dealer's pack.
create or replace function public.plotmap_marketing_mark_pack_downloaded(
  p_dealer_id text, p_week_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.plotmap_marketing_can_operate(p_dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  update public.marketing_weekly_plans
     set pack_downloaded_at = timezone('utc'::text, now())
   where dealer_id = p_dealer_id and week_id = p_week_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.plotmap_marketing_mark_pack_downloaded(text, text) from public;
grant execute on function public.plotmap_marketing_mark_pack_downloaded(text, text) to authenticated;

-- Dealers whose week should be opened, in their own local time. Called
-- by the scheduler with the service role; enqueues one job per dealer
-- through the existing ai_jobs queue rather than one cron per dealer.
create or replace function public.plotmap_marketing_due_dealers()
returns table (dealer_id text, timezone text, week_id text, week_start date)
language sql
stable
security definer
set search_path = public
as $$
  select s.dealer_id,
         s.timezone,
         to_char((now() at time zone s.timezone)::date, 'IYYY-"W"IW') as week_id,
         (date_trunc('week', (now() at time zone s.timezone))::date) as week_start
    from public.marketing_settings s
    join public.dealer_settings d on d.dealer_id = s.dealer_id
   where s.automation_enabled
     and d.account_status = 'active'
     and extract(isodow from (now() at time zone s.timezone)) = s.prepare_weekday
     and (now() at time zone s.timezone)::time >= s.prepare_at_local
     and not exists (
       select 1 from public.marketing_weekly_plans p
        where p.dealer_id = s.dealer_id
          and p.week_id = to_char((now() at time zone s.timezone)::date, 'IYYY-"W"IW')
     );
$$;

revoke all on function public.plotmap_marketing_due_dealers() from public;
-- service_role only: scheduler infrastructure, not a dealer or operator API.

comment on table public.marketing_output_slots is
  'Production tracker: 28 empty output slots per dealer per week. MAPCO plans no creative strategy — the operator records the property and caption when uploading the finished ChatGPT image.';
comment on function public.plotmap_marketing_open_week(text, text, date, text, integer) is
  'Idempotent. A second call for the same (dealer, week) returns the existing plan and never disturbs uploaded work.';
comment on function public.plotmap_marketing_approve_slot(uuid) is
  'Releases an approved creative into the dealer''s existing marketing_creatives pipeline at ready_to_publish. Never claims a post was published — no connector exists.';
