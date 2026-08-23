/* MAPCO Marketing — approved dealer-facing design, backed by the canonical
   Marketing pipeline. No creative, property, channel state, or performance
   number in this screen is invented. */
import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import { requireSession } from '../../packages/data/session';
import {
  loadDealerMarketingFeed,
  type DealerCreative, type DealerMarketingFeed, type MarketingChannel,
} from '../../packages/marketing/dealer-feed';

const esc = (value: unknown): string => String(value ?? '').replace(
  /[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

const CHANNELS: Record<MarketingChannel, { name: string; icon: string; color: string }> = {
  instagram: { name: 'Instagram', icon: 'ph-fill ph-instagram-logo', color: '#E1306C' },
  facebook_page: { name: 'Facebook', icon: 'ph-fill ph-facebook-logo', color: '#1877F2' },
  google_business: { name: 'Google', icon: 'ph-fill ph-google-logo', color: '#EA4335' },
  whatsapp_business: { name: 'WhatsApp', icon: 'ph-fill ph-whatsapp-logo', color: '#25D366' },
};

interface State {
  section: 'today' | 'library' | 'performance';
  feed: DealerMarketingFeed | null;
  activeCreativeId: string;
  propertyFilter: string;
  picker: boolean;
  loading: boolean;
  error: string;
}

const state: State = {
  section: 'today', feed: null, activeCreativeId: '', propertyFilter: 'all',
  picker: false, loading: true, error: '',
};

const todayIso = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

function loadIcons(): void {
  ['regular', 'fill', 'bold'].forEach((weight) => {
    const href = `/assets/phosphor/${weight}/style.css`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
    document.head.appendChild(link);
  });
}

function realConnections(): readonly MarketingChannel[] {
  return (state.feed?.connections ?? [])
    .filter((connection) => connection.status === 'connected')
    .map((connection) => connection.provider);
}

function header(): string {
  const tabs = [
    { key: 'today', label: 'Today', icon: 'ph-sun-horizon' },
    { key: 'library', label: 'Library', icon: 'ph-cards-three' },
    { key: 'performance', label: 'Performance', icon: 'ph-chart-bar' },
  ] as const;
  const connected = new Set(realConnections());
  return `<header style="flex:none;padding:14px 32px;display:flex;align-items:center;gap:22px;z-index:10;position:relative">
    <a href="/index.html" style="display:flex;align-items:center;gap:12px;flex:none;text-decoration:none">
      <img src="/assets/mapco-logo.png" alt="MAPCO" style="height:50px;width:auto;display:block;filter:drop-shadow(0 7px 12px rgba(90,40,150,.3))">
      <div style="line-height:1"><div style="font-size:20px;font-weight:800;letter-spacing:-.01em;color:#241833">MAPCO</div><div style="font-size:9.5px;font-weight:800;letter-spacing:.42em;color:#7a2fe0;margin-top:2px">MARKETING</div></div>
    </a>
    <nav style="display:flex;align-items:center;gap:3px;margin:0 auto;background:rgba(255,255,255,.55);border:1px solid rgba(122,47,224,.16);border-radius:17px;padding:5px;box-shadow:0 14px 32px -22px rgba(60,30,90,.6);backdrop-filter:blur(8px)">
      ${tabs.map((tab) => { const on = state.section === tab.key; return `<button data-act="nav" data-tab="${tab.key}" style="display:flex;align-items:center;gap:8px;padding:10px 20px;border-radius:13px;font-size:14.5px;font-weight:800;${on ? 'background:#1c1430;color:#ffcb45;box-shadow:0 10px 22px -12px rgba(28,20,48,.7)' : 'color:#5a3a1c;background:transparent'}"><i class="${on ? 'ph-fill ' : 'ph '}${tab.icon}" style="font-size:17px"></i>${tab.label}</button>`; }).join('')}
    </nav>
    <div style="display:flex;align-items:center;gap:7px">${(Object.keys(CHANNELS) as MarketingChannel[]).map((channel) => {
      const meta = CHANNELS[channel]; const on = connected.has(channel);
      return `<span title="${esc(meta.name)} · ${on ? 'connected' : 'not connected'}" style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#fff;opacity:${on ? '1' : '.38'};box-shadow:0 5px 12px -6px rgba(40,15,70,.5)"><i class="${meta.icon}" style="font-size:16px;color:${meta.color}"></i></span>`;
    }).join('')}</div>
  </header>`;
}

function emptyState(title: string, message: string): string {
  return `<div style="min-height:360px;display:grid;place-items:center;padding:32px"><div style="max-width:580px;text-align:center;padding:34px;border-radius:26px;background:rgba(255,255,255,.7);border:1px solid rgba(122,47,224,.16);box-shadow:0 30px 60px -40px rgba(40,15,70,.65)"><div style="width:54px;height:54px;margin:0 auto;border-radius:17px;display:grid;place-items:center;background:#f3eeff;color:#7a2fe0"><i class="ph-fill ph-images" style="font-size:27px"></i></div><h2 style="margin:16px 0 0;font-family:'Newsreader',serif;font-size:30px;font-weight:500;color:#1c1430">${esc(title)}</h2><p style="margin:9px 0 0;font-size:15px;line-height:1.6;color:#6a5b48">${esc(message)}</p></div></div>`;
}

function channelChips(channels: readonly MarketingChannel[]): string {
  if (!channels.length) return `<span style="font-size:12px;color:#8a7862">No channels assigned</span>`;
  return channels.map((channel) => { const meta = CHANNELS[channel]; return `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:9px;background:#fff;color:${meta.color};font-size:11.5px;font-weight:800"><i class="${meta.icon}"></i>${esc(meta.name)}</span>`; }).join('');
}

