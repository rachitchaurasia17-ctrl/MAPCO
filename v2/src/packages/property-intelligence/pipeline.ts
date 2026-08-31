/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · pipeline orchestrator
   ---------------------------------------------------------------
   REAL MAPCO PROPERTY
     → PHASE 1   Gemini + Google Maps grounding (high recall)
     → NORMALIZE deterministic: ids, Places identity, exact-id dedupe,
                 sameSector, Phase 2 input contract
     → PHASE 2   Gemini, FRESH request (no Phase 1 context carried over)
     → VALIDATE  strict; one controlled repair attempt, then fail truthfully
     → PHASE 3   deterministic: Places details, persistent Place Photos,
                 Google Routes (distance / duration / polyline), cost ledger
     → PERSISTED FINAL PROPERTY INTELLIGENCE
     → EXISTING MAPCO PROPERTY INTELLIGENCE UI

   There are exactly TWO AI phases. Phase 3 contains no AI.

   Every failure produces a truthful state. Nothing in this file invents a
   place, a distance, a duration or a photo to fill a gap.
   ═══════════════════════════════════════════════════════════════ */
import {
  DEFAULT_LIMITS,
  PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
  PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
  type GenerationStage,
  type IntelligencePlace,
  type IntelUnavailableReason,
  type LocalCategoryView,
  type NormalizedCandidate,
  type Phase2Output,
  type PipelineDeps,
  type PipelineInput,
  type PipelineResult,
  type PropertyIntelligenceViewModel,
  type RunUsage,
} from './types.ts';
import {
  PHASE1_PROMPT_VERSION, PHASE2_PROMPT, PHASE2_PROMPT_VERSION, buildPhase1Prompt,
} from './prompts/index.ts';
import { indexGroundedPlaces, parsePhase1Output } from './phase1/parse.ts';
import { buildPhase2Input, knownPlaceIdsFrom, normalizeCandidates } from './normalize/index.ts';
import { validatePhase2Output } from './phase2/validate.ts';
import { enrichSelections, type Selection } from './enrich/index.ts';
import { CostLedger } from './cost/ledger.ts';
import { DEFAULT_PRICING } from './cost/pricing.ts';
import { categoryIcon } from './icons.ts';
import { computeInputDigest } from './cache-key.ts';

/** Below this the area is genuinely too sparse to present anything useful. */
export const MIN_CANDIDATES = 6;

/** A truthful failure reason, carried out of the pipeline unchanged.
 *  Written without TypeScript parameter properties so the package runs
 *  unchanged under Node type-stripping, Deno and the browser bundler. */
export class PipelineError extends Error {
  readonly reason: IntelUnavailableReason;
  readonly detail?: string;
  constructor(reason: IntelUnavailableReason, detail?: string) {
    super(reason);
    this.name = 'PipelineError';
    this.reason = reason;
    this.detail = detail;
  }
}

