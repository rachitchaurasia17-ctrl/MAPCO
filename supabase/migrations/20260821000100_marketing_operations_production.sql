-- ============================================================
-- MAPCO Marketing Operations · production workflow hardening
-- Target: MAPCO-DEV. No seed rows, fixtures, or publishing claims.
-- ============================================================

create extension if not exists pgcrypto;

-- A dealer profile is not an internal operator merely because it can open
-- an URL. Internal status and the dealer assignment are both persisted.
create table if not exists public.marketing_internal_operators (
  operator_id uuid primary key references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);
alter table public.marketing_internal_operators enable row level security;

alter table public.marketing_weekly_plans
  add column if not exists inventory_baseline jsonb not null default '[]'::jsonb;
alter table public.marketing_output_slots
  add column if not exists selected_channels jsonb not null default '[]'::jsonb;

update public.marketing_settings set per_day = 4 where per_day <> 4;
update public.marketing_weekly_plans set per_day = 4, target_count = 28
 where per_day <> 4 or target_count <> 28;

alter table public.marketing_settings drop constraint if exists marketing_settings_per_day_check;
alter table public.marketing_settings add constraint marketing_settings_per_day_check check (per_day = 4);
alter table public.marketing_weekly_plans drop constraint if exists marketing_weekly_plans_per_day_check;
alter table public.marketing_weekly_plans add constraint marketing_weekly_plans_per_day_check check (per_day = 4);
alter table public.marketing_weekly_plans drop constraint if exists marketing_weekly_plans_target_count_check;
alter table public.marketing_weekly_plans add constraint marketing_weekly_plans_target_count_check check (target_count = 28);
alter table public.marketing_output_slots drop constraint if exists marketing_output_slots_slot_index_check;
alter table public.marketing_output_slots add constraint marketing_output_slots_slot_index_check check (slot_index between 0 and 3);
alter table public.marketing_output_slots drop constraint if exists marketing_output_slots_selected_channels_check;
alter table public.marketing_output_slots add constraint marketing_output_slots_selected_channels_check check (
  jsonb_typeof(selected_channels) = 'array'
  and jsonb_array_length(selected_channels) <= 4
  and octet_length(selected_channels::text) <= 256
);

-- Align the canonical provider-neutral channel vocabulary with the runtime.
alter table public.marketing_creatives drop constraint if exists marketing_creatives_channel_check;
alter table public.marketing_creatives add constraint marketing_creatives_channel_check check (
  channel in ('generic', 'instagram', 'facebook_page', 'google_business', 'whatsapp_business')
);
alter table public.marketing_schedule_items drop constraint if exists marketing_schedule_items_channel_check;
alter table public.marketing_schedule_items add constraint marketing_schedule_items_channel_check check (
  channel in ('instagram', 'facebook_page', 'google_business', 'whatsapp_business')
);
alter table public.marketing_channel_accounts drop constraint if exists marketing_channel_accounts_provider_check;
alter table public.marketing_channel_accounts add constraint marketing_channel_accounts_provider_check check (
  provider in ('instagram', 'facebook_page', 'google_business', 'whatsapp_business')
);

create table if not exists public.marketing_new_property_actions (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null references public.dealer_settings(dealer_id) on delete cascade,
  plan_id uuid not null references public.marketing_weekly_plans(id) on delete cascade,
  property_id text not null,
  stage text not null default 'detected' check (stage in ('detected','assigned','uploaded','approved','dismissed')),
  assigned_slot_id uuid references public.marketing_output_slots(id) on delete set null,
  detected_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (plan_id, property_id)
);
create index if not exists marketing_new_property_actions_dealer_idx
  on public.marketing_new_property_actions (dealer_id, plan_id, stage);
alter table public.marketing_new_property_actions enable row level security;

-- Private output bucket. Objects are never public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-creatives', 'marketing-creatives', false, 15728640,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.plotmap_marketing_actor_can_operate(
  p_actor uuid, p_dealer_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_actor is not null
    and coalesce(trim(p_dealer_id), '') <> ''
    and public.plotmap_dealer_is_active(p_dealer_id)
    and exists (
      select 1 from public.profiles p
       where p.id = p_actor and p.status = 'active'
    )
    and (
      exists (
        select 1 from public.platform_admins pa
        join public.profiles p on p.id = pa.profile_id
         where pa.profile_id = p_actor and pa.status = 'active'
           and p.status = 'active' and p.role = 'owner'
      )
      or (
        exists (select 1 from public.marketing_internal_operators o
                 where o.operator_id = p_actor and o.active)
        and exists (select 1 from public.marketing_operator_dealers a
                     where a.operator_id = p_actor and a.dealer_id = p_dealer_id)
      )
    );
