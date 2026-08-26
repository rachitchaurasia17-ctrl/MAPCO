import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import type { Property } from '../src/packages/data/types';
import {
  DeskStore,
  toCanonicalSellerType, toDeskSellerKind,
  toCanonicalRelationship, toDeskRelation,
  toCanonicalAvailability, confirmedLabel,
} from '../src/apps/dealer/desk-store';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260826000200_desk_seller_completion.sql', import.meta.url),
  'utf8',
);

function property(id: string, overrides: Partial<Property> = {}): Property {
  return {
    id, type: 'Residential Plot', want: 'Plot', city: 'Mohali', area: 'Seller test',
    loc: 'Seller test, Mohali', sector: '93', size: '300 sq yd', facing: 'East',
    position: 'Inside', approvals: [], landmarks: [], price: 8000000, photos: [],
    published: true, sold: false, lifecycle: 'on-sale', views: 0, ...overrides,
  };
}

const uniq = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

describe('Desk ↔ canonical seller vocabulary', () => {
  it('translates seller type in both directions', () => {
    expect(toCanonicalSellerType('Individual')).toBe('individual');
    expect(toCanonicalSellerType('Builder')).toBe('builder');
    expect(toCanonicalSellerType('Broker')).toBe('broker');
    expect(toCanonicalSellerType('Company')).toBe('company');
    expect(toDeskSellerKind('builder')).toBe('Builder');
  });

  it('falls back to a valid enum rather than sending an unknown label', () => {
    // The database CHECK constraint would reject anything else outright.
    expect(toCanonicalSellerType('Something Else')).toBe('individual');
    expect(toCanonicalSellerType(undefined)).toBe('individual');
  });

  it('translates the relationship label the UI shows', () => {
    expect(toCanonicalRelationship('Authorized Seller')).toBe('authorized-seller');
    expect(toCanonicalRelationship('Co-owner')).toBe('co-owner');
    expect(toCanonicalRelationship('Owner')).toBe('owner');
    expect(toDeskRelation('authorized-seller')).toBe('Authorized Seller');
  });

  it('maps the availability tick-box onto the three-state enum', () => {
    expect(toCanonicalAvailability(true)).toBe('available');
    expect(toCanonicalAvailability(false)).toBe('unconfirmed');
    expect(toCanonicalAvailability(undefined)).toBe('unconfirmed');
  });

  it('derives the confirmation label from a real timestamp', () => {
    const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
    expect(confirmedLabel(ago(0))).toBe('Today');
    expect(confirmedLabel(ago(1))).toBe('Yesterday');
    expect(confirmedLabel(ago(3))).toBe('3 days ago');
    expect(confirmedLabel(ago(14))).toBe('2 weeks ago');
    // Never invents a confirmation that did not happen.
    expect(confirmedLabel(undefined)).toBe('');
    expect(confirmedLabel('not-a-date')).toBe('');
  });
});

