# Shared catalog live preflight: publication blocked

MAPCO-DEV (`lswzrkvdwirhvggtvuch`), read-only inspection on 2026-09-12.
No migration, storage upload, property update or map publication has occurred.

The ownership decision is settled: one shared immutable platform catalog,
with dealer permissions and separately owned placements/annotations. No copy
of every map per dealer. Implementation is pending historical reconciliation.

## Observed compatibility problems

81 actual `prebuilt_maps` rows were inspected. Every primary raster returned
HTTP 200 and matched a committed MAPCO asset by SHA256. 65 rows match bytes
already in the typed catalog; 16 use committed assets outside that catalog.
The full database ID / asset / typed match / property-reference table is in
`live-reconciliation-preflight.json`.

Two newly imported typed IDs collide with historical database IDs:

| ID | Historical live image | New typed image |
| --- | --- | --- |
| chandigarh-sector-15 | 1448 x 1086 PNG | 2217 x 1649 JPG |
| chandigarh-sector-4 | 1448 x 1086 PNG | 2221 x 1573 JPG |

The PNGs match `3d maps/sector 15 chd.png` and `3d maps/sector 4 chd.png`.
An upsert of the typed catalog would replace coordinate spaces. Preserve the
historical IDs; assign distinct new IDs to the imported reference sheets during
reconciliation. Neither new ID belongs to the original 113-map baseline.

## Decision required: orphaned historical placements

Properties `ecocity` and `omx` have placements at (0.42, 0.31) and (0.6, 0.55),
respectively, against `map-nc-master`. The database contains no such map row.
Do not substitute `new-chandigarh-master`: its current image is 1603 x 1278.

The initial demo seed assigned `map-nc-master` a Mohali image under a New
Chandigarh label. Later, `v2/scripts/backend-verify.mjs` explicitly uploaded
`migration-kit/maps with svg/new chd normal.png` to
`maps/newchandigarh/masterplan.png`, created `map-nc-master` using that image,
saved these exact two coordinates, then deleted its test map rows. The script
did not undo the property references. The inventory document also records
removal of these historical test IDs.

The surviving verification image is 1484 x 1060. Its Storage object metadata
ETag matches the committed source MD5 `8fe6d22dbde4ebfec859726834697c0d`.
Source SHA256: `b0a7cd489cf747ec3e3fd238716764252967c078dd67ed3620e75ad9909a50db`.
This is strong recovery evidence, but not a retained historical database row
or proof of every image replacement over that ID's lifetime.

Proposed recovery awaiting the user's answer: restore `map-nc-master` as a
historical immutable map bound to the verification image, preserving both
property coordinates exactly. Alternative: leave the orphaned references
untouched until the intended historical sheet is confirmed. No inferred
coordinate conversion or WGS84 change is proposed.

Two other properties contain typed sector references with no current database
row (`sector-77-mohali`, `sector-66-mohali`). These are represented in the typed
catalog and can resolve through normal catalog publication; they are not
evidence to rewrite the two historical placements.

## Reopened content audit

The prior 160-map count is a repository entry count, not yet a certified final
unique usable count. The prior blanket PDF exclusions must not be treated as
final decisions.

Rendered every page of all 19 committed PDFs: 18 map candidates (35 pages) and
one unrelated 35-page document. No PDF decoding failures. Visual inspection
found complete additional candidate sheets for DLF Hyde Park commercial pockets
and overall layout, DLF Valley, IT City, Landchester, Omaxe commercial and overall
layout, PCL, Suntec City, Greater Punjab Officers Society, and a numbered New
Chandigarh zonal plan. EcoCity I/II PDFs also contain official-sheet information
requiring comparison with the existing simplified rasters. A floor-plan
advertisement is unsuitable as a sector/project base map. The 18-page Aerocity
document contains cropped block details that need comparison with the full
existing sheets. Emaar also needs comparison rather than automatic exclusion.

All 63 previously classified visual duplicates were re-rendered in comparison
sheets. Pixel similarity was used only to suggest comparison candidates; several
suggestions were wrong, so it cannot decide duplicate status. Per-sheet evidence,
the remaining vector/current-repo asset audit, recovered raster exports, and the
final exact count are still unfinished. No new recovered map is claimed imported.

Inspection images and raw snapshots are deliberately ignored. The read-only
review scripts preserve Git blob provenance and do not execute donor code.

## Acceptance status

- Shared catalog architecture: decision recorded; implementation pending.
- Live reconciliation: blocked before mutation by the historical binding decision.
- New Map Studio selection/save/reopen: not run; not proven.
- Existing compatibility: conflicts identified; existing live state untouched.
- Cross-dealer shared-catalog isolation: not implemented/tested yet.
- Final unique usable count and PDF recovery count: not certified.
- Validation: 63 tests in seven map suites passed, including five publication
  preflight regressions. Typecheck and production build passed. The build retains
  a large-chunk warning. The map generator and all 160 raster inputs are unchanged
  from the prior committed-files-only generation proof.
- Map system ready for first real dealer: **NO**.
