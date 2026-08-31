import { describe, expect, it, vi } from 'vitest';
import { GeminiVertexTextModel } from '../src/packages/property-intelligence/providers/gemini-vertex';

const okResponse = () => new Response(JSON.stringify({
  candidates: [{
    content: { parts: [{ text: '{"ok":true}' }] },
    groundingMetadata: {
      groundingChunks: [{ maps: { placeId: 'places/test-place', title: 'Test Place' } }],
      retrievalQueries: ['nearby'],
    },
  }],
  usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, thoughtsTokenCount: 3 },
}), { status: 200, headers: { 'content-type': 'application/json' } });

describe('Gemini provider authentication', () => {
  it('uses the Gemini API key endpoint and preserves the Phase 1 Maps-grounding request', async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const model = new GeminiVertexTextModel({
      model: 'gemini-3.6-flash',
      apiKey: 'server-only-test-key',
      fetchImpl: fetchImpl as typeof fetch,
    });

    const result = await model.generate('unchanged phase one prompt', {
      grounding: { latitude: 30.681991, longitude: 76.702441 },
      maxOutputTokens: 8192,
      temperature: 0.2,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
    expect(init?.headers).toMatchObject({
      'content-type': 'application/json',
      'x-goog-api-key': 'server-only-test-key',
    });
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: 'unchanged phase one prompt' }] }],
      tools: [{ googleMaps: {} }],
      toolConfig: { retrievalConfig: { latLng: { latitude: 30.681991, longitude: 76.702441 } } },
    });
    expect(result.groundedPlaces).toEqual([{ placeId: 'places/test-place', title: 'Test Place' }]);
    expect(result.usage).toMatchObject({ inputTokens: 11, outputTokens: 10, groundingQueries: 1 });
  });

  it('keeps the Phase 2 request independent and ungrounded', async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const model = new GeminiVertexTextModel({
      model: 'gemini-3.6-flash', apiKey: 'server-only-test-key', fetchImpl: fetchImpl as typeof fetch,
    });

    await model.generate('unchanged phase two prompt', { temperature: 0.1 });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(body.contents[0].parts[0].text).toBe('unchanged phase two prompt');
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('toolConfig');
  });

  it('retains bearer-token authentication for local ADC harnesses', async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const model = new GeminiVertexTextModel({
      project: 'mapco-504912', location: 'global', model: 'gemini-3.6-flash',
      getAccessToken: async () => 'test-access-token', fetchImpl: fetchImpl as typeof fetch,
    });

    await model.generate('local harness');

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toContain('aiplatform.googleapis.com/v1/projects/mapco-504912/locations/global');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-access-token' });
    expect(init?.headers).not.toHaveProperty('x-goog-api-key');
  });
});
