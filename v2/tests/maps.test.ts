/* Map engine pilot: registry, coordinates (no-distortion), cache,
   overlays, and engine lifecycle (single-active, lazy 3D, cancel, cleanup). */
import { describe, it, expect } from 'vitest';
import { getMaps, getMap, renderingFor } from '../src/packages/maps/registry';
import { CoordinateSystem, MAX_ZOOM, cssMapTransform, type Transform } from '../src/packages/maps/coordinates';
import { BoundedCache } from '../src/packages/maps/cache';
import { layoutOverlay, geometryMatches } from '../src/packages/maps/overlay-engine';
import { MapEngine, type RenderSurface } from '../src/packages/maps/map-engine';
import type { LoadedImage, ImagePort } from '../src/packages/maps/loader';

describe('Registry', () => {
  it('exposes the pilot maps and links masterplan ↔ sector', () => {
    expect(getMaps().length).toBe(2);
    const mp = getMap('masterplan-mohali')!;
    expect(mp.linkedMapIds).toContain('sector-mohali-90-91');
    expect(getMap('sector-mohali-90-91')!.linkedMapIds).toContain('masterplan-mohali');
  });
  it('renderingFor falls back easy→original and exposes 3D only when present', () => {
    const mp = getMap('masterplan-mohali')!;
    expect(renderingFor(mp, 'easy')).toBe(mp.original);   // no easy → original
    expect(renderingFor(mp, 'threeD')).toBe(mp.threeD);
    expect(renderingFor(getMap('sector-mohali-90-91')!, 'threeD')).toBeUndefined();
  });
});

describe('CoordinateSystem — never crops or distorts', () => {
  const cs = new CoordinateSystem({ w: 1000, h: 500 });
  const vp = { w: 800, h: 800 };

  it('Fit uses the CONTAIN scale (min ratio) and centers', () => {
    const t = cs.fit(vp);
    expect(t.scale).toBeCloseTo(0.8);            // min(800/1000, 800/500)=0.8
    // fully contained: rendered size ≤ viewport on both axes
    expect(1000 * t.scale).toBeLessThanOrEqual(vp.w + 1e-9);
    expect(500 * t.scale).toBeLessThanOrEqual(vp.h + 1e-9);
    expect(t.ty).toBeCloseTo((800 - 400) / 2);   // vertically centered
  });

  it('initial cover-fit fills every edge with no side gutters', () => {
    const t = cs.cover(vp);
    expect(t.scale).toBeCloseTo(1.6);
    const left = t.tx;
    const right = t.tx + 1000 * t.scale;
    const top = t.ty;
    const bottom = t.ty + 500 * t.scale;
    expect(left).toBeLessThanOrEqual(0);
    expect(right).toBeGreaterThanOrEqual(vp.w);
    expect(top).toBeLessThanOrEqual(0);
    expect(bottom).toBeGreaterThanOrEqual(vp.h);
    expect(t.tx).toBeCloseTo((800 - 1600) / 2);
    expect(t.ty).toBeCloseTo(0);
  });

  it('cover-fit preserves the intrinsic aspect ratio exactly', () => {
    const t = cs.cover(vp);
    const renderedWidth = 1000 * t.scale;
    const renderedHeight = 500 * t.scale;
    expect(renderedWidth / renderedHeight).toBeCloseTo(1000 / 500, 12);
  });

  it('screen↔intrinsic roundtrips exactly', () => {
    const t = cs.fit(vp);
    const p = { x: 321, y: 145 };
    const back = cs.toIntrinsic(cs.toScreen(p, t), t);
    expect(back.x).toBeCloseTo(p.x); expect(back.y).toBeCloseTo(p.y);
  });

  it('zoom clamps at MAX_ZOOM and keeps aspect (uniform scale)', () => {
    const base = cs.fit(vp);
    const z = cs.zoomTo(vp, 99, { x: 400, y: 400 }, base);
    expect(cs.zoomLevel(vp, z)).toBeCloseTo(MAX_ZOOM);
    // uniform scale ⇒ no stretch; width/height ratio preserved
    expect((1000 * z.scale) / (500 * z.scale)).toBeCloseTo(2);
  });

  it('pan never reveals a gutter when zoomed in', () => {
    const zoomed = cs.zoomTo(vp, 4, { x: 400, y: 400 }, cs.fit(vp));
    const panned = cs.clampPan(vp, { scale: zoomed.scale, tx: 99999, ty: 99999 });
    expect(panned.tx).toBeLessThanOrEqual(0);
    expect(panned.ty).toBeLessThanOrEqual(0);
  });
});

describe('BoundedCache (LRU)', () => {
  it('evicts oldest beyond max and calls onEvict', () => {
    const evicted: string[] = [];
    const c = new BoundedCache<string, number>(2, (_v, k) => evicted.push(k));
    c.set('a', 1); c.set('b', 2); c.get('a'); c.set('c', 3); // 'b' is LRU → evicted
    expect(c.size).toBe(2);
    expect(evicted).toEqual(['b']);
    expect(c.has('a')).toBe(true);
    expect(c.has('b')).toBe(false);
  });
});

describe('Overlay engine', () => {
  it('overlays use the exact same scale and translation as raster and pins', () => {
    const transform = { scale: 0.5, tx: 10, ty: 20 };
    const l = layoutOverlay({ w: 1575, h: 1132 }, { w: 1603, h: 1278 }, transform);
    expect(l.width).toBe(1603);
    expect(l.height).toBe(1278);
    expect(l.viewBox).toBe('0 0 1575 1132');
    expect(l.transform).toBe(cssMapTransform(transform));
  });
  it('flags the pilot overlay/raster authoring mismatch as a DATA gap', () => {
    expect(geometryMatches({ w: 1575, h: 1132 }, { w: 1603, h: 1278 })).toBe(false);
  });
});

