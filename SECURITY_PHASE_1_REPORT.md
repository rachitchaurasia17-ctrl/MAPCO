# MAPCO Security Phase 1 Report

**Report date:** 2026-08-25  
**Scope:** `v2/`, `supabase/`, deployment configuration, security migrations, and verification tooling  
**UI impact:** No visual redesign was performed. Changes are limited to security boundaries, small busy/disabled states, and safe rendering behavior.  
**Companion document:** [`SECURITY_ARCHITECTURE.md`](./SECURITY_ARCHITECTURE.md)

## Security readiness score

**Source readiness: 6/10.** The repository now contains meaningful authentication, tenant-isolation, projection, storage-lifecycle, XSS, header, and negative-test foundations. That is stronger than a prototype, but material operational and architectural gaps remain.

**Deployed readiness is not established.** The 6/10 score is for the reviewed source candidate, not for a hosted environment and not an approval to onboard real customers. The final Phase 1 migration has not been applied to a confirmed target, hosted Supabase Auth/dashboard settings have not been reconciled, and the live A-H hostile-tenant suite has not run. Production readiness remains unverified until those gates pass.

## 1. Vulnerabilities discovered

No committed service-role credential or other confirmed critical secret was found, and source review alone did not demonstrate a live cross-tenant disclosure. The following exploitable weaknesses or material security risks were identified.

| Severity | Finding | Impact before Phase 1 |
|---|---|---|
| HIGH | Protected dealer entry points were missing or had lost the shared session gate, while session handling accepted browser-stored token material without a server identity check. | A user could open an internal route directly or retain a counterfeit/stale browser session at the UI boundary. RLS still needed to contain data access, but route confidentiality and fail-closed behavior were not reliable. |
| HIGH | A later role-policy migration replaced earlier write policies and omitted account-state and quota predicates. | Suspended/expired dealers or over-quota writes could regain paths that earlier migrations intended to deny. Reading migrations independently obscured the insecure final state. |
| HIGH | Dealer owners could update provider-controlled `dealer_settings` fields such as plan, account status, payment state, storage configuration, and quotas. | A dealer could attempt self-upgrade, restore a disabled account, or change provider control-plane values. |
| HIGH | Tenant writes accepted a browser-supplied `dealer_id` and relied on every individual policy/RPC to reject it correctly. | A weak future policy or `SECURITY DEFINER` writer could turn payload tampering into cross-tenant writes or quota bypass. Tenant identity was not universally immutable at the row boundary. |
| HIGH | Authenticated clients could insert audit rows directly. | A caller could forge actor, dealer, action, or metadata fields and reduce the evidentiary value of the audit trail. |
| HIGH | A legacy anonymous share-link resolver based on a slug remained callable. | It preserved a weaker, potentially enumerable presentation surface alongside the newer capability-token design. |
| HIGH | Client-safe property selection treated absent `clientVisible` values as visible, and related presentation paths did not consistently require published/not-sold/not-internally-hidden state. | Properties not explicitly approved for a buyer presentation could enter a client projection or snapshot. |
| HIGH | Quota admission depended on statement-visible counts and did not cover every inactive-to-active transition. | Bulk/concurrent writes or later activation could exceed property, map, or team limits even when single-row checks appeared correct. |
| HIGH | Authored SVG path/ID data and client media/labels reached dynamic HTML/SVG contexts. | Stored dealer-controlled content could attempt attribute breakout, active URL schemes, or stored XSS on dealer/client pages. |
| HIGH | The legacy `maps` Storage bucket is public. | Knowledge or discovery of an object URL bypasses database RLS. Draft/private map data placed there is effectively public. This remains open. |
| MEDIUM | Dealer deletion did not enumerate all newer document and marketing buckets. | Tenant files could survive account deletion and create retention/privacy inconsistencies. |
| MEDIUM | Local Auth defaults allowed signup, six-character passwords, unconfirmed email, less restrictive rate limits, long OTP validity, and insecure password changes. | A deployment that inherited those settings would have a weak account-abuse baseline. |
| MEDIUM | Edge Function JWT verification modes were not explicitly pinned in configuration. | A deployment flag or operator mistake could silently expose an authenticated function or block a deliberately public/token-authenticated one. |
| MEDIUM | Supabase Auth's cross-tab coordination lock had been overridden, and private local caches were not bound to a verified user identity. | Multi-tab refresh races and same-browser cross-account data residue were possible. |
| MEDIUM | Important mutations had inconsistent rapid-click protection. | Slow or failed requests could cause duplicate links, approvals, deletions, publishes, or other writes. |
| MEDIUM | Deployment headers lacked a complete CSP, HSTS, permissions policy, strict referrer policy, and explicit buyer-link no-store policy. | Browser defense in depth against injection, framing, referrer/token leakage, and unsafe caching was incomplete. |
| MEDIUM | The legacy isolation verifier treated any response below HTTP 500 as safe, including HTTP 200. The service-role fixture bootstrap could target a remote project without an exact environment acknowledgement. | Tests could report a false isolation pass, and an operator could create durable test fixtures in the wrong hosted project. |
| MEDIUM | Platform-admin UI access used a hardcoded/mock profile flag in the developer surface. | UI-level provider access could be shown based on non-authoritative browser state. |
| LOW | The repository lacks a complete security CI/release gate, browser multi-tab/refresh E2E coverage, dependency-update automation, and a pinned operational security baseline. | Regressions can survive local review and configuration drift can go unnoticed. |

