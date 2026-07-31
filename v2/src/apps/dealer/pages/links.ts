import { adapter } from '../../../packages/data/mock-adapter-v2';
import { getInitials } from '../../../packages/auth/auth';
import type { Client, ClientLink, Property } from '../../../packages/data/types';

const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export async function renderLinks(el: HTMLElement): Promise<void> {
  let links: ClientLink[] = [];
  let clients: Client[] = [];
  let properties: Property[] = [];
  let buildOpen = false;
  let buildDone = false;
  let chosenClient = '';
  let chosenProps: string[] = [];
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

  const builderMarkup = () => {
    if (buildDone) {
      const client = clients.find((item) => item.id === chosenClient);
      return `<div style="position:fixed;inset:0;z-index:86;display:flex;justify-content:center;align-items:flex-start;padding:28px 24px;overflow-y:auto"><div data-act="close-build" style="position:fixed;inset:0;background:rgba(60,44,12,.58)"></div><div role="dialog" aria-modal="true" style="position:relative;width:100%;max-width:660px;border-radius:28px;background:#fffaf0;box-shadow:0 0 0 1px #cfe6d8,0 40px 80px -30px rgba(40,26,2,.8);padding:32px 30px"><div style="width:64px;height:64px;margin:0 auto;border-radius:20px;background:#dcf3e5;color:#12a150;display:grid;place-items:center"><i class="ph-fill ph-check-circle" style="font-size:34px"></i></div><div style="margin-top:16px;text-align:center;font-family:'Newsreader',serif;font-weight:500;font-size:28px;color:#241d0c">Link is ready</div><div style="margin-top:7px;text-align:center;font-size:15.5px;color:#6b6156">Private to ${esc(client?.name || 'this customer')} · ${chosenProps.length} plots</div><div style="display:flex;align-items:center;gap:10px;margin-top:22px;padding:15px 17px;border-radius:14px;background:#faf7ff;border:1px solid #e4dbf7"><i class="ph-bold ph-link-simple" style="font-size:18px;color:#a8792a"></i><span style="flex:1;font-size:14.5px;font-weight:600;color:#4c463d">plotmap.in/p/${esc((client?.name || 'client').split(' ')[0]!.toLowerCase())}-ready</span></div><button data-act="close-build" style="width:100%;height:54px;margin-top:16px;border-radius:14px;background:#12a150;color:#fff;font-size:16px;font-weight:800">Done</button></div></div>`;
    }
    const ready = Boolean(chosenClient && chosenProps.length);
    return `<div style="position:fixed;inset:0;z-index:86;display:flex;justify-content:center;align-items:flex-start;padding:28px 24px;overflow-y:auto"><div data-act="close-build" style="position:fixed;inset:0;background:rgba(60,44,12,.58);animation:omVeil .2s ease both"></div><section role="dialog" aria-modal="true" aria-label="Send a private link" style="position:relative;width:100%;max-width:660px;border-radius:28px;background:#fffaf0;box-shadow:0 0 0 1px #cfe6d8,0 40px 80px -30px rgba(40,26,2,.8);overflow:hidden;animation:omSheet .34s cubic-bezier(.2,.8,.2,1) both">
      <div style="display:flex;align-items:center;gap:14px;padding:22px 26px;border-bottom:1px solid #ddeee4;background:#dcf3e5"><span style="width:46px;height:46px;border-radius:14px;background:#12704a;color:#fff;display:grid;place-items:center;flex:none"><i class="ph-fill ph-paper-plane-tilt" style="font-size:23px"></i></span><div style="flex:1;min-width:0"><div style="font-family:'Newsreader',serif;font-weight:500;font-size:26px;letter-spacing:-.02em;color:#241d0c">Send a private link</div><div style="font-size:14px;color:#12704a">One page, only for them. Voice note optional.</div></div><button data-act="close-build" style="width:38px;height:38px;border-radius:12px;background:#fffaf0;color:#6b6156;display:grid;place-items:center;flex:none"><i class="ph-bold ph-x" style="font-size:16px"></i></button></div>
      <div data-scroll style="padding:22px 26px;max-height:60vh;overflow-y:auto"><div style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Who is it for</div><div style="display:flex;flex-direction:column;gap:9px;margin-top:11px">${clients.map((client) => { const on = chosenClient === client.id; return `<button data-act="choose-client" data-id="${esc(client.id)}" style="display:flex;align-items:center;gap:12px;width:100%;padding:11px 13px;border-radius:14px;transition:all .16s;${on ? 'background:#dcf3e5;border:1px solid #12a150' : 'background:#faf7ff;border:1px solid #e4dbf7'}"><span style="width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:13px;font-weight:800;${on ? 'background:#12704a;color:#fff' : 'background:#e2f2e6;color:#12704a'}">${getInitials(client.name)}</span><span style="flex:1;min-width:0;text-align:left"><span style="display:block;font-size:15.5px;font-weight:800;color:#2f2a2d">${esc(client.name)}</span><span style="display:block;font-size:13px;color:#8d8271">${esc(client.want)} · ${esc(client.city)}</span></span><i class="${on ? 'ph-fill ph-check-circle' : 'ph ph-circle'}" style="font-size:20px;color:#12a150;flex:none"></i></button>`; }).join('')}</div>
        <div style="margin-top:22px;display:flex;align-items:baseline;justify-content:space-between;gap:10px"><div style="font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Which plots</div><div style="font-size:13.5px;font-weight:700;color:#12704a">${chosenProps.length ? `${chosenProps.length} ${chosenProps.length === 1 ? 'plot' : 'plots'} chosen` : 'Pick up to 4'}</div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:11px">${properties.slice(0, 8).map((property) => { const on = chosenProps.includes(property.id); return `<button data-act="choose-prop" data-id="${esc(property.id)}" style="position:relative;overflow:hidden;border-radius:14px;background:#faf7ff;border:2px solid ${on ? '#12a150' : '#e4dbf7'}"><span style="display:block;width:100%;height:70px;background:${property.photos[0] ? `url('${esc(property.photos[0])}') center/cover` : '#efe8fb'}"></span><span style="display:block;padding:9px 10px;font-size:12.5px;font-weight:700;text-align:left;line-height:1.3;color:#241f1c">${esc(property.loc)}</span>${on ? '<span style="position:absolute;top:7px;right:7px;width:24px;height:24px;border-radius:50%;background:#12a150;color:#fff;display:grid;place-items:center"><i class="ph-bold ph-check" style="font-size:13px"></i></span>' : ''}</button>`; }).join('')}</div>
        <div style="margin-top:22px;font-size:12.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8d8271">Your voice <span style="font-weight:700;text-transform:none;letter-spacing:0;color:#a5946f">· optional</span></div><button style="display:flex;align-items:center;justify-content:center;gap:11px;width:100%;height:64px;margin-top:11px;border-radius:16px;background:#ffc93c;color:#241d0c;font-size:17.5px;font-weight:800"><i class="ph-fill ph-microphone" style="font-size:22px"></i><span style="flex:1;text-align:left;font-size:15.5px;font-weight:800">Record a voice note for them</span></button></div>
      <div style="display:flex;align-items:center;gap:11px;padding:16px 26px;border-top:1px solid #ddeee4;background:#f4fbf6"><div style="flex:1;font-size:13.5px;color:#8d8271">${!chosenClient ? 'Pick a customer first' : !chosenProps.length ? 'Pick at least one plot' : 'Ready to send'}</div><button data-act="close-build" style="padding:15px 22px;border-radius:14px;background:#e8f2eb;color:#6b6156;font-size:15.5px;font-weight:700">Cancel</button><button data-act="send" ${ready ? '' : 'disabled'} style="display:flex;align-items:center;justify-content:center;gap:9px;padding:15px 24px;border-radius:14px;font-size:15.5px;font-weight:800;${ready ? 'background:#12a150;color:#fff;box-shadow:0 14px 26px -16px rgba(18,161,80,.95)' : 'background:#e8f2eb;color:#a5b8ac'}"><i class="ph-fill ph-paper-plane-tilt" style="font-size:18px"></i>Send link</button></div>
    </section></div>`;
  };

  const previewMarkup = (link: ClientLink) => `<div style="position:fixed;inset:0;z-index:88;display:grid;place-items:center;padding:24px;background:rgba(26,18,12,.52)"><section role="dialog" aria-modal="true" style="width:min(430px,94vw);border-radius:28px;background:#fffaf0;padding:26px;box-shadow:0 40px 80px -30px rgba(0,0,0,.8)"><button data-act="close-preview" style="float:right;width:38px;height:38px;border-radius:11px;background:#f3eeff"><i class="ph-bold ph-x"></i></button><div style="font-family:'Newsreader',serif;font-size:28px;font-weight:500">${esc(link.clientName)}'s page</div><div style="margin-top:8px;color:#8d8271">${link.props.length} private plots · ${link.events.opens} opens</div><button data-act="close-preview" style="width:100%;height:50px;margin-top:24px;border-radius:13px;background:#6b3fd4;color:#fff;font-weight:800">Close preview</button></section></div>`;

  const render = () => {
    const live = links.filter((link) => link.status === 'active');
    const preview = previewId ? links.find((link) => link.id === previewId) : undefined;
    el.innerHTML = `<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both"><div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">Client Links</h1><p style="margin:8px 0 0;font-size:17px;color:#6b6156">Private pages you sent after a meeting — one link can hold up to 4 plots.</p></div><button data-act="open-build" style="display:flex;align-items:center;gap:9px;padding:16px 24px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16.5px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-fill ph-paper-plane-tilt" style="font-size:19px"></i>Send a new link</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px"><div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:24px 26px"><div style="font-size:14px;color:#8a6a14;font-weight:800">Live right now</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#1f1a12;margin-top:8px">${live.length} live ${live.length === 1 ? 'link' : 'links'}</div></div><div style="background:#efe8fb;border:1.5px solid #ddd0f5;border-radius:20px;padding:24px 26px"><div style="font-size:14px;color:#6b6156;font-weight:800">Times your links were opened</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#5b32c4;margin-top:8px">${links.reduce((sum, link) => sum + link.events.opens, 0)}</div></div></div>
      ${links.length ? `<div style="display:flex;flex-direction:column;gap:14px;margin-top:22px">${links.map(linkCard).join('')}</div>` : '<div style="padding:40px;text-align:center;font-size:16px;color:#8d8271;background:#faf7ff;border:1.5px dashed #e6cf9a;border-radius:20px;margin-top:20px">No links sent yet. Tap “Send a new link” after your next meeting.</div>'}</div>${buildOpen ? builderMarkup() : ''}${preview ? previewMarkup(preview) : ''}`;
  };

  el.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const action = target.dataset.act;
    const id = target.dataset.id || '';
    if (action === 'open-build') { buildOpen = true; buildDone = false; chosenClient = ''; chosenProps = []; }
    if (action === 'close-build') buildOpen = false;
    if (action === 'choose-client') chosenClient = chosenClient === id ? '' : id;
    if (action === 'choose-prop') chosenProps = chosenProps.includes(id) ? chosenProps.filter((item) => item !== id) : chosenProps.length < 4 ? [...chosenProps, id] : chosenProps;
    if (action === 'send' && chosenClient && chosenProps.length) {
      const client = clients.find((item) => item.id === chosenClient)!;
      links.unshift({ id: `local-${Date.now()}`, clientId: client.id, clientName: client.name, props: [...chosenProps], propNames: chosenProps.map((propId) => properties.find((property) => property.id === propId)?.area || propId), expiry: '3d', loc: 'area', price: 'hidden', audio: 'none', audioSecs: 0, status: 'active', events: { opens: 0, played: 0, called: 0, wa: 0, visit: 0 }, lastOpen: 'not opened yet' });
      buildDone = true;
    }
    if (action === 'stop') links = links.map((link) => link.id === id ? { ...link, status: 'revoked' } : link);
    if (action === 'delete') links = links.filter((link) => link.id !== id);
    if (action === 'preview') previewId = id;
    if (action === 'close-preview') previewId = null;
    render();
  });
  render();
}