function todayView(): string {
  const feed = state.feed!;
  const today = todayIso();
  const creatives = feed.creatives.filter((creative) => creative.localDate === today);
  if (!creatives.length) return emptyState('No approved outputs for today yet', 'Marketing Ops has not released any of today’s four outputs. This page will update from the persisted approval pipeline when they are ready.');
  const active = creatives.find((creative) => creative.id === state.activeCreativeId) ?? creatives[0]!;
  state.activeCreativeId = active.id;
  const position = creatives.indexOf(active);
  return `<div style="flex:1;min-height:0;display:flex;flex-direction:column;padding:0 32px 18px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 2px 10px">
      <div style="display:flex;align-items:center;gap:10px"><span style="width:9px;height:9px;border-radius:50%;background:#22bf55;box-shadow:0 0 0 4px rgba(34,191,85,.18)"></span><div style="font-size:12.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#7a2fe0">${esc(today)} — ${creatives.length} of 4 ready</div></div>
      <div style="display:flex;gap:8px">${creatives.map((creative, index) => `<button data-act="creative" data-id="${esc(creative.id)}" style="display:flex;align-items:center;gap:8px;padding:8px 13px;border-radius:13px;${creative.id === active.id ? 'background:#fff;box-shadow:0 12px 26px -14px rgba(90,40,150,.55);border:1px solid rgba(122,47,224,.2)' : 'background:rgba(255,255,255,.42);opacity:.75'}"><span style="font-size:10px;font-weight:800;color:#7a2fe0">${String(index + 1).padStart(2, '0')}</span><span style="font-size:13px;font-weight:800">${esc(creative.propertyLabel)}</span></button>`).join('')}</div>
    </div>
    <div style="flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,.7fr);gap:18px">
      <div style="min-height:0;display:grid;place-items:center"><div style="height:100%;max-height:620px;max-width:100%;aspect-ratio:4/5;border-radius:24px;overflow:hidden;background:#14101f;box-shadow:0 44px 84px -34px rgba(40,15,70,.7)"><img src="${esc(active.displayUrl)}" alt="${esc(active.propertyLabel)} creative" style="width:100%;height:100%;object-fit:contain;display:block"></div></div>
      <aside style="align-self:center;padding:24px;border-radius:24px;background:rgba(255,255,255,.72);border:1px solid rgba(122,47,224,.15);box-shadow:0 28px 58px -36px rgba(40,15,70,.6)">
        <div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#7a2fe0">${esc(active.slotRef)} · approved output ${position + 1}</div>
        <h1 style="margin:8px 0 0;font-family:'Newsreader',serif;font-size:34px;font-weight:500;color:#1c1430">${esc(active.propertyLabel)}</h1>
        <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#5a4a38;white-space:pre-wrap">${esc(active.caption || 'No caption was supplied with this creative.')}</p>
        <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:18px">${channelChips(active.channels)}</div>
        <button disabled aria-disabled="true" style="width:100%;height:52px;margin-top:22px;border-radius:15px;background:rgba(122,47,224,.12);color:#8f819e;font-size:16px;font-weight:800;cursor:not-allowed"><i class="ph-fill ph-lock-key" style="margin-right:8px"></i>Publishing not connected</button>
        <div style="margin-top:10px;font-size:12.5px;line-height:1.5;color:#7a6a8e">This creative is ready for the dealer. MAPCO will not claim it was posted until a real provider credential and connector report success.</div>
      </aside>
    </div>
  </div>`;
}

