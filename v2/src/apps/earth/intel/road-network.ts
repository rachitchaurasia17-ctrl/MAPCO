/* MAPCO ROAD NETWORK
   ------------------
   One road is one authoritative GeoJSON file in src/apps/earth/data/roads/. Vite discovers
   the files at build time; this module parses them once, preserves their source
   coordinates, derives a small spatial index, and ranks roads locally. No Google
   API participates in road ingestion, proximity, selection, or visualization. */

import type { LatLng } from '../config';
import {
  ROAD_CATALOG,
  type RoadCatalogEntry,
  type RoadClass,
  type RoadRole,
} from './road-catalog';

export type { RoadClass, RoadRole };

export type GeoPosition = readonly [longitude: number, latitude: number, ...altitude: number[]];

export interface RoadBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface RoadSpec {
  id: string;
  name: string;
  aliases: string[];
  role: RoadRole;
  roadClass: RoadClass;
  importance: number;
  connectivity: number;
  connects: string;
  stories: string[];
  sourceFile: string;
  /** The untouched coordinate tuples parsed from the source GeoJSON. */
  coordinates: GeoPosition[];
  /** Google LatLng representation of the same longitude/latitude values. */
  path: LatLng[];
  bounds: RoadBounds;
  lengthMeters: number;
  corridor: string;
}

export interface SelectedRoad {
  spec: RoadSpec;
  path: LatLng[];
  accessPoint: LatLng;
  accessMeters: number;
  score: number;
  relation: 'direct' | 'connected';
  graphHops: number;
  networkMeters: number;
  tier: 'primary' | 'secondary' | 'tertiary';
}

export interface RoadGraphEdge {
  roadId: string;
  junction: LatLng;
  selfAlongMeters: number;
  otherAlongMeters: number;
  gapMeters: number;
}

export type RoadGraph = ReadonlyMap<string, readonly RoadGraphEdge[]>;

export interface RoadRankingDiagnostic {
  roadId: string;
  roadName: string;
  accessMeters: number;
  relation: 'direct' | 'connected' | 'irrelevant';
  roadClass: RoadClass;
  importance: number;
  graphHops: number | null;
  networkMeters: number | null;
  score: number;
  selected: boolean;
  reason: string;
}

export interface RoadLoadFailure {
  sourceFile: string;
  reason: string;
}

export interface RoadLoadResult {
  roads: RoadSpec[];
  failures: RoadLoadFailure[];
  files: RoadFileDiagnostic[];
  discoveredCount: number;
  parsedCount: number;
  validCount: number;
  registeredCount: number;
}

export interface RoadFileDiagnostic {
  sourceFile: string;
  discovered: true;
  parsed: boolean;
  valid: boolean;
  registered: boolean;
  eligibleForRanking: boolean;
  renderable: boolean;
  roadId?: string;
  roadName?: string;
  reason?: string;
}

interface GeoJsonProperties {
  id?: unknown;
  name?: unknown;
  aliases?: unknown;
  role?: unknown;
  class?: unknown;
  roadClass?: unknown;
  road_class?: unknown;
  importance?: unknown;
  connectivity?: unknown;
  connects?: unknown;
  stories?: unknown;
}

interface LineStringFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties?: GeoJsonProperties | null;
    geometry?: { type: string; coordinates?: unknown } | null;
  }>;
}

const CLASS_DEFAULTS: Record<RoadClass, { importance: number; connectivity: number }> = {
  'major-arterial': { importance: 0.9, connectivity: 0.9 },
  'regional-corridor': { importance: 0.84, connectivity: 0.9 },
  'city-connector': { importance: 0.7, connectivity: 0.72 },
  'sector-access': { importance: 0.58, connectivity: 0.52 },
  'ordinary-connector': { importance: 0.46, connectivity: 0.42 },
};

const ROLE_WEIGHT: Record<string, Record<RoadRole, number>> = {
  residential: { access: 1, arterial: 0.95, city: 0.92, airport: 0.84, connector: 0.82, regional: 0.74 },
  commercial: { arterial: 1, regional: 0.98, city: 0.95, airport: 0.92, access: 0.9, connector: 0.8 },
  investment: { arterial: 1, airport: 1, regional: 0.98, city: 0.9, access: 0.86, connector: 0.78 },
  rental: { access: 1, city: 0.95, arterial: 0.94, connector: 0.86, airport: 0.76, regional: 0.7 },
};

