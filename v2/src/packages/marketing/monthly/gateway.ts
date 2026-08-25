import { getSupabase } from '../../data/supabase/client';
import { validateReelUpload } from './media';
import type { MarketingUsage, ReelJobState } from './types';

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';

async function client() {
  const value = await getSupabase();
  if (!value) throw new Error('MAPCO-DEV is not configured');
  return value;
}

function domainResult(data: unknown, fallback: string): JsonRecord {
  const result = record(data);
  if (result.ok !== true) throw new Error(text(result.reason) || fallback);
  return result;
}

async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadMarketingUsage(): Promise<MarketingUsage> {
  const supabase = await client();
  const { data, error } = await supabase.functions.invoke('marketing-ops', { body: { action: 'usage' } });
  if (error) throw error;
  const row = domainResult(data, 'Marketing usage unavailable');
  return {
    postsEntitled: Number(row.postsEntitled), postsUsed: Number(row.postsUsed),
    postsRemaining: Number(row.postsRemaining), reelsEntitled: Number(row.reelsEntitled),
    reelsUsed: Number(row.reelsUsed), reelsRemaining: Number(row.reelsRemaining),
    periodStart: text(row.periodStart), periodEnd: text(row.periodEnd),
  };
}

export interface DealerReelSubmission {
  readonly propertyId: string;
  readonly submissionKey: string;
  readonly file: File;
  readonly note?: string;
}

export interface ReelSubmissionResult {
  readonly jobId: string;
  readonly quotaNumber: number;
  readonly state: ReelJobState;
  readonly idempotent: boolean;
}

export async function submitDealerReel(input: DealerReelSubmission): Promise<ReelSubmissionResult> {
  const contentHash = await sha256(input.file);
  const problems = validateReelUpload(input.file.type, input.file.size, contentHash, 'raw');
  if (problems.length) throw new Error(problems.map((problem) => problem.message).join(' '));
  const supabase = await client();
  const { data, error } = await supabase.rpc('plotmap_marketing_reserve_reel', {
    p_property_id: input.propertyId,
    p_submission_key: input.submissionKey,
    p_note: input.note ?? null,
    p_mime: input.file.type,
    p_bytes: input.file.size,
    p_content_hash: contentHash,
  });
  if (error) throw error;
  const reserved = domainResult(data, 'Could not reserve Reel entitlement');
  const upload = record(reserved.upload);
  const bucket = text(upload.bucket); const path = text(upload.path);
  const jobId = text(reserved.jobId); const assetId = text(reserved.assetId);
  if (bucket !== 'marketing-reel-raw' || !path || !jobId || !assetId) throw new Error('Invalid Reel upload contract');

  const uploaded = await supabase.storage.from(bucket).upload(path, input.file, {
    contentType: input.file.type, upsert: false,
  });
  if (uploaded.error) {
    // A network retry may arrive after Storage accepted the original upload
    // but before the finalize response reached the browser.
    const retryFinalize = await supabase.rpc('plotmap_marketing_finalize_reel_asset', {
      p_job_id: jobId, p_asset_id: assetId,
    });
    if (retryFinalize.error || record(retryFinalize.data).ok !== true) throw uploaded.error;
  } else {
    const finalized = await supabase.rpc('plotmap_marketing_finalize_reel_asset', {
      p_job_id: jobId, p_asset_id: assetId,
    });
    if (finalized.error) throw finalized.error;
    domainResult(finalized.data, 'Could not finalize Reel upload');
  }
  return {
    jobId,
    quotaNumber: Number(reserved.quotaNumber),
    state: 'received',
    idempotent: reserved.idempotent === true,
  };
}

export interface OperatorReelJob {
  readonly id: string;
  readonly dealerId: string;
  readonly propertyId: string;
  readonly propertyLabel: string;
  readonly quotaNumber: number;
  readonly state: ReelJobState;
  readonly note?: string;
  readonly rawReady: boolean;
  readonly finishedReady: boolean;
  readonly creativeId?: string;
}

