import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  PHASE1_PROMPT_SHA256, PHASE1_PROMPT_TEMPLATE, PHASE1_PROMPT_VERSION,
  PHASE2_PROMPT, PHASE2_PROMPT_SHA256, buildPhase1Prompt,
  parsePhase1Output, parseApproxKm, parseRating, parseReviewCount,
  indexGroundedPlaces, lookupGroundedPlaceId,
  normalizeCandidates, buildPhase2Input, computeSameSector, sectorToken, candidateId,
  validatePhase2Output,
  MAX_LOCAL_PLACES_PER_CATEGORY,
  type NormalizedCandidate,
} from '../src/packages/property-intelligence';
import { FakePlaces } from './helpers/pi-fakes';

const PROMPT_DIR = resolve(__dirname, '../src/packages/property-intelligence/prompts');
const readPrompt = (name: string) =>
  readFileSync(resolve(PROMPT_DIR, name), 'utf8').replace(/\r\n/g, '\n');
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/* ═══════════════════════════════════════════════════════════════
   PROMPTS — the finalized wording is the source of truth
   ═══════════════════════════════════════════════════════════════ */
describe('Property Intelligence · finalized prompts', () => {
  it('loads Phase 1 verbatim from prompts/phase1.txt', () => {
    expect(PHASE1_PROMPT_TEMPLATE).toBe(readPrompt('phase1.txt'));
  });

  it('loads Phase 2 verbatim from prompts/phase2.txt', () => {
    expect(PHASE2_PROMPT).toBe(readPrompt('phase2.txt'));
  });

  // If this fails, prompts/index.ts has drifted from the .txt files.
  // Run: node scripts/sync-pi-prompts.mjs
  it('keeps the generated module and the .txt files in lockstep', () => {
    expect(PHASE1_PROMPT_SHA256).toBe(sha(readPrompt('phase1.txt')));
    expect(PHASE2_PROMPT_SHA256).toBe(sha(readPrompt('phase2.txt')));
  });

  it('versions the prompt so a wording change invalidates the cache', () => {
    expect(PHASE1_PROMPT_VERSION).toBe(`p1-${PHASE1_PROMPT_SHA256.slice(0, 12)}`);
  });

  it('fills the real property into the Phase 1 template', () => {
    const prompt = buildPhase1Prompt({
      latitude: 30.681991, longitude: 76.702441, locality: 'Sector 78', city: 'Mohali',
    });
    expect(prompt).toContain('30.681991, 76.702441 — Sector 78, Mohali');
    expect(prompt).not.toContain('{{');
    // The grounding instruction must survive substitution.
    expect(prompt).toContain('Use Google Maps grounding explicitly');
  });

  it('keeps the finalized ranking philosophy intact in Phase 2', () => {
    expect(PHASE2_PROMPT).toContain('Rank 1 = the FINAL default location/photo MAPCO displays first');
    expect(PHASE2_PROMPT).toContain('City Reach is NOT a ranked alternative system');
    expect(PHASE2_PROMPT).toContain('Do not rank City candidates');
  });
});

/* ═══════════════════════════════════════════════════════════════
   PHASE 1 PARSER
   ═══════════════════════════════════════════════════════════════ */
