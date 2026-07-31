# MAPCO V2 — Antigravity + Claude Handoff

Last verified: **2026-07-31 (Asia/Calcutta)**

This is the current operational handoff for continuing the MAPCO V2 pixel-parity work. Read this file and `PIXEL_PARITY_HANDOFF.md` before editing anything.

## 1. User objective

Rebuild MAPCO V2 so the real TypeScript application matches the approved Claude designs exactly. This is a strict translation task, not a redesign exercise.

The user expects:

- exact structure, dimensions, spacing, typography, colors, cards, navigation, overlays, and interactions;
- real TypeScript values in place of prototype bindings — never display `${...}` expressions as text;
- preservation of DataAdapterV2, map engine, routes, security boundaries, and tests;
- no Supabase connection, deployment, merge to `main`, or approved-design edits;
- visual work to stop at user-review checkpoints instead of continuing into unrelated screens;
- clickable customer, property, link, team, and presentation surfaces where the approved design implies interaction.

Do not “improve,” simplify, modernize, or reinterpret the approved design.

## 2. Repository and Git state

Repository:

```text
C:\Users\rachi_l35wosr\OneDrive\Desktop\MAPCO
```

Application root:

```text
C:\Users\rachi_l35wosr\OneDrive\Desktop\MAPCO\v2
```

Current branch:

```text
feat/mapco-v2-pixel-parity
```

Current pushed/checked-out HEAD:

```text
5ca06c246ac681eb32efa2e8c24f09c1bc995a54
```

Remote state at handoff:

```text
5ca06c2 (HEAD, origin/feat/mapco-v2-pixel-parity) document locked Masterplan implementation
```

Important: there are newer **uncommitted** Dealer Dashboard changes on top of this pushed commit. Preserve them. Do not reset, checkout, clean, or overwrite the working tree.

Current working tree:

```text
 M v2/src/apps/dealer/pages/customers.ts
 M v2/src/apps/dealer/pages/links.ts
 M v2/src/apps/dealer/pages/properties.ts
 M v2/src/packages/ui/utils.ts
?? "# Dealer Dashboard Redesign (2).zip"
```

The ZIP is a user-provided, untracked design bundle. Do not delete, modify, or commit it unless the user explicitly asks.

## 3. Immutable visual sources

Primary approved source:

```text
approved-designs/02-Dashboard/design_handoff_plotmap/
```

Exact design files:

```text
design/Dealer Dashboard.dc.html
design/Team Workspace.dc.html
design/Client Presentation.dc.html
design/PlotMap Landing.dc.html
```

Supporting specifications:

```text
README.md
data-model.md
screens/01-landing.md
screens/02-client-presentation.md
screens/03-dealer-dashboard.md
screens/04-team-workspace.md
```

Never edit this approved-design directory. Read inline styles and the prototype view-model, then translate them into existing TypeScript application state.

The latest Add Property modal also uses these user-supplied screenshot references:

```text
C:/Users/RACHI_~1/AppData/Local/Temp/codex-clipboard-2e86bfcf-331e-40b3-8bf1-e0895a66526e.png
C:/Users/RACHI_~1/AppData/Local/Temp/codex-clipboard-c154dc83-89ba-4deb-a94b-0c38884029a7.png
```

Those Temp paths are not durable. The implemented modal in `properties.ts` is now the durable translation of those screenshots.

## 4. Locked Client Presentation Masterplan

The Masterplan state is approved and locked. Do not alter it while working on Dealer Dashboard or other routes.

Locked baseline:

- implementation commit: `a28dbf322f9d3e0360747496a5b78ed0da9efc4e`;
- documentation commit / current pushed HEAD: `5ca06c246ac681eb32efa2e8c24f09c1bc995a54`;
- route: `/app/plotmap/index.html`;
- desktop property rail: `clamp(300px, 24vw, 330px)`;
- map uses all remaining width with no unnecessary inter-column gutter;
- initial Masterplan is centered aspect-preserving cover-fit with no side gutters;
- slight vertical cropping is allowed and cropped content remains reachable by panning;
- map viewport clips overflow;
- raster has no internal padding or margins;
- Fit Map explicitly returns to centered contain-fit;
- Original → 3D → Original retains the same active map;
- 3D imagery remains lazy-loaded;
- raster, overlays, saved highlights, and pins share the canonical `cssMapTransform()` transform.

Regression coverage exists for all of the above in `v2/tests/maps.test.ts` and `v2/tests/structure.test.ts`.

