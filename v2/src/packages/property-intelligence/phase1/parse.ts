/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Phase 1 parser (deterministic)
   ---------------------------------------------------------------
   Phase 1 is asked for a pipe-delimited universe under two headings:

     LOCAL CANDIDATE UNIVERSE
     CITY CANDIDATE UNIVERSE
     Exact Maps Name | Entity Type | Category | Locality | Rating |
     Review Count | Approx. Proximity

   A grounded model is chatty and inconsistent in small ways — it may
   wrap rows in a markdown table, number them, bold the headings, repeat
   the column header, or add one extra descriptive column. This parser
   absorbs that WITHOUT inventing anything: a row that cannot be read is
   dropped, never guessed at.

   Column mapping is anchored, not positional: the PLACE_ENTITY /
   GEOGRAPHIC_ENTITY cell is located first, and the three trailing
   columns are always rating / reviews / proximity. Everything between
   is category and locality. That survives an extra column without
   silently shifting locality into the rating field.

   NO filtering of any kind happens here. Phase 2 is the intelligence
   judge; Phase 1 output is deliberately over-inclusive.
   ═══════════════════════════════════════════════════════════════ */
import type { DiscoveredIn, EntityKind, Phase1Candidate } from '../types.ts';

/** Strip markdown emphasis, list bullets and row numbering from a line. */
function stripDecoration(line: string): string {
  return line
    .replace(/^\s*[-*+•]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/, '')
    .trim();
}

/** A markdown table separator such as |---|:---:|---| carries no data. */
function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

/** The model sometimes repeats the column header inside the table. */
function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(' ').toLowerCase();
  return (
    (joined.includes('entity type') && joined.includes('category'))
    || (joined.includes('maps name') && joined.includes('proximity'))
  );
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** UNKNOWN / N/A / — / empty all mean "the model did not know". */
function readOptional(raw: string | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (/^(unknown|n\/?a|none|null|-{1,2}|—|–|\?)$/i.test(value)) return null;
  return value;
}

/** "4.3", "4.3/5", "4,3", "Rating: 4.3" → 4.3 ; anything else → null. */
export function parseRating(raw: string | undefined): number | null {
  const value = readOptional(raw);
  if (value === null) return null;
  const match = value.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 0 || n > 5) return null;
  return n;
}

