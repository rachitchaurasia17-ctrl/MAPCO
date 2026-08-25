# MAPCO SaaS Security Architecture

**Document status:** Phase 1 source implementation, security contract, and deployment gate  
**Scope:** `v2/`, `supabase/`, deployment configuration, and supporting verification code  
**Last reviewed:** 2026-08-25  
**Important:** `supabase/migrations/20260825000100_security_phase_1_foundation.sql` exists in the working tree but has **not been proven applied to a hosted Supabase project**. Database controls described as “Phase 1” are effective remotely only after that migration is applied and the live A-H verifier passes against a non-production project.

## 1. Executive security position

MAPCO is a multi-tenant property-dealer SaaS. Its primary security boundary is the Supabase database, not the browser. Each authenticated user resolves to a server-owned dealer identity through `profiles`; every private row must be scoped to that dealer, and every mutation must be authorized by both membership role and account state. The buyer presentation is a separate, deliberately narrow capability-token boundary. Platform administration is orthogonal to dealer membership and must be proven by the server-side `platform_admins` registry.

Phase 1 materially strengthens this model in source:

- protected application entry points now require a network-validated Supabase user before rendering;
- the developer control surface checks `plotmap_is_platform_admin()` rather than trusting a mock UI flag;
- a final-state migration derives `dealer_id` from the authenticated profile, makes it immutable, restores role/account/quota RLS gates, constrains helper ACLs, removes forgeable audit inserts, retires the legacy share-slug resolver, and makes client visibility explicit;
- private client media, property files, and marketing assets remain tenant-prefixed and private; dealer deletion now covers the newer private buckets;
- stored dealer content is constrained before HTML/SVG rendering, and high-impact duplicate actions have a single-flight boundary;
- production response headers, authentication defaults, Edge Function JWT declarations, and security-focused tests are now explicit.

No committed service-role credential was identified in the repository review, and the browser client rejects service-role-shaped keys. No confirmed critical cross-tenant disclosure was demonstrated from source alone. This is not a claim that production is secure: the latest migration and hosted configuration still require deployment and live verification.

## 2. System inventory and current architecture

### 2.1 Runtime components

| Component | Responsibility | Principal evidence |
|---|---|---|
| Vite/TypeScript multi-page frontend | Dealer desk, Earth, Map Pilot, marketing, operations, AI console, developer control, and buyer presentation | `v2/vite.config.ts`, `v2/src/apps/**` |
| Data abstraction | Selects deterministic mock data for development/tests or Supabase for real data; production fails closed when Supabase mode/configuration is absent | `v2/src/packages/data/adapter.ts` |
| Supabase browser client | Uses only URL plus publishable/anon key, persists/refreshes Auth sessions, and rejects `sb_secret_` or JWT `service_role` keys | `v2/src/packages/data/supabase/client.ts` |
| Supabase Auth | Email/password identity and access/refresh token lifecycle | `v2/src/packages/data/session.ts`, `supabase/config.toml` |
| PostgreSQL/PostgREST | Tenant data, memberships, account state, RLS, constrained RPCs, audit events, quotas, and client-safe projections | `supabase/migrations/*.sql` |
| Supabase Storage | Private property photos, documents, client audio, and marketing media; one intentionally public legacy `maps` bucket | storage policies in `supabase/migrations/*.sql` |
| Edge Functions | AI work, property intelligence, marketing operations, dealer provisioning/deletion, and client-link resolution | `supabase/functions/*/index.ts`, function declarations in `supabase/config.toml` |
| Hosting boundary | Security headers and buyer-link cache/referrer controls | `v2/vercel.json`, `v2/client/index.html` |
| Verification | Unit/static security contracts plus optional live A-H tenant-isolation exercise | `v2/tests/security-phase1-*.test.ts`, `v2/tests/session-security.test.ts`, `v2/tests/protected-route-entrypoints.test.ts`, `v2/scripts/security-verify.mjs` |

