// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
// Repo-controlled road data — must NOT reach outside the repo, or CI and
// Vercel cannot resolve it.
import airportRoadRaw from '../src/apps/earth/data/roads/airport road.geojson?raw';
import {
  ROAD_LOAD_FAILURES,
  ROAD_DIAGNOSTICS,
  ROAD_FILE_DIAGNOSTICS,
  ROAD_SPECS,
  buildRoadGraph,
  getLastRoadRankingDiagnostics,
  loadRoadsFromRawFiles,
  nearestOnPath,
  parseRoadGeoJson,
  roadNameFromFilename,
  scoreRoad,
  selectRoadsFor,
  stableRoadId,
  type RoadSpec,
} from '../src/apps/earth/intel/road-network';
import {
  RoadLayer,
  createRoadLabelElement,
  extractUsefulSegments,
  globalRoadLayerItems,
  resolveRoadLayerMode,
  selectRoadLabels,
} from '../src/apps/earth/road-layer';

function geoJson(
  coordinates: number[][],
  properties: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties, geometry: { type: 'LineString', coordinates } }],
  });
}

function road(
  filename: string,
  latitude: number,
  properties: Record<string, unknown>,
): RoadSpec {
  return parseRoadGeoJson(
    `/google maps/${filename}`,
    geoJson([[-0.02, latitude], [0.02, latitude]], properties),
    {},
  )!;
}

function roadFromPath(
  filename: string,
  coordinates: number[][],
  properties: Record<string, unknown>,
): RoadSpec {
  return parseRoadGeoJson(`/google maps/${filename}`, geoJson(coordinates, properties), {})!;
}

describe('GeoJSON road ingestion', () => {
  it('derives a stable id and useful display name from filename alone', () => {
    const parsed = parseRoadGeoJson(
      '/google maps/mohali-sirhind-road.geojson',
      geoJson([[76.7, 30.7], [76.8, 30.8]]),
      {},
    )!;
    expect(parsed.id).toBe('mohali-sirhind-road');
    expect(parsed.name).toBe('Mohali-Sirhind Road');
    expect(stableRoadId('Airport Road.geojson')).toBe('airport-road');
    expect(roadNameFromFilename('airport-road.geojson')).toBe('Airport Road');
    expect(roadNameFromFilename('purav marg.geojson')).toBe('Purav Marg');
    expect(roadNameFromFilename('IT CITY KURALI BYPASS.geojson')).toBe('IT City Kurali Bypass');
    expect(roadNameFromFilename('SH-12A.geojson')).toBe('SH-12A');
  });

  it('preserves every authoritative coordinate tuple exactly', () => {
    const source = JSON.parse(airportRoadRaw).features[0].geometry.coordinates;
    const parsed = parseRoadGeoJson('/google maps/airport road.geojson', airportRoadRaw)!;
    expect(parsed.coordinates).toEqual(source);
    expect(parsed.coordinates).toHaveLength(43);
  });

  it('discovers Airport Road with catalog significance and no load failures', () => {
    expect(ROAD_LOAD_FAILURES).toEqual([]);
    expect(ROAD_DIAGNOSTICS.discovered).toBeGreaterThanOrEqual(29);
    expect(ROAD_DIAGNOSTICS).toMatchObject({
      parsed: ROAD_DIAGNOSTICS.discovered,
      valid: ROAD_DIAGNOSTICS.discovered,
      registered: ROAD_DIAGNOSTICS.discovered,
      rejected: 0,
    });
    expect(ROAD_FILE_DIAGNOSTICS).toHaveLength(ROAD_DIAGNOSTICS.discovered);
    expect(ROAD_FILE_DIAGNOSTICS.every((file) => file.discovered && file.parsed && file.valid
      && file.registered && file.eligibleForRanking && file.renderable)).toBe(true);
    const airport = ROAD_SPECS.find((candidate) => candidate.id === 'airport-road');
    expect(airport).toMatchObject({
      name: 'Airport Road',
      role: 'airport',
      roadClass: 'regional-corridor',
      importance: 0.95,
    });
  });

  it('rejects invalid or empty geometry instead of inventing a road', () => {
    expect(parseRoadGeoJson('/google maps/empty.geojson', geoJson([]), {})).toBeNull();
    expect(parseRoadGeoJson('/google maps/bad.geojson', '{bad json', {})).toBeNull();
    const loaded = loadRoadsFromRawFiles({
      '/google maps/valid.geojson': geoJson([[76.7, 30.7], [76.8, 30.8]]),
      '/google maps/invalid.geojson': geoJson([]),
    }, {});
    expect(loaded.roads).toHaveLength(1);
    expect(loaded.failures).toHaveLength(1);
  });

  it('deduplicates the same road identity across files', () => {
    const sameIdentity = { name: 'Ring Road', aliases: ['City Ring'] };
    const loaded = loadRoadsFromRawFiles({
      '/google maps/ring-a.geojson': geoJson([[76.7, 30.7], [76.8, 30.8]], sameIdentity),
      '/google maps/ring-b.geojson': geoJson([[76.6, 30.6], [76.9, 30.9]], sameIdentity),
    }, {});
    expect(loaded.roads).toHaveLength(1);
    expect(loaded.failures[0].reason).toContain('Duplicate road identity');
  });
});

