/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · pure geometry + formatting
   Runtime-neutral. Mirrors the well-tested primitives in Earth's
   road-network.ts (metersBetween / nearestOnPath) but with no Vite
   import.meta.glob dependency, so it runs on Node and Deno too.
   ═══════════════════════════════════════════════════════════════ */
import type { GeoPoint } from './types.ts';

const R = 6371000;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function metersBetween(a: GeoPoint, b: GeoPoint): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function project(point: GeoPoint, reference: GeoPoint): { x: number; y: number } {
  return {
    x: rad(point.longitude - reference.longitude) * R * Math.cos(rad(reference.latitude)),
    y: rad(point.latitude - reference.latitude) * R,
  };
}

function unproject(x: number, y: number, reference: GeoPoint): GeoPoint {
  return {
    latitude: reference.latitude + (y / R) * (180 / Math.PI),
    longitude: reference.longitude + (x / (R * Math.cos(rad(reference.latitude)))) * (180 / Math.PI),
  };
}

/** Nearest point on a polyline to `point`, on a local tangent plane. */
export function nearestOnPath(point: GeoPoint, path: readonly GeoPoint[]): { point: GeoPoint; meters: number } {
  if (!path.length) return { point, meters: Number.POSITIVE_INFINITY };
  if (path.length === 1) return { point: path[0]!, meters: metersBetween(point, path[0]!) };
  const origin = project(point, point);
  let best = { point: path[0]!, meters: Number.POSITIVE_INFINITY };
  for (let i = 0; i < path.length - 1; i++) {
    const a = project(path[i]!, point);
    const b = project(path[i + 1]!, point);
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lengthSquared = vx * vx + vy * vy;
    const rawT = lengthSquared === 0 ? 0 : ((origin.x - a.x) * vx + (origin.y - a.y) * vy) / lengthSquared;
    const t = Math.max(0, Math.min(1, rawT));
    const candidate = unproject(a.x + t * vx, a.y + t * vy, point);
    const meters = metersBetween(point, candidate);
    if (meters < best.meters) best = { point: candidate, meters };
  }
  return best;
}

/** "0.4 km" / "1.2 km" / "820 m". Distances below 1 km show metres so a very
 *  close place never reads as "0.0 km". */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 950) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** "6 min" / "1 hr 4 min". Always at least "1 min" for a real route. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}
