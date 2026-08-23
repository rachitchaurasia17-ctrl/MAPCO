/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · orchestrator
   ---------------------------------------------------------------
   canonical point
     → ONE Gemini discovery (6 Day-to-Day + 6 City Reach)
     → resolve/normalize ONLY those final destinations
        (roads via MAPCO GeoJSON, everything else via Google Places)
     → dedupe / bounded repair / verify
     → ONE Google Route Matrix (1 origin × ≤12 destinations)
     → real road distance + duration
     → ViewModel + usage/cost + input digest
   Never invents a place or a distance to keep six rows: an unresolved,
   duplicate, or route-less destination is dropped, not faked.
   ═══════════════════════════════════════════════════════════════ */
import type {
  PipelineInput, PipelineDeps, PipelineResult, PropertyIntelligenceViewModel,
  IntelligencePlace, DiscoveryCandidate, ResolvedDestination, RoutePoint,
  DayToDayCategory, RunUsage,
} from './types.ts';
import { DAY_TO_DAY_ORDER, PROPERTY_INTELLIGENCE_SCHEMA_VERSION } from './types.ts';
import { formatDistance, formatDuration } from './geo.ts';
import { resolveRoad } from './roads.ts';
import { dayToDayIcon, cityReachIcon, repairIncludedType } from './icons.ts';
import { computeInputDigest } from './cache-key.ts';
import { costMicroUsd, DEFAULT_RATES, type CostRates } from './cost.ts';

const REPAIR_QUERY: Record<DayToDayCategory, string> = {
  park: 'park', grocery: 'supermarket', gym: 'gym',
  school: 'school', healthcare: 'hospital', daily_market: 'local market',
};

interface Slot {
  group: 'dayToDay' | 'cityReach';
  category?: DayToDayCategory;
  destinationType: string;
  displayName: string;
  resolved: ResolvedDestination;
  reason?: string;
}

function toRoutePoint(r: ResolvedDestination): RoutePoint {
  return r.placeId
    ? { placeId: r.placeId, latitude: r.latitude, longitude: r.longitude }
    : { latitude: r.latitude, longitude: r.longitude };
}

export interface RunOptions { rates?: CostRates }

