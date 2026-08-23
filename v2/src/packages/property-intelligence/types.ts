/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · domain types (runtime-neutral)
   ---------------------------------------------------------------
   These types are shared verbatim by three runtimes:
     • the browser client (finished UI in earth/property-detail.ts),
     • the Vite dev middleware (local-live server),
     • the Supabase Edge Function (production server).
   Nothing here may import a DOM, Node or Deno API. Only plain data.
   ═══════════════════════════════════════════════════════════════ */

/** Schema version of a persisted Property Intelligence result. Bump this
 *  whenever the shape or generation contract changes so stale cache rows
 *  are naturally invalidated. */
export const PROPERTY_INTELLIGENCE_SCHEMA_VERSION = 1;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type IntelGroup = 'dayToDay' | 'cityReach';

/** The six fixed Day-to-Day categories, in display order. */
export type DayToDayCategory =
  | 'park'
  | 'grocery'
  | 'gym'
  | 'school'
  | 'healthcare'
  | 'daily_market';

export const DAY_TO_DAY_ORDER: DayToDayCategory[] = [
  'park', 'grocery', 'gym', 'school', 'healthcare', 'daily_market',
];

/** City Reach destination kinds Gemini may return. No fixed set of PLACES —
 *  only a vocabulary of destination TYPES so the six anchors are location
 *  specific rather than hard-coded. */
export type CityReachType =
  | 'mall'
  | 'road'
  | 'hospital'
  | 'airport'
  | 'stadium'
  | 'business_district'
  | 'institution'
  | 'civic'
  | 'landmark';

/** Whether a destination routes to a Google Place or to a MAPCO-owned road. */
export type DestinationKind = 'place' | 'road';

/** A point the Routes API can route to: a stable Google Place id, or a raw
 *  coordinate (used for MAPCO road access points and grounded fallbacks). */
export interface RouteTarget {
  kind: DestinationKind;
  /** Preferred: stable Google Place id (indefinitely cacheable). */
  placeId?: string;
  latitude: number;
  longitude: number;
}

/** One row in the finished Property Intelligence UI. The UI renders only
 *  `name`, `icon` and `distanceLabel`; the rest drives real routing. */
export interface IntelligencePlace {
  id: string;
  group: IntelGroup;
  /** Internal bucket (day-to-day category or city-reach type) — not shown. */
  destinationType: string;
  name: string;
  icon: string;
  distanceMeters: number;
  distanceLabel: string;
  durationSeconds: number;
  durationLabel: string;
  routeTarget: RouteTarget;
  /** Provenance — stored, never displayed. */
  placeId?: string;
  latitude: number;
  longitude: number;
  /** Legacy field kept for the existing UI's category read. */
  category?: string;
}

export type IntelStatus = 'ready' | 'unavailable';

export interface PropertyIntelligenceViewModel {
  status: IntelStatus;
  /** Present when status = 'unavailable'. Machine reason for the truthful
   *  "unavailable" state — never a fabricated result. */
  reason?: string;
  generatedAt: string;
  schemaVersion: number;
  provider: string;
  model: string;
  origin: GeoPoint;
  dayToDay: IntelligencePlace[];
  cityReach: IntelligencePlace[];
}

/* ── Discovery (Gemini) ─────────────────────────────────────────── */

export interface DiscoveryCandidate {
  group: IntelGroup;
  /** Day-to-Day only. */
  category?: DayToDayCategory;
  /** City Reach only. */
  destinationType?: CityReachType;
  /** Exact real place name as it appears in Google Maps. */
  name: string;
  reason?: string;
  /** Place id recovered from grounding chunks, when the model cited it. */
  groundedPlaceId?: string;
}

export interface DiscoveryUsage {
  inputTokens: number;
  outputTokens: number;
  /** Google Maps grounding queries billed by this call (best-effort count). */
  groundingQueries: number;
}

export interface DiscoveryResult {
  candidates: DiscoveryCandidate[];
  usage: DiscoveryUsage;
}

export interface DiscoverOptions {
  /** Region/area label to steer the model (e.g. "Tri-City, Punjab, India"). */
  regionHint?: string;
  signal?: AbortSignal;
}

export interface PropertyIntelligenceDiscoveryProvider {
  readonly name: string;
  readonly model: string;
  discover(point: GeoPoint, opts?: DiscoverOptions): Promise<DiscoveryResult>;
}

/* ── Resolution (Google Places) ─────────────────────────────────── */

export interface ResolvedDestination {
  kind: DestinationKind;
  placeId?: string;
  name: string;
  latitude: number;
  longitude: number;
  primaryType?: string;
}

export interface GeoResolver {
  /** Resolve a free-text place name near a point to a canonical Google Place.
   *  Returns null when nothing genuine matches (never a guess). */
  resolvePlace(name: string, near: GeoPoint, opts?: { includedType?: string; signal?: AbortSignal }): Promise<ResolvedDestination | null>;
}

/* ── Routing (Google Routes) ────────────────────────────────────── */

export interface RoutePoint {
  placeId?: string;
  latitude?: number;
  longitude?: number;
}

export interface MatrixElement {
  ok: boolean;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteMatrixClient {
  computeMatrix(origin: RoutePoint, destinations: RoutePoint[], opts?: { signal?: AbortSignal }): Promise<MatrixElement[]>;
}

export interface RouteLine {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
}

export interface RouteClient {
  computeRoute(origin: RoutePoint, destination: RoutePoint, opts?: { signal?: AbortSignal }): Promise<RouteLine | null>;
}

/* ── Road geometry (MAPCO-owned GeoJSON) ────────────────────────── */

export interface RoadGeometry {
  id: string;
  name: string;
  aliases: string[];
  /** Ordered path points (lat/lng). */
  path: GeoPoint[];
}

/* ── Usage / cost accounting ────────────────────────────────────── */

export type CacheOutcome = 'hit' | 'miss' | 'refresh' | 'stale_refresh';

export interface RunUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  groundingQueries: number;
  placesCalls: number;
  matrixElements: number;
  routeCalls: number;
  repairAttempts: number;
  costMicroUsd: number;
  cacheOutcome: CacheOutcome;
  refreshReason?: string;
  latencyMs: number;
  status: 'succeeded' | 'unavailable' | 'failed';
  error?: string;
}

/* ── Pipeline input/deps/result ─────────────────────────────────── */

export interface PipelineInput {
  dealerId: string;
  propertyId: string;
  point: GeoPoint;
  locationUpdatedAt?: string;
  regionHint?: string;
  /** Reason a regeneration was requested (audit only). */
  refreshReason?: string;
}

export interface PipelineDeps {
  discovery: PropertyIntelligenceDiscoveryProvider;
  resolver: GeoResolver;
  matrix: RouteMatrixClient;
  roads: RoadGeometry[];
  /** Injected ISO clock (Deno/Node/browser agnostic; keeps the module pure). */
  now: () => string;
  /** Optional deterministic id factory for tests. */
  makeId?: (seed: string) => string;
  signal?: AbortSignal;
  log?: (level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) => void;
}

export interface PipelineResult {
  viewModel: PropertyIntelligenceViewModel;
  usage: RunUsage;
  /** sha256 of the discovery inputs — the reuse/cache digest. */
  inputDigest: string;
}
