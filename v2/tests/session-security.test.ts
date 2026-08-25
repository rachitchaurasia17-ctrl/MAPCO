// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mode: 'supabase' as 'mock' | 'supabase',
  client: null as any,
  publishResourceInvalidation: vi.fn(),
}));

vi.mock('../src/packages/data/adapter', () => ({
  activeDataMode: () => mocks.mode,
}));
vi.mock('../src/packages/data/supabase/client', () => ({
  getSupabase: async () => mocks.client,
}));
vi.mock('../src/packages/performance', () => ({
  publishResourceInvalidation: mocks.publishResourceInvalidation,
}));

import {
  clearPrivateBrowserState,
  getSession,
  hasPlatformAdminAccess,
  requireSession,
} from '../src/packages/data/session';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function makeClient(user: { id: string; email?: string } | null = null) {
  let authChange: ((event: string) => void) | null = null;
  const unsubscribe = vi.fn();
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'invalid session' },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: { message: 'invalid credentials' } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn((callback: (event: string) => void) => {
        authChange = callback;
        return { data: { subscription: { unsubscribe } } };
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    emitAuthChange(event: string) { authChange?.(event); },
    unsubscribe,
  };
}

describe('protected session boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mode = 'supabase';
    mocks.client = makeClient(null);
    document.body.innerHTML = '';
    localStorage.clear();
    window.history.replaceState({}, '', '/admin/owner.html');
  });

  it('accepts an identity only after Supabase Auth validates it server-side', async () => {
    mocks.client = makeClient({ id: 'user-a', email: 'dealer-a@example.test' });

    await expect(getSession()).resolves.toEqual({
      email: 'dealer-a@example.test',
      userId: 'user-a',
    });
    expect(mocks.client.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it('clears dealer-private caches when the verified browser identity changes', async () => {
    localStorage.setItem('mapco.security.privateCacheOwner.v1', 'user-a');
    localStorage.setItem('mapco.earth.savedLocations.v1', '{"private":true}');
    localStorage.setItem('mapco.marketing.plans.v1', '{"private":true}');
    localStorage.setItem('mapco.ops.assets.v1', '{"private":true}');
    localStorage.setItem('unrelated.preference', 'keep');
    mocks.client = makeClient({ id: 'user-b', email: 'dealer-b@example.test' });

    await getSession();

    expect(localStorage.getItem('mapco.earth.savedLocations.v1')).toBeNull();
    expect(localStorage.getItem('mapco.marketing.plans.v1')).toBeNull();
    expect(localStorage.getItem('mapco.ops.assets.v1')).toBeNull();
    expect(localStorage.getItem('unrelated.preference')).toBe('keep');
    expect(localStorage.getItem('mapco.security.privateCacheOwner.v1')).toBe('user-b');
  });

  it('clears known private state without deleting Supabase auth storage', () => {
    localStorage.setItem('mapco.earth.apiMeter.v1', '[]');
    localStorage.setItem('sb-project-auth-token', 'session-owned-by-supabase');
    clearPrivateBrowserState();
    expect(localStorage.getItem('mapco.earth.apiMeter.v1')).toBeNull();
    expect(localStorage.getItem('sb-project-auth-token')).toBe('session-owned-by-supabase');
  });

  it('fails closed when browser storage contains a counterfeit token', async () => {
    localStorage.setItem('sb-fake-auth-token', JSON.stringify({
      access_token: 'attacker-controlled',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    }));
    const mount = document.createElement('main');
    const onReady = vi.fn();

    await requireSession(mount, onReady);

    expect(mocks.client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(mount.querySelector('#pm-login')).not.toBeNull();
  });

  it('fails closed when server validation is unavailable', async () => {
    mocks.client.auth.getUser.mockRejectedValueOnce(new Error('network unavailable'));
    const mount = document.createElement('main');
    const onReady = vi.fn();

    await requireSession(mount, onReady);

    expect(onReady).not.toHaveBeenCalled();
    expect(mount.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('renders a protected route only after validation and re-gates on cross-tab sign-out', async () => {
    mocks.client = makeClient({ id: 'user-a', email: 'dealer-a@example.test' });
    const mount = document.createElement('main');
    const onReady = vi.fn(() => { mount.textContent = 'private route'; });

    await requireSession(mount, onReady);

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(mount.textContent).toBe('private route');
    mocks.client.emitAuthChange('SIGNED_OUT');
    expect(mount.querySelector('#pm-login')).not.toBeNull();
  });

  it('single-flights repeated login submissions', async () => {
    const signInRequest = deferred<{ error: { message: string } }>();
    mocks.client.auth.signInWithPassword.mockImplementation(() => signInRequest.promise);
    const mount = document.createElement('main');
    await requireSession(mount, vi.fn());

    mount.querySelector<HTMLInputElement>('#pm-email')!.value = 'dealer@example.test';
    mount.querySelector<HTMLInputElement>('#pm-pass')!.value = 'password';
    const form = mount.querySelector<HTMLFormElement>('#pm-login')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(mocks.client.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    });
    signInRequest.resolve({ error: { message: 'invalid credentials' } });
    await vi.waitFor(() => {
      expect(mount.querySelector<HTMLButtonElement>('#pm-login-btn')!.disabled).toBe(false);
    });
  });
});

describe('platform-admin authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mode = 'supabase';
    mocks.client = makeClient({ id: 'user-a', email: 'dealer-a@example.test' });
  });

  it('allows access only when the trusted RPC returns literal true', async () => {
    mocks.client.rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(hasPlatformAdminAccess()).resolves.toBe(true);
    expect(mocks.client.rpc).toHaveBeenCalledWith('plotmap_is_platform_admin');

    mocks.client.rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    await expect(hasPlatformAdminAccess()).resolves.toBe(false);
  });

  it('never grants platform-admin access in mock mode', async () => {
    mocks.mode = 'mock';
    await expect(hasPlatformAdminAccess()).resolves.toBe(false);
    expect(mocks.client.rpc).not.toHaveBeenCalled();
  });
});
