/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Team Workspace: Work Table (Home)
   Three launcher cards + Map Studio hero
   Source: Team Workspace.dc.html
   ═══════════════════════════════════════════════════════════════ */

export function renderWorkHome(el: HTMLElement) {
  el.innerHTML = `
<div style="max-width:1120px;margin:0 auto;padding:34px 40px 70px">
  <div style="animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:38px;letter-spacing:-.02em;color:#241f1c">The Work Table</h1>
    <p style="margin-top:8px;font-size:17px;color:#6b6156">Everything that feeds the presentation. Add properties, mark maps, manage your data.</p>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:28px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
    <div style="border-radius:24px;overflow:hidden;background:#ffc93c;background-image:linear-gradient(140deg,#ffdc7a,#f4ae14);box-shadow:0 20px 50px -24px rgba(244,174,20,.8);cursor:pointer;transition:transform .2s" onmouseenter="this.style.transform='translateY(-4px)'" onmouseleave="this.style.transform='none'">
      <div style="padding:28px 26px 24px">
        <div style="width:54px;height:54px;border-radius:16px;background:#1a2f24;color:#ffd75e;display:grid;place-items:center;box-shadow:0 12px 24px -12px rgba(26,47,36,.8)"><i class="ph-fill ph-pen-nib" style="font-size:26px"></i></div>
        <div style="margin-top:18px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a6a14">Map Studio</div>
        <div style="margin-top:6px;font-family:var(--pm-font-display);font-weight:500;font-size:26px;letter-spacing:-.02em;color:#241d0c">Mark your maps</div>
        <p style="margin-top:6px;font-size:14px;color:#6b5a20;line-height:1.45">Upload a masterplan, draw roads and blocks, pin properties.</p>
      </div>
    </div>

    <div style="border-radius:24px;overflow:hidden;background:#1f4d3a;background-image:linear-gradient(140deg,#37876a,#1f4d3a 58%,#143528);box-shadow:0 20px 50px -24px rgba(18,112,74,.8);cursor:pointer;transition:transform .2s" onmouseenter="this.style.transform='translateY(-4px)'" onmouseleave="this.style.transform='none'">
      <div style="padding:28px 26px 24px">
        <div style="width:54px;height:54px;border-radius:16px;background:#ffc93c;color:#1a2f24;display:grid;place-items:center;box-shadow:0 12px 24px -12px rgba(255,201,60,.8)"><i class="ph-fill ph-buildings" style="font-size:26px"></i></div>
        <div style="margin-top:18px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#a3d6bc">Properties</div>
        <div style="margin-top:6px;font-family:var(--pm-font-display);font-weight:500;font-size:26px;letter-spacing:-.02em;color:#fff8e6">Add your stock</div>
        <p style="margin-top:6px;font-size:14px;color:#9acfb6;line-height:1.45">Upload photos, set price, choose sector and facing. Everything your clients see.</p>
      </div>
    </div>

    <div style="border-radius:24px;overflow:hidden;background:#5b32c4;background-image:linear-gradient(140deg,#8a63e8,#5b32c4 58%,#4a26a8);box-shadow:0 20px 50px -24px rgba(91,50,196,.8);cursor:pointer;transition:transform .2s" onmouseenter="this.style.transform='translateY(-4px)'" onmouseleave="this.style.transform='none'">
      <div style="padding:28px 26px 24px">
        <div style="width:54px;height:54px;border-radius:16px;background:#ffe1e6;color:#5b32c4;display:grid;place-items:center;box-shadow:0 12px 24px -12px rgba(255,225,230,.8)"><i class="ph-fill ph-users-three" style="font-size:26px"></i></div>
        <div style="margin-top:18px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#d8c8ff">Clients</div>
        <div style="margin-top:6px;font-family:var(--pm-font-display);font-weight:500;font-size:26px;letter-spacing:-.02em;color:#fff">Manage clients</div>
        <p style="margin-top:6px;font-size:14px;color:#c4b0f0;line-height:1.45">Add buyers, track what they want, link them to properties and deals.</p>
      </div>
    </div>
  </div>

  <div style="margin-top:28px;border-radius:28px;overflow:hidden;background:#241d0c;background-image:linear-gradient(140deg,#3a2f14 0%,#241d0c 60%,#150f04 100%);box-shadow:0 26px 60px -34px rgba(20,14,2,.95);padding:34px 36px;animation:omRise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.12s">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
      <div>
        <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c9a94a">Map Studio</div>
        <h2 style="margin-top:8px;font-family:var(--pm-font-display);font-weight:500;font-size:34px;letter-spacing:-.02em;color:#fff8e6">Your maps are the product</h2>
        <p style="margin-top:8px;font-size:16px;color:#c9b48a;max-width:520px">Upload your masterplan, draw roads and sectors, pin properties. What you publish here is what your clients see in the full-screen presentation.</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px">
      <div style="border-radius:20px;padding:22px 24px;background:rgba(255,248,230,.08);border:1px solid rgba(255,248,230,.12)">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:#ffc93c;color:#241d0c;display:grid;place-items:center;font-weight:900;font-size:15px;flex:none">1</div>
          <span style="font-size:16px;font-weight:800;color:#fff8e6">Publish Masterplan</span>
        </div>
        <p style="margin-top:10px;font-size:14px;color:#c9b48a;line-height:1.45">Upload your city masterplan image, draw roads and block boundaries.</p>
      </div>
      <div style="border-radius:20px;padding:22px 24px;background:rgba(255,248,230,.08);border:1px solid rgba(255,248,230,.12)">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:#5b32c4;color:#fff;display:grid;place-items:center;font-weight:900;font-size:15px;flex:none">2</div>
          <span style="font-size:16px;font-weight:800;color:#fff8e6">Publish Sector Maps</span>
        </div>
        <p style="margin-top:10px;font-size:14px;color:#c9b48a;line-height:1.45">Add close-up sector maps and mark individual plots on them.</p>
      </div>
      <div style="border-radius:20px;padding:22px 24px;background:rgba(255,248,230,.08);border:1px solid rgba(255,248,230,.12)">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:#12a150;color:#fff;display:grid;place-items:center;font-weight:900;font-size:15px;flex:none">3</div>
          <span style="font-size:16px;font-weight:800;color:#fff8e6">Manage Published</span>
        </div>
        <p style="margin-top:10px;font-size:14px;color:#c9b48a;line-height:1.45">See what's live, hide maps you're still working on, track usage.</p>
      </div>
    </div>
  </div>

  <div style="margin-top:22px;padding:22px 26px;border-radius:22px;background:#fffaf0;border:1.5px solid #f6e3ab;animation:omRise .65s cubic-bezier(.2,.8,.2,1) both;animation-delay:.18s">
    <div style="display:flex;align-items:center;gap:12px">
      <i class="ph-fill ph-info" style="font-size:22px;color:#a8792a"></i>
      <div>
        <div style="font-size:15px;font-weight:800;color:#241f1c">Everything here feeds the presentation</div>
        <div style="font-size:14px;color:#6b6156;margin-top:2px">Maps you publish, properties you add, and client links you send — all appear instantly in the Client Presentation screen.</div>
      </div>
    </div>
  </div>
</div>`;
}
