// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { adapter, toClientSafeProperty } from '../src/packages/data/mock-adapter-v2';
import type { Property } from '../src/packages/data/types';
import {
  coordinateValidationError,
  createPropertyLocation,
  normalizePropertyLocation,
  propertyLocationPoint,
  resolvePropertyPoint,
} from '../src/packages/data/property-location';
import { streetViewUrl } from '../src/packages/ui/utils';
import {
  allProperties,
  locationSource,
  propertyPos,
  type Property as EarthProperty,
} from '../src/apps/earth/config';
import { geographicOriginForProperty } from '../src/apps/earth/main';
import { locationAnalysisKey, roadAdvantagesFor } from '../src/apps/earth/location-advantage';

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: `property-location-${Date.now()}-${Math.random()}`,
    type: 'Residential Plot',
    want: 'Plot',
    city: 'Mohali',
    area: 'Test plot',
    loc: 'Test plot, Mohali',
    sector: 'Test plot',
    size: '300 sq yd',
    facing: 'East',
    position: 'Corner plot',
    approvals: [],
    landmarks: [],
    price: 1,
    photos: [],
    published: false,
    sold: false,
    views: 0,
    ...overrides,
  };
}

function earthProperty(record: Property, legacy?: { lat: number; lng: number }): EarthProperty {
  return {
    id: record.id,
    tag: 'P-TEST',
    plotNo: record.area,
    sector: record.sector,
    city: record.city,
    size: record.size,
    facing: record.facing,
    road: record.position,
    type: record.type,
    price: 'Add price',
    ppu: '—',
    dims: '—',
    approval: '—',
    ownership: '—',
    possession: '—',
    pos: legacy,
    photos: [],
    canonicalRecord: record,
  };
}

describe('canonical property location model', () => {
  it('validates finite coordinate ranges and rejects string/NaN garbage', () => {
    expect(coordinateValidationError(30.6889, 76.7361)).toBeNull();
    expect(coordinateValidationError(-90, 180)).toBeNull();
    expect(coordinateValidationError(91, 76)).toMatch(/latitude/);
    expect(coordinateValidationError(30, -181)).toMatch(/longitude/);
    expect(coordinateValidationError(Number.NaN, 76)).toMatch(/finite/);
    expect(coordinateValidationError('30', 76)).toMatch(/finite/);
  });

  it('retains exact numeric precision through model and repository serialization', async () => {
    const latitude = 30.6889123456789;
    const longitude = 76.7361123456789;
    const draft = property({
      location: createPropertyLocation(
        { latitude, longitude, source: 'manually-verified' },
        '2026-08-11T09:30:00.000Z',
      ),
    });
    const saved = await adapter.properties.save(draft);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.location?.latitude).toBe(latitude);
    expect(saved.value.location?.longitude).toBe(longitude);
    const loaded = await adapter.properties.get(draft.id);
    expect(loaded.ok && loaded.value.location).toEqual(draft.location);
  });

  it('makes canonical coordinates win over every legacy Earth point', () => {
    const canonical = property({
      location: createPropertyLocation({ latitude: 30.700001, longitude: 76.700002 }),
    });
    const legacy = { lat: 31, lng: 77 };
    expect(resolvePropertyPoint(canonical, legacy)).toEqual({ lat: 30.700001, lng: 76.700002 });
    expect(propertyPos(earthProperty(canonical, legacy))).toEqual({ lat: 30.700001, lng: 76.700002 });
  });

  it('allows a valid compatibility fallback but never fabricates an unknown point', () => {
    const old = property();
    expect(resolvePropertyPoint(old, { lat: 30.71, lng: 76.72 })).toEqual({ lat: 30.71, lng: 76.72 });
    expect(resolvePropertyPoint(old, null)).toBeNull();
    expect(resolvePropertyPoint(old, { lat: 999, lng: 999 })).toBeNull();
    expect(normalizePropertyLocation({ latitude: '30', longitude: 76 })).toBeUndefined();
  });

  it('atomically updates and clears a repository location without breaking old rows', async () => {
    const draft = property();
    expect((await adapter.properties.save(draft)).ok).toBe(true);
    const point = { latitude: 30.712345678901, longitude: 76.723456789012, source: 'dealer-selected' as const };
    const updated = await adapter.properties.setLocation(draft.id, point);
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(propertyLocationPoint(updated.value.location)).toEqual({ lat: point.latitude, lng: point.longitude });
    const cleared = await adapter.properties.setLocation(draft.id, null);
    expect(cleared.ok && cleared.value.location).toBeUndefined();
  });

  it('rejects malformed locations at the repository write boundary', async () => {
    const invalid = property({
      location: { latitude: Number.NaN, longitude: 76 } as Property['location'],
    });
    const result = await adapter.properties.save(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });
});

