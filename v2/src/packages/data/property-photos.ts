import type { Property, PropertyPhotoStorageRef } from './types';

export const PROPERTY_PHOTO_BUCKET = 'property-photos';
export const PROPERTY_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROPERTY_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const SIGNED_STORAGE_PATH = /\/storage\/v1\/object\/(?:sign|authenticated)\//i;

export function isPersistentExternalPhoto(value: string): boolean {
  const photo = String(value || '').trim();
  if (!photo || /^(?:blob:|data:)/i.test(photo) || SIGNED_STORAGE_PATH.test(photo)) return false;
  if (photo.startsWith('/')) return true;
  try {
    const url = new URL(photo);
    return url.protocol === 'https:' && !url.searchParams.has('token');
  } catch { return false; }
}

export function normalizePropertyPhotoStorage(value: unknown, propertyId?: string): PropertyPhotoStorageRef[] {
  if (!Array.isArray(value)) return [];
  const expected = propertyId ? `/properties/${propertyId}/` : '/properties/';
  const seen = new Set<string>();
  return value.flatMap((entry): PropertyPhotoStorageRef[] => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Partial<PropertyPhotoStorageRef>;
    const path = String(item.path || '').trim();
    if (item.kind !== 'storage' || !path.startsWith('dealers/') || !path.includes(expected)
      || path.startsWith('/') || path.includes('..') || seen.has(path)) return [];
    seen.add(path);
    return [{ kind: 'storage', id: String(item.id || path.split('/').pop() || path), path }];
  });
}

export function persistentPropertyPayload(property: Property): Property {
  return {
    ...property,
    photos: (property.photos ?? []).filter(isPersistentExternalPhoto),
    photoStorage: normalizePropertyPhotoStorage(property.photoStorage, property.id),
  };
}

export function propertyPhotoSelections(property: Property): string[] {
  const external = (property.photos ?? []).filter(isPersistentExternalPhoto).slice(0, 8);
  const storage = normalizePropertyPhotoStorage(property.photoStorage, property.id)
    .slice(0, Math.max(0, 8 - external.length));
  return [
    ...external.map((_, index) => `external:${index}`),
    ...storage.map((_, index) => `storage:${index}`),
  ];
}

export function propertyPhotoObjectPath(
  dealerId: string,
  propertyId: string,
  objectId: string,
  mimeType: string,
): string {
  const safe = (value: string) => {
    const clean = value.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(clean)) throw new Error('Invalid property photo path component');
    return clean;
  };
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return `dealers/${safe(dealerId)}/properties/${safe(propertyId)}/${safe(objectId)}.${ext}`;
}

export function validatePropertyPhoto(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(PROPERTY_PHOTO_TYPES as readonly string[]).includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size <= 0 || file.size > PROPERTY_PHOTO_MAX_BYTES) return 'Each photo must be 5 MB or smaller.';
  return null;
}
