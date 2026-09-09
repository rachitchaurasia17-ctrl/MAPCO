import type { ClientSafePayload, ClientSafeProperty } from '../data/contracts';
import { isClientCoordinate } from '../data/client-location';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** The presentation accepts only the existing public-link projection. */
export function clientPresentation(o: {
  payload: ClientSafePayload; property: ClientSafeProperty; activeIndex: number;
  activeShot: number; photos: string[]; heroUrl: string; priceLabel: string;
  factsHtml: string; voiceHtml: string; whyHtml: string; intelHtml: string;
  mapsHtml: string; moreHtml: string; callHtml: string; whatsapp: string; embedded?: boolean;
}): string {
  const aiEnabled = o.payload.intelligenceVisible !== false;
  const p = o.property, dealer = o.payload.dealerDisplayName || 'Your dealer';
  const origin = o.payload.locationVisible ? p.location || p.intelligence?.origin : null;
  const validOrigin = isClientCoordinate(origin);
  const coordinate = validOrigin ? `${origin.latitude},${origin.longitude}` : '';
  const satellite = coordinate
    ? `<iframe title="Satellite location of this property" loading="lazy" referrerpolicy="no-referrer" src="https://maps.google.com/maps?q=${encodeURIComponent(coordinate)}&amp;z=18&amp;t=k&amp;output=embed"></iframe>`
    : `<div class="cl-location-empty"><i class="ph-fill ph-map-pin" style="font-size:36px"></i><strong>${p.placement ? 'Property marked on the plan below' : 'Exact location not shared yet'}</strong><span>${p.placement ? 'A satellite pin is not available for this saved map placement.' : 'Your dealer can share the exact pin or guide you during a visit.'}</span></div>`;
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return `<div class="pm-buyer cl-presentation" style="${o.embedded ? 'height:100%;overflow:auto;container-type:inline-size' : 'min-height:100vh'}">
    <div class="cl-shell">
      <header class="cl-topbar"><span class="cl-brand">MAPCO<span style="color:#c99a2d">.</span></span><div class="cl-personal">A personal selection by<br><strong>${esc(dealer)}</strong></div></header>
      ${o.payload.properties.length > 1 ? `<nav class="cl-property-nav" aria-label="Shared properties">${o.payload.properties.map((property, i) => `<button class="pm-cl-go" data-go="${i}" aria-current="${i === o.activeIndex}">${esc(property.area)} · ${esc(property.size)}</button>`).join('')}</nav>` : ''}
      <section class="cl-hero" aria-label="Property photos">
        <div id="pm-cl-hero" style="position:absolute;inset:0;display:grid;place-items:center">${o.heroUrl ? `<img data-client-hero-image src="${esc(o.heroUrl)}" alt="${esc(p.area)} property" style="width:100%;height:100%;object-fit:cover">` : '<span style="color:#624a92">Property photos will appear here when shared</span>'}</div>
        <div class="cl-hero-shade"></div>
        ${o.photos.length > 1 ? '<button id="pm-cl-prev" class="cl-photo-arrow" aria-label="Previous photo" style="left:16px">‹</button><button id="pm-cl-next" class="cl-photo-arrow" aria-label="Next photo" style="right:16px">›</button>' : ''}
        <span class="cl-photo-count" id="pm-cl-photo-count">${o.photos.length ? `Photo ${o.activeShot + 1}/${o.photos.length}` : 'Photos not shared'}</span>
        <div class="cl-hero-caption"><div class="cl-eyebrow">${o.payload.buyerName ? `Selected for ${esc(o.payload.buyerName)}` : 'Your next place starts here'}</div><h1>${esc(p.area)} · ${esc(p.size)}</h1>${p.loc ? `<div><i class="ph-fill ph-map-pin"></i> ${esc(p.loc)}</div>` : ''}</div>
      </section>
      <div class="cl-summary"><div class="cl-summary-facts">${o.factsHtml}</div><div><div class="cl-eyebrow">${p.price === undefined ? 'Speak to your dealer' : 'Asking price'}</div><div class="cl-price">${esc(o.priceLabel)}</div></div></div>
      <nav class="cl-shortcuts" aria-label="Explore this property"><a class="cl-action soft" href="#cl-location">⌖ Exact location</a><a class="cl-action soft" href="#cl-ai" style="${aiEnabled ? '' : 'display:none'}">✦ MAPCO AI</a><a class="cl-action gold" href="#cl-visit">Book a visit</a></nav>
      <div class="cl-layout">
        <div>
          ${o.voiceHtml ? `<section class="cl-card"><div class="cl-eyebrow">From your dealer</div><h2>A few words about this property</h2>${o.voiceHtml}</section>` : ''}
          <section class="cl-card cl-ai" id="cl-ai" style="${aiEnabled ? '' : 'display:none'}"><div class="cl-ai-head"><div><div class="cl-eyebrow">Location, made clearer</div><h2>MAPCO AI</h2></div><span class="cl-ai-mark">✦</span></div><p class="cl-muted">Get to know the neighbourhood before you visit.</p>${o.intelHtml}${o.whyHtml}<p class="cl-muted" style="font-size:13px;margin-top:24px">${p.intelligence?.status === 'ready' ? 'AI-assisted location information. Confirm important details during your visit.' : 'Only information shared by your dealer appears here.'}</p></section>
          <section class="cl-card" id="cl-location"><div class="cl-eyebrow">See where it is</div><h2>${coordinate ? 'Your property, on satellite' : 'Property location'}</h2><p class="cl-muted">${coordinate ? 'The pin marks this property. Explore the surroundings or open directions.' : 'Explore the location information your dealer has shared.'}</p><div class="cl-satellite">${satellite}</div>${coordinate ? `<a class="cl-action soft" style="margin-top:14px" href="https://www.google.com/maps/dir/?api=1&amp;destination=${encodeURIComponent(coordinate)}" target="_blank" rel="noopener">Get directions ↗</a>` : ''}<div style="background:#281640;border-radius:18px;padding:${o.mapsHtml ? '1px 18px 18px' : '0'};margin-top:18px">${o.mapsHtml}</div></section>
        </div>
        <div>
          <section class="cl-card" id="cl-visit"><div class="cl-eyebrow">Come and see it</div><h2>Find a time to visit</h2><p class="cl-muted">Choose a day and time that suit you. ${esc(dealer)} will confirm availability.</p><div class="cl-visit-grid"><label for="cl-visit-date">Preferred date<input id="cl-visit-date" type="date" min="${esc(date)}" required></label><label for="cl-visit-time">Preferred time<select id="cl-visit-time" required><option value="">Choose a time</option>${['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'].map(time => `<option value="${time}">${Number(time.slice(0,2)) % 12 || 12}:00 ${Number(time.slice(0,2)) < 12 ? 'AM' : 'PM'}</option>`).join('')}</select></label></div><p class="cl-muted" style="font-size:13px">All visit times are in India Standard Time.</p><a id="cl-request-visit" href="#cl-visit" class="cl-action gold">Request visit on WhatsApp ↗</a><p id="cl-visit-status" class="cl-visit-status" role="status">Your selected time is a request, confirmed by your dealer.</p></section>
          <section class="cl-card"><div class="cl-eyebrow">A person you can reach</div><h2>${esc(dealer)}</h2><p class="cl-muted">Questions about the price, papers or the property? Speak directly with your dealer.</p><div class="cl-contact">${o.callHtml}<a class="cl-action soft" data-client-event="whatsapp_clicked" href="${esc(o.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></div></section>
          ${o.moreHtml ? `<section class="cl-card" style="background:#281640">${o.moreHtml}</section>` : ''}
        </div>
      </div>
      <footer class="cl-footer">Shared privately${o.payload.buyerName ? ` for ${esc(o.payload.buyerName)}` : ''} · Powered by MAPCO<br>Please keep this link to yourself.</footer>
    </div>
    <div class="cl-bottom"><a class="cl-action soft" href="#cl-ai" style="${aiEnabled ? '' : 'display:none'}">✦ Explore with MAPCO AI</a><a class="cl-action gold" href="#cl-visit">Book a visit</a></div>
  </div>`;
}
