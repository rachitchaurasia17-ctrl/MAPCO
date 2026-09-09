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
