// MAPCO shared Supabase REST access for Edge Functions.
//
// The service-role key never leaves this runtime and is never returned in a
// response body. Every call is a named SECURITY DEFINER RPC — there is no
// generic query surface here, and no AI-authored SQL can ever be executed.

import { logEvent } from './redact.ts';

export const SUPABASE_URL = String(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
const SERVICE_KEY = String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
const ANON_KEY = String(Deno.env.get('SUPABASE_ANON_KEY') || '');

export function backendConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY && ANON_KEY);
}

export class RpcError extends Error {
  constructor(readonly rpcName: string, readonly status: number, message: string) {
    super(message);
    this.name = 'RpcError';
  }
}

interface RpcOptions {
  /** Caller JWT. When present the RPC runs as that user, under their RLS. */
  readonly accessToken?: string;
  readonly timeoutMs?: number;
}

/**
 * Invoke a Postgres RPC.
 *
 * Without `accessToken` the call runs with the service role and is only
 * valid for worker-scoped functions that take an explicit dealer id and
 * were granted to `service_role` in the migrations.
 *
 * With `accessToken` the call runs as the signed-in dealer user, so RLS and
 * the `plotmap_current_dealer_id()` tenancy rules apply unchanged.
 */
export async function rpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
  options: RpcOptions = {},
): Promise<T> {
  if (!backendConfigured()) throw new RpcError(name, 503, 'backend_not_configured');
  const key = options.accessToken ? ANON_KEY : SERVICE_KEY;
  const bearer = options.accessToken || key;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      logEvent('error', 'rpc.failed', { rpc: name, status: response.status, body: text });
      throw new RpcError(name, response.status, `rpc_failed:${name}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  } catch (error) {
    if (error instanceof RpcError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    logEvent('error', 'rpc.transport', { rpc: name, detail: message });
    throw new RpcError(name, 0, `rpc_transport:${name}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve the caller's identity from their Authorization header. */
export async function resolveCaller(
  request: Request,
): Promise<{ userId: string; accessToken: string } | null> {
  const header = request.headers.get('Authorization') || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token || !backendConfigured()) return null;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const user = await response.json().catch(() => null) as { id?: string } | null;
    return user?.id ? { userId: String(user.id), accessToken: token } : null;
  } catch {
    return null;
  }
}
