// MAPCO AI · Provider registry
// A provider becomes available to MAPCO by appearing here AND holding a
// credential. Nothing else in the codebase constructs a provider.

import type { AiProvider } from '../provider.ts';
import { OpenAiProvider } from './openai.ts';

const REGISTRY: readonly AiProvider[] = [new OpenAiProvider()];

export function getProvider(name: string): AiProvider | null {
  return REGISTRY.find((provider) => provider.name === name) ?? null;
}

/** Providers that are both registered and actually usable right now. */
export function configuredProviders(): readonly string[] {
  return REGISTRY.filter((provider) => provider.isConfigured()).map((provider) => provider.name);
}

export function anyProviderConfigured(): boolean {
  return configuredProviders().length > 0;
}
