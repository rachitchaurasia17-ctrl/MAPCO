# MAPCO V2 — Map Library Inventory

Generated from the local Tri-City source library (`maps with svg/`, `3d maps/`, `non 3d maps/`).

**Total source files:** 170

## Per-city coverage (source assets present)

| City / area | Masterplan | 3D | Sector | SVG/overlay | Other | Onboarded to MAPCO-DEV? |
|---|---|---|---|---|---|---|
| Chandigarh | 2 | 0 | 42 | 1 | 3 | — not yet |
| Derabassi | 1 | 1 | 0 | 0 | 0 | — not yet |
| Kharar | 1 | 1 | 0 | 0 | 0 | — not yet |
| Mohali | 5 | 1 | 42 | 3 | 15 | ✅ masterplan(published), 3d, sector(draft), overlay |
| Mohali (Aerocity) | 1 | 0 | 0 | 0 | 0 | — not yet |
| Mohali (Aerotropolis) | 1 | 1 | 0 | 1 | 1 | — not yet |
| New Chandigarh | 4 | 0 | 0 | 2 | 2 | ✅ masterplan(published), overlay |
| New Chandigarh (Eco City) | 0 | 0 | 0 | 0 | 1 | — not yet |
| New Chandigarh (Mullanpur) | 1 | 1 | 0 | 0 | 0 | — not yet |
| Other/Unsorted | 1 | 0 | 8 | 0 | 20 | — not yet |
| Panchkula | 0 | 1 | 0 | 0 | 0 | — not yet |
| Zirakpur | 3 | 1 | 0 | 2 | 0 | — not yet |

## Onboarded this phase (vertical slice)

- **New Chandigarh** masterplan (published, client-visible) + overlay SVG → Storage `maps/newchandigarh/`.
- **Mohali** masterplan + 3D + overlay SVG (published) and a **Sector 90-91** sector map (draft, linked to the Mohali masterplan) → Storage `maps/mohali/`.
- Seeded properties `ecocity`, `omx` linked + placed on the New Chandigarh masterplan (normalized x/y).

## Remaining to onboard (next: batch script)

Everything above marked "— not yet". Recommended batch order: New Chandigarh (Mullanpur/Eco City) → remaining Mohali sectors → Zirakpur → Panchkula → Chandigarh → Derabassi → Kharar → Aerotropolis. Each city needs: masterplan raster + 3D + sector maps + overlay SVG uploaded to the `maps` bucket and a `prebuilt_maps` record created via `plotmap_upsert_map` (published when verified).

---

## Onboarding results (session 5) — batch onboarder live

Tool: `v2/scripts/onboard-maps.mjs` (classify → group renders → dedupe → read dims →
upload to Storage `maps/` → register `prebuilt_maps`; idempotent, skip-with-reasons).

- **80 logical maps** classified from 171 source files; **83 registered** on MAPCO-DEV
  (11 masterplans published + client-visible, 72 sectors draft), **143 assets uploaded**, **0 failures**.
- Relationships: **0 orphan sectors** (every `parent_map_id` resolves), **0 masterplans missing dims**.
- Per city: Mohali 4 master + 45 sector · Chandigarh 1 + 26 · New Chandigarh 2 + 1 ·
  Zirakpur / Panchkula / Derabassi / Kharar 1 master each.
- 65 maps carry a 3D rendering; 7 carry an SVG overlay.

### Skipped (with reasons)
- `3d maps/sector 16.png`, `non 3d maps/sector 83.png` — no city token in the filename
  (genuinely ambiguous; needs a manual city assignment). Everything else was recovered by the
  classifier (typos `aetropolis`/`zirkpur`/`mohalli`/`mohli`, double extensions `*.png.png`,
  no-extension `panchulka`, and project→city mapping for gillco/jlpl/shivalik/industrial/etc.).

### Known cleanup (minor)
- Legacy test records `map-nc-master` / `map-mohali-master` / `map-mohali-sec` (from the
  session-4 verify script) coexist with the clean onboarded ids (`new-chandigarh-master`,
  `mohali-master`, …). Harmless; a dedupe pass can drop the `map-*` test ids.

---

## Session 6 — manual overrides + presentation integration

- **Manual overrides** (remembered in `onboard-maps.mjs` `OVERRIDES`, idempotent):
  `3d maps/sector 16.png` → **Chandigarh · Sector 16** (parent `chandigarh-master`);
  `non 3d maps/sector 83.png` → **Aerocity · Sector 83** (parent `aerocity-master`).
  **0 files now skipped.**
- **Legacy test records removed** (`map-nc-master`/`map-mohali-master`/`map-mohali-sec`);
  the verify harness now self-cleans so they never repopulate.
- **Final catalog:** 81 maps — **9 published city masterplans** (Mohali, Aerocity, Aerotropolis,
  New Chandigarh, Chandigarh, Zirakpur, Panchkula, Derabassi, Kharar) + 72 draft sectors.