describe('local road intelligence', () => {
  it('computes nearest segment access rather than distance to an endpoint', () => {
    const nearest = nearestOnPath(
      { lat: 0.01, lng: 0 },
      [{ lat: 0, lng: -1 }, { lat: 0, lng: 1 }],
    );
    expect(nearest.meters).toBeGreaterThan(1100);
    expect(nearest.meters).toBeLessThan(1125);
    expect(Math.abs(nearest.point.lng)).toBeLessThan(0.000001);
  });

  it('lets an important arterial outrank a closer ordinary connector', () => {
    const arterial = road('major.geojson', 0.0063, {
      name: 'Major Arterial', roadClass: 'major-arterial', role: 'arterial',
      importance: 0.96, connectivity: 0.95, stories: ['regional-access'],
    });
    const lane = road('lane.geojson', 0.0009, {
      name: 'Local Lane', roadClass: 'ordinary-connector', role: 'connector',
      importance: 0.32, connectivity: 0.2, stories: ['local-access'],
    });
    const selected = selectRoadsFor({ lat: 0, lng: 0 }, 'commercial', 8, [lane, arterial]);
    expect(selected[0].spec.id).toBe('major');
    expect(selected[0].accessMeters).toBeGreaterThan(selected[1].accessMeters);
  });

  it('qualifies a major road through a nearby connector while excluding a distant famous road', () => {
    const connector = roadFromPath('connector.geojson', [[0, 0.0005], [0.032, 0.0005]], {
      name: 'Property Connector', roadClass: 'ordinary-connector', role: 'access',
      importance: 0.55, connectivity: 0.7, stories: ['local-access'],
    });
    const connectedMajor = roadFromPath('connected-major.geojson', [[0.03, 0.0005], [0.03, 0.04]], {
      name: 'Connected Major', roadClass: 'major-arterial', role: 'arterial',
      importance: 0.94, connectivity: 0.95, stories: ['city-arterial'],
    });
    const distantFamous = roadFromPath('distant-famous.geojson', [[0.08, -0.02], [0.08, 0.05]], {
      name: 'Distant Famous Road', roadClass: 'major-arterial', role: 'regional',
      importance: 1, connectivity: 1, stories: ['famous-regional'],
    });
    const graph = buildRoadGraph([connector, connectedMajor, distantFamous]);
    expect(graph.get(connector.id)?.some((edge) => edge.roadId === connectedMajor.id)).toBe(true);
    const selected = selectRoadsFor({ lat: 0, lng: 0 }, 'residential', 8, [connector, connectedMajor, distantFamous]);
    expect(selected.map((candidate) => candidate.spec.id)).toContain('connector');
    expect(selected.find((candidate) => candidate.spec.id === 'connected-major')).toMatchObject({
      relation: 'connected', graphHops: 1,
    });
    expect(selected.map((candidate) => candidate.spec.id)).not.toContain('distant-famous');
  });

  it('does not create a graph edge from overlapping bounds alone', () => {
    const diagonalA = roadFromPath('diagonal-a.geojson', [[-0.02, -0.02], [0.02, 0.02]], { name: 'Diagonal A' });
    const diagonalB = roadFromPath('diagonal-b.geojson', [[-0.02, 0], [0.02, 0.04]], { name: 'Diagonal B' });
    const graph = buildRoadGraph([diagonalA, diagonalB]);
    expect(graph.get(diagonalA.id)).toEqual([]);
    expect(graph.get(diagonalB.id)).toEqual([]);
  });

  it('penalizes redundant parallel roads while retaining a distinct corridor story', () => {
    const parallels = [0.0008, 0.0012, 0.0016].map((latitude, index) => roadFromPath(
      `parallel-${index}.geojson`,
      [[-0.02, latitude], [0.02, latitude]],
      {
        name: `Parallel ${index}`, roadClass: 'city-connector', role: 'city',
        importance: 0.78 - index * 0.02, connectivity: 0.75,
        stories: ['same-east-west-story'],
      },
    ));
    const distinct = roadFromPath('distinct.geojson', [[0.004, -0.02], [0.004, 0.02]], {
      name: 'Distinct North South', roadClass: 'city-connector', role: 'connector',
      importance: 0.72, connectivity: 0.75, stories: ['north-south-story'],
    });
    const selected = selectRoadsFor({ lat: 0, lng: 0 }, 'residential', 4, [...parallels, distinct]);
    expect(selected.map((candidate) => candidate.spec.id)).toContain('distinct');
    expect(selected.filter((candidate) => candidate.spec.id.startsWith('parallel-')).length).toBeLessThan(3);
  });

  it('changes ordering when property intent values different connectivity roles', () => {
    const airport = roadFromPath('airport-choice.geojson', [[-0.02, 0.004], [0.02, 0.004]], {
      name: 'Airport Choice', roadClass: 'city-connector', role: 'airport',
      importance: 0.78, connectivity: 0.8, stories: ['airport-access'],
    });
    const city = roadFromPath('city-choice.geojson', [[-0.02, 0.0042], [0.02, 0.0042]], {
      name: 'City Choice', roadClass: 'city-connector', role: 'city',
      importance: 0.78, connectivity: 0.8, stories: ['city-access'],
    });
    expect(selectRoadsFor({ lat: 0, lng: 0 }, 'investment', 1, [airport, city])[0].spec.id).toBe('airport-choice');
    expect(selectRoadsFor({ lat: 0, lng: 0 }, 'rental', 1, [airport, city])[0].spec.id).toBe('city-choice');
  });

  it('respects the maximum without forcing irrelevant roads', () => {
    const roads = Array.from({ length: 12 }, (_, index) => road(`road-${index}.geojson`, 0.001 + index * 0.0001, {
      name: `Road ${index}`,
      roadClass: 'city-connector',
      role: index % 2 ? 'city' : 'connector',
      importance: 0.8,
      connectivity: 0.8,
      stories: [`story-${index}`],
    }));
    expect(selectRoadsFor({ lat: 0, lng: 0 }, 'residential', 6, roads)).toHaveLength(6);
    const far = road('far.geojson', 1, { name: 'Far Road' });
    expect(selectRoadsFor({ lat: 0, lng: 0 }, 'residential', 10, [far])).toEqual([]);
  });

  it('materializes stored geometry without any Google road API call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    selectRoadsFor({ lat: 30.6889, lng: 76.7361 }, 'residential');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getLastRoadRankingDiagnostics().every((road) => road.reason.length > 0)).toBe(true);
    fetchSpy.mockRestore();
  });
});

