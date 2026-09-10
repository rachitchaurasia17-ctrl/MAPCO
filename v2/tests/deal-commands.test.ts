// @vitest-environment jsdom
/*
 * Every Deal-room control must reach the repository. A control that only
 * mutates `this.deals` looks like it worked and is gone after a refresh, so
 * each test here asserts the adapter call AND that a rejected write leaves the
 * in-memory deal untouched.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter } from '../src/packages/data/adapter';
import { Component } from '../src/apps/dealer/logic';
import { deskDeal } from '../src/apps/dealer/desk-deals';
import type { DealWorkspace } from '../src/packages/data/types';

const baseWorkspace: DealWorkspace = {
  deal: {
    id: 'deal-1', propertyId: 'property-1', buyerId: 'buyer-1', buyer: 'Recorded buyer',
    prop: 'Plot', propSub: '200 sq yd', city: 'Mohali', sector: '79', stage: 'token',
    commission: { buyer: { mode: 'none' }, seller: { mode: 'none' } },
  },
  money: {
    value: 8000000, token: 0, expectedBuyer: 0, expectedSeller: 0, expected: 0,
    receivedBuyer: 0, receivedSeller: 0, received: 0, due: 0, fullySettled: false,
  },
  payments: [], stageHistory: [], dealPapers: [], propertyPapers: [],
  paperChecklist: [], propertyPaperChecklist: [],
};

const deal = (over: Record<string, unknown> = {}) => ({
  id: 'deal-1', clientId: 'buyer-1', propId: 'property-1', stage: 'token',
  docs: [], propDocs: [], ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('deal papers checklist', () => {
  it('shows uploaded files and hand-ticked papers together, without duplicating a title', () => {
    const mapped = deskDeal({
      ...baseWorkspace,
      dealPapers: [{ id: 'dd-1', title: 'Token receipt', type: 'token-receipt',
        bucket: 'deal-documents', path: 'p.pdf', mimeType: 'application/pdf',
        sizeBytes: 10, createdAt: '2026-09-01T00:00:00.000Z' }],
      // 'token receipt' repeats the uploaded file and must not appear twice.
      paperChecklist: [{ title: 'Agreement to Sell', markedOn: '2026-09-05' },
        { title: 'token receipt', markedOn: '2026-09-06' }],
      propertyPaperChecklist: [{ title: 'Fard / Jamabandi', markedOn: '2026-09-04' }],
    });
    expect(mapped.docs.map((d: { n: string }) => d.n)).toEqual(['Token receipt', 'Agreement to Sell']);
    expect(mapped.docs.map((d: { uploaded: boolean }) => d.uploaded)).toEqual([true, false]);
    expect(mapped.propDocs.map((d: { n: string; uploaded: boolean }) => [d.n, d.uploaded]))
      .toEqual([['Fard / Jamabandi', false]]);
  });

  it('never invents papers from the stage', () => {
    const mapped = deskDeal({ ...baseWorkspace, deal: { ...baseWorkspace.deal, stage: 'registry' } });
    expect(mapped.docs).toEqual([]);
    expect(mapped.propDocs).toEqual([]);
  });

  it('marks a deal paper through the repository and reloads', async () => {
    const c = new Component() as any;
    c.deals = [deal()];
    const setPaper = vi.spyOn(adapter.deals, 'setPaper').mockResolvedValue({ ok: true, value: [] } as any);
    const load = vi.spyOn(c, 'loadDeals').mockResolvedValue(undefined);
    expect(await c.dealDocToggle('deal-1', 'Token receipt')).toBe(true);
    expect(setPaper).toHaveBeenCalledWith({ dealId: 'deal-1', title: 'Token receipt', have: true });
    expect(load).toHaveBeenCalled();
  });

  it('clears a paper that is already ticked', async () => {
    const c = new Component() as any;
    c.deals = [deal({ docs: [{ n: 'Token receipt', have: true, uploaded: false }] })];
    const setPaper = vi.spyOn(adapter.deals, 'setPaper').mockResolvedValue({ ok: true, value: [] } as any);
    vi.spyOn(c, 'loadDeals').mockResolvedValue(undefined);
    await c.dealDocToggle('deal-1', 'Token receipt');
    expect(setPaper).toHaveBeenCalledWith({ dealId: 'deal-1', title: 'Token receipt', have: false });
  });

  it('reports a rejected paper and leaves the deal unchanged', async () => {
    const c = new Component() as any;
    c.deals = [deal()];
    vi.spyOn(adapter.deals, 'setPaper').mockResolvedValue({ ok: false,
      error: { code: 'validation', message: 'That paper already has an uploaded file' } } as any);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const load = vi.spyOn(c, 'loadDeals').mockResolvedValue(undefined);
    expect(await c.dealDocToggle('deal-1', 'Token receipt')).toBe(false);
    expect(alert).toHaveBeenCalledWith('That paper already has an uploaded file');
    expect(load).not.toHaveBeenCalled();
    expect(c.deals[0].docs).toEqual([]);
  });

  it('saves a property paper onto the property, not the deal', async () => {
    const c = new Component() as any;
    c.deals = [deal()];
    const setMark = vi.spyOn(adapter.propertyDocuments, 'setMark').mockResolvedValue({ ok: true, value: [] } as any);
    vi.spyOn(c, 'loadDeals').mockResolvedValue(undefined);
    expect(await c.propDocToggle('property-1', 'Fard / Jamabandi')).toBe(true);
    expect(setMark).toHaveBeenCalledWith({ propertyId: 'property-1', title: 'Fard / Jamabandi', have: true });
  });

  it('refuses a property paper when the deal has no saved property', async () => {
    const c = new Component() as any;
    c.deals = [deal({ propId: '' })];
    const setMark = vi.spyOn(adapter.propertyDocuments, 'setMark');
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    expect(await c.propDocToggle('', 'Fard / Jamabandi')).toBe(false);
    expect(setMark).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
  });
});

describe('deal property link', () => {
  it('relinks through the repository and closes the picker', async () => {
    const c = new Component() as any;
    c.deals = [deal()];
    const relink = vi.spyOn(adapter.deals, 'relinkProperty').mockResolvedValue({ ok: true, value: {} } as any);
    vi.spyOn(c, 'loadDeals').mockResolvedValue(undefined);
    c.state = { ...c.state, linkFor: 'deal-1' };
    expect(await c.linkProp('deal-1', 'property-2')).toBe(true);
    expect(relink).toHaveBeenCalledWith({ dealId: 'deal-1', propertyId: 'property-2' });
    expect(c.state.linkFor).toBeNull();
  });

  it('keeps the picker open and the old property when the relink is rejected', async () => {
    const c = new Component() as any;
    c.deals = [deal()];
    vi.spyOn(adapter.deals, 'relinkProperty').mockResolvedValue({ ok: false,
      error: { code: 'validation', message: 'That property is already sold' } } as any);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    c.state = { ...c.state, linkFor: 'deal-1' };
    expect(await c.linkProp('deal-1', 'property-2')).toBe(false);
    expect(alert).toHaveBeenCalledWith('That property is already sold');
    expect(c.state.linkFor).toBe('deal-1');
    expect(c.deals[0].propId).toBe('property-1');
  });
});

describe('paper counts', () => {
  it('counts only papers that are actually held', () => {
    const c = new Component() as any;
    expect(c.paperCount(deal({
      docs: [{ n: 'A', have: true }, { n: 'B', have: false }],
      propDocs: [{ n: 'C' }],
    }))).toBe(2);
    expect(c.paperCount(deal())).toBe(0);
  });
});
