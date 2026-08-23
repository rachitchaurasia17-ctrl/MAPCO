/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — plan persistence

   LocalPlanStore backs the current mock/dev mode. It implements the
   same `MarketingPlanStore` interface a Supabase-backed store will,
   so swapping persistence does not touch the planner, the pack builder
   or the UI.

   Dealer scoping is explicit in every key, so one browser profile
   holding two dealers can never cross-read.
   ═══════════════════════════════════════════════════════════════ */
import type {
  CreativeBrief, MarketingHistoryEntry, MarketingPlanStore, StoredResult, WeeklyPlan,
} from '../types';
import { toHistory } from '../planner/weekly-planner';

const PLAN_KEY = 'mapco.marketing.plans.v1';
const RESULT_KEY = 'mapco.marketing.results.v1';

type PlanBag = Record<string, WeeklyPlan>;
type ResultBag = Record<string, StoredResult>;

function read<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function write(key: string, value: unknown): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota or private mode — the plan stays in memory for this session */ }
}

const planId = (dealerId: string, weekId: string): string => `${dealerId}::${weekId}`;
const resultId = (dealerId: string, creativeId: string): string => `${dealerId}::${creativeId}`;

export class LocalPlanStore implements MarketingPlanStore {
  private memoryPlans: PlanBag | null = null;
  private memoryResults: ResultBag | null = null;

  private plans(): PlanBag {
    this.memoryPlans ??= read<PlanBag>(PLAN_KEY, {});
    return this.memoryPlans;
  }
  private results(): ResultBag {
    this.memoryResults ??= read<ResultBag>(RESULT_KEY, {});
    return this.memoryResults;
  }

  async getPlan(dealerId: string, weekId: string): Promise<WeeklyPlan | null> {
    return this.plans()[planId(dealerId, weekId)] ?? null;
  }

  async savePlan(plan: WeeklyPlan): Promise<void> {
    const bag = this.plans();
    bag[planId(plan.dealerId, plan.weekId)] = plan;
    write(PLAN_KEY, bag);
  }

  async listPlans(dealerId: string, limit = 12): Promise<readonly WeeklyPlan[]> {
    return Object.values(this.plans())
      .filter((p) => p.dealerId === dealerId)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .slice(0, limit);
  }

  async updateBrief(dealerId: string, weekId: string, brief: CreativeBrief): Promise<void> {
    const bag = this.plans();
    const key = planId(dealerId, weekId);
    const plan = bag[key];
    if (!plan) return;
    bag[key] = {
      ...plan,
      days: plan.days.map((d) => ({
        ...d,
        briefs: d.briefs.map((b) => (b.id === brief.id ? brief : b)),
      })),
    };
    write(PLAN_KEY, bag);
  }

  async saveResult(dealerId: string, result: StoredResult): Promise<void> {
    const bag = this.results();
    bag[resultId(dealerId, result.creativeId)] = result;
    write(RESULT_KEY, bag);
  }

  async getResult(dealerId: string, creativeId: string): Promise<StoredResult | null> {
    return this.results()[resultId(dealerId, creativeId)] ?? null;
  }

  /** Every brief from previous weeks — seeds cooldowns and rotations. */
  async history(dealerId: string, sinceIso: string): Promise<readonly MarketingHistoryEntry[]> {
    const plans = Object.values(this.plans()).filter((p) => p.dealerId === dealerId);
    return plans
      .flatMap((p) => toHistory(p))
      .filter((h) => h.localDate >= sinceIso);
  }
}

export const localPlanStore = new LocalPlanStore();
