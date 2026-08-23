/* Dealer-facing Marketing projection.

   Supabase mode is broker-only and fail-closed: no local fixtures are ever
   substituted for a rejected or unavailable MAPCO-DEV request. */
import { activeDataMode } from '../data/adapter';
import { getSupabase } from '../data/supabase/client';

export type MarketingChannel = 'instagram' | 'facebook_page' | 'google_business' | 'whatsapp_business';

export interface DealerCreative {
  readonly id: string;
  readonly slotRef: string;
  readonly localDate: string;
  readonly status: 'ready' | 'posted';
  readonly propertyId: string;
  readonly propertyLabel: string;
  readonly caption?: string;
  readonly channels: readonly MarketingChannel[];
  readonly displayUrl: string;
  readonly mime?: string;
  readonly approvedAt?: string;
  readonly publicationStates: readonly { channel: string; status: string }[];
}

export interface MarketingPerformanceRow {
  readonly provider: string;
  readonly scope: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly metrics: Readonly<Record<string, number>>;
}

export interface MarketingConnection {
  readonly provider: MarketingChannel;
  readonly displayName?: string;
  readonly status: string;
  readonly connectedAt?: string;
}

export interface DealerMarketingFeed {
  readonly dealerId: string;
  readonly creatives: readonly DealerCreative[];
  readonly performance: readonly MarketingPerformanceRow[];
  readonly connections: readonly MarketingConnection[];
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';

export async function loadDealerMarketingFeed(): Promise<DealerMarketingFeed> {
  if (activeDataMode() === 'mock') return { dealerId: 'dealer-1', creatives: [], performance: [], connections: [] };
  const client = await getSupabase();
  if (!client) throw new Error('MAPCO-DEV is not configured');
  const { data, error } = await client.functions.invoke('marketing-ops', { body: { action: 'dealer-feed' } });
  if (error) throw error;
  const envelope = record(data);
  if (envelope.ok === false) throw new Error(text(envelope.reason) || 'Marketing feed unavailable');

  const creatives = list(envelope.creatives).map((entry): DealerCreative | null => {
    const row = record(entry); const asset = record(row.asset);
    const displayUrl = text(asset.displayUrl);
    if (!text(row.id) || !displayUrl) return null;
    return {
      id: text(row.id), slotRef: text(row.slotRef), localDate: text(row.localDate),
      status: text(row.status) === 'posted' ? 'posted' : 'ready', propertyId: text(row.propertyId),
      propertyLabel: text(row.propertyLabel) || text(row.propertyId), caption: text(row.caption) || undefined,
      channels: list(row.channels).map(text).filter((channel): channel is MarketingChannel =>
        channel === 'instagram' || channel === 'facebook_page' || channel === 'google_business' || channel === 'whatsapp_business'),
      displayUrl, mime: text(asset.mime) || undefined, approvedAt: text(row.approvedAt) || undefined,
      publicationStates: list(row.publicationStates).map((state) => ({
        channel: text(record(state).channel), status: text(record(state).status),
      })).filter((state) => state.channel && state.status),
    };
  }).filter((creative): creative is DealerCreative => creative !== null);

  const performance = list(envelope.performance).map((entry): MarketingPerformanceRow => {
    const row = record(entry); const rawMetrics = record(row.metrics); const metrics: Record<string, number> = {};
    for (const [key, value] of Object.entries(rawMetrics)) {
      if (typeof value === 'number' && Number.isFinite(value)) metrics[key] = value;
    }
    return { provider: text(row.provider), scope: text(row.scope), periodStart: text(row.periodStart),
      periodEnd: text(row.periodEnd), metrics };
  });
  const connections = list(envelope.connections).map((entry): MarketingConnection => {
    const row = record(entry);
    return { provider: text(row.provider) as MarketingChannel, displayName: text(row.displayName) || undefined,
      status: text(row.status), connectedAt: text(row.connectedAt) || undefined };
  }).filter((connection) => connection.provider);
  return { dealerId: text(envelope.dealerId), creatives, performance, connections };
}
