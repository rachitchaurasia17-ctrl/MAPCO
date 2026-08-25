import { createHash } from './shared/hash';
import { marketingUsage } from './period';
import {
  MarketingQuotaError,
  type MarketingPeriod,
  type MarketingUsage,
  type MonthlyPostSlot,
  type ReelJob,
} from './types';

export interface ClaimPostInput {
  readonly propertyId: string;
  readonly idempotencyKey: string;
  readonly scheduledFor?: string;
  readonly now?: string;
}

export interface SubmitReelInput {
  readonly propertyId: string;
  readonly submissionKey: string;
  readonly note?: string;
  readonly rawContentHash: string;
  readonly now?: string;
}

export interface QuotaResult<T> {
  readonly value: T;
  readonly idempotent: boolean;
}

const fingerprint = (value: object): string => createHash(JSON.stringify(value));

/**
 * Deterministic in-memory contract for the server-side quota RPCs. The promise
 * gate mirrors the database advisory lock, so concurrent callers observe one
 * serial entitlement ledger rather than racing on a stale count.
 */
export class MonthlyMarketingLedger {
  private posts: MonthlyPostSlot[];
  private reels: ReelJob[];
  private gate: Promise<void> = Promise.resolve();

  constructor(public readonly period: MarketingPeriod, posts?: readonly MonthlyPostSlot[], reels?: readonly ReelJob[]) {
    this.posts = [...(posts ?? [])];
    this.reels = [...(reels ?? [])];
  }

  private async serial<T>(operation: () => T): Promise<T> {
    const before = this.gate;
    let release!: () => void;
    this.gate = new Promise<void>((resolve) => { release = resolve; });
    await before;
    try { return operation(); } finally { release(); }
  }

  async claimPost(input: ClaimPostInput): Promise<QuotaResult<MonthlyPostSlot>> {
    return this.serial(() => {
      const requestFingerprint = fingerprint({
        propertyId: input.propertyId,
        scheduledFor: input.scheduledFor ?? null,
      });
      const prior = this.posts.find((slot) => slot.idempotencyKey === input.idempotencyKey);
      if (prior) {
        if (prior.requestFingerprint !== requestFingerprint) {
          throw new MarketingQuotaError('idempotency_conflict');
        }
        return { value: prior, idempotent: true };
      }
      const index = this.posts.findIndex((slot) => !slot.entitlementConsumed);
      if (index < 0) throw new MarketingQuotaError('post_quota_exhausted');
      const claimed: MonthlyPostSlot = {
        ...this.posts[index]!,
        propertyId: input.propertyId,
        ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
        state: 'in_production',
        entitlementConsumed: true,
        consumedAt: input.now ?? new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
        requestFingerprint,
      };
      this.posts[index] = claimed;
      return { value: claimed, idempotent: false };
    });
  }

  async submitReel(input: SubmitReelInput): Promise<QuotaResult<ReelJob>> {
    return this.serial(() => {
      const requestFingerprint = fingerprint({
        propertyId: input.propertyId,
        note: input.note?.trim() || null,
        rawContentHash: input.rawContentHash,
      });
      const prior = this.reels.find((job) => job.submissionKey === input.submissionKey);
      if (prior) {
        if (prior.requestFingerprint !== requestFingerprint) {
          throw new MarketingQuotaError('idempotency_conflict');
        }
        return { value: prior, idempotent: true };
      }
      if (this.reels.filter((job) => job.quotaConsumed).length >= this.period.reelsEntitled) {
        throw new MarketingQuotaError('reel_quota_exhausted');
      }
      const quotaNumber = this.reels.filter((job) => job.quotaConsumed).length + 1;
      const createdAt = input.now ?? new Date().toISOString();
      const job: ReelJob = {
        id: `${this.period.id}::R${String(quotaNumber).padStart(3, '0')}`,
        dealerId: this.period.dealerId,
        periodId: this.period.id,
        quotaNumber,
        propertyId: input.propertyId,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        state: 'awaiting_upload',
        submissionKey: input.submissionKey,
        requestFingerprint,
        quotaConsumed: true,
        rawRevision: 1,
        createdAt,
      };
      this.reels.push(job);
      return { value: job, idempotent: false };
    });
  }

  async replaceRaw(jobId: string): Promise<ReelJob> {
    return this.serial(() => {
      const index = this.reels.findIndex((job) => job.id === jobId);
      if (index < 0) throw new Error('reel_not_found');
      const replacement: ReelJob = {
        ...this.reels[index]!,
        state: 'awaiting_upload',
        rawRevision: this.reels[index]!.rawRevision + 1,
      };
      this.reels[index] = replacement;
      return replacement;
    });
  }

  usage(): MarketingUsage { return marketingUsage(this.period, this.posts, this.reels); }
  postSlots(): readonly MonthlyPostSlot[] { return [...this.posts]; }
  reelJobs(): readonly ReelJob[] { return [...this.reels]; }
}
