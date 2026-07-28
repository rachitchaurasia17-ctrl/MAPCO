/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Dealer Dashboard: My Plots (Properties)
   ═══════════════════════════════════════════════════════════════ */
import { dataAdapter } from '../../../packages/data/mock-adapter';
import { formatINR } from '../../../packages/ui/utils';

export async function renderProperties(el: HTMLElement) {
  const props = await dataAdapter.getProperties();
  const ready = props.filter(p => p.photos.length > 0 && !p.sold);
  const needWork = props.filter(p => p.photos.length === 0 && !p.sold);
  const cities = [...new Set(props.map(p => p.city))];
  const totalValue = ready.reduce((s, p) => s + p.price, 0);

  el.innerHTML = `
<div style="max-width:1120px;margin:0 auto;padding:34px 40px 70px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div>
      <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">My Plots</h1>
      <p style="margin-top:8px;font-size:17px;color:#6b6156">Everything you have to sell — and what's ready to show a customer.</p>
    </div>
    <button style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add a plot</button>
  </div>

  <div style="display:flex;align-items:center;gap:14px;margin-top:22px;position:relative;z-index:20">
    <button style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7;box-shadow:0 1px 2px rgba(30,28,22,.03)">
      <i class="ph-fill ph-map-pin" style="font-size:19px;color:#d95d1e"></i>
      <span style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.1"><span style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8d8271">Showing</span><span style="font-size:16.5px;font-weight:800;color:#241f1c">All cities · ${props.filter(p => !p.sold).length} plots</span></span>
      <i class="ph-bold ph-caret-down" style="font-size:15px;color:#8d8271;margin-left:4px"></i>
    </button>
  </div>

  <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;margin-top:20px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
    <div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:24px 26px;color:#1f1a12">
      <div style="font-size:14px;color:#8a6a14;font-weight:700">Value of stock</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:44px;line-height:1;color:#1f1a12;margin-top:8px">${formatINR(totalValue)}</div>
    </div>
    <div style="background:#ffe6cf;border:1px solid #f8cba6;border-radius:20px;padding:24px 26px">
      <div style="font-size:14px;color:#6b6156;font-weight:700">Ready to show</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:44px;line-height:1;color:#d95d1e;margin-top:8px">${ready.length}</div>
    </div>
    <div style="background:#efe8fb;border:1px solid #ddd0f5;border-radius:20px;padding:24px 26px">
      <div style="font-size:14px;color:#6b6156;font-weight:700">Need a photo</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:44px;line-height:1;color:#b5322a;margin-top:8px">${needWork.length}</div>
    </div>
  </div>

  <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:30px 0 14px">Ready to show</div>
  ${ready.length ? `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:18px">
    ${ready.map(p => `
    <div style="background:#faf7ff;border:1px solid #e4dbf7;border-radius:18px;overflow:hidden;box-shadow:var(--pm-shadow-card);transition:border-color .12s" onmouseenter="this.style.borderColor='#ecd0bf'" onmouseleave="this.style.borderColor='#e4dbf7'">
      <div style="height:150px;position:relative;background:#e7e0d2">
        <div style="position:absolute;inset:0;background-image:url('${p.photos[0] || '/assets/ph-plot-1.png'}');background-size:cover;background-position:center"></div>
        <span style="position:absolute;top:12px;right:12px;font-size:12px;font-weight:800;padding:5px 12px;border-radius:999px;background:${p.published ? '#d9f5e3' : '#ffe6cf'};color:${p.published ? '#0b6f39' : '#c2622a'}">${p.published ? 'Published' : 'Draft'}</span>
      </div>
      <div style="padding:18px 20px">
        <div style="font-size:17.5px;font-weight:800;color:#241f1c">${p.area} · ${p.size}</div>
        <div style="font-size:14px;color:#6b6156;margin-top:2px">${p.loc}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:13px">
          <span style="font-size:13px;font-weight:600;color:#4c463d;background:#f7e7c6;border-radius:9px;padding:5px 11px">${p.size}</span>
          <span style="font-size:13px;font-weight:600;color:#4c463d;background:#f7e7c6;border-radius:9px;padding:5px 11px"><i class="ph ph-compass" style="font-size:14px;vertical-align:-2px"></i> ${p.facing}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px">
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:${p.published ? '#e2f2e6' : '#f3eeff'};color:${p.published ? '#186c3c' : '#6b3fd4'}"><i class="${p.published ? 'ph-fill ph-eye' : 'ph-fill ph-eye-slash'}" style="font-size:14px"></i>${p.published ? 'Live' : 'Hidden'}</span>
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:#f7e7c6;color:#8a6a14"><i class="ph-fill ph-images" style="font-size:14px"></i>${p.photos.length} photos</span>
          ${p.views > 0 ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;background:#efe8fb;color:#6b3fd4"><i class="ph-fill ph-eye" style="font-size:14px"></i>${p.views} views</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid #f6e8c8">
          <span style="font-family:var(--pm-font-display);font-weight:600;font-size:24px;color:#c85a1a">${formatINR(p.price)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
          <button style="display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:12px;background:#fff3d1;color:#8a6a14;font-size:14.5px;font-weight:800"><i class="ph-fill ph-map-pin-line" style="font-size:17px"></i>Show on map</button>
          <a href="#/presentation" style="display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:12px;background:#e2f2e6;color:#186c3c;font-size:14.5px;font-weight:800;text-decoration:none"><i class="ph-fill ph-presentation-chart" style="font-size:17px"></i>Presentation</a>
          <button style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:12px;background:#ffc93c;color:#241d0c;font-size:15.5px;font-weight:800;box-shadow:0 10px 22px -12px rgba(244,174,20,.9)"><i class="ph-fill ph-paper-plane-tilt" style="font-size:18px"></i>Send private link</button>
        </div>
      </div>
    </div>`).join('')}
  </div>` : `<div style="padding:30px;text-align:center;color:#8d8271;font-size:15px;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No ready-to-show plots yet.</div>`}

  ${needWork.length ? `
  <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:34px 0 14px">Need work before you can show them</div>
  <div style="display:flex;flex-direction:column;gap:12px">
    ${needWork.map(p => `
    <div style="display:flex;align-items:center;gap:16px;padding:18px 22px;border:1px solid #f2ddd2;background:#fdf3ee;border-radius:16px">
      <i class="ph-fill ph-warning-circle" style="font-size:26px;color:#b5322a;flex:none"></i>
      <div style="flex:1;min-width:0"><div style="font-size:16.5px;font-weight:700;color:#2f2a2d">${p.area} · ${p.loc}</div><div style="font-size:14px;color:#b5322a;font-weight:600">No photos added yet</div></div>
      <div style="font-family:var(--pm-font-display);font-weight:600;font-size:20px;color:#241f1c;flex:none">${formatINR(p.price)}</div>
    </div>`).join('')}
  </div>` : ''}
</div>`;
}
