/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Phase 2 output validation
   ---------------------------------------------------------------
   AI JSON is never trusted. This validator is the boundary between a
   model response and anything MAPCO persists or shows a dealer.

   It rejects, with a machine-readable reason:
     • non-JSON / non-object payloads
     • unknown or invented candidateIds
     • missing or malformed category structures
     • Local ranks that are absent, non-integer, out of range,
       duplicated within a category, or non-sequential (must be 1..N)
     • the same candidate twice inside one Local category
     • ANY rank on a City candidate — City Reach has no ranking
     • unexpected fields (reasons, finalists, densityGroups, …)

   It deliberately does NOT reject a Local category containing a
   C-prefixed id, or a City entry containing an L-prefixed id: the
   finalized prompt states discoveredIn is a discovery source, not the
   final classification, so Phase 2 is allowed to reclassify.

   On failure `feedback` carries a compact, schema-shaped error list for
   the single controlled repair attempt. MAPCO never patches the gaps
   itself — inventing missing intelligence in code is exactly what this
   architecture exists to prevent.
   ═══════════════════════════════════════════════════════════════ */
import type {
  NormalizedCandidate,
  Phase2Output,
  Phase2ValidationIssue,
  Phase2ValidationResult,
} from '../types.ts';

/** Local categories may carry a default plus up to three alternatives. */
export const MAX_LOCAL_PLACES_PER_CATEGORY = 4;
/** Guardrails against a runaway response; generous vs the prompt's 8–14. */
export const MAX_LOCAL_CATEGORIES = 30;
export const MAX_CITY_PLACES = 40;

const ALLOWED_ROOT_KEYS = new Set(['localCategories', 'cityPlaces']);
const ALLOWED_LOCAL_CATEGORY_KEYS = new Set(['category', 'places']);
const ALLOWED_LOCAL_PLACE_KEYS = new Set(['candidateId', 'rank']);
const ALLOWED_CITY_KEYS = new Set(['candidateId', 'category']);

/** Strip markdown fences and prose around a JSON object. */
export function extractJson(text: string): string {
  let value = String(text ?? '').trim();
  const fence = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) value = fence[1]!.trim();
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start >= 0 && end > start) value = value.slice(start, end + 1);
  return value;
}

function isCleanCategory(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  // Length 1 is odd but not malformed; rejecting it would mask the real
  // problem in a payload whose actual failure is elsewhere.
  return trimmed.length >= 1 && trimmed.length <= 80 && !/[\r\n\t]/.test(trimmed);
}

/**
 * Validate a raw Phase 2 response against the normalized candidate universe
 * that produced it.
 */
