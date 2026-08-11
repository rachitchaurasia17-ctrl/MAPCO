// @vitest-environment jsdom
/* MAPCO Earth — location-intelligence tests.
   These test PRINCIPLES (how selection behaves), never that a specific
   Mohali business must rank in a specific position. No Google calls. */
import { describe, it, expect } from 'vitest';
import { MAPCO_ANCHORS, metersBetween } from '../src/apps/earth/intel/geo-data';
import {
  matchAnchor, isSameEntity, dedupeEntities, coreName, canonicalIdFor,
} from '../src/apps/earth/intel/entities';
import {
  cellKey, cellNeighbourhood, writeCell, hasAnalysedCell, readNeighbourhood, clearIntel,
  markDiscoveryAttempt, inDiscoveryBackoff, INTEL_VERSION,
} from '../src/apps/earth/intel/store';
import {
  planSlots, assignSlots, significanceOf, eligible, scaleOf, NEARBY_ELIGIBLE,
  type SlotCandidate,
} from '../src/apps/earth/intel/slots';
import {
  nearestOnPath,
} from '../src/apps/earth/intel/road-network';
import { intentOf } from '../src/apps/earth/location-advantage';

const AIRPORT = { lat: 30.6735, lng: 76.7885 };
const PLOT = { lat: 30.6889, lng: 76.7361 };

/** Build a slot candidate the way the analyst does. */
function cand(o: Partial<SlotCandidate> & { category: string; distance: number; significance: number; id?: string }): SlotCandidate {
  return {
    canonicalId: o.id ?? `c-${o.category}-${o.distance}-${Math.round(o.significance * 100)}`,
    category: o.category,
    significance: o.significance,
    distance: o.distance,
    storyKey: o.storyKey ?? o.category,
  };
}

/* ════════════════ significance: what it IS, not who rated it ═════ */
describe('significance is MAPCO-defined, not review-defined', () => {
  it('values an unrated government park above a heavily-reviewed café', () => {
    const park = significanceOf({ category: 'park', types: ['park'], reviews: 0 });
    const cafe = significanceOf({ category: 'cafe', types: ['cafe'], rating: 4.8, reviews: 3000 });
    expect(park).toBeGreaterThan(cafe);
  });

  it('values a mall above a kirana/grocery store regardless of proximity', () => {
    const mall = significanceOf({ category: 'mall', types: ['shopping_mall'], rating: 4.3, reviews: 8000 });
    const kirana = significanceOf({ category: 'market', types: ['grocery_store'], rating: 4.9, reviews: 40 });
    expect(mall).toBeGreaterThan(kirana);
  });

  it('caps how far Google engagement alone can lift a small private place', () => {
    const small = significanceOf({ category: 'cafe', types: ['cafe'], rating: 5, reviews: 100000 });
    expect(small).toBeLessThan(0.62);   // below the Nearby bar, however popular
  });

  it('lets MAPCO canonical knowledge override everything', () => {
    expect(significanceOf({ category: 'mall', types: ['shopping_mall'], anchorImportance: 0.88, reviews: 0 })).toBe(0.88);
  });

  it('reads real-world scale from place types', () => {
    expect(scaleOf(['shopping_mall'])).toBe('large');
    expect(scaleOf(['grocery_store'])).toBe('small');
    expect(scaleOf(['international_airport'])).toBe('major');
  });
});

/* ════════════════ Nearby rejects ordinary local businesses ═══════ */
describe('Nearby only admits city-level destinations', () => {
  const slots = planSlots('residential', 'nearby');

  it('structurally excludes kirana / grocery / pharmacy / gym categories', () => {
    for (const c of ['market', 'pharmacy', 'cafe', 'park']) {
      expect(NEARBY_ELIGIBLE.has(c)).toBe(false);
    }
  });

  it('never selects a very close ordinary store', () => {
    const chosen = assignSlots(slots, [
      cand({ category: 'market', distance: 120, significance: 0.4, id: 'kirana' }),
      cand({ category: 'cafe', distance: 200, significance: 0.45, id: 'chaishop' }),
    ]);
    expect(chosen).toHaveLength(0);
  });

  it('prefers a recognised destination 3.5 km away over an ordinary shop 500 m away', () => {
    const chosen = assignSlots(slots, [
      cand({ category: 'market', distance: 500, significance: 0.42, id: 'shop' }),
      cand({ category: 'mall', distance: 3500, significance: 0.88, id: 'mall' }),
    ]);
    expect(chosen.map((c) => c.candidate.canonicalId)).toEqual(['mall']);
  });
});

