/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Shared Client-Link view (the buyer's mobile page)
   ---------------------------------------------------------------
   ONE renderer for the private client page, used by BOTH the public
   buyer route (/client/?token=…) and the dealer "See their page"
   preview, so the preview is a true pixel match of what the client
   sees. Consumes ONLY ClientSafePayload — seller phone/identity,
   commission, notes, team and internal status are absent from the
   type and the payload, never hidden with CSS. The DEALER's own
   contact (phone/whatsapp) IS present so the buyer can reach them.
   ═══════════════════════════════════════════════════════════════ */
import { formatINR } from './utils';
import type { ClientSafeMap, ClientSafePayload, ClientSafeProperty } from '../data/contracts';
import type { ClientLink, Property } from '../data/types';

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const digits = (s?: string) => (s || '').replace(/[^0-9]/g, '');
function waNumber(raw?: string): string {
  const d = digits(raw);
  if (d.length < 10) return '';
  return d.length === 10 ? '91' + d : d;
}

/** A modern, luxury gold map pin (inline SVG). Same gradient id is reused — that
 *  is fine because all instances are identical. */
function luxuryPin(size = 40): string {
  const h = Math.round(size * 1.32);
  return `<svg width="${size}" height="${h}" viewBox="0 0 40 52" fill="none" style="display:block;filter:drop-shadow(0 5px 7px rgba(0,0,0,.55))">
    <defs>
      <radialGradient id="pmLuxPin" cx="50%" cy="34%" r="72%">
        <stop offset="0" stop-color="#fff6d6"/><stop offset="42%" stop-color="#ffce4e"/><stop offset="100%" stop-color="#d98a12"/>
      </radialGradient>
    </defs>
    <path d="M20 1.5C10.6 1.5 3 9 3 18.3 3 30 20 50.5 20 50.5S37 30 37 18.3C37 9 29.4 1.5 20 1.5Z" fill="url(#pmLuxPin)" stroke="#fffaf0" stroke-width="1.6"/>
    <circle cx="20" cy="18.3" r="7" fill="#241d0c"/>
    <circle cx="20" cy="18.3" r="3.1" fill="#ffe9a8"/>
  </svg>`;
}

export type ClientLinkViewMap = ClientSafeMap;

export interface ClientLinkViewOptions {
  /** true when rendered inside the dealer preview phone frame (not full page). */
  embedded?: boolean;
  /** published maps (masterplan + sector) so precise-location plots can be pinned. */
  maps?: ClientLinkViewMap[];
  /** Public route only. Dealer previews deliberately omit event reporting. */
  onEvent?: (
    event: 'audio_played' | 'call_clicked' | 'whatsapp_clicked' | 'visit_requested',
    propertyPublicId: string,
  ) => void;
  /** Re-resolve a short-lived signed audio URL after expiry. */
  refreshVoiceNote?: () => Promise<string | null>;
}

/**
 * Render the buyer's mobile page into `container`. Self-contained: manages its
 * own gallery navigation and voice-note playback, updating in place so audio
 * keeps playing while the buyer flips photos.
 */
export function renderClientLinkView(
  container: HTMLElement,
  payload: ClientSafePayload,
  opts: ClientLinkViewOptions = {},
): void {
  const properties = payload.properties;
  let activeIndex = 0;
  let activeShot = 0;
  let audioPlayReported = false;
  const activeMapByProperty = new Map<string, string>();
  const activeModeByMap = new Map<string, 'original' | 'threeD'>();
  let mapResizeObserver: ResizeObserver | null = null;

  const dealer = payload.dealerDisplayName || 'Your dealer';
  const dealerFirst = dealer.split(' ')[0] || dealer;
  const waNum = waNumber(payload.dealerWhatsapp || payload.dealerPhone);
  const telNum = digits(payload.dealerPhone) || waNumber(payload.dealerWhatsapp);

  const waHref = (msg: string) => waNum
    ? `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;

  const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cmaps = opts.maps ?? payload.maps ?? [];

  function paint(): void {
    mapResizeObserver?.disconnect();
    mapResizeObserver = null;
    const p = properties[activeIndex] || properties[0];
    if (!p) { container.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#0f0a18;color:#9a8aad;font-family:system-ui">Nothing shared on this link.</div>'; return; }
    const photos = p.photos && p.photos.length ? p.photos : [];
    activeShot = Math.min(activeShot, Math.max(0, photos.length - 1));
    const heroUrl = photos[activeShot] || '';
    const priceLabel = p.price !== undefined ? formatINR(p.price) : 'Price on call';
    const multi = properties.length > 1;
    const outerMin = opts.embedded ? 'height:100%;min-height:100%' : 'min-height:100vh';

    const segs = photos.length > 1
      ? `<div id="pm-cl-segs" style="display:flex;gap:5px;margin-bottom:12px">${photos.map((_, i) => `<span style="flex:1;height:4px;border-radius:2px;background:${i === activeShot ? '#ffc93c' : 'rgba(255,255,255,.28)'}"></span>`).join('')}</div>`
      : '';

    const facts = [
      { icon: 'ph-fill ph-ruler', label: p.size },
      { icon: 'ph-fill ph-compass', label: `${p.facing} facing` },
      { icon: 'ph-fill ph-road-horizon', label: p.position },
    ].filter((f) => f.label);
    const factsHtml = facts.map((f) => `<span style="display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;color:#fff6e0;background:rgba(255,255,255,.08);border-radius:12px;padding:10px 14px"><i class="${f.icon}" style="font-size:15px;color:#ffc93c"></i>${esc(f.label)}</span>`).join('');

    const voiceHtml = payload.voiceNote ? `
      <div style="border-radius:20px;padding:16px 18px;margin-top:18px;background:linear-gradient(150deg,#6b3fd4,#3f1f9e);box-shadow:0 18px 40px -20px rgba(107,63,212,.9)">
        <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#d8c8ff">A message from ${esc(dealer)}</div>
        <div style="display:flex;align-items:center;gap:13px;margin-top:12px">
          <button id="pm-cl-play" aria-label="Play voice note" style="width:52px;height:52px;border-radius:50%;background:#ffc93c;color:#241d0c;display:grid;place-items:center;flex:none;cursor:pointer;border:none"><i class="ph-fill ph-play" style="font-size:22px"></i></button>
          <div id="pm-cl-wave" style="flex:1;display:flex;align-items:center;gap:3px;height:34px">${Array.from({ length: 26 }).map((_, i) => `<span style="flex:1;background:rgba(255,255,255,.34);border-radius:2px;height:${9 + ((i * 11) % 20)}px"></span>`).join('')}</div>
          <span id="pm-cl-time" style="font-size:14px;font-weight:800;color:#fff6e0;flex:none">0:${String(payload.voiceNote.seconds).padStart(2, '0')}</span>
        </div>
        <audio id="pm-cl-audio" preload="none"${payload.voiceNote.url ? ` src="${esc(payload.voiceNote.url)}"` : ''}></audio>
      </div>` : '';

    const whyHtml = p.landmarks.length ? `
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9d8bc7;margin-top:24px">Why this one</div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:13px">${p.landmarks.map((lm) => `<div style="display:flex;align-items:center;gap:11px"><i class="ph-fill ph-check-circle" style="font-size:20px;color:#7be0a4;flex:none"></i><span style="flex:1;min-width:0;font-size:15px;font-weight:600;color:#efe7ff">${esc(lm.name)}${lm.distance ? ` · ${esc(lm.distance)}` : ''}</span></div>`).join('')}</div>` : '';

    // Prefer saved map IDs. Label matching is only a compatibility path for old
    // snapshots that contain no IDs at all; it never overrides real placement.
    const hasSavedMapIds = Boolean(p.masterplanId || p.sectorMapId || p.placement?.mapId);
    const placedMap = p.placement ? cmaps.find((m) => m.id === p.placement!.mapId) : undefined;
    const sectorMap = p.sectorMapId
      ? cmaps.find((m) => m.id === p.sectorMapId && m.kind === 'sector')
      : placedMap?.kind === 'sector' ? placedMap
        : !hasSavedMapIds && p.mapSector ? cmaps.find((m) => m.kind === 'sector' && (
          norm(m.sector || m.label) === norm(p.mapSector)
          || norm(m.sector || m.label).includes(norm(p.mapSector))
        )) : undefined;
    const master = p.masterplanId
      ? cmaps.find((m) => m.id === p.masterplanId && m.kind === 'masterplan')
      : placedMap?.kind === 'masterplan' ? placedMap
        : sectorMap?.parentMapId ? cmaps.find((m) => m.id === sectorMap.parentMapId && m.kind === 'masterplan')
          : !hasSavedMapIds && p.mapCity ? cmaps.find((m) => m.kind === 'masterplan' && norm(m.city) === norm(p.mapCity)) : undefined;
    const mapItems = [
      sectorMap ? { t: 'Sector map', m: sectorMap } : null,
      master ? { t: 'Masterplan', m: master } : null,
    ].filter((x): x is { t: string; m: typeof cmaps[number] } => !!x);
    const requestedLocationMap = Boolean(p.placement || p.masterplanId || p.sectorMapId || p.mapCity || p.mapSector);
    const selectedMapId = activeMapByProperty.get(p.id) || mapItems[0]?.m.id || '';
    const activeMapItem = mapItems.find((item) => item.m.id === selectedMapId) || mapItems[0];
    if (activeMapItem) activeMapByProperty.set(p.id, activeMapItem.m.id);
    const activeMap = activeMapItem?.m;
    const mapMode = activeMap ? activeModeByMap.get(activeMap.id) || 'original' : 'original';
    const hasThreeD = Boolean(activeMap?.assets?.threeD?.path);
    const safeMode = mapMode === 'threeD' && hasThreeD ? 'threeD' : 'original';
    const raster = safeMode === 'threeD' ? activeMap?.assets?.threeD?.path || '' : activeMap?.assets?.original?.path || activeMap?.raster || '';
    const activeDims = safeMode === 'threeD' ? activeMap?.dims?.threeD : activeMap?.dims?.original;
    const pin = safeMode === 'original' && p.placement?.mapId === activeMap?.id ? p.placement : null;
    const mapsHtml = activeMapItem && raster ? `
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9d8bc7;margin-top:24px">Explore location</div>
      <div style="display:flex;gap:7px;margin-top:12px">${mapItems.map(({ t, m }) => `<button class="pm-cl-map-tab" data-map-id="${esc(m.id)}" style="flex:1;height:40px;border-radius:11px;border:1px solid ${m.id === activeMap!.id ? '#ffc93c' : 'rgba(255,255,255,.12)'};background:${m.id === activeMap!.id ? '#ffc93c' : 'rgba(255,255,255,.06)'};color:${m.id === activeMap!.id ? '#241d0c' : '#efe7ff'};font-size:13px;font-weight:800;cursor:pointer">${esc(t)}</button>`).join('')}</div>
      <div style="position:relative;margin-top:9px">
        <button class="pm-cl-map" data-raster="${esc(raster)}" data-pinx="${pin ? pin.x : ''}" data-piny="${pin ? pin.y : ''}" data-label="${esc(activeMapItem.t)}" data-w="${activeDims?.w || ''}" data-h="${activeDims?.h || ''}" style="position:relative;display:block;width:100%;height:190px;border-radius:16px;overflow:hidden;border:none;cursor:pointer;background:#0b0714">
          <img class="pm-cl-map-img" src="${esc(raster)}" alt="${esc(activeMapItem.t)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">
          ${pin ? `<span class="pm-cl-map-pin" style="position:absolute;left:0;top:0;transform:translate(-50%,-100%)">${luxuryPin(38)}</span>` : ''}
          <span style="position:absolute;bottom:10px;right:10px;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(255,201,60,.95);color:#241d0c;font-size:12px;font-weight:800"><i class="ph-fill ph-arrows-out" style="font-size:13px"></i>Full screen</span>
        </button>
        ${hasThreeD ? `<div style="position:absolute;top:9px;right:9px;display:flex;gap:4px;padding:4px;border-radius:10px;background:rgba(20,13,32,.8)"><button class="pm-cl-map-mode" data-mode="original" data-map-id="${esc(activeMap.id)}" style="height:28px;padding:0 9px;border-radius:7px;background:${safeMode === 'original' ? '#ffc93c' : 'transparent'};color:${safeMode === 'original' ? '#241d0c' : '#fff6e0'};font-size:11px;font-weight:800">Original</button><button class="pm-cl-map-mode" data-mode="threeD" data-map-id="${esc(activeMap.id)}" style="height:28px;padding:0 9px;border-radius:7px;background:${safeMode === 'threeD' ? '#ffc93c' : 'transparent'};color:${safeMode === 'threeD' ? '#241d0c' : '#fff6e0'};font-size:11px;font-weight:800">3D</button></div>` : ''}
      </div>` : requestedLocationMap ? `<div style="margin-top:24px;padding:16px;border-radius:16px;background:rgba(255,255,255,.06);color:#b9a8dd;font-size:13.5px;line-height:1.45"><strong style="display:block;color:#efe7ff;margin-bottom:4px">Location map unavailable</strong>The saved placement is incomplete or its map is not published for clients.</div>` : '';

    const moreHtml = multi ? `
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9d8bc7;margin-top:24px">More plots for you</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:11px">${properties.map((o, i) => i === activeIndex ? '' : `<button class="pm-cl-go" data-go="${i}" style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:16px;background:rgba(255,255,255,.05);border:none;cursor:pointer;text-align:left"><span style="width:60px;height:60px;border-radius:12px;flex:none;background:${o.photos[0] ? `url('${esc(o.photos[0])}') center/cover` : '#241a33'}"></span><span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:800;color:#fffdf7">${esc(o.area)}</span><span style="display:block;font-size:12.5px;color:#b9a8dd">${esc(o.size)} · ${esc(o.facing)} facing</span></span><i class="ph-bold ph-caret-right" style="color:#9d8bc7;flex:none"></i></button>`).join('')}</div>` : '';

    const callHtml = telNum
      ? `<a data-client-event="call_clicked" href="tel:${esc(telNum)}" style="display:flex;align-items:center;justify-content:center;gap:9px;height:54px;border-radius:15px;background:#12a150;color:#fff;font-size:16px;font-weight:800;text-decoration:none"><i class="ph-fill ph-phone" style="font-size:20px"></i>Call ${esc(dealerFirst)}</a>`
      : '';

    container.innerHTML = `
<div class="pm-buyer" style="background:#0f0a18;${outerMin};display:flex;justify-content:center;position:relative;font-family:'Hanken Grotesk',system-ui,sans-serif">
  <div style="width:100%;max-width:480px;background:#140d20;position:relative;display:flex;flex-direction:column">
    ${multi ? `<div style="position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:8px;padding:11px 12px;background:rgba(20,13,32,.96);backdrop-filter:blur(8px);border-bottom:1px solid rgba(255,255,255,.08);overflow-x:auto">
      <span style="flex:none;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7ab0;padding-left:4px">${properties.length} plots</span>
      ${properties.map((o, i) => `<button class="pm-cl-go" data-go="${i}" style="flex:none;padding:8px 14px;border-radius:999px;font-size:13px;font-weight:800;border:none;cursor:pointer;white-space:nowrap;${i === activeIndex ? 'background:#ffc93c;color:#241d0c' : 'background:rgba(255,255,255,.09);color:#c9b6ef'}">${esc(o.area)}</button>`).join('')}
    </div>` : ''}
    <div style="position:relative;height:320px;flex:none">
      <div id="pm-cl-hero" style="position:absolute;inset:0;${heroUrl ? `background:url('${esc(heroUrl)}') center/cover` : 'background:#241a33;display:grid;place-items:center;color:#6b5a90'}">${heroUrl ? '' : '<i class="ph-fill ph-image" style="font-size:44px"></i>'}</div>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,10,24,.66) 0%,rgba(15,10,24,.05) 34%,rgba(20,13,32,.96) 100%)"></div>
      <div style="position:absolute;top:16px;left:16px;right:16px;display:flex;align-items:center;gap:11px">
        <div style="width:40px;height:40px;border-radius:50%;background:#ffc93c;color:#241d0c;display:grid;place-items:center;font-size:14px;font-weight:800;flex:none">${esc((dealer.charAt(0) || 'M').toUpperCase())}</div>
        <div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:#fff6e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(dealer)}</div><div style="font-size:11.5px;font-weight:700;color:#c9b6ef">Chosen for you by ${esc(dealer)}</div></div>
      </div>
      ${photos.length > 1 ? `<button id="pm-cl-prev" aria-label="Previous photo" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(20,13,32,.62);color:#fff6e0;display:grid;place-items:center;border:none;cursor:pointer"><i class="ph-bold ph-caret-left" style="font-size:19px"></i></button><button id="pm-cl-next" aria-label="Next photo" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(20,13,32,.62);color:#fff6e0;display:grid;place-items:center;border:none;cursor:pointer"><i class="ph-bold ph-caret-right" style="font-size:19px"></i></button>` : ''}
      <div style="position:absolute;bottom:14px;left:16px;right:16px">
        ${segs}
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px">
          <div style="min-width:0"><div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ffc93c">${esc(p.loc || p.area)}</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:27px;line-height:1.1;color:#fffdf7;margin-top:3px">${esc(p.area)} · ${esc(p.size)}</div></div>
          <span style="font-size:11.5px;font-weight:800;color:#fff6e0;background:rgba(255,255,255,.16);border-radius:999px;padding:6px 12px;flex:none">Photo ${activeShot + 1}/${photos.length || 1}</span>
        </div>
      </div>
    </div>
    <div style="padding:8px 18px 26px;flex:1">
      ${p.loc ? `<div style="display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:700;color:#c9b6ef"><i class="ph-fill ph-map-pin" style="font-size:17px;color:#ffc93c"></i>${esc(p.loc)}</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">${factsHtml}</div>
      <div style="display:flex;align-items:center;gap:11px;background:linear-gradient(135deg,#ffc93c,#f4881f);border-radius:16px;padding:15px 18px;margin-top:16px"><i class="ph-fill ph-tag" style="font-size:21px;color:#3a2410"></i><span style="font-size:20px;font-weight:800;color:#241d0c">${priceLabel}</span></div>
      ${voiceHtml}${whyHtml}${mapsHtml}${moreHtml}
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:24px">
        ${callHtml}
        <a data-client-event="whatsapp_clicked" href="${esc(waHref('Hi ' + dealer + ', I am interested in ' + p.area))}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:9px;height:52px;border-radius:15px;background:#0e3b28;color:#7be0a4;font-size:15px;font-weight:800;text-decoration:none;border:1px solid #1c6b47"><i class="ph-fill ph-whatsapp-logo" style="font-size:19px"></i>WhatsApp</a>
        <div style="display:flex;gap:10px">
          <a data-client-event="visit_requested" href="${esc(waHref('Hi ' + dealer + ', I would like to visit ' + p.area))}" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:50px;border-radius:14px;background:#ffc93c;color:#241d0c;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-calendar-check" style="font-size:18px"></i>Site visit</a>
          <a href="${esc(waHref('Hi ' + dealer + ', I have a question about ' + p.area))}" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:50px;border-radius:14px;background:rgba(255,255,255,.08);color:#efe7ff;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-chat-circle-dots" style="font-size:18px"></i>Ask</a>
        </div>
      </div>
      <div style="text-align:center;padding:22px 0 4px;font-size:12px;color:#8a7ab0;line-height:1.6">${payload.buyerName ? `Shared privately by ${esc(dealer)} for ${esc(payload.buyerName)}<br>` : ''}<span style="display:inline-flex;align-items:center;gap:6px"><i class="ph-fill ph-shield-check" style="font-size:14px"></i>Powered by MAPCO · Please keep this page to yourself.</span></div>
    </div>
  </div>
</div>`;

    wire();
  }

  /** Attach behaviour without a full re-render, so audio keeps playing. */
  function wire(): void {
    const hero = container.querySelector<HTMLElement>('#pm-cl-hero');
    const time = container.querySelector<HTMLElement>('#pm-cl-time');
    const p = properties[activeIndex] || properties[0];
    const photos = p?.photos ?? [];

    const refreshHero = () => {
      const url = photos[activeShot] || '';
      if (hero) hero.style.background = url ? `url('${url}') center/cover` : '#241a33';
      const segsBox = container.querySelector('#pm-cl-segs');
      if (segsBox) segsBox.querySelectorAll('span').forEach((s, i) => { (s as HTMLElement).style.background = i === activeShot ? '#ffc93c' : 'rgba(255,255,255,.28)'; });
      const counter = container.querySelector('div[style*="Photo"]');
      const label = container.querySelector('.pm-buyer span[style*="border-radius:999px"]');
      if (label) label.textContent = `Photo ${activeShot + 1}/${photos.length || 1}`;
      void counter;
    };
    container.querySelector('#pm-cl-prev')?.addEventListener('click', () => { activeShot = (activeShot - 1 + photos.length) % photos.length; refreshHero(); });
    container.querySelector('#pm-cl-next')?.addEventListener('click', () => { activeShot = (activeShot + 1) % photos.length; refreshHero(); });
    container.querySelectorAll('.pm-cl-go').forEach((b) => b.addEventListener('click', (e) => {
      activeIndex = parseInt((e.currentTarget as HTMLElement).dataset.go || '0', 10); activeShot = 0; paint();
    }));

    container.querySelectorAll('.pm-cl-map-tab').forEach((b) => b.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.mapId || '';
      if (p && id) activeMapByProperty.set(p.id, id);
      paint();
    }));
    container.querySelectorAll('.pm-cl-map-mode').forEach((b) => b.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const mode = el.dataset.mode === 'threeD' ? 'threeD' : 'original';
      if (el.dataset.mapId) activeModeByMap.set(el.dataset.mapId, mode);
      paint();
    }));

    // Tapping a location map opens it full-screen (landscape), pin preserved.
    container.querySelectorAll('.pm-cl-map').forEach((b) => b.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      openMapFullscreen(el.dataset.raster || '', el.dataset.pinx, el.dataset.piny, el.dataset.label || 'Map', Number(el.dataset.w), Number(el.dataset.h));
    }));
    const mapHost = container.querySelector<HTMLElement>('.pm-cl-map');
    const mapImage = mapHost?.querySelector<HTMLImageElement>('.pm-cl-map-img');
    const mapPin = mapHost?.querySelector<HTMLElement>('.pm-cl-map-pin');
    if (mapHost && mapImage && mapPin) {
      const position = () => positionContainedPin(mapHost, mapImage, mapPin, Number(mapHost.dataset.pinx), Number(mapHost.dataset.piny), Number(mapHost.dataset.w), Number(mapHost.dataset.h));
      if (mapImage.complete) position(); else mapImage.addEventListener('load', position, { once: true });
      if (typeof ResizeObserver !== 'undefined') {
        mapResizeObserver = new ResizeObserver(position);
        mapResizeObserver.observe(mapHost);
      }
    }

    // Voice note: real playback when a source URL is present.
    const audio = container.querySelector<HTMLAudioElement>('#pm-cl-audio');
    const play = container.querySelector<HTMLButtonElement>('#pm-cl-play');
    if (audio && play) {
      const setIcon = (playing: boolean) => { play.innerHTML = `<i class="ph-fill ph-${playing ? 'pause' : 'play'}" style="font-size:22px"></i>`; };
      let refreshing = false;
      const refreshAndPlay = async () => {
        if (!opts.refreshVoiceNote || refreshing) { play.title = 'Could not play the voice note.'; return; }
        refreshing = true;
        const next = await opts.refreshVoiceNote().catch(() => null);
        refreshing = false;
        if (!next) { play.title = 'Voice note is temporarily unavailable.'; return; }
        audio.src = next;
        audio.load();
        await audio.play().catch(() => { play.title = 'Voice note refreshed. Tap Play again.'; });
      };
      play.addEventListener('click', () => {
        if (!audio.getAttribute('src')) { void refreshAndPlay(); return; }
        if (audio.paused) void audio.play().catch(() => refreshAndPlay());
        else audio.pause();
      });
      audio.addEventListener('play', () => {
        setIcon(true);
        if (!audioPlayReported && p) { audioPlayReported = true; opts.onEvent?.('audio_played', p.id); }
      });
      audio.addEventListener('pause', () => setIcon(false));
      audio.addEventListener('ended', () => setIcon(false));
      audio.addEventListener('timeupdate', () => {
        if (!time || !audio.duration) return;
        const left = Math.max(0, Math.ceil(audio.duration - audio.currentTime));
        time.textContent = `0:${String(left).padStart(2, '0')}`;
      });
    }
    container.querySelectorAll<HTMLElement>('[data-client-event]').forEach((el) => el.addEventListener('click', () => {
      const event = el.dataset.clientEvent as 'call_clicked' | 'whatsapp_clicked' | 'visit_requested';
      if (p && event) opts.onEvent?.(event, p.id);
    }));
  }

  paint();
}

