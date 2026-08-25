import {
  MONTHLY_POST_ENTITLEMENT,
  MONTHLY_REEL_ENTITLEMENT,
  type MarketingPeriod,
  type MarketingUsage,
  type MonthlyPostSlot,
  type ReelJob,
  type ReelJobState,
} from './types';

const dateOnly = (value: Date | string): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid marketing period date');
  return date.toISOString().slice(0, 10);
};

export function calendarMarketingPeriod(dealerId: string, asOf: Date | string): MarketingPeriod {
  const day = dateOnly(asOf);
  const [year, month] = day.split('-').map(Number) as [number, number, number];
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(year, month, 0));
  const end = endDate.toISOString().slice(0, 10);
  return {
    id: `${dealerId}::${start}`,
    dealerId,
    periodStart: start,
    periodEnd: end,
    kind: 'calendar_month',
    anchorDay: 1,
    postsEntitled: MONTHLY_POST_ENTITLEMENT,
    reelsEntitled: MONTHLY_REEL_ENTITLEMENT,
  };
}

export const monthlyPostRef = (slotNumber: number): string =>
  `P${String(slotNumber).padStart(3, '0')}`;

export function createMonthlyPostSlots(period: MarketingPeriod): readonly MonthlyPostSlot[] {
  return Array.from({ length: period.postsEntitled }, (_, index) => {
    const slotNumber = index + 1;
    return {
      id: `${period.id}::${monthlyPostRef(slotNumber)}`,
      dealerId: period.dealerId,
      periodId: period.id,
      slotNumber,
      slotRef: monthlyPostRef(slotNumber),
      state: 'waiting_for_input' as const,
      entitlementConsumed: false,
    };
  });
}

export function marketingUsage(
  period: MarketingPeriod,
  posts: readonly MonthlyPostSlot[],
  reels: readonly ReelJob[],
): MarketingUsage {
  const postsUsed = posts.filter((slot) =>
    slot.periodId === period.id && slot.entitlementConsumed).length;
  const reelsUsed = reels.filter((job) =>
    job.periodId === period.id && job.quotaConsumed).length;
  return {
    postsEntitled: period.postsEntitled,
    postsUsed,
    postsRemaining: Math.max(0, period.postsEntitled - postsUsed),
    reelsEntitled: period.reelsEntitled,
    reelsUsed,
    reelsRemaining: Math.max(0, period.reelsEntitled - reelsUsed),
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  };
}

const REEL_TRANSITIONS: Readonly<Record<ReelJobState, readonly ReelJobState[]>> = {
  awaiting_upload: ['received', 'failed'],
  received: ['in_editing', 'failed', 'replacement_needed'],
  in_editing: ['ready', 'failed', 'replacement_needed'],
  ready: [],
  failed: ['awaiting_upload', 'replacement_needed'],
  replacement_needed: ['awaiting_upload', 'in_editing'],
};

export function canTransitionReel(from: ReelJobState, to: ReelJobState): boolean {
  return from === to || REEL_TRANSITIONS[from].includes(to);
}