/* ── engine with fakes (no DOM) ─────────────────────────────── */
function fakeSurface() {
  const calls = { paint: 0, clear: 0, overlays: 0 };
  const surface: RenderSurface = {
    viewport: () => ({ w: 800, h: 600 }),
    paint: () => { calls.paint++; },
    setOverlays: () => { calls.overlays++; },
    clear: () => { calls.clear++; },
  };
  return { surface, calls };
}

function recordingPort() {
  const loaded: string[] = [];
  const port: ImagePort = async (src) => {
    loaded.push(src);
    const img = { el: { src } } as unknown as HTMLImageElement;
    return { src, el: img, width: 100, height: 100 } as LoadedImage;
  };
  return { port, loaded };
}

describe('MapEngine lifecycle', () => {
  it('keeps exactly one active map and lazy-loads only the requested rendering', async () => {
    const { surface } = fakeSurface();
    const { port, loaded } = recordingPort();
    const engine = new MapEngine(surface, { imagePort: port });

    const r1 = await engine.setMap('masterplan-mohali', { mode: 'original' });
    expect(r1.ok).toBe(true);
    expect(engine.activeMapId).toBe('masterplan-mohali');
    // the 3D asset was NOT loaded
    expect(loaded.some((s) => s.includes('3d'))).toBe(false);

    const r2 = await engine.setMap('sector-mohali-90-91');
    expect(r2.ok).toBe(true);
    expect(engine.activeMapId).toBe('sector-mohali-90-91'); // replaced, single active
  });

  it('loads the 3D rendering only when explicitly selected', async () => {
    const { surface } = fakeSurface();
    const { port, loaded } = recordingPort();
    const engine = new MapEngine(surface, { imagePort: port });
    await engine.setMap('masterplan-mohali', { mode: 'threeD' });
    expect(loaded.some((s) => s.includes('mohali-3d'))).toBe(true);
  });

  it('Fit Map returns a covered Masterplan to full contain-fit', async () => {
    const calls: Transform[] = [];
    const surface: RenderSurface = {
      viewport: () => ({ w: 800, h: 600 }),
      paint: (_img, transform) => { calls.push(transform); },
      setOverlays: () => {},
      clear: () => {},
    };
    const { port } = recordingPort();
    const engine = new MapEngine(surface, { imagePort: port });
    await engine.setMap('masterplan-mohali');
    engine.cover();
    const covered = calls.at(-1)!;
    engine.fit();
    const contained = calls.at(-1)!;
    expect(covered.scale).toBeGreaterThan(contained.scale);
    expect(contained.tx).toBeCloseTo((800 - 1302 * contained.scale) / 2);
    expect(contained.ty).toBeCloseTo((600 - 962 * contained.scale) / 2);
    expect(1302 * contained.scale).toBeLessThanOrEqual(800);
    expect(962 * contained.scale).toBeLessThanOrEqual(600);
  });

  it('switches Original → 3D → Original without losing the active map', async () => {
    const { surface } = fakeSurface();
    const { port, loaded } = recordingPort();
    const engine = new MapEngine(surface, { imagePort: port });

    expect((await engine.setMap('masterplan-mohali', { mode: 'original' })).ok).toBe(true);
    engine.cover();
    expect(engine.activeMode).toBe('original');

    expect((await engine.setMode('threeD')).ok).toBe(true);
    expect(engine.activeMode).toBe('threeD');

    expect((await engine.setMode('original')).ok).toBe(true);
    expect(engine.activeMode).toBe('original');
    expect(engine.activeMapId).toBe('masterplan-mohali');
    expect(loaded.some((src) => src.includes('newchandigarh-map'))).toBe(true);
    expect(loaded.some((src) => src.includes('mohali-3d'))).toBe(true);
  });

  it('supersedes a slow load and ignores its stale result', async () => {
    const { surface } = fakeSurface();
    let resolveFirst: (v: LoadedImage) => void = () => {};
    const port: ImagePort = (src) => {
      if (src.includes('masterplan')) {
        return new Promise<LoadedImage>((res) => { resolveFirst = res; });
      }
      return Promise.resolve({ src, el: { src } as HTMLImageElement, width: 1, height: 1 });
    };
    const engine = new MapEngine(surface, { imagePort: port });
    const p1 = engine.setMap('masterplan-mohali');
    const p2 = engine.setMap('sector-mohali-90-91');
    await p2;
    resolveFirst({ src: 'x', el: { src: 'x' } as HTMLImageElement, width: 1, height: 1 });
    const r1 = await p1;
    expect(r1.ok).toBe(false);
    expect(r1.reason).toBe('superseded');
    expect(engine.activeMapId).toBe('sector-mohali-90-91');
  });

  it('returns not-found for unknown maps', async () => {
    const { surface } = fakeSurface();
    const { port } = recordingPort();
    const engine = new MapEngine(surface, { imagePort: port });
    expect((await engine.setMap('nope')).reason).toBe('not-found');
  });

  it('dispose() clears the surface and makes the engine inert', async () => {
    const { surface, calls } = fakeSurface();
    const { port } = recordingPort();
    const engine = new MapEngine(surface, { imagePort: port });
    await engine.setMap('masterplan-mohali');
    engine.dispose();
    expect(engine.activeMapId).toBeNull();
    expect(calls.clear).toBeGreaterThan(0);
    expect((await engine.setMap('masterplan-mohali')).reason).toBe('disposed');
  });
});
