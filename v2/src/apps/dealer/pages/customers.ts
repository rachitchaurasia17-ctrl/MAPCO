import { adapter } from '../../../packages/data/adapter';
import { formatINR } from '../../../packages/ui/utils';
import { productRoutes, requestedContextId } from '../../../packages/ui/product-routes';
import type { Client, ClientLink, Deal, Property } from '../../../packages/data/types';
import { listAllRecords } from '../../../packages/data/list-all';
import { AddClientFlow } from '../../../packages/ui/shared-modals';

const customersLoadingMarkup = () => '<div role="status" aria-live="polite" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#faf7ff;border:1px solid #e4dbf7;color:#6b6156;font-weight:700">Loading customers…</div>';
const customersErrorMarkup = () => '<div role="alert" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Customers could not be loaded. Please try again.</div>';

const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const values = (value: unknown): string[] => Array.isArray(value)
  ? value.flatMap((item) => typeof item === 'string' && item.trim() ? [item.trim()] : [])
  : [];
const unique = (items: readonly string[]): string[] => [...new Set(items.filter(Boolean))];
const initials = (name: unknown): string => {
  const parts = text(name).split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join('') || '?').toUpperCase();
};
const phoneHref = (phone: unknown): string | null => {
  const value = text(phone);
  if (!value || value === '—') return null;
  const safe = value.replace(/[^0-9+]/g, '');
  return safe ? `tel:${safe}` : null;
};
const whatsappHref = (phone: unknown): string | null => {
  const digits = text(phone).replace(/[^0-9]/g, '');
  return digits ? `https://wa.me/${digits}` : null;
};
const money = (deal: Deal): string => deal.fieldPresence?.soldPrice === false
  ? 'Amount not recorded'
  : formatINR(Number.isFinite(deal.soldPrice) ? deal.soldPrice : 0);

type Filter = 'all' | 'hot' | 'warm' | 'cold' | 'completed';

interface StatusMeta { label: string; style: string; }
const statusMeta = (client: Client): StatusMeta | null => {
  if (client.status === 'hot') return { label: 'Priority', style: 'background:#ffe1e6;color:#b5322a' };
  if (client.status === 'active') return { label: 'Active', style: 'background:#fff0ba;color:#9a6508' };
  if (client.status === 'cold') return { label: 'On hold', style: 'background:#eee8f4;color:#6b5b78' };
  return null;
};