### 2.2 Data domains

The current organization root is `dealer_settings.dealer_id` (text). `profiles` links an Auth user to one dealer and one dealer role. Core dealer-owned tables include `crm_records`, `prebuilt_maps`, `map_overlays`, `share_links`, `audit_logs`, client-link event/rate-limit tables, AI and predictive data, property intelligence data, marketing periods/posts/reel assets, and the Desk seller/document domain. Migrations add foreign keys, RLS, policies, helper functions, and storage policies incrementally.

`dealer_settings` is therefore both the tenant registry and the subscription/control-plane record. This is adequate for Phase 1 but couples organization identity, branding, billing, plan state, and limits. Section 14 defines the Phase 2 split.

## 3. Trust boundaries

```text
Untrusted browser input / URL / uploaded SVG
                    |
                    v
        Vite UI + publishable Supabase key
          | authenticated JWT       | opaque presentation token
          v                         v
   PostgREST / authenticated     Client-link Edge Function
   Edge Function gateway         + service-only narrow RPCs
          |                         |
          +------------+------------+
                       v
              PostgreSQL authorization
        auth.uid() -> profiles -> dealer_id + role
          RLS + RPC checks + tenant trigger + quotas
                       |
          +------------+-------------+
          v                          v
   tenant-private rows       private prefixed Storage

Platform operator browser -> validated JWT -> active platform_admins row
                         -> admin RPC / provision-delete Edge Function

Server-only provider secrets -> Edge Function environment only
```

The boundaries produce five non-negotiable rules:

1. A browser-provided `dealer_id`, profile flag, role label, record ID, or storage path is an untrusted selector, never authority.
2. UI route guards improve confidentiality and user experience, but RLS/RPC/storage policy remains authoritative when a route guard is bypassed or JavaScript is modified.
3. `service_role` is server-only. A service client must expose only a purpose-built allowlisted operation, not generic table access.
4. A client presentation token is a revocable capability for one frozen/scoped presentation, not a weak anonymous dealer session.
5. Stored content is still untrusted content. A value that passed database authorization can still be an XSS payload.

## 4. Identity and role model

The product language requested for the security boundary maps to current implementation as follows:

| Conceptual principal | Current representation | Authority and allowed boundary |
|---|---|---|
| `MAPCO_OWNER` | Authenticated profile with an active row in `platform_admins` | Provider control plane only. Must be checked by `plotmap_is_platform_admin()` or an admin RPC/Edge Function. Dealer UI flags do not grant it. |
| `DEALER_OWNER` | Active `profiles.role = 'owner'` scoped to `profiles.dealer_id` | Tenant administration and full dealer workflows permitted by RLS; never another dealer or platform administration. |
| `DEALER_TEAM_MEMBER` | Active role `manager`, `team`, `map_editor`, or `property_editor` | Tenant-scoped permissions through `plotmap_can_edit_*` helpers. Capabilities differ by role. |
| `CLIENT_PRESENTATION` | Anonymous bearer of a valid, unexpired, unrevoked private client-link token | Only allowlisted presentation snapshot/media/events for that token. It is not a `profiles` role and cannot use dealer tables. |
| `ANONYMOUS` | Supabase `anon` without a valid presentation capability | Public landing content and explicitly public assets only. No CRM, dealer settings, private maps, team, audit, AI, or private Storage access. |

The existing `viewer` profile role is intentionally not equated with anonymous `CLIENT_PRESENTATION`. It is an authenticated presentation-only user. `20260814000400_viewer_presentation_only.sql` removes generic private reads/writes for that role; the Phase 1 tenant trigger also denies authenticated viewer mutations.

Role checks in the browser are advisory. The `getProfile()` implementation in `v2/src/packages/auth/auth.ts` remains a hardcoded mock profile for mock-mode UI behavior. It must not be used as a production authorization source. The Phase 1 developer page no longer does so; any remaining call site must be treated as UI-only until migrated to a server-derived session/profile contract.

