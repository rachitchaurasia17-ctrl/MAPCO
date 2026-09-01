import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import { CLIENTS } from '../src/packages/data/mock-adapter';
import { DeskStore, toDeskProperty } from '../src/apps/dealer/desk-store';
import {
  canonicalPropertyLifecycle, isHeldProperty, isUnsoldProperty, propertyLifecycle,
} from '../src/packages/data/property-lifecycle';
import type { Property } from '../src/packages/data/types';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260901000200_property_unsold_lifecycle.sql', import.meta.url),
  'utf8',
);

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** A complete listing, so the record is legally On Sale from the start. */
const baseForm = {
  city: 'Mohali', area: 'Unsold Test Enclave', type: 'Residential Plot',
  size: '300', unit: 'sq yd', facing: 'East', price: '0.85',
  corner: true, frontage: '30', depth: '75', openSides: 'Two side',
  notes: 'Owner wants a quick close', registry: 'REG-99/2026',
};

/** Everything the Unsold state has to carry through, on one record. */
async function seedRichProperty(id: string): Promise<Property> {
  const store = new DeskStore();
  await store.loadProperties();
  const saved = await store.saveProperty(baseForm, { id });
  expect(saved.error).toBeUndefined();
  const enriched = await adapter.properties.save({
    ...saved.property!,
    photos: ['https://cdn.example.test/unsold-a.jpg', 'https://cdn.example.test/unsold-b.jpg'],
    location: { latitude: 30.7031, longitude: 76.7261, source: 'dealer-selected' },
    mapPlacement: { mapId: 'sector-66', x: 0.42, y: 0.61 },
    sectorMapId: 'sector-66',
    masterplanId: 'mohali-master',
    highlights: ['Park Facing', 'GMADA Approved'],
    videos: ['https://cdn.example.test/unsold.mp4'],
  });
  expect(enriched.ok).toBe(true);
  if (!enriched.ok) throw new Error('property seed failed');
  return enriched.value;
}

/** Which of the three Properties segments this record shows up in. */
const segmentsFor = (store: DeskStore, id: string) => ({
  onSale: store.properties.some((p) => p.id === id && p.status !== 'sold'),
  sold: store.properties.some((p) => p.id === id && p.status === 'sold'),
  unsold: store.unsoldProperties.some((p) => p.id === id),
});

describe('Unsold is its own lifecycle, not "everything that is not sold"', () => {
  it('gives removal a canonical state distinct from draft, on-hold and sold', () => {
    const at = (lifecycle: Property['lifecycle']) =>
      propertyLifecycle({ lifecycle, sold: false, published: true });
    expect(at('unsold')).toBe('unsold');
    expect(at('archived')).toBe('archived');
    expect(isUnsoldProperty({ lifecycle: 'unsold', sold: false, published: false })).toBe(true);
    // Off market / On hold is a property the dealer still holds — never Unsold.
    expect(isUnsoldProperty({ lifecycle: 'archived', sold: false, published: false })).toBe(false);
    expect(isHeldProperty({ lifecycle: 'archived', sold: false, published: false })).toBe(true);
    expect(isHeldProperty({ lifecycle: 'unsold', sold: false, published: false })).toBe(false);
    expect(isHeldProperty({ lifecycle: 'sold', sold: true, published: false })).toBe(false);
  });

  it('never lets a removed property look sold, published or client-visible', () => {
    const canonical = canonicalPropertyLifecycle({
      id: 'x', photos: [], published: true, sold: false, lifecycle: 'unsold',
    } as unknown as Property);
    expect(canonical).toMatchObject({ sold: false, published: false, clientVisible: false });
    expect(toDeskProperty(canonical).status).toBe('removed');
  });

  it('leaves an on-hold property in On sale rather than sweeping it into Unsold', async () => {
    const store = new DeskStore();
    await store.loadProperties();
    const id = uniq('unsold-vs-hold');
    await store.saveProperty({ ...baseForm, area: 'Hold Test' }, { id });
    expect(await store.archiveProperty(id)).toBe(true);

    expect(segmentsFor(store, id)).toEqual({ onSale: true, sold: false, unsold: false });
    expect(store.properties.find((p) => p.id === id)!.status).toBe('onhold');

    await adapter.properties.remove(id);
  });
});

