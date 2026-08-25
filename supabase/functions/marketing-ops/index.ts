// MAPCO-DEV Marketing broker.
// Authenticates the browser actor, calls service-only tenant projections,
// signs private media, and removes every Storage path from the response.

type JsonRecord = Record<string, unknown>;

const SUPABASE_URL = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
const ANON_KEY = String(Deno.env.get('SUPABASE_ANON_KEY') || '');
const SERVICE_KEY = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
const ALLOWED_ORIGINS = new Set([
  ...String(Deno.env.get('PLOTMAP_ALLOWED_ORIGINS') || Deno.env.get('PLOTMAP_CLIENT_LINK_ALLOWED_ORIGINS') || '')
    .split(',').map((value) => value.trim().replace(/\/$/, '')).filter(Boolean),
  // This function is deployed only to MAPCO-DEV; local Vite is a required
  // verification surface, not a production wildcard.
  'http://localhost:5173', 'http://127.0.0.1:5173',
]);
const MAX_BODY_BYTES = 2048;
const SIGNED_URL_SECONDS = 15 * 60;

const record = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};

function headers(origin: string | null): HeadersInit {
  const clean = String(origin || '').replace(/\/$/, '');
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(clean) ? clean : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, x-mapco-client, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600', 'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'", 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff', Vary: 'Origin',
  };
}

function json(origin: string | null, body: JsonRecord, status: number): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...headers(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function rpcFailureStatus(response: Response, envelope: JsonRecord): number {
  if (!response.ok) return response.status;
  const reason = String(envelope.reason || '');
  if (/authori[sz]ed|access|required/.test(reason)) return 403;
  if (/not_found/.test(reason)) return 404;
  if (/invalid/.test(reason)) return 400;
  return 409;
}

async function fetchJson(url: string, init: RequestInit): Promise<{ response: Response; data: unknown }> {
  const response = await fetch(url, init);
  return { response, data: await response.json().catch(() => null) };
}

async function rpc(name: string, body: JsonRecord): Promise<{ response: Response; data: unknown }> {
  return fetchJson(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify(body),
  });
}

function validPath(path: string, dealerId: string): boolean {
  return !!path && path.length <= 500 && !path.includes('..') && !path.startsWith('/')
    && path.startsWith(`${dealerId}/`);
}

async function sign(bucket: string, path: string): Promise<string | null> {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const result = await fetchJson(`${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encoded}`, {
    method: 'POST', headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json',
    }, body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
  });
  const item = record(result.data);
  const signed = String(item.signedURL || item.signedUrl || '');
  return result.response.ok && signed.startsWith('/') ? `${SUPABASE_URL}/storage/v1${signed}` : null;
}

function forbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(forbiddenKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as JsonRecord).some(([key, child]) =>
    /(^|_)(path|photorefs|owner|seller|commission|notes?|location|latitude|longitude|coordinates?)$/i.test(key)
    || forbiddenKey(child));
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get('Origin');
  const cleanOrigin = String(origin || '').replace(/\/$/, '');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== 'POST') return json(origin, { ok: false, reason: 'unavailable' }, 405);
  if (!origin || !ALLOWED_ORIGINS.has(cleanOrigin)) return json(origin, { ok: false, reason: 'unavailable' }, 403);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) return json(origin, { ok: false, reason: 'unavailable' }, 503);

  const token = String(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(origin, { ok: false, reason: 'unauthorized' }, 401);
  const userResult = await fetchJson(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'GET', headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  const actorId = String(record(userResult.data).id || '');
  if (!userResult.response.ok || !actorId) return json(origin, { ok: false, reason: 'unauthorized' }, 401);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json(origin, { ok: false, reason: 'invalid' }, 413);
  let input: JsonRecord;
  try { input = JSON.parse(raw || '{}') as JsonRecord; } catch { return json(origin, { ok: false, reason: 'invalid' }, 400); }
  const action = String(input.action || '');
  const dealerId = String(input.dealerId || '').trim();
  const weekId = String(input.weekId || '').trim();
  const jobId = String(input.jobId || '').trim();

  let result: { response: Response; data: unknown };
  if (action === 'inventory') {
    if (!dealerId || dealerId.length > 120) return json(origin, { ok: false, reason: 'invalid' }, 400);
    result = await rpc('plotmap_marketing_ops_inventory_for', { p_actor: actorId, p_dealer_id: dealerId });
    const envelope = structuredClone(record(result.data));
    if (!result.response.ok || envelope.ok === false) return json(origin, { ok: false, reason: String(envelope.reason || 'unavailable') }, rpcFailureStatus(result.response, envelope));
    const properties = Array.isArray(envelope.properties) ? envelope.properties as JsonRecord[] : [];
    for (const property of properties) {
      const refs = Array.isArray(property.photoRefs) ? property.photoRefs : [];
      const paths = refs.map((entry) => String(record(entry).path || '')).filter((path) => validPath(path, dealerId)).slice(0, 12);
      property.photos = (await Promise.all(paths.map((path) => sign('property-photos', path)))).filter(Boolean);
      delete property.photoRefs;
    }
    const output = { ok: true, properties };
    if (forbiddenKey(output)) return json(origin, { ok: false, reason: 'projection_rejected' }, 500);
    return json(origin, output, 200);
  }

  if (action === 'week') {
    if (!dealerId || !/^\d{4}-W\d{2}$/.test(weekId)) return json(origin, { ok: false, reason: 'invalid' }, 400);
    result = await rpc('plotmap_marketing_ops_week_for', { p_actor: actorId, p_dealer_id: dealerId, p_week_id: weekId });
    const envelope = structuredClone(record(result.data));
    if (!result.response.ok || envelope.ok === false) return json(origin, { ok: false, reason: String(envelope.reason || 'unavailable') }, rpcFailureStatus(result.response, envelope));
    const assets = Array.isArray(envelope.assets) ? envelope.assets as JsonRecord[] : [];
    for (const asset of assets) {
      const path = String(asset.path || '');
      asset.displayUrl = validPath(path, dealerId) ? await sign('marketing-creatives', path) : null;
      delete asset.path; delete asset.bucket;
    }
    return json(origin, envelope, 200);
  }

  if (action === 'dealer-feed') {
    result = await rpc('plotmap_marketing_dealer_feed_for', { p_actor: actorId });
    const envelope = structuredClone(record(result.data));
    if (!result.response.ok || envelope.ok === false) return json(origin, { ok: false, reason: String(envelope.reason || 'unavailable') }, rpcFailureStatus(result.response, envelope));
    const feedDealer = String(envelope.dealerId || '');
    const creatives = Array.isArray(envelope.creatives) ? envelope.creatives as JsonRecord[] : [];
    for (const creative of creatives) {
      const asset = record(creative.asset); const path = String(asset.path || '');
      const bucket = String(asset.bucket || '');
      const allowedBucket = bucket === 'marketing-creatives' || bucket === 'marketing-reel-finished';
      creative.asset = {
        displayUrl: allowedBucket && validPath(path, feedDealer) ? await sign(bucket, path) : null,
        mime: asset.mime, width: asset.width, height: asset.height, bytes: asset.bytes,
        durationSeconds: asset.durationSeconds,
      };
    }
    if (forbiddenKey(envelope)) return json(origin, { ok: false, reason: 'projection_rejected' }, 500);
    return json(origin, envelope, 200);
  }

  if (action === 'usage') {
    result = await rpc('plotmap_marketing_usage_for', { p_actor: actorId });
    const envelope = structuredClone(record(result.data));
    if (!result.response.ok || envelope.ok === false) {
      return json(origin, { ok: false, reason: String(envelope.reason || 'unavailable') }, rpcFailureStatus(result.response, envelope));
    }
    return json(origin, envelope, 200);
  }

  if (action === 'operator-reels') {
    if (!dealerId || dealerId.length > 120) return json(origin, { ok: false, reason: 'invalid' }, 400);
    const periodStart = String(input.periodStart || '').trim();
    if (periodStart && !/^\d{4}-\d{2}-01$/.test(periodStart)) {
      return json(origin, { ok: false, reason: 'invalid' }, 400);
    }
    result = await rpc('plotmap_marketing_ops_reels_for', {
      p_actor: actorId,
      p_dealer_id: dealerId,
      p_period_start: periodStart || null,
    });
    const envelope = structuredClone(record(result.data));
    if (!result.response.ok || envelope.ok === false) {
      return json(origin, { ok: false, reason: String(envelope.reason || 'unavailable') }, rpcFailureStatus(result.response, envelope));
    }
    return json(origin, envelope, 200);
  }

  if (action === 'reel-media') {
    const kind = String(input.kind || '');
    if (!/^[0-9a-f-]{36}$/i.test(jobId) || (kind !== 'raw' && kind !== 'finished')) {
      return json(origin, { ok: false, reason: 'invalid' }, 400);
    }
    result = await rpc('plotmap_marketing_reel_media_for', {
      p_actor: actorId, p_job_id: jobId, p_kind: kind,
    });
    const envelope = structuredClone(record(result.data));
    if (!result.response.ok || envelope.ok === false) {
      return json(origin, { ok: false, reason: String(envelope.reason || 'unavailable') }, rpcFailureStatus(result.response, envelope));
    }
    const bucket = String(envelope.bucket || '');
    const path = String(envelope.path || '');
    const expectedBucket = kind === 'raw' ? 'marketing-reel-raw' : 'marketing-reel-finished';
    const displayUrl = bucket === expectedBucket && validPath(path, String(path.split('/')[0] || ''))
      ? await sign(bucket, path) : null;
    if (!displayUrl) return json(origin, { ok: false, reason: 'media_unavailable' }, 503);
    delete envelope.bucket; delete envelope.path;
    envelope.displayUrl = displayUrl;
    return json(origin, envelope, 200);
  }

  return json(origin, { ok: false, reason: 'invalid_action' }, 400);
});
