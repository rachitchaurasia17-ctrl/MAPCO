/* ═══════════════════════════════════════════════════════════════
   MAPCO EARTH — Location Intelligence (slot-driven analyst)
   ---------------------------------------------------------------
   MAPCO decides the QUESTIONS. Google only supplies the evidence.

     1. PLAN      the ~10 distinct things worth knowing about this
                  property, chosen by its type/intent (intel/slots.ts)
     2. RECALL    everything MAPCO already knows around this point
                  (geo-cell + neighbours — free, persistent, shared)
     3. DISCOVER  one broad pass, only if this cell was never studied
     4. ASSIGN    best answer per question — one candidate per slot,
                  one slot per candidate
     5. GAP-FILL  a single targeted pass for the strongest questions
                  still unanswered (budget-capped)
     6. PRESENT   name + distance only. All reasoning stays invisible.

   Ten results therefore mean ten different location stories by
   construction, not by filtering luck.

   COST — fresh cell ≈ 7 broad + ≤4 targeted Places calls, once, then
   reused free by every property in that neighbourhood, forever.
   ═══════════════════════════════════════════════════════════════ */
import { importMapsLibrary } from '../../packages/maps/google-loader';
import type { LatLng, Property } from './config';
import { MAPCO_ANCHORS, metersBetween } from './intel/geo-data';
import { matchAnchor, canonicalIdFor, dedupeEntities, coreName, normalize } from './intel/entities';
import {
  readNeighbourhood, hasAnalysedCell, writeCell,
  markDiscoveryAttempt, inDiscoveryBackoff, type StoredEntity,
} from './intel/store';
import { meter } from './intel/meter';
import {
  planSlots, assignSlots, unansweredSlots, significanceOf, scaleOf, NEARBY_ELIGIBLE,
  type Slot, type SlotCandidate,
} from './intel/slots';
import { selectRoadsFor } from './intel/road-network';
import type { Intent, Section } from './intel/types';

export type { Intent, Section };

export interface Advantage {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  icon: string;
  color: string;
  pos: LatLng;
  kind: 'poi' | 'road';
  section: Section;
  distanceMeters: number;
  durationSec: number | null;
  aerial: boolean;
  /** internal-only label of the question this answers (never shown) */
  slotId?: string;
  accessPoint?: LatLng;
  path?: LatLng[];
  roadImportance?: number;
  roadScore?: number;
  roadRelation?: 'direct' | 'connected';
  roadHops?: number;
  roadNetworkMeters?: number;
  roadTier?: 'primary' | 'secondary' | 'tertiary';
}

export interface LocationIntel {
  around: Advantage[];
  nearby: Advantage[];
  roads: Advantage[];
  fresh: boolean;
  intent: Intent;
}

/* ── Presentation metadata (icon/colour/label only — no prose) ─── */
const C = { gold: '#f4ae14', green: '#1f8d5f', violet: '#6a44cf', rose: '#c2506b', blue: '#3a66c4' };
interface CatMeta { label: string; icon: string; color: string; }
const CATS: Record<string, CatMeta> = {
  transit: { label: 'Transport', icon: 'ph-fill ph-bus', color: C.blue },
  railway: { label: 'Railway', icon: 'ph-fill ph-train', color: C.violet },
  airport: { label: 'Airport', icon: 'ph-fill ph-airplane-tilt', color: C.gold },
  park: { label: 'Park', icon: 'ph-fill ph-tree', color: C.green },
  sports: { label: 'Sports & recreation', icon: 'ph-fill ph-barbell', color: C.gold },
  market: { label: 'Shopping', icon: 'ph-fill ph-shopping-cart', color: C.gold },
  mall: { label: 'Commercial', icon: 'ph-fill ph-shopping-bag', color: C.gold },
  hospital: { label: 'Healthcare', icon: 'ph-fill ph-first-aid-kit', color: C.rose },
  pharmacy: { label: 'Healthcare', icon: 'ph-fill ph-first-aid', color: C.rose },
  school: { label: 'School', icon: 'ph-fill ph-student', color: C.green },
  university: { label: 'Institution', icon: 'ph-fill ph-graduation-cap', color: C.green },
  business: { label: 'Employment', icon: 'ph-fill ph-buildings', color: C.green },
  township: { label: 'Society', icon: 'ph-fill ph-city', color: C.violet },
  civic: { label: 'Civic', icon: 'ph-fill ph-bank', color: C.violet },
  worship: { label: 'Community', icon: 'ph-fill ph-church', color: C.violet },
  landmark: { label: 'Landmark', icon: 'ph-fill ph-flag-banner', color: C.violet },
  cafe: { label: 'Lifestyle', icon: 'ph-fill ph-coffee', color: C.gold },
  road: { label: 'Road', icon: 'ph-fill ph-road-horizon', color: '#22d3ee' },
};

