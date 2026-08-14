// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { earthShellHtml } from '../src/apps/earth/main';

const v2Root = join(__dirname, '..');
const source = (path: string): string => readFileSync(join(v2Root, path), 'utf8');

/* MAPCO Earth is the Client Presentation surface: it is shown to a buyer in
   the room. These lock the two things that must stay true — the Masterplan
   and 3D views render REAL authored maps (not placeholders), and nothing on
   the browse sheets leaks a dealer-only figure. */
describe('Earth Masterplan and 3D render real maps', () => {
  const plan = source('src/apps/earth/plan-maps.ts');
  const main = source('src/apps/earth/main.ts');

  it('drives the shared map engine rather than a placeholder', () => {
    expect(plan).toContain('mountMapEngine');
    expect(plan).toContain('registerMaps');
    expect(plan).toContain('adapter.presentation.listMaps(');
    expect(main).toContain('showPlan(');
  });

  it('no longer ships the "will appear here" placeholder copy', () => {
    for (const gone of [
      'The official plot layout for this area will appear here',
      'The 3D presentation layout for this area will appear here',
    ]) expect(main).not.toContain(gone);
  });

  it('releases the raster engine when the live map is showing', () => {
    expect(main).toContain('teardownPlan(');
    expect(plan).toMatch(/mounted\?\.dispose\(\)/);
  });

  it('only ever registers published, client-visible maps', () => {
    expect(plan).toMatch(/entry\.published && !entry\.hidden/);
  });

  it('degrades honestly when a rendering is missing', () => {
    expect(plan).toContain('3D not available');
    expect(plan).toContain('No maps published');
  });

  /* Regression: the map engine sets `position:relative` inline on its mount
     root, which beat the stylesheet's `position:absolute`. `inset:0` then
     offset the box without stretching it, the stage measured 1280×0, and
     `overflow:hidden` clipped the whole map away — the raster loaded but
     nothing was ever visible. */
  it('gives the raster stage an explicit size that survives inline position', () => {
    const css = source('src/apps/earth/earth.css');
    const rule = css.slice(css.indexOf('.e-plan-stage {'), css.indexOf('.e-plan-stage:active'));
    expect(rule).toMatch(/width:\s*100%/);
    expect(rule).toMatch(/height:\s*100%/);
    // An entrance animation with fill-mode:both can strand the map at opacity 0.
    expect(rule).not.toMatch(/animation:/);
  });

  it('re-fits the raster once the stage has real layout', () => {
    expect(plan).toContain('ResizeObserver');
    expect(plan).toMatch(/observer\?\.disconnect\(\)/);
  });
});

describe('Earth browse sheets stay client-safe', () => {
  const main = source('src/apps/earth/main.ts');
  // Code only — comments describing the boundary must not satisfy it.
  const sheets = main
    .slice(main.indexOf('BROWSE SHEETS'), main.indexOf('SEARCH  ('))
    .replace(/^[\s\S]*?\*\//, '')        // the slice opens mid banner-comment
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('renders no price, seller, commission or owner on the browse sheets', () => {
    for (const forbidden of [/\bp\.price\b/, /\bprice\b\s*[:}]/, /seller/i, /commission/i, /\bowner\b/i]) {
      expect(sheets).not.toMatch(forbidden);
    }
  });

  it('exposes both browse openers outside the reserved top-right', () => {
    const host = document.createElement('div');
    host.innerHTML = earthShellHtml();
    expect(host.querySelector('#e-open-props')).not.toBeNull();
    expect(host.querySelector('#e-open-sectors')).not.toBeNull();
    // The top-right stays reserved for the four view modes.
    expect(host.querySelector('.e-topright #e-open-props')).toBeNull();
    expect(host.querySelector('.e-topright #e-open-sectors')).toBeNull();
  });

  /* Regression: the openers first lived inside `.e-mine`, which is
     pointer-events:none so the map stays draggable through the cluster.
     They inherited that and were rendered-but-inert — visible, perfectly
     styled, and completely unclickable. */
  it('re-enables pointer events on the browse buttons', () => {
    const css = source('src/apps/earth/earth.css');
    const btn = css.slice(css.indexOf('.e-sheetbtn {'), css.indexOf('.e-sheetbtn:hover'));
    expect(btn).toMatch(/pointer-events:\s*auto/);
  });

  /* Regression: at z-index 35 inside `.e-mine`, an open browse sheet
     (z-index 40) buried the openers, so Properties could not be switched
     to Sector without closing first. */
  it('keeps the openers above the browse sheet in their own layer', () => {
    const host = document.createElement('div');
    host.innerHTML = earthShellHtml();
    const browse = host.querySelector('.e-browse');
    expect(browse).not.toBeNull();
    expect(browse!.querySelector('#e-open-props')).not.toBeNull();
    expect(host.querySelector('.e-mine #e-open-props')).toBeNull();

    const css = source('src/apps/earth/earth.css');
    const rule = css.slice(css.indexOf('.e-browse {'), css.indexOf('.e-sheetbtn {'));
    const z = Number(rule.match(/z-index:\s*(\d+)/)?.[1]);
    expect(z).toBeGreaterThan(40);
  });
});
