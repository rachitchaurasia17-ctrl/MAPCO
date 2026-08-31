# Google Place Photos — MAPCO persistent storage approval

**Status:** approved for MAPCO
**Programme:** Google Young Founder development/support programme
**Scope:** persistent storage and reuse of Google Place Photos, without a
storage/reuse time restriction, for MAPCO's Property Intelligence feature
**Recorded by:** MAPCO project owner
**Recorded on:** 2026-08-31

> **File the original here.** This page records the approval and the
> architecture it authorises so that engineers changing the media pipeline
> understand why it is built this way. It is not itself the approval. The
> written confirmation from Google should be committed alongside this file
> (`docs/google-place-photos-approval.<ext>`) or linked from here, so the
> authority can be produced on request.

---

## Why this document exists

Google Maps Platform's default caching guidance leads most implementations
to re-fetch a Place Photo on each use, or to cache it only briefly. MAPCO
does neither: it downloads a photo **once per place, globally**, stores it,
and serves that stored copy to every property near that place, for every
dealer, indefinitely.

Without this document an engineer would quite reasonably read the media
pipeline as a compliance mistake and "fix" it back into per-view fetching.
That change would multiply MAPCO's Place Photos bill and add latency to
every Property Intelligence card, for no benefit.

**Do not replace the persistent storage architecture with default caching
assumptions.** If the approval ever lapses or its scope changes, change this
document first, then the pipeline.

---

## What the approval permits

- Retrieving Google Place Photos through the Places API.
- Storing the retrieved image bytes in MAPCO-controlled storage.
- Serving that stored copy to MAPCO users.
- Reusing the stored copy across properties, dealers and sessions, without
  a fixed expiry.

## What MAPCO still does, because it is correct regardless

- **Attribution is preserved and displayed.** `place_registry.attributions`
  stores the `authorAttributions` Google returns, the view model carries
  them as `imageAttributions`, and the Property Intelligence card renders
  them over the photo. A stored photo is never shown without its
  attribution.
- **Provenance is recorded.** Every stored asset keeps the Google Place ID,
  the Google photo resource name, `source = GOOGLE_PLACE_PHOTO`, the
  retrieval timestamp, the MAPCO storage path, the MIME type and the
  dimensions.
- **Only server-side code retrieves photos.** The Google server key lives in
  the Supabase Edge runtime (production) or in `supabase/.env.local` read by
  the Vite middleware (development). It never reaches a browser bundle.
- **No photo is attributed to the wrong place.** When Google has no photo
  for a place, the card shows an honest placeholder — never another place's
  image.

---

## The architecture this authorises

```
selected PLACE_ENTITY  (Phase 2 selection only — never the whole universe)
        │
        ▼
  Google Place ID
        │
        ▼
  place_registry  ──── stored copy exists?  ── yes ──▶ reuse the MAPCO asset
  (global, keyed by                                    · zero Google calls
   place_id, NOT by                                    · recorded as a cache
   property or dealer)                                   hit so the saving is
        │                                                measurable
        no
        │
        ▼
  Place Details (photo reference)  →  Place Photo (bytes)
        │
        ▼
  store once in the `place-media` bucket
        │
        ▼
  every future property near that place reuses it
```

### Why the bucket is public-read

`place-media` is created `public = true` with **write restricted to
`service_role`**. This is deliberate and is *not* the same posture as the
legacy `maps` bucket:

| | `place-media` | `maps` (legacy) |
|---|---|---|
| Contents | Google Place Photos of public businesses and landmarks | Dealer masterplan and sector rasters, including drafts |
| Tenant data? | No — global, non-tenant content | Yes |
| Public read | Correct: CDN-served, free, and what makes reuse cheap | A known problem, tracked separately |
| Write access | `service_role` only | No write policy at all |

Nothing in `place-media` is dealer data, so a public object URL discloses
nothing about any tenant.

### Where this is implemented

| Concern | Location |
|---|---|
| Registry table + RPCs + bucket | `supabase/migrations/20260831000100_property_intelligence_v3.sql` |
| Fetch / store / reuse logic | `v2/src/packages/property-intelligence/enrich/index.ts` |
| Production store | `supabase/functions/property-intelligence/store.ts` |
| Development store | `v2/vite-plugins/property-intelligence-dev.ts` |
| Attribution rendering | `v2/src/apps/earth/property-detail.ts` (`intelRowMarkup`) |
| Tests | `v2/tests/property-intelligence-security.test.ts`, `property-intelligence-pipeline.test.ts` |

---

## If the approval changes

1. Update the **Status** line above with the new scope and date.
2. If persistent storage is withdrawn, set a TTL on `place_registry` rows
   and add an expiry check in `enrichSelections` before treating a stored
   asset as reusable — the reuse decision is in one place precisely so this
   change stays small.
3. Re-run `v2/tests/property-intelligence-security.test.ts`, which asserts
   this document exists and that the bucket write policy stays
   service-role-only.
