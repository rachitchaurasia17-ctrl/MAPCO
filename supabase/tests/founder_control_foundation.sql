-- Transactional integration assertions. Run against MAPCO-DEV as postgres.
-- No Auth login is created persistently, no messages sent, all fixtures roll back.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$
declare v_founder uuid; v_other uuid:=gen_random_uuid(); v_dealer text:='founder-test-'||substr(gen_random_uuid()::text,1,8);
begin
  select id into v_founder from auth.users where lower(email)='rachitchaurasia17@gmail.com';
  if v_founder is null then
    v_founder:=gen_random_uuid();
    insert into auth.users(id,email,email_confirmed_at) values(v_founder,'rachitchaurasia17@gmail.com',now());
  end if;
  insert into auth.users(id,email,email_confirmed_at) values(v_other,'founder-test-'||v_other||'@example.invalid',now());
  insert into public.dealer_settings(dealer_id,brand_name,account_status,subscription_status,trial_start,trial_end)
    values(v_dealer,'Founder integration fixture','active','trial',now(),now()+interval '7 days');
  insert into public.profiles(id,email,role,dealer_id,status)
    values(v_other,'founder-test-'||v_other||'@example.invalid','owner',v_dealer,'active');
  perform set_config('founder_test.founder',v_founder::text,true);
  perform set_config('founder_test.other',v_other::text,true);
  perform set_config('founder_test.dealer',v_dealer,true);
end $$;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('founder_test.other'))::text,true);
set local role authenticated;
do $$
begin
  if public.plotmap_is_platform_admin() then raise exception 'Non-founder obtained admin access'; end if;
  if public.plotmap_founder_bootstrap() then raise exception 'Non-founder bootstrap succeeded'; end if;
  begin
    perform public.plotmap_founder_dealer_workspace(current_setting('founder_test.dealer'));
    raise exception 'Non-founder read founder workspace';
  exception when others then
    if sqlerrm<>'Founder access required' then raise; end if;
  end;
  begin
    perform public.plotmap_founder_set_account(jsonb_build_object('dealerId',current_setting('founder_test.dealer'),'action','suspend'));
    raise exception 'Non-founder changed entitlement';
  exception when others then
    if sqlerrm<>'Founder access required' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('founder_test.founder'))::text,true);
do $$
declare v_dealer text:=current_setting('founder_test.dealer'); v_data jsonb; v_prediction uuid; v_code jsonb;
begin
  if not public.plotmap_founder_bootstrap() then raise exception 'Verified founder bootstrap failed'; end if;
  if not public.plotmap_founder_bootstrap() then raise exception 'Bootstrap is not repeatable'; end if;
  perform public.plotmap_founder_add_evidence(jsonb_build_object('dealerId',v_dealer,'kind','statement','provenance','dealer_stated','body','Integration test evidence','occurredAt',now()));
  perform public.plotmap_founder_add_prediction(jsonb_build_object('dealerId',v_dealer,'statement','Integration prediction','domain','commercial','confidence',60,'horizonAt',now()+interval '2 days'));
  v_data:=public.plotmap_founder_dealer_workspace(v_dealer);
  if jsonb_array_length(v_data->'evidence')<>1 or jsonb_array_length(v_data->'predictions')<>1 then raise exception 'Founder records not loaded'; end if;
  v_prediction:=(v_data->'predictions'->0->>'id')::uuid;
  perform public.plotmap_founder_resolve_prediction(v_prediction,'true','Observed result');
  begin
    perform public.plotmap_founder_resolve_prediction(v_prediction,'false','Cannot rewrite result');
    raise exception 'Resolved prediction was overwritten';
  exception when others then
    if sqlerrm<>'Prediction is missing or already resolved' then raise; end if;
  end;
  perform public.plotmap_founder_set_account(jsonb_build_object('dealerId',v_dealer,'action','paid','expiresAt',now()+interval '30 days','plan','Manual monthly','amountPaise',100000));
  if not public.plotmap_dealer_is_active(v_dealer) then raise exception 'Paid access did not apply immediately'; end if;
  v_code:=public.plotmap_founder_create_device_code(v_dealer);
  if (v_code->>'code') !~ '^[0-9]{8}$' then raise exception 'Invalid device activation code'; end if;
  perform public.plotmap_founder_set_account(jsonb_build_object('dealerId',v_dealer,'action','suspend'));
  if public.plotmap_dealer_is_active(v_dealer) then raise exception 'Suspension did not apply immediately'; end if;
  perform public.plotmap_founder_set_account(jsonb_build_object('dealerId',v_dealer,'action','resume'));
  if not public.plotmap_dealer_is_active(v_dealer) then raise exception 'Restore did not apply'; end if;
end $$;
set constraints all immediate;
select 'PASS: founder bootstrap, non-founder denial, evidence, prediction immutability, paid access, suspension, restore, 8-digit code' as result;
rollback;
