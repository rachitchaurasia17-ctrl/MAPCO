/* ═══════════════════════════════════════════════════════════════
   MAPCO GEO — MAPCO's own knowledge of the Tri-City
   ---------------------------------------------------------------
   This is the knowledge MAPCO has that Google does not sell: which
   places actually MATTER to a property buyer here. It exists so that
   importance is decided by MAPCO, not by review counts.

   What is deliberately NOT here any more:
     • Road geometry — moved to road-network.ts, where it is
       materialised from Google's real road graph and verified.
       Hand-sampled corridors were deleted; they only looked like roads.
     • Sector polygons — removed entirely. Google Maps Platform does not
       expose sublocality/sector boundaries (the data-driven styling
       FeatureType enum stops at ADMINISTRATIVE_AREA_LEVEL_2 / LOCALITY /
       POSTAL_CODE), and approximating them was not acceptable.

   Anchor coordinates are approximate and are used primarily to RECOGNISE
   and rank places that Google returns, not to place pins of their own.
   ═══════════════════════════════════════════════════════════════ */
import type { LatLng } from '../config';

export type Precision = 'surveyed' | 'approximate';

export type AnchorKind =
  | 'airport' | 'railway' | 'mall' | 'hospital' | 'university' | 'business'
  | 'stadium' | 'landmark' | 'township' | 'transit';

export interface MapcoAnchor {
  id: string;
  name: string;
  aliases: string[];
  kind: AnchorKind;
  /** MAPCO importance 0..1 — independent of Google ratings. */
  importance: number;
  pos: LatLng;
  precision: Precision;
  /** May be surfaced on its own when Google discovery is genuinely thin. */
  trusted: boolean;
}

