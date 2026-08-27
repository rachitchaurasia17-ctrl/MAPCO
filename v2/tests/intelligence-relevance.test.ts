import { describe, expect, it } from 'vitest';
import {
  selectLocalReach, localProfileFor, categoriesFor, sectorMembership,
  walkability, densityLabel,
  type LocalCandidate,
} from '../src/packages/property-intelligence/local-reach';
import {
  shortlistCityReach, finalizeCityReach, proximityScore, haversineKm,
  CITY_REACH_DISTANCE, type RoutedCandidate,
} from '../src/packages/property-intelligence/landmarks/city-reach-selector';
import { CURATED_LANDMARK_LIBRARY } from '../src/packages/property-intelligence/landmarks/library';

/* Sector 78, Mohali — the benchmark location. */
const SECTOR_78 = { latitude: 30.6885, longitude: 76.7020 };

let seq = 0;
function place(
  name: string, types: string[], meters: number, address = 'Sector 78, Mohali',
): LocalCandidate {
  seq += 1;
  return {
    placeId: `p${seq}`, name, types, primaryType: types[0],
    address, meters,
    latitude: SECTOR_78.latitude, longitude: SECTOR_78.longitude,
  };
}

/** A realistic Sector-78-shaped pool: dense everyday places plus noise. */
function sector78Pool(): LocalCandidate[] {
  return [
    place('Verka Milk Booth', ['convenience_store', 'food_store'], 220),
    place('Sector 78 Sabzi Mandi', ['market'], 380),
    place('8to10 Supermart', ['supermarket'], 300),
    place('Sharma Grocery', ['grocery_store'], 420),
    place('Nirmal Store', ['convenience_store'], 500),
    place('Neighbourhood Park', ['park'], 180),
    place('Green Belt Park', ['park'], 340),
    place('Corner Park', ['park'], 520),
    place('Shivalik Public School', ['school', 'primary_school'], 650),
    place('Sector 78 Library', ['library'], 700),
    place('Bhatia Medicos', ['pharmacy'], 260),
    place('Wellness Chemist', ['pharmacy'], 610),
    place('Smile Dental Clinic', ['dentist'], 480),
    place('Oxfit Gym', ['gym', 'fitness_center'], 540),
    place('Style Studio Salon', ['beauty_salon'], 360),
    place('Cut & Care', ['hair_care'], 590),
    place('Guru Nanak Sweets', ['bakery', 'dessert_shop'], 430),
    place('Shri Mandir', ['hindu_temple', 'place_of_worship'], 470),
    place('Gurdwara Sahib', ['place_of_worship'], 520),
    place('Sector 78 Bus Stop', ['bus_stop'], 300),
    place('PNB ATM', ['atm'], 350),
    /* Noise the old "nearest six POIs" behaviour would have surfaced:
       restaurants and cafés just outside the sector. */
    place('Cafe Mocha', ['cafe'], 700, 'Sector 79, Mohali'),
    place('Pizza Point', ['restaurant'], 720, 'Sector 79, Mohali'),
    place('Curry House', ['restaurant'], 760, 'Sector 79, Mohali'),
    place('Tandoori Nights', ['restaurant'], 810, 'Sector 79, Mohali'),
    /* Sohana Market — just outside the sector but genuinely useful. */
    place('Sohana Main Bazaar', ['market'], 1400, 'Sohana, Mohali'),
  ];
}

