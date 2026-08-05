# MAPCO V2 Backend Architecture and Production Roadmap

Last verified: **2026-08-06 (Asia/Calcutta)**

Branch: **`feat/mapco-v2-backend`**

Supabase target: **MAPCO-DEV (`lswzrkvdwirhvggtvuch`) only**

Production web app: **https://mapco-navy.vercel.app**

This is the implementation handoff for the current MAPCO V2 backend. It supersedes old “next step” notes where they conflict with the verified state below. Never run these instructions against the legacy PROPERTY Supabase project (`czmkfmkmgqlienmdihul`), never put a service-role key in Vite/Vercel, and do not merge this branch to `main` without a separate approval.

## 1. Current architecture

### Runtime boundary

- UI code consumes `DataAdapterV2` through `src/packages/data/adapter.ts`.
- `VITE_DATA_MODE=supabase` selects the real Supabase adapter; mock mode is limited to development and tests.
- A production build now fails closed with a visible configuration error if data mode or required Supabase browser configuration is missing. It never silently creates a local-only Client Link.
- Browser configuration contains only the Supabase project URL and publishable anon key. Service-role access exists only in Supabase Edge Functions and backend verification tools.

### Persistence and tenancy

- Supabase Auth provides dealer/team sessions.
- `dealer_id` is the tenant key on dealer-owned tables.
- RLS and security-definer RPCs enforce tenant isolation; frontend filters are not treated as security.
- CRM entities are stored in `crm_records` with typed payloads for properties, clients, deals, and related records.
- Maps are stored in `prebuilt_maps`; public map assets are in the `maps` bucket.
- Property and Client Link media use private Storage buckets and short-lived signed URLs.

### Private Client Link flow

```text
dealer records PCM/WAV
  -> authenticated private Storage upload
  -> plotmap_create_client_link freezes a client-safe snapshot
  -> database stores only the token hash and private media metadata
  -> resolve-client-link validates the raw token anonymously
  -> token-scoped RPC returns only linked, published, client-visible data
  -> Edge Function signs approved photos/audio
  -> public page receives signed HTTPS URLs and client-safe maps
  -> public events are recorded through the token-scoped event RPC
```

The raw Client Link token is returned once, kept closure-scoped by the public page, stripped from browser history, and never stored in local/session storage.

### Map relationship

```text
property
  -> sectorMapId and/or mapPlacement.mapId
  -> normalized mapPlacement { x, y }
  -> sector prebuilt_map
  -> parent_map_id
  -> city masterplan prebuilt_map
```

The public resolver uses saved IDs before any compatibility label matching. Precise Location OFF returns no map rows and no pin. Precise Location ON returns only the linked sector and its parent masterplan, plus a real 3D asset only when that asset exists.

## 2. Immediate implementation completed

### Production data mode

- `src/packages/data/adapter.ts` rejects mock mode in production and reports missing/invalid production configuration clearly.
- Vercel Production now has persistent entries for `VITE_DATA_MODE`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
- The deployed bundle must be rebuilt after these entries are set; do not use one-off CLI-only build variables as the long-term configuration.

### Voice-note reliability

- `src/packages/ui/shared-modals.ts` records mono PCM and encodes WAV rather than hardcoding WebM/Opus.
- Recording rejects missing APIs, denied microphone permission, empty capture, recordings shorter than 250 ms, and files larger than the upload limit.
- Samples are resampled to 16 kHz so a 120-second recording remains below 5 MB.
- `src/packages/data/supabase/supabase-adapter.ts` validates the audio MIME/type, uploads with the correct extension, stores a dealer-scoped private object path, and removes the object if link creation fails.
- The public resolver returns only a short-lived signed URL. It does not return `audioObjectPath`, media metadata, or a service credential.
- The public player remains user-gesture driven and supports Play, Pause, Resume, Replay, and signed-URL refresh after expiry.

### Token-scoped maps and public safety

- Migration `20260805000100_client_link_scoped_maps_and_listing.sql` adds the service-role-only scoped-map resolver and richer authenticated Client Link listing.
- `supabase/functions/resolve-client-link/index.ts` validates the origin, token result, and media/map envelope before signing media.
- Only linked properties, their linked sector, parent masterplan, safe dimensions, safe assets, and allowed normalized pins are returned.
- Draft, hidden, archived, unrelated maps, internal overlays, seller/owner data, commission, payment data, documents, notes, team data, and raw private paths are absent from the public envelope.

### Public location and multi-property UI

