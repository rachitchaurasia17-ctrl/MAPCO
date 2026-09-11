import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Founder DEV provisioning origin regression', () => {
  it('uses the allowed local browser origin for all Edge calls and checks CORS before mutations', () => {
    const script = readFileSync(new URL('../scripts/founder-readiness-e2e.mjs', import.meta.url), 'utf8');
    expect(script).toContain("const ORIGIN = 'http://localhost:5173'");
    expect(script).not.toContain("Origin: 'https://mapco-navy.vercel.app'");
    expect(script.match(/Origin: ORIGIN/g)?.length).toBe(3);
    expect(script.match(/Origin: BUYER_ORIGIN/g)?.length).toBe(2);
    expect(script).toContain("const BUYER_ORIGIN = 'https://mapco-navy.vercel.app'");
    expect(script).toContain("buyerPreflight.headers.get('access-control-allow-origin') === BUYER_ORIGIN");
    expect(script.indexOf('const preflight =')).toBeLessThan(script.indexOf('founder = await founderSession()'));
    expect(script).toContain("preflight.headers.get('access-control-allow-origin') === ORIGIN");
  });
});
