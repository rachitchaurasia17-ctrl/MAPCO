/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · centralized, versioned pricing
   ---------------------------------------------------------------
   ONE place holds every rate. Nothing in the pipeline may hardcode a
   price; a rate change is configuration, not a code change.

   Two rules this file exists to enforce:

   1. MAPCO never claims an "actual billed cost". Providers report usage
      units (tokens, calls, elements); the money figure here is always an
      ESTIMATE derived from those units and the rate table below, and the
      pricing version used is persisted with every run.

   2. Defaults are deliberately pessimistic. An unmetered call must never
      look free — the same posture the AI router's pricing fallback takes.

   Sources: Google Maps Platform India + global pricing (verified Aug
   2026, carried forward from cost-v2.ts) and Vertex AI Gemini pricing.
   ═══════════════════════════════════════════════════════════════ */

export type PricingRegion = 'india' | 'global';

/** Every billable operation the Property Intelligence pipeline can perform. */
export type CostOperation =
  | 'gemini_input_tokens'
  | 'gemini_output_tokens'
  | 'maps_grounding_query'
  | 'places_identity'
  | 'places_details'
  | 'place_photo'
  | 'routes_compute_route';

export interface Rate {
  operation: CostOperation;
  label: string;
  /** Billing granularity: per 1,000 events, or per 1,000,000 tokens. */
  per: 1_000 | 1_000_000;
  usdPer: number;
  /** Account-wide monthly free allowance, where Google grants one. Used to
   *  report effective average; NEVER used to lower the gross marginal cost. */
  freeCapPerMonth: number;
  note: string;
}

export interface PricingConfig {
  version: string;
  region: PricingRegion;
  inrPerUsd: number;
  rates: Record<CostOperation, Rate>;
}

const GEMINI_RATES: Record<'gemini_input_tokens' | 'gemini_output_tokens' | 'maps_grounding_query', Rate> = {
  gemini_input_tokens: {
    operation: 'gemini_input_tokens',
    label: 'Vertex Gemini 3.6 Flash — input tokens',
    per: 1_000_000,
    usdPer: 0.30,
    freeCapPerMonth: 0,
    note: 'Phase 1 and Phase 2 prompts. Phase 2 input is large (the whole candidate universe).',
  },
  gemini_output_tokens: {
    operation: 'gemini_output_tokens',
    label: 'Vertex Gemini 3.6 Flash — output tokens',
    per: 1_000_000,
    usdPer: 2.50,
    freeCapPerMonth: 0,
    note: 'Thinking tokens are billed as output on Gemini and are included here.',
  },
  maps_grounding_query: {
    operation: 'maps_grounding_query',
    label: 'Google Maps grounding query',
    per: 1_000,
    usdPer: 25.00,
    freeCapPerMonth: 0,
    note: 'Phase 1 only. Phase 2 runs ungrounded, so it never incurs this.',
  },
};

/** India rates apply to billing accounts with an India address and
 *  majority-India usage. */
export const INDIA_PRICING: PricingConfig = {
  version: 'pricing-2026-08-india-v1',
  region: 'india',
  inrPerUsd: 88,
  rates: {
    ...GEMINI_RATES,
    places_identity: {
      operation: 'places_identity',
      label: 'Places Text Search Essentials — identity resolution (places.id only)',
      per: 1_000,
      usdPer: 5.00,
      freeCapPerMonth: 10_000,
      note: 'The request asks for places.id and nothing else, which is the Essentials '
        + 'tier. India-specific Essentials pricing is not verified in-repo, so the '
        + 'GLOBAL Essentials rate is used here as a deliberately conservative '
        + 'stand-in — over-reporting cost is safer than under-reporting it. This is '
        + 'the highest-volume call in the pipeline (one per Phase 1 candidate), so it '
        + 'dominates the per-generation total; verify it first if the rate changes.',
    },
    places_details: {
      operation: 'places_details',
      label: 'Place Details (Essentials)',
      per: 1_000,
      usdPer: 1.50,
      freeCapPerMonth: 70_000,
      note: 'id / location / displayName / photo reference only. Requesting rating or '
        + 'reviews would move this to Enterprise + Atmosphere at $12.00.',
    },
    place_photo: {
      operation: 'place_photo',
      label: 'Place Photos',
      per: 1_000,
      usdPer: 2.10,
      freeCapPerMonth: 7_000,
      note: 'Charged once per place globally. MAPCO persists the photo under written '
        + 'Google approval, so the same place is never re-fetched for another property.',
    },
    routes_compute_route: {
      operation: 'routes_compute_route',
      label: 'Routes Compute Routes (Essentials)',
      per: 1_000,
      usdPer: 1.50,
      freeCapPerMonth: 70_000,
      note: 'Basic routing: distance, duration and polyline. Traffic-aware routing '
        + 'would be Pro and is deliberately not enabled — MAPCO does not need it.',
    },
  },
};