export async function loadOperatorReels(dealerId: string, periodStart?: string): Promise<readonly OperatorReelJob[]> {
  const supabase = await client();
  const { data, error } = await supabase.functions.invoke('marketing-ops', {
    body: { action: 'operator-reels', dealerId, ...(periodStart ? { periodStart } : {}) },
  });
  if (error) throw error;
  const envelope = domainResult(data, 'Reel jobs unavailable');
  return (Array.isArray(envelope.jobs) ? envelope.jobs : []).map((value) => {
    const row = record(value);
    return {
      id: text(row.id), dealerId, propertyId: text(row.propertyId),
      propertyLabel: text(row.propertyLabel), quotaNumber: Number(row.quotaNumber),
      state: text(row.state) as ReelJobState, note: text(row.note) || undefined,
      rawReady: row.rawReady === true, finishedReady: row.finishedReady === true,
      creativeId: text(row.creativeId) || undefined,
    };
  });
}

export async function markReelInEditing(jobId: string): Promise<void> {
  const supabase = await client();
  const { data, error } = await supabase.rpc('plotmap_marketing_mark_reel_in_editing', { p_job_id: jobId });
  if (error) throw error;
  domainResult(data, 'Could not update Reel state');
}

export interface FinishedReelInput {
  readonly jobId: string;
  readonly uploadKey: string;
  readonly file: File;
  readonly durationSeconds?: number;
  readonly width?: number;
  readonly height?: number;
  readonly caption?: string;
  readonly channels?: readonly ('instagram' | 'facebook_page')[];
  readonly scheduledFor?: string;
}

export async function finishReel(input: FinishedReelInput): Promise<{ readonly creativeId: string; readonly idempotent: boolean }> {
  const contentHash = await sha256(input.file);
  const problems = validateReelUpload(input.file.type, input.file.size, contentHash, 'finished');
  if (problems.length) throw new Error(problems.map((problem) => problem.message).join(' '));
  const supabase = await client();
  const prepared = await supabase.rpc('plotmap_marketing_prepare_finished_reel', {
    p_job_id: input.jobId, p_upload_key: input.uploadKey, p_mime: input.file.type,
    p_bytes: input.file.size, p_content_hash: contentHash,
    p_duration_seconds: input.durationSeconds ?? null,
    p_width: input.width ?? null, p_height: input.height ?? null,
  });
  if (prepared.error) throw prepared.error;
  const contract = domainResult(prepared.data, 'Could not prepare finished Reel upload');
  const upload = record(contract.upload); const bucket = text(upload.bucket); const path = text(upload.path);
  const assetId = text(contract.assetId);
  if (bucket !== 'marketing-reel-finished' || !path || !assetId) throw new Error('Invalid finished Reel contract');
  const uploaded = await supabase.storage.from(bucket).upload(path, input.file, {
    contentType: input.file.type, upsert: false,
  });
  if (uploaded.error) {
    const retryFinalize = await supabase.rpc('plotmap_marketing_finalize_reel_asset', {
      p_job_id: input.jobId, p_asset_id: assetId,
    });
    if (retryFinalize.error || record(retryFinalize.data).ok !== true) throw uploaded.error;
  } else {
    const finalized = await supabase.rpc('plotmap_marketing_finalize_reel_asset', {
      p_job_id: input.jobId, p_asset_id: assetId,
    });
    if (finalized.error) throw finalized.error;
    domainResult(finalized.data, 'Could not finalize finished Reel');
  }
  const ready = await supabase.rpc('plotmap_marketing_mark_reel_ready', {
    p_job_id: input.jobId, p_asset_id: assetId, p_caption: input.caption ?? null,
    p_channels: input.channels ?? [], p_scheduled_for: input.scheduledFor ?? null,
  });
  if (ready.error) throw ready.error;
  const result = domainResult(ready.data, 'Could not mark Reel ready');
  return { creativeId: text(result.creativeId), idempotent: result.idempotent === true };
}

