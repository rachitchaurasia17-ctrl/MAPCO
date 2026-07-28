import { initTeamShell } from './shell';

const pathMap: Record<string, string> = {
  '/admin/team.html': 'home',
  '/admin/map-studio.html': 'map-studio'
};

const path = window.location.pathname;
let section = pathMap[path] || 'home';

// Handle hash fragments for simple intra-page tabs if needed
if (path === '/admin/team.html' && window.location.hash) {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'properties' || hash === 'clients') {
    section = hash;
  }
}

const app = document.getElementById('app');
if (app) {
  initTeamShell(app, section);
}
