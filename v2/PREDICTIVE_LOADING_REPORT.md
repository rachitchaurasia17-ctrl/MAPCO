# MAPCO V2 Predictive Priority-Loading Report

Last verified: **2026-08-06 (Asia/Calcutta)**

Branch: **`feat/mapco-v2-backend`**

Supabase target: **MAPCO-DEV (`lswzrkvdwirhvggtvuch`) only**

Production: **https://mapco-navy.vercel.app**

This report describes the transparent rules-based loading system added in the predictive priority-loading phase. It changes loading, caching, telemetry, and invalidation behavior only. It does not redesign the approved MAPCO screens, change calibrated map geometry, connect the legacy PROPERTY project, or claim founder visual or physical-device approval.

## 1. Baseline and measurement method

Measurements used installed Chrome in a fresh 1366×768 context, a real MAPCO-DEV dealer session, Chrome DevTools Protocol Network/Performance metrics, and the production Client Presentation route. Browser cache was cleared before each initial-load trace. Interaction traces waited for the current map image to be complete with a non-zero intrinsic size.

Two baseline sets are retained:

- **Phase-start trace:** the first clean measurement taken before implementation.
- **Controlled comparison:** the same final harness run immediately before and after deployment. Wall-clock comparisons should use this pair because CDN/network variance was material.

### Phase-start trace

| Measurement | Before |
|---|---:|
| Initial requests | 32 |
| Apparent repeated endpoint pairs | 4 |
| Initial transferred bytes | 3,836,085 |
| Original map visible | 1,788 ms |
| First usable interaction | 1,788 ms |
| Cold map switch | 1,272 ms |
| Property grid switch | 280 ms |
| Property detail open | 152 ms |
| Cold 3D selection | 1,051 ms / 1 image request |
| 3D downloaded before selection | No |
| Original return | 138 ms / 0 requests |
| Recent-map return | 482 ms |
| Heap before rapid map/property loop | 6,115,676 bytes |
| Heap after forced GC | 2,433,268 bytes |
| Post-GC growth | −3,682,408 bytes |

The four apparent repeated endpoint pairs in that first trace combined CORS preflights with their payload requests; they were not four duplicate payload downloads. The later controlled baseline found three genuine repeated static payload signatures (two font URLs and one JavaScript URL).

### Controlled production before/after

| Clean initial-load measurement | Before (`b01c46b`) | After | Change |
|---|---:|---:|---:|
| Total requests including preflight | 35 | 37 | +2 |
| Payload requests | 31 | 30 | −1 |
| CORS preflights | 4 | 7 | +3 |
| Identical payload signatures | 3 | 0 | −3 |
| Transferred bytes | 4,080,558 | 4,093,961 | +13,403 (+0.33%) |
| Original map visible | 5,435 ms | 2,545 ms | −2,890 ms (−53.2%) |
| First usable interaction | 5,524 ms | 2,750 ms | −2,774 ms (−50.2%) |
| Original intrinsic dimensions | 1603×1278 | 1603×1278 | unchanged |

The after build adds small dealer-history/telemetry calls after P0/P1 work clears, which explains the extra preflights and approximately 13 KB. It removed identical payload requests and did not delay the active map. The 3.44 MB Original raster remains the dominant initial transfer.

### Production interaction trace after deployment

| Measurement | After |
|---|---:|
| 3D requests before selection | 0 |
| Cold 3D selection | 757 ms / 1 image request |
| Original return | 301 ms / 0 image requests |
| Cold map switch | 1,016 ms / 1 image request |
| Recent-map return | 478 ms / 0 image requests |
| Property grid switch | 169 ms |
| Property detail open | 285 ms |
| Heap before stress loop | 8,131,660 bytes |
| Heap after 10 map switches + 20 property opens | 6,116,696 bytes |
| Heap after forced GC | 3,551,872 bytes |
| Post-GC growth | −4,579,788 bytes |