describe('Property Intelligence · Phase 1 parser', () => {
  const sample = [
    'Some preamble the model felt like writing.',
    'LOCAL CANDIDATE UNIVERSE',
    'Mohali super market | PLACE_ENTITY | Grocery & Daily Needs | Sector 78, Mohali | 4.0 | UNKNOWN | 0.95 km',
    'Verma Chemist | PLACE_ENTITY | Pharmacy | Sector 79, Mohali | 4.3 | 1,204 | 950 m',
    '',
    'CITY CANDIDATE UNIVERSE',
    'Airport Road | GEOGRAPHIC_ENTITY | Major Roads & Corridors | Mohali | UNKNOWN | UNKNOWN | 3.2 km',
  ].join('\n');

  it('splits the two universes on their headings', () => {
    const { local, city } = parsePhase1Output(sample);
    expect(local).toHaveLength(2);
    expect(city).toHaveLength(1);
    expect(local[0]!.discoveredIn).toBe('LOCAL');
    expect(city[0]!.discoveredIn).toBe('CITY');
  });

  it('reads every column of a well-formed row', () => {
    const { local } = parsePhase1Output(sample);
    expect(local[0]).toMatchObject({
      name: 'Mohali super market',
      entityKind: 'PLACE_ENTITY',
      category: 'Grocery & Daily Needs',
      locality: 'Sector 78, Mohali',
      rating: 4,
      reviewCount: null,
      approxDistanceKm: 0.95,
    });
  });

  it('distinguishes GEOGRAPHIC_ENTITY from PLACE_ENTITY', () => {
    const { city } = parsePhase1Output(sample);
    expect(city[0]!.entityKind).toBe('GEOGRAPHIC_ENTITY');
  });

  it('treats UNKNOWN as absent rather than as a value', () => {
    const { city } = parsePhase1Output(sample);
    expect(city[0]!.rating).toBeNull();
    expect(city[0]!.reviewCount).toBeNull();
  });

  it('survives markdown tables, bullets, numbering and a repeated header', () => {
    const messy = [
      '## LOCAL CANDIDATE UNIVERSE',
      '| Exact Maps Name | Entity Type | Category | Locality | Rating | Review Count | Approx. Proximity |',
      '|---|---|---|---|---|---|---|',
      '| **Fresh Mart** | PLACE_ENTITY | Grocery | Sector 78, Mohali | 4.2 | 310 | 1.1 km |',
      '1. Green Park | PLACE_ENTITY | Parks | Sector 78, Mohali | 4.6 | 88 | 0.6 km',
      '- Care Clinic | PLACE_ENTITY | Clinic | Sector 79, Mohali | 4.1 | 45 | 1.4 km',
    ].join('\n');
    const { local } = parsePhase1Output(messy);
    expect(local.map((c) => c.name)).toEqual(['Fresh Mart', 'Green Park', 'Care Clinic']);
    expect(local[0]!.rating).toBe(4.2);
  });

  it('never invents a row it cannot read', () => {
    const broken = ['LOCAL CANDIDATE UNIVERSE', 'no pipes here at all', '| | | |', 'UNKNOWN | PLACE_ENTITY | x | y | 1 | 2 | 3 km'].join('\n');
    expect(parsePhase1Output(broken).local).toHaveLength(0);
  });

  it('returns empty universes for prose with no headings', () => {
    const { local, city } = parsePhase1Output('I could not find anything useful.');
    expect(local).toHaveLength(0);
    expect(city).toHaveLength(0);
  });

  describe('field parsers', () => {
    it('reads metres without mistaking them for kilometres', () => {
      expect(parseApproxKm('950 m')).toBe(0.95);
      expect(parseApproxKm('1.2 km')).toBe(1.2);
      expect(parseApproxKm('~2km away')).toBe(2);
      expect(parseApproxKm('UNKNOWN')).toBeNull();
    });
    it('reads ratings only inside the 0..5 range', () => {
      expect(parseRating('4.3/5')).toBe(4.3);
      expect(parseRating('9')).toBeNull();
      expect(parseRating('N/A')).toBeNull();
    });
    it('reads review counts including k-suffixed and bracketed forms', () => {
      expect(parseReviewCount('1,204')).toBe(1204);
      expect(parseReviewCount('(320)')).toBe(320);
      expect(parseReviewCount('1.2k reviews')).toBe(1200);
    });
  });

  it('indexes grounding chunks as free identity evidence', () => {
    const index = indexGroundedPlaces([{ placeId: 'ChIJ_abc', title: 'Mohali Super Market' }]);
    expect(index['mohali super market']).toBe('ChIJ_abc');
  });
});

/* ═══════════════════════════════════════════════════════════════
   NORMALIZATION — deterministic, no AI, no semantic filtering
   ═══════════════════════════════════════════════════════════════ */
