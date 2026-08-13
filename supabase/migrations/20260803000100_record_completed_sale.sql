-- MAPCO: record a completed sale as ONE atomic transaction.
-- Marks the property sold (removing it from inventory / presentation / future
-- client links), creates the completed deal, and appends to the buyer's
-- purchased history. Dealer-scoped; SECURITY DEFINER so it can write across the
-- dealer's own crm_records under RLS. Any raised error rolls the whole thing back.
create or replace function public.plotmap_record_completed_sale(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dealer_id text := public.plotmap_current_dealer_id();
  v_property_id text := nullif(trim(coalesce(p_payload ->> 'propertyId', '')), '');
  v_buyer_id text := nullif(trim(coalesce(p_payload ->> 'buyerId', '')), '');
  v_new_buyer jsonb := p_payload -> 'newBuyer';
  v_prop record;
  v_buyer_name text;
  v_deal_id text := 'deal-' || encode(extensions.gen_random_bytes(8), 'hex');
  v_sold_price numeric;
  v_sale_date text := nullif(trim(coalesce(p_payload ->> 'saleDate', '')), '');
  v_reg_date text := nullif(trim(coalesce(p_payload ->> 'registrationDate', '')), '');
  v_prop_name text;
  v_prop_sub text;
  v_city text;
  v_sector text;
  v_dealer_name text;
  v_documents jsonb := coalesce(p_payload -> 'documents', '[]'::jsonb);
  v_timeline jsonb;
  v_deal jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 32768 then
    return jsonb_build_object('ok', false, 'reason', 'invalid payload');
  end if;
  if auth.uid() is null or v_dealer_id is null
     or not public.plotmap_can_edit_crm()
     or not public.plotmap_dealer_can_write(v_dealer_id) then
    raise exception 'deal access denied';
  end if;
  if v_property_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_sold_price := nullif(p_payload ->> 'soldPrice', '')::numeric;
  if v_sold_price is null or v_sold_price <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'enter a final sold price');
  end if;
  if v_sale_date is null then
    return jsonb_build_object('ok', false, 'reason', 'enter the sale date');
  end if;

  -- Load + lock the property row (dealer-owned, not deleted).
  select r.id, r.payload into v_prop
  from public.crm_records r
  where r.dealer_id = v_dealer_id and r.id = v_property_id
    and r.entity_type = 'properties' and coalesce(r.deleted, false) = false
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if coalesce((v_prop.payload ->> 'sold')::boolean, false) = true
     or coalesce(v_prop.payload ->> 'internalStatus', '') ~* 'sold' then
    return jsonb_build_object('ok', false, 'reason', 'already_sold');
  end if;

  -- Resolve the buyer (existing dealer-owned client, or create a new one).
  if v_buyer_id is not null then
    select left(coalesce(nullif(trim(r.payload ->> 'name'), ''), 'Buyer'), 80) into v_buyer_name
    from public.crm_records r
    where r.dealer_id = v_dealer_id and r.id = v_buyer_id
      and r.entity_type = 'clients' and coalesce(r.deleted, false) = false;
    if v_buyer_name is null then
      return jsonb_build_object('ok', false, 'reason', 'buyer is not available');
    end if;
  else
    if v_new_buyer is null or nullif(trim(coalesce(v_new_buyer ->> 'name', '')), '') is null then
      return jsonb_build_object('ok', false, 'reason', 'choose or add a buyer');
    end if;
    v_buyer_id := 'client-' || encode(extensions.gen_random_bytes(8), 'hex');
    v_buyer_name := left(trim(v_new_buyer ->> 'name'), 80);
    insert into public.crm_records (id, dealer_id, entity_type, payload, deleted, updated_at)
    values (v_buyer_id, v_dealer_id, 'clients', jsonb_build_object(
      'id', v_buyer_id,
      'name', v_buyer_name,
      'phone', left(coalesce(v_new_buyer ->> 'phone', ''), 24),
      'city', left(coalesce(nullif(trim(v_new_buyer ->> 'city'), ''), v_prop.payload ->> 'city'), 80),
      'status', 'active', 'purchased', jsonb_build_array()
    ), false, timezone('utc'::text, now()));
  end if;

  -- Snapshot fields for the deal record.
  v_city := left(coalesce(nullif(trim(v_prop.payload ->> 'city'), ''), ''), 80);
  v_sector := left(coalesce(nullif(trim(coalesce(v_prop.payload ->> 'sector', v_prop.payload ->> 'block')), ''), ''), 120);
  v_prop_name := left(coalesce(nullif(trim(coalesce(v_prop.payload ->> 'title', v_prop.payload ->> 'area')), ''), 'Property'), 120);
  v_prop_sub := trim(both ' ·' from concat_ws(' · ',
    nullif(trim(v_prop.payload ->> 'size'), ''), nullif(trim(v_prop.payload ->> 'facing'), '')));
  select left(coalesce(nullif(trim(d.brand_name), ''), 'PlotMap'), 120) into v_dealer_name
  from public.dealer_settings d where d.dealer_id = v_dealer_id;
  v_dealer_name := coalesce(v_dealer_name, 'PlotMap');

  v_timeline := jsonb_build_array(jsonb_build_object('at', v_sale_date, 'label', 'Sold price recorded'));
  if v_reg_date is not null then
    v_timeline := v_timeline || jsonb_build_array(jsonb_build_object('at', v_reg_date, 'label', 'Registration completed'));
  end if;

  v_deal := jsonb_strip_nulls(jsonb_build_object(
    'id', v_deal_id,
    'propId', v_property_id,
    'prop', v_prop_name,
    'propSub', v_prop_sub,
    'city', v_city,
    'sector', v_sector,
    'buyerId', v_buyer_id,
    'buyer', v_buyer_name,
    'seller', left(coalesce(nullif(trim(p_payload ->> 'seller'), ''), 'Owner'), 120),
    'sellerPhone', left(nullif(trim(coalesce(p_payload ->> 'sellerPhone', '')), ''), 24),
    'soldPrice', v_sold_price,
    'brokerage', coalesce(nullif(p_payload ->> 'brokerage', '')::numeric, 0),
    'commission', coalesce(nullif(p_payload ->> 'commission', '')::numeric, 0),
    'commissionReceived', coalesce((p_payload ->> 'commissionReceived')::boolean, false),
    'paymentReceived', coalesce(nullif(p_payload ->> 'paymentReceived', '')::numeric, 0),
    'soldDate', v_sale_date,
    'registrationDate', v_reg_date,
    'dealer', v_dealer_name,
    'documents', case when jsonb_typeof(v_documents) = 'array' and jsonb_array_length(v_documents) <= 20 then v_documents else '[]'::jsonb end,
    'timeline', v_timeline
  ));

  -- 1) create the completed deal
  insert into public.crm_records (id, dealer_id, entity_type, payload, deleted, updated_at)
  values (v_deal_id, v_dealer_id, 'deals', v_deal, false, timezone('utc'::text, now()));

  -- 2) mark the property sold (out of inventory / presentation / links)
  update public.crm_records
  set payload = v_prop.payload
      || jsonb_build_object('sold', true, 'published', false, 'clientVisible', false, 'internalStatus', 'sold'),
      updated_at = timezone('utc'::text, now())
  where dealer_id = v_dealer_id and id = v_property_id and entity_type = 'properties';

  -- 3) append to the buyer's purchased history
  update public.crm_records
  set payload = payload
      || jsonb_build_object('purchased',
           coalesce(payload -> 'purchased', '[]'::jsonb) || to_jsonb(v_property_id)),
      updated_at = timezone('utc'::text, now())
  where dealer_id = v_dealer_id and id = v_buyer_id and entity_type = 'clients';

  -- audit trail (best-effort, same shape as other plotmap actions)
  begin
    insert into public.audit_logs (dealer_id, actor_profile_id, actor_role, action_type, entity_type, entity_id, metadata)
    values (v_dealer_id, auth.uid(), public.plotmap_current_role(), 'deal_recorded', 'deals', v_deal_id,
      jsonb_build_object('propertyId', v_property_id, 'soldPrice', v_sold_price));
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'deal', v_deal);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'reason', 'invalid number in payload');
end;
$function$;

revoke all on function public.plotmap_record_completed_sale(jsonb) from public, anon;
grant execute on function public.plotmap_record_completed_sale(jsonb) to authenticated;
