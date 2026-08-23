/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Team Workspace Shell
   Top-bar nav shell + section routing
   Source: Team Workspace.dc.html
   ═══════════════════════════════════════════════════════════════ */
import { renderWorkHome } from './pages/home';
import { renderMapStudio } from './pages/map-studio';
import { renderTeamProperties } from './pages/properties';
import { renderTeamClients } from './pages/clients';

const NAV = [
  { key: 'home', label: 'Workspace', path: '/admin/team.html' },
  { key: 'properties', label: 'Properties', path: '/admin/team.html#properties' },
  { key: 'clients', label: 'Clients', path: '/admin/team.html#clients' },
  { key: 'map-studio', label: 'Map Studio', path: '/admin/map-studio.html' }
];

export function initTeamShell(container: HTMLElement, initialSection: string) {
  let currentSection = initialSection;
  let pendingAction: 'add-property' | 'add-client' | 'send-link' | null = null;

  // Include reset + tokens globally
  const head = document.head;
  if (!head.querySelector('#pm-styles')) {
    const style = document.createElement('style');
    style.id = 'pm-styles';
    style.innerHTML = `@import '/src/packages/ui/reset.css'; @import '/src/packages/ui/tokens.css';`;
    head.appendChild(style);
  }

  const sectionPath = (section: string) => {
    if (section === 'properties') return '/admin/team.html#properties';
    if (section === 'clients') return '/admin/team.html#clients';
    if (section === 'map-studio') return '/admin/map-studio.html';
    return '/admin/team.html';
  };

  const renderShell = () => {
  container.innerHTML = `
<div id="pm-ws-shell" style="position:fixed;inset:0;display:flex;flex-direction:column;background:#e7ddfb;background-image:radial-gradient(64% 52% at -2% -4%,rgba(123,78,224,.62),transparent 64%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.36),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.4),transparent 64%),radial-gradient(120% 120% at 55% 45%,rgba(139,96,232,.16),transparent 70%);font-family:'Hanken Grotesk',sans-serif;color:#241f1c">
  <div id="pm-ws-header" style="display:flex;align-items:center;gap:18px;padding:12px 22px;background:#fffaf0;background-image:linear-gradient(90deg,#fff6dd,#fffaf0 40%,#f6f0ff);border-bottom:1px solid #ddd2f5;box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 8px 22px -20px rgba(60,44,12,.9);z-index:40;flex:none">
    <a href="/admin/owner.html" style="display:flex;align-items:center;gap:10px;color:inherit;flex:none;text-decoration:none">
      <img src="/assets/mapco-logo.png" alt="MAPCO" style="width:52px;height:52px;display:block;flex:none;object-fit:contain">
      <span style="font-family:'Newsreader',serif;font-weight:600;font-size:20px;letter-spacing:-.01em">MAPCO</span>
    </a>
    <div style="display:flex;align-items:center;gap:4px;padding:4px;border-radius:14px;background:#f0eaff">
      ${NAV.map(n => `
        <a href="${n.path}" data-team-nav="${n.key}" style="${currentSection === n.key ? 'padding:8px 24px;border-radius:10px;font-size:15px;font-weight:700;background:#fff;color:#5b32c4;box-shadow:0 4px 10px -4px rgba(80,50,160,.4);text-decoration:none' : 'padding:8px 24px;border-radius:10px;font-size:15px;font-weight:600;color:#6d6380;text-decoration:none'}">
          ${n.label}
        </a>
      `).join('')}
    </div>
    <div style="flex:1"></div>
    <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:13px;background:#f0eaff;border:1px solid #dcd0f3">
      <span style="position:relative;width:8px;height:8px;flex:none;display:block"><span style="position:absolute;inset:0;border-radius:50%;background:#12a150"></span><span style="position:absolute;inset:0;border-radius:50%;background:#12a150;animation:wPulse 2.4s ease-out infinite"></span></span>
      <span style="font-size:13.5px;font-weight:700;color:#3a332c">Team login &middot; everything shared</span>
    </div>
  </div>
  <div data-scroll style="flex:1;min-height:0;overflow-y:auto;position:relative" id="pm-ws-content"></div>
</div>`;

  const content = container.querySelector<HTMLElement>('#pm-ws-content')!;
  const actions = {
    openProperty: () => navigate('properties', 'add-property'),
    openClient: () => navigate('clients', 'add-client'),
    openLink: () => navigate('clients', 'send-link'),
    navigate: (section: string) => navigate(section),
  };

    switch (currentSection) {
      case 'home': renderWorkHome(content, actions); break;
      case 'map-studio': renderMapStudio(content); break;
      case 'properties': void renderTeamProperties(content, pendingAction === 'add-property'); break;
      case 'clients': void renderTeamClients(content, pendingAction === 'add-client' ? 'add' : pendingAction === 'send-link' ? 'link' : null); break;
      default: renderWorkHome(content, actions); break;
    }
    pendingAction = null;

    container.querySelectorAll<HTMLAnchorElement>('[data-team-nav]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        navigate(link.dataset.teamNav || 'home');
      });
    });
  };

  const navigate = (section: string, action: typeof pendingAction = null) => {
    currentSection = section;
    pendingAction = action;
    window.history.pushState({ teamSection: section }, '', sectionPath(section));
    renderShell();
  };

  const syncFromLocation = () => {
    const hash = window.location.hash.replace(/^#/, '');
    currentSection = window.location.pathname === '/admin/map-studio.html'
      ? 'map-studio'
      : hash === 'properties' || hash === 'clients' ? hash : 'home';
    pendingAction = null;
    renderShell();
  };

  window.addEventListener('popstate', syncFromLocation);
  window.addEventListener('hashchange', syncFromLocation);
  renderShell();
}
