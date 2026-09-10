// @vitest-environment jsdom
/*
 * Customers async boundary and real relationships.
 *
 * This suite used to drive src/apps/dealer/pages/customers.ts, a route that was
 * consolidated into the single dealer screen. Its DOM and copy ('Loading
 * customers', the /admin/*.html links) went with it and are not rewritten
 * against markup nobody agreed to. What survives is the boundary:
 *   - a failed customer load surfaces an error and never reads as "no clients",
 *   - a partial customer keeps its blanks blank instead of inventing a
 *     requirement, a budget or an activity date,
 *   - only real purchases and real links attach to a client.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter, ok, err } from '../src/packages/data/adapter';
import { deskStore, budgetLabel } from '../src/apps/dealer/desk-store';
import { normalizeCompletedDeal } from '../src/packages/data/deal-normalization';
import type { Client } from '../src/packages/data/types';

const page = <T>(items: T[]) => ok({ items, nextCursor: null, total: items.length });

afterEach(() => vi.restoreAllMocks());

describe('Customers async boundary', () => {
  it('reports a failed customer load rather than showing an empty contact book', async () => {
    vi.spyOn(adapter.customers, 'list').mockResolvedValue(err('network', 'offline') as never);
    await deskStore.loadClients();
    expect(deskStore.clientsStatus.state).toBe('error');
    // A transport failure is named as one, so the dealer is not told there are
    // no clients when the truth is that the list never arrived.
    expect((deskStore.clientsStatus as { error: string }).error)
      .toBe('Could not reach MAPCO. Check your connection and try again.');
  });

  it('names an ended session instead of reporting an empty contact book', async () => {
    vi.spyOn(adapter.customers, 'list').mockResolvedValue(err('unauthorized', 'no session') as never);
    await deskStore.loadClients();
    expect(deskStore.clientsStatus.state).toBe('error');
    expect((deskStore.clientsStatus as { error: string }).error)
      .toBe('Your session has ended. Sign in again to continue.');
  });

  it('reaches a ready state with the customers the repository actually returned', async () => {
    const customer = { id: 'customer-partial', name: 'Legacy Buyer', phone: '', city: '' } as unknown as Client;
    vi.spyOn(adapter.customers, 'list').mockResolvedValue(page([customer]) as never);
    await deskStore.loadClients();
    expect(deskStore.clientsStatus.state).toBe('ready');
    expect(deskStore.clients.map((c) => c.id)).toContain('customer-partial');
  });
});

describe('partial customers keep their blanks blank', () => {
  it('never invents a budget for a client who has none', () => {
    expect(budgetLabel(undefined, undefined)).toBe('');
    expect(budgetLabel(0, 0)).toBe('');
  });

  it('labels a mixed-unit range without reading lakhs as crores', () => {
    // 80 lakh – 1.5 crore. Dropping the lower unit here printed "₹80–1.5 Cr".
    expect(budgetLabel(8_000_000, 15_000_000)).toBe('₹80 L–1.5 Cr');
    // Same unit on both ends, so the lower one is safe to drop.
    expect(budgetLabel(12_000_000, 18_000_000)).toBe('₹1.2–1.8 Cr');
  });

  it('connects only purchases that were really recorded', () => {
    const sale = normalizeCompletedDeal('sale-1', {
      stage: 'closed', propId: 'property-sold', prop: 'Sold property',
      buyerId: 'customer-partial', buyer: 'Legacy Buyer',
      soldPrice: 8_000_000, saleDate: '2026-06-10', paymentReceived: 8_000_000,
    });
    expect(sale).not.toBeNull();
    expect(sale!.buyerId).toBe('customer-partial');
    expect(sale!.fieldPresence.soldPrice).toBe(true);
    expect(sale!.fieldPresence.soldDate).toBe(true);
    // Commission was never entered, so the screen must not print one.
    expect(sale!.fieldPresence.commission).toBe(false);
  });
});
