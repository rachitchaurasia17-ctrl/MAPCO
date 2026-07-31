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
