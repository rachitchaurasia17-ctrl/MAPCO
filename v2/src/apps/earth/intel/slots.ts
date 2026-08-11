/* ═══════════════════════════════════════════════════════════════
   MAPCO — INFORMATION SLOTS  (the selection brain)
   ---------------------------------------------------------------
   The old engine asked Google "what is near here?" and then tried to
   clean the answer. That is why four parks could win four slots and a
   kirana store could out-rank a mall.

   This module inverts the architecture:

     MAPCO decides the QUESTIONS first.
     Google is only the evidence layer that answers them.

   A "slot" is one distinct thing worth knowing about a location
   ("what is the best green space?", "what is the major commercial
   anchor?"). Each slot may be filled by exactly ONE candidate, and
   each candidate may fill exactly ONE slot. Ten results therefore
   mean ten different location stories — structurally, not by luck.

   Two further ideas do the heavy lifting:

   • SIGNIFICANCE (not popularity). A place's weight comes from what
     it IS — its type, scale and public/civic nature — with Google
     engagement allowed only as capped corroborating evidence. A
     government park with no reviews outranks a five-star salon.

   • SECTION ELIGIBILITY. A grocery store is structurally incapable of
     answering a Nearby question, however close it is. That is why
     "Jain Karyana Store" can never appear as a city-level anchor —
     no rule mentions it by name.
   ═══════════════════════════════════════════════════════════════ */
import type { Intent } from './types';

/* ── Scale: how big a thing is in the real world ───────────────── */
export type Scale = 'small' | 'medium' | 'large' | 'major';

/** Google place types → MAPCO real-world scale. Drives significance far
 *  more than review counts do. */
const TYPE_SCALE: Record<string, Scale> = {
  international_airport: 'major', airport: 'major', train_station: 'large',
  shopping_mall: 'large', department_store: 'medium',
  supermarket: 'medium', grocery_store: 'small', convenience_store: 'small', market: 'medium',
  hospital: 'large', doctor: 'small', pharmacy: 'small', dental_clinic: 'small', medical_lab: 'small',
  university: 'large', college: 'large', secondary_school: 'medium', school: 'medium', primary_school: 'small', preschool: 'small',
  stadium: 'large', sports_complex: 'large', swimming_pool: 'medium', gym: 'small', fitness_center: 'small', sports_club: 'medium',
  park: 'medium', national_park: 'large', playground: 'small', garden: 'medium',
  tourist_attraction: 'large', museum: 'large', amusement_park: 'large', historical_landmark: 'large',
  cafe: 'small', restaurant: 'small', bakery: 'small', bar: 'small',
  local_government_office: 'medium', post_office: 'small', city_hall: 'large', courthouse: 'medium', police: 'small',
  hindu_temple: 'medium', gurudwara: 'medium', church: 'medium', mosque: 'medium',
  apartment_complex: 'medium', housing_complex: 'medium', apartment_building: 'small',
  corporate_office: 'medium', office: 'small',
};
const SCALE_WEIGHT: Record<Scale, number> = { small: 0.28, medium: 0.55, large: 0.82, major: 1.0 };

export function scaleOf(types: string[]): Scale {
  let best: Scale = 'small';
  const order: Scale[] = ['small', 'medium', 'large', 'major'];
  for (const t of types) {
    const s = TYPE_SCALE[t];
    if (s && order.indexOf(s) > order.indexOf(best)) best = s;
  }
  return best;
}

/** Categories that are civic/public infrastructure — trusted without reviews. */
const PUBLIC_CATEGORIES = new Set(['park', 'transit', 'railway', 'airport', 'civic', 'worship', 'school', 'sports', 'road']);
export const isPublicCategory = (c: string) => PUBLIC_CATEGORIES.has(c);

/**
 * MAPCO significance, 0..1. Deliberately NOT review-driven:
 *   what it is (scale + category) dominates,
 *   being a known MAPCO anchor dominates further,
 *   Google engagement can only add a capped amount of corroboration.
 */
