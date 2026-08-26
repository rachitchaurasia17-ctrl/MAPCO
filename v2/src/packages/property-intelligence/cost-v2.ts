/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence cost model (curated City Reach)
   ---------------------------------------------------------------
   Replaces the assumptions behind the old ₹41–49 figure, which priced
   an architecture we no longer build:

     • City Reach is now MAPCO's curated landmark library — no Places
       discovery, no Place Photos. It costs ₹0 to find and ₹0 to
       illustrate. Only travel time is bought.
     • Day to Day no longer issues one Text Search per destination; it
       issues a very small number of Nearby Search requests.
     • Pricing is India-eligible, verified against Google's India
       pricing page, with global as a fallback.

   Every rate is declared, sourced and overridable. Two numbers are
   always reported and never conflated:

     GROSS MARGINAL — the cost of one more property once the monthly
       free allowances are gone. This is the number the ₹5 target is
       judged against.
     EFFECTIVE AVERAGE — total monthly spend ÷ properties, WITH the
       free caps applied. Lower, real, and not a substitute for gross.
   ═══════════════════════════════════════════════════════════════ */

export type PricingRegion = 'india' | 'global';

/**
 * One billable Google SKU. `freeCapPerMonth` is the account-wide monthly
 * allowance for that SKU — it makes the effective average lower than the
 * gross marginal, and must never be used to claim a lower gross.
 */
export interface Sku {
  key: string;
  label: string;
  /** USD per 1,000 billable events. */
  usdPerThousand: number;
  freeCapPerMonth: number;
  /** Why this SKU and not a neighbouring tier — usually the field mask. */
  note: string;
}

/**
 * Verified against Google Maps Platform India pricing (August 2026).
 * India rates apply to billing accounts with an India address and
 * majority-India usage.
 */
export const INDIA_SKUS = {
  nearbySearchPro: {
    key: 'nearbySearchPro',
    label: 'Places Nearby Search (Pro)',
    usdPerThousand: 9.60,
    freeCapPerMonth: 35_000,
    note: 'Pro tier is triggered by requesting places.location / places.displayName. '
      + 'Essentials is the same India rate, so the richer mask costs nothing extra here.',
  },
  textSearchPro: {
    key: 'textSearchPro',
    label: 'Places Text Search (Pro)',
    usdPerThousand: 9.60,
    freeCapPerMonth: 35_000,
    note: 'Only used when a named place cannot be found by Nearby Search.',
  },
  placeDetailsEssentials: {
    key: 'placeDetailsEssentials',
    label: 'Place Details (Essentials)',
    usdPerThousand: 1.50,
    freeCapPerMonth: 70_000,
    note: 'id / location / photo references only. Requesting rating or reviews '
      + 'would move this to Enterprise + Atmosphere at $12.00.',
  },
  placePhotos: {
    key: 'placePhotos',
    label: 'Place Photos',
    usdPerThousand: 2.10,
    freeCapPerMonth: 7_000,
    note: 'Enterprise-only SKU. Day to Day only — City Reach uses MAPCO photos.',
  },
  routeMatrixEssentials: {
    key: 'routeMatrixEssentials',
    label: 'Routes Compute Route Matrix (Essentials)',
    usdPerThousand: 1.50,
    freeCapPerMonth: 70_000,
    note: 'Basic matrix: duration + distance. Traffic-aware routing would be '
      + 'Pro at $3.00 per 1,000 elements.',
  },
} as const satisfies Record<string, Sku>;

/** Global list pricing, used when India eligibility does not apply. */
export const GLOBAL_SKUS = {
  nearbySearchPro: {
    key: 'nearbySearchPro', label: 'Places Nearby Search (Pro)',
    usdPerThousand: 32.00, freeCapPerMonth: 5_000,
    note: 'Pro tier via places.location / places.displayName field mask.',
  },
  textSearchPro: {
    key: 'textSearchPro', label: 'Places Text Search (Pro)',
    usdPerThousand: 32.00, freeCapPerMonth: 5_000,
    note: 'Text Search Essentials is $5.00 but returns ids only.',
  },
  placeDetailsEssentials: {
    key: 'placeDetailsEssentials', label: 'Place Details (Essentials)',
    usdPerThousand: 5.00, freeCapPerMonth: 10_000,
    note: 'id / location / photo references only.',
  },
  placePhotos: {
    key: 'placePhotos', label: 'Place Photos',
    usdPerThousand: 7.00, freeCapPerMonth: 1_000,
    note: 'Enterprise-only SKU.',
  },
  routeMatrixEssentials: {
    key: 'routeMatrixEssentials', label: 'Routes Compute Route Matrix (Essentials)',
    usdPerThousand: 5.00, freeCapPerMonth: 10_000,
    note: 'Basic matrix: duration + distance.',
  },
} as const satisfies Record<string, Sku>;

