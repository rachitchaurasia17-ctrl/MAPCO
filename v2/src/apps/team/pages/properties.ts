import { adapter } from '../../../packages/data/adapter';
import { AddPropertyFlow } from '../../../packages/ui/shared-modals';
import type { Property, PropertyType, WantType, Facing } from '../../../packages/data/types';

const esc = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const propertyTypes: PropertyType[] = ['Residential Plot', 'Flat', 'Floor', 'Kothi', 'Villa', 'Commercial'];

export async function renderTeamProperties(el: HTMLElement, openAddInitially = false) {
  const res = await adapter.properties.list({ limit: 100 });
  // Defensive: supabase payloads may omit these arrays — spreading undefined
  // would throw and blank the whole section.
  let properties: Property[] = res.ok
    ? res.value.items.map((property) => ({ ...property, photos: [...(property.photos ?? [])], approvals: [...(property.approvals ?? [])], landmarks: [...(property.landmarks ?? [])] }))
    : [];
  const loadFailed = !res.ok;
  let selectedId: string | null = null;

  const render = () => {
    el.innerHTML = `
      <div style="max-width:1140px;margin:0 auto;padding:40px 34px 70px">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;animation:wRise .5s cubic-bezier(.2,.8,.2,1) both">
          <div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:38px;letter-spacing:-.02em">Properties</h1><p style="margin:9px 0 0;font-size:16.5px;color:#6b6156">Everything the team has entered. Toggle a plot to put it on the client screen.</p></div>
          <button data-action="add" style="display:flex;align-items:center;gap:9px;padding:14px 20px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:15.5px;font-weight:800;box-shadow:0 14px 26px -16px rgba(168,121,42,.9)"><i class="ph-bold ph-plus"></i>Add a property</button>
        </div>
        ${loadFailed
          ? `<div style="margin-top:40px;padding:40px;text-align:center;background:#fffaf0;border:1px solid #ddd2f5;border-radius:20px;color:#8d8271"><i class="ph-fill ph-warning-circle" style="font-size:34px;color:#c2622a;display:block;margin-bottom:10px"></i>Could not load properties. Check the connection and refresh.</div>`
          : properties.length === 0
            ? `<div style="margin-top:40px;padding:44px;text-align:center;background:#fffaf0;border:1px solid #ddd2f5;border-radius:20px;color:#8d8271"><i class="ph-fill ph-buildings" style="font-size:36px;color:#b5924a;display:block;margin-bottom:10px"></i>No properties yet. Use “Add a property” to enter your first plot.</div>`
            : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-top:26px">
                ${properties.map((property) => propertyCard(property)).join('')}
              </div>`}
      </div>
      ${selectedId ? editDialog(properties.find((property) => property.id === selectedId)!) : ''}
    `;
  };

  const close = () => { selectedId = null; render(); };

  // Same Add Property flow as the dealer dashboard (stepwise + map pin + publish).
  const reloadProps = async () => {
    const r = await adapter.properties.list({ limit: 100 });
    if (r.ok) properties = r.value.items.map((p) => ({ ...p, photos: [...(p.photos ?? [])], approvals: [...(p.approvals ?? [])], landmarks: [...(p.landmarks ?? [])] }));
    render();
  };
  const openAddFlow = () => {
    let flow: AddPropertyFlow;
    flow = new AddPropertyFlow(
      [...new Set(properties.map((p) => p.city).filter(Boolean))],
      () => { flow.unmount(); void reloadProps(); },
      () => { flow.unmount(); },
    );
    flow.mount(document.body);
  };

  el.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    const id = target.closest<HTMLElement>('[data-id]')?.dataset.id;

    if (action === 'close') return close();
    if (action === 'dialog') return;
    if (action === 'add') { openAddFlow(); return; }
    if (action === 'edit' && id) { selectedId = id; return render(); }
    if (action === 'toggle' && id) {
      const property = properties.find((item) => item.id === id);
      if (property) property.published = !property.published;
      return render();
    }
    if (action === 'delete' && id) {
      properties = properties.filter((item) => item.id !== id);
      return close();
    }
    if (action === 'save-edit' && id) {
      const property = properties.find((item) => item.id === id);
      const form = target.closest('form') as HTMLFormElement | null;
      if (property && form) {
        const data = new FormData(form);
        property.type = String(data.get('type')) as PropertyType;
        property.city = String(data.get('city'));
        property.loc = String(data.get('loc'));
        property.sector = property.loc;
        property.size = String(data.get('size'));
        property.facing = String(data.get('facing')) as Facing;
      }
      return close();
    }
    if (action === 'save-add') {
      return; // legacy add dialog removed — Add Property now uses the shared flow
    }
    const card = target.closest<HTMLElement>('[data-property-card]');
    if (card?.dataset.id && !target.closest('button')) { selectedId = card.dataset.id; return render(); }
  });

  el.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>('[data-property-card]');
    if (card?.dataset.id && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); selectedId = card.dataset.id; render();
    }
    if (event.key === 'Escape' && selectedId) close();
  });

  render();
  if (openAddInitially) openAddFlow();
}

function propertyCard(property: Property) {
  const photo = property.photos[0];
  return `<article data-property-card data-id="${esc(property.id)}" tabindex="0" role="button" aria-label="Open ${esc(property.type)} in ${esc(property.loc)}" style="border-radius:22px;overflow:hidden;background:#fffaf0;border:1px solid #ddd2f5;box-shadow:0 2px 3px rgba(40,30,10,.04),0 22px 44px -36px rgba(60,44,12,.8);animation:wRise .5s cubic-bezier(.2,.8,.2,1) both;cursor:pointer">
    <div style="position:relative;height:150px;background:${photo ? `url('${esc(photo)}') center/cover` : '#efdcb2'}">${photo ? '' : '<i class="ph-fill ph-image" style="position:absolute;inset:0;display:grid;place-items:center;color:#b5924a;font-size:40px"></i>'}<span style="position:absolute;top:12px;left:12px;padding:6px 11px;border-radius:9px;background:rgba(24,16,4,.62);font-size:12.5px;font-weight:700;color:#faf7ff">${property.photos.length} photos</span><span style="position:absolute;top:12px;right:12px;padding:6px 11px;border-radius:9px;background:${property.published ? '#d9f5e3' : '#fffaf0'};font-size:12.5px;font-weight:700;color:${property.published ? '#0b6f39' : '#8a5a0c'}">${property.published ? 'Published' : property.photos.length ? 'Ready' : 'Need photos'}</span></div>
    <div style="padding:18px 20px 20px"><div style="font-size:17.5px;font-weight:800">${esc(property.type)}</div><div style="margin-top:4px;font-size:14.5px;color:#6b6156">${esc(property.loc)}, ${esc(property.area)}</div><div style="display:flex;gap:7px;margin-top:14px"><span style="padding:6px 10px;border-radius:9px;background:#f0eaff;font-size:12.5px;font-weight:700">${esc(property.size)}</span><span style="padding:6px 10px;border-radius:9px;background:#f0eaff;font-size:12.5px;font-weight:700">${esc(property.facing)} facing</span></div><div style="display:flex;gap:10px;margin-top:16px"><button data-action="toggle" data-id="${esc(property.id)}" style="flex:1;padding:11px;border-radius:12px;background:${property.published ? '#ffe6cf' : '#dcf3e5'};color:${property.published ? '#c2622a' : '#12704a'};font-size:13.5px;font-weight:800"><i class="ph-bold ${property.published ? 'ph-eye-slash' : 'ph-eye'}"></i> ${property.published ? 'Hide property' : 'Publish to clients'}</button><button data-action="edit" data-id="${esc(property.id)}" style="padding:11px 14px;border-radius:12px;background:#efe8fb;border:1px solid #d6c6f5;color:#5b32c4;font-size:13.5px;font-weight:800"><i class="ph-bold ph-pencil-simple"></i> Edit</button></div></div>
  </article>`;
}

function dialogShell(body: string) {
  return `<div data-action="close" style="position:fixed;inset:0;z-index:80;background:rgba(28,20,6,.55);backdrop-filter:blur(5px);display:flex;justify-content:center;align-items:flex-start;padding:34px 24px;overflow-y:auto;animation:wFade .2s ease both">${body}</div>`;
}

function editDialog(property: Property) {
  return dialogShell(`<form data-action="dialog" style="width:100%;max-width:660px;border-radius:28px;background:#fffaf0;border:1px solid #ddd2f5;box-shadow:0 40px 80px -30px rgba(24,16,4,.8);overflow:hidden">
    <div style="display:flex;align-items:center;gap:14px;padding:24px 26px;border-bottom:1px solid #e4dbf7"><span style="width:46px;height:46px;border-radius:14px;background:#ffc93c;display:grid;place-items:center"><i class="ph-fill ph-house-line" style="font-size:24px"></i></span><div style="flex:1"><div style="font-family:'Newsreader',serif;font-size:26px">Edit property</div><div style="font-size:14px;color:#8d8271">Changes stay in the team workspace until published.</div></div><button type="button" data-action="close" aria-label="Close" style="width:38px;height:38px;border-radius:12px;background:#f0eaff"><i class="ph-bold ph-x"></i></button></div>
    <div style="padding:24px 26px"><div style="height:190px;border-radius:18px;background:${property.photos[0] ? `url('${esc(property.photos[0])}') center/cover` : '#efdcb2'}"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px"><select name="type" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px">${propertyTypes.map((type) => `<option ${type === property.type ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select><input name="city" value="${esc(property.city)}" placeholder="City" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px"><input name="loc" value="${esc(property.loc)}" placeholder="Sector / locality" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px"><input name="size" value="${esc(property.size)}" placeholder="Size" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px"><input name="facing" value="${esc(property.facing)}" placeholder="Facing" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px"></div><div style="display:flex;gap:11px;margin-top:22px"><button type="button" data-action="toggle" data-id="${esc(property.id)}" style="padding:15px 20px;border-radius:14px;background:${property.published ? '#ffe6cf' : '#dcf3e5'};color:${property.published ? '#c2622a' : '#12704a'};font-weight:800">${property.published ? 'Take off client screen' : 'Put on client screen'}</button><div style="flex:1"></div><button type="button" data-action="delete" data-id="${esc(property.id)}" style="width:50px;border-radius:14px;background:#ffe1e6;color:#b3123a"><i class="ph-fill ph-trash"></i></button><button type="button" data-action="save-edit" data-id="${esc(property.id)}" style="padding:15px 26px;border-radius:14px;background:#241d0c;color:#ffd75e;font-weight:800">Save changes</button></div></div>
  </form>`);
}

function addDialog() {
  return dialogShell(`<form data-action="dialog" style="width:100%;max-width:660px;border-radius:28px;background:#fffaf0;border:1px solid #ddd2f5;box-shadow:0 40px 80px -30px rgba(24,16,4,.8);overflow:hidden"><div style="display:flex;align-items:center;gap:14px;padding:24px 26px;border-bottom:1px solid #e4dbf7"><span style="width:46px;height:46px;border-radius:14px;background:#ffc93c;display:grid;place-items:center"><i class="ph-fill ph-house-line" style="font-size:24px"></i></span><div style="flex:1"><div style="font-family:'Newsreader',serif;font-size:26px">Add a property</div><div style="font-size:14px;color:#8d8271">Only the fields you fill will show. Nothing goes live until you publish.</div></div><button type="button" data-action="close" aria-label="Close" style="width:38px;height:38px;border-radius:12px;background:#f0eaff"><i class="ph-bold ph-x"></i></button></div><div style="padding:24px 26px"><div style="font-size:12.5px;font-weight:800;text-transform:uppercase;color:#8d8271">Where is it</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:11px"><input name="city" placeholder="City — Mohali" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px"><input name="loc" placeholder="Sector / locality — Sector 79" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px"></div><div style="margin-top:22px;font-size:12.5px;font-weight:800;text-transform:uppercase;color:#8d8271">What is it</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:11px"><select name="type" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px">${propertyTypes.map((type) => `<option>${esc(type)}</option>`).join('')}</select><input name="size" placeholder="Size — 250 sq yd" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px"><input name="facing" placeholder="Facing — East" style="padding:15px;border-radius:13px;border:1px solid #dcd0f3;background:#faf7ff;font-size:16px"></div><div style="display:flex;gap:11px;margin-top:22px"><button type="button" data-action="save-add" style="flex:1;padding:16px;border-radius:15px;background:#ffc93c;font-size:16px;font-weight:800">Save property</button><button type="button" data-action="close" style="padding:16px 22px;border-radius:15px;background:#f0eaff;font-weight:700">Cancel</button></div></div></form>`);
}