- `src/packages/ui/client-link-view.ts` is shared by dealer preview and the anonymous public route.
- A property switcher updates photos, client-specific price, facts, visibility, location text, sector map, masterplan, mode, and pin as one state change.
- Sector Map and Masterplan tabs use the saved map relationship.
- The modern SVG pin uses the same contained-raster calculation as the map image and is recalculated on resize.
- The fullscreen landscape viewer uses the same source dimensions and normalized pin coordinates.
- Original/3D controls expose 3D only when a separate real 3D asset exists; no CSS tilt is presented as 3D.
- Incomplete placement produces an unavailable state instead of guessing another map.

### Real interlinking proved on MAPCO-DEV

The live `scripts/client-link-e2e.mjs` run verifies:

- a new property and client are visible to dealer and team sessions;
- two selected properties, per-property prices, precise-location mode, and voice metadata persist in a real `share_links` row;
- the real private audio object exists and resolves to an anonymous WAV response;
- opening the link updates analytics;
- the authenticated link listing contains the client ID and all property IDs, enabling property analytics and client activity;
- completing a sale atomically marks the property sold, unpublishes it, removes it from client-safe inventory, updates the buyer’s purchased list, and prevents a new Client Link from selecting that sold property;
- expired and revoked tokens fail closed.

## 3. Important source files

| Responsibility | Source |
|---|---|
| Production mode selection and fail-closed error | `src/packages/data/adapter.ts` |
| Browser Supabase client validation | `src/packages/data/supabase/client.ts` |
| Real DataAdapterV2 implementation | `src/packages/data/supabase/supabase-adapter.ts` |
| Voice recording and Client Link builder | `src/packages/ui/shared-modals.ts` |
| Shared public/dealer Client Link renderer | `src/packages/ui/client-link-view.ts` |
| Anonymous Client Link entry point | `src/apps/client/main.ts` |
| Dealer customer activity | `src/apps/dealer/pages/customers.ts` |
| Edge media/map broker | `../supabase/functions/resolve-client-link/index.ts` |
| Client-safe scoped maps/listing migration | `../supabase/migrations/20260805000100_client_link_scoped_maps_and_listing.sql` |
| Typed prices and precise pins migration | `../supabase/migrations/20260803000200_client_link_typed_price_and_precise_pins.sql` |
| Live Client Link/interlink test | `scripts/client-link-e2e.mjs` |
| Full RLS/storage/map verification | `scripts/backend-verify.mjs` |

## 4. Remaining phase 1 — Full Supabase production mode

### Goal

Make every production dealer/team workflow cross-device and Supabase-backed, with configuration and session failures always explicit.

### Current state

- Production selection is fail-closed and Vercel Production variables are persisted.
- Dealer/team email-password sessions and MAPCO-DEV persistence work.
- Mock mode is still intentionally available to development/tests.
- A complete cold-start audit of every route after the new deployment is still required.

### Backend changes

- Add a lightweight authenticated bootstrap RPC returning profile, dealer settings, role/permissions, and feature limits in one response.
- Add structured error codes for suspended, expired, missing-profile, and inactive-dealer states.
- Ensure every mutating adapter path uses RPCs or RLS-safe writes; remove any remaining production-only local mutations discovered by the route audit.

### Frontend changes

- Centralize session/bootstrap state rather than letting each route independently fetch it.
- Show explicit sign-in, expired-session, suspended-account, and configuration screens.
- Keep mock seed/localStorage imports out of the production dependency path.

### Migrations

- Add `plotmap_session_bootstrap()` if no equivalent compact RPC exists.
- Add indexes only when `EXPLAIN (ANALYZE, BUFFERS)` proves a route query needs them.

### Security rules

- Bootstrap derives dealer and role from `auth.uid()`; it accepts no caller-supplied dealer ID.
- RLS stays enabled on all tenant data.
- No service key, internal billing notes, or cross-dealer aggregates are returned.

### Test cases

- Valid owner, manager, team, and viewer sessions.
- Missing profile, suspended dealer, expired trial, disabled user, expired JWT, and network failure.
- Two-dealer isolation for every bootstrap field and primary CRUD flow.
- Production build with each required environment variable removed must show configuration error and make no mock write.

### Acceptance criteria

- A property/client/link created on one device appears after login on another device.
- Every production route uses Supabase mode and no production bundle contains the mock fallback path as an executable choice.
- Cold page refresh succeeds on all 13 HTML entries.

### Dependency order

First remaining phase. Its bootstrap and error model should be reused by phases 4–6.

### Rollback

Keep the current per-repository adapter methods until the compact bootstrap is proven. Roll back the frontend bootstrap call without reverting RLS or schema hardening.

## 5. Remaining phase 2 — Client Link reliability