## 2. Vulnerabilities fixed

The following fixes are implemented in the working tree. Database/configuration fixes only become effective in a target environment after deployment and verification.

- [`supabase/migrations/20260825000100_security_phase_1_foundation.sql`](./supabase/migrations/20260825000100_security_phase_1_foundation.sql) adds a final-state tenant trigger to every current public table carrying `dealer_id`. Authenticated inserts derive the tenant from the caller's trusted profile; updates/deletes must start from the caller's tenant; updates cannot change it; and inactive, viewer, or non-writable accounts fail closed. Property, map, and team quota checks are repeated at this boundary so a definer writer cannot bypass them.
- Quota admissions use a per-tenant transaction advisory lock, repeat checks when a deleted/inactive row becomes active, and have deferred constraint triggers that assert the final transaction-wide property/map/team counts. This closes multi-row and concurrent admission races while preserving legitimate same-tenant upserts.
- The same migration restores final account-state, capability, quota, and same-tenant predicates that later role policies had removed.
- A provider-only trigger prevents ordinary dealer users from inserting dealer accounts or changing commercial/control-plane fields in `dealer_settings`.
- Direct authenticated inserts into `audit_logs` are revoked. A narrow `plotmap_append_user_audit_event()` RPC derives actor, tenant, and role, validates entity scope, allowlists low-risk events, limits metadata/rate, and removes sensitive top-level metadata keys.
- Browser roles lose `CREATE` on the `public` schema, helper function execute grants are explicit, the legacy slug resolver is revoked, and client projection/RPC grants are restated.
- Client presentation inclusion is deny-by-default: records must be explicitly client-visible and published, not sold, not deleted, and not internally archived/hidden/held before entering the safe view or presentation creation/projection paths.
- [`v2/src/packages/data/session.ts`](./v2/src/packages/data/session.ts) now validates identity with Supabase Auth, fails closed, clears known private state on logout/account switch, re-gates on cross-tab sign-out, and single-flights login.
- Dealer, Earth, Map Pilot, and developer entry points use the shared session boundary. The developer surface additionally checks the server-authoritative `plotmap_is_platform_admin()` RPC.
- [`v2/src/packages/data/supabase/client.ts`](./v2/src/packages/data/supabase/client.ts) no longer overrides Supabase's cross-tab lock and refuses `sb_secret_` or JWT `service_role` credentials in browser configuration.
- [`v2/src/packages/maps/svg-overlay.ts`](./v2/src/packages/maps/svg-overlay.ts) bounds SVG path/ID input and constructs active SVG nodes with DOM APIs rather than reinserting authored markup.
- [`v2/src/packages/ui/client-link-view.ts`](./v2/src/packages/ui/client-link-view.ts) rejects executable/insecure remote media schemes, assigns buyer-controlled labels and URLs through DOM properties/`textContent`, and removes CSS URL interpolation for client photos.
- [`v2/vercel.json`](./v2/vercel.json) adds CSP, HSTS, MIME sniffing protection, frame denial, referrer policy, permissions policy, and stricter no-store/noindex/no-referrer treatment for `/client/*`.
- [`v2/src/packages/security/single-flight.ts`](./v2/src/packages/security/single-flight.ts) adds keyed duplicate-action control for AI decisions. Earth location saves use flow IDs so stale completions cannot close or mutate a newer flow. Presentation revocation rolls back only the failed record and preserves other concurrent revocations. Existing save/delete/publish/client/deal guards are retained.
- [`supabase/functions/delete-dealer/index.ts`](./supabase/functions/delete-dealer/index.ts) now deletes all current tenant-private bucket scopes, reports per-bucket counts, and makes bounded progress across retries for tenants with more than 10,000 objects.
- [`supabase/verification/verify-isolation.js`](./supabase/verification/verify-isolation.js) no longer accepts a successful event RPC response as proof of isolation. It rejects empty positive controls, exercises a device token against the other dealer, randomizes mutation identifiers, rejects privileged keys before network access, and requires exact non-production acknowledgement for hosted targets.
- The A-H and legacy anonymous/device verifiers require exact `NON_PRODUCTION:<project-ref>` acknowledgement for hosted targets and reject privileged keys before network access. The service-role development fixture bootstrap separately requires exact `RESETTABLE_DEV:<project-ref>` acknowledgement.
- [`supabase/config.toml`](./supabase/config.toml) pins hardened Auth defaults and the intended JWT gateway mode for each current Edge Function.

