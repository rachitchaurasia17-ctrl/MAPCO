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
import { CostAwareLruCache } from '../performance';

const SVGNS = 'http://www.w3.org/2000/svg';
const MAX_PATH_DATA_LENGTH = 250_000;
const MAX_ITEM_ID_LENGTH = 256;
const SVG_PATH_DATA_RE = /^[\sMmZzLlHhVvCcSsQqTtAaEe0-9+.,-]+$/;

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVGNS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

/** Path data is the only authored SVG attribute copied into the live document.
 * Keep it inside the SVG path grammar and bounded before setAttribute sees it. */
function safePathData(value: string): string | null {
  const path = value.trim();
  if (!path || path.length > MAX_PATH_DATA_LENGTH || !SVG_PATH_DATA_RE.test(path)) return null;
  return path;
}

function safeItemId(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_ITEM_ID_LENGTH);
}

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

// Distinct bright, modern colours so several highlighted blocks read apart.
const BLOCK_PALETTE = ['#3B82F6', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#F97316', '#06B6D4', '#EF4444'];
const ROAD_PALETTE = ['#26E0FF', '#FFD97A', '#7BE0A4', '#C4B5FD'];

const CONTAINER_RE = /masterplan|export|frame|full ?map/i;
const ROAD_RE = /road|approach|route|highway|spine|arterial|expressway/i;
const SKIP_RE = /pin|label|marker|text/i;
// Oversized container shapes that would "light up a whole zone" when clicked —
// excluded from the individually-highlightable items (item 4).
const EXCLUDE_RE = /full ?map|boundary|outline|frame|export|whole ?map|guide|all?ign|unnecessary|unnecesary|^ignore$|^zone[\s-]?\d*$|^zone \d/i;
const GENERIC_ID_RE = /^(vector|path|rect|group|shape|ellipse|line|polygon)[\s_-]*\d*$/i;

function cleanLabel(id: string): string {
  const t = id.trim().replace(/\s+/g, ' ');
  if (/^\d+[a-z]?$/i.test(t)) return `Sector ${t}`;
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Convert a <polygon>/<polyline> points attr to a path `d` (so everything
 *  is a uniform path for the renderer). */
function pointsToPath(points: string, close: boolean): string {
  if (points.length > MAX_PATH_DATA_LENGTH) return '';
  const nums = points.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  let d = '';
  for (let i = 0; i + 1 < nums.length; i += 2) d += (i === 0 ? 'M' : 'L') + nums[i] + ' ' + nums[i + 1];
  return d + (close ? 'Z' : '');
}

function sanitize(root: Element): void {
  root.querySelectorAll('script,foreignObject,style,image').forEach((n) => n.remove());
}

interface ParsedSvgResource { readonly items: readonly HighlightItem[]; }
const parsedSvgCache = new CostAwareLruCache<ParsedSvgResource>(6, 6 * 1024 * 1024);
const parsedSvgInflight = new Map<string, Promise<ParsedSvgResource | null>>();

function parseSvgResource(text: string): ParsedSvgResource | null {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const authored = doc.querySelector('svg');
  if (!authored || doc.querySelector('parsererror')) return null;
  sanitize(authored);
  const items: HighlightItem[] = [];
  const seen = new Set<string>();
  authored.querySelectorAll<SVGElement>('path[d], polygon[points], polyline[points]').forEach((shape) => {
    const id = safeItemId(shape.getAttribute('id') || '');
    let groupId = '';
    for (let p = shape.parentElement; p; p = p.parentElement) {
      const gid = safeItemId(p.getAttribute?.('id') || '');
      if (gid && !CONTAINER_RE.test(gid)) { groupId = gid; break; }
    }
    if (SKIP_RE.test(id) || SKIP_RE.test(groupId) || EXCLUDE_RE.test(id) || EXCLUDE_RE.test(groupId)) return;
    const tag = shape.tagName.toLowerCase();
    const rawPath = tag === 'path' ? (shape.getAttribute('d') || '') : pointsToPath(shape.getAttribute('points') || '', tag === 'polygon');
    const d = safePathData(rawPath);
    if (!d) return;
    const isRoad = ROAD_RE.test(groupId) || ROAD_RE.test(id) || tag === 'polyline'
      || (tag === 'path' && !/z\s*$/i.test(d.trim()));
    const key = id || `${groupId || tag}-${items.length}`;
    if (seen.has(key)) return;
    seen.add(key);
    const labelBase = id && !GENERIC_ID_RE.test(id.trim()) ? id
      : (groupId ? `${cleanLabel(groupId)} ${items.length + 1}` : `Shape ${items.length + 1}`);
    items.push({ id: key, kind: isRoad ? 'road' : 'block', label: cleanLabel(labelBase), d });
  });
  return { items };
}

async function parsedSvg(
  src: string,
  opts: { signal?: AbortSignal; cacheKey?: string; expiresAt?: number; fetchText?: (src: string, signal?: AbortSignal) => Promise<string> },
): Promise<ParsedSvgResource | null> {
  const key = opts.cacheKey ?? src;
  const cached = parsedSvgCache.get(key);
  if (cached) return cached;
  const existing = parsedSvgInflight.get(key);
  if (existing) return existing;
  const pending = (async () => {
    try {
      const text = opts.fetchText
        ? await opts.fetchText(src, opts.signal)
        : await fetch(src, { signal: opts.signal }).then((response) => {
          if (!response.ok) throw new Error(`SVG ${response.status}`);
          return response.text();
        });
      const parsed = parseSvgResource(text);
      if (parsed) parsedSvgCache.set(key, parsed, { costBytes: text.length * 2, expiresAt: opts.expiresAt });
      return parsed;
    } catch { return null; }
    finally { parsedSvgInflight.delete(key); }
  })();
  parsedSvgInflight.set(key, pending);
  return pending;
}

export async function loadSvgOverlay(
  src: string,
  viewBox: Dimensions,
  opts: {
    signal?: AbortSignal;
    accent?: string;
    cacheKey?: string;
    expiresAt?: number;
    fetchText?: (src: string, signal?: AbortSignal) => Promise<string>;
  } = {},
): Promise<SvgHighlightHandle | null> {
  const parsed = await parsedSvg(src, opts);
  if (!parsed) return null;
  const items: HighlightItem[] = [...parsed.items];

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

  // Build the live SVG with DOM APIs. Authored identifiers/path data are never
  // re-parsed as markup, so quotes in an uploaded SVG cannot become attributes.
  const defs = svgElement('defs');
  const gradient = svgElement('linearGradient', { id: 'pmgrad0', x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient.append(
    svgElement('stop', { offset: 0, 'stop-color': '#fbd38d', 'stop-opacity': '.55' }),
    svgElement('stop', { offset: 1, 'stop-color': '#F59E0B', 'stop-opacity': '.78' }),
  );
  defs.append(gradient);
  const layer = (name: string, pointerEvents = 'none') => {
    const group = svgElement('g', { [`data-${name}`]: '' });
    group.style.pointerEvents = pointerEvents;
    return group;
  };
  const dimG = layer('dim');
  const underG = layer('under');
  const midG = layer('mid');
  const topG = layer('top');
  const labelsG = layer('labels');
  const hitsG = layer('hits', 'auto');
  el.append(defs, dimG, underG, midG, topG, labelsG, hitsG);

  const byId = new Map(items.map((it) => [it.id, it]));
  const selected = new Set<string>();
  let accent = opts.accent ?? '#F59E0B';
  let interactive = false;
  let labelMap: Record<string, string> = {};
  let changeCb: ((ids: string[]) => void) | null = null;

  const fs = Math.max(11, Math.round(viewBox.h / 60));

  function renderLabels(): void {
    const labels: SVGTextElement[] = [];
    const hitShapes = Array.from(hitsG.querySelectorAll<SVGGraphicsElement>('[data-hit]'));
    for (const [id, name] of Object.entries(labelMap)) {
      if (!name) continue;
      const shape = hitShapes.find((candidate) => candidate.getAttribute('data-hit') === id) ?? null;
      if (!shape || typeof shape.getBBox !== 'function') continue;
      let b; try { b = shape.getBBox(); } catch { continue; }
      if (!b.width || !b.height) continue;
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const text = svgElement('text', {
        x: cx.toFixed(1),
        y: cy.toFixed(1),
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
      });
      text.style.cssText = `font-family:'Hanken Grotesk',system-ui,sans-serif;font-weight:800;font-size:${fs}px;fill:#fffdf7;paint-order:stroke;stroke:#1a1206;stroke-width:${(fs / 4).toFixed(1)}px;stroke-linejoin:round`;
      text.textContent = String(name).slice(0, 256);
      labels.push(text);
    }
    labelsG.replaceChildren(...labels);
  }

  function renderHighlights(): void {
    const mid: SVGPathElement[] = [];
    const top: SVGPathElement[] = [];
    let blockIdx = 0;   // each block gets a distinct bright colour
    let roadIdx = 0;

    // PERFORMANCE: no per-shape blur, no stacked drop-shadows, and no infinite
    // animations. Those re-rasterise every frame and made 4-5 selections lag /
    // glitch. Each shape now uses at most ONE cheap static drop-shadow so many
    // can be highlighted smoothly.
    for (const id of selected) {
      const it = byId.get(id);
      if (!it) continue;
      const d = it.d;
      if (it.kind === 'road') {
        const rc = ROAD_PALETTE[roadIdx++ % ROAD_PALETTE.length];
        const glow = svgElement('path', {
          d, fill: 'none', stroke: rgba(rc, .85), 'stroke-width': 11 * s,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        });
        glow.style.filter = `drop-shadow(0 0 ${7 * s}px ${rgba(rc, .9)})`;
        mid.push(glow, svgElement('path', {
          d, fill: 'none', stroke: 'rgba(240,255,255,.98)', 'stroke-width': 3.2 * s,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        }));
      } else {
        const col = BLOCK_PALETTE[blockIdx++ % BLOCK_PALETTE.length];
        const topFace = lighten(col, 0.30);
        const topEdge = lighten(col, 0.72);
        // 3 cheap extrusion steps (was 6) — no blurred ground shadow.
        for (let k = 0; k <= 3; k++) {
          const t = k / 3;
          mid.push(svgElement('path', {
            d,
            fill: darken(col, 0.58 - 0.42 * t),
            transform: `translate(0,${(-lift * t).toFixed(1)})`,
          }));
        }
        const face = svgElement('path', { d, fill: topFace, transform: `translate(0,${-lift})` });
        face.style.filter = `drop-shadow(0 ${3 * s}px ${3 * s}px rgba(10,6,20,.35))`;
        const edge = svgElement('path', {
          d, fill: 'none', stroke: topEdge, 'stroke-width': 2.4 * s,
          'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke', transform: `translate(0,${-lift})`,
        });
        edge.style.filter = `drop-shadow(0 0 ${5 * s}px ${rgba(col, .85)})`;
        top.push(face, edge);
      }
    }

    // No dimming: the base map stays at full brightness. Highlights layer on top.
    dimG.replaceChildren();
    underG.replaceChildren();
    midG.replaceChildren(...mid);
    topG.replaceChildren(...top);
  }

  function renderHits(): void {
    if (!interactive) { hitsG.replaceChildren(); renderLabels(); return; }
    // Roads are thin, blocks are large areas. A generous, transparent road
    // stroke sits ON TOP so roads are easy to hit; blocks fill everything else.
    // The winner is still confirmed geometrically in onHitClick (ROAD-priority):
    // if the pointer is on/near a road stroke the road wins, otherwise the block.
    const blockHits: SVGPathElement[] = [];
    const roadHits: SVGPathElement[] = [];
    for (const it of items) {
      if (it.kind === 'road') {
        const path = svgElement('path', {
          d: it.d, fill: 'none', stroke: 'rgba(0,0,0,0)', 'stroke-width': 36 * s,
          'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'data-hit': it.id,
        });
        path.style.cssText = 'cursor:pointer;pointer-events:stroke';
        roadHits.push(path);
      } else {
        // shift the hit up by the lift so it covers the extruded top face
        for (const transform of [`translate(0,${-lift})`, '']) {
          const path = svgElement('path', {
            d: it.d, fill: 'rgba(0,0,0,0)', 'data-hit': it.id,
            ...(transform ? { transform } : {}),
          });
          path.style.cssText = 'cursor:pointer;pointer-events:fill';
          blockHits.push(path);
        }
      }
    }
    // Blocks first, roads LAST → road strokes paint on top and win the tap.
    hitsG.replaceChildren(...blockHits, ...roadHits);
    hitsG.style.pointerEvents = 'auto';
    renderLabels();
  }

  /** Resolve which shape a tap selects. ROADS take priority: if the pointer is
   *  on/near any road stroke, that road wins (roads are thin and hard to hit);
   *  only when no road is under the pointer does the block win. Purely geometric,
   *  independent of paint order. */
  const onHitClick = (ev: Event) => {
    const me = ev as MouseEvent;
    let blockId: string | null = null;
    let roadId: string | null = null;
    // elementsFromPoint returns every hit-testable element under the cursor,
    // including the transparent block-fills and (wide) road-strokes.
    const stack = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(me.clientX, me.clientY)
      : [ev.target as Element];
    for (const node of stack) {
      const hit = (node as Element).closest?.('[data-hit]') as SVGElement | null;
      if (!hit || !el.contains(hit)) continue;
      const hid = hit.getAttribute('data-hit');
      const it = hid ? byId.get(hid) : null;
      if (!it || !hid) continue;
      if (it.kind === 'road') { roadId = hid; break; }  // road wins immediately
      if (!blockId) blockId = hid;
    }
    const pick = roadId ?? blockId;
    if (!pick) return;
    ev.stopPropagation();
    handle.toggle(pick);
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