export function significanceOf(args: {
  category: string;
  types: string[];
  anchorImportance?: number | null;
  rating?: number;
  reviews?: number;
}): number {
  const { category, types, anchorImportance, rating, reviews } = args;
  if (anchorImportance != null) return anchorImportance;      // MAPCO canonical knowledge wins

  const scale = SCALE_WEIGHT[scaleOf(types)];
  const publicInfra = isPublicCategory(category);

  // A public thing is meaningful because it exists and serves people.
  // A private thing must demonstrate it is more than a corner shop.
  const base = publicInfra ? 0.42 + 0.45 * scale : 0.14 + 0.62 * scale;

  // Engagement is EVIDENCE, never truth — hard-capped so a busy café can
  // never out-weigh a hospital, and an unrated public park is never buried.
  const n = reviews ?? 0;
  const engagement = Math.min(1, Math.log10(n + 1) / 3.4) * (rating && rating >= 3.8 ? 1 : 0.6);
  const cap = publicInfra ? 0.12 : 0.20;

  return Math.max(0, Math.min(1, base + cap * engagement));
}

/* ── Slots ─────────────────────────────────────────────────────── */
export interface SlotProbe {
  types?: string[];
  text?: string;
  radius: number;
  rank: 'DISTANCE' | 'POPULARITY';
}

export interface Slot {
  id: string;
  /** internal only — never shown to a client */
  question: string;
  section: 'around' | 'nearby';
  /** categories able to answer this question */
  categories: string[];
  /** a candidate must be at least this significant to answer */
  minSignificance: number;
  maxMeters: number;
  priority: number;
  /** open slots accept any eligible category, but demand novelty */
  open?: boolean;
  /** targeted retrieval used only if the slot is still unanswered */
  probe?: SlotProbe;
}

/** Categories that may EVER answer a Nearby (city-level) question.
 *  Structural, not a blacklist: a grocery store simply is not a
 *  city-level destination, however close it happens to be. */
export const NEARBY_ELIGIBLE = new Set(['mall', 'hospital', 'university', 'business', 'landmark', 'airport', 'railway', 'sports', 'civic', 'township', 'school', 'transit']);

const AROUND_MAX = 2000;   // dealer's rule: hyperlocal means ~2 km, hard cap
const NEARBY_MAX = 4200;   // ~4 km, with a deliberate transport exception
const NEARBY_FAR = 30000;  // airports / rail only

/* Around Sector — ten different hyperlocal questions. */
const AROUND_SLOTS: Slot[] = [
  { id: 'green', question: 'best green space', section: 'around', categories: ['park'], minSignificance: 0.34, maxMeters: AROUND_MAX, priority: 1.0,
    probe: { types: ['park', 'garden', 'playground'], radius: 2000, rank: 'DISTANCE' } },
  { id: 'daily', question: 'best everyday shopping', section: 'around', categories: ['market'], minSignificance: 0.30, maxMeters: AROUND_MAX, priority: 0.95,
    probe: { types: ['supermarket', 'department_store', 'market'], radius: 2000, rank: 'POPULARITY' } },
  { id: 'fitness', question: 'best fitness option', section: 'around', categories: ['sports'], minSignificance: 0.30, maxMeters: AROUND_MAX, priority: 0.88,
    probe: { types: ['gym', 'sports_club', 'fitness_center'], radius: 2200, rank: 'POPULARITY' } },
  { id: 'community', question: 'strongest residential community anchor', section: 'around', categories: ['township'], minSignificance: 0.34, maxMeters: AROUND_MAX, priority: 0.86,
    probe: { text: 'residential society enclave', radius: 2000, rank: 'POPULARITY' } },
  { id: 'recreation', question: 'strongest sports / recreation facility', section: 'around', categories: ['sports', 'landmark'], minSignificance: 0.52, maxMeters: AROUND_MAX, priority: 0.8,
    probe: { types: ['stadium', 'sports_complex', 'swimming_pool'], radius: 2500, rank: 'POPULARITY' } },
  { id: 'school-local', question: 'most useful local school', section: 'around', categories: ['school'], minSignificance: 0.34, maxMeters: AROUND_MAX, priority: 0.76 },
  { id: 'lifestyle', question: 'strongest local lifestyle spot', section: 'around', categories: ['cafe'], minSignificance: 0.34, maxMeters: AROUND_MAX, priority: 0.7,
    probe: { types: ['cafe', 'bakery', 'restaurant'], radius: 1800, rank: 'POPULARITY' } },
  { id: 'health-local', question: 'everyday healthcare', section: 'around', categories: ['pharmacy', 'hospital'], minSignificance: 0.30, maxMeters: AROUND_MAX, priority: 0.62 },
  { id: 'civic-local', question: 'community / civic facility', section: 'around', categories: ['civic', 'worship'], minSignificance: 0.30, maxMeters: AROUND_MAX, priority: 0.56 },
  { id: 'transit-local', question: 'everyday transport', section: 'around', categories: ['transit'], minSignificance: 0.30, maxMeters: AROUND_MAX, priority: 0.6,
    probe: { types: ['bus_station', 'transit_station'], radius: 1800, rank: 'DISTANCE' } },
  { id: 'around-open-1', question: 'other distinctive hyperlocal advantage', section: 'around', categories: [], minSignificance: 0.55, maxMeters: AROUND_MAX, priority: 0.5, open: true },
  { id: 'around-open-2', question: 'anything else genuinely useful here', section: 'around', categories: [], minSignificance: 0.62, maxMeters: AROUND_MAX, priority: 0.42, open: true },
];

