import { describe, expect, it } from 'vitest';
import { mapEntryFromData, placementVisibleOn, relatedMapPair } from '../src/packages/maps';

const master = mapEntryFromData({
  id: 'master-a', kind: 'masterplan', city: 'City A', label: 'Master A',
  assets: {
    original: { path: '/master-a.png', w: 1000, h: 800 },
    threeD: { path: '/master-a-3d.png', w: 1200, h: 900 },
  },
})!;
const sector = mapEntryFromData({
  id: 'sector-a', kind: 'sector', city: 'City A', label: 'Sector A', parentMapId: master.id,
  assets: { original: { path: '/sector-a.png', w: 800, h: 600 } },
})!;
const unrelated = mapEntryFromData({
  id: 'master-b', kind: 'masterplan', city: 'City B', label: 'Master B',
  assets: { original: { path: '/master-b.png', w: 900, h: 700 } },
})!;

describe('exact map relationships and placement association', () => {
  it('resolves property sector to its explicit parent masterplan only', () => {
    expect(relatedMapPair([unrelated, master, sector], sector.id)).toEqual({ sector, masterplan: master });
    expect(relatedMapPair([unrelated, sector], sector.id)).toEqual({ sector });
    expect(relatedMapPair([unrelated, master], 'missing-sector')).toBeNull();
  });

  it('never reuses a pin across maps or from Original onto 3D', () => {
    const pin = { mapId: sector.id };
    expect(placementVisibleOn(pin, sector, 'original')).toBe(true);
    expect(placementVisibleOn(pin, master, 'original')).toBe(false);
    expect(placementVisibleOn(pin, sector, 'threeD')).toBe(false);
  });

  it('exposes 3D only on the map that has a real 3D asset', () => {
    expect(master.threeD?.src).toBe('/master-a-3d.png');
    expect(sector.threeD).toBeUndefined();
  });
});
