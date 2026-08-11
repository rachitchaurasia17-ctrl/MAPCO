import { adapter } from '../../packages/data/adapter';
import {
  coordinateValidationError,
  createPropertyLocation,
  resolvePropertyPoint,
} from '../../packages/data/property-location';
import type {
  Facing,
  Property as CanonicalProperty,
  PropertyType,
  WantType,
} from '../../packages/data/types';

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

/* ── Default camera: the Aerocity / south-Mohali belt where most
      of the mock inventory sits. ────────────────────────────────── */
export const DEFAULT_CENTER: LatLng = { lat: 30.678, lng: 76.74 };
export const DEFAULT_ZOOM = 13;
export const FOCUS_ZOOM = 17; // when flying to a single plot

/* ── Mock inventory (Tri-City, believable) ───────────────────────── */
export const PROPERTIES: Property[] = [
  {
    id: 'p1', tag: 'P-382', plotNo: 'Plot 627', sector: 'Sector 78', city: 'Mohali',
    size: '250 sq yd', facing: 'East', road: '30 ft', type: 'Residential plot',
    price: '₹2.75 Cr', ppu: '₹1.10 L', dims: '50 × 45 ft', approval: 'GMADA',
    ownership: 'Freehold', possession: 'Ready to build',
    pos: { lat: 30.6889, lng: 76.7361 },
    photos: ['/assets/ph-plot-1.png', '/assets/ph-plot-3.png', '/assets/ph-road-1.png', '/assets/ph-amenity-1.png'],
  },
  {
    id: 'p2', tag: 'P-118', plotNo: 'Plot 92', sector: 'Sector 88', city: 'Mohali',
    size: '200 sq yd', facing: 'West', road: '24 ft', type: 'Residential plot',
    price: '₹1.95 Cr', ppu: '₹97,500', dims: '40 × 45 ft', approval: 'GMADA',
    ownership: 'Freehold', possession: 'Ready to build',
    pos: { lat: 30.6743, lng: 76.7189 },
    photos: ['/assets/ph-plot-2.png', '/assets/ph-plot-1.png', '/assets/ph-road-2.png', '/assets/ph-amenity-2.png'],
  },
  {
    id: 'p3', tag: 'P-540', plotNo: 'Plot 12', sector: 'Sector 89', city: 'Mohali',
    size: '500 sq yd', facing: 'North-East', road: '40 ft', type: 'Kothi plot',
    price: '₹5.50 Cr', ppu: '₹1.10 L', dims: '90 × 50 ft', approval: 'GMADA',
    ownership: 'Freehold', possession: 'Ready to build',
    pos: { lat: 30.6698, lng: 76.7147 },
    photos: ['/assets/ph-plot-3.png', '/assets/ph-project-1.png', '/assets/ph-road-3.png', '/assets/ph-amenity-3.png'],
  },
  {
    id: 'p4', tag: 'P-206', plotNo: 'Plot 344', sector: 'Sector 79', city: 'Mohali',
    size: '300 sq yd', facing: 'South', road: '30 ft', type: 'Residential plot',
    price: '₹3.15 Cr', ppu: '₹1.05 L', dims: '60 × 45 ft', approval: 'GMADA',
    ownership: 'Freehold', possession: 'Ready to build',
    pos: { lat: 30.6842, lng: 76.7442 },
    intent: 'investment',
    photos: ['/assets/ph-plot-1.png', '/assets/ph-project-2.png', '/assets/ph-road-1.png', '/assets/ph-landmark-1.png'],
  },
  {
    id: 'p5', tag: 'P-771', plotNo: 'Plot 58', sector: 'Sector 68', city: 'Mohali',
    size: '420 sq yd', facing: 'North', road: '33 ft', type: 'Corner plot',
    price: '₹4.40 Cr', ppu: '₹1.05 L', dims: '75 × 50 ft', approval: 'GMADA',
    ownership: 'Freehold', possession: 'Ready to build',
    pos: { lat: 30.7061, lng: 76.7328 },
    intent: 'commercial',
    photos: ['/assets/ph-plot-2.png', '/assets/ph-project-3.png', '/assets/ph-road-2.png', '/assets/ph-landmark-2.png'],
  },
];

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
  ...PROPERTIES.flatMap((p): SearchEntry[] => [
    { kind: 'plot', label: `${p.tag} · ${p.plotNo}`, sub: `${p.sector}, ${p.city} · your inventory`, pid: p.id },
    { kind: 'plot', label: `${p.plotNo} (${p.tag})`, sub: `${p.sector}, ${p.city} · your inventory`, pid: p.id },
  ]),
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

