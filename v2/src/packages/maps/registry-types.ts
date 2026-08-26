/* ═══════════════════════════════════════════════════════════════
   MAPCO — canonical non-3D map registry
   ---------------------------------------------------------------
   One record per official 2D map asset. Not every image is a Sector
   Map: the library mixes city masterplans, sector sheets, industrial
   areas, township/project layouts and commercial centre plans, and
   showing the wrong one is worse than showing none.

   The hard rule this file exists to protect:

       Property.location    = real latitude / longitude (Earth)
       Property.mapPlacement = mapId + x/y INSIDE an image

   Those are different things. A pin position on a sector sheet is an
   image coordinate; it is never geography. Nothing here converts one
   into the other, in either direction.
   ═══════════════════════════════════════════════════════════════ */

export type MapKind =
  | 'MASTERPLAN'
  | 'SECTOR_MAP'
  | 'PROJECT_MAP'
  | 'INDUSTRIAL_MAP'
  | 'OTHER_LAYOUT';

export interface MapDimensions {
  width: number;
  height: number;
}

export interface CanonicalMap {
  id: string;
  /** What a dealer would call it. */
  name: string;
  kind: MapKind;
  city: string;
  /** Sector number / phase / locality, when the map is about one. */
  sector?: string;
  /** Township or project name, for PROJECT_MAP. */
  project?: string;
  /** MAPCO-served asset path. */
  image: string;
  /** Intrinsic pixel size — needed to place mapPlacement x/y correctly. */
  dimensions: MapDimensions;
  /** Alternate spellings a dealer or a legacy record might use. */
  aliases?: readonly string[];
  active: boolean;
}

export interface MapImportIssue {
  file: string;
  problem: 'ambiguous-name' | 'not-an-image' | 'unreadable-dimensions' | 'duplicate-id';
  detail: string;
}

/** Normalise for comparison: lowercase, strip punctuation, collapse spaces. */
export function normalizeMapToken(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull a sector/phase number out of free text.
 * "Sector 78, Mohali" → "78"; "Phase 5 Mohali" → "phase 5".
 */
export function extractSectorToken(value: string): string | null {
  const text = normalizeMapToken(value);
  const phase = text.match(/\bphase\s+(\d+[a-z]?)\b/);
  if (phase) return `phase ${phase[1]}`;
  const sector = text.match(/\bsector\s+(\d+[a-z]?)\b/);
  if (sector) return sector[1]!;
  return null;
}

/** City tokens MAPCO curates, longest first so "new chandigarh" wins. */
const CITY_TOKENS = [
  'new chandigarh', 'mullanpur', 'aerotropolis', 'aerocity',
  'chandigarh', 'mohali', 'panchkula', 'zirakpur', 'kharar', 'derabassi',
];

export function extractCityToken(value: string): string | null {
  const text = normalizeMapToken(value);
  for (const city of CITY_TOKENS) if (text.includes(city)) return city;
  // Common shorthand in the asset filenames.
  if (/\bchd\b/.test(text)) return 'chandigarh';
  if (/\bmohalli\b|\bmohli\b/.test(text)) return 'mohali';
  if (/\bpanchulka\b/.test(text)) return 'panchkula';
  return null;
}

export interface MapResolutionInput {
  city?: string;
  /** Free text: "Sector 78, Mohali", "Phase 5", "Eco City". */
  sector?: string;
  area?: string;
  project?: string;
}

export interface MapResolution {
  sectorMap: CanonicalMap | null;
  masterplan: CanonicalMap | null;
  /** Why no sector map, so the UI can say something true. */
  reason?: 'no-sector-recorded' | 'no-map-for-sector' | 'no-city-recorded';
}

/**
 * Resolve the maps for a property.
 *
 * A city Masterplan is NEVER returned as the Sector Map. They are
 * separate results, and a missing sector sheet stays missing so the UI
 * can say "Sector map not available" honestly.
 */
export function resolvePropertyMaps(
  input: MapResolutionInput,
  registry: readonly CanonicalMap[],
): MapResolution {
  const city = extractCityToken(input.city ?? '') ?? extractCityToken(input.area ?? '');
  const active = registry.filter((m) => m.active);

  const masterplan = city
    ? active.find((m) => m.kind === 'MASTERPLAN' && extractCityToken(m.city) === city) ?? null
    : null;

  if (!city) return { sectorMap: null, masterplan, reason: 'no-city-recorded' };

  // A project layout wins over a sector sheet when the property names one.
  const projectText = normalizeMapToken(`${input.project ?? ''} ${input.area ?? ''}`);
  if (projectText) {
    const project = active.find((m) =>
      m.kind === 'PROJECT_MAP'
      && extractCityToken(m.city) === city
      && !!m.project
      && projectText.includes(normalizeMapToken(m.project)));
    if (project) return { sectorMap: project, masterplan };
  }

  const token = extractSectorToken(input.sector ?? '') ?? extractSectorToken(input.area ?? '');
  if (!token) return { sectorMap: null, masterplan, reason: 'no-sector-recorded' };

  const sectorMap = active.find((m) =>
    (m.kind === 'SECTOR_MAP' || m.kind === 'INDUSTRIAL_MAP')
    && extractCityToken(m.city) === city
    && m.sector === token) ?? null;

  return sectorMap
    ? { sectorMap, masterplan }
    : { sectorMap: null, masterplan, reason: 'no-map-for-sector' };
}

/**
 * A property pin may be drawn ONLY when an explicit placement exists for
 * that exact map. There is no fallback: we never centre a pin, never
 * derive one from a sector centroid, and never convert lat/lng into an
 * image position.
 */
export function pinForMap(
  mapId: string,
  placement: { mapId: string; x: number; y: number } | undefined,
): { x: number; y: number } | null {
  if (!placement || placement.mapId !== mapId) return null;
  if (!Number.isFinite(placement.x) || !Number.isFinite(placement.y)) return null;
  if (placement.x < 0 || placement.x > 1 || placement.y < 0 || placement.y > 1) return null;
  return { x: placement.x, y: placement.y };
}
