import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dealerOwner: resolve(__dirname, 'admin/owner.html'),
        dealerAreaIntelligence: resolve(__dirname, 'admin/area-intelligence.html'),
        dealerPropertyInsights: resolve(__dirname, 'admin/property-insights.html'),
        dealerTeam: resolve(__dirname, 'admin/team.html'),
        dealerProperties: resolve(__dirname, 'admin/properties.html'),
        dealerClients: resolve(__dirname, 'admin/clients.html'),
        dealerDeals: resolve(__dirname, 'admin/deals.html'),
        dealerMapStudio: resolve(__dirname, 'admin/map-studio.html'),
        developer: resolve(__dirname, 'admin/developer.html'),
        presentation: resolve(__dirname, 'app/plotmap/index.html'),
        client: resolve(__dirname, 'client/index.html')
      }
    }
  }
});
