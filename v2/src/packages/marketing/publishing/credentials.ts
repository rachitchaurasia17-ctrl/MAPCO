/* ═══════════════════════════════════════════════════════════════
   MAPCO Marketing — the credential boundary

   THE RULE: a provider secret never exists in a database row, in a
   client bundle, in a log line, or in any object that can reach the
   browser. Rows hold a `credentialRef` — the NAME of a secret. Only
   server-side code may exchange that name for a value.

   This milestone deliberately ships NO real secret storage. What it
   ships is the boundary, the interface a production store must satisfy,
   and a guard that makes an accidental leak fail loudly in tests.

   Production backing for `credentialRef` is documented in
   docs/marketing-publishing-capabilities.md §Credential storage.
   ═══════════════════════════════════════════════════════════════ */
import type { ChannelId } from './types';

/** Opaque handle. Never the secret. Safe to store and to log. */
export type CredentialRef = string;

/** Matches the constraint already enforced on marketing_channel_accounts. */
const REF_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/;

export const isValidCredentialRef = (ref: string): boolean => REF_PATTERN.test(ref);

/**
 * Deterministic, non-secret naming so a ref can be derived and revoked
 * without a lookup table: `mapco:<dealer>:<channel>:<purpose>`.
 */
export function credentialRefFor(
  dealerId: string, channel: ChannelId, purpose: 'access' | 'refresh' = 'access',
): CredentialRef {
  const safe = dealerId.replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 60);
  return `mapco:${safe}:${channel}:${purpose}`;
}

export interface StoredCredential {
  readonly ref: CredentialRef;
  readonly dealerId: string;
  readonly channel: ChannelId;
  /** When the provider says this expires. Drives proactive refresh. */
  readonly expiresAt?: string;
  readonly scopes: readonly string[];
  readonly rotatedAt?: string;
}

/**
 * The interface a production secret store must satisfy. Implementations
 * live SERVER-SIDE ONLY (Supabase Edge secret store, a KMS-backed
 * table, or a managed secret manager).
 *
 * `read` intentionally returns the value — that is why no browser bundle
 * may ever import an implementation of this interface.
 */
export interface CredentialStore {
  readonly name: string;
  put(ref: CredentialRef, value: string, meta: Omit<StoredCredential, 'ref'>): Promise<void>;
  read(ref: CredentialRef): Promise<string | null>;
  /** Metadata only — safe to call from anywhere. */
  describe(ref: CredentialRef): Promise<StoredCredential | null>;
  rotate(ref: CredentialRef, value: string, expiresAt?: string): Promise<void>;
  revoke(ref: CredentialRef): Promise<void>;
}

/**
 * The only implementation shipped in this milestone. It refuses to hold
 * anything, so no code path can start depending on insecure storage and
 * quietly ship. This is deliberate: a fake encrypted store would be
 * worse than none.
 */
export class UnconfiguredCredentialStore implements CredentialStore {
  readonly name = 'unconfigured';
  private readonly meta = new Map<CredentialRef, StoredCredential>();

  async put(ref: CredentialRef, _value: string, meta: Omit<StoredCredential, 'ref'>): Promise<void> {
    if (!isValidCredentialRef(ref)) throw new Error(`Invalid credential ref: ${ref}`);
    // Metadata only. The value is intentionally discarded.
    this.meta.set(ref, { ref, ...meta });
  }

  async read(_ref: CredentialRef): Promise<string | null> {
    throw new CredentialStoreNotConfigured();
  }

  async describe(ref: CredentialRef): Promise<StoredCredential | null> {
    return this.meta.get(ref) ?? null;
  }

  async rotate(ref: CredentialRef, _value: string, expiresAt?: string): Promise<void> {
    const existing = this.meta.get(ref);
    if (existing) this.meta.set(ref, { ...existing, expiresAt, rotatedAt: new Date().toISOString() });
  }

  async revoke(ref: CredentialRef): Promise<void> { this.meta.delete(ref); }
}

export class CredentialStoreNotConfigured extends Error {
  constructor() {
    super(
      'No credential store is configured. MAPCO cannot publish to a real platform until a ' +
      'server-side secret store backs credentialRef. See docs/marketing-publishing-capabilities.md.');
    this.name = 'CredentialStoreNotConfigured';
  }
}

/** True once real publishing is actually possible. */
export const credentialsAvailable = (store: CredentialStore): boolean =>
  store.name !== 'unconfigured';

/* ── leak guard ──────────────────────────────────────────────── */

/**
 * Shapes that must never appear in anything client-bound. Used by tests
 * and by the client-safe projection to fail loudly rather than quietly
 * shipping a token to a browser.
 */
const SECRET_KEYS = [
  'accesstoken', 'access_token', 'refreshtoken', 'refresh_token',
  'clientsecret', 'client_secret', 'appsecret', 'app_secret',
  'token', 'secret', 'password', 'privatekey', 'private_key',
  'authorization', 'bearer', 'apikey', 'api_key',
];

export interface LeakFinding {
  readonly path: string;
  readonly key: string;
}

/**
 * Walk any object and report keys that look like a secret.
 * `credentialRef` is explicitly allowed — it is a name, not a value.
 */
export function findSecretLeaks(value: unknown, path = '$'): readonly LeakFinding[] {
  const found: LeakFinding[] = [];
  const walk = (node: unknown, at: string, depth: number): void => {
    if (depth > 8 || node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${at}[${i}]`, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      // A reference is a name, never a secret.
      const isRef = lower === 'credentialref' || lower === 'credential_ref';
      if (!isRef && SECRET_KEYS.includes(lower)) {
        found.push({ path: `${at}.${key}`, key });
      }
      walk(child, `${at}.${key}`, depth + 1);
    }
  };
  walk(value, path, 0);
  return found;
}

export const containsSecret = (value: unknown): boolean => findSecretLeaks(value).length > 0;

/* ── reauthorisation ─────────────────────────────────────────── */

export interface ReauthorisationNeed {
  readonly dealerId: string;
  readonly channel: ChannelId;
  readonly reason: 'expired' | 'revoked' | 'insufficient_scope' | 'never_connected';
  /** Shown to the dealer. Contains no provider detail. */
  readonly message: string;
}

export function reauthorisationMessage(reason: ReauthorisationNeed['reason']): string {
  switch (reason) {
    case 'expired': return 'The connection has expired. Reconnect to keep publishing.';
    case 'revoked': return 'Access was removed on the platform. Reconnect to restore publishing.';
    case 'insufficient_scope': return 'A required permission is missing. Reconnect and accept all permissions.';
    default: return 'Connect this account to publish.';
  }
}

/** Proactive refresh: is this credential close enough to expiry to renew? */
export function needsRefresh(
  credential: StoredCredential, withinHours = 72, now: Date = new Date(),
): boolean {
  if (!credential.expiresAt) return false;
  const expires = Date.parse(credential.expiresAt);
  if (Number.isNaN(expires)) return false;
  return expires - now.getTime() < withinHours * 3600 * 1000;
}
