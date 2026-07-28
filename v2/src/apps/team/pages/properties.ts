/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Team Workspace: Properties (editor)
   ═══════════════════════════════════════════════════════════════ */
import { dataAdapter } from '../../../packages/data/mock-adapter';
import { formatINR } from '../../../packages/ui/utils';

export async function renderTeamProperties(el: HTMLElement) {
  const props = await dataAdapter.getProperties();
  const ready = props.filter(p => p.photos.length > 0);
  const draft = props.filter(p => p.photos.length === 0);

  el.innerHTML = `
<div style="max-width:1120px;margin:0 auto;padding:34px 40px 70px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div>
      <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">Properties</h1>
      <p style="margin-top:8px;font-size:17px;color:#6b6156">Add and manage all your inventory. Photos, price, location — everything your clients see.</p>
    </div>
    <button style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add property</button>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:22px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
    <div style="background:#fff3d1;border:1px solid #f6e3ab;border-radius:18px;padding:20px 22px">
      <div style="font-size:14px;color:#6b6156;font-weight:600">Total properties</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:42px;line-height:1;color:#241f1c;margin-top:6px">${props.length}</div>
    </div>
    <div style="background:#d9f5e3;border:1px solid #b3e0c6;border-radius:18px;padding:20px 22px">
      <div style="font-size:14px;color:#6b6156;font-weight:600">Ready to show</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:42px;line-height:1;color:#0b8f45;margin-top:6px">${ready.length}</div>
    </div>
    <div style="background:#ffe1e6;border:1px solid #f7c4cd;border-radius:18px;padding:20px 22px">
      <div style="font-size:14px;color:#6b6156;font-weight:600">Need photos</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:42px;line-height:1;color:#c2185b;margin-top:6px">${draft.length}</div>
    </div>
  </div>

  <div style="margin-top:22px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:22px;overflow:hidden;box-shadow:var(--pm-shadow-card)">
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 80px;gap:12px;padding:14px 22px;border-bottom:1px solid #e4dbf7;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8d8271">
      <span>Property</span><span>Size / Facing</span><span>Price</span><span>Status</span><span></span>
    </div>
    ${props.map(p => `
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 80px;gap:12px;align-items:center;padding:16px 22px;border-bottom:1px solid #f6e8c8;cursor:pointer;transition:background .12s" onmouseenter="this.style.background='#faf7ff'" onmouseleave="this.style.background='transparent'">
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <div style="width:46px;height:46px;border-radius:12px;background:#e7e0d2;flex:none;overflow:hidden">
          ${p.photos[0] ? `<div style="width:100%;height:100%;background-image:url('${p.photos[0]}');background-size:cover;background-position:center"></div>` : `<div style="width:100%;height:100%;display:grid;place-items:center"><i class="ph-fill ph-image" style="font-size:20px;color:#b5a0e6"></i></div>`}
        </div>
        <div style="min-width:0"><div style="font-size:15px;font-weight:700;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.area}</div><div style="font-size:13px;color:#8d8271">${p.loc}</div></div>
      </div>
      <div style="font-size:14px;color:#241f1c;font-weight:600">${p.size}<br><span style="font-size:13px;color:#8d8271">${p.facing}</span></div>
      <div style="font-family:var(--pm-font-display);font-weight:600;font-size:18px;color:#c85a1a">${formatINR(p.price)}</div>
      <div>
        <span style="font-size:12px;font-weight:800;padding:5px 12px;border-radius:999px;background:${p.photos.length > 0 ? '#d9f5e3' : '#ffe1e6'};color:${p.photos.length > 0 ? '#0b6f39' : '#c2185b'}">${p.photos.length > 0 ? (p.published ? 'Published' : 'Ready') : 'Need photos'}</span>
      </div>
      <div style="text-align:right"><button style="width:34px;height:34px;border-radius:10px;background:#f3eeff;color:#6b6156;display:grid;place-items:center"><i class="ph-bold ph-pencil-simple" style="font-size:16px"></i></button></div>
    </div>`).join('')}
  </div>
</div>`;
}
