# 04 · Team Workspace (`Team Workspace.dc.html`)

Staff-facing. Same violet-dusk system. Top bar: logo → segmented nav pill
(`background:#f0eaff`, 4px padding, radius 14px) → right side a status pill
"Team login · everything shared" with a pulsing green dot (`#12a150`).
Top bar background: `linear-gradient(90deg,#fff6dd,#fffaf0 40%,#f6f0ff)`,
`border-bottom:1px solid #ddd2f5`.

## Home — "The work table"
Eyebrow "THE WORK TABLE" (`#a8792a`), H1 "What are we adding today?" (Newsreader 46px/500/-.025em),
lead paragraph 17px/1.5 `#6b6156`, max-width 600px.

Then a 3-column launcher grid (gap 18px), each a 26px-padded 24px-radius card with a 52px
icon tile and a "Start →" row:
| Card | Bed | Icon tile | CTA ink |
|---|---|---|---|
| Add a property | `#fff3d1` + radial sheen | `#ffc93c` on `#241d0c` | `#8a5a0c` |
| Add a client | `#efe8fb` | `#5b32c4` on `#efe8fb` | `#5b32c4` |
| Generate a link | `#dcf3e5` | `#1f4d3a` on `#d9f5e3` | `#1f4d3a` |

Below, the full-width dark **Map Studio** hero: `background:#1b3a2e`, `border:1px solid #2c4a3c`,
radius 26px, padding 30px 34px. Eyebrow "THE IMPORTANT ONE" in `#ffd75e`, title Newsreader 38px
in `#faf7ff`, body `#c9dbcf`, and three stat chips (`rgba(255,255,255,.10)`, 13px/700, `#e8f2eb`):
"182 maps", "Masterplan highlights", "Sector drawing".

## Map Studio hub
Three numbered cards (01/02/03) — big `Newsreader` ordinal watermark top-right, a 56px icon
tile pinned left-centre in the header band, a soft circle bleeding off one corner:
1. **01 Publish Masterplan** — eyebrow "BIG CITY MAP" (`#a8792a`). Pick which traced roads,
   blocks and pins light up when the client taps a highlight button.
2. **02 Publish Sector Map** — eyebrow "DETAILED PROOF MAP" (`#5b32c4`), rose tile `#ffe1e6`.
   Trace roads, draw blocks, drop pins and labels, link a pin to a plot.
3. **03 Manage Published** — eyebrow "EVERYTHING LIVE" (`#12704a`). Every map a client can
   open right now; edit marks, link a property, hide it.

## Publish Masterplan
Bar: logo · Back · map picker · Link property · Undo. Main area is the full map.
Right panel tabs: **Roads / Sectors / Blocks / Places / Pins** with live highlighting as you
hover a list item. Below the tabs a **set row**: A · B · C · **+** — you group marks into sets,
and each set becomes one highlight button on the client side. Publish opens a confirm dialog
("Publish <map name>" + a summary line).

## Publish Sector Map
Same bar. Tools are a 2×2 grid — **Move · Road · Block · Pin** with **Text** full width beneath.
Same set row, a Live/Hidden pill, a mark editor, and the mark list.
The right panel is fixed height and must **not** scroll.
Marks here save into sets but the **client never sees the set buttons** on a sector map.

## Manage Published
H1 "Published maps". Three stat tiles (18px radius, 132px min-width, Newsreader 34px numeral):
Maps live (`#dcf3e5` / border `#b3e0c6` / ink `#12704a`), Marks drawn (`#fff3d1` / `#f6d98d` / `#8a5a0c`),
Plots linked (`#efe8fb` / `#d6c6f5` / `#5b32c4`).
Then a photo-card grid: each card has stats, a Live/Hidden pill, a linked-property row with a
**+** to link more, and **Edit marks** / **Hide** buttons. Filters above the grid.

## Properties page
Full editor, not a modal: photo upload, city, sector, type, size, facing, position, approvals,
landmarks with distances, plus Save and Delete. List view has a per-plot toggle that puts it
on the client screen.

## Clients page
H1 "Clients" (42px). Every client the dealer is talking to and what they are looking for,
each row expandable to edit details.

## Shared with Dealer Dashboard
Add property, Add client and Generate link are **the same three flows** as in the Dashboard —
implement them once as shared components and mount them in both apps.
