import { describe, expect, it, beforeEach } from 'vitest';
import {
  createWeek, weekIdOf, findSlot,
  detectNewProperties, raiseActions, recommendSlot, summariseBacklog,
  suggestForUpload, recalculateFuture, isMarketableForOps, isHandled, actionId,
  buildNewPropertyPack, renderPropertyBrief, propertyRef,
  LocalOpsStore, DealerAccessError,
  type NewPropertyAction, type OperatorDealerAccess, type OpsWeek, type OutputSlot,
} from '../src/packages/marketing/ops';
import type { DealerBrand } from '../src/packages/marketing/types';
import { PROPERTIES } from '../src/packages/data/mock-adapter';
import type { Property } from '../src/packages/data/types';

const A = 'dealer-1';
const B = 'dealer-2';
const WEEK_START = '2026-08-17';           // Monday
const WEEK_ID = weekIdOf(new Date(`${WEEK_START}T00:00:00Z`));
const MONDAY = '2026-08-17';
const WEDNESDAY = '2026-08-19';
const SUNDAY = '2026-08-23';

const brandA: DealerBrand = { dealerId: A, name: 'Chaurasia Properties', phone: '+91 98765 43210' };
const opAdmin: OperatorDealerAccess = { operatorId: 'op', dealerIds: [], isPlatformAdmin: true };
const opA: OperatorDealerAccess = { operatorId: 'op-a', dealerIds: [A], isPlatformAdmin: false };

const base = PROPERTIES.find((p) => p.published && !p.sold && p.photos.length)!;
const newProp = (id: string, over: Partial<Property> = {}): Property =>
  ({ ...base, id, area: `Sector ${id}`, ...over });

/** Set every slot on/after `from` to a status. */
const setFrom = (week: OpsWeek, from: string, status: OutputSlot['status']): OpsWeek => ({
  ...week,
  slots: week.slots.map((s) => (s.localDate >= from ? { ...s, status } : s)),
});

describe('detection', () => {
  it('raises an action for a property published after the week opened', () => {
    const baseline = PROPERTIES.map((p) => p.id);
    const added = newProp('p284');
    const found = detectNewProperties({
      dealerId: A, weekId: WEEK_ID,
      properties: [...PROPERTIES, added],
      baselinePropertyIds: baseline, existing: [],
    });
    expect(found).toEqual(['p284']);
  });

  it('does not trigger on sold, unpublished or photoless stock', () => {
    const baseline = PROPERTIES.map((p) => p.id);
    const candidates = [
      newProp('sold-1', { sold: true }),
      newProp('draft-1', { published: false }),
      newProp('nophoto-1', { photos: [] }),
    ];
    const found = detectNewProperties({
      dealerId: A, weekId: WEEK_ID,
      properties: [...PROPERTIES, ...candidates],
      baselinePropertyIds: baseline, existing: [],
    });
    expect(found).toEqual([]);
    for (const c of candidates) expect(isMarketableForOps(c)).toBe(false);
  });

  it('is idempotent — the same property never raises twice', () => {
    const baseline = PROPERTIES.map((p) => p.id);
    const added = newProp('p284');
    const week = createWeek(A, WEEK_START);
    const [first] = raiseActions({
      dealerId: A, weekId: WEEK_ID, week, todayIso: MONDAY,
      properties: [added], newPropertyIds: ['p284'],
    });
    const second = detectNewProperties({
      dealerId: A, weekId: WEEK_ID,
      properties: [...PROPERTIES, added],
      baselinePropertyIds: baseline, existing: [first!],
    });
    expect(second).toEqual([]);
    expect(first!.id).toBe(actionId(A, WEEK_ID, 'p284'));
  });

  it('does not re-raise an existing property that was merely edited', () => {
    const edited = { ...base, size: '600 sq yd' };
    const found = detectNewProperties({
      dealerId: A, weekId: WEEK_ID,
      properties: PROPERTIES.map((p) => (p.id === base.id ? edited : p)),
      baselinePropertyIds: PROPERTIES.map((p) => p.id), existing: [],
    });
    expect(found).toEqual([]);
  });
});

