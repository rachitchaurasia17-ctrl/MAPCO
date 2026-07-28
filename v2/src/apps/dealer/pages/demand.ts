/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Dealer Dashboard: Demand
   ═══════════════════════════════════════════════════════════════ */
import { dataAdapter } from '../../../packages/data/mock-adapter';
import { getInitials } from '../../../packages/auth/auth';

export async function renderDemand(el: HTMLElement) {
  const clients = await dataAdapter.getClients();
  const total = clients.length;

  el.innerHTML = `
<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div>
      <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">Demand Pipeline</h1>
      <p style="margin-top:8px;font-size:17px;color:#6b6156">Active buyer requests and specific plot demands.</p>
    </div>
    <button style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Log Demand</button>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
    <div style="background:#fff3d1;border:1px solid #f6e3ab;border-radius:20px;padding:22px 24px">
      <div style="font-size:14.5px;color:#6b6156;font-weight:600">Total Demands</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:46px;line-height:1;color:#241f1c;margin-top:8px">${total}</div>
    </div>
    <div style="background:#efe8fb;border:1px solid #ddd0f5;border-radius:20px;padding:22px 24px">
      <div style="font-size:14.5px;color:#6b6156;font-weight:600">Unfulfilled</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:46px;line-height:1;color:#e79a1f;margin-top:8px">${total}</div>
    </div>
  </div>

  <div style="margin-top:24px;">
    ${clients.length ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
      ${clients.map(c => `
      <div style="min-width:0;background:#faf7ff;border:1px solid #e4dbf7;border-radius:18px;padding:20px 22px;cursor:pointer;box-shadow:var(--pm-shadow-card);transition:border-color .12s,transform .12s" onmouseenter="this.style.borderColor='#ecd0bf';this.style.transform='translateY(-2px)'" onmouseleave="this.style.borderColor='#e4dbf7';this.style.transform='none'">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:50%;background:#f7e7d9;display:grid;place-items:center;font-weight:800;font-size:16px;color:#8a5a0c;flex:none"><i class="ph ph-magnifying-glass" style="font-size:24px;"></i></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:17.5px;font-weight:700;color:#2f2a2d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.want}</div>
            <div style="font-size:13.5px;color:#8d8271;margin-top:2px">Budget: <strong style="color:#c85a1a">${c.budget}</strong></div>
          </div>
        </div>
        <div style="margin-top:16px;background:#faf7ff;border:1px solid #f6e8c8;border-radius:12px;padding:11px 13px;display:flex;align-items:center;gap:10px">
           <div style="width:24px;height:24px;border-radius:50%;background:#e3d6cc;display:grid;place-items:center;font-weight:800;font-size:10px;color:#8a5a0c;flex:none">${getInitials(c.name)}</div>
           <div style="font-size:13px;font-weight:600;color:#2f2a2d;flex:1">${c.name}</div>
           <div style="font-size:12px;color:#8d8271">${c.city}</div>
        </div>
      </div>`).join('')}
    </div>` : `<div style="padding:40px;text-align:center;color:#8d8271;font-size:15px;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No demands logged yet.</div>`}
  </div>
</div>`;
}
