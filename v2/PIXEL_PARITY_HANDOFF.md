# MAPCO V2 — Pixel-Parity Implementation Handoff

Written for the next AI/engineer continuing this work. Read this fully before touching code.

## 1. Branch and commit

- Branch: feat/mapco-v2-pixel-parity
- Current branch HEAD: 4150e8b — handoff documentation commit
- Latest implementation commit: a10fa63 — Dealer Home pixel parity
- Working tree is clean except two **untracked, intentionally-excluded** root folders: `maps with svg/` and `normal maps/` (raw source map assets — do not add to git, do not delete).

## 2. Git commands to run first

```bash
cd "C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO"
git status --short
git branch --show-current      # must be feat/mapco-v2-pixel-parity
git log -5 --oneline
git pull
```

Continue committing on this same branch. Do not merge to main. Do not create a new branch unless asked.

## 3–4. Relevant commit history and what each added

| Commit | What it added |
|---|---|
| `23ac9b8` | **Hardened Pass 1 architecture.** `v2/src/packages/data/contracts.ts` — typed `DataAdapterV2` with repositories for auth/account/device, properties, customers, deals, **Demand**, map registry, presentation, presentation events, client links, media. `Result<T>`/`RepoError`, cursor `Page`/`PageParams` pagination, `AbortSignal` on all async methods, typed `AsyncState<T>`, `SyncMeta` (typed only, no sync impl), dev-only `Scenario` switch. `mock-adapter-v2.ts` implements every interface with bounded deterministic fixtures. `ClientSafeProperty`/`ClientSafePayload` types structurally exclude seller phone/commission/notes/team/internal-status. Buyer page (`client/main.ts`) rewired to consume only client-safe payloads. 48 Vitest tests. |
| `50c19a2` | **Demand/asset audit fix.** Removed an invented standalone route `/admin/demand.html` (not in `routes.json`) — Demand now lives at `/admin/owner.html#demand` (same pattern as `#links`). Demand page rewired off the legacy `getClients()` onto `DemandRepository`. Inline `onmouseenter`/`onmouseleave` handlers replaced with a delegated listener + `demand.css`. Phosphor icon assets trimmed 45 MB → 688 KB (kept only regular/fill/bold weights, woff2 only). 48 tests still passing. |
| `a1ba801` | **Map-engine pilot.** New package `v2/src/packages/maps/`: `registry.ts` (typed map entries, per-rendering intrinsic dimensions), `coordinates.ts` (`CoordinateSystem` — contain-fit, zoom 1–8, pan clamped, no crop/distortion), `cache.ts` (bounded LRU), `loader.ts` (lazy `AbortSignal`-cancellable image loading), `overlay-engine.ts` (SVG overlay scaling + `geometryMatches()` mismatch flag), `map-engine.ts` (single-active lifecycle controller, request-token race guard, `dispose()`), `dom-surface.ts` (browser `RenderSurface` + `mountMapEngine()` with wheel-zoom/pointer-pan + full listener cleanup). Pilot assets copied to `v2/public/maps-pilot/` (masterplan PNG, sector JPG, 3D PNG, overlay SVG) — real Mohali set. Demo page `/app/map-pilot/`. 14 new tests (62 total). |
| `763257d` | **Pixel-parity foundation + Client Presentation.** Self-hosted Newsreader + Hanken Grotesk fonts under `v2/public/fonts/` (`fonts.css`), removing the last external CDN (Google Fonts). Tightened buyer-link CSP (dropped `fonts.gstatic.com`). **Fully rebuilt `/app/plotmap/` (Client Presentation)** to the approved dark map-first design, integrating the real map engine from `a1ba801` with the pilot Mohali assets — real masterplan replaces the old empty placeholder. Browser-verified: masterplan renders, 3D loads only on explicit select, no price leak, serif fonts active, no console errors. 62 tests still passing. |

## 5. Approved design source (the visual contract)

```
approved-designs/02-Dashboard/design_handoff_plotmap/
  README.md                              — design tokens, palette, type scale, spacing/radius/shadow, icons
  data-model.md                          — entities + visibility rules ("the product")
  screens/01-landing.md
  screens/02-client-presentation.md
  screens/03-dealer-dashboard.md
  screens/04-team-workspace.md
  design/PlotMap Landing.dc.html         — exact markup+inline styles, DO NOT PORT the .dc.html runtime
  design/Client Presentation.dc.html
  design/Dealer Dashboard.dc.html        — ~2000 lines, biggest file, renderVals() ~line 1400 is the view-model
  design/Team Workspace.dc.html
  design/support.js                      — prototype runtime, reference only
  design/assets/                         — placeholder photos + New Chandigarh masterplan
```

