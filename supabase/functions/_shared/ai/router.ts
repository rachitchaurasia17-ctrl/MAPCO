// MAPCO AI · Workload router
// ---------------------------------------------------------------
// Decides WHICH provider and model serves a cost class. This is the only
// place a model name appears. Product logic asks for "a deep analysis";
// the router answers with a concrete provider/model pair.
//
// The default chain is ordered by preference. Each candidate is skipped
// unless its provider actually holds a credential, so removing a key is a
// safe, immediate failover — not an outage.
//
// MAPCO_AI_ROUTES may override the whole table as JSON:
//   {"deep":[{"provider":"openai","model":"gpt-4.1"}]}
// Rerouting a workload is therefore a configuration change, never a code
// change, and never touches a prompt, schema or table.

import { configuredProviders, getProvider } from './providers/index.ts';
import type { AiProvider } from './provider.ts';
import type { CostClass } from './tasks.ts';

export interface RouteCandidate {
  readonly provider: string;
  readonly model: string;
}

const DEFAULT_ROUTES: Readonly<Record<CostClass, readonly RouteCandidate[]>> = {
  cheap: [
    { provider: 'openai', model: 'gpt-4.1-mini' },
    { provider: 'openai', model: 'gpt-4o-mini' },
  ],
  standard: [
    { provider: 'openai', model: 'gpt-4.1-mini' },
    { provider: 'openai', model: 'gpt-4.1' },
  ],
  deep: [
    { provider: 'openai', model: 'gpt-4.1' },
    { provider: 'openai', model: 'gpt-4.1-mini' },
  ],
};

let cachedRoutes: Record<CostClass, readonly RouteCandidate[]> | null = null;

function routes(): Record<CostClass, readonly RouteCandidate[]> {
  if (cachedRoutes) return cachedRoutes;
  cachedRoutes = { ...DEFAULT_ROUTES };
  try {
    const raw = Deno.env.get('MAPCO_AI_ROUTES');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<CostClass, RouteCandidate[]>>;
      for (const costClass of ['cheap', 'standard', 'deep'] as const) {
        const list = parsed[costClass];
        if (Array.isArray(list) && list.length) {
          const clean = list.filter(
            (item) => typeof item?.provider === 'string' && typeof item?.model === 'string',
          );
          if (clean.length) cachedRoutes[costClass] = clean;
        }
      }
    }
  } catch {
    // A malformed override must never leave MAPCO unroutable.
    cachedRoutes = { ...DEFAULT_ROUTES };
  }
  return cachedRoutes;
}

export interface ResolvedRoute {
  readonly provider: AiProvider;
  readonly providerName: string;
  readonly model: string;
}

/** First candidate for this cost class whose provider is usable. */
export function resolveRoute(costClass: CostClass): ResolvedRoute | null {
  for (const candidate of routes()[costClass] ?? []) {
    const provider = getProvider(candidate.provider);
    if (provider?.isConfigured()) {
      return { provider, providerName: provider.name, model: candidate.model };
    }
  }
  return null;
}

/** Remaining candidates after a failure, so a run can fail over in place. */
export function fallbackRoutes(costClass: CostClass, afterModel: string): readonly ResolvedRoute[] {
  const list = routes()[costClass] ?? [];
  const startIndex = list.findIndex((candidate) => candidate.model === afterModel);
  return list
    .slice(startIndex + 1)
    .map((candidate) => {
      const provider = getProvider(candidate.provider);
      return provider?.isConfigured()
        ? { provider, providerName: provider.name, model: candidate.model }
        : null;
    })
    .filter((route): route is ResolvedRoute => route !== null);
}

export function routingStatus(): { configuredProviders: readonly string[]; routable: boolean } {
  const configured = configuredProviders();
  return {
    configuredProviders: configured,
    routable: (['cheap', 'standard', 'deep'] as const).every((c) => resolveRoute(c) !== null),
  };
}
