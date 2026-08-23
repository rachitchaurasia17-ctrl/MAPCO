/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · road matching
   ---------------------------------------------------------------
   A City Reach pick can be a ROAD ("Airport Road", "PR-7"). Roads have
   no single POI point, so we resolve them against MAPCO's own 29
   authoritative road GeoJSONs (the same source Earth ranks), taking the
   nearest point on the real geometry as the routing access point. This
   is the task's instruction: inspect MAPCO road geometry BEFORE forcing
   a road through a POI lookup.
   ═══════════════════════════════════════════════════════════════ */
import type { GeoPoint, RoadGeometry, ResolvedDestination } from './types.ts';
import { nearestOnPath } from './geo.ts';

/** Loose token key: lowercase, drop punctuation, collapse "road/marg/path". */
function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t && !STOPWORDS.has(t)),
  );
}

const STOPWORDS = new Set(['road', 'rd', 'marg', 'path', 'the', 'to', 'and', 'nagar', 'main']);

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits++;
  return hits / Math.min(a.size, b.size);
}

/** Best MAPCO road whose name/aliases match `name`, or null. Requires a
 *  meaningful token overlap so a random string never matches a road. */
export function matchRoad(name: string, roads: readonly RoadGeometry[]): RoadGeometry | null {
  const want = tokens(name);
  if (!want.size) return null;
  let best: { road: RoadGeometry; score: number } | null = null;
  for (const road of roads) {
    const candidates = [road.name, ...road.aliases];
    let score = 0;
    for (const c of candidates) score = Math.max(score, overlap(want, tokens(c)));
    if (score >= 0.6 && (!best || score > best.score)) best = { road, score };
  }
  return best?.road ?? null;
}

/** Resolve a road pick to a routing access point on MAPCO geometry. */
export function resolveRoad(
  name: string,
  near: GeoPoint,
  roads: readonly RoadGeometry[],
): ResolvedDestination | null {
  const road = matchRoad(name, roads);
  if (!road || road.path.length < 2) return null;
  const nearest = nearestOnPath(near, road.path);
  if (!Number.isFinite(nearest.meters)) return null;
  return {
    kind: 'road',
    name: road.name,
    latitude: nearest.point.latitude,
    longitude: nearest.point.longitude,
  };
}
