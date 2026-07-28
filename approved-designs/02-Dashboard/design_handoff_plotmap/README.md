# Handoff: PlotMap — map-first property presentation tool

## Overview
PlotMap is a desktop/tablet web app for Indian real-estate dealers (users are typically 40–60,
non-technical, on Windows laptops or tablets, often in a live meeting with a buyer sitting beside them).
It has four surfaces:

| # | File | Who uses it | Job |
|---|------|-------------|-----|
| 1 | `PlotMap Landing.dc.html`      | anyone | entry hub, routes to the three apps |
| 2 | `Client Presentation.dc.html` | dealer, projected/shown to buyer | full-screen map + property browser used DURING a meeting |
| 3 | `Dealer Dashboard.dc.html`    | dealer, alone | what happened: demand signals, deals, plots, customers, private links |
| 4 | `Team Workspace.dc.html`      | dealer's staff | data entry + Map Studio (mark & publish maps) |

Mental model to keep: **Team Workspace puts data in → Client Presentation shows it to a buyer →
Dealer Dashboard reports what the buyer looked at.** Nothing a client sees exists until someone
explicitly *publishes* it.

## About the design files
The files in `design/` are **design references written in HTML**, not production code.
They are prototypes that show intended look, copy and behaviour. They use a small in-house
runtime (`support.js`, `.dc.html` = template + a `class Component` logic block) — **do not port
that runtime.** Recreate these screens in the target codebase's own environment (React/Next,
Vue, SwiftUI, whatever exists) using its established patterns, component library and routing.
If there is no codebase yet, pick a stack (React + Vite + TypeScript is a fine default for this
app; it is heavily interactive, canvas/overlay-driven, and desktop-first) and implement there.

How to read a `.dc.html` file:
- Everything between `<x-dc>` and the trailing `<script type="text/x-dc">` is the **markup**, styled
  with **inline styles only** — every hex value, size and radius you need is literally in the markup.
- The `class Component extends DCLogic { ... }` block at the bottom is the **logic**: `state`,
  seed data arrays (`PROPS`, `NAV`, `STAGES`, `HLSETS`, …), and a `renderVals()` method that
  returns every value the markup interpolates. Read `renderVals()` to learn the derived data
  and view-model shape for each screen.
- `{{ x }}` = a value from `renderVals()`. `<sc-for list="{{ items }}" as="item">` = a list map.
  `<sc-if value="{{ flag }}">` = a conditional. `style-hover="..."` = a `:hover` style.

## Fidelity
**High fidelity.** Colours, type, spacing, radii, copy and interaction states are final and
intentional — recreate them pixel-accurately. Only two things are placeholders:
1. **Photography** — `assets/ph-*.png` are stand-ins for real plot photos.
2. **Map artwork** — only New Chandigarh (`assets/map-src.png`) is a real masterplan; the other
   ~180 city/sector layouts are not wired in yet.

---

## Design tokens

### Colour — "violet dusk" palette
Base surfaces
| Token | Hex | Use |
|---|---|---|
| base | `#f5efff` | app background (always with the bloom gradient below) |
| surface | `#fffaf0` | cards, top bars, sheets |
| surface-alt | `#faf7ff` | secondary cards, list rows |
| surface-violet | `#f0eaff` | inset segmented-control track, chip beds |
| hairline | `#ddd2f5` | 1px borders on light surfaces |
| hairline-2 | `#e4dbf7` | 1.5px card borders |

The background is never flat. Standard bloom (used on all three app pages):
```css
background:#f5efff;
background-image:
  radial-gradient(62% 50% at -2% -4%, rgba(139,96,232,.50), transparent 62%),
  radial-gradient(54% 44% at 104% 0%,  rgba(255,201,60,.42), transparent 60%),
  radial-gradient(70% 60% at 50% 108%, rgba(255,225,230,.55), transparent 65%);
```

Accent / semantic
| Token | Hex | Use |
|---|---|---|
| gold (primary action) | `#ffc93c` | primary buttons, active nav pill, logo mark, map highlight |
| gold-bright | `#ffd75e` | eyebrow text on dark surfaces |
| gold-deep | `#f4ae14` | data bars |
| gold-ink | `#8a5a0c` | link/CTA text on cream |
| gold-eyebrow | `#a8792a` | uppercase section eyebrows |
| gold-bed | `#fff3d1` | amber card background |
| gold-bed-border | `#f6d98d` | border of amber cards |
| violet | `#5b32c4` | secondary accent (clients, links, "enquiry") |
| violet-bed | `#efe8fb` / `#e7defc` | violet card / pill backgrounds |
| violet-bed-border | `#d6c6f5` | violet card border |
| forest | `#1f4d3a` | tertiary accent (send/publish), dark nav panels |
| forest-deep | `#1b3a2e` / `#1a2f24` | Map Studio hero, dark chrome |
| green | `#12704a` | "live/published" text |
| green-bright | `#12a150` | live dot, success |
| green-bed | `#dcf3e5` / `#d9f5e3` | success/live pill bed |
| green-bed-border | `#b3e0c6` | live card border |
| rose-bed | `#ffe1e6` | rose accent tile |
| map-pin glow | `#ffc21e` | pin dot + `box-shadow:0 0 16px #ffc21e` |

