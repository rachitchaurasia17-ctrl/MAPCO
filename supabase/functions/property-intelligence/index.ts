// MAPCO — Property Intelligence · production server (Supabase Edge).
//
// The ONLY place the finalized two-phase pipeline runs in production.
//
//   • Gemini 3.6 Flash on Vertex AI with Google Maps grounding (Phase 1)
//     and a second, independent ungrounded request (Phase 2).
//   • Google Places (New) + Google Routes via GOOGLE_MAPS_SERVER_KEY.
//   • Persistent Google Place Photos in the public `place-media` bucket,
//     one copy per PLACE, reused by every property near it.
//
// SECURITY
//   • No provider credential ever reaches a browser. The browser calls
//     this function with the caller's own JWT and nothing else.
//   • The dealer is derived server-side from that JWT through
//     plotmap_property_intelligence_get, which enforces active member,
//     non-viewer role and an active account. A dealer id in the request
//     body is ignored — there is no code path that reads one.
//   • The property's canonical coordinate comes from the database, never
//     from the request, so a caller cannot generate intelligence for a
//     location they do not own.
//
// COST
//   • Every generation claims a lease first, so a double-click or a
//     refresh loop cannot start two paid pipelines.
//   • Every billable operation is written to the cost ledger, including
//     the ones a cache avoided, so the saving is measurable.
//   • A per-generation INR ceiling degrades the run honestly instead of
//     spending past it.
//
// Deploy:  supabase functions deploy property-intelligence
// Secrets: GOOGLE_MAPS_SERVER_KEY, GOOGLE_GEMINI_API_KEY,
//          MAPCO_AI_ALLOWED_ORIGINS, and optionally GEMINI_MODEL,
//          PROPERTY_INTELLIGENCE_PRICING / PROPERTY_INTELLIGENCE_MAX_INR.

import { rpc, resolveCaller, backendConfigured } from '../_shared/db.ts';
import { allowedOrigins, corsHeaders, json, readJsonBody } from '../_shared/http.ts';
import { logEvent } from '../_shared/redact.ts';
import {
  runPropertyIntelligence,
  GeminiVertexTextModel,
  GooglePlacesClient,
  GoogleRoutesClient,
  CostLedger,
  DEFAULT_LIMITS,
  DEFAULT_PRICING,
  parsePricingOverride,
  computeInputDigest,
  toBuyerSafeIntelligence,
  PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
  PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
  PHASE1_PROMPT_VERSION,
  PHASE2_PROMPT_VERSION,
  type GeoPoint,
  type IntelUnavailableReason,
  type PipelineLimits,
  type PropertyIntelligenceViewModel,
  type RunUsage,
} from '../../../v2/src/packages/property-intelligence/index.ts';
import { createSupabaseStore } from './store.ts';

const ORIGINS = allowedOrigins('MAPCO_AI_ALLOWED_ORIGINS');

const GEMINI = {
  model: Deno.env.get('GEMINI_MODEL') || Deno.env.get('VERTEX_MODEL') || 'gemini-3.6-flash',
};
const GEMINI_KEY = Deno.env.get('GOOGLE_GEMINI_API_KEY') || '';
const MAPS_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_KEY') || '';
const PRICING = parsePricingOverride(
  Deno.env.get('PROPERTY_INTELLIGENCE_PRICING'), DEFAULT_PRICING,
);
const MAX_INR = Number(Deno.env.get('PROPERTY_INTELLIGENCE_MAX_INR') || '')
  || DEFAULT_LIMITS.maxGenerationInr;
const LIMITS: PipelineLimits = { ...DEFAULT_LIMITS, maxGenerationInr: MAX_INR };
const STALE_AFTER_DAYS = Number(Deno.env.get('PROPERTY_INTELLIGENCE_STALE_DAYS') || '180');

function providersConfigured(): boolean {
  return Boolean(MAPS_KEY && GEMINI_KEY);
}

