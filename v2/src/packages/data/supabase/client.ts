/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Supabase browser client (singleton)
   ---------------------------------------------------------------
   Security invariant #5 (20_SECURITY_INVARIANTS): the browser must
   NEVER hold a service-role key. This module hard-rejects any key
   whose JWT role is `service_role` or that is an `sb_secret_` key,
   and only accepts a publishable/anon key against an https
   *.supabase.co URL. The service-role key lives ONLY in edge runtimes.
   ═══════════════════════════════════════════════════════════════ */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseEnv {
  readonly url: string;
  readonly anonKey: string;
}

function decodeJwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

/** Throws if the key looks like a service-role/secret key. */
export function assertPublishableKey(key: string): void {
  if (!key) throw new Error('Supabase key missing');
  if (key.startsWith('sb_secret_')) {
    throw new Error('Refusing a service-role (sb_secret_) key in the browser');
  }
  if (decodeJwtRole(key) === 'service_role') {
    throw new Error('Refusing a service_role JWT in the browser');
  }
}

export function readEnv(): SupabaseEnv | null {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
    throw new Error('Supabase URL must be an https *.supabase.co origin');
  }
  assertPublishableKey(anonKey);
  return { url: url.replace(/\/$/, ''), anonKey };
}

let clientPromise: Promise<SupabaseClient> | null = null;

/** Lazily construct the client (dynamic import keeps supabase-js out of
 *  mock-mode bundles). Returns null if env is not configured. */
export async function getSupabase(): Promise<SupabaseClient | null> {
  const env = readEnv();
  if (!env) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(env.url, env.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        global: { headers: { 'x-mapco-client': 'v2-web' } },
      }),
    );
  }
  return clientPromise;
}

/** True when the app is configured to talk to a real Supabase project. */
export function supabaseConfigured(): boolean {
  try {
    return readEnv() !== null;
  } catch {
    return false;
  }
}
