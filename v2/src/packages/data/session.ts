/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Dealer session + login gate
   ---------------------------------------------------------------
   Real Supabase email/password auth for the dealer app. In mock mode
   there is no gate (a mock owner session is assumed). In supabase mode
   the dealer must sign in before protected routes render — this is
   what makes Map Studio + real-data testing work on a deployed site.
   No password is ever stored by us; supabase-js persists the session.
   ═══════════════════════════════════════════════════════════════ */
import { getSupabase } from './supabase/client';
import { activeDataMode } from './adapter';
import { publishResourceInvalidation } from '../performance';

export interface DealerSession { email: string; userId: string; }

const PRIVATE_CACHE_OWNER_KEY = 'mapco.security.privateCacheOwner.v1';
const PRIVATE_CACHE_PREFIXES = ['mapco.earth.', 'mapco.marketing.', 'mapco.ops.'];

/** Remove dealer-sensitive browser caches without touching Supabase's own
 * session keys or harmless UI preferences. */
export function clearPrivateBrowserState(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key === PRIVATE_CACHE_OWNER_KEY
          || PRIVATE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    delete (window as Window & { __mapcoUsage?: unknown }).__mapcoUsage;
  } catch {
    // Private mode/storage denial must not prevent authentication or logout.
  }
}

function bindPrivateBrowserState(userId: string): void {
  try {
    const previous = localStorage.getItem(PRIVATE_CACHE_OWNER_KEY);
    // `null` also clears pre-Phase-1 unowned caches on the first validated load.
    if (previous !== userId) clearPrivateBrowserState();
    localStorage.setItem(PRIVATE_CACHE_OWNER_KEY, userId);
  } catch { /* storage is optional */ }
}

/**
 * Return the current identity only after Supabase Auth has verified the access
 * token with its `/user` endpoint. A value found in browser storage is never
 * sufficient to cross a protected-route boundary.
 */
export async function getSession(): Promise<DealerSession | null> {
  try {
    const c = await getSupabase();
    if (!c) return null;
    const { data, error } = await c.auth.getUser();
    if (error || !data.user) return null;
    bindPrivateBrowserState(data.user.id);
    return { email: data.user.email ?? '', userId: data.user.id };
  } catch {
    // Network, configuration, and malformed-session failures all deny access.
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const c = await getSupabase();
  if (!c) return { ok: false, error: 'Backend not configured' };
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) {
    clearPrivateBrowserState();
    publishResourceInvalidation({ entity: 'dealer-session', id: 'signed-in' });
  }
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  const c = await getSupabase();
  clearPrivateBrowserState();
  publishResourceInvalidation({ entity: 'dealer-session', id: 'signed-out' });
  if (c) await c.auth.signOut();
  location.reload();
}