describe('seller store', () => {
  it('loads the directory with canonical live and sold counts', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    expect(store.sellersStatus.state).toBe('ready');
    expect(store.sellers.length).toBeGreaterThan(0);
    const reusable = store.sellers.find((s) => s.liveCount + s.soldCount > 1);
    expect(reusable, 'a seller should hold more than one property').toBeTruthy();
    expect(reusable!.props.length).toBe(reusable!.liveCount + reusable!.soldCount);
  });

  it('keeps the same array reference so the synchronous renderer stays attached', async () => {
    const store = new DeskStore();
    const reference = store.sellers;
    await store.loadSellers();
    expect(store.sellers).toBe(reference);
  });

  it('creates a seller and reuses the same record on edit', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    const before = store.sellers.length;

    const id = await store.saveSeller({
      name: 'Test Seller', phone: '+91 90000 55501', kind: 'Broker',
      business: 'Test Advisors', city: 'Mohali', note: 'Only evenings.',
    });
    expect(id).toBeTruthy();
    expect(store.sellers.length).toBe(before + 1);
    const created = store.sellers.find((s) => s.id === id)!;
    expect(created).toMatchObject({
      name: 'Test Seller', kind: 'Broker', business: 'Test Advisors', city: 'Mohali',
    });

    // Editing passes the id, so it updates rather than duplicating.
    const same = await store.saveSeller({
      id: id!, name: 'Test Seller Renamed', phone: '+91 90000 55501', kind: 'Broker',
    });
    expect(same).toBe(id);
    expect(store.sellers.length).toBe(before + 1);
    expect(store.sellers.find((s) => s.id === id)!.name).toBe('Test Seller Renamed');

    await store.archiveSeller(id!, true);
  });

  it('finds an existing seller by phone so Add does not create a duplicate', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    const id = await store.saveSeller({ name: 'Phone Dupe', phone: '+91 90000 55502' });
    expect(id).toBeTruthy();

    // Same number, different formatting.
    expect(store.findSellerByPhone('9000055502')?.id).toBe(id);
    expect(store.findSellerByPhone('+91-90000-55502')?.id).toBe(id);
    // Editing that seller must not flag itself as its own duplicate.
    expect(store.findSellerByPhone('+91 90000 55502', id!)).toBeNull();
    // Too short to be a real match.
    expect(store.findSellerByPhone('55502')).toBeNull();

    await store.archiveSeller(id!, true);
  });

  it('reuses one seller across several properties without duplicating the seller', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    const sellerId = (await store.saveSeller({ name: 'Multi Seller', phone: '+91 90000 55503' }))!;

    const a = uniq('prop-a'); const b = uniq('prop-b');
    await adapter.properties.save(property(a, { loc: 'Alpha, Mohali', price: 5000000 }));
    await adapter.properties.save(property(b, { loc: 'Beta, Mohali', price: 6000000 }));

    expect(await store.assignSellerToProperty({
      propertyId: a, sellerId, askPrice: 4900000, relation: 'Owner',
      availConfirmed: true, visitNote: 'Call first.', docs: ['Registry / Sale Deed'],
    })).toBe(true);
    expect(await store.assignSellerToProperty({
      propertyId: b, sellerId, askPrice: 5900000, relation: 'Authorized Seller',
      availConfirmed: false,
    })).toBe(true);

    const listed = store.sellers.filter((s) => s.id === sellerId);
    expect(listed, 'still exactly one seller record').toHaveLength(1);
    expect(listed[0]!.liveCount).toBe(2);

    await store.loadSellerWorkspace(sellerId);
    const ws = store.sellerWorkspace!;
    expect(ws.active).toHaveLength(2);
    expect(ws.sold).toHaveLength(0);
    // Property-specific facts live on the relationship, not on the seller.
    const alpha = ws.active.find((r) => r.property.id === a)!;
    expect(alpha.ps).toMatchObject({
      askPrice: 4900000, relation: 'Owner', availConfirmed: true, visitNote: 'Call first.',
    });
    expect(alpha.ps.docs).toContain('Registry / Sale Deed');
    const beta = ws.active.find((r) => r.property.id === b)!;
    expect(beta.ps).toMatchObject({ relation: 'Authorized Seller', availConfirmed: false });

    await adapter.properties.remove(a);
    await adapter.properties.remove(b);
  });

  it('splits a seller profile into active and sold properties', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    const sellerId = (await store.saveSeller({ name: 'History Seller', phone: '+91 90000 55504' }))!;
    const live = uniq('prop-live'); const gone = uniq('prop-sold');
    await adapter.properties.save(property(live));
    await adapter.properties.save(property(gone));
    await store.assignSellerToProperty({ propertyId: live, sellerId, askPrice: 7000000 });
    await store.assignSellerToProperty({ propertyId: gone, sellerId, askPrice: 8000000 });

    const buyer = await adapter.customers.list({ limit: 1 });
    const buyerId = buyer.ok ? buyer.value.items[0]?.id : undefined;
    await adapter.deals.record({
      propertyId: gone, buyerId, soldPrice: 8100000, saleDate: '2026-08-24',
    });

    await store.loadSellerWorkspace(sellerId);
    const ws = store.sellerWorkspace!;
    expect(ws.active.map((r) => r.property.id)).toEqual([live]);
    // Sold history is preserved on the seller, not deleted.
    expect(ws.sold.map((r) => r.property.id)).toEqual([gone]);

    await adapter.properties.remove(live);
  });

  it('refuses to archive a seller that still holds active properties', async () => {
    const store = new DeskStore();
    await store.loadSellers();
    const sellerId = (await store.saveSeller({ name: 'Busy Seller', phone: '+91 90000 55505' }))!;
    const held = uniq('prop-held');
    await adapter.properties.save(property(held));
    await store.assignSellerToProperty({ propertyId: held, sellerId });

    expect(await store.archiveSeller(sellerId, true)).toBe(false);
    expect(store.lastWriteError).toMatch(/active propert/i);
    expect(store.sellers.some((s) => s.id === sellerId)).toBe(true);

    await adapter.properties.remove(held);
  });

  it('surfaces a truthful error instead of an empty list when loading fails', async () => {
    const store = new DeskStore();
    const original = adapter.sellers.directory;
    (adapter.sellers as { directory: unknown }).directory = async () =>
      ({ ok: false, error: { code: 'network', message: 'boom', retryable: true } });
    await store.loadSellers();
    expect(store.sellersStatus.state).toBe('error');
    expect(store.sellersStatus.error).toMatch(/could not reach/i);
    expect(store.sellers).toHaveLength(0);
    (adapter.sellers as { directory: unknown }).directory = original;
  });

  it('rejects a seller with no name or no phone', async () => {
    const store = new DeskStore();
    expect(await store.saveSeller({ name: '  ', phone: '+91 90000 55506' })).toBeNull();
    expect(await store.saveSeller({ name: 'No Phone', phone: '   ' })).toBeNull();
    expect(store.lastWriteError).toBeTruthy();
  });
});

describe('seller completion migration invariants', () => {
  it('adds the columns the approved Contacts UI already collects', () => {
    expect(migration).toContain('add column if not exists business');
    expect(migration).toContain('add column if not exists archived');
    expect(migration).toContain('add column if not exists document_kinds');
  });

  it('keeps every seller read model dealer-scoped and closed to anon', () => {
    for (const fn of [
      'plotmap_seller_directory', 'plotmap_seller_workspace',
      'plotmap_set_seller_archived', 'plotmap_assign_property_seller',
    ]) {
      expect(migration).toContain(`create or replace function public.${fn}`);
      expect(migration).toContain(`revoke all on function public.${fn}`);
      expect(migration).toContain(`grant execute on function public.${fn}`);
    }
    expect(migration).toContain('public.plotmap_current_dealer_id()');
    expect(migration).not.toMatch(/to anon/);
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it('never accepts a caller-supplied tenant', () => {
    expect(migration).not.toMatch(/p_payload->>'dealerId'/);
    expect(migration).not.toMatch(/p_dealer_id\s+text/);
  });

  it('blocks archiving a seller that still holds live inventory', () => {
    expect(migration).toContain("coalesce(r.payload->>'lifecycle','') <> 'sold'");
    expect(migration).toContain('still attached to');
  });
});
