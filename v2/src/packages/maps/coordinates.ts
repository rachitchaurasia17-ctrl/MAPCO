/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Map Coordinate System
   ---------------------------------------------------------------
   Pure geometry. Preserves aspect ratio at all times — Fit Map,
   zoom and pan NEVER crop or stretch the raster (doc 11/12 risk:
   "map cropping / distortion"). All transforms are computed from
   the rendering's INTRINSIC dimensions.
   ═══════════════════════════════════════════════════════════════ */

import type { Dimensions } from './registry';

export interface Viewport { readonly w: number; readonly h: number; }
export interface Point { readonly x: number; readonly y: number; }

/** scale + translate mapping intrinsic pixels → screen pixels. */
export interface Transform {
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}

/** Canonical CSS transform shared by the raster, overlays and presentation pins. */
export function cssMapTransform(t: Transform): string {
  return `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})`;
}

export const MIN_ZOOM = 1;      // 1 = Fit Map (fully contained)
export const MAX_ZOOM = 8;

export class CoordinateSystem {
  constructor(private readonly intrinsic: Dimensions) {
    if (intrinsic.w <= 0 || intrinsic.h <= 0) {
      throw new Error('CoordinateSystem requires positive intrinsic dimensions');
    }
  }

  get dims(): Dimensions { return this.intrinsic; }

  /**
   * Fit Map: the largest "contain" scale that fits the whole map in the
   * viewport with no crop, centered. This is zoom level 1.
   */
  fit(viewport: Viewport): Transform {
    const base = this.baseScale(viewport);
    return this.centered(viewport, base);
  }

  /**
   * Cover the viewport with a uniform scale. The raster stays centred and
   * aspect-correct; any overflow is intentionally cropped by the surface.
   */
  cover(viewport: Viewport): Transform {
    const scale = Math.max(
      viewport.w / this.intrinsic.w,
      viewport.h / this.intrinsic.h,
    );
    return this.centered(viewport, scale);
  }

  /** the contain scale (aspect-preserving) for zoom=1. */
  baseScale(viewport: Viewport): number {
    return Math.min(viewport.w / this.intrinsic.w, viewport.h / this.intrinsic.h);
  }

  private centered(viewport: Viewport, scale: number): Transform {
    const tx = (viewport.w - this.intrinsic.w * scale) / 2;
    const ty = (viewport.h - this.intrinsic.h * scale) / 2;
    return { scale, tx, ty };
  }

  /**
   * Apply a zoom factor (1..MAX_ZOOM) about an anchor point in screen space,
   * then clamp panning so the map can never reveal empty gutters beyond its
   * edges once zoomed in (and stays centered when smaller than the viewport).
   */
  zoomTo(viewport: Viewport, zoom: number, anchor: Point, prev: Transform): Transform {
    const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    const scale = this.baseScale(viewport) * z;
    // keep the intrinsic point under the anchor stationary
    const intrinsicPt = this.toIntrinsic(anchor, prev);
    const tx = anchor.x - intrinsicPt.x * scale;
    const ty = anchor.y - intrinsicPt.y * scale;
    return this.clampPan(viewport, { scale, tx, ty });
  }

  /** clamp translation so no crop-gutter appears (or center if smaller). */
  clampPan(viewport: Viewport, t: Transform): Transform {
    const w = this.intrinsic.w * t.scale;
    const h = this.intrinsic.h * t.scale;
    const tx = axisClamp(t.tx, w, viewport.w);
    const ty = axisClamp(t.ty, h, viewport.h);
    return { scale: t.scale, tx, ty };
  }

  /** intrinsic → screen. */
  toScreen(p: Point, t: Transform): Point {
    return { x: p.x * t.scale + t.tx, y: p.y * t.scale + t.ty };
  }

  /** screen → intrinsic. */
  toIntrinsic(p: Point, t: Transform): Point {
    return { x: (p.x - t.tx) / t.scale, y: (p.y - t.ty) / t.scale };
  }

  /** current zoom level relative to Fit Map. */
  zoomLevel(viewport: Viewport, t: Transform): number {
    return t.scale / this.baseScale(viewport);
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/** center when content ≤ viewport, else clamp edges flush (no gutter). */
function axisClamp(translate: number, contentSize: number, viewportSize: number): number {
  if (contentSize <= viewportSize) return (viewportSize - contentSize) / 2;
  return clamp(translate, viewportSize - contentSize, 0);
}