/* ════════════════ Around Sector: distinct stories, 2 km cap ══════ */
describe('Around Sector answers distinct questions', () => {
  const slots = planSlots('residential', 'around');

  it('does not let four parks occupy four slots', () => {
    const parks = [0, 1, 2, 3].map((i) =>
      cand({ category: 'park', distance: 300 + i * 100, significance: 0.5, id: `park${i}` }));
    const chosen = assignSlots(slots, parks);
    expect(chosen).toHaveLength(1);
  });

  it('lets an exceptional second place of the same kind through an open slot', () => {
    const chosen = assignSlots(slots, [
      cand({ category: 'park', distance: 300, significance: 0.55, id: 'ordinary-park' }),
      cand({ category: 'park', distance: 500, significance: 0.86, id: 'landmark-park' }),
    ]);
    expect(chosen.length).toBeGreaterThanOrEqual(2);
  });

  it('produces a diverse set of stories from a mixed pool', () => {
    const pool = [
      cand({ category: 'park', distance: 400, significance: 0.55 }),
      cand({ category: 'sports', distance: 600, significance: 0.5 }),
      cand({ category: 'market', distance: 500, significance: 0.5 }),
      cand({ category: 'township', distance: 700, significance: 0.55 }),
      cand({ category: 'school', distance: 800, significance: 0.5 }),
      cand({ category: 'cafe', distance: 450, significance: 0.45 }),
      cand({ category: 'transit', distance: 350, significance: 0.5 }),
    ];
    const chosen = assignSlots(slots, pool);
    const stories = new Set(chosen.map((c) => c.candidate.storyKey));
    expect(chosen.length).toBeGreaterThanOrEqual(6);
    expect(stories.size).toBe(chosen.length);       // every result a different story
  });

  it('enforces the 2 km hyperlocal cap', () => {
    const far = cand({ category: 'park', distance: 2600, significance: 0.7 });
    expect(slots.some((s) => eligible(s, far))).toBe(false);
  });

  it('never assigns one candidate to two slots', () => {
    const chosen = assignSlots(slots, [cand({ category: 'sports', distance: 400, significance: 0.8, id: 'club' })]);
    expect(chosen).toHaveLength(1);
  });
});

/* ════════════════ layer ownership: Around vs Nearby ══════════════ */
describe('Around Sector and Nearby own different kinds of knowledge', () => {
  const NEARBY_OWNERSHIP = 0.62;
  /** Mirrors ownsNearbyLayer() in location-advantage.ts. */
  const ownsNearby = (c: SlotCandidate) =>
    NEARBY_ELIGIBLE.has(c.category) && c.significance >= NEARBY_OWNERSHIP;

  it('gives a city-scale anchor to Nearby even when it is close', () => {
    expect(ownsNearby(cand({ category: 'mall', distance: 1200, significance: 0.85 }))).toBe(true);
    expect(ownsNearby(cand({ category: 'hospital', distance: 1500, significance: 0.8 }))).toBe(true);
  });

  it('keeps everyday places in Around even when Nearby has empty slots', () => {
    expect(ownsNearby(cand({ category: 'market', distance: 700, significance: 0.9 }))).toBe(false);
    expect(ownsNearby(cand({ category: 'pharmacy', distance: 400, significance: 0.9 }))).toBe(false);
    expect(ownsNearby(cand({ category: 'park', distance: 300, significance: 0.9 }))).toBe(false);
  });

  it('keeps an ordinary member of an eligible category in Around', () => {
    // a small neighbourhood school is nearby-eligible by category but not a city anchor
    expect(ownsNearby(cand({ category: 'school', distance: 600, significance: 0.45 }))).toBe(false);
  });

  it('never lets one entity appear in both tabs', () => {
    const pool = [
      cand({ category: 'mall', distance: 1200, significance: 0.85, id: 'big-mall' }),
      cand({ category: 'park', distance: 400, significance: 0.55, id: 'park' }),
      cand({ category: 'market', distance: 600, significance: 0.5, id: 'store' }),
      cand({ category: 'sports', distance: 700, significance: 0.5, id: 'gym' }),
    ];
    const nearbyPool = pool.filter(ownsNearby);
    const nearby = assignSlots(planSlots('residential', 'nearby'), nearbyPool);
    const claimed = new Set(nearby.map((a) => a.candidate.canonicalId));
    const around = assignSlots(planSlots('residential', 'around'), pool.filter((c) => !claimed.has(c.canonicalId)));

    const aroundIds = around.map((a) => a.candidate.canonicalId);
    const nearbyIds = nearby.map((a) => a.candidate.canonicalId);
    expect(nearbyIds).toContain('big-mall');
    expect(aroundIds).not.toContain('big-mall');
    expect(aroundIds.filter((id) => nearbyIds.includes(id))).toHaveLength(0);
  });

  it('still fills Around after Nearby has claimed the strong entities', () => {
    const pool = [
      cand({ category: 'mall', distance: 1100, significance: 0.86, id: 'mall' }),
      cand({ category: 'hospital', distance: 1600, significance: 0.8, id: 'hosp' }),
      cand({ category: 'park', distance: 350, significance: 0.55, id: 'park' }),
      cand({ category: 'market', distance: 500, significance: 0.5, id: 'kirana' }),
      cand({ category: 'sports', distance: 650, significance: 0.5, id: 'gym' }),
      cand({ category: 'cafe', distance: 450, significance: 0.45, id: 'cafe' }),
    ];
    const nearby = assignSlots(planSlots('residential', 'nearby'), pool.filter(ownsNearby));
    const claimed = new Set(nearby.map((a) => a.candidate.canonicalId));
    const around = assignSlots(planSlots('residential', 'around'), pool.filter((c) => !claimed.has(c.canonicalId)));
    expect(around.length).toBeGreaterThanOrEqual(4);
    expect(nearby.length).toBeGreaterThanOrEqual(2);
  });
});