No layout, color, spacing, typography, animation, visual component, or navigation redesign was made.

## 3. RLS policies created or changed

The audit found RLS enabled across the current public-table migration state, but policy ordering had weakened important final write predicates. Phase 1 therefore re-creates the following final policies rather than assuming earlier migrations still control them:

| Table/domain | Policies changed | Enforced result |
|---|---|---|
| `crm_records` properties | `plotmap crm properties insert/update/delete` | Requires property-edit capability, canonical same-dealer scope, writable account, and the property quota on insert. |
| `crm_records` other CRM entities | `plotmap crm other insert/update/delete` | Requires CRM-edit capability, canonical same-dealer scope, correct non-property entity type, and writable account. |
| `map_overlays` | `plotmap overlays maps insert/update/delete` | Requires map-edit capability, same-dealer scope, and writable account. |
| `prebuilt_maps` | `plotmap prebuilt maps insert/update/delete` | Requires map-edit capability and same-dealer scope; insert also enforces the map quota. |
| `dealer_settings` | `plotmap dealer settings insert/update/delete` | Insert/delete is platform-admin-only. Tenant settings updates require the current dealer and settings capability, while a trigger separately protects plan/billing/control-plane columns. |
| `share_links` | `plotmap share links insert/update/delete` | Direct dealer CRUD is same-tenant, CRM-capability gated, account gated, and cannot create/update/delete the special `client_link` capability rows through the generic table path. |
| `profiles` | `profiles owner dealer insert/update` | Requires team-management capability, same-dealer scope, writable account, allowed statuses/roles, and team quota on insert. The intended `team` role is explicitly supported. |
| `audit_logs` | Direct staff/writer insert policies removed | Authenticated clients cannot author arbitrary audit rows; the constrained audit RPC is the write boundary. |

Additional database controls in the migration:

- `plotmap_00_authenticated_tenant_guard` is installed on every current public base or partitioned table with a `dealer_id` column. It derives tenant identity on insert and rejects tenant changes on update. This is defense in depth around RLS and also executes when an authenticated JWT reaches a weak `SECURITY DEFINER` writer.
- `plotmap_quota_final_check` is installed as a deferred constraint trigger on `crm_records`, `prebuilt_maps`, and `profiles`, so a bulk statement or transaction cannot commit above the final configured active-row limits.
- Platform administrators and `service_role` retain explicit provisioning/operations paths; anonymous capability flows keep their separate narrow contracts.
- Account/quota helper functions are no longer executable by `PUBLIC`/`anon`; grants are limited to intended roles, and authenticated helper calls may inspect only the caller's canonical dealer unless the caller is a platform administrator.
- `plotmap_resolve_share_link(text)` is revoked from `PUBLIC`, `anon`, and `authenticated`.
- `client_safe_properties` now requires explicit visibility/publication and excludes sold or internally hidden records; it is not directly available to public/anonymous roles.
- `plotmap_create_client_link`, presentation property projection, and presentation media RPC definitions/ACLs are hardened so projection code cannot silently restore default-visible behavior.

Important limitation: the catalog loop applies the tenant trigger only to tables that exist when this migration runs. Every future tenant table must add the trigger and negative tests in its own migration.

## 4. Authentication changes

- Protected sessions use `auth.getUser()` as the identity proof. A localStorage object that merely resembles a valid access token is not trusted.
- Invalid, expired, unavailable, or unverifiable sessions fail closed to the login/error boundary before private route initialization.
- Dealer admin, MAPCO Earth, Map Engine Pilot, and Developer Control are explicitly covered by route-entry tests; existing protected applications continue using the shared gate.
- A cross-tab `SIGNED_OUT` event re-gates the open private page.
- Successful login, logout, explicit `?signout`, cross-tab sign-out, and verified user changes clear known dealer-private Earth/marketing/operations caches and legacy presentation-token state without deleting Supabase's own Auth storage.
- Repeated login submissions are single-flighted and the login control is disabled while the request is active.
- Platform-owner access requires the trusted `plotmap_is_platform_admin()` RPC; mock mode cannot grant it.
- Supabase's standard session persistence, refresh rotation, and cross-tab Web Lock behavior are retained instead of implementing custom token/auth coordination.
- Local Auth configuration now disables public/email signup, requires at least 12 characters with lower/upper-case letters and digits, enables email confirmation and secure password changes, shortens email OTP expiry to 600 seconds, reduces sign-in/token-verification rates, and enables TOTP enrollment/verification.
- Edge Functions explicitly requiring gateway JWT verification are `ai-run`, `delete-dealer`, `marketing-ops`, `presentation-properties`, `property-intelligence`, and `provision-dealer`. `resolve-client-link` remains gateway-public because its handler validates a high-entropy capability token; `ai-worker` remains gateway-public because its handler validates a server-to-server shared secret.

The local `supabase/config.toml` does not change an already-hosted Supabase project. Dashboard parity is a required manual deployment step. TOTP is enabled as a capability but is not yet enforced as an organization or platform-admin policy.

## 5. Storage changes

- Existing private bucket policies were reviewed for tenant-prefix enforcement. Current private scopes include property photos, property documents, client-link audio, marketing creatives, raw reels, and finished reels.
- Dealer deletion now traverses and deletes:

  - `property-photos/dealers/<dealer_id>/...`
  - `client-link-audio/dealers/<dealer_id>/...`
  - `property-documents/dealers/<dealer_id>/...`
  - `marketing-creatives/<dealer_id>/...`
  - `marketing-reel-raw/<dealer_id>/...`
  - `marketing-reel-finished/<dealer_id>/...`

- Missing optional buckets fail as zero deleted objects rather than breaking the lifecycle workflow. Pagination is bounded to 10,000 deletions per invocation; an incomplete pass returns a retryable response after deleting the batch, so a retry makes forward progress.
- Presentation media continues through narrow projection/signed-delivery paths instead of granting anonymous access to private dealer buckets.
- The legacy `maps` bucket was deliberately **not** flipped to private in this phase because current map and presentation code uses public URLs. Changing it without a coordinated migration would break working flows. Until Phase 2, it must be treated as a public declassification zone containing only assets deliberately approved for public/client use.

