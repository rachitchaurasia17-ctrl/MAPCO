-- MAPCO Phase 1 security foundation
--
-- Additive final-state hardening. This migration intentionally comes after all
-- feature migrations so later policy/function redefinitions cannot silently
-- remove the account, quota, tenant, or presentation-safety boundaries below.
-- It is safe to re-run: functions/views are replaced, policies/triggers are
-- dropped by name before recreation, and projection patches detect an already
-- hardened definition.

-- ---------------------------------------------------------------------------
-- Provider-owned dealer account and control-plane columns
-- ---------------------------------------------------------------------------

create or replace function public.plotmap_guard_dealer_settings_account_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Dealer settings rows are provisioned by MAPCO. A dealer owner may update
  -- branding through the UPDATE policy below, but may not create an account.
  if tg_op = 'INSERT'
     and not public.plotmap_is_platform_admin()
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'dealer accounts must be provisioned by a platform administrator';
  end if;

  if tg_op = 'UPDATE'
     and not public.plotmap_is_platform_admin()
     and coalesce(auth.role(), '') <> 'service_role'
     and (
       new.billing_email is distinct from old.billing_email
       or new.storage_enabled is distinct from old.storage_enabled
       or new.photo_bucket is distinct from old.photo_bucket
       or new.photo_folder is distinct from old.photo_folder
       or new.plan_code is distinct from old.plan_code
       or new.subscription_status is distinct from old.subscription_status
       or new.account_status is distinct from old.account_status
       or new.trial_start is distinct from old.trial_start
       or new.trial_end is distinct from old.trial_end
       or new.expiry_date is distinct from old.expiry_date
       or new.paid is distinct from old.paid
       or new.renewal_reminder is distinct from old.renewal_reminder
       or new.payment_proof_link is distinct from old.payment_proof_link
       or new.payment_notes is distinct from old.payment_notes
       or new.developer_notes is distinct from old.developer_notes
       or new.seat_limit is distinct from old.seat_limit
       or new.seat_count is distinct from old.seat_count
       or new.max_maps is distinct from old.max_maps
       or new.max_properties is distinct from old.max_properties
       or new.max_team_members is distinct from old.max_team_members
       or new.max_devices_allowed is distinct from old.max_devices_allowed
     ) then
    raise exception using
      errcode = '42501',
      message = 'account, storage, and plan columns are provider-only';
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := timezone('utc'::text, now());
  end if;
  return new;
end;
$$;

revoke all on function public.plotmap_guard_dealer_settings_account_columns()
  from public, anon, authenticated;

drop trigger if exists plotmap_dealer_settings_account_guard on public.dealer_settings;
create trigger plotmap_dealer_settings_account_guard
  before insert or update on public.dealer_settings
  for each row execute function public.plotmap_guard_dealer_settings_account_columns();

-- ---------------------------------------------------------------------------
-- Absolute tenant identity backstop for direct PostgREST table mutations
-- ---------------------------------------------------------------------------

