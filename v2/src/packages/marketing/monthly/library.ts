import type { MarketingCreativeType } from './types';

export interface MarketingLibraryRecord {
  readonly id: string;
  readonly creativeType: MarketingCreativeType;
  readonly propertyId: string;
  readonly propertyLabel: string;
  readonly displayUrl?: string;
  readonly posterUrl?: string;
  readonly durationSeconds?: number;
  readonly createdAt: string;
  readonly readyAt?: string;
  readonly publishingStatus: string;
  readonly platforms: readonly string[];
  readonly publishedAt?: string;
}

export type MarketingLibraryFilter = 'all' | 'posts' | 'reels';

export const filterMarketingLibrary = (
  records: readonly MarketingLibraryRecord[],
  filter: MarketingLibraryFilter,
): readonly MarketingLibraryRecord[] => filter === 'all'
  ? records
  : records.filter((record) => record.creativeType === (filter === 'posts' ? 'post' : 'reel'));

