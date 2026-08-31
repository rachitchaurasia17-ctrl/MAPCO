/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Phase 3 (deterministic, NO AI)
   ---------------------------------------------------------------
   Runs ONLY over the places Phase 2 actually selected. The Phase 1
   universe is 70–110 candidates; enriching all of them would cost real
   money for rows no dealer will ever see.

   PHOTOS — global, not per-property.
     place id → MAPCO place registry → stored copy?
        yes → reuse the stored asset (no Google call, recorded as a
              cache hit so the saving is visible)
        no  → Place Details (photo reference) → Place Photo bytes →
              persist once → every future property near that place
              reuses it
     MAPCO holds written Google approval for this persistent storage
     (docs/google-place-photos-approval.md), which is why the flow is
     store-once-and-reuse rather than re-fetch-per-view.

   ROUTES — real road distance, duration and polyline from the property's
     canonical coordinate, cached by origin+destination+version. The
     Phase 1 approximate proximity is NEVER promoted into a displayed
     distance; a failed route stays visibly unavailable.

   GEOGRAPHIC_ENTITY (roads, corridors, districts) are not routed to a
   fabricated point — routing to "an arterial road" has no single honest
   destination. They are presented as landmarks and marked
   not_applicable, which the map layer renders as a highlight.
   ═══════════════════════════════════════════════════════════════ */
import type {
  GeoPoint, IntelligencePlace, NormalizedCandidate, PlaceMedia,
  PlacesPort, RouteResultRecord, RoutesPort, IntelligenceStore,
} from '../types.ts';
import type { CostLedger } from '../cost/ledger.ts';
import { categoryIcon } from '../icons.ts';
import { formatDistance, formatDuration } from '../geo.ts';

/** Route cache identity version. Bump when the route contract changes
 *  (travel mode, field mask) so stale rows are naturally recomputed. */
export const ROUTE_CACHE_VERSION = 'r1-drive-essentials';

/** Photos are stored at a single sensible width — a card is ~404 px wide,
 *  so 800 px covers 2x displays without paying for needless bytes. */
export const PHOTO_MAX_WIDTH_PX = 800;

/**
 * Origin identity for the route cache. Rounded to ~1.1 m so two saves at
 * the same spot share cached routes, while a genuine relocation does not —
 * which is what makes a moved property recompute its routes.
 */
export function routeOriginKey(point: GeoPoint): string {
  return `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}|${ROUTE_CACHE_VERSION}`;
}

/** Destination identity: a stable place id when we have one. */
export function routeDestinationKey(dest: { placeId?: string | null; latitude?: number | null; longitude?: number | null }): string {
  if (dest.placeId) return `place:${dest.placeId}`;
  if (typeof dest.latitude === 'number' && typeof dest.longitude === 'number') {
    return `pt:${dest.latitude.toFixed(5)},${dest.longitude.toFixed(5)}`;
  }
  return '';
}

/** One place Phase 2 selected, with its normalization record. */
export interface Selection {
  candidate: NormalizedCandidate;
  group: 'local' | 'city';
  category: string;
  rank?: number;
}

export interface EnrichDeps {
  places: PlacesPort;
  routes: RoutesPort;
  store: IntelligenceStore;
  ledger: CostLedger;
  origin: GeoPoint;
  maxEnrichedPlaces: number;
  maxRouteCalls: number;
  maxGenerationInr: number;
  now: () => string;
  signal?: AbortSignal;
  log?: (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => void;
}

export interface EnrichStats {
  detailsFetched: number;
  photosReused: number;
  photosFetched: number;
  photosUnavailable: number;
  routesReused: number;
  routesComputed: number;
  routesUnavailable: number;
  costCapReached: boolean;
}

export interface EnrichResult {
  places: IntelligencePlace[];
  stats: EnrichStats;
}

function emptyStats(): EnrichStats {
  return {
    detailsFetched: 0, photosReused: 0, photosFetched: 0, photosUnavailable: 0,
    routesReused: 0, routesComputed: 0, routesUnavailable: 0, costCapReached: false,
  };
}

/** Phase 3 is I/O-bound (Places, Storage and Routes). A bounded worker pool
 * keeps the deployed Edge run inside its wall-clock budget without changing
 * selection order, provider fields, cache identity or cost decisions. */
async function mapWithConcurrency<T>(
  items: readonly T[], concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const run = async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index]!, index);
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) }, () => run(),
  ));
}

/** Resolve the routable place id for a candidate, without guessing. */
function routablePlaceId(candidate: NormalizedCandidate): string | null {
  const resolution = candidate.placesResolution;
  if (resolution.placeId) return resolution.placeId;
  // Phase 2 has already judged this candidate worth showing. Dropping the
  // card now would lose a place the intelligence judge selected, so MAPCO
  // uses Google's top location-biased match. The ambiguity remains recorded
  // on the candidate — this is a presentation decision, not a claim that
  // the identity was certain.
  if (resolution.status === 'AMBIGUOUS' && resolution.candidatePlaceIds.length > 0) {
    return resolution.candidatePlaceIds[0]!;
  }
  return null;
}