export type SkuKey = keyof typeof INDIA_SKUS;

export function skuTable(region: PricingRegion): Record<SkuKey, Sku> {
  return region === 'india' ? INDIA_SKUS : GLOBAL_SKUS;
}

/** Gemini is priced per token, not per SKU. */
export interface GeminiRates {
  usdPerMillionInput: number;
  usdPerMillionOutput: number;
}
export const DEFAULT_GEMINI_RATES: GeminiRates = {
  usdPerMillionInput: 0.30,
  usdPerMillionOutput: 2.50,
};

export const DEFAULT_INR_PER_USD = 88;
export const GROSS_TARGET_INR = 5;

/** The billable events one FRESH generation actually produces. */
export interface GenerationRequests {
  geminiInputTokens: number;
  geminiOutputTokens: number;
  /** Day to Day discovery. */
  nearbySearchCalls: number;
  /** Day to Day fallback for a named place Nearby Search missed. */
  textSearchCalls: number;
  placeDetailsCalls: number;
  /** Day to Day only. City Reach photos are MAPCO's own — always 0 here. */
  placePhotoCalls: number;
  /** Day to Day destinations + City Reach finalists, in ONE matrix. */
  routeMatrixElements: number;
}

export interface CostLine {
  component: string;
  units: number;
  usd: number;
  inr: number;
  share: number;
  note?: string;
}

export interface GrossCost {
  region: PricingRegion;
  inrPerUsd: number;
  lines: readonly CostLine[];
  totalUsd: number;
  totalInr: number;
  targetInr: number;
  withinTarget: boolean;
  dominant: CostLine | null;
}

/**
 * GROSS MARGINAL cost of one additional fresh generation, with free
 * allowances assumed exhausted. This is what the ₹5 target measures.
 */
export function grossCost(
  requests: GenerationRequests,
  region: PricingRegion = 'india',
  inrPerUsd = DEFAULT_INR_PER_USD,
  gemini: GeminiRates = DEFAULT_GEMINI_RATES,
  targetInr = GROSS_TARGET_INR,
): GrossCost {
  const skus = skuTable(region);
  const per = (sku: Sku, units: number) => (units * sku.usdPerThousand) / 1000;

  const raw = [
    {
      component: 'Gemini discovery',
      units: requests.geminiInputTokens + requests.geminiOutputTokens,
      usd: (requests.geminiInputTokens * gemini.usdPerMillionInput
        + requests.geminiOutputTokens * gemini.usdPerMillionOutput) / 1_000_000,
      note: 'One structured discovery call for Day to Day categories.',
    },
    { component: skus.nearbySearchPro.label, units: requests.nearbySearchCalls, usd: per(skus.nearbySearchPro, requests.nearbySearchCalls), note: skus.nearbySearchPro.note },
    { component: skus.textSearchPro.label, units: requests.textSearchCalls, usd: per(skus.textSearchPro, requests.textSearchCalls), note: skus.textSearchPro.note },
    { component: skus.placeDetailsEssentials.label, units: requests.placeDetailsCalls, usd: per(skus.placeDetailsEssentials, requests.placeDetailsCalls), note: skus.placeDetailsEssentials.note },
    { component: skus.placePhotos.label, units: requests.placePhotoCalls, usd: per(skus.placePhotos, requests.placePhotoCalls), note: skus.placePhotos.note },
    { component: skus.routeMatrixEssentials.label, units: requests.routeMatrixElements, usd: per(skus.routeMatrixEssentials, requests.routeMatrixElements), note: skus.routeMatrixEssentials.note },
    { component: 'City Reach discovery (MAPCO curated)', units: 0, usd: 0, note: 'Our own landmark library — no Places request.' },
    { component: 'City Reach photos (MAPCO owned)', units: 0, usd: 0, note: 'Our own image assets — no Place Photo request.' },
  ];

  const totalUsd = raw.reduce((sum, l) => sum + l.usd, 0);
  const lines: CostLine[] = raw.map((l) => ({
    component: l.component,
    units: l.units,
    usd: l.usd,
    inr: l.usd * inrPerUsd,
    share: totalUsd > 0 ? l.usd / totalUsd : 0,
    ...(l.note ? { note: l.note } : {}),
  }));
  const spending = lines.filter((l) => l.usd > 0);
  const dominant = spending.length
    ? spending.reduce((top, l) => (l.usd > top.usd ? l : top))
    : null;
  const totalInr = totalUsd * inrPerUsd;

  return {
    region, inrPerUsd, lines, totalUsd, totalInr, targetInr,
    withinTarget: totalInr <= targetInr,
    dominant,
  };
}

