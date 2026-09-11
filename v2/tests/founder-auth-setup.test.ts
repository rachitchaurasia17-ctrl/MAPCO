// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ client: null as any }));
vi.mock('../src/packages/data/supabase/client', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/packages/data/supabase/client')>(),
  getSupabase: async () => mocks.client,
}));

import { isFounderCredentialCallback, mountFounderCredentialSetup } from '../src/apps/developer/founder-auth';
import { shouldDetectAuthSessionInUrl } from '../src/packages/data/supabase/client';

function callback(pathname: string, search = '', hash = '') { return { pathname, search, hash } as Location; }

function client(authorized = true) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'founder' } }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: { user: { id: 'founder' } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockImplementation((name: string) => Promise.resolve({
      data: name === 'plotmap_founder_bootstrap' || authorized,
      error: null,
    })),
  };
}

describe('Founder Auth callback boundary', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="app"></div>'; mocks.client = client(); });

  it('detects invite/recovery sessions only on the private Founder route', () => {
    expect(shouldDetectAuthSessionInUrl(callback('/admin/developer.html', '?code=pkce'))).toBe(true);
    expect(shouldDetectAuthSessionInUrl(callback('/admin/developer.html', '', '#access_token=x&type=recovery'))).toBe(true);
    expect(isFounderCredentialCallback(callback('/admin/developer.html', '', '#access_token=x&type=invite'))).toBe(true);
    expect(shouldDetectAuthSessionInUrl(callback('/admin/owner.html', '?code=pkce'))).toBe(false);
    expect(shouldDetectAuthSessionInUrl(callback('/admin/developer.html', '', '#access_token=x&type=magiclink'))).toBe(false);
  });

  it('rejects an authenticated callback that the backend does not authorize', async () => {
    mocks.client = client(false);
    const root = document.querySelector<HTMLElement>('#app')!;
    await mountFounderCredentialSetup(root, true, vi.fn());
    expect(root.textContent).toContain('Founder access denied');
    expect(mocks.client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('updates a matching password then revokes other sessions', async () => {
    const root = document.querySelector<HTMLElement>('#app')!;
    const complete = vi.fn();
    await mountFounderCredentialSetup(root, true, complete);
    const form = root.querySelector<HTMLFormElement>('form')!;
    (form.elements.namedItem('password') as HTMLInputElement).value = 'correct horse battery';
    (form.elements.namedItem('confirm') as HTMLInputElement).value = 'correct horse battery';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(complete).toHaveBeenCalled());
    expect(mocks.client.auth.updateUser).toHaveBeenCalledWith({ password: 'correct horse battery' });
    expect(mocks.client.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('keeps password update errors visible and allows retry', async () => {
    mocks.client.auth.updateUser.mockResolvedValueOnce({ data: null, error: new Error('Password rejected') });
    const root = document.querySelector<HTMLElement>('#app')!;
    await mountFounderCredentialSetup(root, true, vi.fn());
    const form = root.querySelector<HTMLFormElement>('form')!;
    (form.elements.namedItem('password') as HTMLInputElement).value = 'correct horse battery';
    (form.elements.namedItem('confirm') as HTMLInputElement).value = 'correct horse battery';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(root.querySelector('[role=alert]')!.textContent).toContain('Password rejected'));
    expect(root.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false);
  });
});