export function validatePhase2Output(
  raw: string | unknown,
  universe: readonly NormalizedCandidate[],
): Phase2ValidationResult {
  const issues: Phase2ValidationIssue[] = [];
  const add = (code: Phase2ValidationIssue['code'], path: string, detail: string) =>
    issues.push({ code, path, detail });

  let parsed: unknown;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch (error) {
      return {
        ok: false,
        issues: [{ code: 'not_json', path: '$', detail: (error as Error).message }],
        feedback: buildFeedback([{ code: 'not_json', path: '$', detail: 'Response was not valid JSON.' }]),
      };
    }
  } else {
    parsed = raw;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const issue: Phase2ValidationIssue = { code: 'not_object', path: '$', detail: 'Expected a JSON object.' };
    return { ok: false, issues: [issue], feedback: buildFeedback([issue]) };
  }

  const root = parsed as Record<string, unknown>;
  for (const key of Object.keys(root)) {
    if (!ALLOWED_ROOT_KEYS.has(key)) {
      add('unknown_field', `$.${key}`, `Unexpected field "${key}". Return only localCategories and cityPlaces.`);
    }
  }

  const known = new Map(universe.map((c) => [c.candidateId, c]));

  /* ── Local ──────────────────────────────────────────────────── */
  const localRaw = root.localCategories;
  const localCategories: Phase2Output['localCategories'] = [];
  if (!Array.isArray(localRaw)) {
    add('missing_local', '$.localCategories', 'localCategories must be an array.');
  } else {
    if (localRaw.length === 0) {
      add('no_categories', '$.localCategories', 'At least one Local category is required.');
    }
    if (localRaw.length > MAX_LOCAL_CATEGORIES) {
      add('too_many_places', '$.localCategories', `At most ${MAX_LOCAL_CATEGORIES} Local categories.`);
    }
    const seenCategories = new Set<string>();
    localRaw.slice(0, MAX_LOCAL_CATEGORIES).forEach((entry, ci) => {
      const path = `$.localCategories[${ci}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        add('bad_category', path, 'Each Local category must be an object.');
        return;
      }
      const cat = entry as Record<string, unknown>;
      for (const key of Object.keys(cat)) {
        if (!ALLOWED_LOCAL_CATEGORY_KEYS.has(key)) {
          add('unknown_field', `${path}.${key}`, `Unexpected field "${key}" on a Local category.`);
        }
      }
      if (!isCleanCategory(cat.category)) {
        add('bad_category', `${path}.category`, 'category must be a short non-empty string.');
        return;
      }
      const label = (cat.category as string).trim();
      if (seenCategories.has(label.toLowerCase())) {
        add('duplicate_candidate', `${path}.category`, `Category "${label}" appears twice.`);
        return;
      }
      seenCategories.add(label.toLowerCase());

      const placesRaw = cat.places;
      if (!Array.isArray(placesRaw) || placesRaw.length === 0) {
        add('empty_category', `${path}.places`, `Category "${label}" has no places.`);
        return;
      }
      if (placesRaw.length > MAX_LOCAL_PLACES_PER_CATEGORY) {
        add('too_many_places', `${path}.places`,
          `Category "${label}" has ${placesRaw.length} places; the maximum is ${MAX_LOCAL_PLACES_PER_CATEGORY}.`);
        return;
      }

      const places: Phase2Output['localCategories'][number]['places'] = [];
      const seenRanks = new Set<number>();
      const seenIds = new Set<string>();
      let categoryOk = true;

      placesRaw.forEach((placeRaw, pi) => {
        const ppath = `${path}.places[${pi}]`;
        if (!placeRaw || typeof placeRaw !== 'object' || Array.isArray(placeRaw)) {
          add('bad_rank', ppath, 'Each place must be an object with candidateId and rank.');
          categoryOk = false;
          return;
        }
        const place = placeRaw as Record<string, unknown>;
        for (const key of Object.keys(place)) {
          if (!ALLOWED_LOCAL_PLACE_KEYS.has(key)) {
            add('unknown_field', `${ppath}.${key}`, `Unexpected field "${key}". Only candidateId and rank are allowed.`);
            categoryOk = false;
          }
        }
        const id = typeof place.candidateId === 'string' ? place.candidateId.trim() : '';
        if (!id || !known.has(id)) {
          add('unknown_candidate', `${ppath}.candidateId`,
            `"${id || '(missing)'}" is not a candidateId in the supplied universe.`);
          categoryOk = false;
          return;
        }
        if (seenIds.has(id)) {
          add('duplicate_candidate', `${ppath}.candidateId`,
            `Candidate ${id} appears twice inside category "${label}".`);
          categoryOk = false;
          return;
        }
        seenIds.add(id);

        const rank = place.rank;
        if (typeof rank !== 'number' || !Number.isInteger(rank)
          || rank < 1 || rank > MAX_LOCAL_PLACES_PER_CATEGORY) {
          add('bad_rank', `${ppath}.rank`,
            `rank must be an integer 1..${MAX_LOCAL_PLACES_PER_CATEGORY}; received ${JSON.stringify(rank)}.`);
          categoryOk = false;
          return;
        }
        if (seenRanks.has(rank)) {
          add('duplicate_rank', `${ppath}.rank`, `rank ${rank} is used twice in category "${label}".`);
          categoryOk = false;
          return;
        }
        seenRanks.add(rank);
        places.push({ candidateId: id, rank });
      });

      if (!categoryOk) return;

      // Ranks must be exactly 1..N — a category starting at 2, or skipping a
      // rank, has no rank-1 default for MAPCO to display.
      const ranks = [...seenRanks].sort((a, b) => a - b);
      const sequential = ranks.every((value, index) => value === index + 1);
      if (!sequential) {
        add('non_sequential_rank', `${path}.places`,
          `Category "${label}" ranks are [${ranks.join(', ')}]; they must be 1..${ranks.length} with no gaps.`);
        return;
      }

      places.sort((a, b) => a.rank - b.rank);
      localCategories.push({ category: label, places });
    });
  }

  /* ── City ───────────────────────────────────────────────────── */
  const cityRaw = root.cityPlaces;
  const cityPlaces: Phase2Output['cityPlaces'] = [];
  if (!Array.isArray(cityRaw)) {
    add('missing_city', '$.cityPlaces', 'cityPlaces must be an array.');
  } else {
    if (cityRaw.length > MAX_CITY_PLACES) {
      add('too_many_places', '$.cityPlaces', `At most ${MAX_CITY_PLACES} City places.`);
    }
    const seenIds = new Set<string>();
    cityRaw.slice(0, MAX_CITY_PLACES).forEach((entryRaw, i) => {
      const path = `$.cityPlaces[${i}]`;
      if (!entryRaw || typeof entryRaw !== 'object' || Array.isArray(entryRaw)) {
        add('bad_category', path, 'Each City place must be an object.');
        return;
      }
      const entry = entryRaw as Record<string, unknown>;
      for (const key of Object.keys(entry)) {
        if (key === 'rank') {
          add('city_has_rank', `${path}.rank`,
            'City Reach is not a ranked system. Remove rank from every cityPlaces entry.');
          return;
        }
        if (!ALLOWED_CITY_KEYS.has(key)) {
          add('unknown_field', `${path}.${key}`, `Unexpected field "${key}". Only candidateId and category are allowed.`);
          return;
        }
      }
      const id = typeof entry.candidateId === 'string' ? entry.candidateId.trim() : '';
      if (!id || !known.has(id)) {
        add('unknown_candidate', `${path}.candidateId`,
          `"${id || '(missing)'}" is not a candidateId in the supplied universe.`);
        return;
      }
      if (seenIds.has(id)) {
        add('duplicate_candidate', `${path}.candidateId`, `Candidate ${id} appears twice in cityPlaces.`);
        return;
      }
      if (!isCleanCategory(entry.category)) {
        add('bad_category', `${path}.category`, 'category must be a short non-empty string.');
        return;
      }
      seenIds.add(id);
      cityPlaces.push({ candidateId: id, category: (entry.category as string).trim() });
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues, feedback: buildFeedback(issues) };
  }
  return { ok: true, value: { localCategories, cityPlaces }, issues: [] };
}

/** A compact, actionable error list for the single repair attempt. */
export function buildFeedback(issues: readonly Phase2ValidationIssue[]): string {
  const lines = issues.slice(0, 25).map((i) => `- ${i.path}: ${i.detail}`);
  const more = issues.length > 25 ? `\n- (${issues.length - 25} further problems omitted)` : '';
  return [
    'Your previous response was rejected by MAPCO schema validation.',
    'Fix every problem below and return ONLY the corrected JSON object.',
    'Use the same candidate universe. Do not invent candidateIds.',
    '',
    ...lines,
    more,
    '',
    'Required shape:',
    '{"localCategories":[{"category":"...","places":[{"candidateId":"L001","rank":1}]}],'
    + '"cityPlaces":[{"candidateId":"C001","category":"..."}]}',
  ].join('\n');
}
