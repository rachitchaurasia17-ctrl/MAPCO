/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Vite dev middleware (local-live)
   ---------------------------------------------------------------
   The LOCAL stand-in for the production Supabase Edge Function. It runs
   the SAME runtime-neutral pipeline with the real secrets kept
   server-side and never shipped to the browser:

     • Gemini via Vertex AI + ADC (gcloud application-default token)
     • Google Places (New) + Google Routes via GOOGLE_MAPS_SERVER_KEY

   Persistence is a durable local mirror of the production stores, so a
   local session behaves exactly like production including its caching:

     .pi-cache/results/<digest>.json    generated intelligence
     .pi-cache/places/<placeId>.json    global place registry
     .pi-cache/routes/<hash>.json       route cache
     public/place-media/places/<id>.jpg persisted Place Photos, served
                                        at /place-media/... by Vite

   A browser refresh therefore returns the cached result at zero API
   cost — the same contract the production tables provide.

   apply:'serve' — this file never runs in a production build.

   Endpoint (same-origin, dev only):
     POST /api/property-intelligence   → view model (cached or fresh)
   ═══════════════════════════════════════════════════════════════ */
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  runPropertyIntelligence,
  GeminiVertexTextModel,
  GooglePlacesClient,
  GoogleRoutesClient,
  computeInputDigest,
  DEFAULT_LIMITS,
  DEFAULT_PRICING,
  PHASE1_PROMPT_VERSION,
  PHASE2_PROMPT_VERSION,
  PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
  PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
  routeOriginKey,
  type GeoPoint,
  type IntelligenceStore,
  type PipelineResult,
  type PlaceMedia,
  type PropertyIntelligenceViewModel,
  type RouteResultRecord,
} from '../src/packages/property-intelligence/index.ts';

const VERTEX = { project: 'mapco-504912', location: 'global', model: 'gemini-3.6-flash' };
const DEV_DEALER = 'local-dev-dealer';

function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) out[match[1]!] = match[2]!.replace(/^["']|["']$/g, '');
    }
  } catch { /* absent env file is fine */ }
  return out;
}

interface ServerConfig {
  mapsKey: string;
  cacheDir: string;
  mediaDir: string;
  root: string;
}

function buildConfig(root: string): ServerConfig {
  const repo = resolve(root, '..');
  const secret = loadEnv(join(repo, 'supabase', '.env.local'));
  const cacheDir = join(root, '.pi-cache');
  const mediaDir = join(root, 'public', 'place-media', 'places');
  for (const dir of [
    cacheDir, join(cacheDir, 'results'), join(cacheDir, 'places'),
    join(cacheDir, 'routes'), mediaDir,
  ]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  return {
    mapsKey: secret.GOOGLE_MAPS_SERVER_KEY ?? '',
    cacheDir,
    mediaDir,
    root,
  };
}

/* ── ADC token (gcloud), cached ~40 min ─────────────────────────── */
let tokenCache: { value: string; at: number } | null = null;
function adcToken(): string {
  if (tokenCache && Date.now() - tokenCache.at < 40 * 60_000) return tokenCache.value;
  const value = execSync('gcloud auth application-default print-access-token', {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  tokenCache = { value, at: Date.now() };
  return value;
}

const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const safeId = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);

function readJson<T>(path: string): T | null {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as T : null;
  } catch { return null; }
}

function writeJson(path: string, value: unknown): void {
  try { writeFileSync(path, JSON.stringify(value, null, 2)); } catch { /* best effort */ }
}

/**
 * Filesystem mirror of the production stores. Same contract, same caching
 * behaviour — which is what makes local-live a faithful rehearsal rather
 * than a different code path.
 */
function createFileStore(cfg: ServerConfig): IntelligenceStore {
  const placePath = (placeId: string) => join(cfg.cacheDir, 'places', `${safeId(placeId)}.json`);
  const routePath = (originKey: string, destinationKey: string) =>
    join(cfg.cacheDir, 'routes', `${sha(`${originKey}|${destinationKey}`)}.json`);

  return {
    async getPlaceMedia(placeIds) {
      const out = new Map<string, PlaceMedia>();
      for (const placeId of new Set(placeIds.filter(Boolean))) {
        const record = readJson<PlaceMedia>(placePath(placeId));
        if (record) out.set(placeId, record);
      }
      return out;
    },
    async putPlaceMedia(media) {
      const existing = readJson<PlaceMedia>(placePath(media.placeId));
      // Never downgrade a stored asset to unavailable on a later failure.
      const merged: PlaceMedia = existing?.status === 'stored' && media.status !== 'stored'
        ? { ...media, status: 'stored', storagePath: existing.storagePath, publicUrl: existing.publicUrl }
        : media;
      writeJson(placePath(media.placeId), merged);
      return merged;
    },
    async storePhoto(placeId, bytes, mimeType) {
      const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
      const file = `${safeId(placeId)}.${ext}`;
      try {
        writeFileSync(join(cfg.mediaDir, file), bytes);
      } catch { return null; }
      return {
        storagePath: `places/${file}`,
        // Served by Vite from public/. Same shape as the production public
        // bucket URL, so the UI needs no dev-specific branch.
        publicUrl: `/place-media/places/${file}`,
      };
    },
    async getRoutes(originKey, destinationKeys) {
      const out = new Map<string, RouteResultRecord>();
      for (const key of new Set(destinationKeys.filter(Boolean))) {
        const record = readJson<RouteResultRecord>(routePath(originKey, key));
        if (record) out.set(key, record);
      }
      return out;
    },
    async putRoute(originKey, record) {
      writeJson(routePath(originKey, record.destinationKey), record);
    },
  };
}

function buildDeps(cfg: ServerConfig) {
  return {
    model: new GeminiVertexTextModel({
      project: VERTEX.project, location: VERTEX.location, model: VERTEX.model,
      getAccessToken: async () => adcToken(),
    }),
    places: new GooglePlacesClient({ apiKey: cfg.mapsKey, regionCode: 'IN' }),
    routes: new GoogleRoutesClient({ apiKey: cfg.mapsKey, regionCode: 'IN' }),
    store: createFileStore(cfg),
    limits: DEFAULT_LIMITS,
    pricing: DEFAULT_PRICING,
    now: () => new Date().toISOString(),
    log: (level: string, event: string, data?: Record<string, unknown>) => {
      // Structured, secret-free operational logging — the same events the
      // Edge Function emits, so a local failure is diagnosed the same way.
      const line = data ? `${event} ${JSON.stringify(data)}` : event;
      if (level === 'error') console.error('[pi]', line);
      else if (level === 'warn') console.warn('[pi]', line);
      else console.log('[pi]', line);
    },
  };
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 16_384) raw = raw.slice(0, 16_384);
    });
    req.on('end', () => {
      try { resolvePromise(JSON.parse(raw || '{}')); } catch { resolvePromise({}); }
    });
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

