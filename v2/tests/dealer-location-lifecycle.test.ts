// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Component } from '../src/apps/dealer/logic';
import { DCLogic } from '../src/framework/dc';
import { deskStore, toCanonicalProperty } from '../src/apps/dealer/desk-store';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dealerTemplate = readFileSync(resolve(__dirname, '../src/apps/dealer/template.ts'), 'utf8');

describe('dealer canonical Earth lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('reopens the saved WGS84 location without deriving it from mapPlacement', () => {
    const component = new Component() as any;
    component.properties = [{
      id: 'property-location-reopen',
      city: 'Mohali', loc: 'Disposable plot, Mohali', type: 'Residential Plot',
      size: '300 sq yd', facing: 'East', photos: [], docs: [], highlights: [], videos: [],
      location: { latitude: 30.688912, longitude: 76.736112, source: 'dealer-selected' },
      mapPlacement: { mapId: 'sector-sheet', x: 0.1, y: 0.9 },
    }];
    component.setState = (patch: Record<string, unknown>) => {
      component.state = { ...component.state, ...patch };
    };

    component.openEdit('property-location-reopen', 4);

    expect(component.state.pform).toMatchObject({
      lat: 30.688912,
      lng: 76.736112,
      earth: true,
      pinSet: true,
      mapPlacement: { mapId: 'sector-sheet', x: 0.1, y: 0.9 },
      sectorPinX: 10,
      sectorPinY: 90,
    });
    expect(component.state.pform.lat).not.toBe(component.state.pform.mapPlacement.x);
    expect(component.state.pform.lng).not.toBe(component.state.pform.mapPlacement.y);
  });

  it('preserves one live map host across a root rerender', async () => {
    const component = new Component() as any;
    const app = document.getElementById('app')!;
    app.innerHTML = '<div id="dealer-earth-map"></div><input id="dealer-earth-search">';
    const originalHost = document.getElementById('dealer-earth-map')!;
    const map = { id: 'one-map' };
    const mapAssignments: unknown[] = [];
    const marker: Record<string, unknown> = { position: null };
    Object.defineProperty(marker, 'map', {
      configurable: true,
      get: () => mapAssignments.at(-1),
      set: (value) => { mapAssignments.push(value); },
    });
    component._gMapEl = originalHost;
    component._gMap = map;
    component._gMarker = marker;
    component.state.pform = { lat: 30.705006, lng: 76.71554 };

    app.innerHTML = '<div id="dealer-earth-map"></div><input id="dealer-earth-search">';
    const replacementHost = document.getElementById('dealer-earth-map')!;
    expect(replacementHost).not.toBe(originalHost);

    await component.syncEarthMap();

    expect(document.getElementById('dealer-earth-map')).toBe(originalHost);
    expect(component._gMap).toBe(map);
    expect(component._gMarker).toBe(marker);
    expect(mapAssignments).toEqual([null, map]);
    expect(marker.position).toEqual({ lat: 30.705006, lng: 76.71554 });
  });

  it('keeps a Google-selected coordinate pending until explicit confirmation', () => {
    const component = new Component() as any;
    component.state.pform = { earth: true, pinSet: false };

    expect(component.recordEarthSelection(30.705005889229952, 76.71553965608055)).toBe(true);
    expect(component.state.pform).toMatchObject({
      lat: 30.705005889229952,
      lng: 76.71553965608055,
      earth: false,
      pinSet: true,
    });
    expect(component.recordEarthSelection(0, 0)).toBe(false);

    component.setState = (patch: Record<string, unknown>) => {
      component.state = { ...component.state, ...patch };
    };
    component.renderVals().pEarthConfirm();
    expect(component.state.pform.earth).toBe(true);
  });

  it('carries the candidate/accepted contract all the way to the canonical record', () => {
    // The state layer already refused to mark a selection accepted. This proves
    // the persistence boundary honours the same contract, which is the last
    // place the chain could break: desk-store used to write any valid lat/lng.
    const component = new Component() as any;
    component.setState = (patch: Record<string, unknown>) => {
      component.state = { ...component.state, ...patch };
    };
    component.state.pform = {
      ...component.state.pform, city: 'Mohali', area: 'Sector 79', type: 'Residential Plot',
    };

    // Click / drag / search — a candidate only.
    expect(component.recordEarthSelection(30.705005889229952, 76.71553965608055, 'click')).toBe(true);
    expect(component.state.pform.earth).toBe(false);
    expect(toCanonicalProperty(component.state.pform, undefined, 'candidate').location)
      .toBeUndefined();

    // Confirm — accepted, and only now eligible for the canonical column.
    component.renderVals().pEarthConfirm();
    expect(component.state.pform.earth).toBe(true);
    expect(toCanonicalProperty(component.state.pform, undefined, 'accepted').location)
      .toMatchObject({ latitude: 30.705006, longitude: 76.71554, source: 'dealer-selected' });

    // Move pin — back to unaccepted, and an existing coordinate survives.
    const saved = {
      id: 'accepted',
      location: { latitude: 30.705006, longitude: 76.71554, source: 'dealer-selected' },
    } as any;
    component.renderVals().pEarthRedo();
    expect(component.state.pform.earth).toBe(false);
    expect(toCanonicalProperty(component.state.pform, saved, 'accepted').location)
      .toEqual(saved.location);
  });

  it('records how the dealer reached the coordinate, for telemetry only', () => {
    const component = new Component() as any;
    component.state.pform = {};
    for (const source of ['click', 'drag', 'search'] as const) {
      expect(component.recordEarthSelection(30.7046, 76.7179, source)).toBe(true);
      expect(component.state.pform.pinSource).toBe(source);
      // Provenance must never be mistaken for acceptance.
      expect(component.state.pform.earth).toBe(false);
    }
  });

  it('surfaces returned and unexpected persistence failures on the Earth step', async () => {
    const component = new Component() as any;
    component.state.pform = { city: 'Mohali', area: 'Canonical QA', type: 'Residential Plot' };
    component.setState = (patch: Record<string, unknown>) => {
      component.state = { ...component.state, ...patch };
    };

    vi.spyOn(deskStore, 'saveProperty').mockResolvedValueOnce({ error: 'Active dealer write access required.' });
    await component.savePlot();
    expect(component.state).toMatchObject({ savingProp: false, propError: 'Active dealer write access required.' });

    vi.spyOn(deskStore, 'saveProperty').mockRejectedValueOnce(new Error('Network unavailable.'));
    await component.savePlot();
    expect(component.state).toMatchObject({ savingProp: false, propError: 'Network unavailable.' });
    expect(dealerTemplate).toContain('role="alert"');
    expect(dealerTemplate).toContain('${propError}');
  });

  it('removes provider listeners and marker when Earth leaves the DOM', async () => {
    const component = new Component() as any;
    const mapRemove = vi.fn();
    const markerRemove = vi.fn();
    const placeRemove = vi.fn();
    const setMap = vi.fn();
    component._gMap = {};
    component._gMarker = { setMap };
    component._gMapClickListener = { remove: mapRemove };
    component._gMarkerDragListener = { remove: markerRemove };
    component._gPlaceListener = { remove: placeRemove };

    await component.syncEarthMap();

    expect(mapRemove).toHaveBeenCalledOnce();
    expect(markerRemove).toHaveBeenCalledOnce();
    expect(placeRemove).toHaveBeenCalledOnce();
    expect(setMap).toHaveBeenCalledWith(null);
    expect(component._gMap).toBeNull();
    expect(component._gMarker).toBeNull();
  });
});

describe('DC lifecycle regression', () => {
  it('invokes componentDidUpdate once per render without recursively rendering', () => {
    class Probe extends DCLogic {
      updates = 0;
      componentDidUpdate() { this.updates += 1; }
    }
    const probe = new Probe();
    probe.mount(document.getElementById('app')!, () => '<div>desk</div>');
    expect(probe.updates).toBe(1);
    probe.setState({ changed: true });
    expect(probe.updates).toBe(2);
  });
});