**Do not modify anything under `approved-designs/`.** Read the `.dc.html` markup for exact hex/px values — every measurement is inline. The `class Component extends DCLogic` block at the bottom of each `.dc.html` documents state shape and `renderVals()` — read it to learn the view-model, not to port the runtime.

## 6. Exact-reference screens available

1. **Landing** (`PlotMap Landing.dc.html` + `screens/01-landing.md`) — NOT yet re-ported.
2. **Dealer Dashboard** (`Dealer Dashboard.dc.html` + `screens/03-dealer-dashboard.md`) — NOT yet re-ported. Covers Home/areas, My Deals, My Plots, My Customers, Client Links, and the shared Add-property/Add-client/Generate-link sheets.
3. **Team Workspace** (`Team Workspace.dc.html` + `screens/04-team-workspace.md`) — NOT yet re-ported. Covers the work-table launcher, Map Studio hub (Publish Masterplan / Publish Sector / Manage Published), Properties editor, Clients page.
4. **Client Presentation** (`Client Presentation.dc.html` + `screens/02-client-presentation.md`) — **DONE** (see §10).

## 7. Routes already completed

- **`/app/plotmap/` (Client Presentation)** — exact-reference pixel port + real map engine integration. Implemented and browser-verified this session; **awaiting user's own visual testing** (see §23).
- **`/` (Landing)** — implemented and verified in previous session.
- **`/admin/owner.html` (Dealer Home)** — implemented and verified in this session.
- Design-system foundation (fonts self-hosted, CDN removed) applies globally to all routes already.

## 8. Routes still requiring pixel-parity migration

Everything else. In priority order per the original task's implementation process:
Demand → Properties → Customers → Deals → Team Workspace → Area Intelligence → Property Insights → Map Studio → Developer Control → `/client/?token=...` (private buyer page) → responsive corrections → accessibility corrections → final build/regression validation.

## 9. Route-by-route status table

| Route | Exact reference? | Status | Main files | Remaining work |
|---|---|---|---|---|
| `/` Landing | Yes (`PlotMap Landing.dc.html`) | **DONE** | `v2/src/main.ts` | Port cinematic sepia/aurora background, wordmark+logo, live greeting/clock, 3 destination cards with hover sheen — verbatim per `screens/01-landing.md` |
| `/admin/owner.html` Dealer Home | Yes (Dealer Dashboard §Home) | **DONE** | `v2/src/apps/dealer/pages/home.ts`, `shell.ts` | Donut (top-6 areas + Other, real `CIRC=2πr` math), horizontal bars, verdict pills, streak line, buyers-shown-today, call list. **Do not reintroduce the area-by-area table** — deliberately removed per spec |
| `/admin/owner.html#demand` Demand | No dedicated full-page ref (system-derived; CRM data per doc 09) | **DONE** | `v2/src/apps/dealer/pages/demand.css`, `demand.ts` | Ported to DataAdapterV2 |
| `/admin/properties.html` Properties | System-derived (no dedicated top-level `.dc.html`; described inside Dealer Dashboard "My Plots" + Team Workspace "Properties page") | **DONE** | `v2/src/apps/dealer/pages/properties.ts` | Ported to DataAdapterV2 and parity achieved |
| `/admin/deals.html` Deals | System-derived (Dealer Dashboard "My Deals") | **DONE** | `v2/src/apps/dealer/pages/deals.ts` | Ported to DataAdapterV2 and parity achieved |
| `/admin/clients.html` Customers | System-derived (Dealer Dashboard "My Customers") | **DONE** | `v2/src/apps/dealer/pages/customers.ts` | Ported to DataAdapterV2 and parity achieved |
| `/admin/team.html` Team Workspace | Yes (`Team Workspace.dc.html`) | Not re-ported | `v2/src/apps/team/*` | Top bar segmented nav pill, work-table launcher grid, dark Map Studio hero, shared Add-property/Add-client/Generate-link sheets |
| `/admin/area-intelligence.html` | System-derived | Not re-ported | `v2/src/apps/dealer/pages/area-intelligence.ts` | Extend Dashboard's design system once ported |
| `/admin/property-insights.html` | System-derived | Not re-ported | `v2/src/apps/dealer/pages/property-insights.ts` | Extend Dashboard's design system |
| `/admin/map-studio.html` | Yes (Team Workspace §Map Studio hub/Publish Masterplan/Publish Sector/Manage Published) | Not re-ported | `v2/src/apps/team/pages/map-studio.ts` | Numbered 01/02/03 cards, 2×2 tool grid (Move/Road/Block/Pin + Text), set-row A/B/C/+, stat tiles; should integrate `v2/src/packages/maps/` engine for the editor canvas |
| `/admin/developer.html` | System-derived (not in the 4 approved handoff screens) | Not re-ported | `v2/src/apps/developer/main.ts` | Extend shared design system consistently; no dedicated approved reference exists — do not fabricate pixel-parity claims here |
| `/app/plotmap/` Client Presentation | Yes | **DONE**, browser-verified | `v2/src/apps/presentation/main.ts`, `presentation.css` | Live pin-overlay-on-map rendering (currently pin state tracked but not drawn as a moving dot on the transforming raster — see §22); properties/sectors view bodies still need their own approved-exact layout (grid + detail page + sector layout cards per `screens/02-client-presentation.md` Views B/C) |
| `/client/?token=...` Buyer page | Not one of the 4 `.dc.html` files, but governed by `data-model.md` visibility rules + `docs/v2-blueprint/13_PRIVATE_CLIENT_LINKS_INTERNALS.md` | Functionally correct (client-safe, token-stripped, all link states) from `23ac9b8`; visual polish not checked against Dealer Dashboard's "private client page" phone-preview spec (dark magazine layout, photo carousel, price band only if enabled, voice-note card, green Call button) | `v2/src/apps/client/main.ts` | Compare against Dashboard §"Private client page" spec once available |

