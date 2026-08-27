/* ═══════════════════════════════════════════════════════════════
   MAPCO — Curated City Reach landmarks · canonical model
   ---------------------------------------------------------------
   City Reach anchors are MAPCO's own dataset, not a Google Places
   result. A landmark is a stable object with:

       NAME + EXACT LOCATION + PHOTO + CATEGORY

   The coordinates are supplied by MAPCO and are CANONICAL. They are
   validated structurally (a point must be a real point, and inside the
   region we actually curate) but never silently replaced by inferred
   geography, and never re-verified against Google at runtime.

   Because the landmark and its photo are ours, City Reach costs
   nothing to discover or illustrate. Google is used only to compute
   factual travel time from one property to the finalists.
   ═══════════════════════════════════════════════════════════════ */

/** Kept deliberately small. A landmark is defined by what it IS. */
export type LandmarkCategory =
  | 'airport'
  | 'hospital'
  | 'mall'
  | 'university'
  | 'railway-station'
  | 'bus-terminal'
  | 'business-district'
  | 'employment-hub'
  | 'major-market'
  | 'major-road'
  | 'institution'
  | 'recreation'
  | 'civic'
  | 'other';

/**
 * How widely a landmark is recognised. This is a descriptive property of
 * the place — not a score, not a rating, and never shown as a number.
 * It exists so City Reach can prefer an anchor a buyer will actually
 * recognise over an equally-close one they will not.
 */
export type LandmarkRecognition = 'regional' | 'city' | 'local';

export interface CuratedLandmark {
  id: string;
  name: string;
  /** MAPCO-supplied canonical coordinate. Never inferred, never replaced. */
  latitude: number;
  longitude: number;
  category: LandmarkCategory;
  /** The city/region the landmark belongs to. */
  city: string;
  /** Optional finer placement inside that city. */
  locality?: string;
  recognition: LandmarkRecognition;
  /**
   * MAPCO-owned image, resolved to a public asset path at import time.
   * Null means the curated photo is genuinely missing — the importer
   * reports it rather than substituting a Google or generic image.
   */
  image: string | null;
  active: boolean;

  /* ── curated relevance ──
     Optional operator knowledge that stops all 50 landmarks being
     treated as equal points on a map. Every field is a statement about
     the place itself, never a prediction about a property. */

  /** What this landmark IS to the region, in plain words. */
  role?: string;
  /**
   * How widely it anchors a location. Overrides `recognition` for
   * ranking when an operator has been explicit.
   */
  importance?: 'regional' | 'city' | 'local';
  /**
   * Localities this landmark genuinely serves — "Aerocity", "Sector 78",
   * "central Mohali". A property in one of these gets a small relevance
   * lift. Absent means neutral, never a penalty.
   */
  relevantTo?: readonly string[];
  /** Who it is useful to: "families", "commuters", "business". */
  usefulFor?: readonly string[];
  createdAt?: string;
  updatedAt?: string;
}

/** The source row an operator curates. Image is a filename, not a path. */
export interface LandmarkSeedRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: LandmarkCategory;
  city: string;
  locality?: string;
  recognition: LandmarkRecognition;
  /** File in the curated landmark photo folder. Null when not supplied. */
  imageFile: string | null;
}

/* ── structural validation ───────────────────────────────────────
   A curated coordinate is trusted, but it still has to be a real point,
   and it has to be inside the geography we actually curate. A typo that
   drops a digit would otherwise place a Mohali landmark in the ocean and
   quietly poison every City Reach shortlist. */

/** The Tri-City belt MAPCO curates, with generous margin. */
export const CURATED_REGION_BOUNDS = {
  minLatitude: 30.2,
  maxLatitude: 31.2,
  minLongitude: 76.3,
  maxLongitude: 77.2,
} as const;

export function landmarkCoordinateError(
  latitude: unknown,
  longitude: unknown,
): string | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number'
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return 'latitude and longitude must be finite numbers';
  }
  if (latitude < -90 || latitude > 90) return 'latitude must be between -90 and 90';
  if (longitude < -180 || longitude > 180) return 'longitude must be between -180 and 180';
  const b = CURATED_REGION_BOUNDS;
  if (latitude < b.minLatitude || latitude > b.maxLatitude
    || longitude < b.minLongitude || longitude > b.maxLongitude) {
    return `coordinate is outside the curated Tri-City region (${latitude}, ${longitude})`;
  }
  return null;
}

export interface LandmarkValidationIssue {
  id: string;
  name: string;
  problem: 'invalid-coordinate' | 'missing-image' | 'duplicate-id' | 'image-not-found';
  detail: string;
}
