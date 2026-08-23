/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing Ops — mid-week new property workflow

   A weekly plan is a LIVING production schedule, not a frozen export.
   When a dealer publishes new marketable stock mid-week, MAPCO must
   notice, prepare that one property for ChatGPT, and work out where it
   should go — without regenerating the week and without ever silently
   destroying work.

   MAPCO's intelligence here is OPERATIONAL SCHEDULING only. It decides
   "use P284 for C013 on Thursday". It never decides the design, the
   prompt, the headline or the angle — those stay with the operator and
   ChatGPT.
   ═══════════════════════════════════════════════════════════════ */
import type { Property } from '../../data/types';
import type { DealerBrand } from '../types';
import { buildFactPack } from '../facts/fact-pack';
import { createZip, fetchBytes, type ZipEntry } from '../pack/zip';
import {
  photoFileName, propertyRef, renderDealerInfo, renderPropertyBrief,
} from './property-brief';
import { assertDealerAccess, type OperatorDealerAccess } from './types';
import type { OpsWeek, OutputSlot, SlotRef } from './types';

/* ── lifecycle ───────────────────────────────────────────────── */

/**
 * How far a new property has travelled through the ops workflow.
 * Deliberately separate from slot status: a downloaded pack does NOT
 * mean the property has been marketed.
 */
export type NewPropertyStage =
  | 'pack_ready'
  | 'pack_downloaded'
  | 'assigned'
  | 'creative_uploaded'
  | 'approved'
  | 'posted'
  | 'dismissed';

export const TERMINAL_STAGES: readonly NewPropertyStage[] = ['approved', 'posted', 'dismissed'];

/** True once the property genuinely no longer needs marketing attention. */
export const isHandled = (stage: NewPropertyStage): boolean => TERMINAL_STAGES.includes(stage);

export interface NewPropertyAction {
  readonly id: string;              // dealerId::weekId::propertyId — idempotent
  readonly dealerId: string;
  readonly weekId: string;
  readonly propertyId: string;
  readonly propertyRef: string;
  readonly propertyLabel: string;
  readonly detectedAt: string;
  readonly stage: NewPropertyStage;
  /** MAPCO's operational suggestion. Never auto-applied to protected work. */
  readonly recommendation: SlotRecommendation;
  /** Set once the operator actually assigns it. */
  readonly assignedSlotRef?: SlotRef;
}

/* ── detection ───────────────────────────────────────────────── */

export interface DetectionInput {
  readonly dealerId: string;
  readonly weekId: string;
  readonly properties: readonly Property[];
  /** Property ids already present when the week was opened. */
  readonly baselinePropertyIds: readonly string[];
  /** Actions already raised — used for idempotency. */
  readonly existing: readonly NewPropertyAction[];
}

/** A property must be genuinely marketable before it raises an action. */
export function isMarketableForOps(property: Property): boolean {
  if (property.sold) return false;
  if (!property.published) return false;
  const photos = (property.photos ?? []).filter((u) => u && u.trim() && !u.startsWith('data:image/svg'));
  if (!photos.length) return false;
  return buildFactPack(property) !== null;
}

/**
 * Reconciliation, not polling: compare the dealer's current marketable
 * inventory against the baseline captured when the week opened.
 *
 * In production the same function is driven by the property write flow
 * (a create/publish event supplies the property); the comparison is
 * kept deterministic so both paths agree.
 */
export function detectNewProperties(input: DetectionInput): readonly string[] {
  const baseline = new Set(input.baselinePropertyIds);
  const raised = new Set(input.existing.map((a) => a.propertyId));
  return input.properties
    .filter((p) => !baseline.has(p.id))     // genuinely new to this week
    .filter((p) => !raised.has(p.id))       // idempotent — never raise twice
    .filter(isMarketableForOps)
    .map((p) => p.id);
}

/* ── slot recommendation ─────────────────────────────────────── */

export type RecommendationKind =
  | 'today_open'          // an empty slot remains today
  | 'future_open'         // earliest empty slot on a later day
  | 'replace_suggestion'  // only unapproved work would be displaced
  | 'unscheduled';        // nothing safely available this week

export interface SlotRecommendation {
  readonly kind: RecommendationKind;
  readonly slotRef?: SlotRef;
  readonly localDate?: string;
  readonly dayIndex?: number;
  /** Plain-language justification shown to the operator. */
  readonly reason: string;
  /** True when acting on this would displace existing operator work. */
  readonly requiresConfirmation: boolean;
}

/** Statuses MAPCO must never automatically displace. */
const PROTECTED: readonly OutputSlot['status'][] = ['approved', 'ready', 'posted'];
/** Work that exists but could be replaced, with confirmation. */
const DISPLACEABLE: readonly OutputSlot['status'][] = ['uploaded', 'reviewed'];

