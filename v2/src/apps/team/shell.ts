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
  { key: 'home', label: 'Workspace', path: '/admin/team.html' },
  { key: 'properties', label: 'Properties', path: '/admin/team.html#properties' },
  { key: 'clients', label: 'Clients', path: '/admin/team.html#clients' },
  { key: 'map-studio', label: 'Map Studio', path: '/admin/map-studio.html' }
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
<div id="pm-ws-shell" style="position:fixed;inset:0;display:flex;flex-direction:column;background:#f5efff;background-image:radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%);font-family:'Hanken Grotesk',sans-serif;color:#241f1c">
  <div id="pm-ws-header" style="display:flex;align-items:center;gap:18px;padding:12px 22px;background:#fffaf0;background-image:linear-gradient(90deg,#fff6dd,#fffaf0 40%,#f6f0ff);border-bottom:1px solid #ddd2f5;box-shadow:0 1px 0 rgba(255,255,255,.7) inset,0 8px 22px -20px rgba(60,44,12,.9);z-index:40;flex:none">
    <a href="/admin/owner.html" style="display:flex;align-items:center;gap:10px;color:inherit;flex:none;text-decoration:none">
      <svg viewBox="0 0 40 40" style="width:32px;height:32px;display:block;flex:none"><rect width="40" height="40" rx="11" fill="#ffc93c"></rect><path d="M20 8.5 L33 16 L20 23.5 L7 16 Z" fill="#241d0c"></path><path d="M7 22 L20 29.5 L33 22 L33 25.5 L20 33 L7 25.5 Z" fill="#241d0c" opacity="0.45"></path></svg>
      <span style="font-family:'Newsreader',serif;font-weight:600;font-size:20px;letter-spacing:-.01em">PlotMap</span>
    </a>
    <div style="display:flex;align-items:center;gap:4px;padding:4px;border-radius:14px;background:#f0eaff">
      ${NAV.map(n => `
        <a href="${n.path}" style="${currentSection === n.key ? 'padding:8px 24px;border-radius:10px;font-size:15px;font-weight:700;background:#fff;color:#5b32c4;box-shadow:0 4px 10px -4px rgba(80,50,160,.4);text-decoration:none' : 'padding:8px 24px;border-radius:10px;font-size:15px;font-weight:600;color:#6d6380;text-decoration:none'}">
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