Dealer deletion must still be exercised on staging with residual-object scans. Database deletion occurs before storage cleanup and relies on the existing tombstone/retry lifecycle if object deletion is incomplete. The public legacy `maps` bucket is not dealer-rooted consistently and may contain shared assets, so it is intentionally not bulk-deleted by dealer ID; the database purge currently removes the map rows/path references first. Phase 2 must capture those paths before purge or establish a safe ownership manifest, then delete only dealer-owned map objects.

## 6. Secret-management findings

- A scan of the current tree and reachable Git history found no high-confidence committed Supabase service-role key, provider token, private API key, or plaintext production credential. No secret value is reproduced in this report.
- Environment files are ignored. Only the normal Supabase URL and publishable/anon key may enter the Vite/browser build.
- The browser Supabase client rejects modern `sb_secret_` credentials and JWTs whose role is `service_role`, reducing the chance that a deployment variable mistake ships a privileged key.
- Service-role, AI, Google server, SMTP, worker, and service-account credentials remain server/Edge environment values and must be stored in Supabase/Vercel secret stores, separated by development, staging, and production.
- Edge redaction helpers cover provider/service key patterns, JWTs, high-entropy tokens, signed URL query credentials, emails, and phone-like values. Request bodies, authorization headers, raw client-link tokens, signed URLs, and full customer records must not be logged.
- The Google Maps browser key is public by design, not a secret. It still requires exact production HTTP-referrer restrictions, API restrictions, quotas, and billing alerts. Browser-side Routes calls create a cost-abuse risk until proxied through an authenticated Edge Function.
- The live A-H verifier refuses service-role keys. The separate service-role fixture bootstrap is clearly development-only and refuses a remote target without the exact project ref plus `RESETTABLE_DEV:<ref>` acknowledgement.
- No rotation is required solely from evidence found in this repository. Rotate immediately if a credential was ever exposed through another branch, removed/unreachable history, chat, logs, build artifacts, support material, or an external system.

## 7. Automated tests added

The `npm run test:security` command runs the following 45 Phase 1 tests:

| Test file | Count | Coverage |
|---|---:|---|
| [`v2/tests/security-phase1-database.test.ts`](./v2/tests/security-phase1-database.test.ts) | 8 | Provider-owned account fields, derived/immutable tenant identity, old-row enforcement, serialized/deferred quotas, scoped helpers, account RLS predicates, audit integrity, presentation deny-by-default, and absence of permissive/destructive SQL patterns. |
| [`v2/tests/security-phase1-frontend.test.ts`](./v2/tests/security-phase1-frontend.test.ts) | 5 | Hostile SVG/path/ID payloads, executable/insecure media schemes, safe buyer labels, sanitized-gallery navigation, and global/client deployment-header contracts. |
| [`v2/tests/security-phase1-interactions.test.ts`](./v2/tests/security-phase1-interactions.test.ts) | 8 | Slow/failing repeated actions, independent keys, concurrent link revocation, stale Earth-flow completion, and static coverage of important save/delete/publish/deal/decision/revoke guards. |
| [`v2/tests/security-phase1-storage-config.test.ts`](./v2/tests/security-phase1-storage-config.test.ts) | 8 | Auth defaults, per-function JWT modes, progressive deletion coverage, both verifier safety latches, service-key rejection, non-empty device controls, and cross-dealer device probes. |
| [`v2/tests/session-security.test.ts`](./v2/tests/session-security.test.ts) | 9 | Server-validated identity, counterfeit/unavailable session denial, identity-bound private caches, Supabase token preservation, cross-tab logout, login single-flight, and platform-admin RPC authorization. |
| [`v2/tests/protected-route-entrypoints.test.ts`](./v2/tests/protected-route-entrypoints.test.ts) | 6 | Dealer/Earth/Map Pilot/developer route gates, server-authoritative developer access, and removal of the custom Supabase Auth lock override. |
| [`v2/tests/security-phase1-earth-meter.test.ts`](./v2/tests/security-phase1-earth-meter.test.ts) | 1 | Earth usage accounting is scoped to the verified user and cannot leak across account changes in one browser. |