/**
 * Enrich the Phase 2 selections into renderable cards.
 * Order is preserved; every selection produces exactly one card, even when
 * its photo or route is unavailable — a missing photo is an honest
 * placeholder, never a borrowed image from another place.
 */
export async function enrichSelections(
  selections: readonly Selection[],
  deps: EnrichDeps,
): Promise<EnrichResult> {
  const stats = emptyStats();
  const out: IntelligencePlace[] = [];
  const originKey = routeOriginKey(deps.origin);

  /* ── 1. one batched read of the global place registry ─────────── */
  const wanted = new Map<string, string>(); // candidateId → placeId
  for (const selection of selections) {
    const placeId = routablePlaceId(selection.candidate);
    if (placeId) wanted.set(selection.candidate.candidateId, placeId);
  }
  const registry = await deps.store.getPlaceMedia([...new Set(wanted.values())]);

  /* ── 2. one batched read of the route cache ───────────────────── */
  const destinationKeys = [...new Set(
    [...wanted.values()].map((placeId) => routeDestinationKey({ placeId })),
  )].filter(Boolean);
  const routeCache = await deps.store.getRoutes(originKey, destinationKeys);

  let enriched = 0;
  let routeCalls = 0;

  await mapWithConcurrency(selections, 16, async (selection, selectionIndex) => {
    if (deps.signal?.aborted) return;
    const { candidate, group, category, rank } = selection;
    const placeId = wanted.get(candidate.candidateId) ?? null;
    const isGeographic = candidate.entityKind === 'GEOGRAPHIC_ENTITY';

    let displayName = candidate.discovery.name;
    let latitude: number | null = null;
    let longitude: number | null = null;
    let address: string | null = null;
    let media: PlaceMedia | null = placeId ? registry.get(placeId) ?? null : null;

    /* ── details + photo, only for routable places ──────────────── */
    if (placeId && !isGeographic) {
      // A place MAPCO has already stored is completely free: the cached
      // facts carry the coordinate the route needs, so neither Place
      // Details nor Place Photos is called again for it — anywhere, for
      // any property, ever.
      const fullyCached = media?.status === 'stored'
        && Boolean(media.publicUrl)
        && typeof media.latitude === 'number'
        && typeof media.longitude === 'number';

      if (fullyCached) {
        deps.ledger.record('places_details', 1, { cacheHit: true, detail: `reuse ${placeId}` });
        deps.ledger.record('place_photo', 1, { cacheHit: true, detail: `reuse ${placeId}` });
        stats.photosReused++;
        displayName = media!.displayName || displayName;
        latitude = media!.latitude ?? null;
        longitude = media!.longitude ?? null;
        address = media!.address ?? null;
      } else if (enriched >= deps.maxEnrichedPlaces) {
        stats.costCapReached = true;
      } else if (deps.ledger.wouldExceed(deps.maxGenerationInr, 'places_details', 1)) {
        stats.costCapReached = true;
      } else {
        enriched++;
        deps.ledger.record('places_details', 1, { detail: placeId });
        stats.detailsFetched++;
        let details = null;
        try {
          details = await deps.places.details(placeId, { signal: deps.signal });
        } catch (error) {
          deps.log?.('warn', 'pi.enrich.detailsFailed', {
            placeId, error: (error as Error).message,
          });
        }
        if (details) {
          displayName = details.displayName || displayName;
          latitude = details.latitude;
          longitude = details.longitude;
          address = details.formattedAddress;

          const alreadyHasPhoto = media?.status === 'stored' && Boolean(media.publicUrl);
          if (alreadyHasPhoto) {
            deps.ledger.record('place_photo', 1, { cacheHit: true, detail: `reuse ${placeId}` });
            stats.photosReused++;
          } else if (!details.photoName) {
            // Google has no photo for this place. An honest placeholder is
            // correct; borrowing another place's image is not.
            media = await deps.store.putPlaceMedia({
              placeId, googlePhotoName: null, source: 'GOOGLE_PLACE_PHOTO',
              storagePath: null, publicUrl: null, mimeType: null,
              widthPx: null, heightPx: null, attributions: [],
              retrievedAt: deps.now(), status: 'unavailable',
              displayName, latitude, longitude, address,
            });
            stats.photosUnavailable++;
          } else if (deps.ledger.wouldExceed(deps.maxGenerationInr, 'place_photo', 1)) {
            stats.costCapReached = true;
            stats.photosUnavailable++;
          } else {
            media = await fetchAndStorePhoto(placeId, details.photoName, details, deps, stats);
          }
        }
      }
    }

    /* ── route ───────────────────────────────────────────────────── */
    let route: RouteResultRecord | null = null;
    let routeStatus: IntelligencePlace['routeStatus'] = 'unavailable';

    if (isGeographic) {
      // A corridor has no single honest destination point.
      routeStatus = 'not_applicable';
    } else if (placeId) {
      const destKey = routeDestinationKey({ placeId });
      const cached = routeCache.get(destKey);
      if (cached) {
        route = cached;
        routeStatus = 'ok';
        deps.ledger.record('routes_compute_route', 1, {
          cacheHit: true, detail: `reuse ${destKey}`,
        });
        stats.routesReused++;
      } else if (
        routeCalls < deps.maxRouteCalls
        && !deps.ledger.wouldExceed(deps.maxGenerationInr, 'routes_compute_route', 1)
      ) {
        routeCalls++;
        deps.ledger.record('routes_compute_route', 1, { detail: destKey });
        let line = null;
        try {
          line = await deps.routes.computeRoute(
            deps.origin,
            { placeId, latitude: latitude ?? 0, longitude: longitude ?? 0 },
            { travelMode: 'DRIVE', signal: deps.signal },
          );
        } catch (error) {
          deps.log?.('warn', 'pi.enrich.routeFailed', {
            placeId, error: (error as Error).message,
          });
        }
        if (line) {
          route = {
            destinationKey: destKey,
            distanceMeters: line.distanceMeters,
            durationSeconds: line.durationSeconds,
            encodedPolyline: line.encodedPolyline,
            travelMode: 'DRIVE',
            computedAt: deps.now(),
          };
          routeStatus = 'ok';
          stats.routesComputed++;
          await deps.store.putRoute(originKey, route);
        } else {
          stats.routesUnavailable++;
        }
      } else {
        stats.costCapReached = true;
        stats.routesUnavailable++;
      }
    }

    out[selectionIndex] = {
      id: `${group}:${candidate.candidateId}`,
      candidateId: candidate.candidateId,
      group,
      entityKind: candidate.entityKind,
      category,
      ...(rank !== undefined ? { rank } : {}),
      name: displayName,
      icon: categoryIcon(category, candidate.discovery.category, candidate.entityKind),
      distanceMeters: route ? route.distanceMeters : null,
      distanceLabel: route ? formatDistance(route.distanceMeters) : null,
      durationSeconds: route ? route.durationSeconds : null,
      durationLabel: route ? formatDuration(route.durationSeconds) : null,
      travelMode: route ? route.travelMode : null,
      encodedPolyline: route ? route.encodedPolyline : null,
      routeTarget: placeId && !isGeographic
        ? { kind: 'place', placeId, latitude: latitude ?? 0, longitude: longitude ?? 0 }
        : null,
      routeStatus,
      placeId,
      latitude,
      longitude,
      image: media?.status === 'stored' ? media.publicUrl : null,
      imageSource: media?.status === 'stored' && media.publicUrl ? 'google-place-photo' : 'none',
      imageAttributions: media?.attributions ?? [],
      address,
    };
  });

  return { places: out.filter(Boolean), stats };
}

