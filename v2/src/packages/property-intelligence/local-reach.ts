/* ═══════════════════════════════════════════════════════════════
   MAPCO — Local Reach selection
   ---------------------------------------------------------------
   Local Reach answers:

     "What useful everyday things are ACTUALLY around this property?"

   The bar is what a dealer would say standing at the gate:

     "Sector ke andar hi dairy booth hai, parks hain, grocery options
      hain, school hai, gym hai, mandir-gurdwara hai, sabzi mandi hai,
      Sohana market paas hai."

   Two things follow from that, and they are what this module does.

   1. MICRO-LOCAL BEATS MERELY NEAR. A verified local market inside the
      sector beats a café 700 m outside it. Sector membership is read
      from the place's own address text — never guessed from distance
      alone, and treated conservatively when the address does not say.

   2. DENSITY IS AN ANSWER. "9 grocery options, nearest 4 min walk" is
      more useful than one arbitrarily chosen shop. Dense everyday
      categories become a group; genuinely named places stay named.

   The mix adapts to property type: a warehouse does not need a park.
   Nothing is invented — a category with no verified result is simply
   absent, and a count is only ever a count of real resolved places.
   ═══════════════════════════════════════════════════════════════ */

export interface GeoPoint { latitude: number; longitude: number }

/** A candidate returned by discovery, before selection. */
export interface LocalCandidate {
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Google primary type, e.g. "supermarket", "park", "hindu_temple". */
  primaryType?: string;
  types?: readonly string[];
  /** The place's own formatted address, used for sector membership. */
  address?: string;
  /** Straight-line metres from the property. Shortlisting only. */
  meters: number;
}

/** The everyday need a category serves. Drives the mix, not the ranking. */
export type NeedGroup =
  | 'daily-essentials'
  | 'outdoors'
  | 'education'
  | 'health-fitness'
  | 'lifestyle'
  | 'community'
  | 'connectivity'
  | 'commerce'
  | 'industrial';

export interface LocalCategory {
  key: string;
  /** What the card says. */
  label: string;
  group: NeedGroup;
  /** Google place types that satisfy this category. */
  types: readonly string[];
  /**
   * Dense categories are shown as a count plus the nearest. Sparse,
   * landmark-like ones are shown as the named place.
   */
  presentation: 'density' | 'named';
  /** How much this matters day to day, 0–1. */
  usefulness: number;
}

/* ── the catalogue ───────────────────────────────────────────────
   Deliberately small and everyday. These are the things a resident
   actually uses, not everything Google can return. */

const RESIDENTIAL_CATEGORIES: readonly LocalCategory[] = [
  { key: 'dairy', label: 'Dairy & milk booth', group: 'daily-essentials', presentation: 'named', usefulness: 0.95,
    types: ['grocery_store', 'convenience_store', 'food_store'] },
  { key: 'grocery', label: 'Supermarkets & grocery', group: 'daily-essentials', presentation: 'density', usefulness: 1.0,
    types: ['supermarket', 'grocery_store', 'convenience_store'] },
  { key: 'daily-market', label: 'Sabzi mandi & daily market', group: 'daily-essentials', presentation: 'named', usefulness: 0.95,
    types: ['market', 'farmers_market', 'shopping_mall'] },
  { key: 'park', label: 'Parks', group: 'outdoors', presentation: 'density', usefulness: 0.9,
    types: ['park', 'garden', 'playground'] },
  { key: 'school', label: 'Schools', group: 'education', presentation: 'named', usefulness: 0.95,
    types: ['school', 'primary_school', 'secondary_school'] },
  { key: 'library', label: 'Library', group: 'education', presentation: 'named', usefulness: 0.55,
    types: ['library'] },
  { key: 'pharmacy', label: 'Pharmacies', group: 'health-fitness', presentation: 'density', usefulness: 0.9,
    types: ['pharmacy', 'drugstore'] },
  { key: 'clinic', label: 'Clinics & dentists', group: 'health-fitness', presentation: 'density', usefulness: 0.85,
    types: ['doctor', 'dentist', 'medical_lab'] },
  { key: 'gym', label: 'Gyms', group: 'health-fitness', presentation: 'named', usefulness: 0.75,
    types: ['gym', 'fitness_center'] },
  { key: 'salon', label: 'Salons', group: 'lifestyle', presentation: 'density', usefulness: 0.6,
    types: ['beauty_salon', 'hair_care', 'barber_shop'] },
  { key: 'sweets', label: 'Sweets & bakery', group: 'lifestyle', presentation: 'named', usefulness: 0.6,
    types: ['bakery', 'dessert_shop', 'confectionery'] },
  { key: 'worship', label: 'Temples & gurdwaras', group: 'community', presentation: 'density', usefulness: 0.8,
    types: ['hindu_temple', 'place_of_worship', 'church', 'mosque'] },
  { key: 'transit', label: 'Bus stop', group: 'connectivity', presentation: 'named', usefulness: 0.8,
    types: ['bus_stop', 'transit_station', 'bus_station'] },
  { key: 'atm', label: 'Banks & ATMs', group: 'daily-essentials', presentation: 'density', usefulness: 0.7,
    types: ['atm', 'bank'] },
];