function unavailable(reason: string): PropertyIntelligenceViewModel {
  return {
    status: 'unavailable',
    reason: reason as PropertyIntelligenceViewModel['reason'],
    generatedAt: new Date().toISOString(),
    schemaVersion: PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
    pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
    provider: 'vertex-gemini',
    model: VERTEX.model,
    origin: null,
    local: [],
    city: [],
  };
}

/** In-flight guard: a double-click in dev must not start two paid runs. */
const inFlight = new Map<string, Promise<PipelineResult>>();

async function handleIntelligence(
  req: IncomingMessage, res: ServerResponse, cfg: ServerConfig,
): Promise<void> {
  const body = await readBody(req);
  const propertyId = String(body.propertyId ?? '').trim();
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const refresh = body.refresh === true;

  if (!propertyId) return sendJson(res, 200, unavailable('property_not_found'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || (latitude === 0 && longitude === 0)) {
    return sendJson(res, 200, unavailable('location_not_set'));
  }
  if (!cfg.mapsKey) return sendJson(res, 200, unavailable('server_not_configured'));

  const point: GeoPoint = { latitude, longitude };
  const locationUpdatedAt = typeof body.locationUpdatedAt === 'string'
    ? body.locationUpdatedAt : undefined;

  const digest = await computeInputDigest({
    dealerId: DEV_DEALER, propertyId, point, locationUpdatedAt,
    provider: 'vertex-gemini', model: VERTEX.model,
    pipelineVersion: PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
    phase1PromptVersion: PHASE1_PROMPT_VERSION,
    phase2PromptVersion: PHASE2_PROMPT_VERSION,
  });
  const resultPath = join(cfg.cacheDir, 'results', `${digest}.json`);

  if (!refresh) {
    const cached = readJson<{ viewModel: PropertyIntelligenceViewModel }>(resultPath);
    if (cached?.viewModel?.status === 'ready') {
      return sendJson(res, 200, { ...cached.viewModel, cache: 'hit' });
    }
  }

  const key = `${propertyId}:${digest}`;
  if (inFlight.has(key)) {
    const pending = await inFlight.get(key)!;
    return sendJson(res, 200, { ...pending.viewModel, cache: 'busy' });
  }

  const run = runPropertyIntelligence(
    {
      dealerId: DEV_DEALER,
      propertyId,
      point,
      locality: String(body.locality ?? ''),
      city: String(body.city ?? ''),
      propertySector: String(body.locality ?? ''),
      locationUpdatedAt,
      refreshReason: refresh ? 'manual_refresh' : undefined,
    },
    buildDeps(cfg),
    { cacheOutcome: refresh ? 'refresh' : 'miss' },
  );
  inFlight.set(key, run);

  try {
    const result = await run;
    writeJson(resultPath, {
      viewModel: result.viewModel,
      usage: result.usage,
      candidateUniverse: result.candidateUniverse,
      phase2Output: result.phase2Output,
    });
    console.log(
      `[pi] generation ${result.usage.status} · ${result.usage.candidateCount} candidates`
      + ` · ${result.usage.selectedCount} selected · ₹${result.usage.totalInr.toFixed(2)}`
      + ` · saved ₹${(result.usage.photosReused + result.usage.routesReused) > 0 ? 'yes' : '0.00'}`
      + ` · routes ${result.usage.routesComputed} new / ${result.usage.routesReused} reused`
      + ` · photos ${result.usage.photosFetched} new / ${result.usage.photosReused} reused`,
    );
    sendJson(res, 200, {
      ...result.viewModel,
      cache: 'miss',
      costInr: Number(result.usage.totalInr.toFixed(2)),
      routeOriginKey: routeOriginKey(point),
    });
  } catch (error) {
    console.error('[pi] generation failed', error);
    sendJson(res, 200, unavailable('error'));
  } finally {
    inFlight.delete(key);
  }
}

export function propertyIntelligenceDevPlugin(): Plugin {
  let cfg: ServerConfig;
  return {
    name: 'mapco-property-intelligence-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      cfg = buildConfig(server.config.root);
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (req.method !== 'POST' || url !== '/api/property-intelligence') return next();
        void handleIntelligence(req, res, cfg).catch((error) => {
          console.error('[pi] middleware error', error);
          sendJson(res, 200, unavailable('error'));
        });
      });
    },
  };
}
