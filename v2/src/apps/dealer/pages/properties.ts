import { adapter } from '../../../packages/data/adapter';
import type { ClientLink, Property, PropertyType } from '../../../packages/data/types';
import { listAllRecords } from '../../../packages/data/list-all';
import { openPropertyDrawer, openPropertyEditModal } from '../../../packages/ui/property-detail';
import { productRoutes, requestedPropertyId } from '../../../packages/ui/product-routes';
import { AddPropertyFlow } from '../../../packages/ui/shared-modals';
import { formatINR } from '../../../packages/ui/utils';
import {
  propertyAttentionLabel,
  propertyOperationalState,
} from '../property-operational-state';

const esc = (value: unknown): string => String(value ?? '').replace(
  /[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

const iconFor = (type: PropertyType): string =>
  type === 'Flat' || type === 'Floor'
    ? 'ph-fill ph-buildings'
    : type === 'Kothi'
      ? 'ph-fill ph-house-line'
      : type === 'Villa'
        ? 'ph-fill ph-house'
        : type === 'Commercial'
          ? 'ph-fill ph-storefront'
          : 'ph-fill ph-map-pin-area';

const withTimeout = <T,>(promise: Promise<T>): Promise<T> => Promise.race([
  promise,
  new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12_000)),
]);

type Notice = { kind: 'error' | 'success' | 'warning'; message: string };

