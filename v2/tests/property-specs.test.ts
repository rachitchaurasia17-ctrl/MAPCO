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
    const specs = normalizePropertySpecs('Kothi', { approvalNote: 'x'.repeat(400) });
    expect((specs!.approvalNote as string).length).toBe(240);
  });

  it('has dropped the second-road and duplicate dimension fields', () => {
    // The spec sheet asks for one road width and one frontage/depth pair.
    // A key nobody can enter must not survive in the persisted model.
    for (const key of ['road2', 'facing2', 'dimFront', 'dimBack', 'dimLeft', 'dimRight',
      'cornerCut', 'floorPlan']) {
      expect(ALL_PROPERTY_SPEC_KEYS).not.toContain(key);
    }
  });

  it('asks every commercial and industrial kind its own questions', () => {
    // Before the spec sheet was rebuilt these four kinds shared one generic
    // field list, so an office was never asked about cabins or a server room
    // and an industrial plot was never asked its power load.
    expect(propertySpecKeys('Office')).toContain('cabins');
    expect(propertySpecKeys('Office')).toContain('serverRoom');
    expect(propertySpecKeys('Industrial Plot')).toContain('powerLoad');
    expect(propertySpecKeys('Industrial Plot')).toContain('shedArea');
    expect(propertySpecKeys('Showroom')).toContain('groundAccess');
    expect(propertySpecKeys('Commercial Booth')).toContain('parkingAccess');
    expect(propertySpecKeys('Commercial SCO')).toContain('twoSide');
    // …and none of them borrows another's.
    expect(propertySpecKeys('Commercial Booth')).not.toContain('cabins');
    expect(propertySpecKeys('Residential Plot')).not.toContain('powerLoad');
  });

  it('persists the super area a flat is actually sold on', () => {
    // The form has always asked for it; it used to be thrown away on save.
    expect(propertySpecKeys('Flat')).toContain('superArea');
    expect(normalizePropertySpecs('Flat', { superArea: '1850' })).toEqual({ superArea: '1850' });
  });

  it('reports which keys a type change would invalidate', () => {
    // A flat is asked its BHK configuration; a plot has no such question.
    expect(staleSpecKeys('Residential Plot', { config: '3 BHK', frontage: '30' })).toEqual(['config']);
    expect(staleSpecKeys('Flat', { config: '3 BHK' })).toEqual([]);
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
      specs: { config: '3 BHK', baths: '2', floor: 'Second' },
    }));
    expect(asFlat.ok).toBe(true);
    if (asFlat.ok) expect(asFlat.value.specs).toMatchObject({ config: '3 BHK' });

    // The dealer switches the type. A BHK configuration is meaningless on a
    // plot and must not survive.
    const asPlot = await adapter.properties.save({
      ...(asFlat.ok ? asFlat.value : property(id)),
      type: 'Residential Plot', want: 'Plot',
      specs: { ...(asFlat.ok ? asFlat.value.specs : {}), frontage: '30' },
    });
    expect(asPlot.ok).toBe(true);
    if (asPlot.ok) {
      expect(asPlot.value.specs).toEqual({ frontage: '30' });
      expect(asPlot.value.specs).not.toHaveProperty('config');
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
