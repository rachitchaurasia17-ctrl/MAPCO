/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Dealer Home ("areas")
   Source: Dealer Dashboard.dc.html lines 341–478 (<sc-if isAreas>),
   view-model at renderVals() lines 1414–1536.

   A read-only demand screen. Every number comes from the dealer's
   own activity — presentation opens (DemandSignals) and the private
   links they sent (ClientLinks) — never from outside data.
   ═══════════════════════════════════════════════════════════════ */
import { adapter } from '../../../packages/data/adapter';
import { getProfile } from '../../../packages/auth/auth';
import type { Client, ClientLink, DemandSignal, Property, WantType } from '../../../packages/data/types';
import { listAllRecords } from '../../../packages/data/list-all';
import { productRoutes } from '../../../packages/ui/product-routes';
import { propertyOperationalState } from '../property-operational-state';

const esc = (value: unknown): string => String(value ?? '').replace(
  /[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

/** The design's own currency helper (Dealer Dashboard.dc.html line 1307) —
 *  two decimals trimmed, not the one-decimal shared formatINR. */
const inr = (value: number): string => {
  const v = Math.round(value);
  if (v >= 1e7) return '₹' + (+(v / 1e7).toFixed(2)) + ' Cr';
  if (v >= 1e5) return '₹' + (+(v / 1e5).toFixed(2)) + ' L';
  return '₹' + v.toLocaleString('en-IN');
};

const WANTS: WantType[] = ['Plot', 'Flat', 'Kothi', 'Villa', 'Commercial'];
const PIEC = ['#f4ae14', '#6b3fd4', '#1b7a46', '#fb923c', '#c2185b', '#1f6f6b', '#e6cf9a'];

const errorState = (message: string): string =>
  `<div role="alert" style="max-width:1120px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446;font-size:15px;line-height:1.5">${message}</div>`;

const withTimeout = <T,>(promise: Promise<T>): Promise<T> => Promise.race([
  promise,
  new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12_000)),
]);

interface DemandRow {
  city: string;
  opens: number;
  buyers: number;
  stockCount: number;
  stockValue: number;
  verdict: 'Source stock' | 'Ready to sell' | 'You have stock' | 'Quiet';
}

