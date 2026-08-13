import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Property } from '../src/packages/data/types';
import {
  propertyOperationalState,
} from '../src/apps/dealer/property-operational-state';

const root = resolve(__dirname, '..');
const source = (path: string): string => readFileSync(join(root, path), 'utf8');

const property = (overrides: Partial<Property> = {}): Property => ({
  id: 'property-1',
  type: 'Residential Plot',
  want: 'Plot',
  city: 'Mohali',
  area: 'Sector 79 plot',
  loc: 'Sector 79',
  sector: 'Sector 79',
  size: '300 sq yd',
  facing: 'North-East',
  position: 'Inside',
  approvals: [],
  landmarks: [],
  price: 25_000_000,
  photos: ['https://example.test/property.jpg'],
  published: true,
  sold: false,
  views: 0,
  mapPlacement: { mapId: 'sector-79', x: 0.4, y: 0.6 },
  location: { latitude: 30.6891, longitude: 76.6905, source: 'dealer-selected' },
  ...overrides,
});

describe('dealer property operational readiness', () => {
  it('marks a property ready only from its real persisted presentation and Earth state', () => {
    const state = propertyOperationalState(property());
    expect(state.readyToShow).toBe(true);
    expect(state.attentionReasons).toEqual([]);
    expect(state.photoCount).toBe(1);
  });

  it('reports each incomplete setup item without inventing engagement', () => {
    const state = propertyOperationalState(property({
      photos: [],
      published: false,
      mapPlacement: undefined,
      location: undefined,
    }));
    expect(state.readyToShow).toBe(false);
    expect(state.attentionReasons).toEqual([
      'photo', 'published', 'map-placement', 'earth-location',
    ]);
  });

  it('keeps presentation-map placement and canonical Earth location independent', () => {
    const mapOnly = propertyOperationalState(property({ location: undefined }));
    expect(mapOnly.hasMapPlacement).toBe(true);
    expect(mapOnly.hasEarthLocation).toBe(false);

    const earthOnly = propertyOperationalState(property({ mapPlacement: undefined }));
    expect(earthOnly.hasMapPlacement).toBe(false);
    expect(earthOnly.hasEarthLocation).toBe(true);
  });

  it('counts canonical private photo refs when display URLs are temporarily unavailable', () => {
    const state = propertyOperationalState(property({
      photos: [],
      photoStorage: [{ kind: 'storage', id: 'cover', path: 'dealer/property/cover.jpg' }],
    }));
    expect(state.photoCount).toBe(1);
    expect(state.hasDisplayPhoto).toBe(false);
    expect(state.attentionReasons).not.toContain('photo');
  });
});

describe('operation-first Dealer Home boundary', () => {
  const home = source('src/apps/dealer/pages/home.ts');

  it('uses the active adapter and only factual dealer records', () => {
    expect(home).toMatch(/packages\/data\/adapter['"]/);
    expect(home).not.toMatch(/mock-adapter/);
    expect(home).toContain('adapter.properties.list(');
    expect(home).toContain('adapter.clientLinks.list(');
    expect(home).not.toContain('adapter.demandSignals');
  });

  it('centres the approved dealer operations', () => {
    for (const label of [
      'Start Client Presentation', 'Open MAPCO Earth', 'Add Property',
      'My Stock', 'Ready to Show', 'Needs Attention',
    ]) expect(home).toContain(label);
  });

  it('does not render the superseded buyer-analytics dashboard', () => {
    for (const pattern of [
      /Hottest area/i, /Buyer interests/i, /Where buyers look/i,
      /pulling the most attention/i, /\bHOT\b/,
    ]) expect(home).not.toMatch(pattern);
  });
});

describe('truthful My Plots product handoffs and mutations', () => {
  const properties = source('src/apps/dealer/pages/properties.ts');

  it('uses the shared active adapter, including awaited persistence', () => {
    expect(properties).toMatch(/packages\/data\/adapter['"]/);
    expect(properties).not.toMatch(/mock-adapter/);
    expect(properties).toContain('await adapter.properties.save(updated)');
    expect(properties).toContain('await adapter.properties.remove(property.id)');
  });

  it('hands the property ID to Earth, Presentation and Private Links', () => {
    expect(properties).toContain('productRoutes.earth(property.id)');
    expect(properties).toContain('productRoutes.presentation(property.id)');
    expect(properties).toContain('productRoutes.privateLink(property.id)');
    expect(properties).not.toMatch(/(?:lat|lng|latitude|longitude)\s*=/i);
  });

  it('routes completed sales through the atomic record-sale flow', () => {
    expect(properties).toContain('productRoutes.recordSale(property.id)');
    expect(properties).not.toMatch(/sold:\s*true/);
  });

  it('shows distinct real presentation, photo, Earth and private-link state', () => {
    for (const label of [
      'On presentation', 'Map placement missing', 'Located in Earth',
      'Earth location missing', 'active ${shares === 1 ? \'link\' : \'links\'}',
    ]) expect(properties).toContain(label);
  });
});

describe('truthful shared creation flows', () => {
  const modals = source('src/packages/ui/shared-modals.ts');

  it('starts property and customer records empty instead of persisting demo defaults', () => {
    for (const invented of [
      'Eco City plot', 'RERA + GMADA approved', '/assets/ph-plot-1.png',
      "seen: 'just now'", 'isNew: true', "phone: f.phone || '—'",
    ]) expect(modals).not.toContain(invented);
    expect(modals).toContain("city: \"\"");
    expect(modals).toContain("want: '' as WantType | ''");
    expect(modals).toContain('private basicsError()');
  });

  it('shares an exact private-link pin only from stored map placement', () => {
    expect(modals).toContain('Every selected property needs a stored map placement');
    expect(modals).toContain('?.mapPlacement');
    expect(modals).not.toContain("this.locationPrecise ? 'exact' : 'area'");
  });
});
