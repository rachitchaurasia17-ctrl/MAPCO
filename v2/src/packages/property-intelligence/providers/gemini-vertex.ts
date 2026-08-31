/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · Vertex AI Gemini text model
   ---------------------------------------------------------------
   A single-turn text model. The pipeline calls it TWICE per generation
   with two independent requests:

     Phase 1  grounding ON   — Google Maps grounding at the property
                               coordinate, high-recall discovery
     Phase 2  grounding OFF  — judges only the supplied candidate
                               universe

   Two separate requests is a requirement, not an optimisation: carrying
   Phase 1's conversational state into Phase 2 would let the enormous
   Maps-grounding context and the high-recall instructions contaminate
   the final judgment.

   Live-verified contract (2026-08): Maps grounding on Vertex uses
   tools:[{googleMaps:{}}] + toolConfig.retrievalConfig.latLng, and
   responseMimeType:application/json BREAKS the grounding tool — so
   Phase 1 asks for text and MAPCO parses it, while Phase 2 (ungrounded)
   asks for strict JSON in the prompt and is parsed leniently.

   Auth is either an injected bearer-token getter (ADC locally) or a
   server-only Gemini authorization API key. The API-key path uses the
   Gemini generateContent endpoint with the exact same request body.
   ═══════════════════════════════════════════════════════════════ */
import type {
  GenerateOptions, ModelResponse, TextModelProvider,
} from '../types.ts';

export interface GeminiVertexConfig {
  project?: string;
  location?: string;
  model: string;
  /** Returns a fresh OAuth2 bearer token (ADC / workload identity / SA). */
  getAccessToken?: () => Promise<string>;
  /** Server-only Gemini authorization API key bound to a service account. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** Bounded retries for 429/503 (default 3). */
  maxRetries?: number;
}

export class DiscoveryError extends Error {
  readonly code: string;
  readonly detail?: string;
  constructor(code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'DiscoveryError';
    this.code = code;
    this.detail = detail;
  }
}

interface MapsChunk { placeId?: string; title?: string; uri?: string }
interface GroundingChunk { maps?: MapsChunk }
interface VertexResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: GroundingChunk[];
      webSearchQueries?: string[];
      retrievalQueries?: string[];
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GeminiVertexTextModel implements TextModelProvider {
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
    if (this.cfg.apiKey) {
      return `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    }
    const { project, location, model } = this.cfg;
    if (!project || !location) throw new DiscoveryError('vertex_config_missing');
    const host = location === 'global'
      ? 'https://aiplatform.googleapis.com'
      : `https://${location}-aiplatform.googleapis.com`;
    return `${host}/v1/projects/${project}/locations/${location}`
      + `/publishers/google/models/${model}:generateContent`;
  }

  async generate(prompt: string, opts: GenerateOptions = {}): Promise<ModelResponse> {
    const token = this.cfg.apiKey ? '' : await this.cfg.getAccessToken?.();
    if (!this.cfg.apiKey && !token) throw new DiscoveryError('vertex_credentials_missing');

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        maxOutputTokens: opts.maxOutputTokens ?? 8192,
        ...(opts.thinkingBudget != null
          ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } }
          : {}),
      },
    };

    if (opts.grounding) {
      body.tools = [{ googleMaps: {} }];
      body.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: opts.grounding.latitude,
            longitude: opts.grounding.longitude,
          },
        },
      };
    }

    // Bounded retry for transient rate limit / overload, honouring
    // Retry-After when present and capped exponential backoff otherwise.
    const maxAttempts = this.cfg.maxRetries ?? 3;
    let res!: Response;
    for (let attempt = 0; ; attempt++) {
      res = await this.fetchImpl(this.endpoint(), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.cfg.apiKey
            ? { 'x-goog-api-key': this.cfg.apiKey }
            : { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
      if ((res.status !== 429 && res.status !== 503) || attempt >= maxAttempts) break;
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 20_000)
        : Math.min(1000 * 2 ** attempt, 12_000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new DiscoveryError(`vertex_http_${res.status}`, detail);
    }

    const json = await res.json() as VertexResponse;
    const candidate = json.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!text.trim()) {
      throw new DiscoveryError('vertex_empty', candidate?.finishReason ?? '');
    }

    const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
    const groundedPlaces = chunks
      .map((c) => c.maps)
      .filter((m): m is MapsChunk => Boolean(m?.placeId && m?.title))
      .map((m) => ({ placeId: m.placeId!, title: m.title! }));

    const usage = json.usageMetadata ?? {};
    // Google does not report an exact Maps query count. A grounded request
    // bills at least one; the number of distinct retrieval queries is the
    // best observable proxy. Recorded transparently rather than assumed 0 —
    // an unmetered call must never look free.
    const retrievalQueries = candidate?.groundingMetadata?.retrievalQueries?.length ?? 0;
    const groundingQueries = opts.grounding
      ? Math.max(1, retrievalQueries)
      : 0;

    return {
      text,
      groundedPlaces,
      usage: {
        inputTokens: usage.promptTokenCount ?? 0,
        // Thinking tokens are billed as output on Gemini — include them.
        outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
        groundingQueries,
      },
    };
  }
}
