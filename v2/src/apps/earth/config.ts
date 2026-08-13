import { adapter } from '../../packages/data/adapter';
import {
  coordinateValidationError,
  resolvePropertyPoint,
} from '../../packages/data/property-location';
import type { Property as CanonicalProperty } from '../../packages/data/types';

/* ═══════════════════════════════════════════════════════════════
   MAPCO EARTH — canonical property adapter + compatibility fixtures
   ---------------------------------------------------------------
   Real property records and their authoritative locations come from
   MAPCO's active data adapter. Original Earth fixtures and browser
   stores remain compatibility inputs while deterministic matches
   migrate into canonical property records.

   Coordinates: real lat/lng for the Tri-City property market
   (Chandigarh · Mohali · Aerocity · Zirakpur · New Chandigarh …).
   Known landmarks use accurate coordinates; mock plots sit within
   their real sectors.
   ═══════════════════════════════════════════════════════════════ */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Property {
  id: string;
  tag: string;        // MAPCO code, e.g. P-382
  plotNo: string;     // human plot label
  sector: string;
  city: string;
  size: string;
  facing: string;
  road: string;
  type: string;
  price: string;
  ppu: string;
  dims: string;
  approval: string;
  ownership: string;
  possession: string;
  /** Compatibility-only legacy Earth coordinate. Canonical record.location wins. */
  pos?: LatLng;
  photos: string[];
  /** Existing dealer-scoped MAPCO property record, when loaded from the adapter. */
  canonicalRecord?: CanonicalProperty;
  /** What the property is FOR. Drives Location Advantage ranking.
   *  Inferred from `type` when absent. */
  intent?: 'residential' | 'commercial' | 'investment' | 'rental';
}

export interface JumpArea {
  label: string;
  sub?: string;
  pos: LatLng;
  zoom: number;
}

export type PlaceKind = 'plot' | 'sector' | 'project' | 'landmark' | 'place';

export interface SearchEntry {
  kind: PlaceKind;
  label: string;
  sub: string;
  pos?: LatLng;
  zoom?: number;
  pid?: string;       // links to a Property
}

export interface ImportantPlace {
  id: string;
  name: string;
  pos: LatLng;
  createdAt: number;
}

export interface SavedLocation {
  pos: LatLng;
  savedAt: number;
}

/* ── Default camera: the Aerocity / south-Mohali belt. ───────────── */
export const DEFAULT_CENTER: LatLng = { lat: 30.678, lng: 76.74 };
export const DEFAULT_ZOOM = 13;
export const FOCUS_ZOOM = 17; // when flying to a single plot

/* ── Quick Jump areas (real Tri-City places) ─────────────────────── */
export const JUMP_AREAS: JumpArea[] = [
  { label: 'Aerocity', sub: 'GMADA township', pos: { lat: 30.66, lng: 76.77 }, zoom: 14 },
  { label: 'Airport Road', sub: 'Main approach', pos: { lat: 30.656, lng: 76.801 }, zoom: 14 },
  { label: 'CP67', sub: 'Sector 67 · commercial', pos: { lat: 30.7056, lng: 76.7385 }, zoom: 16 },
  { label: 'Sector 82', sub: 'Mohali · Aerocity belt', pos: { lat: 30.6725, lng: 76.752 }, zoom: 15 },
  { label: 'Chandigarh', sub: 'Sector 17', pos: { lat: 30.741, lng: 76.7822 }, zoom: 13 },
  { label: 'New Chandigarh', sub: 'Mullanpur', pos: { lat: 30.79, lng: 76.68 }, zoom: 13 },
  { label: 'Zirakpur', sub: 'Development belt', pos: { lat: 30.6425, lng: 76.8173 }, zoom: 13 },
  { label: 'Panchkula', sub: 'Sector 5', pos: { lat: 30.6942, lng: 76.8606 }, zoom: 13 },
];

/* ── Seed important places (MAPCO landmarks) ─────────────────────── */
export const SEED_IMPORTANT_PLACES: ImportantPlace[] = [
  { id: 'ip-cp67', name: 'CP67 Mall', pos: { lat: 30.7056, lng: 76.7385 }, createdAt: 0 },
  { id: 'ip-airport', name: 'Airport Road', pos: { lat: 30.656, lng: 76.801 }, createdAt: 0 },
  { id: 'ip-sohana', name: 'Sohana Hospital', pos: { lat: 30.687, lng: 76.717 }, createdAt: 0 },
  { id: 'ip-gmada-sports', name: 'GMADA Sports Complex', pos: { lat: 30.69, lng: 76.73 }, createdAt: 0 },
];

/* ── MAPCO search index (plots + sectors + projects + landmarks).
      Google Places (New) results are merged in at runtime so the dealer
      never has to think about the source. ──────────────────────────── */
