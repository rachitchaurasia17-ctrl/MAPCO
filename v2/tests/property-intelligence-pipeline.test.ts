import { describe, expect, it } from 'vitest';
import {
  runPropertyIntelligence, computeInputDigest, cacheKeyString,
  routeOriginKey, routeDestinationKey, toBuyerSafeIntelligence,
  CostLedger, DEFAULT_PRICING, INDIA_PRICING, GLOBAL_PRICING,
  microUsdFor, parsePricingOverride,
  PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
  type PipelineDeps, type PipelineInput, type PlaceMedia,
} from '../src/packages/property-intelligence';
import {
  FakeModel, FakePlaces, FakeRoutes, FakeStore, phase1Text, phase2Json,
} from './helpers/pi-fakes';

const POINT = { latitude: 30.681991, longitude: 76.702441 };

const INPUT: PipelineInput = {
  dealerId: 'dealer-1',
  propertyId: 'prop-1',
  point: POINT,
  locality: 'Sector 78',
  city: 'Mohali',
  propertySector: 'Sector 78',
};

/** Phase 2 selects 2 Local categories (2 places each) and 2 City places. */
const PHASE2 = phase2Json(
  [
    { category: 'Daily Needs & Groceries', ids: ['L001', 'L002'] },
    { category: 'Parks & Green Spaces', ids: ['L003'] },
  ],
  [
    { id: 'C001', category: 'Major Retail & Lifestyle' },
    { id: 'C002', category: 'Major Healthcare' },
  ],
);

function deps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    model: new FakeModel([phase1Text(), PHASE2]),
    places: new FakePlaces(),
    routes: new FakeRoutes(),
    store: new FakeStore(),
    now: () => '2026-08-31T00:00:00.000Z',
    ...overrides,
  } as PipelineDeps;
}

