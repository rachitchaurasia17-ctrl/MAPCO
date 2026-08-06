import type { DealerPredictionSummary } from './types';

interface SessionEntry { count: number; lastAt: number; }

export class SessionLearning {
  private readonly transitions = new Map<string, SessionEntry>();
  private readonly recent = new Map<string, number>();

  constructor(readonly scopeId: string, readonly sessionId: string) {}

  record(fromType: string, fromId: string, toType: string, toId: string, now = Date.now()): void {
    const key = `${fromType}:${fromId}>${toType}:${toId}`;
    const previous = this.transitions.get(key);
    this.transitions.set(key, { count: (previous?.count ?? 0) + 1, lastAt: now });
    this.recent.set(`${toType}:${toId}`, now);
  }

  transitionScore(fromType: string, fromId: string, toType: string, toId: string, now = Date.now()): number {
    const value = this.transitions.get(`${fromType}:${fromId}>${toType}:${toId}`);
    if (!value) return 0;
    const recency = Math.exp(-(now - value.lastAt) / (30 * 60_000));
    return Math.min(1, value.count / 4) * (0.55 + recency * 0.45);
  }

  recentScore(type: string, id: string, now = Date.now()): number {
    const at = this.recent.get(`${type}:${id}`);
    return at ? Math.exp(-(now - at) / (20 * 60_000)) : 0;
  }

  static dealerScores(summaries: readonly DealerPredictionSummary[], fromType: string, fromId: string, toType: string, toId: string, now = Date.now()): { recent: number; history: number } {
    const row = summaries.find((item) => item.fromType === fromType && item.fromId === fromId && item.toType === toType && item.toId === toId);
    if (!row) return { recent: 0, history: 0 };
    const ageDays = Math.max(0, (now - Date.parse(row.lastUsedAt)) / 86_400_000);
    return {
      recent: Math.min(1, row.recentScore) * Math.exp(-ageDays / 14),
      history: Math.min(1, Math.log2(row.count + 1) / 6) * Math.exp(-ageDays / 90),
    };
  }
}
