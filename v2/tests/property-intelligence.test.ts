import { describe, it, expect } from 'vitest';
import {
  runPropertyIntelligence,
  GeminiMapsDiscoveryProvider,
  computeInputDigest,
  cacheKeyString,
  costMicroUsd,
  DEFAULT_RATES,
  decodePolyline,
  formatDistance,
  formatDuration,
  resolveRoad,
  matchRoad,
  PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
  type PropertyIntelligenceDiscoveryProvider,
  type GeoResolver,
  type RouteMatrixClient,
  type DiscoveryResult,
  type ResolvedDestination,
  type MatrixElement,
  type RoadGeometry,
  type GeoPoint,
  type PipelineDeps,
} from '../src/packages/property-intelligence';

const POINT: GeoPoint = { latitude: 30.6725, longitude: 76.752 };

/* ── Test doubles ──────────────────────────────────────────────── */

function fullCandidates() {
  return {
    candidates: [
      { group: 'dayToDay' as const, category: 'park' as const, name: 'Central Park' },
      { group: 'dayToDay' as const, category: 'grocery' as const, name: 'Reliance SMART' },
      { group: 'dayToDay' as const, category: 'gym' as const, name: 'Pro Ultimate Gym' },
      { group: 'dayToDay' as const, category: 'school' as const, name: 'Yadavindra School' },
      { group: 'dayToDay' as const, category: 'healthcare' as const, name: 'Fortis Hospital' },
      { group: 'dayToDay' as const, category: 'daily_market' as const, name: 'Phase 11 Market' },
      { group: 'cityReach' as const, destinationType: 'mall' as const, name: 'CP67' },
      { group: 'cityReach' as const, destinationType: 'airport' as const, name: 'Chandigarh Airport' },
      { group: 'cityReach' as const, destinationType: 'stadium' as const, name: 'PCA Stadium' },
      { group: 'cityReach' as const, destinationType: 'road' as const, name: 'Airport Road' },
      { group: 'cityReach' as const, destinationType: 'business_district' as const, name: 'IT City' },
      { group: 'cityReach' as const, destinationType: 'hospital' as const, name: 'Max Hospital' },
    ],
    usage: { inputTokens: 300, outputTokens: 400, groundingQueries: 1 },
  } satisfies DiscoveryResult;
}

class MockDiscovery implements PropertyIntelligenceDiscoveryProvider {
  readonly name = 'mock';
  readonly model = 'mock-model';
  constructor(private readonly result: DiscoveryResult) {}
  async discover(): Promise<DiscoveryResult> { return this.result; }
}

/** Resolves by name; a small counter fabricates distinct coordinates. Names in
 *  `nulls` resolve to null (unresolved); names in `alias` collapse to one id. */
class MockResolver implements GeoResolver {
  calls = 0;
  private readonly idIndex = new Map<string, number>();
  constructor(
    private readonly nulls: Set<string> = new Set(),
    private readonly alias: Record<string, string> = {},
  ) {}
  async resolvePlace(name: string, near: GeoPoint): Promise<ResolvedDestination | null> {
    this.calls++;
    if (this.nulls.has(name)) return null;
    const id = this.alias[name] ?? `pid:${name}`;
    // Each DISTINCT id gets a distinct coordinate (aliased ids share one, so
    // they correctly collapse in dedupe); spacing > the 4-decimal dedupe grid.
    if (!this.idIndex.has(id)) this.idIndex.set(id, this.idIndex.size + 1);
    const k = this.idIndex.get(id)!;
    return {
      kind: 'place', placeId: id, name,
      latitude: near.latitude + k * 0.002,
      longitude: near.longitude + k * 0.002,
    };
  }
}

const alwaysNullResolver: GeoResolver = { resolvePlace: async () => null };

class MockMatrix implements RouteMatrixClient {
  constructor(private readonly failIndices: Set<number> = new Set()) {}
  async computeMatrix(_o: unknown, destinations: unknown[]): Promise<MatrixElement[]> {
    return destinations.map((_d, i) =>
      this.failIndices.has(i)
        ? { ok: false, distanceMeters: 0, durationSeconds: 0 }
        : { ok: true, distanceMeters: 1000 + i * 500, durationSeconds: 300 + i * 60 });
  }
}

function baseDeps(over: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    discovery: new MockDiscovery(fullCandidates()),
    resolver: new MockResolver(),
    matrix: new MockMatrix(),
    roads: [],
    now: () => '2026-08-18T00:00:00.000Z',
    ...over,
  };
}

/* ── Structured Gemini parse (Vertex contract) ─────────────────── */