const TYPE_CAT: Record<string, string> = {
  bus_station: 'transit', bus_stop: 'transit', transit_station: 'transit', transit_depot: 'transit',
  train_station: 'railway', subway_station: 'railway', light_rail_station: 'railway',
  airport: 'airport', international_airport: 'airport',
  park: 'park', national_park: 'park', state_park: 'park', garden: 'park', playground: 'park',
  stadium: 'sports', gym: 'sports', fitness_center: 'sports', sports_complex: 'sports',
  sports_club: 'sports', swimming_pool: 'sports', athletic_field: 'sports', sports_activity_location: 'sports',
  shopping_mall: 'mall', department_store: 'mall',
  supermarket: 'market', grocery_store: 'market', market: 'market', convenience_store: 'market', wholesaler: 'market',
  hospital: 'hospital', medical_lab: 'pharmacy', pharmacy: 'pharmacy', doctor: 'pharmacy', dental_clinic: 'pharmacy',
  primary_school: 'school', school: 'school', secondary_school: 'school', preschool: 'school',
  university: 'university', college: 'university',
  local_government_office: 'civic', post_office: 'civic', city_hall: 'civic', police: 'civic', fire_station: 'civic', courthouse: 'civic',
  hindu_temple: 'worship', church: 'worship', mosque: 'worship', synagogue: 'worship', place_of_worship: 'worship',
  tourist_attraction: 'landmark', historical_landmark: 'landmark', museum: 'landmark',
  amusement_park: 'landmark', water_park: 'landmark', cultural_landmark: 'landmark', monument: 'landmark',
  cafe: 'cafe', coffee_shop: 'cafe', restaurant: 'cafe', bakery: 'cafe', bar: 'cafe',
  corporate_office: 'business', office: 'business',
  apartment_complex: 'township', housing_complex: 'township', apartment_building: 'township',
};

const PLACE_FIELDS = ['id', 'displayName', 'location', 'primaryType', 'types', 'rating', 'userRatingCount', 'businessStatus'];

/* ── Broad discovery: 7 grouped probes (many types per call) ───── */
interface Probe { id: string; radius: number; rank: 'DISTANCE' | 'POPULARITY'; max: number; types?: string[]; text?: string; }
const BROAD_PROBES: Probe[] = [
  { id: 'local-green-sport', radius: 2000, rank: 'DISTANCE', max: 20, types: ['park', 'playground', 'gym', 'sports_complex', 'stadium', 'swimming_pool'] },
  { id: 'local-daily', radius: 2000, rank: 'DISTANCE', max: 20, types: ['supermarket', 'grocery_store', 'convenience_store', 'department_store'] },
  { id: 'local-edu-civic', radius: 2000, rank: 'DISTANCE', max: 20, types: ['primary_school', 'school', 'secondary_school', 'local_government_office', 'post_office'] },
  { id: 'local-life', radius: 1800, rank: 'POPULARITY', max: 15, types: ['cafe', 'restaurant', 'hindu_temple', 'gurudwara', 'pharmacy', 'bus_station'] },
  { id: 'wide-major', radius: 4200, rank: 'POPULARITY', max: 20, types: ['shopping_mall', 'hospital', 'university', 'tourist_attraction'] },
  { id: 'region-transport', radius: 26000, rank: 'POPULARITY', max: 10, types: ['airport', 'international_airport', 'train_station'] },
  { id: 'text-employment', radius: 7000, rank: 'POPULARITY', max: 8, text: 'IT park business park industrial area' },
];
/** Budget: 7 broad + at most this many targeted gap probes. */
const MAX_GAP_PROBES = 4;