### Goal

Turn the completed core flow into an operationally robust sharing system under retries, expiry, mobile browser differences, and partial upload failures.

### Current state

- Private WAV, signed audio, signed photo plumbing, expiry, revocation, open events, multiple properties, typed prices, precise-location privacy, and invalid-state UI exist.
- Real Edge resolution and anonymous WAV bytes are verified.
- Physical iPhone Safari and Android Chrome audible-output UAT remains a human-device check.

### Backend changes

- Make link creation idempotent with a client request ID so retrying after a timeout cannot create duplicate links.
- Add a cleanup job for orphaned audio/photos older than a safe threshold.
- Add rate-limited event deduplication by token hash, event type, property, and time bucket.
- Add signed-photo refresh to the same refresh contract used by audio.
- Add structured resolver telemetry without logging raw tokens or signed URLs.

### Frontend changes

- Surface upload progress, retry, cancel, and clear failure messages.
- Refresh expired signed photo URLs after image failure.
- Preserve selected property and active map when media refresh occurs.
- Render distinct invalid, expired, revoked, unavailable, and no-approved-photo states.

### Migrations

- Add `client_request_id` uniqueness per dealer if idempotent creation is not already modeled.
- Add safe event dedupe indexes and an orphan-media work queue/table only if a scheduled Edge job is chosen.

### Security rules

- Never log or persist raw tokens after creation.
- Signed URLs remain short-lived; buckets remain private.
- Resolver output remains allow-listed rather than copying arbitrary snapshot metadata.
- Event RPCs validate token state and never reveal whether an unrelated token exists.

### Test cases

- Upload timeout followed by retry, link-RPC failure after upload, and duplicate submit.
- Signed audio/photo expiry during an open page, then successful refresh.
- Missing/deleted media, zero-byte/corrupt audio, slow 3G, offline/reconnect.
- Play/Pause/Resume/Replay on current iPhone Safari and Android Chrome.
- 1, 2, and 4 properties with different prices and precise-location settings.

### Acceptance criteria

- No successful UI card exists without a real resolvable database row.
- A retry creates at most one link and leaves no orphaned media.
- All supported phone browsers play a dealer-recorded note audibly after a user tap.
- Expiry/revocation becomes visible on the next resolver call without exposing private data.

### Dependency order

After phase 1 production bootstrap; before broad performance caching so error semantics are stable.

### Rollback

Add idempotency columns/RPC parameters compatibly. The old creation call can remain accepted during rollout; disable scheduled cleanup before reverting any queue schema.

## 6. Remaining phase 3 — Map catalog cleanup

### Goal

Make every real sector map reliably resolve to the correct Original/3D assets, parent masterplan, and property placement without label guessing.

### Current state

- MAPCO-DEV contains 81 verified maps (9 masterplans, 72 sectors) with no orphan sector parent.
- Published/non-archived masterplans have dimensions.
- The Client Link resolver is token-scoped and no fake 3D is exposed.
- Catalog content still needs a founder-reviewed truth pass for every city/sector and every Original/3D pairing.

### Backend changes

- Add a catalog audit RPC or script that reports orphan parents, missing dimensions, duplicate city/sector identity, missing Original, suspicious same-file Original/3D pairs, and invalid placement IDs.
- Normalize stable city/area/sector slugs while preserving display labels.
- Store asset checksums so duplicate or mislabeled renderings can be detected.

### Frontend changes

- Map Studio should block publish when Original or intrinsic dimensions are missing.
- Show “3D unavailable” when no separate verified asset exists.
- Show placement completeness and parent-masterplan validation before property publish.

### Migrations

- Add unique/partial indexes for normalized catalog identity if the audit shows duplicates.
- Add optional asset checksum and `three_d_verified_at/by` metadata.
- Add constraints preventing self-parenting and cross-dealer parent links.

### Security rules

- Dealer map mutation stays permission-scoped.
- Public/client reads require `published` and `client_visible`.
- Draft, hidden, archived, overlays, calibration internals, and edit metadata stay out of anonymous payloads.

### Test cases

- Every sector has an existing same-dealer masterplan parent.
- Original and 3D URLs differ where 3D is enabled.
- Draft/hidden/archived maps never resolve publicly.
- Normalized coordinates remain in `[0,1]` and reference an allowed linked map.
- Removing/renaming a map produces an actionable Map Studio validation error.

### Acceptance criteria

- Founder-approved inventory maps one-to-one to database records.
- No fake 3D control appears anywhere.
- Every published, placed property opens the intended sector and parent masterplan with the same saved pin.

### Dependency order