function randomRunId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `pir_${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export interface RunOptions {
  /** Reported in the run record; does not change behaviour. */
  cacheOutcome?: RunUsage['cacheOutcome'];
  /** Hosted Edge continuation checkpoint. The ordinary/local pipeline omits it. */
  stopAfter?: 'normalization' | 'phase2';
  /** Trusted server-owned state persisted by an earlier fenced stage. */
  resume?: {
    candidateUniverse: NormalizedCandidate[];
    phase2Output?: Phase2Output | null;
  };
}

export async function runPropertyIntelligence(
  input: PipelineInput,
  deps: PipelineDeps,
  options: RunOptions = {},
): Promise<PipelineResult> {
  const startedAt = Date.now();
  const log = deps.log ?? (() => {});
  const limits = deps.limits ?? DEFAULT_LIMITS;
  const ledger = new CostLedger(deps.pricing ?? DEFAULT_PRICING);
  const runId = deps.makeId ? deps.makeId('run') : randomRunId();

  let stage: GenerationStage = 'queued';
  let candidateUniverse: NormalizedCandidate[] = [];
  let phase2Output: Phase2Output | null = null;
  let repairAttempts = 0;
  let resolvedCount = 0;
  let photosReused = 0;
  let photosFetched = 0;
  let routesReused = 0;
  let routesComputed = 0;

  const inputDigest = await computeInputDigest({
    dealerId: input.dealerId,
    propertyId: input.propertyId,
    point: input.point,
    locationUpdatedAt: input.locationUpdatedAt,
    provider: deps.model.name,
    model: deps.model.model,
    pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
    phase1PromptVersion: PHASE1_PROMPT_VERSION,
    phase2PromptVersion: PHASE2_PROMPT_VERSION,
  });

  const finish = (
    status: RunUsage['status'],
    viewModel: PropertyIntelligenceViewModel,
    selectedCount: number,
    error?: string,
  ): PipelineResult => ({
    viewModel,
    usage: {
      runId,
      provider: deps.model.name,
      model: deps.model.model,
      pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
      phase1PromptVersion: PHASE1_PROMPT_VERSION,
      phase2PromptVersion: PHASE2_PROMPT_VERSION,
      stage,
      events: [...ledger.events],
      totalMicroUsd: ledger.totalMicroUsd(),
      totalInr: ledger.totalInr(),
      inrPerUsd: ledger.pricing.inrPerUsd,
      pricingVersion: ledger.pricing.version,
      cacheOutcome: options.cacheOutcome ?? 'miss',
      refreshReason: input.refreshReason,
      latencyMs: Date.now() - startedAt,
      status,
      error,
      candidateCount: candidateUniverse.length,
      resolvedCount,
      selectedCount,
      photosReused,
      photosFetched,
      routesReused,
      routesComputed,
      repairAttempts,
    },
    inputDigest,
    candidateUniverse,
    phase2Output,
  });

  const unavailable = (reason: IntelUnavailableReason, error?: string): PipelineResult => {
    stage = 'failed';
    return finish('unavailable', {
      status: 'unavailable',
      reason,
      generatedAt: deps.now(),
      schemaVersion: PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
      pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
      provider: deps.model.name,
      model: deps.model.model,
      origin: input.point,
      local: [],
      city: [],
    }, 0, error);
  };

  const checkpoint = (): PipelineResult => finish('succeeded', {
    status: 'generating',
    reason: 'busy',
    generatedAt: deps.now(),
    schemaVersion: PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
    pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
    provider: deps.model.name,
    model: deps.model.model,
    origin: input.point,
    local: [],
    city: [],
  }, 0);

  if (options.resume?.candidateUniverse?.length) {
    candidateUniverse = options.resume.candidateUniverse;
    resolvedCount = candidateUniverse.filter(
      (candidate) => candidate.placesResolution.status === 'RESOLVED',
    ).length;
    log('info', 'pi.normalization.resumed', { runId, candidates: candidateUniverse.length });
  } else {
  /* ── PHASE 1 — Gemini + Google Maps grounding ─────────────────── */
  stage = 'phase1';
  log('info', 'pi.phase1.start', {
    runId, propertyId: input.propertyId, locality: input.locality, city: input.city,
  });

  const phase1Prompt = buildPhase1Prompt({
    latitude: input.point.latitude,
    longitude: input.point.longitude,
    locality: input.locality,
    city: input.city,
  });

  let phase1Text: string;
  let groundedPlaceIds: Record<string, string>;
  try {
    const response = await deps.model.generate(phase1Prompt, {
      grounding: { latitude: input.point.latitude, longitude: input.point.longitude },
      temperature: 0.4,
      maxOutputTokens: 16384,
      thinkingBudget: 2048,
      signal: deps.signal,
    });
    ledger.recordModelTurn('phase1', response.usage);
    phase1Text = response.text;
    groundedPlaceIds = indexGroundedPlaces(response.groundedPlaces);
  } catch (error) {
    const message = (error as Error).message ?? 'phase1 failed';
    log('error', 'pi.phase1.failed', { runId, error: message });
    return unavailable(classifyProviderError(message, 'phase1_failed'), message);
  }

  const parsed = parsePhase1Output(phase1Text);
  const discovered = parsed.local.length + parsed.city.length;
  log('info', 'pi.phase1.parsed', {
    runId, local: parsed.local.length, city: parsed.city.length,
    grounded: Object.keys(groundedPlaceIds).length,
  });
  if (discovered === 0) {
    return unavailable('phase1_unparseable', phase1Text.slice(0, 300));
  }

  /* ── NORMALIZATION — deterministic MAPCO, no AI ───────────────── */
  stage = 'normalization';
  // One batched registry read tells us which place ids MAPCO already knows,
  // which feeds the `seenBefore` signal Phase 2 sees.
  let knownPlaceIds = new Set<string>();
  try {
    const seeded = await deps.store.getPlaceMedia([]);
    knownPlaceIds = knownPlaceIdsFrom(seeded);
  } catch { /* the registry is an optimisation; never fail the run on it */ }

  const identityBudget = Math.min(
    limits.maxIdentityResolutions,
    ledger.remainingUnits(limits.maxGenerationInr, 'places_identity'),
  );

  const normalized = await normalizeCandidates(parsed, deps.places, {
    point: input.point,
    propertySector: input.propertySector,
    propertyLocality: input.locality,
    groundedPlaceIds,
    knownPlaceIds,
    maxIdentityResolutions: identityBudget,
    signal: deps.signal,
    onIdentityRequest: () => ledger.record('places_identity', 1),
    log,
  });
  candidateUniverse = normalized.candidates;
  resolvedCount = normalized.stats.resolved;

  log('info', 'pi.normalize.done', { runId, ...normalized.stats });
  }

  if (candidateUniverse.length < MIN_CANDIDATES) {
    return unavailable('insufficient_candidates',
      `only ${candidateUniverse.length} candidates survived normalization`);
  }

  if (options.stopAfter === 'normalization') {
    stage = 'normalization';
    return checkpoint();
  }

  if (options.resume?.phase2Output) {
    phase2Output = options.resume.phase2Output;
    stage = 'phase2';
    log('info', 'pi.phase2.resumed', {
      runId,
      localCategories: phase2Output.localCategories.length,
      cityPlaces: phase2Output.cityPlaces.length,
    });
  } else {
  const phase2Input = buildPhase2Input({
    propertyId: input.propertyId,
    propertyType: input.propertyType,
    propertySubtype: input.propertySubtype,
    point: input.point,
    locality: input.locality,
    city: input.city,
    candidates: candidateUniverse,
  });

  // The ceiling is checked BEFORE committing the second paid AI turn.
  // Phase 1 has already been billed and cannot be refunded, but there is no
  // reason to spend Phase 2 on top of a budget that is already gone.
  if (ledger.totalInr() > limits.maxGenerationInr) {
    log('warn', 'pi.cost.capReached', {
      runId, spentInr: Number(ledger.totalInr().toFixed(2)), capInr: limits.maxGenerationInr,
    });
    return unavailable('cost_cap_reached',
      `spent ₹${ledger.totalInr().toFixed(2)} of ₹${limits.maxGenerationInr} before Phase 2`);
  }

  /* ── PHASE 2 — Gemini, fresh request, NO grounding ────────────── */
  stage = 'phase2';
  const phase2Body = `${PHASE2_PROMPT}\n\nINPUT JSON:\n${JSON.stringify(phase2Input)}`;

  let validation = await callAndValidatePhase2(phase2Body, candidateUniverse, deps, ledger, 'phase2');

  if (!validation.ok) {
    // ONE controlled repair attempt with the schema errors fed back. MAPCO
    // never patches the response itself — a repaired-by-code result would be
    // MAPCO's judgment wearing Phase 2's name.
    stage = 'validation';
    repairAttempts = 1;
    log('warn', 'pi.phase2.invalid', {
      runId, issues: validation.issues.slice(0, 8).map((i) => `${i.code}@${i.path}`),
    });
    const repairPrompt = `${phase2Body}\n\n${validation.feedback ?? ''}`;
    validation = await callAndValidatePhase2(
      repairPrompt, candidateUniverse, deps, ledger, 'phase2-repair',
    );
    if (!validation.ok) {
      log('error', 'pi.phase2.repairFailed', {
        runId, issues: validation.issues.slice(0, 8).map((i) => `${i.code}@${i.path}`),
      });
      return unavailable('phase2_invalid',
        validation.issues.slice(0, 5).map((i) => `${i.code}@${i.path}`).join('; '));
    }
  }

  phase2Output = validation.value!;
  log('info', 'pi.phase2.ok', {
    runId,
    localCategories: phase2Output.localCategories.length,
    cityPlaces: phase2Output.cityPlaces.length,
  });
  }

  if (options.stopAfter === 'phase2') {
    stage = 'phase2';
    return checkpoint();
  }

  /* ── PHASE 3 — deterministic enrichment ───────────────────────── */
  stage = 'enrichment';
  const byId = new Map(candidateUniverse.map((c) => [c.candidateId, c]));
  const selections: Selection[] = [];

  for (const category of phase2Output.localCategories) {
    for (const place of category.places) {
      const candidate = byId.get(place.candidateId);
      if (!candidate) continue; // validation guarantees this, belt and braces
      selections.push({ candidate, group: 'local', category: category.category, rank: place.rank });
    }
  }
  for (const place of phase2Output.cityPlaces) {
    const candidate = byId.get(place.candidateId);
    if (!candidate) continue;
    selections.push({ candidate, group: 'city', category: place.category });
  }

  const enriched = await enrichSelections(selections, {
    places: deps.places,
    routes: deps.routes,
    store: deps.store,
    ledger,
    origin: input.point,
    maxEnrichedPlaces: limits.maxEnrichedPlaces,
    maxRouteCalls: limits.maxRouteCalls,
    maxGenerationInr: limits.maxGenerationInr,
    now: deps.now,
    signal: deps.signal,
    log,
  });
  photosReused = enriched.stats.photosReused;
  photosFetched = enriched.stats.photosFetched;
  routesReused = enriched.stats.routesReused;
  routesComputed = enriched.stats.routesComputed;

  log('info', 'pi.enrich.done', {
    runId, ...enriched.stats,
    totalInr: Number(ledger.totalInr().toFixed(2)),
    savedInr: Number(ledger.savedInr().toFixed(2)),
  });

  /* ── assemble the view model ──────────────────────────────────── */
  const cardsByKey = new Map(enriched.places.map((p) => [p.id, p]));

  const local: LocalCategoryView[] = phase2Output.localCategories.map((category) => {
    const places = category.places
      .map((p) => cardsByKey.get(`local:${p.candidateId}`))
      .filter((p): p is IntelligencePlace => Boolean(p))
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    return { category: category.category, icon: categoryIcon(category.category), places };
  }).filter((c) => c.places.length > 0);

  const city = phase2Output.cityPlaces
    .map((p) => cardsByKey.get(`city:${p.candidateId}`))
    .filter((p): p is IntelligencePlace => Boolean(p));

  stage = 'complete';

  const viewModel: PropertyIntelligenceViewModel = {
    status: 'ready',
    generatedAt: deps.now(),
    schemaVersion: PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
    pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
    provider: deps.model.name,
    model: deps.model.model,
    origin: input.point,
    local,
    city,
  };

  return finish('succeeded', viewModel, enriched.places.length);
}

/** One Phase 2 turn plus strict validation of whatever came back. */
async function callAndValidatePhase2(
  prompt: string,
  universe: readonly NormalizedCandidate[],
  deps: PipelineDeps,
  ledger: CostLedger,
  label: string,
) {
  try {
    const response = await deps.model.generate(prompt, {
      // NO grounding: Phase 2 judges the supplied universe only, and the
      // enormous Phase 1 Maps context must not contaminate its judgment.
      temperature: 0.2,
      maxOutputTokens: 8192,
      thinkingBudget: 2048,
      signal: deps.signal,
    });
    ledger.recordModelTurn(label, response.usage);
    return validatePhase2Output(response.text, universe);
  } catch (error) {
    const message = (error as Error).message ?? 'phase2 failed';
    return {
      ok: false as const,
      issues: [{ code: 'not_json' as const, path: '$', detail: message }],
      feedback: undefined,
    };
  }
}

/** Map a provider error string onto a truthful unavailable reason. */
function classifyProviderError(
  message: string, fallback: IntelUnavailableReason,
): IntelUnavailableReason {
  const text = message.toLowerCase();
  if (text.includes('429') || text.includes('quota') || text.includes('resource_exhausted')) {
    return 'provider_quota';
  }
  if (text.includes('timeout') || text.includes('deadline') || text.includes('abort')) {
    return 'provider_timeout';
  }
  if (text.includes('503') || text.includes('unavailable') || text.includes('overload')) {
    return 'busy';
  }
  return fallback;
}
