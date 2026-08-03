/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Shared property detail (dealer/team internal)
   ---------------------------------------------------------------
   The full property view opened from Home "hot" cards, the Properties
   list, and Team Workspace. Same look as the Client Presentation detail
   but INTERNAL: shows price + an Edit button. Framework-free overlay;
   returns a disposer. Never used on the client-facing routes.
   ═══════════════════════════════════════════════════════════════ */
import { formatINR, streetViewUrl } from './utils';
import { adapter } from '../data/adapter';
import type { Property, ClientLink, PropertyType } from '../data/types';

const PROPERTY_TYPES: PropertyType[] = ['Residential Plot', 'Flat', 'Floor', 'Kothi', 'Villa', 'Commercial'];

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface PropertyDetailOptions {
  onEdit?: (property: Property) => void;
  onClose?: () => void;
}

/** Open the internal property detail overlay. Returns a disposer. */
export function openPropertyDetail(property: Property, opts: PropertyDetailOptions = {}): () => void {
  const photos = property.photos ?? [];
  const landmarks = property.landmarks ?? [];
  const approvals = property.approvals ?? [];
  let shot = 0;

  const host = document.createElement('div');
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.style.cssText = 'position:fixed;inset:0;z-index:120;display:flex;flex-direction:column;background:#1d1405;background-image:radial-gradient(75% 55% at 88% -4%,rgba(255,201,60,.34),transparent 60%),radial-gradient(65% 50% at 4% 10%,rgba(151,110,235,.28),transparent 60%),radial-gradient(80% 60% at 50% 106%,rgba(31,161,110,.22),transparent 60%);animation:pmdveil .2s ease both;overflow:auto';

  const photo = (i: number) => photos[i % Math.max(photos.length, 1)] || '';
  const CAPTIONS = ['Site view', 'Approach road', 'Surroundings', 'Front road', 'Wide angle', 'Evening view'];
  const priceLabel = property.price ? formatINR(property.price) : 'Price on request';

  function render(): void {
    const facts: [string, string][] = [
      ['Plot size', property.size || '—'],
      ['Facing', property.facing || '—'],
      ['Position', property.position || 'Inside plot'],
      ['Type', property.type || '—'],
      ['Sector', property.sector || property.area || '—'],
      ['City', property.city || '—'],
    ];
    host.innerHTML = `
      <div style="flex:1;min-height:0;width:100%;max-width:1340px;margin:0 auto;padding:18px 26px 24px;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;gap:14px;flex:none">
          <button data-d="close" style="display:flex;align-items:center;gap:9px;height:44px;padding:0 17px;border-radius:13px;background:rgba(255,248,230,.14);color:#fff8e6;font-size:15px;font-weight:800;cursor:pointer"><i class="ph-bold ph-arrow-left" style="font-size:17px"></i>Back</button>
          <div style="flex:1"></div>
          <div style="display:flex;align-items:center;gap:9px;height:44px;padding:0 16px;border-radius:13px;background:rgba(255,248,230,.12)"><i class="ph-fill ph-tag" style="font-size:18px;color:#ffd76b"></i><span style="font-size:16px;font-weight:800;color:#fffdf7">${esc(priceLabel)}</span></div>
          <button data-d="edit" style="display:flex;align-items:center;gap:8px;height:44px;padding:0 18px;border-radius:13px;background:#ffc93c;color:#231a04;font-size:15px;font-weight:800;cursor:pointer"><i class="ph-bold ph-pencil-simple" style="font-size:17px"></i>Edit</button>
        </div>
        <div style="flex:1;min-height:0;margin-top:16px;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:22px">
          <div style="min-height:0;display:flex;flex-direction:column">
            <div style="position:relative;flex:1;min-height:280px;border-radius:24px;overflow:hidden;box-shadow:0 40px 80px -34px rgba(0,0,0,.8)">
              ${photos.length ? `<div style="position:absolute;inset:0;background-image:url('${esc(photo(shot))}');background-size:cover;background-position:center"></div>` : '<div style="position:absolute;inset:0;display:grid;place-items:center;background:#2a2013;color:#8d7a52"><i class="ph-fill ph-image" style="font-size:44px"></i></div>'}
              <div style="position:absolute;left:0;right:0;bottom:0;padding:40px 24px 18px;background:linear-gradient(180deg,rgba(18,12,2,0),rgba(18,12,2,.85));display:flex;align-items:flex-end;justify-content:space-between"><div style="font-size:17px;font-weight:800;color:#fffdf7">${photos.length ? esc(CAPTIONS[shot % CAPTIONS.length]) : 'No photos yet'}</div>${photos.length ? `<div style="font-size:14px;font-weight:800;color:#e2cf9f">${shot + 1} / ${photos.length}</div>` : ''}</div>
              ${photos.length > 1 ? `<button data-d="prev" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,250,238,.92);color:#241d0c;display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-caret-left" style="font-size:22px"></i></button><button data-d="next" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,250,238,.92);color:#241d0c;display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-caret-right" style="font-size:22px"></i></button>` : ''}
            </div>
          </div>
          <div style="min-height:0;display:flex;flex-direction:column"><div style="flex:1;min-height:0;overflow-y:auto;padding-right:4px">
            <div style="font-size:11.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#ffd76b">${esc(property.city || '')}</div>
            <h1 style="margin:8px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:clamp(28px,4vh,42px);line-height:1;letter-spacing:-.03em;color:#fffdf7">${esc(property.area || property.loc || 'Property')}</h1>
            <div style="margin-top:8px;font-size:16px;color:#e2cf9f">${esc(property.loc || '')}</div>
            <div style="display:inline-flex;align-items:center;gap:8px;margin-top:12px;padding:8px 14px;border-radius:12px;background:rgba(255,201,60,.16)"><span style="font-size:12px;font-weight:800;color:#ffd76b">${property.published ? 'PUBLISHED' : 'DRAFT'}</span><span style="font-size:12px;color:#e2cf9f">· ${property.views ?? 0} opens</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px">${facts.map(([k, v]) => `<div style="padding:13px 16px;border-radius:15px;background:rgba(255,248,230,.09);box-shadow:inset 0 0 0 1px rgba(255,248,230,.14)"><div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c8b58a">${esc(k)}</div><div style="margin-top:4px;font-family:'Newsreader',serif;font-weight:500;font-size:21px;color:#fffdf7;line-height:1.1">${esc(v)}</div></div>`).join('')}</div>
            ${approvals.length ? `<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px">${approvals.map((a) => `<span style="padding:7px 12px;border-radius:10px;background:rgba(123,224,164,.16);color:#a7f3c9;font-size:13px;font-weight:800">${esc(a)}</span>`).join('')}</div>` : ''}
            ${landmarks.length ? `<div style="margin-top:16px;font-size:11.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#e2cf9f">What is close by</div><div style="display:flex;flex-direction:column;gap:7px;margin-top:10px">${landmarks.map((l) => `<div style="display:flex;align-items:center;gap:11px;padding:10px 14px;border-radius:13px;background:rgba(255,248,230,.07)"><i class="${esc(l.icon)}" style="font-size:19px;color:#ffd76b"></i><span style="flex:1;font-size:14.5px;font-weight:700;color:#fff8e6">${esc(l.name)}</span><span style="font-size:14.5px;font-weight:800;color:#7be0a4">${esc(l.distance)}</span></div>`).join('')}</div>` : ''}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px;flex:none">
            <a href="${esc(streetViewUrl(property.loc || property.area || ''))}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;height:50px;border-radius:14px;background:#e8f0fe;color:#1a56c4;font-size:15px;font-weight:800;text-decoration:none"><i class="ph-fill ph-person-simple-walk" style="font-size:19px"></i>Street view</a>
            <button data-d="edit" style="display:flex;align-items:center;justify-content:center;gap:8px;height:50px;border-radius:14px;background:#ffc93c;color:#231a04;font-size:15px;font-weight:800;cursor:pointer"><i class="ph-fill ph-pencil-simple" style="font-size:19px"></i>Edit property</button>
          </div></div>
        </div>
      </div>`;
  }

  const dispose = () => { host.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); host.remove(); opts.onClose?.(); };
  const onClick = (e: MouseEvent) => {
    const d = (e.target as HTMLElement).closest<HTMLElement>('[data-d]')?.dataset.d;
    if (d === 'close') dispose();
    else if (d === 'prev') { shot = (shot + Math.max(photos.length, 1) - 1) % Math.max(photos.length, 1); render(); }
    else if (d === 'next') { shot = (shot + 1) % Math.max(photos.length, 1); render(); }
    else if (d === 'edit') { dispose(); opts.onEdit?.(property); }
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dispose(); };

  render();
  host.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(host);
  return dispose;
}

/* ═══════════════════════════════════════════════════════════════
   Premium property-detail DRAWER (shared: Dealer + Team)
   ---------------------------------------------------------------
   A calm, premium overview — one price only, private owner section,
   a single combined activity section (real Client-Link analytics),
   a map section and collapsed nearby places. Delete + Take Off live
   in a three-dot danger menu, never as a primary button.
   ═══════════════════════════════════════════════════════════════ */
export interface PropertyDrawerOptions {
  onEdit?: (p: Property) => void;
  onShowMap?: (p: Property) => void;
  onSendLink?: (p: Property) => void;
  onPublishToggle?: (p: Property) => void;
  onMarkSold?: (p: Property) => void;
  onDelete?: (p: Property) => void;
  onOpenLink?: (link: ClientLink) => void;
  onClose?: () => void;
  /** hide management actions (publish/sold/delete/send-link) for read-only views. */
  canManage?: boolean;
}

const LINK_STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: '#d9f5e3', fg: '#0b6f39', label: 'Active' },
  expired: { bg: '#f6efe0', fg: '#8a6a14', label: 'Expired' },
  revoked: { bg: '#ffe1e6', fg: '#b3123a', label: 'Revoked' },
};

export function openPropertyDrawer(property: Property, opts: PropertyDrawerOptions = {}): () => void {
  const canManage = opts.canManage ?? true;
  const photos = property.photos ?? [];
  const landmarks = property.landmarks ?? [];
  const approvals = property.approvals ?? [];
  let shot = 0;
  let menuOpen = false;
  let nearbyOpen = false;
  let links: ClientLink[] | null = null;   // null = loading, [] = none

  const host = document.createElement('div');
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', property.area || 'Property');
  host.style.cssText = 'position:fixed;inset:0;z-index:120;display:flex;justify-content:flex-end;background:rgba(28,20,5,.4);backdrop-filter:blur(3px);animation:pmdveil .18s ease both';

  const statusBadge = () => property.sold
    ? { bg: '#efe1ff', fg: '#5b32c4', label: 'Sold' }
    : photos.length ? { bg: '#d9f5e3', fg: '#0b6f39', label: 'Available' } : { bg: '#ffe1e6', fg: '#b5322a', label: 'Needs photo' };

  const priceLabel = property.price ? formatINR(property.price) : 'Price on request';

  const activityHtml = (): string => {
    if (links === null) return '<div style="font-size:14px;color:#8d8271">Loading activity…</div>';
    const active = links.filter((l) => l.status === 'active');
    const opens = links.reduce((s, l) => s + (l.events?.opens ?? 0), 0);
    const interested = new Set(links.map((l) => l.clientName).filter(Boolean)).size;
    const lastActive = links.map((l) => l.lastOpen).find((x) => x && x !== 'not yet') || 'No opens yet';
    const stat = (icon: string, value: string, label: string) =>
      `<div style="flex:1;min-width:120px"><div style="display:flex;align-items:center;gap:7px;font-size:20px;font-weight:800;color:#241f1c"><i class="${icon}" style="font-size:18px;color:#6b3fd4"></i>${esc(value)}</div><div style="font-size:12.5px;color:#8d8271;margin-top:2px">${esc(label)}</div></div>`;
    return `<div style="display:flex;flex-wrap:wrap;gap:16px 20px">
        ${stat('ph-fill ph-users-three', String(interested), 'Interested clients')}
        ${stat('ph-fill ph-paper-plane-tilt', String(active.length), 'Active client links')}
        ${stat('ph-fill ph-eye', String(opens), 'Total link opens')}
        ${stat('ph-fill ph-clock', esc(lastActive), 'Last client activity')}
      </div>
      ${links.length ? `<div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">${links.map((l) => {
        const st = LINK_STATUS_STYLE[l.status] ?? LINK_STATUS_STYLE.active!;
        return `<button data-d="open-link" data-id="${esc(l.id)}" style="display:flex;align-items:center;gap:11px;padding:12px 14px;border-radius:13px;background:#fff;border:1px solid #efe6d0;text-align:left;cursor:pointer;width:100%">
          <span style="width:36px;height:36px;border-radius:10px;flex:none;background:#efe8fb;color:#6b3fd4;display:grid;place-items:center"><i class="ph-fill ph-paper-plane-tilt" style="font-size:17px"></i></span>
          <span style="flex:1;min-width:0"><span style="display:block;font-size:14.5px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.clientName || 'Client')}</span><span style="display:block;font-size:12.5px;color:#8d8271">${l.createdAt ? `Created ${esc(l.createdAt)} · ` : ''}Expires in ${esc(l.expiry)} · ${l.events?.opens ?? 0} opens</span></span>
          <span style="flex:none;font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:999px;background:${st.bg};color:${st.fg}">${st.label}</span>
          <i class="ph-bold ph-caret-right" style="font-size:14px;color:#c2bba9;flex:none"></i>
        </button>`;
      }).join('')}</div>` : '<div style="margin-top:12px;font-size:14px;color:#8d8271">No client links contain this plot yet.</div>'}`;
  };

  const sectionCard = (body: string) => `<div style="margin-top:14px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:18px;padding:18px 20px">${body}</div>`;
  const sectionTitle = (title: string, icon: string) => `<div style="display:flex;align-items:center;gap:9px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8d8271;margin-bottom:12px"><i class="${icon}" style="font-size:15px;color:#6b3fd4"></i>${esc(title)}</div>`;

  function render(): void {
    const badge = statusBadge();
    const facts: [string, string, string][] = [
      ['ph-fill ph-ruler', property.size || '—', 'Size'],
      ['ph-fill ph-flag-pennant', property.position || 'Inside', 'Position'],
      ['ph-fill ph-compass', property.facing || '—', 'Facing'],
      ['ph-fill ph-seal-check', approvals[0] || 'None', 'Approval'],
    ];
    const placement = property.mapPlacement ? 'Pinned on the map' : 'Not placed on a map yet';
    host.innerHTML = `<section style="width:min(600px,96vw);height:100%;background:#fffaf0;box-shadow:-28px 0 70px -34px rgba(20,14,2,.8);display:flex;flex-direction:column;animation:omSlide .28s cubic-bezier(.2,.8,.2,1) both">
      <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #f0dfb8;flex:none">
        <button data-d="close" style="display:flex;align-items:center;gap:8px;height:42px;padding:0 15px;border-radius:12px;background:#f3eeff;color:#4c463d;font-weight:800;cursor:pointer"><i class="ph-bold ph-arrow-left"></i>Back</button>
        <div style="flex:1"></div>
        ${canManage ? `<div style="position:relative"><button data-d="menu" aria-label="More actions" style="width:42px;height:42px;border-radius:12px;background:#f3eeff;color:#6b6156;display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-dots-three-vertical" style="font-size:18px"></i></button>
          ${menuOpen ? `<div style="position:absolute;right:0;top:calc(100% + 8px);width:210px;background:#fffaf0;border:1px solid #e6ddcc;border-radius:14px;box-shadow:0 24px 54px -24px rgba(30,28,22,.65);padding:7px;z-index:5;animation:omPop .16s ease both">
            <button data-d="publish" style="width:100%;display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:9px;color:#146c3a;text-align:left;font-weight:800;cursor:pointer"><i class="ph-fill ${property.published ? 'ph-eye-slash' : 'ph-broadcast'}"></i>${property.published ? 'Take off presentation' : 'Publish'}</button>
            <button data-d="delete" style="width:100%;display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:9px;color:#c2185b;text-align:left;font-weight:800;cursor:pointer"><i class="ph-fill ph-trash"></i>Delete plot</button>
          </div>` : ''}
        </div>` : ''}
      </div>
      <div data-scroll style="flex:1;min-height:0;overflow-y:auto;padding:20px 22px 24px">
        <div style="position:relative;height:230px;border-radius:20px;overflow:hidden;${photos.length ? '' : 'background:linear-gradient(135deg,#efe8fb,#f7e7c6)'}">
          ${photos.length ? `<div style="position:absolute;inset:0;background:url('${esc(photos[shot % photos.length])}') center/cover"></div>` : '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#a8792a"><i class="ph-fill ph-image" style="font-size:44px"></i></div>'}
          <span style="position:absolute;top:12px;left:12px;padding:6px 12px;border-radius:999px;background:${badge.bg};color:${badge.fg};font-size:12px;font-weight:800">${badge.label}</span>
          ${photos.length ? `<span style="position:absolute;top:12px;right:12px;padding:6px 11px;border-radius:999px;background:rgba(24,16,4,.6);color:#faf7ff;font-size:12px;font-weight:700"><i class="ph-fill ph-images" style="font-size:13px;vertical-align:-1px"></i> ${shot + 1}/${photos.length}</span>` : ''}
          ${photos.length > 1 ? `<button data-d="prev" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:rgba(255,250,238,.92);color:#241d0c;display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-caret-left" style="font-size:20px"></i></button><button data-d="next" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:rgba(255,250,238,.92);color:#241d0c;display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-caret-right" style="font-size:20px"></i></button>` : ''}
        </div>

        <div style="margin-top:18px">
          <div style="font-size:11.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a8792a">${esc(property.city || '')}${property.sector ? ` · ${esc(property.sector)}` : ''}</div>
          <h2 style="margin:6px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:32px;line-height:1.05;color:#241f1c">${esc(property.area || property.loc || 'Property')}</h2>
          <div style="margin-top:5px;font-size:15px;color:#6b6156">${esc(property.type || '')}${property.size ? ` · ${esc(property.size)}` : ''}</div>
        </div>

        <div style="margin-top:16px;background:#fff3d1;border:1px solid #f2dfab;border-radius:16px;padding:16px 18px;display:flex;align-items:baseline;justify-content:space-between;gap:12px">
          <span style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#a8792a">Asking price</span>
          <span style="font-family:'Newsreader',serif;font-weight:600;font-size:30px;color:#c85a1a">${esc(priceLabel)}</span>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">${facts.map(([icon, v, k]) => `<span style="display:inline-flex;align-items:center;gap:7px;background:#f7e7c6;color:#4c463d;border-radius:999px;padding:8px 13px;font-size:13px;font-weight:700"><i class="${icon}" style="font-size:15px;color:#a8792a"></i><span style="color:#8d8271;font-weight:700">${esc(k)}:</span> ${esc(v)}</span>`).join('')}</div>

        ${sectionCard(sectionTitle('Private owner', 'ph-fill ph-user-focus') + (property.owner ? `
          <div style="display:flex;align-items:center;gap:12px">
            <div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:800;color:#241f1c">${esc(property.owner.name)}</div><div style="font-size:13px;color:#8d8271">${esc(property.owner.phone || '')}${property.owner.priceConfirmedAt ? ` · price confirmed ${esc(property.owner.priceConfirmedAt)}` : ''}</div></div>
            ${property.owner.phone ? `<a href="tel:${esc(property.owner.phone)}" style="display:flex;align-items:center;gap:7px;height:42px;padding:0 15px;border-radius:11px;background:#12a150;color:#fff;font-weight:800;font-size:14px;text-decoration:none"><i class="ph-fill ph-phone"></i>Call</a>` : ''}
          </div>
          <button data-d="edit" style="margin-top:12px;width:100%;height:42px;border-radius:11px;background:#f3eeff;color:#5b32c4;font-weight:800;font-size:14px;cursor:pointer"><i class="ph-fill ph-pencil-simple"></i> Edit details</button>`
          : `<div style="font-size:14px;color:#8d8271">No owner details on file.</div><button data-d="edit" style="margin-top:10px;height:40px;padding:0 15px;border-radius:11px;background:#f3eeff;color:#5b32c4;font-weight:800;font-size:14px;cursor:pointer">Add owner details</button>`))}

        ${sectionCard(sectionTitle('Property activity', 'ph-fill ph-chart-line-up') + `<div id="pm-pd-activity">${activityHtml()}</div>`)}

        ${sectionCard(sectionTitle('On the map', 'ph-fill ph-map-pin-area') + `<div style="display:flex;align-items:center;gap:12px"><div style="flex:1"><div style="font-size:15px;font-weight:800;color:#241f1c">${esc(property.city || 'City map')}${property.sector ? ` · ${esc(property.sector)}` : ''}</div><div style="font-size:13px;color:${property.mapPlacement ? '#0b6f39' : '#8d8271'}">${placement}</div></div><button data-d="show-map" style="height:42px;padding:0 15px;border-radius:11px;background:#fff3d1;color:#8a6a14;font-weight:800;font-size:14px;cursor:pointer"><i class="ph-fill ph-map-pin-line"></i> Show on map</button></div>`)}

        ${landmarks.length ? sectionCard(`<button data-d="nearby" style="width:100%;display:flex;align-items:center;justify-content:space-between;background:none;cursor:pointer">${sectionTitle('Nearby places', 'ph-fill ph-tree').replace('margin-bottom:12px', 'margin-bottom:0')}<i class="ph-bold ph-caret-${nearbyOpen ? 'up' : 'down'}" style="font-size:15px;color:#8d8271"></i></button>${nearbyOpen ? `<div style="display:flex;flex-direction:column;gap:7px;margin-top:12px">${landmarks.map((l) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:11px;background:#fff;border:1px solid #efe6d0"><i class="${esc(l.icon)}" style="font-size:17px;color:#d95d1e"></i><span style="flex:1;font-size:14px;font-weight:700;color:#3a332c">${esc(l.name)}</span><b style="font-size:13px;color:#12a150">${esc(l.distance)}</b></div>`).join('')}</div>` : ''}`) : ''}
      </div>
      <div style="flex:none;padding:14px 20px;border-top:1px solid #f0dfb8;display:flex;gap:9px">
        <button data-d="edit" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:50px;border-radius:13px;background:#f3eeff;color:#4c463d;font-size:15px;font-weight:800;cursor:pointer"><i class="ph-fill ph-pencil-simple"></i>Edit</button>
        <button data-d="show-map" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:50px;border-radius:13px;background:#fff3d1;color:#8a6a14;font-size:15px;font-weight:800;cursor:pointer"><i class="ph-fill ph-map-pin-line"></i>Map</button>
        ${canManage ? `<button data-d="send-link" style="flex:1.4;display:flex;align-items:center;justify-content:center;gap:7px;height:50px;border-radius:13px;background:#ffc93c;color:#241d0c;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 10px 22px -12px rgba(244,174,20,.9)"><i class="ph-fill ph-paper-plane-tilt"></i>Send private link</button>` : ''}
      </div>
    </section>`;
  }

  const dispose = () => { host.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); host.remove(); opts.onClose?.(); };
  const onClick = (e: MouseEvent) => {
    if (e.target === host) { dispose(); return; }
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-d]');
    const d = el?.dataset.d;
    if (!d) return;
    switch (d) {
      case 'close': dispose(); break;
      case 'prev': shot = (shot + Math.max(photos.length, 1) - 1) % Math.max(photos.length, 1); render(); break;
      case 'next': shot = (shot + 1) % Math.max(photos.length, 1); render(); break;
      case 'menu': menuOpen = !menuOpen; render(); break;
      case 'nearby': nearbyOpen = !nearbyOpen; render(); break;
      case 'edit': dispose(); opts.onEdit?.(property); break;
      case 'show-map': if (opts.onShowMap) { dispose(); opts.onShowMap(property); } else { window.location.assign(`/app/plotmap/index.html?property=${encodeURIComponent(property.id)}`); } break;
      case 'send-link': dispose(); opts.onSendLink?.(property); break;
      case 'publish': menuOpen = false; dispose(); opts.onPublishToggle?.(property); break;
      case 'delete': menuOpen = false; dispose(); opts.onDelete?.(property); break;
      case 'open-link': { const link = links?.find((l) => l.id === el?.dataset.id); if (link) { dispose(); opts.onOpenLink?.(link); } break; }
    }
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dispose(); };

  render();
  host.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(host);

  // Load real per-property client-link analytics, then refresh just that section.
  void adapter.clientLinks.listForProperty(property.id).then((res) => {
    links = res.ok ? res.value : [];
    const box = host.querySelector('#pm-pd-activity');
    if (box) box.innerHTML = activityHtml();
  });

  return dispose;
}

/* ── Compact shared edit modal (used by the drawer's Edit action) ── */
export function openPropertyEditModal(
  property: Property,
  opts: { onSave?: (p: Property) => void; onClose?: () => void } = {},
): () => void {
  const host = document.createElement('div');
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(28,20,6,.55);backdrop-filter:blur(5px);display:grid;place-items:center;padding:22px;animation:pmdveil .18s ease both';
  const field = (name: string, label: string, value: string, type = 'text') =>
    `<label style="display:block;font-size:12.5px;font-weight:800;color:#6b6156">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" style="display:block;width:100%;height:48px;margin-top:6px;border:1px solid #dcd0f3;border-radius:12px;background:#faf7ff;padding:0 14px;font-size:15px"></label>`;
  host.innerHTML = `<form style="width:min(640px,96vw);max-height:92vh;overflow:auto;background:#fffaf0;border:1px solid #ddd2f5;border-radius:24px;box-shadow:0 40px 90px -36px rgba(20,14,2,.85)">
    <div style="display:flex;align-items:center;gap:13px;padding:20px 24px;border-bottom:1px solid #e4dbf7"><span style="width:44px;height:44px;border-radius:13px;background:#ffc93c;display:grid;place-items:center"><i class="ph-fill ph-pencil-simple" style="font-size:22px"></i></span><div style="flex:1"><div style="font-family:'Newsreader',serif;font-size:24px">Edit property</div><div style="font-size:13px;color:#8d8271">Private details — never shown to a client.</div></div><button type="button" data-x="close" aria-label="Close" style="width:40px;height:40px;border-radius:12px;background:#f0eaff;cursor:pointer"><i class="ph-bold ph-x"></i></button></div>
    <div style="padding:22px 24px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <label style="display:block;font-size:12.5px;font-weight:800;color:#6b6156">Type<select name="type" style="display:block;width:100%;height:48px;margin-top:6px;border:1px solid #dcd0f3;border-radius:12px;background:#faf7ff;padding:0 12px;font-size:15px">${PROPERTY_TYPES.map((t) => `<option ${t === property.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      ${field('area', 'Plot name', property.area || '')}
      ${field('city', 'City', property.city || '')}
      ${field('loc', 'Sector / locality', property.loc || '')}
      ${field('size', 'Size', property.size || '')}
      ${field('facing', 'Facing', property.facing || '')}
      ${field('position', 'Position', property.position || '')}
      ${field('price', 'Asking price (₹)', property.price ? String(property.price) : '', 'number')}
      ${field('approvals', 'Approvals (comma-separated)', (property.approvals ?? []).join(', '))}
      ${field('ownerName', 'Owner name', property.owner?.name || '')}
      ${field('ownerPhone', 'Owner phone', property.owner?.phone || '')}
      <label style="grid-column:1/-1;display:flex;align-items:center;gap:11px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:12px;padding:13px 15px;font-size:14px;font-weight:700;color:#241f1c;${property.mapPlacement ? '' : 'opacity:.55'}"><input name="clearPin" type="checkbox" ${property.mapPlacement ? '' : 'disabled'} style="width:18px;height:18px">Remove this plot's map pin ${property.mapPlacement ? '(currently pinned)' : '(not pinned — set it in Map Studio)'}</label>
    </div>
    <div style="display:flex;gap:11px;padding:0 24px 22px"><div style="flex:1"></div><button type="button" data-x="close" style="height:48px;padding:0 20px;border-radius:13px;background:#f0eaff;font-weight:800;cursor:pointer">Cancel</button><button type="submit" style="height:48px;padding:0 24px;border-radius:13px;background:#241d0c;color:#ffd75e;font-weight:800;cursor:pointer">Save changes</button></div>
  </form>`;
  const dispose = () => { host.remove(); opts.onClose?.(); };
  host.addEventListener('click', (e) => {
    if (e.target === host || (e.target as HTMLElement).closest('[data-x="close"]')) dispose();
  });
  host.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const val = (n: string) => (form.querySelector(`[name="${n}"]`) as HTMLInputElement | null)?.value ?? '';
    const approvals = val('approvals').split(',').map((s) => s.trim()).filter(Boolean);
    const ownerName = val('ownerName').trim();
    const clearPin = (form.querySelector('[name="clearPin"]') as HTMLInputElement | null)?.checked;
    const typeVal = (form.querySelector('[name="type"]') as HTMLSelectElement | null)?.value as PropertyType | undefined;
    const updated: Property = {
      ...property,
      type: typeVal || property.type,
      area: val('area').trim() || property.area,
      city: val('city').trim() || property.city,
      loc: val('loc').trim() || property.loc,
      sector: val('loc').trim() || property.sector,
      size: val('size').trim() || property.size,
      facing: (val('facing').trim() || property.facing) as Property['facing'],
      position: val('position').trim() || property.position,
      price: Number(val('price')) || property.price,
      approvals,
      ...(clearPin ? { mapPlacement: undefined } : {}),
      ...(ownerName ? { owner: { name: ownerName, phone: val('ownerPhone').trim(), priceConfirmedAt: property.owner?.priceConfirmedAt } } : {}),
    };
    dispose();
    opts.onSave?.(updated);
  });
  document.body.appendChild(host);
  return dispose;
}
