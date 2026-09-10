-- DealSetu private Founder Control. Existing dealer identities are retained.
-- Only the explicitly nominated, email-verified founder can bootstrap access.
create or replace function public.plotmap_founder_identity()
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(select 1 from auth.users u where u.id=auth.uid()
    and lower(u.email)='rachitchaurasia17@gmail.com' and u.email_confirmed_at is not null);
$$;
revoke all on function public.plotmap_founder_identity() from public,anon;
grant execute on function public.plotmap_founder_identity() to authenticated;

create or replace function public.plotmap_is_platform_admin()
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  -- Verified identity permits first bootstrap, including its intermediate
  -- profile insert. Explicitly disabled records always override that path.
  select public.plotmap_founder_identity()
    and not exists(select 1 from public.platform_admins where profile_id=auth.uid() and status<>'active')
    and not exists(select 1 from public.profiles where id=auth.uid() and (status<>'active' or role<>'owner'));
$$;

create or replace function public.plotmap_founder_bootstrap()
returns boolean language plpgsql security definer set search_path=public,pg_catalog as $$
begin
  if not public.plotmap_is_platform_admin() then return false; end if;
  -- Internal identity context, excluded from the customer roster. No dealer
  -- inventory is copied, and an existing founder profile is never reassigned.
  insert into public.dealer_settings(dealer_id,brand_name,account_status,subscription_status,paid,expiry_date,metadata)
    values('dealsetu-platform','DealSetu Platform','active','active',false,'9999-12-31', '{"internal":true}'::jsonb)
    on conflict(dealer_id) do nothing;
  insert into public.profiles(id,email,role,dealer_id,status)
    values(auth.uid(),'rachitchaurasia17@gmail.com','owner','dealsetu-platform','active')
    on conflict(id) do nothing;
  insert into public.platform_admins(profile_id,status,notes)
    values(auth.uid(),'active','Nominated DealSetu founder') on conflict(profile_id) do nothing;
  return public.plotmap_is_platform_admin();
end;
$$;
revoke all on function public.plotmap_founder_bootstrap() from public,anon;
grant execute on function public.plotmap_founder_bootstrap() to authenticated;

alter table public.dealer_settings alter column max_devices_allowed set default 4;

create or replace function public.plotmap_founder_dealer_workspace(p_dealer_id text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_catalog as $$
declare v_usage jsonb;
begin
  if not public.plotmap_is_platform_admin() then raise exception 'Founder access required'; end if;
  if not exists(select 1 from public.dealer_settings where dealer_id=p_dealer_id)
    then raise exception 'Dealer not found'; end if;
  v_usage := public.plotmap_admin_dealer_360(p_dealer_id)->'usage';
  return jsonb_build_object(
    'usage',v_usage,
    'devices',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from public.plotmap_admin_list_dealer_devices() d where d.dealer_id=p_dealer_id),
    'trials',(select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at desc),'[]') from public.trials t where t.dealer_id=p_dealer_id),
    'evidence',(select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at desc),'[]') from
      (select * from public.evidence where dealer_id=p_dealer_id order by occurred_at desc limit 200) e),
    'predictions',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc),'[]') from
      (select * from public.predictions where dealer_id=p_dealer_id order by created_at desc limit 200) p),
    'milestones',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.trial_milestones_v m where m.dealer_id=p_dealer_id),
    'buyer',(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from public.buyer_engagement_v b where b.dealer_id=p_dealer_id),
    'history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc),'[]') from
      (select id,action_type,created_at,metadata from public.audit_logs where dealer_id=p_dealer_id order by created_at desc limit 100) h));
end;
$$;
revoke all on function public.plotmap_founder_dealer_workspace(text) from public,anon;
grant execute on function public.plotmap_founder_dealer_workspace(text) to authenticated;

