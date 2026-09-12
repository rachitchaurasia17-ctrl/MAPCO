// Read-only MAPCO-DEV asset reconciliation. Never publishes or changes rows.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'../..');
const input=JSON.parse(readFileSync(resolve(root,'docs/maps/inspection/live-before.json'),'utf8'));
const catalog=JSON.parse(readFileSync(resolve(root,'v2/public/maps/index.json'),'utf8')).maps;
const files=execFileSync('git',['ls-files','-z'],{cwd:root,maxBuffer:32*1024*1024}).toString().split('\0').filter(p=>/\.(png|jpe?g|webp)$/i.test(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const byHash=new Map();
for(const path of files){const h=sha(readFileSync(resolve(root,path)));byHash.set(h,[...(byHash.get(h)??[]),path]);}
const typed=catalog.map(m=>({...m,sha256:sha(readFileSync(resolve(root,'v2/public'+m.image)))}));
const rows=[];
for(const m of input.maps){
 const row={databaseId:m.id,dealerId:m.dealer_id,status:m.status,deleted:m.deleted,raster:m.raster,databaseDimensions:m.dims,assets:m.assets};
 try{
  const url=new URL(m.raster);
  if(url.origin!=='https://lswzrkvdwirhvggtvuch.supabase.co'||!url.pathname.startsWith('/storage/v1/object/public/maps/'))throw Error('Unapproved origin/path; manual review required');
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
  row.httpStatus=response.status;
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const b=Buffer.from(await response.arrayBuffer());row.sha256=sha(b);row.bytes=b.length;
  row.committedMatches=byHash.get(row.sha256)??[];
  row.typedMatches=typed.filter(t=>t.sha256===row.sha256).map(t=>t.id);
  const sameId=typed.find(t=>t.id===m.id);
  row.idCollision=!!sameId&&sameId.sha256!==row.sha256;
  row.sameIdTypedDimensions=sameId?.dimensions??null;
 }catch(e){row.error=e.message;}
 rows.push(row);
}
const report={project:'lswzrkvdwirhvggtvuch',mode:'read-only',databaseMaps:rows.length,typedMaps:typed.length,rows};
writeFileSync(resolve(root,'docs/maps/inspection/live-asset-reconciliation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({maps:rows.length,errors:rows.filter(r=>r.error),collisions:rows.filter(r=>r.idCollision),noCommittedMatch:rows.filter(r=>!r.error&&!r.committedMatches.length).map(r=>r.databaseId)},null,2));
