/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Shared property detail (dealer/team internal)
   ---------------------------------------------------------------
   The full property view opened from Home "hot" cards, the Properties
   list, and Team Workspace. Same look as the Client Presentation detail
   but INTERNAL: shows price + an Edit button. Framework-free overlay;
   returns a disposer. Never used on the client-facing routes.
   ═══════════════════════════════════════════════════════════════ */
import { formatINR, streetViewUrl } from './utils';
import type { Property } from '../data/types';

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
