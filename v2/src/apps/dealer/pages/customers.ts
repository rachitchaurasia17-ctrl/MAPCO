import { adapter } from '../../../packages/data/adapter';
import { formatINR } from '../../../packages/ui/utils';
import type { Client, ClientLink, Deal, Property, WantType } from '../../../packages/data/types';
import { AddClientFlow } from '../../../packages/ui/shared-modals';

const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const tel = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, '')}`;
const statusLabel = (client: Client) => client.status === 'cold' ? 'Cold' : client.status === 'active' ? 'Warm' : 'Hot';
const statusStyle = (client: Client) => client.status === 'cold'
  ? 'font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;background:#e8e2ef;color:#6b5b78'
  : client.status === 'active'
    ? 'font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;background:#fff0ba;color:#b06f0c'
    : 'font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;background:#ffe1e6;color:#b5322a';

export async function renderCustomers(el: HTMLElement): Promise<void> {
  let clients: Client[] = [];
  let deals: Deal[] = [];
  let properties: Property[] = [];
  let links: ClientLink[] = [];
  let search = '';
  let filter: 'all' | 'hot' | 'warm' | 'cold' | 'done' = 'all';
  let selectedId: string | null = null;
  let deleteArmed = false;

  const [clientResult, dealResult, propertyResult, linkResult] = await Promise.all([
    adapter.customers.list({ limit: 50 }),
    adapter.deals.list({ limit: 50 }),
    adapter.properties.list({ limit: 50 }),
    adapter.clientLinks.list({ limit: 50 }),
  ]);
  if (!clientResult.ok || !dealResult.ok || !propertyResult.ok || !linkResult.ok) {
    el.innerHTML = '<div role="alert" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Customers could not be loaded.</div>';
    return;
  }
  clients = [...clientResult.value.items];
  deals = [...dealResult.value.items];
  properties = [...propertyResult.value.items];
  links = [...linkResult.value.items];

  const dealsFor = (client: Client) => deals.filter((deal) => deal.buyerId === client.id || deal.buyer === client.name);
  const isDone = (client: Client) => dealsFor(client).length > 0;
  const matchesFilter = (client: Client) => filter === 'all'
    || (filter === 'hot' && client.status === 'hot')
    || (filter === 'warm' && client.status === 'active')
    || (filter === 'cold' && client.status === 'cold')
    || (filter === 'done' && isDone(client));

  const filterButton = (key: typeof filter, label: string, count: number) => {
    const active = filter === key;
    return `<button data-act="filter" data-filter="${key}" style="display:flex;align-items:center;gap:9px;height:40px;padding:0 15px;border-radius:999px;white-space:nowrap;font-size:13.5px;font-weight:800;transition:all .15s;${active ? 'background:#ffc93c;color:#241d0c' : 'background:transparent;color:#6b6156'}">${label}<span style="display:grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;font-size:11px;font-weight:800;${active ? 'background:rgba(255,255,255,.38);color:#fff' : 'background:#f3e5bc;color:#8a6a14'}">${count}</span></button>`;
  };

  const clientCard = (client: Client) => {
    const dealCount = dealsFor(client).length;
    return `<article data-act="detail" data-id="${esc(client.id)}" class="${client.status === 'hot' ? 'pm-hot-glow' : ''}" style="min-width:0;background:#faf7ff;border:1px solid #e4dbf7;border-radius:18px;padding:20px 22px;cursor:pointer;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 34px -26px rgba(30,28,22,.6);transition:border-color .12s,transform .12s">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:52px;height:52px;border-radius:50%;overflow:hidden;flex:none;background:#f7e7d9;border:1px dashed #9f8a72;display:grid;place-items:center;text-align:center;font-size:10px;color:#6b6156;line-height:1.1">Photo<br>or<br>browse</div>
        <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:17.5px;font-weight:700;color:#2f2a2d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(client.name)}</span>${client.isNew ? '<span style="font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#b06f0c;background:#fbeecb;padding:2px 7px;border-radius:999px;flex:none">New</span>' : ''}</div><div style="font-size:13.5px;color:#8d8271;margin-top:2px"><i class="ph ph-map-pin" style="font-size:14px;vertical-align:-2px"></i> ${esc(client.city)} · seen ${esc(client.seen)}</div></div>
        <span style="${statusStyle(client)};flex:none">${statusLabel(client)}</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <div style="flex:1;background:#faf7ff;border:1px solid #f6e8c8;border-radius:12px;padding:11px 13px"><div style="font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8d8271">Wants</div><div style="font-size:15px;font-weight:700;color:#2f2a2d;margin-top:2px">${esc(client.want)}</div></div>
        <div style="flex:1;background:#faf7ff;border:1px solid #f6e8c8;border-radius:12px;padding:11px 13px"><div style="font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8d8271">Budget</div><div style="font-size:15px;font-weight:800;color:#c85a1a;margin-top:2px">${esc(client.budget)}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
        <a href="${esc(tel(client.phone))}" data-call style="display:flex;align-items:center;justify-content:center;gap:7px;flex:1;padding:11px;border-radius:11px;background:#12a150;color:#fff;font-size:14px;font-weight:800;text-decoration:none"><i class="ph-fill ph-phone" style="font-size:16px"></i>Call</a>
        <div style="display:flex;align-items:center;gap:6px;padding:11px 14px;border-radius:11px;background:#f7e7c6;color:#4c463d;font-size:13.5px;font-weight:700"><i class="ph-fill ph-handshake" style="font-size:16px;color:#d95d1e"></i>${dealCount} deals</div>
      </div>
    </article>`;
  };

  const detailMarkup = (client: Client) => {
    const lookedAt = client.viewed.length ? client.viewed : client.interest;
    const linkedProperties = client.interest.map((id) => properties.find((property) => property.id === id)).filter((property): property is Property => Boolean(property));
    const clientDeals = dealsFor(client);
    const clientLinks = links.filter((link) => link.clientId === client.id);
    const firstName = client.name.split(' ')[0] || client.name;
    return `<div style="position:fixed;inset:0;z-index:60"><div data-act="close" style="position:absolute;inset:0;background:rgba(26,18,12,.46);animation:omVeil .25s ease both"></div><section data-scroll role="dialog" aria-modal="true" aria-label="${esc(client.name)}" style="position:absolute;right:0;top:0;height:100vh;width:500px;max-width:94vw;background:#f7f3ff;box-shadow:-24px 0 60px -30px rgba(0,0,0,.5);overflow:auto;animation:omSlide .32s cubic-bezier(.2,.8,.2,1) both">
      <div style="position:sticky;top:0;background:#ffc93c;background-image:linear-gradient(180deg,#ffd75e,#f4ae14);color:#1f1a12;padding:24px 26px;z-index:2"><div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:12.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8a6a14">Customer</span><button data-act="close" aria-label="Close customer" style="width:38px;height:38px;border-radius:11px;background:rgba(0,0,0,.09);color:#1f1a12;display:grid;place-items:center"><i class="ph-bold ph-x" style="font-size:17px"></i></button></div><div style="display:flex;align-items:center;gap:14px;margin-top:16px"><div style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex:none;background:rgba(255,255,255,.2);box-shadow:0 0 0 2px rgba(255,255,255,.35);display:grid;place-items:center;text-align:center;font-size:10px;color:#6b6156;line-height:1.1">Add<br>photo<br>browse</div><div style="flex:1"><div style="font-size:25px;font-weight:800;letter-spacing:-.01em;color:#1f1a12">${esc(client.name)}</div><div style="display:flex;align-items:center;gap:8px;font-size:15px;color:#8a6a14;margin-top:2px"><i class="ph ph-phone" style="font-size:16px"></i>${esc(client.phone)}</div></div></div><a href="${esc(tel(client.phone))}" style="display:flex;align-items:center;justify-content:center;gap:9px;margin-top:16px;padding:13px;border-radius:13px;background:#fff;color:#0b8f45;font-size:15.5px;font-weight:800;text-decoration:none"><i class="ph-fill ph-phone-call" style="font-size:18px"></i>Call ${esc(firstName)}</a></div>
      <div style="padding:24px 26px 44px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="background:#faf7ff;border:1px solid #e4dbf7;border-radius:15px;padding:16px 18px"><div style="font-size:12.5px;color:#7d7365;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Budget</div><div style="font-size:21px;font-weight:800;color:#c85a1a;margin-top:4px">${esc(client.budget)}</div></div><div style="background:#faf7ff;border:1px solid #e4dbf7;border-radius:15px;padding:16px 18px"><div style="font-size:12.5px;color:#7d7365;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Wants</div><div style="font-size:21px;font-weight:800;color:#241f1c;margin-top:4px">${esc(client.want)} · ${esc(client.city)}</div></div></div>
        <div style="background:#f4ecdd;border:1px solid #ece0c9;border-radius:15px;padding:16px 18px;margin-top:12px;font-size:15px;color:#4a453e;line-height:1.5"><i class="ph-fill ph-note" style="font-size:17px;color:#d95d1e;vertical-align:-2px;margin-right:6px"></i>${esc(client.note || 'No note added yet.')}</div>
        ${lookedAt.length ? `<div style="font-size:13.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7d7365;margin:26px 0 12px">Looked at on your map</div><div style="display:flex;flex-wrap:wrap;gap:9px">${lookedAt.map((value) => { const property = properties.find((item) => item.id === value); return `<span style="padding:8px 12px;border-radius:10px;background:#fff0c9;border:1px solid #f2dfab;color:#5b4a21;font-size:13px;font-weight:700">${esc(property ? property.area : value)}</span>`; }).join('')}</div>` : ''}
        ${linkedProperties.length ? `<div style="font-size:13.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7d7365;margin:26px 0 12px">Plots connected to them</div><div style="display:flex;flex-direction:column;gap:10px">${linkedProperties.map((property) => `<div style="display:flex;align-items:center;gap:12px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:14px;padding:14px 16px"><div style="width:38px;height:38px;border-radius:11px;background:#fff2cf;color:#a8792a;display:grid;place-items:center;flex:none"><i class="ph-fill ph-map-pin-area" style="font-size:19px"></i></div><div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#211c17">${esc(property.type)} · ${esc(property.size)}</div><div style="font-size:12.5px;color:#7d7365">${esc(property.loc)}</div></div><div style="font-size:16px;font-weight:800;color:#12a150;flex:none">${formatINR(property.price)}</div></div>`).join('')}</div>` : ''}
        <div style="font-size:13.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7d7365;margin:26px 0 12px">Private link activity</div>${clientLinks.length ? `<div style="display:flex;flex-direction:column;gap:9px">${clientLinks.map((link) => `<div style="display:flex;align-items:center;gap:12px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:14px;padding:14px 16px"><span style="width:38px;height:38px;border-radius:11px;background:${link.status === 'active' ? '#dcf3e5' : '#f3eeff'};color:${link.status === 'active' ? '#12704a' : '#8d8271'};display:grid;place-items:center;flex:none"><i class="ph-fill ph-link" style="font-size:18px"></i></span><span style="flex:1;min-width:0"><span style="display:block;font-size:14.5px;font-weight:800;color:#241f1c">${link.propertyCount || link.props.length} ${(link.propertyCount || link.props.length) === 1 ? 'plot' : 'plots'} · ${link.status}</span><span style="display:block;margin-top:2px;font-size:12.5px;color:#8d8271">${link.events.opens} opens · last ${esc(link.lastOpen)}</span></span>${link.audio === 'done' ? '<i class="ph-fill ph-waveform" title="Voice note attached" style="font-size:19px;color:#6b3fd4"></i>' : ''}</div>`).join('')}</div>` : '<div style="font-size:14.5px;color:#8d8271;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:14px;padding:16px 18px">No private link sent to this customer yet.</div>'}
        <div style="font-size:13.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7d7365;margin:26px 0 12px">Purchased properties</div>${clientDeals.length ? `<div style="display:flex;flex-direction:column;gap:11px">${clientDeals.map((deal) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:14px;padding:16px 18px"><div style="min-width:0"><div style="font-size:15px;font-weight:700;color:#2f2a2d">${esc(deal.prop)}</div><div style="font-size:18px;font-weight:800;color:#c85a1a;font-family:'Newsreader',serif;margin-top:2px">${formatINR(deal.soldPrice)}</div></div><span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:#d9f5e3;color:#0b6f39;font-size:12px;font-weight:800"><i class="ph-fill ph-seal-check" style="font-size:13px"></i>Sold${deal.registrationDate ? ' · registered' : ''}</span></div>`).join('')}</div>` : '<div style="font-size:14.5px;color:#8d8271;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:14px;padding:16px 18px">No completed purchase yet for this customer.</div>'}
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e4dbf7">${deleteArmed ? `<div style="font-size:15px;color:#4c463d;line-height:1.45">Delete this customer and every private link sent to them?</div><div style="display:flex;gap:10px;margin-top:12px"><button data-act="disarm" style="flex:1;height:52px;border-radius:13px;background:#f3eeff;color:#4c463d;font-size:16px;font-weight:800">Keep them</button><button data-act="delete" data-id="${esc(client.id)}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:9px;height:52px;border-radius:13px;background:#c2185b;color:#fff;font-size:16px;font-weight:800"><i class="ph-fill ph-trash" style="font-size:18px"></i>Yes, delete</button></div>` : '<button data-act="arm-delete" style="display:flex;align-items:center;gap:9px;height:50px;padding:0 18px;border-radius:13px;background:#f3eeff;color:#8a7a52;font-size:15.5px;font-weight:800"><i class="ph-fill ph-trash" style="font-size:18px"></i>Delete this customer</button>'}</div>
      </div></section></div>`;
  };

  const render = () => {
    const query = search.trim().toLowerCase();
    const visible = clients.filter((client) => matchesFilter(client) && (!query || `${client.name} ${client.city} ${client.budget}`.toLowerCase().includes(query)));
    const selected = selectedId ? clients.find((client) => client.id === selectedId) : undefined;
    el.innerHTML = `<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both"><div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">My Customers</h1><p style="margin:8px 0 0;font-size:17px;color:#6b6156">Everyone you're working with, and exactly what they want.</p></div><button data-act="add" style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add a customer</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px"><div style="background:#fff3d1;border:1px solid #f6e3ab;border-radius:20px;padding:22px 24px"><div style="font-size:14.5px;color:#6b6156;font-weight:600">Total customers</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:46px;line-height:1;color:#241f1c;margin-top:8px">${clients.length}</div></div><div style="background:#ffe1e6;border:1px solid #f7c4cd;border-radius:20px;padding:22px 24px"><div style="font-size:14.5px;color:#6b6156;font-weight:600">Hot right now</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:46px;line-height:1;color:#b5322a;margin-top:8px">${clients.filter((client) => client.status === 'hot').length}</div></div><div style="background:#efe8fb;border:1px solid #ddd0f5;border-radius:20px;padding:22px 24px"><div style="font-size:14.5px;color:#6b6156;font-weight:600">New this week</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:46px;line-height:1;color:#e79a1f;margin-top:8px">${clients.filter((client) => client.isNew).length}</div></div></div>
      <label style="display:flex;align-items:center;gap:12px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:15px;padding:15px 18px;margin:22px 0 14px;box-shadow:0 1px 2px rgba(30,28,22,.03)"><i class="ph ph-magnifying-glass" style="font-size:21px;color:#8d8271"></i><input id="pm-client-search" value="${esc(search)}" placeholder="Search a name, city or budget…" style="border:none;outline:none;background:none;width:100%;font-size:16px;color:#241f1c"></label><div style="display:flex;align-items:center;gap:9px;margin-bottom:18px;overflow-x:auto;padding-bottom:4px">${filterButton('all', 'Everyone', clients.length)}${filterButton('hot', 'Hot', clients.filter((client) => client.status === 'hot').length)}${filterButton('warm', 'Warm', clients.filter((client) => client.status === 'active').length)}${filterButton('cold', 'Cold', clients.filter((client) => client.status === 'cold').length)}${filterButton('done', 'Done', clients.filter(isDone).length)}</div>
      ${visible.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">${visible.map(clientCard).join('')}</div>` : '<div style="padding:40px;text-align:center;color:#8d8271;font-size:15px;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No customers match. Try another filter or add one.</div>'}</div>${selected ? detailMarkup(selected) : ''}`;
  };

  el.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (target.id === 'pm-client-search') { search = target.value; render(); el.querySelector<HTMLInputElement>('#pm-client-search')?.focus(); return; }
  });
  el.addEventListener('click', (event) => {
    const call = (event.target as HTMLElement).closest('[data-call]');
    if (call) { event.stopPropagation(); return; }
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const action = target.dataset.act;
    if (action === 'filter') filter = (target.dataset.filter || 'all') as typeof filter;
    if (action === 'detail') { selectedId = target.dataset.id || null; deleteArmed = false; }
    if (action === 'close') { selectedId = null; deleteArmed = false; }
    if (action === 'add') {
      let flow: AddClientFlow;
      flow = new AddClientFlow(
        (newClient) => {
          clients.unshift(newClient);
          flow.unmount();
          render();
        },
        () => {
          flow.unmount();
        }
      );
      flow.mount(document.body);
    }
    if (action === 'arm-delete') deleteArmed = true;
    if (action === 'disarm') deleteArmed = false;
    if (action === 'delete' && target.dataset.id) { clients = clients.filter((client) => client.id !== target.dataset.id); selectedId = null; }
    render();
  });
  render();
}
