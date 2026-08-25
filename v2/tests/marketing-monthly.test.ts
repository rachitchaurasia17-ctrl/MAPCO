import { describe, expect, it } from 'vitest';
import {
  FINISHED_REEL_MAX_BYTES,
  MONTHLY_POST_ENTITLEMENT,
  MONTHLY_REEL_ENTITLEMENT,
  MonthlyMarketingLedger,
  MarketingQuotaError,
  calendarMarketingPeriod,
  canTransitionReel,
  createMonthlyPostSlots,
  filterMarketingLibrary,
  marketingSafePropertyFacts,
  reelStoragePath,
  validateReelUpload,
  type MarketingLibraryRecord,
} from '../src/packages/marketing';
import { defaultActionFor } from '../src/packages/marketing/publishing';
import { PROPERTIES } from '../src/packages/data/mock-adapter';

const HASH = 'a'.repeat(64);
const period = calendarMarketingPeriod('dealer-a', '2026-08-23');

describe('canonical monthly Marketing period', () => {
  it('represents exactly 30 Posts and 8 Reels for the calendar month', () => {
    expect(period).toMatchObject({
      periodStart: '2026-08-01', periodEnd: '2026-08-31',
      postsEntitled: 30, reelsEntitled: 8, kind: 'calendar_month', anchorDay: 1,
    });
    expect(MONTHLY_POST_ENTITLEMENT).toBe(30);
    expect(MONTHLY_REEL_ENTITLEMENT).toBe(8);
    const slots = createMonthlyPostSlots(period);
    expect(slots).toHaveLength(30);
    expect(slots[0]!.slotRef).toBe('P001');
    expect(slots[29]!.slotRef).toBe('P030');
    expect(slots.every((slot) => !slot.entitlementConsumed)).toBe(true);
  });

  it('starts a fresh entitlement in a new month', () => {
    const september = calendarMarketingPeriod('dealer-a', '2026-09-01');
    expect(september.id).not.toBe(period.id);
    expect(september.periodStart).toBe('2026-09-01');
    expect(september.periodEnd).toBe('2026-09-30');
    expect(createMonthlyPostSlots(september)).toHaveLength(30);
  });
});

describe('monthly Post quota', () => {
  it('allows 30 consumed slots and rejects a normal 31st', async () => {
    const ledger = new MonthlyMarketingLedger(period, createMonthlyPostSlots(period));
    for (let index = 1; index <= 30; index += 1) {
      await ledger.claimPost({ propertyId: `p-${index}`, idempotencyKey: `post-key-${index}` });
    }
    expect(ledger.usage()).toMatchObject({ postsUsed: 30, postsRemaining: 0 });
    await expect(ledger.claimPost({ propertyId: 'p-31', idempotencyKey: 'post-key-31' }))
      .rejects.toMatchObject({ code: 'post_quota_exhausted' });
  });

  it('makes exact retries idempotent and conflicting retries fail', async () => {
    const ledger = new MonthlyMarketingLedger(period, createMonthlyPostSlots(period));
    const first = await ledger.claimPost({
      propertyId: 'p-1', idempotencyKey: 'post-key-1', scheduledFor: '2026-08-12',
    });
    const retry = await ledger.claimPost({
      propertyId: 'p-1', idempotencyKey: 'post-key-1', scheduledFor: '2026-08-12',
    });
    expect(retry.idempotent).toBe(true);
    expect(retry.value.id).toBe(first.value.id);
    expect(ledger.usage().postsUsed).toBe(1);
    await expect(ledger.claimPost({
      propertyId: 'p-2', idempotencyKey: 'post-key-1', scheduledFor: '2026-08-12',
    })).rejects.toBeInstanceOf(MarketingQuotaError);
  });
});

