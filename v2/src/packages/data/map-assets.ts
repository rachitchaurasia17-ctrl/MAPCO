const MAPS_BUCKET = 'maps';

/** Return a canonical object path when a value points into the `maps` bucket. */
export function mapAssetStoragePath(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed, 'https://mapco.invalid');
    const match = url.pathname.match(/\/storage\/v1\/object\/(?:authenticated|sign|public)\/maps\/(.+)$/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  } catch { /* fall through to canonical relative paths */ }

  if (trimmed.startsWith(`${MAPS_BUCKET}/`)) return trimmed.slice(MAPS_BUCKET.length + 1);
  if (!trimmed.startsWith('/') && !/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return trimmed;
  return null;
}

/** Convert canonical maps objects to browser-loadable public bucket URLs. */
export function resolveMapAssetUrl(
  value: string | undefined,
  publicUrlForPath: (path: string) => string,
): string | undefined {
  if (!value) return undefined;
  const path = mapAssetStoragePath(value);
  return path ? publicUrlForPath(path) : value;
}