describe('Property Intelligence · pipeline (finalized architecture)', () => {
  it('runs exactly TWO AI phases, and only Phase 1 is grounded', async () => {
    const model = new FakeModel([phase1Text(), PHASE2]);
    await runPropertyIntelligence(INPUT, deps({ model }));
    expect(model.prompts).toHaveLength(2);
    expect(model.groundingUsed).toEqual([true, false]);
  });

  it('sends Phase 2 as a FRESH request carrying no Phase 1 conversation', async () => {
    const model = new FakeModel([phase1Text(), PHASE2]);
    await runPropertyIntelligence(INPUT, deps({ model }));
    const phase2Prompt = model.prompts[1]!;
    expect(phase2Prompt).toContain('FINAL AI JUDGE');
    expect(phase2Prompt).toContain('"schemaVersion":"mapco.phase2.input.v1"');
    // No trace of the Phase 1 instructions or its raw output.
    expect(phase2Prompt).not.toContain('HIGH-RECALL candidate universe');
    expect(phase2Prompt).not.toContain('LOCAL CANDIDATE UNIVERSE');
  });

  it('continues the same two-phase pipeline across bounded Edge checkpoints', async () => {
    const store = new FakeStore();
    const phase1 = new FakeModel([phase1Text()]);
    const discovered = await runPropertyIntelligence(
      INPUT, deps({ model: phase1, store }), { stopAfter: 'normalization' },
    );
    expect(discovered.viewModel.status).toBe('generating');
    expect(discovered.usage.stage).toBe('normalization');
    expect(phase1.groundingUsed).toEqual([true]);

    const phase2 = new FakeModel([PHASE2]);
    const judged = await runPropertyIntelligence(
      INPUT, deps({ model: phase2, store }), {
        stopAfter: 'phase2', resume: { candidateUniverse: discovered.candidateUniverse },
      },
    );
    expect(judged.viewModel.status).toBe('generating');
    expect(judged.usage.stage).toBe('phase2');
    expect(phase2.groundingUsed).toEqual([false]);
    expect(judged.phase2Output?.localCategories).toHaveLength(2);

    const noMoreAi = new FakeModel([]);
    const completed = await runPropertyIntelligence(
      INPUT, deps({ model: noMoreAi, store }), {
        resume: {
          candidateUniverse: judged.candidateUniverse,
          phase2Output: judged.phase2Output,
        },
      },
    );
    expect(completed.viewModel.status).toBe('ready');
    expect(noMoreAi.prompts).toHaveLength(0);
    expect(completed.viewModel.local).toHaveLength(2);
    expect(completed.viewModel.city).toHaveLength(2);
  });

  it('produces ranked Local categories and an UNRANKED City set', async () => {
    const { viewModel } = await runPropertyIntelligence(INPUT, deps());
    expect(viewModel.status).toBe('ready');
    expect(viewModel.local.map((c) => c.category))
      .toEqual(['Daily Needs & Groceries', 'Parks & Green Spaces']);
    expect(viewModel.local[0]!.places.map((p) => p.rank)).toEqual([1, 2]);
    expect(viewModel.city).toHaveLength(2);
    expect(viewModel.city.every((p) => p.rank === undefined)).toBe(true);
  });

  it('places the rank-1 candidate first — it is the default MAPCO shows', async () => {
    const { viewModel } = await runPropertyIntelligence(INPUT, deps());
    expect(viewModel.local[0]!.places[0]!.rank).toBe(1);
    expect(viewModel.local[0]!.places[0]!.candidateId).toBe('L001');
  });

  it('enriches ONLY the Phase 2 selections, never the whole universe', async () => {
    const places = new FakePlaces();
    // 8 local + 4 city discovered; only 5 selected.
    const result = await runPropertyIntelligence(INPUT, deps({ places }));
    expect(result.candidateUniverse.length).toBe(12);
    expect(places.detailCalls).toHaveLength(5);
    expect(result.usage.selectedCount).toBe(5);
  });

  it('shows only distances Google Routes actually returned', async () => {
    const { viewModel } = await runPropertyIntelligence(INPUT, deps());
    const card = viewModel.local[0]!.places[0]!;
    expect(card.routeStatus).toBe('ok');
    expect(card.distanceMeters).toBe(1500);
    expect(card.distanceLabel).toBeTruthy();
    expect(card.encodedPolyline).toBe('abc_polyline');
  });

  it('never substitutes the Phase 1 approximate distance when routing fails', async () => {
    const { viewModel } = await runPropertyIntelligence(
      INPUT, deps({ routes: new FakeRoutes(true) }),
    );
    const card = viewModel.local[0]!.places[0]!;
    expect(card.routeStatus).toBe('unavailable');
    expect(card.distanceMeters).toBeNull();
    expect(card.distanceLabel).toBeNull();
    expect(card.durationLabel).toBeNull();
  });

  it('does not force a route onto a GEOGRAPHIC_ENTITY', async () => {
    const geoPhase1 = [
      'LOCAL CANDIDATE UNIVERSE',
      ...Array.from({ length: 6 }, (_, i) =>
        `Shop ${i} | PLACE_ENTITY | Grocery | Sector 78, Mohali | 4.1 | 20 | 0.5 km`),
      'CITY CANDIDATE UNIVERSE',
      'Airport Road | GEOGRAPHIC_ENTITY | Major Roads & Corridors | Mohali | UNKNOWN | UNKNOWN | 3 km',
    ].join('\n');
    const routes = new FakeRoutes();
    const model = new FakeModel([
      geoPhase1,
      phase2Json([{ category: 'Daily Needs', ids: ['L001'] }], [{ id: 'C001', category: 'Major Roads & Corridors' }]),
    ]);
    const { viewModel } = await runPropertyIntelligence(INPUT, deps({ model, routes }));
    const road = viewModel.city[0]!;
    expect(road.entityKind).toBe('GEOGRAPHIC_ENTITY');
    expect(road.routeStatus).toBe('not_applicable');
    // Only the one PLACE_ENTITY was routed.
    expect(routes.calls).toHaveLength(1);
  });

  it('shows an honest empty photo rather than another place picture', async () => {
    const places = new FakePlaces({ photos: {} }); // Google returns nothing
    const { viewModel } = await runPropertyIntelligence(INPUT, deps({ places }));
    const card = viewModel.local[0]!.places[0]!;
    expect(card.image).toBeNull();
    expect(card.imageSource).toBe('none');
  });

  it('carries Google photo attribution through to the card', async () => {
    const { viewModel } = await runPropertyIntelligence(INPUT, deps());
    expect(viewModel.local[0]!.places[0]!.imageAttributions).toContain('A Photographer');
  });

  /* ── repair ─────────────────────────────────────────────────── */

  it('makes ONE controlled repair attempt with schema feedback, then succeeds', async () => {
    const model = new FakeModel([phase1Text(), '{"localCategories":[],"cityPlaces":[]}', PHASE2]);
    const result = await runPropertyIntelligence(INPUT, deps({ model }));
    expect(result.usage.repairAttempts).toBe(1);
    expect(result.viewModel.status).toBe('ready');
    expect(model.prompts[2]).toContain('rejected by MAPCO schema validation');
  });

  it('fails truthfully rather than inventing intelligence when repair also fails', async () => {
    const model = new FakeModel([phase1Text(), 'not json', 'still not json']);
    const result = await runPropertyIntelligence(INPUT, deps({ model }));
    expect(result.viewModel.status).toBe('unavailable');
    expect(result.viewModel.reason).toBe('phase2_invalid');
    expect(result.viewModel.local).toEqual([]);
    expect(result.viewModel.city).toEqual([]);
    expect(result.usage.repairAttempts).toBe(1);
  });

  it('reports a truthful state when Phase 1 returns nothing parseable', async () => {
    const model = new FakeModel(['I was unable to find anything.']);
    const result = await runPropertyIntelligence(INPUT, deps({ model }));
    expect(result.viewModel.reason).toBe('phase1_unparseable');
    expect(result.usage.stage).toBe('failed');
  });

  it('maps a provider quota error to a truthful reason', async () => {
    const model = new FakeModel([new Error('vertex_http_429: RESOURCE_EXHAUSTED')]);
    const result = await runPropertyIntelligence(INPUT, deps({ model }));
    expect(result.viewModel.reason).toBe('provider_quota');
  });

  it('reports insufficient_candidates for a genuinely sparse area', async () => {
    const model = new FakeModel([phase1Text(2, 1)]);
    const result = await runPropertyIntelligence(INPUT, deps({ model }));
    expect(result.viewModel.reason).toBe('insufficient_candidates');
  });

  /* ── caching / idempotency ──────────────────────────────────── */

  it('binds the cache digest to coordinate, prompts and pipeline version', async () => {
    const base = {
      dealerId: 'd', propertyId: 'p', point: POINT,
      provider: 'vertex-gemini', model: 'gemini-3.6-flash',
    };
    const a = await computeInputDigest(base);
    const moved = await computeInputDigest({
      ...base, point: { latitude: 30.7, longitude: 76.71 },
    });
    const otherPrompt = await computeInputDigest({ ...base, phase1PromptVersion: 'p1-different' });
    const otherPipeline = await computeInputDigest({ ...base, pipelineVersion: 'pi-9.9.9' });
    expect(a).not.toBe(moved);
    expect(a).not.toBe(otherPrompt);
    expect(a).not.toBe(otherPipeline);
    expect(await computeInputDigest(base)).toBe(a); // deterministic
    expect(cacheKeyString(base)).toContain(PROPERTY_INTELLIGENCE_PIPELINE_VERSION);
  });

  it('gives a moved property a NEW route-cache origin, invalidating its routes', () => {
    const before = routeOriginKey(POINT);
    const after = routeOriginKey({ latitude: 30.6825, longitude: 76.7031 });
    expect(before).not.toBe(after);
    // A sub-metre jitter must NOT invalidate.
    expect(routeOriginKey({ latitude: 30.6819914, longitude: 76.7024409 })).toBe(before);
    expect(routeDestinationKey({ placeId: 'abc' })).toBe('place:abc');
  });

  it('reuses a stored Place Photo globally instead of re-downloading it', async () => {
    const store = new FakeStore();
    const first = new FakePlaces();
    await runPropertyIntelligence(INPUT, deps({ store, places: first }));
    expect(first.photoCalls.length).toBeGreaterThan(0);
    const storedIds = [...store.media.keys()];
    expect(storedIds.length).toBeGreaterThan(0);

    // A DIFFERENT property near the same places reuses every stored photo.
    const second = new FakePlaces();
    const result = await runPropertyIntelligence(
      { ...INPUT, propertyId: 'prop-2' }, deps({ store, places: second }),
    );
    expect(second.photoCalls).toHaveLength(0);
    expect(second.detailCalls).toHaveLength(0);
    expect(result.usage.photosReused).toBe(5);
    expect(result.usage.photosFetched).toBe(0);
  });

  it('reuses a cached route instead of paying Google Routes again', async () => {
    const store = new FakeStore();
    await runPropertyIntelligence(INPUT, deps({ store }));
    const routes = new FakeRoutes();
    const result = await runPropertyIntelligence(
      { ...INPUT, propertyId: 'prop-2' }, deps({ store, routes }),
    );
    expect(routes.calls).toHaveLength(0);
    expect(result.usage.routesReused).toBe(5);
    expect(result.usage.routesComputed).toBe(0);
  });

  it('recomputes routes once the property coordinate changes', async () => {
    const store = new FakeStore();
    await runPropertyIntelligence(INPUT, deps({ store }));
    const routes = new FakeRoutes();
    const moved = { ...INPUT, point: { latitude: 30.71, longitude: 76.73 } };
    const result = await runPropertyIntelligence(moved, deps({ store, routes }));
    expect(routes.calls.length).toBeGreaterThan(0);
    expect(result.usage.routesReused).toBe(0);
  });

  /* ── cost ───────────────────────────────────────────────────── */

  it('records every variable-cost operation with an INR estimate', async () => {
    const result = await runPropertyIntelligence(INPUT, deps());
    const operations = new Set(result.usage.events.map((e) => e.operation));
    expect(operations).toContain('gemini_input_tokens');
    expect(operations).toContain('gemini_output_tokens');
    expect(operations).toContain('maps_grounding_query');
    expect(operations).toContain('places_identity');
    expect(operations).toContain('places_details');
    expect(operations).toContain('place_photo');
    expect(operations).toContain('routes_compute_route');
    expect(result.usage.totalInr).toBeGreaterThan(0);
    expect(result.usage.pricingVersion).toBe(DEFAULT_PRICING.version);
    expect(result.usage.inrPerUsd).toBe(DEFAULT_PRICING.inrPerUsd);
  });

  it('records grounding for Phase 1 only — Phase 2 is never grounded', async () => {
    const result = await runPropertyIntelligence(INPUT, deps());
    const grounding = result.usage.events.filter((e) => e.operation === 'maps_grounding_query');
    expect(grounding).toHaveLength(1);
    expect(grounding[0]!.detail).toBe('phase1');
  });

  it('makes cache savings visible as zero-cost recorded operations', async () => {
    const store = new FakeStore();
    await runPropertyIntelligence(INPUT, deps({ store }));
    const result = await runPropertyIntelligence(
      { ...INPUT, propertyId: 'prop-2' }, deps({ store }),
    );
    const hits = result.usage.events.filter((e) => e.cacheHit);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => e.estimatedMicroUsd === 0)).toBe(true);
  });

  it('stays under the configured per-generation INR ceiling', async () => {
    const result = await runPropertyIntelligence(INPUT, deps());
    expect(result.usage.totalInr).toBeLessThanOrEqual(40);
  });

  it('degrades honestly instead of spending past a tiny ceiling', async () => {
    const places = new FakePlaces();
    const result = await runPropertyIntelligence(INPUT, deps({
      places,
      limits: {
        maxIdentityResolutions: 140, maxEnrichedPlaces: 70,
        maxRouteCalls: 70, maxGenerationInr: 0.02,
      },
    }));
    // Phase 1 is already billed and cannot be refunded, but the run stops
    // before committing Phase 2 and buys no Places or Routes at all.
    expect(result.viewModel.reason).toBe('cost_cap_reached');
    expect(places.detailCalls).toHaveLength(0);
    expect(places.identityCalls).toHaveLength(0);
    const paid = result.usage.events.filter((e) => !e.cacheHit).map((e) => e.operation);
    expect(paid).not.toContain('places_details');
    expect(paid).not.toContain('place_photo');
    expect(paid).not.toContain('routes_compute_route');
  });

  it('bounds identity resolution to the configured maximum', async () => {
    const places = new FakePlaces();
    await runPropertyIntelligence(INPUT, deps({
      places,
      limits: {
        maxIdentityResolutions: 3, maxEnrichedPlaces: 70,
        maxRouteCalls: 70, maxGenerationInr: 40,
      },
    }));
    expect(places.identityCalls).toHaveLength(3);
  });

  it('exposes a traceable generation lifecycle', async () => {
    const ok = await runPropertyIntelligence(INPUT, deps());
    expect(ok.usage.stage).toBe('complete');
    expect(ok.usage.runId).toMatch(/^pir_/);
    expect(ok.usage.phase1PromptVersion).toMatch(/^p1-/);
    expect(ok.usage.phase2PromptVersion).toMatch(/^p2-/);
  });
});

