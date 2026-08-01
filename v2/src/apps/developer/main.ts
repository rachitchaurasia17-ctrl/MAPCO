/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Developer Control
   Platform admin page (shell chrome + placeholder content)
   ═══════════════════════════════════════════════════════════════ */
import { getProfile } from '../../packages/auth/auth';

function initDeveloperControl(container: HTMLElement) {
  const profile = getProfile();

  // Mock Session Check
  if (!profile.isPlatformAdmin) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f5efff;background-image:var(--pm-bloom);font-family:var(--pm-font-sans)">
        <i class="ph-fill ph-lock-key" style="font-size:48px;color:#c2185b;margin-bottom:16px"></i>
        <h1 style="font-size:24px;font-weight:800;color:#1f1a12">Access Denied</h1>
        <p style="margin-top:8px;font-size:15px;color:#6b6156">You must be a Platform Admin to view this page.</p>
        <a href="/" style="margin-top:24px;padding:10px 20px;background:#5b32c4;color:#fff;border-radius:12px;text-decoration:none;font-weight:700" onmouseenter="this.style.background='#4a26a8'" onmouseleave="this.style.background='#5b32c4'">Return to Home</a>
      </div>
    `;
    return;
  }

  // Include reset + tokens globally
  const head = document.head;
  if (!head.querySelector('#pm-styles')) {
    const style = document.createElement('style');
    style.id = 'pm-styles';
    style.innerHTML = `@import '/src/packages/ui/reset.css'; @import '/src/packages/ui/tokens.css';`;
    head.appendChild(style);
  }

  container.innerHTML = `
<style>
  .pm-dev{display:flex;flex-direction:column;height:100vh;min-height:0;width:100%;overflow:hidden;background:#f5efff;background-image:var(--pm-bloom);background-attachment:fixed}
</style>
<div class="pm-dev">
  <header style="display:flex;align-items:center;gap:16px;padding:14px 34px;border-bottom:1px solid #ddd2f5;background:rgba(252,250,255,.86);backdrop-filter:blur(12px);flex:none;z-index:30">
    <button id="pm-dev-back" aria-label="Go back" title="Go back" style="display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 13px;border-radius:11px;background:#f0eaff;color:#4b2ea6;font:inherit;font-size:14px;font-weight:800;cursor:pointer;border:1px solid rgba(120,80,220,.16)"><i class="ph-bold ph-arrow-left" style="font-size:16px"></i>Back</button>
    <a href="/" style="display:flex;align-items:center;gap:10px;text-decoration:none">
      <svg viewBox="0 0 40 40" style="width:36px;height:36px;flex:none"><rect width="40" height="40" rx="12" fill="#241d0c"></rect><path d="M20 8.5 L33 16 L20 23.5 L7 16 Z" fill="#ffc93c"></path><path d="M7 22 L20 29.5 L33 22 L33 25.5 L20 33 L7 25.5 Z" fill="#f4ae14" opacity="0.55"></path><circle cx="20" cy="16" r="3.6" fill="#241d0c"></circle></svg>
      <span style="font-weight:800;font-size:20px;letter-spacing:-.02em;color:#1f1a12">Plot<span style="color:#c2622a">Map</span></span>
    </a>
    <div style="width:1px;height:22px;background:#ddd2f5"></div>
    <span style="font-size:16px;font-weight:800;color:#5b32c4"><i class="ph-fill ph-shield-check" style="font-size:18px;margin-right:6px"></i>Developer Control</span>
    <div style="flex:1"></div>
    <span style="font-size:12.5px;font-weight:800;padding:6px 14px;border-radius:999px;background:#efe8fb;color:#5b32c4">Platform Admin</span>
  </header>
  <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden" data-scroll>
    <div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px">
      <div style="animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
        <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:38px;letter-spacing:-.02em;color:#241f1c">Developer Control Panel</h1>
        <p style="margin-top:8px;font-size:17px;color:#6b6156">Manage dealers, monitor usage, provision trials and subscriptions.</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:26px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
        <div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:18px;padding:20px 22px">
          <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8a6a14">Total dealers</div>
          <div style="font-family:var(--pm-font-display);font-weight:500;font-size:40px;line-height:1;color:#241d0c;margin-top:6px">12</div>
        </div>
        <div style="background:#d9f5e3;border:1px solid #b3e0c6;border-radius:18px;padding:20px 22px">
          <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0b6f39">Active trials</div>
          <div style="font-family:var(--pm-font-display);font-weight:500;font-size:40px;line-height:1;color:#12a150;margin-top:6px">5</div>
        </div>
        <div style="background:#efe8fb;border:1px solid #ddd0f5;border-radius:18px;padding:20px 22px">
          <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#5b32c4">Paid plans</div>
          <div style="font-family:var(--pm-font-display);font-weight:500;font-size:40px;line-height:1;color:#5b32c4;margin-top:6px">7</div>
        </div>
        <div style="background:#ffe1e6;border:1px solid #f7c4cd;border-radius:18px;padding:20px 22px">
          <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#c2185b">Expiring soon</div>
          <div style="font-family:var(--pm-font-display);font-weight:500;font-size:40px;line-height:1;color:#c2185b;margin-top:6px">2</div>
        </div>
      </div>

      <div style="margin-top:22px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:22px;overflow:hidden;box-shadow:var(--pm-shadow-card);animation:omRise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.12s">
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 120px;gap:12px;padding:14px 22px;border-bottom:1px solid #e4dbf7;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8d8271">
          <span>Dealer</span><span>Plan</span><span>Properties</span><span>Links sent</span><span>Status</span>
        </div>
        ${[
          { name: 'Chaurasia Properties', plan: 'Pro', props: 8, links: 4, status: 'active' },
          { name: 'Sethi Real Estate', plan: 'Trial', props: 3, links: 1, status: 'active' },
          { name: 'Mohali Prime Deals', plan: 'Pro', props: 15, links: 12, status: 'active' },
          { name: 'Chandigarh Plots Hub', plan: 'Trial', props: 2, links: 0, status: 'expiring' },
          { name: 'Tricity Estates', plan: 'Basic', props: 6, links: 3, status: 'active' },
        ].map(d => `
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 120px;gap:12px;align-items:center;padding:16px 22px;border-bottom:1px solid #f6e8c8;cursor:pointer;transition:background .12s" onmouseenter="this.style.background='#efe8fb'" onmouseleave="this.style.background='transparent'">
          <div style="font-size:15px;font-weight:700;color:#241f1c">${d.name}</div>
          <div style="font-size:14px;font-weight:700;color:${d.plan === 'Pro' ? '#5b32c4' : d.plan === 'Trial' ? '#c85a1a' : '#6b6156'}">${d.plan}</div>
          <div style="font-size:14px;font-weight:600;color:#241f1c">${d.props}</div>
          <div style="font-size:14px;font-weight:600;color:#241f1c">${d.links}</div>
          <div><span style="font-size:12px;font-weight:800;padding:5px 12px;border-radius:999px;background:${d.status === 'active' ? '#d9f5e3' : '#ffe1e6'};color:${d.status === 'active' ? '#0b6f39' : '#c2185b'}">${d.status === 'active' ? 'Active' : 'Expiring'}</span></div>
        </div>`).join('')}
      </div>

      <div style="margin-top:20px;padding:22px 26px;border-radius:22px;background:#fffaf0;border:1.5px solid #f6e3ab;animation:omRise .65s cubic-bezier(.2,.8,.2,1) both;animation-delay:.18s">
        <div style="display:flex;align-items:center;gap:12px">
          <i class="ph-fill ph-info" style="font-size:22px;color:#a8792a"></i>
          <div>
            <div style="font-size:15px;font-weight:800;color:#241f1c">Pass 1 — Design Shell Only</div>
            <div style="font-size:14px;color:#6b6156;margin-top:2px">This page shows the design chrome for the Developer Control panel. Full functionality (provisioning, trial management, dealer actions) will be wired in Pass 2 when the data adapter connects to Supabase.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

  // Back → previous admin surface (or Dealer Home fallback).
  container.querySelector<HTMLButtonElement>('#pm-dev-back')?.addEventListener('click', () => {
    const ref = document.referrer;
    const safe = window.history.length > 1 && !!ref && (() => { try { return new URL(ref).origin === location.origin; } catch { return false; } })();
    if (safe) window.history.back(); else window.location.assign('/admin/owner.html');
  });
}

const app = document.getElementById('app');
if (app) {
  initDeveloperControl(app);
}
