/* ═══════════════════════════════════════════════════════════════
   MAPCO V2 — Mock Data Adapter
   Seed data matches the design .dc.html files exactly
   ═══════════════════════════════════════════════════════════════ */
import type { DataAdapter, Property, Client, Deal, ClientLink, MapData, DemandSignal } from './types';

export const PROPERTIES: Property[] = [
  { id:'ecocity', type:'Residential Plot', want:'Plot', city:'New Chandigarh', area:'Eco City', loc:'Eco City, New Chandigarh', sector:'Eco City, New Chandigarh', size:'500 sq yd', facing:'North-East', position:'Park facing', approvals:['RERA','GMADA'], landmarks:[{name:'Chandigarh University',distance:'10 min',icon:'ph-fill ph-graduation-cap'},{name:'CP67 Mall',distance:'8 min',icon:'ph-fill ph-storefront'},{name:'PGIMER Hospital',distance:'22 min',icon:'ph-fill ph-first-aid-kit'},{name:'Chandigarh Airport',distance:'25 min',icon:'ph-fill ph-airplane-tilt'}], price:9500000, photos:['/assets/ph-plot-1.png','/assets/ph-plot-2.png','/assets/ph-plot-3.png','/assets/ph-plot-1.png','/assets/ph-plot-2.png','/assets/ph-plot-3.png'], published:true, sold:false, views:34, owner:{name:'Harbhajan Gill',phone:'+919815500101',priceConfirmedAt:'2026-07-20'} },
  { id:'block5', type:'Residential Plot', want:'Plot', city:'New Chandigarh', area:'Zone 2', loc:'Zone 2, New Chandigarh', sector:'Zone 2, New Chandigarh', size:'300 sq yd', facing:'East', position:'Corner plot', approvals:['GMADA'], landmarks:[{name:'Delhi Public School',distance:'5 min',icon:'ph-fill ph-graduation-cap'},{name:'Leisure Valley Park',distance:'7 min',icon:'ph-fill ph-tree'},{name:'City Centre Market',distance:'9 min',icon:'ph-fill ph-storefront'}], price:5400000, photos:['/assets/ph-plot-2.png','/assets/ph-plot-3.png','/assets/ph-plot-1.png','/assets/ph-plot-2.png','/assets/ph-plot-3.png','/assets/ph-plot-1.png'], published:true, sold:false, views:21, owner:{name:'Satnam Kaur',phone:'+919815500202',priceConfirmedAt:'2026-07-28'} },
  { id:'aero', type:'Residential Plot', want:'Plot', city:'Mohali', area:'Aerocity', loc:'Aerocity, Mohali', sector:'Aerocity, Mohali', size:'300 sq yd', facing:'West', position:'Inside plot', approvals:['RERA','GMADA'], landmarks:[{name:'Chandigarh Airport',distance:'6 min',icon:'ph-fill ph-airplane-tilt'},{name:'ISB Mohali',distance:'12 min',icon:'ph-fill ph-graduation-cap'},{name:'CP67 Mall',distance:'10 min',icon:'ph-fill ph-storefront'}], price:7200000, photos:['/assets/ph-plot-3.png','/assets/ph-plot-1.png','/assets/ph-plot-2.png','/assets/ph-plot-3.png','/assets/ph-plot-1.png','/assets/ph-plot-2.png'], published:true, sold:false, views:18 },
  { id:'sec79', type:'Residential Plot', want:'Plot', city:'Mohali', area:'Sector 79', loc:'Sector 79, Mohali', sector:'Sector 79, Mohali', size:'250 sq yd', facing:'East', position:'Corner plot', approvals:['RERA'], landmarks:[{name:'Airport Road',distance:'2 min',icon:'ph-fill ph-road-horizon'},{name:'JLPL Falcon View',distance:'8 min',icon:'ph-fill ph-city'},{name:'PGIMER Hospital',distance:'20 min',icon:'ph-fill ph-first-aid-kit'}], price:4800000, photos:['/assets/ph-plot-1.png','/assets/ph-plot-2.png','/assets/ph-plot-3.png','/assets/ph-plot-1.png','/assets/ph-plot-2.png','/assets/ph-plot-3.png'], published:true, sold:false, views:12 },
  { id:'sec66', type:'Residential Plot', want:'Plot', city:'Mohali', area:'Sector 66', loc:'Sector 66, Mohali', sector:'Sector 66, Mohali', size:'200 sq yd', facing:'South', position:'Park facing', approvals:['GMADA'], landmarks:[{name:'Leisure Valley Park',distance:'4 min',icon:'ph-fill ph-tree'},{name:'CP67 Mall',distance:'7 min',icon:'ph-fill ph-storefront'},{name:'Chandigarh University',distance:'18 min',icon:'ph-fill ph-graduation-cap'}], price:3600000, photos:['/assets/ph-plot-2.png','/assets/ph-plot-3.png','/assets/ph-plot-1.png','/assets/ph-plot-2.png','/assets/ph-plot-3.png','/assets/ph-plot-1.png'], published:true, sold:false, views:8 },
  { id:'omx', type:'Kothi', want:'Kothi', city:'New Chandigarh', area:'Omaxe', loc:'Omaxe, New Chandigarh', sector:'Omaxe, New Chandigarh', size:'1 kanal', facing:'North', position:'Corner plot', approvals:['RERA','GMADA'], landmarks:[{name:'Medicity',distance:'9 min',icon:'ph-fill ph-first-aid-kit'},{name:'Chandigarh University',distance:'14 min',icon:'ph-fill ph-graduation-cap'},{name:'GMADA Expressway',distance:'3 min',icon:'ph-fill ph-road-horizon'}], price:15000000, photos:['/assets/ph-plot-3.png','/assets/ph-plot-1.png','/assets/ph-plot-2.png','/assets/ph-plot-3.png','/assets/ph-plot-1.png','/assets/ph-plot-2.png'], published:true, sold:false, views:28 },
  { id:'jlpl', type:'Flat', want:'Flat', city:'Mohali', area:'Sector 66A', loc:'Sector 66A, Mohali', sector:'Sector 66A, Mohali', size:'3 BHK', facing:'East', position:'Floor 12', approvals:['RERA'], landmarks:[{name:'CP67 Mall',distance:'5 min',icon:'ph-fill ph-storefront'}], price:8500000, photos:[], published:false, sold:false, views:0 },
  { id:'villa1', type:'Villa', want:'Villa', city:'Panchkula', area:'Sector 20', loc:'Sector 20, Panchkula', sector:'Sector 20, Panchkula', size:'400 sq yd', facing:'South', position:'Inside plot', approvals:['HUDA'], landmarks:[{name:'Sector 5 Market',distance:'8 min',icon:'ph-fill ph-storefront'}], price:12000000, photos:[], published:false, sold:false, views:0 },
];

