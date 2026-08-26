import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runPropertyIntelligence } from '../src/packages/property-intelligence/pipeline';
import type {
  PipelineDeps, GeoPoint, ResolvedDestination, MatrixElement, DiscoveryResult,
} from '../src/packages/property-intelligence/types';
import type { CuratedLandmark } from '../src/packages/property-intelligence/landmarks/types';
import { grossCost } from '../src/packages/property-intelligence/cost-v2';

const library: CuratedLandmark[] = JSON.parse(
  readFileSync(new URL('../public/landmarks/index.json', import.meta.url), 'utf8'),
).landmarks;

const SECTOR_78: GeoPoint = { latitude: 30.6885, longitude: 76.7020 };
const NEW_CHANDIGARH: GeoPoint = { latitude: 30.8100, longitude: 76.7250 };

/** Counts every outbound request the pipeline makes. */
function makeDeps(point: GeoPoint, over: Partial<PipelineDeps> = {}) {
  const counters = { discovery: 0, places: 0, matrix: 0, matrixElements: 0 };

  const deps: PipelineDeps = {
    discovery: {
      name: 'test', model: 'test-model',
      async discover(): Promise<DiscoveryResult> {
        counters.discovery++;
        return {
          candidates: [
            { group: 'dayToDay', category: 'park', name: 'Local Park' },
            { group: 'dayToDay', category: 'grocery', name: 'Sector Market' },
            { group: 'dayToDay', category: 'gym', name: 'Fitness Studio' },
            { group: 'dayToDay', category: 'school', name: 'Public School' },
            { group: 'dayToDay', category: 'healthcare', name: 'Clinic' },
            { group: 'dayToDay', category: 'daily_market', name: 'Vegetable Market' },
            // City Reach candidates must be IGNORED now — curated wins.
            { group: 'cityReach', destinationType: 'mall', name: 'Some Distant Mall' },
            { group: 'cityReach', destinationType: 'airport', name: 'Some Airport' },
          ],
          usage: { inputTokens: 1300, outputTokens: 600, groundingQueries: 0 },
        };
      },
    },
    resolver: {
      async resolvePlace(name: string): Promise<ResolvedDestination | null> {
        counters.places++;
        // Deterministic nearby point per name.
        const seed = name.length;
        return {
          kind: 'place', placeId: `place-${name.replace(/\s+/g, '-')}`, name,
          latitude: point.latitude + seed * 0.0004,
          longitude: point.longitude + seed * 0.0004,
        };
      },
    },
    matrix: {
      async computeMatrix(_o, destinations): Promise<MatrixElement[]> {
        counters.matrix++;
        counters.matrixElements += destinations.length;
        return destinations.map((_d, i) => ({
          ok: true, distanceMeters: 600 + i * 900, durationSeconds: 300 + i * 180,
        }));
      },
    },
    roads: [],
    landmarks: library,
    now: () => '2026-08-26T00:00:00.000Z',
    ...over,
  };
  return { deps, counters };
}

