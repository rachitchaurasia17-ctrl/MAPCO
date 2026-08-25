import type { PropertyDocumentType } from './types';

export const PROPERTY_DOCUMENT_BUCKET = 'property-documents' as const;
export const PROPERTY_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const PROPERTY_DOCUMENT_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
] as const;

export function validatePropertyDocument(file: Pick<File, 'type' | 'size'>): string | null {
  if (!(PROPERTY_DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
    return 'Use a PDF, JPG, PNG or WebP document.';
  }
  if (file.size <= 0 || file.size > PROPERTY_DOCUMENT_MAX_BYTES) {
    return 'Each document must be 20 MB or smaller.';
  }
  return null;
}

export function propertyDocumentObjectPath(
  dealerId: string,
  propertyId: string,
  objectId: string,
  mimeType: string,
): string {
  const safe = (value: string) => {
    const clean = value.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(clean)) throw new Error('Invalid property document path component');
    return clean;
  };
  const ext = mimeType === 'application/pdf' ? 'pdf'
    : mimeType === 'image/png' ? 'png'
      : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return `dealers/${safe(dealerId)}/properties/${safe(propertyId)}/documents/${safe(objectId)}.${ext}`;
}

export function isPropertyDocumentType(value: string): value is PropertyDocumentType {
  return ['registry', 'allotment-letter', 'possession-letter', 'rera-certificate',
    'gmada-approval', 'site-plan', 'other'].includes(value);
}
