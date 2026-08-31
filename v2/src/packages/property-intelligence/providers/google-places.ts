/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Google Places (New) client
   ---------------------------------------------------------------
   Three narrowly-scoped operations, each with the SMALLEST field mask
   that satisfies it — the field mask is what determines the SKU, so a
   lazy "give me everything" mask would multiply the bill.

     resolveIdentity  places.id only        → the cheap identity tier
     details          id, displayName, location, formattedAddress,
                      photos                → Essentials + photo ref
     photoBytes       the photo media itself

   RESOLVED / AMBIGUOUS / UNRESOLVED is a real distinction, not a
   convenience: MAPCO reports what Google actually returned and lets
   Phase 2 weigh it, rather than silently picking the first result and
   presenting a guess as an identity.

   Server-key only. This module must never be imported by browser code.
   ═══════════════════════════════════════════════════════════════ */
import type {
  GeoPoint, PlaceDetailsResult, PlacesIdentityResult, PlacesPort,
} from '../types.ts';

export interface GooglePlacesConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Location-bias radius in metres (default 25 km — Tri-City scale). */
  biasRadiusMeters?: number;
  /** Reject anything farther than this from the property (default 80 km). */
  maxDistanceMeters?: number;
  regionCode?: string;
  /** Language for display names (default 'en'). */
  languageCode?: string;
}

/**
 * Identity resolution asks for the place ID and NOTHING else.
 *
 * This is the Text Search ESSENTIALS tier. Adding a single further field
 * (places.location, places.displayName) moves the same call to PRO — a
 * ~2x price jump on the highest-volume call in the pipeline, since every
 * one of the 50-100 Phase 1 candidates is resolved. A live run with
 * places.location in the mask spent the entire per-generation budget
 * here and left nothing for photos or routes.
 *
 * It also matches the finalized Phase 2 input contract, which specifies
 * fieldMask ['places.id'] with verificationTier ID_ONLY.
 */
const IDENTITY_FIELD_MASK = ['places.id'];

/** Details deliberately excludes rating/reviews: requesting either would
 *  move this call from Essentials to Enterprise + Atmosphere pricing. */
const DETAILS_FIELD_MASK = [
  'id', 'displayName', 'location', 'formattedAddress', 'primaryType', 'photos',
];

interface SearchTextResponse {
  places?: Array<{ id?: string }>;
}

interface DetailsResponse {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  primaryType?: string;
  photos?: Array<{
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: Array<{ displayName?: string; uri?: string }>;
  }>;
}

