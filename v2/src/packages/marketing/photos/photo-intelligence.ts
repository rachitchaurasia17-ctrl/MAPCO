/* ─────────────────────────────────────────────────────────────────
   DORMANT — not part of the V1 operator workflow.

   V1 is human-directed: the operator writes their own prompt and lets
   ChatGPT make every creative decision. MAPCO no longer selects
   templates, angles, objectives or properties per output, and ships no
   generated creative prompt.

   This module is retained, compiling and tested, for a future
   automation milestone. Nothing in src/apps/ops imports it.
   ───────────────────────────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — Photo selection

   Provider-neutral by design. The only implementation that ships in
   this milestone is deterministic: it ranks on metadata it can actually
   observe (dimensions, orientation, aspect, byte size, duplicates,
   dealer ordering) and on nothing else.

   It deliberately does NOT pretend to understand photo content. A
   future multimodal provider implements the same `PhotoIntelligence`
   contract and the weekly pipeline does not change.
   ═══════════════════════════════════════════════════════════════ */
import type {
  PhotoCandidate, PhotoIntelligence, PhotoOrientation, PhotoRankContext, RankedPhoto,
} from '../types';

export function orientationOf(w?: number, h?: number): PhotoOrientation | undefined {
  if (!w || !h) return undefined;
  const r = w / h;
  if (r > 1.15) return 'landscape';
  if (r < 0.87) return 'portrait';
  return 'square';
}

/** Probe intrinsic dimensions in the browser. Never throws. */
export async function measurePhoto(url: string): Promise<{ width?: number; height?: number }> {
  if (typeof Image === 'undefined') return {};
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (v: { width?: number; height?: number }): void => {
      if (settled) return; settled = true; resolve(v);
    };
    img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => done({});
    setTimeout(() => done({}), 4000);
    img.src = url;
  });
}

/** Obvious non-assets: empty, data-uri placeholders, known-bad extensions. */
export function isUsablePhoto(p: PhotoCandidate): boolean {
  if (!p.url || !p.url.trim()) return false;
  if (p.url.startsWith('data:image/svg')) return false;
  if (p.width && p.height && (p.width < 400 || p.height < 400)) return false;
  return true;
}

/** Collapse exact-duplicate urls, keeping the earliest dealer ordering. */
export function dedupePhotos(photos: readonly PhotoCandidate[]): readonly PhotoCandidate[] {
  const seen = new Set<string>();
  const out: PhotoCandidate[] = [];
  for (const p of photos) {
    const key = p.url.split('?')[0]!;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * Deterministic ranking. Scores are explainable and reproducible —
 * identical inputs always produce identical output, which the weekly
 * planner relies on for idempotency.
 */
export class DeterministicPhotoIntelligence implements PhotoIntelligence {
  readonly name = 'deterministic-metadata-v1';
  /** Explicitly false: this provider cannot judge photo content. */
  readonly semantic = false;

  async rank(
    photos: readonly PhotoCandidate[],
    context: PhotoRankContext,
  ): Promise<readonly RankedPhoto[]> {
    const usable = dedupePhotos(photos).filter(isUsablePhoto);
    const ranked = usable.map((photo): RankedPhoto => {
      const reasons: string[] = [];
      let score = 100;

      // Dealer ordering is a real signal — the first photo is usually
      // the one the dealer considers representative.
      const orderPenalty = photo.index * 4;
      score -= orderPenalty;
      if (photo.index === 0) reasons.push('First photo in the dealer’s own order');

      const orientation = photo.orientation ?? orientationOf(photo.width, photo.height);
      if (context.preferredOrientation !== 'any' && orientation) {
        if (orientation === context.preferredOrientation) {
          score += 25;
          reasons.push(`Orientation matches the template (${orientation})`);
        } else {
          score -= 15;
          reasons.push(`Orientation is ${orientation}, template prefers ${context.preferredOrientation}`);
        }
      }

      if (photo.width && photo.height) {
        const px = photo.width * photo.height;
        if (px >= 1_500_000) { score += 12; reasons.push('High resolution'); }
        else if (px < 600_000) { score -= 12; reasons.push('Low resolution'); }
      } else {
        reasons.push('Dimensions unknown — ranked on order only');
      }

      // Strongly deprioritise a photo already used recently for this
      // property, so a repeated property still looks like a new post.
      if (context.recentlyUsedIds.includes(photo.id)) {
        score -= 60;
        reasons.push('Used recently for this property');
      }

      return { ...photo, score, reasons };
    });

    return ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  }
}

/** Build candidates from a property's display photo list. */
export function candidatesFrom(propertyId: string, photos: readonly string[]): readonly PhotoCandidate[] {
  return photos.map((url, index) => ({
    id: `${propertyId}#${index}`,
    url,
    index,
  }));
}

export const defaultPhotoIntelligence = new DeterministicPhotoIntelligence();
