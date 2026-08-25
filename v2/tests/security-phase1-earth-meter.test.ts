// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'mapco.earth.apiMeter.v1';

describe('Earth usage meter identity boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as unknown as Record<string, unknown>).__mapcoUsage;
    vi.resetModules();
  });

  it('does not eagerly hydrate private events and drops in-memory state on rehydrate', async () => {
    localStorage.setItem(KEY, JSON.stringify([{
      sku: 'maps.dynamic', n: 7, at: 1, note: 'dealer-a',
    }]));
    const usage = await import('../src/apps/earth/intel/meter');

    expect(usage.getUsage().totalCalls).toBe(0);
    expect((window as unknown as Record<string, unknown>).__mapcoUsage).toBeUndefined();

    usage.rehydrateUsageMeter();
    expect(usage.getUsage().totalCalls).toBe(7);
    usage.meter('places.details', 1);
    expect(usage.getUsage().totalCalls).toBe(8);

    // Session validation clears the previous identity's private cache before
    // the newly validated route asks the meter to rehydrate.
    localStorage.removeItem(KEY);
    usage.rehydrateUsageMeter();
    expect(usage.getUsage().totalCalls).toBe(0);
    const diagnostic = (window as unknown as { __mapcoUsage?: () => { totalCalls: number } }).__mapcoUsage;
    expect(diagnostic?.().totalCalls).toBe(0);
  });
});
