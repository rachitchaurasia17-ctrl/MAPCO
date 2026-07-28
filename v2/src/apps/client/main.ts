/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Buyer Page (/client/)
   Dark magazine layout, framework-free, strict CSP
   Source: Client Presentation.dc.html phone preview + 13_PRIVATE_CLIENT_LINKS_INTERNALS.md
   SECURITY: Never renders seller, commission, or notes.
   ═══════════════════════════════════════════════════════════════ */
import { formatINR } from '../../packages/ui/utils';
import type { Property } from '../../packages/data/types';

async function initClient(container: HTMLElement) {
  // Strip token from URL immediately for security
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (token) {
    window.history.replaceState(null, '', window.location.pathname);
  }

  // (Styles are loaded via external CSS in index.html for strict CSP)

  // In production: use token to call Edge → Supabase RPC
  // For Pass 1: show mock data
  const mockProps: (Pick<Property, 'id' | 'area' | 'loc' | 'size' | 'facing' | 'position' | 'photos' | 'price' | 'landmarks' | 'approvals'>)[] = [
    { id: 'ecocity', area: 'Eco City', loc: 'Eco City, New Chandigarh', size: '500 sq yd', facing: 'North-East', position: 'Park facing', photos: ['/assets/ph-plot-1.png', '/assets/ph-plot-2.png', '/assets/ph-plot-3.png'], price: 9500000, landmarks: [{ name: 'Chandigarh University', distance: '10 min', icon: 'ph-fill ph-graduation-cap' }, { name: 'CP67 Mall', distance: '8 min', icon: 'ph-fill ph-storefront' }], approvals: ['RERA', 'GMADA'] },
    { id: 'block5', area: 'Zone 2', loc: 'Zone 2, New Chandigarh', size: '300 sq yd', facing: 'East', position: 'Corner plot', photos: ['/assets/ph-plot-2.png', '/assets/ph-plot-3.png', '/assets/ph-plot-1.png'], price: 5400000, landmarks: [{ name: 'Delhi Public School', distance: '5 min', icon: 'ph-fill ph-graduation-cap' }, { name: 'Leisure Valley Park', distance: '7 min', icon: 'ph-fill ph-tree' }], approvals: ['GMADA'] },
  ];
  const dealerName = 'Chaurasia Properties';
  const hasVoiceNote = true;
  const voiceSecs = 45;

  container.innerHTML = `
<div class="pm-buyer">
  <!-- Header -->
  <div style="padding:clamp(20px,4vw,34px) clamp(16px,4vw,34px);text-align:center;background:linear-gradient(180deg,#150f24,#0f0a1a);border-bottom:1px solid rgba(139,96,232,.15)">
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;animation:omRise .6s cubic-bezier(.2,.8,.2,1) both">
      <svg viewBox="0 0 40 40" style="width:36px;height:36px"><rect width="40" height="40" rx="12" fill="#ffc93c"></rect><path d="M20 8.5 L33 16 L20 23.5 L7 16 Z" fill="#231a04"></path><path d="M7 22 L20 29.5 L33 22 L33 25.5 L20 33 L7 25.5 Z" fill="#231a04" opacity=".42"></path></svg>
      <span style="font-weight:800;font-size:20px;color:#ffc93c">PlotMap</span>
    </div>
    <div style="margin-top:16px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9a8aad;animation:omRise .7s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">Sent by</div>
    <div style="margin-top:4px;font-family:var(--pm-font-display);font-weight:500;font-size:clamp(22px,5vw,30px);color:#fff;animation:omRise .75s cubic-bezier(.2,.8,.2,1) both;animation-delay:.1s">${dealerName}</div>
    <p style="margin-top:6px;font-size:15px;color:#9a8aad;animation:omRise .8s cubic-bezier(.2,.8,.2,1) both;animation-delay:.14s">${mockProps.length} plots selected for you</p>
  </div>

  <!-- Voice note card -->
  ${hasVoiceNote ? `
  <div style="max-width:540px;margin:0 auto;padding:0 clamp(16px,4vw,34px)">
    <div style="margin-top:24px;padding:18px 22px;border-radius:18px;background:#1a1428;border:1px solid rgba(139,96,232,.2);display:flex;align-items:center;gap:14px;animation:omRise .85s cubic-bezier(.2,.8,.2,1) both;animation-delay:.18s">
      <div style="width:48px;height:48px;border-radius:14px;background:#ffc93c;color:#231a04;display:grid;place-items:center;flex:none"><i class="ph-fill ph-microphone" style="font-size:24px"></i></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:800;color:#f0eaff">Voice note from ${dealerName}</div>
        <div style="font-size:13px;color:#9a8aad;margin-top:2px">${voiceSecs} seconds</div>
      </div>
      <button style="width:44px;height:44px;border-radius:12px;background:rgba(255,194,30,.15);color:#ffc93c;display:grid;place-items:center"><i class="ph-fill ph-play" style="font-size:22px"></i></button>
    </div>
  </div>` : ''}

  <!-- Property cards -->
  <div style="max-width:540px;margin:0 auto;padding:clamp(16px,4vw,28px) clamp(16px,4vw,34px) 40px;display:flex;flex-direction:column;gap:22px">
    ${mockProps.map((p, i) => `
    <div class="pm-buyer-card" style="animation:omRise .9s cubic-bezier(.2,.8,.2,1) both;animation-delay:${(0.22 + i * 0.08).toFixed(2)}s">
      <div style="position:relative;height:clamp(200px,50vw,280px)">
        <div style="position:absolute;inset:0;background-image:url('${p.photos[0]}');background-size:cover;background-position:center"></div>
        <div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(15,10,26,.8),transparent 50%)"></div>
        <div style="position:absolute;bottom:16px;left:16px;right:16px">
          <div style="font-family:var(--pm-font-display);font-weight:500;font-size:clamp(22px,5vw,28px);color:#fff">${p.area}</div>
          <div style="font-size:14px;color:#c9b8e8;margin-top:2px">${p.loc}</div>
        </div>
        <div style="position:absolute;top:14px;right:14px;display:flex;gap:7px">
          ${p.approvals.map(a => `<span style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(255,201,60,.2);color:#ffc93c;backdrop-filter:blur(6px)">${a}</span>`).join('')}
        </div>
      </div>
      <div style="padding:20px 22px">
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          <div style="background:rgba(255,248,230,.08);border-radius:12px;padding:10px 14px;flex:1;min-width:80px"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a8aad">Size</div><div style="font-size:15px;font-weight:800;color:#f0eaff;margin-top:2px">${p.size}</div></div>
          <div style="background:rgba(255,248,230,.08);border-radius:12px;padding:10px 14px;flex:1;min-width:80px"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a8aad">Facing</div><div style="font-size:15px;font-weight:800;color:#f0eaff;margin-top:2px">${p.facing}</div></div>
          <div style="background:rgba(255,248,230,.08);border-radius:12px;padding:10px 14px;flex:1;min-width:80px"><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a8aad">Position</div><div style="font-size:15px;font-weight:800;color:#f0eaff;margin-top:2px">${p.position}</div></div>
        </div>
        <div style="font-family:var(--pm-font-display);font-weight:600;font-size:clamp(24px,6vw,30px);color:#ffc93c;margin-top:16px">${formatINR(p.price)}</div>
        <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a8aad;margin-top:18px">Nearby</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
          ${p.landmarks.map(lm => `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:rgba(255,248,230,.05)">
            <i class="${lm.icon}" style="font-size:18px;color:#ffc93c;flex:none"></i>
            <span style="flex:1;font-size:14px;font-weight:600;color:#f0eaff">${lm.name}</span>
            <span style="font-size:13px;color:#9a8aad;flex:none">${lm.distance}</span>
          </div>`).join('')}
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <a href="https://wa.me/?text=${encodeURIComponent('Hi, I saw ' + p.area + ' on PlotMap')}" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:50px;border-radius:14px;background:#12a150;color:#fff;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-whatsapp-logo" style="font-size:20px"></i>WhatsApp</a>
          <a href="tel:+919876543210" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:50px;border-radius:14px;background:rgba(255,248,230,.1);color:#ffc93c;font-size:15px;font-weight:800;text-decoration:none;border:1px solid rgba(255,194,30,.2)"><i class="ph-fill ph-phone" style="font-size:20px"></i>Call</a>
        </div>
      </div>
    </div>`).join('')}

    <!-- Visit CTA -->
    <button style="width:100%;height:56px;border-radius:16px;background:#ffc93c;color:#231a04;font-size:17px;font-weight:800;box-shadow:0 16px 34px -16px rgba(255,194,30,.6);display:flex;align-items:center;justify-content:center;gap:10px;animation:omRise .95s cubic-bezier(.2,.8,.2,1) both;animation-delay:.4s">
      <i class="ph-fill ph-calendar-check" style="font-size:22px"></i>Book a site visit
    </button>

    <div style="text-align:center;padding:20px 0;font-size:12px;color:#6b5a90;animation:omRise 1s cubic-bezier(.2,.8,.2,1) both;animation-delay:.5s">
      <div style="display:flex;align-items:center;justify-content:center;gap:6px"><i class="ph-fill ph-shield-check" style="font-size:14px"></i>Powered by PlotMap · Private link</div>
    </div>
  </div>
</div>`;
}

const app = document.getElementById('app');
if (app) {
  initClient(app);
}
