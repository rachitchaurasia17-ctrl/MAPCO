/* Shared MAPCO intelligence types (kept separate to avoid import cycles). */
import type { LatLng } from '../config';

/** What a property is FOR. Drives which location questions get asked. */
export type Intent = 'residential' | 'commercial' | 'investment' | 'rental';

/** The three fixed Location Advantage sections. */
export type Section = 'around' | 'nearby' | 'roads';

export type { LatLng };