$$;

create or replace function public.plotmap_marketing_can_operate(p_dealer_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and public.plotmap_marketing_actor_can_operate(auth.uid(), p_dealer_id);
$$;

-- Browser-readable tables are closed. The dealer and Ops browser receive
-- explicit allow-listed RPC/Edge projections only.
revoke all on table public.marketing_settings from public, anon, authenticated;
revoke all on table public.marketing_operator_dealers from public, anon, authenticated;
revoke all on table public.marketing_internal_operators from public, anon, authenticated;
revoke all on table public.marketing_weekly_plans from public, anon, authenticated;
revoke all on table public.marketing_output_slots from public, anon, authenticated;
revoke all on table public.marketing_creative_results from public, anon, authenticated;
revoke all on table public.marketing_new_property_actions from public, anon, authenticated;
revoke all on table public.marketing_content_contexts from public, anon, authenticated;
revoke all on table public.marketing_creatives from public, anon, authenticated;
revoke all on table public.marketing_schedule_items from public, anon, authenticated;
revoke all on table public.marketing_publications from public, anon, authenticated;
revoke all on table public.marketing_channel_accounts from public, anon, authenticated;
revoke all on table public.external_performance_metrics from public, anon, authenticated;

-- Remove old broad read policies. SECURITY DEFINER projections below are
-- the only browser data boundary for this workflow.
drop policy if exists "marketing settings dealer read" on public.marketing_settings;
drop policy if exists "operators read their own assignments" on public.marketing_operator_dealers;
drop policy if exists "weekly plans dealer read" on public.marketing_weekly_plans;
drop policy if exists "weekly plans operator read" on public.marketing_weekly_plans;
drop policy if exists "output slots dealer read approved" on public.marketing_output_slots;
drop policy if exists "output slots operator read" on public.marketing_output_slots;
drop policy if exists "creative results operator read" on public.marketing_creative_results;
drop policy if exists "marketing contexts dealer read" on public.marketing_content_contexts;
drop policy if exists "marketing creatives dealer read" on public.marketing_creatives;
drop policy if exists "marketing schedule dealer read" on public.marketing_schedule_items;
drop policy if exists "marketing publications dealer read" on public.marketing_publications;
drop policy if exists "marketing channels dealer read" on public.marketing_channel_accounts;
drop policy if exists "external performance dealer read" on public.external_performance_metrics;

-- Exactly 28 empty output boxes. A repeated call is idempotent and never
-- changes baseline, associations, creative assets, or protected statuses.
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
  v_baseline jsonb := '[]'::jsonb;
begin
  if not public.plotmap_marketing_can_operate(p_dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if coalesce(p_week_id, '') !~ '^[0-9]{4}-W[0-9]{2}$' or p_week_start is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_week');
  end if;
  if coalesce(p_per_day, 4) <> 4 then
    return jsonb_build_object('ok', false, 'reason', 'four_outputs_per_day_required');
  end if;

  perform pg_advisory_xact_lock(hashtext('mapco:marketing:week:' || p_dealer_id || ':' || p_week_id));

  select coalesce(jsonb_agg(r.id order by r.id), '[]'::jsonb) into v_baseline
    from public.crm_records r
   where r.dealer_id = p_dealer_id and r.entity_type = 'properties' and r.deleted = false
     and r.payload->'published' = 'true'::jsonb
     and coalesce(r.payload->'sold', 'false'::jsonb) <> 'true'::jsonb;

  insert into public.marketing_weekly_plans (
    dealer_id, week_id, week_start, timezone, per_day, target_count, inventory_baseline
  ) values (
    p_dealer_id, p_week_id, p_week_start,
    case when coalesce(trim(p_timezone), '') <> '' then left(p_timezone, 80) else 'Asia/Kolkata' end,
    4, 28, v_baseline
  )
  on conflict (dealer_id, week_id) do nothing
  returning id into v_plan_id;

  if v_plan_id is not null then v_created := true; end if;
  if v_plan_id is null then
    select id into v_plan_id from public.marketing_weekly_plans
     where dealer_id = p_dealer_id and week_id = p_week_id;
  end if;

  for v_day in 0..6 loop
    for v_slot in 0..3 loop
      v_n := v_n + 1;
      insert into public.marketing_output_slots (
        dealer_id, plan_id, slot_ref, day_index, slot_index, local_date
      ) values (
        p_dealer_id, v_plan_id, 'C' || lpad(v_n::text, 3, '0'),
        v_day, v_slot, p_week_start + v_day
      ) on conflict (plan_id, slot_ref) do nothing;
    end loop;
  end loop;

  if (select count(*) from public.marketing_output_slots where plan_id = v_plan_id) <> 28 then
    raise exception 'weekly slot invariant violated';
  end if;

  return jsonb_build_object('ok', true, 'planId', v_plan_id,
    'created', v_created, 'idempotent', not v_created, 'targetCount', 28);
end;
$$;

create or replace function public.plotmap_marketing_validate_property_ids(
  p_dealer_id text, p_property_ids jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_typeof(coalesce(p_property_ids, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(p_property_ids, '[]'::jsonb)) between 0 and 8
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_property_ids, '[]'::jsonb)) e
       where jsonb_typeof(e) <> 'string'
          or length(trim(e #>> '{}')) not between 1 and 160
          or not exists (
            select 1 from public.crm_records r
             where r.dealer_id = p_dealer_id and r.entity_type = 'properties'
               and r.id = trim(e #>> '{}') and r.deleted = false
               and r.payload->'published' = 'true'::jsonb
               and coalesce(r.payload->'sold', 'false'::jsonb) <> 'true'::jsonb
          )
    );
$$;

create or replace function public.plotmap_marketing_update_slot(
  p_slot_id uuid,
  p_property_ids jsonb default '[]'::jsonb,
  p_caption text default null,
  p_channels jsonb default '[]'::jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_slot public.marketing_output_slots%rowtype;
begin
  select * into v_slot from public.marketing_output_slots where id = p_slot_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.plotmap_marketing_can_operate(v_slot.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if v_slot.status in ('approved','ready','posted') then
    return jsonb_build_object('ok', false, 'reason', 'protected_slot');
  end if;
  if not public.plotmap_marketing_validate_property_ids(v_slot.dealer_id, p_property_ids) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_property_association');
  end if;
  if jsonb_typeof(coalesce(p_channels, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_channels, '[]'::jsonb)) > 4
     or exists (select 1 from jsonb_array_elements_text(coalesce(p_channels, '[]'::jsonb)) c
                 where c not in ('instagram','facebook_page','google_business','whatsapp_business')) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_channels');
  end if;
  if length(coalesce(p_caption, '')) > 2200 or length(coalesce(p_note, '')) > 1000 then
    return jsonb_build_object('ok', false, 'reason', 'text_too_long');
  end if;

  update public.marketing_output_slots set
    property_ids = coalesce(p_property_ids, '[]'::jsonb),
    caption = nullif(trim(coalesce(p_caption, '')), ''),
    selected_channels = (select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
                           from (select distinct value as x from jsonb_array_elements_text(coalesce(p_channels, '[]'::jsonb))) q),
    operator_note = nullif(trim(coalesce(p_note, '')), ''),
    updated_at = timezone('utc'::text, now())
   where id = p_slot_id;
  return jsonb_build_object('ok', true, 'slotId', p_slot_id);
end;
$$;

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
set search_path = public, storage
as $$
declare
  v_slot public.marketing_output_slots%rowtype;
  v_week text;
begin
  select s.* into v_slot from public.marketing_output_slots s
   where s.id = p_slot_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select p.week_id into v_week from public.marketing_weekly_plans p where p.id = v_slot.plan_id;
  if not public.plotmap_marketing_can_operate(v_slot.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if v_slot.status in ('approved','ready','posted') then
    return jsonb_build_object('ok', false, 'reason', 'protected_slot');
  end if;
  if p_mime not in ('image/png','image/jpeg','image/webp') or p_bytes not between 1 and 15728640
     or p_content_hash !~ '^[0-9a-f]{64}$' or coalesce(p_width, 0) < 0 or coalesce(p_height, 0) < 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_asset');
  end if;
  if left(coalesce(p_asset_path, ''), length(v_slot.dealer_id || '/' || v_week || '/' || v_slot.slot_ref || '/'))
       <> v_slot.dealer_id || '/' || v_week || '/' || v_slot.slot_ref || '/'
     or length(p_asset_path) > 500
     or not exists (select 1 from storage.objects o where o.bucket_id = 'marketing-creatives' and o.name = p_asset_path) then
    return jsonb_build_object('ok', false, 'reason', 'asset_not_found');
  end if;
  if not public.plotmap_marketing_validate_property_ids(v_slot.dealer_id, p_property_ids)
     or length(coalesce(p_caption, '')) > 2200 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_metadata');
  end if;
  if exists (
    select 1 from public.marketing_creative_results r
    join public.marketing_output_slots s on s.id = r.slot_id
     where r.dealer_id = v_slot.dealer_id and s.plan_id = v_slot.plan_id
       and r.content_hash = p_content_hash and r.superseded = false
  ) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_upload');
  end if;

  update public.marketing_creative_results set superseded = true
   where slot_id = p_slot_id and superseded = false;
  insert into public.marketing_creative_results (
    dealer_id, slot_id, slot_ref, asset_path, mime, bytes, width, height,
    content_hash, uploaded_by
  ) values (
    v_slot.dealer_id, p_slot_id, v_slot.slot_ref, p_asset_path, p_mime, p_bytes,
    nullif(p_width, 0), nullif(p_height, 0), p_content_hash, auth.uid()
  );
  update public.marketing_output_slots set
    status = 'uploaded', property_ids = coalesce(p_property_ids, property_ids),
    caption = coalesce(nullif(trim(coalesce(p_caption, '')), ''), caption),
    uploaded_by = auth.uid(), uploaded_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
   where id = p_slot_id;
  return jsonb_build_object('ok', true, 'slotRef', v_slot.slot_ref);
end;
$$;

create or replace function public.plotmap_marketing_approve_slot(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_slot public.marketing_output_slots%rowtype;
  v_result public.marketing_creative_results%rowtype;
  v_plan public.marketing_weekly_plans%rowtype;
  v_pack jsonb;
  v_context_id uuid;
  v_creative_id uuid;
  v_channel text;
begin
  select * into v_slot from public.marketing_output_slots where id = p_slot_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.plotmap_marketing_can_operate(v_slot.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if v_slot.creative_id is not null and v_slot.status in ('ready','posted') then
    return jsonb_build_object('ok', true, 'creativeId', v_slot.creative_id, 'idempotent', true, 'state', 'ready_to_publish');
  end if;
  if v_slot.status not in ('uploaded','reviewed') then
    return jsonb_build_object('ok', false, 'reason', 'slot_not_reviewable');
  end if;
  if jsonb_array_length(v_slot.property_ids) < 1 then
    return jsonb_build_object('ok', false, 'reason', 'property_required');
  end if;
  if jsonb_array_length(v_slot.selected_channels) < 1 then
    return jsonb_build_object('ok', false, 'reason', 'channel_required');
  end if;
  select * into v_result from public.marketing_creative_results
   where slot_id = p_slot_id and superseded = false;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_image_uploaded'); end if;
  select * into v_plan from public.marketing_weekly_plans where id = v_slot.plan_id;

  v_pack := public.plotmap_ai_marketing_facts_for(v_slot.dealer_id, v_slot.property_ids->>0);
  if coalesce(v_pack->'ok', 'false'::jsonb) <> 'true'::jsonb then
    return jsonb_build_object('ok', false, 'reason', coalesce(v_pack->>'reason', 'property_unavailable'));
  end if;
  select id into v_context_id from public.marketing_content_contexts
   where dealer_id = v_slot.dealer_id and property_id = v_slot.property_ids->>0 and status = 'current';
  if v_context_id is null then
    insert into public.marketing_content_contexts (
      dealer_id, property_id, version, status, facts, photo_refs, content_hash
    ) values (
      v_slot.dealer_id, v_slot.property_ids->>0, 1, 'current',
      jsonb_build_object('schemaVersion', v_pack->'schemaVersion', 'property', v_pack->'property',
                         'brand', v_pack->'brand', 'excluded', v_pack->'excluded'),
      coalesce(v_pack->'photoRefs', '[]'::jsonb),
      encode(digest(convert_to((v_pack - 'photoRefs')::text, 'utf8'), 'sha256'), 'hex')
    ) returning id into v_context_id;
  end if;

  insert into public.marketing_creatives (
    dealer_id, content_context_id, property_id, design_key, design_version,
    channel, format, status, copy, asset, approved_by, approved_at
  ) values (
    v_slot.dealer_id, v_context_id, v_slot.property_ids->>0,
    'operator-external', 'v1', 'generic', 'portrait', 'approved',
    jsonb_build_object('caption', coalesce(v_slot.caption, '')),
    jsonb_build_object('bucket', v_result.asset_bucket, 'path', v_result.asset_path,
                       'mime', v_result.mime, 'w', v_result.width, 'h', v_result.height,
                       'bytes', v_result.bytes),
    auth.uid(), timezone('utc'::text, now())
  ) returning id into v_creative_id;

  for v_channel in select value from jsonb_array_elements_text(v_slot.selected_channels) loop
    insert into public.marketing_schedule_items (
      dealer_id, creative_id, channel, slot_key, scheduled_for, status,
      approval_required, approved_by, approved_at
    ) values (
      v_slot.dealer_id, v_creative_id, v_channel,
      v_plan.week_id || '-' || v_slot.slot_ref || '-' || v_channel,
      (v_slot.local_date::text || ' 09:00:00+05:30')::timestamptz,
      'approved', true, auth.uid(), timezone('utc'::text, now())
    ) on conflict (dealer_id, channel, slot_key) do update set
      creative_id = excluded.creative_id, status = 'approved',
      approved_by = excluded.approved_by, approved_at = excluded.approved_at,
      updated_at = timezone('utc'::text, now());
  end loop;

  update public.marketing_output_slots set
    status = 'ready', content_context_id = v_context_id, creative_id = v_creative_id,
    approved_by = auth.uid(), approved_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
   where id = p_slot_id;
  return jsonb_build_object('ok', true, 'creativeId', v_creative_id,
    'idempotent', false, 'state', 'ready_to_publish');
end;
$$;

create or replace function public.plotmap_marketing_detect_new_properties(
  p_dealer_id text, p_week_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_plan public.marketing_weekly_plans%rowtype; v_count integer;
begin
  if not public.plotmap_marketing_can_operate(p_dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  select * into v_plan from public.marketing_weekly_plans
   where dealer_id = p_dealer_id and week_id = p_week_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'week_not_found'); end if;
  insert into public.marketing_new_property_actions (dealer_id, plan_id, property_id)
  select p_dealer_id, v_plan.id, r.id from public.crm_records r
   where r.dealer_id = p_dealer_id and r.entity_type = 'properties' and r.deleted = false
     and r.payload->'published' = 'true'::jsonb
     and coalesce(r.payload->'sold', 'false'::jsonb) <> 'true'::jsonb
     and not (v_plan.inventory_baseline ? r.id)
  on conflict (plan_id, property_id) do nothing;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'detected', v_count, 'idempotent', v_count = 0);
end;
$$;

create or replace function public.plotmap_marketing_assign_new_property(
  p_action_id uuid, p_slot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_action public.marketing_new_property_actions%rowtype; v_slot public.marketing_output_slots%rowtype;
begin
  select * into v_action from public.marketing_new_property_actions where id = p_action_id for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'action_not_found'); end if;
  if not public.plotmap_marketing_can_operate(v_action.dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  if v_action.stage = 'assigned' and v_action.assigned_slot_id = p_slot_id then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;
  select * into v_slot from public.marketing_output_slots where id = p_slot_id for update;
  if not found or v_slot.plan_id <> v_action.plan_id or v_slot.dealer_id <> v_action.dealer_id then
    return jsonb_build_object('ok', false, 'reason', 'invalid_slot');
  end if;
  if v_slot.status not in ('waiting','failed') then
    return jsonb_build_object('ok', false, 'reason', 'protected_or_occupied_slot');
  end if;
  update public.marketing_output_slots set property_ids = jsonb_build_array(v_action.property_id),
    updated_at = timezone('utc'::text, now()) where id = p_slot_id;
  update public.marketing_new_property_actions set stage = 'assigned', assigned_slot_id = p_slot_id,
    updated_at = timezone('utc'::text, now()) where id = p_action_id;
  return jsonb_build_object('ok', true, 'idempotent', false, 'slotId', p_slot_id);
end;
$$;

create or replace function public.plotmap_marketing_mark_pack_downloaded(
  p_dealer_id text, p_week_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.plotmap_marketing_can_operate(p_dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  update public.marketing_weekly_plans set pack_downloaded_at = timezone('utc'::text, now())
   where dealer_id = p_dealer_id and week_id = p_week_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'week_not_found'); end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Safe roster visible only to a genuine internal operator.
create or replace function public.plotmap_marketing_ops_dealers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_actor uuid := auth.uid(); v_name text; v_admin boolean;
begin
  select coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, 'MAPCO operator'), '@', 1))
    into v_name from public.profiles p where p.id = v_actor and p.status = 'active';
  v_admin := public.plotmap_is_platform_admin();
  if v_actor is null or v_name is null or not (
    v_admin or exists (select 1 from public.marketing_internal_operators o where o.operator_id = v_actor and o.active)
  ) then return jsonb_build_object('ok', false, 'reason', 'internal_operator_required'); end if;

  return jsonb_build_object(
    'ok', true,
    'operator', jsonb_build_object('id', v_actor, 'name', v_name, 'platformAdmin', v_admin),
    'dealers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.dealer_id,
        'brand', jsonb_build_object('name', d.brand_name, 'tagline', d.brand_tagline,
          'phone', d.support_phone, 'whatsapp', d.whatsapp_number, 'logoUrl', d.logo_url),
        'marketableProperties', (select count(*) from public.crm_records r
          where r.dealer_id = d.dealer_id and r.entity_type = 'properties' and r.deleted = false
            and r.payload->'published' = 'true'::jsonb
            and coalesce(r.payload->'sold', 'false'::jsonb) <> 'true'::jsonb)
      ) order by d.brand_name, d.dealer_id)
      from public.dealer_settings d
      where public.plotmap_dealer_is_active(d.dealer_id)
        and public.plotmap_marketing_actor_can_operate(v_actor, d.dealer_id)
    ), '[]'::jsonb)
  );
end;
$$;

-- Service-only helpers for the Edge broker. The caller actor is checked
-- again server-side before raw Storage references ever enter the function
-- response; the Edge function signs them and removes the paths.
create or replace function public.plotmap_marketing_ops_inventory_for(
  p_actor uuid, p_dealer_id text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.plotmap_marketing_actor_can_operate(p_actor, p_dealer_id)
    then jsonb_build_object('ok', false, 'reason', 'not_authorised')
    else jsonb_build_object('ok', true, 'properties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'type', r.payload->>'type', 'want', r.payload->>'want',
        'city', r.payload->>'city', 'area', r.payload->>'area', 'loc', r.payload->>'loc',
        'sector', r.payload->>'sector', 'size', r.payload->>'size',
        'facing', r.payload->>'facing', 'position', r.payload->>'position',
        'approvals', case when jsonb_typeof(r.payload->'approvals')='array' then r.payload->'approvals' else '[]'::jsonb end,
        'landmarks', case when jsonb_typeof(r.payload->'landmarks')='array' then r.payload->'landmarks' else '[]'::jsonb end,
        'photoRefs', case when jsonb_typeof(r.payload->'photoStorage')='array' then r.payload->'photoStorage' else '[]'::jsonb end
      ) order by r.updated_at desc, r.id)
      from public.crm_records r where r.dealer_id = p_dealer_id
        and r.entity_type = 'properties' and r.deleted = false
        and r.payload->'published' = 'true'::jsonb
        and coalesce(r.payload->'sold', 'false'::jsonb) <> 'true'::jsonb
    ), '[]'::jsonb)) end;
$$;

create or replace function public.plotmap_marketing_ops_week_for(
  p_actor uuid, p_dealer_id text, p_week_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_plan public.marketing_weekly_plans%rowtype;
begin
  if not public.plotmap_marketing_actor_can_operate(p_actor, p_dealer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorised');
  end if;
  select * into v_plan from public.marketing_weekly_plans
   where dealer_id = p_dealer_id and week_id = p_week_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'week_not_found'); end if;
  return jsonb_build_object(
    'ok', true,
    'week', jsonb_build_object('dealerId', v_plan.dealer_id, 'weekId', v_plan.week_id,
      'weekStart', v_plan.week_start, 'timezone', v_plan.timezone, 'perDay', 4,
      'createdAt', v_plan.created_at,
      'slots', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'ref', s.slot_ref, 'dealerId', s.dealer_id, 'weekId', v_plan.week_id,
        'dayIndex', s.day_index, 'slotIndex', s.slot_index, 'localDate', s.local_date,
        'status', s.status, 'propertyIds', s.property_ids, 'channels', s.selected_channels,
        'caption', s.caption, 'note', s.operator_note, 'assetId', s.creative_id,
        'uploadedBy', s.uploaded_by, 'uploadedAt', s.uploaded_at,
        'approvedBy', s.approved_by, 'approvedAt', s.approved_at
      ) order by s.day_index, s.slot_index) from public.marketing_output_slots s where s.plan_id = v_plan.id), '[]'::jsonb)),
    'assets', coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'dealerId', r.dealer_id, 'slotRef', r.slot_ref, 'weekId', v_plan.week_id,
      'fileName', regexp_replace(r.asset_path, '^.*/', ''), 'bucket', r.asset_bucket,
      'path', r.asset_path, 'mime', r.mime, 'bytes', r.bytes, 'width', r.width,
      'height', r.height, 'uploadedBy', r.uploaded_by, 'uploadedAt', r.uploaded_at
    ) order by r.slot_ref) from public.marketing_creative_results r
      join public.marketing_output_slots s on s.id = r.slot_id
      where s.plan_id = v_plan.id and not r.superseded), '[]'::jsonb),
    'packDownloadedAt', v_plan.pack_downloaded_at,
    'newProperties', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'propertyId', a.property_id,
      'propertyLabel', coalesce(nullif(trim(r.payload->>'area'), ''), r.payload->>'type', a.property_id)
        || case when coalesce(trim(r.payload->>'size'), '') <> '' then ' · ' || (r.payload->>'size') else '' end,
      'stage', a.stage, 'recommendedSlotId', recommendation.id,
      'recommendedSlotRef', recommendation.slot_ref
    ) order by a.detected_at, a.id)
      from public.marketing_new_property_actions a
      join public.crm_records r on r.id = a.property_id and r.dealer_id = a.dealer_id
      left join lateral (
        select s.id, s.slot_ref from public.marketing_output_slots s
         where s.plan_id = a.plan_id and s.status in ('waiting','failed')
           and jsonb_array_length(s.property_ids) = 0
         order by s.local_date, s.slot_index limit 1
      ) recommendation on true
      where a.plan_id = v_plan.id and a.stage = 'detected'), '[]'::jsonb)
  );
