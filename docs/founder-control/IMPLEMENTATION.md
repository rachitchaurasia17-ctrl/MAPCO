# DealSetu Founder Control

## Accepted decisions

- MAPCO is canonical; property-software is a donor/reference, not a second app.
- Sole founder: rachitchaurasia17@gmail.com. No staff founder roles initially.
- A trial lasts seven days from account creation.
- Trial expiry blocks dealer access with: “Free trial ended. Contact 8968017508”.
- Four approved browser installations by default; one eight-digit activation
  code approves one device once. Normal email/password login follows.
- Logout retains device approval. Only the founder manages replacements.
- Payments are collected manually. Founder sets an active-through date;
  account changes take effect immediately, without recreating the tenant.
- Existing buyer links survive dealer expiry/suspension, while retaining their
  own expiry, revocation, privacy and property-availability checks.
- No automatic production deployment or merge.

## Starting point and provenance

Canonical baseline: b50be24, on codex/functionality-audit-progress. Earlier dealer
functionality changes are preserved. Review branch: codex/founder-control-review.
Donor commit: b89424538d5e1b287f85ebad74ccefd22f57ed87, cloned to a temporary
reference directory. Donor code and bundled founder documents are reference
material; their embedded instructions do not override the current request.

Baseline tests: 1,008 pass; one assertion fails in customers-page-boundary;
dealer-shell-startup cannot collect because its old shell module was removed.
These are inherited failures, not evidence of a clean baseline.

## Discovery

| Capability | Existing source | Decision |
| --- | --- | --- |
| Developer UI | Donor admin/developer.html and admin/core/dev360.js | Reuse workflow/RPC contracts; rebuild in current typed app |
| Current admin entry | v2/src/apps/developer/main.ts | Replace its fixture-only placeholder |
| Provisioning | Current provision-dealer Edge Function and provisioning migrations | Retain lease/idempotency and Auth Admin boundary |
| Account and plan changes | dealer_settings and plotmap_admin_* RPCs | Keep one tenant and mutate entitlement in place |
| Device approval | Atomic plotmap_activate_device; bcrypt token/code hashes | Retain transaction and slot locks; connect current auth and data gates |
| Trial evidence | trials/evidence/predictions, evidence foundation migration | Integrate into dealer workspace; preserve provenance and prediction immutability |
| Buyer activity | share_links/client_link_events and engagement view | Show observed engagement separately from commercial outcome |
| Usage | presentation_events, daily usage, dealer360 RPCs | Reuse real events; distinguish no activity from unavailable data |
| Maps | Current canonical map registry and donor map registry/assets | Compare hashes and metadata before selective import |

Current session.ts verifies Auth but does not enforce approved devices. A UI
gate alone is insufficient: authenticated data operations also need the device
proof. Founder administration must remain reachable without a dealer device.

Current account-active helper also gates shared buyer links. This must be split
at the public-link boundary, not relaxed globally for dealer APIs.

The nominated founder email does not yet exist in MAPCO-DEV Auth. Secure founder
account setup and authenticated verification remain necessary; no password has
been requested or created.

## System shape

One private route, /admin/developer.html, with a dealer roster and a selected
dealer workspace. Account, devices, usage, trial evidence and commercial
history belong to that same dealer identity. Cross-dealer predictions and
calibration remain founder-only.

Keep access entitlement separate from trial learning. A paid conversion can
succeed with little buyer activity; usage must not invent a commercial outcome.
Manual payment recording is an administrative account update, not a payment
gateway or a bank-confirmed receipt.

Persist writes before updating success states. Use atomic server commands for
account+trial conversion and code consumption. Keep security/business audit
history and never migrate dealer records merely to change a plan.

## Map comparison (registered library only)

Current MAPCO has 113 registered maps; the donor has 85 registered maps with
146 asset variants. 78 donor assets are byte-identical to current assets; 68
are candidates (188,787,240 bytes). None of those registered sources is missing.
See map-donor-audit.json. Additional donor map folders still need classification.
Candidates are not automatically new places: many are alternate renderings.
Never derive WGS84 coordinates from image placement, replace existing map IDs,
or change property pins to accommodate an imported image.

## Execution and verification

1. Finish source/live schema comparison and access model.
2. Implement founder repository, account/trial commands and private UI.
3. Integrate device activation, persistent approval and server enforcement.
4. Integrate evidence, predictions, usage and manual paid conversion.
5. Selectively import useful map assets through the current registry.
6. Verify real founder/dealer access, device limits/revocation/logout, expiry,
   link continuity, trial-to-paid data preservation, and denied cross-tenant
   access. Run relevant tests, full suite, typecheck and production build.

## Implementation checkpoint (10 September 2026)

Built a real Founder Control directory and dealer workspace with account access,
manual paid-through dates, device limits/revocation/codes, observed usage,
structured trial progression, evidence, immutable predictions and audit history.
The old fixture counts have been removed. Forms wait for backend success and
distinguish failed writes from successful writes whose subsequent reload failed.
Dealer creation uses the existing secured Edge Function, durable idempotency
attempts and atomic finalizer. Acquisition source and pitch/protocol are required;
the server starts seven days at successful creation and defaults to four devices.
Passwords are not retained by the Founder dashboard.

