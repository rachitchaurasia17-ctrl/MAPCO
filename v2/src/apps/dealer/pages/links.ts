import { activeDataMode, adapter } from '../../../packages/data/adapter';
import { getInitials, getProfile } from '../../../packages/auth/auth';
import type { Client, ClientLink, Property } from '../../../packages/data/types';
import { GenerateLinkFlow } from '../../../packages/ui/shared-modals';
import { renderClientLinkView, previewPayloadFromLink, type ClientLinkViewMap } from '../../../packages/ui/client-link-view';
import { getSession } from '../../../packages/data/session';
import { PredictiveRuntime, dealerScope, sessionScope } from '../../../packages/performance';
import { productRoutes, requestedPropertyId } from '../../../packages/ui/product-routes';
import { listAllRecords } from '../../../packages/data/list-all';

const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
let activeLinkPredictive: PredictiveRuntime | null = null;

export async function renderLinks(el: HTMLElement): Promise<void> {
  activeLinkPredictive?.dispose();
  el.innerHTML = '<div role="status" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#faf7ff;color:#6b6156">Loading client links…</div>';
  const dealerSession = await getSession().catch(() => null);
  const predictive = new PredictiveRuntime(dealerSession ? dealerScope(dealerSession.userId) : sessionScope(), {
    async record(event, signal) {
      const result = await adapter.predictive.record(event, { signal });
      if (!result.ok) throw new Error(result.error.message);
    },
    async summaries(signal) {
      const result = await adapter.predictive.summaries({ signal });
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
  });
  activeLinkPredictive = predictive;
  let links: ClientLink[] = [];
  let clients: Client[] = [];
  let properties: Property[] = [];
  let maps: ClientLinkViewMap[] = [];
  let previewId: string | null = null;

  const [linkResult, clientResult, propertyResult, mapResult] = await Promise.all([
    listAllRecords((params, opts) => adapter.clientLinks.list(params, opts)),
    listAllRecords((params, opts) => adapter.customers.list(params, opts)),
    listAllRecords((params, opts) => adapter.properties.list(params, opts)),
    listAllRecords((params, opts) => adapter.maps.listRegistry(params, opts)),
  ]);
  if (!linkResult.ok || !clientResult.ok || !propertyResult.ok) {
    el.innerHTML = '<div role="alert" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Client links could not be loaded.</div>';
    return;
  }
  links = linkResult.value;
  clients = clientResult.value;
  properties = propertyResult.value;
  predictive.recordAction('route-opened', { type: 'route', id: 'client-links' });
  void predictive.loadHistory();
  if (mapResult.ok) maps = mapResult.value.map((m) => ({
    id: m.id, kind: m.kind, city: m.city, sector: m.sector, area: m.area,
    label: m.label, parentMapId: m.parentMapId, raster: m.raster,
    assets: m.assets, dims: m.dims,
  }));

  const eventChip = (icon: string, label: string) => `<span style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:11.5px;font-weight:800;background:#d9f5e3;color:#0b6f39"><i class="ph-fill ${icon}" style="font-size:14px"></i>${label}</span>`;
  const linkCard = (link: ClientLink) => {
    const active = link.status === 'active';
    const propChips = link.props.map((id, propIndex) => {
      const property = properties.find((item) => item.id === id);
      const label = property ? `${property.type.replace('Residential ', '')} · ${property.area}` : (link.propNames[propIndex] || id);
      return `<span style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:9px;background:#fff0c9;border:1px solid #f2dfab;color:#5b4a21;font-size:11.5px;font-weight:700"><i class="ph-fill ph-map-pin-area" style="font-size:14px"></i>${esc(label)}</span>`;
    }).join('');
    const created = link.createdAt ? `Sent ${esc(link.createdAt)} · ` : '';
    const firstProperty = link.props.length === 1
      ? properties.find((item) => item.id === link.props[0])
      : undefined;
    const plotCount = link.props.length || link.propertyCount || 0;
    const plotsText = firstProperty
      ? `${firstProperty.type} · ${firstProperty.loc}`
      : `${plotCount} ${plotCount === 1 ? 'plot' : 'plots'} in this link`;
    const recordedEvents = [
      link.audio === 'done' ? eventChip('ph-microphone', 'Voice note attached') : '',
      link.events.played > 0 ? eventChip('ph-waveform', 'Voice note played') : '',
      link.events.called > 0 ? eventChip('ph-phone', 'Call tapped') : '',
      link.events.wa > 0 ? eventChip('ph-whatsapp-logo', 'WhatsApp tapped') : '',
      link.events.visit > 0 ? eventChip('ph-calendar-check', 'Visit requested') : '',
    ].filter(Boolean);
    return `<article style="background:#faf7ff;border:1px solid #e4dbf7;border-radius:20px;padding:20px 22px;box-shadow:0 1px 2px rgba(30,28,22,.03),0 16px 34px -28px rgba(30,28,22,.7)">
      <div style="display:flex;align-items:center;gap:14px"><div style="width:48px;height:48px;border-radius:50%;background:#efe8fb;color:#6b3fd4;display:grid;place-items:center;font-size:16px;font-weight:800;flex:none">${getInitials(link.clientName)}</div><div style="flex:1;min-width:0"><div style="font-size:19px;font-weight:800;color:#241f1c">${esc(link.clientName)}</div><div style="font-size:13.5px;color:#8d8271">${created}expires ${esc(link.expiry)}</div></div><div style="text-align:right;flex:none"><div style="font-family:'Newsreader',serif;font-weight:600;font-size:26px;color:#241f1c">${link.events.opens} ${link.events.opens === 1 ? 'open' : 'opens'}</div><div style="font-size:12.5px;color:#8d8271">Last: ${esc(link.lastOpen)}</div></div><span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;${active ? 'background:#d9f5e3;color:#0b8f45' : 'background:#f3eeff;color:#8a7a52'}">${active ? 'Live' : titleCase(link.status)}</span></div>
      <div style="font-size:15px;font-weight:700;color:#4c463d;margin-top:14px">${esc(plotsText)}</div><div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px">${propChips}</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px">${recordedEvents.join('') || '<span style="font-size:12.5px;color:#8d8271">No link actions recorded yet.</span>'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid #f6e8c8"><button data-act="preview" data-id="${esc(link.id)}" style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:12px;background:#efe8fb;color:#6b3fd4;font-size:15px;font-weight:800"><i class="ph-fill ph-device-mobile" style="font-size:18px"></i>See their page</button>${active ? `<button data-act="stop" data-id="${esc(link.id)}" style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:12px;background:#ffe1e6;color:#c2185b;font-size:15px;font-weight:800"><i class="ph-fill ph-prohibit" style="font-size:18px"></i>Stop this link</button>` : ''}</div>
    </article>`;
  };

  // The preview is the REAL client page (same shared renderer) in a phone frame,
  // beside the "what your client sees" explainer — matches the approved design.
  const previewMarkup = (_link: ClientLink) => {
    return `<div id="pm-preview-backdrop" style="position:fixed;inset:0;z-index:88;display:grid;place-items:center;padding:24px;background:rgba(15,10,24,.72);backdrop-filter:blur(4px)"><section role="dialog" aria-modal="true" style="width:min(880px,96vw);max-height:94vh;border-radius:28px;background:#140d20;box-shadow:0 40px 90px -30px rgba(0,0,0,.85);display:flex;gap:8px;overflow:hidden;padding:20px">
      <div style="flex:none;width:360px;max-width:52vw"><div style="height:600px;max-height:82vh;border-radius:30px;overflow:hidden;border:9px solid #241d0c;background:#0f0a18;box-shadow:0 24px 50px -24px rgba(0,0,0,.7)"><div id="pm-link-preview-screen" style="height:100%;overflow-y:auto"></div></div></div>
      <div style="flex:1;min-width:0;padding:14px 12px 8px;display:flex;flex-direction:column;color:#fff8e6">
        <div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c9b6ef">What your client sees</div>
        <div style="font-family:'Newsreader',serif;font-weight:500;font-size:30px;margin-top:6px;color:#fffdf7">On their phone</div>
        <p style="font-size:15px;line-height:1.6;color:#c9b6ef;margin:14px 0 0">Photos first, your voice next, then one big button to call you. Nothing about the seller, your commission or your notes.</p>
        <div style="flex:1"></div>
        <button data-act="close-preview" style="align-self:flex-start;display:flex;align-items:center;gap:9px;height:48px;padding:0 20px;border-radius:14px;background:rgba(255,248,230,.1);color:#fff8e6;font-size:15px;font-weight:800;cursor:pointer"><i class="ph-bold ph-x"></i>Close preview</button>
      </div>
    </section></div>`;
  };

  const mountPreview = (link: ClientLink) => {
    const screen = el.querySelector<HTMLElement>('#pm-link-preview-screen');
    if (!screen) return;
    const profile = activeDataMode() === 'supabase' ? null : getProfile();
    const dealerName = profile?.dealerName || profile?.name || 'Your dealer';
    const payload = previewPayloadFromLink(link, properties, dealerName, {
      buyerName: (link.clientName || '').split(' ')[0],
    });
    renderClientLinkView(screen, payload, { embedded: true, maps });
  };

  const render = () => {
    const live = links.filter((link) => link.status === 'active');
    const preview = previewId ? links.find((link) => link.id === previewId) : undefined;
    el.innerHTML = `<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both"><div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">Client Links</h1><p style="margin:8px 0 0;font-size:17px;color:#6b6156">Private pages you sent after a meeting — one link can hold up to 4 plots.</p></div><button data-act="open-build" style="display:flex;align-items:center;gap:9px;padding:16px 24px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16.5px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-fill ph-paper-plane-tilt" style="font-size:19px"></i>Send a new link</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px"><div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:24px 26px"><div style="font-size:14px;color:#8a6a14;font-weight:800">Live right now</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#1f1a12;margin-top:8px">${live.length} live ${live.length === 1 ? 'link' : 'links'}</div></div><div style="background:#efe8fb;border:1.5px solid #ddd0f5;border-radius:20px;padding:24px 26px"><div style="font-size:14px;color:#6b6156;font-weight:800">Times your links were opened</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#5b32c4;margin-top:8px">${links.reduce((sum, link) => sum + link.events.opens, 0)}</div></div></div>
      ${links.length ? `<div style="display:flex;flex-direction:column;gap:14px;margin-top:22px">${links.map(linkCard).join('')}</div>` : '<div style="padding:40px;text-align:center;font-size:16px;color:#8d8271;background:#faf7ff;border:1.5px dashed #e6cf9a;border-radius:20px;margin-top:20px">No links sent yet. Tap “Send a new link” after your next meeting.</div>'}</div>${preview ? previewMarkup(preview) : ''}`;
    if (preview) mountPreview(preview);
  };

  const openBuilder = (initialPropertyId?: string) => {
    let flow: GenerateLinkFlow;
    flow = new GenerateLinkFlow(
      clients,
      properties,
      () => {
        // A link was created server-side — refresh the real list.
        void listAllRecords((params, opts) => adapter.clientLinks.list(params, opts)).then((result) => {
          if (result.ok) {
            links = result.value;
            render();
          }
        });
      },
      () => { flow.unmount(); },
      predictive,
      { propertyIds: initialPropertyId ? [initialPropertyId] : [] },
    );
    flow.mount(document.body);
  };

  el.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).id === 'pm-preview-backdrop') { previewId = null; render(); return; }
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const action = target.dataset.act;
    const id = target.dataset.id || '';
    if (action === 'open-build') {
      openBuilder();
      return;
    }
    if (action === 'stop') {
      // Deactivate (revoke) the link so it can no longer be opened.
      links = links.map((link) => link.id === id ? { ...link, status: 'revoked' } : link);
      render();
      void adapter.clientLinks.revoke(id).then((r) => {
        if (!r.ok) void listAllRecords((params, opts) => adapter.clientLinks.list(params, opts)).then((res) => { if (res.ok) { links = res.value; render(); } });
      });
      return;
    }
    if (action === 'preview') previewId = id;
    if (action === 'close-preview') previewId = null;
    render();
  });
  render();
  const initialPropertyId = requestedPropertyId();
  if (initialPropertyId && properties.some((property) => property.id === initialPropertyId)) {
    history.replaceState({}, '', productRoutes.privateLink());
    openBuilder(initialPropertyId);
  }
}
