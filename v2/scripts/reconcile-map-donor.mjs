// Import reviewed asset bytes from the pinned donor commit, never its application code.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const donor=resolve(process.argv[2]);
const inventory=JSON.parse(readFileSync(resolve(root,'docs/maps/donor-inventory.json')));
const imports=[];
function add(source,id,name,city,kind,detail={},classification='new-useful') {
  const row=inventory.rows.find(r=>r.path===source);
  if(!row) throw new Error(`Not committed in donor: ${source}`);
  imports.push({source,blob:row.blob,id,name,city,kind,...detail,classification});
}
for(const [file,label,id] of [
  ['Aerocity-C.jpg','Block C','block-c'],['Aerocity-D.jpg','Block D','block-d'],
  ['aerocity-block-a.jpg','Blocks A and C','blocks-a-and-c'],
  ['aerocity-block-b.jpg','Blocks B and D','blocks-b-and-d'],
  ['aerocity-block-g.jpg','Blocks G and H','blocks-g-and-h'],
  ['aerocity-block-i.jpg','Block I','block-i'],['aerocity-block-j.jpg','Block J','block-j'],
]) add(`mohali/${file}`,`aerocity-${id}-reference`,`Aerocity ${label} Reference`,'Aerocity','PROJECT_MAP',{project:`aerocity ${label.toLowerCase()}`});
for(const [file,page] of [['aerocity-mohali.jpg','54'],['aerocity-mohali-1.jpg','55']])
  add(`mohali/${file}`,`aerocity-layout-sheet-${page}`,`Aerocity Layout — Sheet ${page}`,'Aerocity','PROJECT_MAP',{project:`aerocity layout sheet ${page}`},'alternate-rendering');
const projects=[
 ['ansal-sector-116.jpg','golf-links-ii-sector-116','Golf Links II Sector 116','116','golf links ii'],
 ['ansal-sector-116-1.jpg','golf-links-ii-sector-116-sheet-43','Golf Links II Sector 116 — Sheet 43','116','golf links ii sheet 43','alternate-rendering'],
 ['emaar-mgf-sector-108.jpg','emaar-mgf-sector-108','Emaar MGF Sector 108','108','emaar mgf sector 108'],
 ['emaar-mgf-sector-109.jpg','emaar-mgf-sector-109','Emaar MGF Sector 109','109','emaar mgf sector 109'],
 ['emaar-mgf-sector-99-104-105-106-108-109.jpg','emaar-mgf-composite-layout','Emaar MGF Sectors 99, 104–106, 108–109',null,'emaar mgf'],
 ['emaar-mgf-sector-99-104-105-106-108-109-1.jpg','emaar-mgf-composite-updated-reference','Emaar MGF Composite — Updated Reference Sheet',null,'emaar mgf updated reference','alternate-rendering'],
 ['ggp-sector-115.jpg','ggp-sector-115','GGP Sector 115','115','ggp'],
 ['gulmohar-city-sector-125.jpg','gulmohar-complex-sector-125','Gulmohar Complex Sector 125','125','gulmohar complex'],
 ['gulmohar-sector-116.jpg','gulmohar-residency-sector-116','Gulmohar Residency Sector 116','116','gulmohar residency'],
 ['highway-city.jpg','highway-city-mohali','Highway City',null,'highway city'],
 ['jtpl-city-sector-115.jpg','jtpl-city-sector-115','JTPL City Sector 115','115','jtpl city'],
 ['pearls-city-sector-100.jpg','pearls-city-sector-100-sheet-32','Pearls City Sector 100 — Sheet 32','100','pearls city sheet 32','alternate-rendering'],
 ['pearls-city-sector-100-2.jpg','pearls-city-sector-100-sheet-34','Pearls City Sector 100 — Sheet 34','100','pearls city sheet 34','alternate-rendering'],
 ['pearls-city-sector-104.jpg','pearl-city-sector-104','Pearl City Sector 104','104','pearl city'],
 ['rkm-sector-112.jpg','rkm-sector-112','RKM Sector 112','112','rkm'],
 ['shiva-enclave.jpg','shiva-enclave-mohali','Shiva Enclave',null,'shiva enclave'],
 ['shivalik-avenue-sector-125.jpg','shivalik-avenue-sector-125','Shivalik Avenue Sector 125','125','shivalik avenue'],
 ['shivalik-city-sector-127.jpg','shivalik-city-sector-127-sheet-52','Shivalik City Sector 127 — Sheet 52','127','shivalik city sheet 52','alternate-rendering'],
 ['shivalik-city-sector-127-1.jpg','shivalik-city-sector-127-sheet-53','Shivalik City Sector 127 — Sheet 53','127','shivalik city sheet 53','alternate-rendering'],
 ['sky-rock-city-sector-111-112.jpg','sky-rock-city-sector-111-112','Sky Rock City Sectors 111–112',null,'sky rock city'],
 ['tdi-city-sector-110-111.jpg','tdi-city-sector-110-111','TDI City Sectors 110–111',null,'tdi city 110 111'],
 ['tdi-city-sector-117.jpg','tdi-city-sector-117-119','TDI City Sectors 117–119',null,'tdi city 117 119'],
];
for(const [f,id,name,sector,project,classification] of projects)
  add(`mohali/${f}`,id,name,'Mohali','PROJECT_MAP',{...(sector?{sector}:{}),project},classification);