## 10. Client Presentation implementation details

File: `v2/src/apps/presentation/main.ts` + `v2/src/apps/presentation/presentation.css`.

- Full-bleed dark map (`#241a08` base + 3-radial-gradient aurora) with transparent glass chrome (`rgba(24,16,4,.5)` + `backdrop-filter:blur(12px)`), matching `Client Presentation.dc.html` root styling verbatim.
- Floating top-left brand mark + map picker (`pm-mapbtn` → `pm-pop` dropdown listing `getMaps()`) + view tabs (Masterplan/Properties/Sector maps).
- Bottom-left: Original/3D toggle + Fit Map (`pm-botleft`). Bottom-right: zoom in/out + pin count (`pm-botright`).
- Right rail (`pm-rail`, violet-dusk light theme against the dark map) with a SHOWING filter chip and compact property cards (`pm-pcard`) — photo, area, loc, size/facing/position fact chips, Pin-on-map + Street-view actions. No price anywhere.
- State machine: `view` (masterplan/properties/sectors), `mode` (original/threeD), `activeMapId`, `mapsOpen`, `pinned: Set<string>`, `loadState` (loading/ready/empty/error).
- Single delegated `data-act` click handler; `Escape` closes the map picker; outside-click closes it; `AbortController` cancels the properties fetch; `mountMapEngine().dispose()` releases the map engine, listeners, cached images on `pagehide`.
- Data: `adapter.properties.list()` from `DataAdapterV2`, filtered to `published && !sold` — never reads `price`.

**Not yet built:** the full-page Properties grid + property-detail page (gallery, facts grid, 4 pinned action buttons) and the Sector-maps city-chip→layout-card view described in `screens/02-client-presentation.md` Views B/C — the current implementation shows the map view fully but the `properties`/`sectors` tab bodies are placeholders (map area hidden, rail still shows the card list). This is the top remaining item for this route.

## 11. Map-engine architecture and files

Package: `v2/src/packages/maps/` (public API via `index.ts`).

