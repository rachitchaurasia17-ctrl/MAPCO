-- Deal papers checklist + property relink.
--
-- The Deal room's Papers tab is a CHECKLIST of which papers the dealer holds.
-- It is not the file vault: desk_deal_documents requires a real uploaded file
-- (unique storage_path, mime type, size > 0) and the dealer app has no file
-- input. Marking a paper therefore records a dated checklist entry on the deal
-- payload -- the same shape desk_property_sellers.document_kinds already uses
-- for seller papers -- and never invents a document row with no file behind it.
--
-- The checklist rides inside the deal payload, so plotmap_deal_workspace
-- already returns it under `deal` and needs no change.

create or replace function public.plotmap_set_deal_paper(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_id text := nullif(trim(coalesce(p_payload->>'dealId','')), '');
  v_title text := nullif(trim(coalesce(p_payload->>'title','')), '');
  v_have boolean := coalesce((p_payload->>'have')::boolean, true);
  v_deal jsonb; v_list jsonb; v_kept jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
    or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'deal access denied'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8192
    then return jsonb_build_object('ok',false,'reason','invalid payload'); end if;
  if v_title is null or length(v_title) > 160
    then return jsonb_build_object('ok',false,'reason','Enter a paper name of at most 160 characters'); end if;

  select payload into v_deal from public.crm_records
    where dealer_id=v_dealer and id=v_id and entity_type='deals' and not deleted for update;
  if v_deal is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  -- A paper backed by a real uploaded file is owned by that file, not the list.
  if exists (select 1 from public.desk_deal_documents
    where dealer_id=v_dealer and deal_id=v_id and lower(title)=lower(v_title))
    then return jsonb_build_object('ok',false,'reason','That paper already has an uploaded file'); end if;

  v_list := case when jsonb_typeof(v_deal->'paperChecklist') = 'array'
    then v_deal->'paperChecklist' else '[]'::jsonb end;
  -- Rebuild without this title, so marking is idempotent and clearing removes.
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_kept
    from jsonb_array_elements(v_list) e
    where jsonb_typeof(e) = 'object' and lower(coalesce(e->>'title','')) <> lower(v_title);
  if v_have then
    if jsonb_array_length(v_kept) >= 60
      then return jsonb_build_object('ok',false,'reason','This deal already lists 60 papers'); end if;
    v_kept := v_kept || jsonb_build_array(jsonb_build_object(
      'title',v_title,'markedOn',to_char(timezone('utc',now()),'YYYY-MM-DD')));
  end if;

  update public.crm_records
    set payload = payload || jsonb_build_object('paperChecklist',v_kept),
        updated_at = timezone('utc',now())
    where dealer_id=v_dealer and id=v_id and entity_type='deals';

  begin insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values (v_dealer,auth.uid(),public.plotmap_current_role(),
      case when v_have then 'deal_paper_marked' else 'deal_paper_cleared' end,
      'deals',v_id,jsonb_build_object('title',v_title));
  exception when others then null; end;

  return jsonb_build_object('ok',true,'paperChecklist',v_kept);
exception when others then
  -- PL/pgSQL rolls every write in this block back before returning failure.
  return jsonb_build_object('ok',false,'reason',sqlerrm);
end;
$$;
revoke all on function public.plotmap_set_deal_paper(jsonb) from public, anon;
grant execute on function public.plotmap_set_deal_paper(jsonb) to authenticated;

-- Point an open deal at a different saved property. The denormalized property
-- fields and the inherited seller are re-derived from the canonical records --
-- exactly the way plotmap_start_deal derives them -- never re-typed by hand.
create or replace function public.plotmap_relink_deal_property(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_id text := nullif(trim(coalesce(p_payload->>'dealId','')), '');
  v_property text := nullif(trim(coalesce(p_payload->>'propertyId','')), '');
  v_deal jsonb; v_prop jsonb; v_patch jsonb;
  v_seller_id text; v_seller_name text; v_seller_phone text;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
    or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'deal access denied'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8192
    then return jsonb_build_object('ok',false,'reason','invalid payload'); end if;
  if v_property is null then return jsonb_build_object('ok',false,'reason','Choose a saved property'); end if;

  select payload into v_deal from public.crm_records
    where dealer_id=v_dealer and id=v_id and entity_type='deals' and not deleted for update;
  if v_deal is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  if coalesce(v_deal->>'recordType','') <> 'pipeline' or v_deal->>'stage' in ('closed','lost')
    then return jsonb_build_object('ok',false,'reason','Reopen the deal before changing its property'); end if;

  select payload into v_prop from public.crm_records
    where dealer_id=v_dealer and id=v_property and entity_type='properties' and not deleted for update;
  if v_prop is null then return jsonb_build_object('ok',false,'reason','That property is no longer available'); end if;
  if coalesce(v_prop->>'lifecycle','') = 'sold'
    then return jsonb_build_object('ok',false,'reason','That property is already sold'); end if;

  -- One open pipeline deal per property+buyer stays the rule after a relink.
  if exists (select 1 from public.crm_records r
    where r.dealer_id=v_dealer and r.entity_type='deals' and not r.deleted and r.id <> v_id
      and r.payload->>'recordType'='pipeline'
      and r.payload->>'propertyId'=v_property
      and r.payload->>'buyerId'=v_deal->>'buyerId'
      and coalesce(r.payload->>'stage','negotiating') not in ('closed','lost'))
    then return jsonb_build_object('ok',false,'reason','This buyer already has an open deal on that property'); end if;

  select ps.seller_id, s.name, s.primary_phone into v_seller_id, v_seller_name, v_seller_phone
    from public.desk_property_sellers ps
    join public.desk_sellers s on s.id = ps.seller_id and s.dealer_id = ps.dealer_id
    where ps.dealer_id = v_dealer and ps.property_id = v_property
    order by ps.is_primary desc, ps.created_at limit 1;

  v_patch := jsonb_build_object(
    'propertyId',v_property,'propId',v_property,
    'prop',left(coalesce(nullif(trim(coalesce(v_prop->>'title',v_prop->>'area')),''),'Property'),120),
    'propSub',trim(both ' ·' from concat_ws(' · ',
      nullif(trim(v_prop->>'size'),''), nullif(trim(v_prop->>'facing'),''))),
    'city',left(coalesce(v_prop->>'city',''),80),
    'sector',left(coalesce(v_prop->>'sector',v_prop->>'block',''),120),
    'sellerId',v_seller_id,'seller',left(v_seller_name,120),'sellerPhone',left(v_seller_phone,24));

  update public.crm_records set payload = payload || v_patch, updated_at = timezone('utc',now())
    where dealer_id=v_dealer and id=v_id and entity_type='deals';
  -- No desk_deal_stage_events row: its stage column is constrained to the real
  -- stages, so it is the stage ledger. A relink changes no stage, and writing
  -- the current stage again would make the deal's history claim it moved twice.
  -- The relink is recorded in audit_logs below instead.

  begin insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values (v_dealer,auth.uid(),public.plotmap_current_role(),'deal_property_relinked','deals',v_id,
      jsonb_build_object('propertyId',v_property));
  exception when others then null; end;

  select payload into v_deal from public.crm_records
    where dealer_id=v_dealer and id=v_id and entity_type='deals';
  return jsonb_build_object('ok',true,'deal',v_deal);
exception when others then
  -- PL/pgSQL rolls every write in this block back before returning failure.
  return jsonb_build_object('ok',false,'reason',sqlerrm);
end;
$$;
revoke all on function public.plotmap_relink_deal_property(jsonb) from public, anon;
grant execute on function public.plotmap_relink_deal_property(jsonb) to authenticated;

-- The same checklist on the property side. The Deal room's "Add a property
-- paper" picker promises the mark saves onto the property so every future deal
-- sees it; desk_property_documents cannot hold it because there is no file, so
-- it rides on the property payload exactly as the deal checklist does.
create or replace function public.plotmap_set_property_paper(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dealer text := public.plotmap_current_dealer_id();
  v_id text := nullif(trim(coalesce(p_payload->>'propertyId','')), '');
  v_title text := nullif(trim(coalesce(p_payload->>'title','')), '');
  v_have boolean := coalesce((p_payload->>'have')::boolean, true);
  v_prop jsonb; v_list jsonb; v_kept jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or v_dealer is null or not public.plotmap_can_edit_crm()
    or not public.plotmap_dealer_can_write(v_dealer) then raise exception 'property access denied'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8192
    then return jsonb_build_object('ok',false,'reason','invalid payload'); end if;
  if v_title is null or length(v_title) > 160
    then return jsonb_build_object('ok',false,'reason','Enter a paper name of at most 160 characters'); end if;

  select payload into v_prop from public.crm_records
    where dealer_id=v_dealer and id=v_id and entity_type='properties' and not deleted for update;
  if v_prop is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;

  if exists (select 1 from public.desk_property_documents
    where dealer_id=v_dealer and property_id=v_id and lower(title)=lower(v_title))
    then return jsonb_build_object('ok',false,'reason','That paper already has an uploaded file'); end if;

  v_list := case when jsonb_typeof(v_prop->'paperChecklist') = 'array'
    then v_prop->'paperChecklist' else '[]'::jsonb end;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_kept
    from jsonb_array_elements(v_list) e
    where jsonb_typeof(e) = 'object' and lower(coalesce(e->>'title','')) <> lower(v_title);
  if v_have then
    if jsonb_array_length(v_kept) >= 60
      then return jsonb_build_object('ok',false,'reason','This property already lists 60 papers'); end if;
    v_kept := v_kept || jsonb_build_array(jsonb_build_object(
      'title',v_title,'markedOn',to_char(timezone('utc',now()),'YYYY-MM-DD')));
  end if;

  update public.crm_records
    set payload = payload || jsonb_build_object('paperChecklist',v_kept),
        updated_at = timezone('utc',now())
    where dealer_id=v_dealer and id=v_id and entity_type='properties';

  begin insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values (v_dealer,auth.uid(),public.plotmap_current_role(),
      case when v_have then 'property_paper_marked' else 'property_paper_cleared' end,
      'properties',v_id,jsonb_build_object('title',v_title));
  exception when others then null; end;

  return jsonb_build_object('ok',true,'paperChecklist',v_kept);
exception when others then
  -- PL/pgSQL rolls every write in this block back before returning failure.
  return jsonb_build_object('ok',false,'reason',sqlerrm);
end;
$$;
revoke all on function public.plotmap_set_property_paper(jsonb) from public, anon;
grant execute on function public.plotmap_set_property_paper(jsonb) to authenticated;

-- Correction to 20260909154749_desk_deal_details_commands.sql.
--
-- That version appended a desk_deal_stage_events row on every edit, carrying
-- the deal's CURRENT stage. desk_deal_stage_events.stage is constrained to the
-- real stages, so the table is the stage ledger, not a general activity log:
-- an edit that changed no stage made the deal's history read
-- "negotiating > token > token > registry", claiming a move that never
-- happened. The stage row is now written only by plotmap_set_deal_stage, which
-- this function already calls when the stage genuinely changes. Everything else
-- about the command is unchanged.
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
    -- plotmap_set_deal_stage writes the one stage row this transition deserves.
    v_result := public.plotmap_set_deal_stage(jsonb_build_object('dealId',v_id,'stage',v_stage));
    if v_result->>'ok' <> 'true' then raise exception '%',v_result->>'reason'; end if;
  end if;
  if p_payload ? 'tokenPayment' then
    v_result := public.plotmap_record_deal_payment(jsonb_build_object('dealId',v_id,'kind','token',
      'amount',p_payload#>>'{tokenPayment,amount}','receivedOn',p_payload#>>'{tokenPayment,receivedOn}',
      'note','Recorded while updating the deal'));
    if v_result->>'ok' <> 'true' then raise exception '%',v_result->>'reason'; end if;
  end if;
  begin insert into public.audit_logs(dealer_id,actor_profile_id,actor_role,action_type,entity_type,entity_id,metadata)
    values (v_dealer,auth.uid(),public.plotmap_current_role(),'deal_details_updated','deals',v_id,
      jsonb_build_object('fields',(select coalesce(jsonb_agg(k),'[]'::jsonb) from jsonb_object_keys(v_patch) k)));
  exception when others then null; end;
  select payload into v_deal from public.crm_records where dealer_id=v_dealer and id=v_id and entity_type='deals';
  return jsonb_build_object('ok',true,'deal',v_deal);
exception when others then
  -- PL/pgSQL rolls every write in this block back before returning failure.
  return jsonb_build_object('ok',false,'reason',sqlerrm);
end;
$$;
revoke all on function public.plotmap_update_deal_details(jsonb) from public, anon;
grant execute on function public.plotmap_update_deal_details(jsonb) to authenticated;
