// Authenticated Client Presentation catalog broker.
//
// The SQL RPC returns a client-safe property projection plus only external
// public HTTPS photos. This broker uses its server-side service key to resolve
// canonical private property-photo paths and returns signed URLs, never paths.

type JsonRecord = Record<string, unknown>;

const SUPABASE_URL = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
const ANON_KEY = String(Deno.env.get('SUPABASE_ANON_KEY') || '');
const SERVICE_KEY = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
const ALLOWED_ORIGINS = new Set(
  String(Deno.env.get('PLOTMAP_ALLOWED_ORIGINS') || Deno.env.get('PLOTMAP_CLIENT_LINK_ALLOWED_ORIGINS') || '')
    .split(',').map((value) => value.trim().replace(/\/$/, '')).filter(Boolean),
);
const SIGNED_URL_SECONDS = 15 * 60;
const MAX_BODY_BYTES = 1024;

function headers(origin: string | null): HeadersInit {
  const clean = String(origin || '').replace(/\/$/, '');
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(clean) ? clean : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, x-mapco-client, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
}

function json(origin: string | null, body: JsonRecord, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function fetchJson(url: string, init: RequestInit): Promise<{ response: Response; data: unknown }> {
  const response = await fetch(url, init);
  return { response, data: await response.json().catch(() => null) };
}

async function callRpc(name: string, body: JsonRecord, token: string, key: string): Promise<{ response: Response; data: unknown }> {
  return fetchJson(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function sign(path: string): Promise<string | null> {
  if (!path || path.includes('..') || path.startsWith('/')) return null;
  const { response, data } = await fetchJson(
    `${SUPABASE_URL}/storage/v1/object/sign/property-photos/${path.split('/').map(encodeURIComponent).join('/')}`,
    {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
    },
  );
  const item = data && typeof data === 'object' ? data as JsonRecord : null;
  const signed = item && String(item.signedURL || item.signedUrl || '');
  return response.ok && signed.startsWith('/') ? `${SUPABASE_URL}/storage/v1${signed}` : null;
}

Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get('Origin');
  const cleanOrigin = String(origin || '').replace(/\/$/, '');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== 'POST') return json(origin, { ok: false, reason: 'unavailable' }, 405);
  if (!origin || !ALLOWED_ORIGINS.has(cleanOrigin)) return json(origin, { ok: false, reason: 'unavailable' }, 403);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) return json(origin, { ok: false, reason: 'unavailable' }, 503);

  const authorization = String(request.headers.get('Authorization') || '');
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(origin, { ok: false, reason: 'unauthorized' }, 401);
  const user = await fetchJson(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'GET', headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!user.response.ok) return json(origin, { ok: false, reason: 'unauthorized' }, 401);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json(origin, { ok: false, reason: 'invalid' }, 413);
  let input: JsonRecord;
  try { input = JSON.parse(raw || '{}') as JsonRecord; } catch { return json(origin, { ok: false, reason: 'invalid' }, 400); }
  const propertyId = input.propertyId == null ? null : String(input.propertyId).trim();
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 50);
  const offset = Math.max(Number(input.offset) || 0, 0);
  if (propertyId !== null && (!propertyId || propertyId.length > 160)) return json(origin, { ok: false, reason: 'invalid' }, 400);

  const projection = await callRpc('plotmap_presentation_properties', {
    p_limit: propertyId ? 1 : limit,
    p_offset: propertyId ? 0 : offset,
    p_property_id: propertyId,
  }, token, ANON_KEY);
  if (!projection.response.ok || !projection.data || typeof projection.data !== 'object') {
    return json(origin, { ok: false, reason: 'unavailable' }, projection.response.status || 503);
  }

  const envelope = projection.data as JsonRecord;
  const items = Array.isArray(envelope.items) ? structuredClone(envelope.items as JsonRecord[]) : [];
  const ids = items.map((item) => String(item.id || '')).filter(Boolean);
  if (ids.length) {
    // This private helper verifies the same dealer and visible property before it
    // returns object paths. Its result never leaves this service-role runtime.
    const media = await callRpc('plotmap_presentation_property_media', { p_property_ids: ids }, SERVICE_KEY, SERVICE_KEY);
    const byProperty = media.response.ok && media.data && typeof media.data === 'object'
      ? media.data as JsonRecord : {};
    for (const item of items) {
      const paths = Array.isArray(byProperty[String(item.id || '')])
        ? byProperty[String(item.id || '')] as unknown[] : [];
      const signed = (await Promise.all(paths.slice(0, 8).map((path) => sign(String(path))))).filter(Boolean);
      const external = Array.isArray(item.photos) ? item.photos.filter((url) => /^https:\/\//i.test(String(url))) : [];
      item.photos = [...external, ...signed];
    }
  }

  return json(origin, {
    ok: true,
    items,
    total: Number(envelope.total) || 0,
    nextOffset: Number.isInteger(envelope.nextOffset) ? envelope.nextOffset : null,
  }, 200);
});
