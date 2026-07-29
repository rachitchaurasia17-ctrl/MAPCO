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
      title: 'Mohali — Master Plan',
      kind: 'masterplan',
      city: 'Mohali',
      sectorOrBlock: 'Master Plan',
      original: { src: `${BASE}/mohali-masterplan.png`, dims: { w: 1603, h: 1278 } },
      threeD: { src: `${BASE}/mohali-3d.png`, dims: { w: 1448, h: 1086 } },
      overlays: [
        {
          id: 'mohali-roads-sectors',
          src: `${BASE}/mohali-masterplan-overlays.svg`,
          viewBox: { w: 1575, h: 1132 },
          appliesTo: 'original',
        },
      ],
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