describe('Property Intelligence · deterministic normalization', () => {
  const point = { latitude: 30.681991, longitude: 76.702441 };

  const phase1 = (localNames: string[], cityNames: string[] = []) => ({
    local: localNames.map((name) => ({
      name, entityKind: 'PLACE_ENTITY' as const, entityType: null,
      category: 'Grocery', locality: 'Sector 78, Mohali', rating: 4,
      reviewCount: 10, approxDistanceKm: 1, discoveredIn: 'LOCAL' as const,
    })),
    city: cityNames.map((name) => ({
      name, entityKind: 'PLACE_ENTITY' as const, entityType: null,
      category: 'Retail', locality: 'Chandigarh', rating: 4,
      reviewCount: 10, approxDistanceKm: 5, discoveredIn: 'CITY' as const,
    })),
  });

  it('assigns stable, zero-padded L/C ids in discovery order', async () => {
    const result = await normalizeCandidates(phase1(['A', 'B'], ['X']), new FakePlaces(), { point });
    expect(result.candidates.map((c) => c.candidateId)).toEqual(['L001', 'L002', 'C001']);
    expect(candidateId('L', 0)).toBe('L001');
    expect(candidateId('C', 11)).toBe('C012');
  });

  it('resolves PLACE_ENTITY candidates through Google Places', async () => {
    const places = new FakePlaces();
    const result = await normalizeCandidates(phase1(['Fresh Mart']), places, { point });
    expect(places.identityCalls).toHaveLength(1);
    expect(result.candidates[0]!.placesResolution.status).toBe('RESOLVED');
    expect(result.candidates[0]!.placesResolution.placeId).toBeTruthy();
    expect(result.candidates[0]!.placesResolution.verificationTier).toBe('ID_ONLY');
  });

  it('does NOT call Places for a GEOGRAPHIC_ENTITY and marks it NOT_APPLICABLE', async () => {
    const places = new FakePlaces();
    const result = await normalizeCandidates({
      local: [],
      city: [{
        name: 'Airport Road', entityKind: 'GEOGRAPHIC_ENTITY', entityType: null,
        category: 'Major Roads', locality: 'Mohali', rating: null,
        reviewCount: null, approxDistanceKm: 3, discoveredIn: 'CITY',
      }],
    }, places, { point });
    expect(places.identityCalls).toHaveLength(0);
    expect(result.candidates[0]!.placesResolution.status).toBe('NOT_APPLICABLE');
    expect(result.candidates[0]!.placesResolution.placeId).toBeNull();
  });

  it('KEEPS AMBIGUOUS and UNRESOLVED candidates — they are not rejections', async () => {
    const places = new FakePlaces({
      identity: {
        Ambiguous: { status: 'AMBIGUOUS', placeId: null, candidatePlaceIds: ['a', 'b'], fieldMask: [] },
        Missing: { status: 'UNRESOLVED', placeId: null, candidatePlaceIds: [], fieldMask: [] },
      },
    });
    const result = await normalizeCandidates(phase1(['Ambiguous Shop', 'Missing Shop', 'Fine Shop']), places, { point });
    expect(result.candidates).toHaveLength(3);
    expect(result.stats.ambiguous).toBe(1);
    expect(result.stats.unresolved).toBe(1);
  });

  it('merges ONLY exact Place-ID duplicates, and unions discoveredIn', async () => {
    const places = new FakePlaces({
      identity: {
        Twin: { status: 'RESOLVED', placeId: 'same_place', candidatePlaceIds: [], fieldMask: [] },
      },
    });
    const result = await normalizeCandidates(phase1(['Twin One'], ['Twin Two']), places, { point });
    expect(result.candidates).toHaveLength(1);
    expect(result.stats.mergedDuplicates).toBe(1);
    expect(result.candidates[0]!.discoveredIn.sort()).toEqual(['CITY', 'LOCAL']);
  });

  it('keeps different Place IDs distinct even when the names are similar', async () => {
    const places = new FakePlaces({
      identity: {
        'Reliance Fresh Sector 78': { status: 'RESOLVED', placeId: 'p_78', candidatePlaceIds: [], fieldMask: [] },
        'Reliance Fresh Sector 79': { status: 'RESOLVED', placeId: 'p_79', candidatePlaceIds: [], fieldMask: [] },
      },
    });
    const result = await normalizeCandidates(
      phase1(['Reliance Fresh Sector 78', 'Reliance Fresh Sector 79']), places, { point },
    );
    expect(result.candidates).toHaveLength(2);
    expect(result.stats.mergedDuplicates).toBe(0);
  });

  it('performs NO semantic filtering — every discovered candidate reaches Phase 2', async () => {
    const names = Array.from({ length: 40 }, (_, i) => `Candidate ${i}`);
    const result = await normalizeCandidates(phase1(names), new FakePlaces(), { point });
    expect(result.candidates).toHaveLength(40);
  });

  it('uses a free grounded place id instead of paying for identity', async () => {
    const places = new FakePlaces();
    const result = await normalizeCandidates(phase1(['Fresh Mart']), places, {
      point, groundedPlaceIds: { 'fresh mart': 'ChIJ_grounded' },
    });
    expect(places.identityCalls).toHaveLength(0);
    expect(result.candidates[0]!.placesResolution.placeId).toBe('ChIJ_grounded');
    expect(result.candidates[0]!.placesResolution.provider).toBe('GEMINI_GROUNDING');
    expect(result.stats.groundedIdentityHits).toBe(1);
  });

  it('carries candidates UNRESOLVED rather than dropping them when the budget runs out', async () => {
    const places = new FakePlaces();
    const result = await normalizeCandidates(phase1(['A', 'B', 'C']), places, {
      point, maxIdentityResolutions: 1,
    });
    expect(places.identityCalls).toHaveLength(1);
    expect(result.candidates).toHaveLength(3);
    expect(result.stats.identityBudgetExhausted).toBe(true);
  });

  it('survives a Places outage without losing the candidate', async () => {
    const result = await normalizeCandidates(
      phase1(['A']), new FakePlaces({ failIdentity: true }), { point },
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.placesResolution.status).toBe('UNRESOLVED');
  });

  describe('sameSector', () => {
    it('extracts a comparable sector token', () => {
      expect(sectorToken('Sector 78, Mohali')).toBe('sector78');
      expect(sectorToken('Sector-79')).toBe('sector79');
      expect(sectorToken('Phase 3B2, Mohali')).toBe('phase3b2');
      expect(sectorToken('Chandigarh')).toBeNull();
    });
    it('is true only when both sides name the SAME sector', () => {
      expect(computeSameSector('Sector 78, Mohali', 'Sector 78')).toBe(true);
      expect(computeSameSector('Sector 79, Mohali', 'Sector 78')).toBe(false);
      expect(computeSameSector('Mohali', 'Sector 78')).toBe(false);
      expect(computeSameSector('Sector 78, Mohali', undefined, 'Sector 78')).toBe(true);
    });
  });

  it('builds exactly the finalized Phase 2 input contract', async () => {
    const result = await normalizeCandidates(phase1(['A'], ['B']), new FakePlaces(), {
      point, propertySector: 'Sector 78',
    });
    const input = buildPhase2Input({
      propertyId: 'prop-1', point, locality: 'Sector 78', city: 'Mohali',
      candidates: result.candidates,
    });
    expect(input.schemaVersion).toBe('mapco.phase2.input.v1');
    expect(Object.keys(input)).toEqual(['schemaVersion', 'property', 'candidateUniverse', 'importantSemantics']);
    expect(input.property.propertyType).toBe('RESIDENTIAL');
    expect(input.importantSemantics.placesResolution)
      .toContain('UNRESOLVED/AMBIGUOUS is not an automatic rejection');
    const candidate = input.candidateUniverse[0]!;
    expect(Object.keys(candidate).sort())
      .toEqual(['candidateId', 'discoveredIn', 'discovery', 'entityKind', 'mapcoContext', 'placesResolution']);
  });

  it('matches the shape of the finalized reference document', () => {
    const reference = JSON.parse(
      readFileSync(resolve(__dirname, 'fixtures/phase2-input-sector78.json'), 'utf8'),
    ) as { schemaVersion: string; candidateUniverse: NormalizedCandidate[] };
    expect(reference.schemaVersion).toBe('mapco.phase2.input.v1');
    const sample = reference.candidateUniverse[0]!;
    expect(Object.keys(sample).sort())
      .toEqual(['candidateId', 'discoveredIn', 'discovery', 'entityKind', 'mapcoContext', 'placesResolution']);
    expect(Object.keys(sample.discovery).sort()).toEqual(
      ['approxDistanceKm', 'category', 'entityType', 'locality', 'name', 'rating', 'reviewCount'],
    );
  });
});

