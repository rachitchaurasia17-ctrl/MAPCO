// MAPCO · Property Intelligence — authenticated dealer surface (production)
// ---------------------------------------------------------------
// The production counterpart of the Vite dev middleware. It runs the SAME
// runtime-neutral core pipeline (v2/src/packages/property-intelligence) with
// every secret kept in the Edge runtime:
//   • Gemini via Vertex AI, authenticated by a Google SERVICE IDENTITY
//     (service-account JSON in GOOGLE_SERVICE_ACCOUNT_JSON, or a short-lived
//     VERTEX_ACCESS_TOKEN) — the same provider the local path drives with ADC,
//     so swapping the identity never touches Property Intelligence code.
//   • Google Places (New) + Google Routes via GOOGLE_MAPS_SERVER_KEY.
//
// Tenancy: the dealer id is NEVER taken from the request. It is derived from
// plotmap_current_dealer_id() under the caller's own JWT, and the property's
// canonical coordinate is read from the database — never a client-supplied one.
// Persistence + RLS live in the property_intelligence table; cost/usage in
// property_intelligence_runs.
//
// Deploy note: `supabase functions deploy property-intelligence` bundles the
// shared package (imported relatively below) via Deno; roads.json is bundled
// from this directory. Set edge secrets: GOOGLE_MAPS_SERVER_KEY,
// VERTEX_PROJECT, VERTEX_LOCATION, VERTEX_MODEL, and one of
// GOOGLE_SERVICE_ACCOUNT_JSON / VERTEX_ACCESS_TOKEN, plus MAPCO_AI_ALLOWED_ORIGINS.

import { rpc, resolveCaller, backendConfigured } from '../_shared/db.ts';
import { allowedOrigins, corsHeaders, json, readJsonBody } from '../_shared/http.ts';
import { logEvent } from '../_shared/redact.ts';
import {
  runPropertyIntelligence, GeminiMapsDiscoveryProvider, GooglePlacesResolver,
  GoogleRoutesClient, computeInputDigest, parseRatesOverride,
  PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
  type GeoPoint, type RoadGeometry, type PipelineDeps,
} from '../../../v2/src/packages/property-intelligence/index.ts';
import roadsData from './roads.json' with { type: 'json' };

const ORIGINS = allowedOrigins('MAPCO_AI_ALLOWED_ORIGINS');
const ROADS = roadsData as RoadGeometry[];

const VERTEX = {
  project: Deno.env.get('VERTEX_PROJECT') || 'mapco-504912',
  location: Deno.env.get('VERTEX_LOCATION') || 'global',
  model: Deno.env.get('VERTEX_MODEL') || 'gemini-3.6-flash',
};
const MAPS_KEY = Deno.env.get('GOOGLE_MAPS_SERVER_KEY') || '';
const RATES = parseRatesOverride(Deno.env.get('PROPERTY_INTELLIGENCE_RATES'));
const PROVIDER_NAME = 'vertex-gemini';
// Regenerate if a cached result is older than this many days (staleness gate).
const STALE_AFTER_DAYS = Number(Deno.env.get('PROPERTY_INTELLIGENCE_STALE_DAYS') || '90');

/* ── Vertex access token via a Google service identity ──────────── */
let tokenCache = { value: '', exp: 0 };
function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  const raw = atob(body);
  const der = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) der[i] = raw.charCodeAt(i);
  return der;
}
async function mintServiceAccountToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })));
  const input = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  const assertion = `${input}.${b64url(new Uint8Array(sig))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(assertion)}`,
  });
  if (!res.ok) throw new Error(`sa_token_${res.status}`);
  const j = await res.json() as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error('sa_token_empty');
  tokenCache = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 - 60000 };
  return j.access_token;
}
async function getVertexToken(): Promise<string> {
  const direct = Deno.env.get('VERTEX_ACCESS_TOKEN');
  if (direct) return direct;
  if (tokenCache.value && Date.now() < tokenCache.exp) return tokenCache.value;
  const sa = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!sa) throw new Error('vertex_identity_unavailable');
  return mintServiceAccountToken(sa);
}

