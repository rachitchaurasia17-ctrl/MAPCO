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
   ═══════════════════════════════════════════════════════════════ */
import { formatINR } from '../../packages/ui/utils';
import { adapter } from '../../packages/data/adapter';
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
    <div style="margin-top:24px;font-size:12px;color:#6b5a90;display:flex;align-items:center;justify-content:center;gap:6px"><i class="ph-fill ph-shield-check"></i>Powered by MAPCO · Private link</div>
  </div>
</div>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/* ── valid payload rendering ─────────────────────────────────── */
let activeIndex = 0;
let activeShot = 0;

function renderValid(container: HTMLElement, payload: ClientSafePayload, noPhotos: boolean): void {
  const { dealerDisplayName, properties, voiceNote } = payload;
  const p = properties[activeIndex] || properties[0];
  if (!p) return;
  const multi = properties.length > 1;
  const chosen = p.photos && p.photos.length ? p.photos : [];
  const heroUrl = chosen[activeShot] || '';
  const heroStyle = heroUrl
    ? `position:absolute;inset:0;background-image:url('${esc(heroUrl)}');background-size:cover;background-position:center;transition:background-image .3s ease`
    : `position:absolute;inset:0;background:#241a33;display:grid;place-items:center;color:#6b5a90`;

  const priceLabel = p.price !== undefined ? formatINR(p.price) : 'Price on call';

  const pagerHtml = multi
    ? `<div style="position:absolute;top:62px;left:16px;right:16px;display:flex;gap:6px;z-index:3">
        ${properties.map((_, i) => `<button data-go="${i}" class="pm-client-go" aria-label="View shortlisted property ${i + 1}" ${i === activeIndex ? 'aria-current="true"' : ''} style="flex:1;height:4px;border-radius:2px;background:${i === activeIndex ? '#fff' : 'rgba(255,255,255,.3)'};cursor:pointer;border:none"></button>`).join('')}
       </div>`
    : '';

  const dotsHtml = chosen.length > 1
    ? `<div style="display:flex;align-items:center;gap:7px">
         ${chosen.slice(0, 8).map((_, i) => `<span style="width:6px;height:6px;border-radius:50%;background:${i === activeShot ? '#fff' : 'rgba(255,255,255,.4)'}"></span>`).join('')}
       </div>`
    : '';

  const prevBtn = chosen.length > 1 ? `<button class="pm-client-prev" aria-label="Previous property photo" style="position:absolute;left:10px;top:150px;width:40px;height:40px;border-radius:50%;background:rgba(20,13,32,.6);color:#fff6e0;display:grid;place-items:center;border:none;cursor:pointer"><i class="ph-bold ph-caret-left" style="font-size:18px"></i></button>` : '';
  const nextBtn = chosen.length > 1 ? `<button class="pm-client-next" aria-label="Next property photo" style="position:absolute;right:10px;top:150px;width:40px;height:40px;border-radius:50%;background:rgba(20,13,32,.6);color:#fff6e0;display:grid;place-items:center;border:none;cursor:pointer"><i class="ph-bold ph-caret-right" style="font-size:18px"></i></button>` : '';

  const factsHtml = `
    <span style="display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;color:#fff6e0;background:rgba(255,255,255,.09);border-radius:11px;padding:9px 13px"><i class="ph-fill ph-ruler" style="font-size:15px;color:#ffc93c"></i>${esc(p.size)}</span>
    <span style="display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;color:#fff6e0;background:rgba(255,255,255,.09);border-radius:11px;padding:9px 13px"><i class="ph-fill ph-compass" style="font-size:15px;color:#ffc93c"></i>${esc(p.facing)} facing</span>
    <span style="display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;color:#fff6e0;background:rgba(255,255,255,.09);border-radius:11px;padding:9px 13px"><i class="ph-fill ph-road-horizon" style="font-size:15px;color:#ffc93c"></i>${esc(p.position)}</span>
  `;

  const audioHtml = voiceNote ? `
    <div style="border-radius:20px;padding:18px;margin-top:18px;background:linear-gradient(150deg,#6b3fd4,#3f1f9e);box-shadow:0 18px 40px -20px rgba(107,63,212,.9)">
      <div style="font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#d8c8ff">A message from ${esc(dealerDisplayName)}</div>
      <div style="display:flex;align-items:center;gap:13px;margin-top:12px">
        <span aria-hidden="true" style="width:56px;height:56px;border-radius:50%;background:#ffc93c;color:#241d0c;display:grid;place-items:center;flex:none"><i class="ph-fill ph-waveform" style="font-size:22px"></i></span>
        <div style="flex:1;display:flex;align-items:center;gap:3px;height:38px">
          ${Array.from({ length: 24 }).map((_, i) => `<span style="flex:1;background:rgba(255,255,255,.3);border-radius:2px;height:${10 + ((i * 7) % 20)}px"></span>`).join('')}
        </div>
        <span style="font-size:14px;font-weight:800;color:#fff6e0;flex:none">${voiceNote.seconds}s</span>
      </div>
      <div style="margin-top:8px;font-size:11px;font-weight:700;color:#d8c8ff">Audio playback is unavailable in development mock data.</div>
    </div>` : '';

  const othersHtml = multi ? `
    <div style="font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9d8bc7;margin-top:24px">Also shortlisted for you</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:11px">
      ${properties.map((o, i) => {
        if (i === activeIndex) return '';
        const thumbUrl = o.photos && o.photos.length ? o.photos[0] : '';
        const thumbStyle = thumbUrl ? `background-image:url('${esc(thumbUrl)}');background-size:cover;background-position:center` : `background:#241a33`;
        return `
        <button class="pm-client-go" data-go="${i}" style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:18px;background:rgba(255,255,255,.04);border:none;cursor:pointer;text-align:left">
          <span style="width:64px;height:64px;border-radius:12px;flex:none;${thumbStyle}"></span>
          <span style="flex:1;min-width:0"><span style="display:block;font-size:15.5px;font-weight:800;color:#fffdf7">${esc(o.area)}</span><span style="display:block;font-size:12.5px;font-weight:700;color:#b9a8dd">${esc(o.loc || '')}</span></span>
          <i class="ph-bold ph-caret-right" style="font-size:15px;color:#9d8bc7;flex:none"></i>
        </button>`;
      }).join('')}
    </div>` : '';

  const whyHtml = `
    <div style="font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9d8bc7;margin-top:24px">Why this one</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:11px">
      ${p.landmarks.map(lm => `
        <div style="display:flex;align-items:center;gap:11px;padding:10px 14px;border-radius:13px;background:rgba(255,255,255,.05)">
          <i class="${lm.icon}" style="font-size:19px;color:#ffc93c;flex:none"></i>
          <span style="flex:1;min-width:0;font-size:14.5px;font-weight:700;color:#fff8e6">${esc(lm.name)}</span>
          <span style="font-size:14.5px;font-weight:800;color:#7be0a4;flex:none">${esc(lm.distance)}</span>
        </div>
      `).join('')}
    </div>`;

  const waText = encodeURIComponent('Hi, I saw ' + p.area + ' on MAPCO');
  
  container.innerHTML = `