/* Nearby — ten different city-level questions. */
const NEARBY_SLOTS: Slot[] = [
  { id: 'commercial', question: 'major commercial destination', section: 'nearby', categories: ['mall'], minSignificance: 0.62, maxMeters: NEARBY_MAX, priority: 1.0,
    probe: { types: ['shopping_mall'], radius: 6000, rank: 'POPULARITY' } },
  { id: 'healthcare', question: 'major healthcare anchor', section: 'nearby', categories: ['hospital'], minSignificance: 0.6, maxMeters: NEARBY_MAX, priority: 0.95,
    probe: { types: ['hospital'], radius: 7000, rank: 'POPULARITY' } },
  { id: 'employment', question: 'employment / business hub', section: 'nearby', categories: ['business'], minSignificance: 0.55, maxMeters: NEARBY_MAX, priority: 0.92,
    probe: { text: 'IT park corporate office technology park', radius: 8000, rank: 'POPULARITY' } },
  { id: 'education', question: 'major educational institution', section: 'nearby', categories: ['university'], minSignificance: 0.6, maxMeters: NEARBY_MAX, priority: 0.88,
    probe: { types: ['university', 'college'], radius: 9000, rank: 'POPULARITY' } },
  { id: 'transport', question: 'regional transport connectivity', section: 'nearby', categories: ['airport', 'railway'], minSignificance: 0.65, maxMeters: NEARBY_FAR, priority: 0.85 },
  { id: 'lifestyle-major', question: 'major lifestyle / leisure destination', section: 'nearby', categories: ['landmark', 'sports'], minSignificance: 0.62, maxMeters: NEARBY_MAX, priority: 0.74 },
  { id: 'address', question: 'recognised address / township', section: 'nearby', categories: ['township'], minSignificance: 0.6, maxMeters: NEARBY_MAX, priority: 0.68 },
  { id: 'school-major', question: 'notable school worth mentioning', section: 'nearby', categories: ['school'], minSignificance: 0.66, maxMeters: NEARBY_MAX, priority: 0.6 },
  { id: 'civic-major', question: 'important civic / public institution', section: 'nearby', categories: ['civic', 'transit'], minSignificance: 0.6, maxMeters: NEARBY_MAX, priority: 0.55 },
  { id: 'nearby-open-1', question: 'another major destination for this buyer', section: 'nearby', categories: [], minSignificance: 0.68, maxMeters: NEARBY_MAX, priority: 0.5, open: true },
  { id: 'nearby-open-2', question: 'most distinctive remaining anchor', section: 'nearby', categories: [], minSignificance: 0.72, maxMeters: NEARBY_MAX, priority: 0.44, open: true },
];

/** Per-intent slot emphasis. The QUESTIONS shift with the buyer, which is
 *  how the same coordinates produce a different answer set. */
