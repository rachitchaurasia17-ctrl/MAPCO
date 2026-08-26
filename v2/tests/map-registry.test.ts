import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_REGISTRY } from '../src/packages/maps/sector-map-registry';
import {
  resolvePropertyMaps, pinForMap, extractSectorToken, extractCityToken,
} from '../src/packages/maps/registry-types';

describe('map registry', () => {
  it('imported the whole library with real dimensions', () => {
    expect(MAP_REGISTRY.length).toBeGreaterThan(100);
    for (const map of MAP_REGISTRY) {
      expect(map.dimensions.width, map.id).toBeGreaterThan(0);
      expect(map.dimensions.height, map.id).toBeGreaterThan(0);
      expect(map.image).toMatch(/^\/maps\//);
    }
  });

  it('has unique ids and real files on disk', () => {
    const ids = MAP_REGISTRY.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const map of MAP_REGISTRY) {
      expect(existsSync(new URL(`../public${map.image}`, import.meta.url)), map.image).toBe(true);
    }
  });

  it('does not treat every image as a Sector Map', () => {
    const kinds = new Set(MAP_REGISTRY.map((m) => m.kind));
    expect(kinds.has('MASTERPLAN')).toBe(true);
    expect(kinds.has('SECTOR_MAP')).toBe(true);
    expect(kinds.has('PROJECT_MAP')).toBe(true);
    expect(kinds.has('INDUSTRIAL_MAP')).toBe(true);
  });

  it('covers all four launch cities', () => {
    const cities = new Set(MAP_REGISTRY.map((m) => m.city));
    for (const city of ['Mohali', 'Chandigarh', 'Panchkula', 'New Chandigarh']) {
      expect(cities.has(city), city).toBe(true);
    }
  });
});

describe('token extraction', () => {
  it('reads a sector or phase out of free text', () => {
    expect(extractSectorToken('Sector 78, Mohali')).toBe('78');
    expect(extractSectorToken('Phase 5 Mohali')).toBe('phase 5');
    expect(extractSectorToken('Eco City, New Chandigarh')).toBeNull();
  });

  it('reads the city, preferring the longer name', () => {
    expect(extractCityToken('Eco City, New Chandigarh')).toBe('new chandigarh');
    expect(extractCityToken('Sector 32 Chandigarh')).toBe('chandigarh');
    expect(extractCityToken('sector 34 chd')).toBe('chandigarh');
    expect(extractCityToken('Aerocity, Mohali')).toBe('aerocity');
  });
});

describe('property → map resolution', () => {
  it('finds the right sector sheet for a Chandigarh sector', () => {
    const { sectorMap } = resolvePropertyMaps(
      { city: 'Chandigarh', sector: 'Sector 32, Chandigarh' }, MAP_REGISTRY);
    expect(sectorMap).toBeTruthy();
    expect(sectorMap!.kind).toBe('SECTOR_MAP');
    expect(sectorMap!.city).toBe('Chandigarh');
    expect(sectorMap!.sector).toBe('32');
  });

  it('finds the right sector sheet for a Mohali sector', () => {
    const { sectorMap } = resolvePropertyMaps(
      { city: 'Mohali', sector: 'Sector 78, Mohali' }, MAP_REGISTRY);
    expect(sectorMap?.sector).toBe('78');
    expect(sectorMap?.city).toBe('Mohali');
  });

  it('keeps Chandigarh and Mohali sector 32 apart', () => {
    const chd = resolvePropertyMaps({ city: 'Chandigarh', sector: 'Sector 32' }, MAP_REGISTRY);
    const moh = resolvePropertyMaps({ city: 'Mohali', sector: 'Sector 66' }, MAP_REGISTRY);
    expect(chd.sectorMap?.city).toBe('Chandigarh');
    expect(moh.sectorMap?.city).toBe('Mohali');
    expect(chd.sectorMap?.id).not.toBe(moh.sectorMap?.id);
  });

  it('resolves Panchkula sectors from the nested folder', () => {
    const { sectorMap } = resolvePropertyMaps(
      { city: 'Panchkula', sector: 'Sector 12' }, MAP_REGISTRY);
    expect(sectorMap?.city).toBe('Panchkula');
  });

  it('NEVER substitutes a city masterplan for a missing sector map', () => {
    const result = resolvePropertyMaps(
      { city: 'Chandigarh', sector: 'Sector 999' }, MAP_REGISTRY);
    expect(result.sectorMap).toBeNull();
    expect(result.reason).toBe('no-map-for-sector');
    // The masterplan is returned SEPARATELY, never as the sector map.
    if (result.masterplan) expect(result.masterplan.kind).toBe('MASTERPLAN');
  });

  it('says so truthfully when the property records no sector', () => {
    const result = resolvePropertyMaps({ city: 'Mohali' }, MAP_REGISTRY);
    expect(result.sectorMap).toBeNull();
    expect(result.reason).toBe('no-sector-recorded');
  });

  it('says so truthfully when the property records no city', () => {
    const result = resolvePropertyMaps({ sector: 'Sector 78' }, MAP_REGISTRY);
    expect(result.sectorMap).toBeNull();
    expect(result.masterplan).toBeNull();
    expect(result.reason).toBe('no-city-recorded');
  });

  it('prefers a named project layout over a bare sector sheet', () => {
    const { sectorMap } = resolvePropertyMaps(
      { city: 'Mohali', area: 'JLPL Sector 82', sector: 'Sector 82' }, MAP_REGISTRY);
    expect(sectorMap?.kind).toBe('PROJECT_MAP');
    expect(sectorMap?.project).toBe('jlpl');
  });
});

describe('map placement is never geography', () => {
  it('draws a pin only when an explicit placement exists for THAT map', () => {
    expect(pinForMap('map-a', { mapId: 'map-a', x: 0.5, y: 0.4 })).toEqual({ x: 0.5, y: 0.4 });
    // A placement recorded against a different map must not be reused.
    expect(pinForMap('map-b', { mapId: 'map-a', x: 0.5, y: 0.4 })).toBeNull();
    // No placement at all means no pin — never a centred guess.
    expect(pinForMap('map-a', undefined)).toBeNull();
  });

  it('rejects an out-of-range or malformed placement', () => {
    expect(pinForMap('m', { mapId: 'm', x: 1.4, y: 0.2 })).toBeNull();
    expect(pinForMap('m', { mapId: 'm', x: -0.1, y: 0.2 })).toBeNull();
    expect(pinForMap('m', { mapId: 'm', x: NaN, y: 0.2 })).toBeNull();
  });

  it('exposes no path from a map placement to a latitude/longitude', async () => {
    const registry = await import('../src/packages/maps/registry-types');
    const exported = Object.keys(registry).join(' ').toLowerCase();
    // Nothing in this module converts image x/y into geography.
    expect(exported).not.toMatch(/tolatlng|tocoordinate|geocode|placementtolocation/);
  });
});