describe('Property Intelligence · pricing configuration', () => {
  it('keeps every rate in ONE versioned place', () => {
    expect(INDIA_PRICING.version).not.toBe(GLOBAL_PRICING.version);
    for (const config of [INDIA_PRICING, GLOBAL_PRICING]) {
      for (const rate of Object.values(config.rates)) {
        expect(rate.usdPer).toBeGreaterThan(0); // nothing is silently free
      }
    }
  });

  it('computes micro-USD from recorded units', () => {
    // 1,000 photo fetches at the India rate of $2.10 per 1,000.
    expect(microUsdFor(INDIA_PRICING, 'place_photo', 1000)).toBe(2_100_000);
  });

  it('accepts a versioned environment override', () => {
    const config = parsePricingOverride('{"inrPerUsd":90,"rates":{"place_photo":{"usdPer":3}}}');
    expect(config.inrPerUsd).toBe(90);
    expect(config.rates.place_photo.usdPer).toBe(3);
    expect(config.version).toContain('override');
  });

  it('falls back to the safe default on a malformed override', () => {
    expect(parsePricingOverride('{not json').version).toBe(DEFAULT_PRICING.version);
  });

  it('reports what caching saved', () => {
    const ledger = new CostLedger(INDIA_PRICING);
    ledger.record('place_photo', 1, { cacheHit: true });
    ledger.record('place_photo', 1);
    expect(ledger.totalMicroUsd()).toBe(microUsdFor(INDIA_PRICING, 'place_photo', 1));
    expect(ledger.savedInr()).toBeGreaterThan(0);
  });
});

