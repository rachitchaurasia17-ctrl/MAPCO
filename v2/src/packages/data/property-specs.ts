import { DETAIL_SCHEMAS } from './property-details-schema';
/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Adaptive property specifications
   ---------------------------------------------------------------
   A canonical Property carries ~20 flat fields that are true of every
   property (type, city, area, size, facing, price…). Everything a
   buyer actually asks about is type-specific: a plot has frontage and
   open sides, an office has cabins and a server room, a kothi has a
   lawn and a pooja room.

   The Desk already models this adaptively — `kindOf()` maps a property
   type to one of ten kinds and `typeFields()` emits that kind's field
   list. This module is the canonical, persistable counterpart, so the
   spec sheet a dealer fills in survives a save instead of being
   regenerated from seed data on every mount.

   The key rule this file enforces:

     Changing a property's type must change its specification model
     WITHOUT leaving invalid stale values behind.

   `normalizePropertySpecs` is the single place that happens.
   ═══════════════════════════════════════════════════════════════ */

/** The ten specification models. Derived from the Desk's `kindOf()`. */
export type PropertyKind =
  | 'plot' | 'indplot' | 'flat' | 'bfloor' | 'kothi'
  | 'villa' | 'sco' | 'booth' | 'office' | 'showroom';

/** A specification value. Chips persist as strings, flags as booleans. */
export type PropertySpecValue = string | number | boolean;

export type PropertySpecs = Readonly<Record<string, PropertySpecValue>>;

/**
 * Resolve a property type to its specification model. Mirrors the Desk's
 * `kindOf()` exactly — the two must never disagree, or a dealer's saved
 * specs would be dropped as invalid on the next read.
 */
export function propertyKindOf(type: string | undefined): PropertyKind {
  const s = (type ?? '').toLowerCase();
  if (s.includes('industrial')) return 'indplot';
  if (s.includes('plot')) return 'plot';
  if (s.includes('booth')) return 'booth';
  if (s.includes('sco')) return 'sco';
  if (s.includes('office')) return 'office';
  if (s.includes('showroom')) return 'showroom';
  if (s.includes('flat') || s.includes('apartment')) return 'flat';
  if (s.includes('builder')) return 'bfloor';
  if (s.includes('kothi')) return 'kothi';
  if (s.includes('villa')) return 'villa';
  return 'flat';
}

/**
 * The specification keys each kind accepts, extracted from the Desk's
 * `typeFields()` so the persisted model matches the rendered form field
 * for field. Known keys for other kinds are never stored; opaque legacy keys survive same-type edits.
 */