-- Scope account/quota helpers to the authenticated caller. They remain usable
-- by service-role and anonymous-token internals, while an ordinary browser
-- cannot probe another tenant's subscription state or quota headroom.
create or replace function public.plotmap_dealer_is_active(p_dealer_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select nullif(p_dealer_id, '') is not null
     and (
       (
         coalesce(auth.role(), '') <> 'authenticated'
         and coalesce(nullif(current_setting('role', true), 'none'), '') <> 'authenticated'
       )
       or public.plotmap_is_platform_admin()
       or p_dealer_id = public.plotmap_current_dealer_id()
     )
     and exists (
       select 1
       from public.dealer_settings d
       where d.dealer_id = p_dealer_id
         and coalesce(d.account_status, 'active') = 'active'
         and (
           (
             coalesce(d.subscription_status, 'trial') = 'trial'
             and (d.trial_end is null or d.trial_end >= timezone('utc'::text, now()))
           )
           or (
             coalesce(d.subscription_status, 'trial') in ('active', 'paid')
             and (d.expiry_date is null or d.expiry_date >= timezone('utc'::text, now()))
           )
         )
     );
$$;

create or replace function public.plotmap_dealer_can_write(p_dealer_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select public.plotmap_dealer_is_active(p_dealer_id);
$$;

-- VOLATILE is deliberate: row triggers in a bulk statement must observe rows
-- already changed by that statement. Deferred quota assertions below provide
-- a final transaction-state backstop, while the advisory lock serializes
-- competing transactions for the same tenant.
create or replace function public.plotmap_can_insert_property(p_dealer_id text)
returns boolean
language sql
volatile
security definer
set search_path = public, pg_catalog
as $$
  select public.plotmap_dealer_can_write(p_dealer_id)
     and (
       select count(*)
       from public.crm_records r
       where r.dealer_id = p_dealer_id
         and r.entity_type = 'properties'
         and coalesce(r.deleted, false) = false
     ) < coalesce((
       select d.max_properties
       from public.dealer_settings d
       where d.dealer_id = p_dealer_id
     ), 500);
$$;

create or replace function public.plotmap_can_insert_prebuilt_map(p_dealer_id text)
returns boolean
language sql
volatile
security definer
set search_path = public, pg_catalog
as $$
  select public.plotmap_dealer_can_write(p_dealer_id)
     and (
       select count(*)
       from public.prebuilt_maps m
       where m.dealer_id = p_dealer_id
     ) < coalesce((
       select d.max_maps
       from public.dealer_settings d
       where d.dealer_id = p_dealer_id
     ), 10);
$$;

create or replace function public.plotmap_can_insert_team_member(p_dealer_id text)
returns boolean
language sql
volatile
security definer
set search_path = public, pg_catalog
as $$
  select public.plotmap_dealer_can_write(p_dealer_id)
     and (
       select count(*)
       from public.profiles p
       where p.dealer_id = p_dealer_id
         and p.status = 'active'
     ) < coalesce((
       select d.max_team_members
       from public.dealer_settings d
       where d.dealer_id = p_dealer_id
     ), 5);
$$;

-- INSERT policies also run for INSERT .. ON CONFLICT DO UPDATE. At quota,
-- an existing same-tenant row must remain upsertable while a new id must not
-- be admitted. This helper can see an existing same-tenant row despite RLS;
-- the tenant trigger separately rejects colliding cross-tenant primary keys.
create or replace function public.plotmap_quota_insert_allowed(
  p_table text,
  p_row_id text,
  p_dealer_id text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_existing_dealer_id text;
begin
  if nullif(p_row_id, '') is null or nullif(p_dealer_id, '') is null then
    return false;
  end if;

  -- Browser callers may only ask about their own derived tenant. For a
  -- cross-tenant collision, return the same quota answer as a missing id; the
  -- trigger rejects the actual write without turning this helper into an ID
  -- existence oracle.
  if coalesce(auth.role(), '') = 'authenticated'
     and public.plotmap_is_platform_admin() is not true
     and p_dealer_id is distinct from public.plotmap_current_dealer_id() then
    return false;
  end if;

  if p_table = 'crm_records' then
    select r.dealer_id into v_existing_dealer_id
    from public.crm_records r where r.id = p_row_id;
    if found and v_existing_dealer_id = p_dealer_id then return true; end if;
    return public.plotmap_can_insert_property(p_dealer_id);
  elsif p_table = 'prebuilt_maps' then
    select m.dealer_id into v_existing_dealer_id
    from public.prebuilt_maps m where m.id = p_row_id;
    if found and v_existing_dealer_id = p_dealer_id then return true; end if;
    return public.plotmap_can_insert_prebuilt_map(p_dealer_id);
  elsif p_table = 'profiles' then
    select p.dealer_id into v_existing_dealer_id
    from public.profiles p where p.id::text = p_row_id;
    if found and v_existing_dealer_id = p_dealer_id then return true; end if;
    return public.plotmap_can_insert_team_member(p_dealer_id);
  end if;

  return false;
end;
$$;

revoke all on function public.plotmap_quota_insert_allowed(text, text, text)
  from public, anon;
grant execute on function public.plotmap_quota_insert_allowed(text, text, text)
  to authenticated, service_role;

create or replace function public.plotmap_enforce_authenticated_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dealer_id text;
  v_existing_dealer_id text;
  v_row_exists boolean := false;
begin
  -- auth.role() retains the original JWT role inside SECURITY DEFINER RPCs.
  -- This means a dealer cannot use a weak definer function to bypass account,
  -- tenant, or quota checks. Anonymous token flows and service-role operations
  -- keep their separately-scoped contracts; platform admins may provision.
  if coalesce(auth.role(), '') <> 'authenticated'
     and coalesce(nullif(current_setting('role', true), 'none'), '') <> 'authenticated'
     and session_user <> 'authenticated' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if public.plotmap_is_platform_admin() is true then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_dealer_id := nullif(public.plotmap_current_dealer_id(), '');
  if auth.uid() is null
     or v_dealer_id is null
     or public.plotmap_is_active_member() is not true
     or public.plotmap_current_role() = 'viewer'
     or public.plotmap_dealer_can_write(v_dealer_id) is not true then
    raise exception using
      errcode = '42501',
      message = 'active dealer write access required';
  end if;

  if tg_op = 'INSERT' then
    -- Ignore a browser-supplied tenant. The authenticated profile is canonical.
    new.dealer_id := v_dealer_id;

    -- RLS does not run inside SECURITY DEFINER writers. Repeat the three live
    -- plan limits here so an RPC cannot become a quota bypass. A transaction
    -- advisory lock serializes admissions for the tenant; the id is checked
    -- again after acquiring it so concurrent same-id upserts do not consume a
    -- second quota slot.
    if tg_table_name = 'crm_records' then
      select r.dealer_id into v_existing_dealer_id
      from public.crm_records r where r.id = new.id;
      v_row_exists := found;
      if v_row_exists and v_existing_dealer_id is distinct from v_dealer_id then
        raise exception using errcode = '42501', message = 'existing row belongs to another dealer';
      end if;
      if new.entity_type = 'properties' and not coalesce(new.deleted, false) and not v_row_exists then
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended('plotmap:quota:' || v_dealer_id, 0)
        );
        select r.dealer_id into v_existing_dealer_id
        from public.crm_records r where r.id = new.id;
        v_row_exists := found;
        if v_row_exists and v_existing_dealer_id is distinct from v_dealer_id then
          raise exception using errcode = '42501', message = 'existing row belongs to another dealer';
        end if;
        if not v_row_exists
           and public.plotmap_can_insert_property(v_dealer_id) is not true then
          raise exception using errcode = '42501', message = 'property quota or account limit reached';
        end if;
      end if;
    elsif tg_table_name = 'prebuilt_maps' then
      select m.dealer_id into v_existing_dealer_id
      from public.prebuilt_maps m where m.id = new.id;
      v_row_exists := found;
      if v_row_exists and v_existing_dealer_id is distinct from v_dealer_id then
        raise exception using errcode = '42501', message = 'existing row belongs to another dealer';
      end if;
      if not v_row_exists then
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended('plotmap:quota:' || v_dealer_id, 0)
        );
        select m.dealer_id into v_existing_dealer_id
        from public.prebuilt_maps m where m.id = new.id;
        v_row_exists := found;
        if v_row_exists and v_existing_dealer_id is distinct from v_dealer_id then
          raise exception using errcode = '42501', message = 'existing row belongs to another dealer';
        end if;
        if not v_row_exists
           and public.plotmap_can_insert_prebuilt_map(v_dealer_id) is not true then
          raise exception using errcode = '42501', message = 'map quota or account limit reached';
        end if;
      end if;
    elsif tg_table_name = 'profiles' then
      select p.dealer_id into v_existing_dealer_id
      from public.profiles p where p.id = new.id;
      v_row_exists := found;
      if v_row_exists and v_existing_dealer_id is distinct from v_dealer_id then
        raise exception using errcode = '42501', message = 'existing row belongs to another dealer';
      end if;
      if new.status = 'active' and not v_row_exists then
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended('plotmap:quota:' || v_dealer_id, 0)
        );
        select p.dealer_id into v_existing_dealer_id
        from public.profiles p where p.id = new.id;
        v_row_exists := found;
        if v_row_exists and v_existing_dealer_id is distinct from v_dealer_id then
          raise exception using errcode = '42501', message = 'existing row belongs to another dealer';
        end if;
        if not v_row_exists
           and public.plotmap_can_insert_team_member(v_dealer_id) is not true then
          raise exception using errcode = '42501', message = 'team quota or account limit reached';
        end if;
      end if;
    end if;
  elsif old.dealer_id is distinct from v_dealer_id then
    raise exception using
      errcode = '42501',
      message = 'cross-tenant mutation denied';
  elsif tg_op = 'DELETE' then
    return old;
  elsif new.dealer_id is distinct from old.dealer_id then
    raise exception using
      errcode = '42501',
      message = 'dealer_id is immutable';
  else
    new.dealer_id := old.dealer_id;

    -- Rows that did not previously consume quota must pass the same serialized
    -- admission check when an UPDATE activates them. Otherwise a caller could
    -- create deleted/inactive rows below quota and reactivate them after the
    -- tenant reaches its limit.
    if tg_table_name = 'crm_records' then
      if new.entity_type = 'properties'
         and not coalesce(new.deleted, false)
         and (
           old.entity_type is distinct from 'properties'
           or coalesce(old.deleted, false)
         ) then
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended('plotmap:quota:' || v_dealer_id, 0)
        );
        if public.plotmap_can_insert_property(v_dealer_id) is not true then
          raise exception using errcode = '42501', message = 'property quota or account limit reached';
        end if;
      end if;
    elsif tg_table_name = 'profiles' then
      if new.status = 'active'
         and old.status is distinct from 'active' then
        perform pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtextextended('plotmap:quota:' || v_dealer_id, 0)
        );
        if public.plotmap_can_insert_team_member(v_dealer_id) is not true then
          raise exception using errcode = '42501', message = 'team quota or account limit reached';
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.plotmap_enforce_authenticated_tenant()
  from public, anon, authenticated;