/* ── Property intent ──────────────────────────────────────────── */
export function intentOf(p: { type?: string; intent?: Intent }): Intent {
  if (p.intent) return p.intent;
  const t = (p.type || '').toLowerCase();
  if (/commercial|shop|booth|sco|scf|showroom|office|retail/.test(t)) return 'commercial';
  if (/invest/.test(t)) return 'investment';
  if (/rental|rent|lease/.test(t)) return 'rental';
  return 'residential';
}

/* ── Candidates ───────────────────────────────────────────────── */
interface Candidate extends SlotCandidate {
  placeId?: string;
  anchorId?: string;
  name: string;
  pos: LatLng;
  reviewCount?: number;
  rating?: number;
  contentAt: number;
}

let placesLib: any = null;
const memo = new Map<string, LocationIntel>();

/** Exact coordinate identity prevents a moved plot from reusing its old analysis. */
export function locationAnalysisKey(propertyId: string, origin: LatLng, intent: Intent): string {
  return `${propertyId}@${origin.lat},${origin.lng}#${intent}`;
}

function catOf(primary: string | undefined, types: string[]): string | null {
  if (primary && TYPE_CAT[primary]) return TYPE_CAT[primary];
  for (const t of types) if (TYPE_CAT[t]) return TYPE_CAT[t];
  return null;
}
function anchorCategory(kind: string): string {
  const map: Record<string, string> = {
    airport: 'airport', railway: 'railway', mall: 'mall', hospital: 'hospital',
    university: 'university', business: 'business', stadium: 'sports',
    landmark: 'landmark', township: 'township', transit: 'transit',
  };
  return map[kind] ?? 'landmark';
}

/** Listing names a dealer would never say out loud. */
const GENERIC = new Set(['shop', 'store', 'atm', 'clinic', 'market', 'hospital', 'school', 'park', 'gym', 'pg', 'hostel', 'office', 'temple', 'bus', 'busstop', 'busstand', 'college', 'university', 'mall', 'cafe', 'restaurant', 'hotel', 'medical', 'chemist', 'pharmacy', 'salon', 'property', 'dealer', 'properties']);
function nameUnusable(name: string): boolean {
  const t = name.trim();
  if (t.length < 3) return true;
  if (!/[a-z]/i.test(t)) return true;
  if (/^\+?\d[\d\s()-]{4,}$/.test(t)) return true;
  if (GENERIC.has(normalize(t).replace(/\s/g, ''))) return true;
  if ((t.match(/\d/g)?.length ?? 0) >= 6) return true;
  if (!coreName(t)) return true;
  return false;
}

/** The real-world story a candidate tells — used to stop repetition. */
function storyKeyFor(category: string, anchorId?: string): string {
  if (anchorId) return anchorId;
  return category;
}

