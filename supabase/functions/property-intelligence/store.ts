// MAPCO — Property Intelligence · Supabase-backed IntelligenceStore.
//
// Implements the runtime-neutral IntelligenceStore port against Postgres
// and Supabase Storage, using service-role SECURITY DEFINER RPCs only.
// The service-role key never leaves this runtime.
//
// The two caches this backs are what make MAPCO cheaper the more of a
// city it has already seen:
//   place_registry                one stored Google Place Photo per PLACE
//   property_intelligence_routes  one route per origin+destination
//
// MAPCO holds written Google approval (Young Founder programme) for
// persistent storage and reuse of Place Photos — see
// docs/google-place-photos-approval.md. That is why a photo is fetched
// once globally rather than re-fetched per property view.

import { rpc, SUPABASE_URL } from '../_shared/db.ts';
import { logEvent } from '../_shared/redact.ts';
import type {
  IntelligenceStore, PlaceMedia, RouteResultRecord,
} from '../../../v2/src/packages/property-intelligence/index.ts';

const SERVICE_KEY = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
export const PLACE_MEDIA_BUCKET = 'place-media';

interface PlaceRegistryRow {
  place_id: string;
  display_name: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  primary_type: string | null;
  google_photo_name: string | null;
  storage_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  width_px: number | null;
  height_px: number | null;
  attributions: unknown;
  status: string;
  retrieved_at: string | null;
}

interface RouteRow {
  origin_key: string;
  destination_key: string;
  distance_meters: number;
  duration_seconds: number;
  encoded_polyline: string;
  travel_mode: string;
  computed_at: string;
}

function toMedia(row: PlaceRegistryRow): PlaceMedia {
  return {
    placeId: row.place_id,
    googlePhotoName: row.google_photo_name,
    source: 'GOOGLE_PLACE_PHOTO',
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    mimeType: row.mime_type,
    widthPx: row.width_px,
    heightPx: row.height_px,
    attributions: Array.isArray(row.attributions) ? row.attributions as string[] : [],
    retrievedAt: row.retrieved_at,
    status: (row.status === 'stored' || row.status === 'unavailable') ? row.status : 'pending',
    displayName: row.display_name,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    primaryType: row.primary_type,
  };
}

/** Extension for the stored object, derived from the MIME type. */
function extensionFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

/** A Google place id is URL-safe already, but it is caller-influenced data
 *  reaching a storage path — so it is sanitised rather than trusted. */
function safePlaceId(placeId: string): string {
  return placeId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
}

export function createSupabaseStore(): IntelligenceStore {
  return {
    async getPlaceMedia(placeIds: string[]): Promise<Map<string, PlaceMedia>> {
      const out = new Map<string, PlaceMedia>();
      const ids = [...new Set(placeIds.filter(Boolean))];
      if (ids.length === 0) return out;
      try {
        const rows = await rpc<PlaceRegistryRow[]>('plotmap_place_registry_get', {
          p_place_ids: ids,
        });
        for (const row of rows ?? []) out.set(row.place_id, toMedia(row));
      } catch (error) {
        // The registry is an optimisation. A failure means MAPCO pays for a
        // photo it may already own — never a broken generation.
        logEvent('warn', 'pi.store.registryReadFailed', {
          detail: error instanceof Error ? error.message : String(error),
        });
      }
      return out;
    },

    async putPlaceMedia(media: PlaceMedia): Promise<PlaceMedia> {
      try {
        const row = await rpc<PlaceRegistryRow>('plotmap_place_registry_put', {
          p_payload: {
            placeId: media.placeId,
            displayName: media.displayName ?? null,
            latitude: media.latitude ?? null,
            longitude: media.longitude ?? null,
            address: media.address ?? null,
            primaryType: media.primaryType ?? null,
            googlePhotoName: media.googlePhotoName,
            storagePath: media.storagePath,
            publicUrl: media.publicUrl,
            mimeType: media.mimeType,
            widthPx: media.widthPx,
            heightPx: media.heightPx,
            attributions: media.attributions ?? [],
            status: media.status,
            retrievedAt: media.retrievedAt,
          },
        });
        return row ? toMedia(row) : media;
      } catch (error) {
        logEvent('warn', 'pi.store.registryWriteFailed', {
          detail: error instanceof Error ? error.message : String(error),
        });
        return media;
      }
    },

    async storePhoto(
      placeId: string, bytes: Uint8Array, mimeType: string,
    ): Promise<{ storagePath: string; publicUrl: string } | null> {
      const id = safePlaceId(placeId);
      if (!id || !SERVICE_KEY || !SUPABASE_URL) return null;
      // Deterministic path: one object per place, so a re-store overwrites
      // rather than accumulating duplicates of the same image.
      const path = `places/${id}.${extensionFor(mimeType)}`;
      try {
        const response = await fetch(
          `${SUPABASE_URL}/storage/v1/object/${PLACE_MEDIA_BUCKET}/${path}`,
          {
            method: 'POST',
            headers: {
              apikey: SERVICE_KEY,
              Authorization: `Bearer ${SERVICE_KEY}`,
              'Content-Type': mimeType,
              'x-upsert': 'true',
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
            body: bytes,
          },
        );
        if (!response.ok) {
          logEvent('warn', 'pi.store.photoUploadFailed', {
            status: response.status, placeId: id,
          });
          return null;
        }
        return {
          storagePath: path,
          publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${PLACE_MEDIA_BUCKET}/${path}`,
        };
      } catch (error) {
        logEvent('warn', 'pi.store.photoUploadError', {
          detail: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },

    async getRoutes(
      originKey: string, destinationKeys: string[],
    ): Promise<Map<string, RouteResultRecord>> {
      const out = new Map<string, RouteResultRecord>();
      const keys = [...new Set(destinationKeys.filter(Boolean))];
      if (!originKey || keys.length === 0) return out;
      try {
        const rows = await rpc<RouteRow[]>('plotmap_pi_routes_get', {
          p_origin_key: originKey,
          p_destination_keys: keys,
        });
        for (const row of rows ?? []) {
          out.set(row.destination_key, {
            destinationKey: row.destination_key,
            distanceMeters: row.distance_meters,
            durationSeconds: row.duration_seconds,
            encodedPolyline: row.encoded_polyline,
            travelMode: row.travel_mode === 'WALK' ? 'WALK' : 'DRIVE',
            computedAt: row.computed_at,
          });
        }
      } catch (error) {
        logEvent('warn', 'pi.store.routeReadFailed', {
          detail: error instanceof Error ? error.message : String(error),
        });
      }
      return out;
    },

    async putRoute(originKey: string, record: RouteResultRecord): Promise<void> {
      try {
        await rpc('plotmap_pi_routes_put', {
          p_origin_key: originKey,
          p_destination_key: record.destinationKey,
          p_distance_meters: record.distanceMeters,
          p_duration_seconds: record.durationSeconds,
          p_encoded_polyline: record.encodedPolyline,
          p_travel_mode: record.travelMode,
        });
      } catch (error) {
        logEvent('warn', 'pi.store.routeWriteFailed', {
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