function buildDeps(runId?: string, signal?: AbortSignal, maxGenerationInr = MAX_INR) {
  return {
    model: new GeminiVertexTextModel({
      model: GEMINI.model,
      apiKey: GEMINI_KEY,
    }),
    places: new GooglePlacesClient({ apiKey: MAPS_KEY, regionCode: 'IN' }),
    routes: new GoogleRoutesClient({ apiKey: MAPS_KEY, regionCode: 'IN' }),
    store: createSupabaseStore(),
    limits: { ...LIMITS, maxGenerationInr },
    pricing: PRICING,
    now: () => new Date().toISOString(),
    ...(runId ? { makeId: () => runId } : {}),
    signal,
    log: (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) =>
      logEvent(level, event, data ?? {}),
  };
}

function unavailableVm(reason: IntelUnavailableReason): PropertyIntelligenceViewModel {
  return {
    status: 'unavailable',
    reason,
    generatedAt: new Date().toISOString(),
    schemaVersion: PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
    pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
    provider: 'vertex-gemini',
    model: GEMINI.model,
    origin: null,
    local: [],
    city: [],
  };
}

interface GetResult {
  ok: boolean;
  reason?: string;
  dealerId?: string;
  propertyId?: string;
  location?: { latitude?: number; longitude?: number; updatedAt?: string } | null;
  locality?: string;
  city?: string;
  propertyType?: string;
  cached?: {
    inputDigest?: string;
    generationStatus?: string;
    generationStage?: string;
    generationRunId?: string;
    generatedAt?: string;
    status?: string;
    reason?: IntelUnavailableReason;
    origin?: GeoPoint | null;
    local?: PropertyIntelligenceViewModel['local'];
    city?: PropertyIntelligenceViewModel['city'];
    lastCostInr?: number;
    lastCostMicroUsd?: number;
    candidateUniverse?: import('../../../v2/src/packages/property-intelligence/index.ts').NormalizedCandidate[];
    phase2Output?: import('../../../v2/src/packages/property-intelligence/index.ts').Phase2Output | null;
  } | null;
}

function cachedToViewModel(cached: NonNullable<GetResult['cached']>): PropertyIntelligenceViewModel {
  return {
    status: cached.status === 'ready' ? 'ready' : 'unavailable',
    ...(cached.reason ? { reason: cached.reason } : {}),
    generatedAt: cached.generatedAt ?? new Date().toISOString(),
    schemaVersion: PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
    pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
    provider: 'vertex-gemini',
    model: GEMINI.model,
    origin: cached.origin ?? null,
    local: cached.local ?? [],
    city: cached.city ?? [],
  };
}

/** Persist the ledger. A failure here must never fail the generation, but
 *  it IS logged loudly: unrecorded spend is the thing this exists to stop. */
