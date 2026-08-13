/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — My Deals (COMPLETED-SALES REGISTER)
   ---------------------------------------------------------------
   A Deal is a completed property transaction — never a negotiation
   pipeline. Ongoing buyer follow-ups stay in Customers. A Deal is
   created only through "Record Completed Sale", a step-by-step flow
   that ends in one atomic transaction (property→Sold, deal created,
   buyer history updated). All buyer/seller/price/commission/document
   data here is dealer-private and never leaves for a client link.
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../../packages/data/adapter';
import { formatINR } from '../../../packages/ui/utils';
import { productRoutes, requestedAction, requestedContextId } from '../../../packages/ui/product-routes';
import type { Deal, Property, Client } from '../../../packages/data/types';
import type { RecordSaleInput } from '../../../packages/data/contracts';
import { listAllRecords } from '../../../packages/data/list-all';

const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const recorded = (deal: Deal, key: keyof NonNullable<Deal['fieldPresence']>): boolean => deal.fieldPresence?.[key] !== false;
const recordedMoney = (deal: Deal, key: 'soldPrice' | 'brokerage' | 'commission' | 'paymentReceived', value: number): string =>
  recorded(deal, key) && Number.isFinite(value) ? formatINR(value) : 'Not recorded';
const safeDocumentUrl = (value: unknown): string | null => {
  const url = text(value);
  return /^https:\/\//i.test(url) || url.startsWith('/') ? url : null;
};
const safePhoneHref = (value: unknown): string | null => {
  const phone = text(value).replace(/[^0-9+]/g, '');
  return phone ? `tel:${phone}` : null;
};
const customerInitial = (value: unknown): string => (text(value).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('') || '?').toUpperCase();

const dealsLoadingMarkup = () => '<div role="status" aria-live="polite" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#faf7ff;border:1px solid #e4dbf7;color:#6b6156;font-weight:700">Loading completed sales…</div>';
const dealsErrorMarkup = () => '<div role="alert" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">Deals could not be loaded. Please try again.</div>';

/** ISO yyyy-mm-dd → "18 Jun 2026" (never fabricates a date). */
const fmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

type Range = 'all' | 'month' | 'year';
type CommFilter = 'all' | 'received' | 'pending';
type Sort = 'recent' | 'highest';

interface Draft {
  propertyId: string;
  buyerId: string;
  addingBuyer: boolean;
  newBuyer: { name: string; phone: string; city: string };
  seller: string;
  sellerPhone: string;
  soldPrice: number;
  saleDate: string;
  registrationDate: string;
  brokerage?: number;
  commission?: number;
  commissionReceived: boolean;
  paymentReceived?: number;
  documents: { name: string; kind?: string }[];
}

const STEP_TITLES = [
  'Select the sold property',
  'Who bought it?',
  'Confirm the seller',
  'Sale price & dates',
  'Brokerage & commission',
  'Documents (optional)',
  'Review & confirm',
];

