/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing Operations — internal domain types

   The operator is the creative director. MAPCO tracks PRODUCTION, not
   creative strategy: 7 days × 4 output slots = 28 required outputs per
   dealer per week.

   A slot is an empty box to be filled. It carries no property, no
   template, no angle and no prompt at planning time — those are the
   operator's decisions, recorded only when they upload the result.
   ═══════════════════════════════════════════════════════════════ */

/** Operator-facing slot reference within a week: 'C001'…'C028'. */
export type SlotRef = string;

export type SlotStatus =
  | 'waiting'      // nothing produced yet
  | 'uploaded'     // operator has attached an image
  | 'reviewed'     // an internal reviewer has looked at it
  | 'approved'     // cleared to reach the dealer
  | 'ready'        // released into the dealer's Marketing pipeline
  | 'posted'       // genuinely published (only when a connector exists)
  | 'failed';      // needs replacing

export const SLOT_STATUSES: readonly SlotStatus[] = [
  'waiting', 'uploaded', 'reviewed', 'approved', 'ready', 'posted', 'failed',
];

export const SLOT_STATUS_LABEL: Record<SlotStatus, string> = {
  waiting: 'Waiting',
  uploaded: 'Uploaded',
  reviewed: 'Reviewed',
  approved: 'Approved',
  ready: 'Ready to publish',
  posted: 'Posted',
  failed: 'Needs replacing',
};

export interface OutputSlot {
  /** Database identity in Supabase mode. Local/mock weeks may omit it. */
  readonly id?: string;
  readonly ref: SlotRef;
  readonly dealerId: string;
  readonly weekId: string;
  readonly dayIndex: number;      // 0–6
  readonly localDate: string;     // YYYY-MM-DD
  readonly slotIndex: number;     // 0–3
  readonly status: SlotStatus;
  /** Properties the operator actually used. Recorded on upload, not planned. */
  readonly propertyIds: readonly string[];
  /** Explicit operator-selected delivery channels. Never inferred. */
  readonly channels?: readonly ('instagram' | 'facebook_page' | 'google_business' | 'whatsapp_business')[];
  readonly caption?: string;
  readonly note?: string;
  readonly assetId?: string;
  readonly uploadedBy?: string;
  readonly uploadedAt?: string;
  readonly approvedBy?: string;
  readonly approvedAt?: string;
}

export interface OpsWeek {
  readonly dealerId: string;
  readonly weekId: string;
  readonly weekStart: string;
  readonly timezone: string;
  readonly perDay: number;
  readonly slots: readonly OutputSlot[];
  readonly createdAt: string;
}

/** A stored final creative. Private; never a public URL. */
export interface CreativeAsset {
  readonly id: string;
  readonly dealerId: string;
  readonly slotRef: SlotRef;
  readonly weekId: string;
  readonly fileName: string;
  readonly mime: string;
  readonly bytes: number;
  readonly width?: number;
  readonly height?: number;
  /** Runtime-only preview. Supabase mode uses a short-lived signed URL. */
  readonly displayUrl?: string;
  /** Mock-only inline preview retained for deterministic unit tests. */
  readonly dataUrl?: string;
  readonly uploadedBy: string;
  readonly uploadedAt: string;
}

/* ── multi-dealer access control ─────────────────────────────── */

export interface OperatorDealerAccess {
  readonly operatorId: string;
  /** Dealer ids this operator may work on. Empty = none. */
  readonly dealerIds: readonly string[];
  /** Platform admins may operate every dealer. */
  readonly isPlatformAdmin: boolean;
}

export interface DealerOpsSummary {
  readonly dealerId: string;
  readonly dealerName: string;
  readonly logoUrl?: string;
  readonly marketableProperties: number;
  readonly weekId: string;
  readonly todayRequired: number;
  readonly todayDone: number;
  readonly weekRequired: number;
  readonly weekUploaded: number;
  readonly weekApproved: number;
  readonly awaitingReview: number;
  readonly packDownloadedAt?: string;
}

export interface OpsStore {
  getWeek(operator: OperatorDealerAccess, dealerId: string, weekId: string): Promise<OpsWeek | null>;
  saveWeek(operator: OperatorDealerAccess, week: OpsWeek): Promise<void>;
  updateSlot(operator: OperatorDealerAccess, dealerId: string, weekId: string, slot: OutputSlot): Promise<void>;
  saveAsset(operator: OperatorDealerAccess, asset: CreativeAsset): Promise<void>;
  getAsset(operator: OperatorDealerAccess, dealerId: string, slotRef: SlotRef, weekId: string): Promise<CreativeAsset | null>;
  listAssets(operator: OperatorDealerAccess, dealerId: string, weekId: string): Promise<readonly CreativeAsset[]>;
  markPackDownloaded(operator: OperatorDealerAccess, dealerId: string, weekId: string): Promise<void>;
  packDownloadedAt(operator: OperatorDealerAccess, dealerId: string, weekId: string): Promise<string | undefined>;
}

/** Thrown when an operator touches a dealer they are not assigned to. */
export class DealerAccessError extends Error {
  constructor(public readonly dealerId: string) {
    super(`Not authorised for dealer ${dealerId}`);
    this.name = 'DealerAccessError';
  }
}

export function assertDealerAccess(operator: OperatorDealerAccess, dealerId: string): void {
  if (operator.isPlatformAdmin) return;
  if (!operator.dealerIds.includes(dealerId)) throw new DealerAccessError(dealerId);
}

export const canOperate = (operator: OperatorDealerAccess, dealerId: string): boolean =>
  operator.isPlatformAdmin || operator.dealerIds.includes(dealerId);