## 5. Tenant isolation contract

### 5.1 Absolute rule

> An authenticated caller may read or mutate a dealer-owned resource only when the resource’s canonical `dealer_id` equals the active dealer membership resolved on the server from `auth.uid()`. Inserts derive that identity on the server. Updates cannot change it, and updates/deletes must begin from a row owned by that same tenant. Anonymous access is denied unless a separate narrowly scoped capability contract explicitly allows it.

The browser must never select its organization by sending a trusted `dealer_id`. In the current schema, `plotmap_current_dealer_id()` resolves it from `profiles`, while `plotmap_current_role()` and `plotmap_is_active_member()` resolve authorization state. RLS policies combine that identity with domain helpers such as `plotmap_can_edit_properties()`, `plotmap_can_edit_crm()`, `plotmap_can_edit_maps()`, `plotmap_can_manage_team()`, `plotmap_dealer_can_write()`, and quota checks.

### 5.2 Phase 1 database backstop

`20260825000100_security_phase_1_foundation.sql` adds `plotmap_enforce_authenticated_tenant()` as a fixed-search-path `SECURITY DEFINER` `BEFORE INSERT OR UPDATE OR DELETE` trigger on every current public base/partitioned table containing `dealer_id`. The elevated trigger exists so it can see a conflicting row even when RLS hides it; it derives and checks the original authenticated JWT itself. For an ordinary authenticated caller it:

- requires an authenticated user, active membership, a non-viewer role, and a writable dealer account;
- overwrites an inserted `dealer_id` with the server-resolved dealer identity;
- rejects an update/delete unless the old row belongs to that identity, and rejects any update that changes `dealer_id`;
- serializes property, map, and team quota admission per tenant, distinguishes existing same-tenant upserts from genuinely new rows, and rechecks deleted/inactive rows when an update activates them;
- uses deferred constraint triggers on the three quota-bearing tables to assert final transaction-state counts, preventing bulk statements or concurrent transactions from committing above the configured limits.

This is defense in depth around RLS, not a replacement for it. The migration re-states final policies on CRM, overlays, maps, settings, links, and profiles because later migrations can otherwise unintentionally replace an earlier account/quota predicate. It also revokes `CREATE` on the public schema from browser roles to reduce `SECURITY DEFINER` search-path attacks.

Future migrations creating any table with `dealer_id` must add the same trigger in that table’s creation migration; the catalog loop runs only when Phase 1 is applied. Security review must reject a tenant table without all of: `dealer_id`, referential integrity to the organization root, RLS enabled, explicit policies, an immutable/derived tenant trigger, and a two-tenant test.

### 5.3 Organization lifecycle and quotas

Dealer accounts are provider-provisioned. The Phase 1 `plotmap_guard_dealer_settings_account_columns()` trigger blocks ordinary users from inserting dealer accounts or changing billing, subscription, storage, account-state, and limit fields. Owners/managers can retain legitimate branding/settings behavior through the associated RLS policy, but commercial control-plane fields remain platform-owned.

Account suspension/expiry and plan limits must be enforced in database helpers and final RLS/trigger checks. Hiding a button is not enforcement. Browser-callable account/quota helpers now scope authenticated queries to the caller's canonical dealer, preventing cross-tenant subscription/headroom oracles. Provisioning and dealer deletion are privileged server workflows with JWT/origin validation and service-key use confined to the Edge Function. Dealer deletion’s storage registry now includes `property-documents`, `marketing-creatives`, `marketing-reel-raw`, and `marketing-reel-finished` as well as the earlier photo/audio buckets. Large storage cleanups delete a bounded batch before returning a retryable response, so retries make progress instead of repeatedly failing above the cap.

## 6. Authentication and session security

