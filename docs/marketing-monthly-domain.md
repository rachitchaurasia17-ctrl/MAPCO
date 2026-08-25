# MAPCO Marketing monthly domain

## Canonical period

New Marketing entitlement is owned by `marketing_periods`, one row per dealer and calendar month. A period records explicit start/end dates, `period_kind`, and `anchor_day`; V1 uses a calendar month and day 1, while those fields permit a later billing-cycle migration without replacing downstream records.

Every V1 period has exactly 30 Post entitlements and 8 Reel entitlements. `plotmap_marketing_usage()` is the dealer-safe usage contract. A Post is used when its pre-created monthly slot is claimed for production. A Reel is used when its canonical Reel Job is reserved. Failed work, retries, and replacements continue using the original slot/job.

## Posts

`marketing_post_slots` pre-creates `P001` through `P030`. Claiming is serialized with a transaction advisory lock and protected by a dealer/period idempotency key. There is no normal API that creates `P031`.

Monthly Post results reuse `marketing_creative_results`. Approval creates the existing `marketing_creatives` row with `creative_type = 'post'`, then uses the existing `marketing_schedule_items` and publication architecture.

## Reels

`marketing_reel_jobs` is the quota-consuming submission and retains the canonical dealer/property relationship. `marketing_reel_assets` records raw, finished, and optional poster lineage. Replacements supersede media on the same job and return the old private object reference for service-role cleanup.

Raw video is stored only in private `marketing-reel-raw`; finished media is stored only in private `marketing-reel-finished`. Dealers may upload only to a server-derived pending raw path. Operators may upload finished media only for assigned dealers. Neither bucket has a browser read policy. The Marketing broker issues short-lived signed URLs after server-side actor checks and strips bucket/path values from responses.

The operator transition is `received → in_editing → ready`. Marking Ready creates exactly one existing canonical `marketing_creatives` row with `creative_type = 'reel'`; it does not copy the finished file. Automatic schedule rows are accepted only for connected Instagram/Facebook accounts. Empty channels remain honestly ready-but-unscheduled.

## Property and privacy boundary

New active Post/Reel work requires the canonical property to be published, not deleted, and `lifecycle = 'on-sale'` (with legacy published/sold normalization). Sold, Archived, Off Market, and draft properties are rejected for new work.

Creatives, contexts, Reel Jobs, and media metadata retain text property identities rather than cascading through CRM deletion, so completed Marketing history survives Mark Sold. New production contexts use the allow-listed `marketing-facts-v2` projection. Price/asking price, seller/owner facts, commission, private notes/documents, buyers, raw coordinates, and map placement are excluded.

## Legacy weekly compatibility

`marketing_weekly_plans` and `marketing_output_slots` are retained as read-compatible V1 history. Existing weekly creatives still resolve through the same Library projection. New entitlement work must not call `plotmap_marketing_open_week`; it uses `marketing_periods` and `marketing_post_slots`. No historical weekly row, creative, publication, or content context is deleted or rewritten by the monthly migration.

