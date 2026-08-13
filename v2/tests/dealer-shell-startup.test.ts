// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listDeals: vi.fn(),
  renderHome: vi.fn(),
  renderDeals: vi.fn(),
  renderProperties: vi.fn(),
  renderCustomers: vi.fn(),
  renderLinks: vi.fn(),
}));

vi.mock('../src/packages/data/adapter', () => ({
  activeDataMode: () => 'supabase',
  adapter: { deals: { list: mocks.listDeals } },
}));
vi.mock('../src/packages/data/session', () => ({ getSession: mocks.getSession }));
vi.mock('../src/packages/ui/fullscreen', () => ({ mountFullscreenButton: vi.fn() }));
vi.mock('../src/packages/ui/back-button', () => ({ mountBackButton: vi.fn() }));
vi.mock('../src/apps/dealer/pages/home', () => ({ renderHome: mocks.renderHome }));
vi.mock('../src/apps/dealer/pages/deals', () => ({ renderDeals: mocks.renderDeals }));
vi.mock('../src/apps/dealer/pages/properties', () => ({ renderProperties: mocks.renderProperties }));
vi.mock('../src/apps/dealer/pages/customers', () => ({ renderCustomers: mocks.renderCustomers }));
vi.mock('../src/apps/dealer/pages/links', () => ({ renderLinks: mocks.renderLinks }));
vi.mock('../src/apps/dealer/pages/area-intelligence', () => ({ renderAreaIntelligence: vi.fn() }));
vi.mock('../src/apps/dealer/pages/property-insights', () => ({ renderPropertyInsights: vi.fn() }));
vi.mock('../src/apps/dealer/pages/demand', () => ({ renderDemand: vi.fn() }));

import { initDealerShell } from '../src/apps/dealer/shell';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('dealer shell startup boundary', () => {
  let sessionRequest: Deferred<{ email: string; userId: string } | null>;
  let dealsRequest: Deferred<{
    ok: true;
    value: { items: Array<{ id: string }>; nextCursor: null; total: number };
  }>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionRequest = deferred();
    dealsRequest = deferred();
    mocks.getSession.mockImplementation(() => sessionRequest.promise);
    mocks.listDeals.mockImplementation(() => dealsRequest.promise);
    mocks.renderDeals.mockImplementation((host: HTMLElement) => {
      host.innerHTML = '<p data-route-ready="deals">Deals route</p>';
      return Promise.resolve();
    });
    mocks.renderHome.mockImplementation((host: HTMLElement) => {
      host.innerHTML = '<p data-route-ready="home">Home route</p>';
      return Promise.resolve();
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.querySelector('#pm-styles')?.remove();
    window.history.replaceState({}, '', '/');
  });

  it('renders and navigates routes while session and completed-deal metadata are pending', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    initDealerShell(host, 'deals');

    expect(host.querySelector('#pm-dash-shell')).not.toBeNull();
    expect(host.querySelector('[data-route-ready="deals"]')).not.toBeNull();
    expect(mocks.renderDeals).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.listDeals).toHaveBeenCalledWith({ limit: 50 }, undefined);
    expect(host.querySelector<HTMLElement>('[data-deal-count]')?.hidden).toBe(true);
    expect(host.querySelector('[data-dealer-account-name]')?.textContent).toBe('Signed-in dealer');

    host.querySelector<HTMLAnchorElement>('a[data-section="areas"]')!.click();

    expect(host.querySelector('[data-route-ready="home"]')).not.toBeNull();
    expect(mocks.renderHome).toHaveBeenCalledTimes(1);

    sessionRequest.resolve({ email: 'dealer@mapco.test', userId: 'dealer-1' });
    dealsRequest.resolve({
      ok: true,
      value: {
        items: [{ id: 'sale-1' }, { id: 'sale-2' }],
        nextCursor: null,
        total: 2,
      },
    });

    await vi.waitFor(() => {
      expect(host.querySelector('[data-dealer-account-name]')?.textContent).toBe('dealer@mapco.test');
      const badge = host.querySelector<HTMLElement>('[data-deal-count]');
      expect(badge?.hidden).toBe(false);
      expect(badge?.textContent).toBe('2');
    });
  });
});
