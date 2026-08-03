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
import type { ClientSafePayload, ClientSafeProperty } from '../data/contracts';
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

export interface ClientLinkViewOptions {
  /** true when rendered inside the dealer preview phone frame (not full page). */
  embedded?: boolean;
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

  const dealer = payload.dealerDisplayName || 'Your dealer';
  const dealerFirst = dealer.split(' ')[0] || dealer;
  const waNum = waNumber(payload.dealerWhatsapp || payload.dealerPhone);
  const telNum = digits(payload.dealerPhone) || waNumber(payload.dealerWhatsapp);

  const waHref = (msg: string) => waNum
    ? `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;

  function paint(): void {
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

    const moreHtml = multi ? `
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#9d8bc7;margin-top:24px">More plots for you</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:11px">${properties.map((o, i) => i === activeIndex ? '' : `<button class="pm-cl-go" data-go="${i}" style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:16px;background:rgba(255,255,255,.05);border:none;cursor:pointer;text-align:left"><span style="width:60px;height:60px;border-radius:12px;flex:none;background:${o.photos[0] ? `url('${esc(o.photos[0])}') center/cover` : '#241a33'}"></span><span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:800;color:#fffdf7">${esc(o.area)}</span><span style="display:block;font-size:12.5px;color:#b9a8dd">${esc(o.size)} · ${esc(o.facing)} facing</span></span><i class="ph-bold ph-caret-right" style="color:#9d8bc7;flex:none"></i></button>`).join('')}</div>` : '';

    const callHtml = telNum
      ? `<a href="tel:${esc(telNum)}" style="display:flex;align-items:center;justify-content:center;gap:9px;height:54px;border-radius:15px;background:#12a150;color:#fff;font-size:16px;font-weight:800;text-decoration:none"><i class="ph-fill ph-phone" style="font-size:20px"></i>Call ${esc(dealerFirst)}</a>`
      : '';

    container.innerHTML = `
<div class="pm-buyer" style="background:#0f0a18;${outerMin};display:flex;justify-content:center;position:relative;font-family:'Hanken Grotesk',system-ui,sans-serif">
  <div style="width:100%;max-width:480px;background:#140d20;position:relative;display:flex;flex-direction:column">
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
      ${voiceHtml}${whyHtml}${moreHtml}
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:24px">
        ${callHtml}
        <a href="${esc(waHref('Hi ' + dealer + ', I am interested in ' + p.area))}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:9px;height:52px;border-radius:15px;background:#0e3b28;color:#7be0a4;font-size:15px;font-weight:800;text-decoration:none;border:1px solid #1c6b47"><i class="ph-fill ph-whatsapp-logo" style="font-size:19px"></i>WhatsApp</a>
        <div style="display:flex;gap:10px">
          <a href="${esc(waHref('Hi ' + dealer + ', I would like to visit ' + p.area))}" target="_blank" rel="noopener" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:50px;border-radius:14px;background:#ffc93c;color:#241d0c;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-calendar-check" style="font-size:18px"></i>Site visit</a>
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

    // Voice note: real playback when a source URL is present.
    const audio = container.querySelector<HTMLAudioElement>('#pm-cl-audio');
    const play = container.querySelector<HTMLButtonElement>('#pm-cl-play');
    if (audio && play) {
      const setIcon = (playing: boolean) => { play.innerHTML = `<i class="ph-fill ph-${playing ? 'pause' : 'play'}" style="font-size:22px"></i>`; };
      play.addEventListener('click', () => {
        if (!audio.getAttribute('src')) { play.title = 'Voice note will play on the live link.'; return; }
        if (audio.paused) void audio.play().catch(() => { play.title = 'Could not play the voice note.'; });
        else audio.pause();
      });
      audio.addEventListener('play', () => setIcon(true));
      audio.addEventListener('pause', () => setIcon(false));
      audio.addEventListener('ended', () => setIcon(false));
      audio.addEventListener('timeupdate', () => {
        if (!time || !audio.duration) return;
        const left = Math.max(0, Math.ceil(audio.duration - audio.currentTime));
        time.textContent = `0:${String(left).padStart(2, '0')}`;
      });
    }
  }

  paint();
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
