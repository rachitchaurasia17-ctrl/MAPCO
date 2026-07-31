/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Active data adapter (mode switch)
   ---------------------------------------------------------------
   The single module every screen imports `adapter` from. It selects
   the concrete DataAdapterV2 implementation by build-time env:

     VITE_DATA_MODE=mock      → deterministic in-memory fixtures (default)
     VITE_DATA_MODE=supabase  → real MAPCO-DEV data (needs URL + anon key)

   Screens never know which is active — they depend on the interface.
   supabase-js is dynamically imported inside the Supabase client, so
   mock-mode bundles never include it.
   ═══════════════════════════════════════════════════════════════ */
export * from './contracts';

import type { DataAdapterV2 } from './contracts';
import { adapter as mockAdapter } from './mock-adapter-v2';
import { SupabaseDataAdapter } from './supabase/supabase-adapter';
import { supabaseConfigured } from './supabase/client';

export type DataMode = 'mock' | 'supabase';

export function activeDataMode(): DataMode {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  return env.VITE_DATA_MODE === 'supabase' && supabaseConfigured() ? 'supabase' : 'mock';
}

function resolveAdapter(): DataAdapterV2 {
  try {
    return activeDataMode() === 'supabase' ? new SupabaseDataAdapter() : mockAdapter;
  } catch {
    // Any misconfiguration falls back to mock so the UI still renders.
    return mockAdapter;
  }
}

/** The active adapter for the whole app. */
export const adapter: DataAdapterV2 = resolveAdapter();
