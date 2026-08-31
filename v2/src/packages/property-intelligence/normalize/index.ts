/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · deterministic normalization
   ---------------------------------------------------------------
   Everything between Phase 1 and Phase 2. NO AI runs here.

     1. stable candidate ids            L001…  /  C001…
     2. Google Places identity          RESOLVED | AMBIGUOUS | UNRESOLVED
     3. GEOGRAPHIC_ENTITY               NOT_APPLICABLE (no place id needed)
     4. EXACT place-id dedupe ONLY      same id → merge; different → keep
     5. field normalization
     6. sameSector                      deterministic string comparison
     7. the Phase 2 input contract      mapco.phase2.input.v1

   What this deliberately does NOT do: any semantic usefulness filtering.
   A weak-looking candidate, an AMBIGUOUS one and an UNRESOLVED one all
   reach Phase 2, because Phase 2 is the intelligence judge and dropping a
   candidate here would silently overrule it.
   ═══════════════════════════════════════════════════════════════ */
import {
  PHASE2_INPUT_SCHEMA_VERSION,
  type GeoPoint,
  type NormalizedCandidate,
  type Phase1Candidate,
  type Phase2Input,
  type PlaceMedia,
  type PlacesPort,
  type PlacesResolution,
} from '../types.ts';
import { lookupGroundedPlaceId } from '../phase1/parse.ts';

/** Zero-padded stable ids, assigned in discovery order. */
export function candidateId(prefix: 'L' | 'C', index: number): string {
  return `${prefix}${String(index + 1).padStart(3, '0')}`;
}

/**
 * Extract a comparable sector token from a locality string.
 * "Sector 78, Mohali" → "sector78" ; "Phase 3B2" → "phase3b2".
 * Returns null when the text names no sector-like unit.
 */
export function sectorToken(value: string | null | undefined): string | null {
  const text = String(value ?? '').toLowerCase();
  const sector = text.match(/\bsector\s*-?\s*(\d+\s*[a-z]?)/);
  if (sector) return `sector${sector[1]!.replace(/\s+/g, '')}`;
  const phase = text.match(/\bphase\s*-?\s*(\d+\s*[a-z0-9]*)/);
  if (phase) return `phase${phase[1]!.replace(/\s+/g, '')}`;
  const block = text.match(/\bblock\s*-?\s*([a-z0-9]+)/);
  if (block) return `block${block[1]}`;
  return null;
}

/**
 * sameSector is a WEAK contextual signal for Phase 2, computed here so it is
 * deterministic and auditable rather than something the model guesses.
 * True only when both sides name a sector-like unit AND they match.
 */
export function computeSameSector(
  candidateLocality: string | null | undefined,
  propertySector: string | null | undefined,
  propertyLocality?: string | null,
): boolean {
  const candidate = sectorToken(candidateLocality);
  if (!candidate) return false;
  const property = sectorToken(propertySector) ?? sectorToken(propertyLocality);
  if (!property) return false;
  return candidate === property;
}

const UNRESOLVED: PlacesResolution = {
  provider: 'GOOGLE_PLACES_NEW',
  verificationTier: 'ID_ONLY',
  status: 'UNRESOLVED',
  placeId: null,
  candidatePlaceIds: [],
  fieldMask: ['places.id'],
  queryUsed: null,
};

const NOT_APPLICABLE: PlacesResolution = {
  provider: 'NONE',
  verificationTier: 'NONE',
  status: 'NOT_APPLICABLE',
  placeId: null,
  candidatePlaceIds: [],
  fieldMask: [],
  queryUsed: null,
};

/** The query MAPCO sends to Places for identity — name plus locality, so a
 *  generic shop name resolves in the right neighbourhood. */
export function identityQuery(candidate: Phase1Candidate): string {
  return [candidate.name, candidate.locality].filter(Boolean).join(', ');
}

