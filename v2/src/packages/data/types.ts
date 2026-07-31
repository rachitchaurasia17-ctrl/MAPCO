/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Data Types
   Source: data-model.md + design .dc.html seed data
   ═══════════════════════════════════════════════════════════════ */

export type PropertyType = 'Residential Plot' | 'Flat' | 'Floor' | 'Kothi' | 'Villa' | 'Commercial';
export type WantType = 'Plot' | 'Flat' | 'Kothi' | 'Villa' | 'Commercial';
export type Facing = 'East' | 'West' | 'North' | 'South' | 'North-East' | 'North-West' | 'South-East' | 'South-West';
export type DealStage = 'enquiry' | 'negotiating' | 'token' | 'registry' | 'closed';
export type LinkStatus = 'active' | 'revoked' | 'expired';
export type PriceVisibility = 'hidden' | 'shown';
export type LocationVisibility = 'area' | 'exact' | 'hidden';

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
  published: boolean;
  sold: boolean;
  views: number;
  mapPlacement?: { mapId: string; x: number; y: number };
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
}

export interface Deal {
  id: string;
  name: string;
  client: string;
  prop: string;
  propSub: string;
  area: string;
  propId: string;
  value: number;
  comm: number;
  token: number;
  stage: DealStage;
}

export interface ClientLink {
  id: string;
  clientId: string;
  clientName: string;
  props: string[];
  propNames: string[];
  expiry: string;
  loc: LocationVisibility;
  price: PriceVisibility;
  audio: 'none' | 'done';
  audioSecs: number;
  status: LinkStatus;
  events: { opens: number; played: number; called: number; wa: number; visit: number };
  lastOpen: string;
}

export interface MapData {
  id: string;
  kind: 'masterplan' | 'sector';
  city: string;
  sector: string;
  label: string;
  raster: string;
  dims: { original: { w: number; h: number }; threeD?: { w: number; h: number } };
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
