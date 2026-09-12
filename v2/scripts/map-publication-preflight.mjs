/** No ID aliases or coordinate inference: ambiguous historical bindings block publication. */
export function assessMapPublication(catalog, databaseAssets, properties) {
  const typed = new Map(catalog.map(m => [m.id, m]));
  const database = new Map(databaseAssets.map(m => [m.databaseId, m]));
  const collisions = databaseAssets.filter(m => m.idCollision).map(m => m.databaseId);
  const brokenAssets = databaseAssets.filter(m => m.error || m.httpStatus !== 200).map(m => m.databaseId);
  const unresolvedPlacements = properties.filter(p => p.placement?.mapId
    && !database.has(p.placement.mapId) && !typed.has(p.placement.mapId));
  const unresolvedLinks = properties.flatMap(p => ['masterplan_id','sector_map_id']
    .filter(key => p[key] && !database.has(p[key]) && !typed.has(p[key]))
    .map(key => ({propertyId:p.id,field:key,mapId:p[key]})));
  return {
    safeToPublish: catalog.length===typed.size && collisions.length===0 && brokenAssets.length===0
      && unresolvedPlacements.length===0 && unresolvedLinks.length===0,
    collisions, brokenAssets,
    unresolvedPlacements: unresolvedPlacements.map(p => ({propertyId:p.id,mapId:p.placement.mapId})),
    unresolvedLinks,
    duplicateTypedIds: catalog.length !== typed.size,
  };
}