export interface RecommendInput {
  readonly week: OpsWeek;
  readonly todayIso: string;
  /** Slots already promised to other new properties in this same pass. */
  readonly reservedRefs?: readonly SlotRef[];
}

/**
 * Choose where a new property should go.
 *
 * Order of preference:
 *   1. an empty slot remaining today
 *   2. the earliest empty slot on a future day
 *   3. the least disruptive future slot holding unapproved work (needs confirmation)
 *   4. nothing — raise an unscheduled action rather than displace approved work
 *
 * Never returns a protected slot without `requiresConfirmation`, and
 * never returns a past day.
 */
export function recommendSlot(input: RecommendInput): SlotRecommendation {
  const reserved = new Set(input.reservedRefs ?? []);
  const today = input.todayIso;

  const upcoming = input.week.slots
    .filter((s) => s.localDate >= today)
    .filter((s) => !reserved.has(s.ref))
    .slice()
    .sort((a, b) => a.localDate.localeCompare(b.localDate) || a.slotIndex - b.slotIndex);

  // 1. empty slot today
  const openToday = upcoming.find((s) => s.localDate === today && s.status === 'waiting');
  if (openToday) {
    return {
      kind: 'today_open',
      slotRef: openToday.ref,
      localDate: openToday.localDate,
      dayIndex: openToday.dayIndex,
      reason: `${openToday.ref} is still empty today.`,
      requiresConfirmation: false,
    };
  }

  // 2. earliest empty future slot
  const openFuture = upcoming.find((s) => s.localDate > today && s.status === 'waiting');
  if (openFuture) {
    return {
      kind: 'future_open',
      slotRef: openFuture.ref,
      localDate: openFuture.localDate,
      dayIndex: openFuture.dayIndex,
      reason: `Today is already full, so the earliest free slot is ${openFuture.ref} on ${openFuture.localDate}.`,
      requiresConfirmation: false,
    };
  }

  // 3. least disruptive replacement — unapproved work only, latest first
  //    so the nearest-term commitments are disturbed last.
  const displaceable = upcoming
    .filter((s) => s.localDate > today && DISPLACEABLE.includes(s.status))
    .sort((a, b) => b.localDate.localeCompare(a.localDate) || b.slotIndex - a.slotIndex)[0];
  if (displaceable) {
    return {
      kind: 'replace_suggestion',
      slotRef: displaceable.ref,
      localDate: displaceable.localDate,
      dayIndex: displaceable.dayIndex,
      reason: `Every slot is taken. ${displaceable.ref} on ${displaceable.localDate} holds work that is uploaded but not approved — it is the least disruptive to replace.`,
      requiresConfirmation: true,
    };
  }

  // 4. nothing safe. Never displace approved/ready/posted automatically.
  const protectedCount = upcoming.filter((s) => PROTECTED.includes(s.status)).length;
  return {
    kind: 'unscheduled',
    reason: protectedCount
      ? `All remaining slots this week are approved or already posted. This property carries over to next week unless you deliberately replace one.`
      : `No slot remains this week. This property carries over to next week's pack.`,
    requiresConfirmation: true,
  };
}

/* ── raising actions ─────────────────────────────────────────── */

export const actionId = (dealerId: string, weekId: string, propertyId: string): string =>
  `${dealerId}::${weekId}::${propertyId}`;

export interface RaiseInput {
  readonly dealerId: string;
  readonly weekId: string;
  readonly week: OpsWeek;
  readonly todayIso: string;
  readonly properties: readonly Property[];
  readonly newPropertyIds: readonly string[];
  readonly detectedAt?: string;
}

/**
 * Raise one action per new property, scheduling them across DIFFERENT
 * remaining slots so three properties added on Wednesday never all land
 * on the same slot.
 */
export function raiseActions(input: RaiseInput): readonly NewPropertyAction[] {
  const byId = new Map(input.properties.map((p) => [p.id, p]));
  const reserved: SlotRef[] = [];
  const detectedAt = input.detectedAt ?? new Date().toISOString();
  const actions: NewPropertyAction[] = [];

  for (const propertyId of input.newPropertyIds) {
    const property = byId.get(propertyId);
    if (!property) continue;
    const recommendation = recommendSlot({
      week: input.week, todayIso: input.todayIso, reservedRefs: reserved,
    });
    // Only a slot we would actually take is reserved against the next one.
    if (recommendation.slotRef && !recommendation.requiresConfirmation) {
      reserved.push(recommendation.slotRef);
    }
    actions.push({
      id: actionId(input.dealerId, input.weekId, propertyId),
      dealerId: input.dealerId,
      weekId: input.weekId,
      propertyId,
      propertyRef: propertyRef(property),
      propertyLabel: `${property.area || property.type} · ${property.size}`,
      detectedAt,
      stage: 'pack_ready',
      recommendation,
    });
  }
  return actions;
}

