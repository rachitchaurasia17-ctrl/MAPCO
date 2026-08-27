import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURATED_LANDMARKS } from '../src/packages/property-intelligence/landmarks/dataset';
import {
  landmarkCoordinateError, CURATED_REGION_BOUNDS,
} from '../src/packages/property-intelligence/landmarks/types';
import type { CuratedLandmark } from '../src/packages/property-intelligence/landmarks/types';
import {
  shortlistCityReach, finalizeCityReach, haversineKm,
  type RoutedCandidate,
  CITY_REACH_DISTANCE,
} from '../src/packages/property-intelligence/landmarks/city-reach-selector';

const INDEX = new URL('../public/landmarks/index.json', import.meta.url);

/** The imported library, as the app will actually load it. */
const library: CuratedLandmark[] = JSON.parse(readFileSync(INDEX, 'utf8')).landmarks;

/* Representative real coordinates across the launch geography. */
const ORIGINS = {
  sector78Mohali: { latitude: 30.6885, longitude: 76.7020 },
  aerocity: { latitude: 30.6400, longitude: 76.7550 },
  newChandigarh: { latitude: 30.8100, longitude: 76.7250 },
  panchkula: { latitude: 30.6942, longitude: 76.8606 },
};

describe('curated landmark dataset', () => {
  it('gives every landmark a structurally valid, in-region coordinate', () => {
    for (const row of CURATED_LANDMARKS) {
      expect(landmarkCoordinateError(row.latitude, row.longitude), `${row.name}`).toBeNull();
    }
  });

  it('rejects impossible and out-of-region coordinates rather than accepting them', () => {
    expect(landmarkCoordinateError(NaN, 76.7)).toBeTruthy();
    expect(landmarkCoordinateError(95, 76.7)).toBeTruthy();
    expect(landmarkCoordinateError(30.7, 200)).toBeTruthy();
    // A dropped digit would silently poison every shortlist.
    expect(landmarkCoordinateError(3.07, 76.7)).toBeTruthy();
    expect(landmarkCoordinateError(CURATED_REGION_BOUNDS.minLatitude + 0.1, 76.7)).toBeNull();
  });

  it('has unique ids', () => {
    const ids = CURATED_LANDMARKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('imported every dataset row into the published library', () => {
    expect(library.length).toBe(CURATED_LANDMARKS.length);
  });

  it('covers more than one city, so anchors can differ by geography', () => {
    const cities = new Set(library.map((l) => l.city));
    expect(cities.size).toBeGreaterThanOrEqual(3);
  });
});

describe('curated landmark photos', () => {
  it('serves every photo from MAPCO assets — never Google, never base64', () => {
    for (const landmark of library) {
      if (landmark.image === null) continue;
      expect(landmark.image, landmark.name).toMatch(/^\/landmarks\//);
      expect(landmark.image).not.toMatch(/googleapis|googleusercontent|maps\.google/);
      expect(landmark.image).not.toMatch(/^data:/);
    }
  });

  it('points every photo at a file that actually exists on disk', () => {
    for (const landmark of library) {
      if (!landmark.image) continue;
      const path = new URL(`../public${landmark.image}`, import.meta.url);
      expect(existsSync(path), `${landmark.name} → ${landmark.image}`).toBe(true);
    }
  });

  it('leaves a landmark with no supplied photo as null rather than substituting one', () => {
    const missing = library.filter((l) => l.image === null);
    // These are reported by the importer, not silently back-filled.
    for (const landmark of missing) expect(landmark.image).toBeNull();
    // Every other landmark has a real curated photo.
    expect(library.length - missing.length).toBeGreaterThan(40);
  });

  it('never reuses one image file for two different landmarks', () => {
    const images = library.map((l) => l.image).filter(Boolean);
    expect(new Set(images).size).toBe(images.length);
  });
});

describe('City Reach shortlisting (local geometry, no API cost)', () => {
  it('shortlists far fewer landmarks than it holds, so routing stays small', () => {
    const shortlist = shortlistCityReach(ORIGINS.sector78Mohali, library, { shortlistSize: 10 });
    expect(shortlist.length).toBeLessThanOrEqual(10);
    expect(shortlist.length).toBeLessThan(library.length / 2);
  });

  it('gives different geographies materially different anchors', () => {
    const ids = (o: typeof ORIGINS.aerocity) =>
      shortlistCityReach(o, library, { shortlistSize: 10 }).map((c) => c.landmark.id);
    const mohali = ids(ORIGINS.sector78Mohali);
    const newChd = ids(ORIGINS.newChandigarh);
    const panchkula = ids(ORIGINS.panchkula);

    const overlap = (a: string[], b: string[]) => a.filter((id) => b.includes(id)).length;
    // Not the same static six everywhere.
    expect(overlap(mohali, newChd)).toBeLessThan(mohali.length);
    expect(overlap(mohali, panchkula)).toBeLessThan(mohali.length);
    expect(new Set([...mohali, ...newChd, ...panchkula]).size).toBeGreaterThan(mohali.length);
  });

  it('surfaces New Chandigarh anchors for a New Chandigarh property', () => {
    const picked = shortlistCityReach(ORIGINS.newChandigarh, library, { shortlistSize: 10 });
    expect(picked.some((c) => c.landmark.city === 'New Chandigarh')).toBe(true);
  });

  it('surfaces the airport for an Aerocity property', () => {
    const picked = shortlistCityReach(ORIGINS.aerocity, library, { shortlistSize: 12 });
    expect(picked.some((c) => c.landmark.category === 'airport')).toBe(true);
  });

  /* Variety is no longer FORCED — a cap would let a weak anchor in ahead
     of a strong one. A dense location still produces a varied answer
     naturally, which is what this now checks. */
  it('produces a naturally varied answer for a dense location', () => {
    const picked = shortlistCityReach(ORIGINS.sector78Mohali, library, { shortlistSize: 10 });
    const categories = new Set(picked.map((c) => c.landmark.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });

  /* Connectivity used to be allowed a much wider radius. It no longer is:
     an airport 10 km away explains nothing about this property, so ONE
     hard ceiling now applies to every category. */
  it('applies the same hard ceiling to every category, connectivity included', () => {
    const far = { latitude: 30.62, longitude: 76.68 };
    const picked = shortlistCityReach(far, library, { shortlistSize: 12 });
    for (const c of picked) {
      expect(c.straightLineKm, c.landmark.name).toBeLessThanOrEqual(CITY_REACH_DISTANCE.hardMaxKm);
    }
  });

  it('is not merely the N closest landmarks', () => {
    const shortlist = shortlistCityReach(ORIGINS.sector78Mohali, library, { shortlistSize: 8 });
    const nearest = [...library]
      .filter((l) => l.active)
      .sort((a, b) => haversineKm(ORIGINS.sector78Mohali, a) - haversineKm(ORIGINS.sector78Mohali, b))
      .slice(0, 8).map((l) => l.id);
    expect(shortlist.map((c) => c.landmark.id)).not.toEqual(nearest);
  });
});

describe('City Reach finalisation (after real routing)', () => {
  const routed = (over: Partial<RoutedCandidate>[] = []): RoutedCandidate[] =>
    shortlistCityReach(ORIGINS.sector78Mohali, library, { shortlistSize: 10 })
      .map((c, i) => ({
        ...c,
        distanceMeters: 3000 + i * 1200,
        durationSeconds: 480 + i * 150,
        ...(over[i] ?? {}),
      }));

  it('returns at most the limit, and never pads to reach it', () => {
    const final = finalizeCityReach(routed(), { limit: 6 });
    expect(final.length).toBeGreaterThan(0);
    expect(final.length).toBeLessThanOrEqual(6);
    // Everything shown is inside the ceiling on its REAL road distance.
    for (const c of final) expect(c.distanceMeters / 1000).toBeLessThanOrEqual(CITY_REACH_DISTANCE.hardMaxKm);
  });

  it('drops a candidate that failed to route instead of estimating it', () => {
    const withFailure = routed([{ durationSeconds: 0, distanceMeters: 0 }]);
    const failedId = withFailure[0]!.landmark.id;
    const final = finalizeCityReach(withFailure, { limit: 10 });
    expect(final.map((c) => c.landmark.id)).not.toContain(failedId);
  });

  it('never invents a travel time from the straight-line distance', () => {
    const allFailed = routed().map((c) => ({ ...c, durationSeconds: NaN, distanceMeters: NaN }));
    expect(finalizeCityReach(allFailed)).toHaveLength(0);
  });

  it('presents the final anchors nearest-first by real travel time', () => {
    const final = finalizeCityReach(routed(), { limit: 6 });
    const times = final.map((c) => c.durationSeconds);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('keeps the final set varied', () => {
    const final = finalizeCityReach(routed(), { limit: 6, maxPerCategory: 2 });
    const counts = new Map<string, number>();
    for (const c of final) counts.set(c.landmark.category, (counts.get(c.landmark.category) ?? 0) + 1);
    for (const [, n] of counts) expect(n).toBeLessThanOrEqual(2);
  });
});
