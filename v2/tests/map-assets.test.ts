import { describe, expect, it } from 'vitest';
import { mapAssetStoragePath, resolveMapAssetUrl } from '../src/packages/data/map-assets';

describe('map asset request normalization', () => {
  it('extracts canonical paths from authenticated, signed, and raw map objects', () => {
    expect(mapAssetStoragePath('https://project.supabase.co/storage/v1/object/authenticated/maps/dealer/master.png'))
      .toBe('dealer/master.png');
    expect(mapAssetStoragePath('/storage/v1/object/sign/maps/dealer/sector.png?token=temporary'))
      .toBe('dealer/sector.png');
    expect(mapAssetStoragePath('maps/dealer/three-d.webp')).toBe('dealer/three-d.webp');
    expect(mapAssetStoragePath('dealer/overlay.svg')).toBe('dealer/overlay.svg');
  });

  it('converts authenticated objects to public bucket URLs without persisting a signed URL', () => {
    const resolved = resolveMapAssetUrl(
      'https://project.supabase.co/storage/v1/object/authenticated/maps/dealer/master.png',
      (path) => `https://project.supabase.co/storage/v1/object/public/maps/${path}`,
    );
    expect(resolved).toBe('https://project.supabase.co/storage/v1/object/public/maps/dealer/master.png');
    expect(resolved).not.toContain('/authenticated/');
    expect(resolved).not.toContain('token=');
  });

  it('leaves bundled and unrelated external assets untouched', () => {
    expect(resolveMapAssetUrl('/maps-pilot/mohali-masterplan.png', () => 'wrong'))
      .toBe('/maps-pilot/mohali-masterplan.png');
    expect(resolveMapAssetUrl('https://cdn.example.com/map.png', () => 'wrong'))
      .toBe('https://cdn.example.com/map.png');
  });
});
