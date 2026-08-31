/* Shared fakes for Property Intelligence tests.
   Every provider is faked so CI never spends money, but the fakes
   implement the REAL ports — so a test that passes here is exercising the
   same code paths production runs. */
import type {
  GeoPoint, IntelligenceStore, ModelResponse, PlaceDetailsResult, PlaceMedia,
  PlacesIdentityResult, PlacesPort, RouteResultRecord, RoutesPort,
  TextModelProvider,
} from '../../src/packages/property-intelligence';

/** A model that returns scripted responses, one per call, and records the
 *  prompts it was given so tests can assert what each phase actually sent. */
export class FakeModel implements TextModelProvider {
  readonly name = 'fake-model';
  readonly model = 'fake-1';
  readonly prompts: string[] = [];
  readonly groundingUsed: boolean[] = [];
  private readonly script: Array<string | Error>;
  private index = 0;

  constructor(script: Array<string | Error>, readonly grounded: Array<{ placeId: string; title: string }> = []) {
    this.script = script;
  }

  async generate(prompt: string, opts: { grounding?: { latitude: number; longitude: number } } = {}): Promise<ModelResponse> {
    this.prompts.push(prompt);
    this.groundingUsed.push(Boolean(opts.grounding));
    const next = this.script[Math.min(this.index, this.script.length - 1)];
    this.index++;
    if (next instanceof Error) throw next;
    return {
      text: next ?? '',
      usage: { inputTokens: 1000, outputTokens: 500, groundingQueries: opts.grounding ? 1 : 0 },
      groundedPlaces: opts.grounding ? this.grounded : [],
    };
  }
}

export interface FakePlacesOptions {
  /** query substring → identity result. */
  identity?: Record<string, PlacesIdentityResult>;
  /** placeId → details. */
  details?: Record<string, PlaceDetailsResult>;
  /** photoName → bytes; absent means Google has no photo. */
  photos?: Record<string, { bytes: Uint8Array; mimeType: string }>;
  failIdentity?: boolean;
}

export class FakePlaces implements PlacesPort {
  readonly identityCalls: string[] = [];
  readonly detailCalls: string[] = [];
  readonly photoCalls: string[] = [];

  constructor(private readonly opts: FakePlacesOptions = {}) {}

  async resolveIdentity(query: string, _near: GeoPoint): Promise<PlacesIdentityResult> {
    this.identityCalls.push(query);
    if (this.opts.failIdentity) throw new Error('places down');
    for (const [needle, result] of Object.entries(this.opts.identity ?? {})) {
      if (query.toLowerCase().includes(needle.toLowerCase())) return result;
    }
    // Default: a deterministic resolved id derived from the query.
    const placeId = `place_${query.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`;
    return { status: 'RESOLVED', placeId, candidatePlaceIds: [], fieldMask: ['places.id'] };
  }

  async details(placeId: string): Promise<PlaceDetailsResult | null> {
    this.detailCalls.push(placeId);
    return this.opts.details?.[placeId] ?? {
      displayName: `Name of ${placeId}`,
      latitude: 30.69,
      longitude: 76.71,
      primaryType: 'store',
      formattedAddress: 'Somewhere, Mohali',
      photoName: `places/${placeId}/photos/p1`,
      photoAttributions: ['A Photographer'],
      photoWidthPx: 1600,
      photoHeightPx: 1200,
    };
  }

  async photoBytes(photoName: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
    this.photoCalls.push(photoName);
    if (this.opts.photos && !(photoName in this.opts.photos)) return null;
    return this.opts.photos?.[photoName]
      ?? { bytes: new Uint8Array([1, 2, 3, 4]), mimeType: 'image/jpeg' };
  }
}

export class FakeRoutes implements RoutesPort {
  readonly calls: Array<{ origin: GeoPoint; destination: unknown }> = [];
  constructor(private readonly fail = false) {}
  async computeRoute(origin: GeoPoint, destination: { placeId?: string; latitude: number; longitude: number }) {
    this.calls.push({ origin, destination });
    if (this.fail) return null;
    return { distanceMeters: 1500, durationSeconds: 300, encodedPolyline: 'abc_polyline' };
  }
}

/** In-memory store with the same semantics as the Supabase / filesystem ones. */
export class FakeStore implements IntelligenceStore {
  readonly media = new Map<string, PlaceMedia>();
  readonly routes = new Map<string, RouteResultRecord>();
  readonly storedPhotos: string[] = [];
  readonly routeReads: string[] = [];

  async getPlaceMedia(placeIds: string[]): Promise<Map<string, PlaceMedia>> {
    const out = new Map<string, PlaceMedia>();
    for (const id of placeIds) {
      const record = this.media.get(id);
      if (record) out.set(id, record);
    }
    return out;
  }

  async putPlaceMedia(media: PlaceMedia): Promise<PlaceMedia> {
    const existing = this.media.get(media.placeId);
    const merged = existing?.status === 'stored' && media.status !== 'stored'
      ? { ...media, status: 'stored' as const, storagePath: existing.storagePath, publicUrl: existing.publicUrl }
      : media;
    this.media.set(media.placeId, merged);
    return merged;
  }

  async storePhoto(placeId: string, _bytes: Uint8Array, mimeType: string) {
    this.storedPhotos.push(placeId);
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    return {
      storagePath: `places/${placeId}.${ext}`,
      publicUrl: `https://cdn.test/place-media/places/${placeId}.${ext}`,
    };
  }

  async getRoutes(originKey: string, destinationKeys: string[]): Promise<Map<string, RouteResultRecord>> {
    this.routeReads.push(originKey);
    const out = new Map<string, RouteResultRecord>();
    for (const key of destinationKeys) {
      const record = this.routes.get(`${originKey}|${key}`);
      if (record) out.set(key, record);
    }
    return out;
  }

  async putRoute(originKey: string, record: RouteResultRecord): Promise<void> {
    this.routes.set(`${originKey}|${record.destinationKey}`, record);
  }
}

/** A realistic Phase 1 response: pipe-delimited, two headed sections. */
export function phase1Text(localCount = 8, cityCount = 4): string {
  const local = Array.from({ length: localCount }, (_, i) =>
    `Local Place ${i + 1} | PLACE_ENTITY | Grocery & Daily Needs | Sector 78, Mohali | 4.${i % 9} | ${100 + i} | ${(0.4 + i * 0.2).toFixed(1)} km`);
  const city = Array.from({ length: cityCount }, (_, i) =>
    `City Place ${i + 1} | PLACE_ENTITY | Major Retail & Lifestyle | Sector 5, Chandigarh | 4.5 | 2000 | ${(3 + i).toFixed(1)} km`);
  return [
    'LOCAL CANDIDATE UNIVERSE',
    ...local,
    '',
    'CITY CANDIDATE UNIVERSE',
    ...city,
  ].join('\n');
}

/** A valid Phase 2 response over ids that exist in the universe. */
export function phase2Json(
  localCategories: Array<{ category: string; ids: string[] }>,
  cityPlaces: Array<{ id: string; category: string }>,
): string {
  return JSON.stringify({
    localCategories: localCategories.map((entry) => ({
      category: entry.category,
      places: entry.ids.map((candidateId, i) => ({ candidateId, rank: i + 1 })),
    })),
    cityPlaces: cityPlaces.map((entry) => ({ candidateId: entry.id, category: entry.category })),
  });
}
