import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import { CLIENTS, CLIENT_LINKS } from '../src/packages/data/mock-adapter';
import type { Property } from '../src/packages/data/types';
import { canonicalPropertyLifecycle, propertyLifecycle } from '../src/packages/data/property-lifecycle';
import {
  PROPERTY_DOCUMENT_BUCKET,
  PROPERTY_DOCUMENT_MAX_BYTES,
  propertyDocumentObjectPath,
  validatePropertyDocument,
} from '../src/packages/data/property-documents';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260823000100_desk_property_foundations.sql', import.meta.url),
  'utf8',
);

function property(id: string, overrides: Partial<Property> = {}): Property {
  return {
    id, type: 'Residential Plot', want: 'Plot', city: 'Mohali', area: 'Desk test',
    loc: 'Desk test, Mohali', sector: '90', size: '300 sq yd', facing: 'East',
    position: 'Inside', approvals: [], landmarks: [], price: 9000000, photos: [],
    published: false, sold: false, views: 0, ...overrides,
  };
}

describe('canonical property lifecycle', () => {
  it('normalizes legacy flags while lifecycle remains authoritative', () => {
    expect(propertyLifecycle(property('draft'))).toBe('draft');
    expect(propertyLifecycle(property('sale', { published: true }))).toBe('on-sale');
    expect(propertyLifecycle(property('sold', { sold: true }))).toBe('sold');
    expect(propertyLifecycle({ ...property('archived'), lifecycle: 'archived', published: true })).toBe('archived');
    expect(canonicalPropertyLifecycle(property('canonical', { lifecycle: 'sold', published: true })).published).toBe(false);
  });

  it('persists every saved property with canonical lifecycle and compatible flags', async () => {
    const id = `desk-lifecycle-${Date.now()}`;
    const draft = await adapter.properties.save(property(id, { lifecycle: 'draft', published: true }));
    expect(draft.ok).toBe(true);
    if (draft.ok) expect(draft.value).toMatchObject({ lifecycle: 'draft', published: false, sold: false });
    const saved = await adapter.properties.save({ ...(draft.ok ? draft.value : property(id)), lifecycle: 'on-sale' });
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.value).toMatchObject({ lifecycle: 'on-sale', published: true, sold: false });
    await adapter.properties.remove(id);
  });

  it('allows an incomplete draft but rejects the same record as active inventory', async () => {
    const id = `incomplete-draft-${Date.now()}`;
    const incomplete = property(id, { city: '', area: '', size: '', lifecycle: 'draft' });
    expect((await adapter.properties.save(incomplete)).ok).toBe(true);
    const onSale = await adapter.properties.save({ ...incomplete, lifecycle: 'on-sale' });
    expect(onSale.ok).toBe(false);
    if (!onSale.ok) expect(onSale.error.code).toBe('validation');
    await adapter.properties.remove(id);
  });
});

describe('reusable seller and property relationship', () => {
  it('retrieves one seller with all related properties and keeps property facts on the relation', async () => {
    const suffix = Date.now();
    const first = property(`seller-property-a-${suffix}`);
    const second = property(`seller-property-b-${suffix}`);
    await adapter.properties.save(first); await adapter.properties.save(second);
    const seller = await adapter.sellers.save({
      name: 'Private Owner', primaryPhone: '+919900000000', alternatePhone: '+919911111111',
      type: 'individual', city: 'Mohali', note: 'Dealer private',
    });
    expect(seller.ok).toBe(true); if (!seller.ok) return;
    const a = await adapter.sellers.assignToProperty({
      propertyId: first.id, sellerId: seller.value.id, askingPrice: 9500000,
      relationship: 'owner', availability: 'available', lastConfirmedAt: '2026-08-23T00:00:00Z',
      siteVisitInstructions: 'Call first', note: 'Property-specific', documentStatus: 'Registry checked', isPrimary: true,
    });
    const b = await adapter.sellers.assignToProperty({
      propertyId: second.id, sellerId: seller.value.id, relationship: 'authorized-seller',
      availability: 'unconfirmed', isPrimary: true,
    });
    expect(a.ok && b.ok).toBe(true);
    const aggregate = await adapter.sellers.getWithProperties(seller.value.id);
    expect(aggregate.ok).toBe(true);
    if (aggregate.ok) {
      expect(aggregate.value.properties.map((row) => row.property.id).sort()).toEqual([first.id, second.id].sort());
      expect(aggregate.value.properties.find((row) => row.property.id === first.id)?.relationship)
        .toMatchObject({ askingPrice: 9500000, siteVisitInstructions: 'Call first' });
      expect(JSON.stringify(aggregate.value.seller)).not.toContain('askingPrice');
    }
    await adapter.properties.remove(first.id); await adapter.properties.remove(second.id);
  });
});