export const MAPCO_ANCHORS: MapcoAnchor[] = [
  { id: 'an-ixc', name: 'Chandigarh International Airport', aliases: ['shaheed bhagat singh international airport', 'chandigarh airport', 'sbs international airport', 'mohali airport', 'ixc'], kind: 'airport', importance: 1.0, pos: { lat: 30.6735, lng: 76.7885 }, precision: 'approximate', trusted: true },
  { id: 'an-cp67', name: 'CP67 Mall', aliases: ['cp67', 'cp 67', 'cp67 mall mohali'], kind: 'mall', importance: 0.88, pos: { lat: 30.7056, lng: 76.7385 }, precision: 'approximate', trusted: true },
  { id: 'an-elante', name: 'Elante Mall', aliases: ['elante', 'elante mall chandigarh'], kind: 'mall', importance: 0.9, pos: { lat: 30.7052, lng: 76.8014 }, precision: 'approximate', trusted: true },
  { id: 'an-bestech', name: 'Bestech Square Mall', aliases: ['bestech square', 'bestech mall'], kind: 'mall', importance: 0.78, pos: { lat: 30.7120, lng: 76.7280 }, precision: 'approximate', trusted: false },
  { id: 'an-northcountry', name: 'North Country Mall', aliases: ['north country mall kharar'], kind: 'mall', importance: 0.74, pos: { lat: 30.7480, lng: 76.6420 }, precision: 'approximate', trusted: false },
  { id: 'an-vrpunjab', name: 'VR Punjab', aliases: ['vr punjab mall', 'mall of punjab'], kind: 'mall', importance: 0.76, pos: { lat: 30.7850, lng: 76.6900 }, precision: 'approximate', trusted: false },
  { id: 'an-fortis', name: 'Fortis Hospital Mohali', aliases: ['fortis mohali', 'fortis hospital'], kind: 'hospital', importance: 0.88, pos: { lat: 30.7189, lng: 76.7233 }, precision: 'approximate', trusted: true },
  { id: 'an-max', name: 'Max Super Speciality Hospital Mohali', aliases: ['max hospital mohali', 'max hospital'], kind: 'hospital', importance: 0.82, pos: { lat: 30.7085, lng: 76.6990 }, precision: 'approximate', trusted: false },
  { id: 'an-pgi', name: 'PGIMER Chandigarh', aliases: ['pgi chandigarh', 'pgimer', 'post graduate institute'], kind: 'hospital', importance: 0.9, pos: { lat: 30.7645, lng: 76.7752 }, precision: 'approximate', trusted: false },
  { id: 'an-sohana', name: 'Sohana Hospital', aliases: ['shaheed baba deep singh hospital', 'sohana gurudwara hospital'], kind: 'hospital', importance: 0.7, pos: { lat: 30.7017, lng: 76.7180 }, precision: 'approximate', trusted: false },
  { id: 'an-iiser', name: 'IISER Mohali', aliases: ['iiser', 'indian institute of science education and research'], kind: 'university', importance: 0.86, pos: { lat: 30.6684, lng: 76.7290 }, precision: 'approximate', trusted: true },
  { id: 'an-pu', name: 'Panjab University', aliases: ['panjab university chandigarh', 'pu chandigarh'], kind: 'university', importance: 0.85, pos: { lat: 30.7605, lng: 76.7635 }, precision: 'approximate', trusted: false },
  { id: 'an-cu', name: 'Chandigarh University', aliases: ['chandigarh university gharuan', 'cu gharuan'], kind: 'university', importance: 0.8, pos: { lat: 30.7714, lng: 76.5760 }, precision: 'approximate', trusted: false },
  { id: 'an-itcity', name: 'IT City Mohali', aliases: ['it city', 'gmada it city'], kind: 'business', importance: 0.85, pos: { lat: 30.6790, lng: 76.7080 }, precision: 'approximate', trusted: true },
  { id: 'an-itpark', name: 'Mohali IT Park', aliases: ['quark city', 'it park mohali', 'it park', 'rajiv gandhi technology park'], kind: 'business', importance: 0.84, pos: { lat: 30.7128, lng: 76.6885 }, precision: 'approximate', trusted: true },
  { id: 'an-pca', name: 'PCA Stadium', aliases: ['is bindra stadium', 'inderjit singh bindra stadium', 'mohali cricket stadium', 'pca'], kind: 'stadium', importance: 0.8, pos: { lat: 30.7011, lng: 76.7302 }, precision: 'approximate', trusted: true },
  { id: 'an-sukhna', name: 'Sukhna Lake', aliases: ['sukhna'], kind: 'landmark', importance: 0.85, pos: { lat: 30.7421, lng: 76.8188 }, precision: 'approximate', trusted: false },
  { id: 'an-rockgarden', name: 'Rock Garden', aliases: ['rock garden chandigarh', 'nek chand rock garden'], kind: 'landmark', importance: 0.78, pos: { lat: 30.7525, lng: 76.8106 }, precision: 'approximate', trusted: false },
  { id: 'an-chdstn', name: 'Chandigarh Railway Station', aliases: ['chandigarh junction', 'chandigarh railway'], kind: 'railway', importance: 0.85, pos: { lat: 30.6798, lng: 76.8380 }, precision: 'approximate', trusted: true },
  { id: 'an-mohalistn', name: 'Mohali Railway Station', aliases: ['sas nagar railway station', 'sahibzada ajit singh nagar railway station'], kind: 'railway', importance: 0.62, pos: { lat: 30.6350, lng: 76.7530 }, precision: 'approximate', trusted: false },
  { id: 'an-isbt43', name: 'ISBT Sector 43', aliases: ['isbt chandigarh', 'inter state bus terminal sector 43'], kind: 'transit', importance: 0.72, pos: { lat: 30.7190, lng: 76.7510 }, precision: 'approximate', trusted: false },
  { id: 'an-aerocity', name: 'Aerocity Mohali', aliases: ['gmada aerocity', 'aerocity'], kind: 'township', importance: 0.78, pos: { lat: 30.6600, lng: 76.7700 }, precision: 'approximate', trusted: true },
  { id: 'an-jlpl82', name: 'JLPL Sector 82', aliases: ['jlpl falcon view', 'jlpl industrial area', 'jlpl'], kind: 'township', importance: 0.7, pos: { lat: 30.6740, lng: 76.7040 }, precision: 'approximate', trusted: false },
  { id: 'an-wave85', name: 'Wave Estate', aliases: ['wave estate sector 85', 'wave estate mohali'], kind: 'township', importance: 0.68, pos: { lat: 30.6620, lng: 76.7180 }, precision: 'approximate', trusted: false },
  { id: 'an-gillco', name: 'Gillco Valley', aliases: ['gillco valley kharar', 'gillco'], kind: 'township', importance: 0.66, pos: { lat: 30.7080, lng: 76.6390 }, precision: 'approximate', trusted: false },
];

/* ── Geometry helpers (local, free — no Google calls) ──────────── */
const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

export function metersBetween(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
