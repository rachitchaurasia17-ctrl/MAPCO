/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Dealer Dashboard: Home section
   Demand signals, donut chart, bars, streak, call list
   ═══════════════════════════════════════════════════════════════ */
import { dataAdapter } from '../../../packages/data/mock-adapter';
import { getProfile, getGreeting, getFirstName } from '../../../packages/auth/auth';
import { formatDateShort } from '../../../packages/ui/utils';

export async function renderHome(el: HTMLElement) {
  const profile = getProfile();
  const signals = await dataAdapter.getDemandSignals();
  const clients = await dataAdapter.getClients();
  const links = await dataAdapter.getClientLinks();
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

  // Bar data
  const barMax = Math.max(...signals.map(s => s.opens));
  const verdicts = ['Source stock', 'Source stock', 'Stock is fine', 'Quiet', 'Very quiet', 'Quiet'];

  el.innerHTML = `
<div style="max-width:1120px;margin:0 auto;padding:30px 40px 70px">
  <div style="border-radius:28px;padding:32px 34px;background:#241d0c;background-image:linear-gradient(140deg,#3a2f14 0%,#241d0c 60%,#150f04 100%);box-shadow:0 26px 60px -34px rgba(20,14,2,.95);animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
      <div>
        <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c9a94a">${formatDateShort()}</div>
        <h1 style="margin:8px 0 0;font-family:var(--pm-font-display);font-weight:500;font-size:40px;letter-spacing:-.02em;color:#fff8e6">${getGreeting()}, ${getFirstName(profile.name)}.</h1>
        <p style="margin:8px 0 0;font-size:17px;color:#c9b48a">Only from your own presentations and the links you sent.</p>
      </div>
      <a href="#/presentation" style="display:flex;align-items:center;gap:11px;height:62px;padding:0 26px;border-radius:16px;background:#ffc93c;color:#241d0c;font-size:18px;font-weight:800;text-decoration:none;box-shadow:0 16px 34px -16px rgba(244,174,20,.95)">
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
        <h3 style="font-family:var(--pm-font-display);font-weight:500;font-size:23px;color:#241f1c">Where buyers look</h3>
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
          <div style="display:flex;align-items:center;gap:10px;padding:5px 7px;border-radius:10px;cursor:pointer">
            <span style="width:12px;height:12px;border-radius:50%;background:${l.color};flex:none"></span>
            <span style="flex:1;min-width:0;text-align:left;font-size:15px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.city}</span>
            <span style="font-family:var(--pm-font-display);font-size:18px;font-weight:600;color:#241f1c;flex:none">${l.pct}%</span>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <div style="min-width:0;background:#fffaf0;border:1.5px solid #f6e3ab;border-radius:24px;padding:24px 26px">
      <h3 style="font-family:var(--pm-font-display);font-weight:500;font-size:23px;color:#241f1c">What they open most</h3>
      <div style="display:flex;flex-direction:column;gap:14px;margin-top:16px">
        ${signals.map((s, i) => `
        <div style="display:flex;align-items:center;gap:12px">
          <span style="flex:1;min-width:0;font-size:15px;font-weight:700;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.city}</span>
          <div style="flex:2;min-width:0;height:22px;border-radius:6px;background:#f6ecd8;overflow:hidden">
            <div style="height:100%;border-radius:6px;background:${s.color};width:${(s.opens / barMax * 100).toFixed(0)}%;transform-origin:left;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both;animation-delay:${i * 0.08}s"></div>
          </div>
          <span style="font-family:var(--pm-font-display);font-size:17px;font-weight:600;color:#241f1c;flex:none;width:32px;text-align:right">${s.opens}</span>
          <span style="font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:999px;background:${i < 2 ? '#ffe1e6' : '#f6ecd8'};color:${i < 2 ? '#c2185b' : '#8a6a14'};white-space:nowrap">${verdicts[i]}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:16px;animation:omRise .6s cubic-bezier(.2,.8,.2,1) both;animation-delay:.12s">
    <div style="background:#fffaf0;border:1.5px solid #f6e3ab;border-radius:22px;padding:22px 24px">
      <div style="display:flex;align-items:center;gap:9px">
        <i class="ph-fill ph-fire" style="font-size:22px;color:#f0a83c"></i>
        <span style="font-size:17px;font-weight:800;color:#241f1c">7 days in a row</span>
      </div>
      <div style="font-size:14px;color:#6b6156;margin-top:4px">You've used PlotMap every day this week. Buyers notice consistency.</div>
    </div>
    <div style="background:#fffaf0;border:1.5px solid #f6e3ab;border-radius:22px;padding:22px 24px">
      <div style="display:flex;align-items:center;gap:9px">
        <i class="ph-fill ph-users-three" style="font-size:22px;color:#5b32c4"></i>
        <span style="font-size:17px;font-weight:800;color:#241f1c">3 buyers shown today</span>
      </div>
      <div style="font-size:14px;color:#6b6156;margin-top:4px">More presentations mean more deals. Keep the momentum going.</div>
    </div>
  </div>

  <div style="margin-top:20px;background:#fffaf0;border:1.5px solid #e4dbf7;border-radius:22px;padding:22px 24px;animation:omRise .65s cubic-bezier(.2,.8,.2,1) both;animation-delay:.18s">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <h3 style="font-family:var(--pm-font-display);font-weight:500;font-size:22px;color:#241f1c">Call these people today</h3>
      <span style="font-size:12.5px;font-weight:800;color:#5b32c4">${clients.filter(c=>c.status==='hot').length} hot</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      ${clients.filter(c => c.status !== 'cold').slice(0, 4).map(c => `
      <div style="display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:14px;background:var(--pm-surface-alt);border:1px solid #e4dbf7">
        <div style="width:42px;height:42px;border-radius:50%;background:#f7e7d9;display:grid;place-items:center;font-weight:800;font-size:14px;color:#8a5a0c;flex:none">${c.name.split(' ').map(w=>w[0]).join('').toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15.5px;font-weight:700;color:#2f2a2d">${c.name}</div>
          <div style="font-size:13px;color:#8d8271">${c.city} · ${c.want} · ${c.budget}</div>
        </div>
        <span style="font-size:11.5px;font-weight:800;padding:5px 12px;border-radius:999px;background:${c.status === 'hot' ? '#ffe1e6' : '#f6ecd8'};color:${c.status === 'hot' ? '#c2185b' : '#8a6a14'};white-space:nowrap">${c.interest.length > 0 ? 'Has a match' : 'No stock yet'}</span>
        <a href="tel:${c.phone}" style="display:flex;align-items:center;justify-content:center;gap:7px;height:40px;padding:0 16px;border-radius:11px;background:#12a150;color:#fff;font-size:14px;font-weight:800;text-decoration:none;flex:none"><i class="ph-fill ph-phone" style="font-size:16px"></i>Call</a>
      </div>`).join('')}
    </div>
  </div>
</div>`;
}
