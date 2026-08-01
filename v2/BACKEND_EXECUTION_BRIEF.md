# MAPCO V2 — Backend Execution Brief

Living document for the backend build (Pass 2). Keep it short and current so future
sessions don't re-audit. Update the **Status log** at the bottom every session.

## 0. Identity & guardrails

- Branch: `feat/mapco-v2-backend` (from `1645348`, the approved pixel-parity tip).
- **Supabase target: MAPCO-DEV only.** ref `lswzrkvdwirhvggtvuch`, org `fbrwzrfxpfassqtpjnhc`,
  region ap-south-1, created 2026-07-31. Project URL `https://lswzrkvdwirhvggtvuch.supabase.co`.
- **NEVER touch PROPERTY** (`czmkfmkmgqlienmdihul`, org `iushqzbaoyejfhjgxnkx`) — the legacy/live
  project. Also ignore `plotmap-staging` and the inactive default project.
- No prod deploy, no merge to `main`, no secrets in Git or frontend.
- Data API **ON**, auto-expose new tables **OFF** (project setting) — every private table must
  have RLS enabled explicitly in migrations and no direct anon/authenticated grants.

## 1. This is Pass 2 (backend/security port)

Authoritative plan: `docs/v2-blueprint/prompts/BACKEND_PORT_PROMPT.md` + `23_V2_BUILD_SEQUENCE.md`.
Port order: migrations → storage → auth/device → data layer → client-links + resolve edge fn →
provision/delete edge fns → maps. Preserve all 22 invariants in `20_SECURITY_INVARIANTS.md`.
Source of proven backend: `migration-kit/` (see its `MANIFEST.md`). Do **not** inspect the legacy
repo; the blueprint + migration-kit are the memory.

## 2. Architecture (as ported)

- **Tenancy:** every dealer = tenant keyed by text `dealer_id`. Real isolation = Postgres RLS
  anchored to `plotmap_current_dealer_id()`; client-side adapter filtering is "honest UI" only.
- **Core tables (from foundation scaffold):** `public.profiles` (id→auth.users, role, dealer_id,
  status, permissions, metadata; RLS on), `public.dealer_settings` (branding + billing/trial
  readiness: plan_code, subscription_status, account_status, trial_start/end, seat/map/property
  limits). Helper fns `plotmap_current_role()`, `plotmap_current_dealer_id()`, `plotmap_is_staff()`
  (SECURITY DEFINER, stable). Roles: owner/manager/team/map_editor/property_editor/viewer.
- **CRM data:** `crm_records` keyed by `entity_type` (property/customer/deal/demand/...) with
  dealer-scoped RLS; `__unresolved__` fail-closed dealer stamping.
- **Maps/presentation:** map overlays + append-only `presentation_events`.
- **Private Client Links:** token SHA-256 hashed (raw returned once), frozen client-safe snapshot
  (no seller/commission/notes), 15-min signed media via `resolve-client-link` edge fn, anon-RPC
  event tracking (rate-limited, idempotent). Grant-hardened (no direct table grants).
- **Storage:** private buckets `property-photos` + `client-link-audio` + path validators + RLS.
- **Edge functions (service-role only, never in browser):** `resolve-client-link`,
  `provision-dealer`, `delete-dealer`.
- **Frontend boundary (unchanged):** all UI goes through `v2/src/packages/data/contracts.ts`
  (`DataAdapterV2`). Pass 2 adds **real Supabase adapters** behind those interfaces; the mock
  adapter (`mock-adapter-v2.ts`) stays for dev/tests via an env switch.

## 3. Migrations ported (in `supabase/migrations/`, applied order)

Renamed to valid 14-digit timestamps preserving the proven legacy order (enforced files come
after their drafts, so the enforced definition wins):