Cold 3D improved by 28.0%, cold map switching by 20.1%, and the property grid by 39.6% relative to the phase-start trace. Recent-map return remained effectively flat (482→478 ms) but reused the cached raster with zero image requests. Property detail DOM rendering was slower in this run (152→285 ms); that is a genuine remaining optimization target rather than a claimed improvement.

## 2. Main bottlenecks found

1. The active Original raster accounts for about 3.44 MB, roughly 84% of the measured initial transfer.
2. Supabase REST/RPC calls incur CORS preflights; predictive history and telemetry add small request overhead even though they run after visible priority work.
3. The original implementation had separate map-image/SVG consumers without a shared scoped in-flight identity.
4. SVG geometry could be downloaded and parsed again after route/map churn.
5. CSS background images could eagerly fetch card media without native lazy-loading control.
6. Obsolete route/map/property predictions needed explicit abort and stale-response guards.

The large official map was not resized, cropped, stretched, simplified, or replaced because its exact visual/geometry behavior is a product constraint.

## 3. Loader architecture

The implementation is intentionally small and replaceable:

- `src/packages/performance/priority-loader.ts` — queue, concurrency, promotion/demotion, cancellation, Promise deduplication, stale guards, scoped cache, and instrumentation.
- `scoring.ts` — configurable transparent score calculation and priority/stage thresholds.
- `cache.ts` — count- and byte-bounded cost-aware LRU with protection, expiry, and disposal callbacks.
- `network.ts` — connection/device policy and concurrency selection.
- `runtime.ts` — session/dealer learning, scope creation, telemetry deferral, invalidation subscription, environment listeners, and debug access.
- `session-learning.ts` — current-session transitions and decayed dealer-summary conversion.
- `instrumentation.ts` — permanent bounded counters plus detailed events only with `?loader-debug`.
- `invalidation.ts` — small mutation event bus.

All consumers requesting the same fully-scoped resource/stage share one in-flight Promise. The in-flight identity is removed before consumers are resolved, preventing an immediate mutation from reusing a stale settled Promise.

## 4. P0/P1/P2/P3 definitions

| Priority | Meaning | Behavior |
|---|---|---|
| P0 | Current dealer action/visible resource | Immediate; never blocked by predictions; cancels P2/P3. |
| P1 | Strong deterministic dependency | Immediate after/alongside P0; cancels P2/P3; includes current overlay/SVG/placement and explicitly selected media. |
| P2 | Probable next action | Allowed on suitable connections; moderate confidence remains prepare-only; cancelled on P0/P1/context change. |
| P3 | Idle background work | Runs through `requestIdleCallback` (40 ms fallback), only while visible/online and on permitted network/device conditions. |

New P0/P1 work cancels running or queued P2/P3 via AbortController. Route, map, detail, hover, and render-mode groups use monotonically increasing context versions; a response whose version is no longer current is rejected before cache/writeback.

## 5. Candidate score and weights

Every signal is normalized to 0..1. The default score is:

```text
100 × direct action
 28 × current context
 24 × deterministic relationship
 18 × current-session transition
 13 × recent dealer history
+  7 × older dealer history
+ 20 × recent interaction
+ 15 × estimated next-use probability
− 18 × normalized bytes (capped at 4 MiB)
− 12 × parse/decode cost
− 18 × constrained-network penalty
```

The values live in `DEFAULT_SCORE_WEIGHTS` and can be replaced without changing the queue/cache implementation. The preferred order is preserved: direct action, context, deterministic relation, session behavior, recent dealer history, then older history.

Priority thresholds:

- direct action ≥0.95 → P0
- direct action ≥0.5, relationship ≥0.9, or score ≥70 → P1
- score ≥42 → P2
- score ≥24 → P3
- otherwise → skip

## 6. Prepare versus download

