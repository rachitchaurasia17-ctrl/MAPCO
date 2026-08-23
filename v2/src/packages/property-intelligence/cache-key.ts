/* Cache identity for a persisted Property Intelligence result.
   Ties a stored result to everything that could change its meaning:
   dealer, property, canonical coordinate, when that location last
   changed, schema version and the provider/model that produced it.
   Any change → a new digest → a regeneration. Runtime-neutral
   (crypto.subtle exists in browser, Node 18+ and Deno). */
import { PROPERTY_INTELLIGENCE_SCHEMA_VERSION, type GeoPoint } from './types.ts';

export interface CacheIdentity {
  dealerId: string;
  propertyId: string;
  point: GeoPoint;
  locationUpdatedAt?: string;
  provider: string;
  model: string;
  schemaVersion?: number;
}

/** Coordinate rounding: ~1e-5 deg ≈ 1.1 m. Two saves at the same spot share
 *  a digest; a real relocation does not. */
function roundCoord(n: number): string {
  return n.toFixed(5);
}

export function cacheKeyString(id: CacheIdentity): string {
  const schema = id.schemaVersion ?? PROPERTY_INTELLIGENCE_SCHEMA_VERSION;
  return [
    `d=${id.dealerId}`,
    `p=${id.propertyId}`,
    `lat=${roundCoord(id.point.latitude)}`,
    `lng=${roundCoord(id.point.longitude)}`,
    `u=${id.locationUpdatedAt ?? ''}`,
    `s=${schema}`,
    `prov=${id.provider}`,
    `model=${id.model}`,
  ].join('|');
}

export async function computeInputDigest(id: CacheIdentity): Promise<string> {
  const data = new TextEncoder().encode(cacheKeyString(id));
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
