import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import { CLIENTS } from '../src/packages/data/mock-adapter';
import {
  DeskStore, toDeskProperty, toCanonicalProperty, missingForOnSale,
} from '../src/apps/dealer/desk-store';
import type { Property } from '../src/packages/data/types';

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const baseForm = {
  city: 'Mohali', area: 'Test Enclave', type: 'Residential Plot',
  size: '300', unit: 'sq yd', facing: 'East', price: '0.85',
  corner: true, frontage: '30', depth: '75', openSides: 'Two side',
};

describe('Desk ↔ canonical property round trip', () => {
  it('flattens type-specific specs onto the record the Desk reads', () => {
    const canonical = {
      id: 'p1', type: 'Flat', want: 'Flat', city: 'Mohali', area: 'A', loc: 'A, Mohali',
      sector: '66', size: '1650 sq ft', facing: 'East', position: 'Inside',
      approvals: [], landmarks: [], price: 8500000, photos: ['a.jpg'],
      published: true, sold: false, lifecycle: 'on-sale', views: 3,
      specs: { beds: '3', baths: '2', floor: 'Second' },
    } as unknown as Property;
    const desk = toDeskProperty(canonical);
    // logic.ts reads pr.beds directly, not pr.specs.beds.
    expect(desk.beds).toBe('3');
    expect(desk.baths).toBe('2');
    expect(desk.status).toBe('available');
    expect(desk.photoCount).toBe(1);
    expect(desk.published).toBe(true);
  });

  it('maps every lifecycle onto the Desk status vocabulary', () => {
    const at = (lifecycle: string) => toDeskProperty({
      id: 'x', type: 'Flat', want: 'Flat', city: '', area: '', loc: '', sector: '',
      size: '', facing: 'East', position: '', approvals: [], landmarks: [], price: 0,
      photos: [], published: false, sold: false, views: 0, lifecycle,
    } as unknown as Property);
    expect(at('draft')).toMatchObject({ status: 'available', draft: true, published: false });
    expect(at('on-sale')).toMatchObject({ status: 'available', draft: false, published: true });
    expect(at('sold')).toMatchObject({ status: 'sold' });
    expect(at('archived')).toMatchObject({ status: 'onhold' });
  });

  it('reports Earth confirmation only from a canonical coordinate', () => {
    const without = toDeskProperty({ id: 'a', photos: [] } as unknown as Property);
    expect(without.earth).toBe(false);
    const with_ = toDeskProperty({
      id: 'b', photos: [], location: { latitude: 30.7, longitude: 76.7 },
    } as unknown as Property);
    expect(with_.earth).toBe(true);
  });

  it('lifts the flat form back into type-scoped specs', () => {
    const canonical = toCanonicalProperty(baseForm, undefined, 'p2');
    expect(canonical.specs).toMatchObject({ corner: true, frontage: '30', depth: '75' });
    expect(canonical.size).toBe('300 sq yd');
    expect(canonical.price).toBe(8500000);
    expect(canonical.loc).toBe('Test Enclave, Mohali');
    expect(canonical.want).toBe('Plot');
  });

  it('drops spec keys that do not belong to the chosen type', () => {
    const asPlot = toCanonicalProperty(
      { ...baseForm, type: 'Residential Plot', beds: '3', baths: '2' }, undefined, 'p3');
    expect(asPlot.specs).not.toHaveProperty('beds');
    expect(asPlot.specs).toHaveProperty('frontage');
  });

  it('derives a position from the plot advantage flags', () => {
    expect(toCanonicalProperty({ ...baseForm, corner: true }, undefined, 'p4').position).toBe('Corner plot');
    expect(toCanonicalProperty({ ...baseForm, corner: false, parkFacing: true }, undefined, 'p5').position)
      .toBe('Park facing');
    expect(toCanonicalProperty({ ...baseForm, corner: false }, undefined, 'p6').position).toBe('Inside');
  });

  it('names exactly what is missing before a property may go On Sale', () => {
    expect(missingForOnSale(toCanonicalProperty(baseForm, undefined, 'p7'))).toEqual([]);
    const bare = toCanonicalProperty({ type: 'Flat' }, undefined, 'p8');
    expect(missingForOnSale(bare)).toEqual(expect.arrayContaining(['city', 'area', 'size']));
  });

  it('assigns commercial types no facing rather than a fake one', () => {
    const sco = toCanonicalProperty({ ...baseForm, type: 'Commercial SCO' }, undefined, 'p9');
    expect(sco.facing).toBe('—');
    expect(sco.want).toBe('Commercial');
  });
});

