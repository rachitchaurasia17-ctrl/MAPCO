import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {assessMapPublication} from './map-publication-preflight.mjs';
const root=resolve(import.meta.dirname,'../..');
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const catalog=read('v2/public/maps/index.json').maps;
const assets=read('docs/maps/inspection/live-asset-reconciliation.json');
const properties=read('docs/maps/inspection/property-map-references.json');
const report={project:assets.project,inspectionDate:'2026-09-12',mode:'read-only',
  note:'Historical observations, not a substitute for a fresh preflight immediately before mutation.',
  result:assessMapPublication(catalog,assets.rows,properties),
  maps:assets.rows.map(m=>({...m,properties:properties.filter(p=>
    p.placement?.mapId===m.databaseId || p.masterplan_id===m.databaseId || p.sector_map_id===m.databaseId)
    .map(p=>({id:p.id,placement:p.placement,masterplanId:p.masterplan_id,sectorMapId:p.sector_map_id}))})),
  referencesWithoutDatabaseRow:properties.flatMap(p=>['placement','masterplan_id','sector_map_id'].flatMap(key=>{
    const id=key==='placement'?p.placement?.mapId:p[key];
    return id&&!assets.rows.some(m=>m.databaseId===id)?[{propertyId:p.id,field:key,mapId:id,typedCatalogHasId:catalog.some(m=>m.id===id)}]:[];
  })),
};
writeFileSync(resolve(root,'docs/maps/live-reconciliation-preflight.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.result,null,2));
