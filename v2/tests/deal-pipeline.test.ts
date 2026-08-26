import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adapter } from '../src/packages/data/mock-adapter-v2';
import { CLIENTS } from '../src/packages/data/mock-adapter';
import { DCLogic } from '../src/framework/dc';
import type { Property } from '../src/packages/data/types';
import {
  normalizeCompletedDeal,
  normalizePipelineDeal,
  readDealStage,
  expectedCommissionSide,
} from '../src/packages/data/deal-normalization';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260826000100_desk_deal_pipeline.sql', import.meta.url),
  'utf8',
);

function property(id: string, overrides: Partial<Property> = {}): Property {
  return {
    id, type: 'Residential Plot', want: 'Plot', city: 'Mohali', area: 'Pipeline test',
    loc: 'Pipeline test, Mohali', sector: '91', size: '250 sq yd', facing: 'East',
    position: 'Inside', approvals: [], landmarks: [], price: 8000000, photos: [],
    published: true, sold: false, lifecycle: 'on-sale', views: 0, ...overrides,
  };
}

/** A fresh on-sale property plus a buyer, so each test starts from clean state. */
async function fixture(tag: string) {
  const id = `pipeline-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const saved = await adapter.properties.save(property(id));
  if (!saved.ok) throw new Error('property fixture failed');
  const buyer = CLIENTS[0];
  if (!buyer) throw new Error('expected a mock client');
  return { propertyId: id, buyerId: buyer.id };
}

describe('pipeline deal normalization', () => {
  it('declines completed-sale rows so a finished sale is never read as an open negotiation', () => {
    expect(normalizePipelineDeal('deal-1', {
      recordType: 'completed-sale', propertyId: 'p1', buyerId: 'b1', soldDate: '2026-08-01',
    })).toBeNull();
  });

  it('declines pipeline rows from the completed-sales register', () => {
    expect(normalizeCompletedDeal('deal-2', {
      recordType: 'pipeline', stage: 'negotiating', propertyId: 'p1', buyerId: 'b1',
    })).toBeNull();
  });

  it('never fabricates a deal value the dealer has not recorded', () => {
    const deal = normalizePipelineDeal('deal-3', {
      recordType: 'pipeline', stage: 'token', propertyId: 'p1', buyerId: 'b1', prop: 'Plot 9',
    });
    expect(deal).not.toBeNull();
    expect(deal!.value).toBeUndefined();
    expect(deal!.commission).toEqual({ buyer: { mode: 'none' }, seller: { mode: 'none' } });
  });

  it('reads the retired enquiry stage as negotiating', () => {
    expect(readDealStage('enquiry')).toBe('negotiating');
    expect(readDealStage('token')).toBe('token');
    expect(readDealStage(undefined)).toBe('negotiating');
  });

  it('computes each commission side the same way the database does', () => {
    expect(expectedCommissionSide(10_000_000, { mode: 'none' })).toBe(0);
    expect(expectedCommissionSide(10_000_000, { mode: 'pct', percent: 1.5 })).toBe(150_000);
    expect(expectedCommissionSide(10_000_000, { mode: 'fixed', fixed: 90_000 })).toBe(90_000);
  });
});

describe('deal pipeline repository', () => {
  it('starts a deal on a canonical client and property without duplicating either', async () => {
    const { propertyId, buyerId } = await fixture('start');
    const started = await adapter.deals.start({
      propertyId, buyerId, value: 12_000_000,
      commission: { buyer: { mode: 'pct', percent: 1 }, seller: { mode: 'fixed', fixed: 50_000 } },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value).toMatchObject({ stage: 'negotiating', propertyId, buyerId, value: 12_000_000 });

    // Re-issuing the same start returns the existing deal rather than a second one.
    const again = await adapter.deals.start({ propertyId, buyerId });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.value.id).toBe(started.value.id);

    const listed = await adapter.deals.listPipeline({ limit: 50 });
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.items.filter((d) => d.propertyId === propertyId)).toHaveLength(1);
    }
    await adapter.properties.remove(propertyId);
  });

  it('refuses to open a deal on a sold property', async () => {
    const { propertyId, buyerId } = await fixture('sold-guard');
    const sale = await adapter.deals.record({
      propertyId, buyerId, soldPrice: 9_000_000, saleDate: '2026-08-20',
    });
    expect(sale.ok).toBe(true);
    const started = await adapter.deals.start({ propertyId, buyerId });
    expect(started.ok).toBe(false);
    if (!started.ok) expect(started.error.code).toBe('validation');
  });

  it('persists stage transitions and keeps a lost deal with its reason', async () => {
    const { propertyId, buyerId } = await fixture('stage');
    const started = await adapter.deals.start({ propertyId, buyerId, value: 5_000_000 });
    if (!started.ok) throw new Error('start failed');

    const token = await adapter.deals.setStage({
      dealId: started.value.id, stage: 'token', tokenDate: '2026-08-22',
    });
    expect(token.ok).toBe(true);
    if (token.ok) expect(token.value).toMatchObject({ stage: 'token', tokenDate: '2026-08-22' });

    const lost = await adapter.deals.setStage({
      dealId: started.value.id, stage: 'lost', reason: 'Buyer chose another plot',
    });
    expect(lost.ok).toBe(true);
    if (lost.ok) expect(lost.value).toMatchObject({ stage: 'lost', lostReason: 'Buyer chose another plot' });

    // A lost deal persists rather than disappearing.
    const workspace = await adapter.deals.workspace(started.value.id);
    expect(workspace.ok).toBe(true);
    if (workspace.ok) {
      expect(workspace.value.deal.stage).toBe('lost');
      expect(workspace.value.stageHistory.map((e) => e.stage)).toEqual(['negotiating', 'token', 'lost']);
    }
    await adapter.properties.remove(propertyId);
  });

  it('tracks expected, received and still-due commission across both sides', async () => {
    const { propertyId, buyerId } = await fixture('money');
    const started = await adapter.deals.start({
      propertyId, buyerId, value: 10_000_000,
      commission: { buyer: { mode: 'pct', percent: 1 }, seller: { mode: 'pct', percent: 1 } },
    });
    if (!started.ok) throw new Error('start failed');
    const dealId = started.value.id;

    await adapter.deals.recordPayment({ dealId, kind: 'token', amount: 500_000, receivedOn: '2026-08-20' });
    await adapter.deals.recordPayment({ dealId, kind: 'commission-buyer', amount: 60_000, receivedOn: '2026-08-23' });

    const mid = await adapter.deals.workspace(dealId);
    expect(mid.ok).toBe(true);
    if (mid.ok) {
      expect(mid.value.money).toMatchObject({
        value: 10_000_000, token: 500_000,
        expectedBuyer: 100_000, expectedSeller: 100_000, expected: 200_000,
        receivedBuyer: 60_000, receivedSeller: 0, received: 60_000,
        due: 140_000, fullySettled: false,
      });
    }

    await adapter.deals.recordPayment({ dealId, kind: 'commission-buyer', amount: 40_000 });
    await adapter.deals.recordPayment({ dealId, kind: 'commission-seller', amount: 100_000 });
    const settled = await adapter.deals.workspace(dealId);
    if (settled.ok) {
      expect(settled.value.money).toMatchObject({ received: 200_000, due: 0, fullySettled: true });
    }
    await adapter.properties.remove(propertyId);
  });

  it('rejects a payment with no amount', async () => {
    const { propertyId, buyerId } = await fixture('bad-payment');
    const started = await adapter.deals.start({ propertyId, buyerId });
    if (!started.ok) throw new Error('start failed');
    const bad = await adapter.deals.recordPayment({ dealId: started.value.id, kind: 'token', amount: 0 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('validation');
    await adapter.properties.remove(propertyId);
  });

  it('shows the canonical property papers by reference and keeps deal papers separate', async () => {
    const { propertyId, buyerId } = await fixture('papers');
    const started = await adapter.deals.start({ propertyId, buyerId });
    if (!started.ok) throw new Error('start failed');

    const upload = await adapter.propertyDocuments.upload(
      { propertyId, title: 'Jamabandi', type: 'other', visibility: 'private', safety: 'private' },
      new File([new Uint8Array([1, 2, 3])], 'fard.pdf', { type: 'application/pdf' }),
    );
    expect(upload.ok).toBe(true);

    const workspace = await adapter.deals.workspace(started.value.id);
    expect(workspace.ok).toBe(true);
    if (workspace.ok) {
      expect(workspace.value.propertyPapers.map((d) => d.title)).toContain('Jamabandi');
      // The property paper is referenced, never copied into the deal's own papers.
      expect(workspace.value.dealPapers).toHaveLength(0);
      expect(workspace.value.propertyPapers[0]!.storage.bucket).toBe('property-documents');
    }
    await adapter.properties.remove(propertyId);
  });

  it('completes the open pipeline deal on Mark Sold instead of duplicating it', async () => {
    const { propertyId, buyerId } = await fixture('mark-sold');
    const started = await adapter.deals.start({ propertyId, buyerId, value: 7_000_000 });
    if (!started.ok) throw new Error('start failed');

    const before = await adapter.deals.listPipeline({ limit: 50 });
    const openBefore = before.ok ? before.value.items.filter((d) => d.propertyId === propertyId) : [];
    expect(openBefore).toHaveLength(1);

    const sale = await adapter.deals.record({
      propertyId, buyerId, soldPrice: 7_200_000, saleDate: '2026-08-25',
    });
    expect(sale.ok).toBe(true);

    // The pipeline deal is now closed, not left open beside a second deal.
    const after = await adapter.deals.listPipeline({ limit: 50 });
    if (after.ok) {
      const stillOpen = after.value.items.filter(
        (d) => d.propertyId === propertyId && d.stage !== 'closed' && d.stage !== 'lost',
      );
      expect(stillOpen).toHaveLength(0);
    }

    // Buyer purchase history reflects the sale.
    const buyer = await adapter.customers.get(buyerId);
    if (buyer.ok) expect(buyer.value.purchased ?? []).toContain(propertyId);
  });

  it('keeps commission due after the property is sold', async () => {
    const { propertyId, buyerId } = await fixture('due-after-sale');
    const started = await adapter.deals.start({
      propertyId, buyerId, value: 6_000_000,
      commission: { buyer: { mode: 'fixed', fixed: 120_000 }, seller: { mode: 'none' } },
    });
    if (!started.ok) throw new Error('start failed');
    await adapter.deals.record({ propertyId, buyerId, soldPrice: 6_000_000, saleDate: '2026-08-25' });

    const workspace = await adapter.deals.workspace(started.value.id);
    expect(workspace.ok).toBe(true);
    if (workspace.ok) {
      expect(workspace.value.deal.stage).toBe('closed');
      expect(workspace.value.money.due).toBe(120_000);
      expect(workspace.value.money.fullySettled).toBe(false);
    }

    await adapter.deals.recordPayment({
      dealId: started.value.id, kind: 'commission-buyer', amount: 120_000,
    });
    const settled = await adapter.deals.workspace(started.value.id);
    if (settled.ok) expect(settled.value.money).toMatchObject({ due: 0, fullySettled: true });
  });
});

describe('deal pipeline migration invariants', () => {
  it('keeps every new deal table dealer-scoped and closed to anon', () => {
    for (const table of ['desk_deal_stage_events', 'desk_deal_payments', 'desk_deal_documents']) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`grant select, insert, update, delete on public.${table} to authenticated`);
      expect(migration).not.toContain(`on public.${table} to anon`);
    }
    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it('derives the tenant from the session and never from the caller', () => {
    for (const fn of [
      'plotmap_start_deal', 'plotmap_set_deal_stage',
      'plotmap_record_deal_payment', 'plotmap_deal_workspace',
    ]) {
      expect(migration).toContain(`create or replace function public.${fn}`);
      expect(migration).toContain(`revoke all on function public.${fn}`);
      expect(migration).toContain(`grant execute on function public.${fn}`);
    }
    expect(migration).toContain('public.plotmap_current_dealer_id()');
    expect(migration).not.toMatch(/p_payload->>'dealerId'/);
  });

  it('allows only one open pipeline deal per property and buyer', () => {
    expect(migration).toContain('crm_one_open_pipeline_deal_per_property_buyer');
    expect(migration).toContain("coalesce(payload->>'stage','negotiating') not in ('closed','lost')");
  });

  it('routes completion through the sale command rather than a bare stage change', () => {
    expect(migration).toContain("completing a deal goes through the sale record");
    expect(migration).toContain("v_stage not in ('negotiating','token','registry','lost')");
  });

  it('reuses an open pipeline deal when the property is marked sold', () => {
    expect(migration).toContain("v_reused");
    expect(migration).toContain("reusedPipelineDeal");
  });
});

describe('DC framework', () => {
  it('exposes forceUpdate so instance-collection mutations actually re-render', () => {
    // 13 Desk controls call this.forceUpdate(); without it each throws a
    // TypeError and the DOM silently keeps the pre-mutation value.
    expect(typeof new DCLogic().forceUpdate).toBe('function');
  });
});
