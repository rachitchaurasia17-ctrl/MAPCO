// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter, ok } from '../src/packages/data/adapter';
import { renderDeals } from '../src/apps/dealer/pages/deals';
import { normalizeCompletedDeal } from '../src/packages/data/deal-normalization';

describe('Deals page async boundary', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders a loading state while completed sales are pending', async () => {
    let resolveDeals!: (value: Awaited<ReturnType<typeof adapter.deals.list>>) => void;
    vi.spyOn(adapter.deals, 'list').mockImplementation(() => new Promise((resolve) => { resolveDeals = resolve; }));
    const host = document.createElement('div');
    document.body.appendChild(host);

    const rendering = renderDeals(host);
    expect(host.textContent).toContain('Loading completed sales');
    resolveDeals(ok({ items: [], nextCursor: null, total: 0 }));
    await rendering;
    expect(host.textContent).toContain('My Deals');
  });

  it('renders an error alert when an unexpected async failure occurs', async () => {
    vi.spyOn(adapter.deals, 'list').mockRejectedValue(new Error('unexpected failure'));
    const host = document.createElement('div');
    document.body.appendChild(host);

    await renderDeals(host);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Deals could not be loaded');
    expect(host.innerHTML).not.toBe('');
  });

  it('captures current fields and lets the dealer skip optional seller details', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    await renderDeals(host);

    host.querySelector<HTMLButtonElement>('[data-act="record"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-act="pick-prop"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-act="next-step"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-act="pick-buyer"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-act="next-step"]')!.click();

    expect(host.textContent).toContain('Confirm the seller');
    const next = host.querySelector<HTMLButtonElement>('[data-act="next-step"]')!;
    expect(next.disabled).toBe(false);
    next.click();
    expect(host.textContent).toContain('Sale price & dates');
  });

  it('keeps an incomplete legacy completed-sale row usable without claiming unknown values', async () => {
    const legacy = normalizeCompletedDeal('legacy-complete', {
      stage: 'closed', prop: 'Legacy plot', buyerId: 'buyer-legacy', propId: 'property-legacy',
    });
    expect(legacy).not.toBeNull();
    vi.spyOn(adapter.deals, 'list').mockResolvedValue(ok({ items: [legacy!], nextCursor: null, total: 1 }));
    const host = document.createElement('div');
    document.body.appendChild(host);

    await renderDeals(host);
    expect(host.textContent).toContain('Legacy plot');
    expect(host.textContent).toContain('Commission not recorded');
    expect(host.textContent).not.toContain('₹0 pending');

    host.querySelector<HTMLButtonElement>('[data-act="open"]')!.click();
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain('Payment information was not recorded');
    expect(host.querySelector<HTMLAnchorElement>('a[href="/admin/properties.html?property=property-legacy"]')).not.toBeNull();
    expect(host.querySelector<HTMLAnchorElement>('a[href="/admin/clients.html?customer=buyer-legacy"]')).not.toBeNull();
    expect(host.innerHTML).not.toBe('');
  });
});