function buildDeps(): PipelineDeps {
  return {
    discovery: new GeminiMapsDiscoveryProvider({
      project: VERTEX.project, location: VERTEX.location, model: VERTEX.model,
      getAccessToken: getVertexToken, thinkingBudget: 1024,
    }),
    resolver: new GooglePlacesResolver({ apiKey: MAPS_KEY }),
    matrix: new GoogleRoutesClient({ apiKey: MAPS_KEY }),
    roads: ROADS,
    now: () => new Date().toISOString(),
    log: (lvl, ev, d) => logEvent(lvl, `pi.${ev}`, d ?? {}),
  };
}

interface StoredLocation { latitude?: number; longitude?: number; updatedAt?: string }
interface CachedResult {
  inputDigest?: string; schemaVersion?: number; status?: string; reason?: string;
  generatedAt?: string; dayToDay?: unknown[]; cityReach?: unknown[];
}
interface GetResult { ok?: boolean; dealerId?: string; location?: StoredLocation | null; cached?: CachedResult | null }

function unavailable(reason: string): Record<string, unknown> {
  return {
    status: 'unavailable', reason, generatedAt: new Date().toISOString(),
    schemaVersion: PROPERTY_INTELLIGENCE_SCHEMA_VERSION, provider: '', model: '',
    origin: { latitude: 0, longitude: 0 }, dayToDay: [], cityReach: [],
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get('Origin');
  const clean = String(origin || '').replace(/\/$/, '');
  const headers = corsHeaders(origin, ORIGINS);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405, headers);
  if (ORIGINS.size === 0) return json({ ok: false, reason: 'unavailable' }, 503, headers);
  if (!origin || !ORIGINS.has(clean)) return json({ ok: false, reason: 'unavailable' }, 403, headers);
  if (!backendConfigured() || !MAPS_KEY) return json({ ok: false, reason: 'unavailable' }, 503, headers);

  const caller = await resolveCaller(request);
  if (!caller) return json({ ok: false, reason: 'unauthorized' }, 401, headers);

  const body = await readJsonBody(request);
  if (!body) return json({ ok: false, reason: 'invalid_body' }, 400, headers);
  const intent = String(body.intent ?? 'intelligence');

  // ── Route: draw the real polyline for a clicked destination ──────
  if (intent === 'route') {
    const originLat = Number(body.originLat);
    const originLng = Number(body.originLng);
    const target = body.target as { placeId?: string; latitude?: number; longitude?: number } | undefined;
    if (!Number.isFinite(originLat) || !Number.isFinite(originLng) || !target) {
      return json({ ok: false, reason: 'bad_request' }, 400, headers);
    }
    try {
      const client = new GoogleRoutesClient({ apiKey: MAPS_KEY });
      const line = await client.computeRoute(
        { latitude: originLat, longitude: originLng },
        { placeId: target.placeId, latitude: target.latitude, longitude: target.longitude },
      );
      return json(line ? { ok: true, ...line } : { ok: false, reason: 'no_route' }, 200, headers);
    } catch (err) {
      logEvent('error', 'pi.route.failed', { detail: err instanceof Error ? err.message : String(err) });
      return json({ ok: false, reason: 'route_failed' }, 200, headers);
    }
  }

  // ── Intelligence: cached-or-generate ─────────────────────────────
  const propertyId = String(body.propertyId ?? '').trim();
  if (!propertyId) return json(unavailable('missing_property'), 200, headers);
  const refresh = body.refresh === true;

  let ctx: GetResult;
  try {
    ctx = await rpc<GetResult>('plotmap_property_intelligence_get', { p_property_id: propertyId }, { accessToken: caller.accessToken });
  } catch {
    return json({ ok: false, reason: 'unavailable' }, 503, headers);
  }
  const dealerId = String(ctx?.dealerId ?? '');
  if (ctx?.ok !== true || !dealerId) return json({ ok: false, reason: 'unauthorized' }, 401, headers);

  // Canonical location ONLY — never a client-supplied coordinate.
  const loc = ctx.location ?? null;
  if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
    return json(unavailable('location_not_set'), 200, headers);
  }
  const point: GeoPoint = { latitude: loc.latitude, longitude: loc.longitude };
  const locationUpdatedAt = loc.updatedAt;

  const digest = await computeInputDigest({
    dealerId, propertyId, point, locationUpdatedAt,
    provider: PROVIDER_NAME, model: VERTEX.model,
  });

  // Cache hit: same digest, current schema, not stale, not a forced refresh.
  const cached = ctx.cached ?? null;
  const ageMs = cached?.generatedAt ? Date.now() - Date.parse(cached.generatedAt) : Infinity;
  const fresh = ageMs < STALE_AFTER_DAYS * 86400_000;
  if (!refresh && cached && cached.inputDigest === digest
    && cached.schemaVersion === PROPERTY_INTELLIGENCE_SCHEMA_VERSION && fresh) {
    void recordRun(dealerId, propertyId, VERTEX.model, cacheHitUsage(), 'hit');
    return json({
      status: cached.status ?? 'ready', reason: cached.reason,
      generatedAt: cached.generatedAt, schemaVersion: cached.schemaVersion,
      provider: PROVIDER_NAME, model: VERTEX.model, origin: point,
      dayToDay: cached.dayToDay ?? [], cityReach: cached.cityReach ?? [],
      cache: 'hit', costMicroUsd: 0,
    }, 200, headers);
  }

  try {
    const result = await runPropertyIntelligence(
      { dealerId, propertyId, point, locationUpdatedAt, refreshReason: refresh ? 'manual_refresh' : undefined },
      buildDeps(), { rates: RATES },
    );
    if (result.viewModel.status === 'ready') {
      await rpc('plotmap_property_intelligence_store', {
        p_dealer_id: dealerId, p_property_id: propertyId,
        p_schema_version: result.viewModel.schemaVersion,
        p_provider: result.viewModel.provider, p_model: result.viewModel.model,
        p_latitude: point.latitude, p_longitude: point.longitude,
        p_location_updated_at: locationUpdatedAt ?? null,
        p_input_digest: digest, p_status: result.viewModel.status,
        p_reason: result.viewModel.reason ?? null,
        p_day_to_day: result.viewModel.dayToDay, p_city_reach: result.viewModel.cityReach,
      });
    }
    void recordRun(dealerId, propertyId, VERTEX.model, result.usage, refresh ? 'refresh' : 'miss');
    return json({ ...result.viewModel, cache: refresh ? 'refresh' : 'miss', costMicroUsd: result.usage.costMicroUsd }, 200, headers);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logEvent('error', 'pi.generate.failed', { dealerId, detail: msg });
    // Preserve a previous successful result if a refresh failed.
    if (cached && cached.status === 'ready') {
      return json({
        status: 'ready', generatedAt: cached.generatedAt, schemaVersion: cached.schemaVersion,
        provider: PROVIDER_NAME, model: VERTEX.model, origin: point,
        dayToDay: cached.dayToDay ?? [], cityReach: cached.cityReach ?? [], cache: 'stale', costMicroUsd: 0,
      }, 200, headers);
    }
    const reason = /429|quota|rate|503|overload/i.test(msg) ? 'busy' : 'generation_failed';
    return json(unavailable(reason), 200, headers);
  }
});

