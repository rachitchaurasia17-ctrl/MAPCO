import { describe, expect, it } from 'vitest';
import {
  grossCost, effectiveCost, formatGrossReport,
  CACHED_REOPEN_REQUESTS, INDIA_SKUS, GLOBAL_SKUS,
  GROSS_TARGET_INR, DEFAULT_INR_PER_USD,
  type GenerationRequests,
} from '../src/packages/property-intelligence/cost-v2';

/** The configuration actually implemented: curated City Reach + batched Day to Day. */
const IMPLEMENTED: GenerationRequests = {
  geminiInputTokens: 1300, geminiOutputTokens: 600,
  nearbySearchCalls: 1, textSearchCalls: 0, placeDetailsCalls: 0,
  placePhotoCalls: 6, routeMatrixElements: 11,
};
const SCENARIO_B: GenerationRequests = { ...IMPLEMENTED, nearbySearchCalls: 2, routeMatrixElements: 12 };
const SCENARIO_C: GenerationRequests = {
  geminiInputTokens: 1500, geminiOutputTokens: 750,
  nearbySearchCalls: 2, textSearchCalls: 0, placeDetailsCalls: 0,
  placePhotoCalls: 8, routeMatrixElements: 14,
};

describe('curated City Reach removes its own cost', () => {
  it('charges nothing for City Reach discovery or photos', () => {
    const cost = grossCost(IMPLEMENTED, 'india');
    const cityReach = cost.lines.filter((l) => l.component.startsWith('City Reach'));
    expect(cityReach).toHaveLength(2);
    for (const line of cityReach) {
      expect(line.usd).toBe(0);
      expect(line.inr).toBe(0);
      expect(line.units).toBe(0);
    }
  });

  it('buys photos only for Day to Day', () => {
    // Six Day-to-Day results, six photos. City Reach adds none.
    const photos = grossCost(IMPLEMENTED, 'india').lines
      .find((l) => l.component === INDIA_SKUS.placePhotos.label);
    expect(photos?.units).toBe(6);
  });
});

describe('gross marginal cost against the ₹5 target', () => {
  it('meets the target for the implemented configuration', () => {
    const cost = grossCost(IMPLEMENTED, 'india');
    expect(cost.withinTarget).toBe(true);
    expect(cost.totalInr).toBeLessThanOrEqual(GROSS_TARGET_INR);
    expect(cost.totalInr).toBeGreaterThan(3);
  });

  it('meets the target at six City Reach anchors and two Nearby searches', () => {
    expect(grossCost(SCENARIO_B, 'india').withinTarget).toBe(true);
  });

  it('reports scenario C as over target rather than rounding it in', () => {
    const cost = grossCost(SCENARIO_C, 'india');
    expect(cost.withinTarget).toBe(false);
    expect(cost.totalInr).toBeGreaterThan(GROSS_TARGET_INR);
  });

  it('every line sums to the total', () => {
    const cost = grossCost(IMPLEMENTED, 'india');
    const summed = cost.lines.reduce((t, l) => t + l.usd, 0);
    expect(summed).toBeCloseTo(cost.totalUsd, 10);
    expect(cost.lines.reduce((t, l) => t + l.share, 0)).toBeCloseTo(1, 6);
  });

  it('names the dominant SKU', () => {
    expect(grossCost(IMPLEMENTED, 'india').dominant).not.toBeNull();
  });
});

describe('India vs global pricing', () => {
  it('prices India materially below global for the same requests', () => {
    const india = grossCost(IMPLEMENTED, 'india').totalInr;
    const global = grossCost(IMPLEMENTED, 'global').totalInr;
    expect(india).toBeLessThan(global);
    expect(global / india).toBeGreaterThan(2);
  });

  it('fails the target on global pricing — the win is India-specific', () => {
    expect(grossCost(IMPLEMENTED, 'global').withinTarget).toBe(false);
  });

  it('documents which field mask drives each SKU tier', () => {
    for (const sku of Object.values(INDIA_SKUS)) {
      expect(sku.note.length).toBeGreaterThan(10);
      expect(sku.freeCapPerMonth).toBeGreaterThan(0);
    }
    // Nearby Search costs 9.60 in India vs 32.00 globally.
    expect(INDIA_SKUS.nearbySearchPro.usdPerThousand).toBeLessThan(GLOBAL_SKUS.nearbySearchPro.usdPerThousand);
  });
});

describe('effective average cost with free allowances', () => {
  it('is never presented as the gross marginal cost', () => {
    const gross = grossCost(IMPLEMENTED, 'india').totalInr;
    for (const volume of [100, 500, 1000, 3000, 5000, 10_000]) {
      expect(effectiveCost(IMPLEMENTED, volume, 'india').perPropertyInr).toBeLessThan(gross);
    }
  });

  it('rises as free caps are consumed', () => {
    const at100 = effectiveCost(IMPLEMENTED, 100, 'india').perPropertyInr;
    const at10k = effectiveCost(IMPLEMENTED, 10_000, 'india').perPropertyInr;
    expect(at10k).toBeGreaterThan(at100);
  });

  it('is fully inside the free tier at launch volumes', () => {
    const launch = effectiveCost(IMPLEMENTED, 500, 'india');
    // Only Gemini is billed at this volume; every Google SKU is still free.
    expect(launch.fullyFreeSkus.length).toBeGreaterThanOrEqual(3);
    expect(launch.perPropertyInr).toBeLessThan(0.5);
  });

  it('never converges to zero — Gemini has no free tier here', () => {
    expect(effectiveCost(IMPLEMENTED, 100, 'india').perPropertyInr).toBeGreaterThan(0);
  });
});

describe('cached reopen', () => {
  it('issues no request and costs nothing', () => {
    const cost = grossCost(CACHED_REOPEN_REQUESTS, 'india');
    expect(cost.totalInr).toBe(0);
    expect(cost.dominant).toBeNull();
    for (const line of cost.lines) expect(line.units).toBe(0);
  });

  it('costs nothing at any monthly volume', () => {
    expect(effectiveCost(CACHED_REOPEN_REQUESTS, 10_000, 'india').monthlyInr).toBe(0);
  });
});

describe('cost report', () => {
  it('states its pricing region, FX assumption and verdict', () => {
    const report = formatGrossReport(grossCost(IMPLEMENTED, 'india'));
    expect(report).toContain('Pricing: INDIA');
    expect(report).toContain(`1 USD = ₹${DEFAULT_INR_PER_USD}`);
    expect(report).toContain('WITHIN the ₹5.00 gross target');
    expect(report).toContain('City Reach discovery (MAPCO curated)');
  });
});
