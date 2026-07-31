/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Maps package public API (doc 11 stable surface)
   ═══════════════════════════════════════════════════════════════ */
export { getMaps, getMap, renderingFor, addPropertyToMap } from './registry';
export type {
  MapEntry, MapKind, RenderMode, Rendering, Dimensions,
  OverlayDescriptor, MapRegistry,
} from './registry';
export { CoordinateSystem, MIN_ZOOM, MAX_ZOOM, cssMapTransform } from './coordinates';
export type { Transform, Viewport, Point } from './coordinates';
export { BoundedCache } from './cache';
export { layoutOverlay, geometryMatches } from './overlay-engine';
export type { OverlayLayout } from './overlay-engine';
export { MapImageLoader, domImagePort } from './loader';
export type { LoadedImage, ImagePort } from './loader';
export { MapEngine } from './map-engine';
export type { RenderSurface, OverlayRender, SetMapResult } from './map-engine';
export { DomRenderSurface, mountMapEngine } from './dom-surface';
export type { MountedMap } from './dom-surface';
