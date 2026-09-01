// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Component } from '../src/apps/dealer/logic';
import { DCLogic } from '../src/framework/dc';

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
    component._gMapEl = originalHost;
    component._gMap = { id: 'one-map' };
    component._gMarker = { id: 'one-marker' };

    app.innerHTML = '<div id="dealer-earth-map"></div><input id="dealer-earth-search">';
    const replacementHost = document.getElementById('dealer-earth-map')!;
    expect(replacementHost).not.toBe(originalHost);

    await component.syncEarthMap();

    expect(document.getElementById('dealer-earth-map')).toBe(originalHost);
    expect(component._gMap).toEqual({ id: 'one-map' });
    expect(component._gMarker).toEqual({ id: 'one-marker' });
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