- P2 scores below 66 are reduced to `prepare`.
- P3 scores below 36 are reduced to `prepare`; P3 downloads are therefore limited to the top end of P3 and still require fast/visible/idle conditions.
- Slow-2G/2G or Data Saver permits lightweight metadata preparation but blocks predictive heavy downloads.
- A hidden tab blocks all newly scheduled P2/P3 work and cancels already-running P2/P3 when visibility/network state changes.
- P0/P1 remains allowed because an explicit action must not be silently discarded.

Exact predictive 3D gate:

- explicit selection is P0 and may download;
- non-explicit 3D requires score ≥94, effective 4G, at least 8 GB reported device memory, visible and idle state, Data Saver off, and no P0/P1 pending;
- otherwise it is prepare-only;
- no production integration currently proposes 3D speculatively, so normal behavior remains explicit-selection-only.

## 7. New-dealer defaults and relationships

Useful behavior does not wait for stored history:

- masterplan → same-city sector metadata
- sector → parent masterplan metadata
- map/sector → linked visible property summaries
- property → saved sector map, masterplan, and normalized placement metadata
- selected property → first visible media
- Client Link selection → selected-property summaries and first thumbnail
- hover/focus → short-lived small thumbnail/map-metadata boost

Only metadata for related maps is prepared. The 81-row picker registry remains the existing route bootstrap, but full rasters, 3D files, SVGs, and galleries are never prefetched as a catalog.

## 8. Session and dealer-specific learning

Current-session transitions are recorded in memory immediately. Dealer history is loaded after the visible map and uses time-decayed summaries from MAPCO-DEV.

Stored operational events are limited to:

- route/city/masterplan/sector/property opened
- View on Map
- Original/3D selected
- Client Link creation started
- property added to Client Link
- transitions between those resource/workflow states

No pointer, pan, zoom, raw Client Link token, sensitive client content, seller content, or customer-facing analytics event is stored for prediction.

`predictive_usage_events` is dealer/actor scoped with RLS, accepts writes only through a secure authenticated RPC, and has a 90-day raw-event retention trigger. `predictive_transition_summaries` stores only dealer-scoped counts and recency. Anon execution and direct authenticated writes are revoked.

## 9. Request identity and isolation

Resource keys contain:

```text
visibility scope | scope ID | resource type | resource ID |
asset version | visibility version | prepare/download stage
```

Authenticated scopes use a session user identity; anonymous session scopes use a random session ID; public-token scopes use a one-way FNV fingerprint. A raw Client Link token is never present in a key. Each runtime owns one loader/cache, so dealer/session/public resources do not cross runtimes.

Covered resource types include bootstrap data, map metadata/raster/SVG/overlay, property summaries/thumbnails/media, map placement, signed media, and Client Link preview data.

## 10. Cache limits and cleanup

Default browser cache:

- normal device: 48 entries / 64 MiB
- device reporting ≤2 GB memory: 20 entries / 24 MiB
- parsed SVG blueprints: 6 entries / 6 MiB
- non-shared map-engine fallback: 3 decoded images

The current raster is protected from eviction. Switching mode/map unprotects the previous raster but leaves it recent. LRU eviction invokes disposal callbacks, clears image references, revokes blob URLs, releases parsed SVG blueprints, and rejects expired signed media. Runtime disposal removes listeners, aborts requests, clears timers, removes debug globals, and empties caches.

The measured stress trace retained 23 entries costing 8,193,796 estimated bytes, well below the normal cap, and showed negative post-GC growth.

## 11. Mutation invalidation

- property add/edit/visibility/placement → only that property summary, thumbnail, media, placement, plus the visible-property bootstrap
- completed sale → the sold property/inventory entries immediately
- map publish/replace/hide/highlight change → that map’s metadata/raster/SVG/overlay plus published registry
- client update → Client Link preview entries only
- Client Link create/revoke → matching and pending selection preview entries
- dealer sign-in/sign-out → the entire current scope

One property mutation does not flush unrelated maps. A map mutation does not flush property media. Signed URLs include version/expiry metadata and are not reused after expiry.

## 12. Map and property integration