describe('removing a property the dealer never sold', () => {
  it('moves it out of On sale, into Unsold, and never into Sold', async () => {
    const id = uniq('unsold-move');
    await seedRichProperty(id);
    const store = new DeskStore();
    await store.loadProperties();

    expect(segmentsFor(store, id)).toEqual({ onSale: true, sold: false, unsold: false });

    expect(await store.deleteProperty(id)).toBe(true);

    expect(segmentsFor(store, id)).toEqual({ onSale: false, sold: false, unsold: true });
    expect(store.unsoldProperties.find((p) => p.id === id)!.status).toBe('removed');

    await adapter.properties.remove(id);
  });

  it('keeps the record whole, so nothing about the property is destroyed', async () => {
    const id = uniq('unsold-preserve');
    const before = await seedRichProperty(id);
    const store = new DeskStore();
    await store.loadProperties();
    expect(await store.deleteProperty(id)).toBe(true);

    const read = await adapter.properties.get(id);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const after = read.value;

    expect(after.lifecycle).toBe('unsold');
    expect(after.price).toBe(before.price);
    expect(after.type).toBe(before.type);
    expect(after.size).toBe(before.size);
    expect(after.loc).toBe(before.loc);
    expect(after.privateNotes).toBe(before.privateNotes);
    expect(after.registryRef).toBe(before.registryRef);
    expect(after.location).toEqual(before.location);
    expect(after.mapPlacement).toEqual(before.mapPlacement);
    expect(after.sectorMapId).toBe(before.sectorMapId);
    expect(after.masterplanId).toBe(before.masterplanId);
    expect(after.photos).toEqual(before.photos);
    expect(after.specs).toEqual(before.specs);
    expect(after.highlights).toEqual(before.highlights);
    expect(after.videos).toEqual(before.videos);
    // Removal is stamped, not guessed.
    expect(after.removal?.from).toBe('on-sale');
    expect(Number.isNaN(Date.parse(String(after.removal?.at)))).toBe(false);

    await adapter.properties.remove(id);
  });

  it('survives a reload — Unsold is persisted state, not a screen filter', async () => {
    const id = uniq('unsold-reload');
    await seedRichProperty(id);
    const first = new DeskStore();
    await first.loadProperties();
    expect(await first.deleteProperty(id)).toBe(true);

    const reloaded = new DeskStore();
    await reloaded.loadProperties();
    expect(segmentsFor(reloaded, id)).toEqual({ onSale: false, sold: false, unsold: true });

    await adapter.properties.remove(id);
  });

  it('keeps the seller relationship but stops counting it as a live property', async () => {
    const id = uniq('unsold-seller');
    await seedRichProperty(id);
    const seller = await adapter.sellers.save({
      name: 'Unsold Owner', primaryPhone: `+9198${String(Date.now()).slice(-8)}`, type: 'individual',
    });
    expect(seller.ok).toBe(true);
    if (!seller.ok) return;
    expect((await adapter.sellers.assignToProperty({
      propertyId: id, sellerId: seller.value.id, relationship: 'owner',
      availability: 'available', isPrimary: true,
    })).ok).toBe(true);

    const store = new DeskStore();
    await store.loadProperties();
    expect(await store.deleteProperty(id)).toBe(true);

    // The relationship row is untouched — the property is still this seller's.
    const linked = await adapter.sellers.getForProperty(id);
    expect(linked.ok && linked.value.some((r) => r.seller.id === seller.value.id)).toBe(true);
    // But a removed property is not inventory the dealer can offer.
    const directory = await adapter.sellers.directory(true);
    expect(directory.ok).toBe(true);
    if (directory.ok) {
      const entry = directory.value.find((e) => e.seller.id === seller.value.id)!;
      expect(entry.liveCount).toBe(0);
      expect(entry.soldCount).toBe(0);
      expect(entry.properties.map((p) => p.propertyId)).toContain(id);
    }

    await adapter.properties.remove(id);
  });

  it('refuses to remove a sold property, whose deal and buyer history reference it', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    await store.loadProperties();
    const id = uniq('unsold-sold-guard');
    await store.saveProperty({ ...baseForm, area: 'Sold Guard' }, { id });
    expect(await store.markSold({
      propertyId: id, soldPrice: 8600000, saleDate: '2026-08-26', buyerId: CLIENTS[0]!.id,
    })).toBe(true);

    expect(await store.deleteProperty(id)).toBe(false);
    expect(store.lastWriteError).toMatch(/sold/i);
    expect(segmentsFor(store, id)).toEqual({ onSale: false, sold: true, unsold: false });
  });

  it('reports a truthful error instead of removing something that is not there', async () => {
    const store = new DeskStore();
    await store.loadProperties();
    expect(await store.deleteProperty('does-not-exist')).toBe(false);
    expect(store.lastWriteError).toBeTruthy();
  });
});

