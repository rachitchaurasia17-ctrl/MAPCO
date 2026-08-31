/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · domain types (runtime-neutral)
   ---------------------------------------------------------------
   Shared verbatim by three runtimes:
     • the browser client (Earth property detail, Desk, client link),
     • the Vite dev middleware (local-live server),
     • the Supabase Edge Function (production server).
   Nothing here may import a DOM, Node or Deno API. Only plain data.

   FINALIZED ARCHITECTURE (two AI phases; Phase 3 contains NO AI):
     Phase 1  Gemini + Google Maps grounding  → high-recall universe
     Normalize (deterministic MAPCO)          → ids, Places identity,
                                                exact place-id dedupe,
                                                sameSector
     Phase 2  Gemini (fresh session)          → final judgment
     Validate (strict)                        → trust nothing
     Phase 3  Places + Photos + Routes        → deterministic only
   ═══════════════════════════════════════════════════════════════ */

/** Bump when the persisted shape or generation contract changes. Part of the
 *  cache identity, so a bump naturally regenerates every stored result. */
export const PROPERTY_INTELLIGENCE_SCHEMA_VERSION = 3;

/** Bump when pipeline BEHAVIOUR changes without the shape changing. */
export const PROPERTY_INTELLIGENCE_PIPELINE_VERSION = 'pi-3.0.0';

/** The Phase 2 input contract these types build. Matches the finalized
 *  reference document tests/fixtures/phase2-input-sector78.json. */
export const PHASE2_INPUT_SCHEMA_VERSION = 'mapco.phase2.input.v1';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/* ── Phase 1: raw discovery ─────────────────────────────────────── */

/** What Phase 1 is allowed to return for each candidate. */
export type EntityKind = 'PLACE_ENTITY' | 'GEOGRAPHIC_ENTITY';

/** Where Phase 1 found a candidate. NOT its final classification — Phase 2
 *  decides that, and may promote a LOCAL discovery into City or vice versa. */
export type DiscoveredIn = 'LOCAL' | 'CITY';

/** One parsed row of the Phase 1 pipe-delimited output. Every field is
 *  exactly what the model said; MAPCO normalizes later, never here. */
export interface Phase1Candidate {
  name: string;
  entityKind: EntityKind;
  /** Free-text bucket the model chose (e.g. "Supermarket"). Not a MAPCO enum. */
  entityType: string | null;
  category: string | null;
  locality: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** Discovery hint ONLY. Google Routes produces the displayed distance. */
  approxDistanceKm: number | null;
  discoveredIn: DiscoveredIn;
}

export interface Phase1Result {
  local: Phase1Candidate[];
  city: Phase1Candidate[];
  /** Place ids the model cited in grounding chunks, keyed by normalized name.
   *  Free identity evidence — saves a paid Places lookup when it matches. */
  groundedPlaceIds: Record<string, string>;
  usage: ModelUsage;
  /** Raw text, retained only for diagnosing a parse failure. */
  rawText?: string;
}

/* ── Normalization: Google Places identity ──────────────────────── */

export type PlacesResolutionStatus =
  | 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED' | 'NOT_APPLICABLE';

export interface PlacesResolution {
  provider: 'GOOGLE_PLACES_NEW' | 'GEMINI_GROUNDING' | 'NONE';
  /** Which field mask was paid for. ID_ONLY is the cheap identity tier. */
  verificationTier: 'ID_ONLY' | 'GROUNDED' | 'NONE';
  status: PlacesResolutionStatus;
  placeId: string | null;
  /** Populated when several places matched and none was clearly best. */
  candidatePlaceIds: string[];
  fieldMask: string[];
  queryUsed: string | null;
}

export interface MapcoCandidateContext {
  /** Deterministic: does the candidate locality name the property sector? */
  sameSector: boolean;
  /** True when MAPCO global place registry already knows this place id. */
  seenBefore: boolean;
}

/** One normalized candidate — the unit Phase 2 judges. Serialized verbatim
 *  into the Phase 2 input document. */
export interface NormalizedCandidate {
  candidateId: string;
  discoveredIn: DiscoveredIn[];
  entityKind: EntityKind;
  discovery: {
    name: string;
    entityType: string | null;
    category: string | null;
    locality: string | null;
    rating: number | null;
    reviewCount: number | null;
    approxDistanceKm: number | null;
  };
  placesResolution: PlacesResolution;
  mapcoContext: MapcoCandidateContext;
}