/* ════════════════ property type changes the questions ════════════ */
describe('property type changes what matters', () => {
  it('infers intent from the property type', () => {
    expect(intentOf({ type: 'Residential plot' })).toBe('residential');
    expect(intentOf({ type: 'SCO commercial booth' })).toBe('commercial');
    expect(intentOf({ type: 'Residential plot', intent: 'investment' })).toBe('investment');
  });

  it('ranks the same slots differently for a home vs a shop', () => {
    const home = planSlots('residential', 'around');
    const shop = planSlots('commercial', 'around');
    const greenHome = home.find((s) => s.id === 'green')!.priority;
    const greenShop = shop.find((s) => s.id === 'green')!.priority;
    expect(greenHome).toBeGreaterThan(greenShop);
  });

  it('can pick different winners at identical coordinates', () => {
    const pool = [
      cand({ category: 'park', distance: 400, significance: 0.6, id: 'park' }),
      cand({ category: 'transit', distance: 400, significance: 0.6, id: 'bus' }),
    ];
    const home = assignSlots(planSlots('residential', 'around'), pool);
    const shop = assignSlots(planSlots('commercial', 'around'), pool);
    const topHome = home[0].candidate.canonicalId;
    const topShop = shop[0].candidate.canonicalId;
    expect(topHome).not.toBe(topShop);
  });
});

/* ════════════════ semantic entity resolution ═════════════════════ */
describe('semantic entity resolution', () => {
  it('treats the airport and its official name as ONE entity', () => {
    const a = { name: 'Chandigarh International Airport', pos: AIRPORT, category: 'airport' };
    const b = { name: 'Shaheed Bhagat Singh International Airport', pos: { lat: 30.674, lng: 76.789 }, category: 'airport' };
    expect(matchAnchor(a)?.id).toBe('an-ixc');
    expect(matchAnchor(b)?.id).toBe('an-ixc');
    expect(dedupeEntities([{ ...a, anchorId: 'an-ixc' }, { ...b, anchorId: 'an-ixc' }], () => 1)).toHaveLength(1);
  });

  it('collapses a listing that differs only by its locality suffix', () => {
    const a = { name: 'IT Park', pos: { lat: 30.7128, lng: 76.6885 }, category: 'business' };
    const b = { name: 'IT Park, Mohali', pos: { lat: 30.7130, lng: 76.6888 }, category: 'business' };
    expect(coreName(a.name)).toBe(coreName(b.name));
    expect(isSameEntity(a, b)).toBe(true);
  });

  it('keeps genuinely different places apart', () => {
    const s1 = { name: 'Shivalik Public School', pos: PLOT, category: 'school' };
    const s2 = { name: 'Saint Xavier Senior Secondary School', pos: { lat: 30.6905, lng: 76.7402 }, category: 'school' };
    expect(isSameEntity(s1, s2)).toBe(false);
  });

  it('never merges across unrelated families', () => {
    expect(isSameEntity(
      { name: 'Civil Hospital', pos: { lat: 30.70, lng: 76.72 }, category: 'hospital' },
      { name: 'Civil Mall', pos: { lat: 30.70, lng: 76.7201 }, category: 'mall' },
    )).toBe(false);
  });

  it('does not claim an anchor for a far-away same-name place', () => {
    expect(matchAnchor({ name: 'CP67 Mall', pos: { lat: 28.6, lng: 77.2 }, category: 'mall' })).toBeNull();
  });

  it('gives an anchor-backed entity a stable canonical id', () => {
    const e = { name: 'CP67', pos: { lat: 30.7058, lng: 76.7388 }, category: 'mall' };
    expect(canonicalIdFor(e, matchAnchor(e))).toBe('an-cp67');
  });
});

