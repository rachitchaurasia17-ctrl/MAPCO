import { adapter } from '../../../packages/data/adapter';
import { AddClientFlow, GenerateLinkFlow } from '../../../packages/ui/shared-modals';
import type { Client, Property, WantType } from '../../../packages/data/types';

const esc = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export async function renderTeamClients(el: HTMLElement, initialAction: 'add' | 'link' | null = null) {
  const [clientRes, propertyRes] = await Promise.all([
    adapter.customers.list({ limit: 100 }),
    adapter.properties.list({ limit: 100 }),
  ]);
  let clients: Client[] = clientRes.ok ? clientRes.value.items.map((client) => ({ ...client, viewed: [...client.viewed], interest: [...client.interest] })) : [];
  const properties: Property[] = propertyRes.ok ? [...propertyRes.value.items] : [];
  let editId: string | null = null;

  const render = () => {
    el.innerHTML = `
      <div style="max-width:1180px;margin:0 auto;padding:36px 34px 70px">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:22px;flex-wrap:wrap;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both"><div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:42px;letter-spacing:-.025em">Clients</h1><p style="margin:10px 0 0;font-size:16.5px;color:#6b6156">Everyone the dealer is talking to, and what they are looking for.</p></div><button data-action="add" style="display:flex;align-items:center;gap:9px;padding:14px 20px;border-radius:14px;background:#5b32c4;color:#fff;font-size:15.5px;font-weight:800;box-shadow:0 14px 26px -16px rgba(91,50,196,.95)"><i class="ph-bold ph-plus"></i>Add a client</button></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-top:26px">${clients.map(clientCard).join('')}</div>
      </div>
      ${editId ? clientDialog(clients.find((client) => client.id === editId)) : ''}
    `;
  };

  const close = () => { editId = null; render(); };

  // Add Client / Send Link use the SAME shared flows as the dealer dashboard.
  const openAdd = () => {
    let flow: AddClientFlow;
    flow = new AddClientFlow(
      (saved) => { clients.unshift(saved); flow.unmount(); render(); },
      () => flow.unmount(),
    );
    flow.mount(document.body);
  };
  const openLink = (clientId: string | null) => {
    let flow: GenerateLinkFlow;
    flow = new GenerateLinkFlow(
      clients, properties,
      () => { void adapter.clientLinks.list({ limit: 50 }); },
      () => flow.unmount(),
    );
    flow.mount(document.body);
    if (clientId) {
      (flow as unknown as { chosenClient: string; render: () => void }).chosenClient = clientId;
      (flow as unknown as { render: () => void }).render();
    }
  };

  el.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const actionable = target.closest<HTMLElement>('[data-action]');
    const action = actionable?.dataset.action;
    const id = actionable?.dataset.id || target.closest<HTMLElement>('[data-client-card]')?.dataset.id;
    if (action === 'dialog') return;
    if (action === 'close') return close();
    if (action === 'add') { openAdd(); return; }
    if (action === 'edit' && id) { editId = id; return render(); }
    if (action === 'link') { openLink(id || null); return; }
    if (action === 'delete' && id) { clients = clients.filter((client) => client.id !== id); return render(); }
    if (action === 'save-client') {
      const form = target.closest('form') as HTMLFormElement | null;
      if (!form) return;
      const data = new FormData(form);
      const name = String(data.get('name') || '').trim();
      if (!name) return;
      if (editId) {
        const client = clients.find((item) => item.id === editId);
        if (client) { client.name = name; client.phone = String(data.get('phone') || ''); client.want = String(data.get('want') || client.want) as WantType; client.note = String(data.get('note') || ''); }
      } else {
        clients.unshift({ id: `team-${Date.now()}`, name, phone: String(data.get('phone') || ''), city: 'Mohali', want: String(data.get('want') || 'Plot') as WantType, budget: 'Not set', budgetMax: 0, status: 'active', seen: 'today', note: String(data.get('note') || ''), viewed: [], interest: [], isNew: true });
      }
      return close();
    }
    const card = target.closest<HTMLElement>('[data-client-card]');
    if (card?.dataset.id && !target.closest('button')) { editId = card.dataset.id; return render(); }
  });

  el.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>('[data-client-card]');
    if (card?.dataset.id && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); editId = card.dataset.id; render(); }
    if (event.key === 'Escape' && editId) close();
  });

  render();
  if (initialAction === 'add') openAdd();
  if (initialAction === 'link') openLink(null);
}

