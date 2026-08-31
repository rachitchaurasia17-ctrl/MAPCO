/* ═══════════════════════════════════════════════════════════════
   MAPCO — Property Intelligence · buyer-safe projection
   ---------------------------------------------------------------
   Property Intelligence is dealer intelligence. When it is shown on a
   client link, the buyer must not be able to recover the property's
   exact position from it.

   The obvious leak is the route polyline: it starts AT the property.
   The subtle one is distance. Exact road distances to three or more
   known places trilaterate the origin to within metres — so when the
   dealer has hidden or approximated the location, distances are
   withheld too, not merely rounded.

   Visibility contract (mirrors the client-link location setting):
     exact   → full intelligence: distances, durations, polylines
     approx  → places, photos and categories only
     area    → places, photos and categories only
     hidden  → places, photos and categories only

   Everything removed here is removed from the PAYLOAD, not hidden in
   CSS: a buyer reading the network response sees only what is safe.
   ═══════════════════════════════════════════════════════════════ */
import type { IntelligencePlace, PropertyIntelligenceViewModel } from './types.ts';

/** Matches the client-link locationVisibility vocabulary. */
export type LocationVisibility = 'exact' | 'approx' | 'area' | 'hidden';

function stripPlace(place: IntelligencePlace, revealGeometry: boolean): IntelligencePlace {
  if (revealGeometry) {
    // Even at 'exact' the buyer never needs MAPCO's internal candidate
    // bookkeeping; the destination coordinate is public information about
    // the destination, not about the property.
    return { ...place };
  }
  return {
    ...place,
    distanceMeters: null,
    distanceLabel: null,
    durationSeconds: null,
    durationLabel: null,
    travelMode: null,
    encodedPolyline: null,
    routeTarget: null,
    routeStatus: place.routeStatus === 'ok' ? 'withheld' : place.routeStatus,
    latitude: null,
    longitude: null,
  };
}

/**
 * Reduce a dealer view model to what a buyer may safely receive.
 * Returns a NEW object; the dealer payload is never mutated.
 */
export function toBuyerSafeIntelligence(
  viewModel: PropertyIntelligenceViewModel,
  locationVisibility: LocationVisibility,
): PropertyIntelligenceViewModel {
  const revealGeometry = locationVisibility === 'exact';
  return {
    status: viewModel.status,
    ...(viewModel.reason ? { reason: viewModel.reason } : {}),
    generatedAt: viewModel.generatedAt,
    schemaVersion: viewModel.schemaVersion,
    pipelineVersion: viewModel.pipelineVersion,
    provider: viewModel.provider,
    model: viewModel.model,
    // The origin IS the property. It is only ever sent when the dealer has
    // explicitly chosen to reveal the exact location.
    origin: revealGeometry ? viewModel.origin : null,
    local: viewModel.local.map((category) => ({
      category: category.category,
      icon: category.icon,
      places: category.places.map((p) => stripPlace(p, revealGeometry)),
    })),
    city: viewModel.city.map((p) => stripPlace(p, revealGeometry)),
    buyerSafe: true,
  };
}
