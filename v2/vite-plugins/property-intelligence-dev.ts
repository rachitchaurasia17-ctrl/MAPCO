/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Vite dev middleware (local-live)
   ---------------------------------------------------------------
   The LOCAL stand-in for the production Supabase Edge Function. It runs
   the SAME runtime-neutral core pipeline (packages/property-intelligence)
   with the real secrets kept server-side (never shipped to the browser):
     • Gemini via Vertex AI + ADC (gcloud application-default token)
     • Google Places (New) + Google Routes via GOOGLE_MAPS_SERVER_KEY
   Persistence is a durable local file cache keyed by the full cache
   identity (dealer+property+coordinate+updatedAt+schema+provider/model),
   so a browser refresh returns the cached result at zero API cost — the
   same contract the production property_intelligence table provides.

   Endpoints (same-origin, dev only):
     POST /api/property-intelligence        → ViewModel (cached or fresh)
     POST /api/property-intelligence/route  → { encodedPolyline, distance, duration }
   ═══════════════════════════════════════════════════════════════ */
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import {
  runPropertyIntelligence, GeminiMapsDiscoveryProvider, GooglePlacesResolver,
  GoogleRoutesClient, parseRoadFeatureCollection, computeInputDigest,
  type RoadGeometry, type GeoPoint, type PipelineDeps, type PropertyIntelligenceViewModel,
  type RunUsage,
} from '../src/packages/property-intelligence/index.ts';

const VERTEX = { project: 'mapco-504912', location: 'global', model: 'gemini-3.6-flash' };

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
    }
  } catch { /* ignore */ }
  return out;
}

interface ServerConfig {
  mapsKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  roads: RoadGeometry[];
  cacheDir: string;
}

function buildConfig(root: string): ServerConfig {
  const repo = resolve(root, '..');
  const secret = loadEnv(join(repo, 'supabase', '.env.local'));
  const sb = loadEnv(join(repo, 'supabase', '.env'));
  const roadsDir = join(root, 'src', 'apps', 'earth', 'data', 'roads');
  const roads: RoadGeometry[] = [];
  try {
    for (const file of readdirSync(roadsDir).filter((f) => f.endsWith('.geojson'))) {
      const parsed = parseRoadFeatureCollection(readFileSync(join(roadsDir, file), 'utf8'), file);
      if (parsed) roads.push(parsed);
    }
  } catch { /* roads optional */ }
  const cacheDir = join(root, '.pi-cache');
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
  return {
    mapsKey: secret.GOOGLE_MAPS_SERVER_KEY ?? '',
    supabaseUrl: (sb.SUPABASE_URL ?? '').replace(/\/$/, ''),
    supabaseAnonKey: sb.SUPABASE_ANON_KEY ?? '',
    roads, cacheDir,
  };
}

/* ── ADC token (gcloud), cached ~40 min ─────────────────────────── */
let tokenCache = { value: '', at: 0 };
function adcToken(): string {
  if (tokenCache.value && Date.now() - tokenCache.at < 40 * 60 * 1000) return tokenCache.value;
  const value = execSync('gcloud auth application-default print-access-token', {
    encoding: 'utf8', shell: true as unknown as string,
  }).trim();
  tokenCache = { value, at: Date.now() };
  return value;
}

/* ── Dealer identity: JWT-derived (prod-shaped) or a fixed dev id.
   NEVER taken from the request body. ────────────────────────────── */