export const CLIENTS: Client[] = [
  { id:'c1', name:'Rajiv Sharma', phone:'+919876543210', city:'Chandigarh', want:'Plot', budget:'80L – 1.2Cr', budgetMax:12000000, status:'hot', seen:'just now', note:'Looking for park-facing plot in New Chandigarh.', viewed:['ecocity','block5'], interest:['ecocity'], isNew:false },
  { id:'c2', name:'Priya Mehta', phone:'+919876543211', city:'Mohali', want:'Plot', budget:'40L – 60L', budgetMax:6000000, status:'active', seen:'2 hours ago', note:'Wants East facing in Mohali.', viewed:['sec79','sec66'], interest:['sec79'], isNew:false },
  { id:'c3', name:'Amandeep Singh', phone:'+919876543212', city:'New Chandigarh', want:'Kothi', budget:'1.2Cr – 2Cr', budgetMax:20000000, status:'active', seen:'yesterday', note:'Big family, needs corner.', viewed:['omx'], interest:['omx'], isNew:false },
  { id:'c4', name:'Neha Kapoor', phone:'+919876543213', city:'Panchkula', want:'Flat', budget:'60L – 90L', budgetMax:9000000, status:'active', seen:'3 days ago', note:'3 BHK minimum.', viewed:['jlpl'], interest:[], isNew:true },
  { id:'c5', name:'Suresh Gupta', phone:'+919876543214', city:'Chandigarh', want:'Plot', budget:'50L – 80L', budgetMax:8000000, status:'cold', seen:'1 week ago', note:'Not in a hurry.', viewed:[], interest:[], isNew:false },
  { id:'c6', name:'Harpreet Kaur', phone:'+919876543215', city:'Mohali', want:'Villa', budget:'1Cr – 1.5Cr', budgetMax:15000000, status:'hot', seen:'just now', note:'Looking for gated community.', viewed:['omx','ecocity'], interest:['omx'], isNew:true },
];