function clientCard(client: Client) {
  const initials = client.name.split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const hot = client.status === 'hot';
  return `<article data-client-card data-id="${esc(client.id)}" tabindex="0" role="button" aria-label="Open ${esc(client.name)}" style="padding:20px;border-radius:22px;background:#fffaf0;border:1px solid #e4dbf2;box-shadow:0 2px 3px rgba(40,30,10,.04),0 24px 46px -38px rgba(70,40,150,.8);animation:wRise .5s cubic-bezier(.2,.8,.2,1) both;cursor:pointer"><div style="display:flex;align-items:center;gap:13px"><span style="width:48px;height:48px;border-radius:15px;background:#5b32c4;color:#fff;display:grid;place-items:center;font-size:16.5px;font-weight:800">${esc(initials)}</span><div style="flex:1;min-width:0"><div style="font-size:17.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(client.name)}</div><div style="margin-top:2px;font-size:14px;color:#8d8271">${esc(client.phone || 'No number yet')}</div></div><span style="padding:6px 11px;border-radius:9px;background:${hot ? '#ffe6cf' : '#f0eaff'};font-size:12px;font-weight:800;color:${hot ? '#c2622a' : '#8d8271'}">${hot ? 'Hot' : 'Warm'}</span></div><div style="margin-top:15px;padding:12px 14px;border-radius:13px;background:#faf7ff;border:1px solid #ece5f8"><div style="font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#5b32c4">Looking for</div><div style="margin-top:4px;font-size:15px;font-weight:600;color:#4c463d">${esc(client.want)} in ${esc(client.city)}</div></div><div style="display:flex;gap:9px;margin-top:15px"><button data-action="edit" data-id="${esc(client.id)}" style="flex:1;padding:12px;border-radius:12px;background:#efe8fb;border:1px solid #d6c6f5;color:#5b32c4;font-size:13.5px;font-weight:800"><i class="ph-bold ph-pencil-simple"></i> Edit details</button><button data-action="link" data-id="${esc(client.id)}" style="flex:1;padding:12px;border-radius:12px;background:#dcf3e5;border:1px solid #b3e0c6;color:#12704a;font-size:13.5px;font-weight:800"><i class="ph-fill ph-paper-plane-tilt"></i> Send link</button><button data-action="delete" data-id="${esc(client.id)}" aria-label="Delete ${esc(client.name)}" style="width:42px;border-radius:12px;background:#ffe1e6;color:#b3123a"><i class="ph-fill ph-trash"></i></button></div></article>`;
}

function overlay(body: string) {
  return `<div data-action="close" style="position:fixed;inset:0;z-index:80;background:rgba(28,20,6,.55);backdrop-filter:blur(5px);display:flex;justify-content:center;align-items:flex-start;padding:34px 24px;overflow-y:auto;animation:wFade .2s ease both">${body}</div>`;
}

function clientDialog(client?: Client) {
  return overlay(`<form data-action="dialog" style="width:100%;max-width:560px;border-radius:28px;background:#fffaf0;border:1px solid #e4dbf2;box-shadow:0 40px 80px -30px rgba(24,16,4,.8);overflow:hidden"><div style="display:flex;align-items:center;gap:14px;padding:24px 26px;border-bottom:1px solid #ece5f8"><span style="width:46px;height:46px;border-radius:14px;background:#5b32c4;color:#efe8fb;display:grid;place-items:center"><i class="ph-fill ph-user-plus" style="font-size:24px"></i></span><div style="flex:1"><div style="font-family:'Newsreader',serif;font-size:26px">${client ? 'Edit client' : 'Add a client'}</div><div style="font-size:14px;color:#8d8271">Name and phone is enough to start.</div></div><button type="button" data-action="close" aria-label="Close" style="width:38px;height:38px;border-radius:12px;background:#f4f0fb"><i class="ph-bold ph-x"></i></button></div><div style="padding:24px 26px"><div style="display:flex;flex-direction:column;gap:12px"><input name="name" value="${esc(client?.name)}" placeholder="Full name" style="padding:16px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16.5px;font-weight:600"><input name="phone" value="${esc(client?.phone)}" placeholder="Phone number" style="padding:16px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16.5px"><input name="want" value="${esc(client?.want)}" placeholder="Looking for — Plot" style="padding:16px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16px"><textarea name="note" rows="3" placeholder="Any note for the dealer…" style="padding:16px;border-radius:13px;border:1px solid #ddd0f5;background:#faf7ff;font-size:16px;resize:vertical">${esc(client?.note)}</textarea></div><div style="display:flex;gap:11px;margin-top:22px"><button type="button" data-action="save-client" style="flex:1;padding:16px;border-radius:15px;background:#5b32c4;color:#fff;font-size:16px;font-weight:800">${client ? 'Save changes' : 'Save client'}</button><button type="button" data-action="close" style="padding:16px 22px;border-radius:15px;background:#f4f0fb;font-weight:700">Cancel</button></div></div></form>`);
}