export const SEARCH_INDEX: SearchEntry[] = [
  { kind: 'sector', label: 'Sector 78', sub: 'Mohali', pos: { lat: 30.6889, lng: 76.7361 }, zoom: 15 },
  { kind: 'sector', label: 'Sector 79', sub: 'Mohali', pos: { lat: 30.6842, lng: 76.7442 }, zoom: 15 },
  { kind: 'sector', label: 'Sector 82', sub: 'Mohali · Aerocity belt', pos: { lat: 30.6725, lng: 76.752 }, zoom: 15 },
  { kind: 'sector', label: 'Sector 88', sub: 'Mohali', pos: { lat: 30.6743, lng: 76.7189 }, zoom: 15 },
  { kind: 'sector', label: 'Sector 89', sub: 'Mohali', pos: { lat: 30.6698, lng: 76.7147 }, zoom: 15 },
  { kind: 'project', label: 'CP67', sub: 'Commercial project · Sector 67', pos: { lat: 30.7056, lng: 76.7385 }, zoom: 16 },
  { kind: 'project', label: 'Aerocity', sub: 'GMADA township', pos: { lat: 30.66, lng: 76.77 }, zoom: 14 },
  { kind: 'landmark', label: 'Airport Road', sub: 'Main approach road', pos: { lat: 30.656, lng: 76.801 }, zoom: 14 },
  { kind: 'landmark', label: 'GMADA Sports Complex', sub: 'Sector 78 landmark', pos: { lat: 30.69, lng: 76.73 }, zoom: 16 },
  { kind: 'landmark', label: 'Sohana Hospital', sub: 'Airport Road landmark', pos: { lat: 30.687, lng: 76.717 }, zoom: 16 },
];

/* ── Major Tri-City roads / connections (real arterials) ─────────
   Roads have no reliable Places footprint, so Location Advantage
   expresses them as "X m to <road>" using the nearest sampled point
   on the real road (never a fabricated line). A few samples per road
   give an honest proximity estimate. */
export interface Arterial {
  name: string;
  samples: LatLng[];
}
export const ARTERIAL_ROADS: Arterial[] = [
  { name: 'Airport Road', samples: [
    { lat: 30.6606, lng: 76.7969 }, { lat: 30.6512, lng: 76.8127 }, { lat: 30.6702, lng: 76.7802 },
    { lat: 30.6752, lng: 76.7602 }, { lat: 30.6811, lng: 76.7502 },
  ] },
  { name: 'PR-7 (Aerocity Road)', samples: [
    { lat: 30.6588, lng: 76.7727 }, { lat: 30.6412, lng: 76.7999 }, { lat: 30.6738, lng: 76.7521 },
    { lat: 30.6842, lng: 76.7452 }, { lat: 30.6889, lng: 76.7381 }, { lat: 30.6801, lng: 76.7411 },
  ] },
  { name: 'Kharar–Landran Road', samples: [
    { lat: 30.7089, lng: 76.6717 }, { lat: 30.6923, lng: 76.7013 }, { lat: 30.6772, lng: 76.7215 },
    { lat: 30.7002, lng: 76.6889 },
  ] },
  { name: 'Chandigarh–Kharar Highway (NH-05)', samples: [
    { lat: 30.7442, lng: 76.6721 }, { lat: 30.7551, lng: 76.6402 }, { lat: 30.7358, lng: 76.7011 },
    { lat: 30.7649, lng: 76.6702 },
  ] },
  { name: 'Mohali–Sirhind Road', samples: [
    { lat: 30.6699, lng: 76.7231 }, { lat: 30.6531, lng: 76.7099 }, { lat: 30.6402, lng: 76.6981 },
  ] },
  // New Chandigarh / Mullanpur belt (so those plots also get honest road context)
  { name: 'Mullanpur–Kurali Road (NH-205)', samples: [
    { lat: 30.7902, lng: 76.6852 }, { lat: 30.8021, lng: 76.6721 }, { lat: 30.7781, lng: 76.6952 },
    { lat: 30.7856, lng: 76.6788 },
  ] },
  { name: 'New Chandigarh Main Road', samples: [
    { lat: 30.7889, lng: 76.6781 }, { lat: 30.7951, lng: 76.6659 }, { lat: 30.7822, lng: 76.6902 },
  ] },
];

/* ═══════════════════════════════════════════════════════════════
   Local store — pin→save loop + important places (localStorage).
   Swap this module for the real MAPCO property database later.
   ═══════════════════════════════════════════════════════════════ */
const SAVED_KEY = 'mapco.earth.savedLocations.v1';
const PLACES_KEY = 'mapco.earth.importantPlaces.v1';
const PLOTS_KEY = 'mapco.earth.userPlots.v1';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — non-fatal for a prototype */
  }
}

/** Saved property locations, keyed by property id. Overrides seed coords. */
export const savedStore = {
  all(): Record<string, SavedLocation> {
    return readJSON<Record<string, SavedLocation>>(SAVED_KEY, {});
  },
  get(id: string): SavedLocation | null {
    return this.all()[id] ?? null;
  },
  set(id: string, pos: LatLng): void {
    if (coordinateValidationError(pos.lat, pos.lng)) return;
    const all = this.all();
    all[id] = { pos, savedAt: Date.now() };
    writeJSON(SAVED_KEY, all);
  },
  clear(id: string): void {
    const all = this.all();
    delete all[id];
    writeJSON(SAVED_KEY, all);
  },
};

