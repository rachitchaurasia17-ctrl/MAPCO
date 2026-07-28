/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Dealer Dashboard: My Deals
   ═══════════════════════════════════════════════════════════════ */
import { dataAdapter } from '../../../packages/data/mock-adapter';
import { formatINR } from '../../../packages/ui/utils';
import type { Deal, DealStage } from '../../../packages/data/types';

const STAGE_STYLE: Record<DealStage, { color: string; bg: string; card: string; border: string; icon: string }> = {
  enquiry: { color: '#5b32c4', bg: '#e7defc', card: '#f4eeff', border: '#ddd0f5', icon: 'ph-fill ph-chat-circle-dots' },
  negotiating: { color: '#c2622a', bg: '#ffe6cf', card: '#fff3e8', border: '#f8cba6', icon: 'ph-fill ph-scales' },
  token: { color: '#0b6f39', bg: '#d9f5e3', card: '#edfbf2', border: '#b3e0c6', icon: 'ph-fill ph-coins' },
  registry: { color: '#1a56c4', bg: '#dbeafe', card: '#eef4ff', border: '#bcd4f7', icon: 'ph-fill ph-stamp' },
  closed: { color: '#12704a', bg: '#dcf3e5', card: '#edfbf2', border: '#b3e0c6', icon: 'ph-fill ph-seal-check' },
};

export async function renderDeals(el: HTMLElement) {
  const deals = await dataAdapter.getDeals();
  const active = deals.filter(d => d.stage !== 'closed');
  const done = deals.filter(d => d.stage === 'closed');
  const pipeline = active.reduce((s, d) => s + d.value, 0);
  const comm = active.reduce((s, d) => s + d.comm, 0);

  function dealCard(d: Deal): string {
    const st = STAGE_STYLE[d.stage];
    const stageLabel = d.stage.charAt(0).toUpperCase() + d.stage.slice(1);
    return `
    <div style="display:flex;align-items:center;gap:16px;padding:20px 22px;border-radius:18px;background:${st.card};border:1px solid ${st.border};box-shadow:var(--pm-shadow-card);cursor:pointer;transition:transform .12s" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform='none'">
      <div style="width:52px;height:52px;border-radius:16px;background:${st.bg};color:${st.color};display:grid;place-items:center;flex:none"><i class="${st.icon}" style="font-size:25px"></i></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:16px;font-weight:800;color:#2f2a2d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.name}</div>
        <div style="font-size:13px;color:#8d8271;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">${d.client} · ${d.propSub}</div>
        <div style="display:flex;align-items:center;gap:9px;margin-top:9px;flex-wrap:wrap">
          <span style="font-family:var(--pm-font-display);font-weight:600;font-size:19px;color:#241f1c">${formatINR(d.value)}</span>
          ${d.comm ? `<span style="font-size:12.5px;font-weight:800;color:#0b8f45;background:#d9f5e3;padding:3px 10px;border-radius:999px;white-space:nowrap">${formatINR(d.comm)} for you</span>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:8px;flex:none;align-self:stretch">
        <span style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:6px 14px;border-radius:999px;background:${st.bg};color:${st.color}"><span style="width:8px;height:8px;border-radius:50%;background:${st.color}"></span>${stageLabel}</span>
        <i class="ph-bold ph-caret-right" style="font-size:15px;color:#c2bba9"></i>
      </div>
    </div>`;
  }

  el.innerHTML = `
<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div>
      <h1 style="font-family:var(--pm-font-display);font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">My Deals</h1>
      <p style="margin-top:8px;font-size:17px;color:#6b6156">Your deal book — name each deal your way, link the plot, keep your money in view.</p>
    </div>
    <button style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add a deal</button>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
    <div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:24px 26px;color:#1f1a12">
      <div style="font-size:14px;color:#8a6a14;font-weight:700">Money in progress</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:46px;line-height:1;color:#1f1a12;margin-top:8px">${formatINR(pipeline)}</div>
    </div>
    <div style="background:#d9f5e3;border:1px solid #a6e3c0;border-radius:20px;padding:24px 26px">
      <div style="display:flex;align-items:center;gap:7px;font-size:14px;color:#0b6f39;font-weight:800"><i class="ph-fill ph-coins" style="font-size:16px;color:#12a150"></i>Your commission coming</div>
      <div style="font-family:var(--pm-font-display);font-weight:500;font-size:46px;line-height:1;color:#0b8f45;margin-top:8px">${formatINR(comm)}</div>
    </div>
  </div>

  <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:24px 0 12px">Working on now</div>
  ${active.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px">${active.map(dealCard).join('')}</div>` : `<div style="padding:26px;text-align:center;color:#8d8271;font-size:15px;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No active deals right now.</div>`}

  ${done.length ? `
  <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:32px 0 12px">Finished</div>
  <div style="background:#faf7ff;border:1px solid #e4dbf7;border-radius:22px;overflow:hidden;box-shadow:var(--pm-shadow-card)">
    ${done.map(d => {
      const st = STAGE_STYLE[d.stage];
      return `<div style="display:flex;align-items:center;gap:16px;padding:16px 22px;border-bottom:1px solid #f6e8c8;cursor:pointer;transition:background .12s" onmouseenter="this.style.background='#faf7ff'" onmouseleave="this.style.background='transparent'">
        <div style="width:42px;height:42px;border-radius:12px;background:${st.bg};color:${st.color};display:grid;place-items:center;flex:none"><i class="${st.icon}" style="font-size:21px"></i></div>
        <div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800;color:#2f2a2d">${d.name}</div><div style="font-size:13px;color:#8d8271;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.client} · ${d.propSub}</div></div>
        <div style="font-family:var(--pm-font-display);font-weight:600;font-size:20px;color:#241f1c;flex:none">${formatINR(d.value)}</div>
        <span style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:6px 14px;border-radius:999px;background:${st.bg};color:${st.color};flex:none"><span style="width:8px;height:8px;border-radius:50%;background:${st.color}"></span>Closed</span>
      </div>`;
    }).join('')}
  </div>` : ''}
</div>`;
}
