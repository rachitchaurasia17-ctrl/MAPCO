-- Keep optional dealer-private sale fields genuinely optional.
--
-- The completed-sale function is intentionally kept as the same single atomic
-- transaction introduced in 20260803000100. This migration tightens its caller
-- capability and keeps optional seller/commission/payment values genuinely absent.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef('public.plotmap_record_completed_sale(jsonb)'::regprocedure)
    into v_definition;
  v_updated := v_definition;

  v_updated := replace(
    v_updated,
    $old$or not public.plotmap_is_active_member() then$old$,
    $new$or not public.plotmap_can_edit_crm() or not public.plotmap_dealer_can_write(v_dealer_id) then$new$
  );

  v_updated := replace(
    v_updated,
    $old$'seller', left(coalesce(nullif(trim(p_payload ->> 'seller'), ''), 'Owner'), 120),$old$,
    $new$'seller', left(nullif(trim(coalesce(p_payload ->> 'seller', '')), ''), 120),$new$
  );
  v_updated := replace(
    v_updated,
    $old$'brokerage', coalesce(nullif(p_payload ->> 'brokerage', '')::numeric, 0),$old$,
    $new$'brokerage', nullif(p_payload ->> 'brokerage', '')::numeric,$new$
  );
  v_updated := replace(
    v_updated,
    $old$'commission', coalesce(nullif(p_payload ->> 'commission', '')::numeric, 0),$old$,
    $new$'commission', nullif(p_payload ->> 'commission', '')::numeric,$new$
  );
  v_updated := replace(
    v_updated,
    $old$'commissionReceived', coalesce((p_payload ->> 'commissionReceived')::boolean, false),$old$,
    $new$'commissionReceived', (p_payload ->> 'commissionReceived')::boolean,$new$
  );
  v_updated := replace(
    v_updated,
    $old$'paymentReceived', coalesce(nullif(p_payload ->> 'paymentReceived', '')::numeric, 0),$old$,
    $new$'paymentReceived', nullif(p_payload ->> 'paymentReceived', '')::numeric,$new$
  );

  if v_updated = v_definition
     or position($old$'Owner'$old$ in v_updated) > 0
     or position($old$'brokerage', coalesce($old$ in v_updated) > 0
     or position($old$'commission', coalesce($old$ in v_updated) > 0
     or position($old$'commissionReceived', coalesce($old$ in v_updated) > 0
     or position($old$'paymentReceived', coalesce($old$ in v_updated) > 0 then
    raise exception 'plotmap_record_completed_sale definition did not match the expected secure baseline';
  end if;
  if position('public.plotmap_can_edit_crm()' in v_updated) = 0
     or position('public.plotmap_dealer_can_write(v_dealer_id)' in v_updated) = 0
     or position('public.plotmap_is_active_member()' in v_updated) > 0 then
    raise exception 'plotmap_record_completed_sale authorization did not match the expected secure baseline';
  end if;

  execute v_updated;
end;
$migration$;

revoke all on function public.plotmap_record_completed_sale(jsonb) from public, anon;
grant execute on function public.plotmap_record_completed_sale(jsonb) to authenticated;
