import { describe, expect, it, beforeEach } from 'vitest';
import {
  createWeek, mergeWeek, weekIdOf, weekStartOf, weekProgress, slotsForDay, findSlot,
  assessInventory, describePack, buildInventoryPack,
  renderPropertyBrief, renderDealerInfo, renderPackReadme, propertyRef, photoFileName,
  LocalOpsStore, DealerAccessError, assertDealerAccess, canOperate,
  toReleasedCreative, releasedForDealer, canGenuinelyPublish,
  matchFiles, summarise, extractCreativeId,
  type CreativeAsset, type OperatorDealerAccess, type OutputSlot,
} from '../src/packages/marketing/ops';
import type { DealerBrand } from '../src/packages/marketing/types';
import { PROPERTIES } from '../src/packages/data/mock-adapter';
import type { Property } from '../src/packages/data/types';

const A = 'dealer-1';
const B = 'dealer-2';

const brandA: DealerBrand = {
  dealerId: A, name: 'Chaurasia Properties', phone: '+91 98765 43210',
  whatsapp: '+91 98765 43210', logoUrl: '/assets/mapco-logo.png',
};
const brandB: DealerBrand = { dealerId: B, name: 'Sethi Real Estate', phone: '+91 98140 66710' };

// Disjoint inventory, mirroring src/apps/ops/dealers.ts
const propsA = PROPERTIES.filter((_p, i) => i % 2 === 0);
const propsB = PROPERTIES.filter((_p, i) => i % 2 === 1);

const opAdmin: OperatorDealerAccess = { operatorId: 'op-admin', dealerIds: [], isPlatformAdmin: true };
const opA: OperatorDealerAccess = { operatorId: 'op-a', dealerIds: [A], isPlatformAdmin: false };
const opNone: OperatorDealerAccess = { operatorId: 'op-none', dealerIds: [], isPlatformAdmin: false };

const WEEK_START = '2026-08-17';
const WEEK_ID = weekIdOf(new Date(`${WEEK_START}T00:00:00Z`));

describe('28 output slots — the production tracker', () => {
  it('creates exactly 28 slots, 4 per day, C001..C028', () => {
    const week = createWeek(A, WEEK_START);
    expect(week.slots).toHaveLength(28);
    expect(week.slots[0]!.ref).toBe('C001');
    expect(week.slots[27]!.ref).toBe('C028');
    for (let d = 0; d < 7; d++) expect(slotsForDay(week, d)).toHaveLength(4);
  });

  it('starts every slot empty — MAPCO plans no creative strategy', () => {
    for (const slot of createWeek(A, WEEK_START).slots) {
      expect(slot.status).toBe('waiting');
      expect(slot.propertyIds).toEqual([]);
      // Nothing template/angle/objective shaped exists on a slot at all.
      expect(Object.keys(slot)).not.toContain('templateId');
      expect(Object.keys(slot)).not.toContain('angle');
      expect(Object.keys(slot)).not.toContain('objective');
    }
  });

  it('is idempotent — rebuilding keeps the same slot identities', () => {
    const a = createWeek(A, WEEK_START);
    const b = createWeek(A, WEEK_START);
    expect(a.slots.map((s) => s.ref)).toEqual(b.slots.map((s) => s.ref));
    expect(a.weekId).toBe(b.weekId);
  });

  it('rebuilding never destroys uploaded work', () => {
    const original = createWeek(A, WEEK_START);
    const withWork = {
      ...original,
      slots: original.slots.map((s, i) =>
        i === 2 ? { ...s, status: 'approved' as const, propertyIds: ['ecocity'] } : s),
    };
    const rebuilt = mergeWeek(withWork, createWeek(A, WEEK_START));
    expect(rebuilt.slots[2]!.status).toBe('approved');
    expect(rebuilt.slots[2]!.propertyIds).toEqual(['ecocity']);
    expect(rebuilt.slots[0]!.status).toBe('waiting');
  });

  it('reports progress for today and the week', () => {
    const week = createWeek(A, WEEK_START);
    const today = week.slots[0]!.localDate;
    const withOne = {
      ...week,
      slots: week.slots.map((s, i) => (i === 0 ? { ...s, status: 'approved' as const } : s)),
    };
    const p = weekProgress(withOne, today);
    expect(p.required).toBe(28);
    expect(p.uploaded).toBe(1);
    expect(p.approved).toBe(1);
    expect(p.todayRequired).toBe(4);
    expect(p.todayDone).toBe(1);
  });

  it('anchors weeks to Monday', () => {
    expect(weekStartOf(new Date('2026-08-19T10:00:00Z'))).toBe('2026-08-17');
    expect(weekStartOf(new Date('2026-08-23T23:59:00Z'))).toBe('2026-08-17');
  });
});

