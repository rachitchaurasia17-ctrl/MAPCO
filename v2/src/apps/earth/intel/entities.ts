/* ═══════════════════════════════════════════════════════════════
   MAPCO ENTITIES — canonicalisation & semantic deduplication
   ---------------------------------------------------------------
   Google returns *listings*. A dealer thinks in *places*. One real
   place often arrives as several listings:

     "IT Park"  /  "IT Park, Mohali"  /  "Rajiv Gandhi IT Park"
     "Chandigarh International Airport" /
     "Shaheed Bhagat Singh International Airport"

   Those must occupy ONE slot. Exact-name or place-id matching cannot
   do this, so we resolve every listing to a MAPCO canonical entity
   using, in order:
     1. MAPCO anchor aliases  (handles genuine renames/synonyms)
     2. identical core name    (locality suffixes stripped) + proximity
     3. containment            (one core name inside the other)
     4. token similarity       (Jaccard) + tight proximity + same family

   Ten slots then represent ten genuinely different location stories.
   ═══════════════════════════════════════════════════════════════ */
import { MAPCO_ANCHORS, metersBetween, type MapcoAnchor } from './geo-data';
import type { LatLng } from '../config';

/** Words that describe WHERE a place is, not WHAT it is. */
const LOCALITY_WORDS = new Set([
  'mohali', 'chandigarh', 'punjab', 'india', 'zirakpur', 'kharar', 'panchkula', 'derabassi',
  'mullanpur', 'landran', 'banur', 'sasnagar', 'sahibzadaajitsinghnagar', 'tricity',
  'sector', 'phase', 'block', 'near', 'opposite', 'road', 'branch', 'main',
]);
/** Words too generic to identify a place on their own. */
const FILLER_WORDS = new Set(['the', 'and', 'of', 'at', 'in', 'a', 'ltd', 'pvt', 'private', 'limited', 'co', 'company']);

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Significant tokens: locality, filler and bare numbers removed. */
export function coreTokens(name: string): string[] {
  return normalize(name)
    .split(' ')
    .filter((t) => t.length > 1 && !FILLER_WORDS.has(t) && !LOCALITY_WORDS.has(t) && !/^\d+$/.test(t));
}
/** The identity of a place, independent of the area it sits in. */
export function coreName(name: string): string {
  return coreTokens(name).join('');
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Families that may be merged with each other (a hospital is never a mall). */
const FAMILY: Record<string, string> = {
  airport: 'transport', railway: 'transport', transit: 'transport', bus: 'transport',
  mall: 'retail', market: 'retail',
  hospital: 'health', pharmacy: 'health',
  university: 'education', school: 'education',
  business: 'work',
  park: 'leisure', sports: 'leisure', landmark: 'leisure', worship: 'leisure',
  township: 'residential', society: 'residential',
  road: 'road', civic: 'civic',
};
const familyOf = (c: string) => FAMILY[c] ?? c;

export interface EntityLike {
  name: string;
  pos: LatLng;
  category: string;
  placeId?: string;
}

/** Resolve a listing to a known MAPCO anchor (alias-aware, proximity-checked). */
export function matchAnchor(e: EntityLike): MapcoAnchor | null {
  const core = coreName(e.name);
  const toks = coreTokens(e.name);
  let best: { anchor: MapcoAnchor; score: number } | null = null;

  for (const a of MAPCO_ANCHORS) {
    const d = metersBetween(e.pos, a.pos);
    // Anchor coordinates are approximate — allow a generous but bounded window,
    // wider for large footprints like an airport or a township.
    const window = a.kind === 'airport' || a.kind === 'township' || a.kind === 'business' ? 4000 : 1800;
    if (d > window) continue;

    const names = [a.name, ...a.aliases];
    let score = 0;
    for (const n of names) {
      const nCore = coreName(n);
      if (!nCore) continue;
      if (nCore === core) { score = Math.max(score, 1); continue; }
      if (core.length > 4 && (nCore.includes(core) || core.includes(nCore))) { score = Math.max(score, 0.85); continue; }
      score = Math.max(score, jaccard(toks, coreTokens(n)));
    }
    // A close, same-family listing corroborates a rename (airport case).
    if (score < 0.5 && familyOf(e.category) === familyOf(a.kind) && d < 700) score = 0.6;
    if (score >= 0.55 && (!best || score > best.score)) best = { anchor: a, score };
  }
  return best?.anchor ?? null;
}

/** Are these two listings the same real-world place? */
export function isSameEntity(a: EntityLike & { anchorId?: string }, b: EntityLike & { anchorId?: string }): boolean {
  if (a.placeId && b.placeId && a.placeId === b.placeId) return true;
  if (a.anchorId && b.anchorId && a.anchorId === b.anchorId) return true;

  if (familyOf(a.category) !== familyOf(b.category)) return false;
  const d = metersBetween(a.pos, b.pos);
  const ca = coreName(a.name), cb = coreName(b.name);
  if (!ca || !cb) return false;

  if (ca === cb && d < 1500) return true;                                   // same name, same area
  if (d < 800 && (ca.includes(cb) || cb.includes(ca)) && Math.min(ca.length, cb.length) >= 5) return true;
  if (d < 600 && jaccard(coreTokens(a.name), coreTokens(b.name)) >= 0.6) return true;
  return false;
}

/** Stable MAPCO id for an entity — anchor id when known, else name+cell. */
export function canonicalIdFor(e: EntityLike, anchor: MapcoAnchor | null): string {
  if (anchor) return anchor.id;
  const core = coreName(e.name) || normalize(e.name).replace(/\s/g, '');
  return `ce-${e.category}-${core.slice(0, 24)}-${e.pos.lat.toFixed(3)},${e.pos.lng.toFixed(3)}`;
}

/**
 * Collapse a raw candidate list into unique real-world entities.
 * `preferred` decides which listing survives a merge (higher = better).
 */
export function dedupeEntities<T extends EntityLike & { anchorId?: string }>(
  items: T[], preferred: (t: T) => number,
): T[] {
  const sorted = [...items].sort((x, y) => preferred(y) - preferred(x));
  const kept: T[] = [];
  for (const item of sorted) {
    if (!kept.some((k) => isSameEntity(k, item))) kept.push(item);
  }
  return kept;
}

/** Prefer the cleanest human name among merged listings. */
export function bestDisplayName(names: string[], anchor: MapcoAnchor | null): string {
  if (anchor) return anchor.name;                       // MAPCO's canonical label
  return names
    .map((n) => n.replace(/\s+/g, ' ').trim())
    .sort((a, b) => {
      const aComma = a.includes(',') ? 1 : 0, bComma = b.includes(',') ? 1 : 0;
      return aComma - bComma || a.length - b.length;    // shortest, comma-free wins
    })[0];
}
