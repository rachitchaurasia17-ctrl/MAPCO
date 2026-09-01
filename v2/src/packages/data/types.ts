/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Data Types
   Source: data-model.md + design .dc.html seed data
   ═══════════════════════════════════════════════════════════════ */

/**
 * The property types MAPCO actually sells. This mirrors the Desk's own
 * PTYPES list — the adaptive specification model keys off these, so a
 * narrower list would collapse Office / Showroom / SCO into one bucket
 * and lose the fields a buyer of each actually asks about.
 *
 * `Floor` and `Commercial` are retained as legacy values so rows written
 * before the list widened still read.
 */
export type PropertyType =
  | 'Residential Plot'
  | 'Flat'
  | 'Builder Floor'
  | 'Kothi'
  | 'Villa'
  | 'Commercial SCO'
  | 'Commercial Booth'
  | 'Office'
  | 'Showroom'
  | 'Industrial Plot'
  /** @deprecated legacy values kept readable */
  | 'Floor' | 'Commercial';
export type WantType = 'Plot' | 'Flat' | 'Kothi' | 'Villa' | 'Commercial';
export type Facing = 'East' | 'West' | 'North' | 'South' | 'North-East' | 'North-West' | 'South-East' | 'South-West';
export type LinkStatus = 'active' | 'revoked' | 'expired';
export type PriceVisibility = 'hidden' | 'shown';
export type LocationVisibility = 'area' | 'exact' | 'hidden';
/**
 * The one canonical property state.
 *   draft    — incomplete; not listable yet
 *   on-sale  — active inventory the dealer is selling
 *   archived — Off market / On hold: still the dealer's, only paused
 *   sold     — a completed sale is attached
 *   unsold   — the dealer removed it WITHOUT selling it. Recoverable: the
 *              whole record survives, it only leaves active inventory.
 */
export type PropertyLifecycle = 'draft' | 'on-sale' | 'sold' | 'archived' | 'unsold';

export type SellerType = 'individual' | 'builder' | 'broker' | 'company';
export type SellerRelationship = 'owner' | 'co-owner' | 'builder' | 'authorized-seller';
export type SellerAvailability = 'available' | 'unconfirmed' | 'unavailable';
export type PropertyDocumentType =
  | 'registry'
  | 'allotment-letter'
  | 'possession-letter'
  | 'rera-certificate'
  | 'gmada-approval'
  | 'site-plan'
  | 'other';
export type PropertyDocumentVisibility = 'private' | 'dealer-team' | 'approved-for-sharing';
export type PropertyDocumentSafety = 'private' | 'sensitive' | 'verified-shareable';

export type PropertyLocationSource =
  | 'dealer-selected'
  | 'manually-verified'
  | 'imported'
  | 'migrated';

/** One property's authoritative real-world Earth coordinate. */
export interface PropertyLocation {
  latitude: number;
  longitude: number;
  source?: PropertyLocationSource;
  /** ISO timestamp for the last canonical location change. */
  updatedAt?: string;
}

export interface PropertyLocationInput {
  latitude: number;
  longitude: number;
  source?: PropertyLocationSource;
}

export interface PropertyPhotoStorageRef {
  kind: 'storage';
  id: string;
  /** Canonical private object path. Signed/blob URLs are never stored here. */
  path: string;
}

export interface Property {
  id: string;
  type: PropertyType;
  want: WantType;
  city: string;
  area: string;
  loc: string;
  sector: string;
  size: string;
  facing: Facing;
  position: string;
  approvals: string[];
  landmarks: { name: string; distance: string; icon: string }[];
  price: number;
  photos: string[];
  /** Canonical refs for private property-photos objects; `photos` holds display URLs at runtime. */
  photoStorage?: PropertyPhotoStorageRef[];
  published: boolean;
  sold: boolean;
  /** Internal availability gate retained for existing presentation/link SQL. */
  clientVisible?: boolean;
  /** Canonical state. Optional only while legacy rows are normalized on read. */
  lifecycle?: PropertyLifecycle;
  /** Immutable completed-sale association written by the atomic sale command. */
  sale?: { finalPrice: number; soldAt: string; buyerId: string; dealId: string };
  /**
   * When the record left active inventory without selling, and the state
   * it left from. Written when lifecycle becomes 'unsold', cleared on
   * Restore. Nothing else about the property is touched, so Restore is a
   * state change and never a re-creation.
   */
  removal?: { at: string; from: PropertyLifecycle };
  views: number;
  masterplanId?: string;
  sectorMapId?: string;
  mapPlacement?: { mapId: string; x: number; y: number };
  /** Canonical real-world location. Independent from masterplan/SVG placement. */
  location?: PropertyLocation;
  /**
   * Type-specific specifications (frontage, beds, cabins, ceiling height…).
   * The valid key set is decided by the property's kind — see
   * `property-specs.ts`. Changing `type` drops the keys the new kind does
   * not accept, so a stale `beds` can never survive Flat → Plot.
   */
  specs?: import('./property-specs').PropertySpecs;
  /** Private owner details — dealer-only, never projected into a client link. */
  owner?: { name: string; phone: string; priceConfirmedAt?: string };

