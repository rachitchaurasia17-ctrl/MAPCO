/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Active data adapter (mode switch)
   ---------------------------------------------------------------
   The single module every screen imports `adapter` from. It selects
   the concrete DataAdapterV2 implementation by build-time env:

     VITE_DATA_MODE=mock      → deterministic fixtures (development/tests only)
     VITE_DATA_MODE=supabase  → real MAPCO-DEV data (needs URL + anon key)

   Production fails closed with a visible configuration error. It never
   creates local-only links or records when Supabase configuration is absent.

   Screens never know which is active — they depend on the interface.
   supabase-js is dynamically imported inside the Supabase client, so
   mock-mode bundles never include it.
   ═══════════════════════════════════════════════════════════════ */
export * from './contracts';

import type { DataAdapterV2 } from './contracts';
import { adapter as mockAdapter } from './mock-adapter-v2';
import { SupabaseDataAdapter } from './supabase/supabase-adapter';
import { readEnv } from './supabase/client';

export type DataMode = 'mock' | 'supabase';

export interface DataModeEnvironment {
  readonly requested?: string;
  readonly production: boolean;
  readonly supabaseConfigured: boolean;
}

export class DataConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataConfigurationError';
  }
}

/** Pure selection rule, exported so production fail-closed behaviour is tested. */
export function selectDataMode(input: DataModeEnvironment): DataMode {
  if (input.requested === 'supabase') {
    if (!input.supabaseConfigured) {
      throw new DataConfigurationError('Supabase mode requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    return 'supabase';
  }
  if (input.requested === 'mock') {
    if (input.production) {
      throw new DataConfigurationError('Mock data is disabled in production. Set VITE_DATA_MODE=supabase.');
    }
    return 'mock';
  }
  if (input.production) {
    throw new DataConfigurationError('VITE_DATA_MODE must be set to supabase in production.');
  }
  return 'mock';
}

export function activeDataMode(): DataMode {
  const env = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};
  let configured = false;
  let configError: unknown;
  try {
    configured = readEnv() !== null;
  } catch (error) {
    configError = error;
  }
  if (env.VITE_DATA_MODE === 'supabase' && configError) throw configError;
  return selectDataMode({
    requested: typeof env.VITE_DATA_MODE === 'string' ? env.VITE_DATA_MODE : undefined,
    production: env.PROD === true || env.MODE === 'production',
    supabaseConfigured: configured,
  });
}

function showConfigurationError(error: unknown): void {
  if (typeof document === 'undefined') return;
  const message = error instanceof Error ? error.message : 'The production data service is not configured.';
  const show = () => {
    const host = document.getElementById('app') ?? document.body;
    host.innerHTML = `<main role="alert" style="min-height:100vh;display:grid;place-items:center;padding:32px;background:#fffaf0;font-family:system-ui,sans-serif;color:#241d0c"><section style="max-width:560px;padding:28px;border:1px solid #e6cf9a;border-radius:20px;background:#fff"><h1 style="margin:0;font-size:24px">MAPCO configuration error</h1><p style="margin:12px 0 0;line-height:1.55;color:#6b6156">${String(message).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)}</p><p style="margin:12px 0 0;font-size:13px;color:#8d8271">No mock or local data was loaded.</p></section></main>`;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
  else show();
}

function resolveAdapter(): DataAdapterV2 {
  try {
    return activeDataMode() === 'supabase' ? new SupabaseDataAdapter() : mockAdapter;
  } catch (error) {
    showConfigurationError(error);
    throw error;
  }
}

/** The active adapter for the whole app. */
export const adapter: DataAdapterV2 = resolveAdapter();
