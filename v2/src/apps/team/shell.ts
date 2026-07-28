/* ═══════════════════════════════════════════════════════════════
   PlotMap V2 — Team Workspace Shell
   Top-bar nav shell + section routing
   Source: Team Workspace.dc.html
   ═══════════════════════════════════════════════════════════════ */
import { renderWorkHome } from './pages/home';
import { renderMapStudio } from './pages/map-studio';
import { renderTeamProperties } from './pages/properties';
import { renderTeamClients } from './pages/clients';

const NAV = [
  { key: 'home', label: 'Work Table', path: '/admin/team.html' },
  { key: 'map-studio', label: 'Map Studio', path: '/admin/map-studio.html' },
  { key: 'properties', label: 'Properties', path: '/admin/team.html#properties' }, // For simplicity right now, or separate if needed
  { key: 'clients', label: 'Clients', path: '/admin/team.html#clients' },
];

export function initTeamShell(container: HTMLElement, initialSection: string) {
  let currentSection = initialSection;

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
  .pm-ws{display:flex;flex-direction:column;height:100vh;min-height:0;width:100%;overflow:hidden;background:#faf9fc;background-image:var(--pm-bloom);background-attachment:fixed}
  .pm-ws-header{flex:none;display:flex;align-items:center;padding:12px 24px;background:rgba(252,250,255,.82);backdrop-filter:blur(16px);border-bottom:1px solid #ddd2f5;box-shadow:0 1px 2px rgba(88,52,168,.04)}
  .pm-ws-nav{display:flex;align-items:center;background:rgba(0,0,0,.04);padding:4px;border-radius:12px;margin:0 auto}
  .pm-ws-nav-btn{padding:8px 24px;font-size:14.5px;font-weight:700;color:#6b6156;border-radius:9px;transition:background .12s,color .12s;text-decoration:none}
  .pm-ws-nav-btn:hover{color:#1f1a12}
  .pm-ws-nav-btn.active{background:#fff;color:#5b32c4;box-shadow:0 2px 8px -2px rgba(88,52,168,.15)}
  .pm-ws-content{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden}
</style>
<div class="pm-ws">
  <header class="pm-ws-header">
    <div style="flex:1;display:flex;align-items:center;gap:12px">
      <svg viewBox="0 0 40 40" style="width:32px;height:32px;flex:none;display:block">
        <rect x="0" y="0" width="40" height="40" rx="10" fill="#241d0c"></rect>
        <path d="M20 8.5 L33 16 L20 23.5 L7 16 Z" fill="#ffc93c"></path>
        <path d="M7 22 L20 29.5 L33 22 L33 25.5 L20 33 L7 25.5 Z" fill="#f4ae14" opacity="0.55"></path>
      </svg>
      <div style="font-weight:800;font-size:18px;letter-spacing:-.02em;color:#1f1a12">Plot<span style="color:#c2622a">Map</span> <span style="color:#9a8f7c;font-weight:600">Workspace</span></div>
    </div>
    
    <nav class="pm-ws-nav">
      ${NAV.map(n => `
      <a href="${n.path}" class="pm-ws-nav-btn ${currentSection === n.key ? 'active' : ''}">
        ${n.label}
      </a>`).join('')}
    </nav>
    
    <div style="flex:1;display:flex;justify-content:flex-end;align-items:center;gap:16px">
      <a href="/admin/owner.html" style="font-size:14px;font-weight:700;color:#5b32c4;text-decoration:none">Back to Dashboard</a>
    </div>
  </header>
  <main class="pm-ws-content" data-scroll id="pm-ws-content"></main>
</div>`;

  const content = document.getElementById('pm-ws-content')!;
  
  function renderSection() {
    content.innerHTML = '';
    switch (currentSection) {
      case 'home': renderWorkHome(content); break;
      case 'map-studio': renderMapStudio(content); break;
      case 'properties': renderTeamProperties(content); break;
      case 'clients': renderTeamClients(content); break;
      default: renderWorkHome(content); break;
    }
  }

  renderSection();
}
