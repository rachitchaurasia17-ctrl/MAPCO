/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing Ops — persistence with enforced dealer isolation

   Every method takes the operator's access grant and checks it BEFORE
   touching storage. Isolation is enforced in the store, not in the UI,
   so a bug in a screen cannot leak one dealer's work into another.

   LocalOpsStore backs mock/dev mode. A Supabase implementation slots in
   behind the same interface (see 20260815000100_marketing_weekly_packs.sql).
   ═══════════════════════════════════════════════════════════════ */
import type { NewPropertyAction } from './new-property';
import {
  assertDealerAccess,
  type CreativeAsset, type OperatorDealerAccess, type OpsStore, type OpsWeek,
  type OutputSlot, type SlotRef,
} from './types';

const WEEK_KEY = 'mapco.ops.weeks.v1';
const ASSET_KEY = 'mapco.ops.assets.v1';
const PACK_KEY = 'mapco.ops.packs.v1';
const BASELINE_KEY = 'mapco.ops.baseline.v1';
const ACTION_KEY = 'mapco.ops.newprops.v1';

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
  } catch { /* quota / private mode — stays in memory for this session */ }
}

const weekKey = (dealerId: string, weekId: string): string => `${dealerId}::${weekId}`;
const assetKey = (dealerId: string, weekId: string, ref: SlotRef): string => `${dealerId}::${weekId}::${ref}`;

export class LocalOpsStore implements OpsStore {
  private weeks: Record<string, OpsWeek> | null = null;
  private assets: Record<string, CreativeAsset> | null = null;
  private packs: Record<string, string> | null = null;
  private baselines: Record<string, string[]> | null = null;
  private actions: Record<string, NewPropertyAction> | null = null;

  private weekBag(): Record<string, OpsWeek> {
    this.weeks ??= read<Record<string, OpsWeek>>(WEEK_KEY, {});
    return this.weeks;
  }
  private assetBag(): Record<string, CreativeAsset> {
    this.assets ??= read<Record<string, CreativeAsset>>(ASSET_KEY, {});
    return this.assets;
  }
  private packBag(): Record<string, string> {
    this.packs ??= read<Record<string, string>>(PACK_KEY, {});
    return this.packs;
  }

  async getWeek(operator: OperatorDealerAccess, dealerId: string, weekId: string): Promise<OpsWeek | null> {
    assertDealerAccess(operator, dealerId);
    const week = this.weekBag()[weekKey(dealerId, weekId)] ?? null;
    // Belt and braces: never hand back a record stamped for another dealer.
    if (week && week.dealerId !== dealerId) return null;
    return week;
  }

  async saveWeek(operator: OperatorDealerAccess, week: OpsWeek): Promise<void> {
    assertDealerAccess(operator, week.dealerId);
    const bag = this.weekBag();
    bag[weekKey(week.dealerId, week.weekId)] = week;
    write(WEEK_KEY, bag);
  }

  async updateSlot(
    operator: OperatorDealerAccess, dealerId: string, weekId: string, slot: OutputSlot,
  ): Promise<void> {
    assertDealerAccess(operator, dealerId);
    if (slot.dealerId !== dealerId) throw new Error('Slot belongs to a different dealer');
    const bag = this.weekBag();
    const key = weekKey(dealerId, weekId);
    const week = bag[key];
    if (!week) return;
    bag[key] = { ...week, slots: week.slots.map((s) => (s.ref === slot.ref ? slot : s)) };
    write(WEEK_KEY, bag);
  }

  async saveAsset(operator: OperatorDealerAccess, asset: CreativeAsset): Promise<void> {
    assertDealerAccess(operator, asset.dealerId);
    const bag = this.assetBag();
    bag[assetKey(asset.dealerId, asset.weekId, asset.slotRef)] = asset;
    write(ASSET_KEY, bag);
  }

  async getAsset(
    operator: OperatorDealerAccess, dealerId: string, slotRef: SlotRef, weekId: string,
  ): Promise<CreativeAsset | null> {
    assertDealerAccess(operator, dealerId);
    const asset = this.assetBag()[assetKey(dealerId, weekId, slotRef)] ?? null;
    if (asset && asset.dealerId !== dealerId) return null;
    return asset;
  }

  async listAssets(
    operator: OperatorDealerAccess, dealerId: string, weekId: string,
  ): Promise<readonly CreativeAsset[]> {
    assertDealerAccess(operator, dealerId);
    return Object.values(this.assetBag())
      .filter((a) => a.dealerId === dealerId && a.weekId === weekId);
  }

  async markPackDownloaded(operator: OperatorDealerAccess, dealerId: string, weekId: string): Promise<void> {
    assertDealerAccess(operator, dealerId);
    const bag = this.packBag();
    bag[weekKey(dealerId, weekId)] = new Date().toISOString();
    write(PACK_KEY, bag);
  }

  async packDownloadedAt(
    operator: OperatorDealerAccess, dealerId: string, weekId: string,
  ): Promise<string | undefined> {
    assertDealerAccess(operator, dealerId);
    return this.packBag()[weekKey(dealerId, weekId)];
  }

  /* ── mid-week new-property support ─────────────────────────── */

  private baselineBag(): Record<string, string[]> {
    this.baselines ??= read<Record<string, string[]>>(BASELINE_KEY, {});
    return this.baselines;
  }
  private actionBag(): Record<string, NewPropertyAction> {
    this.actions ??= read<Record<string, NewPropertyAction>>(ACTION_KEY, {});
    return this.actions;
  }

  /**
   * The inventory present when the week opened. Everything published
   * after this is "new" for the purposes of the mid-week workflow.
   * Written once per week and never overwritten, so a property added on
   * Wednesday stays new even if the roster is reloaded.
   */
  async ensureBaseline(
    operator: OperatorDealerAccess, dealerId: string, weekId: string, propertyIds: readonly string[],
  ): Promise<readonly string[]> {
    assertDealerAccess(operator, dealerId);
    const bag = this.baselineBag();
    const key = weekKey(dealerId, weekId);
    if (!bag[key]) { bag[key] = [...propertyIds]; write(BASELINE_KEY, bag); }
    return bag[key]!;
  }

  async listActions(
    operator: OperatorDealerAccess, dealerId: string, weekId: string,
  ): Promise<readonly NewPropertyAction[]> {
    assertDealerAccess(operator, dealerId);
    return Object.values(this.actionBag())
      .filter((a) => a.dealerId === dealerId && a.weekId === weekId);
  }

  async saveAction(operator: OperatorDealerAccess, action: NewPropertyAction): Promise<void> {
    assertDealerAccess(operator, action.dealerId);
    const bag = this.actionBag();
    // Keyed by dealer::week::property — raising the same property twice
    // updates the one action rather than creating a duplicate.
    bag[action.id] = action;
    write(ACTION_KEY, bag);
  }

  async getAction(
    operator: OperatorDealerAccess, dealerId: string, actionId: string,
  ): Promise<NewPropertyAction | null> {
    assertDealerAccess(operator, dealerId);
    const action = this.actionBag()[actionId] ?? null;
    if (action && action.dealerId !== dealerId) return null;
    return action;
  }
}

export const localOpsStore = new LocalOpsStore();