Do not change the sidebar width, rail, controls, property cards, map colors, fitting defaults, or map-engine math as part of another screen task.

## 5. Current uncommitted Dealer Dashboard work

### 5.1 My Plots / Properties

Route:

```text
/admin/properties.html
```

File:

```text
v2/src/apps/dealer/pages/properties.ts
```

Current translated state:

- plot cards now follow the approved Dealer Dashboard hierarchy;
- image area is 150 px high;
- Available / Needs photo status is at the upper-right of the image;
- title and location use approved sizing and spacing;
- size, facing, presentation, map, photo-count, and live-link chips are present;
- live link count is derived from `adapter.clientLinks`, not hardcoded prototype text;
- price row, pencil affordance, overflow menu, Show on map, Presentation, and Send private link actions are present;
- portfolio cards now use the approved Value of stock / Ready to show / Need a photo design;
- card grid uses the approved `repeat(auto-fill,minmax(310px,1fr))` behavior;
- cards open their property detail panel;
- presentation/map actions route to `/app/plotmap/index.html?property=...`;
- private-link action routes to `/admin/owner.html#links`.

### 5.2 Add Property modal

Trigger label is now **Add Property**.

The modal is a wide, centered, three-stage implementation matching the latest supplied screenshots:

1. Property Basics
2. Photos & Details
3. Client Preview

Implemented UI:

- blurred dark backdrop;
- large cream modal with fixed header and footer;
- violet brand icon and title block;
- clickable three-stage step rail;
- Property Basics form with title, city, area/sector, plot size, facing, position, and sector;
- Photos & Details form with cover-photo drop area, six gallery slots, property type, listing status, possession, description, count, and nearby places;
- dark client preview panel on every stage;
- live title and location preview updates;
- preview hero, thumbnails, facts, approval badge, and nearby places;
- Back, Save Draft, Next, and Add Property actions;
- stage navigation works in the live browser;
- final values are translated into a local `Property` and added to the in-memory list.

Intentional current limitations that the next agent must know:

- no Supabase or persistent backend connection exists;
- photo controls are visual placeholders and do not open a real file picker yet;
- Save Draft and Add Property both currently save a local unpublished property and close the modal;
- newly created properties currently use `price: 0` because the screenshot flow has no price field;
- the Property model has no separate title field, so the modal title drives the preview but the saved card still uses the existing property type/location model;
- the form is seeded with the Eco City example values from the supplied screenshot to preserve visual parity;
- stage 1 shows Add Property, stage 2 shows Next, and stage 3 shows Add Property, matching the supplied screenshots even though the progression is unconventional.

Do not “fix” these behavior decisions without asking the user, because visual parity was the immediate request.

### 5.3 My Customers

Route:

```text
/admin/clients.html
```

File:

```text
v2/src/apps/dealer/pages/customers.ts
```

State:

- approved two-column customer card hierarchy is present;
- search and filter row match the approved source;
- search surface received the exact subtle handoff shadow;
- cards are clickable and open the customer detail side panel;
- Call links stop card navigation correctly;
- Add Customer modal remains functional and adapter-backed/local-state compatible.

### 5.4 Client Links

Route:

```text
/admin/owner.html#links
```

File:

```text
v2/src/apps/dealer/pages/links.ts
```

State:

- approved stacked card structure is present;
- opens/status, plot chips, engagement chips, actions, and delete affordance are present;
- a link containing one property now shows `Property type · location`, matching the reference;
- multi-property links still show the correct count;
- See their page opens the preview dialog;
- Send a new link opens the approved builder flow;
- data remains sourced from DataAdapterV2 fixtures.

### 5.5 Dealer date formatting

File:

```text
v2/src/packages/ui/utils.ts
```

`formatDateShort()` now matches the prototype behavior:

```ts
toLocaleDateString('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
```

The year was removed because it was not present in the approved Dealer Dashboard header.

## 6. Other route state

### Team Workspace

Important baseline commit:

```text
7afadfe fix: Team Workspace layout structure parity
```

Routes:

```text
/admin/team.html
/admin/map-studio.html
```

The user previously reported that property and client boxes in the Team Dashboard must be clickable. Do not assume every Team Workspace interaction is finished merely because the structure exists. Re-test the exact requested launcher/card path before making a completion claim.

### Client Presentation Properties and Sector Maps

Important baseline commit:

```text
0106186 fix: Client Presentation Properties exact parity
```

Current `v2/src/apps/presentation/main.ts` contains property detail/gallery and sector detail interactions in addition to the locked Masterplan. Do not replace them with a sidebar or violet background that is absent from the approved full-screen detail states.