export async function renderCustomers(el: HTMLElement): Promise<void> {
  el.innerHTML = customersLoadingMarkup();

  let clients: Client[] = [];
  let deals: Deal[] = [];
  let properties: Property[] = [];
  let links: ClientLink[] = [];
  let relatedDataUnavailable = false;
  let search = '';
  let filter: Filter = 'all';
  let selectedId: string | null = requestedContextId(window.location.search, 'customer');

  const safe = async <T>(request: Promise<T>): Promise<T | null> => {
    try { return await request; } catch { return null; }
  };

  const [clientResult, dealResult, propertyResult, linkResult] = await Promise.all([
    safe(listAllRecords((params, opts) => adapter.customers.list(params, opts))),
    safe(listAllRecords((params, opts) => adapter.deals.list(params, opts))),
    safe(listAllRecords((params, opts) => adapter.properties.list(params, opts))),
    safe(listAllRecords((params, opts) => adapter.clientLinks.list(params, opts))),
  ]);

  if (!clientResult?.ok) {
    el.innerHTML = customersErrorMarkup();
    return;
  }
  clients = clientResult.value;
  if (dealResult?.ok) deals = dealResult.value; else relatedDataUnavailable = true;
  if (propertyResult?.ok) properties = propertyResult.value; else relatedDataUnavailable = true;
  if (linkResult?.ok) links = linkResult.value; else relatedDataUnavailable = true;

  if (selectedId && !clients.some((client) => client.id === selectedId)) {
    const selectedResult = await safe(adapter.customers.get(selectedId));
    if (selectedResult?.ok) clients.unshift(selectedResult.value);
  }

  const dealsFor = (client: Client): Deal[] => {
    const name = text(client.name).toLocaleLowerCase();
    return deals.filter((deal) => deal.buyerId === client.id
      || (!deal.buyerId && name && text(deal.buyer).toLocaleLowerCase() === name));
  };
  const linksFor = (client: Client): ClientLink[] => links.filter((link) => link.clientId === client.id);
  const completedPurchaseCount = (client: Client): number => {
    const clientDeals = dealsFor(client);
    const propertyIds = new Set([...values(client.purchased), ...clientDeals.map((deal) => text(deal.propId)).filter(Boolean)]);
    return propertyIds.size + clientDeals.filter((deal) => !text(deal.propId)).length;
  };
  const isCompletedBuyer = (client: Client): boolean => completedPurchaseCount(client) > 0;
  const matchesFilter = (client: Client): boolean => filter === 'all'
    || (filter === 'hot' && client.status === 'hot')
    || (filter === 'warm' && client.status === 'active')
    || (filter === 'cold' && client.status === 'cold')
    || (filter === 'completed' && isCompletedBuyer(client));

  const avatar = (client: Client, size: number): string => {
    const photo = text(client.photo);
    return photo
      ? `<img src="${esc(photo)}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;background:#f0e8d8">`
      : `<span aria-hidden="true" style="width:${size}px;height:${size}px;border-radius:50%;display:grid;place-items:center;flex:none;background:#efe8fb;color:#5b32c4;font-size:${Math.max(14, Math.round(size * .27))}px;font-weight:800">${esc(initials(client.name))}</span>`;
  };

  const filterButton = (key: Filter, label: string, count: number): string => {
    const active = filter === key;
    return `<button data-act="filter" data-filter="${key}" style="display:flex;align-items:center;gap:8px;height:40px;padding:0 15px;border-radius:999px;white-space:nowrap;font-size:13.5px;font-weight:800;${active ? 'background:#ffc93c;color:#241d0c' : 'background:#f3eeff;color:#6b6156'}">${esc(label)}<span style="display:grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;font-size:11px;${active ? 'background:rgba(255,255,255,.42)' : 'background:#eadcb7'}">${count}</span></button>`;
  };

  const clientCard = (client: Client): string => {
    const requirements = text(client.want) || 'Requirement not recorded';
    const budget = text(client.budget) || 'Budget not recorded';
    const city = text(client.city);
    const status = statusMeta(client);
    const completedCount = completedPurchaseCount(client);
    const activeLinks = linksFor(client).filter((link) => link.status === 'active').length;
    const call = phoneHref(client.phone);
    return `<article data-act="detail" data-id="${esc(client.id)}" style="min-width:0;background:#faf7ff;border:1px solid #e4dbf7;border-radius:18px;padding:20px 22px;cursor:pointer;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 34px -26px rgba(30,28,22,.55)">
      <div style="display:flex;align-items:center;gap:14px">${avatar(client, 52)}<div style="flex:1;min-width:0"><div style="font-size:17.5px;font-weight:800;color:#2f2a2d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(text(client.name) || 'Name not recorded')}</div>${city ? `<div style="font-size:13.5px;color:#8d8271;margin-top:3px"><i class="ph ph-map-pin" style="font-size:14px;vertical-align:-2px"></i> ${esc(city)}</div>` : ''}</div>${status ? `<span style="display:inline-flex;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;${status.style}">${status.label}</span>` : ''}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px"><div style="background:#fff;border:1px solid #f0e2c2;border-radius:12px;padding:11px 13px"><div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8d8271">Looking for</div><div style="font-size:14.5px;font-weight:800;color:#2f2a2d;margin-top:3px">${esc(requirements)}</div></div><div style="background:#fff;border:1px solid #f0e2c2;border-radius:12px;padding:11px 13px"><div style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8d8271">Budget</div><div style="font-size:14.5px;font-weight:800;color:#c85a1a;margin-top:3px">${esc(budget)}</div></div></div>
      <div style="display:flex;align-items:center;gap:9px;margin-top:14px">${call ? `<a data-stop href="${esc(call)}" style="display:flex;align-items:center;justify-content:center;gap:7px;flex:1;height:42px;border-radius:11px;background:#12a150;color:#fff;font-size:14px;font-weight:800;text-decoration:none"><i class="ph-fill ph-phone"></i>Call</a>` : '<span style="flex:1;height:42px;border-radius:11px;background:#eee8f4;color:#8d8271;display:grid;place-items:center;font-size:13px;font-weight:700">No phone recorded</span>'}<span style="display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 12px;border-radius:11px;background:#f7e7c6;color:#4c463d;font-size:12.5px;font-weight:800"><i class="ph-fill ph-seal-check" style="color:#0b8f45"></i>${completedCount} completed</span>${activeLinks ? `<span style="display:inline-flex;align-items:center;gap:5px;height:42px;padding:0 11px;border-radius:11px;background:#e2f2e6;color:#186c3c;font-size:12.5px;font-weight:800"><i class="ph-fill ph-link"></i>${activeLinks} live</span>` : ''}</div>
    </article>`;
  };

  const propertyRow = (property: Property): string => `<a href="${esc(productRoutes.properties(property.id))}" style="display:flex;align-items:center;gap:12px;background:#fffdf8;border:1px solid #eddcbb;border-radius:13px;padding:12px 14px;text-decoration:none"><span style="width:42px;height:42px;border-radius:11px;flex:none;display:grid;place-items:center;background:${text(property.photos?.[0]) ? `url('${esc(property.photos[0])}') center/cover` : '#fff2cf'};color:#a8792a">${property.photos?.[0] ? '' : '<i class="ph-fill ph-map-pin-area" style="font-size:19px"></i>'}</span><span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:800;color:#211c17">${esc(`${text(property.type) || 'Property'}${text(property.size) ? ` · ${text(property.size)}` : ''}`)}</span><span style="display:block;font-size:12.5px;color:#7d7365;margin-top:2px">${esc(text(property.loc) || text(property.area) || text(property.city) || 'Location not recorded')}</span></span>${Number.isFinite(property.price) && property.price > 0 ? `<span style="font-size:15px;font-weight:800;color:#c85a1a;flex:none">${formatINR(property.price)}</span>` : ''}<i class="ph-bold ph-arrow-right" style="color:#a5947b"></i></a>`;

  const dealRow = (deal: Deal): string => `<a href="${esc(productRoutes.deals(deal.id))}" style="display:block;background:#fffdf8;border:1px solid #eddcbb;border-radius:15px;padding:15px 17px;text-decoration:none"><span style="display:flex;align-items:center;justify-content:space-between;gap:10px"><span style="min-width:0"><span style="display:block;font-size:15.5px;font-weight:800;color:#241f1c">${esc(text(deal.prop) || 'Property not recorded')}</span><span style="display:block;font-size:13px;color:#8a7a52;margin-top:2px">${esc(text(deal.city) || text(deal.propSub) || 'Completed sale')}</span></span><span style="font-family:'Newsreader',serif;font-weight:600;font-size:20px;color:#241f1c;white-space:nowrap">${esc(money(deal))}</span></span><span style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12.5px;font-weight:800;color:#0b6f39"><i class="ph-fill ph-seal-check"></i>Completed sale <i class="ph-bold ph-arrow-right" style="margin-left:auto;color:#a5947b"></i></span></a>`;

  const linkRow = (link: ClientLink): string => {
    const count = Number(link.propertyCount || values(link.props).length || values(link.propNames).length);
    const opens = Number(link.events?.opens ?? 0);
    const name = values(link.propNames).slice(0, 2).join(' · ') || `${count} ${count === 1 ? 'property' : 'properties'}`;
    const last = text(link.lastOpen);
    return `<div style="display:flex;align-items:center;gap:12px;background:#fffdf8;border:1px solid #eddcbb;border-radius:14px;padding:13px 15px"><span style="width:40px;height:40px;border-radius:11px;display:grid;place-items:center;flex:none;background:${link.status === 'active' ? '#d9f5e3' : '#f3eeff'};color:${link.status === 'active' ? '#0b6f39' : '#8d8271'}"><i class="ph-fill ph-link"></i></span><span style="flex:1;min-width:0"><span style="display:block;font-size:14.5px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name || 'Private link')}</span><span style="display:block;font-size:12.5px;color:#8a7a52;margin-top:2px">${esc(link.status)} · ${opens} ${opens === 1 ? 'open' : 'opens'}${last ? ` · last ${esc(last)}` : ''}</span></span>${link.audio === 'done' ? '<i class="ph-fill ph-waveform" title="Voice note attached" style="font-size:19px;color:#5b32c4"></i>' : ''}</div>`;
  };

  const detailMarkup = (client: Client): string => {
    const clientDeals = dealsFor(client);
    const clientLinks = linksFor(client);
    const purchasedIds = unique(values(client.purchased));
    const dealPropertyIds = new Set(clientDeals.map((deal) => deal.propId).filter(Boolean));
    const purchasesWithoutDeal = purchasedIds
      .filter((id) => !dealPropertyIds.has(id))
      .map((id) => properties.find((property) => property.id === id))
      .filter((property): property is Property => Boolean(property));
    const relevantIds = unique([
      ...values(client.interest),
      ...(text(client.linkedPropertyId) ? [text(client.linkedPropertyId)] : []),
    ]);
    const relevant = relevantIds
      .map((id) => properties.find((property) => property.id === id))
      .filter((property): property is Property => Boolean(property));
    const status = statusMeta(client);
    const call = phoneHref(client.phone);
    const whatsapp = whatsappHref(client.phone);
    const firstName = text(client.name).split(/\s+/)[0] || 'customer';
    const budget = text(client.budget);
    const want = text(client.want);
    const city = text(client.city);
    const note = text(client.note);
    return `<div style="position:fixed;inset:0;z-index:94;display:flex;align-items:center;justify-content:center;padding:22px"><div data-act="close" style="position:absolute;inset:0;background:rgba(26,18,12,.55)"></div><section role="dialog" aria-modal="true" aria-labelledby="pm-customer-title" style="position:relative;width:100%;max-width:1120px;height:min(820px,94vh);display:flex;flex-direction:column;background:#fdf8ee;border-radius:26px;overflow:hidden;box-shadow:0 50px 110px -34px rgba(0,0,0,.72)">
      <div style="flex:none;padding:24px 30px 22px;background:#f7ecd8;background-image:linear-gradient(140deg,#fdf6e8,#f2e2c4);border-bottom:1px solid #ece0c9"><div style="display:flex;align-items:center;gap:18px">${avatar(client, 72)}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap"><span style="font-size:11.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a07c33">Customer</span>${status ? `<span style="display:inline-flex;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:800;${status.style}">${status.label}</span>` : ''}</div><h2 id="pm-customer-title" style="margin:6px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;color:#241f1c">${esc(text(client.name) || 'Name not recorded')}</h2><div style="display:flex;align-items:center;gap:15px;flex-wrap:wrap;margin-top:8px;color:#6b5a33;font-size:14.5px;font-weight:700">${text(client.phone) ? `<span><i class="ph-fill ph-phone"></i> ${esc(client.phone)}</span>` : ''}${city ? `<span><i class="ph-fill ph-map-pin"></i> ${esc(city)}</span>` : ''}</div></div><div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end">${call ? `<a href="${esc(call)}" style="display:flex;align-items:center;gap:8px;height:44px;padding:0 17px;border-radius:12px;background:#12a150;color:#fff;font-size:14.5px;font-weight:800;text-decoration:none"><i class="ph-fill ph-phone-call"></i>Call ${esc(firstName)}</a>` : ''}${whatsapp ? `<a href="${esc(whatsapp)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border-radius:12px;background:#fff;color:#0b6f39;font-size:14.5px;font-weight:800;text-decoration:none;box-shadow:inset 0 0 0 1px #a6e3c0"><i class="ph-fill ph-whatsapp-logo"></i>WhatsApp</a>` : ''}<button data-act="close" aria-label="Close customer" style="width:44px;height:44px;border-radius:12px;background:#fff;color:#4c463d;display:grid;place-items:center;box-shadow:inset 0 0 0 1px #ddd0f5"><i class="ph-bold ph-x"></i></button></div></div></div>
      <div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr"><div data-scroll style="min-height:0;overflow-y:auto;padding:24px 26px 36px"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a07c33">What they are looking for</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><div style="background:#fffdf8;border:1px solid #eddcbb;border-radius:16px;padding:15px 17px"><div style="font-size:12px;font-weight:800;text-transform:uppercase;color:#a07c33">Budget</div><div style="font-family:'Newsreader',serif;font-weight:600;font-size:26px;color:${budget ? '#c85a1a' : '#8d8271'};margin-top:7px">${esc(budget || 'Not recorded')}</div></div><div style="background:#fffdf8;border:1px solid #eddcbb;border-radius:16px;padding:15px 17px"><div style="font-size:12px;font-weight:800;text-transform:uppercase;color:#a07c33">Requirement</div><div style="font-size:20px;font-weight:800;color:${want ? '#241f1c' : '#8d8271'};margin-top:7px">${esc(want || 'Not recorded')}</div>${city ? `<div style="font-size:13.5px;color:#8a7a52;margin-top:2px">in ${esc(city)}</div>` : ''}</div></div>${note ? `<div style="background:#f7e3c3;border:1px solid #eccf9c;border-radius:14px;padding:13px 16px;margin-top:10px;font-size:15px;color:#4a453e;line-height:1.5"><i class="ph-fill ph-note" style="color:#d95d1e;margin-right:7px"></i>${esc(note)}</div>` : '<div style="background:#fffdf8;border:1px dashed #eddcbb;border-radius:14px;padding:13px 16px;margin-top:10px;font-size:14px;color:#8d8271">No dealer note recorded.</div>'}<div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a07c33;margin:22px 0 10px">Relevant properties</div>${relevant.length ? `<div style="display:flex;flex-direction:column;gap:8px">${relevant.map(propertyRow).join('')}</div>` : '<div style="font-size:14px;color:#8d8271;background:#fffdf8;border:1px dashed #eddcbb;border-radius:14px;padding:16px 18px">No property has been connected to this customer.</div>'}</div>
      <div data-scroll style="min-height:0;overflow-y:auto;padding:24px 26px 36px;border-left:1px solid #ece0c9"><div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a07c33">Completed purchases</div>${clientDeals.length || purchasesWithoutDeal.length ? `<div style="display:flex;flex-direction:column;gap:9px;margin-top:12px">${clientDeals.map(dealRow).join('')}${purchasesWithoutDeal.map(propertyRow).join('')}</div>` : '<div style="font-size:14px;color:#8d8271;background:#fffdf8;border:1px dashed #eddcbb;border-radius:14px;padding:16px 18px;margin-top:12px">No completed purchase recorded for this customer.</div>'}<div style="font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a07c33;margin:24px 0 12px">Private links</div>${clientLinks.length ? `<div style="display:flex;flex-direction:column;gap:9px">${clientLinks.map(linkRow).join('')}</div>` : '<div style="font-size:14px;color:#8d8271;background:#fffdf8;border:1px dashed #eddcbb;border-radius:14px;padding:16px 18px">No private link sent to this customer.</div>'}${relatedDataUnavailable ? '<div role="status" style="margin-top:18px;padding:12px 14px;border-radius:12px;background:#fff4e0;border:1px solid #f4cf8f;color:#8a5a08;font-size:13px">Some related properties, completed sales or private links are temporarily unavailable.</div>' : ''}</div></div>
    </section></div>`;
  };

  const render = (): void => {
    try {
      const query = search.trim().toLocaleLowerCase();
      const visible = clients.filter((client) => matchesFilter(client) && (!query || [
        client.name, client.phone, client.city, client.want, client.budget, client.note,
      ].some((item) => text(item).toLocaleLowerCase().includes(query))));
      const selected = selectedId ? clients.find((client) => client.id === selectedId) : undefined;
      const completedCount = clients.filter(isCompletedBuyer).length;
      const activeLinkCustomers = clients.filter((client) => linksFor(client).some((link) => link.status === 'active')).length;
      el.innerHTML = `<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px"><div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap"><div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;color:#241f1c">My Customers</h1><p style="margin:8px 0 0;font-size:17px;color:#6b6156">Requirements, relevant properties, private links and completed purchases in one place.</p></div><button data-act="add" style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#ffc93c;color:#1f1a12;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(244,174,20,.85)"><i class="ph-bold ph-plus"></i>Add a customer</button></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:24px"><div style="background:#fff3d1;border:1px solid #f6e3ab;border-radius:18px;padding:19px 22px"><div style="font-size:13.5px;color:#6b6156;font-weight:700">Customers</div><div style="font-family:'Newsreader',serif;font-size:38px;color:#241f1c;margin-top:5px">${clients.length}</div></div><div style="background:#eaf7ef;border:1px solid #b8e4c8;border-radius:18px;padding:19px 22px"><div style="font-size:13.5px;color:#0b6f39;font-weight:800">Completed buyers</div><div style="font-family:'Newsreader',serif;font-size:38px;color:#0b8f45;margin-top:5px">${completedCount}</div></div><div style="background:#efe8fb;border:1px solid #ddd0f5;border-radius:18px;padding:19px 22px"><div style="font-size:13.5px;color:#5b32c4;font-weight:800">Customers with a live link</div><div style="font-family:'Newsreader',serif;font-size:38px;color:#5b32c4;margin-top:5px">${activeLinkCustomers}</div></div></div>
        <label style="display:flex;align-items:center;gap:12px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:15px;padding:15px 18px;margin:22px 0 14px"><i class="ph ph-magnifying-glass" style="font-size:21px;color:#8d8271"></i><input id="pm-client-search" value="${esc(search)}" placeholder="Search a name, phone, city or requirement…" style="border:none;outline:none;background:none;width:100%;font-size:16px;color:#241f1c"></label><div style="display:flex;align-items:center;gap:9px;margin-bottom:18px;overflow-x:auto;padding-bottom:4px">${filterButton('all', 'Everyone', clients.length)}${filterButton('hot', 'Priority', clients.filter((client) => client.status === 'hot').length)}${filterButton('warm', 'Active', clients.filter((client) => client.status === 'active').length)}${filterButton('cold', 'On hold', clients.filter((client) => client.status === 'cold').length)}${filterButton('completed', 'Completed buyers', completedCount)}</div>
        ${relatedDataUnavailable ? '<div role="status" style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#fff4e0;border:1px solid #f4cf8f;color:#8a5a08;font-size:13px">Customer records are available; some related data could not be loaded.</div>' : ''}${visible.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">${visible.map(clientCard).join('')}</div>` : '<div style="padding:40px;text-align:center;color:#8d8271;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px">No customers match these filters.</div>'}</div>${selected ? detailMarkup(selected) : ''}`;
    } catch {
      el.innerHTML = customersErrorMarkup();
    }
  };

  el.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.id !== 'pm-client-search') return;
    search = target.value;
    render();
    const input = el.querySelector<HTMLInputElement>('#pm-client-search');
    if (input) { input.focus(); input.setSelectionRange(search.length, search.length); }
  });

  el.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('[data-stop]')) { event.stopPropagation(); return; }
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const action = target.dataset.act;
    if (action === 'filter') filter = (target.dataset.filter || 'all') as Filter;
    if (action === 'detail') selectedId = target.dataset.id || null;
    if (action === 'close') selectedId = null;
    if (action === 'add') {
      let flow: AddClientFlow;
      flow = new AddClientFlow(
        (newClient) => {
          clients = [newClient, ...clients.filter((client) => client.id !== newClient.id)];
          selectedId = newClient.id;
          flow.unmount();
          render();
        },
        () => flow.unmount(),
      );
      flow.mount(document.body);
    }
    render();
  });

  render();
}
