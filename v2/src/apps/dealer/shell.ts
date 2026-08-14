import { getProfile, getInitials } from '../../packages/auth/auth';
import { mountFullscreenButton } from '../../packages/ui/fullscreen';
import { mountBackButton } from '../../packages/ui/back-button';
import { formatDateShort } from '../../packages/ui/utils';
import { renderHome } from './pages/home';
import { renderDeals } from './pages/deals';
import { renderProperties } from './pages/properties';
import { renderCustomers } from './pages/customers';
import { renderLinks } from './pages/links';
import { renderAreaIntelligence } from './pages/area-intelligence';
import { renderPropertyInsights } from './pages/property-insights';
import { renderDemand } from './pages/demand';
import { activeDataMode, adapter } from '../../packages/data/adapter';
import { productRoutes } from '../../packages/ui/product-routes';
import { getSession } from '../../packages/data/session';
import { listAllRecords } from '../../packages/data/list-all';

const esc = (value: unknown): string => String(value ?? '').replace(
  /[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
);

/* Nav order and labels from the current design
   (design-latest/Dealer Dashboard.dc.html line 1440).
   Client Links is deliberately NOT a nav item any more — it lives inside
   Properties. Marketing is its own screen. */
const NAV = [
  { key: 'areas', label: 'Home', icon: 'ph-house', path: productRoutes.home },
  { key: 'properties', label: 'Properties', icon: 'ph-buildings', path: productRoutes.properties() },
  { key: 'deals', label: 'Deals', icon: 'ph-handshake', path: productRoutes.deals() },
  { key: 'clients', label: 'Customers', icon: 'ph-users-three', path: productRoutes.customers() },
  { key: 'marketing', label: 'Marketing', icon: 'ph-megaphone-simple', path: productRoutes.marketing() }
];

/* Nav item chrome, copied from the design's navItems view-model
   (Dealer Dashboard.dc.html, renderVals ~line 1438). */
const navItemStyle = (on: boolean): string =>
  `width:100%;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;text-align:left;text-decoration:none;transition:background .15s;${
    on ? 'background:#ffc93c;color:#1f1a12;box-shadow:inset 3px 0 0 #f4ae14' : 'background:transparent;color:#6b6156'}`;

const navBadgeStyle = (on: boolean): string =>
  `margin-left:auto;background:${on ? '#c2185b' : '#fff2cf'};color:${on ? '#fff' : '#a8792a'};font-size:12.5px;font-weight:800;border-radius:999px;padding:2px 10px`;

export const SECMETA: Record<string, {name:string, icon:string}> = {
  'areas': {name: 'Home', icon: 'ph-fill ph-house'},
  'deals': {name: 'Deals', icon: 'ph-fill ph-handshake'},
  'properties': {name: 'Properties', icon: 'ph-fill ph-buildings'},
  'clients': {name: 'Customers', icon: 'ph-fill ph-users-three'},
  'marketing': {name: 'Marketing', icon: 'ph-fill ph-megaphone-simple'},
  'demand': {name: 'Demand Pipeline', icon: 'ph-fill ph-list-magnifying-glass'},
  'links': {name: 'Client Links', icon: 'ph-fill ph-paper-plane-tilt'},
  'area-intelligence': {name: 'Area Intelligence', icon: 'ph-fill ph-chart-polar'},
  'property-insights': {name: 'Property Insights', icon: 'ph-fill ph-lightbulb'}
};

export function initDealerShell(container: HTMLElement, initialSection: string): void {
  let currentSection = initialSection;
  const productionData = activeDataMode() === 'supabase';
  const profile = productionData ? null : getProfile();
  let accountName = productionData ? 'Signed-in dealer' : (profile?.name || 'Dealer');
  const businessName = productionData ? 'Dealer workspace' : (profile?.dealerName || 'MAPCO');
  let initials = getInitials(accountName || businessName);
  if (!SECMETA[currentSection]) currentSection = 'areas';

  const head = document.head;
  if (!head.querySelector('#pm-styles')) {
    const style = document.createElement('style');
    style.id = 'pm-styles';
    style.innerHTML = `@import '/src/packages/ui/reset.css'; @import '/src/packages/ui/tokens.css';`;
    head.appendChild(style);
  }
  // Design hover states (style-hover="…" in Dealer Dashboard.dc.html).
  if (!head.querySelector('#pm-dash-hover')) {
    const hover = document.createElement('style');
    hover.id = 'pm-dash-hover';
    hover.textContent = `#pm-dash-sidebar a[data-nav-on="false"]:hover{background:#fdefc9;color:#1f1a12}`;
    head.appendChild(hover);
  }

  container.innerHTML = `
<div id="pm-dash-shell" style="display:flex;height:100vh;min-height:0;width:100%;overflow:hidden;background:#f5efff;background-image:radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%)">


  <aside id="pm-dash-sidebar" style="width:270px;flex:none;height:100%;min-height:0;overflow:hidden;background:rgba(252,250,255,.82);background-image:linear-gradient(180deg,rgba(253,251,255,.95),rgba(243,236,255,.76) 55%,rgba(236,227,255,.66));backdrop-filter:blur(16px);box-shadow:inset -1px 0 0 rgba(88,52,168,.14);display:flex;flex-direction:column;border-right:1px solid #ddd2f5">
    <div style="display:flex;align-items:center;gap:12px;padding:26px 24px 18px">
      <img src="/assets/mapco-logo.png" alt="MAPCO" style="width:40px;height:40px;flex:none;display:block;object-fit:contain">
      <div style="font-weight:800;font-size:22px;letter-spacing:-.02em;color:#1f1a12">MAPCO</div>
    </div>
    <nav data-scroll style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:4px;padding:6px 16px 8px">
      ${NAV.map((n) => {
        const on = currentSection === n.key;
        return `
        <a href="${n.path}" data-section="${n.key}" data-nav-on="${on}" style="${navItemStyle(on)}">
          <i class="${on ? 'ph-fill ' : 'ph '}${n.icon}" style="font-size:23px;line-height:1;width:26px;text-align:center"></i>
          <span style="font-size:16.5px;font-weight:700;letter-spacing:-.01em">${n.label}</span>
          ${n.key === 'deals' ? `<span data-deal-count hidden style="${navBadgeStyle(on)}"></span>` : ``}
        </a>
      `}).join('')}
    </nav>
    <div style="flex:none;padding:14px 18px 10px">
      <div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#9a8f7c;text-transform:uppercase;padding:0 4px 9px">With a customer?</div>
      <a href="${productRoutes.presentation()}" style="width:100%;display:flex;align-items:center;gap:13px;padding:16px 16px;border-radius:16px;background:#f0a83c;color:#3a2410;text-align:left;text-decoration:none;box-shadow:0 10px 26px -12px rgba(0,0,0,.6);animation:omGlow 3.4s ease-in-out infinite" onmouseover="this.style.background='#ffb84a'" onmouseout="this.style.background='#f0a83c'">
        <i class="ph-fill ph-projector-screen-chart" style="font-size:26px"></i>
        <span style="display:block"><span style="display:block;font-size:15.5px;font-weight:800;letter-spacing:-.01em">Show Map to Customer</span><span style="display:block;font-size:12.5px;font-weight:700;color:#8a5a12">Opens the full-screen map</span></span>
      </a>
    </div>
    <div style="position:relative;flex:none;display:flex;align-items:center;gap:12px;padding:12px 20px 16px;border-top:1px solid #ddd2f5">
      <div data-dealer-initials style="width:40px;height:40px;border-radius:50%;background:#f0a83c;color:#3a2410;display:grid;place-items:center;font-weight:800;font-size:15px;flex:none">${esc(initials)}</div>
      <div style="min-width:0;flex:1"><div data-dealer-account-name style="font-size:14.5px;font-weight:700;color:#1f1a12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(accountName)}</div><div style="font-size:12.5px;color:#9a8f7c;font-weight:600">${esc(businessName)}</div></div>
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
      <span id="pm-dash-back"></span>
      <i class="${SECMETA[currentSection].icon}" style="font-size:21px;color:#d95d1e"></i>
      <span style="font-size:17px;font-weight:800;letter-spacing:-.01em;color:#2f2a2d">${SECMETA[currentSection].name}</span>
      <div style="display:flex;align-items:center;gap:8px;color:#6b6156;font-size:14.5px;font-weight:600"><i class="ph ph-calendar-blank" style="font-size:17px"></i>${formatDateShort()}</div>
      <div style="width:1px;height:22px;background:#e6cf9a"></div>
      <span data-account-chip hidden style="display:flex;align-items:center;gap:7px;background:#f3eeff;color:#a86a08;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700"><i class="ph-fill ph-seal-check" style="font-size:15px"></i><span data-account-chip-text></span></span>
      <div style="flex:1"></div>
      <span id="pm-dash-fs"></span>
    </header>
    <div data-scroll style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden" id="pm-dash-content"></div>
  </main>
</div>
`;

  const fsHost = container.querySelector<HTMLElement>('#pm-dash-fs');
  if (fsHost) mountFullscreenButton(fsHost, { variant: 'bar' });

  // Subtle Back on dealer subpages → Dealer Home (in-shell, preserves fullscreen).
  const backHost = container.querySelector<HTMLElement>('#pm-dash-back');
  if (backHost && currentSection !== 'areas') {
    mountBackButton(backHost, {
      variant: 'bar', label: 'Back to home',
      onBack: () => { window.history.pushState({}, '', productRoutes.home); initDealerShell(container, 'areas'); return true; },
    });
  }

  const content = container.querySelector<HTMLElement>('#pm-dash-content')!;
  
  function renderSection() {
    content.innerHTML = '';
    const protect = (rendering: Promise<void>, label: string) => {
      void rendering.catch(() => {
        content.innerHTML = `<div role="alert" style="max-width:1080px;margin:34px auto;padding:24px 26px;border-radius:18px;background:#ffe1e6;color:#9f2446">${label} could not be loaded. Please try again.</div>`;
      });
    };
    switch (currentSection) {
      case 'areas': protect(renderHome(content), 'Home'); break;
      case 'deals': protect(renderDeals(content), 'Deals'); break;
      case 'properties': protect(renderProperties(content), 'Properties'); break;
      case 'clients': protect(renderCustomers(content), 'Customers'); break;
      case 'links': protect(renderLinks(content), 'Client Links'); break;
      case 'demand': renderDemand(content); break;
      case 'area-intelligence': renderAreaIntelligence(content); break;
      case 'property-insights': protect(renderPropertyInsights(content), 'Property readiness'); break;
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
      settingsPop.innerHTML = `<div style="padding:12px"><div data-dealer-profile-account style="font-family:'Newsreader',serif;font-size:21px;color:#241d0c">${esc(accountName)}</div><div style="margin-top:4px;font-size:14px;color:#6b6156">${esc(businessName)}</div><button data-settings-act="close" style="width:100%;margin-top:14px;padding:11px;border-radius:11px;background:#f0eaff;color:#5b32c4;font-weight:800">Done</button></div>`;
    }
  });

  const navEl = container.querySelector<HTMLElement>('#pm-dash-shell');
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

  const isCurrentShell = () => container.querySelector('#pm-dash-shell') === navEl;

  async function hydrateDealerIdentity(): Promise<void> {
    try {
      const dealerSession = await getSession();
      if (!dealerSession?.email || !isCurrentShell()) return;
      accountName = dealerSession.email;
      initials = getInitials(accountName || businessName);
      const accountNameEl = navEl?.querySelector<HTMLElement>('[data-dealer-account-name]');
      const profileAccountEl = navEl?.querySelector<HTMLElement>('[data-dealer-profile-account]');
      const initialsEl = navEl?.querySelector<HTMLElement>('[data-dealer-initials]');
      if (accountNameEl) accountNameEl.textContent = accountName;
      if (profileAccountEl) profileAccountEl.textContent = accountName;
      if (initialsEl) initialsEl.textContent = initials;
    } catch { /* keep the neutral signed-in label; route content remains usable */ }
  }

  async function hydrateDealCount(): Promise<void> {
    try {
      const dealsResult = await listAllRecords((params, opts) => adapter.deals.list(params, opts));
      if (!dealsResult.ok || !isCurrentShell()) return;
      const badge = navEl?.querySelector<HTMLElement>('[data-deal-count]');
      if (!badge) return;
      // Deals are completed sales; only show the badge after the real register is known.
      badge.textContent = String(dealsResult.value.length);
      badge.hidden = dealsResult.value.length === 0;
    } catch { /* shell stays usable; the Deals page owns its visible error state */ }
  }

  /* The design's "Trial · N days left" chip. Driven by the real
     AccountState contract (adapter.auth.getAccountState) rather than a
     fixed number, so whatever the Developer Control panel provisions is
     what a dealer sees. Hidden entirely on an active paid account. */
  async function hydrateAccountChip(): Promise<void> {
    try {
      const accountResult = await adapter.auth.getAccountState();
      if (!accountResult.ok || !isCurrentShell()) return;
      const account = accountResult.value;
      const label = account.kind === 'trial' || account.kind === 'trial-ending'
        ? `Trial · ${account.daysLeft} day${account.daysLeft === 1 ? '' : 's'} left`
        : account.kind === 'expired' ? 'Subscription expired'
        : account.kind === 'suspended' ? 'Account suspended'
        : '';
      if (!label) return;
      const chip = navEl?.querySelector<HTMLElement>('[data-account-chip]');
      const text = navEl?.querySelector<HTMLElement>('[data-account-chip-text]');
      if (!chip || !text) return;
      text.textContent = label;
      if (account.kind !== 'trial') {
        chip.style.background = '#ffe1e6';
        chip.style.color = '#c2185b';
      }
      chip.hidden = false;
    } catch { /* the chip is informational; the workspace stays usable without it */ }
  }

  if (productionData) void hydrateDealerIdentity();
  void hydrateDealCount();
  void hydrateAccountChip();
}