-- Install the same invariant on every current public base/partitioned table
-- carrying dealer_id. Future tenant tables must receive the same trigger in
-- their own creation migration because migrations run only once.
do $migration$
declare
  v_table record;
begin
  for v_table in
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and a.attname = 'dealer_id'
      and a.attnum > 0
      and not a.attisdropped
    order by c.relname
  loop
    execute format(
      'drop trigger if exists plotmap_00_authenticated_tenant_guard on public.%I',
      v_table.relname
    );
    execute format(
      'create trigger plotmap_00_authenticated_tenant_guard before insert or update or delete on public.%I for each row execute function public.plotmap_enforce_authenticated_tenant()',
      v_table.relname
    );
  end loop;
end;
$migration$;

-- A deferred constraint trigger sees the transaction's final row set. It
-- catches multi-row INSERT/activation statements that a statement-start count
-- alone could miss; any excess aborts the whole transaction.
create or replace function public.plotmap_assert_quota_after_write()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, pg_catalog
as $$
declare
  v_dealer_id text;
  v_count bigint;
  v_limit integer;
  v_increases boolean := false;
begin
  if coalesce(auth.role(), '') <> 'authenticated'
     and coalesce(nullif(current_setting('role', true), 'none'), '') <> 'authenticated' then
    return null;
  end if;
  if public.plotmap_is_platform_admin() is true then return null; end if;

  v_dealer_id := nullif(public.plotmap_current_dealer_id(), '');
  if v_dealer_id is null or new.dealer_id is distinct from v_dealer_id then
    raise exception using errcode = '42501', message = 'active dealer write access required';
  end if;

  if tg_table_name = 'crm_records' then
    if new.entity_type = 'properties' and not coalesce(new.deleted, false) then
      if tg_op = 'INSERT' then
        v_increases := true;
      else
        v_increases := old.entity_type is distinct from 'properties'
          or coalesce(old.deleted, false);
      end if;
    end if;
    if v_increases then
      select count(*) into v_count
      from public.crm_records r
      where r.dealer_id = v_dealer_id
        and r.entity_type = 'properties'
        and not coalesce(r.deleted, false);
      select coalesce(d.max_properties, 500) into v_limit
      from public.dealer_settings d where d.dealer_id = v_dealer_id;
      if v_count > coalesce(v_limit, 500) then
        raise exception using errcode = '42501', message = 'property quota or account limit reached';
      end if;
    end if;
  elsif tg_table_name = 'prebuilt_maps' then
    if tg_op = 'INSERT' then
      select count(*) into v_count
      from public.prebuilt_maps m where m.dealer_id = v_dealer_id;
      select coalesce(d.max_maps, 10) into v_limit
      from public.dealer_settings d where d.dealer_id = v_dealer_id;
      if v_count > coalesce(v_limit, 10) then
        raise exception using errcode = '42501', message = 'map quota or account limit reached';
      end if;
    end if;
  elsif tg_table_name = 'profiles' then
    if new.status = 'active' then
      if tg_op = 'INSERT' then
        v_increases := true;
      else
        v_increases := old.status is distinct from 'active';
      end if;
    end if;
    if v_increases then
      select count(*) into v_count
      from public.profiles p
      where p.dealer_id = v_dealer_id and p.status = 'active';
      select coalesce(d.max_team_members, 5) into v_limit
      from public.dealer_settings d where d.dealer_id = v_dealer_id;
      if v_count > coalesce(v_limit, 5) then
        raise exception using errcode = '42501', message = 'team quota or account limit reached';
      end if;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public.plotmap_assert_quota_after_write()
  from public, anon, authenticated;