function fakeResponse(bodyObj: unknown, status = 200) {
  const text = JSON.stringify(bodyObj);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => bodyObj,
    text: async () => text,
  } as unknown as Response;
}

describe('GeminiMapsDiscoveryProvider — structured parse', () => {
  const vertexBody = (jsonText: string, chunks: unknown[] = []) => ({
    candidates: [{
      finishReason: 'STOP',
      content: { parts: [{ text: jsonText }] },
      groundingMetadata: { groundingChunks: chunks },
    }],
    usageMetadata: { promptTokenCount: 320, candidatesTokenCount: 400, thoughtsTokenCount: 1000 },
  });

  it('parses 6 Day-to-Day + 6 City Reach and normalizes categories/types', async () => {
    const jsonText = JSON.stringify({
      dayToDay: [
        { category: 'Park', name: 'A' }, { category: 'Grocery', name: 'B' },
        { category: 'Gym', name: 'C' }, { category: 'School', name: 'D' },
        { category: 'Healthcare', name: 'E' }, { category: 'DailyMarket', name: 'F' },
      ],
      cityReach: [
        { name: 'CP67', destinationType: 'mall' }, { name: 'Airport', destinationType: 'airport' },
        { name: 'Road X', destinationType: 'road' }, { name: 'PCA', destinationType: 'stadium' },
        { name: 'IT', destinationType: 'business_district' }, { name: 'Hosp', destinationType: 'hospital' },
      ],
    });
    const provider = new GeminiMapsDiscoveryProvider({
      project: 'p', location: 'global', model: 'gemini-3.6-flash',
      getAccessToken: async () => 'tok',
      fetchImpl: (async () => fakeResponse(vertexBody(jsonText, [
        { maps: { title: 'CP67 - Google Maps', placeId: 'PID_CP67' } },
      ]))) as unknown as typeof fetch,
    });
    const out = await provider.discover(POINT);
    const day = out.candidates.filter((c) => c.group === 'dayToDay');
    const city = out.candidates.filter((c) => c.group === 'cityReach');
    expect(day.map((d) => d.category)).toEqual(['park', 'grocery', 'gym', 'school', 'healthcare', 'daily_market']);
    expect(city).toHaveLength(6);
    // thinking tokens are billed as output
    expect(out.usage.outputTokens).toBe(1400);
    // grounding placeId recovered by title match
    expect(out.candidates.find((c) => c.name === 'CP67')?.groundedPlaceId).toBe('PID_CP67');
  });

  it('strips ```json fences before parsing', async () => {
    const fenced = '```json\n' + JSON.stringify({ dayToDay: [{ category: 'Park', name: 'A' }], cityReach: [] }) + '\n```';
    const provider = new GeminiMapsDiscoveryProvider({
      project: 'p', location: 'global', model: 'm', getAccessToken: async () => 'tok',
      fetchImpl: (async () => fakeResponse(vertexBody(fenced))) as unknown as typeof fetch,
    });
    const out = await provider.discover(POINT);
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0]!.name).toBe('A');
  });

  it('throws a typed error on provider HTTP failure', async () => {
    const provider = new GeminiMapsDiscoveryProvider({
      project: 'p', location: 'global', model: 'm', getAccessToken: async () => 'tok', maxRetries: 0,
      fetchImpl: (async () => fakeResponse({ error: 'boom' }, 500)) as unknown as typeof fetch,
    });
    await expect(provider.discover(POINT)).rejects.toMatchObject({ code: 'vertex_http_500' });
  });

  it('retries a 429 then succeeds (bounded)', async () => {
    let n = 0;
    const provider = new GeminiMapsDiscoveryProvider({
      project: 'p', location: 'global', model: 'm', getAccessToken: async () => 'tok', maxRetries: 2,
      fetchImpl: (async () => {
        n++;
        if (n === 1) return fakeResponse({ error: 'rate' }, 429);
        return fakeResponse(vertexBody(JSON.stringify({ dayToDay: [{ category: 'Park', name: 'A' }], cityReach: [] })));
      }) as unknown as typeof fetch,
    });
    const out = await provider.discover(POINT);
    expect(n).toBe(2);
    expect(out.candidates).toHaveLength(1);
  });
});

/* ── Pipeline assembly ─────────────────────────────────────────── */