`v2/src/packages/data/session.ts` is the protected-route boundary. In Supabase mode, `getSession()` calls `supabase.auth.getUser()`, which validates the access token with Supabase Auth; a token-shaped object in browser storage is not sufficient. Network/configuration/token failures deny access. Dealer, Earth, Map Pilot, marketing, operations, AI, team, and developer entry points must call `requireSession()` before private initialization. The developer route performs the additional server-authoritative platform-admin RPC check.

Private browser caches are bound to the validated user ID. Login/logout/account changes clear dealer-sensitive Earth, marketing, and operations cache prefixes plus presentation tokens. This reduces same-browser cross-account residue. Supabase owns password storage and access/refresh token persistence; application code must never copy passwords or tokens into logs, general local storage, query analytics, or domain records.

Mock mode intentionally bypasses the login card for local development/tests. `v2/src/packages/data/adapter.ts` forbids mock mode in production and fails closed when the Supabase deployment configuration is absent. Deployment must preserve that build invariant. A production bundle with a relaxed adapter or a hardcoded profile would collapse the route boundary.

Hardened defaults in `supabase/config.toml` disable public/email signup, require 12-character mixed-case/digit passwords, enable confirmation and secure password changes, reduce sign-in/token-verification rates, shorten email OTP lifetime to 10 minutes, and enable TOTP enrollment/verification. Hosted Supabase Auth settings must be checked manually; changing a local TOML file does not prove the hosted project matches it. Session expiry remains 3,600 seconds with refresh rotation.

## 7. Authorization, RLS, and RPC design

RLS is required on every private public-schema table and must use both `USING` and `WITH CHECK` where applicable. Direct authenticated grants may expose table verbs to PostgREST only when RLS fully constrains them. `anon` receives no generic access to private tables or views.

RPC rules:

- default to `SECURITY INVOKER`; use `SECURITY DEFINER` only when the operation genuinely needs elevated access;
- a definer function uses a fixed `search_path`, validates `auth.uid()`, derives tenant and role internally, verifies account state, and owns a narrow return type;
- revoke default `PUBLIC` execute and grant only the required role;
- never accept `dealer_id` as authority; if an identifier is accepted, join it back to the caller’s derived tenant;
- service-only projection/media RPCs are callable only by `service_role` and are wrapped by an allowlisted Edge Function;
- admin RPCs prove an active `platform_admins` row and reject ordinary dealer users.

The Phase 1 migration explicitly constrains account/quota helper ACLs, revokes the predictable legacy `plotmap_resolve_share_link(text)` entry point, and keeps current presentation RPC ACLs explicit. Legacy RPC grants in early migrations must be evaluated by final database state, not by reading only the migration that first introduced them.

## 8. Client presentation architecture

A private client link is a capability URL. Creation generates a high-entropy raw token; only its SHA-256-derived representation is stored. Resolution checks expiry/revocation and returns a scoped, client-safe snapshot rather than live generic CRM rows. Property inclusion is deny-by-default: Phase 1’s `client_safe_properties` and patched snapshot path require explicit `clientVisible = true`, explicit `published = true`, `sold` not true, and no internally archived/hidden/held state. Presentation maps and media are selected through dedicated projections and service-only RPCs.

The buyer page removes the token from the visible URL/history flow, avoids durable generic token caches, uses `no-store`, `no-referrer`, `noindex`, and a tighter CSP, and resolves media through constrained paths. Events are rate-limited/idempotent and must not become an arbitrary anonymous write API.

The projection must exclude, at minimum: seller phone/email/contact details unless deliberately published, commission and dealer financial data, internal notes/status, negotiation state, private CRM fields, team/member information, author IDs, unrelated properties/maps, storage paths that do not belong to the token snapshot, and provider/admin metadata. Adding a field to the buyer UI requires changing and testing the allowlist; it must never be inherited automatically from the dealer record.

Capability limitations remain: anyone possessing a valid link can use it until it expires or is revoked, and screenshots cannot be prevented. Tokens must not appear in logs, referrers, third-party analytics, support screenshots, or exception messages.

## 9. Storage architecture

Tenant-private buckets include:

