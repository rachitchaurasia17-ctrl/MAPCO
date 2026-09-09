import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter } from '../src/packages/data/adapter';
import { deskDeal, loadDeskDeals } from '../src/apps/dealer/desk-deals';
import type { DealWorkspace } from '../src/packages/data/types';

const workspace: DealWorkspace = {
  deal: { id: 'deal-1', propertyId: 'property-1', buyerId: 'buyer-1', buyer: 'Recorded buyer',
    prop: 'Plot', propSub: '200 sq yd', city: 'Mohali', sector: '79', stage: 'token',
    commission: { buyer: { mode: 'none' }, seller: { mode: 'none' } } },
  money: { value: 8000000, token: 100000, expectedBuyer: 0, expectedSeller: 0,
    expected: 0, receivedBuyer: 0, receivedSeller: 0, received: 0, due: 0, fullySettled: false },
  payments: [], stageHistory: [], dealPapers: [], propertyPapers: [],
};

afterEach(() => vi.restoreAllMocks());
describe('canonical Desk deals', () => {
  it('does not fabricate payments, history, commission or papers from a stage', () => {
    const mapped = deskDeal(workspace);
    expect(mapped.pay).toEqual([]);
    expect(mapped.hist).toEqual([]);
    expect(mapped.docs).toEqual([]);
    expect(mapped.log).toEqual([]);
    expect(mapped.created).toBe('');
    expect(mapped.comm).toBe(0);
    expect(mapped.value).toBe(8000000);
    expect(mapped.money).toEqual(workspace.money);
  });
  it('retains actual ledger records and buyer identity', () => {
    const mapped = deskDeal({ ...workspace, payments: [{ id: 'payment-1',
      kind: 'commission-seller', amount: 500, receivedOn: '2026-09-09', note: 'Receipt' }] });
    expect(mapped.clientId).toBe('buyer-1');
    expect(mapped.pay).toEqual([{ id: 'payment-1', k: 'commS', amt: 500,
      d: '2026-09-09', note: 'Receipt' }]);
  });
  it('paginates pipeline and deduplicates completed workspaces', async () => {
    const pipeline = vi.spyOn(adapter.deals, 'listPipeline')
      .mockResolvedValueOnce({ ok: true, value: { items: [workspace.deal], nextCursor: 'next' } })
      .mockResolvedValueOnce({ ok: true, value: { items: [], nextCursor: null } });
    vi.spyOn(adapter.deals, 'list').mockResolvedValue({ ok: true,
      value: { items: [{ ...workspace.deal } as never], nextCursor: null } });
    const read = vi.spyOn(adapter.deals, 'workspace').mockResolvedValue({ ok: true, value: workspace });
    expect(await loadDeskDeals()).toHaveLength(1);
    expect(read).toHaveBeenCalledTimes(1);
    expect(pipeline).toHaveBeenLastCalledWith({ limit: 100, cursor: 'next' });
  });
  it('fails the read when the backend workspace fails', async () => {
    vi.spyOn(adapter.deals, 'listPipeline').mockResolvedValue({ ok: true,
      value: { items: [workspace.deal], nextCursor: null } });
    vi.spyOn(adapter.deals, 'list').mockResolvedValue({ ok: true, value: { items: [], nextCursor: null } });
    vi.spyOn(adapter.deals, 'workspace').mockResolvedValue({ ok: false,
      error: { code: 'network', message: 'Offline' } });
    await expect(loadDeskDeals()).rejects.toThrow(/workspace could not be loaded/);
  });
});
