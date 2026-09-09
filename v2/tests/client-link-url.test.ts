// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clientLinkUrl } from '../src/packages/data/client-link-url';

/* share_links.url is stored as a bare "/client/" — no origin and no token.
   The Desk copied that verbatim, so the dealer pasted a link into WhatsApp
   that opened nothing; the Team Workspace prepended the origin and produced a
   tokenless "https://host/client/". Both are silent: the dealer sees a link
   and believes it works. */

const src = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');

describe('the address a buyer actually receives', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('always carries the token, even when the server url does not', () => {
    const url = clientLinkUrl('abc123', '/client/');
    expect(url).toContain('token=abc123');
    expect(url.endsWith('/client/')).toBe(false);
  });

  it('is absolute, so it survives being pasted into WhatsApp', () => {
    expect(clientLinkUrl('abc123', '/client/')).toMatch(/^https?:\/\//);
  });

  it('keeps a server url that already has the token', () => {
    expect(clientLinkUrl('abc123', '/client/?token=abc123&x=1')).toContain('token=abc123&x=1');
  });

  it('does not double up an already absolute url', () => {
    const absolute = 'https://mapco.example/client/?token=abc123';
    expect(clientLinkUrl('abc123', absolute)).toBe(absolute);
  });

  it('percent-encodes a hostile token instead of splicing it in raw', () => {
    expect(clientLinkUrl('a b&c=d')).toContain('token=a%20b%26c%3Dd');
  });

  it('falls back to a path rather than an "undefined" prefix with no origin', () => {
    vi.stubGlobal('location', undefined);
    expect(clientLinkUrl('abc123')).toBe('/client/?token=abc123');
  });

  it('is the single source both adapters use, so the two modes cannot drift', () => {
    expect(src('../src/packages/data/supabase/supabase-adapter.ts'))
      .toContain('url: clientLinkUrl(env.token, env.url)');
    expect(src('../src/packages/data/mock-adapter-v2.ts'))
      .toContain('url: clientLinkUrl(token)');
  });

  it('is never prepended with an origin a second time by a caller', () => {
    const modals = src('../src/packages/ui/shared-modals.ts');
    expect(modals).not.toMatch(/origin\s*\+\s*this\.result\.url/);
  });
});