describe('canonical private property documents', () => {
  it('validates a private dealer/property scoped object identity', () => {
    expect(PROPERTY_DOCUMENT_BUCKET).toBe('property-documents');
    expect(propertyDocumentObjectPath('dealer-1', 'property-1', 'document-1', 'application/pdf'))
      .toBe('dealers/dealer-1/properties/property-1/documents/document-1.pdf');
    expect(validatePropertyDocument({ type: 'application/pdf', size: 1 })).toBeNull();
    expect(validatePropertyDocument({ type: 'text/plain', size: 1 })).toMatch(/PDF/);
    expect(validatePropertyDocument({ type: 'image/png', size: PROPERTY_DOCUMENT_MAX_BYTES + 1 })).toMatch(/20 MB/);
  });

  it('defaults documents to private and preserves them after a completed sale', async () => {
    const id = `document-property-${Date.now()}`;
    await adapter.properties.save(property(id, { lifecycle: 'on-sale', published: true }));
    const upload = await adapter.propertyDocuments.upload({ propertyId: id, title: 'Registry', type: 'registry' },
      new File([new Uint8Array([1, 2, 3])], 'registry.pdf', { type: 'application/pdf' }));
    expect(upload.ok).toBe(true); if (!upload.ok) return;
    expect(upload.value).toMatchObject({ visibility: 'private', safety: 'private' });
    const historicalLink = {
      id: `history-link-${Date.now()}`, clientId: 'c1', clientName: 'Historical Buyer',
      props: [id], propNames: ['Desk test'], expiry: '7d', loc: 'area' as const, price: 'hidden' as const,
      audio: 'none' as const, audioSecs: 0, status: 'active' as const,
      events: { opens: 4, played: 1, called: 1, wa: 0, visit: 1 }, lastOpen: 'today',
    };
    CLIENT_LINKS.push(historicalLink);
    const beforeLink = structuredClone(historicalLink);
    const sale = await adapter.deals.record({
      propertyId: id, newBuyer: { name: 'Minimal Buyer', phone: '+919800000000' },
      soldPrice: 9100000, saleDate: '2026-08-23',
    });
    expect(sale.ok).toBe(true);
    const documents = await adapter.propertyDocuments.listForProperty(id);
    expect(documents.ok && documents.value.some((document) => document.id === upload.value.id)).toBe(true);
    expect(CLIENT_LINKS.find((link) => link.id === historicalLink.id)).toEqual(beforeLink);
    CLIENT_LINKS.splice(CLIENT_LINKS.findIndex((link) => link.id === historicalLink.id), 1);
  });
});