drop trigger if exists plotmap_quota_final_check on public.crm_records;
create constraint trigger plotmap_quota_final_check
  after insert or update on public.crm_records
  deferrable initially deferred
  for each row execute function public.plotmap_assert_quota_after_write();

drop trigger if exists plotmap_quota_final_check on public.prebuilt_maps;
create constraint trigger plotmap_quota_final_check
  after insert or update on public.prebuilt_maps
  deferrable initially deferred
  for each row execute function public.plotmap_assert_quota_after_write();

drop trigger if exists plotmap_quota_final_check on public.profiles;
create constraint trigger plotmap_quota_final_check
  after insert or update on public.profiles
  deferrable initially deferred
  for each row execute function public.plotmap_assert_quota_after_write();

-- ---------------------------------------------------------------------------
-- Restore final account-state and quota gates removed by later role policies
-- ---------------------------------------------------------------------------

drop policy if exists "plotmap crm properties insert" on public.crm_records;
drop policy if exists "plotmap crm properties update" on public.crm_records;
drop policy if exists "plotmap crm properties delete" on public.crm_records;
drop policy if exists "plotmap crm other insert" on public.crm_records;
drop policy if exists "plotmap crm other update" on public.crm_records;
drop policy if exists "plotmap crm other delete" on public.crm_records;

