import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/adapter';
import { allProperties, locationSource } from '../src/apps/earth/config';

const presentationSource = readFileSync(new URL('../src/apps/presentation/main.ts', import.meta.url), 'utf8');
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

  it('uses dynamic property filters, real media, and adapter-resolved ID deep links', () => {
    expect(presentationSource).toContain('data-act="property-city"');
    expect(presentationSource).toContain('requestedPropertyId(window.location.search)');
    expect(presentationSource).toContain('adapter.presentation.getProperty(requestedProperty');
    expect(presentationSource).toContain('adapter.presentation.listProperties(');
    expect(presentationSource).not.toContain('adapter.properties.list(');
    expect(presentationSource).not.toContain('adapter.properties.get(');
    expect(presentationSource).toContain('productRoutes.earth(property.id)');
    expect(presentationSource).toContain('No property photo');
    expect(presentationSource).not.toContain('PROPERTY_NAMES');
    expect(presentationSource).not.toContain('CAPTIONS');
    expect(presentationSource).not.toContain('SECTORS');
    expect(presentationSource).not.toContain('property.location ?? property.loc');
    expect(presentationSource).not.toContain('propertyLocationPoint');
  });

  it('never appends fixtures, fabricates media, or auto-writes demo coordinates', () => {
    expect(earthConfigSource).toContain('return canonicalRecords.map(earthProperty)');
    expect(earthConfigSource).not.toContain('fallbackPhotos');
    expect(earthConfigSource).not.toContain('Mock inventory');
    expect(earthConfigSource).not.toContain('migrateDeterministicLegacyLocations');
    expect(earthConfigSource).not.toContain('source: \'migrated\'');
    expect(earthSource).toContain('locationSource.resolve(requestedProperty)');
    expect(earthSource).toContain('productRoutes.properties(p.id)');
    expect(earthSource).toContain('productRoutes.presentation(p.id)');
    expect(earthSource).toContain('navigator.clipboard.writeText');
    expect(earthSource).not.toContain('createPropertyAt');
  });
});
