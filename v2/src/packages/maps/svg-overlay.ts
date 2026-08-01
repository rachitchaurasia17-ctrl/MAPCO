/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Real SVG highlight overlay
   ---------------------------------------------------------------
   Renders the authored masterplan SVG INLINE (real <g>/<path> geometry)
   over the Original raster so we can spotlight the actual authored
   groups and shapes — never fake rectangles.

   • Broad highlight sets are DERIVED from the SVG's real authored groups
     (roads / sectors-blocks-zones / landmarks-places).
   • Individual spotlight targets a single authored <path>/<polygon> by id
     (e.g. Mohali sector "66"; New Chandigarh "omaxe phase 3").
   • The overlay shares the SAME transform as the raster + pins (applied by
     the caller to the layer), so zoom/pan/fit/fullscreen stay in sync.
   • Base geometry is invisible (CSS): only highlighted elements glow, so
     the raster reads cleanly until the dealer highlights something.
   • NEVER used on the 3D rendering — the caller hides the layer in 3D.

   The SVG is fetched from public Storage and sanitized (no scripts / no
   event handlers) before injection.
   ═══════════════════════════════════════════════════════════════ */

import type { Dimensions } from './registry';

export type HighlightCategory = 'roads' | 'sectors' | 'places';

export interface BroadSet {
  readonly id: HighlightCategory;
  readonly category: HighlightCategory;
  readonly label: string;
}

export interface SpotTarget {
  /** authored element id (spotlight key). */
  readonly id: string;
  /** human label for search/menus. */
  readonly label: string;
  readonly category: HighlightCategory;
}

export interface SvgOverlayHandle {
  readonly el: SVGSVGElement;
  readonly viewBox: Dimensions;
  /** broad sets present in THIS map's authored SVG (subset of the three). */
  broadSets(): BroadSet[];
  /** named/numbered shapes that can be individually spotlighted. */
  spotTargets(): SpotTarget[];
  /** toggle a broad category on (null clears the broad highlight). */
  setBroad(category: HighlightCategory | null): void;
  /** spotlight a single authored shape by id (null clears). */
  spotlight(id: string | null): void;
  /** fuzzy-find a spotlight target id from a free-text query. */
  findTarget(query: string): string | null;
  /** hide/show the whole overlay (hidden on the 3D rendering). */
  setVisible(visible: boolean): void;
  /** re-apply the current broad + spotlight state (after a re-parent/paint). */
  reapply(): void;
  destroy(): void;
}

const CONTAINER_RE = /masterplan|export|frame|full ?map|^g$/i;
const ROAD_RE = /road|approach|route|highway/i;
const SECTOR_RE = /sector|zone|block|pocket|phase|plot/i;
const PLACE_RE = /pin|place|landmark|stadium|school|hospital|market|temple|mall|college|university|park|club|branch|tower|medcity/i;
const GENERIC_ID_RE = /^(vector|path|rect|group|shape|ellipse|line|polygon)[\s_-]*\d*$/i;

const CATEGORY_LABEL: Record<HighlightCategory, string> = {
  roads: 'Roads & approaches',
  sectors: 'Sectors & blocks',
  places: 'Landmarks & places',
};

function categorize(id: string): HighlightCategory | null {
  if (CONTAINER_RE.test(id)) return null;
  if (ROAD_RE.test(id)) return 'roads';
  if (PLACE_RE.test(id)) return 'places';
  if (SECTOR_RE.test(id)) return 'sectors';
  return null;
}

function cleanLabel(id: string): string {
  const t = id.trim().replace(/\s+/g, ' ');
  if (/^\d+[a-z]?$/i.test(t)) return `Sector ${t}`;
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strip anything executable from a foreign SVG before we inject it. */
function sanitize(root: Element): void {
  root.querySelectorAll('script,foreignObject,style').forEach((n) => n.remove());
  const walk = (el: Element) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || (name === 'href' && /^\s*javascript:/i.test(attr.value))) el.removeAttribute(attr.name);
    }
    for (const child of [...el.children]) walk(child);
  };
  walk(root);
}