create policy "plotmap crm properties insert" on public.crm_records
for insert to authenticated
with check (
  public.plotmap_can_edit_properties()
  and dealer_id = public.plotmap_current_dealer_id()
  and entity_type = 'properties'
  and (
    coalesce(deleted, false)
    or public.plotmap_quota_insert_allowed('crm_records', id, dealer_id)
  )
);

create policy "plotmap crm properties update" on public.crm_records
for update to authenticated
using (
  public.plotmap_can_edit_properties()
  and dealer_id = public.plotmap_current_dealer_id()
  and entity_type = 'properties'
  and public.plotmap_dealer_can_write(dealer_id)
)
with check (
  public.plotmap_can_edit_properties()
  and dealer_id = public.plotmap_current_dealer_id()
  and entity_type = 'properties'
  and public.plotmap_dealer_can_write(dealer_id)
);

create policy "plotmap crm properties delete" on public.crm_records
for delete to authenticated
using (
  public.plotmap_can_edit_properties()
  and dealer_id = public.plotmap_current_dealer_id()
  and entity_type = 'properties'
  and public.plotmap_dealer_can_write(dealer_id)
);

create policy "plotmap crm other insert" on public.crm_records
for insert to authenticated
with check (
  public.plotmap_can_edit_crm()
  and dealer_id = public.plotmap_current_dealer_id()
  and entity_type <> 'properties'
  and public.plotmap_dealer_can_write(dealer_id)
);

create policy "plotmap crm other update" on public.crm_records
for update to authenticated
using (
  public.plotmap_can_edit_crm()
  and dealer_id = public.plotmap_current_dealer_id()
  and entity_type <> 'properties'
  and public.plotmap_dealer_can_write(dealer_id)
)
with check (
  public.plotmap_can_edit_crm()
  and dealer_id = public.plotmap_current_dealer_id()
  and entity_type <> 'properties'
  and public.plotmap_dealer_can_write(dealer_id)
);

create policy "plotmap crm other delete" on public.crm_records
for delete to authenticated
using (
  public.plotmap_can_edit_crm()
  and dealer_id = public.plotmap_current_dealer_id()
  and entity_type <> 'properties'
  and public.plotmap_dealer_can_write(dealer_id)
);

drop policy if exists "plotmap overlays maps insert" on public.map_overlays;
drop policy if exists "plotmap overlays maps update" on public.map_overlays;
drop policy if exists "plotmap overlays maps delete" on public.map_overlays;

create policy "plotmap overlays maps insert" on public.map_overlays
for insert to authenticated
with check (
  public.plotmap_can_edit_maps()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
);

create policy "plotmap overlays maps update" on public.map_overlays
for update to authenticated
using (
  public.plotmap_can_edit_maps()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
)
with check (
  public.plotmap_can_edit_maps()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
);

create policy "plotmap overlays maps delete" on public.map_overlays
for delete to authenticated
using (
  public.plotmap_can_edit_maps()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
);

drop policy if exists "plotmap prebuilt maps insert" on public.prebuilt_maps;
drop policy if exists "plotmap prebuilt maps update" on public.prebuilt_maps;
drop policy if exists "plotmap prebuilt maps delete" on public.prebuilt_maps;

create policy "plotmap prebuilt maps insert" on public.prebuilt_maps
for insert to authenticated
with check (
  public.plotmap_can_edit_maps()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_quota_insert_allowed('prebuilt_maps', id, dealer_id)
);

create policy "plotmap prebuilt maps update" on public.prebuilt_maps
for update to authenticated
using (
  public.plotmap_can_edit_maps()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
)
with check (
  public.plotmap_can_edit_maps()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
);

