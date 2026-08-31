-- Property Intelligence Edge continuation support.
--
-- MAPCO-DEV's hosted Edge tier has a 150-second hard wall-clock limit. The
-- finalized pipeline can legitimately exceed it when Maps grounding is slow,
-- so the existing PI row is also used as a fenced continuation checkpoint.
-- No table, ranking, prompt, cache or security architecture changes.

create or replace function public.plotmap_property_intelligence_get(p_property_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dealer text := nullif(public.plotmap_current_dealer_id(), '');
  v_prop record;
  v_cached public.property_intelligence%rowtype;
begin
  if auth.uid() is null
     or v_dealer is null
     or not public.plotmap_is_active_member()
     or public.plotmap_current_role() = 'viewer'
     or not public.plotmap_dealer_is_active(v_dealer) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  select r.payload as payload into v_prop
  from public.crm_records r
  where r.id = p_property_id
    and r.entity_type = 'properties'
    and r.dealer_id = v_dealer
    and coalesce(r.deleted, false) = false
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'property_not_found');
  end if;

  select * into v_cached
  from public.property_intelligence
  where dealer_id = v_dealer and property_id = p_property_id
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'dealerId', v_dealer,
    'propertyId', p_property_id,
    'location', v_prop.payload -> 'location',
    'locality', coalesce(nullif(trim(v_prop.payload ->> 'sector'), ''),
                         nullif(trim(v_prop.payload ->> 'area'), ''), ''),
    'city', coalesce(nullif(trim(v_prop.payload ->> 'city'), ''), ''),
    'propertyType', coalesce(nullif(trim(v_prop.payload ->> 'type'), ''), ''),
    'cached', case when v_cached.id is null then null else jsonb_build_object(
      'inputDigest', v_cached.input_digest,
      'schemaVersion', v_cached.schema_version,
      'pipelineVersion', v_cached.pipeline_version,
      'phase1PromptVersion', v_cached.phase1_prompt_version,
      'phase2PromptVersion', v_cached.phase2_prompt_version,
      'provider', v_cached.provider,
      'model', v_cached.model,
      'status', v_cached.status,
      'reason', v_cached.reason,
      'generationStatus', v_cached.generation_status,
      'generationStage', v_cached.generation_stage,
      'generationRunId', v_cached.generation_run_id,
      'generationStartedAt', v_cached.generation_started_at,
      'failureReason', v_cached.failure_reason,
      'generatedAt', v_cached.generated_at,
      'lastCostInr', v_cached.last_cost_inr,
      'lastCostMicroUsd', v_cached.last_cost_micro_usd,
      'candidateUniverse', v_cached.candidate_universe,
      'phase2Output', v_cached.phase2_output,
      'origin', case when v_cached.latitude is null then null else
        jsonb_build_object('latitude', v_cached.latitude, 'longitude', v_cached.longitude) end,
      'local', v_cached.local_categories,
      'city', v_cached.city_places
    ) end
  );
end;
$$;

-- Explicit event indexes make each continuation stage idempotent while the
-- existing (run_id,event_index) uniqueness fence still prevents duplicates.
create or replace function public.plotmap_pi_record_cost(
  p_dealer_id text,
  p_property_id text,
  p_run_id text,
  p_pricing_version text,
  p_inr_per_usd numeric,
  p_events jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer text := lower(trim(coalesce(p_dealer_id, '')));
  v_count integer := 0;
begin
  if v_dealer = '' or p_events is null or jsonb_typeof(p_events) <> 'array' then
    return 0;
  end if;
  insert into public.property_intelligence_cost_events (
    run_id, event_index, dealer_id, property_id, provider, operation, requests, units,
    input_tokens, output_tokens, cache_hit, estimated_micro_usd,
    estimated_inr, avoided_micro_usd, avoided_inr,
    pricing_version, inr_per_usd, detail
  )
  select
    p_run_id,
    coalesce(nullif(e ->> 'eventIndex', '')::integer, event_ordinality::integer),
    v_dealer, p_property_id,
    coalesce(e ->> 'provider', 'unknown'), coalesce(e ->> 'operation', 'unknown'),
    coalesce((e ->> 'requests')::integer, 0), coalesce((e ->> 'units')::numeric, 0),
    coalesce((e ->> 'inputTokens')::integer, 0), coalesce((e ->> 'outputTokens')::integer, 0),
    coalesce((e ->> 'cacheHit')::boolean, false),
    coalesce((e ->> 'estimatedMicroUsd')::bigint, 0),
    coalesce((e ->> 'estimatedInr')::numeric, 0),
    coalesce((e ->> 'avoidedMicroUsd')::bigint, 0),
    coalesce((e ->> 'avoidedInr')::numeric, 0),
    coalesce(p_pricing_version, 'unknown'), coalesce(p_inr_per_usd, 0),
    left(coalesce(e ->> 'detail', ''), 200)
  from jsonb_array_elements(p_events) with ordinality as event(e, event_ordinality)
  where jsonb_typeof(e) = 'object'
  on conflict (run_id, event_index) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.plotmap_pi_run_get(p_run_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(to_jsonb(r), '{}'::jsonb)
  from public.property_intelligence_runs r
  where r.run_id = p_run_id
  limit 1;
$$;

revoke all on function public.plotmap_property_intelligence_get(text) from public, anon, authenticated;
grant execute on function public.plotmap_property_intelligence_get(text) to authenticated;
revoke all on function public.plotmap_pi_record_cost(text, text, text, text, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.plotmap_pi_record_cost(text, text, text, text, numeric, jsonb)
  to service_role;
revoke all on function public.plotmap_pi_run_get(text) from public, anon, authenticated;
grant execute on function public.plotmap_pi_run_get(text) to service_role;
