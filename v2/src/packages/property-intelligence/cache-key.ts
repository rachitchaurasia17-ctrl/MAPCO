/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · cache identity
   ---------------------------------------------------------------
   A stored generation is reused only while every input that could
   change its meaning is unchanged:

     dealer + property        whose intelligence this is
     canonical coordinate     the property MOVED → new intelligence
     locationUpdatedAt        an explicit relocation marker
     pipeline version         behaviour changed
     Phase 1 prompt hash      discovery instructions changed
     Phase 2 prompt hash      judgment instructions changed
     schema version           persisted shape changed
     provider + model         a different model judges differently

   Any change → a new digest → a regeneration. Nothing else triggers
   one, so reopening a property page never re-bills a provider.

   Runtime-neutral: crypto.subtle exists in the browser, Node 18+ and
   Deno.
   ═══════════════════════════════════════════════════════════════ */
import {
  PROPERTY_INTELLIGENCE_PIPELINE_VERSION,
  PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
  type GeoPoint,
} from './types.ts';
import { PHASE1_PROMPT_VERSION, PHASE2_PROMPT_VERSION } from './prompts/index.ts';

export interface CacheIdentity {
  dealerId: string;
  propertyId: string;
  point: GeoPoint;
  locationUpdatedAt?: string;
  provider: string;
  model: string;
  pipelineVersion?: string;
  phase1PromptVersion?: string;
  phase2PromptVersion?: string;
  schemaVersion?: number;
}

/** ~1e-5 deg ≈ 1.1 m. Two saves at the same spot share a digest; a genuine
 *  relocation does not — which is what makes a moved property regenerate
 *  and its cached routes recompute. */
function roundCoord(n: number): string {
  return n.toFixed(5);
}

export function cacheKeyString(id: CacheIdentity): string {
  return [
    `d=${id.dealerId}`,
    `p=${id.propertyId}`,
    `lat=${roundCoord(id.point.latitude)}`,
    `lng=${roundCoord(id.point.longitude)}`,
    `u=${id.locationUpdatedAt ?? ''}`,
    `s=${id.schemaVersion ?? PROPERTY_INTELLIGENCE_SCHEMA_VERSION}`,
    `pipe=${id.pipelineVersion ?? PROPERTY_INTELLIGENCE_PIPELINE_VERSION}`,
    `p1=${id.phase1PromptVersion ?? PHASE1_PROMPT_VERSION}`,
    `p2=${id.phase2PromptVersion ?? PHASE2_PROMPT_VERSION}`,
    `prov=${id.provider}`,
    `model=${id.model}`,
  ].join('|');
}

export async function computeInputDigest(id: CacheIdentity): Promise<string> {
  const data = new TextEncoder().encode(cacheKeyString(id));
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
