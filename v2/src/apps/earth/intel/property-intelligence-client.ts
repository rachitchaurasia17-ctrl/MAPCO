/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · browser client
   ---------------------------------------------------------------
   Calls the MAPCO-owned server (never a provider directly, never with a
   secret in the browser):
     • dev  → the Vite dev middleware at /api/property-intelligence
     • prod → the Supabase Edge Function
              functions/v1/property-intelligence

   The session JWT is forwarded so the server derives the dealer under
   the caller's own identity. The dealer id is NEVER sent in the body,
   and neither is the coordinate in production — the Edge Function reads
   the canonical location from the database, so a caller cannot ask for
   intelligence about a location they do not own.

   Routes are computed server-side during generation and arrive already
   attached to each card, so clicking a place costs nothing and works
   offline from the cached payload.
   ═══════════════════════════════════════════════════════════════ */
import { getSupabase } from '../../../packages/data/supabase/client';
import type {
  GeoPoint, PropertyIntelligenceViewModel,
} from '../../../packages/property-intelligence';

export interface IntelClientResult extends PropertyIntelligenceViewModel {
  /** 'hit' | 'miss' | 'busy' — diagnostic only. */
  cache?: string;
  /** Estimated INR for this generation. Absent on a cache hit. */
  costInr?: number;
}

const DEV = Boolean((import.meta as { env?: Record<string, unknown> }).env?.DEV);
const SUPABASE_URL = String(
  (import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL ?? '',
).replace(/\/$/, '');
const ANON = String(
  (import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY ?? '',
);

const INTEL_URL = DEV
  ? '/api/property-intelligence'
  : `${SUPABASE_URL}/functions/v1/property-intelligence`;

async function headers(): Promise<Record<string, string>> {
  const out: Record<string, string> = { 'content-type': 'application/json' };
  try {
    const supabase = await getSupabase();
    const token = supabase
      ? (await supabase.auth.getSession()).data.session?.access_token
      : undefined;
    if (token) out.Authorization = `Bearer ${token}`;
    if (!DEV && ANON) out.apikey = ANON;
  } catch { /* unauthenticated dev is fine */ }
  return out;
}

export function unavailableIntelligence(
  reason: PropertyIntelligenceViewModel['reason'],
): IntelClientResult {
  return {
    status: 'unavailable',
    reason,
    generatedAt: new Date().toISOString(),
    schemaVersion: 0,
    pipelineVersion: '',
    provider: '',
    model: '',
    origin: null,
    local: [],
    city: [],
  };
}

export interface FetchIntelligenceInput {
  propertyId: string;
  /** Dev only: the middleware has no database to read the location from. */
  point: GeoPoint;
  locality?: string;
  city?: string;
  locationUpdatedAt?: string;
}

export async function fetchPropertyIntelligence(
  input: FetchIntelligenceInput,
  opts: { refresh?: boolean; signal?: AbortSignal } = {},
): Promise<IntelClientResult> {
  try {
    const response = await fetch(INTEL_URL, {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({
        propertyId: input.propertyId,
        refresh: opts.refresh === true,
        // In production the server ignores these and uses the canonical
        // record; the dev middleware has no database and needs them.
        latitude: input.point.latitude,
        longitude: input.point.longitude,
        locality: input.locality ?? '',
        city: input.city ?? '',
        locationUpdatedAt: input.locationUpdatedAt,
      }),
      signal: opts.signal,
    });
    if (!response.ok) return unavailableIntelligence('error');
    return await response.json() as IntelClientResult;
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    return unavailableIntelligence('error');
  }
}

/** Every card in the payload, flattened — used for lookups by card id. */
export function allPlaces(viewModel: PropertyIntelligenceViewModel) {
  return [...viewModel.local.flatMap((category) => category.places), ...viewModel.city];
}
