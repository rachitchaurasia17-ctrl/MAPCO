import type {
  Deal, DealDocument, DealTimelineEntry,
  PipelineDeal, DealStage, CommissionMode, CommissionSide, DealNextAction,
} from './types';

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

const hasValue = (source: UnknownRecord, ...keys: string[]): boolean => keys.some((key) => {
  if (!Object.prototype.hasOwnProperty.call(source, key)) return false;
  const value = source[key];
  return value !== null && value !== undefined && value !== '';
});

const text = (record: UnknownRecord, ...keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const amount = (record: UnknownRecord, ...keys: string[]): number => {
  for (const key of keys) {
    const value = record[key];
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(number)) return number;
  }
  return 0;
};

const flag = (value: unknown): boolean => value === true
  || value === 1
  || (typeof value === 'string' && ['true', 'yes', 'received', 'paid'].includes(value.trim().toLowerCase()));

const documents = (value: unknown): DealDocument[] => Array.isArray(value)
  ? value.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as UnknownRecord;
      const name = text(record, 'name');
      if (!name) return [];
      const kind = text(record, 'kind');
      const url = text(record, 'url');
      return [{ name, ...(kind ? { kind } : {}), ...(url ? { url } : {}) }];
    })
  : [];

const timeline = (value: unknown): DealTimelineEntry[] => Array.isArray(value)
  ? value.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as UnknownRecord;
      const at = text(record, 'at');
      const label = text(record, 'label');
      return at && label ? [{ at, label }] : [];
    })
  : [];

const COMPLETED_STAGES = new Set(['sold', 'completed', 'complete', 'closed', 'registered']);
const NON_COMPLETED_STAGES = new Set([
  'active', 'open', 'pending', 'lead', 'enquiry', 'inquiry',
  'negotiating', 'negotiation', 'token', 'registry',
  'lost', 'cancelled', 'canceled',
]);

/**
 * Normalize dealer-private completed-sale payloads at the adapter boundary.
 * Old negotiation rows deliberately return null: My Deals is a completed-sales
 * register, not the retired pipeline. No missing private value is fabricated.
 */
export function normalizeCompletedDeal(id: string, payload: UnknownRecord): Deal | null {
  const soldDate = text(payload, 'soldDate', 'saleDate', 'closedDate');
  const legacyStage = text(payload, 'stage', 'status', 'internalStatus').toLowerCase();
  // A planned sale/registration date was common on the retired pipeline. An
  // explicit non-completed stage is authoritative and must never leak into the
  // completed-sales register merely because that tentative date exists.
  if (NON_COMPLETED_STAGES.has(legacyStage)) return null;
  if (!soldDate && !COMPLETED_STAGES.has(legacyStage)) return null;

  const registrationDate = text(payload, 'registrationDate', 'registeredDate');
  const normalizedTimeline = timeline(payload.timeline);
  const nestedSeller = record(payload.seller);
  const seller = text(payload, 'seller') || (nestedSeller ? text(nestedSeller, 'name') : '');
  const sellerPhone = text(payload, 'sellerPhone') || (nestedSeller ? text(nestedSeller, 'phone') : '');
  const sellerId = text(payload, 'sellerId');

  return {
    id,
    propId: text(payload, 'propId', 'propertyId'),
    prop: text(payload, 'prop', 'property', 'name'),
    propSub: text(payload, 'propSub'),
    city: text(payload, 'city', 'area'),
    sector: text(payload, 'sector'),
    buyerId: text(payload, 'buyerId', 'clientId'),
    buyer: text(payload, 'buyer', 'client'),
    seller,
    ...(sellerId ? { sellerId } : {}),
    ...(sellerPhone ? { sellerPhone } : {}),
    soldPrice: amount(payload, 'soldPrice', 'value'),
    brokerage: amount(payload, 'brokerage'),
    commission: amount(payload, 'commission', 'comm'),
    commissionReceived: flag(payload.commissionReceived),
    paymentReceived: amount(payload, 'paymentReceived', 'token'),
    soldDate,
    ...(registrationDate ? { registrationDate } : {}),
    dealer: text(payload, 'dealer', 'dealerName'),
    documents: documents(payload.documents),
    timeline: normalizedTimeline.length
      ? normalizedTimeline
      : [
          ...(soldDate ? [{ at: soldDate, label: 'Sold price recorded' }] : []),
          ...(registrationDate ? [{ at: registrationDate, label: 'Registration completed' }] : []),
        ],
    fieldPresence: {
      soldPrice: hasValue(payload, 'soldPrice', 'value'),
      brokerage: hasValue(payload, 'brokerage'),
      commission: hasValue(payload, 'commission', 'comm'),
      commissionReceived: hasValue(payload, 'commissionReceived'),
      paymentReceived: hasValue(payload, 'paymentReceived', 'token'),
      soldDate: hasValue(payload, 'soldDate', 'saleDate', 'closedDate'),
      documents: Object.prototype.hasOwnProperty.call(payload, 'documents') && Array.isArray(payload.documents),
      timeline: Object.prototype.hasOwnProperty.call(payload, 'timeline') && Array.isArray(payload.timeline),
    },
  };
}