describe('monthly Reel quota', () => {
  it('allows exactly 8 jobs and rejects the 9th', async () => {
    const ledger = new MonthlyMarketingLedger(period, createMonthlyPostSlots(period));
    for (let index = 1; index <= 8; index += 1) {
      await ledger.submitReel({
        propertyId: `p-${index}`, submissionKey: `reel-key-${index}`,
        rawContentHash: String(index).padStart(64, '0'),
      });
    }
    expect(ledger.usage()).toMatchObject({ reelsUsed: 8, reelsRemaining: 0 });
    await expect(ledger.submitReel({
      propertyId: 'p-9', submissionKey: 'reel-key-9', rawContentHash: '9'.repeat(64),
    })).rejects.toMatchObject({ code: 'reel_quota_exhausted' });
  });

  it('serializes concurrent submissions so quota cannot be bypassed', async () => {
    const ledger = new MonthlyMarketingLedger(period, createMonthlyPostSlots(period));
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, index) =>
      ledger.submitReel({
        propertyId: `p-${index}`, submissionKey: `concurrent-${index}`,
        rawContentHash: index.toString(16).padStart(64, '0'),
      })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(8);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(12);
    expect(ledger.reelJobs()).toHaveLength(8);
    expect(ledger.usage().reelsRemaining).toBe(0);
  });

  it('retries and raw replacements reuse the same quota entitlement', async () => {
    const ledger = new MonthlyMarketingLedger(period, createMonthlyPostSlots(period));
    const first = await ledger.submitReel({
      propertyId: 'p-1', submissionKey: 'same-reel-key', rawContentHash: HASH,
    });
    const retry = await ledger.submitReel({
      propertyId: 'p-1', submissionKey: 'same-reel-key', rawContentHash: HASH,
    });
    const replacement = await ledger.replaceRaw(first.value.id);
    expect(retry.idempotent).toBe(true);
    expect(replacement.id).toBe(first.value.id);
    expect(replacement.rawRevision).toBe(2);
    expect(ledger.usage().reelsUsed).toBe(1);
  });

  it('enforces received → in_editing → ready as the simple operator path', () => {
    expect(canTransitionReel('received', 'in_editing')).toBe(true);
    expect(canTransitionReel('in_editing', 'ready')).toBe(true);
    expect(canTransitionReel('received', 'ready')).toBe(false);
    expect(canTransitionReel('ready', 'in_editing')).toBe(false);
  });
});

describe('private Reel media and canonical property integration', () => {
  it('validates raw and finished video MIME, size and SHA-256', () => {
    expect(validateReelUpload('video/mp4', 1024, HASH)).toEqual([]);
    expect(validateReelUpload('image/jpeg', 1024, HASH).map((x) => x.field)).toContain('mime');
    expect(validateReelUpload('video/mp4', FINISHED_REEL_MAX_BYTES + 1, HASH, 'finished')
      .map((x) => x.field)).toContain('bytes');
    expect(validateReelUpload('video/mp4', 1024, 'not-a-hash').map((x) => x.field)).toContain('contentHash');
  });

  it('derives a private canonical path rather than accepting a caller path', () => {
    const path = reelStoragePath({
      dealerId: 'dealer-a', periodStart: '2026-08-01', jobId: 'job-1',
      kind: 'raw', contentHash: HASH, mime: 'video/mp4',
    });
    expect(path).toBe(`dealer-a/2026-08-01/job-1/raw/${HASH}.mp4`);
    expect(() => reelStoragePath({
      dealerId: '../dealer-b', periodStart: '2026-08-01', jobId: 'job-1',
      kind: 'raw', contentHash: HASH, mime: 'video/mp4',
    })).toThrow(/unsafe/i);
  });

  it('blocks sold stock from new Marketing and strips every private field', () => {
    const property = PROPERTIES.find((item) => item.published && !item.sold)!;
    const safe = marketingSafePropertyFacts({
      ...property,
      lifecycle: 'on-sale',
      owner: { name: 'Private Seller', phone: '+919999999999' },
      location: { latitude: 30.1, longitude: 76.7 },
      mapPlacement: { mapId: 'private-map', x: 10, y: 20 },
      price: 99999999,
    });
    const encoded = JSON.stringify(safe).toLowerCase();
    for (const forbidden of ['seller', 'phone', 'price', 'latitude', 'longitude', 'mapplacement', 'document']) {
      expect(encoded).not.toContain(forbidden);
    }
    expect(() => marketingSafePropertyFacts({ ...property, lifecycle: 'sold', sold: true }))
      .toThrow(/not_marketable/i);
  });
});

describe('one canonical Marketing Library and publishing controls', () => {
  const records: MarketingLibraryRecord[] = [
    { id: 'p1', creativeType: 'post', propertyId: 'a', propertyLabel: 'A', createdAt: 'x', publishingStatus: 'approved', platforms: [] },
    { id: 'r1', creativeType: 'reel', propertyId: 'a', propertyLabel: 'A', createdAt: 'x', publishingStatus: 'approved', platforms: [] },
  ];

  it('filters All, Posts, and Reels without a second creative store', () => {
    expect(filterMarketingLibrary(records, 'all')).toHaveLength(2);
    expect(filterMarketingLibrary(records, 'posts').map((item) => item.id)).toEqual(['p1']);
    expect(filterMarketingLibrary(records, 'reels').map((item) => item.id)).toEqual(['r1']);
  });

  it('uses the existing publishing action vocabulary for a ready Reel', () => {
    expect(defaultActionFor('instagram', 'reel')).toBe('reel');
    expect(defaultActionFor('facebook_page', 'reel')).toBe('reel');
    expect(defaultActionFor('google_business', 'post')).toBe('local_post');
  });
});

