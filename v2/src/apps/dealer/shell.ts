import { getProfile, getInitials } from '../../packages/auth/auth';
import { formatDateShort } from '../../packages/ui/utils';
import { renderHome } from './pages/home';
import { renderDeals } from './pages/deals';
import { renderProperties } from './pages/properties';
import { renderCustomers } from './pages/customers';
import { renderLinks } from './pages/links';
import { renderAreaIntelligence } from './pages/area-intelligence';
import { renderPropertyInsights } from './pages/property-insights';
import { renderDemand } from './pages/demand';
import { adapter } from '../../packages/data/adapter';

const NAV = [
  { key: 'areas', label: 'Home', icon: 'ph ph-house', iconFill: 'ph-fill ph-house', badge: '', path: '/admin/owner.html' },
  { key: 'deals', label: 'My Deals', icon: 'ph ph-handshake', iconFill: 'ph-fill ph-handshake', badge: '', path: '/admin/deals.html' },
  { key: 'properties', label: 'My Plots', icon: 'ph ph-buildings', iconFill: 'ph-fill ph-buildings', badge: '', path: '/admin/properties.html' },
  { key: 'clients', label: 'My Customers', icon: 'ph ph-users-three', iconFill: 'ph-fill ph-users-three', badge: '', path: '/admin/clients.html' },
  { key: 'links', label: 'Client Links', icon: 'ph ph-paper-plane-tilt', iconFill: 'ph-fill ph-paper-plane-tilt', badge: '3', path: '/admin/owner.html#links' }
];

export const SECMETA: Record<string, {name:string, icon:string}> = {
  'areas': {name: 'Home', icon: 'ph-fill ph-house'},
  'deals': {name: 'My Deals', icon: 'ph-fill ph-handshake'},
  'properties': {name: 'My Plots', icon: 'ph-fill ph-buildings'},
  'clients': {name: 'My Customers', icon: 'ph-fill ph-users-three'},
  'demand': {name: 'Demand Pipeline', icon: 'ph-fill ph-list-magnifying-glass'},
  'links': {name: 'Client Links', icon: 'ph-fill ph-paper-plane-tilt'},
  'area-intelligence': {name: 'Area Intelligence', icon: 'ph-fill ph-chart-polar'},
  'property-insights': {name: 'Property Insights', icon: 'ph-fill ph-lightbulb'}
};