async function recordCost(
  dealerId: string, propertyId: string, usage: RunUsage, eventOffset = 0,
): Promise<void> {
  try {
    const previous = await rpc<Record<string, unknown>>('plotmap_pi_run_get', {
      p_run_id: usage.runId,
    }).catch(() => ({}));
    const prior = (key: string) => Number(previous?.[key] ?? 0);
    await rpc('plotmap_pi_record_cost', {
      p_dealer_id: dealerId,
      p_property_id: propertyId,
      p_run_id: usage.runId,
      p_pricing_version: usage.pricingVersion,
      p_inr_per_usd: usage.inrPerUsd,
      p_events: usage.events.map((event, index) => ({
        ...event, eventIndex: eventOffset + index,
      })),
    });
    await rpc('plotmap_property_intelligence_record_run_v3', {
      p_payload: {
        runId: usage.runId,
        dealerId,
        propertyId,
        provider: usage.provider,
        model: usage.model,
        pipelineVersion: usage.pipelineVersion,
        phase1PromptVersion: usage.phase1PromptVersion,
        phase2PromptVersion: usage.phase2PromptVersion,
        stage: usage.stage,
        inputTokens: prior('input_tokens')
          + usage.events.reduce((s, e) => s + (e.inputTokens ?? 0), 0),
        outputTokens: prior('output_tokens')
          + usage.events.reduce((s, e) => s + (e.outputTokens ?? 0), 0),
        groundingQueries: prior('grounding_queries') + usage.events
          .filter((e) => e.operation === 'maps_grounding_query')
          .reduce((s, e) => s + e.units, 0),
        placesCalls: prior('places_calls') + usage.events
          .filter((e) => e.operation.startsWith('places_') && !e.cacheHit)
          .reduce((s, e) => s + e.units, 0),
        routeCalls: prior('route_calls') + usage.routesComputed,
        repairAttempts: prior('repair_attempts') + usage.repairAttempts,
        costMicroUsd: prior('cost_micro_usd') + usage.totalMicroUsd,
        estimatedInr: prior('estimated_inr') + usage.totalInr,
        pricingVersion: usage.pricingVersion,
        cacheOutcome: String(previous?.cache_outcome ?? usage.cacheOutcome),
        refreshReason: previous?.refresh_reason ?? usage.refreshReason ?? null,
        latencyMs: prior('latency_ms') + usage.latencyMs,
        status: usage.status,
        error: usage.error ?? null,
        candidateCount: Math.max(prior('candidate_count'), usage.candidateCount),
        resolvedCount: Math.max(prior('resolved_count'), usage.resolvedCount),
        selectedCount: Math.max(prior('selected_count'), usage.selectedCount),
        photosReused: prior('photos_reused') + usage.photosReused,
        photosFetched: prior('photos_fetched') + usage.photosFetched,
        routesReused: prior('routes_reused') + usage.routesReused,
        routesComputed: prior('routes_computed') + usage.routesComputed,
      },
    });
  } catch (error) {
    logEvent('error', 'pi.cost.recordFailed', {
      runId: usage.runId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get('Origin');
  const headers = corsHeaders(origin, ORIGINS);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') {
    return json({ ok: false, reason: 'unavailable' }, 405, headers);
  }
  if (!backendConfigured()) {
    return json(unavailableVm('server_not_configured'), 200, headers);
  }

  const caller = await resolveCaller(request);
  if (!caller) return json(unavailableVm('forbidden'), 200, headers);

  const body = await readJsonBody(request);
  if (!body) return json(unavailableVm('error'), 200, headers);

  const propertyId = String(body.propertyId ?? '').trim();
  if (!propertyId || propertyId.length > 128) {
    return json(unavailableVm('property_not_found'), 200, headers);
  }
  const refresh = body.refresh === true;

  // The dealer, the property's canonical coordinate and the caller's right
  // to see any of it all come from the database under the caller's own JWT.
  // Nothing in the request body influences tenancy.
  let ctx: GetResult;
  try {
    ctx = await rpc<GetResult>('plotmap_property_intelligence_get',
      { p_property_id: propertyId }, { accessToken: caller.accessToken });
  } catch {
    return json(unavailableVm('error'), 200, headers);
  }
  if (!ctx?.ok) {
    const reason = ctx?.reason === 'property_not_found' ? 'property_not_found' : 'forbidden';
    return json(unavailableVm(reason as IntelUnavailableReason), 200, headers);
  }

  const dealerId = String(ctx.dealerId ?? '');
  const latitude = Number(ctx.location?.latitude);
  const longitude = Number(ctx.location?.longitude);
  if (!dealerId || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || (latitude === 0 && longitude === 0)) {
    return json(unavailableVm('location_not_set'), 200, headers);
  }
  const point: GeoPoint = { latitude, longitude };
  const locationUpdatedAt = ctx.location?.updatedAt;

  /* ── cache decision ───────────────────────────────────────────── */
  const digest = await computeInputDigest({
    dealerId, propertyId, point, locationUpdatedAt,
    provider: 'vertex-gemini', model: GEMINI.model,
    pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
    phase1PromptVersion: PHASE1_PROMPT_VERSION,
    phase2PromptVersion: PHASE2_PROMPT_VERSION,
  });

  const cached = ctx.cached ?? null;
  const ageMs = cached?.generatedAt ? Date.now() - Date.parse(cached.generatedAt) : Infinity;
  const stale = ageMs > STALE_AFTER_DAYS * 86_400_000;
  const digestMatches = cached?.inputDigest === digest;

  if (!refresh && cached && digestMatches && !stale && cached.status === 'ready') {
    // Reopening a property page must never re-bill a provider.
    const ledger = new CostLedger(PRICING);
    logEvent('info', 'pi.cache.hit', { propertyId, dealerId, digest: digest.slice(0, 12) });
    const cacheRunId = `hit_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await recordCost(dealerId, propertyId, {
      runId: cacheRunId,
      provider: 'vertex-gemini', model: GEMINI.model,
      pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
      phase1PromptVersion: PHASE1_PROMPT_VERSION,
      phase2PromptVersion: PHASE2_PROMPT_VERSION,
      stage: 'complete',
      events: [{
        provider: 'google_vertex_gemini', operation: 'pipeline_cache_hit',
        requests: 0, units: 1, cacheHit: true,
        estimatedMicroUsd: 0, estimatedInr: 0,
        avoidedMicroUsd: 0, avoidedInr: 0,
        detail: 'persisted_property_intelligence',
      }],
      totalMicroUsd: 0, totalInr: 0,
      inrPerUsd: ledger.pricing.inrPerUsd, pricingVersion: ledger.pricing.version,
      cacheOutcome: 'hit', latencyMs: 0, status: 'succeeded',
      candidateCount: 0, resolvedCount: 0, selectedCount: 0,
      photosReused: 0, photosFetched: 0, routesReused: 0, routesComputed: 0,
      repairAttempts: 0,
    });
    return json({ ...cachedToViewModel(cached), cache: 'hit' }, 200, headers);
  }

  if (!providersConfigured()) {
    return json(unavailableVm('server_not_configured'), 200, headers);
  }

  /* ── claim the generation lease ───────────────────────────────── */
  const resumable = !refresh && digestMatches
    && Boolean(cached?.generationRunId)
    && Array.isArray(cached?.candidateUniverse) && cached!.candidateUniverse!.length > 0
    && (cached?.generationStage === 'normalization' || cached?.generationStage === 'phase2');
  const runId = resumable
    ? String(cached!.generationRunId)
    : `pir_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  let claim: { ok?: boolean; reason?: string } | null = null;
  try {
    claim = await rpc('plotmap_property_intelligence_claim', {
      p_dealer_id: dealerId, p_property_id: propertyId,
      p_run_id: runId, p_lease_seconds: 240,
    });
  } catch {
    return json(unavailableVm('error'), 200, headers);
  }
  if (!claim?.ok) {
    // Another run holds the lease. Serve what we have rather than paying
    // twice for the same property.
    logEvent('info', 'pi.claim.busy', { propertyId, dealerId });
    if (cached && cached.status === 'ready') {
      return json({ ...cachedToViewModel(cached), cache: 'busy' }, 200, headers);
    }
    return json({ ...unavailableVm('busy'), status: 'generating' }, 200, headers);
  }

  /* ── run the pipeline ─────────────────────────────────────────── */
  try {
    const priorCostInr = resumable ? Number(cached?.lastCostInr ?? 0) : 0;
    const priorCostMicroUsd = resumable ? Number(cached?.lastCostMicroUsd ?? 0) : 0;
    const remainingInr = Math.max(0.01, MAX_INR - priorCostInr);
    const resume = resumable ? {
      candidateUniverse: cached!.candidateUniverse!,
      ...(cached?.generationStage === 'phase2' && cached.phase2Output
        ? { phase2Output: cached.phase2Output }
        : {}),
    } : undefined;
    const stopAfter = !resumable
      ? 'normalization' as const
      : cached?.generationStage === 'normalization'
        ? 'phase2' as const
        : undefined;
    const eventOffset = !resumable ? 0 : cached?.generationStage === 'normalization' ? 100 : 200;
    const result = await runPropertyIntelligence(
      {
        dealerId, propertyId, point,
        locality: String(ctx.locality ?? ''),
        city: String(ctx.city ?? ''),
        propertyType: ctx.propertyType ? 'RESIDENTIAL' : undefined,
        locationUpdatedAt,
        refreshReason: refresh ? 'manual_refresh' : undefined,
      },
        buildDeps(runId, undefined, remainingInr),
      {
        cacheOutcome: refresh ? 'refresh' : (stale && cached ? 'stale_refresh' : 'miss'),
        ...(stopAfter ? { stopAfter } : {}),
        ...(resume ? { resume } : {}),
      },
    );

    const isCheckpoint = result.viewModel.status === 'generating';
    const cumulativeCostInr = priorCostInr + result.usage.totalInr;
    const cumulativeCostMicroUsd = priorCostMicroUsd + result.usage.totalMicroUsd;

    // Paid usage is persisted before the result/checkpoint. If a later DB
    // write fails, the provider attempt remains visible rather than free.
    await recordCost(dealerId, propertyId, result.usage, eventOffset);

    const stored = await rpc<{ ok?: boolean; reason?: string }>(
      'plotmap_property_intelligence_store_v3', {
      p_dealer_id: dealerId,
      p_property_id: propertyId,
      p_payload: {
        schemaVersion: result.viewModel.schemaVersion,
        pipelineVersion: result.viewModel.pipelineVersion,
        phase1PromptVersion: result.usage.phase1PromptVersion,
        phase2PromptVersion: result.usage.phase2PromptVersion,
        provider: result.viewModel.provider,
        model: result.viewModel.model,
        origin: result.viewModel.origin,
        locationUpdatedAt: locationUpdatedAt ?? null,
        locality: ctx.locality ?? null,
        city: ctx.city ?? null,
        inputDigest: result.inputDigest,
        status: result.viewModel.status === 'ready' ? 'ready' : 'unavailable',
        reason: result.viewModel.reason ?? null,
        candidateUniverse: result.candidateUniverse,
        phase2Output: result.phase2Output,
        local: result.viewModel.local,
        cityPlaces: result.viewModel.city,
        generationStatus: isCheckpoint
          ? 'running'
          : result.usage.status === 'succeeded' ? 'complete' : 'failed',
        generationStage: result.usage.stage,
        runId: result.usage.runId,
        failureReason: result.viewModel.reason ?? null,
        failureDetail: result.usage.error ?? null,
        costInr: cumulativeCostInr.toFixed(2),
        costMicroUsd: String(cumulativeCostMicroUsd),
      },
    });

    if (!stored?.ok) {
      throw new Error(`property_intelligence_store_${stored?.reason ?? 'failed'}`);
    }

    logEvent('info', 'pi.generation.done', {
      runId: result.usage.runId, propertyId, dealerId,
      stage: result.usage.stage, status: result.usage.status,
      candidates: result.usage.candidateCount,
      selected: result.usage.selectedCount,
      inr: Number(cumulativeCostInr.toFixed(2)),
      photosReused: result.usage.photosReused,
      routesReused: result.usage.routesReused,
    });

    return json({
      ...result.viewModel,
      cache: 'miss',
      costInr: Number(cumulativeCostInr.toFixed(2)),
    }, 200, headers);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logEvent('error', 'pi.generation.failed', { runId, propertyId, detail });
    return json(unavailableVm('error'), 200, headers);
  } finally {
    try {
      await rpc('plotmap_property_intelligence_release', {
        p_dealer_id: dealerId, p_property_id: propertyId, p_run_id: runId,
      });
    } catch { /* lease expires on its own */ }
  }
});

/** Exported for the client-link projection used by resolve-client-link. */
export { toBuyerSafeIntelligence };
