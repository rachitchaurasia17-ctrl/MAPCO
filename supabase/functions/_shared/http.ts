// MAPCO shared Edge HTTP helpers.
// Same posture as resolve-client-link: explicit origin allow-list, bounded
// bodies, no-store responses, and a locked-down default CSP. Nothing here
// ever echoes a secret, a token or a signed URL.

export type JsonRecord = Record<string, unknown>;

export const MAX_BODY_BYTES = 16 * 1024;

export function allowedOrigins(envName: string): Set<string> {
  return new Set(
    String(Deno.env.get(envName) || '')
      .split(',')
      .map((value) => value.trim().replace(/\/$/, ''))
      .filter(Boolean),
  );
}

export function corsHeaders(origin: string | null, allowed: Set<string>): HeadersInit {
  const clean = String(origin || '').replace(/\/$/, '');
  return {
    'Access-Control-Allow-Origin': allowed.has(clean) ? clean : '',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, x-mapco-client, x-mapco-worker-key, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Security-Policy': "default-src 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
}

export function json(
  body: JsonRecord,
  status: number,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Reads a JSON body with a hard byte ceiling. Returns null when unusable. */
export async function readJsonBody(request: Request): Promise<JsonRecord | null> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return null;
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as JsonRecord
      : null;
  } catch {
    return null;
  }
}

/**
 * Constant-time-ish shared-secret comparison for the worker trigger.
 * Length is compared first, then every byte, so a mismatch never returns
 * early on the first differing character.
 */
export function secretMatches(provided: string | null, expected: string): boolean {
  if (!expected) return false;
  const a = new TextEncoder().encode(String(provided || ''));
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export function sha256Hex(value: string): Promise<string> {
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(value))
    .then((buffer) =>
      Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    );
}
