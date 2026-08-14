// MAPCO AI · Provider abstraction
// ---------------------------------------------------------------
// MAPCO talks to *a provider*, never to a named vendor. Product logic
// (tasks, prompts, context, schemas, storage) knows nothing about which
// company or model answered — that is decided by the router at call time.
//
// Adding a provider means implementing this one interface and registering
// it. No task, prompt, schema or table changes.

export type AiErrorCode =
  | 'not_configured'
  | 'unauthorized'
  | 'rate_limited'
  | 'timeout'
  | 'provider_error'
  | 'invalid_response'
  | 'content_filtered';

export interface AiUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AiStructuredRequest {
  /** Provider-specific model identifier, supplied by the router. */
  readonly model: string;
  readonly system: string;
  readonly user: string;
  /** Names the expected output shape; providers use it to label the schema. */
  readonly schemaName: string;
  readonly jsonSchema: Record<string, unknown>;
  readonly maxOutputTokens: number;
  readonly temperature?: number;
  readonly timeoutMs?: number;
}

export type AiStructuredResult =
  | {
      readonly ok: true;
      readonly data: unknown;
      readonly usage: AiUsage;
      readonly model: string;
      readonly latencyMs: number;
    }
  | {
      readonly ok: false;
      readonly errorCode: AiErrorCode;
      readonly message: string;
      readonly retryable: boolean;
      readonly latencyMs: number;
      readonly usage?: AiUsage;
    };

export interface AiProvider {
  readonly name: string;
  /** False when the runtime holds no credential for this provider. */
  isConfigured(): boolean;
  /** Must return parsed JSON matching jsonSchema, or a typed failure. */
  generateStructured(request: AiStructuredRequest): Promise<AiStructuredResult>;
}

export function providerFailure(
  errorCode: AiErrorCode,
  message: string,
  latencyMs: number,
  retryable = false,
): AiStructuredResult {
  return { ok: false, errorCode, message, retryable, latencyMs };
}

/** HTTP status → typed error. Shared so every provider classifies alike. */
export function classifyHttpStatus(status: number): { code: AiErrorCode; retryable: boolean } {
  if (status === 401 || status === 403) return { code: 'unauthorized', retryable: false };
  if (status === 408 || status === 504) return { code: 'timeout', retryable: true };
  if (status === 429) return { code: 'rate_limited', retryable: true };
  if (status >= 500) return { code: 'provider_error', retryable: true };
  return { code: 'provider_error', retryable: false };
}
