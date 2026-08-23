/* Phosphor icon mapping — mirrors the icons the finished UI already used in
   its mock so the design is unchanged. Category/type → icon class. */
import type { DayToDayCategory, CityReachType } from './types.ts';

const DAY_TO_DAY_ICON: Record<DayToDayCategory, string> = {
  park: 'ph-fill ph-tree',
  grocery: 'ph-fill ph-shopping-cart',
  gym: 'ph-fill ph-barbell',
  school: 'ph-fill ph-graduation-cap',
  healthcare: 'ph-fill ph-first-aid',
  daily_market: 'ph-fill ph-storefront',
};

const CITY_REACH_ICON: Record<CityReachType, string> = {
  mall: 'ph-fill ph-buildings',
  road: 'ph-fill ph-road-horizon',
  hospital: 'ph-fill ph-hospital',
  airport: 'ph-fill ph-airplane-takeoff',
  stadium: 'ph-fill ph-ticket',
  business_district: 'ph-fill ph-briefcase',
  institution: 'ph-fill ph-bank',
  civic: 'ph-fill ph-buildings',
  landmark: 'ph-fill ph-map-pin',
};

export function dayToDayIcon(category: DayToDayCategory): string {
  return DAY_TO_DAY_ICON[category] ?? 'ph-fill ph-map-pin';
}

export function cityReachIcon(type: CityReachType): string {
  return CITY_REACH_ICON[type] ?? 'ph-fill ph-map-pin';
}

/** Places (New) `includedType` used for a bounded category repair search. */
export function repairIncludedType(category: DayToDayCategory): string | undefined {
  switch (category) {
    case 'park': return 'park';
    case 'grocery': return 'supermarket';
    case 'gym': return 'gym';
    case 'school': return 'school';
    case 'healthcare': return 'hospital';
    case 'daily_market': return 'market';
    default: return undefined;
  }
}
