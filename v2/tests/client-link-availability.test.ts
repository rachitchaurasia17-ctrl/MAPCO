/*
 * A client link serves a snapshot, but availability is not part of it.
 *
 * The snapshot is deliberate: a customer sees exactly what the dealer chose
 * to share, and a later price correction or private note cannot leak into a
 * link already out in the world. But a property that has been sold or
 * withdrawn is not something the dealer is still offering, and a link that
 * keeps presenting it tells the customer something untrue.
 *
 * The resolver therefore takes content from the snapshot and availability
 * from the live record — and must do it without ever putting an internal
 * property id in front of a buyer.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const migration = readFileSync(
  resolve(root, 'supabase/migrations/20260912090000_client_link_hides_withdrawn_property.sql'),
  'utf8');

const resolver = migration.slice(migration.indexOf('function public.plotmap_resolve_client_link'));
const creator = migration.slice(
  migration.indexOf('FUNCTION public.plotmap_create_client_link'),
  migration.indexOf('function public.plotmap_resolve_client_link'));

describe('what a client link may still present', () => {
  it('drops a property that has been sold', () => {
    expect(resolver).toContain("coalesce(r.payload ->> 'sold', 'false')) <> 'true'");
  });

  it('drops one the dealer has stopped showing customers', () => {
    expect(resolver).toContain("coalesce(r.payload ->> 'clientVisible', 'true')) <> 'false'");
  });

  it('drops one taken off the market', () => {
    expect(resolver).toContain("not in ('sold', 'archived')");
  });

  it('drops one whose record has gone', () => {
    expect(resolver).toContain('coalesce(r.deleted, false) = false');
  });

  it('checks it against the link\'s own dealer, never another', () => {
    expect(resolver).toContain('r.dealer_id = v_link.dealer_id');
  });

  it('says the link is unavailable rather than opening onto an empty page', () => {
    expect(resolver).toMatch(/jsonb_array_length\(v_shown\) = 0[\s\S]{0,120}'unavailable'/);
  });
});

describe('and how it checks, without telling the buyer anything', () => {
  it('keeps the buyer-facing id opaque and per link', () => {
    // The snapshot entry a customer receives is still a random id.
    expect(creator).toContain("v_property_public_id := encode(extensions.gen_random_bytes(12), 'hex')");
    expect(creator).toContain("'id', v_property_public_id");
  });

  it('keeps the real ids beside the snapshot, never inside it', () => {
    /* client_snapshot is the object handed to the buyer. The mapping lives
       next to it in metadata, which the resolver never returns. */
    expect(creator).toContain("'snapshot_property_ids', to_jsonb(v_snapshot_property_ids)");
    const snapshotBuild = creator.slice(
      creator.indexOf('v_snapshot := '), creator.indexOf('v_token_hash :='));
    expect(snapshotBuild).not.toContain('v_snapshot_property_ids');
  });

  it('reads the mapping from metadata, which is not part of the answer', () => {
    expect(resolver).toContain("v_link.metadata -> 'snapshot_property_ids'");
    // Only client_snapshot, with its properties replaced, is returned.
    expect(resolver).toContain("'link', (v_snapshot || jsonb_build_object('properties', v_shown))");
    expect(resolver).not.toContain("jsonb_build_object('snapshot_property_ids'");
  });

  it('leaves a link sent before the mapping existed exactly as it was', () => {
    /* Blanking links already in customers' hands would be a worse wrong
       than the one being fixed. */
    expect(resolver).toContain("if v_ids is not null and jsonb_typeof(v_ids) = 'array'");
    expect(resolver).toContain('jsonb_array_length(v_ids) = jsonb_array_length(v_shown)');
  });

  it('still refuses a revoked or expired link before anything else', () => {
    const revokedAt = resolver.indexOf("'revoked'");
    const expiredAt = resolver.indexOf("'expired'");
    const filterAt = resolver.indexOf("snapshot_property_ids");
    expect(revokedAt).toBeGreaterThan(-1);
    expect(expiredAt).toBeGreaterThan(-1);
    expect(revokedAt).toBeLessThan(filterAt);
    expect(expiredAt).toBeLessThan(filterAt);
  });
});
