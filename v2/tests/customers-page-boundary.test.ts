// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter, ok } from '../src/packages/data/adapter';
import { renderCustomers } from '../src/apps/dealer/pages/customers';
import { normalizeCompletedDeal } from '../src/packages/data/deal-normalization';
import type { Client, ClientLink } from '../src/packages/data/types';

const page = <T>(items: T[]) => ok({ items, nextCursor: null, total: items.length });

describe('Customers page async boundary and real relationships', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('shows loading and a useful error when the primary customer request fails', async () => {
    let rejectCustomers!: (reason: unknown) => void;
    vi.spyOn(adapter.customers, 'list').mockImplementation(() => new Promise((_resolve, reject) => { rejectCustomers = reject; }));
    vi.spyOn(adapter.deals, 'list').mockResolvedValue(page([]));
    vi.spyOn(adapter.properties, 'list').mockResolvedValue(page([]));
    vi.spyOn(adapter.clientLinks, 'list').mockResolvedValue(page([]));
    const host = document.createElement('div');
    document.body.appendChild(host);

    const rendering = renderCustomers(host);
    expect(host.textContent).toContain('Loading customers');
    rejectCustomers(new Error('offline'));
    await rendering;
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Customers could not be loaded');
    expect(host.innerHTML).not.toBe('');
  });

  it('renders partial customer rows and connects only real purchases and private links', async () => {
    const customer = { id: 'customer-partial', name: 'Legacy Buyer', phone: '', city: '', interest: [] } as unknown as Client;
    const sale = normalizeCompletedDeal('sale-1', {
      stage: 'closed', propId: 'property-sold', prop: 'Sold property', buyerId: customer.id,
      buyer: customer.name, soldPrice: 8_000_000, saleDate: '2026-06-10', commission: 0,
      commissionReceived: false, paymentReceived: 8_000_000, documents: [],
    })!;
    const link: ClientLink = {
      id: 'link-1', clientId: customer.id, clientName: customer.name,
      props: ['property-live'], propNames: ['Live property'], expiry: '7d',
      loc: 'area', price: 'hidden', audio: 'none', audioSecs: 0, status: 'active',
      events: { opens: 2, played: 0, called: 0, wa: 0, visit: 0 }, lastOpen: '12 Aug',
    };
    vi.spyOn(adapter.customers, 'list').mockResolvedValue(page([customer]));
    vi.spyOn(adapter.deals, 'list').mockResolvedValue(page([sale]));
    vi.spyOn(adapter.properties, 'list').mockResolvedValue(page([]));
    vi.spyOn(adapter.clientLinks, 'list').mockResolvedValue(page([link]));
    window.history.replaceState({}, '', '/admin/clients.html?customer=customer-partial');
    const host = document.createElement('div');
    document.body.appendChild(host);

    await renderCustomers(host);
    expect(host.textContent).toContain('Legacy Buyer');
    expect(host.textContent).toContain('Requirement not recorded');
    expect(host.textContent).toContain('Budget not recorded');
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain('Completed purchases');
    expect(host.textContent).toContain('Sold property');
    expect(host.textContent).toContain('2 opens');
    expect(host.querySelector<HTMLAnchorElement>('a[href="/admin/deals.html?deal=sale-1"]')).not.toBeNull();
    expect(host.textContent).not.toContain('New this week');
    expect(host.textContent).not.toContain('Last active');
    expect(host.innerHTML).not.toBe('');
  });
});