const VALID_ROLES = new Set<RoadRole>(['access', 'arterial', 'airport', 'city', 'regional', 'connector']);
const VALID_CLASSES = new Set<RoadClass>(['major-arterial', 'regional-corridor', 'city-connector', 'sector-access', 'ordinary-connector']);
const R = 6371000;
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function metersBetween(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function project(point: LatLng, reference: LatLng): { x: number; y: number } {
  return {
    x: rad(point.lng - reference.lng) * R * Math.cos(rad(reference.lat)),
    y: rad(point.lat - reference.lat) * R,
  };
}

function unproject(x: number, y: number, reference: LatLng): LatLng {
  return {
    lat: reference.lat + (y / R) * (180 / Math.PI),
    lng: reference.lng + (x / (R * Math.cos(rad(reference.lat)))) * (180 / Math.PI),
  };
}

/** Nearest point on a LineString using a local tangent plane, with Haversine units. */
export function nearestOnPath(point: LatLng, path: readonly LatLng[]): { point: LatLng; meters: number; alongMeters: number } {
  if (!path.length) return { point, meters: Number.POSITIVE_INFINITY, alongMeters: 0 };
  if (path.length === 1) return { point: path[0], meters: metersBetween(point, path[0]), alongMeters: 0 };

  const origin = project(point, point);
  let traversedMeters = 0;
  let best = { point: path[0], meters: Number.POSITIVE_INFINITY, alongMeters: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const a = project(path[i], point);
    const b = project(path[i + 1], point);
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lengthSquared = vx * vx + vy * vy;
    const rawT = lengthSquared === 0 ? 0 : ((origin.x - a.x) * vx + (origin.y - a.y) * vy) / lengthSquared;
    const t = Math.max(0, Math.min(1, rawT));
    const x = a.x + t * vx;
    const y = a.y + t * vy;
    const candidate = unproject(x, y, point);
    const meters = metersBetween(point, candidate);
    const segmentMeters = metersBetween(path[i], path[i + 1]);
    if (meters < best.meters) best = { point: candidate, meters, alongMeters: traversedMeters + segmentMeters * t };
    traversedMeters += segmentMeters;
  }
  return best;
}

function pathLength(path: readonly LatLng[]): number {
  let meters = 0;
  for (let i = 0; i < path.length - 1; i++) meters += metersBetween(path[i], path[i + 1]);
  return meters;
}

function boundsFor(path: readonly LatLng[]): RoadBounds {
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const point of path) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }
  return { north, south, east, west };
}

function distanceToBounds(point: LatLng, bounds: RoadBounds): number {
  return metersBetween(point, {
    lat: Math.max(bounds.south, Math.min(bounds.north, point.lat)),
    lng: Math.max(bounds.west, Math.min(bounds.east, point.lng)),
  });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function listValue(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const strings = value.map(stringValue).filter((item): item is string => Boolean(item));
    return strings.length ? strings : undefined;
  }
  const single = stringValue(value);
  return single ? single.split(',').map((item) => item.trim()).filter(Boolean) : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : undefined;
}