function filteredLibrary(): readonly DealerCreative[] {
  const creatives = state.feed?.creatives ?? [];
  return state.propertyFilter === 'all' ? creatives : creatives.filter((creative) => creative.propertyId === state.propertyFilter);
}

function libraryView(): string {
  const creatives = filteredLibrary();
  const activeLabel = state.propertyFilter === 'all' ? 'All properties' : (state.feed?.creatives.find((item) => item.propertyId === state.propertyFilter)?.propertyLabel ?? 'Property');
  return `<div data-scroll style="padding:6px 32px 46px;overflow-y:auto">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#7a2fe0">Approved creative archive</div><h1 style="margin:4px 0 0;font-family:'Newsreader',serif;font-size:38px;font-weight:500;color:#1c1430">Library</h1><p style="margin:7px 0 0;color:#6a5b48">${creatives.length} persisted creative${creatives.length === 1 ? '' : 's'} · ${esc(activeLabel)}</p></div><button data-act="open-filter" style="height:44px;padding:0 17px;border-radius:13px;background:#fff;color:#5a18c0;font-size:14px;font-weight:800;box-shadow:0 14px 30px -22px rgba(40,15,70,.6)"><i class="ph-bold ph-funnel" style="margin-right:7px"></i>Filter by property</button></div>
    ${creatives.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:20px">${creatives.map((creative) => `<article style="overflow:hidden;border-radius:22px;background:rgba(255,255,255,.75);border:1px solid rgba(122,47,224,.14);box-shadow:0 24px 48px -36px rgba(40,15,70,.65)"><div style="height:280px;background:#1c1430"><img src="${esc(creative.displayUrl)}" alt="${esc(creative.propertyLabel)}" style="width:100%;height:100%;object-fit:cover"></div><div style="padding:15px 16px"><div style="font-size:11px;font-weight:800;color:#7a2fe0">${esc(creative.localDate)} · ${esc(creative.slotRef)}</div><div style="margin-top:4px;font-size:16px;font-weight:800;color:#1c1430">${esc(creative.propertyLabel)}</div><p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#5a4a38;white-space:pre-wrap">${esc(creative.caption || 'No caption was supplied with this creative.')}</p><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${channelChips(creative.channels)}</div></div></article>`).join('')}</div>` : emptyState('No approved creatives yet', 'When Marketing Ops approves an uploaded output, it will appear here from the canonical creative and schedule records.')}
  </div>`;
}

function metricTotals(): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of state.feed?.performance ?? []) for (const [key, value] of Object.entries(row.metrics)) totals[key] = (totals[key] ?? 0) + value;
  return totals;
}

function performanceView(): string {
  const rows = state.feed?.performance ?? []; const totals = metricTotals();
  if (!rows.length) return `<div data-scroll style="padding:6px 32px 46px;overflow-y:auto"><h1 style="margin:0;font-family:'Newsreader',serif;font-size:38px;font-weight:500;color:#1c1430">Performance</h1>${emptyState('No verified platform metrics yet', 'MAPCO only shows provider-reported data. No reach, engagement, follower, or “most viewed” figures are estimated or filled with demo analytics.')}</div>`;
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return `<div data-scroll style="padding:6px 32px 46px;overflow-y:auto"><div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#7a2fe0">Provider-reported only</div><h1 style="margin:4px 0 0;font-family:'Newsreader',serif;font-size:38px;font-weight:500;color:#1c1430">Performance</h1><p style="margin:7px 0 0;color:#6a5b48">${rows.length} persisted metric period${rows.length === 1 ? '' : 's'}</p><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;margin-top:22px">${entries.map(([key, value], index) => `<div style="border-radius:22px;background:${['#fff0c4','#dbfbe3','#ecdbff','#ffe3de'][index % 4]};padding:22px"><div style="font-family:'Newsreader',serif;font-size:40px;font-weight:500;color:#1c1430">${value.toLocaleString()}</div><div style="margin-top:5px;font-size:13px;font-weight:800;color:#5a4a38">${esc(key.replace(/[_-]+/g, ' '))}</div></div>`).join('')}</div><div style="margin-top:18px;padding:16px 18px;border-radius:16px;background:rgba(255,255,255,.7);font-size:13px;color:#6a5b48">Metrics are grouped exactly as received from connected providers. MAPCO does not infer missing activity.</div></div>`;
}