function toCandidate(pl: any, origin: LatLng): Candidate | null {
  const name: string | undefined = pl.displayName;
  const loc = pl.location;
  if (!name || !pl.id || !loc) return null;
  if (pl.businessStatus && pl.businessStatus !== 'OPERATIONAL') return null;
  if (nameUnusable(name)) return null;
  const pos: LatLng = {
    lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
    lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
  };
  if (typeof pos.lat !== 'number' || typeof pos.lng !== 'number') return null;

  const types: string[] = [pl.primaryType, ...(pl.types || [])].filter(Boolean);
  let category = catOf(pl.primaryType, pl.types || []);
  const anchor = matchAnchor({ name, pos, category: category ?? 'landmark', placeId: pl.id });
  if (!category && anchor) category = anchorCategory(anchor.kind);
  if (!category) return null;

  const significance = significanceOf({
    category, types,
    anchorImportance: anchor?.importance ?? null,
    rating: pl.rating, reviews: pl.userRatingCount,
  });

  return {
    canonicalId: canonicalIdFor({ name, pos, category }, anchor),
    placeId: pl.id,
    anchorId: anchor?.id,
    name: anchor ? anchor.name : name.replace(/\s+/g, ' ').trim(),
    pos, category, significance,
    distance: metersBetween(origin, pos),
    storyKey: storyKeyFor(category, anchor?.id),
    reviewCount: pl.userRatingCount, rating: pl.rating,
    contentAt: Date.now(),
  };
}

/* ── Retrieval ────────────────────────────────────────────────── */
async function runProbes(origin: LatLng, probes: Probe[], propertyId: string): Promise<{ found: Candidate[]; ok: number }> {
  if (!placesLib) placesLib = await importMapsLibrary<any>('places');
  const { Place, SearchNearbyRankPreference } = placesLib;
  const found: Candidate[] = [];
  let ok = 0;

  await Promise.all(probes.map(async (probe) => {
    try {
      let places: any[] = [];
      if (probe.types) {
        ({ places } = await Place.searchNearby({
          fields: PLACE_FIELDS,
          locationRestriction: { center: origin, radius: probe.radius },
          includedPrimaryTypes: probe.types,
          maxResultCount: probe.max,
          rankPreference: probe.rank === 'DISTANCE' ? SearchNearbyRankPreference?.DISTANCE : SearchNearbyRankPreference?.POPULARITY,
        }));
        meter('places.searchNearby', 1, { propertyId, mode: 'fresh', note: probe.id });
      } else if (probe.text) {
        ({ places } = await Place.searchByText({
          textQuery: probe.text, fields: PLACE_FIELDS,
          locationBias: { center: origin, radius: probe.radius },
          maxResultCount: probe.max,
        }));
        meter('places.searchText', 1, { propertyId, mode: 'fresh', note: probe.id });
      }
      ok++;
      for (const pl of places || []) {
        const c = toCandidate(pl, origin);
        if (c) found.push(c);
      }
    } catch { /* one probe failing must never break the analysis */ }
  }));

  return { found, ok };
}

const toStored = (c: Candidate): StoredEntity => ({
  canonicalId: c.canonicalId, placeId: c.placeId, anchorId: c.anchorId,
  category: c.category, importance: c.significance, publicInfra: false,
  name: c.name, pos: c.pos, reviewCount: c.reviewCount, rating: c.rating, contentAt: c.contentAt,
});
function fromStored(s: StoredEntity, origin: LatLng): Candidate {
  return {
    canonicalId: s.canonicalId, placeId: s.placeId, anchorId: s.anchorId,
    name: s.name, pos: s.pos, category: s.category,
    significance: s.importance,
    distance: metersBetween(origin, s.pos),
    storyKey: storyKeyFor(s.category, s.anchorId),
    reviewCount: s.reviewCount, rating: s.rating, contentAt: s.contentAt,
  };
}

function toAdvantage(c: Candidate, section: Section, slotId: string): Advantage {
  const meta = CATS[c.category] ?? CATS.landmark;
  return {
    id: c.canonicalId, name: c.name, category: c.category, categoryLabel: meta.label,
    icon: meta.icon, color: meta.color, pos: c.pos, kind: 'poi', section,
    distanceMeters: Math.round(c.distance), durationSec: null, aerial: true, slotId,
  };
}

