# PlotMap — Map Interaction + Map Studio Marking Update

> Scope note: this is the **HTML design prototype** (`PlotMap Hero Screens.dc.html`), not the app code repo.
> The `node --check` / `git` steps in the task brief apply to the production repo and were not run here.
> Money / Finance stays removed — nothing in this update reintroduces it.

## What changed in Client Presentation (client Map view)

- The fake CSS map was replaced with the **real Aerocity masterplan image** (`assets/masterplan.jpg`) as the canvas background.
- Added an **interactive overlay layer** (SVG) driven by a scalable data model — not hardcoded in markup.
- Click/tap interaction states implemented for every overlay type:
  - **normal · hover · selected · related · dimmed**, with premium motion (selection ~300ms, side card slide-in, slow 2.6s road flow, no bounce/flash).
- Per-type client-safe side cards:
  - **Block / Sector** → proof-gold outline, soft fill, rest of map dims, linked road highlights, card with area / nearby road / connected sectors / Sector Proof / View Sector Proof / View Properties.
  - **Road** → airport-blue glow + flow animation, other roads muted, card with connectivity role / connected areas / landmarks / entry-exit / View Connected Areas.
  - **Property Pin** → pin grows + soft ring, parent block highlights, client-safe card (sector, block, size, facing, road width, photo icon, View on Sector Proof, Share Brochure).
  - **Landmark / Commercial** and **Airport / Connectivity Zone** → clean outline, soft fill, "why it matters" explanation, View Nearby Properties.
- A legend ("Tap the map to explore") anchors the interaction.
- **Never shown to clients:** price, sold, seller, commission, finance, internal notes, staff/owner data, draft status.

## What changed in Map Studio

Redesigned around the simple flow: **Pick your map → Mark it → Publish.**

- **Top step bar** shows the active step.
- **Left tool panel:** Select/Edit, Road, Block, Sector, Property Pin, Landmark, Commercial Area, Boundary/Zone.
- **Center canvas:** the real masterplan as background (never a bare grid), zoom/pan controls, in-progress marking that matches the selected tool, a tool-specific **instruction bubble**, Undo point + Finish.
- **Right inspector (kept simple):** name, type, colour group A/B/C/D, client-visible toggle, status chips (Draft/Review/Published/Hidden), **Preview Client Click**, Save Draft, Publish. Advanced fields (client-safe description, links, internal notes) tucked under **More details**.
- **Preview Client Click** opens a full overlay showing exactly how the marking behaves in Client Presentation (road glow+flow / block gold outline / pin ring) with a client card — clearly labelled "Preview mode · not published yet."

## Supported overlay types

`road · block · sector · pin · landmark · commercial · zone (airport/connectivity)`

Each item supports: `id, type, name, geometry, status, clientVisible, colourGroup, linked[…], clientSafeDescription, internalNotes`. Seeded with one of each so more can be added later through Map Studio.

## Publish / clientVisible behavior

- Only overlays that are **status: Published AND clientVisible: true** appear in Client Presentation.
- Draft / Review / Hidden / internal-only markings never render for clients.
- Demonstrated live: the seeded "Airport Road Link" starts as **Draft / Internal-only** (invisible to clients); after Publish it appears as a clickable client overlay.

## Safety audit result

- Client side cards expose only client-safe fields. No price/sold/seller/commission/finance/notes/staff paths exist in the client render.
- Internal notes are visually flagged "never shown to clients" inside Map Studio only.

## Known limitations

- Drawing is a guided **simulation** (points/shape are pre-placed per tool) — good enough to demo the workflow; a production build would capture real tap coordinates.
- Zoom/pan and Undo/Finish are visual affordances, not yet wired to live geometry editing.
- One seeded item per type; geometry is illustrative and not auto-detected from the JPG (as required).

## Next exact step

Wire the Map Studio draw tools to capture real coordinates on the canvas and persist markings to the overlay store, so published items render from saved geometry rather than the seeded demo set.
