import type { Property } from '../../data/types';

export const RAW_REEL_MAX_BYTES = 250 * 1024 * 1024;
export const FINISHED_REEL_MAX_BYTES = 150 * 1024 * 1024;
export const REEL_VIDEO_MIME_TYPES = [
  'video/mp4', 'video/quicktime', 'video/webm',
] as const;

export interface ReelUploadProblem {
  readonly field: 'mime' | 'bytes' | 'contentHash';
  readonly message: string;
}

export function validateReelUpload(
  mime: string,
  bytes: number,
  contentHash: string,
  kind: 'raw' | 'finished' = 'raw',
): readonly ReelUploadProblem[] {
  const problems: ReelUploadProblem[] = [];
  if (!(REEL_VIDEO_MIME_TYPES as readonly string[]).includes(mime)) {
    problems.push({ field: 'mime', message: 'Only MP4, MOV, and WebM video is accepted.' });
  }
  const limit = kind === 'raw' ? RAW_REEL_MAX_BYTES : FINISHED_REEL_MAX_BYTES;
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > limit) {
    problems.push({ field: 'bytes', message: `Video must be between 1 byte and ${limit} bytes.` });
  }
  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    problems.push({ field: 'contentHash', message: 'A lowercase SHA-256 content hash is required.' });
  }
  return problems;
}

const extensionFor = (mime: string): string => ({
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}[mime] ?? 'bin');

const segment = (value: string): string => {
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(value)) throw new Error('Unsafe storage identity');
  return value;
};

export function reelStoragePath(input: {
  readonly dealerId: string;
  readonly periodStart: string;
  readonly jobId: string;
  readonly kind: 'raw' | 'finished';
  readonly contentHash: string;
  readonly mime: string;
}): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart)) throw new Error('Invalid period start');
  if (!/^[0-9a-f]{64}$/.test(input.contentHash)) throw new Error('Invalid content hash');
  return [
    segment(input.dealerId), input.periodStart, segment(input.jobId), input.kind,
    `${input.contentHash}.${extensionFor(input.mime)}`,
  ].join('/');
}

export function isMarketableProperty(property: Property): boolean {
  const lifecycle = property.lifecycle ?? (property.sold ? 'sold' : property.published ? 'on-sale' : 'draft');
  return lifecycle === 'on-sale' && property.published && !property.sold;
}

/** Deliberately excludes price, owner/seller, notes, coordinates, maps and documents. */
export function marketingSafePropertyFacts(property: Property): Readonly<Record<string, unknown>> {
  if (!isMarketableProperty(property)) throw new Error('property_not_marketable');
  return {
    id: property.id,
    type: property.type,
    want: property.want,
    city: property.city,
    area: property.area,
    sector: property.sector,
    size: property.size,
    facing: property.facing,
    position: property.position,
    approvals: [...property.approvals],
    landmarks: property.landmarks.map(({ name, distance }) => ({ name, distance })),
  };
}