/* ── Public API ───────────────────────────────────────────────── */
export async function analyseLocation(property: Property, origin: LatLng): Promise<LocationIntel> {
  const intent = intentOf(property);
  const memoKey = locationAnalysisKey(property.id, origin, intent);
  const cached = memo.get(memoKey);
  if (cached) return cached;

  // 1 · plan the questions BEFORE looking at any data
  const aroundSlots = planSlots(intent, 'around');
  const nearbySlots = planSlots(intent, 'nearby');

  // 2 · recall — free, persistent, shared across properties and dealers
  let pool = (await readNeighbourhood(origin)).map((s) => fromStored(s, origin));
  let fresh = false;
  let discoveryFailed = false;

  // 3 · discover only if MAPCO never successfully studied this cell
  if (await hasAnalysedCell(origin)) {
    meter('places.searchNearby', 0, { propertyId: property.id, mode: 'reused', note: 'recall-hit' });
  } else if (await inDiscoveryBackoff(origin)) {
    meter('places.searchNearby', 0, { propertyId: property.id, mode: 'reused', note: 'retry-cooldown' });
  } else {
    await markDiscoveryAttempt(origin);
    const { found, ok } = await runProbes(origin, BROAD_PROBES, property.id);
    if (ok > 0) {
      pool = [...pool, ...found];

      // 5 · ONE targeted pass for the strongest unanswered questions
      const gapProbes = gapProbesFor(pool, aroundSlots, nearbySlots);
      if (gapProbes.length) {
        const gap = await runProbes(origin, gapProbes, property.id);
        pool = [...pool, ...gap.found];
      }
      await writeCell(origin, pool.filter((c) => c.placeId).map(toStored), true);
      fresh = true;
    } else {
      discoveryFailed = true;
    }
  }

  // 4 · resolve to unique real-world entities, then answer the questions
  const unique = dedupeEntities(pool, (c) => c.significance + (c.anchorId ? 0.5 : 0));

  // ── LAYER OWNERSHIP ──────────────────────────────────────────
  // Around Sector and Nearby are two different KINDS of knowledge, not two
  // radii. Every entity is owned by exactly one layer, decided by semantic
  // importance rather than distance: a city-scale anchor belongs to Nearby
  // even when it is close, and an everyday place belongs to Around even
  // when Nearby has empty slots. Nearby claims first (it is the strictly
  // more selective layer), then Around answers its questions from what is
  // genuinely hyperlocal. This is what makes the two tabs feel like two
  // different things instead of one list shown twice.
  const nearbyPool = unique.filter(ownsNearbyLayer);
  const nearbyAssigned = assignSlots(nearbySlots, nearbyPool);

  const claimedIds = new Set(nearbyAssigned.map((a) => a.candidate.canonicalId));
  const claimedAnchors = new Set(
    nearbyAssigned.map((a) => a.candidate.anchorId).filter((id): id is string => !!id),
  );
  const aroundPool = unique.filter((c) =>
    !claimedIds.has(c.canonicalId) && !(c.anchorId && claimedAnchors.has(c.anchorId)));

  const around = assignSlots(aroundSlots, aroundPool).map((a) => toAdvantage(a.candidate, 'around', a.slot.id));
  const nearby = nearbyAssigned.map((a) => toAdvantage(a.candidate, 'nearby', a.slot.id));

  // MAPCO's own knowledge backfills city-level anchors Google under-reports
  if (nearby.length < 6) topUpFromAnchors(nearby, origin, claimedIds);

  const intel: LocationIntel = {
    around: around.sort((a, b) => a.distanceMeters - b.distanceMeters),
    nearby: nearby.sort((a, b) => a.distanceMeters - b.distanceMeters),
    roads: roadAdvantagesFor(origin, intent),
    fresh, intent,
  };

  if (!discoveryFailed) memo.set(memoKey, intel);
  return intel;
}

/**
 * Does this entity belong to the CITY-ANCHOR layer rather than the
 * hyperlocal one? Category eligibility keeps everyday things (kirana,
 * local park, clinic, café) out structurally; the significance floor then
 * keeps ordinary members of eligible categories — a small neighbourhood
 * school, a minor society — in Around where they are actually useful.
 */
