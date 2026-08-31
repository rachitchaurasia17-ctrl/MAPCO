/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Google Routes client
   ---------------------------------------------------------------
   ONE operation: computeRoutes from the property's canonical coordinate
   to one destination, returning the three things a card needs —
   distanceMeters, duration and the encoded road polyline.

   Deliberately Essentials-tier: no routingPreference, no traffic-aware
   routing, no traffic-coloured polylines. MAPCO does not need live
   traffic for "how far is the school", and those options move the call
   to a materially more expensive SKU.

   The value this returns is the ONLY distance MAPCO ever displays. The
   Phase 1 approximate proximity is a discovery signal and never reaches
   a card.

   Server-key only. This module must never be imported by browser code.
   ═══════════════════════════════════════════════════════════════ */
import type { GeoPoint, RoutesPort } from '../types.ts';

export interface GoogleRoutesConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Default travel mode when a call does not specify one. */
  travelMode?: 'DRIVE' | 'WALK';
  regionCode?: string;
}

export class RoutesError extends Error {
  readonly code: string;
  readonly detail?: string;
  constructor(code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'RoutesError';
    this.code = code;
    this.detail = detail;
  }
}

/** "855s" → 855. */
function parseDuration(value: unknown): number {
  const match = String(value ?? '').match(/([\d.]+)s/);
  return match ? Math.round(parseFloat(match[1]!)) : 0;
}

interface ComputeRoutesResponse {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }>;
}

export class GoogleRoutesClient implements RoutesPort {
  private readonly cfg: GoogleRoutesConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: GoogleRoutesConfig) {
    this.cfg = cfg;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async computeRoute(
    origin: GeoPoint,
    destination: { placeId?: string; latitude: number; longitude: number },
    opts: { travelMode?: 'DRIVE' | 'WALK'; signal?: AbortSignal } = {},
  ): Promise<{ distanceMeters: number; durationSeconds: number; encodedPolyline: string } | null> {
    // A stable place id routes to the place's own entrance; a raw
    // coordinate is the fallback when identity was never resolved.
    const destinationPoint = destination.placeId
      ? { placeId: destination.placeId }
      : {
        location: {
          latLng: { latitude: destination.latitude, longitude: destination.longitude },
        },
      };

    const body = {
      origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
      destination: destinationPoint,
      travelMode: opts.travelMode ?? this.cfg.travelMode ?? 'DRIVE',
      polylineEncoding: 'ENCODED_POLYLINE',
      ...(this.cfg.regionCode ? { regionCode: this.cfg.regionCode } : {}),
    };

    const res = await this.fetchImpl('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': this.cfg.apiKey,
        // Exactly the three fields a card needs. A wider mask would raise
        // the SKU tier without adding anything MAPCO displays.
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!res.ok) {
      // A failed route is a truthful "unavailable" on the card, never a
      // fallback to the Phase 1 approximate distance.
      return null;
    }

    const json = await res.json().catch(() => null) as ComputeRoutesResponse | null;
    const route = json?.routes?.[0];
    if (!route?.polyline?.encodedPolyline || typeof route.distanceMeters !== 'number') {
      return null;
    }
    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: parseDuration(route.duration),
      encodedPolyline: route.polyline.encodedPolyline,
    };
  }
}