- The existing contain/cover coordinate engine, intrinsic dimensions, normalized pins, and shared raster/overlay transform remain unchanged.
- The current Original/3D raster goes through the shared P0 loader and cost-aware cache.
- 3D controls are rendered only when a real backend asset exists; no CSS/fake 3D fallback remains.
- SVG fetches share the priority loader and parsed geometry uses a bounded reusable blueprint cache.
- Existing excluded-name rules (`unnecessary`, misspellings/synonyms, `ignore`, guides, full-map containers) remain active before highlight geometry is created.
- Visible card media uses native lazy images; selected-property media is promoted; non-visible galleries remain lazy.
- Client Link selections prepare only the chosen summaries/thumbnail, not every property.

## 13. Observability and measured prediction reuse

Production always retains aggregate counters only. `?loader-debug` enables a bounded 200-event detail buffer and exposes `window.__MAPCO_LOADER_DEBUG__` with `summary()`, `events()`, and `cache()` for developer inspection; it is removed on runtime disposal.

The scripted production scenario reported:

- 24 cache misses/tasks started
- 17 prepare completions
- 6 download completions
- 149 cache hits
- 3 predictions later reused
- 3 obsolete predictions cancelled
- 23 entries / 8.19 MB retained

This demonstrates reuse and cancellation but is not a statistically meaningful dealer-accuracy percentage. A short natural property-open sample queued one likely-next prediction that the script did not choose. Longitudinal accuracy should be calculated only after real dealer usage; this report does not manufacture a rate from the small verification run.

## 14. Security and verification

Automated coverage includes P0 precedence, P1/new-dealer relationships, score contributions, recency, cost penalties, P2/P3 stage thresholds, promotion, cancellation, stale responses, in-flight deduplication, scope isolation, LRU eviction, signed expiry, mutation invalidation, Data Saver/slow/hidden behavior, 3D gating/laziness, no full-catalog asset preload, and production mock fail-closed behavior.

Live MAPCO-DEV verification proves:

- dealer A can record/read its own minimal event;
- dealer B cannot read dealer A events or summaries;
- direct table writes are blocked;
- anonymous predictive RPC calls are blocked;
- the dealer summary updates with a decayed score;
- temporary verification rows are removed.

Final automated results:

- TypeScript `--noEmit`: pass
- Vitest: 7 files, 113/113 tests passed
- production build: pass (118 modules transformed)
- backend/RLS/Storage verification: 44/44 passed
- private Client Link E2E: 29/29 passed
- production browser: initial map, map switching, Original/3D, property grid/detail, cancellation/cache instrumentation, and stress/GC trace completed

## 15. Rollback

Application rollback is a normal Vercel redeploy of the prior pushed commit (`b01c46b`) or a Git revert of the phase commits. The new tables/RPCs may safely remain unused during an application rollback. Dropping them is intentionally not automated because that would destroy operational history; if a schema rollback is explicitly approved, export any required summaries first and remove the two predictive migrations with a separate reviewed migration.

## 16. Genuine remaining gaps

1. The 3.44 MB official Original raster dominates initial bytes. A future asset pipeline can create equivalent optimized formats/variants, but this phase deliberately did not replace official map media.
2. Property detail open measured 285 ms versus the 152 ms phase-start sample and should be profiled separately; no visual refactor was made here.
3. Predictive telemetry/history adds small Supabase requests and CORS preflights after P0/P1. A future batched endpoint could reduce that overhead.
4. Cost values are safe estimates, not exact decoded-memory sizes for every browser image.
5. Real derived property thumbnails do not yet exist for every Storage asset; adding a dedicated thumbnail pipeline would make low-cost prediction more consistent.
6. Network Information and Device Memory APIs are not available in every browser; the implementation falls back safely but cannot infer missing hardware/network detail.
7. Dealer prediction accuracy needs real longitudinal usage. Only deterministic behavior and small scripted reuse/cancellation samples are verified today.
8. Automated browser tests verify runtime behavior, not founder visual parity or physical-device experience; those remain with the user.