/** Legacy plots dropped before Earth wrote through the canonical repository. */
export const userPlotsStore = {
  all(): Property[] {
    return readJSON<Property[]>(PLOTS_KEY, []);
  },
  add(pos: LatLng): Property {
    const list = this.all();
    const n = PROPERTIES.length + list.length + 1;
    const plot: Property = {
      id: 'u-' + Date.now().toString(36),
      tag: 'P-' + (900 + list.length),
      plotNo: 'New plot ' + n,
      sector: 'Dropped on Earth', city: 'Tri-City',
      size: '—', facing: '—', road: '—', type: 'Plot',
      price: 'Add price', ppu: '—', dims: '—', approval: 'GMADA',
      ownership: 'Freehold', possession: '—',
      pos,
      photos: ['/assets/ph-plot-2.png', '/assets/ph-road-2.png'],
    };
    list.push(plot);
    writeJSON(PLOTS_KEY, list);
    return plot;
  },
  remove(id: string): void {
    writeJSON(PLOTS_KEY, this.all().filter((p) => p.id !== id));
  },
};

/** Seed inventory plus any plots the dealer has dropped this session. */
let canonicalRecords: CanonicalProperty[] = [];

const fallbackPhotos = ['/assets/ph-plot-2.png', '/assets/ph-road-2.png'];

function displayPrice(price: number): string {
  if (!(price > 0)) return 'Add price';
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
    road: record.position || '—',
    type: record.type,
    price: displayPrice(record.price),
    ppu: '—',
    dims: '—',
    approval: record.approvals.join(', ') || '—',
    ownership: '—',
    possession: '—',
    photos: record.photos.length ? record.photos : fallbackPhotos,
    canonicalRecord: record,
    intent: record.want === 'Commercial' ? 'commercial' : 'residential',
  };
}

function propertyTypeOf(value: string): PropertyType {
  const supported: PropertyType[] = ['Residential Plot', 'Flat', 'Floor', 'Kothi', 'Villa', 'Commercial'];
  return supported.includes(value as PropertyType) ? value as PropertyType : 'Residential Plot';
}

function wantTypeOf(value: string): WantType {
  const supported: WantType[] = ['Plot', 'Flat', 'Kothi', 'Villa', 'Commercial'];
  if (supported.includes(value as WantType)) return value as WantType;
  return value.toLowerCase().includes('commercial') ? 'Commercial' : 'Plot';
}

function facingOf(value: string): Facing {
  const supported: Facing[] = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
  return supported.includes(value as Facing) ? value as Facing : 'East';
}

function canonicalProperty(p: Property, pos: LatLng): CanonicalProperty {
  return {
    id: p.id,
    type: propertyTypeOf(p.type),
    want: wantTypeOf(p.type),
    city: p.city,
    area: p.plotNo,
    loc: `${p.sector}, ${p.city}`,
    sector: p.sector,
    size: p.size,
    facing: facingOf(p.facing),
    position: p.road,
    approvals: p.approval === '—' ? [] : [p.approval],
    landmarks: [],
    price: 0,
    photos: p.photos,
    published: false,
    sold: false,
    views: 0,
    location: createPropertyLocation({ latitude: pos.lat, longitude: pos.lng, source: 'dealer-selected' }),
  };
}

