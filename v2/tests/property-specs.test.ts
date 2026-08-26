import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import type { Property } from '../src/packages/data/types';
import {
  propertyKindOf,
  propertySpecKeys,
  normalizePropertySpecs,
  staleSpecKeys,
  PROPERTY_SPEC_KEYS,
  ALL_PROPERTY_SPEC_KEYS,
} from '../src/packages/data/property-specs';

function property(id: string, overrides: Partial<Property> = {}): Property {
  return {
    id, type: 'Residential Plot', want: 'Plot', city: 'Mohali', area: 'Spec test',
    loc: 'Spec test, Mohali', sector: '92', size: '300 sq yd', facing: 'East',
    position: 'Inside', approvals: [], landmarks: [], price: 9000000, photos: [],
    published: false, sold: false, lifecycle: 'draft', views: 0, ...overrides,
  };
}

describe('adaptive property specification model', () => {
  it('maps every supported property type to a specification kind', () => {
    expect(propertyKindOf('Residential Plot')).toBe('plot');
    expect(propertyKindOf('Industrial Plot')).toBe('indplot');
    expect(propertyKindOf('Flat')).toBe('flat');
    expect(propertyKindOf('Builder Floor')).toBe('bfloor');
    expect(propertyKindOf('Kothi')).toBe('kothi');
    expect(propertyKindOf('Villa')).toBe('villa');
    expect(propertyKindOf('Commercial SCO')).toBe('sco');
    expect(propertyKindOf('Commercial Booth')).toBe('booth');
    expect(propertyKindOf('Office')).toBe('office');
    expect(propertyKindOf('Showroom')).toBe('showroom');
  });

  it('resolves industrial before the generic plot rule', () => {
    // 'Industrial Plot' contains 'plot'; order decides correctness.
    expect(propertyKindOf('Industrial Plot')).not.toBe('plot');
  });

  it('gives all ten kinds a non-empty field set', () => {
    const kinds = Object.keys(PROPERTY_SPEC_KEYS);
    expect(kinds).toHaveLength(10);
    for (const kind of kinds) {
      expect(PROPERTY_SPEC_KEYS[kind as keyof typeof PROPERTY_SPEC_KEYS].length).toBeGreaterThan(0);
    }
    expect(ALL_PROPERTY_SPEC_KEYS.length).toBeGreaterThan(80);
  });

  it('keeps only the keys the current kind accepts', () => {
    const specs = normalizePropertySpecs('Residential Plot', {
      frontage: '30', depth: '75', beds: '3', cabins: '4',
    });
    expect(specs).toEqual({ frontage: '30', depth: '75' });
  });

  it('drops values the dealer never entered but keeps an explicit false', () => {
    const specs = normalizePropertySpecs('Residential Plot', {
      frontage: '  ', road: null, plotNo: undefined, corner: false, parkFacing: true,
    });
    expect(specs).toEqual({ corner: false, parkFacing: true });
  });

  it('returns undefined rather than an empty object when nothing survives', () => {
    expect(normalizePropertySpecs('Flat', { cabins: '4' })).toBeUndefined();
    expect(normalizePropertySpecs('Flat', {})).toBeUndefined();
    expect(normalizePropertySpecs('Flat', null)).toBeUndefined();
  });

  it('bounds free text so a spec sheet cannot bloat the payload', () => {
    const specs = normalizePropertySpecs('Kothi', { floorPlan: 'x'.repeat(400) });
    expect((specs!.floorPlan as string).length).toBe(240);
  });

  it('reports which keys a type change would invalidate', () => {
    expect(staleSpecKeys('Residential Plot', { beds: '3', frontage: '30' })).toEqual(['beds']);
    expect(staleSpecKeys('Flat', { beds: '3' })).toEqual([]);
  });
});

describe('specification persistence', () => {
  it('round-trips type-specific specs through a save', async () => {
    const id = `spec-roundtrip-${Date.now()}`;
    const saved = await adapter.properties.save(property(id, {
      type: 'Residential Plot',
      specs: { frontage: '30', depth: '75', corner: true, openSides: 'Two side' },
    }));
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.value.specs).toEqual({
        frontage: '30', depth: '75', corner: true, openSides: 'Two side',
      });
    }

    const read = await adapter.properties.get(id);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.specs).toMatchObject({ frontage: '30', corner: true });
    await adapter.properties.remove(id);
  });

  it('drops stale specifications when the property type changes', async () => {
    const id = `spec-type-change-${Date.now()}`;
    const asFlat = await adapter.properties.save(property(id, {
      type: 'Flat', want: 'Flat',
      specs: { beds: '3', baths: '2', floor: 'Second' },
    }));
    expect(asFlat.ok).toBe(true);
    if (asFlat.ok) expect(asFlat.value.specs).toMatchObject({ beds: '3' });

    // The dealer switches the type. Bedroom counts are meaningless on a plot
    // and must not survive.
    const asPlot = await adapter.properties.save({
      ...(asFlat.ok ? asFlat.value : property(id)),
      type: 'Residential Plot', want: 'Plot',
      specs: { ...(asFlat.ok ? asFlat.value.specs : {}), frontage: '30' },
    });
    expect(asPlot.ok).toBe(true);
    if (asPlot.ok) {
      expect(asPlot.value.specs).toEqual({ frontage: '30' });
      expect(asPlot.value.specs).not.toHaveProperty('beds');
      expect(asPlot.value.specs).not.toHaveProperty('floor');
    }
    await adapter.properties.remove(id);
  });

  it('leaves a property with no specifications absent rather than empty', async () => {
    const id = `spec-absent-${Date.now()}`;
    const saved = await adapter.properties.save(property(id));
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.value.specs).toBeUndefined();
    await adapter.properties.remove(id);
  });
});