Can run after phase 1 and in parallel with phase 2, but must finish before aggressive map caching in phase 4.

### Rollback

Introduce normalized fields/checksums as nullable, backfill, verify, then enforce. Never delete original asset metadata during the first migration.

## 7. Remaining phase 4 — Performance system

### Goal

Keep Client Presentation and dealer routes responsive on mobile/tablet/lower-powered laptops without stale data or unbounded memory.

### Current state

- Presentation loads from real catalog APIs and map engine transforms are stable.
- The app still performs several independent repository calls and loads original-size media more often than necessary.

### Backend changes

- Add one compact presentation bootstrap RPC containing account-safe presentation configuration, default map, published maps needed for navigation, and initial properties.
- Generate thumbnail/medium image variants at upload time or through a trusted image service.
- Return immutable asset versions/checksums for cache keys.
- Remove duplicate RPCs after measuring actual call graphs.

### Frontend changes

- Preload the default map and the first visible property photo only.
- Use a priority queue: active map/property first, adjacent property second, background catalog last.
- Add bounded LRU caches for raster metadata, decoded images, and parsed SVG overlays.
- Abort superseded fetch/decode work with `AbortController`.
- Release image references, observers, object URLs, audio objects, and map listeners on route/property changes.

### Migrations

- Add variant metadata/checksum fields and indexes supporting the bootstrap RPC.
- Do not add a generic cache table unless server-side profiling proves it is required.

### Security rules

- The bootstrap RPC returns client-safe/public fields only for presentation devices.
- Cache keys must not include raw tokens or signed URLs.
- Private signed media must not be persisted in service workers or long-lived caches.

### Test cases

- Cold/warm loads on fast desktop, throttled mobile, and lower-powered laptop.
- Rapid property/map switching cancels stale work and never replaces the active view late.
- Repeated Original/3D switching keeps one active image and bounded cache size.
- Long presentation session shows no monotonic listener, DOM node, or decoded-image growth.

### Acceptance criteria

- One bootstrap request supplies the initial presentation data.
- First usable map/property is visible within agreed budgets measured on target hardware.
- Caches stay within explicit count/byte limits and clean up after navigation.

### Dependency order

After phases 1 and 3; implement only after a baseline trace so optimizations target measured costs.

### Rollback

Keep old individual repository calls behind a temporary feature flag until bootstrap parity tests pass. Image variants are additive; original assets remain available.

## 8. Remaining phase 5 — Production account management

### Goal

Operate dealer trials, paid plans, manual payments, activation/suspension, usage limits, and devices without direct database editing.

### Current state

- Schema/RPC foundations exist for trial dates, subscription/account status, plan/limits, activation, devices, and admin audit events.
- A complete operator workflow, renewal process, and production policy/UAT pass are not finished.

### Backend changes

- Define one account-state transition service/RPC with allowed transitions and audit logging.
- Model manual payment records, receipt/reference, plan period, operator, and reconciliation status.
- Add renewal reminder scheduling and notification delivery state.
- Enforce property/map/seat/device limits transactionally at mutation points.
- Add session/device revoke operations and last-seen metadata.

### Frontend changes

- Build an operator account panel for trial start/end, plan, payment, activate, suspend, renew, and device/session revoke.
- Dealer UI should show plan status, remaining trial days, limits, renewal warning, and actionable suspended/expired states.

### Migrations

- Add a private `dealer_payments` ledger and notification/reminder table.
- Add transition/audit constraints and indexes by dealer/status/due date.
- Add no-update/no-delete policies for immutable payment/audit history where appropriate.

### Security rules

- Only platform-admin identities can modify account/payment state.
- Dealer users can read only their own safe plan summary, never operator notes or other dealers.
- Payment and account changes are RPC-only and audited with actor, before/after state, and timestamp.

### Test cases

- Trial activation, extension, expiry, paid renewal, past due, suspension, reactivation.
- Limit boundary and concurrent-create attempts.
- Manual payment duplicate reference and correction workflow.
- Device limit, device revoke, all-sessions revoke, and stolen/expired session.
- Platform-admin versus dealer/team authorization matrix.

### Acceptance criteria

- Operators can manage an account without SQL console access.
- Every state/payment mutation has an immutable audit record.
- Suspended/expired accounts are blocked consistently by backend and UI.
- Dealer limits cannot be bypassed by concurrent or direct API calls.

### Dependency order

After phase 1 bootstrap/error states. Can overlap phase 4 once the account contract is fixed.

### Rollback

Roll out enforcement by limit type behind server-side flags. Payment/audit ledgers are append-only and should never be dropped during rollback; revert consumers, not history.