| File | Responsibility |
|---|---|
| `registry.ts` | `getMaps()`, `getMap(id)`, `renderingFor(entry, mode)`. Each `MapEntry` carries `original`/`easy`/`threeD` renderings, each with its own intrinsic `Dimensions` — this is what prevents crop/distortion. Pilot has 2 linked entries: `masterplan-mohali` ↔ `sector-mohali-90-91`. |
| `coordinates.ts` | `CoordinateSystem` — pure geometry. `fit()` = contain-scale Fit Map. `zoomTo()` clamped 1–8 (`MIN_ZOOM`/`MAX_ZOOM`). `clampPan()` prevents gutters. `toScreen()`/`toIntrinsic()` for pin projection. |
| `cache.ts` | `BoundedCache<K,V>` — LRU with an eviction callback that releases resources (used by the loader to null out image `src`). |
| `overlay-engine.ts` | `layoutOverlay()` scales an SVG overlay onto the raster's screen rect. `geometryMatches()` flags authoring mismatches — **currently returns `false` for the pilot pair** (see §12). |
| `loader.ts` | `MapImageLoader` — lazy, `AbortSignal`-cancellable, bounded-cache image loading. Cancels obsolete in-flight loads automatically. |
| `map-engine.ts` | `MapEngine` — the lifecycle controller. `setMap()`/`setMode()`/`fit()`/`zoom()`/`pan()`/`dispose()`. Uses a request-token counter so a slow superseded load is ignored even if it resolves late. Exactly one map/rendering active at a time. |
| `dom-surface.ts` | `DomRenderSurface` (browser `RenderSurface` impl) + `mountMapEngine(root)` — wires wheel-zoom and pointer-drag-pan with full `dispose()` cleanup of all listeners. |

Assets: `v2/public/maps-pilot/` — `mohali-masterplan.png` (1603×1278), `mohali-masterplan-overlays.svg` (viewBox 1575×1132), `mohali-sector-90-91.jpg` (1024×724), `mohali-3d.png` (1448×1086, loaded only on explicit 3D select — never preloaded).

Tests: `v2/tests/maps.test.ts` — 14 tests covering registry linking, no-distortion coordinate math (contain-fit, roundtrip, zoom-clamp, pan-no-gutter), LRU eviction, overlay layout, engine single-active/lazy-3D/supersede-race/dispose.

## 12. Known SVG/raster alignment mismatch

The Mohali masterplan overlay SVG (`viewBox="0 0 1575 1132"`) was authored against a slightly different crop than the current masterplan raster (`1603×1278`). `geometryMatches()` in `overlay-engine.ts` returns `false` for this pair and there is a unit test asserting exactly that.

**Per explicit instruction from the previous session: do not silently repair this.** It is flagged as a data/asset-alignment gap, not an engine bug. Do not attempt pixel-nudge correction without a dedicated, verified asset-alignment task — the engine's job is to render whatever geometry it's given without introducing its own distortion, which it does correctly.

## 13. Demand route and adapter decisions

- `routes.json` (in `docs/v2-blueprint/manifests/`) does **not** define `/admin/demand.html`. Doc `09_PROPERTIES_CUSTOMERS_DEALS_DEMAND.md` treats Demand as CRM data (`entity_type`) with no dedicated route — a standalone screen is only a `REPORT-CLAIM`, "pending redesign."
- Decision made in `50c19a2`: Demand is a **section** at `/admin/owner.html#demand`, mirroring the existing `#links` hash-section pattern. **Do not reintroduce a standalone `/admin/demand.html` route.**
- Demand data flows through `adapter.demand` (`DemandRepository` in `contracts.ts`) — `DemandRecord`, `DemandMatch`, typed loading/empty/error/no-match states, `{limit}` pagination. Never derive Demand from the legacy `getClients()`.

## 14. DataAdapterV2 and typed repository architecture

`v2/src/packages/data/contracts.ts` is the single boundary UI modules talk to. Key exports:

- `Result<T>` / `RepoError` / `ok()`/`err()` — structured success/failure, no throwing for expected failures.
- `Page<T>` / `PageParams` / `QueryOptions` (carries `signal?: AbortSignal`) — cursor pagination contract used everywhere.
- `AsyncState<T>` (`idle`/`loading`/`ready`/`empty`/`no-results`/`error`) + `State` factory + `pageToState()` helper.
- `SyncMeta`/`SyncStatus`/`Synced<T>` — typed now for Pass 2, **no sync implemented**.
- Repositories: `AuthRepository`, `PropertyRepository`, `CustomerRepository`, `DealRepository`, `DemandRepository`, `MapRepository`, `PresentationRepository`, `PresentationEventsRepository`, `ClientLinkRepository`, `MediaRepository`, `DemandSignalsRepository` — all assembled into `DataAdapterV2`.
- `activeScenario()` — dev-only `?scenario=` URL switch (gated on `import.meta.env.DEV`) so every state (empty/loading/error/expired/revoked/etc.) is reachable without a backend.

Implementation: `v2/src/packages/data/mock-adapter-v2.ts` — `MockDataAdapterV2` implements every interface with bounded, deterministic fixtures (no randomness). Exported singleton: `adapter`. **All new/ported screens must import `adapter` from here — never call Supabase/IndexedDB directly, never bypass with hardcoded page data.**