/** "1,234", "(1,234)", "1.2k reviews", "12K" → integer ; else null. */
export function parseReviewCount(raw: string | undefined): number | null {
  const value = readOptional(raw);
  if (value === null) return null;
  const k = value.match(/(\d+(?:\.\d+)?)\s*[kK]\b/);
  if (k) return Math.round(Number(k[1]) * 1000);
  const plain = value.replace(/[(),]/g, '').match(/(\d+)/);
  if (!plain) return null;
  const n = Number(plain[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * "0.95 km", "~1.2km", "950 m", "2km away" → kilometres.
 * DISCOVERY HINT ONLY. Google Routes produces every distance MAPCO
 * actually displays; nothing derived from this value is ever shown as an
 * exact measurement.
 */
export function parseApproxKm(raw: string | undefined): number | null {
  const value = readOptional(raw);
  if (value === null) return null;
  const lower = value.toLowerCase();
  // Metres must be checked first: "950 m" would otherwise read as 950 km.
  const metres = lower.match(/(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)\b/);
  if (metres && !/\bkm\b/.test(lower)) {
    const n = Number(metres[1]);
    return Number.isFinite(n) ? Number((n / 1000).toFixed(3)) : null;
  }
  const km = lower.match(/(\d+(?:\.\d+)?)/);
  if (!km) return null;
  const n = Number(km[1]);
  if (!Number.isFinite(n) || n < 0 || n > 500) return null;
  return n;
}

function entityKindOf(cell: string | undefined): EntityKind | null {
  const value = (cell ?? '').toUpperCase();
  if (value.includes('GEOGRAPHIC')) return 'GEOGRAPHIC_ENTITY';
  if (value.includes('PLACE_ENTITY') || /\bPLACE\b/.test(value)) return 'PLACE_ENTITY';
  return null;
}

const LOCAL_HEADING = /local\s+candidate\s+universe/i;
const CITY_HEADING = /city\s+candidate\s+universe/i;

/** Map the cells after the entity-kind anchor onto the remaining fields. */
function readTail(rest: string[]): Pick<
  Phase1Candidate, 'entityType' | 'category' | 'locality' | 'rating' | 'reviewCount' | 'approxDistanceKm'
> {
  // The last three data columns are always rating | reviews | proximity.
  const approx = rest.length >= 1 ? rest[rest.length - 1] : undefined;
  const reviews = rest.length >= 2 ? rest[rest.length - 2] : undefined;
  const rating = rest.length >= 3 ? rest[rest.length - 3] : undefined;
  const middle = rest.slice(0, Math.max(0, rest.length - 3));

  // middle is [category] | [category, locality] | [entityType, category, locality]
  const locality = middle.length >= 2 ? middle[middle.length - 1] : undefined;
  const category = middle.length >= 2 ? middle[middle.length - 2] : middle[0];
  const entityType = middle.length >= 3 ? middle[middle.length - 3] : undefined;

  return {
    entityType: readOptional(entityType),
    category: readOptional(category),
    locality: readOptional(locality),
    rating: parseRating(rating),
    reviewCount: parseReviewCount(reviews),
    approxDistanceKm: parseApproxKm(approx),
  };
}

/**
 * Parse one Phase 1 response into its two candidate universes.
 *
 * A row is accepted when it has a usable name. When the entity-kind column
 * is missing the row is still kept and defaulted to PLACE_ENTITY — dropping
 * a genuine place is worse than carrying one with a defaulted kind, and both
 * Places resolution and Phase 2 re-examine it downstream.
 */
export function parsePhase1Output(
  text: string,
): { local: Phase1Candidate[]; city: Phase1Candidate[] } {
  const local: Phase1Candidate[] = [];
  const city: Phase1Candidate[] = [];
  let section: DiscoveredIn | null = null;

  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = stripDecoration(rawLine);
    if (!line) continue;

    if (LOCAL_HEADING.test(line)) { section = 'LOCAL'; continue; }
    if (CITY_HEADING.test(line)) { section = 'CITY'; continue; }
    if (!section) continue;
    if (!line.includes('|')) continue;

    // Markdown tables wrap rows in leading/trailing pipes.
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.length < 2) continue;
    if (isSeparatorRow(cells)) continue;
    if (isHeaderRow(cells)) continue;

    const name = (cells[0] ?? '').replace(/^["'`]+|["'`]+$/g, '').trim();
    if (!name || name.length > 200) continue;
    if (readOptional(name) === null) continue;

    // Anchor on the entity-kind cell wherever the model put it.
    let kindIdx = -1;
    for (let i = 1; i < cells.length; i++) {
      if (entityKindOf(cells[i])) { kindIdx = i; break; }
    }
    const entityKind = kindIdx >= 0 ? entityKindOf(cells[kindIdx])! : 'PLACE_ENTITY';
    const rest = cells.slice(kindIdx >= 0 ? kindIdx + 1 : 1);

    (section === 'LOCAL' ? local : city).push({
      name,
      entityKind,
      discoveredIn: section,
      ...readTail(rest),
    });
  }

  return { local, city };
}

/**
 * Recover free identity evidence from Maps grounding chunks.
 *
 * A grounding chunk title is rarely the bare place name — Google usually
 * returns something like "Mohali Super Market, Sector 78, Sahibzada Ajit
 * Singh Nagar, Punjab". A live run indexed 59 grounded places and matched
 * ZERO of them by exact title, then paid for 57 Places lookups it did not
 * need. So the index keeps the normalized title AND its leading name
 * segment, and lookup falls back to containment.
 */
export function indexGroundedPlaces(
  chunks: ReadonlyArray<{ placeId: string; title: string }>,
): Record<string, string> {
  const index: Record<string, string> = {};
  for (const chunk of chunks) {
    const full = normalizeName(chunk.title);
    if (!full) continue;
    if (!index[full]) index[full] = chunk.placeId;
    // "Name, Locality, City" -> also index "name".
    const head = normalizeName(String(chunk.title).split(',')[0] ?? '');
    if (head && head !== full && !index[head]) index[head] = chunk.placeId;
  }
  return index;
}

/** Shortest key that is safe to match by containment without colliding. */
const MIN_CONTAINMENT_KEY = 6;

/**
 * Look a candidate name up in the grounded index: exact first, then
 * containment in either direction. Short names are exact-only, because
 * "zone 78" would otherwise match half a dozen unrelated titles.
 */
export function lookupGroundedPlaceId(
  index: Record<string, string>, name: string,
): string | undefined {
  const key = normalizeName(name);
  if (!key) return undefined;
  if (index[key]) return index[key];
  if (key.length < MIN_CONTAINMENT_KEY) return undefined;
  for (const [title, placeId] of Object.entries(index)) {
    if (title.length < MIN_CONTAINMENT_KEY) continue;
    if (title.includes(key) || key.includes(title)) return placeId;
  }
  return undefined;
}
