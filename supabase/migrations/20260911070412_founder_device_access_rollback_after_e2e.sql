-- Emergency rollback after the Founder readiness E2E provisioning boundary
-- returned HTTP 403. Keep device/session/audit evidence, but restore the
-- pre-rollout request, tenant, buyer-link and grant boundaries.

alter role authenticator reset pgrst.db_pre_request;

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

create or replace function public.plotmap_current_dealer_id()
returns text language sql stable security definer set search_path=public as $$
  select coalesce((select p.dealer_id from public.profiles p where p.id = auth.uid()), '');
$$;
revoke all on function public.plotmap_current_dealer_id() from public,anon;
grant execute on function public.plotmap_current_dealer_id() to authenticated,service_role;

create or replace function public.plotmap_dealer_is_active(p_dealer_id text)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
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
revoke all on function public.plotmap_dealer_is_active(text) from public,anon;
grant execute on function public.plotmap_dealer_is_active(text) to authenticated,service_role;

create or replace function public.plotmap_current_status()
returns text language sql stable security definer set search_path=public as $$
  select coalesce((select p.status from public.profiles p where p.id = auth.uid()), '');
$$;
revoke all on function public.plotmap_current_status() from public,anon;
grant execute on function public.plotmap_current_status() to authenticated,service_role;

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
    if position('public.plotmap_buyer_link_dealer_exists(' in v_before)>0 then
      v_after:=replace(v_before,'public.plotmap_buyer_link_dealer_exists(','public.plotmap_dealer_is_active(');
      execute v_after;
    elsif position('public.plotmap_dealer_is_active(' in v_before)=0 then
      raise exception 'Expected buyer-link boundary not found in %',v_name;
    end if;
  end loop;
end $$;

revoke all on function public.plotmap_dealer_access_status(text) from public,anon,authenticated;
revoke all on function public.plotmap_session_is_approved() from public,anon,authenticated;
revoke all on function public.plotmap_dealer_account_access_reason() from public,anon,authenticated;
revoke all on function public.plotmap_buyer_link_dealer_exists(text) from public,anon,authenticated;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
