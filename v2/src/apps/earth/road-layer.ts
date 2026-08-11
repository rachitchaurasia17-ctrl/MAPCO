import type { LatLng } from './config';
import {
  metersBetween,
  nearestOnPath,
  type RoadClass,
  type RoadSpec,
} from './intel/road-network';

export type RoadVisualTier = 'primary' | 'secondary' | 'tertiary';
export type RoadLayerMode = 'off' | 'global' | 'property';

/** Hard cap removed — all roads flow for a premium live network effect. */

export interface RoadLayerItem {
  id: string;
  name: string;
  path: LatLng[];
  accessPoint?: LatLng;
  accessMeters?: number;
  networkMeters?: number;
  importance?: number;
  score?: number;
  relation?: 'direct' | 'connected';
  tier?: RoadVisualTier;
  displayPaths?: LatLng[][];
}

/** The Roads toggle stays on while selection changes; only its data mode changes. */
export function resolveRoadLayerMode(roadsOn: boolean, propertySelected: boolean): RoadLayerMode {
  if (!roadsOn) return 'off';
  return propertySelected ? 'property' : 'global';
}

export function tierForRoadClass(roadClass: RoadClass): RoadVisualTier {
  if (roadClass === 'major-arterial' || roadClass === 'regional-corridor') return 'primary';
  if (roadClass === 'city-connector') return 'secondary';
  return 'tertiary';
}

/** Materialize the already-parsed registry for global display without ranking or geometry copies. */
export function globalRoadLayerItems(roads: readonly RoadSpec[]): RoadLayerItem[] {
  return roads.map((road) => ({
    id: road.id,
    name: road.name,
    path: road.path,
    importance: road.importance,
    score: road.importance * 0.65 + road.connectivity * 0.35,
    tier: tierForRoadClass(road.roadClass),
  }));
}

interface BoundsLike {
  contains(position: LatLng): boolean;
  getNorthEast?(): { lat: number | (() => number); lng: number | (() => number) };
  getSouthWest?(): { lat: number | (() => number); lng: number | (() => number) };
}

function coordinate(value: number | (() => number)): number {
  return typeof value === 'function' ? value() : value;
}

/** Keep label anchors out of the viewport rim and the top toolbar band. */
function insetLabelBounds(bounds: BoundsLike | undefined): BoundsLike | undefined {
  if (!bounds?.getNorthEast || !bounds.getSouthWest) return bounds;
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  const north = coordinate(northEast.lat);
  const east = coordinate(northEast.lng);
  const south = coordinate(southWest.lat);
  const west = coordinate(southWest.lng);
  if (north <= south || east <= west) return bounds;
  const latitudeInset = (north - south) * 0.07;
  const topToolbarInset = (north - south) * 0.15;
  const longitudeInset = (east - west) * 0.07;
  return {
    contains(position) {
      return bounds.contains(position)
        && position.lat >= south + latitudeInset
        && position.lat <= north - topToolbarInset
        && position.lng >= west + longitudeInset
        && position.lng <= east - longitudeInset;
    },
  };
}

