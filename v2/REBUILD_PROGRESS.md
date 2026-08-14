# MAPCO — Dealer Dashboard parity + Earth-in-Presentation rebuild

Working notes for this effort. Branch `feat/mapco-v2-backend`. Nothing committed yet.

## Decisions taken (from the user, this session)

| Question | Decision |
|---|---|
| My Deals | **Pipeline + a Completed tab.** Restore the design's 6-stage deal book as the main view; keep the completed-sales register as a secondary section inside My Deals. |
| Fidelity | Follow the `.dc.html` design. Keep **MAPCO** branding (the repo deliberately renamed PlotMap → MAPCO in `c207586`), drive content through `DataAdapterV2`. |
| Header chips | **Drop** "A client is on your map now". **Keep** "Trial · N days left", wired to the real `adapter.auth.getAccountState()` so the Developer Control panel can drive it. |
| MAPCO Earth | Remove the current Client Presentation; **Earth becomes the presentation**. Carry the masterplan + 3D raster maps over from the old system. Add small buttons to open Properties and Sector. Properties section follows the Claude design. |
| Landing | **No Earth card.** Team Workspace returns as card 03. Earth is reached through the presentation. |

## Design source

`Dealer Dashboard.dc.html`, `Client Presentation.dc.html`, `Team Workspace.dc.html`, `PlotMap Landing.dc.html` at the repo root are **byte-identical** to the copies under `approved-designs/02-Dashboard/design_handoff_plotmap/design/`. One source, no ambiguity. There is no `MAPCO Marketing.dc.html` in the repo.

Extracted per-section specs (from the design-extraction workflow) are in the session scratchpad under `specs/`:
`00-shell`, `01-home`, `02-deals`, `03-plots`, `04-customers`, `05-links`.

## Done

- **Earth regression fixed.** `8d22dfa` deleted the 5 seeded coordinates from `earth/config.ts` and made Earth read locations only from the canonical record — but no mock property had one, so Earth listed 8 properties and drew **0 pins**. Seeded Tri-City coordinates now live in `packages/data/mock-adapter.ts`, applied *after* `hydrateMock()` and only when `!property.location`, so a dealer's pin-and-save always wins. 8/8 now resolve; presentation `hasEarthLocation` went 0 → 6.
- **Team Workspace card restored** in `src/main.ts`, verbatim from before `14c3c58`. Earth card removed.
- **Dealer shell** (`apps/dealer/shell.ts`) rebuilt to the design: 40px logo + 22px wordmark, exact nav/badge styles from the design view-model, "With a customer?" → *Show Map to Customer* CTA with `omGlow`, design background gradients, Earth quick-launch removed, trial chip from `getAccountState()`.
- **Dealer Home** (`apps/dealer/pages/home.ts`) rebuilt to the design's demand screen: donut *Where buyers look*, *What gets opened most* bars, *Interest on the map vs plots you hold* columns, opportunity/hottest banner, *Plots pulling the most attention* cards. Sources: `demandSignals` + `clientLinks` + `properties` + `customers`.
- **Tests updated.** 4 tests written by `8d22dfa` asserted the *opposite* of the approved design (`not.toMatch(/Hottest area/i)`, `not.toContain('adapter.demandSignals')`, "does not render the superseded buyer-analytics dashboard"). Retargeted to assert the design; kept the AI-free and no-fixture boundaries.
- `productRoutes.propertiesInCity(city)` added; `properties.ts` already read `?city=`.

Gates at this point: `tsc --noEmit` clean, **318/318 vitest passing**.

- **Earth Masterplan + 3D are now real maps.** New `apps/earth/plan-maps.ts` mounts the shared `packages/maps` engine into Earth's `#e-plan`, driven by `adapter.presentation.listMaps()` (published + non-hidden only). Verified in-browser: Masterplan loads `mohali-masterplan.png` at its true 1603×1278, 3D lazily loads `mohali-3d.png` at 1448×1086 only when selected, and returning to Earth/Map disposes the engine. Honest empty states for "no maps published" and "3D not available".
- **Properties + Sector browse sheets** added to Earth from `Client Presentation.dc.html` (isProps 154–185, isSectors 187–215): card grids with city filter chips and counts. Opened by two small buttons in the bottom-left cluster — deliberately NOT the top-right, which `tests/earth-toolbar.test.ts` reserves for the four view modes. A property card selects that property on Earth; a sector card opens that sheet in Masterplan.
- New `tests/earth-plan-maps.test.ts` locks: real engine (not placeholder), engine teardown, published-only registration, honest degradation, and **no price/seller/commission/owner on the browse sheets**.

- **Fixed the bug that made all of the above invisible.** `mountMapEngine` sets `position:relative` *inline* on its mount root, which beat the stylesheet's `position:absolute`; `inset:0` then offset the stage without stretching it, so it measured **1280×0** and `overflow:hidden` clipped the entire map. The raster had loaded (correct `naturalWidth`) but `cover()` had fitted it to a dead 0-height viewport. Fix: explicit `width:100%;height:100%` on `.e-plan-stage`, removed the `eFade` entrance animation (with `fill-mode:both` a non-running animation stranded it at `opacity:0`), and added a `ResizeObserver` that re-fits once the stage has real layout. Close button moved to bottom-right — it had been overlapping the view tabs. View tabs now also dismiss an open browse sheet.

Gates: `tsc --noEmit` clean, **327/327 vitest passing**.

## Remaining

1. Client Presentation route (`/app/plotmap/`) — decide whether it now *loads* Earth or keeps the old shell; Earth itself is ready.
2. My Deals — pipeline + Completed tab
3. My Plots, My Customers, Client Links
4. Shared sheets: add-property, add-client, add-deal wizard, detail drawers

## Key architecture findings for the presentation rebuild

- **Earth's Masterplan and 3D views are empty placeholders.** `apps/earth/main.ts:355 renderPlanOverlay()` renders a "will appear here" message — no actual map. This is exactly the gap the user means by "integrate the masterplan and 3d map from the old system".
- The **real raster engine** is `packages/maps`: `mountMapEngine(container, opts) → { engine, dispose }`, `engine.setMap(id,{mode})` / `setMode` / `cover()` / `resize()`, plus `registerMaps()` from `adapter.presentation.listMaps()` and `loadSvgOverlay()` for highlights. It mounts into **any** container, so it can be mounted into Earth's `#e-plan`.
- Earth `main.ts` is **not** a reusable component: it boots on import via a module-level `document.getElementById('app')` block and owns module-level state. Making Earth the presentation is simpler than embedding Earth inside the old presentation shell.
- **Client-safety:** Earth's `main.ts` currently renders **no price** (only `config.ts` computes a `price` string on the Property object). That must stay true once Earth is client-facing — the design's presentation property card shows size / name / sector / facing / flag / photo-count and **no price**. Guarded by `tests/presentation-security-boundary.test.ts`.
- Design sections for the presentation: `isProps` at `Client Presentation.dc.html:154–185`, `isSectors` at `187–215`.

## Standing constraints

- Do not claim pixel-perfect or visually-approved — the user does final visual review personally (`PIXEL_PARITY_HANDOFF.md` §23).
- Do not modify `approved-designs/`, `docs/v2-blueprint/`, `migration-kit/`.
- Vanilla TS + Vite, no frameworks. All data through `DataAdapterV2`.
