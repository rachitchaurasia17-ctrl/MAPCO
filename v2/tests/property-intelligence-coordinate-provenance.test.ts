/*
 * Where the coordinate in a Property Intelligence request comes from.
 *
 * It must be the exact WGS84 point the dealer confirmed on the satellite map
 * and nothing else — not the city centre, not the sector centre, not a text
 * address, not `mapPlacement` (which is a pin on a raster sector sheet, not a
 * place on earth), and not a default. If there is no confirmed point the
 * dealer is told to set one; nothing is substituted.
 *
 * These tests follow that point all the way into the provider requests.
 */
import { describe, expect, it } from 'vitest';
import {
  runPropertyIntelligence, type PipelineDeps, type PipelineInput,
} from '../src/packages/property-intelligence';
import { toCanonicalProperty } from '../src/apps/dealer/desk-store';
import {
  FakeModel, FakePlaces, FakeRoutes, FakeStore, phase1Text, phase2Json,
} from './helpers/pi-fakes';

/** A real rooftop in Sector 91, Mohali — six decimals, as it is stored. */
const CONFIRMED = { latitude: 30.704649, longitude: 76.717873 };

const PHASE2 = phase2Json(
  [{ category: 'Daily Needs & Groceries', ids: ['L001'] }],
  [{ id: 'C001', category: 'Major Retail & Lifestyle' }],
);

function harness() {
  const model = new FakeModel([phase1Text(), PHASE2]);
  const routes = new FakeRoutes();
  const deps: PipelineDeps = {
    model, places: new FakePlaces(), routes, store: new FakeStore(),
    now: () => '2026-09-12T00:00:00.000Z',
  } as unknown as PipelineDeps;
  return { model, routes, deps };
}

const input = (point: { latitude: number; longitude: number }): PipelineInput => ({
  dealerId: 'dealer-1', propertyId: 'prop-1', point,
  locality: 'Sector 91', city: 'Mohali', propertySector: 'Sector 91',
});

describe('the coordinate that reaches the providers', () => {
  it('is the one the dealer confirmed, to the digit', async () => {
    const { model, routes, deps } = harness();

    await runPropertyIntelligence(input(CONFIRMED), deps);

    // The model is grounded at the property, not near it.
    expect(model.groundingPoints[0]).toEqual(CONFIRMED);
    // And every route is measured from the property, not from the locality.
    expect(routes.calls.length).toBeGreaterThan(0);
    for (const call of routes.calls) expect(call.origin).toEqual(CONFIRMED);
  });

  it('names the property own coordinate in the prompt it sends', async () => {
    const { model, deps } = harness();
    await runPropertyIntelligence(input(CONFIRMED), deps);

    const phase1 = model.prompts[0];
    expect(phase1).toContain(String(CONFIRMED.latitude));
    expect(phase1).toContain(String(CONFIRMED.longitude));
  });

  it('carries a moved pin through instead of a remembered one', async () => {
    const moved = { latitude: 30.712345, longitude: 76.723456 };
    const { model, routes, deps } = harness();

    await runPropertyIntelligence(input(moved), deps);

    expect(model.groundingPoints[0]).toEqual(moved);
    for (const call of routes.calls) expect(call.origin).toEqual(moved);
  });
});

describe('what the dealer confirmed is what gets stored', () => {
  const form = (over: Record<string, unknown> = {}) => ({
    type: 'Residential Plot', city: 'Mohali', area: 'Sector 91', sector: '91',
    size: '250', unit: 'sq yd', facing: 'East', corner: true,
    ...over,
  });

  it('stores the satellite pin as the property location', () => {
    const saved = toCanonicalProperty(
      form({ earth: true, lat: CONFIRMED.latitude, lng: CONFIRMED.longitude }) as never,
      undefined, 'p1');

    expect(saved.location).toMatchObject({ ...CONFIRMED, source: 'dealer-selected' });
  });

  it('does not turn a sector-sheet placement into a place on earth', () => {
    /* A pin on a raster master-plan image is a position in a picture. An
       earlier build interpolated those percentages into a hardcoded lat/lng
       box, which produced plausible and wrong coordinates for every property. */
    const saved = toCanonicalProperty(
      form({ earth: false, sectorMapId: 'map-1', sectorPinX: 42, sectorPinY: 61 }) as never,
      undefined, 'p1');

    expect(saved.location).toBeUndefined();
    expect(saved.mapPlacement).toBeDefined();
  });

  it('leaves a property with no confirmed pin with no location at all', () => {
    const saved = toCanonicalProperty(form({ earth: false }) as never, undefined, 'p1');
    // Property Intelligence answers 'location_not_set' for this, and the
    // dealer is asked to place the pin. Nothing is guessed from the city.
    expect(saved.location).toBeUndefined();
  });
});
