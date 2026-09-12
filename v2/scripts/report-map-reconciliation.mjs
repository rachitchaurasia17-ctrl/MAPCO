import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const inv=read('docs/maps/donor-inventory.json');
const imp=read('docs/maps/import-decisions.json').imports;
const maps=read('v2/public/maps/index.json').maps;
const imported=new Map(imp.map(m=>[m.blob,m]));
const seen=new Map();
const decisions=inv.rows.map(row=>{
 let status,reason,target=null;
 const selected=imported.get(row.blob);
 if(selected){target=selected.id;status=row.path===selected.source?selected.classification:'exact-duplicate';reason=row.path===selected.source?'Printed map label and visible layout reviewed; committed bytes imported without cropping or geometry changes.':`Identical committed bytes to imported ${selected.source}`;}
 else if(row.canonicalId){status='already-present-exactly';target=row.canonicalId;reason='Identical Git blob already registered in MAPCO.';}
 else if(row.currentAsset){status='already-present-asset';target=row.currentAsset;reason='Committed MAPCO already owns these exact bytes. Existing illustration/overlay assets retained in place; no duplicated import or unverified calibration.';}
 else if(seen.has(row.blob)){status='exact-duplicate';target=seen.get(row.blob);reason='Repeated donor Git blob; use the first classified source.';}
 else if(/\.pdf$/i.test(row.path)){status='pdf-only';reason='Document-only candidate; current raster catalog requires an identified image with intrinsic dimensions. Not misrepresented as a raster asset.';}
 else if(/\.svg$/i.test(row.path)||row.path.startsWith('new_map_files/')){status='unsuitable';reason='Standalone vector/fragment artwork lacks reviewed raster alignment and map identity; not a complete calibrated map. Current overlays remain unchanged.';}
 else if(!row.candidate){status='obsolete';reason='Design screenshot, UI artwork, or unrelated media outside the map library; donor frontend is not being ported.';}
 else {
   status='semantic-duplicate';
   reason='Visual review: repeat scan/crop of an existing sheet with no useful additional coverage; existing MAPCO raster and pin coordinate space retained.';
   if(row.path.startsWith('maps/enhanced/')) reason='Enhanced/re-encoded version of the existing Panchkula sheet; no additional coverage. Existing pin coordinate space retained.';
   if(row.path==='mohali/hpso-developers-sector-122-1.jpg') reason='Misnamed duplicate of the Aerocity layout; not an HPSO Sector 122 map.';
 }
 seen.set(row.blob,row.path);
 return {...row,status,reason,target};
});
const candidates=decisions.filter(r=>r.candidate);
const counts=candidates.reduce((a,r)=>(a[r.status]=(a[r.status]??0)+1,a),{});
const coverage=maps.reduce((a,m)=>{a[m.city]??={total:0};a[m.city].total++;a[m.city][m.kind]=(a[m.city][m.kind]??0)+1;return a;},{});
const summary={donorCommit:inv.donorCommit,canonicalBase:inv.canonicalCommit,before:inv.before.length,after:maps.length,donorMedia:decisions.length,mapCandidates:candidates.length,unregisteredCandidates:candidates.filter(r=>!r.references.length).length,uniqueCandidateBlobs:new Set(candidates.map(r=>r.blob)).size,missingLegacyReferences:inv.missing.length,imported:imp.length,retainedAlternateRenderings:imp.filter(m=>m.classification==='alternate-rendering').length,counts,coverage,existingIdsChanged:0};
writeFileSync(resolve(root,'docs/maps/reconciliation.json'),JSON.stringify({summary,missing:inv.missing,decisions},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