/** Important places — seeds merged with any the dealer has added. */
export const placesStore = {
  added(): ImportantPlace[] {
    return readJSON<ImportantPlace[]>(PLACES_KEY, []);
  },
  all(): ImportantPlace[] {
    return [...SEED_IMPORTANT_PLACES, ...this.added()];
  },
  add(name: string, pos: LatLng): ImportantPlace {
    const list = this.added();
    const place: ImportantPlace = {
      id: 'ip-' + Date.now().toString(36),
      name: name.trim() || 'Unnamed place',
      pos,
      createdAt: Date.now(),
    };
    list.push(place);
    writeJSON(PLACES_KEY, list);
    return place;
  },
  remove(id: string): void {
    writeJSON(PLACES_KEY, this.added().filter((p) => p.id !== id));
  },
};

/** Legacy browser records are retained only so canonical writes can clean them up. */
export const userPlotsStore = {
  all(): Property[] {
    return readJSON<Property[]>(PLOTS_KEY, []);
  },
  remove(id: string): void {
    writeJSON(PLOTS_KEY, this.all().filter((p) => p.id !== id));
  },
};

/** Dealer-scoped records loaded through the active adapter. */
let canonicalRecords: CanonicalProperty[] = [];

function displayPrice(price: number): string {
  if (!(price > 0)) return '';
  if (price >= 10_000_000) return `₹${(price / 10_000_000).toFixed(2)} Cr`;
  if (price >= 100_000) return `₹${(price / 100_000).toFixed(2)} L`;
  return `₹${price.toLocaleString('en-IN')}`;
}

function earthProperty(record: CanonicalProperty): Property {
  return {
    id: record.id,
    tag: record.id.toUpperCase(),
    plotNo: record.area || record.type,
    sector: record.sector || record.loc || record.area,
    city: record.city,
    size: record.size,
    facing: record.facing,
    road: record.position,
    type: record.type,
    price: displayPrice(record.price),
    ppu: '',
    dims: '',
    approval: record.approvals.join(', '),
    ownership: '',
    possession: '',
    photos: [...record.photos],
    canonicalRecord: record,
    intent: record.want === 'Commercial' ? 'commercial' : 'residential',
  };
}

function replaceCanonical(record: CanonicalProperty): void {
  const index = canonicalRecords.findIndex((item) => item.id === record.id);
  if (index >= 0) canonicalRecords[index] = record;
  else canonicalRecords.unshift(record);
}

async function loadAllCanonicalProperties(): Promise<CanonicalProperty[]> {
  const records: CanonicalProperty[] = [];
  let cursor: string | undefined;
  do {
    const result = await adapter.properties.list({ cursor, limit: 50 });
    if (!result.ok) throw new Error(result.error.message);
    records.push(...result.value.items);
    cursor = result.value.nextCursor ?? undefined;
  } while (cursor);
  return records;
}

export function allProperties(): Property[] {
  return canonicalRecords.map(earthProperty);
}

/** Canonical real-world location first; a validated dealer-saved legacy point only as fallback. */
export function propertyPos(p: Property): LatLng | null {
  const legacy = savedStore.get(p.id)?.pos ?? p.pos ?? null;
  return p.canonicalRecord
    ? resolvePropertyPoint(p.canonicalRecord, legacy)
    : resolvePropertyPoint({}, legacy);
}

/* ═══════════════════════════════════════════════════════════════
   locationSource — the ONE place Earth reads/writes a property's
   geographic location. Reads prefer the canonical property payload;
   validated dealer-saved legacy coordinates are compatibility-only. Every write goes
   through the canonical property repository.
   ═══════════════════════════════════════════════════════════════ */
export const locationSource = {
  async load(): Promise<void> {
    canonicalRecords = await loadAllCanonicalProperties();
  },
  /** Resolve a handoff ID through the active adapter, never fixture inventory. */
  async resolve(id: string): Promise<Property | null> {
    const result = await adapter.properties.get(id);
    if (!result.ok) return null;
    replaceCanonical(result.value);
    return earthProperty(result.value);
  },
  /** Resolve a property's authoritative coordinate. */
  get(id: string): LatLng | null {
    const p = allProperties().find((x) => x.id === id);
    return p ? propertyPos(p) : null;
  },
  /** Persist a property's exact coordinate (dealer pin → save). */
  async set(id: string, pos: LatLng): Promise<CanonicalProperty> {
    const error = coordinateValidationError(pos.lat, pos.lng);
    if (error) throw new RangeError(error);
    const property = allProperties().find((candidate) => candidate.id === id);
    if (!property) throw new Error('Property not found');
    const result = await adapter.properties.setLocation(id, {
      latitude: pos.lat,
      longitude: pos.lng,
      source: 'dealer-selected',
    });
    if (!result.ok) throw new Error(result.error.message);
    replaceCanonical(result.value);
    savedStore.clear(id);
    userPlotsStore.remove(id);
    return result.value;
  },
  /** Whether a dealer has explicitly saved an exact location. */
  isExact(id: string): boolean {
    const property = allProperties().find((candidate) => candidate.id === id);
    return Boolean(property?.canonicalRecord?.location ?? savedStore.get(id));
  },
};
