# DealSetu functionality audit — in progress

Design frozen. Continue the current working tree. No deployment, merge, reset,
stash, clean or branch checkout. Target: MAPCO-DEV (lswzrkvdwirhvggtvuch).

## Baseline inspected 2026-09-09

Branch: antigravity/final-visual-polish. Full tracked diff and three untracked
files inspected before edits. Inherited changes: Contacts edit types, private
note field binding, load/save errors, client/deal ID join, mixed-unit budget
formatting, per-instance render-handler cleanup, associated tests and launch
configuration. Untracked administrative helper scripts contained hardcoded
credentials; replaced with required environment variables. Neither script was
executed. Credential rotation needs separate operational follow-through.

Baseline `npm test`: 881 tests pass in 58 suites; SIX other suites fail to
collect because they reference removed dealer pages/shell. This is not a clean
full-suite result. Failing suites: ai-foundation, customers-page-boundary,
dealer-operations, dealer-shell-startup, deals-page-boundary,
security-phase1-interactions. Must migrate their meaningful assertions to the
current product, not simply exclude them.

## Matrix

Pending rows are deliberately not marked PASS; final status must be one of
PASS / BROKEN→FIXED / NOT IMPLEMENTED→IMPLEMENTED / BLOCKED /
INTENTIONALLY UNAVAILABLE, supported by evidence.

| Area | Current finding / evidence | Final status |
| --- | --- | --- |
| Auth | Real demo dealer sign-in succeeds on port 5178 with VITE_DATA_MODE=supabase. Refresh revalidates session. Full logout/login cycle pending. | Pending |
| Contacts rendering | Authenticated Clients list, add form, profile, edit form render. Private note created and survives refresh/reopen. | Pending |
| Client edits | Prevent save after failed initial lookup. Optional fields can now be cleared. Recorded budget numbers take precedence over stale display string. | BROKEN→FIXED (unit verified; browser in progress) |
| Client shortlist | Removed optimistic local mutation before save; lookup/write failure exposed. Concurrency and browser failure verification pending. | Pending |
| Home | Hardcoded INTEREST, today, activity and type counts; broken Show the map route. Must bind canonical aggregates. | Pending — broken |
| Dealer identity/settings | Hardcoded Rajinder identity; gear has no handler. | Pending — broken |
| Deals | Hardcoded seven deal fixtures; stage/payment/doc/next-action changes mutate arrays only. Pipeline repository exists and needs binding. | Pending — broken |
| Client Links | Seeded list and local delete; inspect all creation/revoke/resolver/activity paths before replacement. | Pending |
| Properties / Add / Edit / all types | Canonical store exists; edit defaults appear capable of inventing values. Full field and workflow trace pending. | Pending |
| Sellers / profiles | Canonical store exists; authenticated list renders. CRUD, archive/restore and error cases pending. | Pending |
| Property lifecycle | Existing sold/unsold/archive/on-hold/delete/restore tests ran in baseline; browser cycles and handler audit pending. | Pending |
| Documents / photos / videos | Full UI to storage and reload audit pending. | Pending |
| Earth / sector maps | Preserve WGS84, mapPlacement and confirmation/autocomplete lifecycle; full browser audit pending. | Pending |
| Buyer Client Links | Preserve CSP, exact-location, tokenless resolver and PI gates; full browser audit pending. | Pending |
| Property Intelligence / telemetry | Existing tests ran in baseline; reachable handlers and backend verification pending. | Pending |
| Search / filters / secondary controls | Inventory every modal/tab/toggle/button, including conditional fields. | Pending |
| Tenant isolation / RLS | Existing security tests ran except removed-module collection failures; live isolation proof pending. | Pending |

## Current verification

- Focused desk client/property/seller/framework suite: 74 tests passing.
- Typecheck passed after first Contacts fixes; final rerun pending.
- Browser test record: QA Persistence 0909, phone ending 8998, created through
  dealer Add Client. Note: QA private note survives refresh 0909.
- Refresh/reopen shows note and no supplied property type.
- Full browser client cycle proven: create → save → refresh → reopen → edit →
  save → sign out via the application's `?signout` route → sign in again →
  reopen. Business QA Persistence Firm, budget ₹80 L–1.5 Cr, and original
  private note are present after relogin. No property type was invented.
- Client Links seeded array replaced by paginated repository reads and real
  workspace event history. Revoke now calls repository; permanent deletion
  reports unsupported instead of silently removing a local row. Further tests,
  error presentation, creation reload, and authenticated revoke proof pending.
- The browser text snapshot redacts the phone input value. Screenshot confirmed
  retention; do not misdiagnose the redacted value as an application bug.

No checkpoint or push yet: the whole-product pass is not complete.

## Deals continuation — 9 September

- Removed seeded Deals from the visible collection. Pipeline and completed
  records now load through paginated repositories and canonical workspaces.
- Stage, lost and payment handlers use the existing RPCs; completion routes
  through the atomic sale command. No commission percentage is invented when
  opening Mark Sold. Payment entry asks for the amount actually received.
- Fixed concurrent collection calls that dropped the second payer-side receipt.
- Browser found a completed sale displayed as zero: Desk now uses the canonical
  workspace money value. Browser refresh confirms ₹3 Cr and ₹12,931 received.
- Applied `20260909154240_desk_completed_money_compatibility.sql` to MAPCO-DEV.
  The workspace preserves legacy scalar commission/received snapshots without
  fabricating payer sides or dated receipts. Final sold price takes precedence
  over an earlier negotiating value. Existing tenant/role guards retained.
- Authenticated-role SQL assertion verifies 30000000 value, 12931 expected,
  12931 received and zero due; anon execute remains denied. This SQL role check
  supplements, and does not replace, the authenticated browser check.
- Focused desk client/property/link/deal and pipeline suites: 81 passing.
  Typecheck passes. Full final suite/build/browser matrix still pending.
- Deals still has local-only wizard/edit/next-action/document/delete handlers
  requiring completion. Do not mark this area PASS yet.
- Security advisor run reports existing public RPC exposure notices, 27
  RLS-without-policy tables, five mutable-search-path helpers, and leaked
  password protection disabled. These need scope-aware assessment; some RPCs
  intentionally serve buyer/device flows. Do not blanket revoke access.