/* ═══════════════════════════════════════════════════════════════
   PHASE 2 VALIDATION — never trust AI JSON
   ═══════════════════════════════════════════════════════════════ */
describe('Property Intelligence · Phase 2 validation', () => {
  const universe: NormalizedCandidate[] = ['L001', 'L002', 'L003', 'C001', 'C002'].map((id) => ({
    candidateId: id,
    discoveredIn: [id.startsWith('L') ? 'LOCAL' : 'CITY'],
    entityKind: 'PLACE_ENTITY',
    discovery: {
      name: `Place ${id}`, entityType: null, category: null, locality: null,
      rating: null, reviewCount: null, approxDistanceKm: null,
    },
    placesResolution: {
      provider: 'GOOGLE_PLACES_NEW', verificationTier: 'ID_ONLY', status: 'RESOLVED',
      placeId: `p_${id}`, candidatePlaceIds: [], fieldMask: [], queryUsed: null,
    },
    mapcoContext: { sameSector: false, seenBefore: false },
  }));

  const valid = {
    localCategories: [{ category: 'Daily Needs & Groceries', places: [{ candidateId: 'L001', rank: 1 }, { candidateId: 'L002', rank: 2 }] }],
    cityPlaces: [{ candidateId: 'C001', category: 'Major Retail & Lifestyle' }],
  };

  it('accepts a well-formed payload', () => {
    const result = validatePhase2Output(JSON.stringify(valid), universe);
    expect(result.ok).toBe(true);
    expect(result.value!.localCategories[0]!.places[0]!.rank).toBe(1);
  });

  it('parses a fenced markdown response', () => {
    const fenced = '```json\n' + JSON.stringify(valid) + '\n```';
    expect(validatePhase2Output(fenced, universe).ok).toBe(true);
  });

  it('rejects non-JSON', () => {
    const result = validatePhase2Output('I think the best places are…', universe);
    expect(result.ok).toBe(false);
    expect(result.issues[0]!.code).toBe('not_json');
  });

  it('rejects an INVENTED candidateId', () => {
    const bad = { ...valid, localCategories: [{ category: 'X', places: [{ candidateId: 'L999', rank: 1 }] }] };
    const result = validatePhase2Output(JSON.stringify(bad), universe);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'unknown_candidate')).toBe(true);
  });

  it('rejects a duplicate rank inside one category', () => {
    const bad = { ...valid, localCategories: [{ category: 'X', places: [{ candidateId: 'L001', rank: 1 }, { candidateId: 'L002', rank: 1 }] }] };
    expect(validatePhase2Output(JSON.stringify(bad), universe).issues.some((i) => i.code === 'duplicate_rank')).toBe(true);
  });

  it('rejects non-sequential ranks — every category needs a rank 1', () => {
    const bad = { ...valid, localCategories: [{ category: 'X', places: [{ candidateId: 'L001', rank: 2 }, { candidateId: 'L002', rank: 3 }] }] };
    expect(validatePhase2Output(JSON.stringify(bad), universe).issues.some((i) => i.code === 'non_sequential_rank')).toBe(true);
  });

  it('rejects the same candidate twice inside one category', () => {
    const bad = { ...valid, localCategories: [{ category: 'X', places: [{ candidateId: 'L001', rank: 1 }, { candidateId: 'L001', rank: 2 }] }] };
    expect(validatePhase2Output(JSON.stringify(bad), universe).issues.some((i) => i.code === 'duplicate_candidate')).toBe(true);
  });

  it('rejects more than four places in a Local category', () => {
    const bad = {
      ...valid,
      localCategories: [{
        category: 'X',
        places: ['L001', 'L002', 'L003', 'C001', 'C002'].map((candidateId, i) => ({ candidateId, rank: i + 1 })),
      }],
    };
    expect(MAX_LOCAL_PLACES_PER_CATEGORY).toBe(4);
    expect(validatePhase2Output(JSON.stringify(bad), universe).issues.some((i) => i.code === 'too_many_places')).toBe(true);
  });

  it('REJECTS a rank on a City candidate — City Reach is unranked', () => {
    const bad = { ...valid, cityPlaces: [{ candidateId: 'C001', category: 'Retail', rank: 1 }] };
    const result = validatePhase2Output(JSON.stringify(bad), universe);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'city_has_rank')).toBe(true);
  });

  it('rejects unexpected fields such as reasons or finalists', () => {
    const bad = { ...valid, rejected: ['L003'] };
    expect(validatePhase2Output(JSON.stringify(bad), universe).issues.some((i) => i.code === 'unknown_field')).toBe(true);
  });

  it('rejects an empty category', () => {
    const bad = { ...valid, localCategories: [{ category: 'X', places: [] }] };
    expect(validatePhase2Output(JSON.stringify(bad), universe).issues.some((i) => i.code === 'empty_category')).toBe(true);
  });

  it('ALLOWS Phase 2 to reclassify across groups — discoveredIn is not final', () => {
    const reclassified = {
      localCategories: [{ category: 'Daily Needs', places: [{ candidateId: 'C001', rank: 1 }] }],
      cityPlaces: [{ candidateId: 'L001', category: 'Major Retail & Lifestyle' }],
    };
    expect(validatePhase2Output(JSON.stringify(reclassified), universe).ok).toBe(true);
  });

  it('produces actionable repair feedback naming the failures', () => {
    const bad = { ...valid, localCategories: [{ category: 'X', places: [{ candidateId: 'NOPE', rank: 1 }] }] };
    const feedback = validatePhase2Output(JSON.stringify(bad), universe).feedback!;
    expect(feedback).toContain('rejected by MAPCO schema validation');
    expect(feedback).toContain('NOPE');
    expect(feedback).toContain('Do not invent candidateIds');
  });
});

