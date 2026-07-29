/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Area Intelligence
   System-derived, extended consistently.
   ═══════════════════════════════════════════════════════════════ */

export function renderAreaIntelligence(el: HTMLElement) {
  el.innerHTML = `
    <div style="max-width:1180px;margin:0 auto;padding:36px 34px 70px">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:22px;flex-wrap:wrap;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both">
        <div>
          <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:42px;letter-spacing:-.025em">Area Intelligence</h1>
          <p style="margin:10px 0 0;font-size:16.5px;color:#6b6156">Discover demographic and market trends in your active sectors.</p>
        </div>
        <button style="display:flex;align-items:center;gap:9px;padding:14px 20px;border-radius:14px;background:#fffaf0;border:1px solid #d6c6f5;color:#5b32c4;font-size:15.5px;font-weight:800;cursor:pointer" onmouseenter="this.style.background='#f0eaff'" onmouseleave="this.style.background='#fffaf0'"><i class="ph-bold ph-download-simple" style="font-size:16px"></i>Export Report</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:26px">
        <div style="padding:22px 24px;border-radius:22px;background:#fffaf0;border:1px solid #e4dbf2;box-shadow:0 2px 3px rgba(40,30,10,.04);animation:wRise .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.05s">
          <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a5a0c">Avg Plot Price</div>
          <div style="margin-top:8px;font-family:'Newsreader',serif;font-weight:500;font-size:36px;letter-spacing:-.02em;color:#241f1c">₹1.2 Cr</div>
          <div style="margin-top:6px;font-size:13px;font-weight:700;color:#12a150"><i class="ph-bold ph-trend-up"></i> +4.2% this month</div>
        </div>
        <div style="padding:22px 24px;border-radius:22px;background:#fffaf0;border:1px solid #e4dbf2;box-shadow:0 2px 3px rgba(40,30,10,.04);animation:wRise .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.1s">
          <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#5b32c4">Buyer Demand</div>
          <div style="margin-top:8px;font-family:'Newsreader',serif;font-weight:500;font-size:36px;letter-spacing:-.02em;color:#241f1c">High</div>
          <div style="margin-top:6px;font-size:13px;font-weight:700;color:#6b6156">82 active inquiries</div>
        </div>
        <div style="padding:22px 24px;border-radius:22px;background:#fffaf0;border:1px solid #e4dbf2;box-shadow:0 2px 3px rgba(40,30,10,.04);animation:wRise .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.15s">
          <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#12704a">Available Inventory</div>
          <div style="margin-top:8px;font-family:'Newsreader',serif;font-weight:500;font-size:36px;letter-spacing:-.02em;color:#241f1c">145</div>
          <div style="margin-top:6px;font-size:13px;font-weight:700;color:#c2185b"><i class="ph-bold ph-trend-down"></i> -12% this month</div>
        </div>
      </div>

      <div style="margin-top:24px;padding:40px;border-radius:22px;background:#faf7ff;border:1px dashed #d6c6f5;display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;text-align:center;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.2s">
        <div style="width:64px;height:64px;border-radius:16px;background:#efe8fb;display:grid;place-items:center;margin-bottom:20px">
          <i class="ph-fill ph-chart-line-up" style="font-size:32px;color:#5b32c4"></i>
        </div>
        <div style="font-size:18px;font-weight:800;color:#241f1c">Market Trends Chart</div>
        <div style="margin-top:8px;font-size:15px;color:#6b6156;max-width:400px">Advanced analytics and historical pricing trends will appear here when connected to the data warehouse.</div>
      </div>
    </div>
  `;
}