/**
 * Deals are COMPLETED sales only (a register, not a pipeline). These seeds are
 * historical sales whose plots have already left the live inventory, so they
 * reference their own snapshot data rather than active PROPERTIES rows. New sales
 * created at runtime via `record()` flip the referenced property to sold. Buyer,
 * seller, price, payment, commission and documents are all dealer-private.
 */
export const DEALS: Deal[] = [
  {
    id:'d1', propId:'blk5sold', prop:'Block 5 site', propSub:'300 sq yd · East',
    city:'New Chandigarh', sector:'Zone 2', buyerId:'c6', buyer:'Harpreet Kaur',
    seller:'Gurmeet Singh', sellerPhone:'+919812000011',
    soldPrice:5400000, brokerage:108000, commission:81000, commissionReceived:true, paymentReceived:5400000,
    soldDate:'2026-06-18', registrationDate:'2026-06-27', dealer:'Chaurasia Properties',
    documents:[{name:'Sale agreement.pdf',kind:'agreement'},{name:'Registry receipt.pdf',kind:'registry'}],
    timeline:[
      { at:'2026-06-10', label:'Sale agreed' },
      { at:'2026-06-18', label:'Sold price recorded' },
      { at:'2026-06-27', label:'Registration completed' },
      { at:'2026-06-30', label:'Commission received' },
    ],
  },
  {
    id:'d2', propId:'wardsold', prop:'Sector 88 plot', propSub:'250 sq yd · West',
    city:'Mohali', sector:'Sector 88', buyerId:'c2', buyer:'Priya Mehta',
    seller:'Ravinder Kaur', sellerPhone:'+919812000022',
    soldPrice:6300000, brokerage:126000, commission:94500, commissionReceived:false, paymentReceived:4000000,
    soldDate:'2026-07-12', registrationDate:'2026-07-21', dealer:'Chaurasia Properties',
    documents:[{name:'Sale agreement.pdf',kind:'agreement'}],
    timeline:[
      { at:'2026-07-05', label:'Sale agreed' },
      { at:'2026-07-12', label:'Sold price recorded' },
      { at:'2026-07-21', label:'Registration completed' },
    ],
  },
  {
    id:'d3', propId:'omxsold', prop:'Omaxe kothi site', propSub:'1 kanal · North',
    city:'New Chandigarh', sector:'Omaxe', buyerId:'c3', buyer:'Amandeep Singh',
    seller:'Baldev Raj', sellerPhone:'+919812000033',
    soldPrice:15200000, brokerage:304000, commission:228000, commissionReceived:false, paymentReceived:9000000,
    soldDate:'2026-07-28', registrationDate:undefined, dealer:'Chaurasia Properties',
    documents:[{name:'Token receipt.pdf',kind:'receipt'}],
    timeline:[
      { at:'2026-07-20', label:'Sale agreed' },
      { at:'2026-07-28', label:'Sold price recorded' },
    ],
  },
];

