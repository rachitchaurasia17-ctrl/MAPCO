/* ═══════════════════════════════════════════════════════════════
   MAPCO — Google API cost instrumentation
   ---------------------------------------------------------------
   Counts every billable Google call MAPCO makes, grouped by SKU
   class, so per-dealer / per-property cost becomes measurable.
   Never records API keys, tokens or raw responses.

   The log is append-only, bounded, and shaped so it can be shipped
   to a backend later without changing call sites.
   ═══════════════════════════════════════════════════════════════ */

export type Sku =
  | 'places.searchNearby'      // Places API (New) — Nearby Search
  | 'places.searchText'        // Places API (New) — Text Search
  | 'places.autocomplete'      // Places API (New) — Autocomplete (session)
  | 'places.details'           // Places API (New) — Place Details
  | 'routes.computeRoutes'     // Routes API — single route
  | 'routes.routeMatrix'       // Routes API — matrix
  | 'streetview.metadata'      // Street View — panorama lookup
  | 'maps.dynamic';            // Maps JS map load

export interface MeterEvent {
  sku: Sku;
  n: number;                   // number of billable units
  at: number;                  // epoch ms
  propertyId?: string;
  /** 'fresh' = genuinely new discovery, 'reused' = served from MAPCO intel. */
  mode?: 'fresh' | 'reused';
  note?: string;
}

const KEY = 'mapco.earth.apiMeter.v1';
const MAX_EVENTS = 500;

const sessionId = 'sess-' + Math.floor(performance.now()).toString(36) + '-' + (globalThis.crypto?.randomUUID?.().slice(0, 8) ?? 'x');

let events: MeterEvent[] = load();

function load(): MeterEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MeterEvent[]) : [];
  } catch { return []; }
}
function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX_EVENTS))); } catch { /* non-fatal */ }
}

/** Record billable Google usage. `n` defaults to 1 unit. */
export function meter(sku: Sku, n = 1, extra: Omit<MeterEvent, 'sku' | 'n' | 'at'> = {}): void {
  events.push({ sku, n, at: Date.now(), ...extra });
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  persist();
}

export interface UsageSummary {
  sessionId: string;
  totalCalls: number;
  bySku: Record<string, number>;
  freshAnalyses: number;
  reusedAnalyses: number;
  since: number | null;
}

/** Roll-up for diagnostics / future backend reporting. */
export function getUsage(): UsageSummary {
  const bySku: Record<string, number> = {};
  let total = 0, fresh = 0, reused = 0;
  for (const e of events) {
    bySku[e.sku] = (bySku[e.sku] ?? 0) + e.n;
    total += e.n;
    if (e.mode === 'fresh') fresh++;
    if (e.mode === 'reused') reused++;
  }
  return { sessionId, totalCalls: total, bySku, freshAnalyses: fresh, reusedAnalyses: reused, since: events[0]?.at ?? null };
}

export function resetUsage(): void { events = []; persist(); }

/** Dev affordance: `window.__mapcoUsage()` in the console. */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__mapcoUsage = getUsage;
}