<div class="pm-buyer" style="background:#0f0a18;min-height:100vh;display:flex;justify-content:center;position:relative">
  <div style="width:100%;max-width:480px;background:#140d20;position:relative;display:flex;flex-direction:column">
    <div style="position:relative;height:330px;flex:none">
      <div style="${heroStyle}"></div>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,10,24,.62) 0%,rgba(15,10,24,.05) 38%,rgba(20,13,32,.96) 100%)"></div>
      <div style="position:absolute;top:16px;left:16px;right:16px;display:flex;align-items:center;gap:10px">
        <div style="width:38px;height:38px;border-radius:50%;background:#ffc93c;color:#241d0c;display:grid;place-items:center;font-size:14px;font-weight:800;flex:none">${esc(dealerDisplayName.charAt(0))}</div>
        <div style="flex:1;min-width:0"><div style="font-size:14.5px;font-weight:800;color:#fff6e0">MAPCO Private</div><div style="font-size:11.5px;font-weight:700;color:#c9b6ef">Chosen for you by ${esc(dealerDisplayName)}</div></div>
      </div>
      <div style="position:absolute;bottom:14px;left:16px;right:16px">
        ${dotsHtml}
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:10px">
          <div>
            <div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#ffc93c">${esc(p.position)}</div>
            <div style="font-family:'Newsreader',serif;font-weight:500;font-size:27px;line-height:1.12;color:#fffdf7;margin-top:4px">${esc(p.area)}</div>
          </div>
          <span style="font-size:11.5px;font-weight:800;color:#fff6e0;background:rgba(255,255,255,.16);border-radius:999px;padding:6px 11px;flex:none">Photo ${activeShot + 1}/${chosen.length || 1}</span>
        </div>
      </div>
      ${pagerHtml}
      ${prevBtn}
      ${nextBtn}
    </div>

    <div style="padding:4px 18px 26px;background:#140d20;flex:1">
      <div style="display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:700;color:#c9b6ef"><i class="ph-fill ph-map-pin" style="font-size:17px;color:#ffc93c"></i>${esc(p.loc || '')}</div>

      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:14px">
        ${factsHtml}
      </div>

      <div style="display:flex;align-items:center;gap:11px;background:linear-gradient(135deg,#ffc93c,#f4881f);border-radius:16px;padding:15px 17px;margin-top:16px">
        <i class="ph-fill ph-tag" style="font-size:21px;color:#3a2410"></i>
        <span style="font-size:19px;font-weight:800;color:#241d0c">${priceLabel}</span>
      </div>

      ${audioHtml}
      ${othersHtml}
      ${whyHtml}

      <div style="margin-top:24px;display:flex;gap:10px">
        <a href="https://wa.me/?text=${waText}" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:15px;background:#12a150;color:#fff;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-whatsapp-logo" style="font-size:19px"></i>WhatsApp</a>
      </div>
      <div style="text-align:center;padding:20px 0 0;font-size:12px;color:#6b5a90"><div style="display:flex;align-items:center;justify-content:center;gap:6px"><i class="ph-fill ph-shield-check" style="font-size:14px"></i>Powered by MAPCO · Private link</div></div>
    </div>
  </div>
</div>`;

  const prev = container.querySelector('.pm-client-prev');
  if (prev) {
    prev.addEventListener('click', () => {
      activeShot = (activeShot - 1 + chosen.length) % chosen.length;
      renderValid(container, payload, noPhotos);
    });
  }
  const next = container.querySelector('.pm-client-next');
  if (next) {
    next.addEventListener('click', () => {
      activeShot = (activeShot + 1) % chosen.length;
      renderValid(container, payload, noPhotos);
    });
  }
  container.querySelectorAll('.pm-client-go').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.currentTarget as HTMLElement).dataset.go || '0', 10);
      activeIndex = idx;
      activeShot = 0;
      renderValid(container, payload, noPhotos);
    });
  });
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