/** The exact document handed to Phase 2. */
export interface Phase2Input {
  schemaVersion: string;
  property: {
    propertyId: string;
    propertyType: string;
    propertySubtype: string;
    latitude: number;
    longitude: number;
    locality: string;
    city: string;
    profile: Record<string, unknown>;
  };
  candidateUniverse: NormalizedCandidate[];
  importantSemantics: Record<string, string>;
}

/* ── Phase 2: the AI judgment ───────────────────────────────────── */

export interface Phase2LocalPlace {
  candidateId: string;
  /** 1 = the default MAPCO displays. 2–4 = switchable alternatives. */
  rank: number;
}

export interface Phase2LocalCategory {
  category: string;
  places: Phase2LocalPlace[];
}

export interface Phase2CityPlace {
  candidateId: string;
  category: string;
}

export interface Phase2Output {
  localCategories: Phase2LocalCategory[];
  cityPlaces: Phase2CityPlace[];
}

/** A single, machine-readable reason a Phase 2 payload was rejected. */
export interface Phase2ValidationIssue {
  code:
    | 'not_json' | 'not_object' | 'missing_local' | 'missing_city'
    | 'unknown_field' | 'bad_category' | 'empty_category'
    | 'unknown_candidate' | 'bad_rank' | 'duplicate_rank'
    | 'non_sequential_rank' | 'duplicate_candidate' | 'city_has_rank'
    | 'too_many_places' | 'no_categories';
  path: string;
  detail: string;
}

export interface Phase2ValidationResult {
  ok: boolean;
  value?: Phase2Output;
  issues: Phase2ValidationIssue[];
  /** Feedback string handed back to the model on the single repair attempt. */
  feedback?: string;
}

/* ── Phase 3: deterministic enrichment ──────────────────────────── */

/** Persisted, globally reusable media for one Google Place. Keyed by place
 *  id, never by property — one download serves every property near it.
 *  MAPCO holds written Google approval for this persistent storage; see
 *  docs/google-place-photos-approval.md. */
export interface PlaceMedia {
  placeId: string;
  /** Google photo resource name, e.g. places/X/photos/Y. */
  googlePhotoName: string | null;
  source: 'GOOGLE_PLACE_PHOTO';
  /** Object path inside the MAPCO place-media bucket. */
  storagePath: string | null;
  publicUrl: string | null;
  mimeType: string | null;
  widthPx: number | null;
  heightPx: number | null;
  /** Google requires attribution to be displayed alongside the photo. */
  attributions: string[];
  retrievedAt: string | null;
  status: 'stored' | 'unavailable' | 'pending';
  /* ── cached place facts ──────────────────────────────────────────
     Stored alongside the media so a REUSED place costs NOTHING at all.
     Without these, every reuse would still need a paid Place Details
     call just to recover the coordinate the route needs. */
  displayName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  primaryType?: string | null;
}

export interface PlaceEnrichment {
  placeId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  primaryType: string | null;
  formattedAddress: string | null;
  media: PlaceMedia | null;
}

/** A persisted road route from the property to one destination. */
export interface RouteResultRecord {
  destinationKey: string;
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  travelMode: 'DRIVE' | 'WALK';
  computedAt: string;
}

/* ── The view model the UI renders ──────────────────────────────── */

export type ImageSource = 'google-place-photo' | 'none';

/** A point the Routes API can route to. */
export interface RouteTarget {
  kind: 'place' | 'geographic';
  placeId?: string;
  latitude: number;
  longitude: number;
}

export type RouteStatus = 'ok' | 'unavailable' | 'not_applicable' | 'withheld';

/** One card in the Property Intelligence UI. */
export interface IntelligencePlace {
  id: string;
  /** The normalization candidate id (L001 / C001). Stable across a run. */
  candidateId: string;
  group: 'local' | 'city';
  entityKind: EntityKind;
  /** Phase 2 category label, shown as the group heading. */
  category: string;
  /** Local only: 1 = default, 2–4 = alternatives. Undefined for City. */
  rank?: number;
  name: string;
  icon: string;
  /** Real Google Routes values. Null when routing genuinely failed — MAPCO
   *  never substitutes the Phase 1 approximate distance here. */
  distanceMeters: number | null;
  distanceLabel: string | null;
  durationSeconds: number | null;
  durationLabel: string | null;
  travelMode: 'DRIVE' | 'WALK' | null;
  /** Encoded road polyline for the map. Null when unavailable or withheld. */
  encodedPolyline: string | null;
  routeTarget: RouteTarget | null;
  routeStatus: RouteStatus;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  /** MAPCO-stored Google Place Photo URL. Null → honest placeholder. */
  image: string | null;
  imageSource: ImageSource;
  imageAttributions: string[];
  address: string | null;
}