const DEV_DEALER = 'local-dev-dealer';
async function resolveDealer(req: IncomingMessage, cfg: ServerConfig): Promise<string> {
  const auth = String(req.headers['authorization'] ?? '');
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return DEV_DEALER;
  try {
    const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/plotmap_current_dealer_id`, {
      method: 'POST',
      headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) return DEV_DEALER;
    const dealer = String((await res.json().catch(() => '')) ?? '').trim();
    return dealer || DEV_DEALER;
  } catch {
    return DEV_DEALER;
  }
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 64 * 1024) req.destroy(); });
    req.on('end', () => { try { res(JSON.parse(raw || '{}')); } catch { res({}); } });
    req.on('error', () => res({}));
  });
}
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(text);
}

interface CacheRecord {
  viewModel: PropertyIntelligenceViewModel;
  usage: RunUsage;
  inputDigest: string;
  storedAt: string;
}
const cachePath = (cfg: ServerConfig, digest: string) => join(cfg.cacheDir, `${digest}.json`);
function readCache(cfg: ServerConfig, digest: string): CacheRecord | null {
  try {
    const p = cachePath(cfg, digest);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as CacheRecord : null;
  } catch { return null; }
}
function writeCache(cfg: ServerConfig, rec: CacheRecord): void {
  try { writeFileSync(cachePath(cfg, rec.inputDigest), JSON.stringify(rec, null, 2)); } catch { /* non-fatal */ }
}

function buildDeps(cfg: ServerConfig): PipelineDeps {
  return {
    discovery: new GeminiMapsDiscoveryProvider({
      project: VERTEX.project, location: VERTEX.location, model: VERTEX.model,
      getAccessToken: async () => adcToken(), thinkingBudget: 1024,
    }),
    resolver: new GooglePlacesResolver({ apiKey: cfg.mapsKey }),
    matrix: new GoogleRoutesClient({ apiKey: cfg.mapsKey }),
    roads: cfg.roads,
    now: () => new Date().toISOString(),
    log: (lvl, ev, d) => { if (lvl !== 'info') console.log(`[pi] ${lvl} ${ev}`, d ?? ''); },
  };
}

async function handleIntelligence(req: IncomingMessage, res: ServerResponse, cfg: ServerConfig): Promise<void> {
  if (!cfg.mapsKey) return sendJson(res, 503, { status: 'unavailable', reason: 'server_not_configured' });
  const body = await readBody(req);
  const propertyId = String(body.propertyId ?? '').trim();
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const locationUpdatedAt = body.locationUpdatedAt ? String(body.locationUpdatedAt) : undefined;
  const refresh = body.refresh === true;
  if (!propertyId) return sendJson(res, 400, { status: 'unavailable', reason: 'missing_property' });
  // Use ONLY canonical coordinates. If absent, Property Intelligence is unavailable.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return sendJson(res, 200, { status: 'unavailable', reason: 'location_not_set' });
  }

  const dealerId = await resolveDealer(req, cfg);
  const point: GeoPoint = { latitude, longitude };
  const digest = await computeInputDigest({
    dealerId, propertyId, point, locationUpdatedAt,
    provider: 'vertex-gemini', model: VERTEX.model,
  });

  if (!refresh) {
    const cached = readCache(cfg, digest);
    if (cached) {
      return sendJson(res, 200, { ...cached.viewModel, cache: 'hit', costMicroUsd: 0 });
    }
  }

  try {
    const deps = buildDeps(cfg);
    const result = await runPropertyIntelligence(
      { dealerId, propertyId, point, locationUpdatedAt, refreshReason: refresh ? 'manual_refresh' : undefined },
      deps,
    );
    if (result.viewModel.status === 'ready') {
      writeCache(cfg, { viewModel: result.viewModel, usage: result.usage, inputDigest: digest, storedAt: new Date().toISOString() });
    }
    console.log(`[pi] generated ${propertyId} dealer=${dealerId} day=${result.viewModel.dayToDay.length} city=${result.viewModel.cityReach.length} cost=${result.usage.costMicroUsd}µUSD ${result.usage.latencyMs}ms`);
    return sendJson(res, 200, { ...result.viewModel, cache: refresh ? 'refresh' : 'miss', costMicroUsd: result.usage.costMicroUsd });
  } catch (err) {
    // Preserve a previous successful result if a refresh failed.
    const prior = readCache(cfg, digest);
    if (prior) return sendJson(res, 200, { ...prior.viewModel, cache: 'stale', costMicroUsd: 0 });
    const msg = (err as Error)?.message ?? '';
    const reason = /429|quota|rate|503|overload/i.test(msg) ? 'busy' : 'generation_failed';
    console.error('[pi] failed', msg);
    return sendJson(res, 200, { status: 'unavailable', reason });
  }
}

async function handleRoute(req: IncomingMessage, res: ServerResponse, cfg: ServerConfig): Promise<void> {
  if (!cfg.mapsKey) return sendJson(res, 503, { ok: false, reason: 'server_not_configured' });
  const body = await readBody(req);
  const originLat = Number(body.originLat);
  const originLng = Number(body.originLng);
  const target = body.target as { placeId?: string; latitude?: number; longitude?: number } | undefined;
  if (!Number.isFinite(originLat) || !Number.isFinite(originLng) || !target) {
    return sendJson(res, 400, { ok: false, reason: 'bad_request' });
  }
  try {
    const client = new GoogleRoutesClient({ apiKey: cfg.mapsKey });
    const line = await client.computeRoute(
      { latitude: originLat, longitude: originLng },
      { placeId: target.placeId, latitude: target.latitude, longitude: target.longitude },
    );
    if (!line) return sendJson(res, 200, { ok: false, reason: 'no_route' });
    return sendJson(res, 200, { ok: true, ...line });
  } catch (err) {
    console.error('[pi] route failed', (err as Error)?.message);
    return sendJson(res, 200, { ok: false, reason: 'route_failed' });
  }
}

export function propertyIntelligenceDevPlugin(): Plugin {
  return {
    name: 'mapco-property-intelligence-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const cfg = buildConfig(server.config.root);
      console.log(`[pi] dev middleware ready · roads=${cfg.roads.length} · maps=${cfg.mapsKey ? 'yes' : 'MISSING'} · model=${VERTEX.model}`);
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (req.method !== 'POST' || !url?.startsWith('/api/property-intelligence')) return next();
        const done = (p: Promise<void>) => p.catch((e) => { console.error('[pi] handler error', e); sendJson(res, 500, { status: 'unavailable', reason: 'internal_error' }); });
        if (url === '/api/property-intelligence/route') return void done(handleRoute(req, res, cfg));
        if (url === '/api/property-intelligence') return void done(handleIntelligence(req, res, cfg));
        return next();
      });
    },
  };
}
