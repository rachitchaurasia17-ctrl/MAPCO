/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Map Engine (lifecycle controller)
   ---------------------------------------------------------------
   Reusable across Client Presentation, Map Studio and Client Links.
   Guarantees:
     • exactly ONE primary map/rendering active at a time
     • the 3D rendering is loaded only when explicitly selected
     • obsolete loads are cancelled; stale async results are ignored
     • dispose() releases image refs, overlays, listeners and cache
   Preserves geometry via CoordinateSystem — never crops/stretches.
   ═══════════════════════════════════════════════════════════════ */

import { getMap, renderingFor, type MapEntry, type RenderMode } from './registry';
import { CoordinateSystem, type Transform, type Viewport, type Point } from './coordinates';
import { layoutOverlay, type OverlayLayout } from './overlay-engine';
import { MapImageLoader, type ImagePort, type LoadedImage } from './loader';
import type { PriorityLoader, ResourceScope } from '../performance';

export interface OverlayRender {
  readonly id: string;
  readonly src: string;
  readonly layout: OverlayLayout;
}

/** The rendering target. A DOM implementation lives in dom-surface.ts;
 *  tests inject a fake to assert engine behaviour without a browser. */
export interface RenderSurface {
  viewport(): Viewport;
  paint(img: LoadedImage, transform: Transform): void;
  setOverlays(overlays: readonly OverlayRender[]): void;
  clear(): void;
}

export interface SetMapResult {
  readonly ok: boolean;
  readonly mapId?: string;
  readonly mode?: RenderMode;
  readonly reason?: 'not-found' | 'no-rendering' | 'load-failed' | 'superseded' | 'disposed';
}

export class MapEngine {
  private readonly loader: MapImageLoader;
  private token = 0;
  private disposed = false;
  private viewportFit: 'contain' | 'cover' = 'contain';

  private active: {
    entry: MapEntry;
    mode: RenderMode;
    coords: CoordinateSystem;
    transform: Transform;
    img: LoadedImage;
  } | null = null;

  constructor(
    private readonly surface: RenderSurface,
    opts: { imagePort?: ImagePort; maxCached?: number; priorityLoader?: PriorityLoader; scope?: ResourceScope; loaderGroup?: string } = {},
  ) {
    this.loader = new MapImageLoader(opts.imagePort, opts.maxCached ?? 3,
      opts.priorityLoader && opts.scope
        ? { loader: opts.priorityLoader, scope: opts.scope, group: opts.loaderGroup ?? 'map-engine' }
        : undefined);
  }

  get activeMapId(): string | null { return this.active?.entry.id ?? null; }
  get activeMode(): RenderMode | null { return this.active?.mode ?? null; }
  get transform(): Transform | null { return this.active?.transform ?? null; }

  /**
   * Make `id` (in `mode`) the single active rendering. Cancels any in-flight
   * load, clears the previous rendering, and ignores its own result if a
   * newer setMap superseded it.
   */
  async setMap(id: string, opts: { mode?: RenderMode } = {}): Promise<SetMapResult> {
    if (this.disposed) return { ok: false, reason: 'disposed' };
    const mode: RenderMode = opts.mode ?? 'original';
    const entry = getMap(id);
    if (!entry) return { ok: false, reason: 'not-found' };
    const rendering = renderingFor(entry, mode);
    if (!rendering) return { ok: false, reason: 'no-rendering' };

    const myToken = ++this.token;
    // release the previous active rendering immediately (single active).
    this.active = null;
    this.surface.clear();

    let img: LoadedImage;
    try {
      img = await this.loader.load(rendering.src, undefined, {
        resourceId: `${entry.id}:${mode}`,
        version: rendering.src,
        estimatedBytes: Math.min(rendering.dims.w * rendering.dims.h, 6 * 1024 * 1024),
        reason: mode === 'threeD' ? 'dealer explicitly selected real 3D' : 'current visible Original map',
      });
    } catch {
      // aborted (superseded) or genuine failure
      if (myToken !== this.token) return { ok: false, reason: 'superseded' };
      return { ok: false, reason: 'load-failed' };
    }
    if (myToken !== this.token || this.disposed) return { ok: false, reason: 'superseded' };

    const coords = new CoordinateSystem(rendering.dims);
    const transform = this.viewportFit === 'cover'
      ? coords.cover(this.surface.viewport())
      : coords.fit(this.surface.viewport());
    this.active = { entry, mode, coords, transform, img };
    this.loader.protect({ resourceId: `${entry.id}:${mode}`, version: rendering.src }, true);
    this.paint();
    return { ok: true, mapId: id, mode };
  }