create policy "plotmap prebuilt maps delete" on public.prebuilt_maps
for delete to authenticated
using (
  public.plotmap_can_edit_maps()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
);

drop policy if exists "plotmap dealer settings insert" on public.dealer_settings;
drop policy if exists "plotmap dealer settings update" on public.dealer_settings;
drop policy if exists "plotmap dealer settings delete" on public.dealer_settings;

create policy "plotmap dealer settings insert" on public.dealer_settings
for insert to authenticated
with check (public.plotmap_is_platform_admin());

create policy "plotmap dealer settings update" on public.dealer_settings
for update to authenticated
using (
  dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_can_manage_settings()
  and public.plotmap_dealer_can_write(dealer_id)
)
with check (
  dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_can_manage_settings()
  and public.plotmap_dealer_can_write(dealer_id)
);

create policy "plotmap dealer settings delete" on public.dealer_settings
for delete to authenticated
using (public.plotmap_is_platform_admin());

drop policy if exists "plotmap share links insert" on public.share_links;
drop policy if exists "plotmap share links update" on public.share_links;
drop policy if exists "plotmap share links delete" on public.share_links;

create policy "plotmap share links insert" on public.share_links
for insert to authenticated
with check (
  target_type <> 'client_link'
  and public.plotmap_can_edit_crm()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
);

create policy "plotmap share links update" on public.share_links
for update to authenticated
using (
  target_type <> 'client_link'
  and public.plotmap_can_edit_crm()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
)
with check (
  target_type <> 'client_link'
  and public.plotmap_can_edit_crm()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
);

create policy "plotmap share links delete" on public.share_links
for delete to authenticated
using (
  target_type <> 'client_link'
  and public.plotmap_can_edit_crm()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
);

drop policy if exists "profiles owner dealer insert" on public.profiles;
drop policy if exists "profiles owner dealer update" on public.profiles;

create policy "profiles owner dealer insert" on public.profiles
for insert to authenticated
with check (
  public.plotmap_can_manage_team()
  and dealer_id = public.plotmap_current_dealer_id()
  and (
    status <> 'active'
    or public.plotmap_quota_insert_allowed('profiles', id::text, dealer_id)
  )
  and role in ('team', 'manager', 'map_editor', 'property_editor', 'viewer')
  and status in ('active', 'blocked', 'disabled', 'suspended', 'removed')
);

create policy "profiles owner dealer update" on public.profiles
for update to authenticated
using (
  public.plotmap_can_manage_team()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
)
with check (
  public.plotmap_can_manage_team()
  and dealer_id = public.plotmap_current_dealer_id()
  and public.plotmap_dealer_can_write(dealer_id)
  and role in ('owner', 'team', 'manager', 'map_editor', 'property_editor', 'viewer')
  and status in ('active', 'blocked', 'disabled', 'suspended', 'removed')
);

-- The helper ACLs are explicit because CREATE FUNCTION otherwise leaves
-- EXECUTE to PUBLIC. Anonymous callers do not need account-state or quota
-- oracles; trusted definer functions continue to call them as their owner.
revoke all on function public.plotmap_is_platform_admin() from public, anon;
grant execute on function public.plotmap_is_platform_admin() to authenticated, service_role;
revoke all on function public.plotmap_dealer_is_active(text) from public, anon;
grant execute on function public.plotmap_dealer_is_active(text) to authenticated, service_role;
revoke all on function public.plotmap_dealer_can_write(text) from public, anon;
grant execute on function public.plotmap_dealer_can_write(text) to authenticated, service_role;
revoke all on function public.plotmap_can_insert_property(text) from public, anon;
grant execute on function public.plotmap_can_insert_property(text) to authenticated, service_role;
revoke all on function public.plotmap_can_insert_prebuilt_map(text) from public, anon;
grant execute on function public.plotmap_can_insert_prebuilt_map(text) to authenticated, service_role;
revoke all on function public.plotmap_can_insert_team_member(text) from public, anon;
grant execute on function public.plotmap_can_insert_team_member(text) to authenticated, service_role;

-- SECURITY DEFINER functions use fixed search paths, and browser roles cannot
-- create shadow objects in the public schema.
revoke create on schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Append-only, actor-derived audit trail
-- ---------------------------------------------------------------------------

drop policy if exists "plotmap audit logs staff insert" on public.audit_logs;
drop policy if exists "plotmap audit logs writer insert" on public.audit_logs;
revoke insert on public.audit_logs from authenticated;

