import { adapter } from '../../../packages/data/mock-adapter-v2';
import { formatINR } from '../../../packages/ui/utils';
import type { Deal, DealStage } from '../../../packages/data/types';

function esc(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const STAGE_STYLE: Record<DealStage, { color: string; bg: string; card: string; border: string; icon: string }> = {
  enquiry: { color: '#5b32c4', bg: '#e7defc', card: '#f4eeff', border: '#ddd0f5', icon: 'ph-fill ph-chat-circle-dots' },
  negotiating: { color: '#c2622a', bg: '#ffe6cf', card: '#fff3e8', border: '#f8cba6', icon: 'ph-fill ph-scales' },
  token: { color: '#0b6f39', bg: '#d9f5e3', card: '#edfbf2', border: '#b3e0c6', icon: 'ph-fill ph-coins' },
  registry: { color: '#1a56c4', bg: '#dbeafe', card: '#eef4ff', border: '#bcd4f7', icon: 'ph-fill ph-stamp' },
  closed: { color: '#12704a', bg: '#dcf3e5', card: '#edfbf2', border: '#b3e0c6', icon: 'ph-fill ph-seal-check' },
};

function shell(inner: string): string {
  return `
<div style="padding:40px;max-width:1200px;margin:0 auto">
  <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:24px">
    <div>
      <h1 style="font-size:32px;font-weight:800;letter-spacing:-.02em;color:#1f1a12;margin-bottom:6px">Deals Pipeline</h1>
      <p style="font-size:16px;color:#6b6156;font-weight:500">Track and manage your ongoing negotiations.</p>
    </div>
    <button style="display:flex;align-items:center;gap:8px;padding:12px 20px;border-radius:12px;background:#6533d1;color:#fff;font-size:14.5px;font-weight:700;box-shadow:0 4px 12px rgba(101,51,209,.3);border:none;cursor:pointer"><i class="ph-bold ph-plus" style="font-size:16px"></i>New Deal</button>
  </div>
  ${inner}
</div>`;
}

function loadingBlock(): string {
  return `<div style="margin-top:40px;text-align:center;color:#8d8271">Loading deals...</div>`;
}

function errorBlock(msg: string): string {
  return `<div style="margin-top:40px;padding:30px;background:#fff3f3;border:1px solid #fecaca;border-radius:16px;color:#b91c1c;text-align:center">${esc(msg)}</div>`;
}

export async function renderDeals(el: HTMLElement): Promise<void> {
  const controller = new AbortController();

  function dealCard(d: Deal): string {
    const stageColors: Record<string, { bg: string, color: string }> = {
      enquiry: { bg: '#e7defc', color: '#5b32c4' },
      negotiating: { bg: '#fff4e5', color: '#c97312' },
      token: { bg: '#d9f5e3', color: '#0b6f39' },
      registry: { bg: '#dbeafe', color: '#1a56c4' },
      closed: { bg: '#dcf3e5', color: '#12704a' },
    };
    const st = stageColors[d.stage] || stageColors.enquiry;
    const stageLabel = d.stage.charAt(0).toUpperCase() + d.stage.slice(1);
    
    // Fallback date and follow up since it's not directly in Deal type
    const createdDate = "Oct 12"; 
    const followUpText = "Follow up on Friday";

    return `
    <div style="background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.05);border:1px solid rgba(88,52,168,.08);display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:800;font-size:17px;color:#1f1a12;margin-bottom:4px">${esc(d.propSub)}</div>
          <div style="font-size:14px;color:#6b6156;font-weight:600">${esc(d.client)}</div>
        </div>
        <div style="background:${st.bg};color:${st.color};padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800">${esc(stageLabel)}</div>
      </div>
      <div style="display:flex;gap:16px;padding:16px 0;border-top:1px dashed #e8e3f2;border-bottom:1px dashed #e8e3f2">
        <div style="flex:1">
          <div style="font-size:12px;color:#9a8f7c;font-weight:700;margin-bottom:2px">Amount</div>
          <div style="font-size:15px;font-weight:800;color:#1f1a12">${formatINR(d.value)}</div>
        </div>
        <div style="flex:1">
          <div style="font-size:12px;color:#9a8f7c;font-weight:700;margin-bottom:2px">Created</div>
          <div style="font-size:15px;font-weight:700;color:#4a423a">${createdDate}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#6b6156;font-weight:600">
        <i class="ph-bold ph-clock" style="color:#d95d1e"></i> ${followUpText}
      </div>
    </div>`;
  }

  async function load(): Promise<void> {
    el.innerHTML = shell(loadingBlock());

    const res = await adapter.deals.list({ limit: 100 }, { signal: controller.signal });

    if (!res.ok) {
      if (res.error.code === 'aborted') return;
      el.innerHTML = shell(errorBlock('Could not load deals.'));
      return;
    }

    const deals = res.value.items;
    
    // For the stats row
    const totalDeals = deals.length;
    const inNegotiation = deals.filter(d => d.stage === 'negotiating').length;
    const pendingPayment = deals.filter(d => d.stage === 'token' || d.stage === 'registry').length;
    const closed = deals.filter(d => d.stage === 'closed').length;

    el.innerHTML = shell(`
  <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:20px;margin-bottom:32px">
    <div style="background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04);border:1px solid rgba(88,52,168,.08)">
      <div style="font-size:13px;font-weight:700;color:#6b6156;margin-bottom:8px">Total Deals</div>
      <div style="font-size:28px;font-weight:800;color:#1f1a12">${totalDeals}</div>
    </div>
    <div style="background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04);border:1px solid rgba(88,52,168,.08)">
      <div style="font-size:13px;font-weight:700;color:#6b6156;margin-bottom:8px">In Negotiation</div>
      <div style="font-size:28px;font-weight:800;color:#e8851c">${inNegotiation}</div>
    </div>
    <div style="background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04);border:1px solid rgba(88,52,168,.08)">
      <div style="font-size:13px;font-weight:700;color:#6b6156;margin-bottom:8px">Pending Payment</div>
      <div style="font-size:28px;font-weight:800;color:#2a7dc4">${pendingPayment}</div>
    </div>
    <div style="background:#fff;border-radius:16px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04);border:1px solid rgba(88,52,168,.08)">
      <div style="font-size:13px;font-weight:700;color:#6b6156;margin-bottom:8px">Closed This Month</div>
      <div style="font-size:28px;font-weight:800;color:#189c4d">${closed}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:20px">
    ${deals.map(dealCard).join('')}
  </div>`);
  }

  const cleanup = () => { controller.abort(); };
  window.addEventListener('pagehide', cleanup, { once: true });

  await load();
}