/* ───────────────────────────────────────────────────────────────
   PIPELINE DEALS
   A deal in flight. Kept beside the completed-sale normalizer so both
   readings of the same canonical crm_records row live in one place.
   Nothing here fabricates a value the dealer has not recorded: an
   unset deal value stays undefined rather than becoming 0.
   ─────────────────────────────────────────────────────────────── */

const PIPELINE_STAGES = new Set<DealStage>(['negotiating', 'token', 'registry', 'closed', 'lost']);

const optionalAmount = (source: UnknownRecord, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = source[key];
    if (value === null || value === undefined || value === '') continue;
    const number = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
};

const commissionSide = (value: unknown): CommissionSide => {
  const source = record(value);
  if (!source) return { mode: 'none' };
  const raw = text(source, 'mode').toLowerCase();
  const mode: CommissionMode = raw === 'pct' || raw === 'fixed' ? raw : 'none';
  const percent = optionalAmount(source, 'percent');
  const fixed = optionalAmount(source, 'fixed');
  return {
    mode,
    ...(mode === 'pct' && percent !== undefined ? { percent } : {}),
    ...(mode === 'fixed' && fixed !== undefined ? { fixed } : {}),
  };
};

const nextAction = (value: unknown): DealNextAction | undefined => {
  const source = record(value);
  if (!source) return undefined;
  const kind = text(source, 'kind');
  if (!kind) return undefined;
  const note = text(source, 'note');
  const dueOn = text(source, 'dueOn');
  return { kind, ...(note ? { note } : {}), ...(dueOn ? { dueOn } : {}) };
};

/** `enquiry` is a retired alias that reads as Negotiating. */
export function readDealStage(value: unknown): DealStage {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'enquiry' || raw === 'inquiry') return 'negotiating';
  return PIPELINE_STAGES.has(raw as DealStage) ? raw as DealStage : 'negotiating';
}

/**
 * Normalize a deal payload into its in-flight shape. Returns null for rows
 * that are not pipeline deals, so a completed-sale register row can never be
 * mistaken for an open negotiation.
 */
export function normalizePipelineDeal(id: string, payload: UnknownRecord): PipelineDeal | null {
  if (text(payload, 'recordType') !== 'pipeline') return null;
  const propertyId = text(payload, 'propertyId', 'propId');
  const buyerId = text(payload, 'buyerId', 'clientId');
  if (!id || !propertyId || !buyerId) return null;

  const commission = record(payload.commission);
  const sellerId = text(payload, 'sellerId');
  const seller = text(payload, 'seller');
  const sellerPhone = text(payload, 'sellerPhone');
  const value = optionalAmount(payload, 'value');
  const action = nextAction(payload.nextAction);
  const tokenDate = text(payload, 'tokenDate');
  const registryDate = text(payload, 'registryDate');
  const lostReason = text(payload, 'lostReason');
  const lostOn = text(payload, 'lostOn');
  const createdAt = text(payload, 'createdAt');

  return {
    id,
    stage: readDealStage(payload.stage),
    propertyId,
    prop: text(payload, 'prop', 'property', 'name'),
    propSub: text(payload, 'propSub'),
    city: text(payload, 'city', 'area'),
    sector: text(payload, 'sector'),
    buyerId,
    buyer: text(payload, 'buyer', 'client'),
    ...(sellerId ? { sellerId } : {}),
    ...(seller ? { seller } : {}),
    ...(sellerPhone ? { sellerPhone } : {}),
    ...(value !== undefined ? { value } : {}),
    commission: {
      buyer: commissionSide(commission?.buyer),
      seller: commissionSide(commission?.seller),
    },
    ...(action ? { nextAction: action } : {}),
    ...(tokenDate ? { tokenDate } : {}),
    ...(registryDate ? { registryDate } : {}),
    ...(lostReason ? { lostReason } : {}),
    ...(lostOn ? { lostOn } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
}

/** Mirror of plotmap_deal_commission_side so client-side previews agree. */
export function expectedCommissionSide(value: number, side: CommissionSide): number {
  if (side.mode === 'fixed') return Math.round(side.fixed ?? 0);
  if (side.mode === 'pct') return Math.round((value || 0) * (side.percent ?? 0) / 100);
  return 0;
}