export function stableRoadId(value: string): string {
  return value.toLowerCase().replace(/\.geojson$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function titleToken(token: string): string {
  if (/^(nh|pr|sh|it)$/i.test(token)) return token.toUpperCase();
  if (/^\d+[a-z]?$/i.test(token)) return token.toUpperCase();
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/** Human name fallback; explicit GeoJSON/catalog names always win. */
export function roadNameFromFilename(filename: string): string {
  const stem = filename.replace(/^.*[\\/]/, '').replace(/\.geojson$/i, '');
  const routeCode = /^(nh|sh|pr)[-_\s]*([0-9]+[a-z]?)$/i.exec(stem.trim());
  if (routeCode) return `${routeCode[1].toUpperCase()}-${routeCode[2].toUpperCase()}`;
  const tokens = stem.split(/[-_\s]+/).filter(Boolean);
  if (/^[^-\s]+-[^-\s]+-road$/i.test(stem) && tokens.length === 3) {
    return `${titleToken(tokens[0])}-${titleToken(tokens[1])} Road`;
  }
  return tokens.map(titleToken).join(' ');
}

function normalizeRole(value: unknown, fallback: RoadRole): RoadRole {
  const role = stringValue(value)?.toLowerCase() as RoadRole | undefined;
  return role && VALID_ROLES.has(role) ? role : fallback;
}

function normalizeClass(value: unknown, fallback: RoadClass): RoadClass {
  const roadClass = stringValue(value)?.toLowerCase().replace(/[_\s]+/g, '-') as RoadClass | undefined;
  return roadClass && VALID_CLASSES.has(roadClass) ? roadClass : fallback;
}

function roleForClass(roadClass: RoadClass): RoadRole {
  if (roadClass === 'major-arterial') return 'arterial';
  if (roadClass === 'regional-corridor') return 'regional';
  if (roadClass === 'city-connector') return 'city';
  if (roadClass === 'sector-access') return 'access';
  return 'connector';
}

function corridorFor(path: readonly LatLng[]): string {
  const start = path[0];
  const end = path[path.length - 1];
  const northSouth = Math.abs(end.lat - start.lat);
  const eastWest = Math.abs(end.lng - start.lng) * Math.cos(rad((start.lat + end.lat) / 2));
  if (northSouth > eastWest * 1.8) return 'north-south';
  if (eastWest > northSouth * 1.8) return 'east-west';
  return (end.lat - start.lat) * (end.lng - start.lng) >= 0 ? 'southwest-northeast' : 'northwest-southeast';
}

function parseCoordinates(value: unknown): { coordinates: GeoPosition[] | null; reason?: string } {
  if (!Array.isArray(value) || value.length < 2) {
    return { coordinates: null, reason: 'LineString must contain at least two positions' };
  }
  const coordinates: GeoPosition[] = [];
  for (let index = 0; index < value.length; index++) {
    const candidate = value[index];
    if (!Array.isArray(candidate) || candidate.length < 2 || !candidate.every((item) => typeof item === 'number' && Number.isFinite(item))) {
      return { coordinates: null, reason: `Position ${index} must contain finite numeric longitude and latitude values` };
    }
    const [lng, lat] = candidate;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return { coordinates: null, reason: `Position ${index} is outside valid longitude/latitude bounds` };
    }
    coordinates.push(candidate as unknown as GeoPosition);
  }
  return { coordinates };
}

interface RoadParseResult {
  parsed: boolean;
  road: RoadSpec | null;
  reason?: string;
}

function inspectRoadGeoJson(sourceFile: string, raw: string, catalog: Record<string, RoadCatalogEntry>): RoadParseResult {
  let data: LineStringFeatureCollection;
  try {
    data = JSON.parse(raw) as LineStringFeatureCollection;
  } catch {
    return { parsed: false, road: null, reason: 'Invalid JSON' };
  }
  if (data.type !== 'FeatureCollection') return { parsed: true, road: null, reason: 'Root type must be FeatureCollection' };
  if (!Array.isArray(data.features)) return { parsed: true, road: null, reason: 'FeatureCollection.features must be an array' };
  if (data.features.length !== 1) return { parsed: true, road: null, reason: `Expected exactly one road feature; found ${data.features.length}` };
  const feature = data.features[0];
  if (feature?.type !== 'Feature') return { parsed: true, road: null, reason: 'Entry must be a GeoJSON Feature' };
  if (!feature.geometry) return { parsed: true, road: null, reason: 'Feature geometry is missing' };
  if (feature.geometry.type !== 'LineString') return { parsed: true, road: null, reason: `Geometry type ${feature.geometry.type || '(missing)'} is not supported; expected LineString` };
  const parsedCoordinates = parseCoordinates(feature.geometry.coordinates);
  if (!parsedCoordinates.coordinates) return { parsed: true, road: null, reason: parsedCoordinates.reason };
  const coordinates = parsedCoordinates.coordinates;

  const filename = sourceFile.replace(/^.*[\\/]/, '');
  const fallbackId = stableRoadId(filename);
  if (!fallbackId) return { parsed: true, road: null, reason: 'Filename cannot produce a stable road id' };
  const properties = feature.properties ?? {};
  const catalogEntry = catalog[fallbackId] ?? {};
  const id = stableRoadId(stringValue(properties.id) ?? catalogEntry.id ?? fallbackId);
  const roadClass = normalizeClass(properties.roadClass ?? properties.road_class ?? properties.class, catalogEntry.roadClass ?? 'ordinary-connector');
  const role = normalizeRole(properties.role, catalogEntry.role ?? roleForClass(roadClass));
  const classDefaults = CLASS_DEFAULTS[roadClass];
  const path = coordinates.map(([lng, lat]) => ({ lat, lng }));
  const aliases = listValue(properties.aliases) ?? catalogEntry.aliases ?? [];
  const name = stringValue(properties.name) ?? catalogEntry.name ?? roadNameFromFilename(filename);
  const stories = listValue(properties.stories) ?? catalogEntry.stories ?? [`${role}:${corridorFor(path)}`];

  return { parsed: true, road: {
    id,
    name,
    aliases: [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))],
    role,
    roadClass,
    importance: numberValue(properties.importance) ?? catalogEntry.importance ?? classDefaults.importance,
    connectivity: numberValue(properties.connectivity) ?? catalogEntry.connectivity ?? classDefaults.connectivity,
    connects: stringValue(properties.connects) ?? catalogEntry.connects ?? name,
    stories: [...new Set(stories.map(stableRoadId).filter(Boolean))],
    sourceFile: filename,
    coordinates,
    path,
    bounds: boundsFor(path),
    lengthMeters: pathLength(path),
    corridor: corridorFor(path),
  } };
}

