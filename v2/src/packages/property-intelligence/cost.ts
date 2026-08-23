/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · cost model
   ---------------------------------------------------------------
   Cost is tracked in integer micro-USD (1e-6 USD), matching the AI
   foundation's ai_executions.cost_micro_usd convention. Rates are
   overridable so a price change is config, not code. Defaults are
   deliberately slightly pessimistic — an unmetered call must never
   look free (same posture as the AI router's pricing fallback).
   ═══════════════════════════════════════════════════════════════ */

export interface CostRates {
  /** micro-USD per input token (Gemini). */
  geminiInputPerToken: number;
  /** micro-USD per output token (Gemini, incl. thinking). */
  geminiOutputPerToken: number;
  /** micro-USD per Google Maps grounding query. */
  groundingPerQuery: number;
  /** micro-USD per Places Text Search (New) call. */
  placesPerCall: number;
  /** micro-USD per Route Matrix element (origin×destination pair). */
  matrixPerElement: number;
  /** micro-USD per computeRoutes (detailed polyline) call. */
  routePerCall: number;
}

/** Defaults (2026, USD → micro-USD):
 *  - gemini-3.6-flash ≈ $0.30 / 1M input, $2.50 / 1M output  → 0.30, 2.50 µUSD/tok
 *  - Google Maps Grounding ≈ $25 / 1k queries                → 25000 µUSD/query
 *  - Places Text Search (New) ≈ $32 / 1k calls               → 32000 µUSD/call
 *  - Route Matrix ≈ $5 / 1k elements                         → 5000  µUSD/element
 *  - Compute Routes ≈ $5 / 1k calls                          → 5000  µUSD/call
 *  All overridable via PROPERTY_INTELLIGENCE_RATES env JSON on the server. */
export const DEFAULT_RATES: CostRates = {
  geminiInputPerToken: 0.30,
  geminiOutputPerToken: 2.50,
  groundingPerQuery: 25000,
  placesPerCall: 32000,
  matrixPerElement: 5000,
  routePerCall: 5000,
};

export interface CostTally {
  inputTokens: number;
  outputTokens: number;
  groundingQueries: number;
  placesCalls: number;
  matrixElements: number;
  routeCalls: number;
}

export function costMicroUsd(tally: CostTally, rates: CostRates = DEFAULT_RATES): number {
  const raw =
    tally.inputTokens * rates.geminiInputPerToken +
    tally.outputTokens * rates.geminiOutputPerToken +
    tally.groundingQueries * rates.groundingPerQuery +
    tally.placesCalls * rates.placesPerCall +
    tally.matrixElements * rates.matrixPerElement +
    tally.routeCalls * rates.routePerCall;
  return Math.round(raw);
}

/** Human-readable USD for reports/logs. */
export function microUsdToUsd(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(4)}`;
}

export function parseRatesOverride(json: string | undefined | null): CostRates {
  if (!json) return DEFAULT_RATES;
  try {
    const parsed = JSON.parse(json) as Partial<CostRates>;
    return { ...DEFAULT_RATES, ...parsed };
  } catch {
    return DEFAULT_RATES;
  }
}
