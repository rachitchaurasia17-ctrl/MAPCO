# Committed map-library reconciliation

Continuation status: see `LIVE-PREFLIGHT.md`. The 160 entries below are the
first checkpoint, not a certified final unique-map count. PDF exclusions and
visual-duplicate evidence are being reopened; live publication is blocked by
historical map bindings that require an explicit recovery decision.

Canonical baseline: `865d1f0a9bf61901e42013d9c38fe12ec38dfbcd` (MAPCO).
Donor: `b89424538d5e1b287f85ebad74ccefd22f57ed87` (property-software).

## Catalog result

113 → 160 typed maps. Imported 47 committed rasters: 39 additional layouts and
8 complementary/alternate sheets. No donor application, routing, engine, CRM,
admin code, or unverified overlay calibration was imported.

The donor has 422 committed media files, of which 352 are map candidates
(330 unique blobs). Its 85 registry records reference 146 existing committed
images: zero missing references. Another 206 candidate files are outside that
registry. Counts below refer to candidate files, not unique logical maps.

| Disposition | Files |
| --- | ---: |
| Exact bytes already in typed MAPCO catalog | 114 |
| Exact bytes already committed elsewhere in MAPCO | 70 |
| Additional useful map | 39 |
| Retained alternate/complementary sheet | 8 |
| Repeated donor bytes, not imported again | 17 |
| Visually duplicated sheet, existing raster retained | 63 |
| Unsuitable fragments/uncalibrated vector artwork | 23 |
| PDF-only | 18 |

Every candidate and source blob is recorded in `reconciliation.json`;
`import-decisions.json` identifies the 47 selected sources. Source bytes were
read using Git objects, rather than relying on ignored donor files.

| Region | Maps |
| --- | ---: |
| Mohali | 71 |
| Panchkula | 36 |
| Chandigarh | 35 |
| Aerocity | 10 |
| New Chandigarh / Mullanpur | 4 |
| Aerotropolis | 1 |
| Derabassi | 1 |
| Kharar | 1 |
| Zirakpur | 1 |

Categories: 91 sector maps, 45 project maps, 10 master plans, 9 industrial maps,
5 other layouts. Donor folder names were not treated as authoritative: several
`new chandigarh` images show Chandigarh city sectors; printed sector labels
also correct misleading filenames. EcoCity I/II are New Chandigarh; the existing
GMADA Aerocity image is a partial E/F sheet, not a whole-city master plan.

## Compatibility and generation

All 113 original IDs, image paths, pixel dimensions, ordering, and SHA256 raster
hashes are preserved. Metadata corrections do not replace images or transfer
pins. Alternate sheets have distinct IDs. `Property.location` is untouched;
no coordinates or map placements are inferred or migrated.

The existing `v2/scripts/import-maps.mjs` consumes reviewed source overrides in
`map-curation.json`. Run from `v2`:

```
node scripts/import-maps.mjs --check
```

The check rejects stale generated JSON/TypeScript, missing images, duplicate
IDs/new duplicate bytes, changed original geometry/bytes, and source/output
differences. The source rasters under `non 3d maps/legacy` and published copies
are both committed. Donor access is unnecessary to generate the registry.
The audit script pins both historical commits so reruns retain the baseline.

Validation: 58 tests across six map suites passed; `npm run typecheck` and
`npm run build` passed. Production build emitted a large-chunk warning.
The registry integration test initially exceeded Vitest's 5-second default
while hashing all rasters; standalone reproduction passed and its bounded
timeout is now 30 seconds (child process limited to 25 seconds).
Generation also passed from a separate Git archive of the staged source,
published assets, generator, curation and compatibility baseline. That check
had no donor checkout, node_modules, secrets or ignored source files available.
This proves committed map-input completeness, not a live Supabase rollout.

## Map Studio publishing blocker

This is a repository catalog checkpoint, not a completed live database rollout.
The current Map Studio repository calls `plotmap_dealer_maps`; its mock fixture
contains two static maps. The typed catalog is consumed by the current maps
resolver and mock map repository, but it is not that tenant-owned database list.

`prebuilt_maps.id` is globally unique while records carry `dealer_id`.
The existing `onboard-maps.mjs` uses independent slugs, a hardcoded demo tenant
and checkout, skips nested source folders, and upserts storage/database records.
It must not be run to publish these assets: it could replace a persisted map's
image coordinate space or create mismatched IDs. No database mutation was made.

Publishing needs a decision on shared-library versus per-dealer ownership,
followed by an explicit reconciliation against actual database IDs and saved
placements. Existing database IDs/images must remain immutable. No automatic
replacement or inferred geographic calibration is safe.

Browser inspection opened current Map Studio and the property wizard, but did
not prove selection of this 160-map catalog or saved placement rendering there.
Those acceptance checks remain blocked on the catalog integration decision.
Earth had no local API key; no property data was saved or modified.

Other remaining gaps: incomplete regional coverage is not invented; PDF-only
plans need separate reviewed raster preparation; uncalibrated SVG fragments are
not ready overlays. Four original PNG assets exceed 4MB and remain byte-identical
to protect compatibility. No claim is made that legacy layouts are current
legal/planning authority editions.