const COMMERCIAL_CATEGORIES: readonly LocalCategory[] = [
  { key: 'market', label: 'Commercial market', group: 'commerce', presentation: 'named', usefulness: 1.0,
    types: ['market', 'shopping_mall', 'department_store'] },
  { key: 'bank', label: 'Banks & ATMs', group: 'commerce', presentation: 'density', usefulness: 0.95,
    types: ['bank', 'atm'] },
  { key: 'food', label: 'Cafés & eating out', group: 'commerce', presentation: 'density', usefulness: 0.8,
    types: ['restaurant', 'cafe', 'meal_takeaway'] },
  { key: 'business-services', label: 'Business services', group: 'commerce', presentation: 'density', usefulness: 0.85,
    types: ['accounting', 'lawyer', 'insurance_agency', 'courier_service'] },
  { key: 'hotel', label: 'Hotels', group: 'commerce', presentation: 'named', usefulness: 0.6,
    types: ['hotel', 'lodging'] },
  { key: 'parking', label: 'Parking', group: 'connectivity', presentation: 'density', usefulness: 0.8,
    types: ['parking'] },
  { key: 'transit', label: 'Transport access', group: 'connectivity', presentation: 'named', usefulness: 0.75,
    types: ['bus_stop', 'transit_station', 'bus_station'] },
  { key: 'fuel', label: 'Fuel stations', group: 'connectivity', presentation: 'named', usefulness: 0.65,
    types: ['gas_station'] },
];

const INDUSTRIAL_CATEGORIES: readonly LocalCategory[] = [
  { key: 'fuel', label: 'Fuel stations', group: 'industrial', presentation: 'named', usefulness: 1.0,
    types: ['gas_station', 'truck_stop'] },
  { key: 'logistics', label: 'Logistics & courier', group: 'industrial', presentation: 'density', usefulness: 0.95,
    types: ['courier_service', 'moving_company', 'storage'] },
  { key: 'transit', label: 'Transport access', group: 'connectivity', presentation: 'named', usefulness: 0.85,
    types: ['bus_station', 'transit_station', 'truck_stop'] },
  { key: 'bank', label: 'Banks & ATMs', group: 'commerce', presentation: 'density', usefulness: 0.8,
    types: ['bank', 'atm'] },
  { key: 'food', label: 'Food & dhaba', group: 'industrial', presentation: 'density', usefulness: 0.7,
    types: ['restaurant', 'meal_takeaway'] },
  { key: 'repair', label: 'Vehicle & equipment repair', group: 'industrial', presentation: 'density', usefulness: 0.75,
    types: ['car_repair', 'hardware_store'] },
];

export type LocalProfile = 'residential' | 'commercial' | 'industrial';

/** The Desk's ten property kinds collapse to three everyday profiles. */
export function localProfileFor(propertyType: string | undefined): LocalProfile {
  const t = String(propertyType ?? '').toLowerCase();
  if (t.includes('industrial')) return 'industrial';
  if (t.includes('sco') || t.includes('booth') || t.includes('office')
    || t.includes('showroom') || t.includes('commercial')) return 'commercial';
  return 'residential';
}

export function categoriesFor(profile: LocalProfile): readonly LocalCategory[] {
  if (profile === 'commercial') return COMMERCIAL_CATEGORIES;
  if (profile === 'industrial') return INDUSTRIAL_CATEGORIES;
  return RESIDENTIAL_CATEGORIES;
}

/* ── sector membership ───────────────────────────────────────────
   Read from the place's OWN address. A place whose address says
   "Sector 78" is in Sector 78 — that is a fact, not an inference. When
   the address is silent we fall back to a conservative distance band
   and mark it as unconfirmed, so a guess can never outrank a fact. */

export type SectorMatch = 'same-sector' | 'adjacent' | 'nearby' | 'unknown';

/** A Mohali/Chandigarh sector is roughly 800 m across. */
const SAME_SECTOR_METERS = 700;
const ADJACENT_METERS = 1500;

export function sectorMembership(
  candidate: LocalCandidate,
  propertySector: string | undefined,
): SectorMatch {
  const token = String(propertySector ?? '').match(/\b(\d+[a-z]?)\b/i)?.[1];
  const address = (candidate.address ?? '').toLowerCase();

  if (token && address) {
    // The address names this exact sector — a fact.
    if (new RegExp(`sector\\s*${token}\\b`, 'i').test(address)) return 'same-sector';
    // It names a DIFFERENT sector — also a fact, and a disqualifying one
    // for "same sector" however close it happens to be.
    if (/sector\s*\d+/i.test(address)) {
      return candidate.meters <= ADJACENT_METERS ? 'adjacent' : 'nearby';
    }
  }
  // Address is silent. Distance only, and never promoted to a fact.
  if (candidate.meters <= SAME_SECTOR_METERS) return 'adjacent';
  if (candidate.meters <= ADJACENT_METERS) return 'nearby';
  return 'unknown';
}

