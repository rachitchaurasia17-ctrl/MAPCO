/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — bulk return from ChatGPT

   The operator drags finished images back in. MAPCO matches each file
   to a creative by the id embedded in its filename.

   Matching is strict and explicit: an ambiguous or unrecognised file is
   REPORTED, never guessed at. Silently attaching the wrong creative to
   the wrong property would be worse than rejecting the file.
   ═══════════════════════════════════════════════════════════════ */
import type { CreativeBrief, CreativeId } from '../types';

export type ImportOutcome = 'matched' | 'unmatched' | 'duplicate' | 'invalid';

export interface ImportCandidate {
  readonly fileName: string;
  readonly outcome: ImportOutcome;
  readonly creativeId?: CreativeId;
  /** Why it was rejected, or a note about the match. */
  readonly note: string;
  readonly file?: File;
  readonly width?: number;
  readonly height?: number;
}

const ACCEPTED_MIME = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_RESULT_BYTES = 15 * 1024 * 1024;

/** 4:5 portrait, with tolerance for a model that lands slightly off. */
const TARGET_RATIO = 1080 / 1350;
const RATIO_TOLERANCE = 0.06;

/**
 * Pull a creative id out of a filename. Accepts `C001.png`,
 * `C001 (1).png`, `c001-final.jpg`, `MAPCO-C001.png`.
 * Returns null when there is no unambiguous single id.
 */
export function extractCreativeId(fileName: string): CreativeId | null {
  const matches = fileName.toUpperCase().match(/C\d{3}/g);
  if (!matches || matches.length === 0) return null;
  const unique = [...new Set(matches)];
  // Two different ids in one filename is ambiguous — refuse it.
  if (unique.length > 1) return null;
  return unique[0]!;
}

async function measure(file: File): Promise<{ width?: number; height?: number }> {
  if (typeof Image === 'undefined' || typeof URL === 'undefined') return {};
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;
    const done = (v: { width?: number; height?: number }): void => {
      if (settled) return; settled = true;
      URL.revokeObjectURL(url);
      resolve(v);
    };
    img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => done({});
    setTimeout(() => done({}), 4000);
    img.src = url;
  });
}

export interface MatchContext {
  readonly briefs: readonly CreativeBrief[];
  /** Creative ids that already have an uploaded result. */
  readonly alreadyUploaded: readonly CreativeId[];
}

/**
 * Classify a batch of dropped files. Pure decision-making apart from
 * reading image dimensions.
 */
export async function matchFiles(
  files: readonly File[], context: MatchContext,
): Promise<readonly ImportCandidate[]> {
  const valid = new Set(context.briefs.map((b) => b.id));
  const uploaded = new Set(context.alreadyUploaded);
  const seenThisBatch = new Set<CreativeId>();
  const out: ImportCandidate[] = [];

  for (const file of files) {
    if (!ACCEPTED_MIME.includes(file.type)) {
      out.push({ fileName: file.name, outcome: 'invalid', note: `Unsupported type ${file.type || 'unknown'} — PNG, JPEG or WebP only` });
      continue;
    }
    if (file.size > MAX_RESULT_BYTES) {
      out.push({ fileName: file.name, outcome: 'invalid', note: `Too large (${(file.size / 1048576).toFixed(1)} MB, limit 15 MB)` });
      continue;
    }

    const id = extractCreativeId(file.name);
    if (!id) {
      out.push({ fileName: file.name, outcome: 'unmatched', note: 'No creative id (like C001) found in the filename' });
      continue;
    }
    if (!valid.has(id)) {
      out.push({ fileName: file.name, outcome: 'unmatched', creativeId: id, note: `${id} is not part of this week` });
      continue;
    }
    if (seenThisBatch.has(id)) {
      out.push({ fileName: file.name, outcome: 'duplicate', creativeId: id, note: `Another file in this batch is also ${id}` });
      continue;
    }

    const { width, height } = await measure(file);
    let note = uploaded.has(id) ? `Replaces the existing image for ${id}` : `Matched to ${id}`;
    if (width && height) {
      const ratio = width / height;
      if (Math.abs(ratio - TARGET_RATIO) > RATIO_TOLERANCE) {
        note += ` · note: ${width}×${height} is not 4:5`;
      }
    }

    seenThisBatch.add(id);
    out.push({ fileName: file.name, outcome: 'matched', creativeId: id, note, file, width, height });
  }

  return out;
}

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });

export interface ImportSummary {
  readonly matched: number;
  readonly unmatched: number;
  readonly duplicate: number;
  readonly invalid: number;
}

export const summarise = (candidates: readonly ImportCandidate[]): ImportSummary => ({
  matched: candidates.filter((c) => c.outcome === 'matched').length,
  unmatched: candidates.filter((c) => c.outcome === 'unmatched').length,
  duplicate: candidates.filter((c) => c.outcome === 'duplicate').length,
  invalid: candidates.filter((c) => c.outcome === 'invalid').length,
});