/* ═══════════════════════════════════════════════════════════════
   GROUNDED IDENTITY — free place ids recovered from Phase 1
   A live run indexed 59 grounded places and matched ZERO by exact
   title, then paid for 57 avoidable Places lookups. These lock the fix.
   ═══════════════════════════════════════════════════════════════ */
describe('Property Intelligence · grounded identity matching', () => {
  it('indexes both the full title and its leading name segment', () => {
    const index = indexGroundedPlaces([
      { placeId: 'ChIJ_abc', title: 'Mohali Super Market, Sector 78, Sahibzada Ajit Singh Nagar, Punjab' },
    ]);
    expect(index['mohali super market']).toBe('ChIJ_abc');
    expect(Object.values(index)).toContain('ChIJ_abc');
  });

  it('matches a candidate whose name is only part of the grounded title', () => {
    const index = indexGroundedPlaces([
      { placeId: 'ChIJ_abc', title: 'Sohana Hospital, Airport Road, Sector 77, Mohali' },
    ]);
    expect(lookupGroundedPlaceId(index, 'Sohana Hospital')).toBe('ChIJ_abc');
  });

  it('matches when the candidate name is LONGER than the grounded title', () => {
    const index = indexGroundedPlaces([{ placeId: 'ChIJ_x', title: 'GMADA Sports Complex' }]);
    expect(lookupGroundedPlaceId(index, 'GMADA Sports Complex Sector 78 Mohali')).toBe('ChIJ_x');
  });

  it('refuses containment matching for very short names', () => {
    // "Zone 78" would otherwise collide with any title containing it.
    const index = indexGroundedPlaces([{ placeId: 'ChIJ_y', title: 'Zone 78 Wellness Centre, Mohali' }]);
    expect(lookupGroundedPlaceId(index, 'Zone')).toBeUndefined();
  });

  it('returns nothing when there is genuinely no match', () => {
    const index = indexGroundedPlaces([{ placeId: 'ChIJ_z', title: 'Fortis Hospital, Mohali' }]);
    expect(lookupGroundedPlaceId(index, 'Completely Different Place')).toBeUndefined();
  });

  it('spends nothing on Places when grounding already identified the place', async () => {
    const places = new FakePlaces();
    const result = await normalizeCandidates(
      {
        local: [{
          name: 'Sohana Hospital', entityKind: 'PLACE_ENTITY', entityType: null,
          category: 'Hospital', locality: 'Sector 77, Mohali', rating: 4.2,
          reviewCount: 900, approxDistanceKm: 1.9, discoveredIn: 'LOCAL',
        }],
        city: [],
      },
      places,
      {
        point: { latitude: 30.68, longitude: 76.70 },
        groundedPlaceIds: indexGroundedPlaces([
          { placeId: 'ChIJ_sohana', title: 'Sohana Hospital, Airport Road, Sector 77, Mohali' },
        ]),
      },
    );
    expect(places.identityCalls).toHaveLength(0);
    expect(result.stats.groundedIdentityHits).toBe(1);
    expect(result.candidates[0]!.placesResolution.placeId).toBe('ChIJ_sohana');
    expect(result.candidates[0]!.placesResolution.provider).toBe('GEMINI_GROUNDING');
  });
});