describe('runPropertyIntelligence — assembly', () => {
  it('produces 6 Day-to-Day and 6 City Reach with real road distances', async () => {
    const { viewModel, usage } = await runPropertyIntelligence(
      { dealerId: 'd1', propertyId: 'p1', point: POINT }, baseDeps(),
    );
    expect(viewModel.status).toBe('ready');
    expect(viewModel.dayToDay).toHaveLength(6);
    expect(viewModel.cityReach).toHaveLength(6);
    // Day-to-Day stays in the fixed category order.
    expect(viewModel.dayToDay.map((p) => p.destinationType))
      .toEqual(['park', 'grocery', 'gym', 'school', 'healthcare', 'daily_market']);
    // every row carries a real road distance + label + route target
    for (const row of [...viewModel.dayToDay, ...viewModel.cityReach]) {
      expect(row.distanceMeters).toBeGreaterThan(0);
      expect(row.distanceLabel).toMatch(/km|m$/);
      expect(row.durationLabel).toMatch(/min|hr/);
      expect(row.routeTarget).toBeTruthy();
    }
    expect(usage.matrixElements).toBe(12);
    expect(usage.costMicroUsd).toBeGreaterThan(0);
  });

  it('maps Route Matrix distances onto the correct rows and formats them', async () => {
    const { viewModel } = await runPropertyIntelligence(
      { dealerId: 'd1', propertyId: 'p1', point: POINT }, baseDeps(),
    );
    // MockMatrix returns 1000 + i*500 metres; first row is 1000 m → "1.0 km".
    expect(viewModel.dayToDay[0]!.distanceMeters).toBe(1000);
    expect(viewModel.dayToDay[0]!.distanceLabel).toBe('1.0 km');
  });

  it('drops a destination that has no drivable route (never a fake distance)', async () => {
    const deps = baseDeps({ matrix: new MockMatrix(new Set([0])) }); // first slot has no route
    const { viewModel } = await runPropertyIntelligence(
      { dealerId: 'd1', propertyId: 'p1', point: POINT }, deps,
    );
    // The park (index 0) is dropped; only 5 Day-to-Day remain.
    expect(viewModel.dayToDay).toHaveLength(5);
    expect(viewModel.dayToDay.some((p) => p.destinationType === 'park')).toBe(false);
  });

  it('rejects duplicates that resolve to the same place', async () => {
    // Two City Reach names collapse to one place id.
    const resolver = new MockResolver(new Set(), { 'IT City': 'pid:CP67', CP67: 'pid:CP67' });
    const { viewModel } = await runPropertyIntelligence(
      { dealerId: 'd1', propertyId: 'p1', point: POINT }, baseDeps({ resolver }),
    );
    const ids = [...viewModel.dayToDay, ...viewModel.cityReach].map((p) => p.placeId);
    expect(new Set(ids).size).toBe(ids.length); // no duplicate place id survives
    expect(viewModel.cityReach.length).toBeLessThan(6);
  });

  it('runs bounded repair for a Day-to-Day category the model name fails to resolve', async () => {
    const resolver = new MockResolver(new Set(['Central Park'])); // first name unresolved → repair
    const { viewModel } = await runPropertyIntelligence(
      { dealerId: 'd1', propertyId: 'p1', point: POINT }, baseDeps({ resolver }),
    );
    // Repair search ("park") succeeds, so the park slot is still filled.
    expect(viewModel.dayToDay.some((p) => p.destinationType === 'park')).toBe(true);
  });

  it('resolves a City Reach road via MAPCO road geometry (nearest point)', async () => {
    const road: RoadGeometry = {
      id: 'airport-road', name: 'Airport Road', aliases: [],
      path: [
        { latitude: 30.6606, longitude: 76.7969 },
        { latitude: 30.6752, longitude: 76.7602 },
        { latitude: 30.6811, longitude: 76.7502 },
      ],
    };
    const { viewModel } = await runPropertyIntelligence(
      { dealerId: 'd1', propertyId: 'p1', point: POINT }, baseDeps({ roads: [road] }),
    );
    const roadRow = viewModel.cityReach.find((p) => p.destinationType === 'road');
    expect(roadRow?.name).toBe('Airport Road');
    expect(roadRow?.routeTarget.kind).toBe('road');
    expect(roadRow?.routeTarget.placeId).toBeUndefined();
  });

  it('reports a truthful unavailable state instead of faking rows', async () => {
    // Nothing resolves to a genuine, routable place (sparse area).
    const thin = new MockDiscovery({
      candidates: [{ group: 'cityReach', destinationType: 'mall', name: 'One' }],
      usage: { inputTokens: 10, outputTokens: 10, groundingQueries: 1 },
    });
    const { viewModel } = await runPropertyIntelligence(
      { dealerId: 'd1', propertyId: 'p1', point: POINT },
      baseDeps({ discovery: thin, resolver: alwaysNullResolver }),
    );
    expect(viewModel.status).toBe('unavailable');
    expect(viewModel.reason).toBe('insufficient_results');
  });

  it('propagates a provider failure to the caller (no mock fallback)', async () => {
    const failing: PropertyIntelligenceDiscoveryProvider = {
      name: 'mock', model: 'm',
      discover: async () => { throw new Error('vertex_http_429'); },
    };
    await expect(runPropertyIntelligence(
      { dealerId: 'd1', propertyId: 'p1', point: POINT }, baseDeps({ discovery: failing }),
    )).rejects.toThrow('429');
  });
});

