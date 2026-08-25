// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadSvgOverlay } from '../src/packages/maps/svg-overlay';
import { renderClientLinkView } from '../src/packages/ui/client-link-view';
import type { ClientSafePayload } from '../src/packages/data/contracts';

afterEach(() => {
  document.body.replaceChildren();
  delete (globalThis as Record<string, unknown>).__mapcoXss;
});

describe('stored rendering payload hardening', () => {
  it('keeps hostile SVG IDs as inert data and rejects non-path grammar', async () => {
    const hostileId = 'plot" onpointerenter="globalThis.__mapcoXss=1';
    const authoredSvg = `<svg xmlns="http://www.w3.org/2000/svg">
      <script>globalThis.__mapcoXss = 1</script>
      <path id="plot&amp;quot; onpointerenter=&amp;quot;globalThis.__mapcoXss=1" d="M0 0 L20 0 L20 20 Z"/>
      <path id="poisoned-path" d="M0 0 Z&amp;quot; onload=&amp;quot;globalThis.__mapcoXss=1"/>
    </svg>`;
    // Use a correctly entity-decoded ID while keeping the XML well-formed.
    const fixture = authoredSvg.replace('plot&amp;quot;', 'plot&quot;').replace('=&amp;quot;global', '=&quot;global');
    const overlay = await loadSvgOverlay('hostile.svg', { w: 100, h: 100 }, {
      cacheKey: `security-fixture-${Date.now()}`,
      fetchText: async () => fixture,
    });

    expect(overlay).not.toBeNull();
    if (!overlay) return;
    expect(overlay.items()).toHaveLength(1);
    expect(overlay.items()[0]?.id).toBe(hostileId);

    overlay.setInteractive(true);
    overlay.setSelection([hostileId]);

    const hit = Array.from(overlay.el.querySelectorAll('[data-hit]'))
      .find((node) => node.getAttribute('data-hit') === hostileId);
    expect(hit).toBeTruthy();
    expect(overlay.el.querySelector('[onpointerenter], [onload], script')).toBeNull();
    expect((globalThis as Record<string, unknown>).__mapcoXss).toBeUndefined();
  });

  it('blocks executable media schemes and renders fullscreen labels as text', () => {
    const payload: ClientSafePayload = {
      dealerDisplayName: '<img src=x onerror="globalThis.__mapcoXss=1">',
      priceVisible: false,
      locationVisible: true,
      maps: [{
        id: 'map-1',
        kind: 'sector',
        label: 'hostile map',
        raster: 'https://cdn.example.test/sector.png',
        assets: { original: { path: 'https://cdn.example.test/sector.png', w: 100, h: 100 } },
        dims: { original: { w: 100, h: 100 } },
      }],
      properties: [{
        id: 'property-1',
        area: '<svg onload="globalThis.__mapcoXss=1">',
        size: '200 sq yd',
        facing: 'North',
        position: 'Corner',
        photos: ['javascript:globalThis.__mapcoXss=1', 'http://cdn.example.test/insecure.jpg'],
        approvals: [],
        landmarks: [],
        sectorMapId: 'map-1',
      }],
    };
    const host = document.createElement('div');
    document.body.append(host);
    renderClientLinkView(host, payload);

    expect(host.querySelector('[data-client-hero-image]')).toBeNull();
    expect(host.querySelector('[onerror], [onload]')).toBeNull();
    expect(host.textContent).toContain('<svg onload="globalThis.__mapcoXss=1">');

    const map = host.querySelector<HTMLButtonElement>('.pm-cl-map');
    expect(map).not.toBeNull();
    if (!map) return;
    map.dataset.label = '<img src=x onerror="globalThis.__mapcoXss=1">';
    map.click();

    const fullscreenLabel = document.body.querySelector<HTMLElement>('[data-map-label]');
    const fullscreenImage = document.body.querySelector<HTMLImageElement>('[data-map-image]');
    expect(fullscreenLabel?.textContent).toBe('<img src=x onerror="globalThis.__mapcoXss=1">');
    expect(fullscreenLabel?.querySelector('img')).toBeNull();
    expect(fullscreenImage?.src).toBe('https://cdn.example.test/sector.png');
    expect(document.body.querySelector('[onerror], [onload]')).toBeNull();
    expect((globalThis as Record<string, unknown>).__mapcoXss).toBeUndefined();
  });

  it('keeps gallery navigation on the sanitized photo list', () => {
    const payload: ClientSafePayload = {
      dealerDisplayName: 'Safe Dealer',
      priceVisible: false,
      locationVisible: false,
      properties: [{
        id: 'property-gallery',
        area: 'Safe area',
        size: '200 sq yd',
        facing: 'North',
        position: 'Corner',
        photos: [
          'https://cdn.example.test/first.jpg',
          'javascript:globalThis.__mapcoXss=1',
          'https://cdn.example.test/second.jpg',
        ],
        approvals: [],
        landmarks: [],
      }],
    };
    const host = document.createElement('div');
    renderClientLinkView(host, payload);

    const next = host.querySelector<HTMLButtonElement>('#pm-cl-next');
    const hero = host.querySelector<HTMLImageElement>('[data-client-hero-image]');
    expect(next).not.toBeNull();
    expect(hero?.src).toBe('https://cdn.example.test/first.jpg');
    next?.click();
    expect(hero?.src).toBe('https://cdn.example.test/second.jpg');
    expect(hero?.src).not.toContain('javascript:');
    expect((globalThis as Record<string, unknown>).__mapcoXss).toBeUndefined();
  });
});

describe('deployment security header contract', () => {
  const config = JSON.parse(readFileSync(resolve(__dirname, '../vercel.json'), 'utf8')) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  };
  const routeHeaders = (source: string) => new Map(
    config.headers.find((entry) => entry.source === source)?.headers.map((header) => [header.key, header.value]),
  );

  it('sets transport, MIME, referrer, permissions, CSP, and anti-framing globally', () => {
    const headers = routeHeaders('/(.*)');
    expect(headers.get('Strict-Transport-Security')).toMatch(/max-age=31536000/);
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(headers.get('Content-Security-Policy')).toContain("object-src 'none'");
    expect(headers.get('Content-Security-Policy')).not.toContain("'unsafe-eval'");
  });

  it('keeps client-link responses non-cacheable, non-indexable, and stricter', () => {
    const headers = routeHeaders('/client/(.*)');
    const csp = headers.get('Content-Security-Policy') ?? '';
    const scriptDirective = csp.split(';').find((part) => part.trim().startsWith('script-src')) ?? '';
    expect(headers.get('Cache-Control')).toContain('no-store');
    expect(headers.get('X-Robots-Tag')).toContain('noindex');
    expect(headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(scriptDirective).toBe(" script-src 'self'");
    expect(csp).toContain("default-src 'none'");
  });
});
