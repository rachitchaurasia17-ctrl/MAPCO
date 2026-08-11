/* ═══════════════════════════════════════════════════════════════
   MAPCO INTEL STORE — persistent, shared, backend-ready
   ---------------------------------------------------------------
   WHY THIS EXISTS
   A fresh Location Advantage analysis costs real Google money. That
   spend must become durable, reusable MAPCO intelligence — not a
   throwaway result that dies when Chrome closes.

   TWO IDEAS
   1. GEOGRAPHIC SHARING — intelligence is keyed by a ~600 m geo cell,
      NOT by property id. A second property 150 m away (any dealer,
      any device) reuses the same discovered geography. MAPCO gets
      cheaper as it learns more of the Tri-City.
   2. SPLIT OWNERSHIP — what we persist is split by who owns it:
        • MAPCO-owned (indefinite): canonical entity ids, MAPCO
          category + importance, anchor links, ranking inputs,
          relationships, timestamps, versions.
        • Google Place IDs (indefinite — expressly permitted).
        • Google *content* (name / coordinate / rating) is CACHED
          WITH A 30-DAY TTL and refreshed after expiry, per Google
          Maps Platform caching terms. Expired content is dropped,
          the MAPCO layer survives.

   BACKEND-READY
   All access goes through `IntelBackend`. Today a localStorage
   implementation persists across browser restarts on one device.
   `setIntelBackend()` swaps in a shared remote (Supabase/edge) later
   with zero call-site changes, which is what makes the intelligence
   shared across dealers and machines.
   ═══════════════════════════════════════════════════════════════ */
import type { LatLng } from '../config';

/** v4 — slot-driven selection. Bumped deliberately: caches written by the
 *  old "rank all nearby POIs" engine hold selections we no longer trust,
 *  so each area is re-analysed once, then reused free as before. */
export const INTEL_VERSION = 4;
/** Google Maps Platform permits caching content for up to 30 days. */
const GOOGLE_CONTENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** MAPCO's own derived intelligence is refreshed far less often. */
const MAPCO_INTEL_TTL_MS = 120 * 24 * 60 * 60 * 1000;

/** ~600 m cell — small enough that context is genuinely local, big
 *  enough that neighbouring plots share one paid discovery. */
const CELL_DEG = 0.006;

export function cellKey(p: LatLng): string {
  return `${Math.round(p.lat / CELL_DEG)}:${Math.round(p.lng / CELL_DEG)}`;
}
/** The cell plus its 8 neighbours — lets a property near a cell edge
 *  reuse everything MAPCO already knows around it. */
export function cellNeighbourhood(p: LatLng): string[] {
  const cy = Math.round(p.lat / CELL_DEG), cx = Math.round(p.lng / CELL_DEG);
  const keys: string[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keys.push(`${cy + dy}:${cx + dx}`);
  return keys;
}

/** One real-world entity MAPCO understands. */
export interface StoredEntity {
  /** MAPCO canonical id — MAPCO-owned, stable, indefinite. */
  canonicalId: string;
  /** Google Place ID — permitted to store indefinitely. */
  placeId?: string;
  /** MAPCO anchor this entity resolved to, if any. */
  anchorId?: string;
  /** MAPCO classification + importance (MAPCO-owned). */
  category: string;
  importance: number;
  publicInfra: boolean;
  /* ── Google-derived content — TTL'd ── */
  name: string;
  pos: LatLng;
  reviewCount?: number;
  rating?: number;
  /** When the Google content above was fetched. */
  contentAt: number;
}

export interface CellIntel {
  version: number;
  key: string;
  updatedAt: number;
  /** When a discovery last SUCCEEDED here. Set even when the area turned
   *  out to be sparse — a quiet neighbourhood must not be re-discovered
   *  (and re-billed) on every open. NOT set when discovery failed, so a
   *  network/quota blip can never poison a cell with an empty result. */
  analysedAt?: number;
  /** When discovery was last attempted (success or failure). Backs the
   *  retry cooldown that stops a failing area from being hammered. */
  attemptedAt?: number;
  entities: StoredEntity[];
}

/* ── Backend abstraction ───────────────────────────────────────── */
export interface IntelBackend {
  readonly name: string;
  get(keys: string[]): Promise<CellIntel[]>;
  put(cell: CellIntel): Promise<void>;
  clear?(): Promise<void>;
}

const LS_PREFIX = 'mapco.intel.cell.';

/** Device-persistent backend. Survives tab close, browser restart and
 *  reboot; does NOT cross devices (that needs the remote backend). */
class LocalIntelBackend implements IntelBackend {
  readonly name = 'local';
  async get(keys: string[]): Promise<CellIntel[]> {
    const out: CellIntel[] = [];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(LS_PREFIX + k);
        if (!raw) continue;
        const cell = JSON.parse(raw) as CellIntel;
        if (cell.version !== INTEL_VERSION) { localStorage.removeItem(LS_PREFIX + k); continue; }
        if (Date.now() - cell.updatedAt > MAPCO_INTEL_TTL_MS) { localStorage.removeItem(LS_PREFIX + k); continue; }
        out.push(cell);
      } catch { /* skip unreadable cell */ }
    }
    return out;
  }
  async put(cell: CellIntel): Promise<void> {
    try { localStorage.setItem(LS_PREFIX + cell.key, JSON.stringify(cell)); }
    catch { pruneOldest(); try { localStorage.setItem(LS_PREFIX + cell.key, JSON.stringify(cell)); } catch { /* give up quietly */ } }
  }
  async clear(): Promise<void> {
    for (const k of Object.keys(localStorage)) if (k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
  }
}

