/* ═══════════════════════════════════════════════════════════════
   MAPCO — City Reach selector
   ---------------------------------------------------------------
   City Reach answers ONE question:

     "What major, recognisable places are genuinely CLOSE to this
      property — close enough to explain where it sits in the city?"

   It is not "famous places somewhere in the Tri-City". A monument 12 km
   away explains nothing about Sector 78, however well known it is.

   So proximity is a HARD FILTER, applied before anything else:

     ~1–3 km   strongest
     ~3–5 km   still relevant
     beyond    excluded, regardless of fame

   Only what survives that gate is ranked, by

     prominence × usefulness × proximity

   multiplicatively — a landmark that is weak on any one of the three
   cannot be rescued by the other two.

   Count is never padded. If three strong anchors survive the gate, the
   answer is three anchors.
   ═══════════════════════════════════════════════════════════════ */
import type { CuratedLandmark, LandmarkCategory } from './types.ts';

export interface GeoPoint { latitude: number; longitude: number }

/** Straight-line km. Used ONLY to gate and shortlist — never displayed. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The distance rule. Everything beyond `hardMaxKm` is excluded outright. */
export const CITY_REACH_DISTANCE = {
  /** Inside this, proximity is not a penalty at all. */
  strongKm: 3,
  /** Still relevant, with a falling proximity score. */
  relevantKm: 5,
  /** Absolute ceiling. Nothing past this appears, however famous. */
  hardMaxKm: 6,
} as const;

/**
 * How much a category helps EXPLAIN a location to a buyer. A hospital or
 * a mall anchors a neighbourhood in someone's mind; a rose garden does
 * not, even when it is well known.
 */
const CATEGORY_USEFULNESS: Record<LandmarkCategory, number> = {
  hospital: 1.00,
  mall: 0.95,
  'major-market': 0.92,
  airport: 0.90,
  'employment-hub': 0.90,
  'business-district': 0.88,
  university: 0.85,
  'railway-station': 0.85,
  'bus-terminal': 0.72,
  'major-road': 0.70,
  civic: 0.58,
  institution: 0.52,
  recreation: 0.48,
  other: 0.38,
};

const RECOGNITION_PROMINENCE = { regional: 1.0, city: 0.78, local: 0.42 } as const;

/** Prominence, refined by curated importance where an operator set one. */
function prominenceOf(landmark: CuratedLandmark): number {
  const base = RECOGNITION_PROMINENCE[landmark.recognition];
  if (landmark.importance === 'regional') return Math.max(base, 1.0);
  if (landmark.importance === 'city') return Math.max(base, 0.78);
  if (landmark.importance === 'local') return Math.min(base, 0.42);
  return base;
}

/**
 * Proximity score under the distance rule. Full marks inside the strong
 * band, falling away across the relevant band, zero past the ceiling.
 */
export function proximityScore(km: number): number {
  const { strongKm, relevantKm } = CITY_REACH_DISTANCE;
  if (km <= strongKm) return 1;
  if (km >= relevantKm) return 0.25;
  // Linear falloff between the two bands.
  return 1 - 0.75 * ((km - strongKm) / (relevantKm - strongKm));
}

/**
 * Does this landmark claim relevance to the property's locality? Curated
 * `relevantTo` is an operator statement about which pockets a landmark
 * actually serves. Absent metadata is neutral, never a penalty.
 */
function localityBoost(landmark: CuratedLandmark, locality: string | undefined): number {
  if (!locality || !landmark.relevantTo?.length) return 1;
  const text = locality.toLowerCase();
  return landmark.relevantTo.some((zone) => text.includes(zone.toLowerCase())) ? 1.15 : 1;
}

export interface CityReachCandidate {
  landmark: CuratedLandmark;
  straightLineKm: number;
  /** Internal ranking value. Never rendered, never persisted as a score. */
  rank: number;
}

export interface ShortlistOptions {
  /** How many candidates to send to Route Matrix. */
  shortlistSize?: number;
  /** Override the hard distance ceiling (km). */
  maxKm?: number;
  /** The property's locality/sector text, for curated relevance. */
  locality?: string;
  /**
   * Minimum rank to be worth a route call. Stops a weak, far anchor
   * being routed just to fill a slot.
   */
  minRank?: number;
}

/**
 * Cheap local shortlist. No API calls, no cost.
 *
 * Distance gates first; nothing beyond the ceiling is considered at all.
 */
export function shortlistCityReach(
  origin: GeoPoint,
  landmarks: readonly CuratedLandmark[],
  options: ShortlistOptions = {},
): CityReachCandidate[] {
  const maxKm = options.maxKm ?? CITY_REACH_DISTANCE.hardMaxKm;
  const shortlistSize = options.shortlistSize ?? 10;
  const minRank = options.minRank ?? 0.22;

  const scored: CityReachCandidate[] = [];
  for (const landmark of landmarks) {
    if (!landmark.active) continue;
    const straightLineKm = haversineKm(origin, landmark);
    // THE hard rule. Fame does not buy an exception.
    if (straightLineKm > maxKm) continue;

    const rank = prominenceOf(landmark)
      * CATEGORY_USEFULNESS[landmark.category]
      * proximityScore(straightLineKm)
      * localityBoost(landmark, options.locality);

    if (rank < minRank) continue;
    scored.push({ landmark, straightLineKm, rank });
  }

  scored.sort((a, b) => (b.rank - a.rank) || (a.straightLineKm - b.straightLineKm));
  /* No diversity padding. Category variety is a nice property of a good
     answer, not a target to hit — forcing it is how a weak anchor gets in
     ahead of a strong one. */
  return scored.slice(0, shortlistSize);
}

export interface RoutedCandidate extends CityReachCandidate {
  /** Real road distance in metres, from Route Matrix. Never estimated. */
  distanceMeters: number;
  /** Real travel duration in seconds, from Route Matrix. Never estimated. */
  durationSeconds: number;
}

export interface FinalizeOptions {
  /** Upper bound on rows. Fewer is correct when fewer are strong. */
  limit?: number;
  /** Road distance ceiling (km) — the real number, not the straight line. */
  maxKm?: number;
}

/**
 * Final selection, once Route Matrix has returned real travel.
 *
 * The road distance re-applies the ceiling: a landmark 4 km away in a
 * straight line but 9 km by road does not explain this location either.
 * A candidate that failed to route is dropped, never estimated.
 */
export function finalizeCityReach(
  routed: readonly RoutedCandidate[],
  options: FinalizeOptions = {},
): RoutedCandidate[] {
  const limit = options.limit ?? 6;
  const maxKm = options.maxKm ?? CITY_REACH_DISTANCE.hardMaxKm;

  const usable = routed.filter((r) =>
    Number.isFinite(r.durationSeconds) && r.durationSeconds > 0
    && Number.isFinite(r.distanceMeters) && r.distanceMeters > 0
    && r.distanceMeters / 1000 <= maxKm);

  const ranked = [...usable].sort((a, b) => {
    const score = (c: RoutedCandidate) =>
      prominenceOf(c.landmark)
      * CATEGORY_USEFULNESS[c.landmark.category]
      * proximityScore(c.distanceMeters / 1000);
    return score(b) - score(a) || a.distanceMeters - b.distanceMeters;
  });

  // Present nearest-first: that is how a dealer reads connectivity.
  return ranked.slice(0, limit).sort((a, b) => a.durationSeconds - b.durationSeconds);
}
