import type { Deal, DealDocument, DealTimelineEntry } from './types';

type UnknownRecord = Record<string, unknown>;

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

/**
 * Normalize dealer-private completed-sale payloads at the adapter boundary.
 * Old negotiation rows deliberately return null: My Deals is a completed-sales
 * register, not the retired pipeline. No missing private value is fabricated.
 */
export function normalizeCompletedDeal(id: string, payload: UnknownRecord): Deal | null {
  const soldDate = text(payload, 'soldDate', 'saleDate', 'closedDate');
  const legacyStage = text(payload, 'stage', 'status', 'internalStatus').toLowerCase();
  if (!soldDate && !COMPLETED_STAGES.has(legacyStage)) return null;

  const registrationDate = text(payload, 'registrationDate', 'registeredDate');
  const normalizedTimeline = timeline(payload.timeline);
  const sellerPhone = text(payload, 'sellerPhone');

  return {
    id,
    propId: text(payload, 'propId', 'propertyId'),
    prop: text(payload, 'prop', 'property', 'name'),
    propSub: text(payload, 'propSub'),
    city: text(payload, 'city', 'area'),
    sector: text(payload, 'sector'),
    buyerId: text(payload, 'buyerId', 'clientId'),
    buyer: text(payload, 'buyer', 'client'),
    seller: text(payload, 'seller'),
    ...(sellerPhone ? { sellerPhone } : {}),
    soldPrice: amount(payload, 'soldPrice', 'value'),
    brokerage: amount(payload, 'brokerage'),
    commission: amount(payload, 'commission', 'comm'),
    commissionReceived: payload.commissionReceived === true,
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
  };
}
