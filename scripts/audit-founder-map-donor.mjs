// Read-only comparison of donor map directories against the canonical library.
// No JavaScript from the donor is executed; only image bytes and JSON are read.
import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,extname} from 'node:path';
import {createHash} from 'node:crypto';
const donor=resolve(process.argv[2]??'');
if(!process.argv[2] || !existsSync(join(donor,'app/plotmap/map-registry.js')))throw new Error('Pass the donor repository directory.');
const root=resolve(import.meta.dirname,'..');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const current=readFileSync(join(root,'v2/src/packages/maps/sector-map-registry.ts'),'utf8').split('\n').map(line=>line.trim().replace(/,$/,'' )).filter(line=>line.startsWith('{"id"')).map(line=>JSON.parse(line));
const known=new Map(current.map(row=>[hash(join(root,'v2/public',row.image)),row.id]));
const raw=readFileSync(join(donor,'app/plotmap/map-registry.js'),'utf8');
const legacy=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
const registered=new Set(legacy.maps.flatMap(row=>[row.easyMapSrc,row.originalMapSrc].filter(Boolean).map(url=>decodeURIComponent(url).replace(/^\//,''))));
const files=[];
function walk(path){for(const entry of readdirSync(path,{withFileTypes:true})){const absolute=join(path,entry.name);if(entry.isDirectory())walk(absolute);else if(['.png','.jpg','.jpeg','.webp'].includes(extname(entry.name).toLowerCase()))files.push(absolute);}}
for(const folder of ['maps','normal maps','mohali','new chandigarh','panchulka','new_map_files'])if(existsSync(join(donor,folder)))walk(join(donor,folder));
const rows=files.map(path=>{const bytes=readFileSync(path);const sha256=createHash('sha256').update(bytes).digest('hex');const source=relative(donor,path).replaceAll('\\','/');return {source,bytes:bytes.length,sha256,registered:registered.has(source),canonicalId:known.get(sha256)??null};});
const unmatched=rows.filter(row=>!row.canonicalId);
const result={canonicalMaps:current.length,donorRegisteredMaps:legacy.maps.length,scannedImages:rows.length,byteIdenticalImages:rows.length-unmatched.length,unmatchedImages:unmatched.length,uniqueUnmatchedImages:new Set(unmatched.map(row=>row.sha256)).size,unregisteredUnmatchedImages:unmatched.filter(row=>!row.registered).length,rows};
writeFileSync(join(root,'docs/founder-control/map-folder-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,rows:unmatched.filter(row=>!row.registered).map(row=>row.source).slice(0,45)},null,2));