- `property-photos`: `dealers/<dealer_id>/properties/<property_id>/...`;
- `property-documents`: `dealers/<dealer_id>/properties/<property_id>/...`;
- `client-link-audio`: dealer-prefixed private audio exposed to buyers only via controlled signed access;
- `marketing-creatives`, `marketing-reel-raw`, and `marketing-reel-finished`: private objects rooted by dealer ID.

Storage policies must validate the authenticated tenant against path segments and role/account helpers for each operation. Bucket privacy is necessary but not sufficient; a private bucket with a broad authenticated read policy is still cross-tenant. Signed URLs are credentials and must be short-lived, projection-scoped, redacted from logs, and regenerated rather than persisted.

**Residual risk:** `20260801002300_map_linking.sql` creates the `maps` bucket with `public = true` and describes rasters as non-secret. Public URLs bypass database RLS by design. Until redesigned, this bucket is a declassification zone: only assets approved for public/client publication may be stored there. Draft maps, private annotations, seller information, coordinates not approved for sharing, or predictable private exports must use a private bucket. Paths are not consistently dealer-rooted and may be shared, so permanent dealer deletion cannot safely remove these objects after its database purge has discarded the path inventory. Phase 2 should capture an ownership manifest before purge, make source maps private by default, and publish immutable derivatives to a separate explicit public bucket or serve short-lived signed URLs.

## 10. Browser, rendering, and response security

Database authorization does not make strings safe for HTML. Phase 1 hardens the highest-risk stored-content paths:

- `v2/src/packages/ui/client-link-view.ts` accepts only HTTPS, localhost HTTP, or blob media URLs; rejects credentials/control characters/active schemes; uses DOM properties and `textContent` for full-screen map URL/label data; and uses image elements rather than CSS URL interpolation for client photos;
- `v2/src/packages/maps/svg-overlay.ts` bounds and grammar-checks SVG path data, normalizes identifiers, removes active SVG elements, and builds live SVG nodes with DOM APIs rather than concatenating authored attributes into `innerHTML`;
- security tests exercise hostile SVG IDs/path grammar, executable media schemes, and hostile client labels.

`v2/vercel.json` now sets CSP, HSTS, no-sniff, frame denial, referrer policy, and permissions policy globally. `/client/*` receives the tighter no-frame/no-form/no-worker policy plus private no-store caching and no-referrer/noindex behavior.

**Residual risk:** the general application CSP still permits `'unsafe-inline'` for scripts and styles because current pages contain inline handlers/styles, and image/media sources broadly permit HTTPS. This reduces CSP’s ability to stop a stored injection. Phase 2 should remove inline event handlers, adopt nonces or hashed bootstraps, and narrow media origins. CSP must be validated on the deployed response because hosting rule precedence can differ from local expectations.

## 11. Mutation concurrency and idempotency

Rapid clicks are a security and integrity concern when they create links, publish/delete records, approve actions, charge quotas, or enqueue expensive AI/marketing work. UI controls should disable and expose `aria-busy`, but server-side idempotency and uniqueness are authoritative.

`v2/src/packages/security/single-flight.ts` provides a keyed in-flight boundary for AI decisions. Earth location saves bind completion, errors, cancellation, Escape handling, and controls to the initiating flow ID, so an older request cannot control a newer flow. Presentation revocation rolls back only the failed record and preserves concurrent records and truthful post-revoke state. Existing property, login, modal, and marketing flows use busy/disabled guards. Tests simulate delayed/rejected operations, concurrent distinct actions, stale completions, and repeated interaction. Edge/RPC workflows that can create durable side effects must additionally use idempotency keys, unique constraints, transaction locks, or conflict-safe state transitions. A client-only guard cannot protect against two tabs or a replayed HTTP request.

## 12. Secrets, configuration, logging, and audit