export interface EffectiveCost {
  propertiesPerMonth: number;
  /** Monthly spend after each SKU's free cap is consumed. */
  monthlyInr: number;
  /** monthlyInr ÷ propertiesPerMonth. */
  perPropertyInr: number;
  /** SKUs still fully inside their free allowance at this volume. */
  fullyFreeSkus: readonly string[];
}

/**
 * EFFECTIVE AVERAGE cost with India monthly free allowances applied
 * across the billing account. Reported alongside gross, never instead
 * of it — a free cap is a launch subsidy, not a lower unit cost.
 */
export function effectiveCost(
  requests: GenerationRequests,
  propertiesPerMonth: number,
  region: PricingRegion = 'india',
  inrPerUsd = DEFAULT_INR_PER_USD,
  gemini: GeminiRates = DEFAULT_GEMINI_RATES,
): EffectiveCost {
  const skus = skuTable(region);
  const usage: [Sku, number][] = [
    [skus.nearbySearchPro, requests.nearbySearchCalls],
    [skus.textSearchPro, requests.textSearchCalls],
    [skus.placeDetailsEssentials, requests.placeDetailsCalls],
    [skus.placePhotos, requests.placePhotoCalls],
    [skus.routeMatrixEssentials, requests.routeMatrixElements],
  ];

  let monthlyUsd = 0;
  const fullyFreeSkus: string[] = [];
  for (const [sku, perProperty] of usage) {
    const monthlyEvents = perProperty * propertiesPerMonth;
    if (monthlyEvents === 0) continue;
    const billable = Math.max(0, monthlyEvents - sku.freeCapPerMonth);
    if (billable === 0) fullyFreeSkus.push(sku.label);
    monthlyUsd += (billable * sku.usdPerThousand) / 1000;
  }
  // Gemini has no free tier in this model — always billed.
  monthlyUsd += propertiesPerMonth
    * (requests.geminiInputTokens * gemini.usdPerMillionInput
      + requests.geminiOutputTokens * gemini.usdPerMillionOutput) / 1_000_000;

  const monthlyInr = monthlyUsd * inrPerUsd;
  return {
    propertiesPerMonth,
    monthlyInr,
    perPropertyInr: propertiesPerMonth > 0 ? monthlyInr / propertiesPerMonth : 0,
    fullyFreeSkus,
  };
}

/** A reopen served from cache issues no request at all. */
export const CACHED_REOPEN_REQUESTS: GenerationRequests = {
  geminiInputTokens: 0, geminiOutputTokens: 0,
  nearbySearchCalls: 0, textSearchCalls: 0, placeDetailsCalls: 0,
  placePhotoCalls: 0, routeMatrixElements: 0,
};

export const formatInr = (rupees: number): string => `₹${rupees.toFixed(2)}`;

export function formatGrossReport(cost: GrossCost): string {
  const rows = cost.lines
    .filter((l) => l.units > 0 || l.usd > 0)
    .map((l) => `  ${l.component.padEnd(44)} ${String(l.units).padStart(6)}  ${formatInr(l.inr).padStart(8)}  ${(l.share * 100).toFixed(1).padStart(5)}%`);
  const free = cost.lines
    .filter((l) => l.units === 0 && l.usd === 0 && l.component.startsWith('City Reach'))
    .map((l) => `  ${l.component.padEnd(44)} ${'—'.padStart(6)}  ${formatInr(0).padStart(8)}`);
  return [
    ...rows, ...free,
    `  ${'TOTAL (gross marginal)'.padEnd(44)} ${''.padStart(6)}  ${formatInr(cost.totalInr).padStart(8)}`,
    '',
    `  Pricing: ${cost.region.toUpperCase()} · 1 USD = ₹${cost.inrPerUsd}`,
    `  Verdict: ${cost.withinTarget
      ? `WITHIN the ${formatInr(cost.targetInr)} gross target`
      : `OVER the ${formatInr(cost.targetInr)} gross target by ${formatInr(cost.totalInr - cost.targetInr)}`}`,
    cost.dominant ? `  Dominant SKU: ${cost.dominant.component} (${(cost.dominant.share * 100).toFixed(1)}%)` : '',
  ].filter(Boolean).join('\n');
}
