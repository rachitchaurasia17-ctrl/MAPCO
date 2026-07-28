/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Team Workspace: Clients
   ═══════════════════════════════════════════════════════════════ */
import { dataAdapter } from '../../../packages/data/mock-adapter';
import { getInitials } from '../../../packages/auth/auth';

export async function renderTeamClients(el: HTMLElement) {
  const clients = await dataAdapter.getClients();

  const statusColor: Record<string, { bg: string; color: string }> = {
    hot: { bg: '#ffe1e6', color: '#c2185b' },
    active: { bg: '#d9f5e3', color: '#0b6f39' },
    cold: { bg: '#f6ecd8', color: '#8a6a14' },
  };

  el.innerHTML = `
<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div>
      <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">Clients</h1>
      <p style="margin-top:8px;font-size:17px;color:#6b6156">All buyers across the team. Track what each one wants and where they stand.</p>
    </div>
    <button style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add client</button>
  </div>

  <label style="display:flex;align-items:center;gap:12px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:15px;padding:15px 18px;margin:22px 0 14px;box-shadow:0 1px 2px rgba(30,28,22,.03)">
    <i class="ph ph-magnifying-glass" style="font-size:21px;color:#8d8271"></i>
    <input placeholder="Search by name, city or budget…" style="border:none;outline:none;background:none;width:100%;font-size:16px;color:#241f1c"/>
  </label>

  <div style="background:#faf7ff;border:1px solid #e4dbf7;border-radius:22px;overflow:hidden;box-shadow:var(--pm-shadow-card)">
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 100px;gap:12px;padding:14px 22px;border-bottom:1px solid #e4dbf7;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8d8271">
      <span>Client</span><span>Wants</span><span>Budget</span><span>Status</span><span>Seen</span>
    </div>
    ${clients.map(c => {
      const sc = statusColor[c.status] || statusColor.active;
      return `
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 100px;gap:12px;align-items:center;padding:16px 22px;border-bottom:1px solid #f6e8c8;cursor:pointer;transition:background .12s" onmouseenter="this.style.background='#faf7ff'" onmouseleave="this.style.background='transparent'">
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <div style="width:42px;height:42px;border-radius:50%;background:#f7e7d9;display:grid;place-items:center;font-weight:800;font-size:14px;color:#8a5a0c;flex:none">${getInitials(c.name)}</div>
        <div style="min-width:0"><div style="font-size:15px;font-weight:700;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div><div style="font-size:13px;color:#8d8271">${c.city}</div></div>
      </div>
      <div style="font-size:14px;color:#241f1c;font-weight:600">${c.want}</div>
      <div style="font-size:14px;font-weight:700;color:#c85a1a">${c.budget}</div>
      <div><span style="font-size:12px;font-weight:800;padding:5px 12px;border-radius:999px;background:${sc.bg};color:${sc.color}">${c.status.charAt(0).toUpperCase() + c.status.slice(1)}</span></div>
      <div style="font-size:13px;color:#8d8271">${c.seen}</div>
    </div>`;
    }).join('')}
  </div>
</div>`;
}