for(const [f,id,name,sector] of [
 ['industrial-area-phase-7.jpg','industrial-focal-point-phase-7','Industrial Focal Point Phase 7','phase 7'],
 ['industrial-area-phase-vi.jpg','industrial-area-phase-6','Industrial Area Phase 6','phase 6'],
 ['industrial-focal-point-phase-v.jpg','industrial-focal-point-phase-5','Industrial Focal Point Phase 5','phase 5'],
 ['industrial-growth.jpg','industrial-growth-mohali','Mohali Industrial Growth Layout',null],
]) add(`mohali/${f}`,id,name,'Mohali','INDUSTRIAL_MAP',sector?{sector}:{});
// The directory name is misleading: landmarks and sheet labels establish Chandigarh.
// Several numeric filenames are off by one; explicitly use the printed sector.
for(const [file,sector] of [['10.jpg','10'],['11.jpg','11'],['16.jpg','15'],["19 '.jpg",'19'],['23.jpg','23'],['24.jpg','24'],['26.jpg','26'],['27.jpg','27'],['32.jpg','31'],['4.jpg','4'],['43.jpg','42'],['48.jpg','48']])
  add(`new chandigarh/${file}`,`chandigarh-sector-${sector}`,`Chandigarh Sector ${sector}`,'Chandigarh','SECTOR_MAP',{sector});

const byId={};
for(const m of inventory.before) {
  if(m.city==='Panchkula' && m.kind==='SECTOR_MAP') {
    const n=m.sector.replace(/p$/,'');
    const mdc=m.project==='mansa devi complex';
    byId[m.id]={name:`Panchkula ${mdc?'Mansa Devi Complex ':''}Sector ${n.toUpperCase()}`,sector:mdc?`mdc ${n}`:n,aliases:[m.name]};
  }
}
Object.assign(byId,{
 'eco-city-1':{name:'Eco City I — New Chandigarh',city:'New Chandigarh',project:'eco city 1',aliases:['Eco City I','Mullanpur Eco City']},
 'ecocity-mohali':{name:'Eco City II — New Chandigarh',city:'New Chandigarh',project:'eco city 2',aliases:['Ecocity Phase 2','Mullanpur Eco City II']},
 'gamada-aerocity-mohali':{name:'Aerocity Blocks E and F Reference',kind:'PROJECT_MAP',project:'aerocity blocks e and f'},
 'aerocity-masterplan':{name:'Greater Mohali and Aerotropolis Regional Plan',city:'Aerotropolis',aliases:['Aerocity Masterplan','Greater Mohali Regional Plan']},
 'panchulka-masterplan':{name:'Panchkula Masterplan',aliases:['Panchulka Masterplan']},
 'panchulka-extenstion':{name:'Panchkula Extension Masterplan',aliases:['Panchulka Extension']},
 'amravti':{name:'Amravati Enclave',aliases:['Amravti','Amravati']},
 'sctor-34-chd':{name:'Chandigarh Sector 34',aliases:['Sctor 34 Chd']},
 'secter-32-chd':{name:'Chandigarh Sector 32 — Reference',aliases:['Secter 32 Chd']},
 'sector-63-mohalli':{name:'Mohali Sector 63',aliases:['Sector 63 Mohalli']},
 'sector-67-mohli':{name:'Mohali Sector 67',aliases:['Sector 67 Mohli']},
});
const sourceOverrides={};
mkdirSync(resolve(root,'non 3d maps/legacy'),{recursive:true});
for(const m of imports){
  const source=`legacy/${m.id}.jpg`;
  const bytes=execFileSync('git',['-C',donor,'cat-file','blob',m.blob],{maxBuffer:32*1024*1024});
  writeFileSync(resolve(root,'non 3d maps',source),bytes);
  const {blob,classification,source:donorSource,...metadata}=m;
  sourceOverrides[source]=metadata;
}
writeFileSync(resolve(root,'v2/scripts/map-curation.json'),JSON.stringify({version:1,byId,sources:sourceOverrides},null,2)+'\n');
writeFileSync(resolve(root,'docs/maps/import-decisions.json'),JSON.stringify({donorCommit:inventory.donorCommit,imports},null,2)+'\n');
console.log(`Imported ${imports.length} committed images; ${imports.filter(x=>x.classification==='alternate-rendering').length} complementary reference sheets.`);
