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

export interface DealerSession { email: string; userId: string; }

export async function getSession(): Promise<DealerSession | null> {
  const c = await getSupabase();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  const s = data.session;
  return s ? { email: s.user.email ?? '', userId: s.user.id } : null;
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const c = await getSupabase();
  if (!c) return { ok: false, error: 'Backend not configured' };
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  const c = await getSupabase();
  if (c) await c.auth.signOut();
  location.reload();
}

/** Renders a login card into `mount`. Calls onReady() when signed in. */
function renderLogin(mount: HTMLElement, onReady: () => void): void {
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
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (mount.querySelector<HTMLInputElement>('#pm-email')!).value;
    const password = (mount.querySelector<HTMLInputElement>('#pm-pass')!).value;
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Signing in…';
    const res = await signIn(email, password);
    // Reload so data calls run on a clean page load where the session is simply
    // read from storage — the same pattern the (working) presentation uses.
    // Calling adapter methods in the same tick as signIn/getSession deadlocks
    // supabase-js's auth lock and leaves dealer pages stuck on "Loading…".
    if (res.ok) { location.reload(); return; }
    errEl.textContent = res.error ?? 'Sign in failed'; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Sign in';
  });
  mount.querySelector<HTMLInputElement>('#pm-email')!.focus();
}

/** supabase-js persists the session under sb-<ref>-auth-token. Read it directly
 *  (no getSession() auth call) so the gate never touches the auth lock. */
function persistedSessionValid(): boolean {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
    const ref = (env.VITE_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9-]+)\.supabase\.co/)?.[1];
    if (!ref) return false;
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return false;
    const s = JSON.parse(raw);
    return !!s?.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 5000);
  } catch { return false; }
}

/** Gate protected routes: in supabase mode, require a session first.
 *  Visiting any dealer route with ?signout signs out and shows the login. */
export async function requireSession(mount: HTMLElement, onReady: () => void): Promise<void> {
  if (activeDataMode() === 'mock') { onReady(); return; }
  if (new URLSearchParams(location.search).has('signout')) {
    const c = await getSupabase();
    if (c) await c.auth.signOut();
    history.replaceState(null, '', location.pathname);
    renderLogin(mount, onReady);
    return;
  }
  // Gate on the persisted token only — do NOT call getSession() here; it would
  // poison supabase-js's auth lock and hang the page's first data calls.
  if (persistedSessionValid()) { onReady(); return; }
  renderLogin(mount, onReady);
}
