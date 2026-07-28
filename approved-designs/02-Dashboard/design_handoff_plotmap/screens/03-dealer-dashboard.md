# 03 · Dealer Dashboard (`Dealer Dashboard.dc.html`)

Preview 1440 × 940. The dealer's private app — used alone, after meetings. ~2000 lines;
`renderVals()` (from ~line 1400) is the authoritative view-model reference.

## Shell
Left **sidebar** (translucent over the violet-dusk bloom): logo, then nav.
`NAV`:
| key | label | icon |
|---|---|---|
| `areas` | Home | `ph-house` |
| `deals` | My Deals | `ph-handshake` (badge = active deal count) |
| `properties` | My Plots | `ph-buildings` |
| `clients` | My Customers | `ph-users-three` |
| `links` | Client Links | `ph-paper-plane-tilt` |

Nav item: full width, `display:flex;gap:14px;padding:14px 16px;border-radius:14px`, icon 23px
in a 26px centred box. **Active** = `background:#ffc93c;color:#1f1a12` + inset shadow + fill icon.
Hover (inactive) = `background:#fdefc9;color:#1f1a12`. Nav column scrolls with the custom scrollbar.

Content header shows greeting, date, and the section name/icon from `SECMETA`.
Changing section resets selections and re-runs the count-up animation.

## Home (`areas`)
Demand signals only, from real opens. Includes a donut (top 6 areas + "Other areas",
`CIRC = 2πr`, r = 45, cumulative stroke offsets) and horizontal bars for property types
opened most. Each row carries a plain-English verdict pill — e.g. "Source stock",
"Stock is fine", "Quiet" — and clicking a row jumps to My Plots filtered to that city.
**The area-by-area table was deliberately removed. Do not reintroduce it.**
Also: streak line ("N days in a row using PlotMap"), buyers-shown-today count, and a
call list of clients with a match/no-stock chip.

## My Deals (`deals`)
`STAGES` = enquiry · negotiating · token · registry (+ closed). Each stage has
`{color, bg, card, border}` — e.g. enquiry `#5b32c4` on `#e7defc`, card `#f4eeff`,
border `#ddd0f5`. Search + list + detail pane. Pipeline value and expected commission
(commission ≈ 1.5% of value) are summed across active deals.
The Deals **section shows finished deals only**; active ones live in the pipeline summary.
Delete is two-step (`delArm`).

## My Plots (`properties`)
Photo tiles with a city filter dropdown. Every plot shows a status badge:
**On presentation** (green) or **Not published** (neutral). Actions per tile:
Publish · Take off · Mark sold · Delete. Prices are editable inline.
Marking a plot sold creates a deal record and jumps to Deals.
Deleting a plot also strips it out of every client link.
Views-per-plot bars use `#f4ae14`; a plot with no photo gets an "Add photo" chip instead of "Ready".

## My Customers (`clients`)
A **ranked leaderboard**, not a table. Each row: rank, name, phone, budget, what they want
(icons: Plot `ph-fill ph-map-pin-area`, Flat `ph-fill ph-buildings`, Kothi `ph-fill ph-house-line`,
Villa `ph-fill ph-house`, Commercial `ph-fill ph-storefront`) and **reason chips** explaining
the rank — top client / active / recent. Detail pane shows their viewed plots, interests
and deals; delete is two-step.

## Client Links (`links`)
Cards for each private share: client, plot count, expiry, opens, and per-event pills
(played the voice note / called / WhatsApp / visited). Actions: preview, stop (revoke), delete.
Card style: `background:#faf7ff;border:1.5px solid #e4dbf7;border-radius:22px;padding:22px 24px`
plus the standard card shadow. Header shows "N live links" and total opens.

## Sheets & flows (shared with Team Workspace — build once)
- **Add a property** — multi-step (`pstep`): city, area, type (default "Residential Plot"),
  size, facing (default East), sector, price, photos.
- **Add a client** — name, phone, want, city, budget from/to + unit (Lakh/Cr), note, plots of interest.
- **Generate a client link** — stepped and every step skippable: pick/create customer →
  pick up to **4** plots → optional voice note (record/stop, `secs` timer) → choose whether
  location and **price** are shown (price defaults to `hidden`) → expiry (default 3 days) →
  one-tap **preview in a phone mockup** → "Link is ready" confirmation with copy/WhatsApp.

## Private client page (the phone preview / what the buyer receives)
Dark magazine layout: photo carousel, price band (only if price was enabled), a glowing
voice-note card, a benefits list, and a large green **Call** button at the bottom.

## State
See `state = { ... }` at line ~1196. Key shape:
`section`, `selectedDeal`, `selectedClient`, `clientFilter`, searches, `plotCity`/`plotCityOpen`,
`p` (0→1 count-up progress), `addOpen`/`addClientOpen`/`addPlotOpen`/`pstep`, `shareFor`/`sform`,
`mobileFor`/`mobileLink` (phone preview), `propDetail`/`propShot`, `delArm`/`delPlot`/`delClient`.
Data lives in instance arrays `this.properties`, `this.clients`, `this.deals`, `this.clientLinks`
plus `this.PROPMAP` (plot → sector map) and `this.INTEREST` (area → opens).
In production these become API resources; keep the derived view-model layer, it is where all
the plain-English labelling happens.