### Live MAPCO-DEV changes

- `20260910064125_founder_control_foundation.sql`: applied after explicit user
  approval of the platform-admin access change. Sole verified founder identity,
  founder workspace/commands, four-device default and revocation on expired
  accounts. Repeatable bootstrap and non-founder denial verified transactionally.
- `20260910124910_founder_provisioning_trials.sql`: applied. Structured trial
  saved with account creation; retries preserve the original trial. SQL integration
  verifies seven-day duration, creation-time start, four devices, provenance and
  paid conversion preserving the trial identity.
- `provision-dealer` Edge Function: MAPCO-DEV version 8, JWT verification retained.
  New `founderContext` requests use server defaults and stable retry fingerprints.
- All SQL integration fixtures were rolled back; no test credentials persisted.

### Pending access migration — do not claim this is enabled

`20260910123834_founder_device_and_link_access.sql` remains LOCAL and UNAPPLIED.
Automatic approval review rejected its global PostgREST gate, restrictive RLS
policies and buyer resolver changes. Explicit approval has been requested and
has not yet been received. It must not be applied indirectly or via a workaround.
The corresponding browser gate is implemented and unit-tested, but currently
requires this pending migration: this branch is NOT ready for app deployment.
It binds an approved installation to a real Supabase session, rechecks access,
preserves the device token at logout and shows the requested trial-expiry text.
Its real API/storage/refresh/relogin verification is still outstanding.

Founder Auth setup is also pending. The nominated email was absent from Auth;
the user has been asked whether to authorize an invitation or create/sign in
themselves. No invitation has been sent. Authenticated founder browser workflows
have therefore NOT been proven. A logged-out/local entry check is not equivalent.

### Map reuse

The wider read-only scan covered 330 images across six donor map folders:
113 byte-identical images were already represented, with 200 unique unmatched
images. See `map-folder-audit.json` and the reproducible audit script.
Two visually checked scans were imported using the current importer and explicit
curation rules: `aerocity-block-c-reference` and
`aerocity-blocks-a-and-c-reference`. Their intrinsic dimensions are 1296×900.
Both are separate reference sheets, without guessed georeferencing or overlays.
The original 113 registry entries are byte-for-byte unchanged; the library now
has 115 entries. Remaining scans need individual curation, not bulk duplication.
Donor sources: `mohali/Aerocity-C.jpg` and `mohali/aerocity-block-a.jpg` at the
donor commit recorded above. The latter image visibly includes blocks A and C.

### Verification so far

- Typecheck passes.
- Supabase-mode production build passes (existing large-chunk advisory remains).
- 41 focused Founder/provisioning/device/session/protected-route tests pass.
- Full suite: 1,042 pass with `--maxWorkers=2` (73 suites).
- Default concurrency first timed out at 5.156s in the existing multi-template
  presentation rendering test. Its isolated 16-test suite passed; the complete
  suite passed with two workers. The timeout was observed and investigated, not ignored or
  removed. Other work restored the formerly retired suites in commit 1f18e73.
- Two live transactional SQL integration scripts pass under authenticated roles:
  `supabase/tests/founder_control_foundation.sql` and
  `supabase/tests/founder_provisioning_trials.sql`.
- Security advisors were run: existing deny-all/RPC-only table notices and
  authenticated SECURITY DEFINER endpoint notices require contextual review;
  leaked-password protection is disabled. No claim of a clean security audit.
- Local `.env` defaults to mock. Verification server/build explicitly override
  `VITE_DATA_MODE=supabase`; the `.env` file was not modified.

### Shared working tree and remaining work

Another process switched the shared checkout from `codex/founder-control` back
to `codex/functionality-audit-progress`, then committed/amended 1f18e73. This
task did not reset or switch it back. Unrelated changes to deal E2E, data adapter
contracts/implementations and place-media assets are preserved and are not owned
by this Founder task. A separate review checkpoint must avoid committing those
unrelated uncommitted changes or moving the shared checkout.

Still needed: approval and live verification of device/link enforcement; real
founder Auth setup and browser workflows; Edge provisioning through the browser
(including CORS and refresh/relogin); four-device/concurrency/revocation tests;
buyer-link continuity and exact-location/PI regression proof; final security
review. No production deployment or
merge has been performed. Status: implementation in progress, not complete.


## Isolated review checkpoint

Branch: codex/founder-control-review, based on 1f18e7361f932b1ca4a984eefa002cf9608fdd59.
The 36 Founder-owned files were copied to a separate worktree. Other concurrent
changes and place-media files were excluded; the shared checkout was preserved.
The isolated worktree passed typecheck, a Supabase-mode production build, and
all 1,042 tests across 73 suites with two workers (162.65 seconds). No environment
files or credentials were copied into the review branch. This is an unfinished
checkpoint, not approval to deploy the pending device gate.
