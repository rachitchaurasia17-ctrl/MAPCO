import { initDealerShell } from './shell';

const pathMap: Record<string, string> = {
  '/admin/owner.html': 'areas',
  '/admin/deals.html': 'deals',
  '/admin/properties.html': 'properties',
  '/admin/clients.html': 'clients',
  '/admin/area-intelligence.html': 'area-intelligence',
  '/admin/property-insights.html': 'property-insights',
};

const path = window.location.pathname;
const section = pathMap[path] || 'areas';

const app = document.getElementById('app');
if (app) {
  initDealerShell(app, section);
}
