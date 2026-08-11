/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Google Maps JavaScript API loader
   ---------------------------------------------------------------
   • lazy: the Google Maps script is injected only on first use
     (never on the landing hub or other apps), so nothing Google
     is downloaded until a dealer actually opens MAPCO Earth.
   • single-load: the bootstrap is installed once; concurrent
     callers share one in-flight promise.
   • library-scoped: callers import only the libraries they need
     (maps / marker / places / streetView) via importLibrary.
   ---------------------------------------------------------------
   Env (read from v2/.env(.local) or repo-root .env.local — see
   vite.config.ts which merges both):
     VITE_GOOGLE_MAPS_API_KEY
     VITE_GOOGLE_MAPS_MAP_ID   (vector Map ID — required for
                                AdvancedMarkerElement)
   ═══════════════════════════════════════════════════════════════ */

export const GOOGLE_MAPS_API_KEY: string =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';
export const GOOGLE_MAPS_MAP_ID: string =
  (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) ?? '';

export function hasGoogleConfig(): boolean {
  return GOOGLE_MAPS_API_KEY.length > 0;
}

let bootstrapPromise: Promise<typeof google> | null = null;

/**
 * Install the official Google Maps inline bootstrap (the `importLibrary`
 * shim) exactly once and resolve with the global `google` object. Safe to
 * call repeatedly — the same promise is returned.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = new Promise<typeof google>((resolve, reject) => {
    if (!hasGoogleConfig()) {
      reject(new Error('missing-api-key'));
      return;
    }
    // Already present (e.g. hot reload) — reuse it.
    if (typeof google !== 'undefined' && google.maps?.importLibrary) {
      resolve(google);
      return;
    }

    // Official inline loader (v=weekly). Adapted from Google's snippet so we
    // do not depend on a CDN <script> tag with a global callback.
    ((g: Record<string, unknown>) => {
      let h: Promise<void> | undefined;
      let a: HTMLScriptElement;
      const p = 'The Google Maps JavaScript API';
      const c = 'google';
      const l = 'importLibrary';
      const q = '__ib__';
      const m = document;
      let b = window as unknown as Record<string, unknown>;
      const gm = ((b[c] ??= {}) as Record<string, unknown>);
      const d = (gm.maps ??= {}) as Record<string, unknown>;
      const r = new Set<string>();
      const e = new URLSearchParams();
      const u = () =>
        h ??
        (h = new Promise<void>((res, rej) => {
          a = m.createElement('script');
          e.set('libraries', [...r].join(','));
          for (const k in g) {
            e.set(
              k.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase()),
              String(g[k]),
            );
          }
          e.set('callback', c + '.maps.' + q);
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          (d[q] as unknown) = res;
          a.onerror = () => (h = rej(new Error(p + ' could not load.')) as unknown as Promise<void>);
          a.nonce = (m.querySelector('script[nonce]') as HTMLScriptElement | null)?.nonce || '';
          m.head.append(a);
        }));
      if (d[l]) {
        // already bootstrapped
      } else {
        (d[l] as unknown) = (fn: string, ...args: unknown[]) =>
          r.add(fn) && u().then(() => (d[l] as (f: string, ...a: unknown[]) => unknown)(fn, ...args));
      }
    })({ key: GOOGLE_MAPS_API_KEY, v: 'weekly' });

    // Kick a first import so the bootstrap actually fetches the core script,
    // then resolve with the ready `google` namespace.
    google.maps
      .importLibrary('maps')
      .then(() => resolve(google))
      .catch((err: unknown) => {
        bootstrapPromise = null; // allow a later retry
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });

  return bootstrapPromise;
}

/** Convenience wrapper around google.maps.importLibrary. */
export async function importMapsLibrary<T = unknown>(name: string): Promise<T> {
  const g = await loadGoogleMaps();
  return g.maps.importLibrary(name) as Promise<T>;
}
