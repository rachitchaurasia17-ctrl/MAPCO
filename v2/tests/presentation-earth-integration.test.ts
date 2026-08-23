import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/adapter';
import { allProperties, locationSource } from '../src/apps/earth/config';
import { productRoutes } from '../src/packages/ui/product-routes';

const earthSource = readFileSync(new URL('../src/apps/earth/main.ts', import.meta.url), 'utf8');
const earthConfigSource = readFileSync(new URL('../src/apps/earth/config.ts', import.meta.url), 'utf8');

describe('Presentation and MAPCO Earth product handoff', () => {
  it('keeps runtime Earth inventory equal to the active adapter inventory', async () => {
    const expected: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await adapter.properties.list({ limit: 50, ...(cursor ? { cursor } : {}) });
      expect(page.ok).toBe(true);
      if (!page.ok) return;
      expected.push(...page.value.items.map((property) => property.id));
      cursor = page.value.nextCursor ?? undefined;
    } while (cursor);

    await locationSource.load();
    expect(allProperties().map((property) => property.id).sort()).toEqual(expected.sort());
  });

  it('uses Earth as the single property-ID presentation handoff', () => {
    expect(productRoutes.presentation('property-7')).toBe(productRoutes.earth('property-7'));
    expect(earthSource).toContain('requestedPropertyId(window.location.search)');
    expect(earthSource).toContain('locationSource.resolve(requestedProperty)');
    expect(earthSource).toContain('data-prop=');
    expect(earthSource).toContain('openPropertyDetail(property)');
  });

  it('never appends fixtures, fabricates media, or auto-writes demo coordinates', () => {
    expect(earthConfigSource).toContain('return canonicalRecords.map(earthProperty)');
    expect(earthConfigSource).not.toContain('fallbackPhotos');
    expect(earthConfigSource).not.toContain('Mock inventory');
    expect(earthConfigSource).not.toContain('migrateDeterministicLegacyLocations');
    expect(earthConfigSource).not.toContain('source: \'migrated\'');
    expect(earthSource).toContain('locationSource.resolve(requestedProperty)');
    expect(earthSource).toContain('productRoutes.properties(p.id)');
    expect(productRoutes.presentation('property-7')).toBe(productRoutes.earth('property-7'));
    expect(earthSource).toContain('navigator.clipboard.writeText');
    expect(earthSource).not.toContain('createPropertyAt');
  });
});
