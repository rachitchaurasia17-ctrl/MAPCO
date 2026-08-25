import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

describe('private application entrypoints', () => {
  it.each([
    ['dealer admin', 'src/apps/dealer/main.ts'],
    ['MAPCO Earth', 'src/apps/earth/main.ts'],
    ['Map Engine Pilot', 'src/apps/map-pilot/main.ts'],
    ['Developer Control', 'src/apps/developer/main.ts'],
  ])('%s boots behind the shared server-validated session gate', (_name, path) => {
    const entrypoint = source(path);
    expect(entrypoint).toMatch(/import\s*\{[^}]*\brequireSession\b[^}]*\}/);
    expect(entrypoint).toMatch(/requireSession\s*\(/);
  });

  it('uses a server RPC, not a mock profile flag, for platform-admin access', () => {
    const developer = source('src/apps/developer/main.ts');
    const session = source('src/packages/data/session.ts');

    expect(developer).toContain('hasPlatformAdminAccess');
    expect(developer).not.toContain('getProfile');
    expect(session).toContain("rpc('plotmap_is_platform_admin')");
  });

  it('does not override the Supabase Auth coordination strategy', () => {
    const client = source('src/packages/data/supabase/client.ts');
    expect(client).not.toMatch(/\block\s*:/);
  });
});
