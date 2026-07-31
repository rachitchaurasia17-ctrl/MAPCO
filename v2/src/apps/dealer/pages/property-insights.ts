/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Property Insights
   System-derived, extended consistently.
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../../packages/data/adapter';

export async function renderPropertyInsights(el: HTMLElement) {
  const res = await adapter.properties.list({ limit: 4 });
  const props = res.ok ? res.value.items : [];

  el.innerHTML = `
    <div style="max-width:1180px;margin:0 auto;padding:36px 34px 70px">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:22px;flex-wrap:wrap;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both">
        <div>
          <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:42px;letter-spacing:-.025em">Property Insights</h1>
          <p style="margin:10px 0 0;font-size:16.5px;color:#6b6156">Analyze price history and demand signals for specific properties.</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="text" placeholder="Search a property..." style="padding:12px 16px;border-radius:12px;border:1px solid #ddd2f5;background:#fffaf0;font-size:15px;width:260px;outline:none"/>
          <button style="display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:12px;background:#5b32c4;color:#fff;border:none;cursor:pointer" onmouseenter="this.style.background='#4a26a8'" onmouseleave="this.style.background='#5b32c4'"><i class="ph-bold ph-magnifying-glass" style="font-size:18px"></i></button>
        </div>
      </div>

      <div style="margin-top:30px;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a5a0c;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.05s">Top Performing Plots</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:14px;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.1s">
        ${props.map(p => `
          <div style="padding:16px;border-radius:18px;background:#fffaf0;border:1px solid #e4dbf2;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor='#c3a6f0'" onmouseout="this.style.borderColor='#e4dbf2'">
            <div style="width:60px;height:60px;border-radius:12px;background:#efdcb2 url('${p.photos[0] || ''}') center/cover;flex:none"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:15.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.type}</div>
              <div style="font-size:13px;color:#6b6156;margin-top:2px">${p.loc}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;font-weight:700;color:#12a150"><i class="ph-fill ph-eye"></i> ${p.views} views</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:30px;display:flex;gap:20px;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.15s">
        <div style="flex:2;padding:34px;border-radius:22px;background:#faf7ff;border:1px dashed #d6c6f5;display:flex;flex-direction:column;align-items:center;justify-content:center;height:340px;text-align:center">
          <div style="width:64px;height:64px;border-radius:16px;background:#efe8fb;display:grid;place-items:center;margin-bottom:20px">
            <i class="ph-fill ph-chart-bar" style="font-size:32px;color:#5b32c4"></i>
          </div>
          <div style="font-size:18px;font-weight:800;color:#241f1c">Price History</div>
          <div style="margin-top:8px;font-size:15px;color:#6b6156;max-width:320px">Select a property above to see its historical price changes and valuation over time.</div>
        </div>

        <div style="flex:1;padding:24px;border-radius:22px;background:#fff3d1;border:1px solid #f6d98d;display:flex;flex-direction:column">
          <div style="font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a5a0c">Similar Demand</div>
          <div style="margin-top:16px;flex:1;display:flex;flex-direction:column;gap:12px">
            <div style="padding:12px 14px;border-radius:12px;background:#fffaf0;border:1px solid #e4dbf2">
              <div style="font-size:14px;font-weight:800;color:#241f1c">300 sq yd Plots</div>
              <div style="font-size:13px;color:#6b6156;margin-top:4px">12 active buyers</div>
            </div>
            <div style="padding:12px 14px;border-radius:12px;background:#fffaf0;border:1px solid #e4dbf2">
              <div style="font-size:14px;font-weight:800;color:#241f1c">Corner Plots</div>
              <div style="font-size:13px;color:#6b6156;margin-top:4px">8 active buyers</div>
            </div>
            <div style="padding:12px 14px;border-radius:12px;background:#fffaf0;border:1px dashed #d6c6f5;color:#5b32c4;font-size:13px;font-weight:800;display:grid;place-items:center;cursor:pointer" onmouseenter="this.style.background='#f0eaff'" onmouseleave="this.style.background='#fffaf0'">
              View all matching
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