Browser configuration may contain only public identifiers: the Supabase URL, publishable/anon key, restricted Google Maps browser key, and non-sensitive feature settings. `v2/src/packages/data/supabase/client.ts` validates an HTTPS Supabase project URL and rejects service-role credentials. Provider keys, `SUPABASE_SERVICE_ROLE_KEY`, SMTP credentials, worker keys, Google service-account material, and AI keys belong only in Supabase/Vercel secret stores or a gitignored local environment.

Repository environment files are ignored and no secret values are reproduced in this document. Deployment owners must still rotate any credential ever pasted into source control, chat, build logs, or an artifact; deletion from the latest commit is not rotation. Google browser keys require HTTP-referrer and API restrictions. Supabase keys must be separated by environment.

Edge Function logs use `supabase/functions/_shared/redact.ts`, which redacts provider/service keys, JWTs, 64-hex tokens, signed URL query credentials, phone numbers, and email addresses. Functions should log correlation IDs, operation names, coarse status, latency, and non-sensitive identifiers; never request bodies, authorization headers, raw tokens, signed URLs, secrets, or full customer data.

`audit_logs` is a security record, not an application console. Phase 1 removes direct authenticated inserts and exposes `plotmap_append_user_audit_event()` for a small allowlist. Actor and dealer are derived from `auth.uid()` and membership, entity existence is tenant-checked, metadata is bounded, and events are rate-limited. Provider/admin security events remain authored by their owning privileged transaction. Audit retention, export protection, anomaly alerts, and an external immutable sink remain Phase 2 work.

## 13. Findings and disposition

Severity reflects impact plus realistic exploitability in the reviewed architecture. “Implemented” means present in the working tree; it does not mean deployed.

| Severity | Finding and evidence | Phase 1 disposition | Residual |
|---|---|---|---|
| Critical | No confirmed committed service-role secret or demonstrated live cross-tenant disclosure was found. | Browser key rejection and secret/log rules retained. | A live production assessment and history/secret scanner remain required. |
| High | Protected dealer routes were able to initialize without the shared session gate (`v2/src/apps/dealer/main.ts`; Earth and Map Pilot had direct boot paths). | All three now initialize through `requireSession()`; session identity is validated by `auth.getUser()`. | Mock mode deliberately bypasses auth; production must fail closed. |
| High | Developer authorization trusted the hardcoded mock profile (`v2/src/apps/developer/main.ts`, `v2/src/packages/auth/auth.ts`). | Developer route now requires Auth and `plotmap_is_platform_admin()`. | The hardcoded mock profile remains elsewhere for UI/mock behavior and must never become backend authority. |
| High | Migration ordering could leave final CRM/map/settings/team write policies without earlier account/quota predicates. | Final migration re-states account-state, role, tenant, and quota gates and adds a trigger backstop. | Not effective remotely until migration deployment; future policy replacement can regress it without final-state tests. |
| High | Direct authenticated audit inserts allowed a caller to forge actor/context integrity. | Table insert revoked; narrow actor-derived RPC added. | External tamper-resistant retention/alerting is not yet implemented. |
| Medium | The browser supplied tenant IDs on writes, relying on each policy/RPC to reject tampering. | Insert tenant is overwritten from membership; updates/deletes must start from the caller's tenant; and update tenant changes are rejected on all current tenant tables. | Future tenant tables need the trigger explicitly. |
| Medium | Quota checks could be raced by concurrent/bulk writes or bypassed by activating an inactive row later. | Per-tenant transaction locks, volatile counts, activation checks, and deferred final-count constraint triggers cover properties, maps, and active team members. | Hosted PostgreSQL execution and bulk-boundary tests remain a deployment gate. |
| Medium | Predictable legacy share-slug resolver remained a callable legacy surface (`plotmap_resolve_share_link(text)`). | Execute revoked in the Phase 1 migration; hashed expiring client links are canonical. | Confirm no external legacy consumer before deployment and monitor failed calls. |
| Medium | Buyer map labels/media and authored SVG attributes reached dynamic markup contexts (`client-link-view.ts`, `svg-overlay.ts`). | URL allowlisting, DOM assignment, path grammar bounds, active-element removal, and hostile-payload tests added. | Other legacy `innerHTML` call sites need continuing source/sink review. |
| Medium | Global deployment headers were incomplete, and buyer responses lacked explicit no-store protection. | CSP/HSTS/referrer/permissions/frame/no-sniff headers added; client route is tighter and no-store. | General CSP retains unsafe inline execution/style compatibility. |
| Medium | Local Auth defaults permitted signup and weak passwords, with longer OTP/rate windows and no TOTP. | `supabase/config.toml` hardened. | Hosted dashboard parity, SMTP, CAPTCHA, recovery abuse controls, and enforcement of TOTP for privileged users are manual. |
| Medium | Dealer deletion omitted newer document/marketing storage scopes. | Delete workflow registry covers all current private buckets. | Each future bucket must update lifecycle deletion and tests. |
| Medium | Public `maps` bucket makes object possession/path discovery equivalent to public access. | Documented as an explicit public declassification zone; private domains remain private. | Bucket redesign/migration is outstanding. |
| Low | Rapid repeated actions could duplicate some decisions or jobs. | Shared single-flight and targeted button busy guards/tests added; server idempotency already exists for selected flows. | Audit all durable create/publish/AI/marketing operations for transactional idempotency. |
| Low | Hosted DB network restrictions, CAPTCHA, backup/restore evidence, and alerting are not encoded by application source. | Deployment checklist added below. | Infrastructure owner action required. |

