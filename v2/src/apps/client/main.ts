/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Buyer Page (/client/?token=...)
   Dark magazine layout, framework-free, strict CSP.
   ---------------------------------------------------------------
   SECURITY (20_SECURITY_INVARIANTS + 13_PRIVATE_CLIENT_LINKS):
   • token read from URLSearchParams, stripped from history at once
   • token never rendered, never logged, never stored (local/session)
   • page consumes ONLY ClientSafePayload — seller phone/identity,
     commission, notes, team, internal status are ABSENT from the
     type and payload, not hidden with CSS.
   ═══════════════════════════════════════════════════════════════ */
import { formatINR } from '../../packages/ui/utils';
import { adapter } from '../../packages/data/mock-adapter-v2';
import type { ClientSafePayload, ClientSafeProperty, ClientLinkState } from '../../packages/data/contracts';

/* ── token handling ──────────────────────────────────────────── */
function readAndStripToken(): string {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? '';
  // Remove the token from the address bar + history immediately.
  if (token) {
    window.history.replaceState(null, '', window.location.pathname);
  }
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
    <div style="margin-top:24px;font-size:12px;color:#6b5a90;display:flex;align-items:center;justify-content:center;gap:6px"><i class="ph-fill ph-shield-check"></i>Powered by PlotMap · Private link</div>
  </div>
</div>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/* ── valid payload rendering ─────────────────────────────────── */
function propertyCard(p: ClientSafeProperty, i: number): string {
  const hero = p.photos[0];
  const heroBlock = hero
    ? `<div style="position:absolute;inset:0;background-image:url('${esc(hero)}');background-size:cover;background-position:center"></div>`
    : `<div style="position:absolute;inset:0;background:#241a33;display:grid;place-items:center;color:#6b5a90"><i class="ph-fill ph-image" style="font-size:40px"></i></div>`;
  return `
<div class="pm-buyer-card" style="animation:omRise .9s cubic-bezier(.2,.8,.2,1) both;animation-delay:${(0.22 + i * 0.08).toFixed(2)}s">
  <div style="position:relative;height:clamp(200px,50vw,280px)">
    ${heroBlock}
    <div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(15,10,26,.8),transparent 50%)"></div>
    <div style="position:absolute;bottom:16px;left:16px;right:16px">
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:clamp(22px,5vw,28px);color:#fff">${esc(p.area)}</div>
      ${p.loc ? `<div style="font-size:14px;color:#c9b8e8;margin-top:2px">${esc(p.loc)}</div>` : ''}
    </div>
    <div style="position:absolute;top:14px;right:14px;display:flex;gap:7px">
      ${p.approvals.map((a) => `<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(255,201,60,.2);color:#ffc93c">${esc(a)}</span>`).join('')}
    </div>
  </div>
  <div style="padding:20px 22px">
    <div style="display:flex;flex-wrap:wrap;gap:10px">
      <div style="background:rgba(255,248,230,.08);border-radius:12px;padding:10px 14px;flex:1;min-width:80px"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a8aad">Size</div><div style="font-size:15px;font-weight:800;color:#f0eaff;margin-top:2px">${esc(p.size)}</div></div>
      <div style="background:rgba(255,248,230,.08);border-radius:12px;padding:10px 14px;flex:1;min-width:80px"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a8aad">Facing</div><div style="font-size:15px;font-weight:800;color:#f0eaff;margin-top:2px">${esc(p.facing)}</div></div>
      <div style="background:rgba(255,248,230,.08);border-radius:12px;padding:10px 14px;flex:1;min-width:80px"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a8aad">Position</div><div style="font-size:15px;font-weight:800;color:#f0eaff;margin-top:2px">${esc(p.position)}</div></div>
    </div>
    ${p.price !== undefined
      ? `<div style="font-family:var(--pm-font-display);font-weight:600;font-size:clamp(24px,6vw,30px);color:#ffc93c;margin-top:16px">${formatINR(p.price)}</div>`
      : `<div style="font-size:14px;font-weight:700;color:#9a8aad;margin-top:16px">Price on request</div>`}
    <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a8aad;margin-top:18px">Nearby</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
      ${p.landmarks.map((lm) => `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:rgba(255,248,230,.05)">
        <i class="${lm.icon}" style="font-size:18px;color:#ffc93c;flex:none"></i>
        <span style="flex:1;font-size:14px;font-weight:600;color:#f0eaff">${esc(lm.name)}</span>
        <span style="font-size:13px;color:#9a8aad;flex:none">${esc(lm.distance)}</span>
      </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <a href="https://wa.me/?text=${encodeURIComponent('Hi, I saw ' + p.area + ' on PlotMap')}" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:50px;border-radius:14px;background:#12a150;color:#fff;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-whatsapp-logo" style="font-size:20px"></i>WhatsApp</a>
      <a href="tel:" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:50px;border-radius:14px;background:rgba(255,248,230,.1);color:#ffc93c;font-size:15px;font-weight:800;text-decoration:none;border:1px solid rgba(255,194,30,.2)"><i class="ph-fill ph-phone" style="font-size:20px"></i>Call dealer</a>
    </div>
  </div>
</div>`;
}

function renderValid(container: HTMLElement, payload: ClientSafePayload, noPhotos: boolean): void {
  const { dealerDisplayName, properties, voiceNote } = payload;
  container.innerHTML = `
<div class="pm-buyer">
  <div style="padding:clamp(20px,4vw,34px) clamp(16px,4vw,34px);text-align:center;background:linear-gradient(180deg,#150f24,#0f0a1a);border-bottom:1px solid rgba(139,96,232,.15)">
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;animation:omRise .6s cubic-bezier(.2,.8,.2,1) both">
      <svg viewBox="0 0 40 40" style="width:36px;height:36px"><rect width="40" height="40" rx="12" fill="#ffc93c"></rect><path d="M20 8.5 L33 16 L20 23.5 L7 16 Z" fill="#231a04"></path><path d="M7 22 L20 29.5 L33 22 L33 25.5 L20 33 L7 25.5 Z" fill="#231a04" opacity=".42"></path></svg>
      <span style="font-weight:800;font-size:20px;color:#ffc93c">PlotMap</span>
    </div>
    <div style="margin-top:16px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9a8aad">Sent by</div>
    <div style="margin-top:4px;font-family:var(--pm-font-display);font-weight:500;font-size:clamp(22px,5vw,30px);color:#fff">${esc(dealerDisplayName)}</div>
    <p style="margin-top:6px;font-size:15px;color:#9a8aad">${properties.length} ${properties.length === 1 ? 'plot' : 'plots'} selected for you</p>
  </div>
  ${voiceNote ? `
  <div style="max-width:540px;margin:0 auto;padding:0 clamp(16px,4vw,34px)">
    <div style="margin-top:24px;padding:18px 22px;border-radius:18px;background:#1a1428;border:1px solid rgba(139,96,232,.2);display:flex;align-items:center;gap:14px">
      <div style="width:48px;height:48px;border-radius:14px;background:#ffc93c;color:#231a04;display:grid;place-items:center;flex:none"><i class="ph-fill ph-microphone" style="font-size:24px"></i></div>
      <div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#f0eaff">Voice note from your dealer</div><div style="font-size:13px;color:#9a8aad;margin-top:2px">${voiceNote.seconds} seconds</div></div>
      <button aria-label="Play voice note" style="width:44px;height:44px;border-radius:12px;background:rgba(255,194,30,.15);color:#ffc93c;display:grid;place-items:center"><i class="ph-fill ph-play" style="font-size:22px"></i></button>
    </div>
  </div>` : ''}
  ${noPhotos ? `<div style="max-width:540px;margin:16px auto 0;padding:0 clamp(16px,4vw,34px)"><div style="padding:14px 18px;border-radius:14px;background:rgba(255,201,60,.08);color:#c9b8e8;font-size:14px;text-align:center">Photos are being prepared and will appear here shortly.</div></div>` : ''}
  <div style="max-width:540px;margin:0 auto;padding:clamp(16px,4vw,28px) clamp(16px,4vw,34px) 40px;display:flex;flex-direction:column;gap:22px">
    ${properties.map((p, i) => propertyCard(p, i)).join('')}
    <button style="width:100%;height:56px;border-radius:16px;background:#ffc93c;color:#231a04;font-size:17px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px"><i class="ph-fill ph-calendar-check" style="font-size:22px"></i>Book a site visit</button>
    <div style="text-align:center;padding:20px 0;font-size:12px;color:#6b5a90"><div style="display:flex;align-items:center;justify-content:center;gap:6px"><i class="ph-fill ph-shield-check" style="font-size:14px"></i>Powered by PlotMap · Private link</div></div>
  </div>
</div>`;
}

function render(container: HTMLElement, state: ClientLinkState): void {
  switch (state.kind) {
    case 'resolving':
      container.innerHTML = stateScreen('ph-fill ph-spinner-gap', 'Opening your link…', 'One moment while we load the plots your dealer selected.');
      break;
    case 'valid':
      renderValid(container, state.payload, false);
      break;
    case 'no-approved-photos':
      renderValid(container, state.payload, true);
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
if (app) {
  void initClient(app);
}