| # | File | Purpose |
|---|---|---|
| 01 | `..000100_saas_foundation_scaffold` | profiles, helper fns, dealer_settings |
| 02 | `..000200_multi_dealer_isolation_draft` | base dealer-scoped RLS |
| 03 | `..000300_storage_photo_policies_draft` | base storage policy |
| 04 | `..000400_team_permissions_rls_draft` | base team scopes |
| 05 | `..000500_multi_dealer_rpc_setup` | isolation RPCs |
| 06 | `..000600_multi_dealer_anon_lockdown` | revoke anon table access |
| 07 | `..000700_phase4_account_gating_enforcement` | trial/active/expired/suspended gating |
| 08 | `..000800_phase5_property_photo_storage_policies` | enforced private photo storage |
| 09 | `..000900_team_role_rls_enforcement` | enforced team-role RLS |
| 10 | `..001000_developer_control_and_trial_analytics_draft` | dev control + trial analytics |
| 11 | `..001100_dealer360_analytics_draft` | analytics (+ secret-reject guard regex) |
| 12 | `..001200_one_click_dealer_provisioning` | provisioning saga RPCs |
| 13 | `..001300_auto_approve_device_activation` | device activation |
| 14 | `..001400_onboarding_access_and_dealer_deletion` | onboarding + deletion |
| 15 | `..001500_private_client_links` | client links + snapshot + media RPC |
| 16 | `..001600_private_client_links_grant_hardening` | grant lockdown |

Edge functions copied to `supabase/functions/{resolve-client-link,provision-dealer,delete-dealer}`.
Verification copied to `supabase/verification/{verify-isolation.js,verify-private-client-links.sql}`.

## 4. How to apply / verify (needs DB password — a secret)

`supabase` CLI v2.111 is installed; project is **linked** (`supabase/.temp` is gitignored).
Applying migrations needs the MAPCO-DEV **database password** (not stored, not in Git):

```bash
cd "C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO"
npx supabase db push                 # prompts for DB password; applies all 16 migrations
node supabase/verification/verify-isolation.js     # needs PLOTMAP_SUPABASE_* env
psql "$MAPCO_DEV_DB_URL" -f supabase/verification/verify-private-client-links.sql
```

## 4b. Base-schema reconstruction (important)

The migration-kit is INCREMENTAL and assumed a retired `supabase_setup.sql` base. On a fresh
project migrations 02+ failed with `relation public.crm_records does not exist`. Reconstructed
the missing base in `20260801000150_base_core_tables_and_client_safe_view.sql`:
`crm_records`, `presentation_events`, `prebuilt_maps`, `map_overlays` (RLS enabled, no permissive
policies — enforced migrations attach the real dealer-scoped policies) and the client-safe
`client_safe_properties` VIEW (projects only buyer-safe property columns; never price/seller/
commission/notes; `security_invoker=true`). Column contracts taken verbatim from the public read
RPCs in `000500_multi_dealer_rpc_setup` (status/client_visible/deleted, event id text, etc.).

## 5. Blockers / open items

