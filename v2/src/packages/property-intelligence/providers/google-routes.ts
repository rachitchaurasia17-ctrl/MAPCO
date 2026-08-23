/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Google Routes client
   ---------------------------------------------------------------
   Real road distances + drivable route geometry. Two calls only:
     • computeRouteMatrix — one origin × up to 12 destinations, the
       single batched request that fills every row's road distance.
     • computeRoutes      — one detailed route (encoded polyline) drawn
       when the dealer clicks a destination.
   Live-verified shapes (2026-08): matrix wraps points as
   {waypoint:{placeId|location.latLng}}, computeRoutes uses the point
   DIRECTLY as origin/destination (no waypoint wrapper).
   ═══════════════════════════════════════════════════════════════ */
import type {
  RouteMatrixClient, RouteClient, RoutePoint, MatrixElement, RouteLine,
} from '../types.ts';

export interface GoogleRoutesConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
  travelMode?: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TWO_WHEELER';
}

function waypoint(p: RoutePoint): Record<string, unknown> {
  if (p.placeId) return { placeId: p.placeId };
  return { location: { latLng: { latitude: p.latitude, longitude: p.longitude } } };
}

/** "855s" → 855. */
function parseDuration(value: unknown): number {
  const m = String(value ?? '').match(/([\d.]+)s/);
  return m ? Math.round(parseFloat(m[1]!)) : 0;
}

export class GoogleRoutesClient implements RouteMatrixClient, RouteClient {
  private readonly cfg: GoogleRoutesConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly travelMode: string;

  constructor(cfg: GoogleRoutesConfig) {
    this.cfg = cfg;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.travelMode = cfg.travelMode ?? 'DRIVE';
  }

  async computeMatrix(
    origin: RoutePoint,
    destinations: RoutePoint[],
    opts: { signal?: AbortSignal } = {},
  ): Promise<MatrixElement[]> {
    const result: MatrixElement[] = destinations.map(() => ({ ok: false, distanceMeters: 0, durationSeconds: 0 }));
    if (!destinations.length) return result;
    const body = {
      origins: [{ waypoint: waypoint(origin) }],
      destinations: destinations.map((d) => ({ waypoint: waypoint(d) })),
      travelMode: this.travelMode,
    };
    const res = await this.fetchImpl('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': this.cfg.apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,condition',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) throw new RoutesError(`matrix_http_${res.status}`, (await res.text().catch(() => '')).slice(0, 200));
    // computeRouteMatrix streams a JSON array of elements.
    const rows = await res.json().catch(() => null) as Array<{
      destinationIndex?: number; distanceMeters?: number; duration?: string; condition?: string;
    }> | null;
    for (const row of Array.isArray(rows) ? rows : []) {
      const idx = row.destinationIndex ?? -1;
      if (idx < 0 || idx >= result.length) continue;
      const ok = row.condition === 'ROUTE_EXISTS' && typeof row.distanceMeters === 'number';
      result[idx] = {
        ok,
        distanceMeters: ok ? row.distanceMeters! : 0,
        durationSeconds: ok ? parseDuration(row.duration) : 0,
      };
    }
    return result;
  }

  async computeRoute(
    origin: RoutePoint,
    destination: RoutePoint,
    opts: { signal?: AbortSignal } = {},
  ): Promise<RouteLine | null> {
    const body = {
      origin: waypoint(origin),
      destination: waypoint(destination),
      travelMode: this.travelMode,
      polylineEncoding: 'ENCODED_POLYLINE',
    };
    const res = await this.fetchImpl('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': this.cfg.apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null) as {
      routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }>;
    } | null;
    const route = json?.routes?.[0];
    if (!route?.polyline?.encodedPolyline || typeof route.distanceMeters !== 'number') return null;
    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: parseDuration(route.duration),
      encodedPolyline: route.polyline.encodedPolyline,
    };
  }
}

export class RoutesError extends Error {
  constructor(readonly code: string, readonly detail?: string) {
    super(code);
    this.name = 'RoutesError';
  }
}