const LEGACY_PROPERTY_SPEC_KEYS: Readonly<Record<PropertyKind, readonly string[]>> = {
  plot: ['approvalNote', 'block', 'corner', 'cornerCut', 'dimBack', 'dimFront', 'dimLeft',
    'dimRight', 'facing', 'frontage', 'depth', 'level', 'mainRoad', 'nearGreen', 'openSides',
    'parkFacing', 'plotNo', 'road', 'road2', 'shape', 'showPlotNo', 'tenure'],
  indplot: ['access', 'approvalNote', 'built', 'ceiling', 'crane', 'depth', 'effluent',
    'frontage', 'gas', 'labourQtr', 'loadingBay', 'officeBlock', 'phase', 'plotNo',
    'powerLoad', 'road', 'sewer', 'shedArea', 'tenure', 'use', 'water', 'yardArea'],
  flat: ['ac', 'age', 'balconies', 'baths', 'beds', 'borewell', 'builtup', 'carpet', 'config',
    'dining', 'facing', 'floor', 'flooring', 'furnishing', 'kitchens', 'lift', 'living',
    'maintenance', 'modularKitchen', 'parking', 'piped', 'plotNo', 'possession', 'powerBackup',
    'puja', 'security', 'servant', 'servantBath', 'solar', 'store', 'study', 'terraceRights',
    'totalFloors', 'wardrobes'],
  bfloor: ['age', 'balconies', 'baths', 'beds', 'borewell', 'builtup', 'carpet', 'config',
    'dining', 'facing', 'floor', 'flooring', 'furnishing', 'kitchens', 'landArea', 'lift',
    'living', 'parking', 'plotNo', 'powerBackup', 'puja', 'road', 'roofRights', 'security',
    'sepEntry', 'servant', 'servantBath', 'solar', 'stilt', 'store', 'study', 'terrace',
    'totalFloors'],
  kothi: ['age', 'barsati', 'basement', 'basementArea', 'baths', 'beds', 'borewell', 'builtup',
    'carpet', 'dining', 'facing', 'floorCount', 'floorPlan', 'furnishing', 'kitchens', 'lawn',
    'lawnArea', 'lift', 'living', 'parking', 'portico', 'powerBackup', 'puja', 'road',
    'security', 'servant', 'servantBath', 'solar', 'stilt', 'store', 'study', 'tenure', 'terrace'],
  villa: ['age', 'barsati', 'basement', 'basementArea', 'baths', 'beds', 'borewell', 'builtup',
    'carpet', 'dining', 'facing', 'floorCount', 'floorPlan', 'furnishing', 'kitchens', 'lawn',
    'lawnArea', 'lift', 'living', 'parking', 'portico', 'powerBackup', 'puja', 'road',
    'security', 'servant', 'servantBath', 'solar', 'stilt', 'store', 'study', 'tenure', 'terrace'],
  sco: ['basement', 'basementArea', 'builtup', 'ceiling', 'corner', 'currentUse', 'fitout',
    'floorCount', 'floorPlan', 'landArea', 'lift', 'mainRoad', 'pantry', 'parking',
    'powerBackup', 'road', 'tenure', 'terrace', 'twoSide', 'use', 'washrooms'],
  booth: ['carpet', 'ceiling', 'corner', 'currentUse', 'fitout', 'floor', 'mainRoad',
    'mezzanine', 'pantry', 'parkingAccess', 'plotNo', 'powerBackup', 'road', 'tenure',
    'use', 'washroom'],
  office: ['basementArea', 'builtup', 'cabins', 'carpet', 'ceiling', 'centralAc', 'conference',
    'corner', 'currentUse', 'facing', 'fitout', 'floor', 'furnishing', 'groundAccess', 'lift',
    'mainRoad', 'maintenance', 'mezzanine', 'pantry', 'parking', 'powerBackup', 'reception',
    'road', 'seats', 'serverRoom', 'shutter', 'tenure', 'totalFloors', 'use', 'washrooms'],
  showroom: ['basementArea', 'carpet', 'ceiling', 'centralAc', 'corner', 'currentUse', 'fitout',
    'floor', 'groundAccess', 'mainRoad', 'mezzanine', 'pantry', 'parking', 'powerBackup',
    'road', 'shutter', 'tenure', 'use', 'washrooms'],
};

export const PROPERTY_SPEC_KEYS = Object.fromEntries(Object.entries(LEGACY_PROPERTY_SPEC_KEYS).map(([kind, keys]) => [kind, [...new Set([...keys, ...DETAIL_SCHEMAS[kind as PropertyKind].map(f => f.key)])]])) as unknown as Record<PropertyKind, readonly string[]>;

/** Every key any kind can hold — the union used for storage validation. */
export const ALL_PROPERTY_SPEC_KEYS: readonly string[] =
  [...new Set(Object.values(PROPERTY_SPEC_KEYS).flat())].sort();

/** The specification keys valid for a given property type. */
export function propertySpecKeys(type: string | undefined): readonly string[] {
  return PROPERTY_SPEC_KEYS[propertyKindOf(type)];
}

const MAX_SPEC_TEXT = 240;

/**
 * Project a raw specification bag onto the model for `type`.
 *
 * - Known keys that belong only to other kinds are DROPPED, so
 *   changing Flat → Plot cannot leave `beds: '3'` behind.
 * - Empty strings, null and undefined are dropped rather than stored as
 *   a value the dealer never entered.
 * - `false` is preserved: an explicitly unticked flag is a real answer.
 * - Text is bounded so a spec sheet can never bloat the payload.
 *
 * Returns undefined when nothing survives, so the field is simply absent
 * rather than persisted as an empty object.
 */
export function normalizePropertySpecs(
  type: string | undefined,
  specs: unknown,
  preserveUnknown = true,
): PropertySpecs | undefined {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return undefined;
  const allowed = new Set(propertySpecKeys(type));
  const source = specs as Record<string, unknown>;
  const out: Record<string, PropertySpecValue> = {};

  for (const key of Object.keys(source)) {
    if (!allowed.has(key) && (!preserveUnknown || ALL_PROPERTY_SPEC_KEYS.includes(key))) continue;
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    const value = source[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'boolean') { out[key] = value; continue; }
    if (typeof value === 'number') {
      if (Number.isFinite(value)) out[key] = value;
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed.slice(0, MAX_SPEC_TEXT);
    }
  }

  return Object.keys(out).length ? out : undefined;
}

/** Keys present on `specs` that the given type does not accept. */
export function staleSpecKeys(type: string | undefined, specs: unknown): readonly string[] {
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return [];
  const allowed = new Set(propertySpecKeys(type));
  return Object.keys(specs as Record<string, unknown>).filter((key) => !allowed.has(key));
}