  /* ── fields common to every property type ──
     Type-specific answers live in `specs`; these are true of all ten
     kinds, so they stay first-class rather than being scoped to one. */

  /** Society / project name, where the property sits inside one. */
  society?: string;
  /** Street address. Dealer-private: never projected into a client link. */
  address?: string;
  /** The size unit the dealer entered ('sq yd', 'sq ft', 'marla', 'kanal'). */
  sizeUnit?: string;
  /** Price per unit, as entered or derived from price ÷ size. */
  rate?: string;
  /** Marketing-safe highlight chips ("Park Facing", "GMADA Approved"). */
  highlights?: readonly string[];
  /** Property video URLs. Photos live in `photos` / `photoStorage`. */
  videos?: readonly string[];
  /** Dealer-private working notes. Never client-safe. */
  privateNotes?: string;
  /** Registry / approval reference text the dealer recorded. */
  registryRef?: string;
  approvalRef?: string;
}

/** Reusable dealer-private seller; never projected into buyer-facing payloads. */
export interface Seller {
  id: string;
  name: string;
  primaryPhone: string;
  alternatePhone?: string;
  type: SellerType;
  /** Firm / trading name recorded beside a person's name. */
  business?: string;
  city?: string;
  note?: string;
  /** Archived sellers keep every relationship, document and deal reference. */
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Private facts about one seller's relationship to one canonical property. */
export interface PropertySeller {
  id: string;
  propertyId: string;
  sellerId: string;
  askingPrice?: number;
  relationship: SellerRelationship;
  availability: SellerAvailability;
  lastConfirmedAt?: string;
  siteVisitInstructions?: string;
  note?: string;
  documentStatus?: string;
  /** The paper kinds the seller has handed over — a multi-select in Contacts. */
  documentKinds?: readonly string[];
  isPrimary: boolean;
}

export interface SellerWithProperties {
  seller: Seller;
  properties: readonly { property: Property; relationship: PropertySeller }[];
}

/**
 * One row of the Sellers list, assembled server-side so the screen does
 * not issue a query per seller. Counts come from the canonical
 * property↔seller relationship, never from a cached copy.
 */
export interface SellerDirectoryEntry {
  seller: Seller;
  /** Properties still on the books (anything whose lifecycle is not sold). */
  liveCount: number;
  soldCount: number;
  /** Most recent availability confirmation across this seller's properties. */
  lastConfirmedAt?: string;
  /** True when at least one attached property is not confirmed available. */
  anyUnconfirmed: boolean;
  properties: readonly {
    propertyId: string;
    lifecycle: PropertyLifecycle;
    loc?: string;
    price?: number;
    askingPrice?: number;
    availability: SellerAvailability;
    lastConfirmedAt?: string;
    isPrimary: boolean;
  }[];
}

/** A Seller profile in one dealer-private round trip. */
export interface SellerWorkspace {
  seller: Seller;
  active: readonly { property: Property; relationship: PropertySeller }[];
  sold: readonly { property: Property; relationship: PropertySeller }[];
}

/** Canonical metadata for a private property document stored in Storage. */
export interface PropertyDocument {
  id: string;
  propertyId: string;
  title: string;
  type: PropertyDocumentType;
  storage: { bucket: 'property-documents'; path: string };
  mimeType: string;
  sizeBytes: number;
  visibility: PropertyDocumentVisibility;
  safety: PropertyDocumentSafety;
  metadata?: Readonly<Record<string, string>>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * What the dealer has actually been told the buyer wants. Every field is
 * optional: a client created from a phone call has a name and a number
 * and nothing else, and that must stay truthful rather than being filled
 * with defaults. Money is stored in RUPEES, matching Property.price.
 */
export interface ClientRequirements {
  /** Property types the buyer is looking at, in Desk vocabulary. */
  types?: readonly string[];
  /** Preferred localities / sectors. */
  areas?: readonly string[];
  budgetMin?: number;
  budgetMax?: number;
  sizeMin?: string;
  sizeMax?: string;
  /** "Corner", "Park facing", "Ready to move"… */
  preferences?: readonly string[];
  /** Where the buyer is in their search. */
  stage?: string;
}

/** A dated dealer note. Newest first. */
export interface ClientNote {
  /** ISO timestamp. */
  at: string;
  text: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  city: string;
  /** Empty when a buyer has not stated a property requirement yet. */
  want: WantType | '';
  budget: string;
  budgetMax: number;
  status: 'active' | 'cold' | 'hot';
  seen: string;
  note: string;
  viewed: string[];
  interest: string[];
  isNew?: boolean;
  /** optional customer photo (URL) and a linked property id. */
  photo?: string;
  linkedPropertyId?: string;
  /** property ids this buyer has completed a purchase on (Purchased Properties). */
  purchased?: string[];
  /** Minimal sale-created buyers remain truthful until the dealer completes them. */
  profileCompleteness?: 'complete' | 'needs-attention';
  missingFields?: string[];

