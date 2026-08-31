/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · cost ledger
   ---------------------------------------------------------------
   Every variable-cost operation in the pipeline is recorded here as it
   happens — including the ones that were AVOIDED by a cache, so the
   saving is measurable rather than invisible.

   The ledger is also the spend guard. `wouldExceed()` is consulted
   BEFORE an expensive stage, so the pipeline degrades honestly (fewer
   enriched places, a truthful cost_cap_reached state) instead of
   silently spending past the configured ceiling.

   A failed paid request is still recorded: the provider billed for the
   attempt, and an operation MAPCO cannot see is an operation MAPCO
   cannot control.
   ═══════════════════════════════════════════════════════════════ */
import type { CostEvent } from '../types.ts';
import {
  DEFAULT_PRICING, microUsdFor, microUsdToInr,
  type CostOperation, type PricingConfig,
} from './pricing.ts';

const PROVIDER_OF: Record<CostOperation, CostEvent['provider']> = {
  gemini_input_tokens: 'google_vertex_gemini',
  gemini_output_tokens: 'google_vertex_gemini',
  maps_grounding_query: 'google_maps_grounding',
  places_identity: 'google_places',
  places_details: 'google_places',
  place_photo: 'google_places',
  routes_compute_route: 'google_routes',
};

export interface RecordOptions {
  /** Number of provider requests this event represents (default = units). */
  requests?: number;
  /** True when MAPCO reused stored state instead of paying. Cost is 0. */
  cacheHit?: boolean;
  detail?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export class CostLedger {
  readonly pricing: PricingConfig;
  private readonly entries: CostEvent[] = [];

  constructor(pricing: PricingConfig = DEFAULT_PRICING) {
    this.pricing = pricing;
  }

  /**
   * Record one billable (or cache-avoided) operation.
   * `units` is the raw provider unit: calls, elements, photos or tokens.
   */
  record(operation: CostOperation, units: number, opts: RecordOptions = {}): CostEvent {
    const cacheHit = opts.cacheHit === true;
    const marginalMicroUsd = microUsdFor(this.pricing, operation, units);
    const microUsd = cacheHit ? 0 : marginalMicroUsd;
    const avoidedMicroUsd = cacheHit ? marginalMicroUsd : 0;
    const event: CostEvent = {
      provider: PROVIDER_OF[operation],
      operation,
      requests: opts.requests ?? (cacheHit ? 0 : units),
      units,
      cacheHit,
      estimatedMicroUsd: microUsd,
      estimatedInr: microUsdToInr(microUsd, this.pricing.inrPerUsd),
      avoidedMicroUsd,
      avoidedInr: microUsdToInr(avoidedMicroUsd, this.pricing.inrPerUsd),
      ...(opts.inputTokens !== undefined ? { inputTokens: opts.inputTokens } : {}),
      ...(opts.outputTokens !== undefined ? { outputTokens: opts.outputTokens } : {}),
      ...(opts.detail ? { detail: opts.detail } : {}),
    };
    this.entries.push(event);
    return event;
  }

  /** Record a Gemini turn: input tokens, output tokens and any grounding. */
  recordModelTurn(
    label: string,
    usage: { inputTokens: number; outputTokens: number; groundingQueries: number },
  ): void {
    if (usage.inputTokens > 0) {
      this.record('gemini_input_tokens', usage.inputTokens, {
        requests: 1, detail: label, inputTokens: usage.inputTokens,
      });
    }
    if (usage.outputTokens > 0) {
      this.record('gemini_output_tokens', usage.outputTokens, {
        requests: 0, detail: label, outputTokens: usage.outputTokens,
      });
    }
    if (usage.groundingQueries > 0) {
      this.record('maps_grounding_query', usage.groundingQueries, { detail: label });
    }
  }

  get events(): readonly CostEvent[] {
    return this.entries;
  }

  totalMicroUsd(): number {
    return this.entries.reduce((sum, e) => sum + e.estimatedMicroUsd, 0);
  }

  totalInr(): number {
    return microUsdToInr(this.totalMicroUsd(), this.pricing.inrPerUsd);
  }

  /** What caching saved this run, in rupees — the number that justifies
   *  the global place registry and the route cache. */
  savedInr(): number {
    return this.entries.reduce((sum, event) => sum + event.avoidedInr, 0);
  }

  /** Would performing `units` more of `operation` push past the ceiling? */
  wouldExceed(capInr: number, operation: CostOperation, units: number): boolean {
    if (!Number.isFinite(capInr) || capInr <= 0) return false;
    const projected = this.totalMicroUsd() + microUsdFor(this.pricing, operation, units);
    return microUsdToInr(projected, this.pricing.inrPerUsd) > capInr;
  }

  /** How many more of `operation` fit under the ceiling. */
  remainingUnits(capInr: number, operation: CostOperation): number {
    if (!Number.isFinite(capInr) || capInr <= 0) return Number.POSITIVE_INFINITY;
    const rate = this.pricing.rates[operation];
    if (!rate || rate.usdPer <= 0) return Number.POSITIVE_INFINITY;
    const remainingInr = capInr - this.totalInr();
    if (remainingInr <= 0) return 0;
    const remainingUsd = remainingInr / this.pricing.inrPerUsd;
    return Math.max(0, Math.floor((remainingUsd / rate.usdPer) * rate.per));
  }

  /** Per-operation rollup for the run record and the ops console. */
  breakdown(): Array<{
    operation: string; label: string; requests: number; units: number;
    cacheHits: number; microUsd: number; inr: number; share: number;
  }> {
    const total = this.totalMicroUsd() || 1;
    const byOperation = new Map<string, {
      requests: number; units: number; cacheHits: number; microUsd: number;
    }>();
    for (const e of this.entries) {
      const row = byOperation.get(e.operation)
        ?? { requests: 0, units: 0, cacheHits: 0, microUsd: 0 };
      row.requests += e.requests;
      row.units += e.units;
      row.cacheHits += e.cacheHit ? 1 : 0;
      row.microUsd += e.estimatedMicroUsd;
      byOperation.set(e.operation, row);
    }
    return [...byOperation.entries()]
      .map(([operation, row]) => ({
        operation,
        label: this.pricing.rates[operation as CostOperation]?.label ?? operation,
        requests: row.requests,
        units: row.units,
        cacheHits: row.cacheHits,
        microUsd: row.microUsd,
        inr: microUsdToInr(row.microUsd, this.pricing.inrPerUsd),
        share: row.microUsd / total,
      }))
      .sort((a, b) => b.microUsd - a.microUsd);
  }
}
