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
  /** micro-USD per Place Photo (New) fetch. Every destination card needs a
   *  photo of the REAL resolved place, so this scales with results. */
  placePhotoPerCall: number;
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
  placePhotoPerCall: 7000,
};

export interface CostTally {
  inputTokens: number;
  outputTokens: number;
  groundingQueries: number;
  placesCalls: number;
  matrixElements: number;
  routeCalls: number;
  /** Real-place photo fetches. Absent on runs that render no photo. */
  placePhotos?: number;
}

export function costMicroUsd(tally: CostTally, rates: CostRates = DEFAULT_RATES): number {
  const raw =
    tally.inputTokens * rates.geminiInputPerToken +
    tally.outputTokens * rates.geminiOutputPerToken +
    tally.groundingQueries * rates.groundingPerQuery +
    tally.placesCalls * rates.placesPerCall +
    tally.matrixElements * rates.matrixPerElement +
    tally.routeCalls * rates.routePerCall +
    (tally.placePhotos ?? 0) * rates.placePhotoPerCall;
  return Math.round(raw);
}

/** Human-readable USD for reports/logs. */
export function microUsdToUsd(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(4)}`;
}

/* ── INR reporting ────────────────────────────────────────────────
   The product target is stated in rupees ("≤ ₹5 per fresh property
   generation"), so cost has to be reportable in INR. The FX rate is an
   assumption, not a fact — it is declared here and overridable, and
   every report prints the rate it used rather than burying it. */

/** USD → INR. Override with PROPERTY_INTELLIGENCE_INR_PER_USD. */
export const DEFAULT_INR_PER_USD = 88;

/** The product's per-property budget for a FRESH generation, in rupees. */
export const FRESH_GENERATION_TARGET_INR = 5;

export function microUsdToInr(micro: number, inrPerUsd = DEFAULT_INR_PER_USD): number {
  return (micro / 1_000_000) * inrPerUsd;
}

export function formatInr(rupees: number): string {
  return `₹${rupees.toFixed(2)}`;
}

export interface CostLine {
  component: string;
  units: number;
  microUsd: number;
  inr: number;
  /** Share of the total, 0–1. Identifies what actually dominates. */
  share: number;
}

export interface CostBreakdown {
  lines: readonly CostLine[];
  totalMicroUsd: number;
  totalInr: number;
  inrPerUsd: number;
  targetInr: number;
  withinTarget: boolean;
  /** The single component costing the most — what to optimise first. */
  dominant: CostLine | null;
}

/**
 * Per-component cost for one generation. Nothing here is hardcoded: every
 * number is derived from the tally actually recorded by the pipeline and
 * the configured rates, so a report reflects the real call pattern.
 */
export function costBreakdown(
  tally: CostTally,
  rates: CostRates = DEFAULT_RATES,
  inrPerUsd = DEFAULT_INR_PER_USD,
  targetInr = FRESH_GENERATION_TARGET_INR,
): CostBreakdown {
  const raw: { component: string; units: number; microUsd: number }[] = [
    { component: 'Gemini discovery (input tokens)', units: tally.inputTokens, microUsd: tally.inputTokens * rates.geminiInputPerToken },
    { component: 'Gemini discovery (output tokens)', units: tally.outputTokens, microUsd: tally.outputTokens * rates.geminiOutputPerToken },
    { component: 'Maps grounding queries', units: tally.groundingQueries, microUsd: tally.groundingQueries * rates.groundingPerQuery },
    { component: 'Places verification calls', units: tally.placesCalls, microUsd: tally.placesCalls * rates.placesPerCall },
    { component: 'Route Matrix elements', units: tally.matrixElements, microUsd: tally.matrixElements * rates.matrixPerElement },
    { component: 'Compute Routes calls', units: tally.routeCalls, microUsd: tally.routeCalls * rates.routePerCall },
    { component: 'Place Photos (real place image)', units: tally.placePhotos ?? 0, microUsd: (tally.placePhotos ?? 0) * rates.placePhotoPerCall },
  ];
  const totalMicroUsd = Math.round(raw.reduce((sum, line) => sum + line.microUsd, 0));
  const lines: CostLine[] = raw.map((line) => ({
    component: line.component,
    units: line.units,
    microUsd: Math.round(line.microUsd),
    inr: microUsdToInr(line.microUsd, inrPerUsd),
    share: totalMicroUsd > 0 ? line.microUsd / totalMicroUsd : 0,
  }));
  const spending = lines.filter((line) => line.microUsd > 0);
  const dominant = spending.length
    ? spending.reduce((top, line) => (line.microUsd > top.microUsd ? line : top))
    : null;
  const totalInr = microUsdToInr(totalMicroUsd, inrPerUsd);
  return {
    lines, totalMicroUsd, totalInr, inrPerUsd, targetInr,
    withinTarget: totalInr <= targetInr,
    dominant,
  };
}

/** A plain-text cost report for a development run. */
export function formatCostReport(breakdown: CostBreakdown): string {
  const rows = breakdown.lines
    .filter((line) => line.units > 0)
    .map((line) => `  ${line.component.padEnd(34)} ${String(line.units).padStart(7)} units   ${formatInr(line.inr).padStart(9)}   ${(line.share * 100).toFixed(1).padStart(5)}%`);
  const verdict = breakdown.withinTarget
    ? `WITHIN the ${formatInr(breakdown.targetInr)} target`
    : `OVER the ${formatInr(breakdown.targetInr)} target by ${formatInr(breakdown.totalInr - breakdown.targetInr)} (${(breakdown.totalInr / breakdown.targetInr).toFixed(1)}x)`;
  return [
    ...rows,
    `  ${'TOTAL'.padEnd(34)} ${''.padStart(7)}         ${formatInr(breakdown.totalInr).padStart(9)}`,
    ``,
    `  Assumption: 1 USD = ₹${breakdown.inrPerUsd}. Rates are configurable via PROPERTY_INTELLIGENCE_RATES.`,
    `  Verdict: ${verdict}`,
    breakdown.dominant ? `  Dominant component: ${breakdown.dominant.component} (${(breakdown.dominant.share * 100).toFixed(1)}% of spend)` : '',
  ].filter(Boolean).join('\n');
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
