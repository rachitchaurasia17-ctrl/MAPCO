/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Lazy Map Image Loader
   ---------------------------------------------------------------
   • lazy: a rendering is fetched only when requested (never preload
     all maps; the 3D rendering is fetched only on explicit select)
   • cancellable: an obsolete request is aborted via AbortSignal
   • bounded: decoded images are held in a small LRU, evictions
     release the image reference so memory stays flat
   ═══════════════════════════════════════════════════════════════ */

import { BoundedCache } from './cache';

export interface LoadedImage {
  readonly src: string;
  readonly el: HTMLImageElement;
  readonly width: number;
  readonly height: number;
}

/** Injected so the engine is testable without a DOM. */
export type ImagePort = (src: string, signal?: AbortSignal) => Promise<LoadedImage>;

/** Default DOM implementation. */
export const domImagePort: ImagePort = (src, signal) =>
  new Promise<LoadedImage>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const el = new Image();
    el.decoding = 'async';
    const onAbort = () => { el.src = ''; reject(new DOMException('aborted', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
    el.onload = () => {
      signal?.removeEventListener('abort', onAbort);
      resolve({ src, el, width: el.naturalWidth, height: el.naturalHeight });
    };
    el.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error(`Failed to load map image: ${src}`));
    };
    el.src = src;
  });

export class MapImageLoader {
  private readonly cache: BoundedCache<string, LoadedImage>;
  private inflight: AbortController | null = null;

  constructor(private readonly port: ImagePort = domImagePort, maxCached = 3) {
    // release the decoded image reference on eviction
    this.cache = new BoundedCache<string, LoadedImage>(maxCached, (img) => { img.el.src = ''; });
  }

  get cacheSize(): number { return this.cache.size; }

  /**
   * Load a rendering, cancelling any previous in-flight load first so only
   * one obsolete request can never outlive the active map.
   */
  async load(src: string, external?: AbortSignal): Promise<LoadedImage> {
    const cached = this.cache.get(src);
    if (cached) return cached;

    this.inflight?.abort();            // cancel obsolete request
    const ctrl = new AbortController();
    this.inflight = ctrl;
    external?.addEventListener('abort', () => ctrl.abort(), { once: true });

    const img = await this.port(src, ctrl.signal);
    if (this.inflight === ctrl) this.inflight = null;
    this.cache.set(src, img);
    return img;
  }

  /** cancel any in-flight load and release all cached image references. */
  dispose(): void {
    this.inflight?.abort();
    this.inflight = null;
    this.cache.clear();
  }
}