- ~~DB password / MCP access~~ **RESOLVED:** the CLI's cached access token reaches MAPCO-DEV and
  `db push` applied all migrations with no password prompt. (MCP connector still can't; use the CLI.)
- **All 17 migrations applied + in sync on MAPCO-DEV** (000100→001600), verified via
  `supabase migration list --linked`.
- Not yet done: live RLS isolation run (`verify-isolation.js` needs anon+service keys + 2 dealers);
  Storage buckets not yet created; edge functions not yet deployed; real Supabase adapters behind
  `DataAdapterV2` not yet written; seed data pending.
- Secrets: anon key (publishable) can go in a gitignored `v2/.env` for the frontend; **service-role
  key must live only in edge-function env**, never in Git/frontend.

## 5c. Real adapter layer (DONE this session)

- `@supabase/supabase-js` added (runtime dep; dynamically imported so mock bundles stay lean).
- `packages/data/supabase/client.ts` — singleton client; **rejects service-role/`sb_secret_` keys**
  and non-`*.supabase.co` URLs (invariant #5); reads `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`.
- `packages/data/supabase/supabase-adapter.ts` — implements the full `DataAdapterV2`: properties/
  customers/deals/demand over `crm_records` (dealer-scoped by RLS), demand matching (deterministic),
  demand signals from `presentation_events`, maps via `prebuilt_maps`+`map_overlays`, presentation
  events via `plotmap_record_presentation_event`, client links via `plotmap_list_client_links` /
  `plotmap_resolve_client_link` (client-safe payload), media via private-storage signed URLs, auth/
  account-state from session + `dealer_settings`. Never throws — always typed `Result`.
- `packages/data/adapter.ts` — **mode switch** `VITE_DATA_MODE=mock|supabase` (mock default). All 13
  screen imports re-pointed to this entry; tests updated. `.env` gitignored, `.env.example` added,
  anon key stored locally only.
- Storage: `property-photos` + `client-link-audio` buckets created **private** (`20260801002000`).
- Seed: `dealer-demo` settings + map + 3 properties / 2 clients / 2 deals / 2 demand (`20260801002100`).
- Gate: `tsc` clean, **72/72 tests pass**, build OK (supabase-js in its own lazy chunk).

## 6. Next steps

1. **Create a demo auth user** (dealer-demo) to read seeded rows — needs the **service-role key**
   (admin API). Provide it as an env secret or run the admin script; then Supabase mode reads live data.
2. Run `verify-isolation.js` + `verify-private-client-links.sql` (dealer-A/dealer-B) — needs 2 users.
3. Deploy edge functions with env (URL, anon key, **service-role key**, origins).
4. Wire login UI + device-activation RPCs into the real auth repo (currently session-based only).
5. NEXT MILESTONE: map database linking (properties↔sectors↔overlays↔prebuilt_maps) — see §7.

## Status log

- **2026-07-31 (session 1):** Verified MAPCO-DEV identity via CLI; `supabase init` + `link` done.
  Ported all 16 proven migrations (valid 14-digit order) + edge functions + verification scripts.
- **2026-07-31 (session 1, cont.):** Applied migrations to MAPCO-DEV via `supabase db push` (CLI
  cached token — no password prompt). Hit the missing-base gap; authored
  `20260801000150_base_core_tables_and_client_safe_view.sql`. **All 17 migrations now applied +
  in sync on MAPCO-DEV.**
- **2026-07-31 (session 2):** Built the real Supabase adapter layer behind DataAdapterV2 (client +
  service-role rejection + full adapter + mode switch), added `@supabase/supabase-js`, created private
  Storage buckets + demo-dealer seed (both applied to MAPCO-DEV), gitignored `.env` with anon key.
  tsc clean, 72/72 tests, build OK. **Remaining:** demo auth user + live isolation run (service-role),
  edge deploy, login/device UI wiring. Then the map-linking milestone (§7).

## 6b. Live verification (session 3) — 23/23 PASS

Run: `node v2/scripts/backend-verify.mjs supabase/.env` (reads gitignored `supabase/.env`;
prints only PASS/FAIL, never secrets). Created demo users `demo-owner`/`demo-team`/`b-owner`.
- **Auth:** real email/password login issues sessions (owner, team, dealer-b). ✓
- **Data:** demo owner reads its seeded properties in Supabase mode. ✓
- **Isolation (RLS):** dealer-b sees only its own rows; neither dealer sees the other; cross-tenant
  fetch-by-id returns nothing; team member is tenant-isolated too. ✓ (the core security property)
- **Account state:** demo dealer reads its trial `dealer_settings`. ✓
- **Storage:** `property-photos` is PRIVATE; 15-min signed URL works; anon direct download blocked. ✓
- **Client links:** create→64-hex token (once); anon resolve→valid snapshot; price-hidden hides price;
  snapshot carries NO commission/seller/notes/internal fields; revoke→revoked; expiry→expired. ✓
- **Roles:** team member has staff read but is not a platform admin. ✓
- **Fix applied:** `20260801002200_service_role_grants.sql` (service_role backend grants — the kit
  assumed Supabase defaults not applied to migration-created tables). Adapter `resolve()` corrected
  to the real `{ok,reason,link}` envelope + client-safe snapshot mapping.

**Edge functions:** all three deployed to MAPCO-DEV — `resolve-client-link` (`--no-verify-jwt`,
smoke-tested live: junk token → `{"ok":false,"reason":"invalid"}`, no crash/leak), `provision-dealer`,
`delete-dealer` (JWT-verified). Origin allowlists set as function secrets. Supabase auto-injects the
service-role key into the edge runtime (never in Git/frontend).

**Frontend gate:** tsc clean, 72/72 Vitest, build OK (mock still default).

Remaining before "production-real": wire the login + device-activation UI onto the real auth repo;
exercise the edge media broker on a live valid token; broader role-matrix coverage. None block the
map-linking milestone.

## 6c. Map linking phase (session 4) — DONE, 32/32 live PASS

Migrations `20260801002300_map_linking` + `..002400_authenticated_published_maps`:
- **Schema:** `prebuilt_maps` extended with `parent_map_id` (sector→masterplan), `area`,
  and an `assets` bundle (`{original,threeD,overlay}` = storage path + w/h). Map states:
  `draft|published|hidden|archived` + `client_visible`.
- **Relationships:** masterplan ↔ sector via `parent_map_id`; properties link via payload
  `masterplanId`/`sectorMapId` + normalized 0–1 `mapPlacement{mapId,x,y}`.
- **Dealer RPCs (Map Studio):** `plotmap_upsert_map`, `plotmap_set_map_status`,
  `plotmap_link_property_to_map`, `plotmap_dealer_maps` (all states) — SECURITY DEFINER,
  re-check dealer + `plotmap_can_edit_maps/properties`. Presentation read:
  `plotmap_published_maps` / `plotmap_published_overlays` (authenticated, published+visible only).
  Kept the deliberate anon device-gating (did NOT re-grant the revoked raw anon RPC).
- **Storage:** public `maps` bucket (rasters aren't secret; only published maps surface).
- **Assets onboarded (vertical slice):** New Chandigarh masterplan+overlay, Mohali
  masterplan+3D+overlay+Sector-90-91, uploaded to `maps/` and created via the dealer RPCs;
  properties `ecocity`/`omx` placed on the NC masterplan.
- **Adapter:** `SupaMaps` now reads through the RPCs (RLS-safe); `rowToMapMeta` maps the
  asset bundle → `MapData` (raster, dims.original/threeD).
- **Verified live (backend-verify.mjs, 32/32):** upload, dealer CRUD, parent link, property
  place, Map-Studio-lists-all, presentation-published-only (draft excluded), archive hides,
  cross-dealer edit blocked.

**Also this session:** violet-dusk background deepened (`#f5efff`→`#e7ddfb` + stronger violet
bloom) in dealer/team shells + tokens (founder: "too white"). Presentation perf: removed the
regressed render-blocking CDN font/icon `<link>`s from `app/plotmap/index.html` (self-hosted
already loaded via JS), added preconnect to Storage + preload of the first masterplan + fonts.
Map library inventory → `v2/MAP_LIBRARY_INVENTORY.md` (170 source files, per-city coverage).
Frontend gate: tsc clean, 72/72 tests, build OK; presentation browser-verified (0 CDN links,
masterplan loads, no console errors).

## 6d. Full-library onboarding (session 5) — 36/36 live PASS

- **`v2/scripts/onboard-maps.mjs`** — dependable batch onboarder. Classifies every source
  file (city via typo-tolerant rules + project→city fallback; masterplan/sector/project; render
  original/threeD/overlay), groups renders into one map, dedupes across folders (prefers the
  annotated `maps with svg` original), reads PNG/JPEG intrinsic dims, uploads to Storage
  `maps/<city>/<map>-<render>.<ext>` (idempotent), and registers `prebuilt_maps` via admin
  (masterplans published, sectors draft, `parent_map_id` = city masterplan). `--dry` / `--cities=` /
  `--all`. Every skip reported with a reason.
- **Result:** 83 maps on MAPCO-DEV (11 masterplans published, 72 sectors), 143 assets uploaded,
  0 failures, 0 orphan sectors, 0 masterplans missing dims. Only 2 files skipped (no city token).
- **Harness:** backend-verify.mjs now includes a library-integrity block → 36/36.
- See `v2/MAP_LIBRARY_INVENTORY.md` for per-city results + skip reasons + minor cleanup note.

## 6e. Presentation catalog integration (session 6) — DONE, browser-verified

- **Manual overrides** for the 2 previously-skipped files (Chandigarh Sector 16, Aerocity
  Sector 83), remembered in `onboard-maps.mjs` `OVERRIDES` → idempotent, **0 skips**. Both
  connected to their correct parent masterplans.
- **Catalog bridge** (`maps/registry.ts`): `mapEntryFromData()` (backend `MapData`→engine
  `MapEntry`; skips missing raster / zero dims — never distorts) + `registerMaps()` (additive,
  idempotent, **never replaces a locked pilot id**). `MapData` extended with `assets`
  (original/threeD/overlay URLs) + `parentMapId` + `area`; adapter populates them.
- **Presentation wired** (`apps/presentation/main.ts`): `loadCatalog()` merges the real
  Supabase catalog into the engine registry after the initial paint; the **map picker is now
  grouped by city → masterplans → sectors** (scrollable); load-failure shows a glass message.
  The locked masterplan stays the default (activeMapId unchanged).
- **Browser-verified (supabase mode, live MAPCO-DEV, dealer session):**
  picker shows 7 cities / 9 published masterplans, **72 draft sectors excluded** (published-only);
  locked masterplan unchanged as default; selecting a DB map renders from **Storage**;
  **Original↔3D switching** loads distinct rasters; 6× repeated switching stays stable with a
  **single active image** (no leak); **zero console errors**. Mock mode still works.
- **Cleanup:** legacy `map-*` test records removed; verify harness self-cleans. Catalog = 81 maps,
  9 published masterplans, 72 draft sectors.
- **Tests:** +8 bridge unit tests (`tests/catalog.test.ts`) → **80/80**; live **36/36**.

## 6f. Map Studio + dealer login + Vercel setup (session 7) — DONE

- **Dealer login/session** (`packages/data/session.ts`): real Supabase email/password
  (`signIn`/`signOut`/`getSession`) + `requireSession()` gate. In supabase mode the dealer
  app shows a login card until signed in; mock mode passes straight through. Wired into
  `apps/team/main.ts` + `apps/dealer/main.ts`. `?signout` on any dealer URL clears the session.
  This is what makes the deployed app usable end to end.
- **Map Studio data layer** (`packages/data/map-studio.ts`): `getMapStudio()` → Supabase repo
  over the real RPCs (`plotmap_dealer_maps` / `_set_map_status` / `_link_property_to_map`) with a
  mock fixture fallback. Throw-free.
- **Map Studio UI** (`apps/team/pages/map-studio.ts`, route `/admin/map-studio.html`): two-panel
  studio — left tree grouped by **city → masterplan → sector** with state chips + state filter;
  right detail with **Original/3D/overlay preview** (overlay overlaid on the raster for alignment
  checks), **asset checklist** (missing-asset + unknown-dimension flags), parent-masterplan link
  (flags orphan sectors), **Publish / Hide / Archive / Restore**, and **Link a plot + Place pin**
  (click-to-drop normalized 0–1 coordinate). Low-jargon copy; delegated listeners; violet tokens.
- **Verified (data level, real dealer session):** dealer maps list (all states); publish a draft
  **sector → it appears in `plotmap_published_maps`** (would show in the presentation); link+place a
  property (placement persisted); reverted cleanly. Existing live suite still 36/36.
- **Vercel setup for self-serve visual testing:** `v2/vercel.json` (Vite build, security headers,
  `/client` noindex/no-referrer) + `v2/DEPLOY_VERCEL.md` (dashboard + CLI paths, Root Dir `v2`,
  env vars incl. `VITE_DATA_MODE=supabase`, demo login + `?signout`). Service-role key never in
  the browser/Vercel env by design.
- Gate: tsc clean, **80/80 tests**, build OK (13 HTML entries in dist). No secrets committed.

## 6g. Dealer pages stuck/blank in supabase mode — FIXED (session 8)

Symptom: after login on the deployed build, Dealer Home stuck on "Loading…", Client Links blank.
Diagnosis (deployed/supabase mode, real dealer session): the raw REST/RPC calls responded fine
(~360ms) but the adapter methods hung with **no network request and no error** — while the
presentation (which never calls `getSession()`) worked in the same build+session. Root causes:

1. **Auth-lock deadlock (the hang).** `requireSession()` called `supabase.auth.getSession()`
   before the page's data calls, deadlocking supabase-js's `navigator.locks` auth lock so every
   later `.from()/.rpc()` hung forever. **Fix:** gate on the persisted `sb-<ref>-auth-token` in
   localStorage directly (no `getSession()`), and **reload after login** so data calls run on a
   clean page — the same pattern the working presentation uses. Also pass a no-op `auth.lock` to
   the client as defence-in-depth (`packages/data/supabase/client.ts`).
2. **Client-links shape mismatch (the blank Links page).** `clientLinks.list` cast the list RPC
   output (`{label,propertyCount,events:{...}}`) straight to `ClientLink`, so `getInitials(link.
   clientName)` threw. **Fix:** proper mapper (label→clientName, events remap, `propertyCount`,
   expiry from `expiresAt`); `ClientLink` gained `propertyCount?`.
3. **Empty-data crash (Home).** The donut read `stats.segs[0].pct` with 0 `presentation_events`
   → threw. **Fix:** guard `segs[0]?.pct ?? 0` / `?? 'No activity yet'`.
4. **Robust states.** Home now handles loading / success / empty / **session-expiry** (`unauthorized`
   → "Sign in again" via `?signout`) / error, with a 12s hard-timeout safety net and a render
   try/catch. No permanent loading screens.

Browser-verified in supabase mode with a real dealer session: **Home, Client Links, Properties,
Deals, Customers all render real data**, no console errors, navigation + refresh work. Mock mode
still works; tsc clean; **80/80 tests**; build OK.

## 6h. Full Screen mode (session 8) — DONE

- `packages/ui/fullscreen.ts`: reusable Fullscreen API control. `mountFullscreenButton(host,
  {variant:'bar'|'floating', onResize})` — syncs button state via the `fullscreenchange` event
  (so **Esc** updates it), calls `onResize` on the next frame, single set of listeners + cleanup,
  graceful fallback when the API is unavailable. `toggleFullscreen`/`isFullscreen`/`fullscreenSupported`.
- Wired into the **dealer shell** header (top-right "Full Screen"/"Exit Full Screen" pill) and the
  **Client Presentation** (compact floating glass square, top-right) where `onResize` calls
  `engine.resize()` so cover-fit recomputes; the pin/highlight rAF loop follows automatically.
  Browser-verified: both buttons render, aria labels correct, no errors. (True fullscreen needs a
  real user gesture — verify on the deploy.) No PWA/offline added, per spec.

## 6i. Real SVG highlight system + Aerocity recovery + perf (session 9) — DONE

Built the real authored-SVG highlight system and removed the fake rectangle highlights and the
old "new chd" placeholder default. Founder decisions applied: **default hero = Mohali**, **merge
Aerocity** (single map from the aligned aerotropolis pair), non-aligned cities **shown with
highlights disabled**.

**Data (MAPCO-DEV).** `v2/scripts/relink-aligned-maps.mjs` connected the newly ALIGNED
raster+SVG pairs (viewBox === raster → 1:1, zero offset) to `chandigarh/mohali/new-chandigarh-master`
and reused the proven `aerotropolis-overlays.svg.svg` (+ `aerotropolis-original.png.png`,
4599×3069) as `aerocity-master`; retired the duplicate `aerotropolis-master`; wrote
`payload.calibration` per map. Non-aligned masterplans (Zirakpur/Panchkula/Derabassi/Kharar) had
their old mismatched overlay stripped and calibration set to `unavailable`. Live verify
`v2/scripts/verify-highlights.mjs` (signs in as demo owner, reads `plotmap_published_maps`, fetches
each SVG) → **31/31 PASS**.

**Engine + package.** New `packages/maps/svg-overlay.ts` — fetches + sanitizes the authored SVG,
injects it INLINE, classifies real groups into broad sets (roads/sectors/places), exposes
individual spotlight + fuzzy search, hides on 3D. `MapEntry` gained `overlay` + `calibration`;
`mapEntryFromData` no longer flat-renders the SVG (raw strokes never show). Added
`MapEngine.focusOn(rect)` to gently center a spotlighted sector. Calibration flows
`payload.calibration` → adapter `rowToMapMeta` → `MapData.calibration` → `MapEntry`.

**Presentation (`apps/presentation/main.ts`).** Fully catalog-driven (no pilot placeholder); default
Mohali. Removed the fake `HIGHLIGHT_SETS`. Highlights control shows real broad-set chips + a sector
search/list, or a clean **"Alignment pending"** state when uncalibrated. Highlight STATE persists
across Original↔3D↔Original, zoom, pan, and opening/closing detail; the SVG is hidden on 3D and
restored on Original. Property-linked highlighting: "Masterplan"/pin switches to the property's
linked map and spotlights its sector; "On masterplan" returns from a sector to its parent.
Pins are BLUE and come ONLY from real `mapPlacement` (unplaced plots show "Not on map"). Visual
language: roads cyan, sectors gold, places amber, pins blue.

**Perf.** Removed the presentation's N+1 pin load (was `listRegistry` + `adapter.maps.get` per map,
~9–100 RPC round-trips, several returning the full catalog) — pins now derive from already-loaded
property placements; the catalog loads in a single `plotmap_published_maps` call. The old placeholder
raster preload + `public/assets/newchandigarh-map.png` were deleted.

**Product hardening.** Reusable `packages/ui/back-button.ts` (history-first, safe same-origin only,
logical fallback, accessible). Wired: Client Presentation (in-chrome Back — closes overlays first,
never exposes dealer routes to clients), dealer shell (subpages → Dealer Home, in-shell so
fullscreen is preserved), Map Studio (→ prev/Dealer Home), Developer Control (→ prev/Dealer Home).
Fullscreen module re-reviewed against spec (label toggle, Esc sync, onResize, single listeners) — OK.

**Gate.** tsc clean, **81/81 Vitest**, `vite build` OK (13 entries). Browser-verified in mock mode:
default Mohali, Back on subpages (hidden on home), Original↔3D hides/restores the highlights control,
grouped picker with no placeholder, **zero console errors**. Highlight alignment confirmed in-browser
against the live public overlay (raster 1603×1278 === viewBox, 80 sector shapes, sector 66 bbox
inside frame). Final on-screen visual approval is the founder's (supabase mode, real login).

## 7. NEXT MILESTONE — Client Presentation highlight system + SVG calibration (full spec captured)

> **Status: implemented in §6i above.** The spec below is retained for reference.


Founder spec (2026-08-01), to build next. Do NOT enable highlights while misaligned.

**Model:** one map record = Original rendering + 3D rendering + a **transparent SVG highlight
overlay** (the authored geometry — `<g id="sectors">` + road groups; 106 sector `<path id="<num>">`).
Never redraw/approximate shapes. Raster + SVG overlay + pins must always share ONE synchronized
transform (the existing `cssMapTransform`), across Original↔3D, zoom, pan.

**Calibration FIRST (per-map, reusable):** SVG viewBox 1575×1132 vs raster 1603×1278. Compute
scale + x/y offset from shared landmarks/boundaries (account for cropping/margins; preserve aspect;
NOT independent width/height stretch). Apply BEFORE the engine zoom/pan transform. Store calibration
metadata per map; add a Map Studio calibration control + a geometry-match status
(calibrated / needs-review / unavailable). Verify at top-left, centre, bottom-right, roads, sector
boundaries. **Only activate highlights when `calibrated`;** else show raster normally and disable the
Highlights control with an "Alignment pending" state. Only show the overlay on a 3D rendering when its
geometry is verified-aligned; otherwise keep the highlight on Original. **Calibrate New Chandigarh first.**

**Two highlight levels:** (1) broad A/B/C sets from the SVG's real authored groups (roads /
sectors-blocks / places); (2) individual sector or linked-property spotlight (exact SVG polygon +
real normalized property pin). Search/tap a sector (Sector 66/83, Eco City, Block 5); select a property
→ open its linked masterplan/sector, activate the sector polygon, show its pin, gently focus; return
from a sector to its parent masterplan. **Highlight state persists** across Original↔3D↔Original, zoom,
pan, opening/closing property detail. Never invent a pin coordinate for an unplaced property.

**Visual language:** roads = cyan/glass glow; sectors/blocks = gold lift; landmarks = amber frame;
property pins = blue. Preserve the approved map layout, cover-fit, and current map-engine geometry.

The linked model + Map Studio RPCs + Storage are proven. Next:
1. **Batch-onboard the rest of Tri-City** (see `v2/MAP_LIBRARY_INVENTORY.md`): a script that
   uploads each city's masterplan/3D/sector/overlay to `maps/` and calls `plotmap_upsert_map`.
2. **Wire the presentation map picker to `adapter.maps`** in supabase mode (currently the static
   engine registry drives the locked masterplan render; bridge the catalog without changing the
   locked cover-fit / `cssMapTransform` math).
3. **Map Studio UI** on the dealer side (list/create/publish/hide/link/place) calling the new RPCs.
4. Device-gated buyer map reads (`plotmap_client_maps_for_device`) once device-activation UI lands.
Locked Masterplan visual + engine math stay frozen throughout.

## 7-old. (superseded) map database linking prep

Kept deliberately out of this phase. The data is prepared for it:
- `prebuilt_maps` (registry: masterplan/sector, city/sector, raster, dims, status, client_visible).
- `map_overlays` (marks/highlight sets, `map_id` FK-by-convention, payload.marks, status/client_visible).
- Properties carry `mapPlacement {mapId,x,y}` (normalized 0–1) in their payload; the presentation
  already reads pin positions via `adapter.maps.listRegistry` + `adapter.maps.get`.
Starting point next session: (a) author dealer-side map CRUD RPCs/policies for `prebuilt_maps` +
`map_overlays` (currently only public read RPCs exist); (b) a linking model connecting
property → sector map → masterplan region; (c) migrate the map-engine registry to read
`adapter.maps` in Supabase mode; (d) onboard the real map library. Keep the locked Masterplan
visual + engine math unchanged.
