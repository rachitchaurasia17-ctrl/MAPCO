/* ═══════════════════════════════════════════════════════════════
   MAPCO — City Reach selector
   ---------------------------------------------------------------
   Turns ~50 curated landmarks into the 5–6 that genuinely explain
   where THIS property sits in the region, without routing all of them.

       property.location
         → cheap local geometry (haversine, our own code, ₹0)
         → shortlist 8–12 plausible anchors
         → Route Matrix on the shortlist ONLY
         → final 5–6 by real travel time + category diversity

   Ranking is factual and internal. It weighs how far a landmark is, how
   widely it is recognised, whether it connects the property to the wider
   region, and whether the set stays varied. It never produces a locality
   score, an investment score, or any number shown to a user — the output
   is an ordered list of real places.
   ═══════════════════════════════════════════════════════════════ */
import type { CuratedLandmark, LandmarkCategory } from './types.ts';

export interface GeoPoint { latitude: number; longitude: number }

/** Straight-line km. Used ONLY to shortlist before routing — never displayed. */
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

/**
 * Categories that explain regional CONNECTIVITY. These stay relevant from
 * further away — an airport 20 km out still matters; a mall 20 km out
 * usually does not.
 */
const CONNECTIVITY: ReadonlySet<LandmarkCategory> = new Set([
  'airport', 'railway-station', 'bus-terminal', 'major-road',
]);

/** How far a category stays meaningful, in km. */
function relevanceRadiusKm(category: LandmarkCategory): number {
  if (CONNECTIVITY.has(category)) return 45;
  if (category === 'hospital' || category === 'university'
    || category === 'employment-hub' || category === 'business-district') return 30;
  return 22;
}

const RECOGNITION_WEIGHT = { regional: 1.0, city: 0.72, local: 0.45 } as const;

export interface CityReachCandidate {
  landmark: CuratedLandmark;
  straightLineKm: number;
  /** Internal ranking value. Never rendered, never persisted as a score. */
  rank: number;
}

export interface ShortlistOptions {
  /** How many candidates to send to Route Matrix. */
  shortlistSize?: number;
  /** Hard cap on straight-line distance for any anchor. */
  maxKm?: number;
  /** At most this many anchors from any one category in the shortlist. */
  maxPerCategory?: number;
}

/**
 * Cheap local shortlist. No API calls, no cost.
 *
 * A landmark earns its place by being close RELATIVE TO WHAT IT IS: an
 * airport is allowed to be far, a market is not. That is what stops a
 * Mohali property and a New Chandigarh property receiving the same list.
 */
export function shortlistCityReach(
  origin: GeoPoint,
  landmarks: readonly CuratedLandmark[],
  options: ShortlistOptions = {},
): CityReachCandidate[] {
  const shortlistSize = options.shortlistSize ?? 10;
  const maxKm = options.maxKm ?? 45;
  const maxPerCategory = options.maxPerCategory ?? 2;

  const scored: CityReachCandidate[] = [];
  for (const landmark of landmarks) {
    if (!landmark.active) continue;
    const straightLineKm = haversineKm(origin, landmark);
    if (straightLineKm > maxKm) continue;
    const radius = relevanceRadiusKm(landmark.category);
    if (straightLineKm > radius) continue;

    // Proximity relative to what this category is allowed to be — so a
    // 15 km airport still ranks well while a 15 km mall does not.
    const proximity = 1 - Math.min(1, straightLineKm / radius);
    const recognition = RECOGNITION_WEIGHT[landmark.recognition];
    // Connectivity anchors explain regional position, which is what City
    // Reach is for, so they carry a little extra weight.
    const connectivity = CONNECTIVITY.has(landmark.category) ? 0.15 : 0;
    scored.push({
      landmark,
      straightLineKm,
      rank: proximity * 0.55 + recognition * 0.30 + connectivity,
    });
  }

  scored.sort((a, b) => (b.rank - a.rank) || (a.straightLineKm - b.straightLineKm));

  // Enforce variety while filling the shortlist: a list of four hospitals
  // explains less than a hospital, a mall, a university and the airport.
  const perCategory = new Map<LandmarkCategory, number>();
  const picked: CityReachCandidate[] = [];
  for (const candidate of scored) {
    if (picked.length >= shortlistSize) break;
    const category = candidate.landmark.category;
    const used = perCategory.get(category) ?? 0;
    if (used >= maxPerCategory) continue;
    perCategory.set(category, used + 1);
    picked.push(candidate);
  }
  // If diversity capping left room, top up with the best of what is left.
  if (picked.length < shortlistSize) {
    for (const candidate of scored) {
      if (picked.length >= shortlistSize) break;
      if (!picked.includes(candidate)) picked.push(candidate);
    }
  }
  return picked;
}

export interface RoutedCandidate extends CityReachCandidate {
  /** Real road distance in metres, from Route Matrix. Never estimated. */
  distanceMeters: number;
  /** Real travel duration in seconds, from Route Matrix. Never estimated. */
  durationSeconds: number;
}

export interface FinalizeOptions {
  /** Final City Reach row count. */
  limit?: number;
  maxPerCategory?: number;
}

/**
 * Final selection, after Route Matrix has returned real travel times.
 *
 * A candidate that failed to route is dropped, never estimated from the
 * straight-line distance we used to shortlist it.
 */
export function finalizeCityReach(
  routed: readonly RoutedCandidate[],
  options: FinalizeOptions = {},
): RoutedCandidate[] {
  const limit = options.limit ?? 6;
  const maxPerCategory = options.maxPerCategory ?? 2;

  const usable = routed.filter((r) =>
    Number.isFinite(r.durationSeconds) && r.durationSeconds > 0
    && Number.isFinite(r.distanceMeters) && r.distanceMeters > 0);

  // Re-rank on the real number now that we have it: actual drive time
  // relative to what the category is allowed to be, plus recognition.
  const ranked = [...usable].sort((a, b) => {
    const score = (c: RoutedCandidate) => {
      const minutes = c.durationSeconds / 60;
      const budget = CONNECTIVITY.has(c.landmark.category) ? 50 : 32;
      const proximity = 1 - Math.min(1, minutes / budget);
      return proximity * 0.6 + RECOGNITION_WEIGHT[c.landmark.recognition] * 0.4;
    };
    return score(b) - score(a) || a.durationSeconds - b.durationSeconds;
  });

  const perCategory = new Map<LandmarkCategory, number>();
  const picked: RoutedCandidate[] = [];
  for (const candidate of ranked) {
    if (picked.length >= limit) break;
    const used = perCategory.get(candidate.landmark.category) ?? 0;
    if (used >= maxPerCategory) continue;
    perCategory.set(candidate.landmark.category, used + 1);
    picked.push(candidate);
  }
  for (const candidate of ranked) {
    if (picked.length >= limit) break;
    if (!picked.includes(candidate)) picked.push(candidate);
  }
  // Present nearest-first: that is how a dealer reads connectivity.
  return picked.sort((a, b) => a.durationSeconds - b.durationSeconds);
}
