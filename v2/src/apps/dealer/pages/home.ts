import { adapter } from '../../../packages/data/adapter';
import type { ClientLink, Property } from '../../../packages/data/types';
import { listAllRecords } from '../../../packages/data/list-all';
import { productRoutes } from '../../../packages/ui/product-routes';
import { AddPropertyFlow } from '../../../packages/ui/shared-modals';
import { formatDateShort, formatINR } from '../../../packages/ui/utils';
import {
  propertyAttentionLabel,
  propertyOperationalState,
} from '../property-operational-state';

const esc = (value: unknown): string => String(value ?? '').replace(
  /[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

const errorState = (message: string): string =>
  `<div role="alert" style="max-width:1120px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446;font-size:15px;line-height:1.5">${message}</div>`;

const withTimeout = <T,>(promise: Promise<T>): Promise<T> => Promise.race([
  promise,
  new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12_000)),
]);

const href = (route: string): string => esc(route);

export async function renderHome(container: HTMLElement): Promise<void> {
  const hour = new Date().getHours();
  const greeting = hour >= 17 ? 'Good evening' : hour >= 12 ? 'Good afternoon' : 'Good morning';

  container.innerHTML = '<div role="status" aria-live="polite" style="max-width:1120px;margin:0 auto;padding:40px;color:#6b6156">Loading your dealer workspace…</div>';

  let properties: Property[] = [];
  let links: ClientLink[] = [];
  try {
    const [propertiesResult, linksResult] = await Promise.all([
      withTimeout(listAllRecords((params, opts) => adapter.properties.list(params, opts))),
      withTimeout(listAllRecords((params, opts) => adapter.clientLinks.list(params, opts))),
    ]);
    if (!propertiesResult.ok || !linksResult.ok) {
      const unauthorized = [propertiesResult, linksResult]
        .some((result) => !result.ok && result.error.code === 'unauthorized');
      container.innerHTML = unauthorized
        ? errorState('Your session has expired. <a href="?signout" style="color:#5b32c4;font-weight:800">Sign in again</a>.')
        : errorState('Your dealer workspace could not be loaded. Please refresh.');
      return;
    }
    properties = propertiesResult.value;
    links = linksResult.value;
  } catch {
    container.innerHTML = errorState('We could not reach your dealer workspace. Check your connection and refresh.');
    return;
  }

  const render = (): void => {
    const stock = properties.filter((property) => !property.sold);
    const ready = stock.filter((property) => propertyOperationalState(property).readyToShow);
    const needsAttention = stock.filter((property) => !propertyOperationalState(property).readyToShow);
    const activeLinks = links.filter((link) => link.status === 'active').length;
    const stockValue = stock.reduce((total, property) => total + (Number.isFinite(property.price) ? property.price : 0), 0);

    const summaryCard = (label: string, value: string | number, detail: string, color: string, background: string, route: string) => `
      <a href="${href(route)}" style="min-width:0;padding:20px 22px;border-radius:20px;background:${background};border:1px solid ${color}22;text-decoration:none;box-shadow:0 14px 32px -28px rgba(31,26,18,.65)">
        <div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#6b6156">${esc(label)}</div>
        <div style="font-family:'Newsreader',serif;font-size:39px;font-weight:550;line-height:1;color:${color};margin-top:8px">${esc(value)}</div>
        <div style="font-size:13px;color:#6b6156;margin-top:6px">${esc(detail)}</div>
      </a>`;

    const readyCard = (property: Property) => {
      const state = propertyOperationalState(property);
      const image = property.photos?.[0];
      return `<a href="${href(productRoutes.properties(property.id))}" style="display:flex;align-items:center;gap:13px;min-width:0;padding:12px;border:1px solid #e4dbf7;border-radius:16px;background:#faf7ff;text-decoration:none">
        <span style="width:78px;height:68px;border-radius:12px;overflow:hidden;display:grid;place-items:center;flex:none;background:#efe8fb;color:#6b3fd4">${image ? `<img src="${esc(image)}" alt="" style="width:100%;height:100%;object-fit:cover">` : '<i class="ph-fill ph-image" style="font-size:25px"></i>'}</span>
        <span style="min-width:0;flex:1"><span style="display:block;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#0b8f45">Ready to show</span><span style="display:block;margin-top:3px;font-size:16px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(property.area || property.type)}</span><span style="display:block;margin-top:2px;font-size:13px;color:#6b6156;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(property.size)} · ${esc(property.loc || property.city)} · ${state.photoCount} photo${state.photoCount === 1 ? '' : 's'}</span></span>
        <i class="ph-bold ph-caret-right" style="font-size:16px;color:#9a8eb4;flex:none"></i>
      </a>`;
    };

    const attentionRow = (property: Property) => {
      const state = propertyOperationalState(property);
      return `<a href="${href(productRoutes.properties(property.id))}" style="display:flex;align-items:center;gap:13px;padding:14px 15px;border-bottom:1px solid #eee6d4;text-decoration:none">
        <span style="width:40px;height:40px;border-radius:12px;background:#fff3d1;color:#a8600c;display:grid;place-items:center;flex:none"><i class="ph-fill ph-wrench" style="font-size:19px"></i></span>
        <span style="min-width:0;flex:1"><span style="display:block;font-size:15px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(property.area || property.type)}</span><span style="display:block;margin-top:3px;font-size:12.5px;color:#8d8271;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${state.attentionReasons.map(propertyAttentionLabel).map(esc).join(' · ')}</span></span>
        <span style="font-size:12px;font-weight:800;color:#8a6a14;white-space:nowrap">Continue setup</span>
      </a>`;
    };

    container.innerHTML = `<div style="max-width:1120px;margin:0 auto;padding:30px 40px 70px">
      <section style="border-radius:28px;padding:32px 34px;background:linear-gradient(140deg,#3a2f14 0%,#241d0c 60%,#150f04 100%);box-shadow:0 26px 60px -34px rgba(20,14,2,.95);animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap">
          <div style="min-width:260px;flex:1">
            <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c9a94a">${esc(formatDateShort())}</div>
            <h1 style="margin:8px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:40px;letter-spacing:-.02em;color:#fff8e6">${esc(greeting)}.</h1>
            <p style="margin:8px 0 0;font-size:17px;color:#c9b48a">Your property work, ready for the next customer conversation.</p>
          </div>
          <a href="${href(productRoutes.presentation())}" style="display:flex;align-items:center;gap:11px;height:58px;padding:0 23px;border-radius:16px;background:#ffc93c;color:#241d0c;font-size:17px;font-weight:800;text-decoration:none;box-shadow:0 16px 34px -16px rgba(244,174,20,.95)"><i class="ph-fill ph-presentation-chart" style="font-size:21px"></i>Start Client Presentation</a>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:26px">
          <a href="${href(productRoutes.earth())}" style="display:flex;align-items:center;gap:13px;min-height:72px;padding:13px 17px;border-radius:16px;background:#6b3fd4;color:#fff;text-decoration:none"><span style="width:42px;height:42px;border-radius:12px;background:#825be0;display:grid;place-items:center"><i class="ph-fill ph-globe-hemisphere-west" style="font-size:22px"></i></span><span><strong style="display:block;font-size:15px">Open MAPCO Earth</strong><small style="display:block;margin-top:2px;color:#ded0fa;font-size:12px">See your located properties</small></span></a>
          <button data-home-action="add-property" style="display:flex;align-items:center;gap:13px;min-height:72px;padding:13px 17px;border-radius:16px;background:#fff3d1;color:#241d0c;text-align:left"><span style="width:42px;height:42px;border-radius:12px;background:#ffc93c;display:grid;place-items:center"><i class="ph-bold ph-plus" style="font-size:20px"></i></span><span><strong style="display:block;font-size:15px">Add Property</strong><small style="display:block;margin-top:2px;color:#8a6a14;font-size:12px">Add it once to your stock</small></span></button>
          <a href="${href(productRoutes.properties())}" style="display:flex;align-items:center;gap:13px;min-height:72px;padding:13px 17px;border-radius:16px;background:rgba(255,255,255,.1);color:#fff8e6;text-decoration:none;border:1px solid rgba(255,255,255,.12)"><span style="width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.12);display:grid;place-items:center"><i class="ph-fill ph-map-pin-area" style="font-size:22px"></i></span><span><strong style="display:block;font-size:15px">My Stock</strong><small style="display:block;margin-top:2px;color:#c9b48a;font-size:12px">${stock.length} active propert${stock.length === 1 ? 'y' : 'ies'}</small></span></a>
        </div>
      </section>

      <section aria-label="Dealer operation summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:20px;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:.04s">
        ${summaryCard('My Stock', stock.length, formatINR(stockValue), '#c85a1a', '#fff3d1', productRoutes.properties())}
        ${summaryCard('Ready to Show', ready.length, 'Complete property records', '#0b8f45', '#e2f2e6', productRoutes.properties())}
        ${summaryCard('Needs Attention', needsAttention.length, 'Real setup gaps to finish', '#b5322a', '#ffe6cf', productRoutes.properties())}
        ${summaryCard('Active Private Links', activeLinks, 'Current client-link access', '#5b32c4', '#efe8fb', productRoutes.privateLink())}
      </section>

      <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:18px;margin-top:26px;align-items:start">
        <section style="min-width:0">
          <div style="display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:12px"><div><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#0b8f45">My Stock</div><h2 style="margin:4px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:28px;color:#241f1c">Ready to show</h2></div><a href="${href(productRoutes.properties())}" style="font-size:13px;font-weight:800;color:#5b32c4;text-decoration:none">View all properties</a></div>
          ${ready.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:10px">${ready.slice(0, 4).map(readyCard).join('')}</div>` : '<div style="padding:28px;border:1px dashed #d8caa8;border-radius:18px;background:#faf7ff;color:#6b6156;font-size:14px">No property is fully ready yet. Finish the real setup items shown beside it—photos, publishing, map placement and Earth location.</div>'}
        </section>

        <section style="min-width:0;background:#fffaf0;border:1px solid #e8ddc6;border-radius:20px;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 18px 12px"><div><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a8600c">Action list</div><h2 style="margin:4px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:25px;color:#241f1c">Needs attention</h2></div><span style="min-width:32px;height:32px;padding:0 9px;border-radius:999px;background:#ffe6cf;color:#b5322a;display:grid;place-items:center;font-weight:800">${needsAttention.length}</span></div>
          ${needsAttention.length ? needsAttention.slice(0, 5).map(attentionRow).join('') : '<div style="padding:18px;color:#0b6f39;font-size:14px">Every active property has its photo, presentation publishing, map placement and Earth location.</div>'}
          ${needsAttention.length > 5 ? `<a href="${href(productRoutes.properties())}" style="display:block;padding:14px 18px;text-align:center;font-size:13px;font-weight:800;color:#5b32c4;text-decoration:none">See all ${needsAttention.length}</a>` : ''}
        </section>
      </div>

      <nav aria-label="Workspace shortcuts" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:28px">
        <a href="${href(productRoutes.customers())}" style="padding:17px 18px;border-radius:16px;background:#faf7ff;border:1px solid #e4dbf7;color:#4c463d;text-decoration:none;font-weight:800"><i class="ph-fill ph-users-three" style="color:#6b3fd4;margin-right:8px"></i>Customers</a>
        <a href="${href(productRoutes.deals())}" style="padding:17px 18px;border-radius:16px;background:#faf7ff;border:1px solid #e4dbf7;color:#4c463d;text-decoration:none;font-weight:800"><i class="ph-fill ph-seal-check" style="color:#6b3fd4;margin-right:8px"></i>Completed Sales</a>
        <a href="${href(productRoutes.privateLink())}" style="padding:17px 18px;border-radius:16px;background:#faf7ff;border:1px solid #e4dbf7;color:#4c463d;text-decoration:none;font-weight:800"><i class="ph-fill ph-paper-plane-tilt" style="color:#6b3fd4;margin-right:8px"></i>Private Client Links</a>
      </nav>
    </div>`;
  };

  container.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-home-action]')?.dataset.homeAction;
    if (action !== 'add-property') return;
    let flow: AddPropertyFlow;
    flow = new AddPropertyFlow(
      [...new Set(properties.map((property) => property.city).filter(Boolean))],
      (property) => {
        properties.unshift(property);
        flow.unmount();
        render();
      },
      () => flow.unmount(),
    );
    flow.mount(document.body);
  });

  render();
}
