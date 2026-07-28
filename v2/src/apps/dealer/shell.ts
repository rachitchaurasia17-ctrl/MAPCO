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

const NAV = [
  { key: 'areas', label: 'Home', icon: 'ph-house', iconFill: 'ph-fill ph-house', badge: '', path: '/admin/owner.html' },
  { key: 'deals', label: 'My Deals', icon: 'ph-handshake', iconFill: 'ph-fill ph-handshake', badge: '4', path: '/admin/deals.html' },
  { key: 'properties', label: 'My Plots', icon: 'ph-buildings', iconFill: 'ph-fill ph-buildings', badge: '', path: '/admin/properties.html' },
  { key: 'clients', label: 'My Customers', icon: 'ph-users-three', iconFill: 'ph-fill ph-users-three', badge: '', path: '/admin/clients.html' },
  { key: 'demand', label: 'Demand', icon: 'ph-list-magnifying-glass', iconFill: 'ph-fill ph-list-magnifying-glass', badge: '', path: '/admin/demand.html' },
  { key: 'links', label: 'Client Links', icon: 'ph-paper-plane-tilt', iconFill: 'ph-fill ph-paper-plane-tilt', badge: '3', path: '/admin/owner.html#links' }, // or something else
  { key: 'area-intelligence', label: 'Area Intelligence', icon: 'ph-map-pin', iconFill: 'ph-fill ph-map-pin', badge: '', path: '/admin/area-intelligence.html' },
  { key: 'property-insights', label: 'Property Insights', icon: 'ph-trend-up', iconFill: 'ph-fill ph-trend-up', badge: '', path: '/admin/property-insights.html' },
  { key: 'team', label: 'Team Workspace', icon: 'ph-users', iconFill: 'ph-fill ph-users', badge: '', path: '/admin/team.html' }
];

const SECMETA: Record<string, { name: string; icon: string }> = {
  areas: { name: 'Home', icon: 'ph-fill ph-house' },
  deals: { name: 'My Deals', icon: 'ph-fill ph-handshake' },
  properties: { name: 'My Plots', icon: 'ph-fill ph-buildings' },
  clients: { name: 'My Customers', icon: 'ph-fill ph-users-three' },
  demand: { name: 'Demand Pipeline', icon: 'ph-fill ph-list-magnifying-glass' },
  links: { name: 'Client Links', icon: 'ph-fill ph-paper-plane-tilt' },
  'area-intelligence': { name: 'Area Intelligence', icon: 'ph-fill ph-map-pin' },
  'property-insights': { name: 'Property Insights', icon: 'ph-fill ph-trend-up' }
};

let currentSection = 'areas';

function renderSection(content: HTMLElement) {
  const section = currentSection;
  content.innerHTML = '';
  switch (section) {
    case 'areas': renderHome(content); break;
    case 'deals': renderDeals(content); break;
    case 'properties': renderProperties(content); break;
    case 'clients': renderCustomers(content); break;
    case 'demand': renderDemand(content); break;
    case 'links': renderLinks(content); break;
    case 'area-intelligence': renderAreaIntelligence(content); break;
    case 'property-insights': renderPropertyInsights(content); break;
    default: renderHome(content); break;
  }
}