export interface NormalizeOptions {
  point: GeoPoint;
  propertySector?: string;
  propertyLocality?: string;
  groundedPlaceIds?: Record<string, string>;
  /** Place ids MAPCO has already seen — sets mapcoContext.seenBefore. */
  knownPlaceIds?: ReadonlySet<string>;
  /** Hard ceiling on paid identity lookups for this generation. */
  maxIdentityResolutions?: number;
  signal?: AbortSignal;
  /** Called once per PAID Places identity request, for the cost ledger. */
  onIdentityRequest?: (query: string) => void;
  log?: (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => void;
}

export interface NormalizeResult {
  candidates: NormalizedCandidate[];
  /** Counters for the run record. */
  stats: {
    discovered: number;
    resolved: number;
    ambiguous: number;
    unresolved: number;
    notApplicable: number;
    mergedDuplicates: number;
    paidIdentityRequests: number;
    groundedIdentityHits: number;
    identityBudgetExhausted: boolean;
  };
}

/**
 * Resolve identity for every PLACE_ENTITY, then merge only EXACT place-id
 * duplicates. Candidates are processed in discovery order so ids are stable
 * for a given Phase 1 output.
 */
export async function normalizeCandidates(
  phase1: { local: Phase1Candidate[]; city: Phase1Candidate[] },
  places: PlacesPort,
  opts: NormalizeOptions,
): Promise<NormalizeResult> {
  const grounded = opts.groundedPlaceIds ?? {};
  const known = opts.knownPlaceIds ?? new Set<string>();
  const budget = opts.maxIdentityResolutions ?? Number.POSITIVE_INFINITY;

  const stats: NormalizeResult['stats'] = {
    discovered: phase1.local.length + phase1.city.length,
    resolved: 0, ambiguous: 0, unresolved: 0, notApplicable: 0,
    mergedDuplicates: 0, paidIdentityRequests: 0, groundedIdentityHits: 0,
    identityBudgetExhausted: false,
  };

  const ordered: Array<{ candidate: Phase1Candidate; id: string }> = [
    ...phase1.local.map((candidate, i) => ({ candidate, id: candidateId('L', i) })),
    ...phase1.city.map((candidate, i) => ({ candidate, id: candidateId('C', i) })),
  ];

  const out: NormalizedCandidate[] = [];
  /** place id → index in `out`, for EXACT identity dedupe. */
  const byPlaceId = new Map<string, number>();

  for (const { candidate, id } of ordered) {
    if (opts.signal?.aborted) break;

    let resolution: PlacesResolution;

    if (candidate.entityKind === 'GEOGRAPHIC_ENTITY') {
      // Roads, corridors and districts do not need a Place ID to be useful
      // City intelligence, and forcing one would invent a false identity.
      resolution = { ...NOT_APPLICABLE };
      stats.notApplicable++;
    } else {
      const query = identityQuery(candidate);
      const groundedId = lookupGroundedPlaceId(grounded, candidate.name);
      if (groundedId) {
        // Free identity: the model cited this place id in a grounding chunk.
        resolution = {
          provider: 'GEMINI_GROUNDING', verificationTier: 'GROUNDED',
          status: 'RESOLVED', placeId: groundedId, candidatePlaceIds: [],
          fieldMask: [], queryUsed: query,
        };
        stats.groundedIdentityHits++;
        stats.resolved++;
      } else if (stats.paidIdentityRequests >= budget) {
        // Budget exhausted: carry the candidate UNRESOLVED rather than drop
        // it. Phase 2 is told UNRESOLVED is not an automatic rejection.
        stats.identityBudgetExhausted = true;
        resolution = { ...UNRESOLVED, queryUsed: query };
        stats.unresolved++;
      } else {
        stats.paidIdentityRequests++;
        opts.onIdentityRequest?.(query);
        let identity;
        try {
          identity = await places.resolveIdentity(query, opts.point, { signal: opts.signal });
        } catch (error) {
          opts.log?.('warn', 'pi.normalize.identityFailed', {
            candidateId: id, error: (error as Error).message,
          });
          identity = null;
        }
        if (!identity) {
          resolution = { ...UNRESOLVED, queryUsed: query };
          stats.unresolved++;
        } else {
          resolution = {
            provider: 'GOOGLE_PLACES_NEW',
            verificationTier: 'ID_ONLY',
            status: identity.status,
            placeId: identity.placeId,
            candidatePlaceIds: identity.candidatePlaceIds,
            fieldMask: identity.fieldMask,
            queryUsed: query,
          };
          if (identity.status === 'RESOLVED') stats.resolved++;
          else if (identity.status === 'AMBIGUOUS') stats.ambiguous++;
          else stats.unresolved++;
        }
      }
    }

    const normalized: NormalizedCandidate = {
      candidateId: id,
      discoveredIn: [candidate.discoveredIn],
      entityKind: candidate.entityKind,
      discovery: {
        name: candidate.name,
        entityType: candidate.entityType,
        category: candidate.category,
        locality: candidate.locality,
        rating: candidate.rating,
        reviewCount: candidate.reviewCount,
        approxDistanceKm: candidate.approxDistanceKm,
      },
      placesResolution: resolution,
      mapcoContext: {
        sameSector: computeSameSector(
          candidate.locality, opts.propertySector, opts.propertyLocality,
        ),
        seenBefore: resolution.placeId ? known.has(resolution.placeId) : false,
      },
    };

    // EXACT identity dedupe only. Two different place ids stay distinct even
    // when their names look similar — that is Phase 2's judgment, not ours.
    const placeId = resolution.placeId;
    if (placeId) {
      const existingIndex = byPlaceId.get(placeId);
      if (existingIndex !== undefined) {
        const existing = out[existingIndex]!;
        for (const source of normalized.discoveredIn) {
          if (!existing.discoveredIn.includes(source)) existing.discoveredIn.push(source);
        }
        // Keep the richer discovery record when the duplicate carries more.
        if (existing.discovery.rating === null && normalized.discovery.rating !== null) {
          existing.discovery.rating = normalized.discovery.rating;
        }
        if (existing.discovery.reviewCount === null && normalized.discovery.reviewCount !== null) {
          existing.discovery.reviewCount = normalized.discovery.reviewCount;
        }
        if (existing.discovery.approxDistanceKm === null && normalized.discovery.approxDistanceKm !== null) {
          existing.discovery.approxDistanceKm = normalized.discovery.approxDistanceKm;
        }
        existing.mapcoContext.sameSector ||= normalized.mapcoContext.sameSector;
        stats.mergedDuplicates++;
        continue;
      }
      byPlaceId.set(placeId, out.length);
    }

    out.push(normalized);
  }

  return { candidates: out, stats };
}

/** The exact document Phase 2 receives. */
export function buildPhase2Input(input: {
  propertyId: string;
  propertyType?: string;
  propertySubtype?: string;
  point: GeoPoint;
  locality: string;
  city: string;
  candidates: NormalizedCandidate[];
}): Phase2Input {
  return {
    schemaVersion: PHASE2_INPUT_SCHEMA_VERSION,
    property: {
      propertyId: input.propertyId,
      propertyType: input.propertyType || 'RESIDENTIAL',
      propertySubtype: input.propertySubtype || 'HOUSE_PLOT_OR_RESIDENTIAL_PROPERTY',
      latitude: input.point.latitude,
      longitude: input.point.longitude,
      locality: input.locality,
      city: input.city,
      profile: {},
    },
    candidateUniverse: input.candidates,
    importantSemantics: {
      discoveredIn: 'Discovery source only; not final Local/City classification.',
      discoveryApproxDistance:
        'Soft Gemini Maps-grounded hint only; Google Routes has not run yet.',
      placesResolution:
        'Identity evidence only. UNRESOLVED/AMBIGUOUS is not an automatic rejection.',
      sameSector: 'Weak contextual signal only.',
    },
  };
}

/** Place ids MAPCO already holds media for — drives `seenBefore` and makes
 *  the photo-reuse saving visible in the run record. */
export function knownPlaceIdsFrom(media: Map<string, PlaceMedia>): Set<string> {
  const ids = new Set<string>();
  for (const [placeId, record] of media) {
    if (record.status === 'stored') ids.add(placeId);
  }
  return ids;
}
