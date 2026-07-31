import { adapter } from '../../../packages/data/adapter';
import { getInitials } from '../../../packages/auth/auth';
import type { Client, ClientLink, Property } from '../../../packages/data/types';
import { GenerateLinkFlow } from '../../../packages/ui/shared-modals';

const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export async function renderLinks(el: HTMLElement): Promise<void> {
  let links: ClientLink[] = [];
  let clients: Client[] = [];
  let properties: Property[] = [];
  let previewId: string | null = null;

  const [linkResult, clientResult, propertyResult] = await Promise.all([
    adapter.clientLinks.list({ limit: 50 }),
    adapter.customers.list({ limit: 50 }),
    adapter.properties.list({ limit: 50 }),
  ]);
  if (!linkResult.ok || !clientResult.ok || !propertyResult.ok) {
    el.innerHTML = '<div role="alert" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Client links could not be loaded.</div>';
    return;
  }
  links = [...linkResult.value.items];
  clients = [...clientResult.value.items];
  properties = [...propertyResult.value.items];

  const eventChip = (on: boolean, icon: string, label: string) => `<span style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:11.5px;font-weight:800;${on ? 'background:#d9f5e3;color:#0b6f39' : 'background:#f3eeff;color:#a5946f'}"><i class="ph-fill ${icon}" style="font-size:14px"></i>${label}</span>`;
  const linkCard = (link: ClientLink, index: number) => {
    const active = link.status === 'active';
    const propChips = link.props.map((id, propIndex) => {
      const property = properties.find((item) => item.id === id);
      const label = property ? `${property.type.replace('Residential ', '')} · ${property.area}` : (link.propNames[propIndex] || id);
      return `<span style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:9px;background:#fff0c9;border:1px solid #f2dfab;color:#5b4a21;font-size:11.5px;font-weight:700"><i class="ph-fill ph-map-pin-area" style="font-size:14px"></i>${esc(label)}</span>`;
    }).join('');
    const created = ['24 Jul', '22 Jul', '18 Jul', '20 Jul'][index] || 'today';
    const firstProperty = link.props.length === 1
      ? properties.find((item) => item.id === link.props[0])
      : undefined;
    const plotsText = firstProperty
      ? `${firstProperty.type} · ${firstProperty.loc}`
      : `${link.props.length} ${link.props.length === 1 ? 'plot' : 'plots'} in this link`;
    return `<article style="background:#faf7ff;border:1px solid #e4dbf7;border-radius:20px;padding:20px 22px;box-shadow:0 1px 2px rgba(30,28,22,.03),0 16px 34px -28px rgba(30,28,22,.7)">
      <div style="display:flex;align-items:center;gap:14px"><div style="width:48px;height:48px;border-radius:50%;background:#efe8fb;color:#6b3fd4;display:grid;place-items:center;font-size:16px;font-weight:800;flex:none">${getInitials(link.clientName)}</div><div style="flex:1;min-width:0"><div style="font-size:19px;font-weight:800;color:#241f1c">${esc(link.clientName)}</div><div style="font-size:13.5px;color:#8d8271">Sent ${created} · expires ${esc(link.expiry)}</div></div><div style="text-align:right;flex:none"><div style="font-family:'Newsreader',serif;font-weight:600;font-size:26px;color:#241f1c">${link.events.opens} ${link.events.opens === 1 ? 'open' : 'opens'}</div><div style="font-size:12.5px;color:#8d8271">Last: ${esc(link.lastOpen)}</div></div><span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;${active ? 'background:#d9f5e3;color:#0b8f45' : 'background:#f3eeff;color:#8a7a52'}">${active ? 'Live' : titleCase(link.status)}</span></div>
      <div style="font-size:15px;font-weight:700;color:#4c463d;margin-top:14px">${esc(plotsText)}</div><div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px">${propChips}</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px">${eventChip(link.audio === 'done', 'ph-microphone', link.audio === 'done' ? 'Voice note attached' : 'No voice note')}${eventChip(link.events.played > 0, 'ph-waveform', 'Heard your voice note')}${eventChip(link.events.called > 0, 'ph-phone', 'Tapped call')}${eventChip(link.events.wa > 0, 'ph-whatsapp-logo', 'Tapped WhatsApp')}${eventChip(link.events.visit > 0, 'ph-calendar-check', 'Asked for a visit')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid #f6e8c8"><button data-act="preview" data-id="${esc(link.id)}" style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:12px;background:#efe8fb;color:#6b3fd4;font-size:15px;font-weight:800"><i class="ph-fill ph-device-mobile" style="font-size:18px"></i>See their page</button>${active ? `<button style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:12px;background:#e2f2e6;color:#146c3a;font-size:15px;font-weight:800"><i class="ph-fill ph-whatsapp-logo" style="font-size:18px"></i>Send again</button><button data-act="stop" data-id="${esc(link.id)}" style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:12px;background:#ffe1e6;color:#c2185b;font-size:15px;font-weight:800"><i class="ph-fill ph-prohibit" style="font-size:18px"></i>Stop this link</button>` : ''}<div style="flex:1"></div><button data-act="delete" data-id="${esc(link.id)}" style="display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:12px;background:#f3eeff;color:#8a7a52;font-size:15px;font-weight:800"><i class="ph-fill ph-trash" style="font-size:18px"></i>Delete</button></div>
    </article>`;
  };

  const previewMarkup = (link: ClientLink) => `<div style="position:fixed;inset:0;z-index:88;display:grid;place-items:center;padding:24px;background:rgba(26,18,12,.52)"><section role="dialog" aria-modal="true" style="width:min(430px,94vw);border-radius:28px;background:#fffaf0;padding:26px;box-shadow:0 40px 80px -30px rgba(0,0,0,.8)"><button data-act="close-preview" style="float:right;width:38px;height:38px;border-radius:11px;background:#f3eeff"><i class="ph-bold ph-x"></i></button><div style="font-family:'Newsreader',serif;font-size:28px;font-weight:500">${esc(link.clientName)}'s page</div><div style="margin-top:8px;color:#8d8271">${link.props.length} private plots · ${link.events.opens} opens</div><button data-act="close-preview" style="width:100%;height:50px;margin-top:24px;border-radius:13px;background:#6b3fd4;color:#fff;font-weight:800">Close preview</button></section></div>`;

  const render = () => {
    const live = links.filter((link) => link.status === 'active');
    const preview = previewId ? links.find((link) => link.id === previewId) : undefined;
    el.innerHTML = `<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both"><div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">Client Links</h1><p style="margin:8px 0 0;font-size:17px;color:#6b6156">Private pages you sent after a meeting — one link can hold up to 4 plots.</p></div><button data-act="open-build" style="display:flex;align-items:center;gap:9px;padding:16px 24px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16.5px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-fill ph-paper-plane-tilt" style="font-size:19px"></i>Send a new link</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px"><div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:24px 26px"><div style="font-size:14px;color:#8a6a14;font-weight:800">Live right now</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#1f1a12;margin-top:8px">${live.length} live ${live.length === 1 ? 'link' : 'links'}</div></div><div style="background:#efe8fb;border:1.5px solid #ddd0f5;border-radius:20px;padding:24px 26px"><div style="font-size:14px;color:#6b6156;font-weight:800">Times your links were opened</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#5b32c4;margin-top:8px">${links.reduce((sum, link) => sum + link.events.opens, 0)}</div></div></div>
      ${links.length ? `<div style="display:flex;flex-direction:column;gap:14px;margin-top:22px">${links.map(linkCard).join('')}</div>` : '<div style="padding:40px;text-align:center;font-size:16px;color:#8d8271;background:#faf7ff;border:1.5px dashed #e6cf9a;border-radius:20px;margin-top:20px">No links sent yet. Tap “Send a new link” after your next meeting.</div>'}</div>${preview ? previewMarkup(preview) : ''}`;
  };

  el.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const action = target.dataset.act;
    const id = target.dataset.id || '';
    if (action === 'open-build') {
      let flow: GenerateLinkFlow;
      flow = new GenerateLinkFlow(
        clients,
        properties,
        (newLink) => {
          links.unshift(newLink);
          render();
        },
        () => {
          flow.unmount();
        }
      );
      flow.mount(document.body);
    }
    if (action === 'stop') links = links.map((link) => link.id === id ? { ...link, status: 'revoked' } : link);
    if (action === 'delete') links = links.filter((link) => link.id !== id);
    if (action === 'preview') previewId = id;
    if (action === 'close-preview') previewId = null;
    render();
  });
  render();
}