export function initDealerShell(container: HTMLElement, initialSection: string) {
  const profile = getProfile();
  const initials = getInitials(profile.name);
  currentSection = initialSection;
  if (!SECMETA[currentSection]) currentSection = 'areas';

  // Include reset + tokens globally
  const head = document.head;
  if (!head.querySelector('#pm-styles')) {
    const style = document.createElement('style');
    style.id = 'pm-styles';
    style.innerHTML = `@import '/src/packages/ui/reset.css'; @import '/src/packages/ui/tokens.css';`;
    head.appendChild(style);
  }

  container.innerHTML = `
<style>
  .pm-dash{display:flex;height:100vh;min-height:0;width:100%;overflow:hidden;background:#f5efff;background-image:var(--pm-bloom);background-attachment:fixed}
  .pm-dash-side{width:270px;flex:none;height:100%;min-height:0;overflow:hidden;background:rgba(252,250,255,.82);background-image:linear-gradient(180deg,rgba(253,251,255,.95),rgba(243,236,255,.76) 55%,rgba(236,227,255,.66));backdrop-filter:blur(16px);box-shadow:inset -1px 0 0 rgba(88,52,168,.14);display:flex;flex-direction:column;border-right:1px solid #ddd2f5}
  .pm-dash-nav-btn{width:100%;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;transition:background .12s,color .12s;color:#6b6156;text-decoration:none}
  .pm-dash-nav-btn:hover{background:#fdefc9;color:#1f1a12}
  .pm-dash-nav-btn.active{background:#ffc93c;color:#1f1a12;box-shadow:inset 0 1px 2px rgba(0,0,0,.08)}
  .pm-dash-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
  .pm-dash-header{display:flex;align-items:center;gap:14px;padding:16px 40px;border-bottom:1px solid #ddd2f5;background:rgba(247,243,234,.86);backdrop-filter:blur(8px);position:sticky;top:0;z-index:30;flex-wrap:wrap}
  .pm-dash-content{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden}
  .pm-dash-cta{width:100%;display:flex;align-items:center;gap:13px;padding:16px;border-radius:16px;background:#f0a83c;color:#3a2410;text-align:left;text-decoration:none;box-shadow:0 10px 26px -12px rgba(0,0,0,.6);animation:omGlow 3.4s ease-in-out infinite}
  .pm-dash-cta:hover{background:#ffb84a}
  @media(max-width:768px){
    .pm-dash-side{width:72px}
    .pm-dash-side .pm-side-label,.pm-dash-side .pm-side-badge,.pm-dash-side .pm-side-owner,.pm-dash-side .pm-side-cta-text{display:none!important}
    .pm-dash-nav-btn{justify-content:center;padding:14px}
    .pm-dash-header{padding:14px 20px}
  }
</style>
<div class="pm-dash">
  <aside class="pm-dash-side">
    <div style="display:flex;align-items:center;gap:12px;padding:26px 24px 18px">
      <svg viewBox="0 0 40 40" style="width:40px;height:40px;flex:none;display:block">
        <rect x="0" y="0" width="40" height="40" rx="12" fill="#241d0c"></rect>
        <path d="M20 8.5 L33 16 L20 23.5 L7 16 Z" fill="#ffc93c"></path>
        <path d="M7 22 L20 29.5 L33 22 L33 25.5 L20 33 L7 25.5 Z" fill="#f4ae14" opacity="0.55"></path>
        <circle cx="20" cy="16" r="3.6" fill="#241d0c"></circle>
      </svg>
      <div class="pm-side-label" style="font-weight:800;font-size:22px;letter-spacing:-.02em;color:#1f1a12">Plot<span style="color:#c2622a">Map</span></div>
    </div>
    <nav data-scroll style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:4px;padding:6px 16px 8px" id="pm-dash-nav">
      ${NAV.map(n => `
      <a href="${n.path}" class="pm-dash-nav-btn ${currentSection === n.key ? 'active' : ''}" data-section="${n.key}">
        <i class="${currentSection === n.key ? n.iconFill : n.icon}" style="font-size:23px;line-height:1;width:26px;text-align:center"></i>
        <span class="pm-side-label" style="font-size:16.5px;font-weight:700;letter-spacing:-.01em">${n.label}</span>
        ${n.badge ? `<span class="pm-side-badge" style="margin-left:auto;font-size:12px;font-weight:800;padding:3px 9px;border-radius:999px;background:${currentSection === n.key ? 'rgba(0,0,0,.12)' : '#efe8fb'};color:${currentSection === n.key ? '#1f1a12' : '#5b32c4'}">${n.badge}</span>` : ''}
      </a>`).join('')}
    </nav>
    <div style="flex:none;padding:14px 18px 10px">
      <div class="pm-side-label" style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#9a8f7c;text-transform:uppercase;padding:0 4px 9px">With a customer?</div>
      <a href="/app/plotmap/index.html" class="pm-dash-cta">
        <i class="ph-fill ph-projector-screen-chart" style="font-size:26px"></i>
        <span class="pm-side-cta-text" style="display:block"><span style="display:block;font-size:15.5px;font-weight:800;letter-spacing:-.01em">Show Map to Customer</span><span style="display:block;font-size:12.5px;font-weight:700;color:#8a5a12">Opens the full-screen map</span></span>
      </a>
    </div>
    <div style="flex:none;display:flex;align-items:center;gap:12px;padding:12px 20px 16px;border-top:1px solid #ddd2f5">
      <div style="width:40px;height:40px;border-radius:50%;background:#f0a83c;color:#3a2410;display:grid;place-items:center;font-weight:800;font-size:15px;flex:none">${initials}</div>
      <div class="pm-side-owner" style="min-width:0;flex:1"><div style="font-size:14.5px;font-weight:700;color:#1f1a12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${profile.name}</div><div style="font-size:12.5px;color:#9a8f7c;font-weight:600">${profile.dealerName}</div></div>
      <i class="ph ph-gear-six pm-side-label" style="font-size:20px;color:#9a8f7c"></i>
    </div>
  </aside>

  <main class="pm-dash-main">
    <header class="pm-dash-header" id="pm-dash-header">
      <i class="${SECMETA[currentSection].icon}" style="font-size:21px;color:#d95d1e"></i>
      <span style="font-size:17px;font-weight:800;letter-spacing:-.01em;color:#2f2a2d" id="pm-dash-sec-name">${SECMETA[currentSection].name}</span>
      <div style="display:flex;align-items:center;gap:8px;color:#6b6156;font-size:14.5px;font-weight:600"><i class="ph ph-calendar-blank" style="font-size:17px"></i>${formatDateShort()}</div>
      <div style="width:1px;height:22px;background:#e6cf9a"></div>
      <div style="display:flex;align-items:center;gap:8px;background:#e2f2e6;color:#186c3c;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:800"><span style="width:9px;height:9px;border-radius:50%;background:#12a150;animation:omGlow 1.8s ease-in-out infinite"></span>A client is on your map now</div>
    </header>
    <div class="pm-dash-content" data-scroll id="pm-dash-content"></div>
  </main>
</div>`;

  const content = document.getElementById('pm-dash-content')!;
  renderSection(content);
}
