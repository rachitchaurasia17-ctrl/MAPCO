/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Data Types
   Source: data-model.md + design .dc.html seed data
   ═══════════════════════════════════════════════════════════════ */

export type PropertyType = 'Residential Plot' | 'Flat' | 'Floor' | 'Kothi' | 'Villa' | 'Commercial';
export type WantType = 'Plot' | 'Flat' | 'Kothi' | 'Villa' | 'Commercial';
export type Facing = 'East' | 'West' | 'North' | 'South' | 'North-East' | 'North-West' | 'South-East' | 'South-West';
export type LinkStatus = 'active' | 'revoked' | 'expired';
export type PriceVisibility = 'hidden' | 'shown';
export type LocationVisibility = 'area' | 'exact' | 'hidden';
export type PropertyLifecycle = 'draft' | 'on-sale' | 'sold' | 'archived';

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
  views: number;
  masterplanId?: string;
  sectorMapId?: string;
  mapPlacement?: { mapId: string; x: number; y: number };
  /** Canonical real-world location. Independent from masterplan/SVG placement. */
  location?: PropertyLocation;
  /** Private owner details — dealer-only, never projected into a client link. */
  owner?: { name: string; phone: string; priceConfirmedAt?: string };
}

/** Reusable dealer-private seller; never projected into buyer-facing payloads. */
export interface Seller {
  id: string;
  name: string;
  primaryPhone: string;
  alternatePhone?: string;
  type: SellerType;
  city?: string;
  note?: string;
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
  isPrimary: boolean;
}

export interface SellerWithProperties {
  seller: Seller;
  properties: readonly { property: Property; relationship: PropertySeller }[];
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
 * A Deal is a COMPLETED property transaction — never an ongoing negotiation.
 * Ongoing buyer follow-ups live on Client, not here. Every field below is
 * dealer-private (buyer, seller, price, payment, commission, documents) and
 * must never appear in a ClientSafePayload / public client link.
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
