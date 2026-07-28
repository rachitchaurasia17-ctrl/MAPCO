/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Dealer Dashboard: My Customers
   ═══════════════════════════════════════════════════════════════ */
import { dataAdapter } from '../../../packages/data/mock-adapter';
import { getInitials } from '../../../packages/auth/auth';

export async function renderCustomers(el: HTMLElement) {
  const clients = await dataAdapter.getClients();
  const deals = await dataAdapter.getDeals();
  const total = clients.length;
  const hot = clients.filter(c => c.status === 'hot').length;
  const newW = clients.filter(c => c.isNew).length;

  const filters = [
    { key: 'all', label: 'All', count: total },
    { key: 'hot', label: 'Hot', count: hot },
    { key: 'active', label: 'Active', count: clients.filter(c => c.status === 'active').length },
    { key: 'cold', label: 'Cold', count: clients.filter(c => c.status === 'cold').length },
    { key: 'new', label: 'New', count: newW },
  ];

  const statusColor: Record<string, { bg: string; color: string }> = {
    hot: { bg: '#ffe1e6', color: '#c2185b' },
    active: { bg: '#d9f5e3', color: '#0b6f39' },
    cold: { bg: '#f6ecd8', color: '#8a6a14' },
  };

  el.innerHTML = `
<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div>
      <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">My Customers</h1>
      <p style="margin-top:8px;font-size:17px;color:#6b6156">Everyone you're working with, and exactly what they want.</p>
    </div>
    <button style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add a customer</button>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
    <div style="background:#fff3d1;border:1px solid #f6e3ab;border-radius:20px;padding:22px 24px">
      <div style="font-size:14.5px;color:#6b6156;font-weight:600">Total customers</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:46px;line-height:1;color:#241f1c;margin-top:8px">${total}</div>
    </div>
    <div style="background:#ffe1e6;border:1px solid #f7c4cd;border-radius:20px;padding:22px 24px">
      <div style="font-size:14.5px;color:#6b6156;font-weight:600">Hot right now</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:46px;line-height:1;color:#b5322a;margin-top:8px">${hot}</div>
    </div>
    <div style="background:#efe8fb;border:1px solid #ddd0f5;border-radius:20px;padding:22px 24px">
      <div style="font-size:14.5px;color:#6b6156;font-weight:600">New this week</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:46px;line-height:1;color:#e79a1f;margin-top:8px">${newW}</div>
    </div>
  </div>

  <div style="display:flex;align-items:center;gap:9px;margin:22px 0 18px;overflow-x:auto;padding-bottom:4px">
    ${filters.map((f, i) => `<button style="display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;font-size:14px;font-weight:800;white-space:nowrap;${i === 0 ? 'background:#ffc93c;color:#1f1a12' : 'background:#faf7ff;color:#6b6156;border:1px solid #e4dbf7'}">${f.label}<span style="font-size:12px;font-weight:800;padding:3px 9px;border-radius:999px;${i === 0 ? 'background:rgba(0,0,0,.1);color:#1f1a12' : 'background:#efe8fb;color:#5b32c4'}">${f.count}</span></button>`).join('')}
  </div>

  ${clients.length ? `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
    ${clients.map(c => {
      const sc = statusColor[c.status] || statusColor.active;
      const dealCount = deals.filter(d => d.client === c.name).length;
      return `
    <div style="min-width:0;background:#faf7ff;border:1px solid #e4dbf7;border-radius:18px;padding:20px 22px;cursor:pointer;box-shadow:var(--pm-shadow-card);transition:border-color .12s,transform .12s" onmouseenter="this.style.borderColor='#ecd0bf';this.style.transform='translateY(-2px)'" onmouseleave="this.style.borderColor='#e4dbf7';this.style.transform='none'">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:52px;height:52px;border-radius:50%;background:#f7e7d9;display:grid;place-items:center;font-weight:800;font-size:16px;color:#8a5a0c;flex:none">${getInitials(c.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:17.5px;font-weight:700;color:#2f2a2d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</span>
            ${c.isNew ? `<span style="font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#b06f0c;background:#fbeecb;padding:2px 7px;border-radius:999px;flex:none">New</span>` : ''}
          </div>
          <div style="font-size:13.5px;color:#8d8271;margin-top:2px"><i class="ph ph-map-pin" style="font-size:14px;vertical-align:-2px"></i> ${c.city} · seen ${c.seen}</div>
        </div>
        <span style="font-size:12px;font-weight:800;padding:5px 12px;border-radius:999px;background:${sc.bg};color:${sc.color};flex:none;white-space:nowrap">${c.status.charAt(0).toUpperCase() + c.status.slice(1)}</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <div style="flex:1;background:#faf7ff;border:1px solid #f6e8c8;border-radius:12px;padding:11px 13px">
          <div style="font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8d8271">Wants</div>
          <div style="font-size:15px;font-weight:700;color:#2f2a2d;margin-top:2px">${c.want}</div>
        </div>
        <div style="flex:1;background:#faf7ff;border:1px solid #f6e8c8;border-radius:12px;padding:11px 13px">
          <div style="font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8d8271">Budget</div>
          <div style="font-size:15px;font-weight:800;color:#c85a1a;margin-top:2px">${c.budget}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
        <a href="tel:${c.phone}" style="display:flex;align-items:center;justify-content:center;gap:7px;flex:1;padding:11px;border-radius:11px;background:#12a150;color:#fff;font-size:14px;font-weight:800;text-decoration:none"><i class="ph-fill ph-phone" style="font-size:16px"></i>Call</a>
        <div style="display:flex;align-items:center;gap:6px;padding:11px 14px;border-radius:11px;background:#f7e7c6;color:#4c463d;font-size:13.5px;font-weight:700"><i class="ph-fill ph-handshake" style="font-size:16px;color:#d95d1e"></i>${dealCount} deals</div>
      </div>
    </div>`;
    }).join('')}
  </div>` : `<div style="padding:40px;text-align:center;color:#8d8271;font-size:15px;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No customers match. Try another filter or add one.</div>`}
</div>`;
}
