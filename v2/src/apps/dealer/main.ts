import '../../packages/ui/tokens.css';
import '../../packages/ui/reset.css';
import { initDealerShell } from './shell';
import { requireSession } from '../../packages/data/session';

const pathMap: Record<string, string> = {
  '/admin/owner.html': 'areas',
  '/admin/deals.html': 'deals',
  '/admin/properties.html': 'properties',
  '/admin/clients.html': 'clients',
  '/admin/area-intelligence.html': 'area-intelligence',
  '/admin/property-insights.html': 'property-insights',
};

// Sections reachable as a hash on an approved surface (no invented route).
// Demand is CRM data (doc 09) with no dedicated route in routes.json, so it
// is a section on /admin/owner.html#demand — the same pattern as #links.
const HASH_SECTIONS = new Set(['demand', 'links']);

const path = window.location.pathname;
const hash = window.location.hash.replace(/^#/, '');
const section = HASH_SECTIONS.has(hash) ? hash : (pathMap[path] || 'areas');

const app = document.getElementById('app');
if (app) {
  // supabase mode → login gate; mock mode → straight through.
  void requireSession(app, () => initDealerShell(app, section));
}