function sameLegacyIdentity(record: CanonicalProperty, legacy: Property): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const sector = normalize(`${record.sector} ${record.area} ${record.loc}`);
  return normalize(record.city) === normalize(legacy.city) && sector.includes(normalize(legacy.sector));
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

async function migrateDeterministicLegacyLocations(): Promise<void> {
  for (const record of [...canonicalRecords]) {
    if (record.location) continue;
    const legacy = PROPERTIES.find((candidate) => candidate.id === record.id);
    if (!legacy || !sameLegacyIdentity(record, legacy)) continue;
    const point = savedStore.get(record.id)?.pos ?? legacy.pos;
    if (!point || coordinateValidationError(point.lat, point.lng)) continue;
    const result = await adapter.properties.setLocation(record.id, {
      latitude: point.lat,
      longitude: point.lng,
      source: 'migrated',
    });
    if (result.ok) {
      replaceCanonical(result.value);
      savedStore.clear(record.id);
    }
  }

  // Browser-created plots have a deterministic id-to-coordinate relationship.
  // Move them once, but retain the old record if a backend write fails.
  for (const legacy of userPlotsStore.all()) {
    if (canonicalRecords.some((record) => record.id === legacy.id)) continue;
    const point = savedStore.get(legacy.id)?.pos ?? legacy.pos;
    if (!point || coordinateValidationError(point.lat, point.lng)) continue;
    const result = await adapter.properties.save(canonicalProperty(legacy, point));
    if (result.ok) {
      replaceCanonical(result.value);
      userPlotsStore.remove(legacy.id);
      savedStore.clear(legacy.id);
    }
  }
}

export function allProperties(): Property[] {
  const canonical = canonicalRecords.map(earthProperty);
  const canonicalIds = new Set(canonical.map((property) => property.id));
  return [
    ...canonical,
    ...PROPERTIES.filter((property) => !canonicalIds.has(property.id)),
    ...userPlotsStore.all().filter((property) => !canonicalIds.has(property.id)),
  ];
}

/** Canonical real-world location first; validated legacy point only as fallback. */
export function propertyPos(p: Property): LatLng | null {
  const legacy = savedStore.get(p.id)?.pos ?? p.pos ?? null;
  return p.canonicalRecord
    ? resolvePropertyPoint(p.canonicalRecord, legacy)
    : resolvePropertyPoint({}, legacy);
}

/* ═══════════════════════════════════════════════════════════════
   locationSource — the ONE place Earth reads/writes a property's
   geographic location. Reads prefer the canonical property payload;
   validated local fixtures are compatibility-only. Every write goes
   through the canonical property repository.
   ═══════════════════════════════════════════════════════════════ */
export const locationSource = {
  async load(): Promise<void> {
    canonicalRecords = await loadAllCanonicalProperties();
    await migrateDeterministicLegacyLocations();
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
    const result = property.canonicalRecord
      ? await adapter.properties.setLocation(id, {
          latitude: pos.lat,
          longitude: pos.lng,
          source: 'dealer-selected',
        })
      : await adapter.properties.save(canonicalProperty(property, pos));
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

/** Existing Add Property pin UX, now persisted through the canonical repository. */
export async function createPropertyAt(pos: LatLng): Promise<Property> {
  const error = coordinateValidationError(pos.lat, pos.lng);
  if (error) throw new RangeError(error);
  const number = allProperties().length + 1;
  const legacy: Property = {
    id: `prop-${Date.now()}`,
    tag: `P-${900 + number}`,
    plotNo: `New plot ${number}`,
    sector: 'Dropped on Earth',
    city: 'Tri-City',
    size: '—',
    facing: 'East',
    road: '—',
    type: 'Residential Plot',
    price: 'Add price',
    ppu: '—',
    dims: '—',
    approval: '—',
    ownership: '—',
    possession: '—',
    photos: fallbackPhotos,
  };
  const result = await adapter.properties.save(canonicalProperty(legacy, pos));
  if (!result.ok) throw new Error(result.error.message);
  replaceCanonical(result.value);
  return earthProperty(result.value);
}
