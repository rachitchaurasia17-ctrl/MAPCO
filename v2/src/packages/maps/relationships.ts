import type { MapEntry, RenderMode } from './registry';

export interface RelatedMapPair {
  readonly sector: MapEntry;
  readonly masterplan?: MapEntry;
}

/** Resolve only explicit backend ids. Missing links stay missing; there is no fallback. */
export function relatedMapPair(
  maps: readonly MapEntry[],
  sectorMapId: string | undefined,
): RelatedMapPair | null {
  if (!sectorMapId) return null;
  const sector = maps.find((map) => map.id === sectorMapId && map.kind === 'sector');
  if (!sector) return null;
  const masterplan = sector.parentMapId
    ? maps.find((map) => map.id === sector.parentMapId && map.kind === 'masterplan')
    : undefined;
  return { sector, ...(masterplan ? { masterplan } : {}) };
}

export function sectorMapsForCity(maps: readonly MapEntry[], city: string): MapEntry[] {
  return maps.filter((map) => map.kind === 'sector' && map.city === city);
}

/** Existing calibration does not map Original coordinates into 3D space. */
export function placementVisibleOn(
  pin: { mapId: string } | null,
  map: MapEntry | undefined,
  mode: RenderMode,
): boolean {
  return mode === 'original' && !!pin && !!map && pin.mapId === map.id;
}
