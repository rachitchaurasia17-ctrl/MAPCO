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

## 5. Blockers

- **DB password required** to `db push` + run verification against MAPCO-DEV (secret — user must
  supply or run push locally). The Supabase **MCP connector cannot reach MAPCO-DEV** (scoped to
  the PROPERTY org); the **CLI cached access token can** (verified via `supabase projects list`).
- Migrations not yet applied/validated on the live dev DB (pending password).
- Real Supabase adapters behind `DataAdapterV2` not yet written (next phase).

## 6. Next steps

1. Apply migrations (`db push`) once password available; fix any fresh-DB ordering issues.
2. Run both verification scripts; confirm dealer-A/dealer-B isolation + client-link security.
3. Configure Storage buckets (private) + confirm not-public.
4. Write typed Supabase adapters (`packages/data/supabase-adapter*`) behind DataAdapterV2, env
   switch `VITE_DATA_MODE=mock|supabase`; keep mocks default for tests.
5. Deploy edge functions to MAPCO-DEV with env (URL, anon key, service-role key, origins).
6. Seed data for a demo dealer; integration + RLS security tests; tsc/tests/build.

## Status log

- **2026-07-31 (session 1):** Verified MAPCO-DEV identity via CLI; `supabase init` + `link` done.
  Ported all 16 proven migrations to `supabase/migrations/` (valid 14-digit order), edge functions,
  and verification scripts. Secret-scanned (only the reject-guard regex present). Brief created.
  **Blocked on DB password** to apply + verify on MAPCO-DEV.
