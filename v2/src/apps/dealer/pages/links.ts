/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Dealer Dashboard: Client Links
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../../packages/data/mock-adapter-v2';
import { getInitials } from '../../../packages/auth/auth';

export async function renderLinks(el: HTMLElement) {
  el.innerHTML = '<div role="status" aria-live="polite" style="max-width:720px;margin:40px auto;padding:24px;color:#6b6156">Loading client links…</div>';
  const result = await adapter.clientLinks.list({ limit: 100 });
  if (!result.ok) {
    el.innerHTML = '<div role="alert" aria-live="assertive" style="max-width:720px;margin:40px auto;padding:24px;border-radius:18px;background:#fffaf0;color:#6b6156">Client links could not be loaded.</div>';
    return;
  }
  const links = result.value.items;
  const liveCount = links.filter(l => l.status === 'active').length;
  const totalOpens = links.reduce((s, l) => s + l.events.opens, 0);

  const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#d9f5e3', color: '#0b6f39', label: 'Live' },
    revoked: { bg: '#ffe1e6', color: '#c2185b', label: 'Stopped' },
    expired: { bg: '#f6ecd8', color: '#8a6a14', label: 'Expired' },
  };

  el.innerHTML = `
<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div>
      <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">Client Links</h1>
      <p style="margin-top:8px;font-size:17px;color:#6b6156">Private pages you sent after a meeting — one link can hold up to 4 plots.</p>
    </div>
    <button style="display:flex;align-items:center;gap:9px;padding:16px 24px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16.5px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85);cursor:pointer;transition:background .15s" onmouseenter="this.style.background='#f4ae14'" onmouseleave="this.style.background='#ffc93c'"><i class="ph-fill ph-paper-plane-tilt" style="font-size:19px"></i>Send a new link</button>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
    <div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:24px 26px">
      <div style="font-size:14px;color:#8a6a14;font-weight:800">Live right now</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:44px;line-height:1;color:#1f1a12;margin-top:8px">${liveCount} links</div>
    </div>
    <div style="background:#efe8fb;border:1.5px solid #ddd0f5;border-radius:20px;padding:24px 26px">
      <div style="font-size:14px;color:#6b6156;font-weight:800">Times your links were opened</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:44px;line-height:1;color:#5b32c4;margin-top:8px">${totalOpens}</div>
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:14px;margin-top:22px">
    ${links.map(l => {
      const ss = statusStyle[l.status] || statusStyle.active;
      const isActive = l.status === 'active';
      return `
    <div style="background:#faf7ff;border:1px solid #e4dbf7;border-radius:22px;padding:22px 26px;box-shadow:var(--pm-shadow-card)">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:48px;height:48px;border-radius:50%;background:#efe8fb;color:#6b3fd4;display:grid;place-items:center;font-size:16px;font-weight:800;flex:none">${getInitials(l.clientName)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:19px;font-weight:800;color:#241f1c">${l.clientName}</div>
          <div style="font-size:13.5px;color:#8d8271">${l.propNames.length} plot${l.propNames.length > 1 ? 's' : ''} · ${l.expiry} expiry · ${l.loc} location</div>
        </div>
        <div style="text-align:right;flex:none">
          <div style="font-family:var(--pm-font-display);font-weight:600;font-size:26px;color:#241f1c">${l.events.opens}</div>
          <div style="font-size:12.5px;color:#8d8271">Last: ${l.lastOpen}</div>
        </div>
        <span style="font-size:12px;font-weight:800;padding:6px 14px;border-radius:999px;background:${ss.bg};color:${ss.color}">${ss.label}</span>
      </div>
      <div style="font-size:15px;font-weight:700;color:#4c463d;margin-top:14px">Plots in this link:</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px">
        ${l.propNames.map(name => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:800;padding:6px 12px;border-radius:999px;background:#f7e7c6;color:#8a6a14"><i class="ph-fill ph-map-pin-area" style="font-size:14px"></i>${name}</span>`).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px">
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 12px;border-radius:999px;background:${l.audio === 'done' ? '#e2f2e6' : '#f3eeff'};color:${l.audio === 'done' ? '#186c3c' : '#6b6156'}"><i class="ph-fill ph-microphone" style="font-size:14px"></i>${l.audio === 'done' ? l.audioSecs + 's voice note' : 'No voice note'}</span>
        ${l.events.played > 0 ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 12px;border-radius:999px;background:#e2f2e6;color:#186c3c"><i class="ph-fill ph-waveform" style="font-size:14px"></i>Heard your voice note</span>` : ''}
        ${l.events.called > 0 ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 12px;border-radius:999px;background:#e2f2e6;color:#186c3c"><i class="ph-fill ph-phone" style="font-size:14px"></i>Tapped call</span>` : ''}
        ${l.events.wa > 0 ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 12px;border-radius:999px;background:#e2f2e6;color:#186c3c"><i class="ph-fill ph-whatsapp-logo" style="font-size:14px"></i>Tapped WhatsApp</span>` : ''}
        ${l.events.visit > 0 ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 12px;border-radius:999px;background:#e2f2e6;color:#186c3c"><i class="ph-fill ph-calendar-check" style="font-size:14px"></i>Asked for a visit</span>` : ''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid #f6e8c8">
        <button style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:12px;background:#efe8fb;color:#6b3fd4;font-size:15px;font-weight:800;cursor:pointer;transition:background .15s" onmouseenter="this.style.background='#e2d6fa'" onmouseleave="this.style.background='#efe8fb'"><i class="ph-fill ph-device-mobile" style="font-size:18px"></i>See their page</button>
        ${isActive ? `
        <button style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:12px;background:#e2f2e6;color:#146c3a;font-size:15px;font-weight:800;cursor:pointer;transition:background .15s" onmouseenter="this.style.background='#cbe9d4'" onmouseleave="this.style.background='#e2f2e6'"><i class="ph-fill ph-whatsapp-logo" style="font-size:18px"></i>Send again</button>
        <button style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:12px;background:#ffe1e6;color:#c2185b;font-size:15px;font-weight:800;cursor:pointer;transition:background .15s" onmouseenter="this.style.background='#f7c4cd'" onmouseleave="this.style.background='#ffe1e6'"><i class="ph-fill ph-prohibit" style="font-size:18px"></i>Stop this link</button>` : ''}
        <div style="flex:1"></div>
        <button style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:12px;background:#f3eeff;color:#8a7a52;font-size:15px;font-weight:800;cursor:pointer;transition:background .15s" onmouseenter="this.style.background='#ddd2f5'" onmouseleave="this.style.background='#f3eeff'"><i class="ph-fill ph-trash" style="font-size:18px"></i>Delete</button>
      </div>
    </div>`;
    }).join('')}
  </div>

  ${links.length === 0 ? `<div style="padding:40px;text-align:center;font-size:16px;color:#8d8271;background:#faf7ff;border:1.5px dashed #e6cf9a;border-radius:20px;margin-top:20px">No links sent yet. Tap "Send a new link" after your next meeting.</div>` : ''}
</div>`;
}