function cacheHitUsage() {
  return {
    provider: PROVIDER_NAME, model: VERTEX.model, inputTokens: 0, outputTokens: 0,
    groundingQueries: 0, placesCalls: 0, matrixElements: 0, routeCalls: 0, repairAttempts: 0,
    costMicroUsd: 0, cacheOutcome: 'hit' as const, latencyMs: 0, status: 'succeeded' as const,
  };
}

async function recordRun(
  dealerId: string, propertyId: string, model: string,
  usage: ReturnType<typeof cacheHitUsage> | Awaited<ReturnType<typeof runPropertyIntelligence>>['usage'],
  outcome: 'hit' | 'miss' | 'refresh',
): Promise<void> {
  try {
    await rpc('plotmap_property_intelligence_record_run', {
      p_dealer_id: dealerId, p_property_id: propertyId,
      p_provider: usage.provider, p_model: model,
      p_input_tokens: usage.inputTokens, p_output_tokens: usage.outputTokens,
      p_grounding_queries: usage.groundingQueries, p_places_calls: usage.placesCalls,
      p_matrix_elements: usage.matrixElements, p_route_calls: usage.routeCalls,
      p_repair_attempts: usage.repairAttempts, p_cost_micro_usd: usage.costMicroUsd,
      p_cache_outcome: outcome, p_refresh_reason: (usage as { refreshReason?: string }).refreshReason ?? null,
      p_latency_ms: usage.latencyMs, p_status: usage.status,
      p_error: (usage as { error?: string }).error ?? null,
    });
  } catch (err) {
    logEvent('warn', 'pi.run.record_failed', { detail: err instanceof Error ? err.message : String(err) });
  }
}