export async function initDealerShell(container: HTMLElement, initialSection: string) {
  let currentSection = initialSection;
  const profile = getProfile();
  const initials = getInitials(profile.name || profile.dealerName);
  if (!SECMETA[currentSection]) currentSection = 'areas';

  const dealsResult = await adapter.deals.list({ limit: 100 });
  const activeDealCount = dealsResult.ok
    ? dealsResult.value.items.filter((deal) => deal.stage !== 'closed').length
    : 0;

  const head = document.head;
  if (!head.querySelector('#pm-styles')) {
    const style = document.createElement('style');
    style.id = 'pm-styles';
    style.innerHTML = `@import '/src/packages/ui/reset.css'; @import '/src/packages/ui/tokens.css';`;
    head.appendChild(style);
  }

  container.innerHTML = `
<div id="pm-dash-shell" style="display:flex;height:100vh;min-height:0;width:100%;overflow:hidden;background:#f5efff;background-image:radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%)">


  <aside id="pm-dash-sidebar" style="width:270px;flex:none;height:100%;min-height:0;overflow:hidden;background:rgba(252,250,255,.82);background-image:linear-gradient(180deg,rgba(253,251,255,.95),rgba(243,236,255,.76) 55%,rgba(236,227,255,.66));backdrop-filter:blur(16px);box-shadow:inset -1px 0 0 rgba(88,52,168,.14);display:flex;flex-direction:column;border-right:1px solid #ddd2f5">
    <div style="display:flex;align-items:center;gap:12px;padding:26px 24px 18px">
      <svg viewBox="0 0 40 40" style="width:40px;height:40px;flex:none;display:block">
        <rect x="0" y="0" width="40" height="40" rx="12" fill="#241d0c"></rect>
        <path d="M20 8.5 L33 16 L20 23.5 L7 16 Z" fill="#ffc93c"></path>
        <path d="M7 22 L20 29.5 L33 22 L33 25.5 L20 33 L7 25.5 Z" fill="#f4ae14" opacity="0.55"></path>
        <circle cx="20" cy="16" r="3.6" fill="#241d0c"></circle>
      </svg>
      <div style="font-weight:800;font-size:22px;letter-spacing:-.02em;color:#1f1a12">Plot<span style="color:#c2622a">Map</span></div>
    </div>
    <nav data-scroll style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:4px;padding:6px 16px 8px">
      ${NAV.map(n => {
        const badge = n.key === 'deals' && activeDealCount ? String(activeDealCount) : '';
        return `
        <a href="${n.path}" data-section="${n.key}" style="${currentSection === n.key ? 'width:100%;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;transition:background .15s;background:#ffc93c;color:#1f1a12;box-shadow:inset 3px 0 0 #f4ae14;text-decoration:none' : 'width:100%;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;transition:background .15s;color:#6b6156;text-decoration:none'}" onmouseover="if(this.dataset.section!=='${currentSection}'){this.style.background='#fdefc9';this.style.color='#1f1a12';}" onmouseout="if(this.dataset.section!=='${currentSection}'){this.style.background='transparent';this.style.color='#6b6156';}" >
          <i class="${currentSection === n.key ? n.iconFill : n.icon}" style="font-size:23px;line-height:1;width:26px;text-align:center"></i>
          <span style="font-size:16.5px;font-weight:700;letter-spacing:-.01em">${n.label}</span>
          ${badge ? `<span style="margin-left:auto;background:${currentSection === n.key ? '#c2185b' : '#fff2cf'};color:${currentSection === n.key ? '#fff' : '#a8792a'};font-size:12.5px;font-weight:800;border-radius:999px;padding:2px 10px">${badge}</span>` : ``}
        </a>
      `}).join('')}
    </nav>
    <div style="flex:none;padding:14px 18px 10px">
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#9a8f7c;text-transform:uppercase;padding:0 4px 9px">With a customer?</div>
      <a href="/app/plotmap/index.html" style="width:100%;display:flex;align-items:center;gap:13px;padding:16px 16px;border-radius:16px;background:#f0a83c;color:#3a2410;text-align:left;text-decoration:none;box-shadow:0 10px 26px -12px rgba(0,0,0,.6);animation:omGlow 3.4s ease-in-out infinite" onmouseover="this.style.background='#ffb84a'" onmouseout="this.style.background='#f0a83c'">
        <i class="ph-fill ph-projector-screen-chart" style="font-size:26px"></i>
        <span style="display:block"><span style="display:block;font-size:15.5px;font-weight:800;letter-spacing:-.01em">Show Map to Customer</span><span style="display:block;font-size:12.5px;font-weight:700;color:#8a5a12">Opens the full-screen map</span></span>
      </a>
    </div>
    <div style="position:relative;flex:none;display:flex;align-items:center;gap:12px;padding:12px 20px 16px;border-top:1px solid #ddd2f5">
      <div style="width:40px;height:40px;border-radius:50%;background:#f0a83c;color:#3a2410;display:grid;place-items:center;font-weight:800;font-size:15px;flex:none">${initials}</div>
      <div style="min-width:0;flex:1"><div style="font-size:14.5px;font-weight:700;color:#1f1a12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${profile.name}</div><div style="font-size:12.5px;color:#9a8f7c;font-weight:600">${profile.dealerName}</div></div>
      <button id="pm-dealer-settings" aria-label="Open dealer settings" aria-expanded="false" style="width:36px;height:36px;border-radius:11px;color:#9a8f7c;display:grid;place-items:center" onmouseenter="this.style.background='#f0eaff';this.style.color='#5b32c4'" onmouseleave="if(this.getAttribute('aria-expanded')!=='true'){this.style.background='transparent';this.style.color='#9a8f7c'}"><i class="ph ph-gear-six" style="font-size:20px"></i></button>
      <div id="pm-dealer-settings-pop" hidden style="position:absolute;left:18px;right:18px;bottom:72px;padding:10px;border-radius:16px;background:#fffaf0;border:1px solid #ddd2f5;box-shadow:0 24px 54px -24px rgba(30,20,8,.75);z-index:60">
        <div style="padding:9px 10px 7px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9a8f7c">Dealer settings</div>
        <button data-settings-act="profile" style="width:100%;display:flex;align-items:center;gap:10px;padding:11px 10px;border-radius:10px;color:#4c463d;text-align:left;font-weight:700"><i class="ph ph-user-circle" style="font-size:18px;color:#5b32c4"></i>Profile and business</button>
        <button data-settings-act="close" style="width:100%;display:flex;align-items:center;gap:10px;padding:11px 10px;border-radius:10px;color:#4c463d;text-align:left;font-weight:700"><i class="ph ph-x-circle" style="font-size:18px;color:#a8792a"></i>Close settings</button>
      </div>
    </div>
  </aside>

  

  <main id="pm-dash-main" style="flex:1;min-width:0;min-height:0;display:flex;flex-direction:column">
<header id="pm-dash-header" style="display:flex;align-items:center;gap:14px;padding:16px 40px;border-bottom:1px solid #ddd2f5;background:rgba(247,243,234,.86);backdrop-filter:blur(8px);position:sticky;top:0;z-index:30">
      <i class="${SECMETA[currentSection].icon}" style="font-size:21px;color:#d95d1e"></i>
      <span style="font-size:17px;font-weight:800;letter-spacing:-.01em;color:#2f2a2d">${SECMETA[currentSection].name}</span>
        <div style="display:flex;align-items:center;gap:8px;color:#6b6156;font-size:14.5px;font-weight:600"><i class="ph ph-calendar-blank" style="font-size:17px"></i>${formatDateShort()}</div>
      <div style="width:1px;height:22px;background:#e6cf9a"></div>
      <div style="display:flex;align-items:center;gap:8px;background:#e2f2e6;color:#186c3c;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:800"><span style="width:9px;height:9px;border-radius:50%;background:#12a150;animation:omGlow 1.8s ease-in-out infinite"></span>A client is on your map now</div>
      <div style="display:flex;align-items:center;gap:7px;background:#f3eeff;color:#a86a08;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700"><i class="ph-fill ph-seal-check" style="font-size:15px"></i>Trial &middot; 12 days left</div>
    </header>
    <div data-scroll style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden" id="pm-dash-content"></div>
  </main>
</div>
`;

  const content = document.getElementById('pm-dash-content')!;
  
  function renderSection() {
    content.innerHTML = '';
    switch (currentSection) {
      case 'areas': renderHome(content); break;
      case 'deals': renderDeals(content); break;
      case 'properties': renderProperties(content); break;
      case 'clients': renderCustomers(content); break;
      case 'links': renderLinks(content); break;
      case 'demand': renderDemand(content); break;
      case 'area-intelligence': renderAreaIntelligence(content); break;
      case 'property-insights': renderPropertyInsights(content); break;
      default: renderHome(content); break;
    }
  }

  renderSection();

  const settingsButton = container.querySelector<HTMLButtonElement>('#pm-dealer-settings');
  const settingsPop = container.querySelector<HTMLElement>('#pm-dealer-settings-pop');
  const closeSettings = () => {
    if (!settingsButton || !settingsPop) return;
    settingsPop.hidden = true;
    settingsButton.setAttribute('aria-expanded', 'false');
    settingsButton.style.background = 'transparent';
    settingsButton.style.color = '#9a8f7c';
  };
  settingsButton?.addEventListener('click', () => {
    if (!settingsPop) return;
    const opening = settingsPop.hidden;
    settingsPop.hidden = !opening;
    settingsButton.setAttribute('aria-expanded', String(opening));
    settingsButton.style.background = opening ? '#f0eaff' : 'transparent';
    settingsButton.style.color = opening ? '#5b32c4' : '#9a8f7c';
  });
  settingsPop?.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-settings-act]')?.dataset.settingsAct;
    if (action === 'close') closeSettings();
    if (action === 'profile') {
      settingsPop.innerHTML = `<div style="padding:12px"><div style="font-family:'Newsreader',serif;font-size:21px;color:#241d0c">${profile.name}</div><div style="margin-top:4px;font-size:14px;color:#6b6156">${profile.dealerName}</div><button data-settings-act="close" style="width:100%;margin-top:14px;padding:11px;border-radius:11px;background:#f0eaff;color:#5b32c4;font-weight:800">Done</button></div>`;
    }
  });

  const navEl = document.getElementById('pm-dash-shell');
  if (navEl) {
    navEl.addEventListener('click', (e) => {
      const a = (e.target as Element).closest('a');
      if (a && a.dataset.section) {
        e.preventDefault();
        window.history.pushState({}, '', a.getAttribute('href'));
        initDealerShell(container, a.dataset.section);
      }
    });
  }
}