create or replace function public.plotmap_append_user_audit_event(
  p_action_type text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_dealer_id text := nullif(public.plotmap_current_dealer_id(), '');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_recent integer;
  v_id uuid;
begin
  if v_actor is null
     or v_dealer_id is null
     or public.plotmap_is_active_member() is not true
     or public.plotmap_current_role() = 'viewer'
     or public.plotmap_dealer_can_write(v_dealer_id) is not true then
    raise exception using errcode = '42501', message = 'active dealer write access required';
  end if;
  if p_entity_id is null or length(p_entity_id) not between 1 and 160 then
    raise exception 'invalid audit entity';
  end if;
  if jsonb_typeof(v_metadata) <> 'object' or octet_length(v_metadata::text) > 2048 then
    raise exception 'invalid audit metadata';
  end if;

  -- Only low-privilege user activity is accepted here. Security decisions and
  -- provider/admin events remain server-authored inside their owning RPCs.
  if not (
    (p_action_type = 'property_exported' and p_entity_type = 'properties' and exists (
      select 1 from public.crm_records r
      where r.dealer_id = v_dealer_id and r.id = p_entity_id
        and r.entity_type = 'properties' and not coalesce(r.deleted, false)
    ))
    or (p_action_type = 'map_exported' and p_entity_type = 'prebuilt_maps' and exists (
      select 1 from public.prebuilt_maps m
      where m.dealer_id = v_dealer_id and m.id = p_entity_id
    ))
    or (p_action_type = 'client_link_copied' and p_entity_type = 'client_link' and exists (
      select 1 from public.share_links s
      where s.dealer_id = v_dealer_id and s.id::text = p_entity_id
        and s.target_type = 'client_link'
    ))
    or (p_action_type = 'settings_updated' and p_entity_type = 'dealer_settings'
        and p_entity_id = v_dealer_id)
  ) then
    raise exception 'unsupported or out-of-scope audit event';
  end if;

  select count(*) into v_recent
  from public.audit_logs a
  where a.actor_profile_id = v_actor
    and a.created_at > timezone('utc'::text, now()) - interval '1 minute';
  if v_recent >= 120 then
    raise exception using errcode = '54000', message = 'audit event rate limit exceeded';
  end if;

  v_metadata := (
    v_metadata - array[
      'dealerId', 'dealer_id', 'actor', 'actorRole', 'email', 'phone',
      'token', 'secret', 'seller', 'commission'
    ]::text[]
  ) || jsonb_build_object('source', 'authenticated_user');

  insert into public.audit_logs (
    dealer_id, actor_profile_id, actor_role, action_type,
    entity_type, entity_id, metadata
  ) values (
    v_dealer_id, v_actor, public.plotmap_current_role(), p_action_type,
    p_entity_type, p_entity_id, v_metadata
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.plotmap_append_user_audit_event(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.plotmap_append_user_audit_event(text, text, text, jsonb)
  to authenticated;

-- The predictable legacy slug resolver is superseded by hashed, expiring,
-- revocable client-link tokens. Keep it installed for migration compatibility
-- but make it unreachable from browser roles.
revoke all on function public.plotmap_resolve_share_link(text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Presentation data is deny-by-default: clientVisible must be explicit true
-- ---------------------------------------------------------------------------

create or replace view public.client_safe_properties
with (security_invoker = true) as
  select
    r.id,
    r.dealer_id,
    coalesce(
      nullif(r.payload ->> 'status', ''),
      case when lower(coalesce(r.payload ->> 'published', 'false')) = 'true'
        then 'published' else 'draft' end
    ) as status,
    (lower(coalesce(r.payload ->> 'clientVisible', 'false')) = 'true') as client_visible,
    r.payload ->> 'type' as type,
    r.payload ->> 'want' as want,
    r.payload ->> 'city' as city,
    r.payload ->> 'area' as area,
    r.payload ->> 'loc' as loc,
    r.payload ->> 'sector' as sector,
    r.payload ->> 'size' as size,
    r.payload ->> 'facing' as facing,
    r.payload ->> 'position' as position,
    coalesce(r.payload -> 'approvals', '[]'::jsonb) as approvals,
    coalesce(r.payload -> 'landmarks', '[]'::jsonb) as landmarks,
    coalesce(r.payload -> 'photos', '[]'::jsonb) as photos,
    r.created_at,
    r.updated_at
  from public.crm_records r
  where r.entity_type = 'properties'
    and coalesce(r.deleted, false) = false
    and lower(coalesce(r.payload ->> 'published', 'false')) = 'true'
    and lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'
    and coalesce(r.payload ->> 'internalStatus', '') !~* '(archived|internal|hold|sold|hidden)'
    and lower(coalesce(r.payload ->> 'clientVisible', 'false')) = 'true';

revoke all on public.client_safe_properties from public, anon;

-- Patch the current full snapshot function without replacing its evolving
-- allow-listed return shape. Migration-time assertions fail closed if the
-- expected safety predicate has been changed to an unknown definition.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef('public.plotmap_create_client_link(jsonb)'::regprocedure)
    into v_definition;

  -- The current function shape must still contain the established deletion
  -- and internal-state predicates. If an earlier migration changed either,
  -- stop instead of applying a partial projection hardening.
  if position($required$coalesce(r.deleted, false) = false$required$ in v_definition) = 0
     or position($required$coalesce(r.payload ->> 'internalStatus', '') !~* '(archived|internal|hold|sold|hidden)'$required$ in v_definition) = 0 then
    raise exception 'plotmap_create_client_link safety baseline did not match';
  end if;

  v_updated := v_definition;

  if position($old$coalesce((r.payload ->> 'clientVisible')::boolean, true) = true$old$ in v_updated) > 0 then
    v_updated := replace(
      v_updated,
      $old$coalesce((r.payload ->> 'clientVisible')::boolean, true) = true$old$,
      $new$lower(coalesce(r.payload ->> 'clientVisible', 'false')) = 'true'$new$
    );
  end if;
  if position($new$lower(coalesce(r.payload ->> 'clientVisible', 'false')) = 'true'$new$ in v_updated) = 0 then
    raise exception 'plotmap_create_client_link visibility baseline did not match';
  end if;

  -- A selected property must be affirmatively published and not sold. Add
  -- the predicates beside explicit client visibility, preserving the evolving
  -- allow-listed snapshot return shape.
  if position($published$lower(coalesce(r.payload ->> 'published', 'false')) = 'true'$published$ in v_updated) = 0
     or position($sold$lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'$sold$ in v_updated) = 0 then
    v_updated := replace(
      v_updated,
      $anchor$lower(coalesce(r.payload ->> 'clientVisible', 'false')) = 'true'$anchor$,
      $hardened$lower(coalesce(r.payload ->> 'clientVisible', 'false')) = 'true'
      and lower(coalesce(r.payload ->> 'published', 'false')) = 'true'
      and lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'$hardened$
    );
  end if;

  if position($old$coalesce((r.payload ->> 'clientVisible')::boolean, true) = true$old$ in v_updated) > 0
     or position($published$lower(coalesce(r.payload ->> 'published', 'false')) = 'true'$published$ in v_updated) = 0
     or position($sold$lower(coalesce(r.payload ->> 'sold', 'false')) <> 'true'$sold$ in v_updated) = 0 then
    raise exception 'plotmap_create_client_link publication hardening was incomplete';
  end if;

  if v_updated is distinct from v_definition then execute v_updated; end if;
end;
$migration$;

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_updated text;
begin
  foreach v_signature in array array[
    'public.plotmap_presentation_properties(integer,integer,text)'::regprocedure,
    'public.plotmap_presentation_property_media(text[])'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_definition;
    if position($old$lower(coalesce(r.payload ->> 'clientVisible', 'true')) = 'true'$old$ in v_definition) > 0 then
      v_updated := replace(
        v_definition,
        $old$lower(coalesce(r.payload ->> 'clientVisible', 'true')) = 'true'$old$,
        $new$lower(coalesce(r.payload ->> 'clientVisible', 'false')) = 'true'$new$
      );
      if position($old$lower(coalesce(r.payload ->> 'clientVisible', 'true')) = 'true'$old$ in v_updated) > 0 then
        raise exception '% visibility hardening was incomplete', v_signature::text;
      end if;
      execute v_updated;
    elsif position($new$lower(coalesce(r.payload ->> 'clientVisible', 'false')) = 'true'$new$ in v_definition) = 0 then
      raise exception '% visibility baseline did not match', v_signature::text;
    end if;
  end loop;
end;
$migration$;

-- Restate the intended browser/service ACLs after the projection patches.
revoke all on function public.plotmap_create_client_link(jsonb) from public, anon;
grant execute on function public.plotmap_create_client_link(jsonb) to authenticated;
revoke all on function public.plotmap_presentation_properties(integer, integer, text)
  from public, anon;
grant execute on function public.plotmap_presentation_properties(integer, integer, text)
  to authenticated;
revoke all on function public.plotmap_presentation_property_media(text[])
  from public, anon, authenticated;
grant execute on function public.plotmap_presentation_property_media(text[])
  to service_role;