### Landing

Route:

```text
/
```

The landing route exists and was rebuilt earlier. It has not been part of the latest visual review cycle. Do not claim new approval without checking it against `PlotMap Landing.dc.html` and asking the user.

## 7. Data, security, and architecture boundaries

All UI data must go through:

```text
v2/src/packages/data/contracts.ts
v2/src/packages/data/mock-adapter-v2.ts
```

Use the exported `adapter`. Do not connect Supabase or bypass DataAdapterV2 with a new direct store.

Preserve:

- typed repository results and scenarios;
- `ClientSafePayload` / `ClientSafeProperty` boundaries;
- no seller phone, commission, internal notes, or team data in buyer-safe payloads;
- existing route manifest decisions;
- Demand as `/admin/owner.html#demand`, not `/admin/demand.html`;
- map-engine lifecycle and cleanup;
- no external CDN/font regression;
- approved folder immutability.

Client Presentation intentionally does not show price. Do not add it casually.

## 8. Verification state

Verified on 2026-07-31 against the current uncommitted working tree:

```text
npm run build              PASS
npm test -- --run          PASS
git diff --check           PASS
```

Test totals:

```text
4 test files passed
72 tests passed
```

Suites:

```text
tests/adapter.test.ts       13
tests/structure.test.ts     24
tests/maps.test.ts          18
tests/states.test.ts        17
```

The Add Property stages were also browser-verified at a 1440×900 desktop viewport:

- Add Property opens;
- Property Basics renders;
- Photos & Details renders;
- Next reaches Client Preview;
- the modal remains within its fixed shell with internal scrolling;
- cards, customer panels, and client-link previews were verified in the preceding review cycle.

## 9. Local preview

From `v2`:

```powershell
npm run dev -- --host 127.0.0.1 --port 5174
```

Primary review links:

```text
Landing:                 http://127.0.0.1:5174/
Dealer Home:             http://127.0.0.1:5174/admin/owner.html
My Plots:                http://127.0.0.1:5174/admin/properties.html
My Customers:            http://127.0.0.1:5174/admin/clients.html
Client Links:            http://127.0.0.1:5174/admin/owner.html#links
Team Workspace:          http://127.0.0.1:5174/admin/team.html
Map Studio:              http://127.0.0.1:5174/admin/map-studio.html
Client Presentation:     http://127.0.0.1:5174/app/plotmap/index.html
```

To review the latest task, open My Plots and click **Add Property**.

## 10. Next recommended action

The immediate checkpoint is **user visual approval of the Add Property modal**.

Do not start another broad redesign pass before that approval. If the user supplies mismatch screenshots:

1. compare only the named modal/state;
2. preserve Masterplan and other locked routes;
3. change the smallest relevant surface;
4. verify the exact stage at the same viewport;
5. rerun build and all tests;
6. stop for visual review.

After approval, the user may request another Dealer Dashboard or Team Workspace state. Work one exact-reference state at a time.

## 11. Resume checklist for Antigravity or Claude

Before editing:

```powershell
cd "C:\Users\rachi_l35wosr\OneDrive\Desktop\MAPCO"
git status --short
git branch --show-current
git rev-parse HEAD
```

Confirm:

- branch is `feat/mapco-v2-pixel-parity`;
- HEAD is at least `5ca06c2`;
- the four modified files are still present;
- the untracked design ZIP is preserved;
- no unrelated worktree changes are reverted.

Then read:

```text
v2/ANTIGRAVITY_CLAUDE_HANDOFF.md
v2/PIXEL_PARITY_HANDOFF.md
approved-designs/02-Dashboard/design_handoff_plotmap/README.md
the exact .dc.html for the requested route
```

## 12. Hard prohibitions

Do not:

- modify `approved-designs/`;
- merge to `main`;
- deploy;
- connect Supabase;
- overwrite or delete the user ZIP;
- run `git reset --hard`, `git checkout --`, or `git clean`;
- discard the current uncommitted Dealer Dashboard work;
- change the locked Masterplan while fixing Dealer Dashboard;
- invent routes;
- render prototype placeholders or `${...}` expressions;
- claim pixel perfection without direct visual comparison and user approval.

## 13. Handoff summary

The pushed branch contains the locked Masterplan baseline. The working tree contains the newest Dealer Dashboard visual pass, including the exact-reference plot cards and the wide three-stage Add Property modal. Build and all 72 tests pass. The next agent should preserve the working tree, show the modal to the user, and wait for the next visual approval or specific mismatch request.