const NEARBY_OWNERSHIP_SIGNIFICANCE = 0.62;
function ownsNearbyLayer(c: Candidate): boolean {
  return NEARBY_ELIGIBLE.has(c.category) && c.significance >= NEARBY_OWNERSHIP_SIGNIFICANCE;
}

/** Which targeted probes would answer the strongest missing questions? */
function gapProbesFor(pool: Candidate[], aroundSlots: Slot[], nearbySlots: Slot[]): Probe[] {
  const unique = dedupeEntities(pool, (c) => c.significance);
  const missing = [
    ...unansweredSlots(aroundSlots, assignSlots(aroundSlots, unique)),
    ...unansweredSlots(nearbySlots, assignSlots(nearbySlots, unique)),
  ].sort((a, b) => b.priority - a.priority).slice(0, MAX_GAP_PROBES);

  return missing.map((s) => ({
    id: 'gap:' + s.id,
    radius: s.probe!.radius,
    rank: s.probe!.rank,
    max: 12,
    types: s.probe!.types,
    text: s.probe!.text,
  }));
}

/** MAPCO knows the Tri-City's major anchors independently of Google.
 *  `claimed` carries entities already owned elsewhere so a top-up can never
 *  reintroduce something the other tab is showing. */
function topUpFromAnchors(nearby: Advantage[], origin: LatLng, claimed: ReadonlySet<string> = new Set()): void {
  const have = new Set([...nearby.map((a) => a.id), ...claimed]);
  const stories = new Set(nearby.map((a) => a.category));
  const extra = MAPCO_ANCHORS
    .filter((a) => a.trusted && !have.has(a.id))
    .map((a) => ({ a, cat: anchorCategory(a.kind), dist: metersBetween(origin, a.pos) }))
    .filter((x) => {
      const far = x.cat === 'airport' || x.cat === 'railway';
      return x.dist <= (far ? 30000 : 6000) && !stories.has(x.cat);
    })
    .sort((x, y) => y.a.importance - x.a.importance)
    .slice(0, 6 - nearby.length);

  for (const { a, cat, dist } of extra) {
    const meta = CATS[cat] ?? CATS.landmark;
    stories.add(cat);
    nearby.push({
      id: a.id, name: a.name, category: cat, categoryLabel: meta.label,
      icon: meta.icon, color: meta.color, pos: a.pos, kind: 'poi', section: 'nearby',
      distanceMeters: Math.round(dist), durationSec: null, aerial: true, slotId: 'anchor',
    });
  }
}

/** Roads: authoritative MAPCO GeoJSON, selected locally with no API call. */
/** Default road set: the SHORTEST convincing explanation of connectivity.
 *  Four excellent roads beat eight technically-relevant ones. */
export const ROAD_DISPLAY_LIMIT = 6;

export function roadAdvantagesFor(origin: LatLng, intent: Intent): Advantage[] {
  const roads = selectRoadsFor(origin, intent, ROAD_DISPLAY_LIMIT);
  return roads.map((r) => ({
    id: r.spec.id, name: r.spec.name, category: 'road', categoryLabel: CATS.road.label,
    icon: CATS.road.icon, color: CATS.road.color, pos: r.accessPoint, kind: 'road' as const,
    section: 'roads' as const,
    distanceMeters: Math.round(r.accessMeters), durationSec: null, aerial: true,
    accessPoint: r.accessPoint, path: r.path, roadImportance: r.spec.importance,
    roadScore: r.score, roadRelation: r.relation, roadHops: r.graphHops,
    roadNetworkMeters: r.networkMeters, roadTier: r.tier,
  }));
}

export function clearAdvantageCache(propertyId?: string): void {
  if (!propertyId) { memo.clear(); return; }
  for (const k of [...memo.keys()]) if (k.startsWith(propertyId + '@')) memo.delete(k);
}

/** Exposed for tests. */
export const _internals = { toCandidate, storyKeyFor, scaleOf };