function picker(): string {
  if (!state.picker) return '';
  const properties = [...new Map((state.feed?.creatives ?? []).map((creative) => [creative.propertyId, creative.propertyLabel])).entries()];
  return `<div data-act="close-filter" style="position:fixed;inset:0;z-index:80;background:rgba(24,16,40,.5);backdrop-filter:blur(6px);display:grid;place-items:center;padding:32px"><div data-act="stop" style="width:min(620px,100%);max-height:80vh;overflow:auto;border-radius:24px;background:linear-gradient(160deg,#fff6ec,#fdeefb);padding:26px"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#7a2fe0">Filter by property</div><div style="font-size:21px;font-weight:800;color:#1c1430">Approved creatives</div></div><button data-act="close-filter" style="width:38px;height:38px;border-radius:11px;background:#f3eeff"><i class="ph-bold ph-x"></i></button></div><div style="display:flex;flex-direction:column;gap:9px;margin-top:18px"><button data-act="pick-filter" data-id="all" style="padding:13px;border-radius:13px;background:#fff;text-align:left;font-weight:800">All properties</button>${properties.map(([id, label]) => `<button data-act="pick-filter" data-id="${esc(id)}" style="padding:13px;border-radius:13px;background:#fff;text-align:left;font-weight:800">${esc(label)}</button>`).join('')}</div></div></div>`;
}

function render(): void {
  const root = document.getElementById('app'); if (!root) return;
  const content = state.loading ? emptyState('Loading Marketing…', 'Reading the dealer’s approved creative pipeline from MAPCO-DEV.')
    : state.error ? emptyState('Marketing is unavailable', state.error)
    : state.section === 'today' ? todayView() : state.section === 'library' ? libraryView() : performanceView();
  root.innerHTML = `<style>@import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@400;500;600&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap');html,body{height:100%;margin:0}body{background:#fff4de;color:#241833;font-family:'Hanken Grotesk',system-ui,sans-serif;overflow:hidden}button{font-family:inherit;border:none;cursor:pointer;color:inherit}[data-scroll]::-webkit-scrollbar{width:11px;height:11px}[data-scroll]::-webkit-scrollbar-thumb{background:rgba(122,47,224,.3);border-radius:9px;border:3px solid transparent;background-clip:content-box}</style><div style="position:fixed;inset:0;pointer-events:none;background:radial-gradient(58% 48% at 0 0,rgba(255,203,69,.48),transparent 65%),radial-gradient(58% 54% at 100% 0,rgba(122,47,224,.34),transparent 68%),radial-gradient(52% 50% at 0 100%,rgba(34,191,85,.28),transparent 68%),radial-gradient(52% 44% at 100% 100%,rgba(224,71,58,.28),transparent 68%)"></div><div style="position:relative;height:100vh;display:flex;flex-direction:column;overflow:hidden">${header()}<main data-scroll style="flex:1;min-height:0;overflow-y:auto">${content}</main>${picker()}</div>`;
}

function wire(root: HTMLElement): void {
  root.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]'); if (!target) return;
    switch (target.dataset.act) {
      case 'nav': state.section = (target.dataset.tab as State['section']) || 'today'; render(); break;
      case 'creative': state.activeCreativeId = target.dataset.id || ''; render(); break;
      case 'open-filter': state.picker = true; render(); break;
      case 'close-filter': state.picker = false; render(); break;
      case 'pick-filter': state.propertyFilter = target.dataset.id || 'all'; state.picker = false; render(); break;
      case 'stop': event.stopPropagation(); break;
    }
  });
}

async function boot(): Promise<void> {
  loadIcons(); const root = document.getElementById('app'); if (!root) return;
  wire(root); render();
  await requireSession(root, async () => {
    try {
      state.feed = await loadDealerMarketingFeed();
      state.activeCreativeId = state.feed.creatives.find((creative) => creative.localDate === todayIso())?.id
        ?? state.feed.creatives[0]?.id ?? '';
    } catch (error) { state.error = error instanceof Error ? error.message : 'Could not load Marketing.'; }
    state.loading = false; render();
  });
}

void boot();
