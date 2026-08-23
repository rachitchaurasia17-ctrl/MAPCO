/* MAPCO — Property Intelligence · public surface (runtime-neutral).
   Shared verbatim by the browser client, the Vite dev middleware and the
   Supabase Edge Function. */
export * from './types.ts';
export { runPropertyIntelligence } from './pipeline.ts';
export type { RunOptions } from './pipeline.ts';
export { GeminiMapsDiscoveryProvider, DiscoveryError } from './providers/gemini-vertex.ts';
export type { GeminiVertexConfig } from './providers/gemini-vertex.ts';
export { GooglePlacesResolver } from './providers/google-places.ts';
export type { GooglePlacesConfig } from './providers/google-places.ts';
export { GoogleRoutesClient, RoutesError } from './providers/google-routes.ts';
export type { GoogleRoutesConfig } from './providers/google-routes.ts';
export { resolveRoad, matchRoad } from './roads.ts';
export { parseRoadFeatureCollection, titleCaseRoad } from './roads-source.ts';
export { metersBetween, nearestOnPath, formatDistance, formatDuration } from './geo.ts';
export { decodePolyline } from './polyline.ts';
export { costMicroUsd, microUsdToUsd, DEFAULT_RATES, parseRatesOverride } from './cost.ts';
export type { CostRates, CostTally } from './cost.ts';
export { computeInputDigest, cacheKeyString } from './cache-key.ts';
export type { CacheIdentity } from './cache-key.ts';
export { dayToDayIcon, cityReachIcon } from './icons.ts';
