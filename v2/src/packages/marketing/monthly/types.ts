export const MONTHLY_POST_ENTITLEMENT = 30 as const;
export const MONTHLY_REEL_ENTITLEMENT = 8 as const;

export type MarketingCreativeType = 'post' | 'reel';
export type MarketingPeriodKind = 'calendar_month' | 'billing_cycle';

export interface MarketingPeriod {
  readonly id: string;
  readonly dealerId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly kind: MarketingPeriodKind;
  readonly anchorDay: number;
  readonly postsEntitled: number;
  readonly reelsEntitled: number;
}

export type MonthlyPostState =
  | 'waiting_for_input'
  | 'in_production'
  | 'ready_for_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'replacement_needed';

export interface MonthlyPostSlot {
  readonly id: string;
  readonly dealerId: string;
  readonly periodId: string;
  readonly slotNumber: number;
  readonly slotRef: string;
  readonly state: MonthlyPostState;
  readonly propertyId?: string;
  readonly scheduledFor?: string;
  readonly entitlementConsumed: boolean;
  readonly consumedAt?: string;
  readonly idempotencyKey?: string;
  readonly requestFingerprint?: string;
  readonly creativeId?: string;
}

export type ReelJobState =
  | 'awaiting_upload'
  | 'received'
  | 'in_editing'
  | 'ready'
  | 'failed'
  | 'replacement_needed';

export interface ReelJob {
  readonly id: string;
  readonly dealerId: string;
  readonly periodId: string;
  readonly quotaNumber: number;
  readonly propertyId: string;
  readonly note?: string;
  readonly state: ReelJobState;
  readonly submissionKey: string;
  readonly requestFingerprint: string;
  readonly quotaConsumed: true;
  readonly rawRevision: number;
  readonly creativeId?: string;
  readonly createdAt: string;
  readonly readyAt?: string;
}

export interface MarketingUsage {
  readonly postsEntitled: number;
  readonly postsUsed: number;
  readonly postsRemaining: number;
  readonly reelsEntitled: number;
  readonly reelsUsed: number;
  readonly reelsRemaining: number;
  readonly periodStart: string;
  readonly periodEnd: string;
}

export class MarketingQuotaError extends Error {
  constructor(
    public readonly code: 'post_quota_exhausted' | 'reel_quota_exhausted' | 'idempotency_conflict',
  ) {
    super(code);
    this.name = 'MarketingQuotaError';
  }
}