describe('Local Reach — Sector 78 residential benchmark', () => {
  const entries = selectLocalReach(sector78Pool(), {
    propertyType: 'Residential Plot', propertySector: 'Sector 78, Mohali', limit: 6,
  });

  it('produces a useful mix rather than the nearest six POIs', () => {
    expect(entries.length).toBeGreaterThanOrEqual(4);
    expect(entries.length).toBeLessThanOrEqual(6);
    const groups = new Set(entries.map((e) => e.category.group));
    expect(groups.size).toBeGreaterThanOrEqual(3);
  });

  it('is not dominated by restaurants and cafés', () => {
    const food = entries.filter((e) => ['food', 'sweets'].includes(e.category.key));
    expect(food.length).toBeLessThanOrEqual(1);
    // Residential Local Reach has no generic restaurant category at all.
    expect(categoriesFor('residential').some((c) => c.key === 'food')).toBe(false);
  });

  it('surfaces daily essentials when they exist', () => {
    const keys = entries.map((e) => e.category.key);
    const essentials = ['grocery', 'daily-market', 'dairy'];
    expect(keys.some((k) => essentials.includes(k))).toBe(true);
  });

  it('can surface parks, health, education and community', () => {
    const wide = selectLocalReach(sector78Pool(), {
      propertyType: 'Residential Plot', propertySector: 'Sector 78, Mohali', limit: 12,
    });
    const groups = new Set(wide.map((e) => e.category.group));
    expect(groups.has('outdoors')).toBe(true);
    expect(groups.has('health-fitness')).toBe(true);
    expect(groups.has('education')).toBe(true);
    expect(groups.has('community')).toBe(true);
  });

  it('shows density for dense categories and a name for landmark ones', () => {
    const wide = selectLocalReach(sector78Pool(), {
      propertyType: 'Residential Plot', propertySector: 'Sector 78, Mohali', limit: 12,
    });
    const parks = wide.find((e) => e.category.key === 'park');
    expect(parks?.count).toBeGreaterThan(1);
    expect(densityLabel(parks!)).toMatch(/^\d+ nearby$/);

    const school = wide.find((e) => e.category.key === 'school');
    expect(school?.count).toBe(1);
    expect(densityLabel(school!)).toBe('Shivalik Public School');
  });

  it('counts only real resolved places — never an invented number', () => {
    const wide = selectLocalReach(sector78Pool(), {
      propertyType: 'Residential Plot', propertySector: 'Sector 78, Mohali', limit: 12,
    });
    for (const entry of wide) {
      expect(entry.count).toBe(entry.matches.length);
      expect(entry.matches.length).toBeGreaterThan(0);
    }
  });

  it('never lets one place inflate two cards', () => {
    const wide = selectLocalReach(sector78Pool(), {
      propertyType: 'Residential Plot', propertySector: 'Sector 78, Mohali', limit: 12,
    });
    const ids = wide.flatMap((e) => e.matches.map((m) => m.placeId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rejects distant POIs that are not everyday', () => {
    const withFarPOI = [...sector78Pool(),
      place('Distant Hypermarket', ['supermarket'], 9000, 'Sector 22, Chandigarh')];
    const wide = selectLocalReach(withFarPOI, {
      propertyType: 'Residential Plot', propertySector: 'Sector 78, Mohali', limit: 12,
    });
    const names = wide.flatMap((e) => e.matches.map((m) => m.name));
    expect(names).not.toContain('Distant Hypermarket');
  });
});

describe('Local Reach — same-sector weighting', () => {
  it('reads sector membership from the address, not from distance', () => {
    const inSector = place('In Sector Market', ['market'], 900, 'Sector 78, Mohali');
    const outSector = place('Other Sector Market', ['market'], 300, 'Sector 79, Mohali');
    expect(sectorMembership(inSector, 'Sector 78, Mohali')).toBe('same-sector');
    // Closer, but its own address says a different sector.
    expect(sectorMembership(outSector, 'Sector 78, Mohali')).not.toBe('same-sector');
  });

  it('treats a silent address conservatively rather than assuming', () => {
    const silent = place('Unnamed Shop', ['grocery_store'], 250, 'Mohali, Punjab');
    // Close, but never promoted to a same-sector fact.
    expect(sectorMembership(silent, 'Sector 78, Mohali')).toBe('adjacent');
  });

  it('lets a same-sector market beat a closer out-of-sector café', () => {
    const pool = [
      place('Sector 78 Market', ['market'], 900, 'Sector 78, Mohali'),
      place('Nearby Cafe', ['cafe'], 300, 'Sector 79, Mohali'),
      place('Sector 78 Grocery', ['supermarket'], 800, 'Sector 78, Mohali'),
    ];
    const entries = selectLocalReach(pool, {
      propertyType: 'Residential Plot', propertySector: 'Sector 78, Mohali', limit: 6,
    });
    const keys = entries.map((e) => e.category.key);
    expect(keys).toContain('daily-market');
    // The café is not even a residential category.
    expect(keys).not.toContain('food');
  });

  it('scores walking distance the way a resident experiences it', () => {
    expect(walkability(300)).toBe(1);
    expect(walkability(800)).toBeLessThan(1);
    expect(walkability(3000)).toBeLessThan(walkability(1200));
  });
});

describe('Local Reach — property type changes the answer', () => {
  const pool = [
    ...sector78Pool(),
    place('HDFC Bank', ['bank'], 400),
    place('Sharma & Co Chartered Accountants', ['accounting'], 500),
    place('Indian Oil Petrol Pump', ['gas_station'], 800),
    place('BlueDart Courier', ['courier_service'], 700),
    place('Auto Repair Works', ['car_repair'], 900),
    place('Multi-level Parking', ['parking'], 350),
  ];

  it('gives a commercial property a different mix from a residential one', () => {
    const residential = selectLocalReach(pool, {
      propertyType: 'Residential Plot', propertySector: 'Sector 78, Mohali', limit: 6,
    }).map((e) => e.category.key);
    const commercial = selectLocalReach(pool, {
      propertyType: 'Commercial SCO', propertySector: 'Sector 78, Mohali', limit: 6,
    }).map((e) => e.category.key);

    expect(commercial).not.toEqual(residential);
    // Commercial cares about banks and business services; residential does not.
    expect(commercial.some((k) => ['bank', 'business-services', 'market'].includes(k))).toBe(true);
    expect(residential).not.toContain('business-services');
  });

  it('gives an industrial property access and logistics, not parks and schools', () => {
    const industrial = selectLocalReach(pool, {
      propertyType: 'Industrial Plot', propertySector: 'Phase 8, Mohali', limit: 6,
    }).map((e) => e.category.key);
    expect(industrial.some((k) => ['fuel', 'logistics', 'transit', 'repair'].includes(k))).toBe(true);
    expect(industrial).not.toContain('park');
    expect(industrial).not.toContain('school');
  });

  it('maps every Desk property type to a profile', () => {
    expect(localProfileFor('Residential Plot')).toBe('residential');
    expect(localProfileFor('Kothi')).toBe('residential');
    expect(localProfileFor('Villa')).toBe('residential');
    expect(localProfileFor('Flat')).toBe('residential');
    expect(localProfileFor('Commercial SCO')).toBe('commercial');
    expect(localProfileFor('Showroom')).toBe('commercial');
    expect(localProfileFor('Office')).toBe('commercial');
    expect(localProfileFor('Industrial Plot')).toBe('industrial');
  });
});

describe('Local Reach — fewer results is correct', () => {
  it('shows four cards when only four categories have real matches', () => {
    const thin = [
      place('Corner Grocery', ['grocery_store'], 300),
      place('Small Park', ['park'], 400),
      place('Local Chemist', ['pharmacy'], 350),
      place('Bus Stop', ['bus_stop'], 500),
    ];
    const entries = selectLocalReach(thin, {
      propertyType: 'Residential Plot', propertySector: 'Sector 78, Mohali', limit: 6,
    });
    expect(entries.length).toBe(4);
  });

  it('shows nothing rather than noise when nothing everyday is near', () => {
    const none = [place('Remote Warehouse', ['storage'], 8000, 'Derabassi')];
    expect(selectLocalReach(none, { propertyType: 'Residential Plot', limit: 6 })).toHaveLength(0);
  });
});

describe('City Reach — proximity is a hard filter', () => {
  it('excludes anything past the hard ceiling however famous', () => {
    const picked = shortlistCityReach(SECTOR_78, CURATED_LANDMARK_LIBRARY, { shortlistSize: 20 });
    for (const c of picked) {
      expect(c.straightLineKm, c.landmark.name).toBeLessThanOrEqual(CITY_REACH_DISTANCE.hardMaxKm);
    }
  });

  it('drops the far famous landmarks for a Sector 78 property', () => {
    const names = shortlistCityReach(SECTOR_78, CURATED_LANDMARK_LIBRARY, { shortlistSize: 20 })
      .map((c) => c.landmark.name);
    // All of these are well known and all are far from Sector 78.
    for (const far of ['Sukhna Lake', 'Rock Garden', 'Capitol Complex', 'Elante Mall']) {
      expect(names, far).not.toContain(far);
    }
  });

  it('prefers a closer major anchor over a more famous distant one', () => {
    const far = CURATED_LANDMARK_LIBRARY.find((l) => l.name === 'Shaheed Bhagat Singh International Airport')!;
    const near = CURATED_LANDMARK_LIBRARY.find((l) => l.name === 'Sohana Hospital')!;
    expect(haversineKm(SECTOR_78, far)).toBeGreaterThan(haversineKm(SECTOR_78, near));
    const picked = shortlistCityReach(SECTOR_78, [far, near], { shortlistSize: 5 });
    expect(picked[0]?.landmark.name).toBe('Sohana Hospital');
  });

  it('scores proximity in bands and gives nothing full marks past the relevant band', () => {
    expect(proximityScore(1)).toBe(1);
    expect(proximityScore(CITY_REACH_DISTANCE.strongKm)).toBe(1);
    expect(proximityScore(4)).toBeLessThan(1);
    expect(proximityScore(CITY_REACH_DISTANCE.relevantKm)).toBeLessThanOrEqual(0.25);
  });

  it('returns fewer than the target rather than padding with distant landmarks', () => {
    // A location with only a couple of curated anchors genuinely nearby.
    const remote = { latitude: 30.60, longitude: 76.60 };
    const picked = shortlistCityReach(remote, CURATED_LANDMARK_LIBRARY, { shortlistSize: 6 });
    expect(picked.length).toBeLessThan(6);
    for (const c of picked) {
      expect(c.straightLineKm).toBeLessThanOrEqual(CITY_REACH_DISTANCE.hardMaxKm);
    }
  });

  it('re-applies the ceiling to the REAL road distance', () => {
    const near = CURATED_LANDMARK_LIBRARY.find((l) => l.name === 'Sohana Hospital')!;
    const routed: RoutedCandidate[] = [{
      landmark: near, straightLineKm: 2, rank: 0.8,
      // Straight line is fine, but the road route is far past the ceiling.
      distanceMeters: 9500, durationSeconds: 900,
    }];
    expect(finalizeCityReach(routed)).toHaveLength(0);
  });

  it('still drops a candidate that failed to route', () => {
    const near = CURATED_LANDMARK_LIBRARY.find((l) => l.name === 'Sohana Hospital')!;
    expect(finalizeCityReach([{
      landmark: near, straightLineKm: 2, rank: 0.8,
      distanceMeters: 0, durationSeconds: 0,
    }])).toHaveLength(0);
  });

  it('does not force category diversity at the cost of a stronger anchor', () => {
    const hospitals = CURATED_LANDMARK_LIBRARY
      .filter((l) => l.category === 'hospital')
      .slice(0, 3);
    const picked = shortlistCityReach(
      { latitude: hospitals[0]!.latitude, longitude: hospitals[0]!.longitude },
      hospitals, { shortlistSize: 3 });
    // All three may be hospitals — that is allowed when they are the
    // strongest anchors, because diversity is not a target.
    expect(picked.length).toBeGreaterThan(1);
  });
});

describe('City Reach and Local Reach are different questions', () => {
  it('City Reach stays inside a few km while Local Reach stays walkable', () => {
    const city = shortlistCityReach(SECTOR_78, CURATED_LANDMARK_LIBRARY, { shortlistSize: 10 });
    for (const c of city) expect(c.straightLineKm).toBeLessThanOrEqual(6);

    const local = selectLocalReach(sector78Pool(), {
      propertyType: 'Residential Plot', propertySector: 'Sector 78, Mohali', limit: 12,
    });
    for (const e of local) expect(e.nearest.meters).toBeLessThanOrEqual(3000);
  });
});
