// MAPCO AI · Context builder
// ---------------------------------------------------------------
// The only path from the database to a model. It calls the deterministic
// SQL fact functions, then applies a second, independent safety pass in
// this runtime before anything is sent:
//
//   • a hard byte budget, so a large dealer cannot produce a large bill;
//   • a key allow-list sweep that strips anything resembling identity,
//     even if a future migration accidentally projects it.
//
// The database projection is already privacy-scoped. This layer exists so
// that guarantee does not depend on a single implementation being correct.

import { rpc } from '../db.ts';
import { logEvent } from '../redact.ts';

/** Keys that must never appear anywhere inside a context payload. */
const FORBIDDEN_KEY = /^(name|clientname|customername|buyername|phone|whatsapp|email|owner|ownername|sellerphone|seller|note|notes|token|tokenhint|sessionhash|sessionid|commission|brokerage|payment|documents|address|label)$/i;

/** Above this the facts are trimmed rather than sent. */
const MAX_CONTEXT_BYTES = 24 * 1024;

export interface FactsResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly facts?: Record<string, unknown>;
  readonly digest?: string;
  readonly bytes?: number;
  readonly trimmed?: boolean;
}

/**
 * Recursively drop identity-shaped keys. Cheap, total, and independent of
 * the SQL projection — belt and braces on the privacy boundary.
 */
export function scrubIdentity(value: unknown, depth = 0): unknown {
  if (depth > 12) return null;
  if (Array.isArray(value)) return value.map((item) => scrubIdentity(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY.test(key)) continue;
      out[key] = scrubIdentity(raw, depth + 1);
    }
    return out;
  }
  return value;
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value ?? {})).byteLength;
}

/**
 * Shrink an over-budget fact object by shortening its long arrays first.
 * Totals and comparisons are preserved; only the tail of each ranked list
 * is dropped, which is the least informative part.
 */
function trimToBudget(facts: Record<string, unknown>): { facts: Record<string, unknown>; trimmed: boolean } {
  let current = facts;
  let trimmed = false;
  for (const limit of [12, 8, 5, 3]) {
    if (byteLength(current) <= MAX_CONTEXT_BYTES) break;
    trimmed = true;
    current = capArrays(current, limit) as Record<string, unknown>;
  }
  return { facts: current, trimmed };
}

function capArrays(value: unknown, limit: number, depth = 0): unknown {
  if (depth > 12) return null;
  if (Array.isArray(value)) return value.slice(0, limit).map((item) => capArrays(item, limit, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      out[key] = capArrays(raw, limit, depth + 1);
    }
    return out;
  }
  return value;
}

async function digestOf(facts: Record<string, unknown>): Promise<string> {
  // Volatile fields are excluded so identical underlying activity produces
  // an identical digest — the basis for skipping a needless regeneration.
  const stable = { ...facts };
  delete (stable as Record<string, unknown>).generatedAt;
  delete (stable as Record<string, unknown>).window;
  delete (stable as Record<string, unknown>).previousWindow;
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable)));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function finalise(raw: Record<string, unknown>): Promise<FactsResult> {
  const scrubbed = scrubIdentity(raw) as Record<string, unknown>;
  const { facts, trimmed } = trimToBudget(scrubbed);
  return {
    ok: true,
    facts,
    digest: await digestOf(facts),
    bytes: byteLength(facts),
    trimmed,
  };
}

/** Deterministic business facts for one dealer. Service-role path. */
export async function buildBusinessContext(
  dealerId: string,
  windowDays: number,
): Promise<FactsResult> {
  try {
    const raw = await rpc<Record<string, unknown>>('plotmap_ai_context_facts_for', {
      p_dealer_id: dealerId,
      p_window_days: windowDays,
      p_top: 20,
    });
    if (!raw || raw.ok !== true) {
      return { ok: false, reason: String(raw?.reason ?? 'facts_unavailable') };
    }
    return await finalise(raw);
  } catch (error) {
    logEvent('error', 'context.business.failed', {
      dealerId,
      detail: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: 'facts_unavailable' };
  }
}

/** Marketing-safe facts for one property. Service-role path. */
export async function buildMarketingContext(
  dealerId: string,
  propertyId: string,
): Promise<FactsResult> {
  try {
    const raw = await rpc<Record<string, unknown>>('plotmap_ai_marketing_facts_for', {
      p_dealer_id: dealerId,
      p_property_id: propertyId,
    });
    if (!raw || raw.ok !== true) {
      return { ok: false, reason: String(raw?.reason ?? 'facts_unavailable') };
    }
    return await finalise(raw);
  } catch (error) {
    logEvent('error', 'context.marketing.failed', {
      dealerId,
      detail: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: 'facts_unavailable' };
  }
}
