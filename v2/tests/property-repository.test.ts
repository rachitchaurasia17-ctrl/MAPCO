import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import type { Property } from '../src/packages/data/types';

const property = (id: string): Property => ({
  id,
  type: 'Residential Plot',
  want: 'Plot',
  city: 'Mohali',
  area: 'Removal test',
  loc: 'Removal test, Mohali',
  sector: 'Removal test',
  size: '100 sq yd',
  facing: 'East',
  position: 'Inside plot',
  approvals: [],
  landmarks: [],
  price: 1,
  photos: [],
  published: false,
  sold: false,
  views: 0,
});

describe('property repository lifecycle', () => {
  it('removes a property through the repository instead of hiding it in one page', async () => {
    const id = `remove-${Date.now()}`;
    expect((await adapter.properties.save(property(id))).ok).toBe(true);
    expect((await adapter.properties.get(id)).ok).toBe(true);

    const removed = await adapter.properties.remove(id);
    expect(removed.ok).toBe(true);
    const missing = await adapter.properties.get(id);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('not_found');
  });
});