  /** Switch rendering mode (original / easy / threeD) of the active map. */
  setMode(mode: RenderMode): Promise<SetMapResult> {
    if (!this.active) return Promise.resolve({ ok: false, reason: 'not-found' });
    return this.setMap(this.active.entry.id, { mode });
  }

  fit(): void {
    if (!this.active) return;
    this.viewportFit = 'contain';
    this.active.transform = this.active.coords.fit(this.surface.viewport());
    this.paint();
  }

  /** Fill the viewport without distortion; overflow remains pannable. */
  cover(): void {
    if (!this.active) return;
    this.viewportFit = 'cover';
    this.active.transform = this.active.coords.cover(this.surface.viewport());
    this.paint();
  }

  /** Recalculate the active fit policy after a viewport resize. */
  resize(): void {
    if (!this.active) return;
    this.active.transform = this.viewportFit === 'cover'
      ? this.active.coords.cover(this.surface.viewport())
      : this.active.coords.fit(this.surface.viewport());
    this.paint();
  }

  zoom(factor: number, anchor?: Point): void {
    if (!this.active) return;
    const vp = this.surface.viewport();
    const a = anchor ?? { x: vp.w / 2, y: vp.h / 2 };
    const level = this.active.coords.zoomLevel(vp, this.active.transform);
    this.active.transform = this.active.coords.zoomTo(vp, level * factor, a, this.active.transform);
    this.paint();
  }

  pan(dx: number, dy: number): void {
    if (!this.active) return;
    const t = this.active.transform;
    this.active.transform = this.active.coords.clampPan(this.surface.viewport(), { scale: t.scale, tx: t.tx + dx, ty: t.ty + dy });
    this.paint();
  }

  /** Gently center + zoom onto an intrinsic-coordinate rectangle (e.g. a
   *  spotlighted SVG sector). Aspect-preserving, clamped so no gutter shows. */
  focusOn(rect: { x: number; y: number; w: number; h: number }, opts: { maxZoom?: number; pad?: number } = {}): void {
    if (!this.active || rect.w <= 0 || rect.h <= 0) return;
    const vp = this.surface.viewport();
    const base = this.active.coords.baseScale(vp);
    const pad = opts.pad ?? 0.72;                       // leave breathing room
    const fitZoom = Math.min(vp.w / (rect.w * base), vp.h / (rect.h * base)) * pad;
    const z = Math.max(1, Math.min(fitZoom, opts.maxZoom ?? 3));
    const scale = base * z;
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    this.active.transform = this.active.coords.clampPan(vp, { scale, tx: vp.w / 2 - cx * scale, ty: vp.h / 2 - cy * scale });
    this.paint();
  }

  private paint(): void {
    if (!this.active) return;
    const { img, transform, coords, entry, mode } = this.active;
    this.surface.paint(img, transform);
    const overlays: OverlayRender[] = entry.overlays
      .filter((o) => o.appliesTo === mode)
      .map((o) => ({ id: o.id, src: o.src, layout: layoutOverlay(o.viewBox, coords.dims, transform) }));
    this.surface.setOverlays(overlays);
  }

  /** Release everything. The engine is inert afterwards. */
  dispose(): void {
    this.disposed = true;
    this.token++;                 // invalidate any in-flight setMap
    this.active = null;
    this.loader.dispose();        // cancels load, releases cached image refs
    this.surface.clear();
  }
}
