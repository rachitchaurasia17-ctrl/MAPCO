/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Team Workspace: Clients
   Source: Team Workspace.dc.html (isClients)
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../../packages/data/mock-adapter-v2';

export async function renderTeamClients(el: HTMLElement) {
  const res = await adapter.customers.list({ limit: 100 });
  const clients = res.ok ? res.value.items : [];

  el.innerHTML = `
    <div style="max-width:1180px;margin:0 auto;padding:36px 34px 70px">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:22px;flex-wrap:wrap;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both">
        <div>
          <h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:42px;letter-spacing:-.025em">Clients</h1>
          <p style="margin:10px 0 0;font-size:16.5px;color:#6b6156">Everyone the dealer is talking to, and what they are looking for.</p>
        </div>
        <button style="display:flex;align-items:center;gap:9px;padding:14px 20px;border-radius:14px;background:#5b32c4;color:#fff;font-size:15.5px;font-weight:800;box-shadow:0 14px 26px -16px rgba(91,50,196,.95)"><i class="ph-bold ph-plus" style="font-size:16px"></i>Add a client</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-top:26px">
        ${clients.map(c => {
          const ini = c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
          const isHot = c.status === 'hot';
          const avStyle = isHot
            ? 'width:48px;height:48px;border-radius:50%;background:#ffe1e6;color:#c2185b;display:grid;place-items:center;font-size:15px;font-weight:800;flex:none'
            : 'width:48px;height:48px;border-radius:50%;background:#f0eaff;color:#5b32c4;display:grid;place-items:center;font-size:15px;font-weight:800;flex:none';
          const tagStyle = isHot
            ? 'padding:6px 11px;border-radius:9px;background:#ffe1e6;font-size:12.5px;font-weight:800;color:#c2185b'
            : 'padding:6px 11px;border-radius:9px;background:#d9f5e3;font-size:12.5px;font-weight:800;color:#0b6f39';

          return `
          <div style="padding:20px;border-radius:22px;background:#fffaf0;border:1px solid #e4dbf2;box-shadow:0 2px 3px rgba(40,30,10,.04),0 24px 46px -38px rgba(70,40,150,.8);animation:wRise .5s cubic-bezier(.2,.8,.2,1) both">
            <div style="display:flex;align-items:center;gap:13px">
              <span style="${avStyle}">${ini}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:17.5px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
                <div style="margin-top:2px;font-size:14px;color:#8d8271">${c.phone || c.id}</div>
              </div>
              <span style="${tagStyle}">${c.status || 'active'}</span>
            </div>
            <div style="margin-top:15px;padding:12px 14px;border-radius:13px;background:#faf7ff;border:1px solid #ece5f8">
              <div style="font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#5b32c4">Looking for</div>
              <div style="margin-top:4px;font-size:15px;font-weight:600;color:#4c463d">${c.want || 'Any plot'}</div>
            </div>
            <div style="display:flex;align-items:center;gap:9px;margin-top:15px">
              <button style="display:flex;align-items:center;justify-content:center;gap:7px;flex:1;padding:12px;border-radius:12px;background:#efe8fb;border:1px solid #d6c6f5;color:#5b32c4;font-size:13.5px;font-weight:800"><i class="ph-bold ph-pencil-simple" style="font-size:15px"></i>Edit details</button>
              <button style="display:flex;align-items:center;justify-content:center;gap:7px;flex:1;padding:12px;border-radius:12px;background:#dcf3e5;border:1px solid #b3e0c6;color:#12704a;font-size:13.5px;font-weight:800"><i class="ph-fill ph-paper-plane-tilt" style="font-size:15px"></i>Send link</button>
              <button style="width:42px;height:42px;border-radius:12px;background:#ffe1e6;color:#b3123a;display:grid;place-items:center;flex:none"><i class="ph-fill ph-trash" style="font-size:17px"></i></button>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