export interface LocalCategoryView {
  category: string;
  icon: string;
  /** Ordered by rank. places[0] is always rank 1 — the default. */
  places: IntelligencePlace[];
}

export type IntelStatus = 'ready' | 'unavailable' | 'generating';

export type IntelUnavailableReason =
  | 'location_not_set' | 'no_dealer' | 'forbidden' | 'account_inactive'
  | 'property_not_found' | 'phase1_failed' | 'phase1_unparseable'
  | 'phase2_failed' | 'phase2_invalid' | 'insufficient_candidates'
  | 'server_not_configured' | 'busy' | 'cost_cap_reached'
  | 'provider_quota' | 'provider_timeout' | 'error';

export interface PropertyIntelligenceViewModel {
  status: IntelStatus;
  reason?: IntelUnavailableReason;
  generatedAt: string;
  schemaVersion: number;
  pipelineVersion: string;
  provider: string;
  model: string;
  origin: GeoPoint | null;
  /** Local Reach — category groups, each with a rank-1 default. */
  local: LocalCategoryView[];
  /** City Reach — a flat, unranked set of wider-location landmarks. */
  city: IntelligencePlace[];
  /** True when this payload has been reduced for a buyer (no exact origin,
   *  no polylines, no coordinates). Set by the client-link projection. */
  buyerSafe?: boolean;
}

/* ── Usage / cost accounting ────────────────────────────────────── */

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  /** Google Maps grounding queries billed by this call. */
  groundingQueries: number;
}

export type CacheOutcome = 'hit' | 'miss' | 'refresh' | 'stale_refresh';

/** One billable (or cache-avoided) operation. The cost ledger is a list of
 *  these — nothing is estimated without a recorded unit behind it. */
export interface CostEvent {
  provider:
    | 'google_vertex_gemini' | 'google_places'
    | 'google_routes' | 'google_maps_grounding';
  /** Maps to a versioned SKU in cost/pricing.ts. */
  operation: string;
  requests: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Billable units for non-token SKUs (calls, elements, photos). */
  units: number;
  cacheHit: boolean;
  /** ESTIMATED from recorded units. Never claimed as billed. */
  estimatedMicroUsd: number;
  estimatedInr: number;
  /** Marginal provider cost avoided because MAPCO reused persisted state. */
  avoidedMicroUsd: number;
  avoidedInr: number;
  detail?: string;
}

export type GenerationStage =
  | 'queued' | 'phase1' | 'normalization' | 'phase2'
  | 'validation' | 'enrichment' | 'complete' | 'failed';

export interface RunUsage {
  runId: string;
  provider: string;
  model: string;
  pipelineVersion: string;
  phase1PromptVersion: string;
  phase2PromptVersion: string;
  stage: GenerationStage;
  events: CostEvent[];
  totalMicroUsd: number;
  totalInr: number;
  inrPerUsd: number;
  pricingVersion: string;
  cacheOutcome: CacheOutcome;
  refreshReason?: string;
  latencyMs: number;
  status: 'succeeded' | 'unavailable' | 'failed';
  error?: string;
  /** Counts that make cache savings visible. */
  candidateCount: number;
  resolvedCount: number;
  selectedCount: number;
  photosReused: number;
  photosFetched: number;
  routesReused: number;
  routesComputed: number;
  repairAttempts: number;
}

/* ── Provider ports (implemented in providers/) ─────────────────── */

export interface ModelResponse {
  text: string;
  usage: ModelUsage;
  /** Recovered from Maps grounding chunks. */
  groundedPlaces: Array<{ placeId: string; title: string }>;
}

export interface GenerateOptions {
  /** Enables the Google Maps grounding tool at the given coordinate. */
  grounding?: { latitude: number; longitude: number };
  temperature?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  signal?: AbortSignal;
}

/** A single-turn text model. Phase 1 and Phase 2 each call this ONCE with a
 *  fresh request, so Phase 1 grounding context never contaminates Phase 2. */
export interface TextModelProvider {
  readonly name: string;
  readonly model: string;
  generate(prompt: string, opts?: GenerateOptions): Promise<ModelResponse>;
}

export interface PlacesIdentityResult {
  status: PlacesResolutionStatus;
  placeId: string | null;
  candidatePlaceIds: string[];
  fieldMask: string[];
}

