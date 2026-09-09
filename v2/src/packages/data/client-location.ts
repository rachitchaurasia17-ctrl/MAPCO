/** A satellite pin requires a real stored coordinate, never a plan's x/y. */
export function isClientCoordinate(value: unknown): value is { latitude: number; longitude: number } {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return typeof point.latitude === 'number' && typeof point.longitude === 'number'
    && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
    && !(point.latitude === 0 && point.longitude === 0);
}
