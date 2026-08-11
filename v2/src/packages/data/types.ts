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
  views: number;
  masterplanId?: string;
  sectorMapId?: string;
  mapPlacement?: { mapId: string; x: number; y: number };
  /** Canonical real-world location. Independent from masterplan/SVG placement. */
  location?: PropertyLocation;
  /** Private owner details — dealer-only, never projected into a client link. */
  owner?: { name: string; phone: string; priceConfirmedAt?: string };
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  city: string;
  want: WantType;
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
}

export interface DealDocument { name: string; kind?: string; url?: string; }
export interface DealTimelineEntry { at: string; label: string; }

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