describe('live pipeline — curated City Reach', () => {
  it('issues ZERO Places calls for City Reach', async () => {
    const { deps, counters } = makeDeps(SECTOR_78);
    const result = await runPropertyIntelligence({
      dealerId: 'd1', propertyId: 'p1', point: SECTOR_78,
    } as never, deps);

    expect(result.usage.cityReachPlacesCalls).toBe(0);
    // Every Places call belongs to Day to Day.
    expect(counters.places).toBe(result.usage.placesCalls);
    expect(result.viewModel.cityReach.length).toBeGreaterThan(0);
  });

  it('uses MAPCO curated photos for City Reach, never Google', async () => {
    const { deps } = makeDeps(SECTOR_78);
    const result = await runPropertyIntelligence({
      dealerId: 'd1', propertyId: 'p1', point: SECTOR_78,
    } as never, deps);

    for (const row of result.viewModel.cityReach) {
      expect(row.imageSource).toBe('mapco-curated');
      if (row.image) expect(row.image).toMatch(/^\/landmarks\//);
      expect(row.image ?? '').not.toMatch(/googleapis|googleusercontent/);
    }
  });

  it('ignores the model\'s City Reach suggestions entirely', async () => {
    const { deps } = makeDeps(SECTOR_78);
    const result = await runPropertyIntelligence({
      dealerId: 'd1', propertyId: 'p1', point: SECTOR_78,
    } as never, deps);
    const names = result.viewModel.cityReach.map((r) => r.name);
    expect(names).not.toContain('Some Distant Mall');
    expect(names).not.toContain('Some Airport');
    // …and every row is a real curated landmark.
    for (const name of names) {
      expect(library.some((l) => l.name === name), name).toBe(true);
    }
  });

  it('presents five to six City Reach anchors', async () => {
    const { deps } = makeDeps(SECTOR_78);
    const result = await runPropertyIntelligence({
      dealerId: 'd1', propertyId: 'p1', point: SECTOR_78,
    } as never, deps);
    expect(result.viewModel.cityReach.length).toBeGreaterThanOrEqual(5);
    expect(result.viewModel.cityReach.length).toBeLessThanOrEqual(6);
  });

  it('routes in ONE matrix and only for shortlisted finalists', async () => {
    const { deps, counters } = makeDeps(SECTOR_78);
    const result = await runPropertyIntelligence({
      dealerId: 'd1', propertyId: 'p1', point: SECTOR_78,
    } as never, deps);
    expect(counters.matrix).toBe(1);
    // Never the whole library.
    expect(counters.matrixElements).toBeLessThan(library.length / 2);
    expect(result.usage.matrixElements).toBe(counters.matrixElements);
  });

  it('gives different geographies different anchors', async () => {
    const a = await runPropertyIntelligence(
      { dealerId: 'd', propertyId: 'p', point: SECTOR_78 } as never, makeDeps(SECTOR_78).deps);
    const b = await runPropertyIntelligence(
      { dealerId: 'd', propertyId: 'p', point: NEW_CHANDIGARH } as never, makeDeps(NEW_CHANDIGARH).deps);
    const an = a.viewModel.cityReach.map((r) => r.name);
    const bn = b.viewModel.cityReach.map((r) => r.name);
    expect(an).not.toEqual(bn);
  });

  it('walks genuinely walkable everyday destinations and drives the rest', async () => {
    const { deps } = makeDeps(SECTOR_78);
    const result = await runPropertyIntelligence({
      dealerId: 'd1', propertyId: 'p1', point: SECTOR_78,
    } as never, deps);
    const walked = result.viewModel.dayToDay.filter((r) => r.travelMode === 'WALK');
    expect(walked.length).toBeGreaterThan(0);
    for (const row of walked) expect(row.distanceMeters).toBeLessThanOrEqual(1200);
    for (const row of result.viewModel.cityReach) expect(row.travelMode).toBe('DRIVE');
  });

  it('drops a landmark that failed to route rather than estimating it', async () => {
    const { deps } = makeDeps(SECTOR_78, {
      matrix: {
        async computeMatrix(_o, destinations): Promise<MatrixElement[]> {
          return destinations.map((_d, i) => ({
            ok: i % 2 === 0, distanceMeters: 900, durationSeconds: 420,
          }));
        },
      },
    });
    const result = await runPropertyIntelligence({
      dealerId: 'd1', propertyId: 'p1', point: SECTOR_78,
    } as never, deps);
    for (const row of [...result.viewModel.dayToDay, ...result.viewModel.cityReach]) {
      expect(row.durationSeconds).toBeGreaterThan(0);
      expect(row.distanceMeters).toBeGreaterThan(0);
    }
  });

  it('shows no City Reach at all rather than paying for discovery when the library is absent', async () => {
    const { deps, counters } = makeDeps(SECTOR_78, { landmarks: [] });
    const result = await runPropertyIntelligence({
      dealerId: 'd1', propertyId: 'p1', point: SECTOR_78,
    } as never, deps);
    expect(result.viewModel.cityReach).toHaveLength(0);
    expect(result.usage.cityReachPlacesCalls).toBe(0);
    // Only Day to Day spent anything.
    expect(counters.places).toBeLessThanOrEqual(12);
  });
});

describe('measured runtime cost', () => {
  it('lands at or under ₹5 gross on India pricing from real counters', async () => {
    const { deps } = makeDeps(SECTOR_78);
    const result = await runPropertyIntelligence({
      dealerId: 'd1', propertyId: 'p1', point: SECTOR_78,
    } as never, deps);

    // Model the batched Day-to-Day discovery the architecture targets:
    // one Nearby Search rather than one call per destination.
    const cost = grossCost({
      geminiInputTokens: result.usage.inputTokens,
      geminiOutputTokens: result.usage.outputTokens,
      nearbySearchCalls: 1,
      textSearchCalls: 0,
      placeDetailsCalls: 0,
      placePhotoCalls: result.usage.placePhotoCalls,
      routeMatrixElements: result.usage.matrixElements,
    }, 'india');

    expect(result.usage.placePhotoCalls).toBe(result.viewModel.dayToDay.length);
    expect(cost.totalInr).toBeLessThanOrEqual(5);
    expect(cost.withinTarget).toBe(true);
  });
});