describe('geographic consumers', () => {
  it('feeds Earth markers, Street View, Location Advantage, and Roads one canonical origin', async () => {
    const latitude = 30.6999912345;
    const longitude = 76.7333312345;
    const draft = property({ location: createPropertyLocation({ latitude, longitude }) });
    expect((await adapter.properties.save(draft)).ok).toBe(true);
    await locationSource.load();
    const earth = allProperties().find((candidate) => candidate.id === draft.id)!;
    const origin = geographicOriginForProperty(earth);
    expect(origin).toEqual({ lat: latitude, lng: longitude });
    expect(propertyPos(earth)).toEqual(origin); // marker position
    expect(streetViewUrl(earth.canonicalRecord!.location!)).toContain(`viewpoint=${latitude},${longitude}`);
    expect(roadAdvantagesFor(origin!, 'residential').every((road) => road.distanceMeters >= 0)).toBe(true);
  });

  it('changes the analysis identity for any exact coordinate change', () => {
    const first = locationAnalysisKey('p1', { lat: 30.70000001, lng: 76.7 }, 'residential');
    const moved = locationAnalysisKey('p1', { lat: 30.70000002, lng: 76.7 }, 'residential');
    expect(moved).not.toBe(first);
  });

  it('uses canonical coordinates in dealer presentation without exposing them in client-safe links', () => {
    const canonical = createPropertyLocation({ latitude: 30.688912345, longitude: 76.736112345 });
    expect(streetViewUrl(canonical)).toBe(
      'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.688912345,76.736112345',
    );
    const safe = toClientSafeProperty(property({ location: canonical }), { price: true, location: true });
    expect('location' in safe).toBe(false);
    expect('latitude' in safe).toBe(false);
    expect('longitude' in safe).toBe(false);
  });
});

describe('migration and tenant boundary', () => {
  const migration = readFileSync(
    join(process.cwd(), '..', 'supabase', 'migrations', '20260811000100_canonical_property_location.sql'),
    'utf8',
  );
  const verifier = readFileSync(
    join(process.cwd(), '..', 'supabase', 'verification', 'verify-isolation.js'),
    'utf8',
  );

  it('stores location on the existing property payload and leaves mapPlacement separate', () => {
    expect(migration).toContain("'{location}'");
    expect(migration).toContain("entity_type = 'properties'");
    expect(migration).toContain('mapPlacement{x,y} remains an independent');
    expect(migration).not.toContain("'{mapPlacement}'");
  });

  it('does not promote legacy fixtures or inferred points into canonical locations', () => {
    expect(migration).not.toContain('legacy_location');
    expect(migration).not.toContain('30.6889');
    expect(migration).toContain('No fixture, centroid, or inferred');
  });

  it('keeps the writer behind authenticated dealer RLS and verifies anon denial', () => {
    expect(migration).toContain('security invoker');
    expect(migration).toContain('public.plotmap_current_dealer_id()');
    expect(migration).toMatch(/revoke all[\s\S]+from public, anon/);
    expect(migration).toMatch(/grant execute[\s\S]+to authenticated/);
    expect(verifier).toContain('anon cannot set property locations');
  });
});
