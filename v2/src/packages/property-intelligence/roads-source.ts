/* Pure parser: raw road GeoJSON (one LineString FeatureCollection per file)
   → RoadGeometry. Runtime-neutral (no fs). The Vite dev middleware and the
   Edge function both feed file contents through this so road identity and
   geometry are derived identically on every runtime. */
import type { GeoPoint, RoadGeometry } from './types.ts';

function titleToken(token: string): string {
  if (/^(nh|pr|sh|it)$/i.test(token)) return token.toUpperCase();
  if (/^[a-z]{1,3}-?\d+[a-z]?$/i.test(token)) return token.toUpperCase();
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function titleCaseRoad(stem: string): string {
  const routeCode = /^(nh|sh|pr)[-_\s]*([0-9]+[a-z]?)$/i.exec(stem.trim());
  if (routeCode) return `${routeCode[1]!.toUpperCase()}-${routeCode[2]!.toUpperCase()}`;
  return stem.split(/[-_\s]+/).filter(Boolean).map(titleToken).join(' ');
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

/** Parse one road file's raw JSON into a RoadGeometry, or null if invalid.
 *  `filename` supplies the id + a title-cased name fallback. */
export function parseRoadFeatureCollection(raw: string, filename: string): RoadGeometry | null {
  let data: any;
  try { data = JSON.parse(raw); } catch { return null; }
  const feature = data?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (feature?.geometry?.type !== 'LineString' || !Array.isArray(coords)) return null;
  const path: GeoPoint[] = [];
  for (const c of coords) {
    if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
      path.push({ latitude: c[1], longitude: c[0] });
    }
  }
  if (path.length < 2) return null;
  const stem = filename.replace(/^.*[\\/]/, '').replace(/\.geojson$/i, '');
  const props = feature.properties ?? {};
  const name = (typeof props.name === 'string' && props.name.trim()) ? props.name.trim() : titleCaseRoad(stem);
  const aliases = toStringList(props.aliases);
  // The raw filename stem is itself a useful matching alias.
  if (!aliases.includes(stem)) aliases.push(stem);
  return { id: stem, name, aliases, path };
}