describe('shared road renderer', () => {
  it('clips display segments without modifying authoritative geometry', () => {
    const source = Array.from({ length: 17 }, (_, index) => ({ lat: 0, lng: -0.08 + index * 0.01 }));
    const snapshot = JSON.stringify(source);
    const segments = extractUsefulSegments(source, { lat: 0, lng: 0 }, 2600);
    expect(JSON.stringify(source)).toBe(snapshot);
    expect(segments.flat().length).toBeLessThan(source.length);
    expect(segments.flat().every((point) => source.includes(point))).toBe(true);
  });

  it('selects labels deterministically and avoids the property pin', () => {
    const roads = ['a', 'b'].map((id, index) => ({
      id, name: id.toUpperCase(), score: 0.9 - index * 0.1, tier: 'primary' as const,
      path: [{ lat: 0, lng: 0.008 }, { lat: 0, lng: 0.012 }, { lat: 0, lng: 0.016 }],
      displayPaths: [[{ lat: 0, lng: 0.008 }, { lat: 0, lng: 0.012 }, { lat: 0, lng: 0.016 }]],
    }));
    const args = [roads, null, { lat: 0, lng: 0 }, { lat: 0, lng: 0 }, 15, { contains: () => true }] as const;
    const first = selectRoadLabels(...args);
    const second = selectRoadLabels(...args);
    expect(second).toEqual(first);
    expect(first).toHaveLength(2); // Both labels are generated; native collision engine handles hiding
    expect(nearestOnPath({ lat: 0, lng: 0 }, [first[0].position]).meters).toBeGreaterThan(240);
  });

  it('builds a readable label whose pointer tip shares the geographic marker anchor', () => {
    const label = createRoadLabelElement('Airport Road', 'primary', true);
    expect(label.classList.contains('on')).toBe(true);
    expect(label.querySelector('.e-roadlabel-text')?.textContent).toBe('Airport Road');
    expect(label.lastElementChild?.classList.contains('e-roadlabel-pointer')).toBe(true);
    expect(label.querySelector('.e-roadlabel-pointer')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the property network immediately, stays centred, and survives an Earth/Map basemap swap', () => {
    const polylines: Array<{ options: any; map: unknown }> = [];
    class Polyline {
      map: unknown;
      constructor(public options: any) {
        this.map = options.map;
        polylines.push(this);
      }
      setMap(map: unknown): void { this.map = map; }
    }
    class Marker {
      map: unknown;
      constructor(options: any) { this.map = options.map; }
    }
    vi.stubGlobal('google', { maps: { Polyline } });
    const listeners: Record<string, () => void> = {};
    const fitBounds = vi.fn();
    const panTo = vi.fn();
    const map = {
      type: 'hybrid',
      addListener: (event: string, callback: () => void) => { listeners[event] = callback; },
      getCenter: () => ({ lat: () => 30.7, lng: () => 76.7 }),
      getZoom: () => 14,
      getBounds: () => ({ contains: () => true }),
      fitBounds,
      panTo,
      setMapTypeId(type: string) { this.type = type; },
    };
    const layer = new RoadLayer(map, Marker);
    layer.show([{
      id: 'airport-road', name: 'Airport Road',
      path: [{ lat: 30.7, lng: 76.7 }, { lat: 30.8, lng: 76.8 }],
      accessPoint: { lat: 30.7, lng: 76.7 }, accessMeters: 0,
      importance: 0.95, score: 0.9, tier: 'primary', relation: 'direct',
    }], null, { lat: 30.7, lng: 76.7 });
    // three stroke layers (casing / glow / core) plus one travelling-light
    // overlay, which a primary road carries when motion is allowed
    expect(polylines.length).toBeGreaterThanOrEqual(3);
    const flowLines = polylines.filter((polyline) => Array.isArray(polyline.icons));
    expect(flowLines.length).toBeLessThanOrEqual(1);
    expect(polylines.every((polyline) => polyline.map === map)).toBe(true);
    expect(fitBounds).not.toHaveBeenCalled();
    expect(panTo).not.toHaveBeenCalled();
    map.setMapTypeId('roadmap');
    expect(polylines.every((polyline) => polyline.map === map)).toBe(true);
    expect(listeners.idle).toBeTypeOf('function');
    vi.unstubAllGlobals();
  });
});

describe('global and property road modes', () => {
  it('transitions global → property → global while the Roads toggle stays on', () => {
    const roadsOn = true;
    expect(resolveRoadLayerMode(roadsOn, false)).toBe('global');
    expect(resolveRoadLayerMode(roadsOn, true)).toBe('property');
    expect(resolveRoadLayerMode(roadsOn, false)).toBe('global');
    expect(resolveRoadLayerMode(false, false)).toBe('off');
    expect(resolveRoadLayerMode(false, true)).toBe('off');
  });

  it('materializes all 29 registered roads without ranking, copying, mutation, or API calls', () => {
    const snapshots = ROAD_SPECS.map((road) => JSON.stringify(road.coordinates));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const items = globalRoadLayerItems(ROAD_SPECS);
    expect(items).toHaveLength(29);
    expect(items.map((item) => item.id)).toEqual(ROAD_SPECS.map((road) => road.id));
    expect(items.every((item, index) => item.path === ROAD_SPECS[index].path)).toBe(true);
    expect(new Set(items.map((item) => item.tier))).toEqual(new Set(['primary', 'secondary', 'tertiary']));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ROAD_SPECS.map((road) => JSON.stringify(road.coordinates))).toEqual(snapshots);
    fetchSpy.mockRestore();
  });

  it('renders every registered geometry in global mode and removes the layer when Roads is off', () => {
    const polylines: Array<{ options: any; map: unknown; setMap(map: unknown): void }> = [];
    const markers: Array<{ map: unknown }> = [];
    class Polyline {
      map: unknown;
      constructor(public options: any) { this.map = options.map; polylines.push(this); }
      setMap(map: unknown): void { this.map = map; }
    }
    class Marker {
      map: unknown;
      constructor(options: any) { this.map = options.map; markers.push(this); }
    }
    const map = {
      addListener: vi.fn(),
      getCenter: () => ({ lat: () => 30.72, lng: () => 76.75 }),
      getZoom: () => 12,
      getBounds: () => ({ contains: () => true }),
    };
    vi.stubGlobal('google', {
      maps: {
        Polyline,
        CollisionBehavior: { OPTIONAL_AND_HIDES_LOWER_PRIORITY: 'optional' },
      },
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    try {
      const items = globalRoadLayerItems(ROAD_SPECS);
      const layer = new RoadLayer(map, Marker);
      layer.show(items, null, null);
      const casingPaths = polylines
        .filter((polyline) => polyline.options.strokeColor === '#04121a')
        .map((polyline) => polyline.options.path as Array<{ lat: number; lng: number }>);
      expect(items.every((road) => casingPaths.some((path) => path.includes(road.path[0])))).toBe(true);

      layer.hide();
      expect(polylines.every((polyline) => polyline.map === null)).toBe(true);
      expect(markers.every((marker) => marker.map === null)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps property mode on the intelligent short list rather than the global registry', () => {
    const selected = roadAdvantagesFor({ lat: 30.6889, lng: 76.7361 }, 'residential');
    expect(selected.length).toBeGreaterThanOrEqual(4);
    expect(selected.length).toBeLessThanOrEqual(ROAD_DISPLAY_LIMIT);
    expect(selected.length).toBeLessThan(ROAD_SPECS.length);
    expect(selected.every((road) => road.path && road.roadTier)).toBe(true);
  });
});

/* ── Added: tapered clipping + deployable data + road count ── */
import { taperSegment } from '../src/apps/earth/road-layer';
import { ROAD_DISPLAY_LIMIT, roadAdvantagesFor } from '../src/apps/earth/location-advantage';

describe('road rendering polish', () => {
  it('keeps the default road set to the shortest convincing explanation', () => {
    expect(ROAD_DISPLAY_LIMIT).toBeGreaterThanOrEqual(4);
    expect(ROAD_DISPLAY_LIMIT).toBeLessThanOrEqual(6);
  });

  it('leaves a short segment untapered', () => {
    const short = [{ lat: 30.70, lng: 76.70 }, { lat: 30.7005, lng: 76.7005 }];
    const pieces = taperSegment(short);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].fade).toBe(1);
  });

  it('fades both ends of a long clipped segment without cutting it', () => {
    const long: { lat: number; lng: number }[] = [];
    for (let i = 0; i <= 60; i++) long.push({ lat: 30.70, lng: 76.70 + i * 0.001 });
    const fullPath = [{ lat: 30.7, lng: 76.6 }, ...long, { lat: 30.7, lng: 76.8 }];
    const pieces = taperSegment(long, fullPath);
    expect(pieces.length).toBeGreaterThan(2);
    expect(pieces[0].fade).toBeLessThan(1);                        // head fades in
    expect(pieces[pieces.length - 1].fade).toBeLessThan(1);        // tail fades out
    expect(Math.max(...pieces.map((p) => p.fade))).toBe(1);        // middle is solid
  });

  it('never mutates the source coordinates while tapering', () => {
    const source = [{ lat: 30.70, lng: 76.70 }, { lat: 30.70, lng: 76.75 }, { lat: 30.70, lng: 76.80 }];
    const snapshot = JSON.stringify(source);
    taperSegment(source);
    extractUsefulSegments(source, { lat: 30.705, lng: 76.75 }, 3000);
    expect(JSON.stringify(source)).toBe(snapshot);
  });
});

describe('connectivity relevance decays with graph distance', () => {
  const road = ROAD_SPECS[0];

  it('penalises every hop away from the property', () => {
    const direct = scoreRoad(road, 500, 'residential', 'direct', 500, 0, 3);
    const oneHop = scoreRoad(road, 500, 'residential', 'connected', 1500, 1, 3);
    const twoHop = scoreRoad(road, 500, 'residential', 'connected', 1500, 2, 3);
    expect(direct).toBeGreaterThan(oneHop);
    expect(oneHop).toBeGreaterThan(twoHop);
    // the drop must be meaningful, not cosmetic
    expect(direct - twoHop).toBeGreaterThan(0.15);
  });

  it('scores a near direct road above the same road reached from far away', () => {
    const near = scoreRoad(road, 300, 'residential', 'direct', 300, 0, 3);
    const far = scoreRoad(road, 300, 'residential', 'connected', 4800, 2, 3);
    expect(near).toBeGreaterThan(far);
  });
});