## 14. Phase 2 target: organizations and memberships

The current `profiles(dealer_id, role)` model supports one user in one dealer and ties tenant identity to a mutable text business identifier. Phase 2 should normalize organization identity without weakening current RLS.

Recommended target:

```text
organizations
  id uuid primary key
  slug/text business identifier unique
  status, created_at, deleted_at

organization_memberships
  organization_id uuid -> organizations.id
  user_id uuid -> auth.users.id
  role enum / role_id
  status, invited_by, joined_at
  primary key (organization_id, user_id)

organization_entitlements
  organization_id uuid primary key
  plan, subscription/account state, quotas, feature flags

organization_settings
  organization_id uuid primary key
  dealer branding and non-provider-editable settings

platform_admins
  user/profile reference, status, grants, created_by
```

Every tenant table should migrate to immutable `organization_id uuid not null`, with foreign keys and composite references where child ownership matters. The active organization must be selected through a server-validated membership, not arbitrary browser state. Multi-organization users require a signed/validated active-org claim or RPC context that verifies the membership on every request. Roles should become capabilities or a centralized permission matrix rather than scattered string comparisons. Provider entitlements should be separate from dealer-editable settings.

Migration should be additive: create UUID organizations, backfill from `dealer_settings`, create memberships from `profiles`, dual-write/validate, add composite indexes and RLS, run two-tenant and multi-membership tests, switch reads, then retire text keys. Do not perform a broad in-place rename without rollback and reconciliation telemetry.

## 15. Verification architecture

Local checks:

```text
cd v2
npm run typecheck
npm test
npm run test:security
```

Security tests assert migration contracts, route coverage, session failure behavior, hostile rendering, headers/storage configuration, and rapid-interaction single-flight behavior. Static SQL assertions detect obvious policy drift but cannot execute PostgreSQL semantics.

`npm run security:verify` runs the live A-H matrix using only a public key and two ordinary users in different dealers:

- A: Dealer A cannot query Dealer B’s property by a targeted ID;
- B: a forged `dealer_id` is rejected or overwritten with Dealer A’s canonical tenant;
- C: Dealer A cannot update Dealer B’s row;
- D: Dealer A cannot delete Dealer B’s row;
- E: anonymous CRM access is denied or returns no rows;
- F: a client token receives exactly one allowlisted snapshot without private/unrelated fields;
- G: an ordinary dealer cannot invoke a platform-owner RPC;
- H: Dealer A and anonymous cannot download Dealer B’s private Storage object.