describe('restoring an Unsold property', () => {
  it('puts the same record back On sale without creating a duplicate', async () => {
    const id = uniq('unsold-restore');
    const before = await seedRichProperty(id);
    const store = new DeskStore();
    await store.loadProperties();
    const totalBefore = store.properties.length + store.unsoldProperties.length;

    expect(await store.deleteProperty(id)).toBe(true);
    expect(await store.restoreUnsoldProperty(id)).toBe(true);

    expect(segmentsFor(store, id)).toEqual({ onSale: true, sold: false, unsold: false });
    const back = store.properties.find((p) => p.id === id)!;
    expect(back.status).toBe('available');
    expect(back.published).toBe(true);
    // One record in, one record out — Restore is a state change.
    expect(store.properties.filter((p) => p.id === id)).toHaveLength(1);
    expect(store.properties.length + store.unsoldProperties.length).toBe(totalBefore);

    const read = await adapter.properties.get(id);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.lifecycle).toBe('on-sale');
    expect(read.value.removal).toBeUndefined();
    expect(read.value.price).toBe(before.price);
    expect(read.value.location).toEqual(before.location);
    expect(read.value.mapPlacement).toEqual(before.mapPlacement);
    expect(read.value.photos).toEqual(before.photos);
    expect(read.value.specs).toEqual(before.specs);
    expect(read.value.privateNotes).toBe(before.privateNotes);

    await adapter.properties.remove(id);
  });

  it('persists the restored state across a reload', async () => {
    const id = uniq('unsold-restore-reload');
    await seedRichProperty(id);
    const first = new DeskStore();
    await first.loadProperties();
    expect(await first.deleteProperty(id)).toBe(true);
    expect(await first.restoreUnsoldProperty(id)).toBe(true);

    const reloaded = new DeskStore();
    await reloaded.loadProperties();
    expect(segmentsFor(reloaded, id)).toEqual({ onSale: true, sold: false, unsold: false });

    await adapter.properties.remove(id);
  });

  it('brings an incomplete record back as a Draft rather than refusing it', async () => {
    const store = new DeskStore();
    await store.loadProperties();
    const id = uniq('unsold-restore-draft');
    const draft = await store.saveProperty({ city: 'Mohali', area: 'Half filled', type: 'Flat' }, { id });
    expect(draft.property?.lifecycle).toBe('draft');

    expect(await store.deleteProperty(id)).toBe(true);
    expect(store.unsoldProperties.find((p) => p.id === id)!.removedFrom).toBe('draft');

    expect(await store.restoreUnsoldProperty(id)).toBe(true);
    const back = store.properties.find((p) => p.id === id)!;
    expect(back.status).toBe('available');
    expect(back.draft).toBe(true);
    // A draft is still on the dealer's list, so On sale shows it again.
    expect(segmentsFor(store, id)).toEqual({ onSale: true, sold: false, unsold: false });

    await adapter.properties.remove(id);
  });
});

describe('existing Sold behaviour is untouched', () => {
  it('still records a sale atomically and keeps it out of Unsold', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    await store.loadProperties();
    const id = uniq('unsold-sold-regression');
    await store.saveProperty({ ...baseForm, area: 'Sold Regression' }, { id });
    const buyerId = CLIENTS[0]!.id;

    expect(await store.markSold({
      propertyId: id, soldPrice: 8600000, saleDate: '2026-08-26', buyerId,
    })).toBe(true);

    const sold = store.properties.find((p) => p.id === id)!;
    expect(sold.status).toBe('sold');
    expect(sold.published).toBe(false);
    expect(store.unsoldProperties.some((p) => p.id === id)).toBe(false);

    const buyer = await adapter.customers.get(buyerId);
    expect(buyer.ok && buyer.value.purchased?.includes(id)).toBe(true);
  });
});

describe('the database accepts the new state without widening anything else', () => {
  it('adds unsold to the lifecycle constraint and keeps it out of client-facing rows', () => {
    expect(migration).toContain("payload->>'lifecycle' in ('draft','on-sale','sold','archived','unsold')");
    expect(migration).toContain('crm_records_unsold_not_client_facing');
    // A seller's live count is the inventory still on the books.
    expect(migration).toContain("coalesce(r.payload->>'lifecycle','') not in ('sold','unsold')");
    // Removal is a lifecycle change, never a tombstone.
    expect(migration).not.toMatch(/delete\s+from\s+public\.crm_records/i);
  });
});