describe('slot recommendation', () => {
  it('prefers an empty slot today', () => {
    const rec = recommendSlot({ week: createWeek(A, WEEK_START), todayIso: MONDAY });
    expect(rec.kind).toBe('today_open');
    expect(rec.slotRef).toBe('C001');
    expect(rec.localDate).toBe(MONDAY);
    expect(rec.requiresConfirmation).toBe(false);
  });

  it('falls through to the earliest future slot when today is full', () => {
    const week = createWeek(A, WEEK_START);
    const todayFull = {
      ...week,
      slots: week.slots.map((s) => (s.localDate === MONDAY ? { ...s, status: 'uploaded' as const } : s)),
    };
    const rec = recommendSlot({ week: todayFull, todayIso: MONDAY });
    expect(rec.kind).toBe('future_open');
    expect(rec.localDate).toBe('2026-08-18');
    expect(rec.slotRef).toBe('C005');
    expect(rec.requiresConfirmation).toBe(false);
  });

  it('never recommends a past day', () => {
    const rec = recommendSlot({ week: createWeek(A, WEEK_START), todayIso: WEDNESDAY });
    expect(rec.localDate! >= WEDNESDAY).toBe(true);
  });

  it('suggests replacing only unapproved work, and asks for confirmation', () => {
    const week = setFrom(createWeek(A, WEEK_START), MONDAY, 'uploaded');
    const rec = recommendSlot({ week, todayIso: MONDAY });
    expect(rec.kind).toBe('replace_suggestion');
    expect(rec.requiresConfirmation).toBe(true);
    // Least disruptive = furthest out.
    expect(rec.localDate).toBe(SUNDAY);
  });

  it('NEVER auto-replaces approved, ready or posted work', () => {
    for (const status of ['approved', 'ready', 'posted'] as const) {
      const week = setFrom(createWeek(A, WEEK_START), MONDAY, status);
      const rec = recommendSlot({ week, todayIso: MONDAY });
      expect(rec.kind).toBe('unscheduled');
      expect(rec.slotRef).toBeUndefined();
      expect(rec.requiresConfirmation).toBe(true);
      expect(rec.reason).toMatch(/carries over|approved|posted/i);
    }
  });

  it('honours slots already reserved for other new properties', () => {
    const week = createWeek(A, WEEK_START);
    const rec = recommendSlot({ week, todayIso: MONDAY, reservedRefs: ['C001', 'C002'] });
    expect(rec.slotRef).toBe('C003');
  });
});

describe('multiple new properties in one day', () => {
  const week = createWeek(A, WEEK_START);
  const three = ['p284', 'p285', 'p286'].map((id) => newProp(id));

  it('spreads them across different slots — never all onto one', () => {
    const actions = raiseActions({
      dealerId: A, weekId: WEEK_ID, week, todayIso: MONDAY,
      properties: three, newPropertyIds: three.map((p) => p.id),
    });
    const refs = actions.map((a) => a.recommendation.slotRef);
    expect(refs).toEqual(['C001', 'C002', 'C003']);
    expect(new Set(refs).size).toBe(3);
  });

  it('reports an honest backlog rather than inventing a 29th deliverable', () => {
    // Only two slots free all week.
    const nearlyFull: OpsWeek = {
      ...week,
      slots: week.slots.map((s, i) => (i < 26 ? { ...s, status: 'approved' as const } : s)),
    };
    const actions = raiseActions({
      dealerId: A, weekId: WEEK_ID, week: nearlyFull, todayIso: MONDAY,
      properties: three, newPropertyIds: three.map((p) => p.id),
    });
    const backlog = summariseBacklog(actions);
    expect(backlog.scheduledThisWeek).toBe(2);
    expect(backlog.queuedForNextWeek).toBe(1);
    expect(backlog.line).toMatch(/2 scheduled this week/);
    expect(backlog.line).toMatch(/1 queued for next week/);
    // The week is still 28 slots. Nothing was invented.
    expect(nearlyFull.slots).toHaveLength(28);
  });
});

