-- Keep the durable legacy provisioning attempt/lease and atomic finalizer.
-- Structured provenance is attached before Auth creation, never fabricated.
alter table public.dealer_provisioning_attempts add column founder_context jsonb;
create or replace function public.plotmap_founder_set_provisioning_context(p_attempt_id uuid,p_context jsonb)
returns void language plpgsql security definer set search_path=public,pg_catalog as $$
declare v_attempt public.dealer_provisioning_attempts%rowtype; v_key text;
begin
  if not public.plotmap_is_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if p_context is null or jsonb_typeof(p_context)<>'object'
    or coalesce(p_context->>'acquisitionSource','') not in ('family','referral','cold','walk_in','inbound') then raise exception 'INVALID_FOUNDER_CONTEXT'; end if;
  foreach v_key in array array['pitchVersion','protocolVersion','buildVersion'] loop
    if coalesce(length(trim(p_context->>v_key)),0) not between 1 and 60 then raise exception 'INVALID_FOUNDER_CONTEXT'; end if;
  end loop;
  select * into v_attempt from public.dealer_provisioning_attempts where id=p_attempt_id and created_by=auth.uid() for update;
  if not found or v_attempt.status='completed' then raise exception 'PROVISIONING_ATTEMPT_NOT_RETRYABLE'; end if;
  if v_attempt.founder_context is not null and v_attempt.founder_context<>p_context then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  update public.dealer_provisioning_attempts set founder_context=p_context where id=p_attempt_id;
end;
$$;
revoke all on function public.plotmap_founder_set_provisioning_context(uuid,jsonb) from public,anon;
grant execute on function public.plotmap_founder_set_provisioning_context(uuid,jsonb) to authenticated;

do $$
declare v_before text; v_after text;
begin
  v_before:=pg_get_functiondef('public.plotmap_admin_finalize_dealer_provisioning(uuid,text)'::regprocedure);
  v_after:=replace(v_before,'  if v_attempt.dealer_preexisted then', $patch$
  if v_attempt.founder_context is not null then
    -- Start the seven days when the account is actually created, not when a
    -- browser form opened or an earlier failed provisioning attempt began.
    v_attempt.trial_start:=now();
    v_attempt.trial_end:=now()+interval '7 days';
    v_attempt.subscription_status:='trial';
    v_attempt.device_limit:=4;
    v_attempt.activation_expires_at:=now()+interval '24 hours';
    update public.dealer_provisioning_attempts set trial_start=v_attempt.trial_start,
      trial_end=v_attempt.trial_end,subscription_status='trial',device_limit=4,
      activation_expires_at=v_attempt.activation_expires_at where id=v_attempt.id;
  end if;
  if v_attempt.dealer_preexisted then$patch$);
  if v_after=v_before then raise exception 'Provisioning finalizer account anchor missing'; end if;
  v_before:=v_after;
  v_after:=replace(v_before,'  -- Reuse the established bcrypt, uniqueness, ownership and audit contract.', $patch$
  if v_attempt.founder_context is not null then
    insert into public.trials(id,dealer_id,started_at,ends_at,pitch_version,build_version_at_start,protocol_version,acquisition_source)
      values(v_attempt.id,v_attempt.dealer_id,v_attempt.trial_start,v_attempt.trial_end,
        v_attempt.founder_context->>'pitchVersion',v_attempt.founder_context->>'buildVersion',
        v_attempt.founder_context->>'protocolVersion',v_attempt.founder_context->>'acquisitionSource');
  end if;
  -- Reuse the established bcrypt, uniqueness, ownership and audit contract.$patch$);
  if v_after=v_before then raise exception 'Provisioning finalizer evidence anchor missing'; end if;
  execute v_after;
end $$;
