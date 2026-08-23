/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Gemini (Vertex AI) discovery
   ---------------------------------------------------------------
   The default discovery provider. Uses gemini-3.6-flash on Vertex AI
   with native Google Maps Grounding to intelligently SELECT the final
   six Day-to-Day and six City Reach destinations for the exact
   property coordinate — not to discover 50 candidates for MAPCO to
   filter. Auth is an injected bearer-token getter (ADC locally, a
   Google service identity in production), so this file never holds a
   key and never runs in the browser.

   Live-verified contract (2026-08): Maps grounding on Vertex uses
   tools:[{googleMaps:{}}] + toolConfig.retrievalConfig.latLng, and
   `responseMimeType:application/json` BREAKS the grounding tool — so we
   ask for strict JSON in the prompt and parse leniently. Grounding
   chunks (with canonical placeIds) attach to prose, not JSON answers,
   so we opportunistically recover any placeIds the model does cite.
   ═══════════════════════════════════════════════════════════════ */
import type {
  DiscoverOptions,
  DiscoveryCandidate,
  DiscoveryResult,
  GeoPoint,
  PropertyIntelligenceDiscoveryProvider,
  DayToDayCategory,
  CityReachType,
} from '../types.ts';

export interface GeminiVertexConfig {
  project: string;
  location: string;
  model: string;
  /** Returns a fresh OAuth2 bearer token (ADC / workload identity / SA). */
  getAccessToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
  /** Thinking budget — bounded for cost/latency; selection stays high quality. */
  thinkingBudget?: number;
  temperature?: number;
  maxOutputTokens?: number;
  /** Bounded retries for 429/503 (default 3). */
  maxRetries?: number;
}

const CATEGORY_ALIASES: Record<string, DayToDayCategory> = {
  park: 'park', parks: 'park',
  grocery: 'grocery', supermarket: 'grocery', groceries: 'grocery', hypermarket: 'grocery',
  gym: 'gym', fitness: 'gym',
  school: 'school', education: 'school',
  healthcare: 'healthcare', health: 'healthcare', hospital: 'healthcare', clinic: 'healthcare', medical: 'healthcare',
  dailymarket: 'daily_market', daily_market: 'daily_market', market: 'daily_market', lifestyle: 'daily_market',
};

const CITY_TYPES = new Set<CityReachType>([
  'mall', 'road', 'hospital', 'airport', 'stadium', 'business_district', 'institution', 'civic', 'landmark',
]);

function normalizeCategory(raw: unknown): DayToDayCategory | undefined {
  const key = String(raw ?? '').toLowerCase().replace(/[^a-z_]/g, '');
  return CATEGORY_ALIASES[key];
}

function normalizeCityType(raw: unknown): CityReachType {
  const key = String(raw ?? '').toLowerCase().replace(/[^a-z_]/g, '') as CityReachType;
  if (CITY_TYPES.has(key)) return key;
  if (key.includes('road') || key.includes('corridor') || key.includes('highway')) return 'road';
  if (key.includes('mall') || key.includes('retail') || key.includes('shop')) return 'mall';
  if (key.includes('hospital') || key.includes('medical')) return 'hospital';
  if (key.includes('airport')) return 'airport';
  if (key.includes('stadium') || key.includes('sport')) return 'stadium';
  if (key.includes('it') || key.includes('business') || key.includes('tech')) return 'business_district';
  return 'landmark';
}

function buildPrompt(point: GeoPoint, regionHint?: string): string {
  const region = regionHint || 'the Tri-City area (Chandigarh / Mohali / Zirakpur / New Chandigarh), Punjab, India';
  return `You are MAPCO's location analyst for a real-estate property in ${region}.
The property is at latitude ${point.latitude}, longitude ${point.longitude}.

Use Google Maps grounding for THIS exact location. Choose concise, factual, genuinely useful destinations for a property buyer. Do NOT pick the mathematically closest weak business — pick the strongest genuinely useful place (an established supermarket 700 m away can beat an unknown grocery shop 150 m away). Adjoining sectors are fine.

Return TWO groups.

DAY TO DAY — exactly 6, one per category, in this order:
1 Park, 2 Grocery/Supermarket, 3 Gym, 4 School, 5 Healthcare, 6 Daily Market / Lifestyle.

CITY REACH — exactly 6 broader recognizable anchors that genuinely matter for THIS location. There are NO fixed categories: pick what is truly relevant here from major malls/retail hubs, major roads/corridors, important hospitals, major institutions, airports, business/IT districts, major sports/civic destinations, or other recognizable city anchors. A different property must produce different anchors. Avoid weak filler and random small businesses.

For EVERY place, "name" MUST be the exact real place name as it appears in Google Maps (so it can be looked up). Keep "reason" to one short factual clause.

Respond with STRICT JSON only — no prose, no markdown fences:
{"dayToDay":[{"category":"Park|Grocery|Gym|School|Healthcare|DailyMarket","name":"...","reason":"..."}],"cityReach":[{"name":"...","destinationType":"mall|road|hospital|airport|stadium|business_district|institution|civic|landmark","reason":"..."}]}`;
}

