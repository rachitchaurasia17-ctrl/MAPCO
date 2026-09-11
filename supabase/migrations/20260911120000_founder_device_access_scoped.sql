-- Correct the first device-access rollout and install the scoped boundary.
-- This migration is deliberately forward-only: it removes the global
-- PostgREST hook and blanket restrictive policies before tightening the
-- canonical dealer helpers used by existing RLS, Storage and RPC paths.

alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';

do $$
declare r record;
begin
  for r in
    select schemaname, tablename
    from pg_policies
    where policyname = 'founder_approved_session'
  loop
    execute format('drop policy founder_approved_session on %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;

drop function if exists public.plotmap_check_dealer_request();

create or replace function public.plotmap_dealer_access_status(p_device_token text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog,extensions as $$
declare
  v_reason text;
  v_profile public.profiles%rowtype;
  v_session uuid;
  v_device uuid;
  v_end timestamptz;
  v_limit integer;
  v_subscription text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if public.plotmap_is_platform_admin() then
    return jsonb_build_object('status','approved','founder',true);
  end if;

  select * into v_profile from public.profiles where id=auth.uid();
  select case when subscription_status='trial' then trial_end else expiry_date end,
    max_devices_allowed, subscription_status
  into v_end, v_limit, v_subscription
  from public.dealer_settings where dealer_id=v_profile.dealer_id;

  v_reason:=public.plotmap_dealer_account_access_reason();
  if v_reason<>'active' then
    return jsonb_strip_nulls(jsonb_build_object(
      'status',v_reason,
      'dealerId',v_profile.dealer_id,
      'expiresAt',v_end,
      'maxDevices',v_limit,
      'subscriptionStatus',v_subscription,
      'founder',false
    ));
  end if;

  select id into v_session from auth.sessions
  where id::text=auth.jwt()->>'session_id'
    and user_id=auth.uid()
    and (not_after is null or not_after>now());
  if v_session is null then return jsonb_build_object('status','sign_in_required'); end if;

  if p_device_token is not null and length(p_device_token) between 32 and 512 then
    select id into v_device from public.dealer_devices
    where dealer_id=v_profile.dealer_id
      and status='approved'
      and device_token_hash=extensions.crypt(p_device_token,device_token_hash)
    order by approved_at desc limit 1 for update;

    if v_device is not null then
      insert into public.dealer_device_sessions(session_id,profile_id,device_id)
      values(v_session,auth.uid(),v_device)
      on conflict(session_id) do update
        set device_id=excluded.device_id,bound_at=now()
        where dealer_device_sessions.profile_id=excluded.profile_id;
      update public.dealer_devices set last_seen=now() where id=v_device;
    end if;
  end if;

  return jsonb_build_object(
    'status',case when public.plotmap_session_is_approved() then 'approved' else 'device_not_activated' end,
    'dealerId',v_profile.dealer_id,
    'expiresAt',v_end,
    'maxDevices',v_limit,
    'subscriptionStatus',v_subscription,
    'founder',false
  );
end;
$$;
revoke all on function public.plotmap_dealer_access_status(text) from public,anon;
grant execute on function public.plotmap_dealer_access_status(text) to authenticated;

-- Device activation requires a real authenticated dealer session. The
-- activation transaction validates that the code belongs to that same dealer.
revoke execute on function public.plotmap_activate_device(text,text,text,text) from anon;
grant execute on function public.plotmap_activate_device(text,text,text,text) to authenticated;

create or replace function public.plotmap_device_gate_bootstrap_request()
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select trim(leading '/' from current_setting('request.path',true)) in
    ('rpc/plotmap_activate_device','rpc/plotmap_dealer_access_status');
$$;
revoke all on function public.plotmap_device_gate_bootstrap_request() from public,anon;
grant execute on function public.plotmap_device_gate_bootstrap_request() to authenticated,service_role;

create or replace function public.plotmap_current_dealer_id()
returns text language sql stable security definer set search_path=public,pg_catalog as $$
  select coalesce((select p.dealer_id from public.profiles p where p.id=auth.uid()
    and (
      public.plotmap_is_platform_admin()
      or public.plotmap_device_gate_bootstrap_request()
      or public.plotmap_session_is_approved()
    )), '');
$$;
revoke all on function public.plotmap_current_dealer_id() from public,anon;
grant execute on function public.plotmap_current_dealer_id() to authenticated,service_role;

create or replace function public.plotmap_dealer_is_active(p_dealer_id text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select nullif(p_dealer_id,'') is not null
    and (
      (
        coalesce(auth.jwt()->>'role','')<>'authenticated'
        and coalesce(nullif(current_setting('role',true),'none'),'')<>'authenticated'
      )
      or public.plotmap_is_platform_admin()
      or (
        p_dealer_id=(select p.dealer_id from public.profiles p where p.id=auth.uid())
        and (
          public.plotmap_device_gate_bootstrap_request()
          or public.plotmap_session_is_approved()
        )
      )
    )
    and exists(
      select 1 from public.dealer_settings d
      where d.dealer_id=p_dealer_id
        and coalesce(d.account_status,'active')='active'
        and (
          (coalesce(d.subscription_status,'trial')='trial'
            and (d.trial_end is null or d.trial_end>=timezone('utc'::text,now())))
          or (coalesce(d.subscription_status,'trial') in ('active','paid')
            and (d.expiry_date is null or d.expiry_date>=timezone('utc'::text,now())))
        )
    );
$$;
revoke all on function public.plotmap_dealer_is_active(text) from public,anon;
grant execute on function public.plotmap_dealer_is_active(text) to authenticated,service_role;

create or replace function public.plotmap_current_status()
returns text language sql stable security definer set search_path=public,pg_catalog as $$
  select p.status from public.profiles p where p.id=auth.uid()
    and (
      public.plotmap_is_platform_admin()
      or public.plotmap_device_gate_bootstrap_request()
      or public.plotmap_session_is_approved()
    );
$$;
revoke all on function public.plotmap_current_status() from public,anon;
grant execute on function public.plotmap_current_status() to authenticated,service_role;

-- The legacy demo limit is normalised after Founder bootstrap through
-- plotmap_admin_set_dealer_device_limit. Do not bypass the provider-only
-- dealer_settings guard from migration context.

create or replace function public.plotmap_buyer_link_dealer_exists(p_dealer_id text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(select 1 from public.dealer_settings where dealer_id=p_dealer_id);
$$;
revoke all on function public.plotmap_buyer_link_dealer_exists(text) from public,anon,authenticated;

do $$
declare
  v_name text;
  v_oid regprocedure;
  v_before text;
  v_after text;
begin
  foreach v_name in array array[
    'plotmap_resolve_client_link',
    'plotmap_resolve_client_link_media',
    'plotmap_resolve_client_link_maps',
    'plotmap_record_client_link_event',
    'plotmap_client_link_intelligence'
  ] loop
    select p.oid into v_oid from pg_proc p
    where p.pronamespace='public'::regnamespace and p.proname=v_name;
    if v_oid is null then raise exception 'Required buyer boundary is missing: %',v_name; end if;

    v_before:=pg_get_functiondef(v_oid);
    if position('public.plotmap_dealer_is_active(' in v_before)>0 then
      v_after:=replace(v_before,'public.plotmap_dealer_is_active(','public.plotmap_buyer_link_dealer_exists(');
      execute v_after;
    elsif position('public.plotmap_buyer_link_dealer_exists(' in v_before)=0 then
      raise exception 'Expected buyer-link boundary not found in %',v_name;
    end if;
  end loop;
end $$;