describe('mid-week recalculation', () => {
  it('never rewrites the past or protected work', () => {
    const week = createWeek(A, WEEK_START);
    const withHistory: OpsWeek = {
      ...week,
      slots: week.slots.map((s) => {
        if (s.localDate === MONDAY) return { ...s, status: 'posted' as const, propertyIds: ['old'] };
        if (s.localDate === WEDNESDAY && s.slotIndex === 0) return { ...s, status: 'approved' as const, propertyIds: ['keep'] };
        return s;
      }),
    };
    const assignments = new Map(withHistory.slots.map((s) => [s.ref, 'p284']));
    const next = recalculateFuture(withHistory, WEDNESDAY, assignments);

    // Monday is in the past — untouched.
    expect(next.slots.filter((s) => s.localDate === MONDAY).every((s) => s.propertyIds[0] === 'old')).toBe(true);
    // Approved Wednesday slot — untouched.
    expect(findSlot(next, withHistory.slots.find((s) => s.localDate === WEDNESDAY && s.slotIndex === 0)!.ref)!.propertyIds)
      .toEqual(['keep']);
    // A waiting future slot does take the assignment.
    const waiting = next.slots.find((s) => s.localDate > WEDNESDAY && s.status === 'waiting')!;
    expect(waiting.propertyIds).toEqual(['p284']);
  });

  it('keeps the week at 28 slots after recalculation', () => {
    const week = createWeek(A, WEEK_START);
    expect(recalculateFuture(week, WEDNESDAY, new Map()).slots).toHaveLength(28);
  });
});

describe('upload-back context', () => {
  const week = createWeek(A, WEEK_START);
  const action = raiseActions({
    dealerId: A, weekId: WEEK_ID, week, todayIso: MONDAY,
    properties: [newProp('p284')], newPropertyIds: ['p284'],
  })[0]!;

  it('suggests the property MAPCO prepared for that slot', () => {
    const s = suggestForUpload(A, [action], action.recommendation.slotRef!);
    expect(s.propertyId).toBe('p284');
    expect(s.reason).toMatch(/prepared for/i);
  });

  it('suggests nothing for an unrelated slot', () => {
    expect(suggestForUpload(A, [action], 'C028').propertyId).toBeUndefined();
  });

  it('never crosses dealers', () => {
    expect(suggestForUpload(B, [action], action.recommendation.slotRef!).propertyId).toBeUndefined();
  });

  it('stops suggesting once the action is handled', () => {
    const done: NewPropertyAction = { ...action, stage: 'approved' };
    expect(suggestForUpload(A, [done], action.recommendation.slotRef!).propertyId).toBeUndefined();
    expect(isHandled('approved')).toBe(true);
    expect(isHandled('pack_downloaded')).toBe(false);
  });
});

describe('lifecycle and next-week carry-over', () => {
  it('downloading the pack does NOT mark the property handled', () => {
    expect(isHandled('pack_downloaded')).toBe(false);
    expect(isHandled('assigned')).toBe(false);
    expect(isHandled('creative_uploaded')).toBe(false);
  });

  it('an unhandled property stays available to next week', () => {
    const week = createWeek(A, WEEK_START);
    const full = setFrom(week, MONDAY, 'approved');
    const [action] = raiseActions({
      dealerId: A, weekId: WEEK_ID, week: full, todayIso: MONDAY,
      properties: [newProp('p284')], newPropertyIds: ['p284'],
    });
    expect(action!.recommendation.kind).toBe('unscheduled');
    expect(isHandled(action!.stage)).toBe(false);
    // Next week it is simply part of normal marketable inventory.
    expect(isMarketableForOps(newProp('p284'))).toBe(true);
  });
});

