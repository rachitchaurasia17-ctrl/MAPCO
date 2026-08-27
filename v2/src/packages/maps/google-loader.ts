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
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  'AIzaSyDH8vCu5eCmKJ7fU5GgLHnmCcdxciy8Ez8';
export const GOOGLE_MAPS_MAP_ID: string =
  (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) ||
  'aede803e7526c27fe6e6f529';

export function hasGoogleConfig(): boolean {
  return GOOGLE_MAPS_API_KEY.length > 0;
}

let bootstrapPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = new Promise<typeof google>((resolve, reject) => {
    if (!hasGoogleConfig()) {
      reject(new Error('missing-api-key'));
      return;
    }
    if (typeof window !== 'undefined' && (window as any).google?.maps) {
      resolve((window as any).google);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&v=weekly&libraries=places,marker,geometry`;
    script.async = true;
    script.onload = () => {
      if ((window as any).google?.maps) {
        resolve((window as any).google);
      } else {
        bootstrapPromise = null;
        reject(new Error('Google Maps script loaded but google.maps is missing'));
      }
    };
    script.onerror = () => {
      bootstrapPromise = null;
      reject(new Error('Google Maps script failed to load'));
    };
    document.head.appendChild(script);
  });

  return bootstrapPromise;
}

/** Convenience wrapper around google.maps.importLibrary. */
export async function importMapsLibrary<T = unknown>(name: string): Promise<T> {
  const g = await loadGoogleMaps();
  if (g.maps?.importLibrary) {
    return g.maps.importLibrary(name) as Promise<T>;
  }
  return (g.maps as any)[name] || g.maps;
}