The verifier randomizes disposable fixtures, cleans them in `finally`, refuses secret/service-role keys, and requires exact `NON_PRODUCTION:<project-ref>` acknowledgement for a remote target. The legacy anonymous/device verifier also refuses privileged keys and unacknowledged hosted targets, requires non-empty same-dealer positive controls, uses randomized denied-mutation identifiers, and attempts the same device token against another dealer. `v2/scripts/backend-verify.mjs` is a separate service-role fixture bootstrap and requires an exact `RESETTABLE_DEV:<project-ref>` acknowledgement remotely. None of these scripts is authorized for production.

## 16. Deployment and manual security checklist

Complete these steps in order and attach evidence to the release:

1. Confirm the target is a non-production/staging project first. Take a restorable database backup and record the project ref without recording credentials.
2. Review the ordered migration set and apply through `20260825000100_security_phase_1_foundation.sql`. Capture migration success and database logs. Do not describe Phase 1 as deployed before this succeeds.
3. Inspect final RLS/grants for every public table/view/function and every Storage bucket. Confirm `anon` has no private-table access, helper functions have explicit execute grants, and public schema creation is revoked.
4. Run the full local typecheck/test/security suite. Then run `security:verify` against staging with two real, active, distinct dealer test accounts. Require all 8/8 checks. Investigate any setup failure as a failure, not a skip.
5. Exercise suspended/expired accounts, viewer role, single-row and bulk quota boundaries, team role transitions, client-link revoke/expiry, and dealer deletion including all private buckets.
6. Mirror and verify hosted Auth settings: closed signup, confirmation, secure password changes, password policy, rate limits, OTP expiry, refresh rotation, and TOTP. Require MFA for `MAPCO_OWNER` accounts operationally.
7. Verify every Edge Function’s JWT mode matches `supabase/config.toml`. Configure exact production origins; never use `*` with credentialed/private operations. Set secrets only in the function secret store and rotate any value with uncertain exposure.
8. Restrict Google browser keys by production HTTP referrer and exact APIs. Restrict server keys by service/API and network mechanism where supported. Use separate dev/staging/prod credentials.
9. Deploy `v2/vercel.json`; inspect real responses for the global and `/client/*` headers. Test Auth, Google Maps, Supabase websocket/API, media, and client links under CSP. Do not loosen CSP globally to fix one blocked dependency without review.
10. Inventory the public `maps` bucket. Remove private/draft material, document which assets are deliberately public, and capture dealer ownership/path data before database deletion. Schedule the private-by-default migration before storing new sensitive map content.
11. Enable hosted database SSL/network controls where operationally feasible, production SMTP, CAPTCHA/abuse controls, backup/PITR, audit retention, log-drain redaction, anomaly alerts, and incident-owner routing.
12. Run a post-deploy smoke test from a clean browser: direct protected URLs while signed out, expired/tampered sessions, account switching on one device, ordinary-dealer developer URL, revoked buyer token, hostile stored label/SVG, and repeated rapid actions.
13. Record accepted residual risks, owners, and deadlines. At minimum: public maps bucket, unsafe-inline general CSP, remaining mock UI profile call sites, future-table trigger discipline, and lack of an external immutable audit sink.

## 17. Change-control rules

Security-sensitive changes require a reviewer who understands both Postgres RLS and the application domain. Any new table, RPC, bucket, Edge Function, protected route, buyer field, or durable action must include its tenant/role/capability contract and a negative test. Never “temporarily” grant `anon` or `authenticated` broad access to debug production. Never resolve a customer issue with a browser service key. Never rely on hidden navigation, a disabled control, an unguessable UUID, or a storage URL path as authorization.

The release gate is simple: until the Phase 1 migration is applied, hosted settings are reconciled, and the live A-H matrix passes, the repository contains a security implementation candidate—not verified production security.