const SECTOR_WEIGHT: Record<SectorMatch, number> = {
  'same-sector': 1.0,
  adjacent: 0.72,
  nearby: 0.45,
  unknown: 0.28,
};

/** Walkability: full marks on foot, falling away as it becomes a drive. */
export function walkability(meters: number): number {
  if (meters <= 400) return 1;
  if (meters <= 900) return 0.85;
  if (meters <= 1500) return 0.6;
  if (meters <= 2500) return 0.35;
  return 0.15;
}

/* ── selection ───────────────────────────────────────────────── */

export interface LocalReachEntry {
  category: LocalCategory;
  /** Density cards carry every match; named cards carry exactly one. */
  matches: readonly LocalCandidate[];
  /** The one that is actually routed and shown as "nearest". */
  nearest: LocalCandidate;
  /** How many real, verified places back this card. */
  count: number;
  sector: SectorMatch;
  /** Internal ranking value. Never rendered. */
  rank: number;
}

export interface SelectLocalReachOptions {
  propertyType?: string;
  /** "Sector 78, Mohali" — used for sector membership. */
  propertySector?: string;
  /** How many cards to produce. Fewer is correct when fewer are real. */
  limit?: number;
  /** Candidates beyond this are not everyday. */
  maxMeters?: number;
  /** Minimum rank worth a card. */
  minRank?: number;
}

function matchesCategory(candidate: LocalCandidate, category: LocalCategory): boolean {
  const own = new Set<string>([
    ...(candidate.primaryType ? [candidate.primaryType] : []),
    ...(candidate.types ?? []),
  ]);
  return category.types.some((t) => own.has(t));
}

/**
 * Turn one pool of verified nearby places into the Local Reach cards.
 *
 * A category yields at most one card. Dense categories keep their whole
 * match list so the card can honestly say "9 nearby"; named categories
 * keep only their best single place.
 */
export function selectLocalReach(
  candidates: readonly LocalCandidate[],
  options: SelectLocalReachOptions = {},
): LocalReachEntry[] {
  const profile = localProfileFor(options.propertyType);
  const categories = categoriesFor(profile);
  const limit = options.limit ?? 6;
  const maxMeters = options.maxMeters ?? 3000;
  const minRank = options.minRank ?? 0.18;

  const inRange = candidates.filter((c) => c.meters <= maxMeters);
  const claimed = new Set<string>();
  const entries: LocalReachEntry[] = [];

  for (const category of categories) {
    // A place belongs to the first category that wants it, so one shop
    // cannot inflate two different cards.
    const matches = inRange
      .filter((c) => !claimed.has(c.placeId) && matchesCategory(c, category))
      .sort((a, b) => a.meters - b.meters);
    if (!matches.length) continue;

    const nearest = matches[0]!;
    const sector = sectorMembership(nearest, options.propertySector);
    // A density card is worth more when it is genuinely dense, but the
    // bonus is capped so quantity never beats being in the sector.
    const densityBonus = category.presentation === 'density'
      ? Math.min(0.2, (matches.length - 1) * 0.04)
      : 0;

    const rank = category.usefulness
      * SECTOR_WEIGHT[sector]
      * walkability(nearest.meters)
      + densityBonus;

    if (rank < minRank) continue;

    const kept = category.presentation === 'density' ? matches : [nearest];
    for (const m of kept) claimed.add(m.placeId);

    entries.push({
      category, matches: kept, nearest,
      count: kept.length, sector, rank,
    });
  }

  entries.sort((a, b) => b.rank - a.rank);

  /* Keep the mix honest: at most two cards from one need-group, so six
     rows cannot all be food. Applied as a cap, never as padding. */
  const perGroup = new Map<NeedGroup, number>();
  const picked: LocalReachEntry[] = [];
  for (const entry of entries) {
    if (picked.length >= limit) break;
    const used = perGroup.get(entry.category.group) ?? 0;
    if (used >= 2) continue;
    perGroup.set(entry.category.group, used + 1);
    picked.push(entry);
  }
  // If the cap left room and strong entries remain, use them.
  for (const entry of entries) {
    if (picked.length >= limit) break;
    if (!picked.includes(entry)) picked.push(entry);
  }
  return picked;
}

/** "6 nearby · nearest 3 min walk" — only ever real counts. */
export function densityLabel(entry: LocalReachEntry): string {
  return entry.count > 1 ? `${entry.count} nearby` : entry.nearest.name;
}