describe('property store', () => {
  it('loads canonical inventory and keeps the array reference', async () => {
    const store = new DeskStore();
    const reference = store.properties;
    await store.loadSellers();
    await store.loadProperties();
    expect(store.propertiesStatus.state).toBe('ready');
    expect(store.properties).toBe(reference);
    expect(store.properties.length).toBeGreaterThan(0);
  });

  it('attaches the seller relationship without a query per property', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    await store.loadProperties();
    const withSeller = store.properties.find((p) => p.ps);
    expect(withSeller, 'inventory should carry its seller relationship').toBeTruthy();
    expect(withSeller!.ps).toMatchObject({ sellerId: expect.any(String) });
  });

  it('saves a new property and survives a reload of the store', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    await store.loadProperties();
    const id = uniq('desk-prop');
    const result = await store.saveProperty({ ...baseForm, area: 'Persisted Enclave' }, { id });
    expect(result.error).toBeUndefined();
    expect(result.property?.id).toBe(id);

    const fresh = new DeskStore();
    await fresh.loadSellers();
    await fresh.loadProperties();
    const found = fresh.properties.find((p) => p.id === id);
    expect(found, 'property should still be there after a fresh load').toBeTruthy();
    expect(found!.area).toBe('Persisted Enclave');
    expect(found!.frontage).toBe('30');

    await adapter.properties.remove(id);
  });

  it('keeps an incomplete property as a Draft and says what is missing', async () => {
    const store = new DeskStore();
    await store.loadProperties();
    const id = uniq('desk-draft');
    const result = await store.saveProperty(
      { city: 'Mohali', area: 'Incomplete', type: 'Flat' },
      { id, lifecycle: 'on-sale' },
    );
    expect(result.error).toBeUndefined();
    expect(result.property?.lifecycle).toBe('draft');
    expect(result.missing).toEqual(expect.arrayContaining(['size']));
    await adapter.properties.remove(id);
  });

  it('takes a property off the market and puts it back without losing anything', async () => {
    const store = new DeskStore();
    await store.loadProperties();
    const id = uniq('desk-archive');
    await store.saveProperty({ ...baseForm, area: 'Archive Test' }, { id });

    expect(await store.archiveProperty(id)).toBe(true);
    expect(store.properties.find((p) => p.id === id)!.status).toBe('onhold');

    expect(await store.restoreProperty(id)).toBe(true);
    const back = store.properties.find((p) => p.id === id)!;
    expect(back.status).toBe('available');
    expect(back.published).toBe(true);
    // Specifications survived the round trip.
    expect(back.frontage).toBe('30');

    await adapter.properties.remove(id);
  });

  it('marks a property sold through the one atomic command', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    await store.loadProperties();
    const id = uniq('desk-sold');
    await store.saveProperty({ ...baseForm, area: 'Sold Test' }, { id });
    const buyerId = CLIENTS[0]!.id;

    expect(await store.markSold({
      propertyId: id, soldPrice: 8600000, saleDate: '2026-08-26', buyerId,
    })).toBe(true);

    const sold = store.properties.find((p) => p.id === id)!;
    expect(sold.status).toBe('sold');
    expect(sold.published).toBe(false);

    // The buyer's purchase history moved with it.
    const buyer = await adapter.customers.get(buyerId);
    expect(buyer.ok && buyer.value.purchased?.includes(id)).toBe(true);
  });

  it('refuses to delete nothing and reports a truthful error', async () => {
    const store = new DeskStore();
    await store.loadProperties();
    expect(await store.deleteProperty('does-not-exist')).toBe(false);
    expect(store.lastWriteError).toBeTruthy();
  });

  it('surfaces a real error instead of an empty inventory when loading fails', async () => {
    const store = new DeskStore();
    const original = adapter.properties.list;
    (adapter.properties as { list: unknown }).list = async () =>
      ({ ok: false, error: { code: 'network', message: 'boom', retryable: true } });
    await store.loadProperties();
    expect(store.propertiesStatus.state).toBe('error');
    expect(store.propertiesStatus.error).toMatch(/could not reach/i);
    expect(store.properties).toHaveLength(0);
    (adapter.properties as { list: unknown }).list = original;
  });
});
