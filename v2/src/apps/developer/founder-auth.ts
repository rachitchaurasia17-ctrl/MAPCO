import { getSupabase, shouldDetectAuthSessionInUrl } from '../../packages/data/supabase/client';

type CallbackLocation = Pick<Location, 'pathname' | 'search' | 'hash'>;

/** Capture this before Supabase removes tokens from a successful auth URL. */
export function isFounderCredentialCallback(
  value: CallbackLocation = location,
): boolean {
  return shouldDetectAuthSessionInUrl(value);
}

function renderShell(mount: HTMLElement, body: string): void {
  mount.innerHTML = `<main class="fc"><section style="max-width:520px;margin:10vh auto">${body}</section></main>`;
}

/** Complete a Supabase invite/recovery only for the server-authorized Founder.
 * The browser never receives an admin key and a forged callback cannot cross
 * plotmap_founder_bootstrap's confirmed-email check. */
export async function mountFounderCredentialSetup(
  mount: HTMLElement,
  requested: boolean,
  onComplete: () => void = () => location.reload(),
): Promise<boolean> {
  if (!requested) return false;
  const client = await getSupabase();
  if (!client) {
    renderShell(mount, '<h1>Founder setup unavailable</h1><p role="alert">MAPCO-DEV is not configured in this build.</p>');
    return true;
  }

  const identity = await client.auth.getUser();
  if (identity.error || !identity.data.user) {
    renderShell(mount, '<h1>Founder setup link expired</h1><p role="alert">Request a new secure setup link and open it in this browser.</p><a href="/admin/developer.html">Return to sign in</a>');
    return true;
  }
  const bootstrapped = await client.rpc('plotmap_founder_bootstrap');
  const authorized = bootstrapped.error
    ? { data: false, error: bootstrapped.error }
    : await client.rpc('plotmap_is_platform_admin');
  if (authorized.error || authorized.data !== true) {
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    renderShell(mount, '<h1>Founder access denied</h1><p role="alert">This setup link is not authorized for Founder Control.</p><a href="/admin/developer.html">Return to sign in</a>');
    return true;
  }

  renderShell(mount, `<h1>Secure Founder account</h1>
    <p>Set the password for Founder Control. Use at least 12 characters.</p>
    <form data-founder-password novalidate>
      <label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" required></label>
      <label>Confirm password<input name="confirm" type="password" autocomplete="new-password" minlength="12" required></label>
      <p role="alert" hidden></p><p role="status" hidden></p>
      <button type="submit">Save password</button>
    </form>`);
  const form = mount.querySelector<HTMLFormElement>('[data-founder-password]')!;
  const alert = form.querySelector<HTMLElement>('[role=alert]')!;
  const status = form.querySelector<HTMLElement>('[role=status]')!;
  const submit = form.querySelector<HTMLButtonElement>('button')!;
  let saving = false;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (saving || !form.reportValidity()) return;
    const data = new FormData(form);
    const password = String(data.get('password') ?? '');
    const confirmation = String(data.get('confirm') ?? '');
    alert.hidden = true;
    status.hidden = true;
    if (password.length < 12) {
      alert.textContent = 'Use at least 12 characters.';
      alert.hidden = false;
      return;
    }
    if (password !== confirmation) {
      alert.textContent = 'The passwords do not match.';
      alert.hidden = false;
      return;
    }
    saving = true;
    submit.disabled = true;
    submit.textContent = 'Saving…';
    void client.auth.updateUser({ password }).then(async ({ error }) => {
      if (error) throw error;
      const revoked = await client.auth.signOut({ scope: 'others' });
      if (revoked.error) throw revoked.error;
      history.replaceState(null, '', location.pathname);
      status.textContent = 'Password saved. Opening Founder Control…';
      status.hidden = false;
      onComplete();
    }).catch((error: unknown) => {
      alert.textContent = error instanceof Error ? error.message : 'Password could not be saved.';
      alert.hidden = false;
      saving = false;
      submit.disabled = false;
      submit.textContent = 'Save password';
    });
  });
  return true;
}