  /* ── what the dealer knows ── */

  alternatePhone?: string;
  /** Firm name, when the buyer is buying through or for a business. */
  business?: string;
  /** Stated requirements. Absent until the dealer records something. */
  requirements?: ClientRequirements;
  /** Dealer's own notes, newest first. Dealer-private. */
  notes?: readonly ClientNote[];
  /** Archived clients keep every link, deal and purchase reference. */
  archived?: boolean;
}

export interface DealDocument { name: string; kind?: string; url?: string; }
export interface DealTimelineEntry { at: string; label: string; }

/**
 * Legacy completed-sale rows predate parts of the current private Deal shape.
 * Normalizers keep numeric fallbacks render-safe, while this metadata lets the
 * dealer UI distinguish an explicitly recorded zero/false from a missing value.
 */
export interface DealFieldPresence {
  soldPrice: boolean;
  brokerage: boolean;
  commission: boolean;
  commissionReceived: boolean;
  paymentReceived: boolean;
  soldDate: boolean;
  documents: boolean;
  timeline: boolean;
}

/**
 * The COMPLETED-sale shape of a deal — the register row a finished
 * transaction settles into. A deal still in flight is a `PipelineDeal`
 * (below); both are the same canonical crm_records row at different
 * points in its life, distinguished by recordType.
 *
 * Every field below is dealer-private (buyer, seller, price, payment,
 * commission, documents) and must never appear in a ClientSafePayload
 * or a public client link.
 */
export interface Deal {
  id: string;
  // sold property / plot (snapshot so the register survives inventory edits)
  propId: string;
  prop: string;            // plot name, e.g. "Eco City plot"
  propSub: string;         // "500 sq yd · North-East"
  city: string;
  sector: string;
  // parties
  buyerId: string;
  buyer: string;           // buyer / client name
  seller: string;          // private seller name
  sellerId?: string;       // reusable private seller relation, when available
  sellerPhone?: string;
  // money
  soldPrice: number;       // final sold price
  brokerage: number;       // total brokerage on the transaction
  commission: number;      // dealer commission earned
  commissionReceived: boolean;
  paymentReceived: number; // amount received so far
  // dates (ISO yyyy-mm-dd)
  soldDate: string;
  registrationDate?: string;
  // assignment
  dealer: string;          // assigned dealer display name
  // records
  documents: DealDocument[];
  timeline: DealTimelineEntry[];
  /** Adapter-derived only; omitted by complete in-memory/current records. */
  fieldPresence?: DealFieldPresence;
}

/* ───────────────────────────────────────────────────────────────
   PIPELINE DEALS
   `Deal` above stays the COMPLETED-sale register shape so existing
   readers keep working. A deal in flight is a PipelineDeal: the same
   canonical crm_records row, distinguished by recordType='pipeline'.
   Marking a property sold completes the matching pipeline deal in
   place rather than writing a second canonical deal.
   ─────────────────────────────────────────────────────────────── */

export type DealStage = 'negotiating' | 'token' | 'registry' | 'closed' | 'lost';

/** Stages a dealer can move a deal to directly. Completion goes through
 *  the sale command so property/buyer history move as one unit. */
export type DealStageTransition = Exclude<DealStage, 'closed'>;

export type CommissionMode = 'none' | 'pct' | 'fixed';

/** One side of the brokerage. `percent` applies to the deal value. */
export interface CommissionSide {
  mode: CommissionMode;
  percent?: number;
  fixed?: number;
}

export interface DealCommission {
  buyer: CommissionSide;
  seller: CommissionSide;
}

export interface DealNextAction {
  kind: string;
  note?: string;
  /** ISO yyyy-mm-dd */
  dueOn?: string;
}

/** A deal in flight. Every field is dealer-private. */
export interface PipelineDeal {
  id: string;
  stage: DealStage;
  propertyId: string;
  prop: string;
  propSub: string;
  city: string;
  sector: string;
  buyerId: string;
  buyer: string;
  sellerId?: string;
  seller?: string;
  sellerPhone?: string;
  /** Current agreed value. Absent until the dealer records one. */
  value?: number;
  commission: DealCommission;
  nextAction?: DealNextAction;
  tokenDate?: string;
  registryDate?: string;
  lostReason?: string;
  lostOn?: string;
  createdAt?: string;
}

export type DealPaymentKind = 'token' | 'commission-buyer' | 'commission-seller';

export interface DealPayment {
  id: string;
  kind: DealPaymentKind;
  amount: number;
  /** ISO yyyy-mm-dd */
  receivedOn: string;
  note?: string;
}

export interface DealStageEvent {
  stage: DealStage;
  occurredAt: string;
  note?: string;
}

/**
 * Commission arithmetic, computed server-side so the database, the read
 * model and the UI can never disagree. A completed deal may still carry
 * `due > 0` — commission outlives the sale.
 */
export interface DealMoney {
  value: number;
  token: number;
  expectedBuyer: number;
  expectedSeller: number;
  expected: number;
  receivedBuyer: number;
  receivedSeller: number;
  received: number;
  due: number;
  fullySettled: boolean;
}

/** A deal-owned paper. Property papers are referenced, never copied here. */
export interface DealPaper {
  id: string;
  title: string;
  type: string;
  bucket: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  createdAt?: string;
}

/** The seller context a deal inherits through its canonical property. */
export interface DealSellerContext {
  id: string;
  name: string;
  primaryPhone: string;
  type: SellerType;
  relationship: SellerRelationship;
  availability: SellerAvailability;
  askingPrice?: number;
  siteVisitInstructions?: string;
}

/**
 * Everything the Deal room needs in one dealer-private round trip:
 * canonical buyer/property/seller, stage history, the money ledger, the
 * deal's own papers and — by reference, never duplicated — the canonical
 * property's papers.
 */
export interface DealWorkspace {
  deal: PipelineDeal;
  property?: Property;
  buyer?: Client;
  seller?: DealSellerContext;
  stageHistory: readonly DealStageEvent[];
  payments: readonly DealPayment[];
  money: DealMoney;
  dealPapers: readonly DealPaper[];
  propertyPapers: readonly PropertyDocument[];
}

export interface ClientLink {
  id: string;
  clientId: string;
  clientName: string;
  props: string[];
  propNames: string[];
  /** count of plots on the link when the ids aren't returned (Supabase list RPC). */
  propertyCount?: number;
  /** human-readable creation date (Supabase list RPC); optional in fixtures. */
  createdAt?: string;
  expiry: string;
  loc: LocationVisibility;
  price: PriceVisibility;
  audio: 'none' | 'done';
  audioSecs: number;
  status: LinkStatus;
  events: { opens: number; played: number; called: number; wa: number; visit: number };
  lastOpen: string;
}

export interface MapAsset { path: string; w?: number; h?: number; }

export interface MapData {
  id: string;
  kind: 'masterplan' | 'sector';
  city: string;
  sector: string;
  /** the sector/area subtitle within its city. */
  area?: string;
  /** for a sector map, the id of its parent masterplan. */
  parentMapId?: string;
  label: string;
  raster: string;
  /** Original / 3D / overlay asset URLs (Storage) — the render sources. */
  assets?: { original?: MapAsset; threeD?: MapAsset; overlay?: MapAsset };
  dims: { original: { w: number; h: number }; threeD?: { w: number; h: number } };
  /** Geometry trust for this map's SVG overlay (drives the Highlights control). */
  calibration?: {
    status: 'calibrated' | 'needs-review' | 'unavailable';
    overlayViewBox?: { w: number; h: number } | null;
    raster?: { w: number; h: number } | null;
  };
  published: boolean;
  hidden: boolean;
  sets: MarkSet[];
  linkedProperties: string[];
}

export interface MarkSet {
  id: string;
  name: string;
  marks: Mark[];
}

export interface Mark {
  kind: 'road' | 'block' | 'pin' | 'text';
  /** Coordinate provenance must be explicit for property pins. */
  coordinateProvenance?: 'development-mock' | 'map-authored' | 'survey';
  points: number[][] | { x: number; y: number };
  label: string;
  propertyId?: string;
}

export interface DemandSignal {
  city: string;
  opens: number;
  color: string;
}

/** Data adapter interface — all data access goes through this boundary */
export interface DataAdapter {
  getProperties(): Promise<Property[]>;
  getClients(): Promise<Client[]>;
  getDeals(): Promise<Deal[]>;
  getClientLinks(): Promise<ClientLink[]>;
  getMaps(): Promise<MapData[]>;
  getDemandSignals(): Promise<DemandSignal[]>;
}
