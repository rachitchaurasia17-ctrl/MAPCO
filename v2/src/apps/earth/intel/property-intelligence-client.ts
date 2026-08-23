/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · browser client
   ---------------------------------------------------------------
   Calls the MAPCO-owned server (never a provider directly, never with
   a secret in the browser):
     • dev  → the Vite dev middleware at /api/property-intelligence
     • prod → the Supabase Edge Function functions/v1/property-intelligence
   The session JWT is forwarded so the server derives the dealer under
   the caller's own identity (dealer id is never sent in the body).
   ═══════════════════════════════════════════════════════════════ */
import { getSupabase } from '../../../packages/data/supabase/client';
import type { PropertyIntelligenceViewModel, GeoPoint, RouteTarget } from '../../../packages/property-intelligence';

export interface IntelClientResult extends PropertyIntelligenceViewModel {
  cache?: string;
  costMicroUsd?: number;
}

export interface RouteResult {
  ok: boolean;
  encodedPolyline?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  reason?: string;
}

const DEV = Boolean((import.meta as { env?: Record<string, unknown> }).env?.DEV);
const SUPABASE_URL = String((import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const ANON = String((import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY ?? '');

const INTEL_URL = DEV ? '/api/property-intelligence' : `${SUPABASE_URL}/functions/v1/property-intelligence`;
const ROUTE_URL = DEV ? '/api/property-intelligence/route' : `${SUPABASE_URL}/functions/v1/property-intelligence`;

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  try {
    const sb = await getSupabase();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined;
    if (token) h.Authorization = `Bearer ${token}`;
    if (!DEV && ANON) h.apikey = ANON;
  } catch { /* unauthenticated dev is fine */ }
  return h;
}

export async function fetchPropertyIntelligence(
  propertyId: string,
  point: GeoPoint,
  locationUpdatedAt?: string,
  opts: { refresh?: boolean; signal?: AbortSignal } = {},
): Promise<IntelClientResult> {
  const res = await fetch(INTEL_URL, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({
      propertyId,
      latitude: point.latitude,
      longitude: point.longitude,
      locationUpdatedAt,
      refresh: opts.refresh === true,
      ...(DEV ? {} : { intent: 'intelligence' }),
    }),
    signal: opts.signal,
  });
  if (!res.ok) return unavailable('server_error');
  return await res.json() as IntelClientResult;
}

export async function fetchRoute(
  origin: GeoPoint,
  target: RouteTarget,
  opts: { signal?: AbortSignal } = {},
): Promise<RouteResult> {
  const res = await fetch(ROUTE_URL, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({
      ...(DEV ? {} : { intent: 'route' }),
      originLat: origin.latitude,
      originLng: origin.longitude,
      target: { placeId: target.placeId, latitude: target.latitude, longitude: target.longitude },
    }),
    signal: opts.signal,
  });
  if (!res.ok) return { ok: false, reason: 'server_error' };
  return await res.json() as RouteResult;
}

function unavailable(reason: string): IntelClientResult {
  return {
    status: 'unavailable', reason, generatedAt: new Date().toISOString(),
    schemaVersion: 0, provider: '', model: '',
    origin: { latitude: 0, longitude: 0 }, dayToDay: [], cityReach: [],
  };
}
