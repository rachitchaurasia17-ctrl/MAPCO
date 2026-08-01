/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Overlay Engine
   ---------------------------------------------------------------
   Positions an SVG overlay (roads / blocks / regions) over the
   active rendering at the correct scale. The overlay keeps its own
   intrinsic viewBox, so its internal geometry is preserved losslessly
   (SVG); only the outer layer is scaled/translated by the shared map
   Transform — no coordinate approximation.
   ═══════════════════════════════════════════════════════════════ */

import type { Dimensions } from './registry';
import { cssMapTransform, type Transform } from './coordinates';

export interface OverlayLayout {
  /** CSS transform string for the overlay <svg> wrapper. */
  readonly transform: string;
  /** rendered width/height in screen px (before transform scale is applied). */
  readonly width: number;
  readonly height: number;
  /** viewBox string that preserves the overlay's intrinsic geometry. */
  readonly viewBox: string;
}

/**
 * Compute the layout that maps the overlay's intrinsic viewBox onto the
 * SAME screen rectangle the raster occupies under `t`. The overlay artwork
 * is authored against `rasterDims` (the rendering it applies to); if the
 * overlay's own viewBox differs it is stretched to the raster box via the
 * SVG viewBox (still lossless internally, but any authoring mismatch is a
 * DATA issue, surfaced by geometryMatches()).
 */
export function layoutOverlay(
  overlayViewBox: Dimensions,
  rasterDims: Dimensions,
  t: Transform,
): OverlayLayout {
  return {
    transform: cssMapTransform(t),
    width: rasterDims.w,
    height: rasterDims.h,
    viewBox: `0 0 ${overlayViewBox.w} ${overlayViewBox.h}`,
  };
}

/**
 * True when the overlay artwork was authored at the same intrinsic size as
 * the raster it applies to. A mismatch means the overlay was captured
 * against a different crop and pixel-perfect alignment is not guaranteed —
 * a map-DATA gap, not an engine bug.
 */
export function geometryMatches(overlayViewBox: Dimensions, rasterDims: Dimensions): boolean {
  return overlayViewBox.w === rasterDims.w && overlayViewBox.h === rasterDims.h;
}