export async function renderDeals(el: HTMLElement): Promise<void> {
  el.innerHTML = dealsLoadingMarkup();
  let deals: Deal[] = [];
  let properties: Property[] = [];
  let customers: Client[] = [];

  let search = '';
  let range: Range = 'all';
  let comm: CommFilter = 'all';
  let sort: Sort = 'recent';
  let cityFilter = '';
  let selectedId: string | null = requestedContextId(window.location.search, 'deal');

  // ── record-completed-sale flow state ──────────────────────────
  let flowOpen = requestedAction(window.location.search, 'record');
  let step = 1;
  let recording = false;
  let flowError = '';
  const draft: Draft = {
    propertyId: requestedContextId(window.location.search, 'property') ?? '', buyerId: '', addingBuyer: false,
    newBuyer: { name: '', phone: '', city: '' },
    seller: '', sellerPhone: '', soldPrice: 0, saleDate: '', registrationDate: '',
    brokerage: undefined, commission: undefined, commissionReceived: false, paymentReceived: undefined, documents: [],
  };

  let loaded;
  try {
    loaded = await Promise.all([
      listAllRecords((params, opts) => adapter.deals.list(params, opts)),
      listAllRecords((params, opts) => adapter.properties.list(params, opts)),
      listAllRecords((params, opts) => adapter.customers.list(params, opts)),
    ]);
  } catch {
    el.innerHTML = dealsErrorMarkup();
    return;
  }
  const [dealsRes, propsRes, custRes] = loaded;
  if (!dealsRes.ok) {
    el.innerHTML = dealsErrorMarkup();
    return;
  }
  deals = dealsRes.value;
  if (propsRes.ok) properties = propsRes.value;
  if (custRes.ok) customers = custRes.value;

  // A stable product handoff may target a completed sale/property outside the
  // first list page. Resolve that exact ID through the active adapter instead
  // of dropping the context or copying data into the URL.
  if (selectedId && !deals.some((deal) => deal.id === selectedId)) {
    try {
      const selectedResult = await adapter.deals.get(selectedId);
      if (selectedResult.ok) deals.unshift(selectedResult.value);
    } catch { /* the register remains usable without the requested detail */ }
  }
  if (draft.propertyId && !properties.some((property) => property.id === draft.propertyId)) {
    try {
      const propertyResult = await adapter.properties.get(draft.propertyId);
      if (propertyResult.ok) properties.unshift(propertyResult.value);
    } catch { /* the flow will show the regular available-property list */ }
  }

  const availableProperties = () => properties.filter((p) => !p.sold);
  const selectedProperty = () => properties.find((p) => p.id === draft.propertyId);
  const selectedBuyer = () => customers.find((c) => c.id === draft.buyerId);

  /* ── filtering ─────────────────────────────────────────────── */
  const filteredDeals = (): Deal[] => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const inRange = (d: Deal): boolean => {
      if (range === 'all') return true;
      if (!recorded(d, 'soldDate') || !text(d.soldDate)) return false;
      const dt = new Date(`${text(d.soldDate)}T00:00:00`);
      if (Number.isNaN(dt.getTime())) return false;
      if (range === 'year') return dt.getFullYear() === now.getFullYear();
      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
    };
    let list = deals.filter((d) =>
      (!q || `${text(d.prop)} ${text(d.buyer)} ${text(d.seller)} ${text(d.city)} ${text(d.sector)}`.toLowerCase().includes(q))
      && inRange(d)
      && (comm === 'all' || (recorded(d, 'commissionReceived') && (comm === 'received' ? d.commissionReceived : !d.commissionReceived)))
      && (!cityFilter || d.city === cityFilter));
    list = [...list].sort((a, b) => sort === 'highest'
      ? (recorded(b, 'soldPrice') ? b.soldPrice : -1) - (recorded(a, 'soldPrice') ? a.soldPrice : -1)
      : text(b.soldDate).localeCompare(text(a.soldDate)));
    return list;
  };

  /* ── deal card ─────────────────────────────────────────────── */
  const commissionSummary = (d: Deal): { label: string; color: string; icon: string } => {
    if (!recorded(d, 'commission') || !Number.isFinite(d.commission)) {
      return { label: 'Commission not recorded', color: '#8d8271', icon: 'ph-minus-circle' };
    }
    const amount = formatINR(d.commission);
    if (!recorded(d, 'commissionReceived')) {
      return { label: `${amount} · status not recorded`, color: '#8d8271', icon: 'ph-question' };
    }
    return d.commissionReceived
      ? { label: `${amount} received`, color: '#0b8f45', icon: 'ph-coins' }
      : { label: `${amount} pending`, color: '#b06f0c', icon: 'ph-hourglass-medium' };
  };

  const dealCard = (d: Deal) => {
    const commission = commissionSummary(d);
    const location = [text(d.city), text(d.sector)].filter(Boolean).join(' · ');
    const completedAt = text(d.registrationDate) || text(d.soldDate);
    return `<button data-act="open" data-id="${esc(d.id)}" style="width:100%;text-align:left;background:#faf7ff;border:1.5px solid #e4dbf7;border-radius:18px;padding:18px 20px;cursor:pointer;transition:transform .14s,border-color .12s;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 34px -26px rgba(30,28,22,.6)">
    <div style="display:flex;align-items:flex-start;gap:14px">
      <span style="width:48px;height:48px;border-radius:13px;flex:none;display:grid;place-items:center;background:#d9f5e3;color:#0b6f39"><i class="ph-fill ph-seal-check" style="font-size:24px"></i></span>
      <div style="flex:1;min-width:0">
        <div style="font-size:16.5px;font-weight:800;color:#2f2a2d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(text(d.prop) || 'Property not recorded')}</div>
        ${location ? `<div style="font-size:13px;color:#8d8271;margin-top:1px"><i class="ph ph-map-pin" style="font-size:13px;vertical-align:-1px"></i> ${esc(location)}</div>` : ''}
      </div>
      <span style="font-family:'Newsreader',serif;font-weight:600;font-size:21px;color:${recorded(d, 'soldPrice') ? '#241f1c' : '#8d8271'};flex:none">${esc(recordedMoney(d, 'soldPrice', d.soldPrice))}</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">
      <span style="display:inline-flex;align-items:center;gap:6px;background:#eef4ff;color:#1a56c4;border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:700"><i class="ph-fill ph-user"></i>${esc(text(d.buyer) || 'Buyer not recorded')}</span>
      ${completedAt ? `<span style="display:inline-flex;align-items:center;gap:6px;background:#f6efe0;color:#8a6a14;border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:700"><i class="ph-fill ph-calendar-check"></i>${fmtDate(completedAt)}</span>` : ''}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid #efe6d0">
      <span style="display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;color:${commission.color}"><i class="ph-fill ${commission.icon}" style="font-size:15px"></i>${esc(commission.label)}</span>
      <span style="font-size:12.5px;color:#0b6f39;font-weight:800">Completed</span>
    </div>
  </button>`;
  };

  /* ── filter bar ────────────────────────────────────────────── */
  const chip = (active: boolean, act: string, extra: string, label: string) =>
    `<button data-act="${act}" ${extra} style="height:38px;padding:0 15px;border-radius:999px;font-size:13px;font-weight:800;white-space:nowrap;cursor:pointer;${active ? 'background:#ffc93c;color:#241d0c' : 'background:#faf7ff;border:1px solid #e4dbf7;color:#6b6156'}">${esc(label)}</button>`;

  const filterBar = () => {
    const cities = [...new Set(deals.map((d) => d.city).filter(Boolean))].sort();
    return `<div style="display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:20px 0 6px">
      ${chip(range === 'all', 'range', 'data-range="all"', 'All Deals')}
      ${chip(range === 'month', 'range', 'data-range="month"', 'This Month')}
      ${chip(range === 'year', 'range', 'data-range="year"', 'This Year')}
      ${chip(sort === 'highest', 'sort', `data-sort="${sort === 'highest' ? 'recent' : 'highest'}"`, 'Highest Value')}
      ${chip(comm === 'received', 'comm', `data-comm="${comm === 'received' ? 'all' : 'received'}"`, 'Commission Received')}
      ${chip(comm === 'pending', 'comm', `data-comm="${comm === 'pending' ? 'all' : 'pending'}"`, 'Commission Pending')}
      <select data-act="city" style="height:38px;border:1px solid #e4dbf7;border-radius:999px;padding:0 14px;font:inherit;font-size:13px;font-weight:700;color:#4c463d;background:#faf7ff">
        <option value=""${cityFilter === '' ? ' selected' : ''}>All cities</option>
        ${cities.map((c) => `<option value="${esc(c)}"${cityFilter === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
    </div>`;
  };

  /* ── deal detail (8 sections) ──────────────────────────────── */
  const section = (title: string, icon: string, body: string) => `<div style="margin-top:16px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:18px;padding:18px 20px">
    <div style="display:flex;align-items:center;gap:9px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8d8271;margin-bottom:12px"><i class="${icon}" style="font-size:15px;color:#5b32c4"></i>${esc(title)}</div>${body}</div>`;
  const kv = (k: string, v: string) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;font-size:14.5px"><span style="color:#8d8271">${esc(k)}</span><span style="font-weight:700;color:#241f1c;text-align:right">${v}</span></div>`;

  /** Render dealer-private sale detail without assuming a legacy row is complete. */
  const safeDetailMarkup = (d: Deal): string => {
    const documents = Array.isArray(d.documents) ? d.documents : [];
    const timeline = Array.isArray(d.timeline) ? d.timeline : [];
    const soldKnown = recorded(d, 'soldPrice') && Number.isFinite(d.soldPrice);
    const paymentKnown = recorded(d, 'paymentReceived') && Number.isFinite(d.paymentReceived);
    const commission = commissionSummary(d);
    const sellerPhone = safePhoneHref(d.sellerPhone);
    const soldDate = recorded(d, 'soldDate') ? text(d.soldDate) : '';
    const location = [text(d.city), text(d.sector)].filter(Boolean).join(' · ');
    const paymentBody = soldKnown && paymentKnown
      ? (() => {
          const paidPct = d.soldPrice > 0 ? Math.min(100, Math.max(0, Math.round((d.paymentReceived / d.soldPrice) * 100))) : 0;
          const outstanding = Math.max(0, d.soldPrice - d.paymentReceived);
          return kv('Received', formatINR(d.paymentReceived))
            + kv('Outstanding', formatINR(outstanding))
            + `<div style="height:8px;border-radius:999px;background:#efe6d0;margin-top:10px;overflow:hidden"><div style="height:100%;width:${paidPct}%;background:#12a150"></div></div><div style="font-size:12px;color:#8d8271;margin-top:5px">${paidPct}% collected</div>`;
        })()
      : '<div style="font-size:14px;color:#8d8271">Payment information was not recorded on this sale.</div>';
    const documentBody = recorded(d, 'documents')
      ? documents.length
        ? `<div style="display:flex;flex-direction:column;gap:8px">${documents.map((doc) => {
            const url = safeDocumentUrl(doc?.url);
            const content = `<i class="ph-fill ph-file-text" style="font-size:19px;color:#5b32c4"></i><span style="flex:1;font-size:14px;font-weight:700;color:#241f1c">${esc(text(doc?.name) || 'Document')}</span>${text(doc?.kind) ? `<span style="font-size:11px;font-weight:800;text-transform:uppercase;color:#8d8271">${esc(doc.kind)}</span>` : ''}`;
            return url
              ? `<a href="${esc(url)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #efe6d0;border-radius:11px;padding:11px 13px;text-decoration:none">${content}<i class="ph-bold ph-arrow-square-out" style="color:#8d8271"></i></a>`
              : `<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #efe6d0;border-radius:11px;padding:11px 13px">${content}</div>`;
          }).join('')}</div>`
        : '<div style="font-size:14px;color:#8d8271">No documents attached.</div>'
      : '<div style="font-size:14px;color:#8d8271">Document information was not recorded on this legacy sale.</div>';
    const timelineBody = timeline.length
      ? `<div style="display:flex;flex-direction:column">${timeline.map((entry, index) => `<div style="display:flex;gap:12px"><div style="display:flex;flex-direction:column;align-items:center"><span style="width:12px;height:12px;border-radius:50%;background:#5b32c4;flex:none;margin-top:4px"></span>${index < timeline.length - 1 ? '<span style="width:2px;flex:1;background:#e4dbf7"></span>' : ''}</div><div style="padding-bottom:14px"><div style="font-size:14.5px;font-weight:700;color:#241f1c">${esc(text(entry?.label) || 'Completed sale update')}</div>${text(entry?.at) ? `<div style="font-size:12.5px;color:#8d8271">${fmtDate(entry.at)}</div>` : ''}</div></div>`).join('')}</div>`
      : '<div style="font-size:14px;color:#8d8271">No completion timeline recorded.</div>';
    const propertyBody = kv('Plot', esc(text(d.prop) || 'Not recorded'))
      + (location ? kv('City · Sector', esc(location)) : '')
      + (text(d.propSub) ? kv('Details', esc(d.propSub)) : '')
      + (text(d.propId) ? `<a href="${esc(productRoutes.properties(d.propId))}" style="margin-top:8px;height:42px;border-radius:11px;background:#fff2cf;color:#6b4a08;font-weight:800;font-size:14px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-fill ph-arrow-square-out"></i>Open property</a>` : '');
    const buyerBody = kv('Name', esc(text(d.buyer) || 'Not recorded'))
      + (text(d.buyerId) ? `<a href="${esc(productRoutes.customers(d.buyerId))}" style="margin-top:8px;height:42px;border-radius:11px;background:#eef4ff;color:#1a56c4;font-weight:800;font-size:14px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph-fill ph-arrow-square-out"></i>Open customer</a>` : '');
    const sellerBody = kv('Name', esc(text(d.seller) || 'Not recorded'))
      + (sellerPhone ? `<a href="${esc(sellerPhone)}" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;height:42px;border-radius:11px;background:#12a150;color:#fff;font-weight:800;font-size:14px;text-decoration:none"><i class="ph-fill ph-phone"></i>Call seller</a>` : '');
    const transactionBody = kv('Final amount', esc(recordedMoney(d, 'soldPrice', d.soldPrice)))
      + kv('Sale date', soldDate ? fmtDate(soldDate) : 'Not recorded')
      + (text(d.registrationDate) ? kv('Registration date', fmtDate(d.registrationDate)) : '');
    const brokerageBody = kv('Total brokerage', esc(recordedMoney(d, 'brokerage', d.brokerage)))
      + kv('Your commission', esc(recordedMoney(d, 'commission', d.commission)))
      + kv('Status', recorded(d, 'commissionReceived')
        ? d.commissionReceived ? '<span style="color:#0b8f45">Received</span>' : '<span style="color:#b06f0c">Pending</span>'
        : '<span style="color:#8d8271">Not recorded</span>');

    return `<div data-overlay style="position:fixed;inset:0;background:rgba(28,20,5,.32);backdrop-filter:blur(3px);z-index:90;display:flex;justify-content:flex-end"><section role="dialog" aria-modal="true" aria-labelledby="pm-deal-title" style="width:min(560px,96vw);height:100%;background:#fffaf0;box-shadow:-26px 0 70px -34px rgba(20,14,2,.75);display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:14px;padding:22px 24px;border-bottom:1px solid #f0dfb8"><span style="width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:#d9f5e3;color:#0b6f39"><i class="ph-fill ph-seal-check" style="font-size:23px"></i></span><div style="flex:1;min-width:0"><h2 id="pm-deal-title" style="margin:0;font-family:'Newsreader',serif;font-size:25px;font-weight:500;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(text(d.prop) || 'Completed sale')}</h2><p style="margin:3px 0 0;color:#8d8271;font-size:14px">Completed sale${soldDate ? ` · ${fmtDate(soldDate)}` : ''}</p></div><button data-act="close" aria-label="Close deal" style="width:42px;height:42px;border-radius:12px;background:#f3eeff;color:#6b6156"><i class="ph-bold ph-x"></i></button></div>
      <div data-scroll style="padding:22px 24px 26px;overflow-y:auto;flex:1"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="border-radius:18px;padding:18px;background:#ffc93c"><div style="font-size:12px;font-weight:800;color:#8a6a14;text-transform:uppercase">Final sold price</div><div style="font-family:'Newsreader',serif;font-size:28px;font-weight:600;margin-top:4px">${esc(recordedMoney(d, 'soldPrice', d.soldPrice))}</div></div><div style="border-radius:18px;padding:18px;background:#d9f5e3"><div style="font-size:12px;font-weight:800;color:#0b6f39;text-transform:uppercase">Commission</div><div style="font-size:17px;font-weight:800;color:${commission.color};margin-top:8px">${esc(commission.label)}</div></div></div>
        ${section('Sold property', 'ph-fill ph-buildings', propertyBody)}${section('Buyer', 'ph-fill ph-user', buyerBody)}${section('Seller (private)', 'ph-fill ph-user-focus', sellerBody)}${section('Transaction', 'ph-fill ph-receipt', transactionBody)}${section('Payment summary', 'ph-fill ph-wallet', paymentBody)}${section('Brokerage & commission', 'ph-fill ph-coins', brokerageBody)}${section('Documents', 'ph-fill ph-files', documentBody)}${section('Completion timeline', 'ph-fill ph-clock-counter-clockwise', timelineBody)}
      </div><div style="padding:16px 24px;border-top:1px solid #f0dfb8"><button data-act="close" style="width:100%;height:48px;border-radius:13px;background:#241d0c;color:#fff8e6;font-size:15px;font-weight:800">Done</button></div></section></div>`;
  };

  /* ── Record Completed Sale flow ────────────────────────────── */
  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return !!draft.propertyId;
      case 2: return draft.addingBuyer ? !!draft.newBuyer.name.trim() : !!draft.buyerId;
      case 3: return true; // seller identity is private and optional
      case 4: return draft.soldPrice > 0 && !!draft.saleDate;
      default: return true;
    }
  };

  const advanceError = (): string => {
    if (step === 1) return 'Choose the property that was sold.';
    if (step === 2) return draft.addingBuyer ? 'Enter the buyer name.' : 'Choose or add the buyer.';
    if (step === 4) return 'Enter the final sold price and sale date.';
    return '';
  };

  const fieldInput = (name: string, label: string, value: string, type = 'text', extra = '') =>
    `<label style="display:block;font-size:13px;font-weight:800;color:#6b6156">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${extra} style="display:block;width:100%;height:50px;margin-top:7px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:16px"></label>`;

  const stepBody = (): string => {
    const p = selectedProperty();
    switch (step) {
      case 1: {
        const avail = availableProperties();
        if (!avail.length) return '<div style="padding:30px;text-align:center;color:#8d8271;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:16px">No available property to sell. Every plot is already sold.</div>';
        return `<div data-scroll style="display:flex;flex-direction:column;gap:9px;max-height:52vh;overflow-y:auto">${avail.map((prop) => `<button type="button" data-act="pick-prop" data-id="${esc(prop.id)}" style="display:flex;align-items:center;gap:13px;padding:13px;border-radius:14px;text-align:left;cursor:pointer;border:1.5px solid ${draft.propertyId === prop.id ? '#12a150' : '#e6cf9a'};background:${draft.propertyId === prop.id ? '#edfbf2' : '#fff'}"><span style="width:46px;height:46px;border-radius:11px;flex:none;background:#f4eeff url('${esc(prop.photos[0] ?? '')}') center/cover;display:grid;place-items:center;color:#5b32c4">${prop.photos.length ? '' : '<i class="ph-fill ph-image" style="font-size:20px"></i>'}</span><span style="flex:1;min-width:0"><span style="display:block;font-size:15.5px;font-weight:800;color:#241f1c">${esc(prop.area)}</span><span style="display:block;font-size:13px;color:#8d8271">${esc(prop.city)} · ${esc(prop.size)} · ${esc(prop.facing)}</span></span><span style="font-weight:800;color:#c85a1a;flex:none">${formatINR(prop.price)}</span>${draft.propertyId === prop.id ? '<i class="ph-fill ph-check-circle" style="font-size:22px;color:#12a150;flex:none"></i>' : ''}</button>`).join('')}</div>`;
      }
      case 2: {
        if (draft.addingBuyer) {
          return `<div style="display:flex;flex-direction:column;gap:14px">
            ${fieldInput('nb-name', 'Buyer name', draft.newBuyer.name, 'text', 'required')}
            ${fieldInput('nb-phone', 'Phone', draft.newBuyer.phone, 'tel')}
            ${fieldInput('nb-city', 'City', draft.newBuyer.city)}
            <button type="button" data-act="cancel-newbuyer" style="align-self:flex-start;height:40px;padding:0 16px;border-radius:11px;background:#f3eeff;color:#4c463d;font-weight:800;cursor:pointer"><i class="ph-bold ph-arrow-left"></i> Choose existing instead</button>
          </div>`;
        }
        return `<div style="display:flex;flex-direction:column;gap:9px">
          <button type="button" data-act="add-newbuyer" style="display:flex;align-items:center;gap:10px;padding:13px;border-radius:14px;border:1.5px dashed #b79cf0;background:#f7f3ff;color:#5b32c4;font-weight:800;cursor:pointer"><i class="ph-bold ph-plus-circle" style="font-size:20px"></i>Add a new buyer</button>
          <div data-scroll style="display:flex;flex-direction:column;gap:9px;max-height:44vh;overflow-y:auto">${customers.map((c) => {
            const contact = [text(c.phone), text(c.city)].filter(Boolean).join(' · ');
            return `<button type="button" data-act="pick-buyer" data-id="${esc(c.id)}" style="display:flex;align-items:center;gap:12px;padding:13px;border-radius:14px;text-align:left;cursor:pointer;border:1.5px solid ${draft.buyerId === c.id ? '#1a56c4' : '#e6cf9a'};background:${draft.buyerId === c.id ? '#eef4ff' : '#fff'}"><span style="width:42px;height:42px;border-radius:50%;flex:none;background:#eef4ff;color:#1a56c4;display:grid;place-items:center;font-weight:800">${esc(customerInitial(c.name))}</span><span style="flex:1;min-width:0"><span style="display:block;font-size:15px;font-weight:800;color:#241f1c">${esc(text(c.name) || 'Name not recorded')}</span>${contact ? `<span style="display:block;font-size:13px;color:#8d8271">${esc(contact)}</span>` : ''}</span>${draft.buyerId === c.id ? '<i class="ph-fill ph-check-circle" style="font-size:22px;color:#1a56c4;flex:none"></i>' : ''}</button>`;
          }).join('')}</div>
        </div>`;
      }
      case 3:
        return `<div style="display:flex;flex-direction:column;gap:14px">
          <div style="font-size:14px;color:#6b6156;background:#f6efe0;border:1px solid #ece0c9;border-radius:12px;padding:13px 15px">Confirm the seller for <b>${esc(p?.area ?? 'this property')}</b>. Seller details stay private and never appear in a client link. Leave them blank to skip.</div>
          ${fieldInput('seller', 'Seller name (optional)', draft.seller)}
          ${fieldInput('sellerPhone', 'Seller phone (optional)', draft.sellerPhone, 'tel')}
        </div>`;
      case 4:
        return `<div style="display:flex;flex-direction:column;gap:14px">
          ${fieldInput('soldPrice', 'Final sold price (₹)', draft.soldPrice ? String(draft.soldPrice) : '', 'number', 'inputmode="numeric" min="0"')}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            ${fieldInput('saleDate', 'Sale date', draft.saleDate, 'date')}
            ${fieldInput('registrationDate', 'Registration date', draft.registrationDate, 'date')}
          </div>
        </div>`;
      case 5:
        return `<div style="display:flex;flex-direction:column;gap:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            ${fieldInput('brokerage', 'Total brokerage (₹)', draft.brokerage === undefined ? '' : String(draft.brokerage), 'number', 'inputmode="numeric" min="0"')}
            ${fieldInput('commission', 'Your commission (₹)', draft.commission === undefined ? '' : String(draft.commission), 'number', 'inputmode="numeric" min="0"')}
          </div>
          ${fieldInput('paymentReceived', 'Payment received so far (₹)', draft.paymentReceived === undefined ? '' : String(draft.paymentReceived), 'number', 'inputmode="numeric" min="0"')}
          <label style="display:flex;align-items:center;gap:11px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:13px;padding:14px 16px;cursor:pointer;font-size:15px;font-weight:700;color:#241f1c"><input name="commissionReceived" type="checkbox" ${draft.commissionReceived ? 'checked' : ''} style="width:20px;height:20px">Commission already received</label>
        </div>`;
      case 6:
        return `<div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;gap:10px"><input id="pm-doc-name" placeholder="Document name (e.g. Sale agreement.pdf)" style="flex:1;height:48px;border:1px solid #e6cf9a;border-radius:13px;background:#fff;padding:0 15px;font-size:15px"><button type="button" data-act="add-doc" style="height:48px;padding:0 18px;border-radius:13px;background:#5b32c4;color:#fff;font-weight:800;cursor:pointer">Add</button></div>
          ${draft.documents.length ? `<div style="display:flex;flex-direction:column;gap:8px">${draft.documents.map((doc, i) => `<div style="display:flex;align-items:center;gap:10px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:11px;padding:11px 13px"><i class="ph-fill ph-file-text" style="font-size:19px;color:#5b32c4"></i><span style="flex:1;font-size:14px;font-weight:700;color:#241f1c">${esc(doc.name)}</span><button type="button" data-act="rm-doc" data-i="${i}" aria-label="Remove" style="width:26px;height:26px;border-radius:8px;background:#ffe1e6;color:#c2185b;display:grid;place-items:center;cursor:pointer"><i class="ph-bold ph-x" style="font-size:12px"></i></button></div>`).join('')}</div>` : '<div style="font-size:14px;color:#8d8271">No documents attached yet. This step is optional.</div>'}
        </div>`;
      default: {
        const buyerName = draft.addingBuyer ? draft.newBuyer.name : (selectedBuyer()?.name ?? '');
        const row = (k: string, v: string) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #efe6d0;font-size:14.5px"><span style="color:#8d8271">${esc(k)}</span><span style="font-weight:800;color:#241f1c;text-align:right">${v}</span></div>`;
        return `<div style="display:flex;flex-direction:column;gap:14px">
          <div style="background:#fff;border:1px solid #efe6d0;border-radius:16px;padding:6px 18px 14px">
            ${row('Property', esc(p?.area ?? '—'))}
            ${row('City · Sector', `${esc(p?.city ?? '')}${p?.sector ? ` · ${esc(p.sector)}` : ''}`)}
            ${row('Buyer', esc(buyerName || '—'))}
            ${row('Seller', esc(draft.seller || '—'))}
            ${row('Final sold price', formatINR(draft.soldPrice))}
            ${row('Sale date', fmtDate(draft.saleDate))}
            ${row('Registration date', fmtDate(draft.registrationDate))}
            ${row('Brokerage', draft.brokerage === undefined ? 'Not recorded' : formatINR(draft.brokerage))}
            ${row('Your commission', draft.commission === undefined ? 'Not recorded' : `${formatINR(draft.commission)}${draft.commissionReceived ? ' · received' : ' · pending'}`)}
            ${row('Documents', draft.documents.length ? `${draft.documents.length} attached` : 'None')}
          </div>
          <div role="alert" style="display:flex;gap:11px;background:#fff4e0;border:1px solid #f4cf8f;border-radius:14px;padding:14px 16px;color:#8a5a08;font-size:14px;line-height:1.5"><i class="ph-fill ph-warning" style="font-size:20px;flex:none;margin-top:1px"></i><span>This will mark the selected property as <b>Sold</b> and remove it from available inventory, Client Presentation and future Client Links.</span></div>
          ${flowError ? `<div role="alert" style="background:#ffe1e6;border:1px solid #f3b6c2;color:#9f2446;border-radius:12px;padding:12px 15px;font-size:14px;font-weight:700">${esc(flowError)}</div>` : ''}
        </div>`;
      }
    }
  };

  const flowMarkup = () => `<div data-overlay style="position:fixed;inset:0;background:rgba(24,16,4,.5);backdrop-filter:blur(5px);z-index:100;display:grid;place-items:center;padding:20px"><form id="pm-record-sale" role="dialog" aria-modal="true" aria-labelledby="pm-rs-title" style="width:min(760px,97vw);max-height:94vh;display:flex;flex-direction:column;background:#fffaf0;border-radius:26px;box-shadow:0 44px 100px -36px rgba(20,14,2,.9);overflow:hidden">
    <div style="display:flex;align-items:center;gap:14px;padding:22px 26px;border-bottom:1px solid #f0dfb8;flex:none"><span style="width:48px;height:48px;border-radius:14px;background:#12a150;color:#fff;display:grid;place-items:center;flex:none"><i class="ph-fill ph-seal-check" style="font-size:24px"></i></span><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8d8271">Record completed sale · Step ${step} of 7</div><h2 id="pm-rs-title" style="margin:3px 0 0;font-family:'Newsreader',serif;font-size:26px;font-weight:500;color:#241f1c">${esc(STEP_TITLES[step - 1] ?? '')}</h2></div><button type="button" data-act="close-flow" aria-label="Close" style="width:42px;height:42px;border-radius:12px;background:#f3eeff;color:#6b6156;flex:none"><i class="ph-bold ph-x"></i></button></div>
    <div style="padding:18px 26px 0;flex:none"><div style="display:flex;gap:6px">${[1, 2, 3, 4, 5, 6, 7].map((s) => `<span style="height:6px;flex:1;border-radius:999px;background:${s <= step ? '#12a150' : '#e4dbcf'}"></span>`).join('')}</div></div>
    <div data-scroll style="padding:24px 26px;overflow-y:auto;flex:1">${stepBody()}${flowError && step < 7 ? `<div role="alert" style="margin-top:14px;background:#ffe1e6;border:1px solid #f3b6c2;color:#9f2446;border-radius:12px;padding:12px 15px;font-size:14px;font-weight:700">${esc(flowError)}</div>` : ''}</div>
    <div style="display:flex;align-items:center;gap:10px;padding:18px 26px;border-top:1px solid #f0dfb8;flex:none">${step > 1 ? '<button type="button" data-act="back-step" style="height:50px;padding:0 20px;border-radius:13px;background:#f3eeff;color:#4c463d;font-weight:800;cursor:pointer"><i class="ph-bold ph-arrow-left"></i> Back</button>' : ''}<div style="flex:1"></div>${step < 7
      ? '<button type="button" data-act="next-step" style="height:50px;padding:0 26px;border-radius:13px;background:#12a150;color:#fff;font-weight:800;cursor:pointer">Next <i class="ph-bold ph-arrow-right"></i></button>'
      : `<button type="submit" ${recording ? 'disabled' : ''} style="height:50px;padding:0 26px;border-radius:13px;background:#12a150;color:#fff;font-weight:800;cursor:pointer;${recording ? 'opacity:.6' : ''}">${recording ? 'Recording…' : '<i class="ph-fill ph-check-circle"></i> Confirm & record sale'}</button>`}</div>
  </form></div>`;

  /* ── main render ───────────────────────────────────────────── */
  const render = () => {
    try {
      const list = filteredDeals();
    const soldTotal = list.filter((d) => recorded(d, 'soldPrice') && Number.isFinite(d.soldPrice)).reduce((s, d) => s + d.soldPrice, 0);
    const commEarned = list.filter((d) => recorded(d, 'commission') && recorded(d, 'commissionReceived') && d.commissionReceived && Number.isFinite(d.commission)).reduce((s, d) => s + d.commission, 0);
    const commPending = list.filter((d) => recorded(d, 'commission') && recorded(d, 'commissionReceived') && !d.commissionReceived && Number.isFinite(d.commission)).reduce((s, d) => s + d.commission, 0);
    const incompleteCount = list.filter((d) => !recorded(d, 'soldPrice') || !recorded(d, 'commission') || !recorded(d, 'commissionReceived')).length;
    const selected = selectedId ? deals.find((d) => d.id === selectedId) : undefined;

      el.innerHTML = `<div style="max-width:1080px;margin:0 auto;padding:34px 40px 70px">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
        <div><h1 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:#241f1c">My Deals</h1><p style="margin:8px 0 0;font-size:17px;color:#6b6156">Your completed-sales register — every closed transaction, buyer, seller and commission in one place.</p></div>
        <button data-act="record" style="display:flex;align-items:center;gap:9px;padding:15px 22px;border-radius:14px;background:#12a150;color:#fff;font-size:16px;font-weight:800;box-shadow:0 12px 26px -14px rgba(11,143,69,.85);cursor:pointer"><i class="ph-fill ph-seal-check" style="font-size:18px"></i>Record Completed Sale</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:24px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
        <div style="background:#ffc93c;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14);border-radius:20px;padding:22px 24px;color:#1f1a12"><div style="font-size:13.5px;color:#8a6a14;font-weight:700">Recorded sold value</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:38px;line-height:1;margin-top:8px">${formatINR(soldTotal)}</div></div>
        <div style="background:#d9f5e3;border:1px solid #a6e3c0;border-radius:20px;padding:22px 24px"><div style="font-size:13.5px;color:#0b6f39;font-weight:800">Commission received</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:38px;line-height:1;color:#0b8f45;margin-top:8px">${formatINR(commEarned)}</div></div>
        <div style="background:#fff3e8;border:1px solid #f8cba6;border-radius:20px;padding:22px 24px"><div style="font-size:13.5px;color:#b06f0c;font-weight:800">Commission pending</div><div style="font-family:'Newsreader',serif;font-weight:500;font-size:38px;line-height:1;color:#c2622a;margin-top:8px">${formatINR(commPending)}</div></div>
      </div>
      ${incompleteCount ? `<div role="status" style="margin-top:14px;padding:11px 14px;border-radius:12px;background:#fff4e0;border:1px solid #f4cf8f;color:#8a5a08;font-size:13px">${incompleteCount} legacy ${incompleteCount === 1 ? 'sale has' : 'sales have'} fields that were not recorded; totals exclude unknown values.</div>` : ''}
      <label style="display:flex;align-items:center;gap:12px;background:#faf7ff;border:1px solid #e4dbf7;border-radius:15px;padding:15px 18px;margin:24px 0 0"><i class="ph ph-magnifying-glass" style="font-size:21px;color:#8d8271"></i><input id="pm-deal-search" value="${esc(search)}" placeholder="Search a property, buyer, seller or city…" style="border:none;outline:none;background:none;width:100%;font-size:16px;color:#241f1c">${search ? '<button data-act="clear" aria-label="Clear search" style="width:28px;height:28px;border-radius:8px;background:#f3eeff;color:#6b6156;display:grid;place-items:center;flex:none"><i class="ph-bold ph-x" style="font-size:13px"></i></button>' : ''}</label>
      ${filterBar()}
      <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8d8271;margin:22px 0 12px">${list.length} completed ${list.length === 1 ? 'sale' : 'sales'}</div>
      ${list.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px">${list.map(dealCard).join('')}</div>`
        : `<div style="padding:40px 26px;text-align:center;color:#8d8271;background:#faf7ff;border:1px dashed #e6cf9a;border-radius:18px"><i class="ph-fill ph-seal-check" style="font-size:34px;color:#c9b48a"></i><div style="margin-top:10px;font-size:16px;font-weight:700;color:#6b6156">No completed sales${search || range !== 'all' || comm !== 'all' || cityFilter ? ' match your filters' : ' yet'}.</div><div style="font-size:14px;margin-top:4px">Record a sale after the transaction is complete.</div></div>`}
      </div>${selected ? safeDetailMarkup(selected) : ''}${flowOpen ? flowMarkup() : ''}`;
    } catch {
      el.innerHTML = dealsErrorMarkup();
    }
  };

  /* ── capture step field values into the draft (no re-render) ── */
  const captureStepFields = () => {
    const form = el.querySelector('#pm-record-sale');
    if (!form) return;
    const val = (name: string) => (form.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value ?? '';
    if (step === 2 && draft.addingBuyer) {
      draft.newBuyer.name = val('nb-name'); draft.newBuyer.phone = val('nb-phone'); draft.newBuyer.city = val('nb-city');
    }
    if (step === 3) { draft.seller = val('seller'); draft.sellerPhone = val('sellerPhone'); }
    if (step === 4) { draft.soldPrice = Number(val('soldPrice')) || 0; draft.saleDate = val('saleDate'); draft.registrationDate = val('registrationDate'); }
    if (step === 5) {
      const optionalAmount = (name: string): number | undefined => {
        const raw = val(name).trim();
        return raw === '' ? undefined : Number(raw);
      };
      draft.brokerage = optionalAmount('brokerage'); draft.commission = optionalAmount('commission');
      draft.paymentReceived = optionalAmount('paymentReceived');
      draft.commissionReceived = !!(form.querySelector('[name="commissionReceived"]') as HTMLInputElement | null)?.checked;
    }
  };

  const closeFlow = () => { flowOpen = false; step = 1; flowError = ''; recording = false; draft.propertyId = ''; draft.buyerId = ''; draft.addingBuyer = false; draft.newBuyer = { name: '', phone: '', city: '' }; draft.seller = ''; draft.sellerPhone = ''; draft.soldPrice = 0; draft.saleDate = ''; draft.registrationDate = ''; draft.brokerage = undefined; draft.commission = undefined; draft.commissionReceived = false; draft.paymentReceived = undefined; draft.documents = []; };

  const submitSale = async () => {
    if (recording) return;
    recording = true; flowError = ''; render();
    const input: RecordSaleInput = {
      propertyId: draft.propertyId,
      ...(draft.addingBuyer ? { newBuyer: { name: draft.newBuyer.name.trim(), phone: draft.newBuyer.phone.trim(), city: draft.newBuyer.city.trim() } } : { buyerId: draft.buyerId }),
      seller: draft.seller.trim() || undefined, sellerPhone: draft.sellerPhone.trim() || undefined,
      soldPrice: draft.soldPrice, saleDate: draft.saleDate, registrationDate: draft.registrationDate || undefined,
      brokerage: draft.brokerage, commission: draft.commission,
      commissionReceived: draft.commissionReceived, paymentReceived: draft.paymentReceived,
      documents: draft.documents,
    };
    let res;
    try {
      res = await adapter.deals.record(input);
    } catch {
      recording = false;
      flowError = 'The completed sale could not be recorded. Please try again.';
      render();
      return;
    }
    if (!res.ok) { recording = false; flowError = res.error.message; render(); return; }
    // Success: reflect the new sale locally and drop the sold plot from inventory.
    deals.unshift(res.value);
    properties = properties.filter((p) => p.id !== input.propertyId);
    closeFlow();
    selectedId = res.value.id;
    render();
  };

  /* ── events ────────────────────────────────────────────────── */
  el.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.id === 'pm-deal-search') { search = target.value; render(); const s = el.querySelector<HTMLInputElement>('#pm-deal-search'); if (s) { s.focus(); s.setSelectionRange(search.length, search.length); } }
  });

  el.addEventListener('change', (event) => {
    const target = event.target as HTMLElement;
    const act = target.getAttribute('data-act');
    if (act === 'city') { cityFilter = (target as HTMLSelectElement).value; render(); }
  });

  el.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    if (form.id !== 'pm-record-sale') return;
    event.preventDefault();
    void submitSale();
  });

  el.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) {
      if ((event.target as HTMLElement).hasAttribute('data-overlay')) { selectedId = null; render(); }
      return;
    }
    const action = target.dataset.act;
    switch (action) {
      case 'open': selectedId = target.dataset.id ?? null; break;
      case 'close': selectedId = null; break;
      case 'clear': search = ''; break;
      case 'range': range = (target.dataset.range as Range) ?? 'all'; break;
      case 'sort': sort = (target.dataset.sort as Sort) ?? 'recent'; break;
      case 'comm': comm = (target.dataset.comm as CommFilter) ?? 'all'; break;
      case 'record': flowOpen = true; step = 1; flowError = ''; break;
      case 'close-flow': closeFlow(); break;
      case 'pick-prop': draft.propertyId = target.dataset.id ?? ''; flowError = ''; break;
      case 'pick-buyer': draft.buyerId = target.dataset.id ?? ''; draft.addingBuyer = false; flowError = ''; break;
      case 'add-newbuyer': captureStepFields(); draft.addingBuyer = true; draft.buyerId = ''; break;
      case 'cancel-newbuyer': captureStepFields(); draft.addingBuyer = false; break;
      case 'add-doc': {
        const nameEl = el.querySelector<HTMLInputElement>('#pm-doc-name');
        const name = (nameEl?.value ?? '').trim();
        if (name) draft.documents.push({ name });
        break;
      }
      case 'rm-doc': { const i = Number(target.dataset.i); if (!Number.isNaN(i)) draft.documents.splice(i, 1); break; }
      case 'next-step':
        captureStepFields();
        if (canAdvance()) { flowError = ''; step = Math.min(7, step + 1); }
        else flowError = advanceError();
        break;
      case 'back-step': captureStepFields(); step = Math.max(1, step - 1); break;
      default: return;
    }
    render();
  });

  render();
}