describe('Property Intelligence · buyer-safe projection', () => {
  const dealerVm = {
    status: 'ready' as const,
    generatedAt: '2026-08-31T00:00:00.000Z',
    schemaVersion: 3,
    pipelineVersion: 'pi-3.0.0',
    provider: 'vertex-gemini',
    model: 'gemini-3.6-flash',
    origin: POINT,
    local: [{
      category: 'Daily Needs',
      icon: 'ph-fill ph-shopping-cart',
      places: [{
        id: 'local:L001', candidateId: 'L001', group: 'local' as const,
        entityKind: 'PLACE_ENTITY' as const, category: 'Daily Needs', rank: 1,
        name: 'Fresh Mart', icon: 'i', distanceMeters: 1500, distanceLabel: '1.5 km',
        durationSeconds: 300, durationLabel: '5 min', travelMode: 'DRIVE' as const,
        encodedPolyline: 'abc', routeTarget: { kind: 'place' as const, placeId: 'p1', latitude: 1, longitude: 2 },
        routeStatus: 'ok' as const, placeId: 'p1', latitude: 30.7, longitude: 76.7,
        image: 'https://cdn/x.jpg', imageSource: 'google-place-photo' as const,
        imageAttributions: ['A'], address: 'Somewhere',
      }],
    }],
    city: [],
  };

  it('withholds the origin, polyline and distances when location is hidden', () => {
    for (const visibility of ['hidden', 'area', 'approx'] as const) {
      const safe = toBuyerSafeIntelligence(dealerVm, visibility);
      const card = safe.local[0]!.places[0]!;
      expect(safe.origin).toBeNull();
      expect(card.encodedPolyline).toBeNull();
      expect(card.routeTarget).toBeNull();
      expect(card.latitude).toBeNull();
      expect(card.longitude).toBeNull();
      // Exact distances to several known places trilaterate the property,
      // so they are withheld too — not merely rounded.
      expect(card.distanceMeters).toBeNull();
      expect(card.distanceLabel).toBeNull();
      expect(card.routeStatus).toBe('withheld');
      expect(safe.buyerSafe).toBe(true);
    }
  });

  it('keeps the place, its category and its photo — that IS the value', () => {
    const safe = toBuyerSafeIntelligence(dealerVm, 'hidden');
    const card = safe.local[0]!.places[0]!;
    expect(card.name).toBe('Fresh Mart');
    expect(card.category).toBe('Daily Needs');
    expect(card.image).toBe('https://cdn/x.jpg');
  });

  it('reveals full geometry only when the dealer chose exact location', () => {
    const safe = toBuyerSafeIntelligence(dealerVm, 'exact');
    expect(safe.origin).toEqual(POINT);
    expect(safe.local[0]!.places[0]!.encodedPolyline).toBe('abc');
    expect(safe.local[0]!.places[0]!.distanceLabel).toBe('1.5 km');
  });

  it('does not mutate the dealer payload', () => {
    toBuyerSafeIntelligence(dealerVm, 'hidden');
    expect(dealerVm.origin).toEqual(POINT);
    expect(dealerVm.local[0]!.places[0]!.encodedPolyline).toBe('abc');
  });
});

describe('Property Intelligence · place media registry', () => {
  it('never downgrades a stored photo to unavailable on a later failure', async () => {
    const store = new FakeStore();
    const stored: PlaceMedia = {
      placeId: 'p1', googlePhotoName: 'n', source: 'GOOGLE_PLACE_PHOTO',
      storagePath: 'places/p1.jpg', publicUrl: 'https://cdn/p1.jpg',
      mimeType: 'image/jpeg', widthPx: 800, heightPx: 600, attributions: [],
      retrievedAt: '2026-08-01T00:00:00.000Z', status: 'stored',
    };
    await store.putPlaceMedia(stored);
    await store.putPlaceMedia({ ...stored, status: 'unavailable', publicUrl: null });
    expect(store.media.get('p1')!.status).toBe('stored');
    expect(store.media.get('p1')!.publicUrl).toBe('https://cdn/p1.jpg');
  });
});