/* ── Cache identity / invalidation / cross-dealer isolation ────── */

describe('cache identity', () => {
  const base = { dealerId: 'd1', propertyId: 'p1', point: POINT, provider: 'vertex-gemini', model: 'gemini-3.6-flash' };

  it('is stable for identical inputs', async () => {
    expect(await computeInputDigest(base)).toBe(await computeInputDigest({ ...base }));
  });

  it('changes when the canonical location changes', async () => {
    const a = await computeInputDigest(base);
    const b = await computeInputDigest({ ...base, point: { latitude: 30.80, longitude: 76.68 } });
    expect(a).not.toBe(b);
  });

  it('changes when locationUpdatedAt changes (explicit invalidation)', async () => {
    const a = await computeInputDigest({ ...base, locationUpdatedAt: '2026-01-01T00:00:00Z' });
    const b = await computeInputDigest({ ...base, locationUpdatedAt: '2026-02-01T00:00:00Z' });
    expect(a).not.toBe(b);
  });

  it('changes when the schema version or model changes', async () => {
    const a = await computeInputDigest(base);
    expect(a).not.toBe(await computeInputDigest({ ...base, schemaVersion: PROPERTY_INTELLIGENCE_SCHEMA_VERSION + 1 }));
    expect(a).not.toBe(await computeInputDigest({ ...base, model: 'other' }));
  });

  it('isolates dealers — a different dealer yields a different key and digest', async () => {
    const keyA = cacheKeyString(base);
    const keyB = cacheKeyString({ ...base, dealerId: 'd2' });
    expect(keyA).not.toBe(keyB);
    expect(await computeInputDigest(base)).not.toBe(await computeInputDigest({ ...base, dealerId: 'd2' }));
  });
});

/* ── Cost tracking ─────────────────────────────────────────────── */

describe('cost model', () => {
  it('computes integer micro-USD from a usage tally', () => {
    const cost = costMicroUsd({
      inputTokens: 300, outputTokens: 1400, groundingQueries: 1,
      placesCalls: 12, matrixElements: 12, routeCalls: 0,
    }, DEFAULT_RATES);
    // 300*0.30 + 1400*2.50 + 1*25000 + 12*32000 + 12*5000 = 90+3500+25000+384000+60000
    expect(cost).toBe(472590);
    expect(Number.isInteger(cost)).toBe(true);
  });
});

/* ── Geometry / roads / polyline helpers ───────────────────────── */

describe('helpers', () => {
  it('matches a MAPCO road by name/alias with a meaningful overlap', () => {
    const roads: RoadGeometry[] = [
      { id: 'airport-road', name: 'Airport Road', aliases: ['PR-7'], path: [POINT, POINT] },
      { id: 'kharar-landran', name: 'Kharar Landran Road', aliases: [], path: [POINT, POINT] },
    ];
    expect(matchRoad('Airport Road', roads)?.id).toBe('airport-road');
    expect(matchRoad('PR-7', roads)?.id).toBe('airport-road');
    expect(matchRoad('Some Random Shop', roads)).toBeNull();
  });

  it('resolves a road to a nearest access point on the geometry', () => {
    const road: RoadGeometry = {
      id: 'r', name: 'Test Road', aliases: [],
      path: [{ latitude: 30.67, longitude: 76.75 }, { latitude: 30.68, longitude: 76.76 }],
    };
    const r = resolveRoad('Test Road', POINT, [road]);
    expect(r?.kind).toBe('road');
    expect(r?.latitude).toBeGreaterThan(30.66);
  });

  it('formats distance and duration for the UI', () => {
    expect(formatDistance(420)).toBe('420 m');
    expect(formatDistance(2100)).toBe('2.1 km');
    expect(formatDuration(360)).toBe('6 min');
    expect(formatDuration(3900)).toBe('1 hr 5 min');
  });

  it('decodes a Google encoded polyline (precision 5)', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toHaveLength(3);
    expect(pts[0]!.latitude).toBeCloseTo(38.5, 4);
    expect(pts[0]!.longitude).toBeCloseTo(-120.2, 4);
    expect(pts[2]!.latitude).toBeCloseTo(43.252, 3);
  });
});
