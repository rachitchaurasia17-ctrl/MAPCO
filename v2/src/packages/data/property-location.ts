import type {
  Property,
  PropertyLocation,
  PropertyLocationInput,
  PropertyLocationSource,
} from './types';

export interface GeographicPoint {
  lat: number;
  lng: number;
}

const LOCATION_SOURCES = new Set<PropertyLocationSource>([
  'dealer-selected',
  'manually-verified',
  'imported',
  'migrated',
]);

export function coordinateValidationError(latitude: unknown, longitude: unknown): string | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number'
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return 'Property latitude and longitude must be finite numbers.';
  }
  if (latitude < -90 || latitude > 90) return 'Property latitude must be between -90 and 90.';
  if (longitude < -180 || longitude > 180) return 'Property longitude must be between -180 and 180.';
  return null;
}

export function propertyLocationValidationError(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return 'Property location must be an object.';
  const location = value as Partial<PropertyLocation>;
  const coordinateError = coordinateValidationError(location.latitude, location.longitude);
  if (coordinateError) return coordinateError;
  if (location.source !== undefined && !LOCATION_SOURCES.has(location.source)) {
    return 'Property location source is not supported.';
  }
  if (location.updatedAt !== undefined
    && (typeof location.updatedAt !== 'string' || !location.updatedAt.trim()
      || Number.isNaN(Date.parse(location.updatedAt)))) {
    return 'Property location updatedAt must be a valid ISO timestamp.';
  }
  return null;
}

/** Read boundary: malformed legacy payloads become locationless, never fake coordinates. */
export function normalizePropertyLocation(value: unknown): PropertyLocation | undefined {
  if (propertyLocationValidationError(value)) return undefined;
  if (value == null) return undefined;
  const input = value as PropertyLocation;
  return {
    latitude: input.latitude,
    longitude: input.longitude,
    ...(input.source ? { source: input.source } : {}),
    ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
  };
}

export function createPropertyLocation(
  input: PropertyLocationInput,
  updatedAt = new Date().toISOString(),
): PropertyLocation {
  const value: PropertyLocation = { ...input, updatedAt };
  const error = propertyLocationValidationError(value);
  if (error) throw new RangeError(error);
  return value;
}

export function propertyLocationPoint(location: PropertyLocation | undefined): GeographicPoint | null {
  const normalized = normalizePropertyLocation(location);
  return normalized
    ? { lat: normalized.latitude, lng: normalized.longitude }
    : null;
}

/** Canonical coordinates always win; a valid legacy point is compatibility-only. */
export function resolvePropertyPoint(
  property: Pick<Property, 'location'>,
  legacyPoint?: GeographicPoint | null,
): GeographicPoint | null {
  const canonical = propertyLocationPoint(property.location);
  if (canonical) return canonical;
  if (!legacyPoint || coordinateValidationError(legacyPoint.lat, legacyPoint.lng)) return null;
  return { lat: legacyPoint.lat, lng: legacyPoint.lng };
}

/** Preserve numeric precision and remove malformed location payloads on reads. */
export function normalizePropertyLocationOnRead(property: Property): Property {
  const location = normalizePropertyLocation(property.location);
  if (!location) {
    const { location: _invalid, ...rest } = property;
    return rest as Property;
  }
  return { ...property, location };
}
