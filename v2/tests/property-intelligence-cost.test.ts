import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RATES, DEFAULT_INR_PER_USD, FRESH_GENERATION_TARGET_INR,
  costBreakdown, costMicroUsd, microUsdToInr, formatCostReport,
  type CostTally,
} from '../src/packages/property-intelligence/cost';

/**
 * The call pattern the pipeline actually produces today for a fresh
 * generation: ONE Gemini discovery, one Places Text Search per proposed
 * destination, and ONE Route Matrix covering all of them.
 */
const CURRENT_SHAPE: CostTally = {
  inputTokens: 1500,
  outputTokens: 800,
  groundingQueries: 1,
  placesCalls: 12,
  matrixElements: 12,
  routeCalls: 0,
};

describe('property intelligence cost model', () => {
  it('reports cost in rupees against the stated product target', () => {
    const breakdown = costBreakdown(CURRENT_SHAPE);
    expect(breakdown.totalMicroUsd).toBe(costMicroUsd(CURRENT_SHAPE));
    expect(breakdown.totalInr).toBeCloseTo(microUsdToInr(breakdown.totalMicroUsd), 6);
    expect(breakdown.targetInr).toBe(FRESH_GENERATION_TARGET_INR);
    expect(breakdown.inrPerUsd).toBe(DEFAULT_INR_PER_USD);
  });

  it('every line sums to the total, so no spend is unaccounted for', () => {
    const breakdown = costBreakdown(CURRENT_SHAPE);
    const summed = breakdown.lines.reduce((total, line) => total + line.microUsd, 0);
    expect(Math.abs(summed - breakdown.totalMicroUsd)).toBeLessThanOrEqual(3);
    const shares = breakdown.lines.reduce((total, line) => total + line.share, 0);
    expect(shares).toBeCloseTo(1, 5);
  });

  it('identifies Places verification as the component that dominates today', () => {
    const breakdown = costBreakdown(CURRENT_SHAPE);
    expect(breakdown.dominant?.component).toBe('Places verification calls');
    expect(breakdown.dominant!.share).toBeGreaterThan(0.5);
  });

  it('reports the current pipeline as OVER the ₹5 target rather than claiming success', () => {
    const breakdown = costBreakdown(CURRENT_SHAPE);
    expect(breakdown.withinTarget).toBe(false);
    expect(breakdown.totalInr).toBeGreaterThan(FRESH_GENERATION_TARGET_INR);
  });

  it('a cached reopen costs nothing — no AI, no Places, no Routes', () => {
    const cached: CostTally = {
      inputTokens: 0, outputTokens: 0, groundingQueries: 0,
      placesCalls: 0, matrixElements: 0, routeCalls: 0,
    };
    const breakdown = costBreakdown(cached);
    expect(breakdown.totalMicroUsd).toBe(0);
    expect(breakdown.totalInr).toBe(0);
    expect(breakdown.withinTarget).toBe(true);
    expect(breakdown.dominant).toBeNull();
  });

  it('honours a configured FX rate instead of hardcoding one', () => {
    const at88 = costBreakdown(CURRENT_SHAPE, DEFAULT_RATES, 88);
    const at100 = costBreakdown(CURRENT_SHAPE, DEFAULT_RATES, 100);
    expect(at100.totalInr / at88.totalInr).toBeCloseTo(100 / 88, 6);
  });

  it('reacts to a rate change as configuration, not code', () => {
    const cheaperPlaces = costBreakdown(CURRENT_SHAPE, { ...DEFAULT_RATES, placesPerCall: 0 });
    expect(cheaperPlaces.totalInr).toBeLessThan(costBreakdown(CURRENT_SHAPE).totalInr);
    expect(cheaperPlaces.dominant?.component).not.toBe('Places verification calls');
  });

  it('prices the real-place photo the spec requires on every card', () => {
    const withPhotos = costBreakdown({ ...CURRENT_SHAPE, placePhotos: 12 });
    const without = costBreakdown(CURRENT_SHAPE);
    expect(withPhotos.totalInr).toBeGreaterThan(without.totalInr);
    const line = withPhotos.lines.find((l) => l.component.startsWith('Place Photos'));
    expect(line?.units).toBe(12);
    expect(line!.inr).toBeGreaterThan(0);
  });

  it('shows batching verification is the biggest available saving', () => {
    // 12 individual Text Search calls vs 3 batched Nearby Search calls.
    const perPlace = costBreakdown(CURRENT_SHAPE);
    const batched = costBreakdown(
      { ...CURRENT_SHAPE, groundingQueries: 0, placesCalls: 3 },
      { ...DEFAULT_RATES, placesPerCall: 35_000 },
    );
    expect(batched.totalInr).toBeLessThan(perPlace.totalInr / 2);
    // Even batched, it is still over target — the model must not pretend otherwise.
    expect(batched.withinTarget).toBe(false);
  });

  it('prints a report that states its assumption and its verdict', () => {
    const report = formatCostReport(costBreakdown(CURRENT_SHAPE));
    expect(report).toContain('1 USD = ₹88');
    expect(report).toContain('Dominant component');
    expect(report).toMatch(/OVER the ₹5\.00 target/);
  });
});