/* ════════════════ roads: local geographic calculation ════════════ */
describe('road proximity', () => {
  it('measures perpendicular access distance to a corridor', () => {
    const near = nearestOnPath({ lat: 30.71, lng: 76.75 }, [{ lat: 30.70, lng: 76.70 }, { lat: 30.70, lng: 76.80 }]);
    expect(near.meters).toBeGreaterThan(900);
    expect(near.meters).toBeLessThan(1300);
  });
});

/* ════════════════ sectors are gone ═══════════════════════════════ */
describe('sector feature', () => {
  it('ships no sector geometry (Google exposes no sector boundaries)', async () => {
    const geo = await import('../src/apps/earth/intel/geo-data');
    expect((geo as Record<string, unknown>).MAPCO_SECTORS).toBeUndefined();
    expect((geo as Record<string, unknown>).sectorRing).toBeUndefined();
    expect((geo as Record<string, unknown>).sectorAt).toBeUndefined();
  });
});

/* ════════════════ cost architecture (must stay intact) ═══════════ */
describe('paid discovery is never repeated (cost gate)', () => {
  it('bumped the intelligence version for the new engine', () => {
    expect(INTEL_VERSION).toBeGreaterThanOrEqual(4);
  });

  it('marks a cell analysed even when the area turns out to be quiet', async () => {
    await clearIntel();
    expect(await hasAnalysedCell(PLOT)).toBe(false);
    await writeCell(PLOT, [], true);
    expect(await hasAnalysedCell(PLOT)).toBe(true);
  });

  it('persists intelligence for reuse by a neighbouring plot', async () => {
    await clearIntel();
    await writeCell(PLOT, [{
      canonicalId: 'an-cp67', placeId: 'gp-1', anchorId: 'an-cp67',
      category: 'mall', importance: 0.88, publicInfra: false,
      name: 'CP67 Mall', pos: { lat: 30.7056, lng: 76.7385 }, contentAt: Date.now(),
    }], true);
    const reused = await readNeighbourhood({ lat: 30.6902, lng: 76.7368 });
    expect(reused.map((e) => e.canonicalId)).toContain('an-cp67');
  });

  it('does NOT mark a cell analysed when discovery failed outright', async () => {
    await clearIntel();
    await markDiscoveryAttempt(PLOT);
    await writeCell(PLOT, [], false);
    expect(await hasAnalysedCell(PLOT)).toBe(false);
  });

  it('cools down after a failed discovery instead of retrying on every open', async () => {
    await clearIntel();
    expect(await inDiscoveryBackoff(PLOT)).toBe(false);
    await markDiscoveryAttempt(PLOT);
    expect(await inDiscoveryBackoff(PLOT)).toBe(true);
  });

  it('keeps a successful analysis authoritative over a later attempt marker', async () => {
    await clearIntel();
    await writeCell(PLOT, [], true);
    await markDiscoveryAttempt(PLOT);
    expect(await hasAnalysedCell(PLOT)).toBe(true);
  });

  it('drops Google-derived content past the 30-day cache limit', async () => {
    await clearIntel();
    await writeCell(PLOT, [{
      canonicalId: 'ce-old', category: 'mall', importance: 0.5, publicInfra: false,
      name: 'Old Listing', pos: PLOT, contentAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    }], true);
    expect(await readNeighbourhood(PLOT)).toHaveLength(0);
  });

  it('shares one paid discovery between plots ~150 m apart', () => {
    expect(cellNeighbourhood(PLOT)).toContain(cellKey({ lat: 30.6902, lng: 76.7368 }));
  });
});

/* ════════════════ anchors ════════════════════════════════════════ */
describe('MAPCO anchor knowledge', () => {
  it('has unique ids', () => {
    const ids = MAPCO_ANCHORS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('places every anchor inside the Tri-City region', () => {
    for (const a of MAPCO_ANCHORS) {
      expect(metersBetween(a.pos, { lat: 30.72, lng: 76.75 })).toBeLessThan(40000);
    }
  });
});
