-- Persist an edit and its optional stage/payment in one transaction.
create or replace function public.plotmap_update_deal_details(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_id text := p_payload->>'dealId';
  v_deal jsonb; v_patch jsonb := '{}'::jsonb; v_result jsonb;
  v_amount numeric; v_stage text; v_action jsonb;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
    or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'deal access denied'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 32768
    then return jsonb_build_object('ok',false,'reason','invalid payload'); end if;
  select payload into v_deal from public.crm_records
    where dealer_id=v_dealer and id=v_id and entity_type='deals' and not deleted for update;
  if v_deal is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if coalesce(v_deal->>'recordType','') <> 'pipeline' or v_deal->>'stage' in ('closed','lost')
    then return jsonb_build_object('ok',false,'reason','Reopen the deal before editing it'); end if;
  if p_payload ? 'name' then
    if length(coalesce(p_payload->>'name','')) > 160 then raise exception 'Deal name is too long'; end if;
    v_patch := v_patch || jsonb_build_object('name',trim(coalesce(p_payload->>'name','')));
  end if;
  if p_payload ? 'value' then
    v_amount := (p_payload->>'value')::numeric;
    if v_amount is null or v_amount <= 0 or v_amount = 'NaN'::numeric then raise exception 'Enter a positive deal value'; end if;
    v_patch := v_patch || jsonb_build_object('value',v_amount);
  end if;
  if p_payload ? 'registryDate' then
    v_patch := v_patch || jsonb_build_object('registryDate',nullif(p_payload->>'registryDate','')::date);
  end if;
  if p_payload ? 'nextAction' then
    v_action := p_payload->'nextAction';
    if v_action <> 'null'::jsonb then
      if jsonb_typeof(v_action) <> 'object' or nullif(trim(v_action->>'kind'),'') is null
        or length(v_action->>'kind') > 60 or length(coalesce(v_action->>'note','')) > 300
        then raise exception 'Enter a follow-up action and a note of at most 300 characters'; end if;
      v_action := jsonb_build_object('kind',trim(v_action->>'kind'),'note',coalesce(v_action->>'note',''),
        'dueOn',nullif(v_action->>'dueOn','')::date);
    end if;
    v_patch := v_patch || jsonb_build_object('nextAction',v_action);
  end if;
  update public.crm_records set payload=payload||v_patch, updated_at=timezone('utc',now())
    where dealer_id=v_dealer and id=v_id and entity_type='deals';
  v_stage := nullif(p_payload->>'stage','');
  if v_stage is not null and v_stage <> v_deal->>'stage' then
    if v_stage not in ('negotiating','token','registry') then raise exception 'Use the sale or lost workflow for this stage'; end if;
    v_result := public.plotmap_set_deal_stage(jsonb_build_object('dealId',v_id,'stage',v_stage));
    if v_result->>'ok' <> 'true' then raise exception '%',v_result->>'reason'; end if;
  end if;
  if p_payload ? 'tokenPayment' then
    v_result := public.plotmap_record_deal_payment(jsonb_build_object('dealId',v_id,'kind','token',
      'amount',p_payload#>>'{tokenPayment,amount}','receivedOn',p_payload#>>'{tokenPayment,receivedOn}',
      'note','Recorded while updating the deal'));
    if v_result->>'ok' <> 'true' then raise exception '%',v_result->>'reason'; end if;
  end if;
  select payload into v_deal from public.crm_records where dealer_id=v_dealer and id=v_id and entity_type='deals';
  insert into public.desk_deal_stage_events(id,dealer_id,deal_id,stage,note)
    values ('dse-'||encode(extensions.gen_random_bytes(8),'hex'),v_dealer,v_id,v_deal->>'stage','Deal details updated');
  return jsonb_build_object('ok',true,'deal',v_deal);
exception when others then
  -- PL/pgSQL rolls every write in this block back before returning failure.
  return jsonb_build_object('ok',false,'reason',sqlerrm);
end;
$$;
revoke all on function public.plotmap_update_deal_details(jsonb) from public, anon;
grant execute on function public.plotmap_update_deal_details(jsonb) to authenticated;

-- Preserve dealer-entered deal names and commission totals.
create or replace function public.plotmap_start_deal(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_property text := nullif(trim(coalesce(p_payload->>'propertyId','')), '');
  v_buyer text := nullif(trim(coalesce(p_payload->>'buyerId','')), '');
  v_new_buyer jsonb := p_payload->'newBuyer';
  v_stage text := coalesce(nullif(trim(p_payload->>'stage'),''), 'negotiating');
  v_value numeric := nullif(p_payload->>'value','')::numeric;
  v_commission_total numeric := nullif(p_payload->>'commissionTotal','')::numeric;
  v_deal_id text := 'deal-'||encode(extensions.gen_random_bytes(8),'hex');
  v_prop record; v_buyer_name text; v_existing jsonb;
  v_seller_id text; v_seller_name text; v_seller_phone text;
  v_prop_name text; v_prop_sub text; v_deal jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 32768
    then return jsonb_build_object('ok',false,'reason','invalid payload'); end if;
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
    or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'deal access denied'; end if;
  if v_stage not in ('negotiating','token','registry')
    then return jsonb_build_object('ok',false,'reason','a new deal starts at negotiating, token or registry'); end if;
  if v_commission_total < 0 then return jsonb_build_object('ok',false,'reason','commission cannot be negative'); end if;
  if length(coalesce(p_payload->>'name','')) > 160 then return jsonb_build_object('ok',false,'reason','deal name is too long'); end if;
  if v_property is null then return jsonb_build_object('ok',false,'reason','choose a property'); end if;
  if v_value is not null and v_value <= 0
    then return jsonb_build_object('ok',false,'reason','deal value must be positive'); end if;

  select r.id, r.payload into v_prop from public.crm_records r
    where r.dealer_id = v_dealer and r.id = v_property
      and r.entity_type = 'properties' and not r.deleted for update;
  if not found then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if coalesce(v_prop.payload->>'lifecycle','') = 'sold'
    then return jsonb_build_object('ok',false,'reason','this property is already sold'); end if;

  -- Canonical buyer: reuse an existing client, or create a minimal truthful one.
  if v_buyer is not null then
    select left(nullif(trim(r.payload->>'name'),''),80) into v_buyer_name from public.crm_records r
      where r.dealer_id = v_dealer and r.id = v_buyer and r.entity_type = 'clients' and not r.deleted;
    if v_buyer_name is null then return jsonb_build_object('ok',false,'reason','buyer is not available'); end if;
  else
    if nullif(trim(coalesce(v_new_buyer->>'name','')),'') is null
      then return jsonb_build_object('ok',false,'reason','choose or add a buyer'); end if;
    v_buyer := 'client-'||encode(extensions.gen_random_bytes(8),'hex');
    v_buyer_name := left(trim(v_new_buyer->>'name'),80);
    insert into public.crm_records(id,dealer_id,entity_type,payload,deleted,updated_at) values (
      v_buyer,v_dealer,'clients',jsonb_build_object(
        'id',v_buyer,'name',v_buyer_name,'phone',left(coalesce(v_new_buyer->>'phone',''),24),
        'city','','want','','budget','','budgetMax',0,'status','active','seen','','note','',
        'viewed','[]'::jsonb,'interest','[]'::jsonb,'purchased','[]'::jsonb,
        'profileCompleteness','needs-attention',
        'missingFields',jsonb_build_array('city','requirements','budget')),
      false,timezone('utc',now()));
  end if;

  -- Idempotency: an open pipeline deal for this property+buyer is reused.
  select r.payload into v_existing from public.crm_records r
    where r.dealer_id = v_dealer and r.entity_type = 'deals' and not r.deleted
      and r.payload->>'recordType' = 'pipeline'
      and r.payload->>'propertyId' = v_property
      and r.payload->>'buyerId' = v_buyer
      and coalesce(r.payload->>'stage','negotiating') not in ('closed','lost')
    order by r.created_at limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok',true,'idempotent',true,'deal',v_existing);
  end if;

  -- Seller context comes through the canonical property↔seller relationship.
  select ps.seller_id, s.name, s.primary_phone into v_seller_id, v_seller_name, v_seller_phone
    from public.desk_property_sellers ps
    join public.desk_sellers s on s.id = ps.seller_id and s.dealer_id = ps.dealer_id
    where ps.dealer_id = v_dealer and ps.property_id = v_property
    order by ps.is_primary desc, ps.created_at limit 1;

  v_prop_name := left(coalesce(nullif(trim(coalesce(v_prop.payload->>'title',v_prop.payload->>'area')),''),'Property'),120);
  v_prop_sub := trim(both ' ·' from concat_ws(' · ',
    nullif(trim(v_prop.payload->>'size'),''), nullif(trim(v_prop.payload->>'facing'),'')));

  v_deal := jsonb_strip_nulls(jsonb_build_object(
    'id',v_deal_id,'recordType','pipeline','stage',v_stage,
    'propertyId',v_property,'propId',v_property,'prop',v_prop_name,'propSub',v_prop_sub,
    'city',left(coalesce(v_prop.payload->>'city',''),80),
    'sector',left(coalesce(v_prop.payload->>'sector',v_prop.payload->>'block',''),120),
    'buyerId',v_buyer,'buyer',v_buyer_name,
    'sellerId',v_seller_id,'seller',left(v_seller_name,120),'sellerPhone',left(v_seller_phone,24),
    'name',nullif(trim(p_payload->>'name'),''),'commissionTotal',v_commission_total,
    'value',v_value,
    'commission',jsonb_build_object(
      'buyer',jsonb_build_object(
        'mode',coalesce(nullif(p_payload#>>'{commission,buyer,mode}',''),'none'),
        'percent',nullif(p_payload#>>'{commission,buyer,percent}','')::numeric,
        'fixed',nullif(p_payload#>>'{commission,buyer,fixed}','')::numeric),
      'seller',jsonb_build_object(
        'mode',coalesce(nullif(p_payload#>>'{commission,seller,mode}',''),'none'),
        'percent',nullif(p_payload#>>'{commission,seller,percent}','')::numeric,
        'fixed',nullif(p_payload#>>'{commission,seller,fixed}','')::numeric)),
    'nextAction',case when nullif(trim(p_payload#>>'{nextAction,kind}'),'') is null then null
      else jsonb_build_object(
        'kind',left(trim(p_payload#>>'{nextAction,kind}'),60),
        'note',left(coalesce(p_payload#>>'{nextAction,note}',''),300),
        'dueOn',nullif(p_payload#>>'{nextAction,dueOn}','')::date) end,
    'createdAt',to_char(timezone('utc',now()),'YYYY-MM-DD')));

  insert into public.crm_records(id,dealer_id,entity_type,payload,deleted,updated_at)
    values (v_deal_id,v_dealer,'deals',v_deal,false,timezone('utc',now()));
  insert into public.desk_deal_stage_events(id,dealer_id,deal_id,stage,note)
    values ('dse-'||encode(extensions.gen_random_bytes(8),'hex'),v_dealer,v_deal_id,v_stage,'Deal created');

  begin insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values (v_dealer,auth.uid(),public.plotmap_current_role(),'deal_started','deals',v_deal_id,
      jsonb_build_object('propertyId',v_property,'buyerId',v_buyer,'stage',v_stage));
  exception when others then null; end;

  return jsonb_build_object('ok',true,'idempotent',false,'deal',v_deal);
exception when unique_violation then
  return jsonb_build_object('ok',false,'reason','a deal already exists for this buyer and property');
when invalid_text_representation or numeric_value_out_of_range or check_violation then
  return jsonb_build_object('ok',false,'reason','invalid value in payload');
end;
$$;
revoke all on function public.plotmap_start_deal(jsonb) from public, anon;
grant execute on function public.plotmap_start_deal(jsonb) to authenticated;

-- Preserve recorded completed-sale amounts in the existing dealer-scoped workspace.
create or replace function public.plotmap_deal_workspace(p_deal_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_deal jsonb; v_property_id text; v_value numeric;
  v_expected_b numeric; v_expected_s numeric;
  v_got_b numeric; v_got_s numeric; v_token numeric;
  v_expected_other numeric := 0; v_got_other numeric := 0;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_is_active_member()
    or public.plotmap_current_role() = 'viewer'
    then raise exception 'deal access denied'; end if;

  select r.payload into v_deal from public.crm_records r
    where r.dealer_id = v_dealer and r.id = p_deal_id
      and r.entity_type = 'deals' and not r.deleted;
  if v_deal is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  v_property_id := coalesce(v_deal->>'propertyId', v_deal->>'propId');
  v_value := coalesce(
    nullif(v_deal->>'soldPrice','')::numeric,
    nullif(v_deal->>'value','')::numeric, 0);

  v_expected_b := public.plotmap_deal_commission_side(v_value,
    v_deal#>>'{commission,buyer,mode}',
    nullif(v_deal#>>'{commission,buyer,percent}','')::numeric,
    nullif(v_deal#>>'{commission,buyer,fixed}','')::numeric);
  v_expected_s := public.plotmap_deal_commission_side(v_value,
    v_deal#>>'{commission,seller,mode}',
    nullif(v_deal#>>'{commission,seller,percent}','')::numeric,
    nullif(v_deal#>>'{commission,seller,fixed}','')::numeric);

  select
    coalesce(sum(amount) filter (where kind='commission-buyer'),0),
    coalesce(sum(amount) filter (where kind='commission-seller'),0),
    coalesce(sum(amount) filter (where kind='token'),0)
  into v_got_b, v_got_s, v_token
  from public.desk_deal_payments where dealer_id=v_dealer and deal_id=p_deal_id;

  -- Older completed sales recorded one commission total, without a side.
  -- Preserve that total without inventing who paid it or dated ledger rows.
  if jsonb_typeof(v_deal->'commissionTotal') = 'number' then
    v_expected_other := greatest(0, (v_deal->>'commissionTotal')::numeric);
  end if;
  if jsonb_typeof(v_deal->'commission') = 'number' then
    v_expected_other := greatest(0, (v_deal->>'commission')::numeric);
    if v_deal->>'commissionReceived' = 'true' then
      -- This legacy flag is a total-received snapshot, not another receipt.
      v_got_other := greatest(0, v_expected_other - v_got_b - v_got_s);
    end if;
  end if;
  if jsonb_typeof(v_deal->'paymentReceived') = 'number' then
    v_token := greatest(v_token, (v_deal->>'paymentReceived')::numeric);
  end if;

  return jsonb_build_object(
    'ok',true,
    'deal',v_deal,
    'property',(select jsonb_build_object('id',r.id,'payload',r.payload)
      from public.crm_records r where r.dealer_id=v_dealer and r.id=v_property_id
        and r.entity_type='properties' and not r.deleted),
    'buyer',(select jsonb_build_object('id',r.id,'payload',r.payload)
      from public.crm_records r where r.dealer_id=v_dealer and r.id=v_deal->>'buyerId'
        and r.entity_type='clients' and not r.deleted),
    'seller',(select jsonb_build_object(
        'id',s.id,'name',s.name,'primaryPhone',s.primary_phone,'type',s.seller_type,
        'relationship',ps.relationship,'availability',ps.availability,
        'askingPrice',ps.asking_price,'siteVisitInstructions',ps.site_visit_instructions)
      from public.desk_property_sellers ps
      join public.desk_sellers s on s.id=ps.seller_id and s.dealer_id=ps.dealer_id
      where ps.dealer_id=v_dealer and ps.property_id=v_property_id
      order by ps.is_primary desc, ps.created_at limit 1),
    'stageHistory',(select coalesce(jsonb_agg(jsonb_build_object(
        'stage',e.stage,'occurredAt',e.occurred_at,'note',e.note) order by e.occurred_at),'[]'::jsonb)
      from public.desk_deal_stage_events e where e.dealer_id=v_dealer and e.deal_id=p_deal_id),
    'payments',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',p.id,'kind',p.kind,'amount',p.amount,'receivedOn',p.received_on,'note',p.note)
        order by p.received_on desc, p.created_at desc),'[]'::jsonb)
      from public.desk_deal_payments p where p.dealer_id=v_dealer and p.deal_id=p_deal_id),
    'money',jsonb_build_object(
      'value',v_value,'token',v_token,
      'expectedBuyer',v_expected_b,'expectedSeller',v_expected_s,
      'expectedUnallocated',v_expected_other,'receivedUnallocated',v_got_other,
      'expected',v_expected_b+v_expected_s+v_expected_other,
      'receivedBuyer',v_got_b,'receivedSeller',v_got_s,'received',v_got_b+v_got_s+v_got_other,
      'due',greatest(0,(v_expected_b+v_expected_s+v_expected_other)-(v_got_b+v_got_s+v_got_other)),
      'fullySettled',(v_expected_b+v_expected_s+v_expected_other) > 0 and (v_got_b+v_got_s+v_got_other) >= (v_expected_b+v_expected_s+v_expected_other)),
    'dealPapers',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',d.id,'title',d.title,'type',d.document_type,'bucket',d.storage_bucket,
        'path',d.storage_path,'mimeType',d.mime_type,'sizeBytes',d.size_bytes,'createdAt',d.created_at)
        order by d.created_at desc),'[]'::jsonb)
      from public.desk_deal_documents d where d.dealer_id=v_dealer and d.deal_id=p_deal_id),
    -- Property papers are referenced, never duplicated into the deal.
    'propertyPapers',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',d.id,'title',d.title,'type',d.document_type,'bucket',d.storage_bucket,
        'path',d.storage_path,'mimeType',d.mime_type,'sizeBytes',d.size_bytes,
        'visibility',d.visibility,'safety',d.safety,'createdAt',d.created_at)
        order by d.created_at desc),'[]'::jsonb)
      from public.desk_property_documents d
      where d.dealer_id=v_dealer and d.property_id=v_property_id));
end;
$$;
revoke all on function public.plotmap_deal_workspace(text) from public, anon;
grant execute on function public.plotmap_deal_workspace(text) to authenticated;
