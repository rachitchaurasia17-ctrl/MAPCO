// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EARTH_VIEW_MODES, earthShellHtml } from '../src/apps/earth/shell';

describe('MAPCO Earth toolbar composition', () => {
  it('keeps Street View and Roads with the bottom-left property controls', () => {
    const host = document.createElement('div');
    host.innerHTML = earthShellHtml();
    const brandRow = host.querySelector('.e-top-left .e-brandrow');
    const tools = host.querySelector('.e-mine #e-tools');

    expect(brandRow?.firstElementChild?.id).toBe('e-brand');
    expect(brandRow?.firstElementChild?.getAttribute('href')).toBe('/index.html');
    expect(brandRow?.querySelector('#e-tools')).toBeNull();
    expect(tools).not.toBeNull();
    expect(Array.from(tools?.children ?? []).map((child) => child.id)).toEqual(['e-svbtn', 'e-roads']);
    expect(tools?.querySelector('#e-svbtn')?.getAttribute('aria-pressed')).toBe('false');
    expect(tools?.querySelector('#e-roads')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('reserves the top-right exclusively for the four view modes', () => {
    const host = document.createElement('div');
    host.innerHTML = earthShellHtml();
    const topRight = host.querySelector('.e-topright');

    expect(Array.from(topRight?.children ?? []).map((child) => child.id)).toEqual(['e-views']);
    expect(topRight?.querySelector('#e-tools')).toBeNull();
    expect(EARTH_VIEW_MODES.map((mode) => mode.label)).toEqual(['Earth', 'Map', 'Masterplan', '3D']);
  });
});