export function positionContainedPin(
  host: HTMLElement,
  image: HTMLImageElement,
  pin: HTMLElement,
  x: number,
  y: number,
  suppliedWidth = 0,
  suppliedHeight = 0,
): void {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return;
  const naturalWidth = suppliedWidth > 0 ? suppliedWidth : image.naturalWidth;
  const naturalHeight = suppliedHeight > 0 ? suppliedHeight : image.naturalHeight;
  if (!naturalWidth || !naturalHeight || !host.clientWidth || !host.clientHeight) return;
  const scale = Math.min(host.clientWidth / naturalWidth, host.clientHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  pin.style.left = `${(host.clientWidth - width) / 2 + x * width}px`;
  pin.style.top = `${(host.clientHeight - height) / 2 + y * height}px`;
}

/** Open a map raster full-screen (landscape) with the plot pin, for the buyer. */
function openMapFullscreen(raster: string, pinx?: string, piny?: string, label = 'Map', width = 0, height = 0): void {
  if (!raster) return;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:200;background:#0b0714;display:flex;align-items:center;justify-content:center;animation:pmdveil .18s ease both';
  const px = Number(pinx), py = Number(piny);
  const hasPin = Number.isFinite(px) && Number.isFinite(py) && pinx !== '' && piny !== '';
  ov.innerHTML = `
    <div style="position:relative;width:100%;height:100%">
      <img data-map-image src="${raster.replace(/"/g, '&quot;')}" alt="${label}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">
      ${hasPin ? `<span data-map-pin style="position:absolute;left:0;top:0;transform:translate(-50%,-100%)">${luxuryPin(46)}</span>` : ''}
      <button data-x style="position:absolute;top:16px;right:16px;width:46px;height:46px;border-radius:14px;background:rgba(255,248,230,.16);color:#fff8e6;display:grid;place-items:center;border:none;cursor:pointer"><i class="ph-bold ph-x" style="font-size:20px"></i></button>
      <div style="position:absolute;top:18px;left:18px;padding:7px 14px;border-radius:999px;background:rgba(20,13,32,.7);color:#fff6e0;font-size:13px;font-weight:800">${label}</div>
      <div style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);padding:8px 16px;border-radius:999px;background:rgba(20,13,32,.7);color:#c9b6ef;font-size:12.5px;font-weight:700">Rotate your phone for a bigger view</div>
    </div>`;
  let resize: ResizeObserver | null = null;
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
  const close = () => {
    resize?.disconnect();
    document.removeEventListener('keydown', onKey);
    try { const scr = (screen as unknown as { orientation?: { unlock?: () => void } }).orientation; scr?.unlock?.(); } catch { /* ignore */ }
    try { if (document.fullscreenElement) void document.exitFullscreen(); } catch { /* ignore */ }
    ov.remove();
  };
  ov.addEventListener('click', (e) => { if (e.target === ov || (e.target as HTMLElement).closest('[data-x]')) close(); });
  document.body.appendChild(ov);
  document.addEventListener('keydown', onKey);
  const image = ov.querySelector<HTMLImageElement>('[data-map-image]');
  const pin = ov.querySelector<HTMLElement>('[data-map-pin]');
  const stage = image?.parentElement;
  if (image && pin && stage) {
    const position = () => positionContainedPin(stage, image, pin, px, py, width, height);
    if (image.complete) position(); else image.addEventListener('load', position, { once: true });
    if (typeof ResizeObserver !== 'undefined') { resize = new ResizeObserver(position); resize.observe(stage); }
  }
  // Best-effort: go fullscreen + lock to landscape (mobile).
  try {
    const req = ov.requestFullscreen?.();
    if (req && typeof req.then === 'function') {
      void req.then(() => {
        try { void (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation?.lock?.('landscape'); } catch { /* ignore */ }
      }).catch(() => { /* ignore */ });
    }
  } catch { /* ignore */ }
}

/**
 * Build a ClientSafePayload for the DEALER preview from a saved link + the
 * dealer's own properties, honouring the link's price/location visibility.
 * A projection to the exact client-safe shape — the preview shows precisely
 * what a client would see, nothing private.
 */
export function previewPayloadFromLink(
  link: ClientLink,
  properties: Property[],
  dealerDisplayName: string,
  dealerContact?: { phone?: string; whatsapp?: string; buyerName?: string },
): ClientSafePayload {
  const priceVisible = link.price === 'shown';
  const locationVisible = link.loc !== 'hidden';
  const precise = link.loc === 'exact';
  const safe: ClientSafeProperty[] = (link.props.length ? link.props : [])
    .map((id) => properties.find((p) => p.id === id))
    .filter((p): p is Property => !!p)
    .map((p) => ({
      id: p.id,
      area: p.area,
      size: p.size,
      facing: p.facing,
      position: p.position,
      photos: [...p.photos],
      approvals: [...p.approvals],
      landmarks: p.landmarks.map((l) => ({ name: l.name, distance: l.distance, icon: l.icon })),
      ...(locationVisible ? { loc: p.loc } : {}),
      ...(priceVisible ? { price: p.price } : {}),
      ...(precise ? { mapCity: p.city, mapSector: p.sector } : {}),
      ...(precise && p.masterplanId ? { masterplanId: p.masterplanId } : {}),
      ...(precise && p.sectorMapId ? { sectorMapId: p.sectorMapId } : {}),
      ...(precise && p.mapPlacement ? { placement: { ...p.mapPlacement } } : {}),
    }));
  return {
    dealerDisplayName,
    properties: safe,
    priceVisible,
    locationVisible,
    ...(dealerContact?.phone ? { dealerPhone: dealerContact.phone } : {}),
    ...(dealerContact?.whatsapp ? { dealerWhatsapp: dealerContact.whatsapp } : {}),
    ...(dealerContact?.buyerName ? { buyerName: dealerContact.buyerName } : {}),
    ...(link.audio === 'done' ? { voiceNote: { url: '', seconds: link.audioSecs } } : {}),
  };
}
