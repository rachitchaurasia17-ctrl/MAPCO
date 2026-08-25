# 01 · PlotMap Landing (`PlotMap Landing.dc.html`)

## Purpose
Entry hub. Establishes the brand, tells the user the time/greeting, and routes to the three apps.

## Layout
Full-viewport (`position:fixed;inset:0`), single centred column, content max-width ~1100px,
vertically centred. Background is a cinematic sepia map wash with an amber / lavender / forest
aurora layered over it (see the root element's `background-image` stack — copy it verbatim).

Top: large **Newsreader** wordmark "PlotMap" with the gold rounded-square logo mark
(40×40 viewBox, `rx=11`, fill `#ffc93c`, dark `#241d0c` diamond glyph).
Under it: a live greeting line ("Good evening" etc., derived from the clock) plus the current
time and date, updating every minute.

Bottom: **three destination cards** in a `repeat(3,minmax(0,1fr))` grid, gap 18px:
| Card | Header colour | Goes to |
|---|---|---|
| Client Presentation | gold `#ffc93c` | `Client Presentation.dc.html` |
| Dealer Dashboard | violet `#5b32c4` | `Dealer Dashboard.dc.html` |
| Team Workspace | forest `#1f4d3a` | `Team Workspace.dc.html` |

Each card: coloured header band with an icon tile, then title (Newsreader 27px/500),
one line of description (15px/1.5, `#6b6156`), and a "Open →" row (15px/800 in the card's accent).
Hover: lift `translateY(-2px)` + diagonal sheen sweep + shadow deepen, 150ms.

## Interactions
- Cards are links (real navigation, not JS routing).
- Clock ticks on a 60s interval; greeting recomputes from the hour.
- Entry: each block animates in with `wRise`, staggered ~60ms.

## State
`{ now: Date }` only. Everything else is static.
