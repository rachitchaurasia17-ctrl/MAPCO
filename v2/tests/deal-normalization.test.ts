import { describe, expect, it } from 'vitest';
import { normalizeCompletedDeal } from '../src/packages/data/deal-normalization';

describe('completed Deal normalization', () => {
  it('preserves the modern atomic completed-sale shape', () => {
    const deal = normalizeCompletedDeal('deal-modern', {
      propId: 'property-1', prop: 'Eco City plot', propSub: '500 sq yd', city: 'New Chandigarh', sector: 'Eco City',
      buyerId: 'buyer-1', buyer: 'Buyer', seller: 'Seller', soldPrice: 9_500_000,
      brokerage: 190_000, commission: 142_500, commissionReceived: true,
      paymentReceived: 9_500_000, soldDate: '2026-07-20', dealer: 'Dealer', documents: [], timeline: [],
    });
    expect(deal?.soldDate).toBe('2026-07-20');
    expect(deal?.soldPrice).toBe(9_500_000);
    expect(deal?.timeline).toEqual([{ at: '2026-07-20', label: 'Sold price recorded' }]);
  });

  it('normalizes a genuinely completed legacy sale without fabricating missing private fields', () => {
    const deal = normalizeCompletedDeal('deal-legacy', {
      propId: 'property-2', prop: 'Legacy plot', propSub: '300 sq yd', area: 'Mohali',
      clientId: 'buyer-2', client: 'Legacy Buyer', value: 7_500_000, comm: 100_000,
      token: 500_000, saleDate: '2025-12-15', stage: 'closed', documents: [{ name: 'Registry', kind: 'pdf' }],
    });
    expect(deal).toMatchObject({
      id: 'deal-legacy', city: 'Mohali', buyer: 'Legacy Buyer', soldPrice: 7_500_000,
      commission: 100_000, paymentReceived: 500_000, soldDate: '2025-12-15', seller: '', dealer: '',
    });
    expect(deal?.documents).toEqual([{ name: 'Registry', kind: 'pdf' }]);
  });

  it('excludes legacy negotiation and token-stage rows from the completed-sales register', () => {
    const base = { prop: 'Pipeline record', area: 'New Chandigarh', client: 'Buyer', value: 9_500_000, comm: 142_500 };
    expect(normalizeCompletedDeal('d1', { ...base, stage: 'negotiating' })).toBeNull();
    expect(normalizeCompletedDeal('d3', { ...base, stage: 'token' })).toBeNull();
  });
});