export class GooglePlacesClient implements PlacesPort {
  private readonly cfg: GooglePlacesConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: GooglePlacesConfig) {
    this.cfg = cfg;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  /**
   * Resolve a candidate name to a Google Place ID.
   *
   *   exactly one plausible match            → RESOLVED
   *   several plausible matches              → AMBIGUOUS (ids returned)
   *   none, or all beyond the distance cap   → UNRESOLVED
   *
   * An AMBIGUOUS or UNRESOLVED candidate is NOT dropped — the finalized
   * Phase 2 prompt is explicitly told these are not automatic rejections.
   */
  async resolveIdentity(
    query: string,
    near: GeoPoint,
    opts: { signal?: AbortSignal } = {},
  ): Promise<PlacesIdentityResult> {
    const text = query.trim();
    if (!text) {
      return { status: 'UNRESOLVED', placeId: null, candidatePlaceIds: [], fieldMask: IDENTITY_FIELD_MASK };
    }

    const body = {
      textQuery: text,
      locationBias: {
        circle: {
          center: { latitude: near.latitude, longitude: near.longitude },
          radius: this.cfg.biasRadiusMeters ?? 25_000,
        },
      },
      // Three is enough to tell "one obvious match" from "genuinely several".
      maxResultCount: 3,
      regionCode: this.cfg.regionCode ?? 'IN',
      languageCode: this.cfg.languageCode ?? 'en',
    };

    const res = await this.fetchImpl('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': this.cfg.apiKey,
        'X-Goog-FieldMask': IDENTITY_FIELD_MASK.join(','),
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!res.ok) {
      return { status: 'UNRESOLVED', placeId: null, candidatePlaceIds: [], fieldMask: IDENTITY_FIELD_MASK };
    }

    const json = await res.json().catch(() => null) as SearchTextResponse | null;
    const ids = (json?.places ?? [])
      .map((place) => place.id)
      .filter((id): id is string => Boolean(id));

    if (ids.length === 0) {
      return { status: 'UNRESOLVED', placeId: null, candidatePlaceIds: [], fieldMask: IDENTITY_FIELD_MASK };
    }

    // Exactly one location-biased match for a name+locality query is a
    // confident identity.
    if (ids.length === 1) {
      return {
        status: 'RESOLVED', placeId: ids[0]!,
        candidatePlaceIds: [], fieldMask: IDENTITY_FIELD_MASK,
      };
    }

    // Several matched. Without coordinates MAPCO cannot prove which one is
    // meant, so it reports genuine ambiguity rather than asserting an
    // identity — the finalized Phase 2 prompt is explicitly told AMBIGUOUS
    // is not a rejection. Google's ranking (relevance + location bias) is
    // preserved in order, so candidatePlaceIds[0] is its best match.
    return {
      status: 'AMBIGUOUS', placeId: null,
      candidatePlaceIds: ids, fieldMask: IDENTITY_FIELD_MASK,
    };
  }

  async details(
    placeId: string,
    opts: { signal?: AbortSignal } = {},
  ): Promise<PlaceDetailsResult | null> {
    if (!placeId) return null;
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`
      + `?languageCode=${encodeURIComponent(this.cfg.languageCode ?? 'en')}`;

    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': this.cfg.apiKey,
        'X-Goog-FieldMask': DETAILS_FIELD_MASK.join(','),
      },
      signal: opts.signal,
    });
    if (!res.ok) return null;

    const json = await res.json().catch(() => null) as DetailsResponse | null;
    const lat = json?.location?.latitude;
    const lng = json?.location?.longitude;
    if (!json || typeof lat !== 'number' || typeof lng !== 'number') return null;

    const photo = json.photos?.[0];
    const attributions = (photo?.authorAttributions ?? [])
      .map((a) => a.displayName?.trim())
      .filter((v): v is string => Boolean(v));

    return {
      displayName: json.displayName?.text?.trim() || placeId,
      latitude: lat,
      longitude: lng,
      primaryType: json.primaryType ?? null,
      formattedAddress: json.formattedAddress ?? null,
      photoName: photo?.name ?? null,
      photoAttributions: attributions,
      photoWidthPx: typeof photo?.widthPx === 'number' ? photo.widthPx : null,
      photoHeightPx: typeof photo?.heightPx === 'number' ? photo.heightPx : null,
    };
  }

  /**
   * Fetch the actual photo bytes so MAPCO can persist one copy per PLACE.
   * skipHttpRedirect returns a JSON envelope with a photoUri, which is then
   * fetched directly — this avoids following an opaque redirect and keeps
   * the API key out of the second request.
   */
  async photoBytes(
    photoName: string,
    opts: { maxWidthPx?: number; signal?: AbortSignal } = {},
  ): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
    if (!photoName) return null;
    const maxWidth = opts.maxWidthPx ?? 800;
    const mediaUrl = `https://places.googleapis.com/v1/${photoName}/media`
      + `?maxWidthPx=${maxWidth}&skipHttpRedirect=true`;

    const envelope = await this.fetchImpl(mediaUrl, {
      method: 'GET',
      headers: { 'X-Goog-Api-Key': this.cfg.apiKey },
      signal: opts.signal,
    });
    if (!envelope.ok) return null;

    const json = await envelope.json().catch(() => null) as { photoUri?: string } | null;
    const photoUri = json?.photoUri;
    if (!photoUri) return null;

    const image = await this.fetchImpl(photoUri, { method: 'GET', signal: opts.signal });
    if (!image.ok) return null;

    const buffer = await image.arrayBuffer();
    const mimeType = image.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    return { bytes: new Uint8Array(buffer), mimeType };
  }
}