/** Extracts useful source-coordinate segments without mutating or densifying the LineString. */
export function extractUsefulSegments(path: readonly LatLng[], property: LatLng, radiusMeters: number): LatLng[][] {
  const segments: LatLng[][] = [];
  let current: LatLng[] = [];
  for (let index = 0; index < path.length - 1; index++) {
    const start = path[index];
    const end = path[index + 1];
    const useful = nearestOnPath(property, [start, end]).meters <= radiusMeters;
    if (useful) {
      if (!current.length) current.push(start);
      current.push(end);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

function displayRadius(road: RoadLayerItem, active: boolean): number {
  const access = road.accessMeters ?? 0;
  if (active) return Math.min(8500, Math.max(5000, access + 2200));
  if (road.tier === 'primary') return Math.min(5000, Math.max(3400, access + 1300));
  if (road.tier === 'secondary') return Math.min(4800, Math.max(3000, access + 1100));
  return Math.min(6200, Math.max(2600, access + 900));
}

function candidateLabelPoints(road: RoadLayerItem, bounds?: BoundsLike): LatLng[] {
  const paths = road.displayPaths?.length ? road.displayPaths : [road.path];
  const candidates: LatLng[] = [];
  for (const path of paths) {
    if (!path.length) continue;
    const indices = new Set([
      Math.floor(path.length * 0.25),
      Math.floor(path.length * 0.5),
      Math.floor(path.length * 0.75),
    ]);
    for (const index of indices) {
      const point = path[Math.max(0, Math.min(path.length - 1, index))];
      if (!bounds || bounds.contains(point)) candidates.push(point);
    }
  }
  return candidates;
}

function labelPoint(
  road: RoadLayerItem,
  property: LatLng | null,
  mapCenter: LatLng,
  exclusionMeters: number,
  bounds?: BoundsLike,
): LatLng | null {
  const candidates = candidateLabelPoints(road, bounds)
    .filter((point) => !property || metersBetween(property, point) >= exclusionMeters)
    .sort((a, b) => {
      const propertyDelta = property
        ? metersBetween(property, a) - metersBetween(property, b)
        : 0;
      return propertyDelta || metersBetween(mapCenter, a) - metersBetween(mapCenter, b);
    });
  if (candidates.length) return candidates[0];

  const paths = road.displayPaths?.length ? road.displayPaths : [road.path];
  const visible = paths.flat().filter((point) => (!bounds || bounds.contains(point))
    && (!property || metersBetween(property, point) >= exclusionMeters));
  if (!visible.length) return null;
  return visible.sort((a, b) => metersBetween(mapCenter, a) - metersBetween(mapCenter, b))[0];
}

/** Deterministic, property-aware label selection with map/pin collision suppression. */
export function selectRoadLabels(
  roads: readonly RoadLayerItem[],
  activeId: string | null,
  mapCenter: LatLng,
  property: LatLng | null,
  zoom: number,
  bounds?: BoundsLike,
): Array<{ road: RoadLayerItem; position: LatLng }> {
  // Rely on AdvancedMarkerElement's native CollisionBehavior for smooth zooming
  // instead of hard-capping and removing labels abruptly.
  const metersPerPixel = 156543.03392 * Math.cos((mapCenter.lat * Math.PI) / 180) / (2 ** zoom);
  const propertyExclusion = Math.max(240, metersPerPixel * 75);

  const labels: Array<{ road: RoadLayerItem; position: LatLng }> = [];
  for (const road of roads) {
    const active = road.id === activeId;
    const position = labelPoint(road, property, mapCenter, active ? propertyExclusion * 0.65 : propertyExclusion, bounds);
    if (!position) continue;
    labels.push({ road, position });
  }
  return labels;
}

/* ── Tapered ends ───────────────────────────────────────────────
   A clipped road must not look cut with scissors. We split the last
   stretch of each rendered segment into a few short pieces whose
   opacity ramps down, so the line reads as continuing beyond the
   useful window. Source geometry is never modified — this only
   subdivides the already-derived display path for drawing. */
const TAPER_STEPS = 5;
const TAPER_METERS = 420;

interface TaperPiece { path: LatLng[]; fade: number; }

/** Split a display path into a solid core plus fading head/tail pieces at artificial cuts. */
export function taperSegment(path: readonly LatLng[], fullPath?: readonly LatLng[]): TaperPiece[] {
  if (path.length < 2) return [{ path: [...path], fade: 1 }];

  const isStartClipped = fullPath ? path[0] !== fullPath[0] : false;
  const isEndClipped = fullPath ? path[path.length - 1] !== fullPath[fullPath.length - 1] : false;

  if (!isStartClipped && !isEndClipped) return [{ path: [...path], fade: 1 }];

  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = metersBetween(path[i], path[i + 1]);
    lengths.push(d);
    total += d;
  }
  // Too short to taper meaningfully — draw as-is.
  if (total < TAPER_METERS * 2.5) return [{ path: [...path], fade: 1 }];

  const pieces: TaperPiece[] = [];
  const cut = TAPER_METERS;
  let travelled = 0;
  let current: LatLng[] = [path[0]];
  let currentFade = fadeAt(0, total, cut, isStartClipped, isEndClipped);

  for (let i = 0; i < path.length - 1; i++) {
    travelled += lengths[i];
    const next = path[i + 1];
    const f = fadeAt(travelled, total, cut, isStartClipped, isEndClipped);
    current.push(next);
    // start a new piece when the fade bucket changes
    if (Math.abs(f - currentFade) > 0.5 / TAPER_STEPS) {
      pieces.push({ path: current, fade: currentFade });
      current = [next];
      currentFade = f;
    }
  }
  if (current.length >= 2) pieces.push({ path: current, fade: currentFade });
  return pieces.length ? pieces : [{ path: [...path], fade: 1 }];
}

/** 1 in the middle, ramping to ~0.15 at clipped ends, quantised into steps. */
function fadeAt(distance: number, total: number, cut: number, isStartClipped: boolean, isEndClipped: boolean): number {
  let edge = Infinity;
  if (isStartClipped) edge = Math.min(edge, distance);
  if (isEndClipped) edge = Math.min(edge, total - distance);

  if (edge >= cut) return 1;
  const raw = 0.15 + 0.85 * (edge / cut);
  return Math.round(raw * TAPER_STEPS) / TAPER_STEPS;
}

function roadStyle(road: RoadLayerItem, active: boolean, quiet: boolean) {
  if (active) {
    return { casing: 14, glow: 9.5, core: 4.5, casingOpacity: 0.64, glowOpacity: 0.6, coreOpacity: 1, coreColor: '#fef08a' };
  }
  const tier = road.tier ?? 'secondary';
  const base = tier === 'primary'
    ? { casing: 10, glow: 6.5, core: 3.1, casingOpacity: 0.54, glowOpacity: 0.45, coreOpacity: 0.96 }
    : tier === 'secondary'
      ? { casing: 8, glow: 5, core: 2.5, casingOpacity: 0.46, glowOpacity: 0.35, coreOpacity: 0.84 }
      : { casing: 6.5, glow: 4, core: 2, casingOpacity: 0.38, glowOpacity: 0.25, coreOpacity: 0.7 };
  return {
    ...base,
    casingOpacity: quiet ? base.casingOpacity * 0.66 : base.casingOpacity,
    glowOpacity: quiet ? base.glowOpacity * 0.58 : base.glowOpacity,
    coreOpacity: quiet ? base.coreOpacity * 0.68 : base.coreOpacity,
    coreColor: '#facc15', // strong golden yellow
  };
}

/** One renderer shared by global exploration and property-specific road intelligence. */
export class RoadLayer {
  private lines: any[] = [];
  private labels: any[] = [];
  private roads: RoadLayerItem[] = [];
  private activeId: string | null = null;
  private property: LatLng | null = null;

  constructor(private map: any, private AdvancedMarkerElement: any) {
    map.addListener('idle', () => this.redrawLabels());
  }

  show(roads: readonly RoadLayerItem[], activeId: string | null, property: LatLng | null): void {
    this.clearLines();
    this.clearLabels();
    this.property = property;
    this.activeId = activeId;
    this.roads = roads
      .filter((road) => road.path.length >= 2)
      .map((road) => ({
        ...road,
        displayPaths: [road.path],
      }))
      .filter((road) => road.displayPaths.length > 0);

    for (const road of this.roads) {
      const active = road.id === activeId;
      const quiet = activeId != null && !active;
      const style = roadStyle(road, active, quiet);
      for (const path of road.displayPaths!) {
        for (const piece of taperSegment(path, road.path)) {
          const f = piece.fade;
          this.lines.push(new google.maps.Polyline({
            map: this.map, path: piece.path, geodesic: false, clickable: false,
            strokeColor: '#04121a', strokeOpacity: style.casingOpacity * f,
            strokeWeight: style.casing, zIndex: 3,
          }));
          this.lines.push(new google.maps.Polyline({
            map: this.map, path: piece.path, geodesic: false, clickable: false,
            strokeColor: active ? '#fde047' : '#f59e0b', strokeOpacity: style.glowOpacity * f,
            strokeWeight: style.glow, zIndex: 4,
          }));
          this.lines.push(new google.maps.Polyline({
            map: this.map, path: piece.path, geodesic: false, clickable: false,
            strokeColor: style.coreColor, strokeOpacity: style.coreOpacity * f,
            strokeWeight: style.core, zIndex: 5,
          }));
        }
      }
    }
    this.redrawLabels();
  }

  hide(): void {
    this.clearLines();
    this.clearLabels();
    this.roads = [];
    this.activeId = null;
    this.property = null;
  }

  private redrawLabels(): void {
    this.clearLabels();
    if (!this.roads.length) return;
    const centerValue = this.map.getCenter?.();
    const center = centerValue
      ? { lat: centerValue.lat(), lng: centerValue.lng() }
      : this.property ?? this.roads[0].path[0];
    const zoom = this.map.getZoom?.() ?? 13;
    const bounds = insetLabelBounds(this.map.getBounds?.() as BoundsLike | undefined);
    for (const { road, position } of selectRoadLabels(this.roads, this.activeId, center, this.property, zoom, bounds)) {
      const active = road.id === this.activeId;
      const tier = road.tier ?? 'secondary';
      const element = createRoadLabelElement(road.name, tier, active, Boolean(this.activeId && !active));
      const collisionBehavior = google.maps.CollisionBehavior?.OPTIONAL_AND_HIDES_LOWER_PRIORITY;

      const tierValue = tier === 'primary' ? 2 : tier === 'secondary' ? 1 : 0;
      const score = Math.round((road.score ?? road.importance ?? 0.5) * 100);
      const zIndex = active ? 1000 : (tierValue * 100) + score;

      this.labels.push(new this.AdvancedMarkerElement({
        map: this.map,
        position,
        content: element,
        zIndex,
        ...(collisionBehavior ? { collisionBehavior } : {}),
      }));
    }
  }

  private clearLines(): void {
    for (const line of this.lines) line.setMap(null);
    this.lines.length = 0;
  }

  private clearLabels(): void {
    for (const label of this.labels) label.map = null;
    this.labels.length = 0;
  }
}

/** Pointer tip is the AdvancedMarker anchor, so it always targets a real source road point. */
export function createRoadLabelElement(
  name: string,
  tier: RoadVisualTier,
  active = false,
  dim = false,
): HTMLElement {
  const element = document.createElement('div');
  element.className = `e-roadlabel e-roadlabel--${tier}`
    + (active ? ' on' : '') + (dim ? ' dim' : '');

  const text = document.createElement('span');
  text.className = 'e-roadlabel-text';
  text.textContent = name;

  const pointer = document.createElement('span');
  pointer.className = 'e-roadlabel-pointer';
  pointer.setAttribute('aria-hidden', 'true');
  element.append(text, pointer);
  return element;
}
