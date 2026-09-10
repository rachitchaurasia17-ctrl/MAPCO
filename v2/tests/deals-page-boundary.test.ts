// @vitest-environment jsdom
/*
 * Deals async boundary.
 *
 * This suite used to drive src/apps/dealer/pages/deals.ts, a route that was
 * consolidated into the single dealer screen. Its DOM, its data-act hooks and
 * its copy ('Loading completed sales', 'Sale price & dates', the /admin/*.html
 * links) all went with it, so those assertions are gone rather than rewritten
 * against markup nobody agreed to. What survives is the boundary itself:
 *   - a pending load is visibly pending and never silently empty,
 *   - a failed load says so and leaves the screen usable,
 *   - an incomplete legacy completed sale renders without claiming values
 *     that were never recorded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter, ok, err } from '../src/packages/data/adapter';
import { Component } from '../src/apps/dealer/logic';
import { deskDeal } from '../src/apps/dealer/desk-deals';
import { normalizeCompletedDeal } from '../src/packages/data/deal-normalization';
import type { DealWorkspace } from '../src/packages/data/types';

const page = <T>(items: T[]) => ok({ items, nextCursor: null, total: items.length });

afterEach(() => vi.restoreAllMocks());

describe('Deals async boundary', () => {
  it('marks the load pending until every deal has arrived', async () => {
    const c = new Component() as any;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(adapter.deals, 'listPipeline').mockImplementation((async () => { await gate; return page([]); }) as never);
    vi.spyOn(adapter.deals, 'list').mockResolvedValue(page([]) as never);

    const loading = c.loadDeals();
    expect(c.state.loadingDeals).toBe(true);
    release();
    await loading;
    expect(c.state.loadingDeals).toBe(false);
    expect(c.deals).toEqual([]);
  });

  it('reports a failed load instead of showing an empty deal book', async () => {
    const c = new Component() as any;
    c.deals = [];
    vi.spyOn(adapter.deals, 'listPipeline').mockResolvedValue(err('network', 'offline') as never);
    vi.spyOn(adapter.deals, 'list').mockResolvedValue(page([]) as never);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await c.loadDeals();
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Deals could not be loaded'));
    expect(c.state.loadingDeals).toBe(false);
  });

  it('does not start a second load while one is already running', async () => {
    const c = new Component() as any;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const listPipeline = vi.spyOn(adapter.deals, 'listPipeline')
      .mockImplementation((async () => { await gate; return page([]); }) as never);
    vi.spyOn(adapter.deals, 'list').mockResolvedValue(page([]) as never);

    const first = c.loadDeals();
    await c.loadDeals();
    expect(listPipeline).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it('keeps an incomplete legacy completed sale usable without claiming unknown values', () => {
    const legacy = normalizeCompletedDeal('legacy-complete', {
      stage: 'closed', prop: 'Legacy plot', buyerId: 'buyer-legacy', propId: 'property-legacy',
    });
    expect(legacy).not.toBeNull();
    /* Nothing about money was recorded. The numbers read 0 for arithmetic, but
       fieldPresence is what the screen must consult before printing them, so a
       legacy row shows "not recorded" rather than a confident zero. */
    expect(legacy!.fieldPresence).toEqual(expect.objectContaining({
      soldPrice: false, commission: false, commissionReceived: false,
      paymentReceived: false, soldDate: false, documents: false,
    }));
    expect(legacy!.prop).toBe('Legacy plot');
    expect(legacy!.buyerId).toBe('buyer-legacy');
  });

  it('renders a completed sale with no money ledger as zero, not as a guess', () => {
    const workspace: DealWorkspace = {
      deal: { id: 'legacy-complete', propertyId: 'property-legacy', buyerId: 'buyer-legacy',
        buyer: '', prop: 'Legacy plot', propSub: '', city: '', sector: '', stage: 'closed',
        commission: { buyer: { mode: 'none' }, seller: { mode: 'none' } } },
      money: { value: 0, token: 0, expectedBuyer: 0, expectedSeller: 0, expected: 0,
        receivedBuyer: 0, receivedSeller: 0, received: 0, due: 0, fullySettled: false },
      payments: [], stageHistory: [], dealPapers: [], propertyPapers: [],
      paperChecklist: [], propertyPaperChecklist: [],
    };
    const mapped = deskDeal(workspace);
    expect(mapped.value).toBe(0);
    expect(mapped.comm).toBe(0);
    expect(mapped.pay).toEqual([]);
    expect(mapped.hist).toEqual([]);
    expect(mapped.created).toBe('');
    // A sale with no recorded date must not borrow today's.
    expect(mapped.createdDay).toBe(0);
  });
});
