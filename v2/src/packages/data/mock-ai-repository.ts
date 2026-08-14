/* ═══════════════════════════════════════════════════════════════
   MAPCO AI — Mock repository (development and tests only)
   ---------------------------------------------------------------
   Deliberately produces NO AI content.

   Mock fixtures exist so screens can be developed without a backend.
   Inventing a plausible "MAPCO Intelligence" snapshot here would put
   fabricated business insight one import away from a production
   surface, and would make a broken pipeline look like a working one.

   So every read reports `unavailable / disabled`: the exact state a
   real dealer sees before AI is switched on for them. That is the
   state MAPCO's surfaces must render correctly, so it is the state
   development exercises.
   ═══════════════════════════════════════════════════════════════ */

import { ok, err, type Result, type QueryOptions } from './contracts';
import {
  aiUnavailable, AI_DISABLED_STATUS,
  type AiAvailability, type AiActionDecision, type AiJobType, type AiRepository,
} from '../ai/contracts';
import type {
  AiActionProposal, AiAnswer, AiArtifactKind, AiArtifactSummary, AiIntelligenceSnapshot,
  AiMarketingSuggestion, AiSignalSet, AiStatus, AiUsageRow, AiWeeklyReport,
} from '../ai/types';

function aborted<T>(opts?: QueryOptions): Result<T> | null {
  return opts?.signal?.aborted ? err('aborted', 'Request cancelled') : null;
}

export class MockAiRepository implements AiRepository {
  async status(opts?: QueryOptions): Promise<Result<AiStatus>> {
    return aborted<AiStatus>(opts) ?? ok(AI_DISABLED_STATUS);
  }

  async snapshot(_periodKey?: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiIntelligenceSnapshot>>> {
    return aborted<AiAvailability<AiIntelligenceSnapshot>>(opts)
      ?? ok(aiUnavailable<AiIntelligenceSnapshot>('disabled'));
  }

  async weeklyReport(_periodKey?: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiWeeklyReport>>> {
    return aborted<AiAvailability<AiWeeklyReport>>(opts)
      ?? ok(aiUnavailable<AiWeeklyReport>('disabled'));
  }

  async signals(_periodKey?: string, opts?: QueryOptions): Promise<Result<AiAvailability<AiSignalSet>>> {
    return aborted<AiAvailability<AiSignalSet>>(opts)
      ?? ok(aiUnavailable<AiSignalSet>('disabled'));
  }

  async marketingSuggestion(
    _propertyId: string,
    opts?: QueryOptions,
  ): Promise<Result<AiAvailability<AiMarketingSuggestion>>> {
    return aborted<AiAvailability<AiMarketingSuggestion>>(opts)
      ?? ok(aiUnavailable<AiMarketingSuggestion>('disabled'));
  }

  async history(
    _kind: AiArtifactKind,
    _limit?: number,
    opts?: QueryOptions,
  ): Promise<Result<readonly AiArtifactSummary[]>> {
    return aborted<readonly AiArtifactSummary[]>(opts) ?? ok([]);
  }

  async usage(_days?: number, opts?: QueryOptions): Promise<Result<readonly AiUsageRow[]>> {
    return aborted<readonly AiUsageRow[]>(opts) ?? ok([]);
  }

  async pendingActions(opts?: QueryOptions): Promise<Result<readonly AiActionProposal[]>> {
    return aborted<readonly AiActionProposal[]>(opts) ?? ok([]);
  }

  async decideAction(
    _id: string,
    _decision: AiActionDecision,
    _note?: string,
    opts?: QueryOptions,
  ): Promise<Result<void>> {
    return aborted<void>(opts) ?? err('unavailable', 'AI is not available in mock mode');
  }

  async contextFacts(
    _windowDays?: number,
    opts?: QueryOptions,
  ): Promise<Result<Readonly<Record<string, unknown>>>> {
    return aborted<Readonly<Record<string, unknown>>>(opts)
      ?? err('unavailable', 'AI is not available in mock mode');
  }

  async ask(_question: string, _windowDays?: number, opts?: QueryOptions): Promise<Result<AiAnswer | null>> {
    // null, not a fabricated answer: "AI is off" is the honest result.
    return aborted<AiAnswer | null>(opts) ?? ok(null);
  }

  async enqueue(
    _jobType: AiJobType,
    _idempotencyKey: string,
    _input?: Readonly<Record<string, unknown>>,
    opts?: QueryOptions,
  ): Promise<Result<{ readonly created: boolean }>> {
    return aborted<{ readonly created: boolean }>(opts)
      ?? err('unavailable', 'AI is not available in mock mode');
  }
}