export const CLIENT_LINKS: ClientLink[] = [
  { id:'l1', clientId:'c1', clientName:'Rajiv Sharma', props:['ecocity','block5'], propNames:['Eco City plot','Block 5 site'], expiry:'7d', loc:'area', price:'hidden', audio:'done', audioSecs:45, status:'active', events:{opens:8,played:3,called:1,wa:2,visit:1}, lastOpen:'2 hrs ago' },
  { id:'l2', clientId:'c2', clientName:'Priya Mehta', props:['sec79','aero'], propNames:['Sector 79 plot','Aerocity plot'], expiry:'3d', loc:'exact', price:'shown', audio:'none', audioSecs:0, status:'active', events:{opens:3,played:0,called:0,wa:1,visit:0}, lastOpen:'yesterday' },
  { id:'l3', clientId:'c3', clientName:'Amandeep Singh', props:['omx'], propNames:['Omaxe kothi site'], expiry:'14d', loc:'area', price:'hidden', audio:'done', audioSecs:90, status:'active', events:{opens:12,played:5,called:2,wa:3,visit:2}, lastOpen:'just now' },
  { id:'l4', clientId:'c5', clientName:'Suresh Gupta', props:['sec66'], propNames:['Sector 66 plot'], expiry:'7d', loc:'area', price:'hidden', audio:'none', audioSecs:0, status:'revoked', events:{opens:1,played:0,called:0,wa:0,visit:0}, lastOpen:'5 days ago' },
];

export const DEMAND_SIGNALS: DemandSignal[] = [
  { city:'New Chandigarh', opens:83, color:'#ffc93c' },
  { city:'Mohali', opens:51, color:'#5b32c4' },
  { city:'Chandigarh', opens:29, color:'#12a150' },
  { city:'Panchkula', opens:14, color:'#e8763a' },
  { city:'Zirakpur', opens:9, color:'#3d8fb8' },
  { city:'Other areas', opens:6, color:'#c9b48a' },
];

/* ── local persistence ────────────────────────────────────────
   MAPCO V2 runs as a multi-page app, so each route is a fresh page
   load and the in-memory fixtures would reset on every navigation —
   making the app feel disconnected. To make mock mode feel real and
   interlinked on a device, the mutable collections are mirrored to
   localStorage: anything added/edited/sold on one page shows up on
   every other page (Client Presentation, Customers, Links…). True
   cross-device persistence still requires Supabase mode.
   ─────────────────────────────────────────────────────────────── */
const MOCK_LS_KEY = 'mapco.mock.v2';

export function persistMock(): void {
  try {
    localStorage.setItem(MOCK_LS_KEY, JSON.stringify({
      properties: PROPERTIES, clients: CLIENTS, deals: DEALS, links: CLIENT_LINKS,
    }));
  } catch { /* storage unavailable (private mode / SSR) — stay in-memory */ }
}

function hydrateMock(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(MOCK_LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw) as Partial<{ properties: Property[]; clients: Client[]; deals: Deal[]; links: ClientLink[] }>;
    if (Array.isArray(d.properties)) PROPERTIES.splice(0, PROPERTIES.length, ...d.properties);
    if (Array.isArray(d.clients)) CLIENTS.splice(0, CLIENTS.length, ...d.clients);
    if (Array.isArray(d.deals)) DEALS.splice(0, DEALS.length, ...d.deals);
    if (Array.isArray(d.links)) CLIENT_LINKS.splice(0, CLIENT_LINKS.length, ...d.links);
  } catch { /* corrupt store — fall back to seeds */ }
}

hydrateMock();

export class MockDataAdapter implements DataAdapter {
  async getProperties(): Promise<Property[]> { return PROPERTIES; }
  async getClients(): Promise<Client[]> { return CLIENTS; }
  async getDeals(): Promise<Deal[]> { return DEALS; }
  async getClientLinks(): Promise<ClientLink[]> { return CLIENT_LINKS; }
  async getMaps(): Promise<MapData[]> { return []; }
  async getDemandSignals(): Promise<DemandSignal[]> { return DEMAND_SIGNALS; }
}

export const dataAdapter: DataAdapter = new MockDataAdapter();