export interface PlaceDetailsResult {
  displayName: string;
  latitude: number;
  longitude: number;
  primaryType: string | null;
  formattedAddress: string | null;
  photoName: string | null;
  photoAttributions: string[];
  photoWidthPx: number | null;
  photoHeightPx: number | null;
}

export interface PlacesPort {
  /** Cheap ID_ONLY identity resolution for one candidate name. */
  resolveIdentity(
    query: string, near: GeoPoint, opts?: { signal?: AbortSignal },
  ): Promise<PlacesIdentityResult>;
  /** Details for a place MAPCO has decided to present. */
  details(placeId: string, opts?: { signal?: AbortSignal }): Promise<PlaceDetailsResult | null>;
  /** Download the actual photo bytes for persistent MAPCO storage. */
  photoBytes(
    photoName: string, opts?: { maxWidthPx?: number; signal?: AbortSignal },
  ): Promise<{ bytes: Uint8Array; mimeType: string } | null>;
}

export interface RoutesPort {
  computeRoute(
    origin: GeoPoint,
    destination: { placeId?: string; latitude: number; longitude: number },
    opts?: { travelMode?: 'DRIVE' | 'WALK'; signal?: AbortSignal },
  ): Promise<{ distanceMeters: number; durationSeconds: number; encodedPolyline: string } | null>;
}

/** Persistent MAPCO state the pipeline reads and writes. Implemented by the
 *  Edge Function (Supabase) and the dev middleware (filesystem) so the
 *  pipeline itself stays runtime-neutral and fully testable. */
export interface IntelligenceStore {
  /** Global place registry lookup — the reason a photo is downloaded once. */
  getPlaceMedia(placeIds: string[]): Promise<Map<string, PlaceMedia>>;
  putPlaceMedia(media: PlaceMedia): Promise<PlaceMedia>;
  /** Persist photo bytes; returns the stored path and public URL. */
  storePhoto(
    placeId: string, bytes: Uint8Array, mimeType: string,
  ): Promise<{ storagePath: string; publicUrl: string } | null>;
  /** Route cache keyed by origin key + destination key. */
  getRoutes(originKey: string, destinationKeys: string[]): Promise<Map<string, RouteResultRecord>>;
  putRoute(originKey: string, record: RouteResultRecord): Promise<void>;
}

/* ── Pipeline input / deps / result ─────────────────────────────── */

export interface PipelineInput {
  dealerId: string;
  propertyId: string;
  point: GeoPoint;
  locality: string;
  city: string;
  propertyType?: string;
  propertySubtype?: string;
  /** Property sector, used for the deterministic sameSector signal. */
  propertySector?: string;
  locationUpdatedAt?: string;
  refreshReason?: string;
}

export interface PipelineLimits {
  /** Hard ceiling on Places identity resolutions per generation. */
  maxIdentityResolutions: number;
  /** Hard ceiling on enriched (details + photo) places per generation. */
  maxEnrichedPlaces: number;
  /** Hard ceiling on Routes calls per generation. */
  maxRouteCalls: number;
  /** Abort the generation when the running estimate would exceed this. */
  maxGenerationInr: number;
}

/** Sized for the finalized architecture: ~50–80 Local + 15–30 City
 *  candidates resolved, then only the Phase 2 selections enriched. The INR
 *  ceiling is the product decision (₹40 per generation), overridable per
 *  dealer and per platform through configuration. */
export const DEFAULT_LIMITS: PipelineLimits = {
  maxIdentityResolutions: 140,
  maxEnrichedPlaces: 70,
  maxRouteCalls: 70,
  maxGenerationInr: 40,
};

export interface PipelineDeps {
  model: TextModelProvider;
  places: PlacesPort;
  routes: RoutesPort;
  store: IntelligenceStore;
  limits?: PipelineLimits;
  pricing?: import('./cost/pricing.ts').PricingConfig;
  now: () => string;
  /** Deterministic id factory (tests inject a counter). */
  makeId?: (seed: string) => string;
  signal?: AbortSignal;
  log?: (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => void;
}

/** Everything one generation produced — the UI payload plus everything
 *  needed to reconstruct it without paying a provider again. */
export interface PipelineResult {
  viewModel: PropertyIntelligenceViewModel;
  usage: RunUsage;
  inputDigest: string;
  /** Persisted so a regeneration can be diffed and audited. */
  candidateUniverse: NormalizedCandidate[];
  phase2Output: Phase2Output | null;
}