export function parseRoadGeoJson(sourceFile: string, raw: string, catalog: Record<string, RoadCatalogEntry> = ROAD_CATALOG): RoadSpec | null {
  return inspectRoadGeoJson(sourceFile, raw, catalog).road;
}

function identityKeys(road: RoadSpec): string[] {
  return [road.id, road.name, ...road.aliases].map(stableRoadId).filter(Boolean);
}

export function loadRoadsFromRawFiles(rawFiles: Record<string, string>, catalog: Record<string, RoadCatalogEntry> = ROAD_CATALOG): RoadLoadResult {
  const roads: RoadSpec[] = [];
  const failures: RoadLoadFailure[] = [];
  const files: RoadFileDiagnostic[] = [];
  const identities = new Set<string>();

  for (const sourceFile of Object.keys(rawFiles).sort()) {
    const inspected = inspectRoadGeoJson(sourceFile, rawFiles[sourceFile], catalog);
    const road = inspected.road;
    if (!road) {
      const reason = inspected.reason ?? 'Unknown GeoJSON validation error';
      failures.push({ sourceFile, reason });
      files.push({
        sourceFile, discovered: true, parsed: inspected.parsed, valid: false,
        registered: false, eligibleForRanking: false, renderable: false, reason,
      });
      continue;
    }
    const keys = identityKeys(road);
    if (keys.some((key) => identities.has(key))) {
      const reason = 'Duplicate road identity (id, name, or alias already registered)';
      failures.push({ sourceFile, reason });
      files.push({
        sourceFile, discovered: true, parsed: true, valid: true,
        registered: false, eligibleForRanking: false, renderable: false,
        roadId: road.id, roadName: road.name, reason,
      });
      continue;
    }
    keys.forEach((key) => identities.add(key));
    roads.push(road);
    files.push({
      sourceFile, discovered: true, parsed: true, valid: true,
      registered: true, eligibleForRanking: true, renderable: road.path.length >= 2,
      roadId: road.id, roadName: road.name,
    });
  }
  return {
    roads,
    failures,
    files,
    discoveredCount: Object.keys(rawFiles).length,
    parsedCount: files.filter((file) => file.parsed).length,
    validCount: files.filter((file) => file.valid).length,
    registeredCount: roads.length,
  };
}

/* Repo-controlled, deployable road data. These files are byte-identical copies
   of the authored set; the originals remain untouched outside the repo. The
   path MUST stay repo-relative so Vercel/CI can resolve it at build time. */
