import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { propertyIntelligenceDevPlugin } from './vite-plugins/property-intelligence-dev';

export default defineConfig(({ mode }) => {
  // Google Maps keys may live in v2/.env(.local) OR the repo-root .env.local.
  // Merge both (v2 wins) and expose them explicitly so MAPCO Earth works
  // regardless of which location holds the keys, without changing envDir
  // (which would break the existing v2/.env vars, e.g. Supabase).
  const rootEnv = loadEnv(mode, resolve(__dirname, '..'), 'VITE_');
  const localEnv = loadEnv(mode, __dirname, 'VITE_');
  const merged = { ...rootEnv, ...localEnv };

  return {
    plugins: [propertyIntelligenceDevPlugin()],
    define: {
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(process.env.VITE_GOOGLE_MAPS_API_KEY || merged.VITE_GOOGLE_MAPS_API_KEY || ''),
      'import.meta.env.VITE_GOOGLE_MAPS_MAP_ID': JSON.stringify(process.env.VITE_GOOGLE_MAPS_MAP_ID || merged.VITE_GOOGLE_MAPS_MAP_ID || ''),
    },
    server: {
      // Authoritative hand-mapped roads live beside the MAPCO repository in
      // Desktop/google maps and are bundled by the Earth road-data glob.
      fs: {
        allow: [resolve(__dirname, '..'), resolve(__dirname, '..', '..', 'google maps')],
      },
    },
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
          dealerMarketing: resolve(__dirname, 'admin/marketing.html'),
          dealerOps: resolve(__dirname, 'admin/ops.html'),
          developer: resolve(__dirname, 'admin/developer.html'),
          // Internal AI operations surface. Not linked from the dealer nav.
          aiConsole: resolve(__dirname, 'admin/ai-console.html'),
          mapPilot: resolve(__dirname, 'app/map-pilot/index.html'),
          earth: resolve(__dirname, 'app/earth/index.html'),
          client: resolve(__dirname, 'client/index.html')
        }
      }
    }
  };
});
