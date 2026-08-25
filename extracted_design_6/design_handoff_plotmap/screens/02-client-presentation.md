# 02 · Client Presentation (`Client Presentation.dc.html`)

**This is the hero screen** — it is what a buyer sees across the table. Design intent:
the map fills the screen and the UI disappears. Preview size 1440 × 900, but it must fill
any viewport including a tablet in landscape.

## Top-level state
```js
{ view:'masterplan'|'properties'|'sectors',
  dim:'original'|'3d', hl:null|'A'|'B'|'C',      // active masterplan highlight set
  zoom:1, tx:0, ty:0, dragging:false,            // map pan/zoom transform
  mapsOpen:false, filterOpen:false, cat:'all',   // popovers + property-type filter
  pins:[],                                       // ids of pinned plots shown on the map
  lb:null, shot:0, vw:1440, vh:900,              // lightbox + photo index + viewport
  pcity:'All', scity:'All',                      // city filters (properties / sectors)
  pd:null, pdShot:0,                             // open property detail + its gallery index
  sec:null, secDim:'original', secSet:'A' }      // open sector layout + its toggles
```
Map raster box: `MAP_W = 1302`, `MAP_H = 962`. **All mark coordinates are normalised 0–1**
against that box, so overlays scale with the image.

## View A — Masterplan (default)
Full-bleed map, no page chrome. Chrome is transparent glass floating over it:

- **Top-left glass bar** — map picker (city name + caret, opens `MAPS` list; only New Chandigarh
  is `ready:true`, the rest render disabled), an Original / 3D map segmented toggle
  (`DIMS`, icons `ph-fill ph-map-trifold` / `ph-fill ph-cube`), and a filter button.
  Tabs: 38px tall, radius 10px, 14.5px/800; active = solid, inactive = transparent.
- **View tabs** (`VIEWS`): Masterplan · Properties · Sector maps.
- **Bottom-left** — one small pill cycling the map style.
- **Bottom-right** — zoom in / out / reset (`zoomBy(±0.3)`) and the pin count. Unobtrusive.
- **Pins**: multiple plots can be pinned at once. Dot = 13px circle, `background:#ffc21e`,
  `border:3px solid #fffdfb`, `box-shadow:0 0 16px #ffc21e` — a hard glowing halo, not a soft blur.
- **Photo rail** on the right edge for the active pin's photos.
- Pan by drag (`onDown`), zoom by wheel (`onWheel`); transform is `translate(tx,ty) scale(zoom)`.

### Highlight sets (`HLSETS`)
Three named sets — `A` "Roads & approach", `B` (blocks/sectors), `C` (landmark pins).
Each holds `roads: [[[x,y],…]]` polylines, `blocks: [...]` polygons and `pins: [{x,y,n}]`.
The client taps A/B/C and only that set lights up, in gold. Sets are authored in Map Studio.

## View B — Properties
Full page (top bar hides completely). Violet-dusk bloom background.
City chips + a property-type filter (`CATS`: Everything / My plots / … each with its own
`c` text colour and `bg` bed colour). Grid of photo-led property cards — photo is the hero.

**Property detail** (`pd`): full page, **no price**.
- Gallery with thumbnail strip; captions from `CAPTIONS` = Site view · Approach road ·
  Surroundings · Front road · Wide angle · Evening view. `pdShot` cycles 0–5.
- Facts grid (size, facing, position, approvals) and landmarks with distances.
- **Four action buttons pinned to the bottom**: Masterplan (pins this plot and returns to
  the map), Sector map (opens its layout), Street view (Google Street View URL from the
  sector), WhatsApp (`https://wa.me/?text=<name — size · facing · sector>`).

## View C — Sector maps
City chips → layout cards, each with its own Original / 3D toggle.
A/B/C highlight buttons appear **only for masterplans**, never for sector layouts.
Right panel: dark translucent glass with a hairline edge, listing the plots on that layout.
Roads / blocks / pins glow gold when a set is active.

## Interactions & motion
- Opening Properties or a Sector map hides the top bar; going Back restores it.
- Popovers (map picker, filter) close on outside click and on view change.
- All transitions 150ms; map transform is not animated during drag.
- Photo lightbox (`lb`) with keyboard next/prev.

## Notes for implementation
- The map layer wants to be a single `<img>` plus an absolutely-positioned SVG overlay sized
  to the same normalised box — not a tile server. Do not introduce a mapping library; these
  are raster masterplans, not geographic maps.
- Chrome must stay readable over both light and dark map regions: glass = translucent light
  fill + 1px hairline + backdrop blur.
