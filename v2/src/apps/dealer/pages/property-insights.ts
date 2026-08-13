/* MAPCO V2 — factual property readiness; no synthetic views or demand. */
import { adapter } from '../../../packages/data/adapter';
import { listAllRecords } from '../../../packages/data/list-all';
import { productRoutes } from '../../../packages/ui/product-routes';
import { propertyAttentionLabel, propertyOperationalState } from '../property-operational-state';

const esc = (value: unknown): string => String(value ?? '').replace(
  /[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

export async function renderPropertyInsights(el: HTMLElement): Promise<void> {
  el.innerHTML = '<div role="status" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#faf7ff;color:#6b6156">Loading property readiness…</div>';

  let result;
  try {
    result = await listAllRecords((params, opts) => adapter.properties.list(params, opts));
  } catch {
    el.innerHTML = '<div role="alert" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Property readiness could not be loaded.</div>';
    return;
  }
  if (!result.ok) {
    el.innerHTML = '<div role="alert" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Property readiness could not be loaded.</div>';
    return;
  }

  const active = result.value.filter((property) => !property.sold);
  const assessed = active.map((property) => ({ property, state: propertyOperationalState(property) }));
  const ready = assessed.filter(({ state }) => state.readyToShow);
  const attention = assessed.filter(({ state }) => !state.readyToShow);

  const card = ({ property, state }: (typeof assessed)[number]) => {
    const reasons = state.attentionReasons.map((reason) => propertyAttentionLabel(reason));
    return `<a href="${esc(productRoutes.properties(property.id))}" style="display:flex;align-items:center;gap:14px;padding:16px;border-radius:18px;background:#fffaf0;border:1px solid #e4dbf2;color:inherit;text-decoration:none">
      <span style="width:64px;height:64px;border-radius:13px;background:#efe8fb;display:grid;place-items:center;overflow:hidden;flex:none">${state.hasDisplayPhoto ? `<img src="${esc(property.photos[0])}" alt="" style="width:100%;height:100%;object-fit:cover">` : '<i class="ph-fill ph-image" style="font-size:25px;color:#8d7bb6"></i>'}</span>
      <span style="min-width:0;flex:1"><span style="display:block;font-size:16px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(property.area || property.type)}</span><span style="display:block;margin-top:3px;font-size:13px;color:#6b6156">${esc([property.city, property.sector || property.loc, property.size].filter(Boolean).join(' · '))}</span><span style="display:block;margin-top:7px;font-size:12px;font-weight:800;color:${state.readyToShow ? '#0b8f45' : '#a65b0d'}">${state.readyToShow ? 'Ready to show' : esc(reasons.join(' · '))}</span></span>
      <i class="ph-bold ph-caret-right" style="color:#8d8271"></i>
    </a>`;
  };

  el.innerHTML = `<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap"><div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:36px;color:#241f1c">Property readiness</h1><p style="margin:8px 0 0;font-size:16px;color:#6b6156">Operational checks from your real inventory. MAPCO does not infer views, demand, or price history.</p></div><a href="${productRoutes.properties()}" style="height:46px;padding:0 18px;border-radius:13px;background:#5b32c4;color:#fff;display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-weight:800"><i class="ph-bold ph-buildings"></i>Open My Plots</a></div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:24px"><div style="padding:22px;border-radius:19px;background:#ffc93c"><div style="font-size:13px;font-weight:800;color:#7b5b08">Active stock</div><div style="font-family:'Newsreader',serif;font-size:38px;margin-top:5px">${active.length}</div></div><div style="padding:22px;border-radius:19px;background:#d9f5e3"><div style="font-size:13px;font-weight:800;color:#0b6f39">Ready to show</div><div style="font-family:'Newsreader',serif;font-size:38px;margin-top:5px">${ready.length}</div></div><div style="padding:22px;border-radius:19px;background:#fff0d8"><div style="font-size:13px;font-weight:800;color:#9b5910">Needs attention</div><div style="font-family:'Newsreader',serif;font-size:38px;margin-top:5px">${attention.length}</div></div></div>
    <h2 style="margin:30px 0 13px;font-family:'Newsreader',serif;font-size:25px;font-weight:500;color:#241f1c">${attention.length ? 'Needs attention' : 'Ready inventory'}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:13px">${(attention.length ? attention : ready).map(card).join('') || '<div style="grid-column:1/-1;padding:34px;text-align:center;border:1px dashed #d6c6f5;border-radius:18px;color:#8d8271">No active properties yet.</div>'}</div>
  </div>`;
}
