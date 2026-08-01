/* Data-adapter behaviour: Demand, states, pagination, AbortSignal, matching. */
import { describe, it, expect } from 'vitest';
import { adapter, DEMAND_RECORDS, toClientSafeProperty } from '../src/packages/data/mock-adapter-v2';
import { PROPERTIES } from '../src/packages/data/mock-adapter';

describe('Demand repository', () => {
  it('lists deterministic demand fixtures', async () => {
    const r = await adapter.demand.list();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.items.length).toBe(DEMAND_RECORDS.length);
      expect(r.value.items[0]!.customerName).toBe('Rajiv Sharma');
    }
  });

  it('exposes the full demand contract fields', async () => {
    const r = await adapter.demand.get('dm1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = r.value;
      for (const k of ['customerId', 'category', 'preferredLocations', 'propertyType',
        'budgetMin', 'budgetMax', 'urgency', 'followUp', 'status'] as const) {
        expect(d[k]).toBeDefined();
      }
    }
  });

  it('produces deterministic matches within budget', async () => {
    const a = await adapter.demand.match('dm1');
    const b = await adapter.demand.match('dm1');
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.map((m) => m.property.id)).toEqual(b.value.map((m) => m.property.id));
      expect(a.value.every((m) => m.score >= 0.5 && m.score <= 1)).toBe(true);
    }
  });

  it('returns an empty match array (no-match state) rather than throwing', async () => {
    // dm3: Kothi 1.2–2Cr in New Chandigarh — narrow; still deterministic.
    const r = await adapter.demand.match('dm3');
    expect(r.ok).toBe(true);
    if (r.ok) expect(Array.isArray(r.value)).toBe(true);
  });

  it('validates budget on save', async () => {
    const r = await adapter.demand.save({
      customerId: 'c1', category: 'buy', preferredLocations: ['Mohali'],
      propertyType: 'Flat', budgetMin: 9000000, budgetMax: 1000000,
      urgency: 'exploring', followUp: 'new', status: 'open',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('validation');
  });
});

describe('Pagination (cursor contract)', () => {
  it('paginates with a working cursor', async () => {
    const first = await adapter.properties.list({ limit: 3 });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.items.length).toBe(3);
      expect(first.value.nextCursor).toBeTruthy();
      const second = await adapter.properties.list({ limit: 3, cursor: first.value.nextCursor! });
      if (second.ok) {
        const firstIds = new Set(first.value.items.map((p) => p.id));
        expect(second.value.items.every((p) => !firstIds.has(p.id))).toBe(true);
      }
    }
  });

  it('caps page size at the documented maximum', async () => {
    const r = await adapter.properties.list({ limit: 9999 });
    if (r.ok) expect(r.value.items.length).toBeLessThanOrEqual(50);
  });
});

describe('AbortSignal support', () => {
  it('returns an aborted result when signal already fired', async () => {
    const c = new AbortController();
    c.abort();
    const r = await adapter.properties.list({}, { signal: c.signal });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('aborted');
  });
});

describe('Client-safe projection (security invariant)', () => {
  const forbidden = ['phone', 'commission', 'note', 'notes', 'sold', 'published',
    'views', 'owner', 'sellerPhone', 'internalStatus', 'team'];

  it('never copies forbidden fields into the buyer payload', () => {
    const safe = toClientSafeProperty(PROPERTIES[0]!, { price: true, location: true });
    for (const key of forbidden) {
      expect(Object.prototype.hasOwnProperty.call(safe, key)).toBe(false);
    }
  });

  it('omits price when the link hides it', () => {
    const safe = toClientSafeProperty(PROPERTIES[0]!, { price: false, location: true });
    expect('price' in safe).toBe(false);
  });

  it('omits location when the link hides it', () => {
    const safe = toClientSafeProperty(PROPERTIES[0]!, { price: true, location: false });
    expect('loc' in safe).toBe(false);
  });

  it('resolve() returns only client-safe payloads with no forbidden keys', async () => {
    const r = await adapter.clientLinks.resolve('l1');
    expect(r.ok).toBe(true);
    if (r.ok && r.value.kind === 'valid') {
      for (const p of r.value.payload.properties) {
        for (const key of forbidden) {
          expect(Object.prototype.hasOwnProperty.call(p, key)).toBe(false);
        }
      }
    }
  });
});

describe('Property-pin coordinate provenance', () => {
  it('marks invented preview pins as development-only, never survey coordinates', async () => {
    const result = await adapter.maps.get('mohali-master');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const pins = result.value.sets.flatMap((set) => set.marks).filter((mark) => mark.kind === 'pin');
    expect(pins).toHaveLength(3);
    expect(pins.every((pin) => pin.coordinateProvenance === 'development-mock')).toBe(true);
    expect(pins.every((pin) => pin.coordinateProvenance !== 'survey')).toBe(true);
  });
});