/** Renders a login card into `mount`. Calls onReady() when signed in. */
function renderLogin(mount: HTMLElement, onReady: () => void | Promise<void>): void {
  mount.innerHTML = `
<div style="position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#e7ddfb;background-image:radial-gradient(64% 52% at -2% -4%,rgba(123,78,224,.5),transparent 64%),radial-gradient(72% 62% at 100% 100%,rgba(255,201,60,.32),transparent 64%);font-family:var(--pm-font-ui)">
  <div style="width:100%;max-width:400px;background:#fffaf0;border:1px solid #ecdca6;border-radius:24px;padding:32px 30px;box-shadow:0 30px 60px -24px rgba(40,30,10,.4)">
    <div style="display:flex;align-items:center;gap:10px">
      <svg viewBox="0 0 40 40" style="width:34px;height:34px"><rect width="40" height="40" rx="12" fill="#ffc93c"></rect><path d="M20 8.5 L33 16 L20 23.5 L7 16 Z" fill="#231a04"></path><path d="M7 22 L20 29.5 L33 22 L33 25.5 L20 33 L7 25.5 Z" fill="#231a04" opacity=".42"></path></svg>
      <span style="font-family:var(--pm-font-display);font-weight:600;font-size:20px;color:#241f1c">MAPCO</span>
    </div>
    <h1 style="margin:20px 0 4px;font-family:var(--pm-font-display);font-weight:500;font-size:26px;color:#241f1c">Dealer sign in</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b6156">Sign in to manage your maps, plots and links.</p>
    <form id="pm-login" novalidate>
      <label style="display:block;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8d8271;margin-bottom:6px">Email</label>
      <input id="pm-email" type="email" autocomplete="username" required style="width:100%;height:48px;border:1px solid #ddd2f5;border-radius:14px;padding:0 14px;font-size:15px;font-family:inherit;margin-bottom:14px;background:#fff">
      <label style="display:block;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#8d8271;margin-bottom:6px">Password</label>
      <input id="pm-pass" type="password" autocomplete="current-password" required style="width:100%;height:48px;border:1px solid #ddd2f5;border-radius:14px;padding:0 14px;font-size:15px;font-family:inherit;margin-bottom:8px;background:#fff">
      <div id="pm-login-err" role="alert" style="display:none;font-size:13px;font-weight:700;color:#c2185b;background:#ffe1e6;border-radius:10px;padding:9px 12px;margin:6px 0 4px"></div>
      <button id="pm-login-btn" type="submit" style="width:100%;height:50px;margin-top:14px;border-radius:14px;background:#ffc93c;color:#231a04;font-size:16px;font-weight:800;box-shadow:0 12px 22px -10px rgba(255,194,30,.7)">Sign in</button>
    </form>
  </div>
</div>`;
  const form = mount.querySelector<HTMLFormElement>('#pm-login')!;
  const errEl = mount.querySelector<HTMLElement>('#pm-login-err')!;
  const btn = mount.querySelector<HTMLButtonElement>('#pm-login-btn')!;
  let submitting = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    const email = (mount.querySelector<HTMLInputElement>('#pm-email')!).value;
    const password = (mount.querySelector<HTMLInputElement>('#pm-pass')!).value;
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Signing in…';
    const res = await signIn(email, password).catch(() => ({ ok: false, error: 'Sign in failed' }));
    // Reload so every data adapter starts with the newly persisted session.
    if (res.ok) { location.reload(); return; }
    errEl.textContent = res.error ?? 'Sign in failed'; errEl.style.display = 'block';
    submitting = false;
    btn.disabled = false; btn.textContent = 'Sign in';
  });
  mount.querySelector<HTMLInputElement>('#pm-email')!.focus();
}

/** Server-authoritative platform-admin check. Never trusts profile/UI flags. */
export async function hasPlatformAdminAccess(): Promise<boolean> {
  try {
    if (activeDataMode() === 'mock') return false;
    const c = await getSupabase();
    if (!c) return false;
    const { data, error } = await c.rpc('plotmap_is_platform_admin');
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Gate protected routes: in supabase mode, require a session first.
 *  Visiting any dealer route with ?signout signs out and shows the login. */
export async function requireSession(mount: HTMLElement, onReady: () => void | Promise<void>): Promise<void> {
  if (activeDataMode() === 'mock') { await onReady(); return; }
  if (new URLSearchParams(location.search).has('signout')) {
    const c = await getSupabase();
    clearPrivateBrowserState();
    if (c) await c.auth.signOut({ scope: 'local' }).catch(() => undefined);
    history.replaceState(null, '', location.pathname);
    renderLogin(mount, onReady);
    return;
  }
  const session = await getSession();
  if (!session) {
    renderLogin(mount, onReady);
    return;
  }

  // If another tab signs out, immediately put this protected surface back
  // behind the gate. Database RLS remains the final authorization boundary.
  const c = await getSupabase();
  const subscription = c?.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      clearPrivateBrowserState();
      renderLogin(mount, onReady);
    }
  }).data.subscription;
  if (subscription) {
    window.addEventListener('pagehide', () => subscription.unsubscribe(), { once: true });
  }
  await onReady();
}
