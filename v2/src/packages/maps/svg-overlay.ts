/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Premium SVG highlight overlay (the blueprint renderer)
   ---------------------------------------------------------------
   Renders the authored masterplan geometry as a PREMIUM highlight:
     • a dimming mask darkens everything except the highlighted items
     • blocks/sectors are extruded into glossy 3D isometric shapes
     • roads glow with an animated energy "flow" dash
     • a transparent hit layer makes every shape individually clickable
   Selecting is instant + multi-select: click a road/block on the map and
   it lights up immediately, click more to add them, click again to remove.

   Geometry comes from the REAL aligned SVG (`<path id>` per road/sector),
   so nothing is redrawn or approximated. The overlay shares the ONE map
   transform (applied by the caller), so it stays glued to the raster + pins
   through zoom / pan / fit / fullscreen. Never shown on the 3D rendering.
   ═══════════════════════════════════════════════════════════════ */

import type { Dimensions } from './registry';

const SVGNS = 'http://www.w3.org/2000/svg';

export type ItemKind = 'road' | 'block';

export interface HighlightItem {
  readonly id: string;
  readonly kind: ItemKind;
  readonly label: string;
  /** authored path data (its own = the raster's coordinate space). */
  readonly d: string;
}

export interface SvgHighlightHandle {
  /** the render-target <svg> (append to the shared, transform-synced layer). */
  readonly el: SVGSVGElement;
  readonly viewBox: Dimensions;
  /** every selectable authored shape (for the studio list / search). */
  items(): HighlightItem[];
  /** current selected item ids. */
  selection(): string[];
  setSelection(ids: readonly string[]): void;
  toggle(id: string): void;
  clear(): void;
  /** enable/disable clicking shapes on the map (hit layer). */
  setInteractive(on: boolean): void;
  /** notified whenever the selection changes (studio save / presentation UI). */
  onSelectChange(cb: (ids: string[]) => void): void;
  /** hide/show the whole overlay (hidden on the 3D rendering). */
  setVisible(visible: boolean): void;
  /** accent color for the highlight (a saved set can override per-set). */
  setAccent(hex: string): void;
  /** render text names on shapes: { itemId: name }. Empty clears them. */
  setLabels(labels: Record<string, string>): void;
  destroy(): void;
}

/* ── color math (from the blueprint) ─────────────────────────── */
function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
}
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt);
  return `rgb(${r},${g},${b})`;
}
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

const CONTAINER_RE = /masterplan|export|frame|full ?map/i;
const ROAD_RE = /road|approach|route|highway|spine|arterial|expressway/i;
const SKIP_RE = /pin|label|marker|text/i;
// Oversized container shapes that would "light up a whole zone" when clicked —
// excluded from the individually-highlightable items (item 4).
const EXCLUDE_RE = /full ?map|boundary|outline|frame|export|whole ?map|guide|all?ign|^zone[\s-]?\d*$|^zone \d/i;
const GENERIC_ID_RE = /^(vector|path|rect|group|shape|ellipse|line|polygon)[\s_-]*\d*$/i;