export async function renderProperties(el: HTMLElement): Promise<void> {
  let properties: Property[] = [];
  let links: ClientLink[] = [];
  let linksAvailable = true;
  let city = new URLSearchParams(window.location.search).get('city') || 'all';
  let cityOpen = false;
  const deepLinkId = requestedPropertyId(window.location.search);
  let menuId: string | null = null;
  let busyId: string | null = null;
  let notice: Notice | null = null;
  let drawerDispose: (() => void) | null = null;

  el.innerHTML = '<div role="status" aria-live="polite" style="max-width:1120px;margin:34px auto;padding:24px 26px;color:#6b6156">Loading your properties…</div>';

  try {
    const [propertyResult, linkResult] = await Promise.all([
      withTimeout(listAllRecords((params, opts) => adapter.properties.list(params, opts))),
      withTimeout(listAllRecords((params, opts) => adapter.clientLinks.list(params, opts))),
    ]);
    if (!propertyResult.ok) {
      el.innerHTML = '<div role="alert" style="max-width:1120px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Properties could not be loaded. Please refresh.</div>';
      return;
    }
    properties = propertyResult.value;
    if (linkResult.ok) {
      links = linkResult.value;
    } else {
      linksAvailable = false;
      notice = { kind: 'warning', message: 'Private-link context is temporarily unavailable.' };
    }
  } catch {
    el.innerHTML = '<div role="alert" style="max-width:1120px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Properties could not be loaded. Check your connection and refresh.</div>';
    return;
  }

  const activeLinkCount = (propertyId: string): number => links.filter(
    (link) => link.status === 'active' && (link.props ?? []).includes(propertyId),
  ).length;

  const renderCard = (property: Property): string => {
    const state = propertyOperationalState(property);
    const shares = activeLinkCount(property.id);
    const image = property.photos?.[0];
    const busy = busyId === property.id;
    const statusChip = (icon: string, label: string, okay: boolean, goodBg = '#d9f5e3', goodFg = '#0b6f39') =>
      `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;padding:5px 10px;border-radius:999px;background:${okay ? goodBg : '#f3eeff'};color:${okay ? goodFg : '#786b58'}"><i class="ph-fill ${icon}" style="font-size:13px"></i>${esc(label)}</span>`;

    return `<article aria-busy="${busy}" style="min-width:0;background:#faf7ff;border:1px solid #e4dbf7;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 34px -26px rgba(30,28,22,.6);position:relative;${busy ? 'opacity:.65;pointer-events:none' : ''}">
      <div style="height:170px;position:relative;background:linear-gradient(135deg,#efe8fb,#f7e7c6)">
        <button data-act="detail" data-id="${esc(property.id)}" title="Open this property" style="position:absolute;inset:0;width:100%;cursor:pointer;padding:0;text-align:left;overflow:hidden">
          ${image ? `<img src="${esc(image)}" alt="" style="width:100%;height:100%;object-fit:cover">` : `<span style="position:absolute;inset:0;display:grid;place-items:center;color:#8a7a52"><span style="text-align:center"><i class="${iconFor(property.type)}" style="font-size:34px"></i><span style="display:block;margin-top:6px;font-size:12px;font-weight:800">${state.photoCount ? 'Photo unavailable' : 'Add photos'}</span></span></span>`}
        </button>
        <span style="position:absolute;top:12px;right:12px;display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;background:${state.readyToShow ? '#d9f5e3' : '#fff3d1'};color:${state.readyToShow ? '#0b6f39' : '#8a5a0c'};font-size:11.5px;font-weight:800"><i class="ph-fill ${state.readyToShow ? 'ph-check-circle' : 'ph-wrench'}"></i>${state.readyToShow ? 'Ready to show' : 'Needs attention'}</span>
      </div>
      <div style="padding:18px 20px">
        <div style="font-size:11px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#9a6b1b">${esc(property.type)}</div>
        <div style="font-family:'Newsreader',serif;font-size:24px;font-weight:550;color:#241f1c;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(property.area || property.type)}</div>
        <div style="font-size:14px;color:#6b6156;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(property.loc || property.sector)}${property.city ? ` · ${esc(property.city)}` : ''}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <span style="font-size:13px;font-weight:700;color:#4c463d;background:#f7e7c6;border-radius:9px;padding:5px 10px"><i class="ph-fill ph-ruler" style="font-size:13px;vertical-align:-1px;color:#a8792a"></i> ${esc(property.size || 'Size not set')}</span>
          <span style="font-size:13px;font-weight:700;color:#4c463d;background:#f7e7c6;border-radius:9px;padding:5px 10px"><i class="ph ph-compass" style="font-size:14px;vertical-align:-2px;color:#a8792a"></i> ${esc(property.facing || 'Facing not set')}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:12px">
          ${statusChip(state.isPublished ? 'ph-eye' : 'ph-eye-slash', state.isPublished ? 'On presentation' : 'Not published', state.isPublished)}
          ${statusChip('ph-map-pin-line', state.hasMapPlacement ? 'On presentation map' : 'Map placement missing', state.hasMapPlacement)}
          ${statusChip('ph-globe-hemisphere-west', state.hasEarthLocation ? 'Located in Earth' : 'Earth location missing', state.hasEarthLocation, '#e5e0ff', '#5b32c4')}
          ${statusChip('ph-images', `${state.photoCount} photo${state.photoCount === 1 ? '' : 's'}`, state.photoCount > 0, '#f7e7c6', '#8a6a14')}
          ${linksAvailable && shares ? statusChip('ph-paper-plane-tilt', `${shares} active ${shares === 1 ? 'link' : 'links'}`, true, '#efe8fb', '#6b3fd4') : ''}
        </div>
        ${state.attentionReasons.length ? `<div style="margin-top:12px;padding:9px 11px;border-radius:11px;background:#fff8e6;color:#78613a;font-size:12.5px"><strong style="color:#8a5a0c">To finish:</strong> ${state.attentionReasons.map(propertyAttentionLabel).map(esc).join(' · ')}</div>` : ''}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid #f0e4cb">
          <button data-act="detail" data-id="${esc(property.id)}" title="Edit property" style="display:flex;align-items:center;gap:8px;font-family:'Newsreader',serif;font-weight:600;font-size:24px;color:#c85a1a;cursor:pointer"><span>${esc(formatINR(property.price))}</span><i class="ph-fill ph-pencil-simple" style="font-size:15px"></i></button>
          <button data-act="menu" data-id="${esc(property.id)}" title="More actions" aria-label="Property actions" aria-expanded="${menuId === property.id}" style="width:36px;height:36px;border-radius:11px;background:#f3eeff;color:#746982;display:grid;place-items:center"><i class="ph-bold ph-dots-three" style="font-size:18px"></i></button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
          <a href="${esc(productRoutes.earth(property.id))}" style="display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:12px;background:#efe8fb;color:#5b32c4;font-size:14px;font-weight:800;text-decoration:none"><i class="ph-fill ph-globe-hemisphere-west" style="font-size:17px"></i>${state.hasEarthLocation ? 'View in Earth' : 'Set in Earth'}</a>
          <a href="${esc(productRoutes.presentation(property.id))}" style="display:flex;align-items:center;justify-content:center;gap:7px;height:46px;border-radius:12px;background:#e2f2e6;color:#186c3c;font-size:14px;font-weight:800;text-decoration:none"><i class="ph-fill ph-presentation-chart" style="font-size:17px"></i>Presentation</a>
          <a href="${esc(productRoutes.privateLink(property.id))}" style="grid-column:1 / -1;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:12px;background:#ffc93c;color:#241d0c;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 10px 22px -12px rgba(244,174,20,.9)"><i class="ph-fill ph-paper-plane-tilt" style="font-size:18px"></i>${shares ? `Manage ${shares} active ${shares === 1 ? 'link' : 'links'}` : 'Send private link'}</a>
        </div>
      </div>
      ${menuId === property.id ? `<div style="position:absolute;right:14px;bottom:76px;width:210px;background:#fffaf0;border:1px solid #e6ddcc;border-radius:14px;box-shadow:0 24px 54px -24px rgba(30,28,22,.65);padding:7px;z-index:20;animation:omPop .16s ease both">
        <button data-act="publish" data-id="${esc(property.id)}" style="width:100%;display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:9px;color:#146c3a;text-align:left;font-weight:800"><i class="ph-fill ${property.published ? 'ph-eye-slash' : 'ph-broadcast'}"></i>${property.published ? 'Take off presentation' : 'Publish'}</button>
        <button data-act="sold" data-id="${esc(property.id)}" style="width:100%;display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:9px;color:#5b32c4;text-align:left;font-weight:800"><i class="ph-fill ph-seal-check"></i>Record completed sale</button>
        <button data-act="remove" data-id="${esc(property.id)}" style="width:100%;display:flex;align-items:center;gap:9px;padding:10px 11px;border-radius:9px;color:#c2185b;text-align:left;font-weight:800"><i class="ph-fill ph-trash"></i>Remove from stock</button>
      </div>` : ''}
    </article>`;
  };

  const render = (): void => {
    const cities = [...new Set(properties.filter((property) => !property.sold).map((property) => property.city).filter(Boolean))].sort();
    const stock = properties.filter((property) => !property.sold && (city === 'all' || property.city === city));
    const ready = stock.filter((property) => propertyOperationalState(property).readyToShow);
    const needsAttention = stock.filter((property) => !propertyOperationalState(property).readyToShow);
    const portfolio = stock.reduce((sum, property) => sum + (Number.isFinite(property.price) ? property.price : 0), 0);
    const noticeStyle = notice?.kind === 'error'
      ? 'background:#ffe1e6;color:#9f2446;border-color:#f4b8c7'
      : notice?.kind === 'success'
        ? 'background:#d9f5e3;color:#0b6f39;border-color:#b8e5c9'
        : 'background:#fff3d1;color:#8a5a0c;border-color:#f0d68c';

    el.innerHTML = `<div style="max-width:1120px;margin:0 auto;padding:34px 40px 70px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both"><div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">My Plots</h1><p style="margin:8px 0 0;font-size:17px;color:#6b6156">Everything in your stock—and exactly what is ready to show.</p></div><button data-act="add" style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus" style="font-size:18px"></i>Add Property</button></div>
      ${notice ? `<div role="${notice.kind === 'error' ? 'alert' : 'status'}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding:12px 15px;border:1px solid;border-radius:13px;${noticeStyle}"><span>${esc(notice.message)}</span><button data-act="dismiss-notice" aria-label="Dismiss message" style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:inherit"><i class="ph-bold ph-x"></i></button></div>` : ''}
      <div style="display:flex;align-items:center;gap:14px;margin-top:22px;position:relative;z-index:20"><div style="position:relative"><button data-act="city-toggle" aria-expanded="${cityOpen}" style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:15px;background:#faf7ff;border:1px solid #e6ddcc;box-shadow:0 1px 2px rgba(30,28,22,.04)"><i class="ph-fill ph-map-pin" style="font-size:19px;color:#d95d1e"></i><span style="display:flex;flex-direction:column;align-items:flex-start;line-height:1.1"><span style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8d8271">Showing</span><span style="font-size:16.5px;font-weight:800;color:#241f1c">${city === 'all' ? 'All cities' : esc(city)}</span></span><i class="ph-bold ph-caret-${cityOpen ? 'up' : 'down'}" style="font-size:15px;color:#8d8271;margin-left:4px"></i></button>${cityOpen ? `<div style="position:absolute;top:calc(100% + 10px);left:0;width:440px;max-width:80vw;background:#faf7ff;border:1px solid #e6ddcc;border-radius:18px;box-shadow:0 30px 70px -26px rgba(30,28,22,.55);padding:12px;z-index:40;animation:omPop .18s ease both"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${['all', ...cities].map((value) => `<button data-act="city" data-city="${esc(value)}" style="display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-radius:11px;background:${city === value ? '#fff3d1' : 'transparent'};color:${city === value ? '#8a5a0c' : '#4c463d'};font-size:14px;font-weight:800;text-align:left">${value === 'all' ? 'All cities' : esc(value)}${city === value ? '<i class="ph-bold ph-check"></i>' : ''}</button>`).join('')}</div></div>` : ''}</div></div>
      <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;margin-top:20px">
        <div style="background:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:24px 26px;color:#1f1a12"><div style="font-size:14px;color:#8a6a14;font-weight:700">Value of stock${city === 'all' ? '' : ` in ${esc(city)}`}</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:42px;line-height:1;color:#1f1a12;margin-top:8px">${esc(formatINR(portfolio))}</div></div>
        <div style="background:#e2f2e6;border:1px solid #bedfc8;border-radius:20px;padding:24px 26px"><div style="font-size:14px;color:#41614b;font-weight:700">Ready to show</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#0b8f45;margin-top:8px">${ready.length}</div></div>
        <div style="background:#ffe6cf;border:1px solid #f8cba6;border-radius:20px;padding:24px 26px"><div style="font-size:14px;color:#6b6156;font-weight:700">Needs attention</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:44px;line-height:1;color:#b5322a;margin-top:8px">${needsAttention.length}</div></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin:30px 0 14px"><div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#5a735f">Ready to show</div><span style="font-size:12.5px;color:#8d8271">Photo · published · presentation map · Earth location</span></div>
      ${ready.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px">${ready.map(renderCard).join('')}</div>` : `<div style="padding:30px;text-align:center;color:#8d8271;font-size:15px;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No ready-to-show properties in ${city === 'all' ? 'your stock' : esc(city)} yet.</div>`}
      ${needsAttention.length ? `<div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:32px 0 12px">Needs attention</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px">${needsAttention.map(renderCard).join('')}</div>` : ''}
      ${stock.length === 0 ? `<div style="margin-top:28px;padding:34px;text-align:center;background:#faf7ff;border:1px dashed #d9cdaF;border-radius:20px"><i class="ph-fill ph-map-pin-area" style="font-size:34px;color:#8a63e8"></i><div style="font-size:18px;font-weight:800;color:#241f1c;margin-top:8px">No properties in this view</div><button data-act="add" style="margin-top:14px;padding:11px 17px;border-radius:12px;background:#ffc93c;color:#241d0c;font-weight:800">Add Property</button></div>` : ''}
    </div>`;
  };

  const replaceSavedProperty = (saved: Property): void => {
    properties = properties.map((property) => property.id === saved.id ? saved : property);
  };

  const saveProperty = async (updated: Property, successMessage: string, reopen = false): Promise<void> => {
    if (busyId) return;
    busyId = updated.id;
    menuId = null;
    notice = null;
    render();
    try {
      const result = await adapter.properties.save(updated);
      if (!result.ok) {
        notice = { kind: 'error', message: 'The property could not be saved. Your previous data is unchanged.' };
        return;
      }
      replaceSavedProperty(result.value);
      notice = { kind: 'success', message: successMessage };
    } catch {
      notice = { kind: 'error', message: 'The property could not be saved. Check your connection and try again.' };
    } finally {
      busyId = null;
      render();
      if (reopen) {
        const current = properties.find((property) => property.id === updated.id);
        if (current && notice?.kind === 'success') openDrawer(current);
      }
    }
  };

  const removeProperty = async (property: Property): Promise<void> => {
    if (busyId || !window.confirm(`Remove ${property.area || property.type} from your stock?`)) return;
    busyId = property.id;
    menuId = null;
    notice = null;
    render();
    try {
      const result = await adapter.properties.remove(property.id);
      if (!result.ok) {
        notice = { kind: 'error', message: 'The property was not removed. Your stock is unchanged.' };
        return;
      }
      properties = properties.filter((item) => item.id !== property.id);
      notice = { kind: 'success', message: 'Property removed from your active stock.' };
    } catch {
      notice = { kind: 'error', message: 'The property was not removed. Check your connection and try again.' };
    } finally {
      busyId = null;
      render();
    }
  };

  const openDrawer = (property: Property): void => {
    drawerDispose?.();
    drawerDispose = openPropertyDrawer(property, {
      onShowMap: (item) => window.location.assign(productRoutes.presentation(item.id)),
      onSendLink: (item) => window.location.assign(productRoutes.privateLink(item.id)),
      onMarkSold: (item) => window.location.assign(productRoutes.recordSale(item.id)),
      onEdit: (item) => openPropertyEditModal(item, {
        onSave: (updated) => void saveProperty(updated, 'Property details saved.', true),
      }),
      onPublishToggle: (item) => void saveProperty(
        { ...item, published: !item.published },
        item.published ? 'Property removed from Client Presentation.' : 'Property published to Client Presentation.',
      ),
      onDelete: (item) => void removeProperty(item),
    });
  };

  const addProperty = (): void => {
    let flow: AddPropertyFlow;
    flow = new AddPropertyFlow(
      [...new Set(properties.map((property) => property.city).filter(Boolean))],
      (newProperty) => {
        properties.unshift(newProperty);
        notice = { kind: 'success', message: 'Property added to your stock.' };
        flow.unmount();
        render();
      },
      () => flow.unmount(),
    );
    flow.mount(document.body);
  };

  el.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const action = target.dataset.act;
    const id = target.dataset.id;
    if (busyId && id === busyId) return;

    if (action === 'dismiss-notice') {
      notice = null;
      render();
      return;
    }
    if (action === 'city-toggle') {
      cityOpen = !cityOpen;
      render();
      return;
    }
    if (action === 'city') {
      city = target.dataset.city || 'all';
      cityOpen = false;
      menuId = null;
      render();
      return;
    }
    if (action === 'detail') {
      menuId = null;
      const property = properties.find((item) => item.id === id);
      if (property) openDrawer(property);
      return;
    }
    if (action === 'menu') {
      menuId = menuId === id ? null : id || null;
      render();
      return;
    }
    if (action === 'add') {
      addProperty();
      return;
    }
    if (!id) return;
    const property = properties.find((item) => item.id === id);
    if (!property) return;
    if (action === 'publish') {
      void saveProperty(
        { ...property, published: !property.published },
        property.published ? 'Property removed from Client Presentation.' : 'Property published to Client Presentation.',
      );
    }
    if (action === 'sold') window.location.assign(productRoutes.recordSale(property.id));
    if (action === 'remove') void removeProperty(property);
  });

  render();
  if (deepLinkId) {
    const property = properties.find((item) => item.id === deepLinkId);
    if (property) openDrawer(property);
  }
}
