import { adapter } from '../../../packages/data/adapter';
import { formatINR } from '../../../packages/ui/utils';
import type { Deal, DealStage } from '../../../packages/data/types';

const STAGES: Record<DealStage, { label: string; color: string; bg: string; card: string; border: string; icon: string }> = {
  enquiry: { label: 'Enquiry', color: '#5b32c4', bg: '#e7defc', card: '#f4eeff', border: '#ddd0f5', icon: 'ph-fill ph-chat-circle-dots' },
  negotiating: { label: 'Negotiating', color: '#c2622a', bg: '#ffe6cf', card: '#fff3e8', border: '#f8cba6', icon: 'ph-fill ph-scales' },
  token: { label: 'Token taken', color: '#0b6f39', bg: '#d9f5e3', card: '#edfbf2', border: '#b3e0c6', icon: 'ph-fill ph-coins' },
  registry: { label: 'Registry', color: '#1a56c4', bg: '#dbeafe', card: '#eef4ff', border: '#bcd4f7', icon: 'ph-fill ph-stamp' },
  closed: { label: 'Closed', color: '#12704a', bg: '#dcf3e5', card: '#edfbf2', border: '#b3e0c6', icon: 'ph-fill ph-seal-check' },
};

const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export async function renderDeals(el: HTMLElement): Promise<void> {
  let deals: Deal[] = [];
  let search = '';
  let selectedId: string | null = null;
  let deleteArmed = false;
  let addOpen = false;
  let addStep = 1;

  const result = await adapter.deals.list({ limit: 100 });
  if (!result.ok) {
    el.innerHTML = '<div role="alert" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Deals could not be loaded.</div>';
    return;
  }
  deals = [...result.value.items];

  const dealRow = (deal: Deal, compact = false) => {
    const meta = STAGES[deal.stage];
    if (compact) {
      return `<button data-act="open" data-id="${esc(deal.id)}" style="width:100%;display:flex;align-items:center;gap:16px;padding:16px 22px;border:0;border-bottom:1px solid #f6e8c8;background:#faf7ff;cursor:pointer;text-align:left;transition:background .12s">
        <span style="width:46px;height:46px;border-radius:13px;flex:none;display:grid;place-items:center;background:${meta.bg};color:${meta.color}"><i class="${meta.icon}" style="font-size:21px"></i></span>
        <span style="flex:1;min-width:0"><span style="display:block;font-size:16px;font-weight:800;color:#2f2a2d">${esc(deal.name)}</span><span style="display:block;font-size:13px;color:#8d8271;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(deal.client)} · ${esc(deal.propSub)}</span></span>
        <span style="font-family:'Newsreader',serif;font-weight:600;font-size:20px;color:#241f1c;flex:none">${formatINR(deal.value)}</span>
        <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;background:${meta.bg};color:${meta.color};font-size:12px;font-weight:800;flex:none"><span style="width:7px;height:7px;border-radius:50%;background:${meta.color}"></span>${meta.label}</span>
        <i class="ph-bold ph-caret-right" style="font-size:16px;color:#c2bba9;flex:none"></i>
      </button>`;
    }
    return `<button data-act="open" data-id="${esc(deal.id)}" style="width:100%;display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:18px;background:${meta.card};border:1.5px solid ${meta.border};cursor:pointer;text-align:left;transition:transform .14s">
      <span style="width:50px;height:50px;border-radius:14px;flex:none;display:grid;place-items:center;background:${meta.bg};color:${meta.color}"><i class="${meta.icon}" style="font-size:25px"></i></span>
      <span style="flex:1;min-width:0"><span style="display:block;font-size:16px;font-weight:800;color:#2f2a2d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(deal.name)}</span><span style="display:block;font-size:13px;color:#8d8271;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">${esc(deal.client)} · ${esc(deal.propSub)}</span><span style="display:flex;align-items:center;gap:9px;margin-top:9px;flex-wrap:wrap"><b style="font-family:'Newsreader',serif;font-weight:600;font-size:19px;color:#241f1c">${formatINR(deal.value)}</b>${deal.comm ? `<span style="font-size:12.5px;font-weight:800;color:#0b8f45;background:#d9f5e3;padding:3px 10px;border-radius:999px">${formatINR(deal.comm)} for you</span>` : ''}</span></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:8px;flex:none;align-self:stretch"><span style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;background:${meta.bg};color:${meta.color};font-size:12px;font-weight:800"><span style="width:7px;height:7px;border-radius:50%;background:${meta.color}"></span>${meta.label}</span><i class="ph-bold ph-caret-right" style="font-size:15px;color:#c2bba9"></i></span>
    </button>`;
  };

  const render = () => {
    const query = search.trim().toLowerCase();
    const matches = deals.filter((deal) => !query || `${deal.name} ${deal.client} ${deal.prop} ${deal.propSub} ${deal.area}`.toLowerCase().includes(query));
    const active = matches.filter((deal) => deal.stage !== 'closed');
    const finished = matches.filter((deal) => deal.stage === 'closed');
    const allActive = deals.filter((deal) => deal.stage !== 'closed');
    const pipeline = allActive.reduce((sum, deal) => sum + deal.value, 0);
    const commission = allActive.reduce((sum, deal) => sum + deal.comm, 0);
    const selected = selectedId ? deals.find((deal) => deal.id === selectedId) : undefined;

    el.innerHTML = `<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
        <div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">My Deals</h1><p style="margin:8px 0 0;font-size:17px;color:#6b6156">Your deal book — name each deal your way, link the plot, keep your money in view.</p></div>
        <button data-act="add" style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add a deal</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
        <div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:24px 26px;color:#1f1a12"><div style="font-size:14px;color:#8a6a14;font-weight:700">Money in progress</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:46px;line-height:1;color:#1f1a12;margin-top:8px">${formatINR(pipeline)}</div></div>
        <div style="background:#d9f5e3;border:1px solid #a6e3c0;border-radius:20px;padding:24px 26px"><div style="display:flex;align-items:center;gap:7px;font-size:14px;color:#0b6f39;font-weight:800"><i class="ph-fill ph-coins" style="font-size:16px;color:#12a150"></i>Your commission coming</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:46px;line-height:1;color:#0b8f45;margin-top:8px">${formatINR(commission)}</div></div>
      </div>
      <label style="display:flex;align-items:center;gap:12px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:15px;padding:15px 18px;margin:24px 0 8px;box-shadow:0 1px 2px rgba(30,28,22,.03)"><i class="ph ph-magnifying-glass" style="font-size:21px;color:#8d8271"></i><input id="pm-deal-search" value="${esc(search)}" placeholder="Search a deal name, customer or plot…" style="border:none;outline:none;background:none;width:100%;font-size:16px;color:#241f1c">${search ? '<button data-act="clear" aria-label="Clear search" style="width:28px;height:28px;border-radius:8px;background:#f3eeff;color:#6b6156;display:grid;place-items:center;flex:none"><i class="ph-bold ph-x" style="font-size:13px"></i></button>' : ''}</label>
      <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:24px 0 12px">Working on now</div>
      ${active.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px">${active.map((deal) => dealRow(deal)).join('')}</div>` : `<div style="padding:26px;text-align:center;color:#8d8271;font-size:15px;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No deals match “${esc(search)}”.</div>`}
      ${finished.length ? `<div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:32px 0 12px">Finished</div><div style="background:#faf7ff;border:1px solid #e4dbf7;border-radius:22px;overflow:hidden;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 34px -26px rgba(30,28,22,.6)">${finished.map((deal) => dealRow(deal, true)).join('')}</div>` : ''}
    </div>${selected ? detailMarkup(selected) : ''}${addOpen ? addMarkup() : ''}`;
  };

  const detailMarkup = (deal: Deal) => {
    const meta = STAGES[deal.stage];
    return `<div data-overlay style="position:fixed;inset:0;background:rgba(28,20,5,.32);backdrop-filter:blur(3px);z-index:90;display:flex;justify-content:flex-end;animation:omFade .18s ease both"><section role="dialog" aria-modal="true" aria-labelledby="pm-deal-title" style="width:min(560px,94vw);height:100%;background:#fffaf0;box-shadow:-26px 0 70px -34px rgba(20,14,2,.75);display:flex;flex-direction:column;animation:omSlide .28s cubic-bezier(.2,.8,.2,1) both">
      <div style="display:flex;align-items:center;gap:14px;padding:22px 24px;border-bottom:1px solid #f0dfb8"><span style="width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:${meta.bg};color:${meta.color}"><i class="${meta.icon}" style="font-size:23px"></i></span><div style="flex:1"><h2 id="pm-deal-title" style="margin:0;font-family:'Newsreader',serif;font-size:27px;font-weight:500;color:#241f1c">${esc(deal.name)}</h2><p style="margin:3px 0 0;color:#8d8271;font-size:14px">${esc(deal.client)} · ${esc(deal.area)}</p></div><button data-act="close" aria-label="Close deal" style="width:42px;height:42px;border-radius:12px;background:#f3eeff;color:#6b6156;display:grid;place-items:center"><i class="ph-bold ph-x"></i></button></div>
      <div data-scroll style="padding:24px;overflow-y:auto;flex:1"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="border-radius:18px;padding:20px;background:#ffc93c"><div style="font-size:12px;font-weight:800;color:#8a6a14;text-transform:uppercase">Deal value</div><div style="font-family:'Newsreader',serif;font-size:34px;font-weight:600;margin-top:6px">${formatINR(deal.value)}</div></div><div style="border-radius:18px;padding:20px;background:#d9f5e3"><div style="font-size:12px;font-weight:800;color:#0b6f39;text-transform:uppercase">Your commission</div><div style="font-family:'Newsreader',serif;font-size:34px;font-weight:600;color:#0b8f45;margin-top:6px">${formatINR(deal.comm)}</div></div></div>
      <div style="margin-top:18px;padding:20px;border-radius:18px;background:${meta.card};border:1.5px solid ${meta.border}"><div style="font-size:12px;font-weight:800;color:${meta.color};text-transform:uppercase">Current stage</div><div style="font-size:19px;font-weight:800;color:#241f1c;margin-top:6px">${meta.label}</div>${deal.token ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid #a6e3c0;font-size:14.5px">Token taken · <b style="color:#b04a12">${formatINR(deal.token)}</b></div>` : ''}</div>
      <div style="margin-top:18px;padding:20px;border-radius:18px;background:#faf7ff;border:1px solid #e4dbf7"><div style="font-size:12px;font-weight:800;color:#8d8271;text-transform:uppercase">Linked plot</div><div style="font-size:18px;font-weight:800;color:#241f1c;margin-top:7px">${esc(deal.prop)}</div><div style="font-size:14px;color:#6b6156;margin-top:3px">${esc(deal.propSub)}</div></div></div>
      <div style="padding:18px 24px;border-top:1px solid #f0dfb8;display:flex;gap:10px">${deleteArmed ? `<button data-act="delete" data-id="${esc(deal.id)}" style="flex:1;height:48px;border-radius:13px;background:#c2185b;color:#fff;font-size:15px;font-weight:800">Delete this deal</button><button data-act="disarm" style="height:48px;padding:0 18px;border-radius:13px;background:#f3eeff;color:#6b6156;font-weight:800">Cancel</button>` : `<button data-act="arm-delete" style="height:48px;padding:0 18px;border-radius:13px;background:#ffe1e6;color:#c2185b;font-size:15px;font-weight:800"><i class="ph-fill ph-trash"></i> Delete</button><div style="flex:1"></div><button data-act="close" style="height:48px;padding:0 22px;border-radius:13px;background:#241d0c;color:#fff8e6;font-size:15px;font-weight:800">Done</button>`}</div>
    </section></div>`;
  };

  const addMarkup = () => `<div data-overlay style="position:fixed;inset:0;background:rgba(28,20,5,.38);backdrop-filter:blur(4px);z-index:100;display:grid;place-items:center;padding:22px"><form id="pm-add-deal" role="dialog" aria-modal="true" aria-labelledby="pm-add-deal-title" style="width:min(680px,96vw);max-height:92vh;overflow:auto;background:#fffaf0;border-radius:26px;box-shadow:0 40px 90px -36px rgba(20,14,2,.85)">
    <div style="display:flex;align-items:center;gap:14px;padding:22px 26px;border-bottom:1px solid #f0dfb8"><span style="width:48px;height:48px;border-radius:14px;background:#6b3fd4;color:#fff;display:grid;place-items:center"><i class="ph-fill ph-handshake" style="font-size:24px"></i></span><div style="flex:1"><div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8d8271">Step ${addStep} of 3</div><h2 id="pm-add-deal-title" style="margin:3px 0 0;font-family:'Newsreader',serif;font-size:28px;font-weight:500">${addStep === 1 ? 'Who is this deal for?' : addStep === 2 ? 'Which property?' : 'The money and stage'}</h2></div><button type="button" data-act="close-add" aria-label="Close" style="width:42px;height:42px;border-radius:12px;background:#f3eeff;color:#6b6156"><i class="ph-bold ph-x"></i></button></div>
    <div style="padding:26px"><div style="display:flex;gap:7px;margin-bottom:22px">${[1, 2, 3].map((step) => `<span style="height:6px;flex:1;border-radius:999px;background:${step <= addStep ? '#6b3fd4' : '#ddd2f5'}"></span>`).join('')}</div>
    ${addStep === 1 ? `<label style="display:block;font-size:13px;font-weight:800;color:#6b6156">Customer name<input name="client" required placeholder="Rajiv Sharma" style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px"></label>` : addStep === 2 ? `<label style="display:block;font-size:13px;font-weight:800;color:#6b6156">Property<input name="prop" required placeholder="Eco City plot · 500 sq yd" style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px"></label>` : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><label style="font-size:13px;font-weight:800;color:#6b6156">Deal value<input name="value" inputmode="numeric" value="9500000" style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px"></label><label style="font-size:13px;font-weight:800;color:#6b6156">Stage<select name="stage" style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px"><option value="enquiry">Enquiry</option><option value="negotiating">Negotiating</option><option value="token">Token taken</option><option value="registry">Registry</option></select></label></div>`}</div>
    <div style="display:flex;align-items:center;gap:10px;padding:18px 26px;border-top:1px solid #f0dfb8">${addStep > 1 ? '<button type="button" data-act="back" style="height:48px;padding:0 20px;border-radius:13px;background:#f3eeff;color:#4c463d;font-weight:800"><i class="ph-bold ph-arrow-left"></i> Back</button>' : ''}<div style="flex:1"></div>${addStep < 3 ? '<button type="button" data-act="next" style="height:48px;padding:0 24px;border-radius:13px;background:#6b3fd4;color:#fff;font-weight:800">Next <i class="ph-bold ph-arrow-right"></i></button>' : '<button type="submit" style="height:48px;padding:0 26px;border-radius:13px;background:#12a150;color:#fff;font-weight:800"><i class="ph-fill ph-check-circle"></i> Save deal</button>'}</div>
  </form></div>`;

  el.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.id === 'pm-deal-search') { search = target.value; render(); target.focus(); target.setSelectionRange(search.length, search.length); }
  });
  el.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (form.id !== 'pm-add-deal') return;
    event.preventDefault();
    const data = new FormData(form);
    const client = String(data.get('client') || 'New customer');
    const prop = String(data.get('prop') || 'New property');
    const value = Number(data.get('value') || 9500000);
    deals.unshift({ id: `local-${Date.now()}`, name: `${client} · ${prop}`, client, prop, propSub: prop, area: '', propId: '', value, comm: Math.round(value * .015), token: 0, stage: String(data.get('stage') || 'enquiry') as DealStage });
    addOpen = false; addStep = 1; render();
  });
  el.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) { if ((event.target as HTMLElement).hasAttribute('data-overlay')) { selectedId = null; addOpen = false; render(); } return; }
    const action = target.dataset.act;
    if (action === 'open') { selectedId = target.dataset.id ?? null; deleteArmed = false; }
    if (action === 'close') { selectedId = null; deleteArmed = false; }
    if (action === 'clear') search = '';
    if (action === 'add') { addOpen = true; addStep = 1; }
    if (action === 'close-add') addOpen = false;
    if (action === 'next') addStep = Math.min(3, addStep + 1);
    if (action === 'back') addStep = Math.max(1, addStep - 1);
    if (action === 'arm-delete') deleteArmed = true;
    if (action === 'disarm') deleteArmed = false;
    if (action === 'delete' && target.dataset.id) { deals = deals.filter((deal) => deal.id !== target.dataset.id); selectedId = null; deleteArmed = false; }
    render();
  });
  render();
}