/** Drop the least-recently-updated cells when storage is full. */
function pruneOldest(): void {
  const cells: { k: string; at: number }[] = [];
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(LS_PREFIX)) continue;
    try { cells.push({ k, at: (JSON.parse(localStorage.getItem(k)!) as CellIntel).updatedAt ?? 0 }); }
    catch { localStorage.removeItem(k); }
  }
  cells.sort((a, b) => a.at - b.at);
  for (const c of cells.slice(0, Math.max(1, Math.ceil(cells.length * 0.25)))) localStorage.removeItem(c.k);
}

let backend: IntelBackend = new LocalIntelBackend();

/** Swap in a shared/remote backend (Supabase, edge KV, …) later.
 *  Everything above keeps working unchanged. */
export function setIntelBackend(b: IntelBackend): void { backend = b; }
export function intelBackendName(): string { return backend.name; }

/* ── Public API ────────────────────────────────────────────────── */

/** Every entity MAPCO already knows around this point (self + neighbours),
 *  with expired Google content dropped. */
export async function readNeighbourhood(p: LatLng): Promise<StoredEntity[]> {
  const cells = await backend.get(cellNeighbourhood(p));
  const now = Date.now();
  const byId = new Map<string, StoredEntity>();
  for (const cell of cells) {
    for (const e of cell.entities) {
      if (now - e.contentAt > GOOGLE_CONTENT_TTL_MS) continue;   // Google content expired
      const prev = byId.get(e.canonicalId);
      if (!prev || e.contentAt > prev.contentAt) byId.set(e.canonicalId, e);
    }
  }
  return [...byId.values()];
}

/**
 * Has MAPCO already PAID to study this cell recently?
 * This is the cost gate. It is deliberately based on "did we run a
 * discovery", not "did we find a lot" — otherwise a genuinely quiet
 * area would be re-discovered, and re-billed, on every open forever.
 * Expires with the Google content TTL so results never go stale.
 */
export async function hasAnalysedCell(p: LatLng): Promise<boolean> {
  const [cell] = await backend.get([cellKey(p)]);
  if (!cell?.analysedAt) return false;
  return Date.now() - cell.analysedAt <= GOOGLE_CONTENT_TTL_MS;
}

/** Persist a completed discovery for this cell (merging with what exists).
 *  `analysed=false` records the attempt WITHOUT claiming success, so a
 *  failed discovery never blocks a later retry. */
export async function writeCell(p: LatLng, entities: StoredEntity[], analysed = true): Promise<void> {
  const key = cellKey(p);
  const [existing] = await backend.get([key]);
  const byId = new Map<string, StoredEntity>();
  for (const e of existing?.entities ?? []) byId.set(e.canonicalId, e);
  for (const e of entities) byId.set(e.canonicalId, e);       // newest wins
  await backend.put({
    version: INTEL_VERSION, key, updatedAt: Date.now(),
    analysedAt: analysed ? Date.now() : existing?.analysedAt,
    attemptedAt: Date.now(),
    entities: [...byId.values()],
  });
}

/** How long to wait before retrying a discovery that failed outright. */
const RETRY_COOLDOWN_MS = 15 * 60 * 1000;

/** Record that we are about to spend money here — written BEFORE the calls
 *  so a crash mid-discovery still counts as an attempt. */
export async function markDiscoveryAttempt(p: LatLng): Promise<void> {
  const key = cellKey(p);
  const [existing] = await backend.get([key]);
  await backend.put({
    version: INTEL_VERSION, key,
    updatedAt: existing?.updatedAt ?? Date.now(),
    analysedAt: existing?.analysedAt,
    attemptedAt: Date.now(),
    entities: existing?.entities ?? [],
  });
}

/** True while a recently-failed cell is cooling down — prevents a failing
 *  area from being retried (and billed) on every single open. */
export async function inDiscoveryBackoff(p: LatLng): Promise<boolean> {
  const [cell] = await backend.get([cellKey(p)]);
  if (!cell?.attemptedAt) return false;
  return Date.now() - cell.attemptedAt < RETRY_COOLDOWN_MS;
}

export async function clearIntel(): Promise<void> { await backend.clear?.(); }
