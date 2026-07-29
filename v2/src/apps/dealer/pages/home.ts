/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Dealer Dashboard: Home section
   Metrics grid, map integration, recent views
   ═══════════════════════════════════════════════════════════════ */
import { dataAdapter } from '../../../packages/data/mock-adapter';
import { getProfile, getGreeting, getFirstName } from '../../../packages/auth/auth';
import { formatDateShort } from '../../../packages/ui/utils';

const formatPrice = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  return `₹${val.toLocaleString()}`;
};

export async function renderHome(el: HTMLElement) {
  const profile = getProfile();
  const signals = await dataAdapter.getDemandSignals();
  const links = await dataAdapter.getClientLinks();
  const properties = await dataAdapter.getProperties();

  const totalOpens = signals.reduce((s, d) => s + d.opens, 0);
  const totalLinkOpens = links.reduce((s, l) => s + l.events.opens, 0);
  const hotArea = signals[0];

  // Donut chart math
  const CIRC = 2 * Math.PI * 62; // r=62
  let offset = 0;
  const segs = signals.map(s => {
    const pct = s.opens / totalOpens;
    const dash = CIRC * pct;
    const o = offset;
    offset += dash;
    return { ...s, pct: Math.round(pct * 100), dash, offset: -o };
  });

  // What gets opened most by type
  const wantBars = [
    { want: 'Plot', opens: 112, tag: 'Source stock', tagStyle: 'padding:3px 8px;border-radius:6px;background:#c2185b;color:#fff;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase', barStyle: 'height:100%;background:#5b32c4;width:80%;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both' },
    { want: 'Kothi', opens: 45, tag: 'Stock is fine', tagStyle: 'padding:3px 8px;border-radius:6px;background:#ded0fa;color:#5b32c4;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase', barStyle: 'height:100%;background:#5b32c4;width:40%;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both;animation-delay:0.08s' },
    { want: 'Flat', opens: 22, tag: 'Quiet', tagStyle: 'padding:3px 8px;border-radius:6px;background:#ded0fa;color:#5b32c4;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase', barStyle: 'height:100%;background:#5b32c4;width:20%;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both;animation-delay:0.16s' },
  ];

  // Interest on the map vs plots you hold
  const maxOpens = Math.max(...signals.map(s => s.opens));
  const maxStock = 5;
  const vsCols = signals.slice(0, 6).map((s, i) => {
    const stock = properties.filter(p => p.city === s.city).length;
    const barAHeight = Math.max(5, (s.opens / maxOpens) * 100);
    const barBHeight = Math.max(5, (stock / maxStock) * 100);
    const chipNeedsStock = stock < s.opens / 10;
    return {
      city: s.city,
      opens: s.opens,
      stock,
      barA: `width:36px;height:${barAHeight}%;background:#6b3fd4;border-radius:6px 6px 0 0;display:flex;align-items:flex-start;justify-content:center;animation:barGrowUp .85s cubic-bezier(.2,.8,.2,1) both;animation-delay:${i * 0.05}s;transform-origin:bottom`,
      barB: `width:36px;height:${barBHeight}%;background:#ffc93c;border-radius:6px 6px 0 0;display:flex;align-items:flex-start;justify-content:center;animation:barGrowUp .85s cubic-bezier(.2,.8,.2,1) both;animation-delay:${0.1 + i * 0.05}s;transform-origin:bottom`,
      labA: 'font-size:12px;font-weight:800;color:#fff;margin-top:4px',
      labB: 'font-size:12px;font-weight:800;color:#a8600c;margin-top:4px',
      chip: chipNeedsStock ? 'Needs stock' : 'OK',
      chipStyle: chipNeedsStock 
        ? 'font-size:11px;font-weight:800;color:#c2185b;background:#ffe1e6;padding:3px 8px;border-radius:999px;white-space:nowrap' 
        : 'font-size:11px;font-weight:800;color:#8a8070;white-space:nowrap'
    };
  });

  // Plots pulling the most attention
  const attentionRows = properties.map((p, i) => {
    const views = p.views || 0;
    const isHot = views > 20;
    const photo = p.photos[0] || '';
    return {
      loc: p.loc,
      views,
      rank: `#${i + 1}`,
      priceFmt: formatPrice(p.price),
      chip: isHot ? 'Hot plot' : '',
      dotStyle: isHot ? 'width:12px;height:12px;border-radius:50%;background:#e8763a' : 'width:12px;height:12px;border-radius:50%;background:#e6e1d6',
      photoStyle: `position:relative;display:block;height:130px;background:#e6cf9a url(${photo}) center/cover;border-radius:14px 14px 0 0;overflow:hidden`,
      rankStyle: 'position:absolute;top:10px;left:10px;padding:4px 10px;border-radius:999px;background:rgba(20,14,2,.75);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);font-size:11.5px;font-weight:800;letter-spacing:.04em;color:#fff',
      cardStyle: 'display:block;width:100%;text-align:left;background:#fff;border:1px solid #f2ddd2;border-radius:16px;cursor:pointer;transition:transform .15s;outline:none',
    };
  }).sort((a, b) => b.views - a.views).slice(0, 5);

  el.innerHTML = `
<style>
  .pm-hover-card:hover { transform: translateY(-3px); box-shadow: 0 10px 20px -10px rgba(0,0,0,0.1); }
  @keyframes barGrowUp { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  .pm-show-map-btn:hover { background: #ffdc7a !important; }
</style>
<div style="max-width:1120px;margin:0 auto;padding:30px 40px 70px">
  <div style="border-radius:28px;padding:32px 34px;background:#241d0c;background-image:linear-gradient(140deg,#3a2f14 0%,#241d0c 60%,#150f04 100%);box-shadow:0 26px 60px -34px rgba(20,14,2,.95);animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
      <div>
        <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c9a94a">${formatDateShort()}</div>
        <h1 style="margin:8px 0 0;font-family:var(--pm-font-display);font-weight:500;font-size:40px;letter-spacing:-.02em;color:#fff8e6">${getGreeting()}, ${getFirstName(profile.name)}.</h1>
        <p style="margin:8px 0 0;font-size:17px;color:#c9b48a">Only from your own presentations and the links you sent.</p>
      </div>
      <a href="/app/plotmap/index.html" class="pm-show-map-btn" style="display:flex;align-items:center;gap:11px;height:62px;padding:0 26px;border-radius:16px;background:#ffc93c;color:#241d0c;font-size:18px;font-weight:800;text-decoration:none;box-shadow:0 16px 34px -16px rgba(244,174,20,.95);transition:background .15s">
        <i class="ph-fill ph-projector-screen-chart" style="font-size:22px"></i>Show the map
      </a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px">
      <div style="border-radius:20px;padding:20px 22px;background:#ffc93c;background-image:linear-gradient(140deg,#ffdc7a,#f4ae14)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#8a6a14"><i class="ph-fill ph-cursor-click" style="font-size:16px"></i>Opened while presenting</div>
        <div style="font-family:var(--pm-font-display);font-weight:500;font-size:52px;line-height:1;color:#241d0c;margin-top:6px">${totalOpens}</div>
      </div>
      <div style="border-radius:20px;padding:20px 22px;background:#6b3fd4;background-image:linear-gradient(140deg,#8a63e8,#5b32c4)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#d8c8ff"><i class="ph-fill ph-paper-plane-tilt" style="font-size:16px"></i>Link opens</div>
        <div style="font-family:var(--pm-font-display);font-weight:500;font-size:52px;line-height:1;color:#fff;margin-top:6px">${totalLinkOpens}</div>
        <div style="font-size:13px;font-weight:700;color:#d8c8ff;margin-top:4px">${links.filter(l=>l.status==='active').length} active links</div>
      </div>
      <div style="border-radius:20px;padding:20px 22px;background:#12a150;background-image:linear-gradient(140deg,#2ec06b,#0b8f45)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#c9f0d9"><i class="ph-fill ph-fire" style="font-size:16px"></i>Hottest area</div>
        <div style="font-family:var(--pm-font-display);font-weight:600;font-size:27px;line-height:1.15;color:#fff;margin-top:12px">${hotArea.city}</div>
        <div style="font-size:14px;font-weight:700;color:#c9f0d9;margin-top:3px">${hotArea.opens} opens this month</div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;margin-top:18px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
    <div style="min-width:0;background:#fff3d1;border:1.5px solid #f6e3ab;border-radius:24px;padding:24px 26px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <h3 style="margin:0;font-family:var(--pm-font-display);font-weight:500;font-size:23px;color:#241f1c">Where buyers look</h3>
        <span style="font-size:12.5px;font-weight:800;color:#8a6a14;white-space:nowrap">${totalOpens} opens</span>
      </div>
      <div style="display:flex;align-items:center;gap:18px;margin-top:16px;flex-wrap:wrap">
        <div style="position:relative;width:158px;height:158px;flex:none">
          <svg viewBox="0 0 180 180" style="width:158px;height:158px;transform:rotate(-90deg);filter:drop-shadow(0 10px 20px rgba(31,26,18,.2))">
            ${segs.map(g => `<circle cx="90" cy="90" r="62" fill="none" stroke="${g.color}" stroke-width="34" stroke-dasharray="${g.dash} ${CIRC - g.dash}" stroke-dashoffset="${g.offset}"></circle>`).join('')}
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
            <div style="font-family:var(--pm-font-display);font-weight:600;font-size:30px;line-height:1;color:#241f1c">${segs[0].pct}%</div>
            <div style="font-size:11.5px;font-weight:800;color:#8a6a14;text-align:center;max-width:96px;line-height:1.25;margin-top:3px">${segs[0].city}</div>
          </div>
        </div>
        <div style="flex:1 1 150px;min-width:0;display:flex;flex-direction:column;gap:8px">
          ${segs.slice(0, 5).map(l => `
          <div style="display:flex;align-items:center;gap:10px;padding:5px 7px;border-radius:10px;cursor:pointer" style="transition:background .1s" onmouseover="this.style.background='#ffe9a8'" onmouseout="this.style.background='transparent'">
            <span style="width:12px;height:12px;border-radius:50%;background:${l.color};flex:none"></span>
            <span style="flex:1;min-width:0;text-align:left;font-size:15px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.city}</span>
            <span style="font-family:var(--pm-font-display);font-size:18px;font-weight:600;color:#241f1c;flex:none">${l.pct}%</span>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <div style="min-width:0;background:#efe8fb;border:1.5px solid #ddd0f5;border-radius:24px;padding:24px 26px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <h3 style="margin:0;font-family:var(--pm-font-display);font-weight:500;font-size:23px;color:#241f1c">What gets opened most</h3>
        <span style="font-size:12.5px;font-weight:800;color:#5b32c4;white-space:nowrap">by type</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:11px;margin-top:16px">
        ${wantBars.map(w => `
        <div>
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
            <span style="font-size:15.5px;font-weight:800;color:#241f1c">${w.want}</span>
            <span style="${w.tagStyle}">${w.tag}</span>
          </div>
          <div style="display:flex;align-items:center;gap:9px;margin-top:6px">
            <div style="flex:1;min-width:70px;height:16px;border-radius:999px;background:#ded0fa;overflow:hidden"><div style="${w.barStyle}"></div></div>
            <span style="font-family:var(--pm-font-display);font-size:20px;font-weight:600;color:#5b32c4;flex:none">${w.opens}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <div style="background:#faf7ff;border:1.5px solid #e4dbf7;border-radius:24px;padding:24px 26px;margin-top:16px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.08s">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="min-width:0">
        <h3 style="margin:0;font-family:var(--pm-font-display);font-weight:500;font-size:23px;color:#241f1c">Interest on the map vs plots you hold</h3>
        <p style="margin:4px 0 0;font-size:14px;color:#8a8070">Opens are counted while you present. Nothing here comes from outside.</p>
      </div>
      <div style="display:flex;align-items:center;gap:14px">
        <span style="display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#5b32c4"><span style="width:12px;height:12px;border-radius:4px;background:#6b3fd4"></span>Opens</span>
        <span style="display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#a8600c"><span style="width:12px;height:12px;border-radius:4px;background:#ffc93c"></span>Your plots</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:12px;margin-top:20px;align-items:end">
      ${vsCols.map(v => `
      <div style="min-width:0;display:flex;flex-direction:column;align-items:center;gap:9px">
        <div style="display:flex;align-items:flex-end;gap:6px;height:150px">
          <div style="${v.barA}"><span style="${v.labA}">${v.opens}</span></div>
          <div style="${v.barB}"><span style="${v.labB}">${v.stock}</span></div>
        </div>
        <div style="font-size:12.5px;font-weight:800;color:#4c463d;text-align:center;line-height:1.25;max-width:100%;overflow:hidden;text-overflow:ellipsis">${v.city}</div>
        <span style="${v.chipStyle}">${v.chip}</span>
      </div>`).join('')}
    </div>
  </div>

  <div style="background:#e6f5eb;margin-top:18px;border-radius:22px;padding:22px 26px;display:flex;align-items:center;gap:16px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.1s">
    <i class="ph-fill ph-trend-up" style="font-size:32px;color:#0b8f45;flex:none"></i>
    <div>
      <div style="font-size:12.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#0b8f45">Trending · Mohali</div>
      <div style="font-size:17px;color:#4c463d;line-height:1.45;margin-top:4px;max-width:820px">A lot of buyers opened Aerocity and Sector 79 this week. Good time to call your Mohali leads.</div>
    </div>
  </div>

  <div style="display:flex;align-items:center;justify-content:space-between;margin:30px 0 14px;animation:omRise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.12s">
    <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a8070">Plots pulling the most attention</div>
    <span style="font-size:12.5px;font-weight:800;color:#8a6a14;background:#fff3d1;border-radius:999px;padding:5px 13px">From your presentations</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px;animation:omRise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.14s">
    ${attentionRows.map(a => `
    <button class="pm-hover-card" style="${a.cardStyle}">
      <span style="${a.photoStyle}">
        <span style="${a.rankStyle}">${a.rank}</span>
        <span style="position:absolute;left:0;right:0;bottom:0;padding:22px 10px 9px;background:linear-gradient(180deg,rgba(20,14,2,0),rgba(20,14,2,.86));display:flex;align-items:flex-end;justify-content:space-between;gap:6px">
          <span style="font-family:var(--pm-font-display);font-weight:600;font-size:23px;line-height:1;color:#ffd75e">${a.views}</span>
          <span style="font-size:11px;font-weight:800;color:#f4e5c4;letter-spacing:.04em">OPENS</span>
        </span>
      </span>
      <span style="display:block;padding:10px 12px 4px;font-size:14.5px;font-weight:800;color:#211c17;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left">${a.loc}</span>
      <span style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 12px">
        <span style="font-family:var(--pm-font-display);font-weight:600;font-size:17px;color:#c85a1a">${a.priceFmt}</span>
        <span style="${a.dotStyle}" title="${a.chip}"></span>
      </span>
    </button>`).join('')}
  </div>
</div>`;
}