end;
$$;

create or replace function public.plotmap_marketing_dealer_feed_for(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_dealer text;
begin
  select p.dealer_id into v_dealer from public.profiles p
   where p.id = p_actor and p.status = 'active' and p.role in ('owner','manager');
  if v_dealer is null or not public.plotmap_dealer_is_active(v_dealer) then
    return jsonb_build_object('ok', false, 'reason', 'dealer_marketing_access_required');
  end if;
  return jsonb_build_object(
    'ok', true, 'dealerId', v_dealer,
    'creatives', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'slotRef', s.slot_ref, 'localDate', s.local_date, 'status', s.status,
      'propertyId', c.property_id,
      'propertyLabel', coalesce(nullif(trim(ctx.facts#>>'{property,area}'), ''), ctx.facts#>>'{property,type}', c.property_id)
        || case when coalesce(trim(ctx.facts#>>'{property,size}'), '') <> '' then ' · ' || (ctx.facts#>>'{property,size}') else '' end,
      'caption', c.copy->>'caption', 'approvedAt', c.approved_at,
      'channels', coalesce((select jsonb_agg(si.channel order by si.channel)
        from public.marketing_schedule_items si where si.creative_id = c.id), '[]'::jsonb),
      'asset', jsonb_build_object('bucket', c.asset->>'bucket', 'path', c.asset->>'path',
        'mime', c.asset->>'mime', 'width', c.asset->'w', 'height', c.asset->'h', 'bytes', c.asset->'bytes'),
      'publicationStates', coalesce((select jsonb_agg(jsonb_build_object('channel', p.channel, 'status', p.status))
        from public.marketing_publications p where p.creative_id = c.id), '[]'::jsonb)
    ) order by s.local_date desc, s.slot_ref desc)
      from public.marketing_output_slots s
      join public.marketing_creatives c on c.id = s.creative_id
      join public.marketing_content_contexts ctx on ctx.id = c.content_context_id
      where s.dealer_id = v_dealer and s.status in ('ready','posted')
        and c.status in ('approved','published')), '[]'::jsonb),
    'performance', coalesce((select jsonb_agg(jsonb_build_object(
      'provider', m.provider, 'scope', m.scope, 'periodStart', m.period_start,
      'periodEnd', m.period_end, 'metrics', m.metrics
    ) order by m.period_end desc) from public.external_performance_metrics m
      where m.dealer_id = v_dealer), '[]'::jsonb),
    'connections', coalesce((select jsonb_agg(jsonb_build_object(
      'provider', a.provider, 'displayName', a.display_name, 'status', a.status,
      'connectedAt', a.connected_at
    ) order by a.provider) from public.marketing_channel_accounts a
      where a.dealer_id = v_dealer), '[]'::jsonb)
  );
end;
$$;

create or replace function public.plotmap_marketing_can_read_creative_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.plotmap_can_edit_crm()
    and public.plotmap_dealer_is_active(public.plotmap_current_dealer_id())
    and exists (select 1 from public.marketing_creatives c
      where c.dealer_id = public.plotmap_current_dealer_id()
        and c.status in ('approved','published') and c.asset->>'path' = p_path);
$$;

drop policy if exists "marketing creative upload by operator" on storage.objects;
create policy "marketing creative upload by operator" on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketing-creatives'
  and public.plotmap_marketing_can_operate((storage.foldername(name))[1])
  and array_length(storage.foldername(name), 1) = 3
);
drop policy if exists "marketing creative read" on storage.objects;
create policy "marketing creative read" on storage.objects for select to authenticated
using (
  bucket_id = 'marketing-creatives'
  and (public.plotmap_marketing_can_operate((storage.foldername(name))[1])
       or public.plotmap_marketing_can_read_creative_path(name))
);
drop policy if exists "marketing creative delete unbound" on storage.objects;
create policy "marketing creative delete unbound" on storage.objects for delete to authenticated
using (
  bucket_id = 'marketing-creatives'
  and public.plotmap_marketing_can_operate((storage.foldername(name))[1])
  and not exists (select 1 from public.marketing_creatives c where c.asset->>'path' = name)
);

grant select, insert, delete on storage.objects to authenticated;

-- Browser RPC grants: user-scoped operations only.
revoke all on function public.plotmap_marketing_can_operate(text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_open_week(text,text,date,text,integer) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_update_slot(uuid,jsonb,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_record_result(uuid,text,text,integer,integer,integer,text,jsonb,text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_approve_slot(uuid) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_detect_new_properties(text,text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_assign_new_property(uuid,uuid) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_mark_pack_downloaded(text,text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_ops_dealers() from public, anon, authenticated;

grant execute on function public.plotmap_marketing_can_operate(text) to authenticated;
grant execute on function public.plotmap_marketing_open_week(text,text,date,text,integer) to authenticated;
grant execute on function public.plotmap_marketing_update_slot(uuid,jsonb,text,jsonb,text) to authenticated;
grant execute on function public.plotmap_marketing_record_result(uuid,text,text,integer,integer,integer,text,jsonb,text) to authenticated;
grant execute on function public.plotmap_marketing_approve_slot(uuid) to authenticated;
grant execute on function public.plotmap_marketing_detect_new_properties(text,text) to authenticated;
grant execute on function public.plotmap_marketing_assign_new_property(uuid,uuid) to authenticated;
grant execute on function public.plotmap_marketing_mark_pack_downloaded(text,text) to authenticated;
grant execute on function public.plotmap_marketing_ops_dealers() to authenticated;

-- Service-only broker helpers. Browser clients cannot obtain raw photo or
-- creative paths from these functions.
revoke all on function public.plotmap_marketing_actor_can_operate(uuid,text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_validate_property_ids(text,jsonb) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_ops_inventory_for(uuid,text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_ops_week_for(uuid,text,text) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_dealer_feed_for(uuid) from public, anon, authenticated;
revoke all on function public.plotmap_marketing_can_read_creative_path(text) from public, anon, authenticated;
grant execute on function public.plotmap_marketing_actor_can_operate(uuid,text) to service_role;
grant execute on function public.plotmap_marketing_validate_property_ids(text,jsonb) to service_role;
grant execute on function public.plotmap_marketing_ops_inventory_for(uuid,text) to service_role;
grant execute on function public.plotmap_marketing_ops_week_for(uuid,text,text) to service_role;
grant execute on function public.plotmap_marketing_dealer_feed_for(uuid) to service_role;
grant execute on function public.plotmap_marketing_can_read_creative_path(text) to authenticated;

comment on table public.marketing_new_property_actions is
  'Idempotent mid-week inventory backlog. It assigns only an existing safe slot and never creates a 29th output.';