Additional verification assets:

- [`v2/scripts/security-verify.mjs`](./v2/scripts/security-verify.mjs) implements the required live hostile checks using only a public key and ordinary Dealer A/Dealer B accounts:

  - **A:** Dealer A targets Dealer B's property UUID for a read.
  - **B:** Dealer A forges `dealer_id = Dealer B` on insert.
  - **C:** Dealer A targets Dealer B's property for update.
  - **D:** Dealer A targets Dealer B's property for delete.
  - **E:** Anonymous caller targets CRM data.
  - **F:** A client capability is created/resolved/revoked and its payload is recursively checked for private or unrelated data.
  - **G:** An ordinary dealer attempts a platform-owner RPC.
  - **H:** Dealer A and anonymous callers attempt Dealer B's private Storage object.

- The live verifier randomizes disposable fixtures, cleans them in `finally`, rejects privileged keys, and requires exact `NON_PRODUCTION:<project-ref>` confirmation for a hosted target.
- [`supabase/verification/verify-isolation.js`](./supabase/verification/verify-isolation.js) provides a smaller anonymous/device check with the same remote-target latch, non-empty positive controls, and explicit cross-dealer device-token probes.
- [`v2/scripts/backend-verify.mjs`](./v2/scripts/backend-verify.mjs) has a separate exact `RESETTABLE_DEV:<project-ref>` remote safety latch because it intentionally creates durable named demo fixtures.
- [`supabase/seed.sql`](./supabase/seed.sql) is intentionally empty; security verification creates randomized fixtures rather than installing customer-like PII by default.

No Playwright suite was introduced because the repository does not currently have a verified browser/CI harness. Rapid-request behavior is covered at the logic and source-contract level; real multi-tab, refresh-during-request, navigation, and modal stress tests remain Phase 2 work.

## 8. Test results

| Check | Result | Interpretation |
|---|---|---|
| `npm run test:security` | **PASS — 45/45** | All Phase 1 security contract/unit tests pass. |
| `npm run typecheck` | **PASS** | The TypeScript project type-checks. |
| `npm run build` | **PASS** | The Vite production build completes. |
| `npm audit --offline` | **PASS — 0 reported vulnerabilities** | The locally cached dependency advisory database reported no vulnerabilities. This does not replace a current online/SCA scan. |
| `node --check scripts/security-verify.mjs` | **PASS** | Live A-H verifier parses successfully. |
| `node --check scripts/backend-verify.mjs` | **PASS** | Service-role development verifier parses successfully. |
| `node --check ../supabase/verification/verify-isolation.js` | **PASS** | The hardened legacy anonymous/device verifier parses successfully. |
| Full Vitest suite | **589/590 pass; 1 pre-existing failure** | The only failure is the user-owned `marketing-production-boundary.test.ts`, which rejects placeholder production constants such as `const PROPS`/`const TODAY` in the already-modified marketing entry point. It is unrelated to Phase 1 and was not overwritten. The overall suite is still red until that existing boundary failure is resolved. |
| Isolated add-property photo tests | **PASS — 3/3** | The focused photo flow remains green. |
| Live database/storage A-H suite | **NOT RUN** | Supabase CLI and Docker are unavailable, and no explicitly confirmed non-production Supabase project plus Dealer A/B credentials was provided. A production or ambiguous remote target was intentionally not mutated. |
| Legacy anonymous/device live verifier | **NOT RUN** | Syntax, process-safety, and static contracts passed, but no staging device token with non-empty same-dealer fixtures and a second dealer was available for live RPC checks. |
| Phase 1 SQL migration execution | **NOT RUN / NOT PROVEN DEPLOYED** | Static checks passed, but PostgreSQL migration semantics and the hosted final state have not been exercised. |

