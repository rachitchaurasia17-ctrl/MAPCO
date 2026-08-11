/* ═══════════════════════════════════════════════════════════════
   MAPCO EARTH — Routes provider (Google Routes API, REST)
   ---------------------------------------------------------------
   Reserved for genuinely live, on-demand point-to-point routing.
   MAPCO road identity, geometry, proximity and visualization come only
   from MAPCO-owned GeoJSON and never call this provider.

   Requires the "Routes API" enabled on the Google Cloud project.
   If it is disabled/unauthorized we NEVER fabricate a route: matrix
   falls back to honest aerial (straight-line) distance with no drive
   time, and computeRoute returns null (no polyline drawn).

   The key is the same VITE_GOOGLE_MAPS_API_KEY used by the map.
   ═══════════════════════════════════════════════════════════════ */
import { GOOGLE_MAPS_API_KEY } from '../../packages/maps/google-loader';
import type { LatLng } from './config';

const BASE = 'https://routes.googleapis.com';

export interface RouteLeg {
  distanceMeters: number;
  durationSec: number | null;
  path: LatLng[]; // decoded polyline (empty for matrix results)
}
export interface MatrixCell {
  distanceMeters: number;
  durationSec: number | null;
  aerial: boolean; // true → straight-line fallback (Routes API unavailable)
}

/** Tracks whether the Routes API appears usable, so callers can surface
 *  a one-time "enable Routes API" note without spamming. */
let routesApiDisabled = false;
export function isRoutesApiDisabled(): boolean { return routesApiDisabled; }

function ll(p: LatLng) { return { latLng: { latitude: p.lat, longitude: p.lng } }; }

function parseDuration(d: unknown): number | null {
  if (typeof d !== 'string') return null;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(d.trim());
  return m ? Math.round(parseFloat(m[1])) : null;
}

/** Haversine straight-line distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Drive distance + time from one origin to many destinations (one call). */
export async function computeRouteMatrix(origin: LatLng, dests: LatLng[]): Promise<MatrixCell[]> {
  const fallback = (): MatrixCell[] =>
    dests.map((d) => ({ distanceMeters: haversineMeters(origin, d), durationSec: null, aerial: true }));

  if (!GOOGLE_MAPS_API_KEY || routesApiDisabled || dests.length === 0) return fallback();

  try {
    const res = await fetch(`${BASE}/distanceMatrix/v2:computeRouteMatrix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,condition',
      },
      body: JSON.stringify({
        origins: [{ waypoint: { location: ll(origin) } }],
        destinations: dests.map((d) => ({ waypoint: { location: ll(d) } })),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) routesApiDisabled = true;
      return fallback();
    }
    const rows = (await res.json()) as Array<{
      destinationIndex: number; distanceMeters?: number; duration?: string; condition?: string;
    }>;
    const out: MatrixCell[] = dests.map((d) => ({ distanceMeters: haversineMeters(origin, d), durationSec: null, aerial: true }));
    for (const r of rows) {
      const i = r.destinationIndex;
      if (i == null || i < 0 || i >= out.length) continue;
      if (r.condition === 'ROUTE_EXISTS' && typeof r.distanceMeters === 'number') {
        out[i] = { distanceMeters: r.distanceMeters, durationSec: parseDuration(r.duration), aerial: false };
      }
    }
    return out;
  } catch {
    return fallback();
  }
}

/** Road-following route (polyline + distance + time) for the active advantage. */
export async function computeRoute(origin: LatLng, dest: LatLng): Promise<RouteLeg | null> {
  if (!GOOGLE_MAPS_API_KEY || routesApiDisabled) return null;
  try {
    const res = await fetch(`${BASE}/directions/v2:computeRoutes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: ll(origin) },
        destination: { location: ll(dest) },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        polylineEncoding: 'ENCODED_POLYLINE',
      }),
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) routesApiDisabled = true;
      return null;
    }
    const data = (await res.json()) as {
      routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }>;
    };
    const r = data.routes?.[0];
    if (!r || !r.polyline?.encodedPolyline) return null;
    return {
      distanceMeters: r.distanceMeters ?? 0,
      durationSec: parseDuration(r.duration),
      path: decodePolyline(r.polyline.encodedPolyline),
    };
  } catch {
    return null;
  }
}

/** Decode a Google encoded polyline into lat/lng points (no library needed). */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let result = 0, shift = 0, b: number;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/* ── Human-friendly formatting ─────────────────────────────────── */
export function formatDistance(m: number): string {
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} km`;
}
export function formatDuration(sec: number | null): string | null {
  if (sec == null) return null;
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const mm = min % 60;
  return mm ? `${h} h ${mm} min` : `${h} h`;
}
