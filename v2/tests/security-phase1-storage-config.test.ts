import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const config = readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const deletion = readFileSync(new URL('../../supabase/functions/delete-dealer/index.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const isolation = readFileSync(new URL('../../supabase/verification/verify-isolation.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const liveVerifier = readFileSync(new URL('../scripts/security-verify.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const serviceVerifier = readFileSync(new URL('../scripts/backend-verify.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const liveVerifierPath = fileURLToPath(new URL('../scripts/security-verify.mjs', import.meta.url));
const isolationVerifierPath = fileURLToPath(new URL('../../supabase/verification/verify-isolation.js', import.meta.url));

describe('Phase 1 deployment and storage security', () => {
  it('pins hardened Auth defaults that production must mirror', () => {
    expect(config).toContain('enable_signup = false');
    expect(config).toContain('minimum_password_length = 12');
    expect(config).toContain('password_requirements = "lower_upper_letters_digits"');
    expect(config).toContain('enable_confirmations = true');
    expect(config).toContain('secure_password_change = true');
    expect(config).toContain('[auth.mfa.totp]\nenroll_enabled = true\nverify_enabled = true');
  });

  it('pins Edge gateway JWT modes instead of relying on deploy flags', () => {
    for (const name of [
      'ai-run', 'delete-dealer', 'marketing-ops', 'presentation-properties',
      'property-intelligence', 'provision-dealer',
    ]) {
      expect(config).toContain(`[functions.${name}]\nverify_jwt = true`);
    }
    for (const name of ['ai-worker', 'resolve-client-link']) {
      expect(config).toContain(`[functions.${name}]\nverify_jwt = false`);
    }
  });

  it('purges every current tenant-private storage bucket on dealer deletion', () => {
    for (const bucket of [
      'property-photos', 'client-link-audio', 'property-documents',
      'marketing-creatives', 'marketing-reel-raw', 'marketing-reel-finished',
    ]) {
      expect(deletion).toContain(`bucket: '${bucket}'`);
      expect(deletion).toContain(`storageObjectsDeleted['${bucket}']`);
    }
    expect(deletion).toContain("prefix === 'dealers' ? `dealers/${dealerId}` : dealerId");
    expect(deletion).toContain('MAX_STORAGE_OBJECTS_PER_REQUEST = 10000');
    expect(deletion).toContain('return { deleted: objects.length, complete: !truncated }');
    expect(deletion).toContain('storage_objects_deleted_this_attempt');
    expect(deletion).toContain('pending_bucket: storagePendingBucket');
    expect(deletion).not.toContain('storage_limit_exceeded');
  });

  it('does not treat a successful event RPC response as an isolation pass', () => {
    expect(isolation).toContain('const eventSafe = !eventRes.ok');
    expect(isolation).toContain('eventRes.status >= 400');
    expect(isolation).not.toContain(': eventRes.status < 500');
    expect(isolation).toContain('rows.length > 0');
    expect(isolation).toContain('expectRpcDealerBlocked');
    expect(isolation).toContain("'plotmap_client_properties_for_device', OTHER_DEALER_ID");
    expect(isolation).toContain("'plotmap_client_maps_for_device', OTHER_DEALER_ID");
    expect(isolation).toContain("'plotmap_client_overlays_for_device', OTHER_DEALER_ID");
    expect(isolation).toContain('globalThis.crypto.randomUUID()');
  });

  it('requires an exact non-production acknowledgement for legacy remote isolation checks', () => {
    expect(isolation).toContain('PLOTMAP_VERIFY_PROJECT_REF');
    expect(isolation).toContain('PLOTMAP_VERIFY_CONFIRM');
    expect(isolation).toContain('NON_PRODUCTION:${REMOTE_REF}');
    expect(isolation).toContain('target.hostname !== `${REMOTE_REF}.supabase.co`');
    expect(isolation).toContain('Remote run refused');
  });

  it('provides all eight live hostile checks with a remote-target safety latch', () => {
    for (const letter of 'ABCDEFGH') expect(liveVerifier).toContain(`TEST ${letter}`);
    expect(liveVerifier).toContain('NON_PRODUCTION:${REMOTE_REF}');
    expect(liveVerifier).toContain('Refusing a secret/service-role key');
    expect(liveVerifier).toContain('results.length !== 8');
    expect(liveVerifier).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(liveVerifier).toContain("payload?.role === 'string'");
    expect(liveVerifier).toContain("jwtRole(KEY) === 'service_role'");
    expect(liveVerifier).toContain('excludedSelections.every(Boolean)');
    expect(liveVerifier).toContain('projectionFieldHits');
    for (const field of ['price', 'sector', 'plotnumber', 'latitude', 'longitude', 'lat', 'lng']) {
      expect(liveVerifier).toContain(`'${field}'`);
    }
  });

  it('decodes and rejects service-role JWTs before either verifier performs network I/O', () => {
    const encoded = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const serviceJwt = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ role: 'service_role' })}.test-signature`;
    const live = spawnSync(process.execPath, [liveVerifierPath], {
      encoding: 'utf8',
      env: {
        ...process.env,
        MAPCO_SECURITY_TEST_URL: 'http://127.0.0.1:54321',
        MAPCO_SECURITY_TEST_ANON_KEY: serviceJwt,
        MAPCO_SECURITY_TEST_DEALER_A_EMAIL: 'a@example.test',
        MAPCO_SECURITY_TEST_DEALER_A_PASSWORD: 'not-a-real-password',
        MAPCO_SECURITY_TEST_DEALER_B_EMAIL: 'b@example.test',
        MAPCO_SECURITY_TEST_DEALER_B_PASSWORD: 'not-a-real-password',
      },
    });
    const legacy = spawnSync(process.execPath, [isolationVerifierPath], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PLOTMAP_SUPABASE_URL: 'http://127.0.0.1:54321',
        PLOTMAP_SUPABASE_ANON_KEY: serviceJwt,
      },
    });

    expect(live.status).toBe(2);
    expect(legacy.status).toBe(2);
    expect(live.stderr).toContain('Refusing a secret/service-role key');
    expect(legacy.stderr).toContain('service-role key');
    expect(live.stderr).not.toContain(serviceJwt);
    expect(legacy.stderr).not.toContain(serviceJwt);

    const modernSecret = spawnSync(process.execPath, [isolationVerifierPath], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PLOTMAP_SUPABASE_URL: 'http://127.0.0.1:54321',
        PLOTMAP_SUPABASE_ANON_KEY: 'sb_secret_test-value',
      },
    });
    expect(modernSecret.status).toBe(2);
    expect(modernSecret.stderr).toContain('service-role key');
    expect(modernSecret.stderr).not.toContain('sb_secret_test-value');
  });

  it('refuses the legacy service-role fixture bootstrap without an exact dev acknowledgement', () => {
    expect(serviceVerifier).toContain('MAPCO_BACKEND_VERIFY_PROJECT_REF');
    expect(serviceVerifier).toContain('RESETTABLE_DEV:${ref}');
    expect(serviceVerifier).toContain('remote run refused');
  });
});