/** Download a Place Photo once and persist it into MAPCO's global registry. */
async function fetchAndStorePhoto(
  placeId: string,
  photoName: string,
  details: { photoAttributions: string[]; photoWidthPx: number | null; photoHeightPx: number | null; displayName: string; latitude: number; longitude: number; formattedAddress: string | null },
  deps: EnrichDeps,
  stats: EnrichStats,
): Promise<PlaceMedia> {
  deps.ledger.record('place_photo', 1, { detail: placeId });
  let bytes: { bytes: Uint8Array; mimeType: string } | null = null;
  try {
    bytes = await deps.places.photoBytes(photoName, {
      maxWidthPx: PHOTO_MAX_WIDTH_PX, signal: deps.signal,
    });
  } catch (error) {
    deps.log?.('warn', 'pi.enrich.photoFailed', { placeId, error: (error as Error).message });
  }

  if (!bytes) {
    stats.photosUnavailable++;
    return deps.store.putPlaceMedia({
      placeId, googlePhotoName: photoName, source: 'GOOGLE_PLACE_PHOTO',
      storagePath: null, publicUrl: null, mimeType: null,
      widthPx: null, heightPx: null,
      attributions: details.photoAttributions ?? [],
      retrievedAt: deps.now(), status: 'unavailable',
    });
  }

  const stored = await deps.store.storePhoto(placeId, bytes.bytes, bytes.mimeType);
  if (!stored) {
    stats.photosUnavailable++;
    return deps.store.putPlaceMedia({
      placeId, googlePhotoName: photoName, source: 'GOOGLE_PLACE_PHOTO',
      storagePath: null, publicUrl: null, mimeType: bytes.mimeType,
      widthPx: null, heightPx: null,
      attributions: details.photoAttributions ?? [],
      retrievedAt: deps.now(), status: 'unavailable',
    });
  }

  stats.photosFetched++;
  return deps.store.putPlaceMedia({
    placeId,
    googlePhotoName: photoName,
    source: 'GOOGLE_PLACE_PHOTO',
    storagePath: stored.storagePath,
    publicUrl: stored.publicUrl,
    mimeType: bytes.mimeType,
    widthPx: details.photoWidthPx,
    heightPx: details.photoHeightPx,
    attributions: details.photoAttributions ?? [],
    retrievedAt: deps.now(),
    status: 'stored',
    displayName: details.displayName,
    latitude: details.latitude,
    longitude: details.longitude,
    address: details.formattedAddress,
  } as PlaceMedia);
}
