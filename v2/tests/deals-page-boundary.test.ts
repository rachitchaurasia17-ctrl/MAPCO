// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter, ok } from '../src/packages/data/adapter';
import { renderDeals } from '../src/apps/dealer/pages/deals';

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
});
