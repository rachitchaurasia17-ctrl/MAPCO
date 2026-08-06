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
import { PriorityLoader, type ResourceScope } from '../performance';

export interface LoadedImage {
  readonly src: string;
  readonly el: HTMLImageElement;
  readonly width: number;
  readonly height: number;
}

/** Injected so the engine is testable without a DOM. */
export type ImagePort = (src: string, signal?: AbortSignal) => Promise<LoadedImage>;

export interface ScheduledImageLoader {
  readonly loader: PriorityLoader;
  readonly scope: ResourceScope;
  readonly group: string;
}

export interface ImageLoadOptions {
  readonly resourceId: string;
  readonly version?: string;
  readonly estimatedBytes?: number;
  readonly reason?: string;
}

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

  private protectedSchedulerResource: Pick<ImageLoadOptions, 'resourceId' | 'version'> | null = null;

  constructor(
    private readonly port: ImagePort = domImagePort,
    maxCached = 3,
    private readonly scheduled?: ScheduledImageLoader,
  ) {
    // release the decoded image reference on eviction
    this.cache = new BoundedCache<string, LoadedImage>(maxCached, (img) => { img.el.src = ''; });
  }

  get cacheSize(): number { return this.cache.size; }

  /**
   * Load a rendering, cancelling any previous in-flight load first so only
   * one obsolete request can never outlive the active map.
   */
  async load(src: string, external?: AbortSignal, options?: ImageLoadOptions): Promise<LoadedImage> {
    if (this.scheduled && options) {
      this.inflight?.abort();
      const ctrl = new AbortController();
      this.inflight = ctrl;
      const onAbort = () => ctrl.abort();
      external?.addEventListener('abort', onAbort, { once: true });
      const key = {
        scope: this.scheduled.scope,
        type: 'map-raster' as const,
        id: options.resourceId,
        version: options.version ?? src,
      };
      try {
        return await this.scheduled.loader.schedule({
          key,
          priority: 'P0',
          stage: 'download',
          group: this.scheduled.group,
          cost: { bytes: options.estimatedBytes ?? 2 * 1024 * 1024, parse: 0.65, heavy: true },
          reason: options.reason ?? 'current visible map',
          cache: {
            costBytes: options.estimatedBytes ?? 2 * 1024 * 1024,
            dispose: (img) => {
              const image = img as LoadedImage;
              const objectUrl = image.el.src.startsWith('blob:') ? image.el.src : '';
              image.el.src = '';
              if (objectUrl && typeof URL !== 'undefined') URL.revokeObjectURL(objectUrl);
            },
          },
          run: (schedulerSignal) => {
            schedulerSignal.addEventListener('abort', onAbort, { once: true });
            return this.port(src, ctrl.signal);
          },
        });
      } finally {
        external?.removeEventListener('abort', onAbort);
        if (this.inflight === ctrl) this.inflight = null;
      }
    }
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

  protect(options: ImageLoadOptions, value = true): void {
    if (!this.scheduled) return;
    const previous = this.protectedSchedulerResource;
    if (value && previous && (previous.resourceId !== options.resourceId || previous.version !== options.version)) {
      // The previous rendering remains recent but is no longer eviction-proof.
      this.scheduled.loader.protect({ scope: this.scheduled.scope, type: 'map-raster', id: previous.resourceId, version: previous.version }, 'download', false);
    }
    this.scheduled.loader.protect({ scope: this.scheduled.scope, type: 'map-raster', id: options.resourceId, version: options.version }, 'download', value);
    this.protectedSchedulerResource = value ? { resourceId: options.resourceId, version: options.version } : null;
  }

  /** cancel any in-flight load and release all cached image references. */
  dispose(): void {
    this.inflight?.abort();
    this.inflight = null;
    this.cache.clear();
    if (this.scheduled) {
      const current = this.protectedSchedulerResource;
      if (current) {
        this.scheduled.loader.protect({
          scope: this.scheduled.scope,
          type: 'map-raster',
          id: current.resourceId,
          version: current.version,
        }, 'download', false);
      }
      this.protectedSchedulerResource = null;
      this.scheduled.loader.cancelWhere((task) => task.group === this.scheduled!.group, 'map engine disposed');
    }
  }
}