create or replace function public.plotmap_founder_set_account(p_payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare
  v_id text:=p_payload->>'dealerId'; v_action text:=p_payload->>'action';
  v_end timestamptz; v_account public.dealer_settings%rowtype; v_amount bigint;
begin
  if not public.plotmap_is_platform_admin() then raise exception 'Founder access required'; end if;
  select * into v_account from public.dealer_settings where dealer_id=v_id for update;
  if not found or v_id='dealsetu-platform' then raise exception 'Dealer not found'; end if;
  if v_action in ('paid','extend_trial') then
    v_end:=(p_payload->>'expiresAt')::timestamptz;
    if v_end is null or not isfinite(v_end) or v_end<=now() then raise exception 'Choose a future access expiry'; end if;
  end if;
  if p_payload ? 'amountPaise' then
    v_amount:=(p_payload->>'amountPaise')::bigint;
    if v_amount<0 then raise exception 'Payment amount cannot be negative'; end if;
  end if;
  if v_action='paid' then
    if nullif(trim(p_payload->>'plan'),'') is null then raise exception 'Enter a plan name'; end if;
    if length(trim(p_payload->>'plan'))>80 or length(coalesce(p_payload->>'paymentNote',''))>2000
      then raise exception 'Plan or payment note is too long'; end if;
    update public.dealer_settings set account_status='active',subscription_status='paid',paid=true,
      expiry_date=v_end,plan_code=trim(p_payload->>'plan'),
      payment_notes=coalesce(p_payload->>'paymentNote',''),updated_at=now() where dealer_id=v_id;
    update public.trials set commercial_outcome='won',closed_at=coalesce(closed_at,now()),
      price_paid_paise=coalesce(v_amount,price_paid_paise),updated_at=now()
      where id=(select id from public.trials where dealer_id=v_id and commercial_outcome='open' order by started_at desc limit 1);
  elsif v_action='extend_trial' then
    if v_account.subscription_status<>'trial' then raise exception 'This account is not on a trial'; end if;
    update public.dealer_settings set account_status='active',trial_end=v_end,updated_at=now() where dealer_id=v_id;
    update public.trials set ends_at=v_end,updated_at=now() where dealer_id=v_id and commercial_outcome='open';
    insert into public.evidence(dealer_id,kind,provenance,body,occurred_at,created_by)
      values(v_id,'treatment_change','founder_observed',
        'Founder extended trial access through '||v_end::text,now(),auth.uid());
  elsif v_action='suspend' then
    update public.dealer_settings set account_status='suspended',updated_at=now() where dealer_id=v_id;
  elsif v_action='resume' then
    if (case when v_account.subscription_status='trial' then v_account.trial_end else v_account.expiry_date end) is null
      or (case when v_account.subscription_status='trial' then v_account.trial_end else v_account.expiry_date end)<=now()
      then raise exception 'Set a new access expiry before restoring this account'; end if;
    update public.dealer_settings set account_status='active',updated_at=now() where dealer_id=v_id;
  else raise exception 'Unknown account action'; end if;
  insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values(v_id,auth.uid(),'owner','founder_account_'||v_action,'dealer_settings',v_id,
      jsonb_strip_nulls(jsonb_build_object('expiresAt',v_end,'amountPaise',v_amount,'plan',p_payload->>'plan','note',p_payload->>'paymentNote')));
end;
$$;
revoke all on function public.plotmap_founder_set_account(jsonb) from public,anon;
grant execute on function public.plotmap_founder_set_account(jsonb) to authenticated;

create or replace function public.plotmap_founder_create_device_code(p_dealer_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_code text; v_end timestamptz:=now()+interval '24 hours'; v_limit integer; v_count integer;
begin
  if not public.plotmap_is_platform_admin() then raise exception 'Founder access required'; end if;
  select max_devices_allowed into v_limit from public.dealer_settings where dealer_id=p_dealer_id for update;
  if not found then raise exception 'Dealer not found'; end if;
  select count(*) into v_count from public.dealer_devices where dealer_id=p_dealer_id and status='approved';
  if v_count>=v_limit then raise exception 'Device limit reached. Revoke an old device first.'; end if;
  v_code:=public.plotmap_secure_numeric_code(8);
  perform public.plotmap_admin_create_dealer_activation_code(p_dealer_id,v_code,'Founder device approval',1,v_end);
  return jsonb_build_object('code',v_code,'expires_at',v_end);
end;
$$;
revoke all on function public.plotmap_founder_create_device_code(text) from public,anon;
grant execute on function public.plotmap_founder_create_device_code(text) to authenticated;

create or replace function public.plotmap_founder_add_evidence(p_payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_trial uuid:=nullif(p_payload->>'trialId','')::uuid;
begin
  if not public.plotmap_is_platform_admin() then raise exception 'Founder access required'; end if;
  if v_trial is not null and not exists(select 1 from public.trials where id=v_trial and dealer_id=p_payload->>'dealerId')
    then raise exception 'Trial does not belong to this dealer'; end if;
  insert into public.evidence(dealer_id,trial_id,kind,provenance,body,occurred_at,created_by)
    values(p_payload->>'dealerId',v_trial,p_payload->>'kind',p_payload->>'provenance',
      p_payload->>'body',(p_payload->>'occurredAt')::timestamptz,auth.uid());
end;
$$;
revoke all on function public.plotmap_founder_add_evidence(jsonb) from public,anon;
grant execute on function public.plotmap_founder_add_evidence(jsonb) to authenticated;

create or replace function public.plotmap_founder_add_prediction(p_payload jsonb)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_trial uuid:=nullif(p_payload->>'trialId','')::uuid;
begin
  if not public.plotmap_is_platform_admin() then raise exception 'Founder access required'; end if;
  if v_trial is not null and not exists(select 1 from public.trials where id=v_trial and dealer_id=p_payload->>'dealerId')
    then raise exception 'Trial does not belong to this dealer'; end if;
  insert into public.predictions(dealer_id,trial_id,statement,domain,confidence,horizon_at,created_by)
    values(p_payload->>'dealerId',v_trial,p_payload->>'statement',p_payload->>'domain',
      (p_payload->>'confidence')::integer,(p_payload->>'horizonAt')::timestamptz,auth.uid());
end;
$$;
revoke all on function public.plotmap_founder_add_prediction(jsonb) from public,anon;
grant execute on function public.plotmap_founder_add_prediction(jsonb) to authenticated;

create or replace function public.plotmap_founder_resolve_prediction(p_id uuid,p_resolution text,p_note text)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
begin
  if not public.plotmap_is_platform_admin() then raise exception 'Founder access required'; end if;
  if p_resolution not in ('true','false','unresolvable','expired') or nullif(trim(p_note),'') is null
    then raise exception 'Choose an outcome and record the supporting evidence'; end if;
  update public.predictions set resolution=p_resolution,resolved_at=now(),resolution_note=p_note
    where id=p_id and resolution='pending';
  if not found then raise exception 'Prediction is missing or already resolved'; end if;
end;
$$;
revoke all on function public.plotmap_founder_resolve_prediction(uuid,text,text) from public,anon;
grant execute on function public.plotmap_founder_resolve_prediction(uuid,text,text) to authenticated;

-- The Edge Function's service-side attempt reconciliation uses this separate
-- helper. Tighten it too, so the legacy provisioning path cannot admit a
-- different platform-admin account after Founder Control is introduced.
create or replace function public.plotmap_provisioning_admin_is_active(p_actor_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_catalog as $$
  select exists(select 1 from public.platform_admins a
    join public.profiles p on p.id=a.profile_id join auth.users u on u.id=p.id
    where a.profile_id=p_actor_id and a.status='active' and p.status='active' and p.role='owner'
      and lower(u.email)='rachitchaurasia17@gmail.com' and u.email_confirmed_at is not null);
$$;
revoke all on function public.plotmap_provisioning_admin_is_active(uuid) from public,anon,authenticated;

create or replace function public.plotmap_admin_set_device_status(
  p_device_id uuid,p_status text,p_developer_notes text default null)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_device public.dealer_devices%rowtype; v_limit integer; v_count integer;
begin
  if not public.plotmap_is_platform_admin() then raise exception 'Founder access required'; end if;
  if p_status is null or p_status not in ('approved','rejected','revoked') then raise exception 'Unsupported device status'; end if;
  select * into v_device from public.dealer_devices where id=p_device_id;
  if not found then raise exception 'Device not found'; end if;
  -- Match activation's dealer-before-device order and serialize slot decisions.
  select max_devices_allowed into v_limit from public.dealer_settings where dealer_id=v_device.dealer_id for update;
  select * into v_device from public.dealer_devices where id=p_device_id for update;
  if not found then raise exception 'Device not found'; end if;
  if p_status='approved' then
    if not public.plotmap_dealer_is_active(v_device.dealer_id) then raise exception 'Restore dealer access before approving a device'; end if;
    select count(*) into v_count from public.dealer_devices where dealer_id=v_device.dealer_id and status='approved' and id<>p_device_id;
    if v_count>=v_limit then raise exception 'Dealer has reached approved device limit'; end if;
  end if;
  update public.dealer_devices set status=p_status,
    approved_by=case when p_status='approved' then auth.uid() else approved_by end,
    approved_at=case when p_status='approved' then now() else approved_at end,
    rejected_by=case when p_status='rejected' then auth.uid() else rejected_by end,
    rejected_at=case when p_status='rejected' then now() else rejected_at end,
    revoked_by=case when p_status='revoked' then auth.uid() else revoked_by end,
    revoked_at=case when p_status='revoked' then now() else revoked_at end,
    developer_notes=coalesce(p_developer_notes,developer_notes),updated_at=now()
    where id=p_device_id;
  insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values(v_device.dealer_id,auth.uid(),'owner','dealer_device_'||p_status,'dealer_devices',p_device_id::text,'{}');
end;
$$;
revoke all on function public.plotmap_admin_set_device_status(uuid,text,text) from public,anon;
grant execute on function public.plotmap_admin_set_device_status(uuid,text,text) to authenticated;