describe('inventory eligibility', () => {
  it('excludes sold, unpublished and photoless stock, and says why', () => {
    const stock: Property[] = [
      { ...PROPERTIES[0]!, id: 'sold-1', sold: true },
      { ...PROPERTIES[0]!, id: 'hidden-1', published: false },
      { ...PROPERTIES[0]!, id: 'nophoto-1', photos: [] },
    ];
    const { marketable, excluded } = assessInventory(stock);
    expect(marketable).toHaveLength(0);
    expect(excluded.map((e) => e.reason)).toEqual(
      ['sold', 'not published', 'no usable photograph']);
  });

  it('includes every marketable property, not a preselected 28', () => {
    const { marketable } = assessInventory(PROPERTIES);
    const expected = PROPERTIES.filter((p) => p.published && !p.sold && (p.photos ?? []).length);
    expect(marketable).toHaveLength(expected.length);
  });

  it('a property that sells drops out of the next pack', () => {
    const before = assessInventory(propsA).marketable.length;
    const sold = propsA.map((p, i) => (i === 0 ? { ...p, sold: true } : p));
    expect(assessInventory(sold).marketable.length).toBe(before - 1);
  });
});

describe('property brief — built for ChatGPT, safe by construction', () => {
  const property = PROPERTIES.find((p) => p.published && !p.sold && p.photos.length)!;

  it('never leaks a private field', () => {
    const md = renderPropertyBrief(property, brandA)!.toLowerCase();
    // Owner/seller/commission appear only inside the explicit "withheld" line.
    expect(md).not.toContain(property.owner?.phone?.toLowerCase() ?? '@@none@@');
    expect(md).not.toContain('internalstatus');
    expect(md).not.toContain('photostorage');
    expect(md).not.toContain('dealers/');           // no private storage path
    expect(md).not.toMatch(/latitude|longitude/);   // no raw coordinates
  });

  it('never states a price', () => {
    const md = renderPropertyBrief(property, brandA)!;
    expect(md).not.toContain(String(property.price));
    expect(md).toMatch(/Price is not included/i);
  });

  it('refuses to brief sold or unpublished stock', () => {
    expect(renderPropertyBrief({ ...property, sold: true }, brandA)).toBeNull();
    expect(renderPropertyBrief({ ...property, published: false }, brandA)).toBeNull();
  });

  it('carries the factual guardrails ChatGPT needs', () => {
    const md = renderPropertyBrief(property, brandA)!;
    expect(md).toMatch(/photographs are authoritative/i);
    expect(md).toMatch(/Only the facts above may be stated/i);
    expect(md).toMatch(/Never invent/i);
    expect(md).toMatch(/### Never state/);
    expect(md).toMatch(/Powered by MAPCO/);
  });

  it('ships no template, angle or MAPCO-authored creative prompt', () => {
    const md = renderPropertyBrief(property, brandA)!;
    expect(md).not.toMatch(/\bT0\d{2}\b/);          // no template id
    expect(md).not.toMatch(/creative angle/i);
    expect(md).not.toMatch(/headline approach/i);
    expect(md).not.toMatch(/objective/i);
  });

  it('lists the real photos in the dealer’s own order', () => {
    const md = renderPropertyBrief(property, brandA)!;
    for (let i = 0; i < property.photos.length; i++) {
      expect(md).toContain(photoFileName(property, i, property.photos[i]!));
    }
    expect(md).toMatch(/dealer's first\/cover photo|dealer's own order/i);
    // Honest: no invented creative ranking.
    expect(md).toMatch(/does not rank these creatively/i);
  });

  it('reproduces dealer branding exactly, and flags a missing number', () => {
    expect(renderPropertyBrief(property, brandA)!).toContain('+91 98765 43210');
    const noPhone = renderPropertyBrief(property, { dealerId: A, name: 'X' })!;
    expect(noPhone).toMatch(/No contact number is recorded/i);
    expect(noPhone).toMatch(/Do not invent one/i);
  });

  it('uses a stable property reference everywhere', () => {
    const ref = propertyRef(property);
    expect(ref).toMatch(/^P-[A-Z0-9]+$/);
    expect(renderPropertyBrief(property, brandA)!).toContain(ref);
    expect(photoFileName(property, 0, property.photos[0]!).startsWith(ref)).toBe(true);
  });
});

describe('pack structure', () => {
  it('describes a dealer-scoped tree with one folder per property', () => {
    const { lines, marketable } = describePack(brandA, propsA, WEEK_ID);
    expect(lines[0]).toContain('MAPCO-DEALER-CHAURASIA-PROPERTIES');
    expect(lines).toContain('  DEALER/');
    expect(lines).toContain('    dealer-info.md');
    expect(lines).toContain('    dealer-logo.png');
    expect(lines).toContain('  PROPERTIES/');
    expect(lines.filter((l) => l.includes('MAPCO-PROPERTY-BRIEF.md'))).toHaveLength(marketable);
  });

  it('the README tells the operator they write the prompt', () => {
    const md = renderPackReadme(brandA, ['P-A'], WEEK_ID);
    expect(md).toMatch(/You are the creative director/i);
    expect(md).toMatch(/Write your own prompt/i);
    expect(md).not.toMatch(/template/i);
  });

  it('dealer info states the canonical contact and never invents one', () => {
    expect(renderDealerInfo(brandA, 3, WEEK_ID)).toContain('+91 98765 43210');
    const none = renderDealerInfo({ dealerId: A, name: 'X' }, 0, WEEK_ID);
    expect(none).toMatch(/not recorded in MAPCO/);
    expect(none).toMatch(/rather than inventing one/i);
  });

  it('refuses to build a pack for a dealer the operator cannot access', async () => {
    await expect(buildInventoryPack(opNone, A, brandA, propsA, WEEK_ID))
      .rejects.toBeInstanceOf(DealerAccessError);
  });
});

describe('cross-dealer isolation', () => {
  let store: LocalOpsStore;
  beforeEach(() => { store = new LocalOpsStore(); });

  it('blocks an unassigned operator at the access check', () => {
    expect(() => assertDealerAccess(opA, B)).toThrow(DealerAccessError);
    expect(() => assertDealerAccess(opA, A)).not.toThrow();
    expect(canOperate(opA, B)).toBe(false);
    expect(canOperate(opAdmin, B)).toBe(true);
  });

  it('refuses every store operation for an unauthorised dealer', async () => {
    await expect(store.getWeek(opA, B, WEEK_ID)).rejects.toBeInstanceOf(DealerAccessError);
    await expect(store.saveWeek(opA, createWeek(B, WEEK_START))).rejects.toBeInstanceOf(DealerAccessError);
    await expect(store.listAssets(opA, B, WEEK_ID)).rejects.toBeInstanceOf(DealerAccessError);
    await expect(store.markPackDownloaded(opA, B, WEEK_ID)).rejects.toBeInstanceOf(DealerAccessError);
  });

  it('keeps two dealers’ weeks and assets completely separate', async () => {
    await store.saveWeek(opAdmin, createWeek(A, WEEK_START));
    await store.saveWeek(opAdmin, createWeek(B, WEEK_START));

    const assetA: CreativeAsset = {
      id: 'a1', dealerId: A, slotRef: 'C001', weekId: WEEK_ID, fileName: 'C001.png',
      mime: 'image/png', bytes: 1000, dataUrl: 'data:image/png;base64,AAAA',
      uploadedBy: 'op-admin', uploadedAt: new Date().toISOString(),
    };
    await store.saveAsset(opAdmin, assetA);

    expect((await store.listAssets(opAdmin, A, WEEK_ID))).toHaveLength(1);
    expect((await store.listAssets(opAdmin, B, WEEK_ID))).toHaveLength(0);
    expect(await store.getAsset(opAdmin, B, 'C001', WEEK_ID)).toBeNull();
  });

  it('rejects a slot stamped for a different dealer', async () => {
    await store.saveWeek(opAdmin, createWeek(A, WEEK_START));
    const foreign: OutputSlot = { ...createWeek(B, WEEK_START).slots[0]! };
    await expect(store.updateSlot(opAdmin, A, WEEK_ID, foreign)).rejects.toThrow(/different dealer/i);
  });

  it('gives the two fixture dealers disjoint inventory', () => {
    const idsA = new Set(propsA.map((p) => p.id));
    expect(propsB.every((p) => !idsA.has(p.id))).toBe(true);
  });
});

describe('bulk upload of finished creatives', () => {
  const file = (name: string, type = 'image/png', size = 2048): File => ({ name, type, size } as File);
  const slotRefs = createWeek(A, WEEK_START).slots.map((s) => ({ id: s.ref })) as never;

  it('matches C001..C004 to the right slots', async () => {
    const res = await matchFiles(
      [file('C001.png'), file('C002.png'), file('C003.png'), file('C004.png')],
      { briefs: slotRefs, alreadyUploaded: [] });
    expect(summarise(res).matched).toBe(4);
    expect(res.map((r) => r.creativeId)).toEqual(['C001', 'C002', 'C003', 'C004']);
  });

  it('reports duplicates, unknown ids and bad files instead of guessing', async () => {
    const res = await matchFiles(
      [file('C001.png'), file('C001 copy.png'), file('C999.png'), file('notes.txt', 'text/plain')],
      { briefs: slotRefs, alreadyUploaded: [] });
    const s = summarise(res);
    expect(s.matched).toBe(1);
    expect(s.duplicate).toBe(1);
    expect(s.unmatched).toBe(1);
    expect(s.invalid).toBe(1);
  });

  it('flags replacing an existing creative', async () => {
    const [r] = await matchFiles([file('C005.png')], { briefs: slotRefs, alreadyUploaded: ['C005'] });
    expect(r!.note).toMatch(/replaces/i);
  });

  it('never extracts an ambiguous id', () => {
    expect(extractCreativeId('C001-and-C002.png')).toBeNull();
    expect(extractCreativeId('C012.png')).toBe('C012');
  });
});

describe('release into the dealer’s existing Marketing', () => {
  const asset: CreativeAsset = {
    id: 'a1', dealerId: A, slotRef: 'C001', weekId: WEEK_ID, fileName: 'C001.png',
    mime: 'image/png', bytes: 1000, dataUrl: 'data:image/png;base64,AAAA',
    uploadedBy: 'op', uploadedAt: new Date().toISOString(),
  };

  it('releases only approved work', () => {
    const week = createWeek(A, WEEK_START);
    const waiting = week.slots[0]!;
    expect(toReleasedCreative(waiting, asset)).toBeNull();
    expect(toReleasedCreative({ ...waiting, status: 'uploaded' }, asset)).toBeNull();
    expect(toReleasedCreative({ ...waiting, status: 'approved' }, asset)).not.toBeNull();
  });

  it('never claims published without a real connector', () => {
    const slot = { ...createWeek(A, WEEK_START).slots[0]!, status: 'approved' as const };
    expect(toReleasedCreative(slot, asset)!.state).toBe('ready_to_publish');
    expect(canGenuinelyPublish()).toBe(false);
  });

  it('carries the property association the operator recorded', () => {
    const slot = {
      ...createWeek(A, WEEK_START).slots[0]!,
      status: 'approved' as const, propertyIds: ['ecocity', 'aero'],
    };
    const released = toReleasedCreative(slot, asset)!;
    expect(released.propertyIds).toEqual(['ecocity', 'aero']);
    expect(released.designKey).toBe('operator-chatgpt-v1');
  });

  it('releases nothing for a dealer with no approved work', () => {
    expect(releasedForDealer(createWeek(B, WEEK_START).slots, [])).toHaveLength(0);
  });
});
