/* MAPCO — Property Intelligence · public surface (runtime-neutral).
   Shared verbatim by the browser client, the Vite dev middleware and the
   Supabase Edge Function. Nothing here touches a DOM, Node or Deno API. */

/* domain */
export * from './types.ts';

/* pipeline */
export { runPropertyIntelligence, PipelineError, MIN_CANDIDATES } from './pipeline.ts';
export type { RunOptions } from './pipeline.ts';

/* phases */
export {
  parsePhase1Output, indexGroundedPlaces, lookupGroundedPlaceId, normalizeName,
  parseRating, parseReviewCount, parseApproxKm,
} from './phase1/parse.ts';
export {
  normalizeCandidates, buildPhase2Input, computeSameSector, sectorToken,
  candidateId, identityQuery, knownPlaceIdsFrom,
} from './normalize/index.ts';
export type { NormalizeOptions, NormalizeResult } from './normalize/index.ts';
export {
  validatePhase2Output, extractJson, buildFeedback,
  MAX_LOCAL_PLACES_PER_CATEGORY, MAX_LOCAL_CATEGORIES, MAX_CITY_PLACES,
} from './phase2/validate.ts';
export {
  enrichSelections, routeOriginKey, routeDestinationKey,
  ROUTE_CACHE_VERSION, PHOTO_MAX_WIDTH_PX,
} from './enrich/index.ts';
export type { Selection, EnrichDeps, EnrichResult, EnrichStats } from './enrich/index.ts';

/* prompts — the finalized wording, loaded from ./prompts/*.txt */
export {
  PHASE1_PROMPT_TEMPLATE, PHASE2_PROMPT, buildPhase1Prompt,
  PHASE1_PROMPT_SHA256, PHASE2_PROMPT_SHA256,
  PHASE1_PROMPT_VERSION, PHASE2_PROMPT_VERSION,
} from './prompts/index.ts';

/* providers */
export { GeminiVertexTextModel, DiscoveryError } from './providers/gemini-vertex.ts';
export type { GeminiVertexConfig } from './providers/gemini-vertex.ts';
export { GooglePlacesClient } from './providers/google-places.ts';
export type { GooglePlacesConfig } from './providers/google-places.ts';
export { GoogleRoutesClient, RoutesError } from './providers/google-routes.ts';
export type { GoogleRoutesConfig } from './providers/google-routes.ts';

/* cost */
export { CostLedger } from './cost/ledger.ts';
export {
  DEFAULT_PRICING, INDIA_PRICING, GLOBAL_PRICING,
  microUsdFor, microUsdToInr, formatInr, parsePricingOverride,
} from './cost/pricing.ts';
export type { PricingConfig, PricingRegion, CostOperation, Rate } from './cost/pricing.ts';

/* utilities */
export { metersBetween, nearestOnPath, formatDistance, formatDuration } from './geo.ts';
export { decodePolyline } from './polyline.ts';
export { computeInputDigest, cacheKeyString } from './cache-key.ts';
export type { CacheIdentity } from './cache-key.ts';
export { categoryIcon } from './icons.ts';

/* buyer-safe projection */
export { toBuyerSafeIntelligence } from './buyer-safe.ts';
export type { LocationVisibility } from './buyer-safe.ts';