export async function loadSvgOverlay(
  src: string,
  viewBox: Dimensions,
  opts: { signal?: AbortSignal } = {},
): Promise<SvgOverlayHandle | null> {
  let text: string;
  try {
    const res = await fetch(src, { signal: opts.signal });
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null; // network / abort → caller falls back to raster-only
  }
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg || doc.querySelector('parsererror')) return null;

  const el = document.importNode(svg, true) as SVGSVGElement;
  sanitize(el);

  // Normalize the coordinate space to the calibrated viewBox and size it at
  // intrinsic pixels so the caller's cssMapTransform overlays it 1:1 on the raster.
  el.setAttribute('viewBox', `0 0 ${viewBox.w} ${viewBox.h}`);
  el.setAttribute('preserveAspectRatio', 'none');
  el.setAttribute('width', String(viewBox.w));
  el.setAttribute('height', String(viewBox.h));
  el.classList.add('pm-ov');
  el.style.cssText = 'position:absolute;top:0;left:0;transform-origin:0 0;overflow:visible;pointer-events:none';

  // Classify authored groups → broad categories.
  const groupsByCat: Record<HighlightCategory, Element[]> = { roads: [], sectors: [], places: [] };
  el.querySelectorAll('g[id]').forEach((g) => {
    const cat = categorize(g.getAttribute('id') || '');
    if (cat) groupsByCat[cat].push(g);
  });

  // Fallback for flat overlays (no authored groups, e.g. the Aerocity roads
  // overlay): treat the whole overlay as a single "roads" set.
  const flat = groupsByCat.roads.length === 0 && groupsByCat.sectors.length === 0 && groupsByCat.places.length === 0;
  if (flat) groupsByCat.roads.push(el);

  // Collect individually-spotlightable shapes (named/numbered) inside the
  // sector + place groups. Skip generic ids (Vector 30) — not searchable.
  const targets: SpotTarget[] = [];
  const seen = new Set<string>();
  const collect = (groups: Element[], category: HighlightCategory) => {
    for (const g of groups) {
      g.querySelectorAll('[id]').forEach((shape) => {
        if (shape.tagName.toLowerCase() === 'g') return;
        const id = shape.getAttribute('id') || '';
        if (!id || seen.has(id) || GENERIC_ID_RE.test(id.trim())) return;
        seen.add(id);
        targets.push({ id, label: cleanLabel(id), category });
      });
    }
  };
  collect(groupsByCat.sectors, 'sectors');
  collect(groupsByCat.places, 'places');
  targets.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  let broad: HighlightCategory | null = null;
  let spotId: string | null = null;

  const shapeById = (id: string): Element | null => {
    const escaped = id.replace(/["\\]/g, '\\$&');
    return el.querySelector(`[id="${escaped}"]`);
  };

  const reapply = () => {
    for (const cat of ['roads', 'sectors', 'places'] as HighlightCategory[]) {
      const on = broad === cat;
      for (const g of groupsByCat[cat]) g.classList.toggle(`pm-hl-${cat}`, on);
    }
    el.querySelectorAll('.pm-spot').forEach((n) => n.classList.remove('pm-spot'));
    if (spotId) shapeById(spotId)?.classList.add('pm-spot');
  };

  const handle: SvgOverlayHandle = {
    el,
    viewBox,
    broadSets: () =>
      (['roads', 'sectors', 'places'] as HighlightCategory[])
        .filter((c) => groupsByCat[c].length > 0)
        .map((c) => ({ id: c, category: c, label: CATEGORY_LABEL[c] })),
    spotTargets: () => targets.slice(),
    setBroad(category) { broad = category; reapply(); },
    spotlight(id) { spotId = id; reapply(); },
    findTarget(query) {
      const q = query.trim().toLowerCase();
      if (!q) return null;
      const num = q.match(/(\d+[a-z]?)/)?.[1];
      // exact id, then numeric sector, then label contains
      return (
        targets.find((t) => t.id.toLowerCase() === q)?.id ??
        (num ? targets.find((t) => t.id.toLowerCase() === num)?.id : undefined) ??
        targets.find((t) => t.label.toLowerCase().includes(q))?.id ??
        null
      );
    },
    setVisible(visible) { el.style.display = visible ? '' : 'none'; },
    reapply,
    destroy() { el.remove(); },
  };
  return handle;
}
