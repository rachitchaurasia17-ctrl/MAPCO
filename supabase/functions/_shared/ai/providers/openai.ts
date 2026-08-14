// MAPCO AI · OpenAI provider
// ---------------------------------------------------------------
// The FIRST provider, not the architecture. Everything vendor-specific
// (endpoint, request shape, usage field names, error mapping) is confined
// to this file; nothing outside it mentions OpenAI.
//
// The API key is read from the Edge secret store and never leaves this
// runtime, is never logged, and is never included in any response.

import {
  classifyHttpStatus,
  providerFailure,
  type AiProvider,
  type AiStructuredRequest,
  type AiStructuredResult,
} from '../provider.ts';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';

  private get apiKey(): string {
    return String(Deno.env.get('OPENAI_API_KEY') || '');
  }

  private get baseUrl(): string {
    return String(Deno.env.get('OPENAI_BASE_URL') || DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async generateStructured(request: AiStructuredRequest): Promise<AiStructuredResult> {
    const startedAt = Date.now();
    if (!this.isConfigured()) {
      return providerFailure('not_configured', 'OPENAI_API_KEY is not set', 0);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 45000);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: request.model,
          temperature: request.temperature ?? 0.2,
          max_completion_tokens: request.maxOutputTokens,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          // Constrain generation to MAPCO's schema. MAPCO still re-validates
          // the result itself — this is the first gate, not the only one.
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: request.schemaName,
              strict: true,
              schema: request.jsonSchema,
            },
          },
        }),
      });

      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        const { code, retryable } = classifyHttpStatus(response.status);
        // The provider's own error text can echo request content; keep only
        // the status. Redaction happens again at the log boundary.
        return providerFailure(code, `openai_http_${response.status}`, latencyMs, retryable);
      }

      const body = await response.json().catch(() => null) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      } | null;

      const choice = body?.choices?.[0];
      const usage = {
        inputTokens: Number(body?.usage?.prompt_tokens ?? 0),
        outputTokens: Number(body?.usage?.completion_tokens ?? 0),
      };

      if (choice?.finish_reason === 'content_filter') {
        return { ...providerFailure('content_filtered', 'filtered', latencyMs), usage };
      }
      // A truncated response is structurally incomplete; treat it as a
      // failure rather than trying to salvage half an artifact.
      if (choice?.finish_reason === 'length') {
        return { ...providerFailure('invalid_response', 'truncated', latencyMs, true), usage };
      }

      const content = String(choice?.message?.content ?? '').trim();
      if (!content) {
        return { ...providerFailure('invalid_response', 'empty', latencyMs, true), usage };
      }

      try {
        return { ok: true, data: JSON.parse(content), usage, model: request.model, latencyMs };
      } catch {
        return { ...providerFailure('invalid_response', 'not_json', latencyMs, true), usage };
      }
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      return providerFailure(
        aborted ? 'timeout' : 'provider_error',
        aborted ? 'aborted' : 'transport_error',
        latencyMs,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