export const GLOBAL_PRICING: PricingConfig = {
  version: 'pricing-2026-08-global-v1',
  region: 'global',
  inrPerUsd: 88,
  rates: {
    ...GEMINI_RATES,
    places_identity: {
      operation: 'places_identity',
      label: 'Places Text Search Essentials — identity resolution (places.id only)',
      per: 1_000, usdPer: 5.00, freeCapPerMonth: 10_000,
      note: 'Essentials tier: ids only. Pro ($32.00) would apply if any further field '
        + 'were added to the mask.',
    },
    places_details: {
      operation: 'places_details',
      label: 'Place Details (Essentials)',
      per: 1_000, usdPer: 5.00, freeCapPerMonth: 10_000,
      note: 'id / location / displayName / photo reference only.',
    },
    place_photo: {
      operation: 'place_photo',
      label: 'Place Photos',
      per: 1_000, usdPer: 7.00, freeCapPerMonth: 1_000,
      note: 'Enterprise-only SKU. Charged once per place globally.',
    },
    routes_compute_route: {
      operation: 'routes_compute_route',
      label: 'Routes Compute Routes (Essentials)',
      per: 1_000, usdPer: 5.00, freeCapPerMonth: 10_000,
      note: 'Basic routing: distance, duration and polyline.',
    },
  },
};

export const DEFAULT_PRICING = INDIA_PRICING;

/** Micro-USD (1e-6 USD) for a number of billable units, matching the AI
 *  foundation's ai_executions.cost_micro_usd convention. */
export function microUsdFor(config: PricingConfig, operation: CostOperation, units: number): number {
  const rate = config.rates[operation];
  if (!rate || !Number.isFinite(units) || units <= 0) return 0;
  return Math.round((units / rate.per) * rate.usdPer * 1_000_000);
}

export function microUsdToInr(microUsd: number, inrPerUsd: number): number {
  return (microUsd / 1_000_000) * inrPerUsd;
}

export function formatInr(rupees: number): string {
  return `₹${rupees.toFixed(2)}`;
}

/**
 * Parse a pricing override supplied by the server environment, e.g.
 * PROPERTY_INTELLIGENCE_PRICING='{"inrPerUsd":90,"rates":{"place_photo":{"usdPer":3}}}'.
 * Unknown keys are ignored; anything malformed falls back to the default so a
 * bad env var can never make the pipeline behave as if calls were free.
 */
export function parsePricingOverride(
  raw: string | undefined | null,
  base: PricingConfig = DEFAULT_PRICING,
): PricingConfig {
  if (!raw) return base;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return base;
  }
  const next: PricingConfig = {
    ...base,
    rates: { ...base.rates },
    version: typeof parsed.version === 'string' ? parsed.version : `${base.version}+override`,
  };
  if (typeof parsed.region === 'string' && (parsed.region === 'india' || parsed.region === 'global')) {
    const table = parsed.region === 'india' ? INDIA_PRICING : GLOBAL_PRICING;
    next.region = table.region;
    next.rates = { ...table.rates };
    next.inrPerUsd = table.inrPerUsd;
  }
  if (typeof parsed.inrPerUsd === 'number' && parsed.inrPerUsd > 0) {
    next.inrPerUsd = parsed.inrPerUsd;
  }
  const rates = parsed.rates;
  if (rates && typeof rates === 'object') {
    for (const [key, value] of Object.entries(rates as Record<string, unknown>)) {
      const operation = key as CostOperation;
      if (!next.rates[operation] || !value || typeof value !== 'object') continue;
      const patch = value as Record<string, unknown>;
      const usdPer = patch.usdPer;
      const freeCap = patch.freeCapPerMonth;
      next.rates[operation] = {
        ...next.rates[operation],
        ...(typeof usdPer === 'number' && usdPer >= 0 ? { usdPer } : {}),
        ...(typeof freeCap === 'number' && freeCap >= 0 ? { freeCapPerMonth: freeCap } : {}),
      };
    }
  }
  return next;
}
