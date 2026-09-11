/*
 * `location.updatedAt` is a relocation marker, not a save timestamp.
 *
 * Property Intelligence folds it into its cache digest, so a fresh value means
 * "this property is somewhere else now — throw the intelligence away and
 * generate it again". That regeneration is a paid round of Places, Routes and
 * model calls, with a ₹40 ceiling.
 *
 * So the marker has to move when, and only when, the property does.
 */
import { describe, expect, it } from 'vitest';
import { toCanonicalProperty } from '../src/apps/dealer/desk-store';
import { cacheKeyString } from '../src/packages/property-intelligence/cache-key';
import type { Property } from '../src/packages/data/types';

const AT = '2026-09-01T10:00:00.000Z';

const saved = (over: Partial<Property> = {}): Property => ({
  id: 'p1', type: 'Residential Plot', want: 'Plot', city: 'Mohali', area: 'Sector 91',
  loc: 'Sector 91, Mohali', sector: '91', size: '250 sq yd', facing: 'East',
  position: 'Corner plot', approvals: [], landmarks: [], price: 7500000,
  photos: [], published: true, sold: false,
  location: { latitude: 30.704649, longitude: 76.717873, source: 'dealer-selected', updatedAt: AT },
  ...over,
} as unknown as Property);

/** The form as openEdit() rebuilds it from a saved property. */
const reopened = (over: Record<string, unknown> = {}) => ({
  type: 'Residential Plot', city: 'Mohali', area: 'Sector 91', sector: '91',
  size: '250', unit: 'sq yd', facing: 'East', corner: true, price: '0.75',
  earth: true, pinSet: true, lat: 30.704649, lng: 76.717873,
  ...over,
});

describe('the relocation marker', () => {
  it('does not move when the dealer edits something else', () => {
    // A dealer correcting a price was paying for a full intelligence rebuild.
    const before = saved();
    const after = toCanonicalProperty(reopened({ price: '0.80' }) as never, before, 'p1');

    expect(after.location?.updatedAt).toBe(AT);
    expect(after.price).toBe(8000000);
  });

  it('survives a save that rounds to the same spot', () => {
    const before = saved();
    // Google hands back more precision than the record stores.
    const after = toCanonicalProperty(
      reopened({ lat: 30.7046494321, lng: 76.7178731234 }) as never, before, 'p1');

    expect(after.location?.updatedAt).toBe(AT);
  });

  it('moves when the dealer actually moves the pin', () => {
    const before = saved();
    const after = toCanonicalProperty(
      reopened({ lat: 30.712, lng: 76.723 }) as never, before, 'p1');

    expect(after.location?.updatedAt).not.toBe(AT);
    expect(after.location?.latitude).toBe(30.712);
    expect(after.location?.longitude).toBe(76.723);
  });

  it('is what decides whether the cached intelligence still belongs to this property', () => {
    const point = { latitude: 30.704649, longitude: 76.717873 };
    const common = {
      dealerId: 'd1', propertyId: 'p1', point, provider: 'vertex-gemini', model: 'm',
      pipelineVersion: 'v1', phase1PromptVersion: 'p1', phase2PromptVersion: 'p2',
    };
    const unmoved = cacheKeyString({ ...common, locationUpdatedAt: AT });
    const again = cacheKeyString({ ...common, locationUpdatedAt: AT });
    const moved = cacheKeyString({ ...common, locationUpdatedAt: '2026-09-12T09:00:00.000Z' });

    expect(again).toBe(unmoved);
    expect(moved).not.toBe(unmoved);
  });

  it('still refuses to invent a location the dealer never confirmed', () => {
    const fresh = toCanonicalProperty(
      { type: 'Residential Plot', city: 'Mohali', area: 'Sector 91', earth: false, lat: 30.7, lng: 76.7 } as never,
      undefined, 'p2');
    expect(fresh.location).toBeUndefined();
  });

  it('never erases a confirmed location because a later pin was not confirmed', () => {
    const before = saved();
    const after = toCanonicalProperty(reopened({ earth: false }) as never, before, 'p1');
    expect(after.location?.updatedAt).toBe(AT);
    expect(after.location?.latitude).toBe(30.704649);
  });
});
