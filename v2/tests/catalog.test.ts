/* Backend map catalog → engine registry bridge. */
import { describe, it, expect } from 'vitest';
import { mapEntryFromData, registerMaps, getMaps, getMap, type MapCatalogInput } from '../src/packages/maps';

const full: MapCatalogInput = {
  id: 'cat-mohali-master', kind: 'masterplan', city: 'Mohali', area: 'Master Plan', label: 'Mohali — Master Plan',
  raster: 'https://x.supabase.co/maps/mohali/master-original.png',
  dims: { original: { w: 1600, h: 1278 } },
  assets: {
    original: { path: 'https://x/mohali-original.png', w: 1600, h: 1278 },
    threeD: { path: 'https://x/mohali-3d.png', w: 1448, h: 1086 },
    overlay: { path: 'https://x/mohali-overlay.svg', w: 1600, h: 1278 },
  },
  linkedProperties: ['ecocity'],
};

describe('mapEntryFromData', () => {
  it('converts a full record with original + 3D + overlay', () => {
    const e = mapEntryFromData(full)!;
    expect(e.id).toBe('cat-mohali-master');
    expect(e.original.src).toContain('original.png');
    expect(e.original.dims).toEqual({ w: 1600, h: 1278 });
    expect(e.threeD?.src).toContain('3d.png');
    // The authored SVG is exposed as a single inline overlay (not flat-rendered),
    // and is NOT added to `overlays` (which the engine would flat-render).
    expect(e.overlays).toHaveLength(0);
    expect(e.overlay?.src).toContain('overlay.svg');
    expect(e.overlay?.viewBox).toEqual({ w: 1600, h: 1278 });
    expect(e.linkedPropertyIds).toEqual(['ecocity']);
  });

  it('marks an aligned overlay (viewBox === raster) as calibrated', () => {
    const e = mapEntryFromData({ ...full, calibration: { status: 'calibrated', overlayViewBox: { w: 1600, h: 1278 } } })!;
    expect(e.calibration?.status).toBe('calibrated');
    expect(e.overlay?.status).toBe('calibrated');
  });

  it('omits 3D and the overlay when absent', () => {
    const e = mapEntryFromData({ id: 's1', kind: 'sector', city: 'Mohali', label: 'S1',
      assets: { original: { path: 'https://x/s1.png', w: 800, h: 600 } } })!;
    expect(e.threeD).toBeUndefined();
    expect(e.overlays).toHaveLength(0);
    expect(e.overlay).toBeUndefined();
  });

  it('links a sector to its parent masterplan', () => {
    const e = mapEntryFromData({ id: 's2', kind: 'sector', city: 'Mohali', label: 'S2', parentMapId: 'cat-mohali-master',
      assets: { original: { path: 'https://x/s2.png', w: 800, h: 600 } } })!;
    expect(e.linkedMapIds).toEqual(['cat-mohali-master']);
  });

  it('returns null for a missing raster (missing-asset)', () => {
    expect(mapEntryFromData({ id: 'z', kind: 'sector', city: 'X', label: 'Z' })).toBeNull();
  });

  it('returns null for unknown/zero dimensions (never distort)', () => {
    expect(mapEntryFromData({ id: 'z2', kind: 'sector', city: 'X', label: 'Z2',
      assets: { original: { path: 'https://x/z2.png' } } })).toBeNull();
  });
});

describe('registerMaps (additive, idempotent)', () => {
  it('adds new entries and is idempotent', () => {
    const before = getMaps().length;
    const added1 = registerMaps([full]);
    expect(added1).toHaveLength(1);
    expect(getMaps().length).toBe(before + 1);
    const added2 = registerMaps([full]); // duplicate id
    expect(added2).toHaveLength(0);
    expect(getMaps().length).toBe(before + 1);
    expect(getMap('cat-mohali-master')?.threeD?.src).toContain('3d.png');
  });

  it('never replaces a locked pilot entry', () => {
    const pilot = getMap('masterplan-mohali');
    expect(pilot).toBeTruthy();
    registerMaps([{ id: 'masterplan-mohali', kind: 'masterplan', city: 'Hacked', label: 'Hacked',
      assets: { original: { path: 'https://evil/x.png', w: 10, h: 10 } } }]);
    expect(getMap('masterplan-mohali')?.title).toBe(pilot!.title); // unchanged
  });

  it('skips invalid entries in a batch', () => {
    const added = registerMaps([
      { id: 'ok-1', kind: 'sector', city: 'Mohali', label: 'OK', assets: { original: { path: 'https://x/ok.png', w: 100, h: 100 } } },
      { id: 'bad-1', kind: 'sector', city: 'Mohali', label: 'Bad' }, // no raster
    ]);
    expect(added.map((e) => e.id)).toEqual(['ok-1']);
  });
});