The legacy `v2/src/packages/data/mock-adapter.ts` (`dataAdapter`, `getClients()` etc.) still exists and is still used by some unported pages (home, deals, properties, customers, team, area-intelligence, property-insights). **Do not delete it** until every page importing it has been migrated onto `DataAdapterV2` — check with `grep -rl "from '.*mock-adapter'" v2/src` (excluding `mock-adapter-v2`) before removing anything.

## 15. Client-safe security requirements

`ClientSafeProperty` / `ClientSafePayload` (in `contracts.ts`) are structurally incapable of holding: seller phone, seller identity, commission, negotiation notes, internal notes, team data, owner-only fields, internal property status, or price (price is present only when the link's visibility settings allow it). This is enforced by a compile-time `never`-assertion type (`_clientSafeHasNoForbiddenKeys`) plus runtime tests in `v2/tests/adapter.test.ts`.

Client Presentation (`/app/plotmap/`) reads from `DataAdapterV2.properties` directly (dealer's own device/session — broader visibility rules than the tokenized Private Client Link per `docs/v2-blueprint/12_CLIENT_PRESENTATION_INTERNALS.md`) but this session's rebuild **deliberately never renders price** there either, per explicit task instruction. If price is reintroduced to Client Presentation in future work, confirm against `12_CLIENT_PRESENTATION_INTERNALS.md`'s "client-safe rules" section first — it notes Presentation *can* show more than the tokenized link, but the current build keeps price out.

The Private Client Link (`/client/?token=...`) is the **hard** client-safe boundary — never bypass `ClientSafePayload` there.

## 16. Shared design tokens, fonts and icon assets

- `v2/src/packages/ui/tokens.css` — full violet-dusk token set (colors, spacing, radii, shadows, motion keyframes, custom scrollbar). Matches `README.md`'s token table. `@import './fonts.css'` at the top (no more Google Fonts CDN).
- `v2/src/packages/ui/fonts.css` — `@font-face` for Newsreader 400/500/600 and Hanken Grotesk 400/500/600/700/800, all `woff2`, self-hosted at `v2/public/fonts/*.woff2` (580 KB total, latin subset only).
- `v2/src/packages/ui/reset.css` — base reset.
- Phosphor icons — self-hosted at `v2/public/assets/phosphor/{regular,fill,bold}/` (688 KB total after `50c19a2`'s trim; only these 3 weights are referenced anywhere in code). **Do not reinstall the full ~45 MB Phosphor package** — if a new icon weight is genuinely needed, extract only that weight's woff2 + style.css the same way, do not copy the whole package.
- Pages load icon stylesheets at runtime via `loadIcons()`-style helpers (see `presentation/main.ts`) pointing at `/assets/phosphor/<weight>/style.css` — always local paths, never CDN.

## 17. Architecture that must not be replaced

- `DataAdapterV2` and all typed repositories (§14)
- `DemandRepository`, `ClientSafePayload` (§13, §15)
- Typed `AsyncState`, cursor pagination, `AbortSignal` support
- Map registry, loader, `CoordinateSystem`, bounded LRU cache, SVG overlay engine, map lifecycle `dispose()`, lazy 3D loading (§11)
- Route-level Vite entries (`v2/vite.config.ts` — every `.html` entry point listed there)
- Strict Client Link CSP + token-removal-from-history in `v2/src/apps/client/main.ts`
- Zero heavy runtime frameworks — this is vanilla TS + Vite, keep it that way

## 18. Prohibited actions (carried forward)

- Do not connect Supabase, apply migrations, or deploy Vercel.
- Do not merge to main.
- Do not modify `approved-designs/`, `docs/v2-blueprint/`, or `migration-kit/`.
- Do not inspect the old `xyz`/`property-software` repository or search Downloads/unrelated folders.
- Do not invent new standalone routes (Demand's `#demand` hash pattern is the model for any non-routed section).
- Do not reinstall the full Phosphor package or reintroduce a Google Fonts CDN import.
- Do not claim pixel-perfect/visually-approved status — see §23.

## 19. Remaining migration order

1. Landing (`/`) - **DONE**
2. Dealer Home (`/admin/owner.html`) - **DONE**
3. Demand visual polish (`#demand`) - **DONE**
4. Properties, Customers, Deals - **DONE**
5. Team Workspace + Map Studio - **DONE**
6. Area Intelligence, Property Insights, Developer Control - **DONE**
7. Client Presentation Properties/Sector-maps tab bodies - **DONE**
8. Private buyer page visual polish against the Dashboard's phone-preview spec - **DONE**
9. Full 6-viewport responsive pass (1440×900, 1366×768, 1024×768, tablet landscape, 430×932, 390×844)
10. Full accessibility pass across all routes
11. Final build/regression validation

## 20. Test and build commands

```bash
cd "C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/v2"
npx tsc --noEmit
npm test
npm run build
```

Current state (as of `763257d`): tsc clean, **62/62 vitest tests pass**, build succeeds. Re-run all three before every commit.

## 21. Local preview links

```bash
cd "C:/Users/rachi_l35wosr/OneDrive/Desktop/MAPCO/v2"
npm run preview   # http://localhost:4173 by default
```

- `/` — Landing
- `/admin/owner.html` — Dealer Home (also `#demand` for Demand)
- `/admin/properties.html`, `/admin/deals.html`, `/admin/clients.html`
- `/admin/team.html`, `/admin/area-intelligence.html`, `/admin/property-insights.html`
- `/admin/map-studio.html`, `/admin/developer.html`
- `/app/plotmap/index.html` — Client Presentation (done, see §10)
- `/client/?token=l1` — Private buyer page (use a real fixture token, e.g. `l1`, from `mock-adapter.ts`'s `CLIENT_LINKS`)
- `/app/map-pilot/index.html` — standalone map-engine demo (not a production route)

## 22. Current known defects and limitations

- Client Presentation: pinning a property (`pm-pcard-act--pin`) updates the pin-count chip and card label but does **not** yet draw a glowing dot marker on the map at the property's coordinates — the approved design's pin dot spec (`13px circle, #ffc21e, 3px solid #fffdfb border, box-shadow:0 0 16px #ffc21e`) is documented in `screens/02-client-presentation.md` but not wired to real coordinates yet (no per-property `{x,y}` mark data exists in the current fixtures).
- Client Presentation Properties/Sector-maps tab bodies are not built (§10).
- SVG/raster geometry mismatch on the Mohali pilot pair — flagged, not fixed (§12).
- All screens outside Client Presentation still run the pre-pixel-parity visual implementation (functionally correct, tokens-based, but not verified against the `.dc.html` markup pixel-by-pixel).
- Some dealer pages still import the legacy `mock-adapter.ts` rather than `DataAdapterV2` (§14) — migrate opportunistically as each page is pixel-ported, don't do a disruptive mass find-replace.

## 23. Final visual testing rule

**The user personally performs all final visual testing.** No AI working on this repository may declare the design "visually approved," "pixel-perfect," or "matches the handoff" based on build success, automated tests, or even browser screenshots taken during implementation. Automated checks (tsc, vitest, build, and browser smoke tests for console errors/rendering) verify the code *runs* — they do not verify visual fidelity. Always report implementation as "implemented, awaiting the user's own visual review" and let the user be the one to confirm parity against the approved `.dc.html` files.

## 24. Continuation prompt (ready to paste to the next AI)

```
Continue the MAPCO V2 pixel-parity migration.

Repository: C:\Users\rachi_l35wosr\OneDrive\Desktop\MAPCO
Branch: feat/mapco-v2-pixel-parity (do not create a new branch, do not merge to main)
Expected current HEAD: 4150e8b
Latest implementation commit: a10fa63

First read v2/PIXEL_PARITY_HANDOFF.md in full — it has the complete state,
architecture, route status table, and prohibited actions.

Then run:
  git status --short
  git branch --show-current
  git log -5 --oneline
  git pull

Approved design source (the visual contract, read completely, do not modify):
  approved-designs/02-Dashboard/design_handoff_plotmap/

Continue the remaining migration order from §19 of the handoff, starting with
Landing (/) and Dealer Home (/admin/owner.html), porting each screen's exact
markup/spacing/typography/colors from the corresponding .dc.html file and
screens/*.md spec. Preserve all architecture listed in §17 of the handoff
(DataAdapterV2, map engine, client-safe types, etc.) — do not bypass typed
adapters with hardcoded page data.

Do not connect Supabase, deploy Vercel, apply migrations, or merge to main.
Do not modify approved-designs/, docs/v2-blueprint/, or migration-kit/.
Do not claim pixel-perfect or visually-approved status — the user performs
all final visual testing personally (handoff §23).

Run npx tsc --noEmit, npm test, npm run build before every commit. Commit
and push only to origin/feat/mapco-v2-pixel-parity.
```
