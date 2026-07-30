/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — DOM RenderSurface + interaction mount
   ---------------------------------------------------------------
   The browser implementation of RenderSurface plus a helper that
   wires pointer-drag pan and wheel zoom with FULL listener cleanup.
   ═══════════════════════════════════════════════════════════════ */

import { MapEngine, type RenderSurface, type OverlayRender } from './map-engine';
import { cssMapTransform, type Transform, type Viewport } from './coordinates';
import type { LoadedImage } from './loader';

export class DomRenderSurface implements RenderSurface {
  private readonly imgEl: HTMLImageElement;
  private readonly overlayLayer: HTMLDivElement;

  constructor(private readonly root: HTMLElement) {
    root.style.position = 'relative';
    root.style.overflow = 'hidden';
    root.style.touchAction = 'none';
    this.imgEl = document.createElement('img');
    this.imgEl.alt = '';
    this.imgEl.draggable = false;
    this.imgEl.style.cssText = 'position:absolute;top:0;left:0;transform-origin:0 0;user-select:none;pointer-events:none;max-width:none';
    this.overlayLayer = document.createElement('div');
    this.overlayLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    root.append(this.imgEl, this.overlayLayer);
  }

  viewport(): Viewport {
    return { w: this.root.clientWidth || 1, h: this.root.clientHeight || 1 };
  }

  paint(img: LoadedImage, t: Transform): void {
    if (this.imgEl.src !== img.el.src) this.imgEl.src = img.el.src;
    this.imgEl.width = img.width;
    this.imgEl.height = img.height;
    this.imgEl.style.transform = cssMapTransform(t);
  }

  setOverlays(overlays: readonly OverlayRender[]): void {
    this.overlayLayer.replaceChildren(
      ...overlays.map((o) => {
        const el = document.createElement('img');
        el.src = o.src;
        el.alt = '';
        el.style.cssText =
          `position:absolute;top:0;left:0;transform-origin:0 0;pointer-events:none;` +
          `width:${o.layout.width}px;height:${o.layout.height}px;transform:${o.layout.transform}`;
        return el;
      }),
    );
  }

  clear(): void {
    this.imgEl.removeAttribute('src');
    this.overlayLayer.replaceChildren();
  }
}

export interface MountedMap {
  readonly engine: MapEngine;
  /** removes all listeners and disposes the engine. */
  dispose(): void;
}

/** Mount an interactive map engine onto a container, returning a disposer. */
export function mountMapEngine(root: HTMLElement): MountedMap {
  const surface = new DomRenderSurface(root);
  const engine = new MapEngine(surface);

  let dragging = false;
  let lastX = 0, lastY = 0;

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    engine.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, { x: e.offsetX, y: e.offsetY });
  };
  const onDown = (e: PointerEvent) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    root.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    engine.pan(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  };
  const onUp = () => { dragging = false; };
  const onResize = () => engine.resize();

  root.addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);
  window.addEventListener('resize', onResize);

  return {
    engine,
    dispose() {
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      window.removeEventListener('resize', onResize);
      engine.dispose();
    },
  };
}
