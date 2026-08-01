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

## 7. NEXT MILESTONE — Map Studio UI + remaining polish

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