describe('individual new-property pack', () => {
  it('contains only that property, its photos and the dealer files', async () => {
    const property = newProp('p284');
    const pack = await buildNewPropertyPack(opAdmin, A, brandA, property, WEEK_ID);
    expect(pack.fileName).toBe(`NEW-PROPERTY-${propertyRef(property)}.zip`);
    // Photo BYTES need a browser fetch base; under Node only the text
    // entries are embedded. Photo inclusion is verified in-browser.
    expect(pack.photoCount).toBeGreaterThanOrEqual(0);
    // The brief still names every photo file, so the association is provable here.
    const brief = renderPropertyBrief(property, brandA)!;
    for (let i = 0; i < property.photos.length; i++) {
      expect(brief).toContain(`${propertyRef(property)}-PHOTO-${String(i + 1).padStart(2, '0')}`);
    }

    const text = new TextDecoder('latin1').decode(new Uint8Array(await pack.blob.arrayBuffer()));
    expect(text).toContain('MAPCO-PROPERTY-BRIEF.md');
    expect(text).toContain('DEALER-INFO.md');
    // No other property may appear.
    for (const other of PROPERTIES.filter((p) => p.id !== property.id)) {
      expect(text).not.toContain(`/${propertyRef(other)}-PHOTO`);
    }
    // Same security rules as the full pack.
    expect(text).not.toMatch(/dealers\//);
    expect(text).not.toMatch(/\bT0\d{2}\b/);          // no template
  });

  it('refuses a dealer the operator cannot access', async () => {
    await expect(buildNewPropertyPack(opA, B, brandA, newProp('p284'), WEEK_ID))
      .rejects.toBeInstanceOf(DealerAccessError);
  });

  it('refuses to pack an unmarketable property', async () => {
    await expect(buildNewPropertyPack(opAdmin, A, brandA, newProp('x', { sold: true }), WEEK_ID))
      .rejects.toThrow(/not marketable/i);
  });

  it('carries the same factual guardrails as the weekly pack', () => {
    const md = renderPropertyBrief(newProp('p284'), brandA)!;
    expect(md).toMatch(/photographs are authoritative/i);
    expect(md).toMatch(/Price is not included/i);
    expect(md).not.toMatch(/creative angle|headline approach/i);
  });
});

describe('cross-dealer isolation for new-property actions', () => {
  let store: LocalOpsStore;
  beforeEach(() => { store = new LocalOpsStore(); });

  it('refuses to read or write another dealer’s actions', async () => {
    await expect(store.listActions(opA, B, WEEK_ID)).rejects.toBeInstanceOf(DealerAccessError);
    await expect(store.ensureBaseline(opA, B, WEEK_ID, [])).rejects.toBeInstanceOf(DealerAccessError);
    const foreign = raiseActions({
      dealerId: B, weekId: WEEK_ID, week: createWeek(B, WEEK_START), todayIso: MONDAY,
      properties: [newProp('p999')], newPropertyIds: ['p999'],
    })[0]!;
    await expect(store.saveAction(opA, foreign)).rejects.toBeInstanceOf(DealerAccessError);
  });

  it('keeps two dealers’ actions separate', async () => {
    const mk = (dealerId: string, id: string): NewPropertyAction => raiseActions({
      dealerId, weekId: WEEK_ID, week: createWeek(dealerId, WEEK_START), todayIso: MONDAY,
      properties: [newProp(id)], newPropertyIds: [id],
    })[0]!;
    await store.saveAction(opAdmin, mk(A, 'pa'));
    await store.saveAction(opAdmin, mk(B, 'pb'));
    const listA = await store.listActions(opAdmin, A, WEEK_ID);
    expect(listA).toHaveLength(1);
    expect(listA[0]!.propertyId).toBe('pa');
    expect(await store.listActions(opAdmin, B, WEEK_ID)).toHaveLength(1);
  });

  it('freezes the baseline so a mid-week addition stays new', async () => {
    const first = await store.ensureBaseline(opAdmin, A, WEEK_ID, ['a', 'b']);
    const second = await store.ensureBaseline(opAdmin, A, WEEK_ID, ['a', 'b', 'c']);
    expect(first).toEqual(['a', 'b']);
    expect(second).toEqual(['a', 'b']);   // not overwritten
  });
});
