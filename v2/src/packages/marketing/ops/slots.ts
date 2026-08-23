/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing Ops — the weekly output tracker

   28 output slots per dealer per week (7 × 4). These are empty boxes,
   not creative briefs: MAPCO does not decide which property fills
   C001. The operator does that in ChatGPT and records it on upload.

   Slot identity is deterministic, so regenerating a week never
   renumbers or loses existing work.
   ═══════════════════════════════════════════════════════════════ */
import type { OpsWeek, OutputSlot, SlotRef, SlotStatus } from './types';

export const DEFAULT_PER_DAY = 4;
export const DAYS_IN_WEEK = 7;
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const slotRef = (n: number): SlotRef => `C${String(n).padStart(3, '0')}`;

/** Monday of the week containing `date`, as YYYY-MM-DD. */
export function weekStartOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** ISO week identity, e.g. '2026-W34'. */
export function weekIdOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDow = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDow + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Create an empty week of output slots. */
export function createWeek(
  dealerId: string, weekStart: string, timezone = 'Asia/Kolkata', perDay = DEFAULT_PER_DAY,
): OpsWeek {
  const weekId = weekIdOf(new Date(`${weekStart}T00:00:00Z`));
  const slots: OutputSlot[] = [];
  let n = 0;
  for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex++) {
    for (let slotIndex = 0; slotIndex < perDay; slotIndex++) {
      slots.push({
        ref: slotRef(++n),
        dealerId, weekId,
        dayIndex,
        localDate: addDays(weekStart, dayIndex),
        slotIndex,
        status: 'waiting',
        propertyIds: [],
      });
    }
  }
  return { dealerId, weekId, weekStart, timezone, perDay, slots, createdAt: new Date().toISOString() };
}

/**
 * Rebuild a week without losing work: slots that already carry an
 * upload keep their status, property association and asset.
 */
export function mergeWeek(existing: OpsWeek | null, fresh: OpsWeek): OpsWeek {
  if (!existing) return fresh;
  const byRef = new Map(existing.slots.map((s) => [s.ref, s]));
  return {
    ...fresh,
    createdAt: existing.createdAt,
    slots: fresh.slots.map((slot) => {
      const prior = byRef.get(slot.ref);
      return prior && prior.status !== 'waiting' ? { ...slot, ...prior } : slot;
    }),
  };
}

export const slotsForDay = (week: OpsWeek, dayIndex: number): readonly OutputSlot[] =>
  week.slots.filter((s) => s.dayIndex === dayIndex);

export const findSlot = (week: OpsWeek, ref: SlotRef): OutputSlot | undefined =>
  week.slots.find((s) => s.ref === ref);

const DONE: readonly SlotStatus[] = ['uploaded', 'reviewed', 'approved', 'ready', 'posted'];

export const isDone = (slot: OutputSlot): boolean => DONE.includes(slot.status);

export interface WeekProgress {
  readonly required: number;
  readonly uploaded: number;
  readonly approved: number;
  readonly awaitingReview: number;
  readonly failed: number;
  readonly todayRequired: number;
  readonly todayDone: number;
}

export function weekProgress(week: OpsWeek, todayIso: string): WeekProgress {
  const today = week.slots.filter((s) => s.localDate === todayIso);
  return {
    required: week.slots.length,
    uploaded: week.slots.filter(isDone).length,
    approved: week.slots.filter((s) => ['approved', 'ready', 'posted'].includes(s.status)).length,
    awaitingReview: week.slots.filter((s) => s.status === 'uploaded').length,
    failed: week.slots.filter((s) => s.status === 'failed').length,
    todayRequired: today.length,
    todayDone: today.filter(isDone).length,
  };
}

/** The dealer-facing pipeline only ever sees approved work. */
export const releasableSlots = (week: OpsWeek): readonly OutputSlot[] =>
  week.slots.filter((s) => ['approved', 'ready', 'posted'].includes(s.status));
