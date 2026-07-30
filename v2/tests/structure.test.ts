/* Route entry files, route→entry mapping, and forbidden-legacy-import checks. */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(__dirname, '..');

const ENTRY_HTML = [
  'index.html',
  'admin/owner.html', 'admin/deals.html', 'admin/properties.html', 'admin/clients.html',
  'admin/area-intelligence.html', 'admin/property-insights.html', 'admin/team.html',
  'admin/map-studio.html', 'admin/developer.html',
  'app/plotmap/index.html', 'client/index.html',
];

describe('Route entry points', () => {
  for (const p of ENTRY_HTML) {
    it(`entry exists: ${p}`, () => {
      expect(existsSync(join(root, p))).toBe(true);
    });
  }

  it('vite config wires every entry point', () => {
    const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
    for (const p of ENTRY_HTML) {
      expect(vite.includes(p)).toBe(true);
    }
  });
});

describe('Client link security markup', () => {
  const html = readFileSync(join(root, 'client/index.html'), 'utf8');
  it('is at /client/ and declares noindex/noarchive', () => {
    expect(html).toMatch(/noindex/);
    expect(html).toMatch(/noarchive/);
  });
  it('keeps referrer no-referrer', () => {
    expect(html).toMatch(/no-referrer/);
  });
  it('has a strict CSP with no unsafe-inline script', () => {
    const csp = /Content-Security-Policy[^>]*content="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
  });
});

describe('Buyer client does not import internal record data', () => {
  const client = readFileSync(join(root, 'src/apps/client/main.ts'), 'utf8');
  it('imports the client-safe contract, not raw fixtures', () => {
    expect(client).toContain('ClientSafePayload');
    // must not pull the full internal fixtures directly
    expect(client).not.toContain("from '../../packages/data/mock-adapter'");
  });
  it('strips the token from history and never stores it', () => {
    expect(client).toContain('history.replaceState');
    expect(client).toContain("localStorage.removeItem('token')");
    expect(client).toContain("sessionStorage.removeItem('token')");
  });
});

describe('Audited adapter and accessibility boundaries', () => {
  it('keeps migrated dealer screens on DataAdapterV2', () => {
    for (const p of ['src/apps/dealer/pages/home.ts', 'src/apps/dealer/pages/links.ts']) {
      const source = readFileSync(join(root, p), 'utf8');
      expect(source).toContain('mock-adapter-v2');
      expect(source).not.toMatch(/mock-adapter['"]/);
    }
  });

  it('loads presentation pins through the map repository and labels mock provenance', () => {
    const source = readFileSync(join(root, 'src/apps/presentation/main.ts'), 'utf8');
    expect(source).toContain('adapter.maps.listRegistry');
    expect(source).toContain('adapter.maps.get');
    expect(source).not.toContain('PIN_COORDS');
    expect(source).toContain('not survey coordinates');
  });

  it('keeps presentation highlights and pins on the canonical raster transform', () => {
    const source = readFileSync(join(root, 'src/apps/presentation/main.ts'), 'utf8');
    expect(source).toContain('const sharedTransform = cssMapTransform(t)');
    expect(source).toContain('highlightLayer.style.transform = sharedTransform');
    expect(source).toContain('pinLayer.style.transform = sharedTransform');
  });

  it('gives the activation modal dialog semantics and Escape handling', () => {
    const source = readFileSync(join(root, 'src/main.ts'), 'utf8');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("e.key === 'Escape'");
    expect(source).toContain('previouslyFocused?.focus()');
  });

  it('targets every audited responsive surface', () => {
    const css = readFileSync(join(root, 'src/packages/ui/responsive.css'), 'utf8');
    for (const selector of ['#pm-dash-sidebar', '#pm-dash-content', '#pm-ws-header',
      '.pm-map-editor-body', '.pm-map-editor-sidebar', '.pm-rail', '.pm-viewtabs',
      '.pm-pres-grid', '.pm-modal-content', '.pm-buyer']) {
      expect(css).toContain(selector);
    }
  });
});

describe('No forbidden legacy filenames imported', () => {
  const forbidden = [/xyz/i, /legacy/i, /\.dc\.html/];
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else if (/\.ts$/.test(name)) out.push(full);
    }
    return out;
  }
  it('source files avoid legacy references in imports', () => {
    for (const f of walk(join(root, 'src'))) {
      const text = readFileSync(f, 'utf8');
      const importLines = text.split('\n').filter((l) => /^\s*import\s/.test(l));
      for (const line of importLines) {
        for (const pat of forbidden) expect(pat.test(line)).toBe(false);
      }
    }
  });
});