describe('one-step completed sale invariants', () => {
  it('is idempotent, writes canonical sale state, and creates a truthful incomplete buyer', async () => {
    const id = `idempotent-sale-${Date.now()}`;
    await adapter.properties.save(property(id, { lifecycle: 'on-sale', published: true }));
    const seller = await adapter.sellers.save({
      name: 'Sale Owner', primaryPhone: '+919600000000', type: 'individual',
    });
    expect(seller.ok).toBe(true); if (!seller.ok) return;
    expect((await adapter.sellers.assignToProperty({
      propertyId: id, sellerId: seller.value.id, relationship: 'owner',
      availability: 'available', isPrimary: true,
    })).ok).toBe(true);
    const input = {
      propertyId: id, newBuyer: { name: 'Retry Buyer', phone: '+919700000000' },
      soldPrice: 9200000, saleDate: '2026-08-23',
    } as const;
    const first = await adapter.deals.record(input);
    const retry = await adapter.deals.record(input);
    expect(first.ok && retry.ok).toBe(true);
    if (!first.ok || !retry.ok) return;
    expect(retry.value.id).toBe(first.value.id);
    expect(first.value).toMatchObject({ sellerId: seller.value.id, seller: 'Sale Owner' });
    const sold = await adapter.properties.get(id);
    expect(sold.ok).toBe(true);
    if (sold.ok) expect(sold.value).toMatchObject({
      lifecycle: 'sold', sold: true, published: false,
      sale: { finalPrice: 9200000, soldAt: '2026-08-23', buyerId: first.value.buyerId, dealId: first.value.id },
    });
    const buyer = await adapter.customers.get(first.value.buyerId);
    expect(buyer.ok).toBe(true);
    if (buyer.ok) expect(buyer.value).toMatchObject({
      city: '', want: '', budget: '', budgetMax: 0, profileCompleteness: 'needs-attention',
      missingFields: ['city', 'requirements', 'budget'],
    });
    const preservedSeller = await adapter.sellers.getForProperty(id);
    expect(preservedSeller.ok && preservedSeller.value[0]?.seller.id === seller.value.id).toBe(true);
    const deals = await adapter.deals.list({ limit: 50 });
    expect(deals.ok && deals.value.items.filter((deal) => deal.propId === id)).toHaveLength(1);
  });

  it('uses an existing customer without creating or fabricating another profile', async () => {
    const id = `existing-buyer-sale-${Date.now()}`;
    await adapter.properties.save(property(id, { lifecycle: 'on-sale', published: true }));
    const customer = CLIENTS.find((row) => row.id === 'c1')!;
    const beforeCount = CLIENTS.length;
    const beforePurchased = [...(customer.purchased ?? [])];
    const sale = await adapter.deals.record({
      propertyId: id, buyerId: customer.id, soldPrice: 9300000, saleDate: '2026-08-23',
    });
    expect(sale.ok).toBe(true);
    expect(CLIENTS).toHaveLength(beforeCount);
    expect(customer.purchased).toEqual([...beforePurchased, id]);
    customer.purchased = beforePurchased;
    await adapter.properties.remove(id);
  });

  it('rejects invalid sale input before mutating the property or deal register', async () => {
    const id = `atomic-failure-${Date.now()}`;
    await adapter.properties.save(property(id, { lifecycle: 'on-sale', published: true }));
    const before = await adapter.deals.list({ limit: 50 });
    const result = await adapter.deals.record({
      propertyId: id, newBuyer: { name: '', phone: '' }, soldPrice: 9400000, saleDate: '2026-08-23',
    });
    expect(result.ok).toBe(false);
    const unchanged = await adapter.properties.get(id);
    expect(unchanged.ok && unchanged.value.lifecycle).toBe('on-sale');
    const after = await adapter.deals.list({ limit: 50 });
    if (before.ok && after.ok) expect(after.value.items).toHaveLength(before.value.items.length);
    await adapter.properties.remove(id);
  });
});

describe('database privacy and atomicity contract', () => {
  it('dealer-scopes private tables and Storage without adding them to client projections', () => {
    for (const table of ['desk_sellers', 'desk_property_sellers', 'desk_property_documents']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("values ('property-documents','property-documents',false");
    expect(migration).toContain("public.plotmap_current_role()<>'viewer'");
    expect(migration).toContain("bucket_id='property-documents'");
    expect(migration).toContain('r.dealer_id = new.dealer_id');
    expect(migration).toContain('s.dealer_id = new.dealer_id');
    expect(migration).not.toMatch(/property-documents[^\n]+public\s*=\s*true/i);
  });

  it('locks the property, preserves related records, and prevents duplicate canonical deals', () => {
    expect(migration).toContain('crm_records_property_lifecycle_valid');
    expect(migration).toContain('for update;');
    expect(migration).toContain("'recordType','completed-sale'");
    expect(migration).toContain('crm_one_canonical_completed_sale_per_property');
    expect(migration).toContain("'lifecycle','sold','sold',true,'published',false,'clientVisible',false");
    expect(migration).toContain("'profileCompleteness','needs-attention'");
    expect(migration).not.toMatch(/delete from public\.(desk_property_documents|desk_property_sellers|client_links|presentation_events)/i);
    const saleFunction = migration.slice(migration.indexOf('create or replace function public.plotmap_record_completed_sale'));
    expect(saleFunction).not.toMatch(/(?:update|delete from)\s+public\.(?:share_links|presentation_events|marketing_[a-z_]+)/i);
  });
});
