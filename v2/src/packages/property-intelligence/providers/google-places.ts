/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Google Places (New) resolver
   ---------------------------------------------------------------
   Resolves a Gemini-selected place NAME to a canonical Google Place:
   stable placeId + display name + coordinate + primary type. This is
   the task's "resolve/normalize only the final destinations" step —
   the cheapest reliable path to a routable, verifiable identity.
   Server-key only (never the browser). Prefers stable place ids.
   ═══════════════════════════════════════════════════════════════ */
import type { GeoResolver, GeoPoint, ResolvedDestination } from '../types.ts';
import { metersBetween } from '../geo.ts';

export interface GooglePlacesConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Location-bias radius in metres (default 25 km — Tri-City scale). */
  biasRadiusMeters?: number;
  /** Hard reject anything farther than this from the property (default 80 km). */
  maxDistanceMeters?: number;
  regionCode?: string;
}

interface PlacesResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    primaryType?: string;
    types?: string[];
  }>;
}

export class GooglePlacesResolver implements GeoResolver {
  private readonly cfg: GooglePlacesConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: GooglePlacesConfig) {
    this.cfg = cfg;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async resolvePlace(
    name: string,
    near: GeoPoint,
    opts: { includedType?: string; signal?: AbortSignal } = {},
  ): Promise<ResolvedDestination | null> {
    const query = name.trim();
    if (!query) return null;
    const radius = this.cfg.biasRadiusMeters ?? 25000;
    const body: Record<string, unknown> = {
      textQuery: query,
      locationBias: { circle: { center: { latitude: near.latitude, longitude: near.longitude }, radius } },
      maxResultCount: 3,
      regionCode: this.cfg.regionCode ?? 'IN',
      ...(opts.includedType ? { includedType: opts.includedType } : {}),
    };
    const res = await this.fetchImpl('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': this.cfg.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.types',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null) as PlacesResponse | null;
    const maxDistance = this.cfg.maxDistanceMeters ?? 80000;

    // Choose the nearest genuine match within the distance ceiling.
    let best: ResolvedDestination | null = null;
    let bestMeters = Infinity;
    for (const p of json?.places ?? []) {
      const lat = p.location?.latitude;
      const lng = p.location?.longitude;
      if (!p.id || typeof lat !== 'number' || typeof lng !== 'number') continue;
      const meters = metersBetween(near, { latitude: lat, longitude: lng });
      if (meters > maxDistance) continue;
      if (meters < bestMeters) {
        bestMeters = meters;
        best = {
          kind: 'place',
          placeId: p.id,
          name: p.displayName?.text?.trim() || query,
          latitude: lat,
          longitude: lng,
          primaryType: p.primaryType,
        };
      }
    }
    return best;
  }
}
