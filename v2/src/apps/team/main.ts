import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import { initTeamShell } from './shell';
import { requireSession } from '../../packages/data/session';

const pathMap: Record<string, string> = {
  '/admin/team.html': 'home',
  '/admin/map-studio.html': 'map-studio',
};

const path = window.location.pathname;
let section = pathMap[path] || 'home';

if (path === '/admin/team.html' && window.location.hash) {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'properties' || hash === 'clients') section = hash;
}

const app = document.getElementById('app');
if (app) {
  // In supabase mode this shows a login card until the dealer signs in;
  // in mock mode it proceeds straight to the workspace.
  void requireSession(app, () => initTeamShell(app, section));
}