export async function renderHome(container: HTMLElement): Promise<void> {
  container.innerHTML = '<div role="status" aria-live="polite" style="max-width:1120px;margin:0 auto;padding:40px;color:#6b6156">Loading your dealer workspace…</div>';

  let properties: Property[] = [];
  let links: ClientLink[] = [];
  let customers: Client[] = [];
  let signals: DemandSignal[] = [];

  try {
    const [propertiesResult, linksResult, customersResult, signalsResult] = await Promise.all([
      withTimeout(listAllRecords((params, opts) => adapter.properties.list(params, opts))),
      withTimeout(listAllRecords((params, opts) => adapter.clientLinks.list(params, opts))),
      withTimeout(listAllRecords((params, opts) => adapter.customers.list(params, opts))),
      withTimeout(adapter.demandSignals.get()),
    ]);
    if (!propertiesResult.ok || !linksResult.ok || !customersResult.ok) {
      const unauthorized = [propertiesResult, linksResult, customersResult]
        .some((result) => !result.ok && result.error.code === 'unauthorized');
      container.innerHTML = unauthorized
        ? errorState('Your session has expired. <a href="?signout" style="color:#5b32c4;font-weight:800">Sign in again</a>.')
        : errorState('Your dealer workspace could not be loaded. Please refresh.');
      return;
    }
    properties = propertiesResult.value;
    links = linksResult.value;
    customers = customersResult.value;
    // Demand signals are supporting context; the screen still reads without them.
    signals = signalsResult.ok ? signalsResult.value : [];
  } catch {
    container.innerHTML = errorState('We could not reach your dealer workspace. Check your connection and refresh.');
    return;
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const ownerFirst = (getProfile()?.name || '').split(' ')[0] || '';

  const opensByCity = new Map(signals.map((signal) => [signal.city, signal.opens]));
  const unsold = properties.filter((property) => !property.sold);

  /* demandRows — the spine of the whole screen (design lines 1468–1482).
     Cities are the union of everywhere the dealer has signal, stock or a
     buyer, rather than the design's hardcoded nine. */
  const cities = [...new Set([
    ...signals.map((signal) => signal.city),
    ...properties.map((property) => property.city),
    ...customers.map((customer) => customer.city),
  ].filter(Boolean))];

  const demandRows: DemandRow[] = cities.map((city) => {
    const opens = opensByCity.get(city) ?? 0;
    const buyers = customers.filter((customer) => customer.city === city).length;
    const stock = unsold.filter((property) => property.city === city);
    const verdict: DemandRow['verdict'] = buyers > 0 && stock.length === 0 ? 'Source stock'
      : buyers > 0 && stock.length > 0 ? 'Ready to sell'
      : stock.length > 0 ? 'You have stock'
      : 'Quiet';
    return {
      city,
      opens,
      buyers,
      stockCount: stock.length,
      stockValue: stock.reduce((total, property) => total + (Number.isFinite(property.price) ? property.price : 0), 0),
      verdict,
    };
  }).sort((a, b) => b.opens - a.opens);

  const totalOpens = demandRows.reduce((total, row) => total + row.opens, 0);
  const linkOpens = links.reduce((total, link) => total + (link.events?.opens ?? 0), 0);
  const liveLinks = links.filter((link) => link.status === 'active').length;
  const top = demandRows[0];

  /* Donut — first six cities, remainder folded into "Other areas". */
  const pieData = demandRows.slice(0, 6).map((row, index) => ({
    label: row.city, opens: row.opens, color: PIEC[index]!, city: row.city as string | null,
  }));
  const restOpens = demandRows.slice(6).reduce((total, row) => total + row.opens, 0);
  if (restOpens > 0) pieData.push({ label: 'Other areas', opens: restOpens, color: PIEC[6]!, city: null });
  const pieTotal = pieData.reduce((total, slice) => total + slice.opens, 0) || 1;

  const CIRC2 = 2 * Math.PI * 62;
  let cumulative = 0;
  const pieSegs = pieData.map((slice) => {
    const pct = slice.opens / pieTotal;
    const seg = {
      color: slice.color,
      dash2: (pct * CIRC2 - 3).toFixed(2) + ' ' + CIRC2.toFixed(2),
      offset2: (-cumulative * CIRC2).toFixed(2),
    };
    cumulative += pct;
    return seg;
  });
  const pieLegend = pieData.map((slice) => ({
    city: slice.label,
    pct: Math.round(slice.opens / pieTotal * 100) + '%',
    color: slice.color,
    href: slice.city ? productRoutes.propertiesInCity(slice.city) : productRoutes.properties(),
  }));
  const pieTop = pieLegend.slice(0, 5);

  /* What gets opened most — by property type. */
  const wantRows = WANTS.map((want) => ({
    want,
    opens: properties.filter((property) => property.want === want)
      .reduce((total, property) => total + (property.views || 0), 0),
    stock: unsold.filter((property) => property.want === want).length,
  })).sort((a, b) => b.opens - a.opens);
  const maxWantOpens = Math.max(1, ...wantRows.map((row) => row.opens));

  /* Opens vs stock columns. */
  const vsRows = demandRows.slice(0, 6);
  const maxVsOpens = Math.max(1, ...vsRows.map((row) => row.opens));
  const maxVsStock = Math.max(1, ...vsRows.map((row) => row.stockCount));

  /* Insight banner — an unserved city beats the hottest one. */
  const opportunity = demandRows.find((row) => row.verdict === 'Source stock');
  const banner = opportunity
    ? {
      bg: 'background:#f7dde3;border:1px solid #eec3cd', tag: 'color:#a3324f',
      icon: 'ph-fill ph-lightbulb-filament', kicker: 'Biggest opportunity', name: opportunity.city,
      line: `${opportunity.city} was opened ${opportunity.opens} time${opportunity.opens === 1 ? '' : 's'} while you were presenting — but you have nothing to show there yet. Sourcing even one plot could win a deal.`,
    }
    : top ? {
      bg: 'background:#fbeecb;border:1px solid #f0dda6', tag: 'color:#a8792a',
      icon: 'ph-fill ph-fire', kicker: 'Hottest area', name: top.city,
      line: `${top.city} is your most looked-at area with ${top.opens} opens, and you have ${top.stockCount} plot${top.stockCount === 1 ? '' : 's'} ready. Lead with these.`,
    } : null;

  /* Plots pulling the most attention. */
  const attention = unsold.slice()
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5)
    .map((property, index) => ({
      property,
      rank: '#' + (index + 1),
      views: property.views || 0,
      loc: `${property.size} · ${(property.loc || property.city).split(', ')[0]}`,
      priceFmt: inr(property.price),
      ready: propertyOperationalState(property).readyToShow,
      photo: property.photos?.[0] ?? '',
    }));

  container.innerHTML = `<div style="max-width:1120px;margin:0 auto;padding:30px 40px 70px">

  <div style="border-radius:28px;padding:32px 34px;background:#241d0c;background-image:linear-gradient(140deg,#3a2f14 0%,#241d0c 60%,#150f04 100%);box-shadow:0 26px 60px -34px rgba(20,14,2,.95);animation:omRise .5s cubic-bezier(.2,.8,.2,1) both">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
      <div>
        <div style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#c9a94a">${esc(dateStr)}</div>
        <h1 style="margin:8px 0 0;font-family:'Newsreader',serif;font-weight:500;font-size:40px;letter-spacing:-.02em;color:#fff8e6">${esc(greeting)}${ownerFirst ? ', ' + esc(ownerFirst) : ''}.</h1>
        <p style="margin:8px 0 0;font-size:17px;color:#c9b48a">Only from your own presentations and the links you sent.</p>
      </div>
      <a href="${esc(productRoutes.presentation())}" style="display:flex;align-items:center;gap:11px;height:62px;padding:0 26px;border-radius:16px;background:#ffc93c;color:#241d0c;font-size:18px;font-weight:800;text-decoration:none;box-shadow:0 16px 34px -16px rgba(244,174,20,.95)" onmouseover="this.style.background='#f4ae14'" onmouseout="this.style.background='#ffc93c'"><i class="ph-fill ph-projector-screen-chart" style="font-size:22px"></i>Show the map</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px">
      <div style="border-radius:20px;padding:20px 22px;background:#ffc93c;background-image:linear-gradient(140deg,#ffdc7a,#f4ae14)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#8a6a14"><i class="ph-fill ph-cursor-click" style="font-size:16px"></i>Opened while presenting</div>
        <div data-count="${totalOpens}" style="font-family:'Newsreader',serif;font-weight:500;font-size:52px;line-height:1;color:#241d0c;margin-top:6px">${totalOpens}</div>
      </div>
      <div style="border-radius:20px;padding:20px 22px;background:#6b3fd4;background-image:linear-gradient(140deg,#8a63e8,#5b32c4)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#d8c8ff"><i class="ph-fill ph-paper-plane-tilt" style="font-size:16px"></i>Link opens</div>
        <div data-count="${linkOpens}" style="font-family:'Newsreader',serif;font-weight:500;font-size:52px;line-height:1;color:#fff;margin-top:6px">${linkOpens}</div>
        <div style="font-size:13px;font-weight:700;color:#d8c8ff;margin-top:4px">${liveLinks} link${liveLinks === 1 ? '' : 's'} live now</div>
      </div>
      <div style="border-radius:20px;padding:20px 22px;background:#12a150;background-image:linear-gradient(140deg,#2ec06b,#0b8f45)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#c9f0d9"><i class="ph-fill ph-fire" style="font-size:16px"></i>Hottest area</div>
        <div style="font-family:'Newsreader',serif;font-weight:600;font-size:27px;line-height:1.15;color:#fff;margin-top:12px">${esc(top?.city ?? 'No opens yet')}</div>
        <div style="font-size:14px;font-weight:700;color:#c9f0d9;margin-top:3px">${top ? `${top.opens} opens · ${top.stockCount} plot${top.stockCount === 1 ? '' : 's'} you can show` : 'Present a map to start seeing demand'}</div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;margin-top:18px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.06s">
    <div style="min-width:0;background:#fff3d1;border:1.5px solid #f6e3ab;border-radius:24px;padding:24px 26px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">Where buyers look</h3>
        <span style="font-size:12.5px;font-weight:800;color:#8a6a14;white-space:nowrap">${totalOpens} opens</span>
      </div>
      <div style="display:flex;align-items:center;gap:18px;margin-top:16px;flex-wrap:wrap">
        <div style="position:relative;width:158px;height:158px;flex:none">
          <svg viewBox="0 0 180 180" style="width:158px;height:158px;transform:rotate(-90deg);filter:drop-shadow(0 10px 20px rgba(31,26,18,.2))">
            ${totalOpens > 0
              ? pieSegs.map((seg) => `<circle cx="90" cy="90" r="62" fill="none" stroke="${esc(seg.color)}" stroke-width="34" stroke-dasharray="${esc(seg.dash2)}" stroke-dashoffset="${esc(seg.offset2)}"></circle>`).join('')
              : `<circle cx="90" cy="90" r="62" fill="none" stroke="#f0dda6" stroke-width="34"></circle>`}
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">
            <div style="font-family:'Newsreader',serif;font-weight:600;font-size:30px;line-height:1;color:#241f1c">${esc(totalOpens > 0 ? (pieLegend[0]?.pct ?? '') : '—')}</div>
            <div style="font-size:11.5px;font-weight:800;color:#8a6a14;text-align:center;max-width:96px;line-height:1.25;margin-top:3px">${esc(totalOpens > 0 ? (pieLegend[0]?.city ?? '') : 'No opens yet')}</div>
          </div>
        </div>
        <div style="flex:1 1 150px;min-width:0;display:flex;flex-direction:column;gap:8px">
          ${pieTop.map((row) => `<a href="${esc(row.href)}" style="display:flex;align-items:center;gap:10px;width:100%;padding:5px 7px;border-radius:10px;cursor:pointer;text-decoration:none" onmouseover="this.style.background='#ffe9a8'" onmouseout="this.style.background='transparent'">
            <span style="width:16px;height:16px;border-radius:5px;flex:none;background:${esc(row.color)}"></span>
            <span style="flex:1;min-width:0;text-align:left;font-size:15px;font-weight:800;color:#241f1c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(row.city)}</span>
            <span style="font-family:'Newsreader',serif;font-size:18px;font-weight:600;color:#241f1c;flex:none">${esc(row.pct)}</span>
          </a>`).join('')}
        </div>
      </div>
    </div>

    <div style="min-width:0;background:#efe8fb;border:1.5px solid #ddd0f5;border-radius:24px;padding:24px 26px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
        <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">What gets opened most</h3>
        <span style="font-size:12.5px;font-weight:800;color:#5b32c4;white-space:nowrap">by type</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:11px;margin-top:16px">
        ${wantRows.map((row) => {
          const none = row.opens === 0;
          return `<div>
            <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
              <span style="font-size:15.5px;font-weight:800;color:#241f1c">${esc(row.want)}</span>
              <span style="font-size:12.5px;font-weight:800;padding:4px 10px;border-radius:999px;white-space:nowrap;${none ? 'background:#f3eeff;color:#8a7a52' : 'background:#ded0fa;color:#5b32c4'}">${none ? 'never opened yet' : `${row.stock} in stock`}</span>
            </div>
            <div style="display:flex;align-items:center;gap:9px;margin-top:6px">
              <div style="flex:1;min-width:70px;height:16px;border-radius:999px;background:#ded0fa;overflow:hidden">
                <div style="height:100%;width:${Math.max(6, Math.round(row.opens / maxWantOpens * 100))}%;border-radius:999px;background:${none ? '#c4b183' : '#6b3fd4'};transform-origin:left;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both"></div>
              </div>
              <span style="font-family:'Newsreader',serif;font-size:20px;font-weight:600;color:#5b32c4;flex:none">${row.opens}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>

  <div style="background:#faf7ff;border:1.5px solid #e4dbf7;border-radius:24px;padding:24px 26px;margin-top:16px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.08s">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="min-width:0">
        <h3 style="margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:23px;color:#241f1c">Interest on the map vs plots you hold</h3>
        <p style="margin:4px 0 0;font-size:14px;color:#8a8070">Opens are counted while you present. Nothing here comes from outside.</p>
      </div>
      <div style="display:flex;align-items:center;gap:14px">
        <span style="display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#5b32c4"><span style="width:12px;height:12px;border-radius:4px;background:#6b3fd4"></span>Opens</span>
        <span style="display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#a8600c"><span style="width:12px;height:12px;border-radius:4px;background:#ffc93c"></span>Your plots</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:12px;margin-top:20px;align-items:end">
      ${vsRows.map((row) => {
        const hA = Math.max(16, Math.round(row.opens / maxVsOpens * 146));
        const hB = Math.max(16, Math.round(row.stockCount / maxVsStock * 146));
        const short = (row.opens / maxVsOpens) > (row.stockCount / maxVsStock);
        return `<div style="min-width:0;display:flex;flex-direction:column;align-items:center;gap:9px">
          <div style="display:flex;align-items:flex-end;gap:6px;height:150px">
            <div style="width:30px;height:${hA}px;border-radius:9px 9px 4px 4px;background:linear-gradient(180deg,#8a63e8,#5b32c4);display:flex;align-items:flex-start;justify-content:center;padding-top:4px;transform-origin:bottom;animation:barGrow .8s cubic-bezier(.2,.8,.2,1) both"><span style="font-size:12px;font-weight:800;color:#fff">${row.opens}</span></div>
            <div style="width:30px;height:${hB}px;border-radius:9px 9px 4px 4px;background:linear-gradient(180deg,#ffdc7a,#f4ae14);display:flex;align-items:flex-start;justify-content:center;padding-top:4px;transform-origin:bottom;animation:barGrow .8s cubic-bezier(.2,.8,.2,1) both"><span style="font-size:12px;font-weight:800;color:#241d0c">${row.stockCount}</span></div>
          </div>
          <div style="font-size:12.5px;font-weight:800;color:#4c463d;text-align:center;line-height:1.25;max-width:100%;overflow:hidden;text-overflow:ellipsis">${esc(row.city)}</div>
          <span style="font-size:11px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap;${short ? 'background:#ffd3de;color:#c2185b' : 'background:#c9f0d9;color:#0b8f45'}">${short ? 'Source more' : 'Covered'}</span>
        </div>`;
      }).join('')}
    </div>
  </div>

  ${banner ? `<div style="${banner.bg};margin-top:18px;border-radius:22px;padding:22px 26px;display:flex;align-items:center;gap:16px;animation:omRise .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:.1s">
    <i class="${banner.icon}" style="font-size:32px;${banner.tag};flex:none"></i>
    <div>
      <div style="font-size:12.5px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;${banner.tag}">${esc(banner.kicker)} · ${esc(banner.name)}</div>
      <div style="font-size:17px;color:#4c463d;line-height:1.45;margin-top:4px;max-width:820px">${esc(banner.line)}</div>
    </div>
  </div>` : ''}

  <div style="display:flex;align-items:center;justify-content:space-between;margin:30px 0 14px">
    <div style="font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a8070">Plots pulling the most attention</div>
    <span style="font-size:12.5px;font-weight:800;color:#8a6a14;background:#fff3d1;border-radius:999px;padding:5px 13px">From your presentations</span>
  </div>
  ${attention.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px">
    ${attention.map((row) => `<a href="${esc(productRoutes.properties(row.property.id))}" style="min-width:0;display:block;background:#faf7ff;border:1.5px solid #e4dbf7;border-radius:18px;overflow:hidden;cursor:pointer;text-align:left;text-decoration:none;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 32px -26px rgba(30,28,22,.7);transition:transform .14s" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='none'">
      <span style="display:block;position:relative;height:112px;${row.photo ? `background-image:url('${esc(row.photo)}');background-size:cover;background-position:center` : 'background:#efe8fb;display:grid;place-items:center'}">
        ${row.photo ? '' : '<i class="ph-fill ph-image" style="font-size:28px;color:#6b3fd4"></i>'}
        <span style="position:absolute;top:8px;left:8px;display:grid;place-items:center;min-width:26px;height:26px;padding:0 7px;border-radius:9px;background:rgba(255,253,247,.94);color:#241d0c;font-size:12.5px;font-weight:800">${esc(row.rank)}</span>
        <span style="position:absolute;left:0;right:0;bottom:0;padding:22px 10px 9px;background:linear-gradient(180deg,rgba(20,14,2,0),rgba(20,14,2,.86));display:flex;align-items:flex-end;justify-content:space-between;gap:6px">
          <span style="font-family:'Newsreader',serif;font-weight:600;font-size:23px;line-height:1;color:#ffd75e">${row.views}</span>
          <span style="font-size:11px;font-weight:800;color:#f4e5c4;letter-spacing:.04em">OPENS</span>
        </span>
      </span>
      <span style="display:block;padding:10px 12px 4px;font-size:14.5px;font-weight:800;color:#211c17;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left">${esc(row.loc)}</span>
      <span style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 12px">
        <span style="font-family:'Newsreader',serif;font-weight:600;font-size:17px;color:#c85a1a">${esc(row.priceFmt)}</span>
        <span title="${row.ready ? 'Ready' : 'Needs setup'}" style="width:11px;height:11px;border-radius:50%;flex:none;background:${row.ready ? '#12a150' : '#c2185b'}"></span>
      </span>
    </a>`).join('')}
  </div>` : `<div style="padding:28px;border:1px dashed #d8caa8;border-radius:18px;background:#faf7ff;color:#6b6156;font-size:14px">No plots yet. Add one, then present it — opens show up here.</div>`}
</div>`;

  /* The design's count-up (animateCount, line 1313): 1050ms, k = 1-(1-k)^3.
     Purely an enhancement — the markup already carries the final number, so a
     throttled or never-firing rAF (background tab, reduced motion) leaves the
     correct total on screen rather than a stuck 0. */
  const counters = Array.from(container.querySelectorAll<HTMLElement>('[data-count]'));
  if (counters.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let start = 0;
    const tick = (now: number): void => {
      if (!counters[0]!.isConnected) return;
      if (!start) start = now;
      let k = Math.min(1, (now - start) / 1050);
      k = 1 - Math.pow(1 - k, 3);
      for (const el of counters) el.textContent = String(Math.round(Number(el.dataset.count) * k));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