const INTENT_SLOT_BIAS: Record<Intent, Record<string, number>> = {
  residential: { green: 1.15, community: 1.12, daily: 1.1, recreation: 1.05, lifestyle: 1.0, 'school-local': 1.05, employment: 0.8, transport: 0.85 },
  commercial: { daily: 1.05, transit: 1.15, 'transit-local': 1.15, commercial: 1.2, employment: 1.2, transport: 1.05, address: 1.05, green: 0.5, 'school-local': 0.45, 'health-local': 0.5, lifestyle: 1.05 },
  investment: { employment: 1.2, commercial: 1.12, transport: 1.15, education: 1.1, address: 1.15, community: 1.05, green: 0.7, lifestyle: 0.6, 'health-local': 0.6 },
  rental: { employment: 1.2, education: 1.15, 'transit-local': 1.18, healthcare: 1.1, daily: 1.08, lifestyle: 1.05, green: 0.8, community: 0.9 },
};

/** The question set MAPCO will try to answer for this property. */
export function planSlots(intent: Intent, section: 'around' | 'nearby'): Slot[] {
  const base = section === 'around' ? AROUND_SLOTS : NEARBY_SLOTS;
  const bias = INTENT_SLOT_BIAS[intent] ?? {};
  return base
    .map((s) => ({ ...s, priority: s.priority * (bias[s.id] ?? 1) }))
    .sort((a, b) => b.priority - a.priority);
}

/* ── Assignment ────────────────────────────────────────────────── */
export interface SlotCandidate {
  canonicalId: string;
  category: string;
  significance: number;
  distance: number;
  /** the real-world story this candidate tells (used for novelty) */
  storyKey: string;
}

export interface Assignment<T extends SlotCandidate> {
  slot: Slot;
  candidate: T;
  value: number;
}

/** Can this candidate answer this question at all? */
export function eligible(slot: Slot, c: SlotCandidate): boolean {
  if (c.distance > slot.maxMeters) return false;
  if (c.significance < slot.minSignificance) return false;
  if (slot.section === 'nearby' && !NEARBY_ELIGIBLE.has(c.category)) return false;
  if (slot.open) return true;
  return slot.categories.includes(c.category);
}

/** How well this candidate answers this particular question. */
function fit(slot: Slot, c: SlotCandidate): number {
  // Nearby is prominence-led; Around is proximity-led. This is why a
  // recognised mall at 3.5 km beats an ordinary shop at 500 m.
  const prox = slot.section === 'around'
    ? Math.exp(-c.distance / 900)
    : 0.55 + 0.45 * Math.exp(-c.distance / (slot.id === 'transport' ? 14000 : 3000));
  const weight = slot.section === 'around' ? 0.45 + 0.55 * c.significance : c.significance;
  return slot.priority * weight * prox;
}

/**
 * Greedy maximum-value matching: one candidate per slot, one slot per
 * candidate, highest-value pairs first. Open slots additionally require a
 * NEW story — that is what stops a second ordinary park from ever taking
 * a tenth place, while still letting a genuinely exceptional one through.
 */
export function assignSlots<T extends SlotCandidate>(slots: Slot[], candidates: T[]): Assignment<T>[] {
  const pairs: Assignment<T>[] = [];
  for (const slot of slots) {
    for (const c of candidates) {
      if (!eligible(slot, c)) continue;
      pairs.push({ slot, candidate: c, value: fit(slot, c) });
    }
  }
  pairs.sort((a, b) => b.value - a.value);

  const usedSlots = new Set<string>();
  const usedCandidates = new Set<string>();
  const usedStories = new Set<string>();
  const out: Assignment<T>[] = [];

  for (const p of pairs) {
    if (usedSlots.has(p.slot.id) || usedCandidates.has(p.candidate.canonicalId)) continue;
    const storySeen = usedStories.has(p.candidate.storyKey);
    if (storySeen) {
      // A repeated story may only pass through an OPEN slot, and only when
      // the candidate is independently exceptional.
      if (!p.slot.open || p.candidate.significance < 0.78) continue;
    }
    usedSlots.add(p.slot.id);
    usedCandidates.add(p.candidate.canonicalId);
    usedStories.add(p.candidate.storyKey);
    out.push(p);
  }
  return out;
}

/** Slots still unanswered — drives the single targeted retrieval pass. */
export function unansweredSlots<T extends SlotCandidate>(slots: Slot[], assigned: Assignment<T>[]): Slot[] {
  const filled = new Set(assigned.map((a) => a.slot.id));
  return slots.filter((s) => !filled.has(s.id) && s.probe);
}
