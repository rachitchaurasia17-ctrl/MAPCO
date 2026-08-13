import { propertyLocationPoint } from '../../packages/data/property-location';
import type { Property } from '../../packages/data/types';

export type PropertyAttentionReason =
  | 'photo'
  | 'published'
  | 'map-placement'
  | 'earth-location';

export interface PropertyOperationalState {
  photoCount: number;
  hasDisplayPhoto: boolean;
  isPublished: boolean;
  hasMapPlacement: boolean;
  hasEarthLocation: boolean;
  attentionReasons: PropertyAttentionReason[];
  readyToShow: boolean;
}

/**
 * A single, factual readiness definition shared by Dealer Home and My Plots.
 * Presentation-map placement and geographic Earth location intentionally stay
 * independent: neither one can stand in for the other.
 */
export function propertyOperationalState(property: Property): PropertyOperationalState {
  const displayPhotos = property.photos ?? [];
  const storedPhotos = property.photoStorage ?? [];
  const photoCount = Math.max(displayPhotos.length, storedPhotos.length);
  const hasMapPlacement = Boolean(property.mapPlacement);
  const hasEarthLocation = propertyLocationPoint(property.location) !== null;
  const attentionReasons: PropertyAttentionReason[] = [];

  if (photoCount === 0) attentionReasons.push('photo');
  if (!property.published) attentionReasons.push('published');
  if (!hasMapPlacement) attentionReasons.push('map-placement');
  if (!hasEarthLocation) attentionReasons.push('earth-location');

  return {
    photoCount,
    hasDisplayPhoto: displayPhotos.length > 0,
    isPublished: property.published,
    hasMapPlacement,
    hasEarthLocation,
    attentionReasons,
    readyToShow: !property.sold && attentionReasons.length === 0,
  };
}

export const propertyAttentionLabel = (reason: PropertyAttentionReason): string => {
  switch (reason) {
    case 'photo': return 'Add photos';
    case 'published': return 'Publish to presentation';
    case 'map-placement': return 'Place on presentation map';
    case 'earth-location': return 'Set Earth location';
  }
};
