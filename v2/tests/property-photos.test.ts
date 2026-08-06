import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import type { Property } from '../src/packages/data/types';
import {
  PROPERTY_PHOTO_MAX_BYTES,
  normalizePropertyPhotoStorage,
  persistentPropertyPayload,
  propertyPhotoObjectPath,
  propertyPhotoSelections,
  validatePropertyPhoto,
} from '../src/packages/data/property-photos';

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-photo-test', type: 'Residential Plot', want: 'Plot', city: 'Mohali',
    area: 'Sector 90', loc: 'Sector 90, Mohali', sector: '90', size: '300 sq yd',
    facing: 'East', position: 'Corner plot', approvals: [], landmarks: [], price: 1,
    photos: [], published: false, sold: false, views: 0, ...overrides,
  };
}

describe('private property photo references', () => {
  it('builds the exact dealer/property-scoped private object path', () => {
    expect(propertyPhotoObjectPath('dealer-1', 'prop-1', 'photo-1', 'image/webp'))
      .toBe('dealers/dealer-1/properties/prop-1/photo-1.webp');
    expect(() => propertyPhotoObjectPath('../dealer', 'prop-1', 'photo-1', 'image/jpeg')).toThrow();
  });

  it('accepts only bucket-supported images within the 5 MB limit', () => {
    expect(validatePropertyPhoto({ type: 'image/jpeg', size: 1024 })).toBeNull();
    expect(validatePropertyPhoto({ type: 'image/gif', size: 1024 })).toMatch(/JPG/);
    expect(validatePropertyPhoto({ type: 'image/png', size: PROPERTY_PHOTO_MAX_BYTES + 1 })).toMatch(/5 MB/);
  });

  it('never persists blob, data, authenticated, or signed Storage URLs', () => {
    const canonical = persistentPropertyPayload(property({
      photos: [
        'blob:http://localhost/temporary',
        'data:image/png;base64,temporary',
        'https://project.supabase.co/storage/v1/object/sign/property-photos/a.jpg?token=secret',
        'https://cdn.example/property.jpg',
        '/assets/legacy-property.jpg',
      ],
      photoStorage: [{ kind: 'storage', id: 'cover', path: 'dealers/dealer-1/properties/prop-photo-test/cover.jpg' }],
    }));
    expect(canonical.photos).toEqual(['https://cdn.example/property.jpg', '/assets/legacy-property.jpg']);
    expect(canonical.photoStorage).toEqual([
      { kind: 'storage', id: 'cover', path: 'dealers/dealer-1/properties/prop-photo-test/cover.jpg' },
    ]);
  });

  it('rejects malformed and cross-property canonical refs', () => {
    expect(normalizePropertyPhotoStorage([
      { kind: 'storage', id: 'ok', path: 'dealers/dealer-1/properties/prop-photo-test/ok.jpg' },
      { kind: 'storage', id: 'wrong', path: 'dealers/dealer-1/properties/other/wrong.jpg' },
      { kind: 'storage', id: 'escape', path: 'dealers/dealer-1/properties/prop-photo-test/../escape.jpg' },
    ], 'prop-photo-test')).toHaveLength(1);
  });

  it('creates approved Client Link refs for both external and private photos', () => {
    const refs = propertyPhotoSelections(property({
      photos: [
        'https://cdn.example/external.jpg',
        'https://project.supabase.co/storage/v1/object/sign/property-photos/a.jpg?token=temporary',
      ],
      photoStorage: [
        { kind: 'storage', id: 'cover', path: 'dealers/dealer-1/properties/prop-photo-test/cover.jpg' },
        { kind: 'storage', id: 'gallery', path: 'dealers/dealer-1/properties/prop-photo-test/gallery.webp' },
      ],
    }));
    expect(refs).toEqual(['external:0', 'storage:0', 'storage:1']);
  });

  it('round-trips uploaded canonical refs without storing its temporary preview URL', async () => {
    const draft = property({ id: `prop-photo-${Date.now()}` });
    expect((await adapter.properties.save(draft)).ok).toBe(true);
    const file = new File([new Uint8Array([1, 2, 3])], 'cover.jpg', { type: 'image/jpeg' });
    const upload = await adapter.media.uploadPropertyPhoto(draft.id, file);
    expect(upload.ok).toBe(true);
    if (!upload.ok) return;
    const saved = await adapter.properties.save({ ...draft, photoStorage: [upload.value] });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.photoStorage?.[0]?.path).toBe(upload.value.path);
    expect(saved.value.photos[0]).toMatch(/^blob:/);

    const canonical = persistentPropertyPayload(saved.value);
    expect(canonical.photos).toEqual([]);
    expect(JSON.stringify(canonical)).not.toContain('blob:');
    expect((await adapter.media.removePropertyPhotos([upload.value.path])).ok).toBe(true);
  });
});
