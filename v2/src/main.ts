import './packages/ui/tokens.css';
import './packages/ui/reset.css';
import { getGreeting, getInitials, getFirstName, getProfile } from './packages/auth/auth';
import { adapter } from './packages/data/adapter';

// Load Phosphor Icons from CDN
const iconLinks = [
  '/assets/phosphor/regular/style.css',
  '/assets/phosphor/fill/style.css',
  '/assets/phosphor/bold/style.css',
];
iconLinks.forEach(href => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
});

function initLanding(container: HTMLElement) {
  const profile = getProfile();
  const greeting = getGreeting() + ', ' + getFirstName(profile.name);
  const initials = getInitials(profile.name);
  const now = new Date();
  const today = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    + ' · ' + now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

  container.innerHTML = `
<style>
  @keyframes lRise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
  @keyframes lFade{from{opacity:0}to{opacity:1}}
  @keyframes lWide{from{opacity:0;letter-spacing:.6em}to{opacity:1;letter-spacing:.34em}}
  @keyframes lPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.6);opacity:0}}
  @keyframes lBloomA{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(6%,4%,0) scale(1.18)}}
  @keyframes lBloomB{0%,100%{transform:translate3d(0,0,0) scale(1.1)}50%{transform:translate3d(-7%,5%,0) scale(1)}}
  @keyframes lBloomC{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(4%,-6%,0) scale(1.22)}}
  @keyframes lGlowRing{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.95;transform:scale(1.06)}}
  @keyframes lSlide{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}
  
  .pm-modal-overlay{position:fixed;inset:0;background:rgba(15,10,26,.6);backdrop-filter:blur(12px);z-index:100;display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .3s ease}
  .pm-modal-content{background:#fffaf0;border-radius:24px;width:90%;max-width:440px;padding:32px 36px;box-shadow:0 30px 60px -20px rgba(40,30,10,.5);transform:translateY(20px);transition:transform .3s cubic-bezier(.2,.8,.2,1)}
  .pm-modal-overlay.active{display:flex;opacity:1}
  .pm-modal-overlay.active .pm-modal-content{transform:translateY(0)}
  
  .pm-land-card-1:hover{transform:translateY(-10px);box-shadow:0 2px 3px rgba(40,30,10,.05),0 44px 70px -34px rgba(255,175,20,.9) !important;border-color:#ffc93c !important;}
  .pm-land-card-2:hover{transform:translateY(-10px);box-shadow:0 2px 3px rgba(40,30,10,.05),0 44px 70px -34px rgba(18,161,80,.75) !important;border-color:#12a150 !important;}
  .pm-land-card-3:hover{transform:translateY(-10px);box-shadow:0 2px 3px rgba(40,30,10,.05),0 44px 70px -34px rgba(151,110,235,.8) !important;border-color:#976eeb !important;}
</style>
<div class="pm-landing" style="position:fixed;inset:0;overflow:hidden;background:#f7ecd6;font-family:var(--pm-font-ui);display:flex;flex-direction:column">

  <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">
    <div style="position:absolute;width:70vw;height:70vw;left:-16vw;top:-22vw;border-radius:50%;background:radial-gradient(circle,rgba(255,201,60,.72),rgba(255,201,60,0) 68%);animation:lBloomA 26s ease-in-out infinite"></div>
    <div style="position:absolute;width:62vw;height:62vw;right:-14vw;top:-18vw;border-radius:50%;background:radial-gradient(circle,rgba(151,110,235,.42),rgba(151,110,235,0) 68%);animation:lBloomB 32s ease-in-out infinite"></div>
    <div style="position:absolute;width:74vw;height:74vw;left:14vw;bottom:-40vw;border-radius:50%;background:radial-gradient(circle,rgba(31,161,110,.34),rgba(31,161,110,0) 66%);animation:lBloomC 29s ease-in-out infinite"></div>
    <div style="position:absolute;width:46vw;height:46vw;right:2vw;bottom:-24vw;border-radius:50%;background:radial-gradient(circle,rgba(255,150,90,.38),rgba(255,150,90,0) 68%);animation:lBloomA 34s ease-in-out infinite"></div>
    <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(120,92,40,.055) 0 1px,transparent 1px 88px),repeating-linear-gradient(0deg,rgba(120,92,40,.055) 0 1px,transparent 1px 88px)"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(105% 78% at 50% 42%,rgba(255,250,238,.62) 0%,rgba(247,236,214,.2) 52%,rgba(240,226,196,.62) 100%)"></div>
  </div>

  <div style="position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:clamp(14px,2.2vh,22px) clamp(20px,3vw,40px);flex:none;animation:lFade .8s ease both">
    <div style="display:flex;align-items:center;gap:9px">
      <span style="position:relative;width:9px;height:9px;flex:none;display:block">
        <span style="position:absolute;inset:0;border-radius:50%;background:#12a150"></span>
        <span style="position:absolute;inset:0;border-radius:50%;background:#12a150;animation:lPulse 2.4s ease-out infinite"></span>
      </span>
      <span style="font-size:12px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#12704a">Tricity</span>
      <span style="width:4px;height:4px;border-radius:50%;background:#c9b48a"></span>
      <span style="font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9a8a68">Live</span>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <button id="pm-activate-btn" style="background:rgba(255,194,30,.2);color:#8a5a0c;border:none;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:800;cursor:pointer;transition:background .2s;display:flex;align-items:center;gap:6px">
        <i class="ph-bold ph-key"></i>Activate Device
      </button>
      <div style="text-align:right;line-height:1.25">
        <div id="pm-land-greeting" style="font-size:14px;font-weight:800;color:#3a332c">${greeting}</div>
        <div id="pm-land-date" style="font-size:12px;color:#94886c">${today}</div>
      </div>
      <div style="width:38px;height:38px;border-radius:12px;background:#1a2f24;color:#ffd75e;display:grid;place-items:center;font-size:14px;font-weight:800;flex:none;box-shadow:0 10px 20px -12px rgba(26,47,36,.9)">${initials}</div>
    </div>
  </div>

  <div style="position:relative;z-index:2;flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(16px,3.4vh,34px);padding:0 clamp(20px,3vw,40px) clamp(10px,1.6vh,18px)">

    <div style="display:flex;flex-direction:column;align-items:center;text-align:center;flex:none">
      <div style="position:relative;width:clamp(56px,7.4vh,78px);height:clamp(56px,7.4vh,78px);animation:lRise .9s cubic-bezier(.2,.8,.2,1) both">
        <div style="position:absolute;inset:-10px;border-radius:22px;background:radial-gradient(circle,rgba(255,201,60,.6),transparent 70%);animation:lGlowRing 4.2s ease-in-out infinite"></div>
        <img src="/assets/mapco-logo.png" alt="MAPCO" style="position:relative;width:100%;height:100%;display:block;object-fit:contain;filter:drop-shadow(0 10px 20px rgba(120,86,10,.3))">
      </div>

      <h1 style="margin:clamp(10px,1.8vh,18px) 0 0;font-family:var(--pm-font-display);font-weight:500;font-size:clamp(46px,9.4vh,96px);line-height:.9;letter-spacing:-.035em;color:#16281e;animation:lRise 1s cubic-bezier(.2,.8,.2,1) both;animation-delay:.08s">MAPCO</h1>

      <div style="margin-top:clamp(8px,1.5vh,15px);font-size:clamp(10px,1.35vh,13px);font-weight:800;letter-spacing:.34em;text-transform:uppercase;color:#a8792a;animation:lWide 1.4s cubic-bezier(.2,.8,.2,1) both;animation-delay:.3s">Property Presentation System</div>

      <p style="margin:clamp(10px,1.8vh,18px) 0 0;max-width:480px;font-size:clamp(14px,1.9vh,17px);line-height:1.5;color:#6b6156;text-wrap:pretty;animation:lRise 1s cubic-bezier(.2,.8,.2,1) both;animation-delay:.16s">Every map, every plot, every client — one calm room. Choose where the day starts.</p>
    </div>

    <div class="pm-land-cards" style="display:flex;gap:clamp(12px,1.4vw,20px);width:100%;max-width:1160px;flex:0 1 auto;min-height:0">

      <a href="/app/earth/index.html" class="pm-land-card-1" style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;border-radius:clamp(18px,2.4vh,26px);background:#fffaf0;border:1px solid #f2dca6;box-shadow:0 2px 3px rgba(40,30,10,.04),0 30px 56px -38px rgba(120,86,10,.8);color:inherit;text-decoration:none;transition:transform .38s cubic-bezier(.2,.8,.2,1),box-shadow .38s ease,border-color .3s ease;animation:lRise .95s cubic-bezier(.2,.8,.2,1) both;animation-delay:.2s">
        <div style="position:relative;flex:none;height:clamp(84px,13vh,120px);background:#ffc93c;background-image:radial-gradient(120% 130% at 12% 8%,#ffe28a,#f7b21f 62%,#e79a0c);overflow:hidden">
          <div style="position:absolute;inset:0;background:repeating-linear-gradient(58deg,rgba(255,255,255,.24) 0 2px,transparent 2px 26px)"></div>
          <div style="position:absolute;right:-18px;bottom:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.24)"></div>
          <div style="position:absolute;left:clamp(16px,2vw,22px);top:50%;transform:translateY(-50%);width:clamp(42px,6vh,54px);height:clamp(42px,6vh,54px);border-radius:16px;background:#1a2f24;color:#ffd75e;display:grid;place-items:center;box-shadow:0 14px 26px -14px rgba(26,47,36,.8)"><i class="ph-fill ph-globe-hemisphere-west" style="font-size:clamp(21px,3vh,27px)"></i></div>
          <div style="position:absolute;right:clamp(16px,2vw,22px);top:clamp(10px,1.4vh,14px);font-family:var(--pm-font-display);font-size:clamp(20px,3vh,27px);color:rgba(26,47,36,.42)">01</div>
        </div>
        <div style="padding:clamp(14px,2.2vh,22px) clamp(16px,2vw,24px) clamp(16px,2.4vh,24px);display:flex;flex-direction:column;flex:1;min-height:0">
          <div style="font-size:clamp(10px,1.3vh,11.5px);font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a8792a">The Real World</div>
          <div style="margin-top:6px;font-family:var(--pm-font-display);font-weight:500;font-size:clamp(21px,3.4vh,30px);line-height:1.05;letter-spacing:-.02em;color:#241f1c">MAPCO Earth</div>
          <p style="margin:8px 0 0;font-size:clamp(13px,1.7vh,15px);line-height:1.45;color:#6b6156;text-wrap:pretty">Find any plot, sector or landmark on live satellite — see exactly where a property sits on the ground.</p>
          <div style="display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:clamp(12px,1.8vh,20px);font-size:clamp(14px,1.8vh,15.5px);font-weight:800;color:#8a5a0c">Open the map <i class="ph-bold ph-arrow-right" style="font-size:15px;animation:lSlide 2.6s ease-in-out infinite"></i></div>
        </div>
      </a>

      <a href="/admin/owner.html" class="pm-land-card-2" style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;border-radius:clamp(18px,2.4vh,26px);background:#fffaf0;border:1px solid #c9e4d5;box-shadow:0 2px 3px rgba(40,30,10,.04),0 30px 56px -38px rgba(20,60,42,.8);color:inherit;text-decoration:none;transition:transform .38s cubic-bezier(.2,.8,.2,1),box-shadow .38s ease,border-color .3s ease;animation:lRise .95s cubic-bezier(.2,.8,.2,1) both;animation-delay:.28s">
        <div style="position:relative;flex:none;height:clamp(84px,13vh,120px);background:#1f4d3a;background-image:radial-gradient(120% 130% at 88% 6%,#37876a,#1f4d3a 58%,#143528);overflow:hidden">
          <div style="position:absolute;inset:0;background:repeating-linear-gradient(122deg,rgba(255,255,255,.12) 0 2px,transparent 2px 26px)"></div>
          <div style="position:absolute;left:-24px;bottom:-34px;width:130px;height:130px;border-radius:50%;background:rgba(122,224,164,.22)"></div>
          <div style="position:absolute;left:clamp(16px,2vw,22px);top:50%;transform:translateY(-50%);width:clamp(42px,6vh,54px);height:clamp(42px,6vh,54px);border-radius:16px;background:#ffc93c;color:#1a2f24;display:grid;place-items:center;box-shadow:0 14px 26px -14px rgba(0,0,0,.6)"><i class="ph-fill ph-chart-donut" style="font-size:clamp(21px,3vh,27px)"></i></div>
          <div style="position:absolute;right:clamp(16px,2vw,22px);top:clamp(10px,1.4vh,14px);font-family:var(--pm-font-display);font-size:clamp(20px,3vh,27px);color:rgba(217,245,227,.5)">02</div>
        </div>
        <div style="padding:clamp(14px,2.2vh,22px) clamp(16px,2vw,24px) clamp(16px,2.4vh,24px);display:flex;flex-direction:column;flex:1;min-height:0">
          <div style="font-size:clamp(10px,1.3vh,11.5px);font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#12704a">For you</div>
          <div style="margin-top:6px;font-family:var(--pm-font-display);font-weight:500;font-size:clamp(21px,3.4vh,30px);line-height:1.05;letter-spacing:-.02em;color:#241f1c">Dealer Dashboard</div>
          <p style="margin:8px 0 0;font-size:clamp(13px,1.7vh,15px);line-height:1.45;color:#6b6156;text-wrap:pretty">Real demand signals, your best clients, closed deals and every client link.</p>
          <div style="display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:clamp(12px,1.8vh,20px);font-size:clamp(14px,1.8vh,15.5px);font-weight:800;color:#12704a">Enter command <i class="ph-bold ph-arrow-right" style="font-size:15px;animation:lSlide 2.6s ease-in-out infinite;animation-delay:.3s"></i></div>
        </div>
      </a>

      <a href="/admin/team.html" class="pm-land-card-3" style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;border-radius:clamp(18px,2.4vh,26px);background:#fffaf0;border:1px solid #ded1f4;box-shadow:0 2px 3px rgba(40,30,10,.04),0 30px 56px -38px rgba(70,40,150,.7);color:inherit;text-decoration:none;transition:transform .38s cubic-bezier(.2,.8,.2,1),box-shadow .38s ease,border-color .3s ease;animation:lRise .95s cubic-bezier(.2,.8,.2,1) both;animation-delay:.36s">
        <div style="position:relative;flex:none;height:clamp(84px,13vh,120px);background:#5b32c4;background-image:radial-gradient(120% 130% at 18% 4%,#a983f5,#6a3ed6 58%,#4a26a8);overflow:hidden">
          <div style="position:absolute;inset:0;background:repeating-linear-gradient(58deg,rgba(255,255,255,.14) 0 2px,transparent 2px 26px)"></div>
          <div style="position:absolute;right:-20px;top:-34px;width:126px;height:126px;border-radius:50%;background:rgba(255,255,255,.16)"></div>
          <div style="position:absolute;left:clamp(16px,2vw,22px);top:50%;transform:translateY(-50%);width:clamp(42px,6vh,54px);height:clamp(42px,6vh,54px);border-radius:16px;background:#ffe1e6;color:#5b32c4;display:grid;place-items:center;box-shadow:0 14px 26px -14px rgba(40,20,90,.7)"><i class="ph-fill ph-pen-nib" style="font-size:clamp(21px,3vh,27px)"></i></div>
          <div style="position:absolute;right:clamp(16px,2vw,22px);top:clamp(10px,1.4vh,14px);font-family:var(--pm-font-display);font-size:clamp(20px,3vh,27px);color:rgba(239,232,251,.5)">03</div>
        </div>
        <div style="padding:clamp(14px,2.2vh,22px) clamp(16px,2vw,24px) clamp(16px,2.4vh,24px);display:flex;flex-direction:column;flex:1;min-height:0">
          <div style="font-size:clamp(10px,1.3vh,11.5px);font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#5b32c4">For your team</div>
          <div style="margin-top:6px;font-family:var(--pm-font-display);font-weight:500;font-size:clamp(21px,3.4vh,30px);line-height:1.05;letter-spacing:-.02em;color:#241f1c">Team Workspace</div>
          <p style="margin:8px 0 0;font-size:clamp(13px,1.7vh,15px);line-height:1.45;color:#6b6156;text-wrap:pretty">Add properties, mark maps in Map Studio, send private client links.</p>
          <div style="display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:clamp(12px,1.8vh,20px);font-size:clamp(14px,1.8vh,15.5px);font-weight:800;color:#5b32c4">Open workspace <i class="ph-bold ph-arrow-right" style="font-size:15px;animation:lSlide 2.6s ease-in-out infinite;animation-delay:.6s"></i></div>
        </div>
      </a>

    </div>

    <div class="pm-land-footer" style="display:flex;align-items:center;justify-content:center;gap:clamp(12px,1.6vw,24px);flex-wrap:wrap;flex:none;animation:lFade 1.2s ease both;animation-delay:.5s">
      <div style="display:flex;align-items:center;gap:7px;font-size:clamp(11.5px,1.5vh,13.5px);color:#8d8271"><i class="ph-fill ph-shield-check" style="font-size:16px;color:#12704a"></i>Only what you publish is ever visible to a client</div>
      <span style="width:5px;height:5px;border-radius:50%;background:#d3c49c"></span>
      <div style="display:flex;align-items:center;gap:7px;font-size:clamp(11.5px,1.5vh,13.5px);color:#8d8271"><i class="ph-fill ph-cloud-check" style="font-size:16px;color:#a8792a"></i>Studio changes reach the client screen instantly</div>
    </div>

  </div>

  <!-- Device Activation Modal -->
  <div id="pm-activation-modal" class="pm-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="pm-activation-title" aria-hidden="true">
    <div class="pm-modal-content" tabindex="-1">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
        <h2 id="pm-activation-title" style="font-family:var(--pm-font-display);font-size:24px;font-weight:500;color:#241f1c;letter-spacing:-.02em">Activate Device</h2>
        <button id="pm-close-modal" aria-label="Close device activation" style="background:none;border:none;cursor:pointer;color:#9a8f7c;padding:4px"><i class="ph-bold ph-x" style="font-size:20px"></i></button>
      </div>
      <p style="font-size:15px;color:#6b6156;line-height:1.5;margin-bottom:24px">Enter the 6-digit activation code provided by your MAPCO platform administrator.</p>
      
      <div style="display:flex;flex-direction:column;gap:16px">
        <label for="pm-act-code" class="pm-sr-only">Six-digit activation code</label>
        <input type="text" id="pm-act-code" inputmode="numeric" autocomplete="one-time-code" aria-describedby="pm-act-error" placeholder="000-000" style="width:100%;height:52px;border-radius:14px;border:1px solid #ddd2f5;padding:0 16px;font-family:var(--pm-font-ui);font-size:16px;text-align:center;letter-spacing:4px;font-weight:700;color:#1f1a12;background:#fff" maxlength="7">
        
        <div id="pm-act-error" role="alert" aria-live="assertive" style="display:none;color:#c2185b;font-size:13px;font-weight:700;text-align:center;padding:8px;background:#ffe1e6;border-radius:8px">Invalid activation code.</div>
        
        <button id="pm-act-submit" disabled aria-disabled="true" style="width:100%;height:52px;border-radius:14px;background:#ffc93c;color:#231a04;font-size:16px;font-weight:800;border:none;cursor:not-allowed;opacity:.65;box-shadow:0 8px 16px -8px rgba(255,194,30,.6)">Activate this device</button>
      </div>
    </div>
  </div>
</div>`;

  // Live clock
  const updateClock = () => {
    const now = new Date();
    const h = now.getHours();
    const part = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const el1 = document.getElementById('pm-land-greeting');
    const el2 = document.getElementById('pm-land-date');
    if (el1) el1.textContent = part + ', ' + getFirstName(profile.name);
    if (el2) el2.textContent = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  };
  setInterval(updateClock, 60000);

  // Modal logic
  const modal = document.getElementById('pm-activation-modal')!;
  const btnOpen = document.getElementById('pm-activate-btn')!;
  const btnClose = document.getElementById('pm-close-modal')!;
  const inputCode = document.getElementById('pm-act-code') as HTMLInputElement;
  const submitCode = document.getElementById('pm-act-submit') as HTMLButtonElement;
  const errorMsg = document.getElementById('pm-act-error')!;
  let previouslyFocused: HTMLElement | null = null;

  const closeModal = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    previouslyFocused?.focus();
  };

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      previouslyFocused = document.activeElement as HTMLElement | null;
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      inputCode.value = '';
      errorMsg.style.display = 'none';
      submitCode.disabled = true;
      submitCode.setAttribute('aria-disabled', 'true');
      submitCode.textContent = 'Activate this device';
      submitCode.style.cssText += ';cursor:not-allowed;opacity:.65;background:#ffc93c;color:#231a04';
      inputCode.focus();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', closeModal);
  }
  
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  if (inputCode) {
    inputCode.addEventListener('input', (e) => {
      let val = inputCode.value.replace(/[^0-9]/g, '');
      if (val.length > 3) val = val.slice(0, 3) + '-' + val.slice(3, 6);
      inputCode.value = val;
      errorMsg.style.display = 'none';
      const ready = val.replace(/\D/g, '').length === 6;
      submitCode.disabled = !ready;
      submitCode.setAttribute('aria-disabled', String(!ready));
      submitCode.style.cursor = ready ? 'pointer' : 'not-allowed';
      submitCode.style.opacity = ready ? '1' : '.65';
    });
  }

  const submitActivation = async () => {
    if (submitCode.disabled) return;
    submitCode.disabled = true;
    submitCode.textContent = 'Checking…';
    const result = await adapter.auth.submitActivationCode(inputCode.value);
    if (!result.ok) {
      errorMsg.textContent = 'Could not verify the code. Please try again.';
      errorMsg.style.display = 'block';
    } else if (result.value.kind === 'activated') {
      submitCode.textContent = 'Device activated';
      submitCode.style.background = '#12a150';
      submitCode.style.color = '#fff';
      btnOpen.innerHTML = '<i class="ph-fill ph-check-circle"></i>Device active';
      window.setTimeout(closeModal, 550);
      return;
    } else {
      const messages: Record<string, string> = {
        'invalid-code': 'That activation code is not valid.',
        'expired-code': 'That activation code has expired.',
        'device-limit-reached': 'The device limit has already been reached.',
        'device-approval-required': 'This device is waiting for administrator approval.',
      };
      errorMsg.textContent = messages[result.value.kind] || 'This device could not be activated.';
      errorMsg.style.display = 'block';
    }
    submitCode.textContent = 'Activate this device';
    submitCode.disabled = false;
  };
  submitCode.addEventListener('click', () => { void submitActivation(); });
  inputCode.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); void submitActivation(); }
  });

}

const app = document.getElementById('app');
if (app) {
  initLanding(app);
}