function cleanLabel(id: string): string {
  const t = id.trim().replace(/\s+/g, ' ');
  if (/^\d+[a-z]?$/i.test(t)) return `Sector ${t}`;
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Convert a <polygon>/<polyline> points attr to a path `d` (so everything
 *  is a uniform path for the renderer). */
function pointsToPath(points: string, close: boolean): string {
  const nums = points.trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
  let d = '';
  for (let i = 0; i + 1 < nums.length; i += 2) d += (i === 0 ? 'M' : 'L') + nums[i] + ' ' + nums[i + 1];
  return d + (close ? 'Z' : '');
}

function sanitize(root: Element): void {
  root.querySelectorAll('script,foreignObject,style,image').forEach((n) => n.remove());
}

export async function loadSvgOverlay(
  src: string,
  viewBox: Dimensions,
  opts: { signal?: AbortSignal; accent?: string } = {},
): Promise<SvgHighlightHandle | null> {
  let text: string;
  try {
    const res = await fetch(src, { signal: opts.signal });
    if (!res.ok) return null;
    text = await res.text();
  } catch { return null; }

  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const authored = doc.querySelector('svg');
  if (!authored || doc.querySelector('parsererror')) return null;
  sanitize(authored);

  // ── extract items from the authored geometry ──────────────────
  // A shape's kind: 'road' if it (or an ancestor group) is a road group OR the
  // shape is an unclosed path; otherwise 'block' (extrudable sector/zone/block).
  const items: HighlightItem[] = [];
  const seen = new Set<string>();
  const shapeEls = authored.querySelectorAll<SVGElement>('path[d], polygon[points], polyline[points]');
  shapeEls.forEach((shape) => {
    const id = shape.getAttribute('id') || '';
    // an ancestor <g id> gives context (roads vs sectors)
    let groupId = '';
    for (let p = shape.parentElement; p; p = p.parentElement) {
      const gid = p.getAttribute?.('id');
      if (gid && !CONTAINER_RE.test(gid)) { groupId = gid; break; }
    }
    if (SKIP_RE.test(id) || SKIP_RE.test(groupId)) return;
    // Skip whole-zone / full-map / alignment-guide shapes so a click never
    // highlights an entire zone unnecessarily (item 4). Named blocks remain.
    if (EXCLUDE_RE.test(id) || EXCLUDE_RE.test(groupId)) return;
    const tag = shape.tagName.toLowerCase();
    let d = '';
    if (tag === 'path') d = shape.getAttribute('d') || '';
    else d = pointsToPath(shape.getAttribute('points') || '', tag === 'polygon');
    if (!d) return;
    const isRoad = ROAD_RE.test(groupId) || ROAD_RE.test(id) || (tag === 'polyline') ||
      (tag === 'path' && !/z\s*$/i.test(d.trim())); // open path → road-like
    // Prefer the shape id; fall back to a stable synthetic id.
    const key = id || `${groupId || tag}-${items.length}`;
    if (seen.has(key)) return;
    seen.add(key);
    const labelBase = id && !GENERIC_ID_RE.test(id.trim()) ? id : (groupId ? `${cleanLabel(groupId)} ${items.length + 1}` : `Shape ${items.length + 1}`);
    items.push({ id: key, kind: isRoad ? 'road' : 'block', label: cleanLabel(labelBase), d });
  });

  // ── build the render target ───────────────────────────────────
  const el = document.createElementNS(SVGNS, 'svg');
  el.setAttribute('viewBox', `0 0 ${viewBox.w} ${viewBox.h}`);
  el.setAttribute('preserveAspectRatio', 'none');
  el.setAttribute('width', String(viewBox.w));
  el.setAttribute('height', String(viewBox.h));
  el.classList.add('pm-hlsvg');
  el.style.cssText = 'position:absolute;top:0;left:0;transform-origin:0 0;overflow:visible;pointer-events:none';

  // proportional scale (blueprint constants were authored for ~1036px tall)
  const s = viewBox.h / 1036;
  const lift = Math.max(12, Math.round(18 * s));

  el.innerHTML = `
    <defs>
      <linearGradient id="pmgrad0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbd38d" stop-opacity=".55"/><stop offset="1" stop-color="#F59E0B" stop-opacity=".78"/></linearGradient>
    </defs>
    <g data-dim style="pointer-events:none"></g>
    <g data-under style="pointer-events:none"></g>
    <g data-mid style="pointer-events:none"></g>
    <g data-top style="pointer-events:none"></g>
    <g data-labels style="pointer-events:none"></g>
    <g data-hits></g>`;
  const dimG = el.querySelector('[data-dim]') as SVGGElement;
  const underG = el.querySelector('[data-under]') as SVGGElement;
  const midG = el.querySelector('[data-mid]') as SVGGElement;
  const topG = el.querySelector('[data-top]') as SVGGElement;
  const labelsG = el.querySelector('[data-labels]') as SVGGElement;
  const hitsG = el.querySelector('[data-hits]') as SVGGElement;

  const byId = new Map(items.map((it) => [it.id, it]));
  const selected = new Set<string>();
  let accent = opts.accent ?? '#F59E0B';
  let interactive = false;
  let labelMap: Record<string, string> = {};
  let changeCb: ((ids: string[]) => void) | null = null;

  const glow = '#FFD97A';
  const fs = Math.max(11, Math.round(viewBox.h / 60));

  function renderLabels(): void {
    let txt = '';
    for (const [id, name] of Object.entries(labelMap)) {
      if (!name) continue;
      const shape = el.querySelector(`[data-hit="${id.replace(/["\\]/g, '\\$&')}"]`) as SVGGraphicsElement | null
        ?? el.querySelector(`[id="${id.replace(/["\\]/g, '\\$&')}"]`) as SVGGraphicsElement | null;
      if (!shape || typeof shape.getBBox !== 'function') continue;
      let b; try { b = shape.getBBox(); } catch { continue; }
      if (!b.width || !b.height) continue;
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const safe = name.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
      txt += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" style="font-family:'Hanken Grotesk',system-ui,sans-serif;font-weight:800;font-size:${fs}px;fill:#fffdf7;paint-order:stroke;stroke:#1a1206;stroke-width:${(fs / 4).toFixed(1)}px;stroke-linejoin:round">${safe}</text>`;
    }
    labelsG.innerHTML = txt;
  }

  function renderHighlights(): void {
    let maskCuts = '';
    let under = '';
    let mid = '';
    let top = '';
    const col = accent;
    const topFace = lighten(col, 0.34);
    const topEdge = lighten(col, 0.74);
    const steps = 5;

    for (const id of selected) {
      const it = byId.get(id);
      if (!it) continue;
      const d = it.d;
      if (it.kind === 'road') {
        maskCuts += `<path d="${d}" fill="none" stroke="black" stroke-width="${46 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
        under += `<path d="${d}" fill="none" stroke="rgba(0,24,48,.55)" stroke-width="${16 * s}" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,${5 * s})" style="filter:blur(${6 * s}px)"/>`;
        mid += `<path d="${d}" fill="none" stroke="${rgba(glow, .72)}" stroke-width="${11 * s}" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 ${8 * s}px ${rgba(glow, .9)}) drop-shadow(0 0 ${18 * s}px ${rgba(col, .65)})"/>`;
        mid += `<path d="${d}" fill="none" stroke="rgba(235,255,255,.98)" stroke-width="${3.5 * s}" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 ${4 * s}px rgba(255,255,255,.95)) drop-shadow(0 0 ${14 * s}px ${rgba(glow, .95)})"/>`;
        mid += `<path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="${4.4 * s}" stroke-linecap="round" stroke-dasharray="${2 * s} ${32 * s}" style="pointer-events:none;filter:drop-shadow(0 0 ${5 * s}px rgba(255,255,255,1)) drop-shadow(0 0 ${12 * s}px ${rgba(glow, 1)});animation:pmflowdash 1.15s linear infinite"/>`;
      } else {
        maskCuts += `<path d="${d}" fill="black"/>`;
        maskCuts += `<path d="${d}" fill="black" transform="translate(0,${-lift})"/>`;
        under += `<path d="${d}" fill="rgba(22,15,4,.5)" transform="translate(0,${lift + 5 * s})" style="filter:blur(${9 * s}px)"/>`;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          mid += `<path d="${d}" fill="${darken(col, 0.62 - 0.46 * t)}" transform="translate(0,${(-lift * t).toFixed(1)})"/>`;
        }
        top += `<path d="${d}" fill="${topFace}" stroke="${topEdge}" stroke-width="${2 * s}" stroke-linejoin="round" transform="translate(0,${-lift})" style="filter:drop-shadow(0 ${3 * s}px ${3 * s}px rgba(26,18,6,.34))"/>`;
        top += `<path d="${d}" fill="url(#pmgrad0)" transform="translate(0,${-lift})" style="mix-blend-mode:screen;opacity:.55"/>`;
        top += `<path d="${d}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="${1 * s}" stroke-linejoin="round" transform="translate(0,${-lift - 1})"/>`;
      }
    }

    dimG.innerHTML = selected.size
      ? `<mask id="pmdim" maskUnits="userSpaceOnUse" x="-40" y="-40" width="${viewBox.w + 80}" height="${viewBox.h + 80}">
           <rect x="-40" y="-40" width="${viewBox.w + 80}" height="${viewBox.h + 80}" fill="white"/>${maskCuts}
         </mask>
         <rect x="-40" y="-40" width="${viewBox.w + 80}" height="${viewBox.h + 80}" fill="#241C10" opacity="0.46" mask="url(#pmdim)"/>`
      : '';
    underG.innerHTML = under;
    midG.innerHTML = mid;
    topG.innerHTML = top;
  }

  function renderHits(): void {
    if (!interactive) { hitsG.innerHTML = ''; return; }
    let hits = '';
    for (const it of items) {
      if (it.kind === 'road') {
        hits += `<path d="${it.d}" fill="none" stroke="rgba(0,0,0,0)" stroke-width="${22 * s}" style="cursor:pointer;pointer-events:stroke" data-hit="${it.id}"/>`;
      } else {
        // shift the hit up by the lift so it covers the extruded top face
        hits += `<path d="${it.d}" fill="rgba(0,0,0,0)" transform="translate(0,${-lift})" style="cursor:pointer;pointer-events:fill" data-hit="${it.id}"/>`;
        hits += `<path d="${it.d}" fill="rgba(0,0,0,0)" style="cursor:pointer;pointer-events:fill" data-hit="${it.id}"/>`;
      }
    }
    hitsG.innerHTML = hits;
    hitsG.style.pointerEvents = 'auto';
  }

  const onHitClick = (ev: Event) => {
    const t = (ev.target as Element).closest('[data-hit]') as SVGElement | null;
    if (!t) return;
    ev.stopPropagation();
    handle.toggle(t.getAttribute('data-hit')!);
  };
  el.addEventListener('click', onHitClick);

  const notify = () => { changeCb?.([...selected]); };

  const handle: SvgHighlightHandle = {
    el,
    viewBox,
    items: () => items.slice(),
    selection: () => [...selected],
    setSelection(ids) { selected.clear(); for (const id of ids) if (byId.has(id)) selected.add(id); renderHighlights(); notify(); },
    toggle(id) { if (!byId.has(id)) return; if (selected.has(id)) selected.delete(id); else selected.add(id); renderHighlights(); notify(); },
    clear() { if (!selected.size) return; selected.clear(); renderHighlights(); notify(); },
    setInteractive(on) { interactive = on; renderHits(); },
    onSelectChange(cb) { changeCb = cb; },
    setVisible(v) { el.style.display = v ? '' : 'none'; },
    setAccent(hex) { accent = hex; renderHighlights(); },
    setLabels(m) { labelMap = { ...m }; renderLabels(); },
    destroy() { el.removeEventListener('click', onHitClick); el.remove(); },
  };
  renderHighlights();
  return handle;
}