## 9. Remaining phase 6 — Production hardening

### Goal

Make failures observable, recoverable, backed up, isolated, and reproducible before real dealer onboarding.

### Current state

- Automated unit/build checks, real MAPCO-DEV RLS tests, token tests, Storage checks, and two-dealer isolation exist.
- Production alerting, backup restore drills, browser/device matrix, and long-running operational monitoring remain.

### Backend changes

- Add structured Edge/RPC error logging with correlation IDs and secret redaction.
- Configure alerts for resolver error rate, auth failures, storage/signing failures, and database saturation.
- Add upload-recovery/orphan cleanup jobs with dry-run reporting.
- Enable and document database/Storage backup strategy and perform restore drills into a separate non-production project.
- Add scheduled integrity checks for RLS, map catalog, expired links, and orphan media.

### Frontend changes

- Capture route, release, correlation ID, and safe error category in an error-reporting service.
- Add retry/offline/session-expired UI without exposing internal error text.
- Ensure all route-level async work cancels on navigation/pagehide.

### Migrations

- Add a redacted operational-event table only if the selected logging platform cannot provide required searchable context.
- Add cleanup job state/leases if scheduled cleanup runs inside Supabase.

### Security rules

- Redact tokens, signed URLs, phone numbers, owner/seller data, documents, and all credentials from logs.
- Backup access is restricted and audited.
- Restore tests use isolated projects and synthetic data; never overwrite MAPCO-DEV or production.

### Test cases

- Full two-dealer isolation suite in CI against an ephemeral/isolated Supabase project.
- Route refresh and direct-entry tests for every HTML route.
- Session expiry during read, upload, link creation, and presentation.
- Edge timeout, Supabase outage, signed URL failure, corrupt upload, and retry recovery.
- Current iPhone Safari, Android Chrome, iPad/tablet, and lower-powered Windows laptop.
- Backup restore drill with row counts, RLS, Storage inventory, and Client Link revocation verification.

### Acceptance criteria

- On-call can identify a failing component and correlation ID without viewing private payloads.
- Backup restore steps are executed successfully, not merely documented.
- Critical routes pass the supported device/browser matrix.
- Security isolation and route-refresh checks run on every release candidate.

### Dependency order

Start observability early, but the final hardening gate follows phases 1–5 and blocks production onboarding.

### Rollback

Logging and alerts are additive and can be disabled independently. Cleanup begins in report-only mode. Never make automatic deletion the first rollout.

## 10. Required execution order

1. Full Supabase production mode and session/bootstrap contract.
2. Client Link retry/media reliability and physical phone UAT.
3. Map catalog truth/relationship cleanup.
4. Measured presentation/media performance system.
5. Account/payment/device operations.
6. Final observability, recovery, restore, isolation, and device hardening gate.

Phases 2 and 3 can overlap after phase 1. Phase 5 can overlap measured performance work after the account bootstrap contract is stable. Phase 6 supplies early observability but remains the final release gate.

## 11. Verification commands

Run from the repository root unless shown otherwise:

```powershell
node v2/scripts/client-link-e2e.mjs
node v2/scripts/backend-verify.mjs
cd v2
npm test
npm run build
npm audit
```

Expected verified baseline on 2026-08-06:

- Client Link/interlink E2E: **28 passed, 0 failed**
- Backend/RLS/storage/map verification: **36 passed, 0 failed**
- Vitest: **93 passed** across 6 files
- TypeScript + production Vite build: **passed**
- npm audit: **0 vulnerabilities**

The live scripts create isolated test rows and remove them in `finally`. If a run is interrupted, remove only rows/objects carrying that run’s `e2e-*` or explicitly generated `browser-*` identifier; never run a broad database or Storage cleanup.

## 12. Deployment checklist

1. Confirm branch is `feat/mapco-v2-backend` and inspect `git status`, `git diff`, and staged files.
2. Confirm no `.env`, token, service-role key, signed URL, or approved design asset is staged.
3. Run all commands in section 11.
4. Push the committed branch.
5. Confirm Vercel Production contains the three required `VITE_*` variables.
6. Deploy the pushed commit from `v2` with `npx vercel --prod`.
7. Verify `/`, `/admin/owner.html`, `/admin/team.html`, `/app/plotmap/index.html`, and `/client/index.html` by direct navigation and refresh.
8. Create one short-lived real Client Link, open it directly in a fresh anonymous browser, tap Play, verify the audio resource and UI, then delete only that test link/audio object.
9. Confirm the production JavaScript bundle contains Supabase mode and the MAPCO-DEV project reference, not mock mode as the selected runtime.