export async function runPropertyIntelligence(
  input: PipelineInput,
  deps: PipelineDeps,
  options: RunOptions = {},
): Promise<PipelineResult> {
  const started = Date.now();
  const rates = options.rates ?? DEFAULT_RATES;
  const log = deps.log ?? (() => {});
  const tally = {
    inputTokens: 0, outputTokens: 0, groundingQueries: 0,
    placesCalls: 0, matrixElements: 0, routeCalls: 0, repairAttempts: 0,
  };

  const digest = await computeInputDigest({
    dealerId: input.dealerId, propertyId: input.propertyId, point: input.point,
    locationUpdatedAt: input.locationUpdatedAt,
    provider: deps.discovery.name, model: deps.discovery.model,
  });

  // 1) Discovery ---------------------------------------------------
  const discovery = await deps.discovery.discover(input.point, {
    regionHint: input.regionHint, signal: deps.signal,
  });
  tally.inputTokens += discovery.usage.inputTokens;
  tally.outputTokens += discovery.usage.outputTokens;
  tally.groundingQueries += discovery.usage.groundingQueries;
  log('info', 'pi.discovery', { candidates: discovery.candidates.length });

  const dayByCategory = new Map<DayToDayCategory, DiscoveryCandidate>();
  const cityCandidates: DiscoveryCandidate[] = [];
  for (const c of discovery.candidates) {
    if (c.group === 'dayToDay' && c.category) {
      if (!dayByCategory.has(c.category)) dayByCategory.set(c.category, c);
    } else if (c.group === 'cityReach') {
      cityCandidates.push(c);
    }
  }

  const seenPlaceIds = new Set<string>();
  const seenCoordKeys = new Set<string>();
  const coordKey = (r: ResolvedDestination) => `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`;
  const claim = (r: ResolvedDestination): boolean => {
    const pk = r.placeId ? `p:${r.placeId}` : '';
    const ck = coordKey(r);
    if (pk && seenPlaceIds.has(pk)) return false;
    if (seenCoordKeys.has(ck)) return false;
    if (pk) seenPlaceIds.add(pk);
    seenCoordKeys.add(ck);
    return true;
  };

  // 2) Resolve Day-to-Day (bounded repair per missing/failed category)
  const daySlots: Slot[] = [];
  for (const category of DAY_TO_DAY_ORDER) {
    const candidate = dayByCategory.get(category);
    let resolved: ResolvedDestination | null = null;
    if (candidate) {
      resolved = await deps.resolver.resolvePlace(candidate.name, input.point, { signal: deps.signal });
      tally.placesCalls++;
    }
    if (!resolved || !claimPreview(resolved, seenPlaceIds, seenCoordKeys)) {
      // Bounded repair: one category search near the property.
      resolved = await deps.resolver.resolvePlace(REPAIR_QUERY[category], input.point, {
        includedType: repairIncludedType(category), signal: deps.signal,
      });
      tally.placesCalls++;
      tally.repairAttempts++;
    }
    if (!resolved || !claim(resolved)) {
      log('warn', 'pi.dayToDay.dropped', { category });
      continue;
    }
    daySlots.push({
      group: 'dayToDay', category, destinationType: category,
      displayName: resolved.name, resolved, reason: candidate?.reason,
    });
  }

  // 3) Resolve City Reach (roads via MAPCO geometry, else Places)
  const citySlots: Slot[] = [];
  for (const candidate of cityCandidates) {
    if (citySlots.length >= 6) break;
    const type = candidate.destinationType ?? 'landmark';
    let resolved: ResolvedDestination | null = null;
    if (type === 'road') {
      resolved = resolveRoad(candidate.name, input.point, deps.roads);
      if (!resolved) {
        // Some "roads" are also POIs (e.g. a named highway junction).
        resolved = await deps.resolver.resolvePlace(candidate.name, input.point, { signal: deps.signal });
        tally.placesCalls++;
      }
    } else {
      resolved = await deps.resolver.resolvePlace(candidate.name, input.point, { signal: deps.signal });
      tally.placesCalls++;
    }
    if (!resolved || !claim(resolved)) {
      log('warn', 'pi.cityReach.dropped', { name: candidate.name });
      continue;
    }
    citySlots.push({
      group: 'cityReach', destinationType: type,
      displayName: resolved.name, resolved, reason: candidate.reason,
    });
  }

  // 4) One Route Matrix: property × all resolved destinations --------
  const allSlots = [...daySlots, ...citySlots];
  const origin: RoutePoint = { latitude: input.point.latitude, longitude: input.point.longitude };
  const elements = allSlots.length
    ? await deps.matrix.computeMatrix(origin, allSlots.map((s) => toRoutePoint(s.resolved)), { signal: deps.signal })
    : [];
  tally.matrixElements += allSlots.length;

  // 5) Assemble rows; drop any destination with no real route --------
  const dayToDay: IntelligencePlace[] = [];
  const cityReach: IntelligencePlace[] = [];
  allSlots.forEach((slot, i) => {
    const el = elements[i];
    if (!el || !el.ok) { log('warn', 'pi.route.missing', { name: slot.displayName }); return; }
    const isDay = slot.group === 'dayToDay';
    const idx = (isDay ? dayToDay.length : cityReach.length) + 1;
    const place: IntelligencePlace = {
      id: isDay ? `d${idx}` : `c${idx}`,
      group: slot.group,
      destinationType: slot.destinationType,
      category: slot.category,
      name: slot.displayName,
      icon: isDay
        ? dayToDayIcon(slot.category as DayToDayCategory)
        : cityReachIcon(slot.destinationType as any),
      distanceMeters: el.distanceMeters,
      distanceLabel: formatDistance(el.distanceMeters),
      durationSeconds: el.durationSeconds,
      durationLabel: formatDuration(el.durationSeconds),
      latitude: slot.resolved.latitude,
      longitude: slot.resolved.longitude,
      placeId: slot.resolved.placeId,
      routeTarget: {
        kind: slot.resolved.kind,
        placeId: slot.resolved.placeId,
        latitude: slot.resolved.latitude,
        longitude: slot.resolved.longitude,
      },
    };
    (isDay ? dayToDay : cityReach).push(place);
  });

  const ready = dayToDay.length >= 1 && cityReach.length >= 1 && (dayToDay.length + cityReach.length) >= 4;
  const generatedAt = deps.now();
  const viewModel: PropertyIntelligenceViewModel = {
    status: ready ? 'ready' : 'unavailable',
    reason: ready ? undefined : 'insufficient_results',
    generatedAt,
    schemaVersion: PROPERTY_INTELLIGENCE_SCHEMA_VERSION,
    provider: deps.discovery.name,
    model: deps.discovery.model,
    origin: input.point,
    dayToDay,
    cityReach,
  };

  const cost = costMicroUsd(tally, rates);
  const usage: RunUsage = {
    provider: deps.discovery.name,
    model: deps.discovery.model,
    inputTokens: tally.inputTokens,
    outputTokens: tally.outputTokens,
    groundingQueries: tally.groundingQueries,
    placesCalls: tally.placesCalls,
    matrixElements: tally.matrixElements,
    routeCalls: tally.routeCalls,
    repairAttempts: tally.repairAttempts,
    costMicroUsd: cost,
    cacheOutcome: input.refreshReason ? 'refresh' : 'miss',
    refreshReason: input.refreshReason,
    latencyMs: Date.now() - started,
    status: ready ? 'succeeded' : 'unavailable',
  };

  log('info', 'pi.done', {
    dayToDay: dayToDay.length, cityReach: cityReach.length,
    costMicroUsd: cost, latencyMs: usage.latencyMs,
  });

  return { viewModel, usage, inputDigest: digest };
}

/** Preview whether a resolved destination would survive dedupe, WITHOUT
 *  claiming it — used to decide whether a Day-to-Day slot needs repair. */
function claimPreview(r: ResolvedDestination, placeIds: Set<string>, coords: Set<string>): boolean {
  const pk = r.placeId ? `p:${r.placeId}` : '';
  const ck = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`;
  if (pk && placeIds.has(pk)) return false;
  if (coords.has(ck)) return false;
  return true;
}