Static tests establish source contracts; they cannot prove RLS, grants, triggers, Storage policies, Edge configuration, or migration ordering in a real Supabase project. The release gate requires an applied migration plus a live 8/8 A-H pass against staging.

## 9. Remaining risks

1. **Deployment is unverified.** The Phase 1 migration, hosted Auth settings, Edge Function JWT modes/secrets/origins, Storage policies, and response headers have not been inspected on a deployed target.
2. **The public `maps` bucket remains a confidentiality and deletion-lifecycle risk.** Draft/private maps, annotations, seller data, and unapproved coordinates must not be placed there. Existing paths are not consistently dealer-rooted, and permanent dealer deletion cannot safely remove shared/public map objects without a pre-purge ownership manifest.
3. **The current tenant key is free-form text.** `dealer_settings.dealer_id` is both organization identity and control plane; not every relationship has an organization UUID, composite tenant foreign key, or centrally enforced membership constraint.
4. **The device/passcode model is not a strong authentication boundary.** Public resolver/activation flows lack a durable attempt/IP rate-limit boundary, and current UI behavior may treat a valid user session as activation. It should not be represented as device approval security.
5. **A hardcoded mock profile remains in `v2/src/packages/auth/auth.ts`.** Backend RLS/Edge authorization is authoritative, but remaining UI action visibility and role UX should load real membership/capabilities in production.
6. **The general CSP still allows `'unsafe-inline'` for compatibility.** Inline handlers/styles and broad HTTPS image/media sources reduce injection containment. The external unpkg icon stylesheet is also a supply-chain dependency without a local integrity boundary.
7. **Google's browser key remains billable and user-visible.** Earth is now protected, but authenticated users can replay browser Routes requests. Referrer/API restrictions reduce abuse; an Edge proxy is the stronger boundary.
8. **Client capability possession is still access.** A valid token can be forwarded until expiry/revocation, and screenshots cannot be prevented. Tokens and signed media URLs must stay out of logs, referrers, analytics, and support material.
9. **Audit maturity is limited.** The application audit RPC is narrow, metadata redaction is top-level, and there is no external immutable sink, retention policy, alerting, or evidence of hosted Auth-log integration.
10. **Not every durable action has server idempotency.** UI single-flight guards do not stop two tabs, direct HTTP replay, or concurrent clients. Map Studio/Ops/Earth and future write paths need an explicit action-by-action review.
11. **Browser stress coverage is incomplete.** There is no real Playwright coverage for multiple tabs, refresh during request, fast navigation, repeated modal cycles, or rapid property selection.
12. **Historical demo data is still migration-shaped.** `20260801002100_seed_demo_dealer.sql` remains in the migration history even though the new root seed file is empty. Demo fixtures should be development-only.
13. **Future schema changes can regress isolation.** A new `dealer_id` table created after the Phase 1 migration will not automatically receive the catalog-installed trigger. A later policy/function replacement can also weaken the final state.
14. **Dealer deletion needs live lifecycle evidence.** All current private buckets are registered, but staging must prove database purge, object cleanup, retries/tombstones, and residual scans under partial failure; public map ownership/cleanup remains unresolved.
15. **Operational controls are outside the repository evidence.** CAPTCHA/breached-password protection, mandatory privileged MFA, production SMTP, backups/PITR, network restrictions, alerting, incident response, log retention, and periodic access review are not established here.
16. **The full local suite is not completely green.** The pre-existing marketing production-boundary failure must be resolved before treating CI as a release gate.

## 10. Recommended Phase 2 work

### Deployment gate before starting or claiming Phase 2

