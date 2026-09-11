# MAPCO-DEV Founder/device checkpoint — 2026-09-11

Scope: provisioning 403 and the existing scoped device/account/buyer boundary.
Branch: `codex/founder-control-completion`, continued from `073ec972e0246cd00ced81ac58431d68c2d767a6`.
No design, dealer UI, map architecture, production deployment or main-branch changes.

## Exact 403 cause and fix

The verifier sent `Origin: https://mapco-navy.vercel.app` to DEV's
`provision-dealer` Edge function. Deployed v8 rejects that origin through
`PLOTMAP_ALLOWED_ORIGINS` before OPTIONS handling, JWT validation,
`plotmap_is_platform_admin`, provisioning RPCs, profiles, dealer_settings,
triggers or RLS. Its misleading public error is HTTP 403 with
`{"ok":false,"code":"PLATFORM_ADMIN_REQUIRED","message":"Active platform-admin access is required.","recoverable":false}`.
There is no Postgres error in this rejection path because it does not call Postgres.

Read-only live OPTIONS reproduction:

| Endpoint / origin | Result |
| --- | --- |
| provision-dealer / production-site origin | 403, no Access-Control-Allow-Origin |
| provision-dealer / http://localhost:5173 | 204, matching allow-origin |
| resolve-client-link / http://localhost:5173 | 204, no allow-origin |
| resolve-client-link / existing buyer-site origin | 204, matching allow-origin |

Rejected provisioning request id: `01a08f56-09b1-7218-9a77-909193c7719d`.
Edge execution id: `c189860a-98e4-4125-83ee-20bc5847aa97`.
Allowed provisioning preflight request id: `01a08f56-0b60-7300-8a4e-362d057b3345`.
Evidence is the live HTTP response and deployed function source. Edge/Postgres
log retrieval was not available through the connected tools; no log inspection
is claimed.

The fix is confined to the verifier: use each endpoint's actual allowed origin,
check both preflights before mutations, and report safe status/code/request-id
diagnostics on provisioning failures. No grants, RLS, origin allow-lists,
provider-only triggers, Founder checks or application code were relaxed.
Additional devices now explicitly bind their authenticated session after activation,
as the actual app does. The origin regression test protects this setup.

## Applied migration and rollback history

1. `20260911144329_founder_device_access_retry_dev_origin`: applied the existing scoped SQL.
2. Provisioning and device checks passed; buyer check failed because the verifier
   incorrectly reused the Founder origin for the independently configured buyer endpoint.
3. `20260911144440_founder_device_access_rollback_buyer_verification`: immediately rolled back before investigating.
4. Verified both endpoint origins; corrected the verifier without changing backend authorization.
5. `20260911144725_founder_device_access_retry_verified_origins`: reapplied the same scoped SQL.
6. Live matrix passed; this last migration remains applied on MAPCO-DEV only.

All three exact migration bodies are retained locally with the applied versions.
Rollback SQL remains available. Account guard and authenticated tenant guard
triggers remain enabled. No global pre-request hook or blanket restrictive policy
is introduced. The scoped migration contains no dealer_settings data mutation;
demo limit normalization uses the authenticated Founder RPC.

## Live verification

`npm run founder:verify -- <MAPCO-DEV env file>`: **68 checks passed**, exit 0.
Creates a disposable dealer through the real deployed provisioning Edge Function,
uses real Supabase Auth/JWT sessions, then removes the tenant and Auth identity
through the existing deletion Edge Function. No secrets or activation codes logged.

| Boundary | Result |
| --- | --- |
| Confirmed sole Founder Auth and private RPC access | PASS |
| Founder exemption from dealer device gate | PASS |
| Existing demo email/password login | PASS |
| Real provisioning, seven-day trial from creation, four-device default | PASS |
| Unapproved device: CRM and older SECURITY DEFINER read denied | PASS |
| Dealer-bound eight-digit code; wrong dealer/code, expired and reused code | PASS |
| Existing invalid-code server delay | PASS (250ms delay; not proof of a request-count lockout) |
| Approved session tenant reads, canonical location RPC and Storage upload | PASS |
| Session restoration and logout/login with same device token | PASS via Auth clients |
| Different device remains gated | PASS |
| Four approved devices; fifth code issuance denied | PASS |
| Founder revocation, immediate Storage denial, replacement slot | PASS |
| Dealer cannot change own device limit or revoke devices | PASS |
| Dealer denied private Founder workspace/actions | PASS |
| Cross-dealer reads and writes | PASS |
| Trial expiry/suspension: access status and direct row denial | PASS |
| Buyer link remains available during dealer expiry/suspension | PASS |
| Buyer link's own expiry and revocation still deny resolution | PASS |
| Exact saved map placement and persisted WGS84 location | PASS |
| Paid conversion preserves trial identity and property data | PASS |
| Test tenant/Auth cleanup | PASS |

These are real backend tests, not browser UI automation. The Founder test session
uses a server-generated magic-link challenge redeemed through Auth, not the
Founder's normal password. Browser localStorage persistence and normal Founder
password login are not claimed from these tests.

Both transactional SQL suites passed and rolled back their fixtures:
`supabase/tests/founder_control_foundation.sql` and
`supabase/tests/founder_provisioning_trials.sql`.

## Browser status and remaining readiness blocker

Opened the unchanged Founder page at `http://localhost:5173/admin/developer.html`
with `VITE_DATA_MODE=supabase` and MAPCO-DEV URL/anon key. The sign-in form renders.
No existing browser session was available. Requested the Founder to sign in
directly in that page; no password requested in chat, reset or exposed.

Still pending that sign-in: authenticated directory, browser provisioning,
trial/paid-through dates, device list/code/revoke controls, suspend/reactivate,
browser refresh/relogin, and normal-dealer UI denial. Backend equivalents above
pass, but do not substitute for these browser requirements.

## Security Advisor classification

Latest DEV scan: 2 anonymous SECURITY DEFINER warnings, 140 authenticated
SECURITY DEFINER warnings, 28 RLS-enabled/no-policy informational findings,
5 mutable-search-path warnings, 1 leaked-password-protection warning.

- Both anonymous functions are intentional token-scoped buyer APIs:
  `plotmap_resolve_client_link` and `plotmap_record_client_link_event`.
  Removing those grants would break public buyer links.
- Device codes/devices/session-binding tables are deliberately inaccessible by
  direct RLS access; vetted definer RPCs provide the required operations.
- Access-system definer functions inspected are postgres-owned with explicit
  search paths. The five mutable-search-path functions are SECURITY INVOKER,
  not privileged definer bypasses. No speculative unrelated changes applied.
- Authenticated definer warnings require function-by-function authorization
  review; critical Founder/device/RPC paths above were exercised. This is not
  a claim that all 140 functions received a complete security audit.
- Leaked-password protection remains disabled. The existing activation delay
  is retained; robust request-count rate limiting was not established here.

## Local checks

- Full runnable suite: **1,057 tests / 77 files passed**.
- Typecheck: passed.
- Production build with explicit Supabase mode and MAPCO-DEV URL/anon key: passed.
- Existing large-chunk and plugin-timing build warnings remain.
- The suite emitted jsdom's unsupported document-navigation diagnostic; no
  failing or flaky test was dismissed.

REAL DEALER READY: NO — required browser proof remains pending.
FOUNDER CONTROL READY: NO — required authenticated Founder UI proof remains pending.
PRODUCTION READY: NO — DEV proof is incomplete and no production rollout is authorized.
DESIGN CHANGES: NONE
