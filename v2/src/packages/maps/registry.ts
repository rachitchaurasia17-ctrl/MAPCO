/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Map Pilot Registry
   ---------------------------------------------------------------
   Mirrors the proven `window.PM_MAP_REGISTRY` contract (doc 11):
   every rendering carries its OWN intrinsic pixel dimensions so the
   engine scales overlays/pins without cropping or distortion.

   This pilot integrates ONE linked Mohali set of three controlled
   renderings. In production this file is GENERATED (doc 11: "do not
   hand-edit"); here it is a small deterministic seed.
   ═══════════════════════════════════════════════════════════════ */

export type MapKind = 'masterplan' | 'sector';
export type RenderMode = 'original' | 'easy' | 'threeD';

export interface Dimensions {
  /** intrinsic pixel width/height of THIS rendering — never approximated. */
  readonly w: number;
  readonly h: number;
}

export interface Rendering {
  readonly src: string;
  readonly dims: Dimensions;
}

export interface OverlayDescriptor {
  readonly id: string;
  readonly src: string;
  /** intrinsic viewBox of the overlay artwork (its own coordinate space). */
  readonly viewBox: Dimensions;
  /** which rendering this overlay is authored against. */
  readonly appliesTo: RenderMode;
}

/** Geometry trust for a map's SVG overlay. Highlights only activate when
 *  `calibrated`; otherwise the raster renders normally and Highlights show a
 *  clean "Alignment pending" state (never visibly wrong geometry). */
export type CalibrationStatus = 'calibrated' | 'needs-review' | 'unavailable';

export interface MapCalibration {
  readonly status: CalibrationStatus;
  /** the overlay's authored viewBox (its own coordinate space). */
  readonly overlayViewBox?: Dimensions;
  /** the raster the overlay was authored against. */
  readonly raster?: Dimensions;
}

/** The authored SVG highlight overlay for the Original rendering.
 *  Belongs to the Original map ONLY — never rendered on the 3D map. */
export interface MapOverlaySpec {
  readonly src: string;
  readonly viewBox: Dimensions;
  readonly status: CalibrationStatus;
}

export interface MapEntry {
  readonly id: string;
  readonly title: string;
  readonly kind: MapKind;
  readonly city: string;
  readonly sectorOrBlock: string;
  /** the official proof rendering (always present). */
  readonly original: Rendering;
  /** cleaned/easy rendering, if available. */
  readonly easy?: Rendering;
  /** simplified client-friendly 3D rendering — loaded ONLY on demand. */
  readonly threeD?: Rendering;
  readonly overlays: readonly OverlayDescriptor[];
  /** the authored SVG highlight overlay (Original only), if any. The
   *  presentation renders this inline (real geometry) for highlighting;
   *  it is NOT flat-rendered by the engine. */
  readonly overlay?: MapOverlaySpec;
  /** geometry trust for this map's overlay (drives the Highlights control). */
  readonly calibration?: MapCalibration;
  /** sector maps reachable from this map (masterplan → sector). */
  readonly linkedMapIds: readonly string[];
  /** properties placed on this map. */
  readonly linkedPropertyIds: readonly string[];
  readonly status: 'active';
}

export interface MapRegistry {
  readonly version: number;
  readonly maps: readonly MapEntry[];
}

const BASE = '/maps-pilot';

const REGISTRY: MapRegistry = {
  version: 1,
  maps: [
    {
      id: 'masterplan-mohali',
      title: 'Mohali (engine pilot)',
      kind: 'masterplan',
      city: 'Mohali',
      sectorOrBlock: 'Master Plan',
      original: { src: `${BASE}/mohali-masterplan.png`, dims: { w: 1603, h: 1278 } },
      threeD: { src: `${BASE}/mohali-3d.png`, dims: { w: 1448, h: 1086 } },
      overlays: [],
      linkedMapIds: ['sector-mohali-90-91'],
      linkedPropertyIds: ['aero', 'sec79', 'sec66'],
      status: 'active',
    },
    {
      id: 'sector-mohali-90-91',
      title: 'Mohali — Janta Township, Sector 90-91',
      kind: 'sector',
      city: 'Mohali',
      sectorOrBlock: 'Sector 90-91',
      original: { src: `${BASE}/mohali-sector-90-91.jpg`, dims: { w: 1024, h: 724 } },
      overlays: [],
      linkedMapIds: ['masterplan-mohali'],
      linkedPropertyIds: ['sec79'],
      status: 'active',
    },
  ],
};

/** Public registry API (doc 11 stable surface). */
export function getMaps(): readonly MapEntry[] {
  return REGISTRY.maps;
}

export function getMap(id: string): MapEntry | undefined {
  return REGISTRY.maps.find((m) => m.id === id);
}

/** Resolve the rendering for a requested mode, falling back safely. */
export function renderingFor(entry: MapEntry, mode: RenderMode): Rendering | undefined {
  if (mode === 'original') return entry.original;
  if (mode === 'easy') return entry.easy ?? entry.original;
  if (mode === 'threeD') return entry.threeD;
  return entry.original;
}
export function addPropertyToMap(mapId: string, propertyId: string) {
  const m = REGISTRY.maps.find(m => m.id === mapId);
  if (m) {
    (m.linkedPropertyIds as string[]).push(propertyId);
  }
}

/* ── backend catalog bridge ────────────────────────────────────
   The static entries above are the LOCKED pilot (do not change).
   These helpers let the real Supabase catalog be merged in as
   first-class engine entries WITHOUT disturbing the locked default. */

/** Structural shape the data layer already returns (no import needed). */
export interface MapCatalogInput {
  readonly id: string;
  readonly kind: MapKind;
  readonly city?: string;
  readonly sector?: string;
  readonly area?: string;
  readonly label?: string;
  readonly raster?: string;
  readonly parentMapId?: string;
  readonly dims?: { original?: Dimensions; threeD?: Dimensions };
  readonly assets?: {
    original?: { path?: string; w?: number; h?: number };
    threeD?: { path?: string; w?: number; h?: number };
    overlay?: { path?: string; w?: number; h?: number };
  };
  readonly calibration?: { status?: string; overlayViewBox?: Dimensions | null; raster?: Dimensions | null } | null;
  readonly linkedProperties?: readonly string[];
}

function calibrationStatusOf(raw: unknown): CalibrationStatus {
  return raw === 'calibrated' || raw === 'needs-review' || raw === 'unavailable' ? raw : 'unavailable';
}

/** Convert a backend map record into a MapEntry the engine can render.
 *  Returns null when there is no usable original raster (missing-asset). */
export function mapEntryFromData(d: MapCatalogInput): MapEntry | null {
  const originalSrc = d.assets?.original?.path ?? d.raster;
  if (!originalSrc) return null;
  const ow = d.assets?.original?.w ?? d.dims?.original?.w ?? 0;
  const oh = d.assets?.original?.h ?? d.dims?.original?.h ?? 0;
  if (!ow || !oh) return null; // incompatible/unknown dimensions → skip, never distort
  const threeDPath = d.assets?.threeD?.path;
  const overlayPath = d.assets?.overlay?.path;
  // The overlay viewBox: prefer explicit calibration, then the stored overlay
  // asset dims, then the raster dims (aligned exports share both).
  const vbW = d.calibration?.overlayViewBox?.w ?? d.assets?.overlay?.w ?? ow;
  const vbH = d.calibration?.overlayViewBox?.h ?? d.assets?.overlay?.h ?? oh;
  const status = calibrationStatusOf(d.calibration?.status);
  const overlay: MapOverlaySpec | undefined = overlayPath
    ? { src: overlayPath, viewBox: { w: vbW, h: vbH }, status }
    : undefined;
  const entry: MapEntry = {
    id: d.id,
    title: d.label || d.area || d.city || d.id,
    kind: d.kind,
    city: d.city || 'Other',
    sectorOrBlock: d.sector || d.area || '',
    original: { src: originalSrc, dims: { w: ow, h: oh } },
    ...(threeDPath ? { threeD: { src: threeDPath, dims: { w: d.assets!.threeD!.w || ow, h: d.assets!.threeD!.h || oh } } } : {}),
    // The engine never flat-renders the authored SVG (raw strokes would show).
    // The real geometry is rendered inline by the presentation via `overlay`.
    overlays: [],
    ...(overlay ? { overlay } : {}),
    calibration: { status, overlayViewBox: overlay?.viewBox, raster: { w: ow, h: oh } },
    linkedMapIds: d.parentMapId ? [d.parentMapId] : [],
    linkedPropertyIds: d.linkedProperties ? [...d.linkedProperties] : [],
    status: 'active',
  };
  return entry;
}

/** Merge backend entries into the registry (idempotent; never replaces a
 *  locked pilot id). Entries without a usable raster are skipped. */
export function registerMaps(inputs: readonly MapCatalogInput[]): MapEntry[] {
  const seen = new Set(REGISTRY.maps.map((m) => m.id));
  const added: MapEntry[] = [];
  for (const input of inputs) {
    if (seen.has(input.id)) continue;
    const entry = mapEntryFromData(input);
    if (!entry) continue;
    (REGISTRY.maps as MapEntry[]).push(entry);
    seen.add(entry.id);
    added.push(entry);
  }
  return added;
}
