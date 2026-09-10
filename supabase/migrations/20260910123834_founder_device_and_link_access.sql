-- Session-bound device approval. Authentication remains Supabase email/password.
-- The browser keeps its installation token; only hashes and session bindings
-- are persisted server-side. Existing device rows and tenant IDs are retained.
create table public.dealer_device_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.dealer_devices(id) on delete cascade,
  bound_at timestamptz not null default now()
);
create index dealer_device_sessions_device_idx on public.dealer_device_sessions(device_id);
create index dealer_device_sessions_profile_idx on public.dealer_device_sessions(profile_id);
alter table public.dealer_device_sessions enable row level security;
alter table public.dealer_device_sessions force row level security;
revoke all on public.dealer_device_sessions from public,anon,authenticated;

create or replace function public.plotmap_dealer_account_access_reason()
returns text language sql stable security definer set search_path=public,pg_catalog as $$
  select coalesce((select case
    when p.status<>'active' then 'account_blocked'
    when d.account_status='suspended' then 'account_suspended'
    when d.subscription_status='trial' and
      (d.account_status='expired' or d.trial_end is null or d.trial_end<=now()) then 'trial_expired'
    when d.account_status<>'active' or d.subscription_status not in ('trial','paid','active')
      or (d.subscription_status in ('paid','active') and (d.expiry_date is null or d.expiry_date<=now())) then 'account_blocked'
    else 'active' end
    from public.profiles p join public.dealer_settings d on d.dealer_id=p.dealer_id
    where p.id=auth.uid()),'account_blocked');
$$;
revoke all on function public.plotmap_dealer_account_access_reason() from public,anon;
grant execute on function public.plotmap_dealer_account_access_reason() to authenticated;

create or replace function public.plotmap_session_is_approved()
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select public.plotmap_is_platform_admin() or (
    public.plotmap_dealer_account_access_reason()='active' and exists(
      select 1 from public.dealer_device_sessions b
      join auth.sessions s on s.id=b.session_id and s.user_id=b.profile_id
      join public.dealer_devices d on d.id=b.device_id
      join public.profiles p on p.id=b.profile_id and p.dealer_id=d.dealer_id
      where b.session_id::text=auth.jwt()->>'session_id' and b.profile_id=auth.uid()
        and d.status='approved' and p.status='active' and (s.not_after is null or s.not_after>now())));
$$;
revoke all on function public.plotmap_session_is_approved() from public,anon;
grant execute on function public.plotmap_session_is_approved() to authenticated;

create or replace function public.plotmap_dealer_access_status(p_device_token text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog,extensions as $$
declare v_reason text; v_profile public.profiles%rowtype; v_session uuid; v_device uuid; v_end timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if public.plotmap_is_platform_admin() then return jsonb_build_object('status','approved','founder',true); end if;
  select * into v_profile from public.profiles where id=auth.uid();
  v_reason:=public.plotmap_dealer_account_access_reason();
  if v_reason<>'active' then return jsonb_build_object('status',v_reason); end if;
  select id into v_session from auth.sessions where id::text=auth.jwt()->>'session_id'
    and user_id=auth.uid() and (not_after is null or not_after>now());
  if v_session is null then return jsonb_build_object('status','sign_in_required'); end if;
  if p_device_token is not null and length(p_device_token) between 32 and 512 then
    -- Serializes a binding with founder revocation of this particular device.
    select id into v_device from public.dealer_devices where dealer_id=v_profile.dealer_id
      and status='approved' and device_token_hash=extensions.crypt(p_device_token,device_token_hash)
      order by approved_at desc limit 1 for update;
    if v_device is not null then
      insert into public.dealer_device_sessions(session_id,profile_id,device_id)
        values(v_session,auth.uid(),v_device)
        on conflict(session_id) do update set device_id=excluded.device_id,bound_at=now()
          where dealer_device_sessions.profile_id=excluded.profile_id;
      update public.dealer_devices set last_seen=now() where id=v_device;
    end if;
  end if;
  select case when subscription_status='trial' then trial_end else expiry_date end into v_end
    from public.dealer_settings where dealer_id=v_profile.dealer_id;
  return jsonb_build_object('status',case when public.plotmap_session_is_approved() then 'approved' else 'device_not_activated' end,
    'dealerId',v_profile.dealer_id,'expiresAt',v_end,'founder',false);
end;
$$;
revoke all on function public.plotmap_dealer_access_status(text) from public,anon;
grant execute on function public.plotmap_dealer_access_status(text) to authenticated;

-- SECURITY DEFINER RPCs must pass this gate too, not only table RLS.
create or replace function public.plotmap_check_dealer_request()
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_path text:=current_setting('request.path',true);
begin
  if coalesce(auth.jwt()->>'role','')<>'authenticated' then return; end if;
  -- Public token-scoped buyer operations keep working even when the browser
  -- also holds an expired dealer login. Their own token/privacy checks remain.
  if v_path in ('/rpc/plotmap_resolve_client_link','/rpc/plotmap_record_client_link_event',
    '/rpc/plotmap_activate_device','/rpc/plotmap_dealer_access_status',
    '/rpc/plotmap_is_platform_admin','/rpc/plotmap_founder_bootstrap') then return; end if;
  if not public.plotmap_session_is_approved() then
    raise sqlstate 'PT403' using message='Dealer account or device access is not approved',hint='Sign in and activate this device, or contact 8968017508.';
  end if;
end;
$$;
revoke all on function public.plotmap_check_dealer_request() from public;
grant execute on function public.plotmap_check_dealer_request() to anon,authenticated,service_role;
alter role authenticator set pgrst.db_pre_request='public.plotmap_check_dealer_request';
notify pgrst,'reload config';

-- Add a restrictive gate alongside existing tenant/capability policies. This
-- also protects direct Storage/Realtime paths outside PostgREST. No existing
-- tenant policy is replaced and anon buyer projections are not changed.
do $$
declare r record;
begin
  for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and c.relrowsecurity and
      (n.nspname='public' or (n.nspname='storage' and c.relname='objects'))
  loop
    execute format('create policy founder_approved_session on %I.%I as restrictive for all to authenticated using ((select public.plotmap_session_is_approved())) with check ((select public.plotmap_session_is_approved()))',r.nspname,r.relname);
  end loop;
end $$;

-- Decouple only the existing buyer-link boundaries from dealer entitlement.
-- Preserve every other byte of the current resolver, telemetry and map logic.
create or replace function public.plotmap_buyer_link_dealer_exists(p_dealer_id text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(select 1 from public.dealer_settings where dealer_id=p_dealer_id);
$$;
revoke all on function public.plotmap_buyer_link_dealer_exists(text) from public,anon,authenticated;
do $$
declare v_name text; v_oid regprocedure; v_before text; v_after text;
begin
  foreach v_name in array array['plotmap_resolve_client_link','plotmap_resolve_client_link_media',
    'plotmap_resolve_client_link_maps','plotmap_record_client_link_event','plotmap_client_link_intelligence']
  loop
    select p.oid into v_oid from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=v_name;
    if v_oid is null then raise exception 'Required buyer boundary is missing: %',v_name; end if;
    v_before:=pg_get_functiondef(v_oid);
    v_after:=replace(v_before,'public.plotmap_dealer_is_active(','public.plotmap_buyer_link_dealer_exists(');
    if v_after=v_before then raise exception 'Expected account gate not found in %',v_name; end if;
    execute v_after;
  end loop;
end $$;
