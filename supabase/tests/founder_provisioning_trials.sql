-- No accounts or credentials survive this integration test.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare v_founder uuid;
begin
  select id into v_founder from auth.users where lower(email)='rachitchaurasia17@gmail.com';
  if v_founder is null then
    v_founder:=gen_random_uuid();
    insert into auth.users(id,email,email_confirmed_at) values(v_founder,'rachitchaurasia17@gmail.com',now());
  end if;
  perform set_config('founder_test.founder',v_founder::text,true);
  perform set_config('founder_test.dealer','trial-test-'||substr(gen_random_uuid()::text,1,8),true);
  perform set_config('founder_test.password','Test-'||gen_random_uuid()::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',v_founder)::text,true);
end $$;
set local role authenticated;
do $$
declare v_begin jsonb; v_context jsonb:='{"acquisitionSource":"referral","pitchVersion":"integration-pitch","protocolVersion":"integration-protocol","buildVersion":"test"}';
begin
  if not public.plotmap_founder_bootstrap() then raise exception 'Founder bootstrap failed'; end if;
  v_begin:=public.plotmap_admin_begin_dealer_provisioning(
    p_idempotency_key=>gen_random_uuid()::text,p_request_fingerprint=>repeat('a',64),
    p_dealer_id=>current_setting('founder_test.dealer'),p_business_name=>'Trial test business',
    p_owner_name=>'Test owner',p_owner_phone=>null,p_primary_area=>'Mohali',
    p_login_email=>current_setting('founder_test.dealer')||'@example.invalid',
    p_account_status=>'active',p_subscription_status=>'trial',
    p_trial_start=>now()-interval '1 day',p_trial_end=>now()+interval '2 days',
    p_device_limit=>1,p_activation_expires_at=>now()+interval '1 day',p_passcode=>current_setting('founder_test.password'));
  perform set_config('founder_test.attempt',v_begin->>'attempt_id',true);
  perform public.plotmap_founder_set_provisioning_context((v_begin->>'attempt_id')::uuid,v_context);
  perform public.plotmap_founder_set_provisioning_context((v_begin->>'attempt_id')::uuid,v_context);
  begin
    perform public.plotmap_founder_set_provisioning_context((v_begin->>'attempt_id')::uuid,v_context||'{"acquisitionSource":"cold"}');
    raise exception 'Retry changed acquisition source';
  exception when others then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end;
end $$;
reset role;
do $$
declare v_id uuid:=gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
    values(v_id,current_setting('founder_test.dealer')||'@example.invalid',now(),
      jsonb_build_object('plotmap_provisioning_attempt_id',current_setting('founder_test.attempt'),'plotmap_dealer_id',current_setting('founder_test.dealer')));
  perform set_config('founder_test.dealer_user',v_id::text,true);
end $$;
set local role authenticated;
do $$
declare v_result jsonb; v_workspace jsonb; v_trial jsonb;
begin
  perform public.plotmap_admin_mark_dealer_provisioning_auth(current_setting('founder_test.attempt')::uuid,current_setting('founder_test.dealer_user')::uuid);
  v_result:=public.plotmap_admin_finalize_dealer_provisioning(current_setting('founder_test.attempt')::uuid,current_setting('founder_test.password'));
  if (v_result->>'device_limit')::int<>4 then raise exception 'New founder account did not default to four devices'; end if;
  if (v_result->>'trial_end')::timestamptz-(v_result->>'trial_start')::timestamptz<>interval '7 days' then raise exception 'Trial is not seven days'; end if;
  if (v_result->>'trial_start')::timestamptz<>now() then raise exception 'Trial did not start on creation'; end if;
  v_workspace:=public.plotmap_founder_dealer_workspace(current_setting('founder_test.dealer'));
  if jsonb_array_length(v_workspace->'trials')<>1 then raise exception 'Structured trial not saved atomically'; end if;
  v_trial:=v_workspace->'trials'->0;
  if v_trial->>'acquisition_source'<>'referral' then raise exception 'Provenance not preserved'; end if;
  v_result:=public.plotmap_admin_finalize_dealer_provisioning(current_setting('founder_test.attempt')::uuid,current_setting('founder_test.password'));
  if (v_result->>'credentials_available')::boolean then raise exception 'Retry exposed credentials'; end if;
  perform public.plotmap_founder_set_account(jsonb_build_object('dealerId',current_setting('founder_test.dealer'),'action','paid','expiresAt',now()+interval '30 days','plan','Manual','amountPaise',125050));
  v_workspace:=public.plotmap_founder_dealer_workspace(current_setting('founder_test.dealer'));
  if jsonb_array_length(v_workspace->'trials')<>1 or v_workspace->'trials'->0->>'id'<>v_trial->>'id'
    or v_workspace->'trials'->0->>'commercial_outcome'<>'won'
    or (v_workspace->'trials'->0->>'price_paid_paise')::bigint<>125050 then raise exception 'Paid conversion failed to preserve and close original trial'; end if;
end $$;
set constraints all immediate;
select 'PASS: atomic seven-day trial, four devices, acquisition provenance, idempotent completion, paid conversion preserves trial' as result;
rollback;