const rawRoadFiles = import.meta.glob('../data/roads/*.geojson', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const discovered = loadRoadsFromRawFiles(rawRoadFiles);
export const ROAD_LOAD_FAILURES = discovered.failures;
export const ROAD_FILE_DIAGNOSTICS = discovered.files;
export const ROAD_DIAGNOSTICS = {
  discovered: discovered.discoveredCount,
  parsed: discovered.validCount,
  valid: discovered.validCount,
  registered: discovered.registeredCount,
  rejected: discovered.failures.length,
};
export const ROAD_SPECS: RoadSpec[] = discovered.roads;

if (import.meta.env.DEV) {
  console.info(`[MAPCO Roads] Road GeoJSON files discovered: ${ROAD_DIAGNOSTICS.discovered}`);
  console.info(`[MAPCO Roads] Successfully parsed: ${ROAD_DIAGNOSTICS.parsed}`);
  console.info(`[MAPCO Roads] Registered: ${ROAD_DIAGNOSTICS.registered}`);
  console.info(`[MAPCO Roads] Rejected: ${ROAD_DIAGNOSTICS.rejected}`);
  console.table(ROAD_FILE_DIAGNOSTICS.map((file) => ({
    file: file.sourceFile.replace(/^.*[\\/]/, ''),
    discovered: file.discovered,
    parsed: file.parsed,
    valid: file.valid,
    registered: file.registered,
    eligibleForRanking: file.eligibleForRanking,
    renderable: file.renderable,
    name: file.roadName ?? '',
    reason: file.reason ?? '',
  })));
  for (const failure of ROAD_LOAD_FAILURES) {
    console.warn(`[MAPCO Roads] Rejected ${failure.sourceFile}: ${failure.reason}`);
  }
}

/* ── Connectivity graph (derived once from exact source geometry) ── */

const GRAPH_JOIN_TOLERANCE_METERS = 120;
const MAX_GRAPH_HOPS = 2;

const DIRECT_RANGE: Record<RoadClass, number> = {
  'major-arterial': 2200,
  'regional-corridor': 2400,
  'city-connector': 1600,
  'sector-access': 1200,
  'ordinary-connector': 900,
};

const CONNECTED_RANGE: Record<RoadClass, number> = {
  'major-arterial': 5200,
  'regional-corridor': 5500,
  'city-connector': 3800,
  'sector-access': 2500,
  'ordinary-connector': 1800,
};

interface XY { x: number; y: number; }
interface SegmentConnection {
  pointA: LatLng;
  pointB: LatLng;
  meters: number;
  alongA: number;
  alongB: number;
}

const cross = (a: XY, b: XY) => a.x * b.y - a.y * b.x;
const subtract = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
const addScaled = (a: XY, b: XY, t: number): XY => ({ x: a.x + b.x * t, y: a.y + b.y * t });
const distanceXY = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

function closestPointOnSegment(point: XY, a: XY, b: XY): { point: XY; t: number } {
  const direction = subtract(b, a);
  const lengthSquared = direction.x ** 2 + direction.y ** 2;
  const rawT = lengthSquared === 0 ? 0
    : ((point.x - a.x) * direction.x + (point.y - a.y) * direction.y) / lengthSquared;
  const t = Math.max(0, Math.min(1, rawT));
  return { point: addScaled(a, direction, t), t };
}

function closestSegmentPair(a0: LatLng, a1: LatLng, b0: LatLng, b1: LatLng): {
  pointA: LatLng; pointB: LatLng; meters: number; tA: number; tB: number;
} {
  const reference = {
    lat: (a0.lat + a1.lat + b0.lat + b1.lat) / 4,
    lng: (a0.lng + a1.lng + b0.lng + b1.lng) / 4,
  };
  const pa0 = project(a0, reference);
  const pa1 = project(a1, reference);
  const pb0 = project(b0, reference);
  const pb1 = project(b1, reference);
  const r = subtract(pa1, pa0);
  const s = subtract(pb1, pb0);
  const denominator = cross(r, s);
  const delta = subtract(pb0, pa0);

  if (Math.abs(denominator) > 1e-8) {
    const tA = cross(delta, s) / denominator;
    const tB = cross(delta, r) / denominator;
    if (tA >= 0 && tA <= 1 && tB >= 0 && tB <= 1) {
      const intersection = addScaled(pa0, r, tA);
      const point = unproject(intersection.x, intersection.y, reference);
      return { pointA: point, pointB: point, meters: 0, tA, tB };
    }
  }

  const options: Array<{ a: XY; b: XY; tA: number; tB: number }> = [];
  const a0ToB = closestPointOnSegment(pa0, pb0, pb1);
  options.push({ a: pa0, b: a0ToB.point, tA: 0, tB: a0ToB.t });
  const a1ToB = closestPointOnSegment(pa1, pb0, pb1);
  options.push({ a: pa1, b: a1ToB.point, tA: 1, tB: a1ToB.t });
  const b0ToA = closestPointOnSegment(pb0, pa0, pa1);
  options.push({ a: b0ToA.point, b: pb0, tA: b0ToA.t, tB: 0 });
  const b1ToA = closestPointOnSegment(pb1, pa0, pa1);
  options.push({ a: b1ToA.point, b: pb1, tA: b1ToA.t, tB: 1 });
  options.sort((left, right) => distanceXY(left.a, left.b) - distanceXY(right.a, right.b));
  const best = options[0];
  return {
    pointA: unproject(best.a.x, best.a.y, reference),
    pointB: unproject(best.b.x, best.b.y, reference),
    meters: distanceXY(best.a, best.b),
    tA: best.tA,
    tB: best.tB,
  };
}

function expandedBoundsOverlap(a: RoadBounds, b: RoadBounds, toleranceMeters: number): boolean {
  const middleLat = (a.north + a.south + b.north + b.south) / 4;
  const latPad = toleranceMeters / 111320;
  const lngPad = toleranceMeters / (111320 * Math.max(0.2, Math.cos(rad(middleLat))));
  return !(a.east + lngPad < b.west || b.east + lngPad < a.west
    || a.north + latPad < b.south || b.north + latPad < a.south);
}

function prefixLengths(path: readonly LatLng[]): number[] {
  const prefix = [0];
  for (let index = 0; index < path.length - 1; index++) {
    prefix.push(prefix[index] + metersBetween(path[index], path[index + 1]));
  }
  return prefix;
}

function connectionBetween(a: RoadSpec, b: RoadSpec, toleranceMeters: number): SegmentConnection | null {
  if (!expandedBoundsOverlap(a.bounds, b.bounds, toleranceMeters)) return null;
  const prefixA = prefixLengths(a.path);
  const prefixB = prefixLengths(b.path);
  let best: SegmentConnection | null = null;
  for (let ai = 0; ai < a.path.length - 1; ai++) {
    for (let bi = 0; bi < b.path.length - 1; bi++) {
      const pair = closestSegmentPair(a.path[ai], a.path[ai + 1], b.path[bi], b.path[bi + 1]);
      if (pair.meters > toleranceMeters || (best && pair.meters >= best.meters)) continue;
      best = {
        pointA: pair.pointA,
        pointB: pair.pointB,
        meters: pair.meters,
        alongA: prefixA[ai] + metersBetween(a.path[ai], a.path[ai + 1]) * pair.tA,
        alongB: prefixB[bi] + metersBetween(b.path[bi], b.path[bi + 1]) * pair.tB,
      };
    }
  }
  return best;
}

/** Lightweight road-to-road graph; bbox overlap only prefilters exact segment checks. */
export function buildRoadGraph(roads: readonly RoadSpec[], toleranceMeters = GRAPH_JOIN_TOLERANCE_METERS): RoadGraph {
  const graph = new Map<string, RoadGraphEdge[]>();
  roads.forEach((road) => graph.set(road.id, []));
  for (let left = 0; left < roads.length; left++) {
    for (let right = left + 1; right < roads.length; right++) {
      const a = roads[left];
      const b = roads[right];
      const connection = connectionBetween(a, b, toleranceMeters);
      if (!connection) continue;
      const junction = {
        lat: (connection.pointA.lat + connection.pointB.lat) / 2,
        lng: (connection.pointA.lng + connection.pointB.lng) / 2,
      };
      graph.get(a.id)!.push({
        roadId: b.id, junction, selfAlongMeters: connection.alongA,
        otherAlongMeters: connection.alongB, gapMeters: connection.meters,
      });
      graph.get(b.id)!.push({
        roadId: a.id, junction, selfAlongMeters: connection.alongB,
        otherAlongMeters: connection.alongA, gapMeters: connection.meters,
      });
    }
  }
  return graph;
}

export const ROAD_GRAPH = buildRoadGraph(ROAD_SPECS);

interface ReachState {
  relation: 'direct' | 'connected';
  hops: number;
  networkMeters: number;
  entryAlongMeters: number;
}

interface RankedCandidate extends SelectedRoad {
  adjustedScore?: number;
}

function connectedReach(
  roads: readonly RoadSpec[],
  graph: RoadGraph,
  access: ReadonlyMap<string, ReturnType<typeof nearestOnPath>>,
): Map<string, ReachState> {
  const byId = new Map(roads.map((road) => [road.id, road]));
  const reached = new Map<string, ReachState>();
  const queue: Array<{ roadId: string; state: ReachState }> = [];

  for (const road of roads) {
    const nearest = access.get(road.id)!;
    if (nearest.meters > DIRECT_RANGE[road.roadClass]) continue;
    const state: ReachState = {
      relation: 'direct', hops: 0, networkMeters: nearest.meters,
      entryAlongMeters: nearest.alongMeters,
    };
    reached.set(road.id, state);
    queue.push({ roadId: road.id, state });
  }

  while (queue.length) {
    queue.sort((a, b) => a.state.networkMeters - b.state.networkMeters);
    const current = queue.shift()!;
    if (reached.get(current.roadId) !== current.state || current.state.hops >= MAX_GRAPH_HOPS) continue;
    for (const edge of graph.get(current.roadId) ?? []) {
      const target = byId.get(edge.roadId);
      if (!target) continue;
      const hops = current.state.hops + 1;
      const networkMeters = current.state.networkMeters
        + Math.abs(edge.selfAlongMeters - current.state.entryAlongMeters)
        + edge.gapMeters;
      if (networkMeters > CONNECTED_RANGE[target.roadClass]) continue;
      const previous = reached.get(target.id);
      if (previous?.relation === 'direct' || (previous && previous.networkMeters <= networkMeters)) continue;
      const state: ReachState = {
        relation: 'connected', hops, networkMeters,
        entryAlongMeters: edge.otherAlongMeters,
      };
      reached.set(target.id, state);
      queue.push({ roadId: target.id, state });
    }
  }
  return reached;
}

export function scoreRoad(
  road: RoadSpec,
  accessMeters: number,
  intent: string,
  relation: 'direct' | 'connected' = 'direct',
  networkMeters = accessMeters,
  graphHops = 0,
  graphDegree = 0,
): number {
  const roleWeight = (ROLE_WEIGHT[intent] ?? ROLE_WEIGHT.residential)[road.role] ?? 0.75;
  const classWeight = CLASS_DEFAULTS[road.roadClass].importance;
  const range = relation === 'direct' ? DIRECT_RANGE[road.roadClass] : CONNECTED_RANGE[road.roadClass];
  const relevantMeters = relation === 'direct' ? accessMeters : networkMeters;
  const reachWeight = Math.exp(-relevantMeters / (range * 0.72));
  const centrality = Math.min(1, graphDegree / 5);
  return clamp01(
    road.importance * 0.22
    + classWeight * 0.14
    + road.connectivity * 0.14
    + roleWeight * 0.18
    + centrality * 0.07
    + reachWeight * 0.25
    // A graph connection is EVIDENCE of connectivity, not proof the road
    // belongs in a client-facing set. Each hop away from the property costs
    // real relevance, so a two-hop road must be genuinely excellent to survive.
    + (relation === 'direct' ? 0.04 : -HOP_PENALTY * graphHops),
  );
}

/** Relevance lost per graph hop. */
const HOP_PENALTY = 0.11;

/**
 * Minimum score a road must reach to be shown, by how far it sits from the
 * property in the network. Direct roads are judged generously; a two-hop
 * road faces a much harder bar and normally disappears.
 */
function acceptanceFloor(relation: 'direct' | 'connected', hops: number): number {
  if (relation === 'direct') return 0.44;
  return hops <= 1 ? 0.54 : 0.66;
}

function setSimilarity(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection++;
  return intersection / union.size;
}

function roadSimilarity(a: RoadSpec, b: RoadSpec, graph: RoadGraph): number {
  const neighboursA = (graph.get(a.id) ?? []).map((edge) => edge.roadId);
  const neighboursB = (graph.get(b.id) ?? []).map((edge) => edge.roadId);
  return clamp01(
    setSimilarity(a.stories, b.stories) * 0.44
    + (a.corridor === b.corridor ? 0.16 : 0)
    + (a.role === b.role ? 0.12 : 0)
    + (a.roadClass === b.roadClass ? 0.08 : 0)
    + setSimilarity(neighboursA, neighboursB) * 0.2,
  );
}

function selectionKey(origin: LatLng, intent: string, limit: number): string {
  return `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}:${intent}:${limit}`;
}

interface SelectionCacheValue {
  roads: SelectedRoad[];
  diagnostics: RoadRankingDiagnostic[];
}

const selectionCache = new Map<string, SelectionCacheValue>();
let lastRankingDiagnostics: RoadRankingDiagnostic[] = [];

function rankRoads(
  origin: LatLng,
  intent: string,
  limit: number,
  roads: readonly RoadSpec[],
  graph: RoadGraph,
): SelectionCacheValue {
  const access = new Map(roads.map((road) => [road.id, nearestOnPath(origin, road.path)]));
  const reach = connectedReach(roads, graph, access);
  const diagnostics = new Map<string, RoadRankingDiagnostic>();
  const candidates: RankedCandidate[] = [];

  for (const spec of roads) {
    const nearest = access.get(spec.id)!;
    const state = reach.get(spec.id);
    const relation = state?.relation ?? 'irrelevant';
    const score = state
      ? scoreRoad(spec, nearest.meters, intent, state.relation, state.networkMeters, state.hops, graph.get(spec.id)?.length ?? 0)
      : 0;
    let reason = 'not directly accessible and no useful graph connection';
    if (distanceToBounds(origin, spec.bounds) > CONNECTED_RANGE['regional-corridor'] * 1.25) {
      reason = 'outside the property relevance boundary';
    } else if (state && score < acceptanceFloor(state.relation, state.hops)) {
      reason = state.relation === 'direct'
        ? 'below the meaningful relevance threshold'
        : `reachable in ${state.hops} hop(s) but not relevant enough to explain this property`;
    } else if (state) {
      reason = 'eligible';
      candidates.push({
        spec, path: spec.path, accessPoint: nearest.point, accessMeters: nearest.meters,
        score, relation: state.relation, graphHops: state.hops,
        networkMeters: state.networkMeters, tier: 'tertiary',
      });
    }
    diagnostics.set(spec.id, {
      roadId: spec.id,
      roadName: spec.name,
      accessMeters: nearest.meters,
      relation,
      roadClass: spec.roadClass,
      importance: spec.importance,
      graphHops: state?.hops ?? null,
      networkMeters: state?.networkMeters ?? null,
      score,
      selected: false,
      reason,
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.accessMeters - b.accessMeters);
  const selected: RankedCandidate[] = [];
  const identities = new Set<string>();
  while (selected.length < limit) {
    let best: RankedCandidate | undefined;
    let bestAdjusted = -Infinity;
    for (const candidate of candidates) {
      if (selected.includes(candidate) || identityKeys(candidate.spec).some((identity) => identities.has(identity))) continue;
      const similarity = selected.length
        ? Math.max(...selected.map((chosen) => roadSimilarity(candidate.spec, chosen.spec, graph)))
        : 0;
      const adjusted = candidate.score - similarity * 0.28 - (similarity > 0.72 ? 0.2 : 0);
      if (adjusted > bestAdjusted) {
        best = candidate;
        bestAdjusted = adjusted;
      }
    }
    if (!best || bestAdjusted < acceptanceFloor(best.relation, best.graphHops)) break;
    best.adjustedScore = bestAdjusted;
    selected.push(best);
    identityKeys(best.spec).forEach((identity) => identities.add(identity));
  }

  const finalRoads = selected.map((road, index): SelectedRoad => ({
    ...road,
    tier: index < 2 && road.relation === 'direct'
      ? 'primary'
      : road.relation === 'direct' ? 'secondary' : 'tertiary',
  }));
  const selectedIds = new Set(finalRoads.map((road) => road.spec.id));
  for (const diagnostic of diagnostics.values()) {
    if (selectedIds.has(diagnostic.roadId)) {
      diagnostic.selected = true;
      diagnostic.reason = 'selected as a distinct connectivity story';
      continue;
    }
    const candidate = candidates.find((road) => road.spec.id === diagnostic.roadId);
    if (!candidate) continue;
    const similarity = finalRoads.length
      ? Math.max(...finalRoads.map((road) => roadSimilarity(candidate.spec, road.spec, graph)))
      : 0;
    diagnostic.reason = similarity >= 0.55
      ? 'redundant with a stronger selected connectivity story'
      : finalRoads.length >= limit ? 'selection limit reached' : 'insufficient information gain';
  }

  return {
    roads: finalRoads,
    diagnostics: [...diagnostics.values()].sort((a, b) => b.score - a.score || a.accessMeters - b.accessMeters),
  };
}

function logRanking(origin: LatLng, intent: string, diagnostics: readonly RoadRankingDiagnostic[]): void {
  if (!import.meta.env.DEV) return;
  console.groupCollapsed(`[MAPCO Roads] Connectivity ranking ${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)} · ${intent}`);
  console.table(diagnostics.map((road) => ({
    road: road.roadName,
    accessMeters: Math.round(road.accessMeters),
    status: road.relation,
    class: road.roadClass,
    importance: road.importance,
    graphHops: road.graphHops ?? '—',
    networkMeters: road.networkMeters == null ? '—' : Math.round(road.networkMeters),
    score: Number(road.score.toFixed(3)),
    selected: road.selected,
    reason: road.reason,
  })));
  console.groupEnd();
}

/** Property-centric selection from direct access plus meaningful graph reach. */
export function selectRoadsFor(
  origin: LatLng,
  intent: string,
  limit = 8,
  roads: readonly RoadSpec[] = ROAD_SPECS,
): SelectedRoad[] {
  const cappedLimit = Math.max(0, Math.min(10, Math.floor(limit)));
  if (!cappedLimit) return [];
  const useCache = roads === ROAD_SPECS;
  const key = selectionKey(origin, intent, cappedLimit);
  const cached = useCache ? selectionCache.get(key) : undefined;
  if (cached) {
    lastRankingDiagnostics = cached.diagnostics;
    return cached.roads.slice();
  }
  const result = rankRoads(origin, intent, cappedLimit, roads, useCache ? ROAD_GRAPH : buildRoadGraph(roads));
  lastRankingDiagnostics = result.diagnostics;
  if (useCache) {
    selectionCache.set(key, result);
    logRanking(origin, intent, result.diagnostics);
  }
  return result.roads.slice();
}

export function getLastRoadRankingDiagnostics(): RoadRankingDiagnostic[] {
  return lastRankingDiagnostics.map((diagnostic) => ({ ...diagnostic }));
}

/** Test/development seam for re-running selection after authored data changes. */
export function _resetRoadSelectionCache(): void {
  selectionCache.clear();
  lastRankingDiagnostics = [];
}