export interface BacklogSummary {
  readonly scheduledThisWeek: number;
  readonly queuedForNextWeek: number;
  readonly needingConfirmation: number;
  readonly line: string;
}

/** Honest backlog: never invent an extra deliverable to absorb overflow. */
export function summariseBacklog(actions: readonly NewPropertyAction[]): BacklogSummary {
  const open = actions.filter((a) => !isHandled(a.stage));
  const scheduled = open.filter((a) => a.recommendation.slotRef && !a.recommendation.requiresConfirmation).length;
  const confirm = open.filter((a) => a.recommendation.requiresConfirmation && a.recommendation.slotRef).length;
  const queued = open.filter((a) => a.recommendation.kind === 'unscheduled').length;
  const parts: string[] = [];
  if (scheduled) parts.push(`${scheduled} scheduled this week`);
  if (confirm) parts.push(`${confirm} needing your confirmation`);
  if (queued) parts.push(`${queued} queued for next week's plan`);
  return {
    scheduledThisWeek: scheduled,
    queuedForNextWeek: queued,
    needingConfirmation: confirm,
    line: parts.join(' · ') || 'No new inventory this week.',
  };
}

/* ── the individual property pack ────────────────────────────── */

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

export interface NewPropertyPackResult {
  readonly blob: Blob;
  readonly fileName: string;
  readonly photoCount: number;
}

/**
 * A single-property ChatGPT pack. Same factual and security rules as the
 * full inventory pack: no template, no generated prompt, no invented fact.
 */
export async function buildNewPropertyPack(
  operator: OperatorDealerAccess,
  dealerId: string,
  brand: DealerBrand,
  property: Property,
  weekId: string,
): Promise<NewPropertyPackResult> {
  assertDealerAccess(operator, dealerId);

  const brief = renderPropertyBrief(property, brand);
  if (!brief) throw new Error('This property is not marketable');

  const ref = propertyRef(property);
  const root = `NEW-PROPERTY-${ref}`;
  const entries: ZipEntry[] = [
    { path: `${root}/MAPCO-PROPERTY-BRIEF.md`, data: utf8(brief) },
    { path: `${root}/DEALER-INFO.md`, data: utf8(renderDealerInfo(brand, 1, weekId)) },
  ];

  if (brand.logoUrl) {
    const logo = await fetchBytes(brand.logoUrl);
    if (logo) entries.push({ path: `${root}/DEALER-LOGO.png`, data: logo });
  }

  const photos = (property.photos ?? []).filter((u) => u && u.trim());
  let photoCount = 0;
  for (let i = 0; i < photos.length; i++) {
    const bytes = await fetchBytes(photos[i]!);
    if (!bytes) continue;
    entries.push({ path: `${root}/${photoFileName(property, i, photos[i]!)}`, data: bytes });
    photoCount++;
  }

  return { blob: createZip(entries), fileName: `${root}.zip`, photoCount };
}

/* ── upload-back context ─────────────────────────────────────── */

export interface UploadSuggestion {
  readonly slotRef?: SlotRef;
  readonly propertyId?: string;
  readonly reason: string;
}

/**
 * When the operator uploads an image, suggest the slot and property
 * MAPCO recommended for a downloaded/assigned new-property pack — so
 * they need not remember where it was meant to go.
 *
 * Never crosses dealers: only actions for THIS dealer are considered.
 */
export function suggestForUpload(
  dealerId: string,
  actions: readonly NewPropertyAction[],
  slotRef: SlotRef,
): UploadSuggestion {
  const match = actions
    .filter((a) => a.dealerId === dealerId)
    .filter((a) => !isHandled(a.stage))
    .find((a) => (a.assignedSlotRef ?? a.recommendation.slotRef) === slotRef);
  if (!match) return { reason: 'No new-property context for this slot.' };
  return {
    slotRef,
    propertyId: match.propertyId,
    reason: `${match.propertyRef} was prepared for ${slotRef}${match.assignedSlotRef ? '' : ' (MAPCO recommendation)'}.`,
  };
}

/* ── mid-week recalculation ──────────────────────────────────── */

/**
 * Recalculate only the MUTABLE future. Completed history is never
 * rebuilt: approved, ready and posted slots are returned untouched.
 */
export function recalculateFuture(
  week: OpsWeek, todayIso: string, assignments: ReadonlyMap<SlotRef, string>,
): OpsWeek {
  return {
    ...week,
    slots: week.slots.map((slot) => {
      if (slot.localDate < todayIso) return slot;               // the past is immutable
      if (PROTECTED.includes(slot.status)) return slot;          // protected work is immutable
      const propertyId = assignments.get(slot.ref);
      if (!propertyId) return slot;
      return { ...slot, propertyIds: [propertyId] };
    }),
  };
}