1. Back up a resettable non-production Supabase project and apply every migration through `20260825000100_security_phase_1_foundation.sql` in order.
2. Inspect final `relrowsecurity`, RLS policies, table/view grants, function `proacl`, fixed `search_path`, schema grants, and Storage policies. Confirm `anon` has no generic private-data access.
3. Run `npm run security:verify` with two active users belonging to distinct test dealers and require **8/8**. Treat setup errors, empty checks, unexpected 2xx responses, or cleanup failures as failures.
4. Test suspended/expired accounts, single-row and bulk quota limits, the viewer role, owner/team role transitions, link expiry/revocation, and dealer deletion across every private bucket.
5. Mirror `supabase/config.toml` into the hosted Auth dashboard. Verify closed signup, confirmation, password policy, secure changes, OTP expiry, refresh rotation, rate limits, and TOTP. Add production SMTP and abuse protection.
6. Deploy each Edge Function with the configured JWT mode, exact allowlisted production origins, and environment-specific secrets. Confirm the public functions authenticate inside their handler.
7. Deploy `v2/vercel.json` and inspect actual global and `/client/*` responses. Exercise Supabase, Google Maps, websocket, media, and buyer flows under CSP before loosening any directive.
8. Restrict Google browser and server keys to exact referrers/services, separate credentials by environment, and set quotas/billing alerts.
9. Inventory the public `maps` bucket for private/draft material and remove or migrate anything not intentionally public. Record an ownership/path manifest before dealer-row purge so deletion can remove dealer-owned map assets without deleting shared files.
10. Resolve the existing marketing production-boundary test so the complete suite can become a mandatory release check.

### Phase 2 architecture and hardening priorities

1. **Normalize organizations and memberships.** Introduce immutable UUID `organizations`, `organization_memberships`, separate entitlements and dealer-editable settings, composite tenant foreign keys, and an additive backfill/cutover plan. Support multi-organization users only through a server-validated active membership.
2. **Make maps private by default.** Move source/draft maps to a private bucket and either serve short-lived signed URLs or publish sanitized immutable derivatives to a separate explicit public bucket.
3. **Replace device/passcode trust.** Use invite-only Supabase Auth, enforced MFA or device-session claims issued by a rate-limited server API. Add durable attempt, lockout, expiry, revocation, and anomaly telemetry.
4. **Remove mock authorization from production UX.** Load the authenticated membership and capabilities from a trusted server contract, then align route/action visibility with the database permission matrix while retaining backend enforcement.
5. **Finish CSP/XSS hardening.** Remove inline event handlers, move styles to classes, adopt nonces/hashes and Trusted Types where practical, narrow media/connect origins, self-host or integrity-pin external assets, and continue source-to-sink review of legacy `innerHTML`.
6. **Move billable Google APIs server-side.** Proxy Routes/Places through an authenticated, tenant-rate-limited Edge Function with per-tenant budgets, caching, quotas, and anomaly alerts.
7. **Add server idempotency and integrity constraints.** Use idempotency keys, unique constraints, transaction locks, conflict-safe state transitions, NOT NULL/foreign-key/composite ownership constraints, and tested cascade/soft-delete rules for every costly or destructive workflow.
8. **Mature audit and detection.** Add server-authored login/logout/admin/team/permission/integration/delete events, nested secret redaction, retention/access controls, an external tamper-resistant sink, alerts, and periodic review.
9. **Establish security CI.** Run typecheck, build, full tests, security tests, migration lint/apply, database A-H tests on disposable Supabase, dependency/secret/SAST scans, Edge checks, and header/CSP smoke tests on every release.
10. **Add browser adversarial E2E.** Cover slow/failing networks, repeated Save/Delete/Publish/Generate/Create actions, refresh mid-request, two tabs/two users, rapid navigation/selection, modal churn, token revocation, and account switching.
11. **Move demo data out of migrations.** Keep deterministic/randomized fixtures in local seed/test tooling only, never in the production migration chain.
12. **Operationalize production security.** Require MFA for `MAPCO_OWNER`, enable breached-password and CAPTCHA protections where supported, configure backups/PITR and restore drills, restrict database/network access, rotate credentials on schedule/exposure, and maintain an incident-response owner and residual-risk register.

Phase 1 is complete as a reviewed source implementation candidate. It is not complete as a deployed security control set until the manual deployment gate and live hostile verification are evidenced.
