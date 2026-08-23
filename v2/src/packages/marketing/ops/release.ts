/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing Ops — release into the dealer's own Marketing

   When an operator approves a creative it must reach the dealer
   through their EXISTING MAPCO Marketing experience — not a second,
   parallel marketing database.

   In production this maps onto the existing tables:

     marketing_creatives      the approved asset + its copy
     marketing_schedule_items the dealer-visible slot and approval state

   Publishing connectors are NOT implemented. Nothing here claims a post
   was published. An approved creative reaches `ready_to_publish` and
   stops there, honestly, until a real connector exists.
   ═══════════════════════════════════════════════════════════════ */
import type { CreativeAsset, OutputSlot } from './types';

/** Honest terminal state for this milestone. */
export type ReleaseState = 'ready_to_publish' | 'published';

export interface ReleasedCreative {
  readonly dealerId: string;
  readonly slotRef: string;
  readonly weekId: string;
  readonly localDate: string;
  readonly propertyIds: readonly string[];
  readonly caption?: string;
  readonly assetId: string;
  readonly state: ReleaseState;
  readonly approvedBy?: string;
  readonly approvedAt?: string;
  /** Maps to marketing_creatives.design_key — operator-made, not templated. */
  readonly designKey: 'operator-chatgpt-v1';
}

/**
 * Project an approved slot into the shape the dealer's Marketing
 * pipeline consumes. Pure — persistence is the caller's job.
 */
export function toReleasedCreative(slot: OutputSlot, asset: CreativeAsset): ReleasedCreative | null {
  if (!['approved', 'ready', 'posted'].includes(slot.status)) return null;
  return {
    dealerId: slot.dealerId,
    slotRef: slot.ref,
    weekId: slot.weekId,
    localDate: slot.localDate,
    propertyIds: slot.propertyIds,
    caption: slot.caption,
    assetId: asset.id,
    // Never 'published' unless a real connector reported success.
    state: slot.status === 'posted' ? 'published' : 'ready_to_publish',
    approvedBy: slot.approvedBy,
    approvedAt: slot.approvedAt,
    designKey: 'operator-chatgpt-v1',
  };
}

/** Everything the dealer should now be able to see. */
export function releasedForDealer(
  slots: readonly OutputSlot[], assets: readonly CreativeAsset[],
): readonly ReleasedCreative[] {
  const byRef = new Map(assets.map((a) => [a.slotRef, a]));
  return slots
    .map((slot) => {
      const asset = byRef.get(slot.ref);
      return asset ? toReleasedCreative(slot, asset) : null;
    })
    .filter((r): r is ReleasedCreative => r !== null)
    // A dealer must only ever receive their own work.
    .filter((r) => slots.every((s) => s.dealerId === r.dealerId));
}

/** True when a real publishing connector exists for this channel. */
export const canGenuinelyPublish = (): boolean => false;

export const RELEASE_NOTE =
  'Approved creatives reach “Ready to publish”. MAPCO has no live Instagram, ' +
  'Facebook or Google Business connector yet, so nothing is auto-posted and no ' +
  'publish result is simulated.';