function stripToJson(text: string): string {
  let t = text.trim();
  // Strip ```json ... ``` fences if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1]!.trim();
  // Trim to the outermost JSON object.
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return t;
}

interface RawDay { category?: unknown; name?: unknown; reason?: unknown }
interface RawCity { name?: unknown; destinationType?: unknown; reason?: unknown }

function normText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export class GeminiMapsDiscoveryProvider implements PropertyIntelligenceDiscoveryProvider {
  readonly name = 'vertex-gemini';
  readonly model: string;
  private readonly cfg: GeminiVertexConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: GeminiVertexConfig) {
    this.cfg = cfg;
    this.model = cfg.model;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  private endpoint(): string {
    const { project, location, model } = this.cfg;
    const host = location === 'global'
      ? 'https://aiplatform.googleapis.com'
      : `https://${location}-aiplatform.googleapis.com`;
    return `${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
  }

  async discover(point: GeoPoint, opts: DiscoverOptions = {}): Promise<DiscoveryResult> {
    const token = await this.cfg.getAccessToken();
    const body = {
      contents: [{ role: 'user', parts: [{ text: buildPrompt(point, opts.regionHint) }] }],
      tools: [{ googleMaps: {} }],
      toolConfig: { retrievalConfig: { latLng: { latitude: point.latitude, longitude: point.longitude } } },
      generationConfig: {
        temperature: this.cfg.temperature ?? 0.35,
        maxOutputTokens: this.cfg.maxOutputTokens ?? 4096,
        ...(this.cfg.thinkingBudget != null ? { thinkingConfig: { thinkingBudget: this.cfg.thinkingBudget } } : {}),
      },
    };

    // Bounded retry for transient rate limit / overload (429 / 503), honouring
    // Retry-After when present, with capped exponential backoff otherwise.
    const maxAttempts = this.cfg.maxRetries ?? 3;
    let res!: Response;
    for (let attempt = 0; ; attempt++) {
      res = await this.fetchImpl(this.endpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
      if ((res.status !== 429 && res.status !== 503) || attempt >= maxAttempts) break;
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 20000)
        : Math.min(1000 * 2 ** attempt, 12000);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new DiscoveryError(`vertex_http_${res.status}`, detail);
    }
    const json = await res.json() as VertexResponse;
    const candidate = json.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!text.trim()) throw new DiscoveryError('vertex_empty', candidate?.finishReason ?? '');

    let parsed: { dayToDay?: RawDay[]; cityReach?: RawCity[] };
    try {
      parsed = JSON.parse(stripToJson(text));
    } catch {
      throw new DiscoveryError('vertex_unparseable', text.slice(0, 200));
    }

    // Grounding chunks (placeId + title), when the model cited any.
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks ?? [];
    const grounded = groundingChunks
      .map((c) => c.maps)
      .filter((m): m is MapsChunk => Boolean(m?.placeId && m?.title))
      .map((m) => ({ placeId: m.placeId!, title: normText(m.title!) }));

    const matchGrounded = (name: string): string | undefined => {
      const key = normText(name);
      const hit = grounded.find((g) => g.title === key || g.title.includes(key) || key.includes(g.title));
      return hit?.placeId;
    };

    const candidates: DiscoveryCandidate[] = [];
    for (const d of Array.isArray(parsed.dayToDay) ? parsed.dayToDay : []) {
      const name = String(d.name ?? '').trim();
      const category = normalizeCategory(d.category);
      if (!name || !category) continue;
      candidates.push({
        group: 'dayToDay', category, name,
        reason: d.reason ? String(d.reason).slice(0, 200) : undefined,
        groundedPlaceId: matchGrounded(name),
      });
    }
    for (const c of Array.isArray(parsed.cityReach) ? parsed.cityReach : []) {
      const name = String(c.name ?? '').trim();
      if (!name) continue;
      candidates.push({
        group: 'cityReach',
        destinationType: normalizeCityType(c.destinationType),
        name,
        reason: c.reason ? String(c.reason).slice(0, 200) : undefined,
        groundedPlaceId: matchGrounded(name),
      });
    }

    const usage = json.usageMetadata ?? {};
    return {
      candidates,
      usage: {
        inputTokens: usage.promptTokenCount ?? 0,
        // Thinking tokens are billed as output on Gemini — include them.
        outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
        // The API does not report the exact Maps query count; a grounded
        // request bills at least one query. Recorded transparently as ≥1.
        groundingQueries: grounded.length > 0 || groundingChunks.length > 0 ? 1 : 1,
      },
    };
  }
}

export class DiscoveryError extends Error {
  constructor(readonly code: string, readonly detail?: string) {
    super(code);
    this.name = 'DiscoveryError';
  }
}

/* ── Vertex response shapes (only the fields we read) ───────────── */
interface MapsChunk { placeId?: string; title?: string; uri?: string }
interface GroundingChunk { maps?: MapsChunk }
interface VertexResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: { groundingChunks?: GroundingChunk[] };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
}
