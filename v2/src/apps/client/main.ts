/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Buyer Page (/client/?token=...)
   Dark magazine layout, framework-free, strict CSP.
   ---------------------------------------------------------------
   SECURITY (20_SECURITY_INVARIANTS + 13_PRIVATE_CLIENT_LINKS):
   • token read from URLSearchParams, stripped from history at once
   • token never rendered, never logged, never stored (local/session)
   • page consumes ONLY ClientSafePayload — seller phone/identity,
     commission, notes, team, internal status are ABSENT from the
     type and payload, not hidden with CSS.
   The buyer page and the dealer "See their page" preview share ONE
   renderer (packages/ui/client-link-view) so they are pixel-identical.
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../packages/data/adapter';
import { renderClientLinkView } from '../../packages/ui/client-link-view';
import type { ClientLinkState } from '../../packages/data/contracts';

/* ── token handling ──────────────────────────────────────────── */
function readAndStripToken(): string {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? '';
  // Remove the token from the address bar + history immediately.
  if (token) window.history.replaceState(null, '', window.location.pathname);
  // Defensive: never leave a token in web storage.
  try {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
  } catch { /* storage may be unavailable under strict privacy */ }
  return token; // held only in this closure; never logged or stored
}

/* ── small state screens (no seller data anywhere) ───────────── */
function stateScreen(icon: string, title: string, body: string): string {
  return `
<div class="pm-buyer" role="alert" aria-live="polite" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px">
  <div style="max-width:380px;text-align:center">
    <div style="width:64px;height:64px;border-radius:20px;background:rgba(255,201,60,.14);color:#ffc93c;display:grid;place-items:center;margin:0 auto 20px"><i class="${icon}" style="font-size:30px"></i></div>
    <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:24px;color:#fff;margin:0 0 8px">${title}</h1>
    <p style="font-size:15px;color:#9a8aad;line-height:1.5;margin:0">${body}</p>
    <div style="margin-top:24px;font-size:12px;color:#6b5a90;display:flex;align-items:center;justify-content:center;gap:6px"><i class="ph-fill ph-shield-check"></i>Powered by MAPCO · Private link</div>
  </div>
</div>`;
}

function render(container: HTMLElement, state: ClientLinkState): void {
  switch (state.kind) {
    case 'resolving':
      container.innerHTML = stateScreen('ph-fill ph-spinner-gap', 'Opening your link…', 'One moment while we load the plots your dealer selected.');
      break;
    case 'valid':
    case 'no-approved-photos':
      renderClientLinkView(container, state.payload);
      break;
    case 'invalid-token':
      container.innerHTML = stateScreen('ph-fill ph-link-break', 'Link not recognised', 'This link is invalid. Please ask your dealer to send a fresh one.');
      break;
    case 'expired':
      container.innerHTML = stateScreen('ph-fill ph-clock-countdown', 'This link has expired', 'For your privacy, links expire after a set time. Ask your dealer for a new link.');
      break;
    case 'revoked':
      container.innerHTML = stateScreen('ph-fill ph-prohibit', 'This link was closed', 'Your dealer has closed this link. Please contact them directly.');
      break;
    case 'unavailable':
      container.innerHTML = stateScreen('ph-fill ph-warning-circle', 'Temporarily unavailable', 'We could not open this link right now. Please try again in a little while.');
      break;
  }
}

async function initClient(container: HTMLElement): Promise<void> {
  const token = readAndStripToken();
  render(container, { kind: 'resolving' });
  const controller = new AbortController();
  window.addEventListener('pagehide', () => controller.abort(), { once: true });
  const result = await adapter.clientLinks.resolve(token, { signal: controller.signal });
  if (!result.ok) {
    render(container, { kind: result.error.code === 'gone' ? 'expired' : 'unavailable' });
    return;
  }
  render(container, result.value);
}

const app = document.getElementById('app');
if (app) void initClient(app);
