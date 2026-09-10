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

/* Dealer Home follows the approved design (Dealer Dashboard.dc.html lines
   341–478): a demand screen built from the dealer's own presentation opens
   and the private links they sent. This supersedes the operation-first Home
   that briefly replaced it. */
/* src/apps/dealer/pages/* was consolidated into one dealer screen module
   plus its repository-backed stores. The invariants below survive that move
   and are re-pointed at the files that hold them now. The assertions that
   did NOT survive were exact copy strings from the retired page markup
   ('Show the map', 'Opened while presenting', 'On presentation', ...): the
   approved design replaced that markup outright, so rewriting them against
   the current text would assert nothing that was ever agreed. They are
   dropped rather than rephrased. */
const DEALER_SOURCES = [
  'src/apps/dealer/logic.ts', 'src/apps/dealer/template.ts',
  'src/apps/dealer/desk-store.ts', 'src/apps/dealer/desk-links.ts',
  'src/apps/dealer/desk-deals.ts',
];
const dealerSource = (): string =>
  DEALER_SOURCES.map((f) => source(f)).join(String.fromCharCode(10));

describe('approved Dealer Home boundary', () => {
  const home = dealerSource();

  it('uses the active adapter and only factual dealer records', () => {
    expect(home).toMatch(/packages\/data\/adapter['"]/);
    expect(home).not.toMatch(/mock-adapter/);
    expect(home).toContain('adapter.properties.list(');
    expect(home).toContain('adapter.clientLinks.list(');
    expect(home).toContain('adapter.customers.list(');
    expect(home).toContain('adapter.demandSignals.get(');
  });

  it('reads every deal from the repository rather than a seeded array', () => {
    expect(home).toContain('loadDeskDeals()');
    expect(home).toContain('adapter.deals.workspace(');
  });


  it('never invents demand it cannot source', () => {
    // No fixture arrays, no seeded interest map — every figure is derived.
    // An empty `INTEREST = {}` is fine: loadDashboard fills it from
    // adapter.demandSignals. What must never appear is a seeded entry.
    expect(home).not.toMatch(/INTEREST\s*[:=]\s*\{\s*['"\w]/);
    expect(home).not.toMatch(/const\s+(PROPERTIES|CLIENTS|DEALS)\s*[:=]/);
  });
});

describe('truthful My Plots product handoffs and mutations', () => {
  const properties = dealerSource();

  it('uses the shared active adapter, including awaited persistence', () => {
    expect(properties).toMatch(/packages\/data\/adapter['"]/);
    expect(properties).not.toMatch(/mock-adapter/);
    expect(properties).toContain('await deskStore.saveProperty(');
    expect(properties).toContain('await adapter.properties.remove(');
  });

  it('routes completed sales through the atomic record-sale flow', () => {
    expect(properties).toContain('adapter.deals.record(');
    // The property is marked sold inside that one transaction, never by the UI.
    expect(properties).not.toMatch(/sold:\s*true/);
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

  it('shares an exact private-link pin only from stored geometry', () => {
    // The guard now accepts a stored map placement OR a real WGS84
    // coordinate, which is stricter than the earlier copy-only check:
    // precision can never come from the toggle alone.
    expect(modals).toContain('?.mapPlacement');
    expect(modals).toContain('isClientCoordinate(');
    expect(modals).not.toContain("this.locationPrecise ? 'exact' : 'area'");
  });
});