Ink
| Token | Hex | Use |
|---|---|---|
| ink | `#241f1c` | headings |
| ink-2 | `#3a332c` | strong body |
| ink-muted | `#6b6156` | body copy |
| ink-soft | `#8d8271` | captions, meta |
| on-dark | `#faf7ff` | text on forest |
| on-dark-muted | `#c9dbcf` | body on forest |

Links (global): `a { color:#7d6c40 }`, `a:hover { color:#5f5130 }`.

### Typography
- Display / numerals: **Newsreader** (serif), weights 400/500/600 — `font-weight:500` almost everywhere.
- UI / body: **Hanken Grotesk**, weights 400–800. Body 15–17px; labels 800 weight.
- Google Fonts: `Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Hanken+Grotesk:wght@400;500;600;700;800`
- Scale (Newsreader): page H1 42–46px / `letter-spacing:-.025em` / `line-height:1.02–1.05`;
  section H1 38px / `-.02em`; card title 27–29px / `-.015em`; sheet title 25–26px / `-.02em`;
  big stat 34px / `line-height:1`; wordmark 20px / 600 / `-.01em`.
- Scale (Hanken): lead paragraph 17px/1.5; body 16.5px; card body 15px/1.5; meta 13.5–14px;
  eyebrow 11.5–12px, weight 800, `letter-spacing:.16–.2em`, uppercase.
- All numeric data uses tabular figures (`font-variant-numeric:tabular-nums`).
- Long copy gets `text-wrap:pretty`.

### Spacing, radius, shadow, motion
- Page gutter 34px; content max-width 1140px; grid gap 18px; card padding 26px (sheets 22–24px).
- Radii: 26px hero panel · 24px launcher card · 22px card · 20px icon tile (64px) ·
  18px stat tile · 17/16px icon tile (52–56px) · 14px nav pill & input · 13px pill ·
  11–10px small chip · 999px status pill · 50% dot.
- Card shadow: `0 1px 2px rgba(30,28,22,.03), 0 16px 38px -30px rgba(30,28,22,.7)`
- Icon-tile shadow: `0 14px 24px -16px rgba(120,86,10,.9)` (gold) / `rgba(52,28,120,.9)` (violet) / `rgba(12,45,30,.9)` (forest)
- Enter animation: `@keyframes wRise { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }`
  run as `wRise .5s cubic-bezier(.2,.8,.2,1) both`, staggered per block.
- Bar growth: `barGrow .85s cubic-bezier(.2,.8,.2,1) both` (scaleX from left).
- Hover: 150ms; cards lift `translateY(-2px)` and gain sheen. Counters animate over ~1050ms with a cubic ease-out.
- Custom scrollbar on scroll containers: 10px wide, thumb `#e6cf9a`, radius 9px, 3px transparent border, transparent track.

### Icons
**Phosphor Icons** v2.1.1 (regular + fill). `ph-<name>` regular, `ph-fill ph-<name>` fill,
`ph-bold ph-arrow-right` for CTA arrows. Active nav/tab switches regular → fill.

---

## Screens
Detailed per-screen specs live in `screens/`:
- `screens/01-landing.md`
- `screens/02-client-presentation.md`
- `screens/03-dealer-dashboard.md`
- `screens/04-team-workspace.md`

## Data model
See `data-model.md` — the entities (Property, Client, Deal, ClientLink, Map, MarkSet, Mark)
and the publish/visibility rules that govern all four screens. **The visibility rules are the
product**; get those right before styling.

## Cross-cutting rules (non-negotiable)
1. **Nothing is client-visible by default.** Properties and maps carry a published flag; the
   Client Presentation and the private client link only ever read published records.
2. **Prices are never shown to the client** unless the dealer explicitly turns price on for
   that specific share.
3. **No fabricated analytics.** Only three signals are real and may be displayed: plot opens
   during a presentation, private-link opens, and stock counts. Do not add invented metrics,
   trend percentages or scores.
4. **Non-technical users.** Copy is plain spoken English ("Take off", "Not published",
   "Add a property"), never jargon. Hit targets ≥ 44px. No hidden gestures without a visible
   equivalent control.
5. **Presentation mode is sacred.** During Client Presentation the map is full-bleed and chrome
   is transparent glass; opening Properties or Sector maps hides the top bar entirely.
6. Group siblings with flex/grid + `gap`, never margins-on-children.

## Assets
- `design/assets/ph-*.png` — 15 placeholder property photos. Replace with real dealer photography;
  they are used at 4:3 and 16:9 in tiles, galleries and the phone mockup.
- `design/assets/map-src.png` — real New Chandigarh masterplan raster, 1302 × 962 (`MAP_W`/`MAP_H`
  in Client Presentation; all mark coordinates are normalised 0–1 against this box).
- ~180 further city and sector layout rasters (Mohali, Panchkula, Chandigarh, Aerocity) are
  **not yet supplied** — the implementation must load them by `{city, sector}` key.
- Fonts from Google Fonts; icons from the Phosphor CDN. Swap both to local/self-hosted in production.

## Files
```
design/PlotMap Landing.dc.html        entry hub
design/Client Presentation.dc.html    meeting screen (map, properties, sector maps)
design/Dealer Dashboard.dc.html       dealer's own reporting app (~2000 lines, the biggest file)
design/Team Workspace.dc.html         staff data entry + Map Studio
design/support.js                     prototype runtime — reference only, DO NOT PORT
design/assets/                        placeholder photos + New Chandigarh masterplan
```
Open any `.dc.html` directly in a browser to see it running.
