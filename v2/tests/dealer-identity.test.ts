// @vitest-environment jsdom
/*
 * The dealer's own identity.
 *
 * The sidebar used to render the constants ownerName = 'Rajinder Singh' /
 * bizName = 'Rajinder Estates', so every dealer was shown somebody else's name
 * and business as their own. The same two strings were also rendered into the
 * client-link preview, which told the dealer a buyer would see a business that
 * was not theirs. Identity now comes from the dealer's own dealer_settings row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter, ok, err } from '../src/packages/data/adapter';
import { Component } from '../src/apps/dealer/logic';

afterEach(() => vi.restoreAllMocks());

const identity = (v: Record<string, unknown>) =>
  vi.spyOn(adapter.auth, 'getDealerIdentity').mockResolvedValue(ok(v) as never);

describe('dealer identity', () => {
  it('starts unnamed rather than showing a placeholder person', () => {
    const c = new Component() as any;
    expect(c.ownerName).toBe('');
    expect(c.bizName).toBe('');
    expect(c.ownerInitials).toBe('');
  });

  it('renders the signed-in dealer, not a constant', async () => {
    const c = new Component() as any;
    identity({ dealerId: 'dealer-demo', brandName: 'Chaurasia Properties', ownerName: 'A Chaurasia' });
    await c.loadIdentity();
    expect(c.ownerName).toBe('A Chaurasia');
    expect(c.bizName).toBe('Chaurasia Properties');
    expect(c.ownerInitials).toBe('AC');
  });

  it('lets the business name stand alone when no owner name is recorded', async () => {
    // dealer-demo on MAPCO-DEV really is in this shape: brand_name set, owner_name null.
    const c = new Component() as any;
    identity({ dealerId: 'dealer-demo', brandName: 'Chaurasia Properties' });
    await c.loadIdentity();
    expect(c.ownerName).toBe('Chaurasia Properties');
    // Not repeated on both lines.
    expect(c.bizName).toBe('');
  });

  it('invents nothing when the account cannot be read', async () => {
    const c = new Component() as any;
    vi.spyOn(adapter.auth, 'getDealerIdentity')
      .mockResolvedValue(err('network', 'Could not reach MAPCO.') as never);
    await c.loadIdentity();
    expect(c.ownerName).toBe('');
    expect(c.bizName).toBe('');
    expect(c.identityError).toBeTruthy();
  });

  it('previews the buyer-facing name the buyer will actually see', async () => {
    const c = new Component() as any;
    identity({ dealerId: 'd', brandName: 'Chaurasia Properties', ownerName: 'A Chaurasia' });
    await c.loadIdentity();
    // The buyer page renders dealerDisplayName, filled from branding.brandName.
    expect(c.buyerFacingName()).toBe('Chaurasia Properties');
  });

  it('falls back to the same wording the buyer page uses when nothing is set', async () => {
    const c = new Component() as any;
    identity({ dealerId: 'd' });
    await c.loadIdentity();
    // supabase-adapter fills dealerDisplayName as branding.brandName ?? 'Your dealer'.
    expect(c.buyerFacingName()).toBe('Your dealer');
  });

  it('never renders a hard-coded dealer name anywhere in the screen sources', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    for (const f of ['src/apps/dealer/logic.ts', 'src/apps/dealer/template.ts']) {
      const source = readFileSync(resolve(__dirname, '..', f), 'utf8');
      expect(source, `${f} still names a specific dealer`).not.toMatch(/Rajinder/);
    }
  });
});
