// @vitest-environment jsdom
/*
 * The Deal room shows day-of-month pills, but a deal's dates are real ISO
 * dates. Every one of these cases was wrong when the two were treated as the
 * same thing: a follow-up due next month read as overdue, labels printed a
 * hard-coded month, and re-saving a follow-up dragged its date backwards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adapter } from '../src/packages/data/adapter';
import { Component } from '../src/apps/dealer/logic';

/** 2026-09-28 — late enough in the month that "next week" crosses into October. */
const NOW = new Date(2026, 8, 28, 10, 0, 0);
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const deal = (over: Record<string, unknown> = {}) => ({
  id: 'deal-1', clientId: 'buyer-1', propId: 'property-1', stage: 'negotiating',
  value: 5000000, docs: [], propDocs: [], log: [], pay: [], hist: [], ...over,
});

describe('deal date arithmetic', () => {
  it('labels a due date in the next month by its own month', () => {
    const c = new Component() as any;
    // day-of-month 3 is *smaller* than today's 28, so a day-only comparison
    // would call this "25 days ago".
    expect(c.dayLabel(3, iso(2026, 10, 3))).toBe('3 Oct');
    expect(c.dayLabel(28, iso(2026, 9, 28))).toBe('Today');
    expect(c.dayLabel(29, iso(2026, 9, 29))).toBe('Tomorrow');
    expect(c.dayLabel(27, iso(2026, 9, 27))).toBe('Yesterday');
    expect(c.dayLabel(21, iso(2026, 9, 21))).toBe('7 days ago');
    expect(c.dayLabel(0)).toBe('');
  });

  it('does not call a follow-up due next month overdue', () => {
    const c = new Component() as any;
    c.clientLinks = []; c.properties = [];
    const flags = c.dealFlags(deal({ next: { k: 'Call buyer', day: 3, dueOn: iso(2026, 10, 3) } }));
    expect(flags.some((f: { t: string }) => /overdue/i.test(f.t))).toBe(false);
    expect(flags.some((f: { t: string }) => /due today/i.test(f.t))).toBe(false);
  });

  it('still flags a genuinely overdue follow-up', () => {
    const c = new Component() as any;
    c.clientLinks = []; c.properties = [];
    const flags = c.dealFlags(deal({ next: { k: 'Call buyer', day: 20, dueOn: iso(2026, 9, 20) } }));
    expect(flags.some((f: { t: string }) => /overdue/i.test(f.t))).toBe(true);
  });

  it('flags a registry inside five days and not one a month out', () => {
    const c = new Component() as any;
    c.clientLinks = []; c.properties = [];
    const near = c.dealFlags(deal({ registryDay: 1, registryDate: iso(2026, 10, 1) }));
    expect(near.some((f: { t: string }) => /^Registry/.test(f.t))).toBe(true);
    const far = c.dealFlags(deal({ registryDay: 28, registryDate: iso(2026, 10, 28) }));
    expect(far.some((f: { t: string }) => /^Registry/.test(f.t))).toBe(false);
  });

  it('counts the quiet gap from the stage event timestamp, not a display string', () => {
    const c = new Component() as any;
    c.clientLinks = []; c.properties = [];
    const quiet = c.dealFlags(deal({ log: [{ d: '18/09/2026', iso: '2026-09-18T09:00:00.000Z' }] }));
    expect(quiet.find((f: { t: string }) => /No update for/.test(f.t))?.t).toBe('No update for 10 days');
    const fresh = c.dealFlags(deal({ log: [{ d: '27/09/2026', iso: '2026-09-27T09:00:00.000Z' }] }));
    expect(fresh.some((f: { t: string }) => /No update for/.test(f.t))).toBe(false);
  });

  it('keeps a follow-up date when only the action changes', async () => {
    const c = new Component() as any;
    c.deals = [deal({ next: { k: 'Call buyer', day: 3, dueOn: iso(2026, 10, 3), note: 'Ring him' } })];
    const update = vi.spyOn(adapter.deals, 'update').mockResolvedValue({ ok: true, value: {} } as any);
    vi.spyOn(c, 'loadDeals').mockResolvedValue(undefined);
    await c.dealNext('deal-1', { k: 'Site visit' });
    expect(update).toHaveBeenCalledWith({ dealId: 'deal-1',
      nextAction: { kind: 'Site visit', note: 'Ring him', dueOn: iso(2026, 10, 3) } });
  });

  it('turns a day pill past the end of the month into the next month', async () => {
    const c = new Component() as any;
    c.deals = [deal({ next: { k: 'Call buyer', day: 28, dueOn: iso(2026, 9, 28) } })];
    const update = vi.spyOn(adapter.deals, 'update').mockResolvedValue({ ok: true, value: {} } as any);
    vi.spyOn(c, 'loadDeals').mockResolvedValue(undefined);
    // "Next week" is today's day-of-month + 7 = 35, i.e. 5 October.
    await c.dealNext('deal-1', { day: 35 });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      nextAction: expect.objectContaining({ dueOn: iso(2026, 10, 5) }) }));
  });

  it('seeds the update modal so a later-month date round-trips unchanged', () => {
    const c = new Component() as any;
    c.deals = [deal({ next: { k: 'Call buyer', day: 3, dueOn: iso(2026, 10, 3) },
      registryDay: 6, registryDate: iso(2026, 10, 6) })];
    c.openUpdate('deal-1');
    const draft = c.state.upDraft;
    expect(c.dealDayDate(draft.nextDay)).toBe(iso(2026, 10, 3));
    expect(c.dealDayDate(draft.regDay)).toBe(iso(2026, 10, 6));
  });
});
