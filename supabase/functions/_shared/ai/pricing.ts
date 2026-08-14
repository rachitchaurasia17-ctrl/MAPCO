// MAPCO AI · Cost model
// ---------------------------------------------------------------
// Cost is tracked in integer micro-USD (1e-6 USD) so no float rounding
// ever accumulates across a month of executions.
//
// Rates are DATA, not code: MAPCO_AI_PRICING may supply a JSON override so
// a price change is a configuration update, never a redeploy. An unknown
// model falls back to a deliberately pessimistic rate — an unmetered call
// must look expensive, not free.

export interface ModelRate {
  /** micro-USD per 1,000,000 input tokens. */
  readonly inputPerMTok: number;
  /** micro-USD per 1,000,000 output tokens. */
  readonly outputPerMTok: number;
}

const FALLBACK_RATE: ModelRate = { inputPerMTok: 5_000_000, outputPerMTok: 20_000_000 };

const DEFAULT_RATES: Readonly<Record<string, ModelRate>> = {
  'openai:gpt-4.1-mini': { inputPerMTok: 400_000, outputPerMTok: 1_600_000 },
  'openai:gpt-4.1': { inputPerMTok: 2_000_000, outputPerMTok: 8_000_000 },
  'openai:gpt-4o-mini': { inputPerMTok: 150_000, outputPerMTok: 600_000 },
  'openai:gpt-4o': { inputPerMTok: 2_500_000, outputPerMTok: 10_000_000 },
};

let overrides: Record<string, ModelRate> | null = null;

function loadOverrides(): Record<string, ModelRate> {
  if (overrides) return overrides;
  overrides = {};
  try {
    const raw = Deno.env.get('MAPCO_AI_PRICING');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Partial<ModelRate>>;
      for (const [key, rate] of Object.entries(parsed)) {
        if (typeof rate?.inputPerMTok === 'number' && typeof rate?.outputPerMTok === 'number') {
          overrides[key] = {
            inputPerMTok: Math.max(0, rate.inputPerMTok),
            outputPerMTok: Math.max(0, rate.outputPerMTok),
          };
        }
      }
    }
  } catch {
    // A malformed override must not disable metering; defaults still apply.
    overrides = {};
  }
  return overrides;
}

export function rateFor(provider: string, model: string): ModelRate {
  const key = `${provider}:${model}`;
  return loadOverrides()[key] ?? DEFAULT_RATES[key] ?? FALLBACK_RATE;
}

/** Integer micro-USD for one call. Always rounds up, never under-reports. */
export function costMicroUsd(
  provider: string,
  model: string,
  usage: { inputTokens: number; outputTokens: number },
): number {
  const rate = rateFor(provider, model);
  const input = Math.max(0, Math.floor(usage.inputTokens || 0));
  const output = Math.max(0, Math.floor(usage.outputTokens || 0));
  return (
    Math.ceil((input * rate.inputPerMTok) / 1_000_000) +
    Math.ceil((output * rate.outputPerMTok) / 1_000_000)
  );
}
