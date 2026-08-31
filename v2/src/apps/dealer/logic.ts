// @ts-nocheck
import { DCLogic, Router } from '../../framework/dc';
import { deskStore } from './desk-store';
import { MAP_REGISTRY as CANONICAL_SECTOR_MAPS } from '../../packages/maps/sector-map-registry';
import { loadGoogleMaps, importMapsLibrary, GOOGLE_MAPS_MAP_ID } from '../../packages/maps/google-loader';
import { productRoutes } from '../../packages/ui/product-routes';

export class Component extends DCLogic {
  state = {
    section: 'areas', celebrate: null, tlAll: false, invView: 'live', dealView: 'live', selectedDeal: null, dealEdit: false, dealSearch: '', clientSearch: '', selectedClient: null, clientFilter: 'all',
    addOpen: false, addClientOpen: false, plotCity: 'all', plotCityOpen: false, p: 0, linkFor: null, delArm: false,
    cardMenu: null, shareFor: null, shareDone: null, sharesFor: null, mobileFor: null, propDetail: null, propShot: 0, more: false, pdTab: 'gallery', pdMedia: 'photos', cpTab: 'overview', moreDetailsOpen: false,
    addPlotOpen: false, pstep: 1, pEditId: null, propQ: '', filtersOpen: false, fType: 'all', fState: 'all', pSaved: false,
    sellerQ: '', sellerAdd: false, sellerView: null, svTab: 'overview', docName: '', docOpen: null, docPickOpen: false, docNewName: '', docNewOpen: false,
    savingProp: false, propDocsOpen: false, quickView: 'all',
    nsform: { name: '', phone: '', phone2: '', business: '', kind: 'Individual', city: '', note: '' },
    soldForm: { price: '', buyerId: '', buyerName: '', buyerPhone: '', comm: '', date: '', buyerNew: false, buyerQ: '' },
    pform: {
      city: '', area: '', society: '', address: '', type: 'Residential Plot', size: '', unit: 'sq yd', carpet: '', rate: '', pooja: false, store: false, servant: false, lift: false, powerBackup: false, cornerShop: false, shutters: '', washrooms: '', facing: 'East', road: '', plotNo: '', showPlotNo: true, corner: false, parkFacing: false, tenure: 'Freehold', beds: '3', baths: '2', floor: '', totalFloors: '', balconies: '1', parking: '1', furnishing: 'Unfurnished', age: 'New', possession: 'Ready to move', frontage: '', use: '', mainRoad: false, avail: 'available', price: '', photos: [0, 1, 2], cover: 0, video: false, docs: [], highlights: [], customHl: '', registry: '', approval: '', notes: '', earth: false, earthQ: '', sector: '',
      sellerId: '', askPrice: '', relation: 'Owner', availConfirmed: true, lastConfirmed: 'Today', visitNote: '', sellerPropNote: '', sellerDocs: []
    },
    lstep: 1, linkCopied: false, priceEdit: null, priceVal: '', unpubFor: null, unpubReason: '', soldFor: null, delPlot: false, delClient: false,
    linkBuild: null, lform: { clientId: '', newName: '', newPhone: '', newBusiness: '', plots: [], expiry: '3d', loc: 'area', price: 'hidden', audio: 'none', secs: 0, note: '' },
    sform: { clientId: '', newName: '', newPhone: '', expiry: '3d', loc: 'area', price: 'hidden', photos: [0, 1, 2, 3], audio: 'none', secs: 0 },
    wiz: { step: 1, clientId: '', useNewClient: false, ncName: '', ncPhone: '', propId: '', useManualProp: false, mpLoc: '', mpSize: '', name: '', value: '', comm: '', stage: 'negotiating', sellerName: '', sellerPhone: '', q1: '', q2: '' },
    cform: { name: '', phone: '', want: 'Plot', city: 'Mohali', budgetFrom: '', budgetTo: '', unit: 'Cr', note: '', plots: [] },
    contactMode: 'clients', cliQ: '', cliFilter: 'all', sellQ: '', addClientBig: false, addSellerOpen: false, sellerProfile: null,
    savingSeller: false, sellerError: '', sellerEditId: null,
    savingSold: false, soldError: '', propError: '', propMissing: [],
    savingClient: false, clientError: '',
    cliEdit: false, noteDraft: '', cpPick: false, cpPickQ: '', cpGroup: 'shortlisted', linkView: null, linkTab: 'focus', lkQ: '', lkFilter: 'all', linksTab: 'props', arch: null,
    cf: { name: '', phone: '', phone2: '', business: '', city: '', types: [], areas: [], budgetFrom: '', budgetTo: '', sizeFrom: '', sizeTo: '', prefs: [], customPref: '', stage: 'Just looking', note: '', areaDraft: '' },
    sf2: { name: '', phone: '', phone2: '', business: '', kind: 'Individual', city: '', note: '' },
    sendLinkType: 'all', sendLinkCity: 'all', viewDoc: null
  };

  CITIES = ['Mohali', 'Aerocity', 'Aerotropolis', 'New Chandigarh', 'Zirakpur', 'Kharar', 'Derabassi', 'Panchkula', 'Chandigarh'];
  INTEREST = { 'New Chandigarh': 46, 'Aerocity': 41, 'Mohali': 34, 'Chandigarh': 26, 'Aerotropolis': 22, 'Zirakpur': 18, 'Panchkula': 14, 'Kharar': 9, 'Derabassi': 6 };

  NAV = [
    { key: 'areas', label: 'Home', icon: 'ph-house' },
    { key: 'properties', label: 'Properties', icon: 'ph-buildings' },
    { key: 'clients', label: 'Contacts', icon: 'ph-address-book' },
    { key: 'links', label: 'Client Links', icon: 'ph-paper-plane-tilt' },
    { key: 'deals', label: 'Deals', icon: 'ph-handshake' },
  ];
  SECMETA = { links: { name: 'Client Links', icon: 'ph-paper-plane-tilt' }, dashboard: { name: 'Home', icon: 'ph-house' }, deals: { name: 'Deals', icon: 'ph-handshake' }, plots: { name: 'Plots', icon: 'ph-map-pin-area' }, properties: { name: 'Properties', icon: 'ph-buildings' }, clients: { name: 'Contacts', icon: 'ph-address-book' }, areas: { name: 'Home', icon: 'ph-trend-up' } };
  STAGES = [
    { key: 'enquiry', label: 'Enquiry', color: '#5b32c4', bg: '#e7defc', card: '#f4eeff', border: '#ddd0f5' },
    { key: 'negotiating', label: 'Negotiating', color: '#a8600c', bg: '#ffe9a8', card: '#fff6dc', border: '#f6e3ab' },
    { key: 'token', label: 'Token', color: '#b8471a', bg: '#ffd9c2', card: '#fff0e4', border: '#f8cba6' },
    { key: 'registry', label: 'Registry', color: '#0f6f8a', bg: '#cceaf3', card: '#e9f6fa', border: '#b6ddea' },
    { key: 'closed', label: 'Closed', color: '#0b8f45', bg: '#c9f0d9', card: '#e6f8ed', border: '#a6e3c0' },
    { key: 'lost', label: 'Lost', color: '#c2185b', bg: '#ffd3de', card: '#fff0f4', border: '#f7c4cd' },
  ];
  WANTS = ['Plot', 'Flat', 'Kothi', 'Villa', 'Commercial'];
  BANDS = [{ l: 'Under ₹1 Cr', max: 1e7 }, { l: '₹1–2 Cr', max: 2e7 }, { l: '₹2–3 Cr', max: 3e7 }, { l: '₹3 Cr & above', max: Infinity }];
  ownerName = 'Rajinder Singh'; bizName = 'Rajinder Estates'; ownerInitials = 'RS';
  blankWiz() { return { step: 1, clientId: '', useNewClient: false, ncName: '', ncPhone: '', propId: '', useManualProp: false, mpLoc: '', mpSize: '', name: '', value: '', comm: '', stage: 'negotiating', sellerName: '', sellerPhone: '', q1: '', q2: '' }; }
  plotPhoto(pr, i) {
    if (!pr) return '/assets/ph-plot-1.png';
    const want = pr.want || (pr.type && pr.type.includes('Plot') ? 'Plot' : pr.type && pr.type.includes('Commercial') ? 'Commercial' : pr.type && (pr.type.includes('Villa') || pr.type.includes('Kothi')) ? 'Villa' : 'Plot');
    const kind = (want === 'Plot') ? 'plot' : (want === 'Commercial' ? 'landmark' : (want === 'Villa' || want === 'Kothi' ? 'project' : 'landmark'));
    const v = (((pr.id || 'P1').length + (i || 0)) % 3) + 1;
    return `/assets/ph-${kind}-${v}.png`;
  }
  propIcon(p) { const t = (p || '').toLowerCase(); if (t.includes('villa')) return 'ph-fill ph-house'; if (t.includes('kothi')) return 'ph-fill ph-house-line'; if (t.includes('flat') || t.includes('floor')) return 'ph-fill ph-buildings'; if (t.includes('commercial') || t.includes('sco') || t.includes('booth')) return 'ph-fill ph-storefront'; return 'ph-fill ph-map-pin-area'; }

  PAPERS = ['Jamabandi / fard', 'Mutation — intkaal', 'No-dues NOC', 'Approved site map', 'Sale agreement', 'Registry deed'];
  DOCDATES = ['24 Jul', '29 Jul', '2 Aug', '6 Aug', '9 Aug', '12 Aug'];
  docExtra = {};
  papersFor(d) {
    const n = { enquiry: 1, negotiating: 2, token: 3, registry: 5, closed: 6, lost: 2 }[d.stage] || 1;
    return this.PAPERS.map((p, i) => ({ name: p, have: i < n }));
  }
  docsFor(d) {
    const out = this.papersFor(d).filter(p => p.have).map((p, i) => ({ name: p.name, type: i % 2 ? 'photo' : 'pdf', when: this.DOCDATES[i] || '—' }));
    if (d.token) out.push({ name: 'Token receipt · ' + this.inr(d.token), type: 'receipt', when: '6 Aug' });
    if (d.stage === 'closed') out.push({ name: 'Registry payment receipt', type: 'receipt', when: '12 Aug' });
    return out.concat(this.docExtra[d.id] || []);
  }
  timelineFor(d) {
    const order = ['enquiry', 'negotiating', 'token', 'registry', 'closed'];
    const upto = d.stage === 'lost' ? 1 : Math.max(0, order.indexOf(d.stage));
    const when = ['24 Jul', '29 Jul', '3 Aug', '8 Aug', '12 Aug'];
    const first = d.client.split(' ')[0];
    const ev = [{ icon: 'ph-fill ph-phone-call', label: 'Called ' + first, detail: 'First talk about ' + d.propSub, when: '22 Jul', bg: '#d9f5e3', fg: '#0b8f45' }];
    for (let i = 0; i <= upto; i++) {
      const m = this.stageMeta(order[i]);
      ev.push({ icon: 'ph-fill ph-flag', label: 'Moved to ' + m.label, detail: i === 0 ? 'Added to your deal book' : 'Stage updated by you', when: when[i], bg: '#f3eeff', fg: '#7d5cc6' });
    }
    const papers = this.papersFor(d).filter(p => p.have);
    if (papers.length > 1) ev.push({ icon: 'ph-fill ph-files', label: 'Papers received', detail: papers.slice(-2).map(p => p.name).join(' · '), when: '8 Aug', bg: '#fff3d1', fg: '#a8792a' });
    if (d.token) ev.push({ icon: 'ph-fill ph-coins', label: 'Money received', detail: this.inr(d.token) + ' token from ' + first, when: '3 Aug', bg: '#d9f5e3', fg: '#0b8f45' });
    if (d.stage === 'lost') ev.push({ icon: 'ph-fill ph-x-circle', label: 'Deal lost', detail: 'Buyer went with another dealer', when: '11 Aug', bg: '#ffe4ea', fg: '#c2185b' });
    else if (d.stage === 'closed') ev.push({ icon: 'ph-fill ph-seal-check', label: 'Registry done', detail: 'Full payment received, keys handed over', when: '12 Aug', bg: '#d9f5e3', fg: '#0b8f45' });
    else ev.push({ icon: 'ph-fill ph-note', label: 'You noted', detail: 'Follow up with ' + first + ' this week', when: '12 Aug', bg: '#f4ecdd', fg: '#a8792a' });
    return ev.reverse();
  }
  waLink(p) { return 'https://wa.me/' + String(p || '').replace(/[^0-9]/g, ''); }

  TODAY = 25;
  deals = [
    {
      id: 'D1', name: 'Gill · Sector 79 plot', client: 'Harpreet Singh Gill', clientId: 'C1', prop: 'Residential Plot · 250 sq yd', propSub: 'Sector 79, Mohali', area: 'Mohali', propId: 'P1',
      value: 16000000, comm: 240000, token: 500000, stage: 'registry', created: '6 Aug', createdDay: 6,
      cB: 1, cS: 0.5, registryDay: 29,
      next: { k: 'Collect document', note: 'Registry papers from Balwinder — fard and mutation', day: 26 },
      pay: [{ k: 'token', amt: 500000, d: '20 Aug', note: 'Cash, receipt signed' }],
      hist: [{ s: 'negotiating', d: '6 Aug' }, { s: 'token', d: '20 Aug' }, { s: 'registry', d: '24 Aug' }],
      docs: [{ n: 'Token receipt', have: true, d: '20 Aug' }, { n: 'Agreement to Sell', have: true, d: '21 Aug' }, { n: 'Payment proof', have: false }, { n: 'Final registry copy', have: false }],
      log: [{ d: '24 Aug', t: 'Stage changed to Registry / Closing', i: 'ph-fill ph-flag-banner', c: '#1a5aa8' }, { d: '22 Aug', t: 'Deal value changed ₹1.62 Cr → ₹1.60 Cr', i: 'ph-fill ph-pencil-simple', c: '#a3541b' }, { d: '21 Aug', t: 'Agreement to Sell signed', i: 'ph-fill ph-file-text', c: '#4a2c99' }, { d: '20 Aug', t: '₹5 L token recorded', i: 'ph-fill ph-coins', c: '#0a6634' }, { d: '6 Aug', t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: 'Balwinder Singh', phone: '+91 98146 22107' }
    },

    {
      id: 'D2', name: 'Simar · Aerocity 300', client: 'Simarjeet Kaur', clientId: 'C2', prop: 'Residential Plot · 300 sq yd', propSub: 'Aerocity, Mohali', area: 'Aerocity', propId: 'P5',
      value: 27000000, comm: 540000, token: 800000, stage: 'token', created: '12 Aug', createdDay: 12,
      cB: 1, cS: 1, registryDay: 0,
      next: { k: 'Collect token', note: 'Balance ₹4 L token promised on Tuesday', day: 25 },
      pay: [{ k: 'token', amt: 800000, d: '22 Aug', note: 'RTGS, first part' }],
      hist: [{ s: 'negotiating', d: '12 Aug' }, { s: 'token', d: '22 Aug' }],
      docs: [{ n: 'Token receipt', have: true, d: '22 Aug' }, { n: 'Agreement to Sell', have: false }, { n: 'Payment proof', have: true, d: '22 Aug' }],
      log: [{ d: '22 Aug', t: '₹8 L token recorded', i: 'ph-fill ph-coins', c: '#0a6634' }, { d: '22 Aug', t: 'Stage changed to Token / Booked', i: 'ph-fill ph-flag-banner', c: '#1a5aa8' }, { d: '12 Aug', t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: 'Karnail Singh Brar', phone: '+91 99885 31220' }
    },

    {
      id: 'D3', name: 'Dr Verma · Panchkula kothi', client: 'Dr. Neeraj Verma', clientId: 'C3', prop: 'Kothi · 300 sq yd', propSub: 'Sector 9, Panchkula', area: 'Panchkula', propId: 'P13',
      value: 31000000, comm: 620000, token: 0, stage: 'negotiating', created: '2 Aug', createdDay: 2,
      cB: 1, cS: 1, registryDay: 0,
      next: { k: 'Call buyer', note: 'He wanted a final number from the brothers', day: 24 },
      pay: [],
      hist: [{ s: 'negotiating', d: '2 Aug' }],
      docs: [{ n: 'Token receipt', have: false }, { n: 'Agreement to Sell', have: false }],
      log: [{ d: '19 Aug', t: 'Deal value changed ₹3.20 Cr → ₹3.10 Cr', i: 'ph-fill ph-pencil-simple', c: '#a3541b' }, { d: '14 Aug', t: 'Seller meeting recorded', i: 'ph-fill ph-users-three', c: '#4a2c99' }, { d: '2 Aug', t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: 'Verma family (direct)', phone: '+91 98720 55014' }
    },

    {
      id: 'D4', name: 'Vikram · Sector 88', client: 'Vikram Ahluwalia', clientId: 'C7', prop: 'Residential Plot · 200 sq yd', propSub: 'Sector 88, Mohali', area: 'Mohali', propId: 'P2',
      value: 12500000, comm: 218750, token: 200000, stage: 'token', created: '9 Aug', createdDay: 9,
      cB: 1, cS: 0.75, registryDay: 31,
      next: { k: 'Registry', note: 'Fix the slot at the tehsil for 31 Aug', day: 27 },
      pay: [{ k: 'token', amt: 200000, d: '18 Aug', note: 'Cheque cleared' }, { k: 'commB', amt: 60000, d: '23 Aug', note: 'Part of buyer side' }],
      hist: [{ s: 'negotiating', d: '9 Aug' }, { s: 'token', d: '18 Aug' }],
      docs: [{ n: 'Token receipt', have: true, d: '18 Aug' }, { n: 'Agreement to Sell', have: true, d: '19 Aug' }, { n: 'Payment proof', have: false }],
      log: [{ d: '23 Aug', t: '₹60,000 commission received from buyer', i: 'ph-fill ph-hand-coins', c: '#0a6634' }, { d: '19 Aug', t: 'Agreement to Sell signed', i: 'ph-fill ph-file-text', c: '#4a2c99' }, { d: '18 Aug', t: '₹2 L token recorded', i: 'ph-fill ph-coins', c: '#0a6634' }, { d: '9 Aug', t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: 'GMADA allottee', phone: '+91 98159 74430' }
    },

    {
      id: 'D5', name: 'Jindal villa · Omaxe', client: 'Baldev Raj Jindal', clientId: 'C5', prop: 'Villa · 400 sq yd', propSub: 'Omaxe, New Chandigarh', area: 'New Chandigarh', propId: 'P10',
      value: 46500000, comm: 813750, token: 0, stage: 'negotiating', created: '16 Aug', createdDay: 16,
      cB: 0.75, cS: 1, registryDay: 0,
      next: { k: 'Meet buyer', note: 'Wants to walk the villa again with his wife', day: 25 },
      pay: [],
      hist: [{ s: 'negotiating', d: '16 Aug' }],
      docs: [{ n: 'Token receipt', have: false }],
      log: [{ d: '21 Aug', t: 'Deal value changed ₹4.80 Cr → ₹4.65 Cr', i: 'ph-fill ph-pencil-simple', c: '#a3541b' }, { d: '16 Aug', t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: 'Omaxe (builder)', phone: '+91 172 400 1200' }
    },

    {
      id: 'D7', name: 'Bansal · Eco City 500', client: 'Rajesh Bansal', clientId: 'C6', prop: 'Residential Plot · 500 sq yd', propSub: 'Eco City, New Chandigarh', area: 'New Chandigarh', propId: 'P9',
      value: 22800000, comm: 456000, token: 0, stage: 'negotiating', created: '20 Aug', createdDay: 20,
      cB: 1, cS: 1, registryDay: 0,
      next: { k: 'Call seller', note: 'Brother must also agree before we take a token', day: 28 },
      pay: [],
      hist: [{ s: 'negotiating', d: '20 Aug' }],
      docs: [{ n: 'Token receipt', have: false }],
      log: [{ d: '20 Aug', t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: 'Jaswant Rai', phone: '+91 94170 88231' }
    },

    {
      id: 'D8', name: 'Mehta · Zirakpur floor', client: 'Anil Mehta', clientId: 'C4', prop: 'Builder Floor · 1450 sq ft', propSub: 'VIP Road, Zirakpur', area: 'Zirakpur', propId: 'P11',
      value: 7600000, comm: 152000, token: 0, stage: 'negotiating', created: '21 Aug', createdDay: 21,
      cB: 1, cS: 1, registryDay: 0,
      next: { k: 'Site visit', note: 'Family visit on Saturday morning', day: 26 },
      pay: [],
      hist: [{ s: 'negotiating', d: '21 Aug' }],
      docs: [{ n: 'Token receipt', have: false }],
      log: [{ d: '21 Aug', t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: 'Motia Group', phone: '+91 98723 11900' }
    },

    {
      id: 'D6', name: 'Sunita · Aerocity flat', client: 'Sunita Rani', clientId: 'C8', prop: '3 BHK Flat · 1650 sq ft', propSub: 'Aerocity, Mohali', area: 'Aerocity', propId: 'P6',
      value: 10200000, comm: 204000, token: 1000000, stage: 'closed', created: '2 Jul', createdDay: 2, closedOn: '18 Aug', closedDay: 18,
      cB: 1, cS: 1, registryDay: 18,
      next: { k: 'Commission follow-up', note: 'Seller side ₹1.02 L still to come', day: 23 },
      pay: [{ k: 'token', amt: 1000000, d: '20 Jul', note: '' }, { k: 'commB', amt: 102000, d: '18 Aug', note: 'Buyer side settled at registry' }],
      hist: [{ s: 'negotiating', d: '2 Jul' }, { s: 'token', d: '20 Jul' }, { s: 'registry', d: '10 Aug' }, { s: 'closed', d: '18 Aug' }],
      docs: [{ n: 'Token receipt', have: true, d: '20 Jul' }, { n: 'Agreement to Sell', have: true, d: '22 Jul' }, { n: 'Payment proof', have: true, d: '18 Aug' }, { n: 'Final registry copy', have: true, d: '18 Aug' }, { n: 'Commission receipt', have: false }],
      log: [{ d: '18 Aug', t: 'Deal completed — registry done', i: 'ph-fill ph-seal-check', c: '#0a6634' }, { d: '18 Aug', t: '₹1.02 L commission received from buyer', i: 'ph-fill ph-hand-coins', c: '#0a6634' }, { d: '20 Jul', t: '₹10 L token recorded', i: 'ph-fill ph-coins', c: '#0a6634' }, { d: '2 Jul', t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: 'Resale · owner', phone: '+91 98550 09912' }
    },

    {
      id: 'D10', name: 'Kirandeep · Sector 70 flat', client: 'Kirandeep Sandhu', clientId: 'C9', prop: '3 BHK Flat · 1450 sq ft', propSub: 'Sector 70, Mohali', area: 'Mohali', propId: 'P12',
      value: 9800000, comm: 196000, token: 500000, stage: 'closed', created: '20 Jun', createdDay: 20, closedOn: '12 Aug', closedDay: 12,
      cB: 1, cS: 1, registryDay: 12,
      next: null,
      pay: [{ k: 'token', amt: 500000, d: '2 Jul', note: '' }, { k: 'commB', amt: 98000, d: '12 Aug', note: '' }, { k: 'commS', amt: 98000, d: '14 Aug', note: 'Seller paid two days later' }],
      hist: [{ s: 'negotiating', d: '20 Jun' }, { s: 'token', d: '2 Jul' }, { s: 'registry', d: '5 Aug' }, { s: 'closed', d: '12 Aug' }],
      docs: [{ n: 'Token receipt', have: true, d: '2 Jul' }, { n: 'Agreement to Sell', have: true, d: '6 Jul' }, { n: 'Payment proof', have: true, d: '12 Aug' }, { n: 'Final registry copy', have: true, d: '12 Aug' }, { n: 'Commission receipt', have: true, d: '14 Aug' }],
      log: [{ d: '14 Aug', t: '₹98,000 commission received from seller — fully settled', i: 'ph-fill ph-hand-coins', c: '#0a6634' }, { d: '12 Aug', t: 'Deal completed — registry done', i: 'ph-fill ph-seal-check', c: '#0a6634' }, { d: '20 Jun', t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: 'Gurmeet Kaur', phone: '+91 98722 40118' }
    },

    {
      id: 'D9', name: 'Sethi · Sector 22 kothi', client: 'Manpreet Sethi', clientId: 'C10', prop: 'Kothi · 500 sq yd', propSub: 'Sector 22, Chandigarh', area: 'Chandigarh', propId: '', outside: true,
      value: 41000000, comm: 0, token: 0, stage: 'lost', created: '14 Jul', createdDay: 14, lostOn: '12 Aug', lostDay: 12, lostReason: 'Price not agreed', lastStage: 'negotiating',
      cB: 1, cS: 1, registryDay: 0, next: null, pay: [],
      hist: [{ s: 'negotiating', d: '14 Jul' }, { s: 'lost', d: '12 Aug' }],
      docs: [],
      log: [{ d: '12 Aug', t: 'Deal marked lost — price not agreed', i: 'ph-fill ph-x-circle', c: '#b02a37' }, { d: '3 Aug', t: 'Owner refused below ₹4.30 Cr', i: 'ph-fill ph-chat-text', c: '#a3541b' }, { d: '14 Jul', t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: 'Owner (direct)', phone: '—' }
    },
  ];
  ;
  /* Clients are canonical — Mark Sold resolves the buyer server-side and
     appends to that client's purchase history, so a fixture id would not
     exist. Filled in place by deskStore.loadClients(). */
  clients = deskStore.clients;
  newClients = ['C5', 'C7', 'C11'];
  CLIX = {
    C1: { types: ['Residential Plot'], areas: ['Sector 79, Mohali', 'Sector 88, Mohali'], bFrom: 1.5, bTo: 1.8, sizeFrom: '250', sizeTo: '300', prefs: ['East facing', 'Ready for registry', 'Corner'], stage: 'Negotiating', business: 'Gill Transport Co.', notes: [{ t: '2 days ago', x: 'Brother is coming next Saturday to see Sector 79.' }, { t: 'Last week', x: 'Only wants ready-for-registry. No GPA.' }] },
    C2: { types: ['Residential Plot'], areas: ['Aerocity, Mohali', 'New Chandigarh'], bFrom: 2.5, bTo: 3, sizeFrom: '300', prefs: ['Park facing', 'Wide road'], stage: 'Site visits', business: '', notes: [{ t: 'Yesterday', x: 'Comparing Aerocity against New Chandigarh. Call after 6 PM.' }] },
    C3: { types: ['Kothi'], areas: ['Sector 9, Panchkula'], bFrom: 3, bTo: 3.5, prefs: ['Corner'], stage: 'Negotiating', business: 'Verma Dental Care', notes: [{ t: '3 days ago', x: 'Decision this month, wife decides the final one.' }] },
    C4: { types: ['Flat', 'Builder Floor'], areas: ['Zirakpur'], bFrom: 0.7, bTo: 0.9, prefs: ['Ready to move'], stage: 'Just looking', business: '', notes: [] },
    C5: { types: ['Villa'], areas: ['New Chandigarh'], bFrom: 4.5, bTo: 5, prefs: ['Gated society', 'Park facing'], stage: 'Actively searching', business: 'Jindal Steels', notes: [{ t: 'Today', x: 'Wants gated only. Doesn\u2019t want Aerocity.' }] },
    C6: { types: ['Residential Plot'], areas: ['Eco City, New Chandigarh'], bFrom: 2, bTo: 2.5, prefs: ['Clear title'], stage: 'Actively searching', business: 'Bansal Investments', notes: [] },
    C7: { types: ['Residential Plot'], areas: ['Sector 88, Mohali'], bFrom: 1.2, bTo: 1.4, prefs: ['Corner'], stage: 'Negotiating', business: '', notes: [{ t: 'Yesterday', x: 'Token discussed \u2014 ready if seller drops 3 lakh.' }] },
    C8: { types: ['Flat'], areas: ['Aerocity, Mohali'], bFrom: 1, bTo: 1.05, prefs: [], stage: 'Bought', business: '', notes: [] },
    C9: { types: [], areas: [], prefs: [], stage: 'Just looking', business: '', notes: [] },
    C10: { types: ['Kothi'], areas: ['Sector 22, Chandigarh'], bFrom: 4, prefs: [], stage: 'Just looking', business: 'Sethi Textiles', notes: [] },
    C11: { types: ['Residential Plot'], areas: ['Aerotropolis'], bFrom: 1.5, bTo: 2, prefs: ['GMADA approved'], stage: 'Actively searching', business: '', notes: [{ t: 'Today', x: 'NRI \u2014 only free on WhatsApp video, evenings IST.' }] },
    C12: { types: ['Residential Plot'], areas: ['Derabassi'], bFrom: 0.4, bTo: 0.55, prefs: [], stage: 'Just looking', business: '', notes: [] }
  };
  PREFOPTS = ['Corner', 'Park facing', 'East facing', 'North facing', 'Wide road', 'Ready for registry', 'Gated society', 'Ready to move', 'Main road', 'Near school'];
  STAGEOPTS = ['Just looking', 'Actively searching', 'Site visits', 'Negotiating'];
  initContacts() {
    if (this._cx) return; this._cx = true;
    for (const c of this.clients) {
      const x = this.CLIX[c.id] || {};
      c.phone2 = c.phone2 || ''; c.business = x.business || ''; c.types = (x.types || []).slice(); c.areas = x.areas || [];
      c.bFrom = x.bFrom || null; c.bTo = x.bTo || null; c.sizeFrom = x.sizeFrom || ''; c.sizeTo = x.sizeTo || '';
      c.prefs = x.prefs || []; c.stage = x.stage || 'Just looking'; c.notes = (x.notes || []).slice(); c.archived = false;
    }
    for (const sl of this.sellers) { if (sl.business === undefined) sl.business = ''; if (sl.archived === undefined) sl.archived = false; }
  }
  wantOf(t) {
    const g = this.groupOf(t); if (g === 'plot') return 'Plot'; if (g === 'comm') return 'Commercial';
    const s = String(t || '').toLowerCase(); if (s.includes('kothi')) return 'Kothi'; if (s.includes('villa')) return 'Villa'; return 'Flat';
  }
  typesFor(c) {
    if ((c.types || []).length) return c.types;
    const w = c.want || 'Plot'; const m = { Plot: 'Residential Plot', Flat: 'Flat', Kothi: 'Kothi', Villa: 'Villa', Commercial: 'Commercial SCO' };
    return [m[w] || 'Residential Plot'];
  }
  /* How much the dealer actually knows. Drives Needs Attention, and is
     computed from what was genuinely recorded — a client with only a name
     and a number reads as needing details, which is the truth. */
  knownDepth(c) {
    let n = 0;
    if ((c.types || []).length) n++;
    if ((c.areas || []).length) n++;
    if (c.bFrom || c.bTo || c.budgetMax) n++;
    if ((c.prefs || []).length) n++;
    if ((c.notes || []).length) n++;
    if (c.sizeFrom || c.sizeTo) n++;
    return n;
  }
  contactState(c) {
    const bought = this.properties.some(pr => pr.sale && pr.sale.buyerId === c.id) || this.deals.some(d => d.client === c.name && d.stage === 'closed');
    if (bought) return 'bought';
    if (this.knownDepth(c) < 2) return 'attention';
    const act = this.clientLinks.filter(l => l.clientId === c.id).reduce((a, l) => a.concat(l.events || []), []);
    if (act.length && Math.min(...act.map(e => e.m)) <= 2880) return 'active';
    if (this.newClients.includes(c.id)) return 'new';
    return 'quiet';
  }
  CSTATE = { active: { l: 'Active', c: '#0a7a42', b: '#cdf0dd', card: '#f1fbf6', ring: '#b3e2c8', i: 'ph-fill ph-pulse' }, attention: { l: 'Needs details', c: '#c0490c', b: '#ffdcbd', card: '#fff5ec', ring: '#f5c9a0', i: 'ph-fill ph-note-pencil' }, bought: { l: 'Bought', c: '#9a6a00', b: '#ffe5a0', card: '#fff8e3', ring: '#f0d493', i: 'ph-fill ph-seal-check' }, new: { l: 'New', c: '#1a5aa8', b: '#d7e8ff', card: '#f3f8ff', ring: '#c0d7f4', i: 'ph-fill ph-sparkle' }, quiet: { l: 'Quiet', c: '#0f5f7a', b: '#d9eef7', card: '#eef8fc', ring: '#a9d8e8', i: 'ph-fill ph-moon' } };
  relT(m) {
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; if (m < 120) return '1 hour ago';
    if (m < 1440) return Math.floor(m / 60) + ' hours ago'; if (m < 2880) return 'yesterday'; if (m < 10080) return Math.floor(m / 1440) + ' days ago';
    return Math.floor(m / 10080) + (m < 20160 ? ' week ago' : ' weeks ago');
  }
  EVMETA = {
    open: { l: 'Opened the link', i: 'ph-fill ph-envelope-open', c: '#5b32c4', b: '#efe8fb' },
    view: { l: 'Viewed', i: 'ph-fill ph-eye', c: '#a3541b', b: '#fff0d6' },
    earth: { l: 'Opened the location map', i: 'ph-fill ph-globe-hemisphere-east', c: '#0f6f8a', b: '#dcf0f7' },
    audio: { l: 'Played your voice note', i: 'ph-fill ph-waveform', c: '#0a6634', b: '#d3f2e0' },
    photos: { l: 'Went through the photos', i: 'ph-fill ph-images', c: '#a8600c', b: '#ffeec4' },
    wa: { l: 'Tapped WhatsApp', i: 'ph-fill ph-whatsapp-logo', c: '#0a6634', b: '#d3f2e0' },
    call: { l: 'Tapped call', i: 'ph-fill ph-phone-call', c: '#146c3a', b: '#d9f0e2' },
    visit: { l: 'Asked for a site visit', i: 'ph-fill ph-footprints', c: '#b02a37', b: '#ffdfe2' }
  };
  initLinks() {
    for (const l of this.clientLinks) {
      const ev = (l.events || []).slice().sort((a, b) => a.m - b.m);
      l.events = ev; const cl = l.clientId ? this.clients.find(c => c.id === l.clientId) : null; if (cl) l.client = cl.name;
      const ops = ev.filter(e => e.k === 'open');
      l.opens = ops.length; l.lastOpenM = ops.length ? ops[0].m : null; l.lastOpen = ops.length ? this.relT(ops[0].m) : 'not opened yet';
      l.played = ev.some(e => e.k === 'audio'); l.called = ev.some(e => e.k === 'call'); l.wa = ev.some(e => e.k === 'wa'); l.visit = ev.some(e => e.k === 'visit');
      l.lastActM = ev.length ? ev[0].m : null; l.props = l.props || [];
    }
  }
  propAct(l, pid) {
    const ev = (l.events || []).filter(e => e.p === pid);
    const views = ev.filter(e => e.k === 'view'); return {
      views: views.length, lastM: views.length ? views[0].m : null,
      earth: ev.some(e => e.k === 'earth'), photos: ev.some(e => e.k === 'photos'), visit: ev.some(e => e.k === 'visit')
    };
  }
  followReasons(l) {
    const out = []; const ev = l.events || [];
    const v = ev.find(e => e.k === 'visit'); if (v) out.push({ t: 'Asked for a site visit', w: this.relT(v.m), i: 'ph-fill ph-footprints', c: '#b02a37', b: '#ffdfe2', big: true });
    const wa = ev.find(e => e.k === 'wa'); if (wa) out.push({ t: 'Tapped WhatsApp', w: this.relT(wa.m), i: 'ph-fill ph-whatsapp-logo', c: '#0a6634', b: '#d3f2e0' });
    const ca = ev.find(e => e.k === 'call'); if (ca) out.push({ t: 'Tapped call', w: this.relT(ca.m), i: 'ph-fill ph-phone-call', c: '#146c3a', b: '#d9f0e2' });
    for (const pid of l.props) {
      const a = this.propAct(l, pid); const pr = this.properties.find(p => p.id === pid);
      if (pr && a.views >= 2 && a.lastM <= 1440) out.push({ t: 'Viewed ' + pr.loc.split(',')[0] + ' ' + a.views + ' times', w: this.relT(a.lastM), i: 'ph-fill ph-eye', c: '#a3541b', b: '#fff0d6' });
    }
    if (l.status === 'active' && !l.opens) out.push({ t: 'Link sent but never opened', w: 'Sent ' + l.created, i: 'ph-fill ph-envelope-simple', c: '#6b6156', b: '#efeae2' });
    return out;
  }
  /* Inventory is canonical. This is the store's own array by reference —
     deskStore.loadProperties() fills it in place from the repository
     boundary. No property fixture remains, so Supabase mode can only show
     the dealer's real inventory. */
  properties = deskStore.properties;
  today = { sessions: 3, areas: 9, topArea: 'New Chandigarh' };
  /* Specifications used to be SYNTHESISED here at mount — a whole spec
     sheet invented per property from SEEDDET + dimsFromSize, so the rich
     Overview a dealer saw was generated, never entered. Canonical specs
     now arrive with the property and a field the dealer never filled in
     stays empty. Nothing is seeded. */
  initPublished() { this._pub = true; }
  /* Sellers are canonical. This is the store's own array by reference —
     deskStore.loadSellers() fills it in place from the repository
     boundary. There is no seller fixture here, so Supabase mode can only
     ever show real dealer records. */
  sellers = deskStore.sellers;
  SELLERKINDS = ['Individual', 'Builder', 'Broker', 'Company'];
  DOCKINDS = ['Registry', 'Allotment Letter', 'Possession Letter', 'RERA / Approval', 'Other'];
  QUICKDOCS = [
    { k: 'Registry / Sale Deed', l: 'Registry', i: 'ph-fill ph-scroll' },
    { k: 'Jamabandi / Fard', l: 'Fard / Jamabandi', i: 'ph-fill ph-book-open-text' },
    { k: 'Allotment Letter', l: 'Allotment Letter', i: 'ph-fill ph-envelope-open' },
    { k: 'Authority NOC / Transfer Permission', l: 'Authority NOC', i: 'ph-fill ph-stamp' },
    { k: 'Possession Letter', l: 'Possession Letter', i: 'ph-fill ph-key' }];
  DOCTYPES = ['Registry / Sale Deed', 'Previous Registry / Title Chain', 'Encumbrance / Mortgage Release / Bank NOC', 'Jamabandi / Fard', 'Mutation', 'Allotment Letter', 'Lease Deed', 'Conveyance Deed', 'Authority NOC / Transfer Permission', 'Authority No-Dues Certificate (NDC)', 'Approved Layout Plan', 'CLU / Development Licence', 'Sanctioned Building Plan', 'Occupancy Certificate (OC)', 'Completion Certificate (CC)', 'RERA Certificate', 'Agreement to Sell / Builder Buyer Agreement', 'Property Tax Receipt / Property ID', 'Possession Letter', 'Power of Attorney (GPA / SPA)', 'Society NOC / Share Certificate / Maintenance NDC', 'Lease / Rent Agreement', 'Inheritance / Will / Legal-Heir / Release Documents', 'Tax / TDS / GST Closing Documents', 'Other Document'];
  /* PROPSELLER / SEEDDET / DEFHL were per-fixture demo data keyed by the
     retired P1..P17 ids: an invented seller relationship, an invented spec
     sheet and invented highlight chips. All three are canonical now —
     desk_property_sellers, Property.specs and Property.highlights. */
  PTYPES = [{ k: 'Residential Plot', i: 'ph-fill ph-map-pin-area', g: 'plot' }, { k: 'Flat', i: 'ph-fill ph-buildings', g: 'built' }, { k: 'Builder Floor', i: 'ph-fill ph-stack', g: 'built' }, { k: 'Kothi', i: 'ph-fill ph-house-line', g: 'built' }, { k: 'Villa', i: 'ph-fill ph-house', g: 'built' }, { k: 'Commercial SCO', i: 'ph-fill ph-storefront', g: 'comm' }, { k: 'Commercial Booth', i: 'ph-fill ph-shopping-bag-open', g: 'comm' }, { k: 'Office', i: 'ph-fill ph-briefcase', g: 'comm' }, { k: 'Showroom', i: 'ph-fill ph-shopping-cart', g: 'comm' }, { k: 'Industrial Plot', i: 'ph-fill ph-factory', g: 'plot' }];
  HIGHLIGHTS = ['Park Facing', 'Corner', 'Wide Road', 'Prime Location', 'Clear Title', 'GMADA Approved', 'RERA Approved', 'Gated', 'Near Market', 'Ready to Move'];
  RS = { ready: { l: 'Ready to show', c: '#0a6634', b: '#c9f0d9', bd: '#8fdcae', i: 'ph-fill ph-seal-check' }, attention: { l: 'Needs attention', c: '#a33417', b: '#ffdccb', bd: '#f3bb98', i: 'ph-fill ph-warning' }, draft: { l: 'Draft', c: '#6b5320', b: '#f6e6bd', bd: '#e2cd97', i: 'ph-fill ph-note-pencil' }, sold: { l: 'Sold', c: '#0a4a26', b: '#c9f0d9', bd: '#8fdcae', i: 'ph-fill ph-seal-check' } };
  buildPropertyOverview(pd) {
    if (!pd) return { headline: '', typeIcon: 'ph-fill ph-house-line', typeLabel: '', isNegotiable: true, isFixedPrice: false, highlightChips: [], hasHighlightChips: false, keySpecs: [], detailGroups: [], moreDetailsList: [], moreDetailsCount: 0, hasMoreDetails: false, hasCustomNotes: false, customNotes: '' };
    const K = this.kindOf(pd.type);
    const has = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== '—';
    const U = (v, u) => {
      if (!has(v)) return '';
      const s = String(v).trim();
      return /[a-z]/i.test(s) ? s : (s + ' ' + u);
    };
    const park = (v) => has(v) ? (String(v) === '0' ? 'None' : (String(v).toLowerCase().includes('car') || String(v).toLowerCase().includes('park') ? String(v) : v + ' car parking')) : '';
    const dims = (pd.frontage && pd.depth) ? (pd.frontage + ' × ' + pd.depth + ' ft') : '';

    // 1. PROPERTY SUMMARY (Level 1 Headline)
    let headlineParts = [];
    let typeIcon = 'ph-fill ph-house-line';
    let typeLabel = pd.type || 'Property';

    if (K === 'plot' || K === 'indplot') {
      typeIcon = K === 'indplot' ? 'ph-fill ph-warehouse' : 'ph-fill ph-compass';
      typeLabel = K === 'indplot' ? 'Industrial Plot' : 'Residential Plot';
      if (pd.landArea) headlineParts.push(pd.landArea + ' sq yd');
      else if (pd.size) headlineParts.push(pd.size);
      if (dims) headlineParts.push(dims);
      if (has(pd.facing)) headlineParts.push(pd.facing + ' facing');
      if (has(pd.road)) headlineParts.push(pd.road + ' ft road');
      if (pd.corner) headlineParts.push('Corner');
      else if (pd.twoSide) headlineParts.push('Two-side open');
      else if (pd.parkFacing) headlineParts.push('Park facing');
    } else if (K === 'flat' || K === 'bfloor') {
      typeIcon = K === 'bfloor' ? 'ph-fill ph-stack' : 'ph-fill ph-buildings';
      typeLabel = K === 'bfloor' ? 'Builder Floor' : 'Apartment / Flat';
      if (pd.config) headlineParts.push(pd.config);
      else if (has(pd.beds)) headlineParts.push(pd.beds + ' BHK');
      if (has(pd.builtup)) headlineParts.push(pd.builtup + ' sq ft');
      else if (has(pd.carpet)) headlineParts.push(pd.carpet + ' sq ft');
      else if (pd.size) headlineParts.push(pd.size);
      if (has(pd.beds)) headlineParts.push(pd.beds + ' Bed');
      if (has(pd.baths)) headlineParts.push(pd.baths + ' Bath');
      if (has(pd.floor)) headlineParts.push(pd.floor + (String(pd.floor).match(/\d/) && !String(pd.floor).includes('Floor') && !String(pd.floor).includes('Ground') ? 'th Floor' : ''));
      if (has(pd.parking) && pd.parking !== '0') headlineParts.push(park(pd.parking));
    } else if (K === 'kothi' || K === 'villa') {
      typeIcon = 'ph-fill ph-house';
      typeLabel = K === 'villa' ? 'Luxury Villa' : 'Independent Kothi';
      if (pd.landArea) headlineParts.push(pd.landArea + ' sq yd');
      else if (pd.size) headlineParts.push(pd.size);
      if (pd.config) headlineParts.push(pd.config);
      else if (has(pd.beds)) headlineParts.push(pd.beds + ' BHK');
      if (has(pd.floorCount)) headlineParts.push(pd.floorCount + (String(pd.floorCount).includes('Floor') ? '' : ' Floors'));
      if (has(pd.builtup)) headlineParts.push(pd.builtup + ' sq ft built-up');
      if (has(pd.facing)) headlineParts.push(pd.facing + ' facing');
    } else {
      typeIcon = 'ph-fill ph-storefront';
      typeLabel = K === 'sco' ? 'Commercial SCO' : (K === 'office' ? 'Commercial Office' : (K === 'showroom' ? 'Commercial Showroom' : 'Commercial Space'));
      if (pd.landArea) headlineParts.push(pd.landArea + ' sq yd');
      else if (has(pd.carpet)) headlineParts.push(pd.carpet + ' sq ft');
      else if (pd.size) headlineParts.push(pd.size);
      if (dims) headlineParts.push(dims);
      if (has(pd.floorCount) || has(pd.floor)) headlineParts.push((pd.floorCount || pd.floor) + ' Floors');
      if (has(pd.builtup)) headlineParts.push(pd.builtup + ' sq ft built-up');
      if (has(pd.road)) headlineParts.push(pd.road + ' ft road');
    }

    const headline = headlineParts.join(' · ') || (pd.type + ' · ' + (pd.size || ''));

    // Highlight Advantage Chips
    const highlightChips = [];
    const addChip = (label, icon, color, bg) => {
      highlightChips.push({
        label, icon: icon || 'ph-fill ph-seal-check',
        style: `display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;background:${bg};color:${color}`
      });
    };

    if (pd.corner) addChip('Corner plot', 'ph-fill ph-corners-out', '#a3541b', '#fff0d6');
    if (pd.twoSide) addChip('2-Side open', 'ph-fill ph-arrows-out', '#1a5aa8', '#e1ecfb');
    if (pd.parkFacing) addChip('Park facing', 'ph-fill ph-tree', '#0a6634', '#d7f0e2');
    if (pd.mainRoad) addChip('Main road', 'ph-fill ph-road-horizon', '#7a2fe0', '#ebe3fa');
    if (pd.nearGreen) addChip('Near green belt', 'ph-fill ph-plant', '#0a6634', '#d7f0e2');
    if (has(pd.possession) && String(pd.possession).toLowerCase().includes('ready')) addChip('Ready to move', 'ph-fill ph-key', '#0a6634', '#d7f0e2');
    if (pd.lift) addChip('Lift installed', 'ph-fill ph-arrows-vertical', '#1a5aa8', '#e1ecfb');
    if (pd.powerBackup) addChip('Power backup', 'ph-fill ph-lightning', '#9a6a00', '#fdf0d4');
    if (pd.security) addChip('Gated security', 'ph-fill ph-shield-check', '#4a2c99', '#ebe3fa');
    if (has(pd.tenure) && String(pd.tenure).toLowerCase().includes('freehold')) addChip('Freehold title', 'ph-fill ph-certificate', '#0a6634', '#d7f0e2');
    if (has(pd.approval) || has(pd.approvalNote)) addChip(pd.approval || pd.approvalNote, 'ph-fill ph-seal-check', '#0a6634', '#d7f0e2');
    if (has(pd.basementArea)) addChip('Basement built', 'ph-fill ph-arrow-down', '#a3541b', '#fff0d6');

    // 2. KEY SPECS (6–8 facts tailored by type)
    const keySpecs = [];
    const addSpec = (label, value, icon) => {
      if (has(value)) keySpecs.push({ label, value: String(value), icon: icon || 'ph-fill ph-check-circle' });
    };

    if (K === 'plot' || K === 'indplot') {
      addSpec('Plot Area', pd.landArea ? (pd.landArea + ' sq yd') : pd.size, 'ph-fill ph-ruler');
      addSpec('Dimensions', dims || '—', 'ph-fill ph-arrows-out-line-horizontal');
      addSpec('Facing', pd.facing, 'ph-fill ph-compass');
      addSpec('Road in Front', has(pd.road) ? (pd.road + ' ft') : '', 'ph-fill ph-road-horizon');
      if (K === 'indplot') {
        addSpec('Built Shed', U(pd.shedArea, 'sq ft'), 'ph-fill ph-warehouse');
        addSpec('Power Load', U(pd.powerLoad, 'KVA'), 'ph-fill ph-lightning');
      } else {
        addSpec('Open Sides', pd.openSides || (pd.twoSide ? '2 Sides' : (pd.corner ? 'Corner' : '')), 'ph-fill ph-arrows-out');
        addSpec('Second Road', has(pd.road2) ? (pd.road2 + ' ft') : (pd.corner ? 'Side road' : ''), 'ph-fill ph-road-horizon');
      }
      addSpec('Ownership', pd.tenure, 'ph-fill ph-certificate');
      addSpec('Approvals', pd.approval || pd.approvalNote, 'ph-fill ph-seal-check');
    } else if (K === 'flat' || K === 'bfloor') {
      addSpec('Configuration', pd.config || (has(pd.beds) ? pd.beds + ' BHK' : ''), 'ph-fill ph-house-line');
      addSpec('Built-up Area', has(pd.builtup) ? (pd.builtup + ' sq ft') : (has(pd.carpet) ? pd.carpet + ' sq ft' : pd.size), 'ph-fill ph-ruler');
      addSpec(K === 'bfloor' ? 'Which Floor' : 'Floor Level', pd.floor ? (pd.floor + (has(pd.totalFloors) ? ' of ' + pd.totalFloors : '')) : '', 'ph-fill ph-stack');
      addSpec('Washrooms', has(pd.baths) ? (pd.baths + ' Baths') : '', 'ph-fill ph-toilet');
      addSpec('Balconies', has(pd.balconies) ? (pd.balconies + ' Balconies') : '', 'ph-fill ph-wind');
      addSpec('Parking', park(pd.parking), 'ph-fill ph-car');
      addSpec('Furnishing', pd.furnishing, 'ph-fill ph-armchair');
      addSpec('Possession', pd.possession || (has(pd.age) ? pd.age + ' Old' : ''), 'ph-fill ph-key');
    } else if (K === 'kothi' || K === 'villa') {
      addSpec(K === 'villa' ? 'Land Area' : 'Plot Size', has(pd.landArea) ? (pd.landArea + ' sq yd') : pd.size, 'ph-fill ph-ruler');
      addSpec('Built-up Area', has(pd.builtup) ? (pd.builtup + ' sq ft') : (has(pd.carpet) ? pd.carpet + ' sq ft' : ''), 'ph-fill ph-buildings');
      addSpec('Bed & Bath', (has(pd.beds) ? pd.beds : '—') + ' Bed · ' + (has(pd.baths) ? pd.baths : '—') + ' Bath', 'ph-fill ph-door-open');
      addSpec('Total Floors', pd.floorCount ? (pd.floorCount + ' Floors') : '', 'ph-fill ph-stack');
      addSpec('Facing', pd.facing, 'ph-fill ph-compass');
      addSpec('Road Width', has(pd.road) ? (pd.road + ' ft') : '', 'ph-fill ph-road-horizon');
      addSpec('Parking', park(pd.parking), 'ph-fill ph-car');
      addSpec('Lawn / Basement', has(pd.lawnArea) ? ('Lawn ' + pd.lawnArea + ' sq yd') : (has(pd.basementArea) ? 'Basement ' + pd.basementArea + ' sq ft' : ''), 'ph-fill ph-tree');
    } else {
      addSpec(K === 'sco' ? 'Plot Area' : 'Total Area', has(pd.landArea) ? (pd.landArea + ' sq yd') : (has(pd.carpet) ? pd.carpet + ' sq ft' : pd.size), 'ph-fill ph-ruler');
      addSpec('Frontage & Dims', dims || (has(pd.frontage) ? pd.frontage + ' ft Front' : ''), 'ph-fill ph-arrows-out-line-horizontal');
      addSpec('Built-up Area', has(pd.builtup) ? (pd.builtup + ' sq ft') : '', 'ph-fill ph-buildings');
      addSpec('Floors', pd.floorCount || pd.floor, 'ph-fill ph-stack');
      addSpec('Road in Front', has(pd.road) ? (pd.road + ' ft') : '', 'ph-fill ph-road-horizon');
      addSpec('Basement', has(pd.basementArea) ? (pd.basementArea + ' sq ft') : (pd.basement ? 'Yes' : 'None'), 'ph-fill ph-arrow-down');
      addSpec('Parking & Access', park(pd.parking) || (pd.groundAccess ? 'Ground access' : ''), 'ph-fill ph-car');
      addSpec('Condition / Fitout', pd.fitout, 'ph-fill ph-hammer');
    }

    // 3. GROUPED PROPERTY DETAILS
    const detailGroups = [];
    const addGroup = (title, icon, c, b, r, items, flagList) => {
      const it = (items || []).filter(x => has(x.value)).map(x => ({ label: x.label, value: String(x.value) }));
      const ch = (flagList || []).filter(x => pd[x.k]).map(x => ({
        label: x.l,
        style: `display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:${b};color:${c};font-size:14px;font-weight:800`
      }));
      if (it.length || ch.length) {
        detailGroups.push({
          title, icon, items: it, chips: ch, hasItems: it.length > 0, hasChips: ch.length > 0,
          headColor: 'color:' + c,
          wrap: 'padding:18px 20px;border-radius:20px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px ' + r
        });
      }
    };

    // Position & Boundaries for Plots
    if (K === 'plot' || K === 'indplot') {
      addGroup('Position & Dimensions', 'ph-fill ph-compass', '#a3541b', '#fff0d6', '#ecdcc0',
        [{ label: 'Shape', value: pd.shape }, { label: 'Ground Level', value: pd.level }, { label: 'Frontage', value: has(pd.frontage) ? pd.frontage + ' ft' : '' }, { label: 'Depth', value: has(pd.depth) ? pd.depth + ' ft' : '' }],
        [{ k: 'corner', l: 'Corner plot' }, { k: 'twoSide', l: 'Two-side open' }, { k: 'parkFacing', l: 'Park facing' }, { k: 'mainRoad', l: 'Main road' }, { k: 'nearGreen', l: 'Near green belt' }, { k: 'cornerCut', l: 'Corner cut' }]);
    }

    // Building & Facilities / Fittings
    if (K === 'flat' || K === 'bfloor' || K === 'kothi' || K === 'villa') {
      addGroup('Building & Facilities', 'ph-fill ph-buildings', '#1a5aa8', '#e1ecfb', '#d7e6f6',
        [{ label: 'Flooring', value: pd.flooring }, { label: 'Maintenance', value: pd.maintenance }, { label: 'Roof Rights', value: pd.roofRights ? 'Yes' : '' }],
        [{ k: 'lift', l: 'Lift' }, { k: 'powerBackup', l: 'Power backup' }, { k: 'security', l: 'Gated security' }, { k: 'modularKitchen', l: 'Modular kitchen' }, { k: 'wardrobes', l: 'Fitted wardrobes' }, { k: 'ac', l: 'ACs installed' }, { k: 'piped', l: 'Piped gas' }, { k: 'solar', l: 'Solar' }, { k: 'borewell', l: 'Borewell' }]);
      
      addGroup('Layout & Rooms Inside', 'ph-fill ph-door-open', '#a3541b', '#fff0d6', '#ecdcc0', [],
        [{ k: 'living', l: 'Drawing / living' }, { k: 'dining', l: 'Dining room' }, { k: 'store', l: 'Store room' }, { k: 'puja', l: 'Pooja room' }, { k: 'study', l: 'Study room' }, { k: 'servant', l: 'Servant room' }, { k: 'servantBath', l: 'Servant washroom' }, { k: 'barsati', l: 'Barsati' }, { k: 'sepEntry', l: 'Separate entry' }, { k: 'terrace', l: 'Private terrace' }, { k: 'portico', l: 'Portico' }, { k: 'stilt', l: 'Stilt parking' }, { k: 'lawn', l: 'Lawn' }, { k: 'basement', l: 'Basement' }]);
    } else if (K === 'sco' || K === 'office' || K === 'showroom') {
      addGroup('Services & Facilities', 'ph-fill ph-plug', '#1a5aa8', '#e1ecfb', '#d7e6f6',
        [{ label: 'Washrooms', value: pd.washrooms }, { label: 'Ceiling Height', value: U(pd.ceiling, 'ft') }, { label: 'Cabins', value: pd.cabins }, { label: 'Workstations / Seats', value: pd.seats }],
        [{ k: 'lift', l: 'Lift' }, { k: 'powerBackup', l: 'Power backup' }, { k: 'pantry', l: 'Pantry' }, { k: 'centralAc', l: 'Central AC' }, { k: 'conference', l: 'Conference room' }, { k: 'reception', l: 'Reception' }, { k: 'serverRoom', l: 'Server room' }, { k: 'terrace', l: 'Terrace' }]);

      addGroup('Commercial Position & Access', 'ph-fill ph-compass', '#a3541b', '#fff0d6', '#ecdcc0',
        [{ label: 'Shutter Width', value: U(pd.shutter, 'ft') }, { label: 'Second Road', value: has(pd.road2) ? pd.road2 + ' ft' : '' }],
        [{ k: 'corner', l: 'Corner' }, { k: 'twoSide', l: 'Two-side open' }, { k: 'mainRoad', l: 'On the main road' }, { k: 'groundAccess', l: 'Direct ground access' }, { k: 'parkingAccess', l: 'Front parking' }, { k: 'basement', l: 'Basement' }, { k: 'mezzanine', l: 'Mezzanine' }]);
    } else if (K === 'indplot') {
      addGroup('Utilities & Infrastructure', 'ph-fill ph-plug', '#0a6634', '#d7f0e2', '#b3e2c8',
        [{ label: 'Industrial Phase', value: pd.phase }, { label: 'Yard Area', value: U(pd.yardArea, 'sq ft') }, { label: 'Current Use', value: pd.use }],
        [{ k: 'water', l: 'Water line' }, { k: 'sewer', l: 'Sewer line' }, { k: 'effluent', l: 'Effluent line' }, { k: 'gas', l: 'Gas pipeline' }, { k: 'crane', l: 'Crane / gantry' }, { k: 'loadingBay', l: 'Loading bay' }, { k: 'built', l: 'Shed built' }, { k: 'officeBlock', l: 'Office block' }, { k: 'labourQtr', l: 'Labour quarters' }]);
    }

    // Floor-wise Configuration
    if (pd.floorPlan) {
      const floorItems = String(pd.floorPlan).split('·').map(s => s.trim()).filter(Boolean).map(s => {
        const p = s.split('—');
        return p.length > 1 ? { label: p[0].trim(), value: p.slice(1).join('—').trim() } : { label: s, value: '' };
      });
      if (floorItems.length) {
        addGroup(K === 'kothi' || K === 'villa' ? 'Floor by Floor Layout' : 'Floor-wise Configuration', 'ph-fill ph-list-numbers', '#0a6634', '#d7f0e2', '#b3e2c8', floorItems, []);
      }
    }

    // Project & Locality (if any project / society / block)
    if (pd.society || pd.block || pd.address) {
      addGroup('Project & Locality', 'ph-fill ph-buildings', '#4a2c99', '#ebe3fa', '#d5c5f2',
        [{ label: 'Project / Society', value: pd.society }, { label: 'Block / Pocket', value: pd.block }, { label: 'Address', value: pd.address }, { label: 'Locality', value: pd.loc }, { label: 'City', value: pd.city }], []);
    }

    // 4. LEVEL 4: EXPANDABLE MORE DETAILS
    const moreDetailsList = [];
    const addMore = (label, value) => {
      if (has(value)) moreDetailsList.push({ label, value: String(value) });
    };

    addMore('Plot / Unit Number', pd.plotNo);
    addMore('Carpet Area', has(pd.carpet) ? pd.carpet + ' sq ft' : '');
    addMore('Super Built-up Area', has(pd.builtup) ? pd.builtup + ' sq ft' : '');
    addMore('Front Side Dimension', has(pd.dimFront) ? pd.dimFront + ' ft' : '');
    addMore('Back Side Dimension', has(pd.dimBack) ? pd.dimBack + ' ft' : '');
    addMore('Left Side Dimension', has(pd.dimLeft) ? pd.dimLeft + ' ft' : '');
    addMore('Right Side Dimension', has(pd.dimRight) ? pd.dimRight + ' ft' : '');
    addMore('Plot Shape', pd.shape);
    addMore('Plot Level', pd.level);
    addMore('Ceiling Height', has(pd.ceiling) ? pd.ceiling + ' ft' : '');
    addMore('Maintenance Cost', pd.maintenance);
    addMore('Construction Age', pd.age);
    addMore('Possession Status', pd.possession);
    addMore('Registry Status', pd.registry);
    addMore('Authority Approval', pd.approval || pd.approvalNote);
    addMore('Ownership Tenure', pd.tenure);
    addMore('Current Use', pd.currentUse);
    addMore('Suitable For', pd.use);

    return {
      headline,
      typeIcon,
      typeLabel,
      isNegotiable: pd.negotiable !== false,
      isFixedPrice: pd.negotiable === false,
      highlightChips,
      hasHighlightChips: highlightChips.length > 0,
      keySpecs,
      detailGroups,
      moreDetailsList,
      moreDetailsCount: moreDetailsList.length,
      hasMoreDetails: moreDetailsList.length > 0 || has(pd.notes) || (pd.highlights && pd.highlights.length > 0),
      hasCustomNotes: has(pd.notes) || has(pd.customHl),
      customNotes: [pd.customHl, pd.notes].filter(has).join(' · ')
    };
  }
  kindOf(t) {
    const s = (t || '').toLowerCase();
    if (s.includes('industrial')) return 'indplot';
    if (s.includes('plot')) return 'plot';
    if (s.includes('booth')) return 'booth';
    if (s.includes('sco')) return 'sco';
    if (s.includes('office')) return 'office';
    if (s.includes('showroom')) return 'showroom';
    if (s.includes('flat') || s.includes('apartment')) return 'flat';
    if (s.includes('builder')) return 'bfloor';
    if (s.includes('kothi')) return 'kothi';
    if (s.includes('villa')) return 'villa';
    return 'flat';
  }
  FACING = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
  dimsFromSize(size) {
    const m = String(size || '').match(/([\d,.]+)\s*(sq\s*yd|sq\s*ft|marla|kanal)/i); if (!m) return null;
    const v = parseFloat(m[1].replace(/,/g, '')); if (!v) return null;
    const u = m[2].toLowerCase().replace(/\s+/g, ' ');
    const sqft = u === 'sq ft' ? v : u === 'marla' ? v * 272.25 : u === 'kanal' ? v * 5445 : v * 9;
    let best = null;
    [24, 30, 33, 35, 40, 45, 50, 55, 60, 66, 75, 80, 100].forEach(f => {
      const d = sqft / f;
      if (d < f * 0.7 || d > f * 2.6) return; const err = Math.abs(d - Math.round(d));
      if (!best || err < best.err - 0.001) best = { f, d: Math.round(d), err };
    });
    if (!best) { const f = Math.round(Math.sqrt(sqft / 1.3)); best = { f, d: Math.round(sqft / f) }; }
    return { f: String(best.f), d: String(best.d), yd: Math.round(sqft / 9) };
  }
  DETAILKEYS = 'frontage depth road2 openSides access parkFacing mainRoad cornerCut nearGreen block shape level dimFront dimBack dimLeft dimRight approvalNote powerLoad water sewer effluent gas crane loadingBay officeBlock labourQtr yardArea shedArea phase use config kitchens builtup carpet landArea floorCount lawn lawnArea basement basementArea terrace barsati portico stilt sepEntry roofRights living dining store puja study servant servantBath lift powerBackup borewell solar security modularKitchen wardrobes ac piped flooring maintenance washrooms washroom pantry mezzanine shutter ceiling cabins seats conference reception serverRoom centralAc groundAccess parkingAccess twoSide fitout currentUse floorPlan'.split(' ');
  KINDMETA = {
    plot: { i: 'ph-fill ph-map-pin-area', h: 'A buyer asks about size, facing, road width and whether it is a corner. No rooms needed.' },
    indplot: { i: 'ph-fill ph-factory', h: 'Industrial buyers ask about frontage, road access, power load and water. Rooms do not matter.' },
    flat: { i: 'ph-fill ph-buildings', h: 'Pick the configuration and the rest fills in. Floor, lift and parking are what buyers ask first.' },
    bfloor: { i: 'ph-fill ph-stack', h: 'Independent floor — which floor, separate entry, parking and how many floors in the building.' },
    kothi: { i: 'ph-fill ph-house-line', h: 'A whole house — plot size, built-up area, floors and total rooms across the house.' },
    villa: { i: 'ph-fill ph-house', h: 'Land area, built-up area, floors and the private lawn/parking. Society amenities go in Highlights.' },
    sco: { i: 'ph-fill ph-storefront', h: 'Frontage, floors, basement and washrooms decide the price on an SCO. No bedrooms.' },
    booth: { i: 'ph-fill ph-shopping-bag-open', h: 'Keep it short — area, frontage, where it sits and what it is used for.' },
    office: { i: 'ph-fill ph-briefcase', h: 'Cabins, seating, conference and pantry are what an office buyer asks about.' },
    showroom: { i: 'ph-fill ph-storefront', h: 'Frontage, ceiling height and ground-floor visibility matter far more than rooms.' }
  };
  typeFields(pf, pill) {
    const K = this.kindOf(pf.type), meta = this.KINDMETA[K] || this.KINDMETA.flat;
    const set = (o) => this.setP(o);
    const WRAP = 'display:flex;flex-wrap:wrap;gap:8px';
    const chips = (label, key, opts, fmt, wide) => {
      const short = opts.every(v => String(v).length <= 4);
      return {
        label, isChips: true, isText: false, wrap: wide ? 'grid-column:1 / -1' : '',
        optsWrap: short ? ('display:grid;grid-template-columns:repeat(' + opts.length + ',minmax(0,1fr));gap:8px') : WRAP,
        opts: opts.map(v => ({
          label: fmt ? fmt(v) : String(v), go: () => set({ [key]: v }),
          style: pill(String(pf[key]) === String(v)) + (short ? ';justify-content:center;padding:0 8px' : '')
        }))
      };
    };
    const flags = (label, list) => ({
      label, isChips: true, isText: false, wrap: 'grid-column:1 / -1', optsWrap: WRAP,
      opts: list.map(f => ({ label: f.l, go: () => set({ [f.k]: !pf[f.k] }), style: pill(!!pf[f.k]) }))
    });
    const text = (label, key, ph, wide) => ({
      label, isChips: false, isText: true, wrap: wide ? 'grid-column:1 / -1' : '',
      val: pf[key] || '', ph, on: (e) => set({ [key]: e.target.value })
    });
    const FURN = ['Unfurnished', 'Semi-furnished', 'Furnished'];
    const AGE = ['New', '1–5 years', '5–10 years', '10+ years'];
    const FLOORS = ['Ground', 'First', 'Second', 'Third', 'Basement'];
    const N5 = ['1', '2', '3', '4', '5+'], N6 = ['1', '2', '3', '4', '5', '6+'], N4 = ['0', '1', '2', '3+'];
    const YARD = (a, b) => { const f = parseFloat(a), d = parseFloat(b); if (!f || !d) return ''; return Math.round(f * d / 9).toLocaleString('en-IN') + ' sq yd  (' + Math.round(f * d).toLocaleString('en-IN') + ' sq ft)'; };
    const dims = (fk, dk, l1, l2) => [text(l1 || 'Frontage (ft)', fk, '30'), text(l2 || 'Depth (ft)', dk, '75')];
    const ROOMS = [{ k: 'living', l: 'Drawing / living' }, { k: 'dining', l: 'Dining' }, { k: 'store', l: 'Store room' }, { k: 'puja', l: 'Pooja room' }, { k: 'study', l: 'Study' }, { k: 'servant', l: 'Servant room' }, { k: 'servantBath', l: 'Servant washroom' }];
    const SERV = [{ k: 'lift', l: 'Lift' }, { k: 'powerBackup', l: 'Power backup' }, { k: 'borewell', l: 'Borewell' }, { k: 'solar', l: 'Solar' }, { k: 'security', l: 'Gated security' }];
    let main = [], more = [];

    if (K === 'plot') {
      main = [...dims('frontage', 'depth'),
      chips('Facing', 'facing', this.FACING, null, true),
      text('Road width in front (ft)', 'road', '30'),
      chips('Open sides', 'openSides', ['One side', 'Two side', 'Three side', 'Four side'], null, true),
      flags('Position advantages', [{ k: 'corner', l: 'Corner plot' }, { k: 'parkFacing', l: 'Park facing' }, { k: 'mainRoad', l: 'On the main road' }, { k: 'cornerCut', l: 'Corner cut' }, { k: 'nearGreen', l: 'Green belt behind' }]),
      text('Plot number', 'plotNo', '1247'),
      text('Block / pocket', 'block', 'B')];
      more = [text('Second-side road width (ft)', 'road2', '24'),
      text('Front dimension (ft)', 'dimFront', '30'), text('Back dimension (ft)', 'dimBack', '30'),
      text('Left dimension (ft)', 'dimLeft', '75'), text('Right dimension (ft)', 'dimRight', '72'),
      chips('Plot shape', 'shape', ['Regular', 'Irregular', 'Corner cut', 'L-shape'], null, true),
      chips('Ownership', 'tenure', ['Freehold', 'Leasehold', 'Power of attorney'], null, true),
      text('Approving authority', 'approvalNote', 'GMADA approved'),
      chips('Ground level', 'level', ['Level with road', 'Above road', 'Below road'], null, true),
      flags('Show to customers', [{ k: 'showPlotNo', l: 'Show plot number to customers' }])];
    }
    else if (K === 'indplot') {
      main = [...dims('frontage', 'depth'),
      text('Road width in front (ft)', 'road', '80'),
      chips('Access', 'access', ['Single access', 'Two-side access', 'Corner'], null, true),
      text('Shed / built-up area (sq ft)', 'shedArea', '8000'),
      text('Power load', 'powerLoad', '75 KVA'),
      flags('Utilities on site', [{ k: 'water', l: 'Water connection' }, { k: 'sewer', l: 'Sewer connection' }, { k: 'effluent', l: 'Effluent line' }, { k: 'gas', l: 'Gas line' }, { k: 'built', l: 'Shed / factory built' }]),
      text('Plot number', 'plotNo', 'B-114'),
      text('Industrial area / phase', 'phase', 'Phase 8B, Mohali')];
      more = [text('Shed height (ft)', 'ceiling', '28'),
      flags('Handling and structure', [{ k: 'crane', l: 'Crane / gantry' }, { k: 'loadingBay', l: 'Loading bay' }, { k: 'officeBlock', l: 'Office block' }, { k: 'labourQtr', l: 'Labour quarters' }]),
      text('Covered parking / yard (sq ft)', 'yardArea', '3000'),
      chips('Ownership', 'tenure', ['Freehold', 'Leasehold'], null, true),
      text('Approving authority', 'approvalNote', 'PSIEC allotted'),
      text('Current use', 'use', 'Warehouse')];
    }
    else if (K === 'flat') {
      main = [chips('Configuration', 'config', ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK'], null, true),
      chips('Bedrooms', 'beds', N6), chips('Washrooms', 'baths', N6),
      chips('Balconies', 'balconies', N4, (v) => v === '0' ? 'None' : v),
      chips('Kitchens', 'kitchens', ['1', '2'], null, false),
      text('Floor this flat is on', 'floor', '2nd'),
      text('Total floors in building', 'totalFloors', '4'),
      chips('Covered parking', 'parking', N4, (v) => v === '0' ? 'None' : v + ' car'),
      chips('Furnishing', 'furnishing', FURN, null, true),
      text('Built-up area (sq ft)', 'builtup', '1450'),
      text('Carpet area (sq ft)', 'carpet', '1180'),
      flags('Rooms it also has', ROOMS),
      flags('Building services', SERV)];
      more = [chips('Age of building', 'age', AGE, null, true),
      chips('Possession', 'possession', ['Ready to move', 'Within 3 months', 'Within 6 months', 'Under construction'], null, true),
      chips('Facing', 'facing', this.FACING, null, true),
      chips('Flooring', 'flooring', ['Vitrified', 'Marble', 'Wooden', 'Tiles', 'Granite'], null, true),
      text('Monthly maintenance', 'maintenance', '₹2,400'),
      text('Flat / unit number', 'plotNo', 'B-402'),
      flags('Extras', [{ k: 'modularKitchen', l: 'Modular kitchen' }, { k: 'wardrobes', l: 'Fitted wardrobes' }, { k: 'ac', l: 'ACs installed' }, { k: 'piped', l: 'Piped gas' }, { k: 'terraceRights', l: 'Terrace rights' }])];
    }
    else if (K === 'bfloor') {
      main = [chips('Configuration', 'config', ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK'], null, true),
      chips('Bedrooms', 'beds', N6), chips('Washrooms', 'baths', N6),
      chips('Which floor', 'floor', FLOORS, null, true),
      text('Total floors in the building', 'totalFloors', '3'),
      chips('Balconies', 'balconies', N4, (v) => v === '0' ? 'None' : v),
      chips('Kitchens', 'kitchens', ['1', '2'], null, false),
      chips('Covered parking', 'parking', N4, (v) => v === '0' ? 'None' : v + ' car'),
      text('Plot size the floor sits on (sq yd)', 'landArea', '250'),
      text('Built-up area (sq ft)', 'builtup', '1650'),
      chips('Furnishing', 'furnishing', FURN, null, true),
      flags('Rooms it also has', ROOMS),
      flags('This floor has', [{ k: 'sepEntry', l: 'Separate entry' }, { k: 'terrace', l: 'Terrace with it' }, { k: 'roofRights', l: 'Roof rights' }, { k: 'stilt', l: 'Stilt parking' }, ...SERV])];
      more = [chips('Age', 'age', AGE, null, true),
      chips('Facing', 'facing', this.FACING, null, true),
      text('Road width in front (ft)', 'road', '40'),
      text('Carpet area (sq ft)', 'carpet', '1380'),
      chips('Flooring', 'flooring', ['Vitrified', 'Marble', 'Wooden', 'Tiles', 'Granite'], null, true),
      text('House number', 'plotNo', '1247')];
    }
    else if (K === 'kothi' || K === 'villa') {
      main = [...dims('frontage', 'depth', 'Plot frontage (ft)', 'Plot depth (ft)'),
      text(K === 'villa' ? 'Land area (sq yd)' : 'Plot area (sq yd)', 'landArea', '500'),
      text('Total built-up area (sq ft)', 'builtup', '4200'),
      chips('Floors built', 'floorCount', ['1', '2', '3', '4'], null, false),
      chips('Total bedrooms', 'beds', N6), chips('Total washrooms', 'baths', N6),
      chips('Kitchens', 'kitchens', ['1', '2', '3'], null, false),
      chips('Covered parking', 'parking', N4, (v) => v === '0' ? 'None' : v + ' car'),
      chips('Furnishing', 'furnishing', FURN, null, true),
      flags('Rooms it also has', ROOMS),
      flags('The house also has', [{ k: 'lawn', l: K === 'villa' ? 'Private lawn' : 'Lawn / garden' }, { k: 'basement', l: 'Basement' }, { k: 'terrace', l: 'Terrace' }, { k: 'barsati', l: 'Barsati / top room' }, { k: 'portico', l: 'Portico' }, { k: 'stilt', l: 'Stilt parking' }, ...SERV])];
      more = [text('Basement area (sq ft)', 'basementArea', '900'),
      text('Lawn area (sq yd)', 'lawnArea', '80'),
      chips('Age', 'age', AGE, null, true),
      chips('Facing', 'facing', this.FACING, null, true),
      text('Road width in front (ft)', 'road', '40'),
      text('Carpet area (sq ft)', 'carpet', '3600'),
      chips('Ownership', 'tenure', ['Freehold', 'Leasehold', 'Power of attorney'], null, true),
      text('Floor-wise rooms (optional)', 'floorPlan', 'Ground — 2 bed, 2 bath, kitchen, drawing · First — 3 bed, 3 bath, kitchen', true)];
    }
    else if (K === 'sco') {
      main = [...dims('frontage', 'depth'),
      chips('Floors built', 'floorCount', ['1', '2', '3', '4', '5'], null, false),
      text('Total built-up area (sq ft)', 'builtup', '5400'),
      text('Plot area (sq yd)', 'landArea', '160'),
      text('Road width in front (ft)', 'road', '80'),
      chips('Washrooms', 'washrooms', N6),
      chips('Covered parking', 'parking', N4, (v) => v === '0' ? 'None' : v + ' car'),
      chips('Condition', 'fitout', ['Bare shell', 'Semi-finished', 'Fully finished'], null, true),
      flags('Position and services', [{ k: 'basement', l: 'Basement' }, { k: 'corner', l: 'Corner' }, { k: 'twoSide', l: 'Two-side open' }, { k: 'mainRoad', l: 'On the main road' }, { k: 'pantry', l: 'Pantry' }, { k: 'lift', l: 'Lift' }, { k: 'powerBackup', l: 'Power backup' }, { k: 'terrace', l: 'Terrace usable' }])];
      more = [text('Basement area (sq ft)', 'basementArea', '1200'),
      text('Ceiling height (ft)', 'ceiling', '12'),
      chips('Suitable for', 'use', ['Shop', 'Office', 'Showroom', 'Restaurant', 'Clinic', 'Bank', 'Hotel'], null, true),
      chips('Ownership', 'tenure', ['Freehold', 'Leasehold'], null, true),
      text('Currently rented to', 'currentUse', 'Ground floor rented at ₹85,000'),
      text('Floor-wise use (optional)', 'floorPlan', 'Ground — showroom · First — office · Second — vacant', true)];
    }
    else if (K === 'booth') {
      main = [text('Unit area (sq ft)', 'carpet', '120'),
      ...dims('frontage', 'depth', 'Shutter frontage (ft)', 'Depth (ft)'),
      chips('Where it sits', 'floor', ['Ground', 'First', 'Basement'], null, true),
      chips('Suitable for', 'use', ['Shop', 'Office', 'Restaurant', 'Clinic', 'Bank'], null, true),
      chips('Condition', 'fitout', ['Bare shell', 'Semi-finished', 'Fully finished'], null, true),
      flags('It also has', [{ k: 'washroom', l: 'Washroom' }, { k: 'pantry', l: 'Pantry' }, { k: 'mezzanine', l: 'Mezzanine' }, { k: 'corner', l: 'Corner' }, { k: 'mainRoad', l: 'On the main road' }, { k: 'parkingAccess', l: 'Parking in front' }, { k: 'powerBackup', l: 'Power backup' }])];
      more = [text('Road width in front (ft)', 'road', '40'),
      text('Ceiling height (ft)', 'ceiling', '11'),
      text('Booth number', 'plotNo', 'SCF-24'),
      text('Current use', 'currentUse', 'Running tea stall'),
      chips('Ownership', 'tenure', ['Freehold', 'Leasehold'], null, true)];
    }
    else if (K === 'office') {
      main = [text('Carpet area (sq ft)', 'carpet', '2400'),
      text('Built-up area (sq ft)', 'builtup', '3100'),
      chips('Which floor', 'floor', FLOORS, null, true),
      text('Total floors in building', 'totalFloors', '8'),
      chips('Cabins', 'cabins', N6), text('Open seating (seats)', 'seats', '36'),
      chips('Washrooms', 'washrooms', N5),
      chips('Covered parking', 'parking', N4, (v) => v === '0' ? 'None' : v + ' car'),
      chips('Condition', 'fitout', ['Bare shell', 'Semi-finished', 'Ready to move'], null, true),
      flags('It also has', [{ k: 'conference', l: 'Conference room' }, { k: 'reception', l: 'Reception' }, { k: 'pantry', l: 'Pantry' }, { k: 'serverRoom', l: 'Server room' }, { k: 'lift', l: 'Lift' }, { k: 'powerBackup', l: 'Power backup' }, { k: 'centralAc', l: 'Central AC' }])];
      more = [chips('Furnishing', 'furnishing', FURN, null, true),
      text('Ceiling height (ft)', 'ceiling', '10'),
      text('Monthly maintenance', 'maintenance', '₹18,000'),
      text('Currently occupied by', 'currentUse', 'Vacant since Feb'),
      chips('Facing', 'facing', this.FACING, null, true)];
    }
    else {
      main = [text('Area (sq ft)', 'carpet', '1800'),
      ...dims('frontage', 'depth', 'Frontage (ft)', 'Depth (ft)'),
      text('Ceiling height (ft)', 'ceiling', '14'),
      chips('Which floor', 'floor', ['Ground', 'First', 'Basement', 'Ground + First'], null, true),
      text('Road width in front (ft)', 'road', '80'),
      chips('Washrooms', 'washrooms', N5),
      chips('Covered parking', 'parking', N4, (v) => v === '0' ? 'None' : v + ' car'),
      chips('Condition', 'fitout', ['Bare shell', 'Semi-finished', 'Fully finished'], null, true),
      flags('Position and services', [{ k: 'groundAccess', l: 'Direct ground access' }, { k: 'corner', l: 'Corner visibility' }, { k: 'mainRoad', l: 'On the main road' }, { k: 'mezzanine', l: 'Mezzanine' }, { k: 'pantry', l: 'Pantry' }, { k: 'powerBackup', l: 'Power backup' }, { k: 'centralAc', l: 'Central AC' }])];
      more = [text('Basement area (sq ft)', 'basementArea', '800'),
      text('Shutter / glass frontage (ft)', 'shutter', '22'),
      chips('Suitable for', 'use', ['Shop', 'Showroom', 'Restaurant', 'Clinic', 'Bank', 'Gym'], null, true),
      text('Current use', 'currentUse', 'Running furniture showroom'),
      chips('Ownership', 'tenure', ['Freehold', 'Leasehold'], null, true)];
    }
    const dimNote = YARD(pf.frontage, pf.depth);
    return {
      pKindIcon: meta.i, pKindHint: dimNote ? ('That works out to ' + dimNote + '.') : meta.h,
      pFields: main.concat(more), pMoreFields: [], pMoreOpen: false, pMoreLabel: '', pMoreIcon: '', pMoreGo: () => { },
      pMoreStyle: 'display:flex;align-items:center;gap:9px;height:50px;padding:0 18px;border-radius:14px;margin-top:16px;background:#e1ecfb;color:#1a5aa8;font-size:16px;font-weight:800'
    };
  }
  groupOf(t) {
    const m = this.PTYPES.find(x => x.k === t); if (m) return m.g; const s = (t || '').toLowerCase();
    if (s.includes('plot')) return 'plot'; if (s.includes('commercial') || s.includes('sco') || s.includes('booth') || s.includes('office') || s.includes('showroom')) return 'comm'; return 'built';
  }
  readinessOf(pr) {
    const miss = [];
    if (!pr.photoCount) miss.push({ k: 'photos', label: 'No photos yet', fix: 'Add photos', icon: 'ph-fill ph-camera', step: 2 });
    if (!pr.earth) miss.push({ k: 'earth', label: 'Exact location not confirmed on MAPCO Earth', fix: 'Set location', icon: 'ph-fill ph-crosshair', step: 3 });
    if (!this.PROPMAP[pr.id]) miss.push({ k: 'sector', label: 'Sector map not linked', fix: 'Link map', icon: 'ph-fill ph-map-trifold', step: 3 });
    if (!pr.price) miss.push({ k: 'price', label: 'Price not set', fix: 'Add price', icon: 'ph-fill ph-tag', step: 1 });
    if (!pr.size || pr.size === '—') miss.push({ k: 'size', label: 'Size missing', fix: 'Add details', icon: 'ph-fill ph-ruler', step: 1 });
    const state = pr.status === 'sold' ? 'sold' : (pr.draft ? 'draft' : 'ready');
    return { miss, state };
  }
  sellerOf(pr) { return pr && pr.ps ? this.sellers.find(x => x.id === pr.ps.sellerId) || null : null; }
  MKT = {
    P1: { created: 8, approved: 6, published: 5, scheduled: 1, reels: 2, perf: { reach: 18400, impr: 26100, eng: 1240, clicks: 312 }, assets: [{ kind: 'Reel', date: '12 Aug', plat: 'Instagram · Facebook', status: 'Published', img: '/assets/mkt-prop-1.jpg' }, { kind: 'Post', date: '9 Aug', plat: 'Instagram', status: 'Published', img: '/assets/mkt-prop-2.jpg' }, { kind: 'Post', date: '14 Aug', plat: 'Facebook', status: 'Scheduled', img: '/assets/mkt-prop-3.webp' }] },
    P5: { created: 5, approved: 4, published: 3, scheduled: 0, reels: 1, perf: { reach: 11200, impr: 15800, eng: 730, clicks: 184 }, assets: [{ kind: 'Reel', date: '10 Aug', plat: 'Instagram', status: 'Published', img: '/assets/mkt-prop-4.jpg' }, { kind: 'Post', date: '6 Aug', plat: 'Instagram', status: 'Published', img: '/assets/mkt-prop-2.jpg' }] },
    P9: { created: 3, approved: 3, published: 1, scheduled: 2, reels: 1, perf: null, assets: [{ kind: 'Reel', date: '16 Aug', plat: 'Instagram', status: 'Scheduled', img: '/assets/mkt-prop-3.webp' }, { kind: 'Post', date: '11 Aug', plat: 'Facebook', status: 'Published', img: '/assets/mkt-prop-1.jpg' }] },
    P10: { created: 4, approved: 2, published: 0, scheduled: 0, reels: 1, perf: null, assets: [{ kind: 'Reel', date: '—', plat: 'Instagram', status: 'Ready', img: '/assets/mkt-prop-4.jpg' }, { kind: 'Post', date: '—', plat: 'Instagram', status: 'Ready', img: '/assets/mkt-prop-2.jpg' }] },
    P2: { created: 6, approved: 5, published: 4, scheduled: 1, reels: 2, perf: { reach: 9400, impr: 13100, eng: 512, clicks: 141 }, assets: [{ kind: 'Post', date: '8 Aug', plat: 'Instagram', status: 'Published', img: '/assets/mkt-prop-2.jpg' }, { kind: 'Reel', date: '13 Aug', plat: 'Instagram · Facebook', status: 'Published', img: '/assets/mkt-prop-1.jpg' }, { kind: 'Post', date: '18 Aug', plat: 'Facebook', status: 'Scheduled', img: '/assets/mkt-prop-3.webp' }] },
    P13: { created: 7, approved: 6, published: 4, scheduled: 2, reels: 3, perf: { reach: 24800, impr: 34600, eng: 1810, clicks: 427 }, assets: [{ kind: 'Reel', date: '15 Aug', plat: 'Instagram', status: 'Published', img: '/assets/mkt-prop-3.webp' }, { kind: 'Post', date: '12 Aug', plat: 'Facebook', status: 'Published', img: '/assets/mkt-prop-4.jpg' }, { kind: 'Reel', date: '20 Aug', plat: 'Instagram', status: 'Scheduled', img: '/assets/mkt-prop-1.jpg' }] },
    P12: { created: 9, approved: 9, published: 7, scheduled: 0, reels: 3, perf: { reach: 31200, impr: 44900, eng: 2260, clicks: 588 }, assets: [{ kind: 'Reel', date: '2 Aug', plat: 'Instagram · Facebook', status: 'Published', img: '/assets/mkt-prop-4.jpg' }, { kind: 'Post', date: '29 Jul', plat: 'Instagram', status: 'Published', img: '/assets/mkt-prop-1.jpg' }, { kind: 'Post', date: '5 Aug', plat: 'Facebook', status: 'Published', img: '/assets/mkt-prop-2.jpg' }] }
  };
  /**
   * MAPCO AI — open this property in Property Intelligence.
   * The Intelligence UI lives in MAPCO Earth (one implementation, one
   * presentation contract); the Desk navigates into it.
   */
  openPropertyIntelligence(id) {
    const pid = id || this.state.propDetail;
    if (!pid) return;
    window.location.assign(productRoutes.propertyIntelligence(pid));
  }

  openEdit(id, step) {
    const pr = this.properties.find(x => x.id === id); if (!pr) return;
    const n = Math.min(6, pr.photoCount || 0); const ps = pr.ps || {};
    this.setState({
      addPlotOpen: true, pstep: step || 1, pEditId: id, cardMenu: null, propDetail: null, pSaved: false, sellerAdd: false, sellerQ: '', docName: '', pform: {
        ...this.blankP(),
        city: pr.city, area: (pr.loc || '').split(',')[0], society: pr.society || '', address: pr.address || '', type: pr.type,
        size: String(pr.size || '').replace(/[^0-9.]/g, ''), unit: /sq ft/.test(pr.size || '') ? 'sq ft' : 'sq yd', carpet: pr.carpet || '',
        facing: pr.facing && pr.facing !== '—' ? pr.facing : 'East', road: pr.road || '', plotNo: pr.plotNo || '', showPlotNo: pr.showPlotNo !== false,
        corner: !!pr.corner, parkFacing: (pr.highlights || []).includes('Park Facing'), tenure: pr.tenure || 'Freehold',
        beds: String(pr.beds || 3), baths: String(pr.baths || 2), floor: pr.floor || '', totalFloors: pr.totalFloors || '', balconies: String(pr.balconies || 1),
        parking: String(pr.parking || 1), furnishing: pr.furnishing || 'Unfurnished', age: pr.age || 'New', possession: pr.possession || 'Ready to move',
        frontage: pr.frontage || '', use: pr.use || '', mainRoad: !!pr.mainRoad, avail: pr.status || 'available',
        pooja: !!pr.pooja, store: !!pr.store, servant: !!pr.servant, lift: !!pr.lift, powerBackup: !!pr.powerBackup,
        washrooms: pr.washrooms || '', shutters: pr.shutters || '', rate: pr.rate || '',
        price: pr.price ? String(pr.price / 1e7) : '',
        photos: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].slice(0, Math.max(n, pr.photoCount || 0)), cover: 0, video: !!pr.video,
        videos: (pr.videos || []).slice(), docs: (pr.docs || []).map(d => ({ ...d, id: d.id || ('DC' + Math.random().toString(36).slice(2, 8)), photos: d.photos || [0] })),
        highlights: (pr.highlights || []).slice(), customHl: '',
        registry: pr.registry || '', approval: pr.approval || '', notes: pr.notes || '',
        earth: !!pr.earth, earthQ: pr.loc || '', sector: this.PROPMAP[pr.id] || '',
        sellerId: ps.sellerId || '', askPrice: ps.askPrice ? String(ps.askPrice / 1e7) : '', relation: ps.relation || 'Owner',
        availConfirmed: ps.availConfirmed !== false, lastConfirmed: ps.lastConfirmed || 'Today',
        visitNote: ps.visitNote || '', sellerPropNote: ps.note || '', sellerDocs: (ps.docs || []).slice()
      }
    });
  }
  blankP() {
    return {
      city: '', area: '', society: '', address: '', type: 'Residential Plot', size: '', unit: 'sq yd', carpet: '', rate: '', pooja: false, store: false, servant: false, lift: false, powerBackup: false, cornerShop: false, shutters: '', washrooms: '', facing: 'East', road: '', plotNo: '', showPlotNo: true, corner: false, parkFacing: false, tenure: 'Freehold', beds: '3', baths: '2', floor: '', totalFloors: '', balconies: '1', parking: '1', furnishing: 'Unfurnished', age: 'New', possession: 'Ready to move', frontage: '', use: '', mainRoad: false, avail: 'available', price: '', photos: [], cover: 0, video: false, videos: [], docs: [], highlights: [], customHl: '', registry: '', approval: '', notes: '', earth: false, earthQ: '', sector: '',
      sellerId: '', askPrice: '', relation: 'Owner', availConfirmed: true, lastConfirmed: 'Today', visitNote: '', sellerPropNote: '', sellerDocs: []
    };
  }
  setP(patch) {
    this.setState({ pform: { ...this.state.pform, ...patch } });
  }
  onPForm(e) {
    const { name, value, type, checked } = e.target;
    this.setP({ [name]: type === 'checkbox' ? checked : value });
  }
  /* Add Seller from inside the Add Property flow. Writes the canonical
     seller, then selects it for this property. An existing seller with the
     same number is reused instead of creating a second copy. */
  async addSeller() {
    const f = this.state.nsform; if (!f.name.trim() || !f.phone.trim()) return;
    if (this.state.savingSeller) return;
    const existing = deskStore.findSellerByPhone(f.phone);
    if (existing) {
      this.setP({ sellerId: existing.id });
      this.setState({ sellerAdd: false, sellerQ: '', nsform: this.blankNS() });
      return;
    }
    this.setState({ savingSeller: true, sellerError: '' });
    const id = await deskStore.saveSeller({
      name: f.name, phone: f.phone, phone2: f.phone2,
      business: f.business, kind: f.kind, city: f.city, note: f.note,
    });
    if (!id) { this.setState({ savingSeller: false, sellerError: deskStore.lastWriteError }); return; }
    this.setP({ sellerId: id });
    this.setState({ savingSeller: false, sellerError: '', sellerAdd: false, sellerQ: '', nsform: this.blankNS() });
  }
  blankNS() { return { name: '', phone: '', phone2: '', business: '', kind: 'Individual', city: '', note: '' }; }
  toggleSellerDoc(d) {
    const cur = this.state.pform.sellerDocs || [];
    this.setP({ sellerDocs: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] });
  }
  addDoc(kind, name) {
    const cur = (this.state.pform.docs || []).slice();
    const existing = cur.find(d => d.kind === kind && !name);
    if (existing) { this.setState({ docOpen: existing.id, docPickOpen: false }); return; }
    const id = 'DC' + Date.now() + Math.floor(Math.random() * 99);
    cur.push({ id, kind, name: (name || '').trim() || kind, photos: [0], img: cur.length % 3 });
    this.setP({ docs: cur }); this.setState({ docOpen: id, docPickOpen: false, docNewName: '' });
  }
  removeDocById(id) {
    this.setP({ docs: (this.state.pform.docs || []).filter(d => d.id !== id) });
    if (this.state.docOpen === id) this.setState({ docOpen: null });
  }
  docAddPhoto(id) { const cur = (this.state.pform.docs || []).map(d => d.id === id ? { ...d, photos: [...(d.photos || []), (d.photos || []).length] } : d); this.setP({ docs: cur }); }
  docRemovePhoto(id, i) {
    const cur = (this.state.pform.docs || []).map(d => {
      if (d.id !== id) return d;
      const ph = (d.photos || []).slice(); ph.splice(i, 1); return { ...d, photos: ph };
    }); this.setP({ docs: cur });
  }
  addPhotoSlot() { const cur = (this.state.pform.photos || []); this.setP({ photos: [...cur, cur.length ? Math.max(...cur) + 1 : 0] }); }
  addVideoSlot() { const cur = (this.state.pform.videos || []); this.setP({ videos: [...cur, cur.length] }); }
  removeVideo(i) { const cur = (this.state.pform.videos || []).slice(); cur.splice(i, 1); this.setP({ videos: cur }); }
  findMatchingSectorMap(city, sectorOrArea) {
    if (!sectorOrArea) return null;
    const q = String(sectorOrArea).toLowerCase().replace(/[^a-z0-9]/g, '');
    const cNorm = String(city || '').toLowerCase();
    return CANONICAL_SECTOR_MAPS.find((m) => {
      if (cNorm && m.city && !m.city.toLowerCase().includes(cNorm) && !cNorm.includes(m.city.toLowerCase())) {
        return false;
      }
      const mSec = (m.sector || m.project || m.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const mName = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (mSec && (q.includes(mSec) || mSec.includes(q))) || (mName && (q.includes(mName) || mName.includes(q)));
    }) || null;
  }
  mapClick(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const zoom = this.state.mapZoom || 1;
    const offX = e.clientX - r.left;
    const offY = e.clientY - r.top;
    const midX = r.width / 2;
    const midY = r.height / 2;
    const relX = (offX - midX) / zoom + midX;
    const relY = (offY - midY) / zoom + midY;
    const x = Math.max(3, Math.min(97, +(relX / r.width * 100).toFixed(2)));
    const y = Math.max(4, Math.min(96, +(relY / r.height * 100).toFixed(2)));
    if (this.state.pinMode === 'sector') {
      const mapId = this.state.pform.sectorMapId;
      this.setP({
        pinX: x, pinY: y, sectorPinX: x, sectorPinY: y, pinSet: true,
        mapPlacement: mapId ? { mapId, x: +(x / 100).toFixed(4), y: +(y / 100).toFixed(4) } : undefined
      });
    } else {
      this.setP({ pinX: x, pinY: y, pinSet: true, earth: true });
    }
  }
  setNS(o) { this.setState({ nsform: { ...this.state.nsform, ...o } }); }
  onNS(e) { this.setNS({ [e.target.name]: e.target.value }); }
  setSold(o) { this.setState({ soldForm: { ...this.state.soldForm, ...o } }); }
  onSold(e) { this.setSold({ [e.target.name]: e.target.value }); }
  toggleHl(h) { const cur = this.state.pform.highlights || []; this.setP({ highlights: cur.includes(h) ? cur.filter(x => x !== h) : [...cur, h] }); }
  addCustomHl() {
    const v = (this.state.pform.customHl || '').trim(); if (!v) return; const cur = this.state.pform.highlights || [];
    if (!cur.includes(v)) this.setP({ highlights: [...cur, v], customHl: '' }); else this.setP({ customHl: '' });
  }
  togglePhoto(i) {
    const f = this.state.pform; const cur = f.photos || [];
    if (cur.includes(i)) { const next = cur.filter(x => x !== i); this.setP({ photos: next, cover: next.includes(f.cover) ? f.cover : (next[0] !== undefined ? next[0] : 0) }); }
    else this.setP({ photos: [...cur, i] });
  }
  movePhoto(i, dir) {
    const cur = (this.state.pform.photos || []).slice(); const at = cur.indexOf(i); const to = at + dir;
    if (at < 0 || to < 0 || to >= cur.length) return; cur.splice(at, 1); cur.splice(to, 0, i); this.setP({ photos: cur });
  }
  SHOWS = { 'New Chandigarh': 14, 'Mohali': 11, 'Aerocity': 9, 'Aerotropolis': 7, 'Zirakpur': 4, 'Panchkula': 3, 'Kharar': 2, 'Chandigarh': 2, 'Derabassi': 1 };
  EXPIRY = [{ k: '24h', l: '24 hours' }, { k: '3d', l: '3 days' }, { k: '7d', l: '7 days' }, { k: 'custom', l: 'Custom' }];
  LOCVIS = [{ k: 'area', l: 'Area only', d: 'City and sector, nothing more', i: 'ph-fill ph-shield-check' }, { k: 'approx', l: 'Approximate', d: 'A highlighted zone on the map', i: 'ph-fill ph-circle-dashed' }, { k: 'exact', l: 'Exact spot', d: 'Turn on only if you trust them', i: 'ph-fill ph-crosshair' }];
  PRICEVIS = [{ k: 'hidden', l: 'Hidden', d: 'They call you to ask', i: 'ph-fill ph-eye-slash' }, { k: 'range', l: 'Show a range', d: 'Rough band only', i: 'ph-fill ph-arrows-horizontal' }, { k: 'exact', l: 'Exact price', d: 'Full number visible', i: 'ph-fill ph-tag' }];
  SHOTCAP = ['Site view', 'Approach road', 'Surroundings', 'Front road', 'Wide angle', 'Evening view'];
  SECTORMAPS = { 'Mohali': ['Sector 79 sheet', 'Sector 88 sheet', 'Sector 66 sheet', 'Sector 82 sheet'], 'Aerocity': ['Aerocity master sheet', 'Aerocity Pocket B'], 'Aerotropolis': ['Aerotropolis master sheet'], 'New Chandigarh': ['Eco City sheet', 'Omaxe sheet', 'Altus zone sheet'], 'Zirakpur': ['VIP Road sheet', 'Dhakoli sheet'], 'Kharar': ['Sunny Enclave sheet'], 'Derabassi': ['Bhankharpur sheet'], 'Panchkula': ['Sector 9 sheet', 'Sector 20 sheet'], 'Chandigarh': ['Sector 22 sheet'] };
  PROPMAP = { P1: 'Sector 79 sheet', P2: 'Sector 88 sheet', P3: 'Sector 66 sheet', P5: 'Aerocity master sheet', P6: 'Aerocity Pocket B', P7: 'Aerotropolis master sheet', P9: 'Eco City sheet', P10: 'Omaxe sheet', P11: 'VIP Road sheet', P12: 'Dhakoli sheet', P13: 'Sector 9 sheet', P16: 'Bhankharpur sheet', P17: 'Sector 22 sheet' };
  DEALDATES = {
    D1: { start: 22, token: 3, due: 18 }, D2: { start: 28, token: 8, due: 24 }, D3: { start: 5 }, D4: { start: 1, token: 11 },
    D5: { start: 7 }, D6: { start: 2, token: 22, close: 6 }, D7: { start: 9 }, D8: { start: 12 }, D9: { start: 4 }
  };
  clientLinks = [
    {
      id: 'L1', clientId: 'c2', client: 'Priya Mehta', props: ['sec79', 'aero'], created: '24 Jul', expires: '27 Jul', status: 'active', audio: true, loc: 'area', price: 'hidden',
      events: [{ m: 12, k: 'view', p: 'sec79' }, { m: 13, k: 'earth', p: 'sec79' }, { m: 15, k: 'open' }, { m: 186, k: 'photos', p: 'sec79' }, { m: 190, k: 'view', p: 'sec79' }, { m: 193, k: 'audio' }, { m: 196, k: 'open' }, { m: 1380, k: 'visit', p: 'sec79' }, { m: 1392, k: 'view', p: 'sec79' }, { m: 1400, k: 'view', p: 'aero' }, { m: 1410, k: 'open' }, { m: 2760, k: 'view', p: 'sec79' }, { m: 2770, k: 'open' }]
    },
    {
      id: 'L2', clientId: 'c1', client: 'Rajiv Sharma', props: ['ecocity', 'block5'], created: '22 Jul', expires: '25 Jul', status: 'active', audio: true, loc: 'area', price: 'range',
      events: [{ m: 96, k: 'view', p: 'ecocity' }, { m: 99, k: 'wa' }, { m: 104, k: 'open' }, { m: 1520, k: 'view', p: 'ecocity' }, { m: 1530, k: 'open' }]
    },
    {
      id: 'L3', clientId: 'c3', client: 'Amandeep Singh', props: ['omx', 'sec66', 'panchkula20'], created: '18 Jul', expires: '21 Jul', status: 'expired', audio: false, loc: 'approx', price: 'hidden',
      events: [{ m: 8600, k: 'view', p: 'omx' }, { m: 8620, k: 'earth', p: 'omx' }, { m: 8640, k: 'call' }, { m: 8660, k: 'view', p: 'omx' }, { m: 8700, k: 'view', p: 'sec66' }, { m: 8760, k: 'open' }, { m: 10100, k: 'view', p: 'omx' }, { m: 10140, k: 'open' }]
    },
    {
      id: 'L4', clientId: 'c5', client: 'Suresh Gupta', props: ['sec66a'], created: '20 Jul', expires: '23 Jul', status: 'revoked', audio: true, loc: 'exact', price: 'exact',
      events: [{ m: 6100, k: 'audio' }, { m: 6120, k: 'view', p: 'sec66a' }, { m: 6140, k: 'open' }]
    },
    { id: 'L5', clientId: 'c4', client: 'Neha Kapoor', props: ['panchkula20', 'sec66a'], created: '2 Aug', expires: '9 Aug', status: 'active', audio: true, loc: 'area', price: 'hidden', events: [] },
    {
      id: 'L6', clientId: 'c6', client: 'Harpreet Kaur', props: ['omx'], created: '21 Aug', expires: '28 Aug', status: 'active', audio: false, loc: 'area', price: 'range',
      events: [{ m: 52, k: 'view', p: 'omx' }, { m: 58, k: 'photos', p: 'omx' }, { m: 60, k: 'open' }]
    },
  ];
  shares = [
    { id: 'S1', propId: 'ecocity', client: 'Simarjeet Kaur', created: '22 Jul', expires: '25 Jul', status: 'active', loc: 'area', price: 'hidden', audio: true, opened: '23 Jul, 9:12 pm', opens: 5, played: true, called: true, wa: false, visit: true },
    { id: 'S2', propId: 'ecocity', client: 'Karan Gupta', created: '18 Jul', expires: '21 Jul', status: 'expired', loc: 'approx', price: 'range', audio: true, opened: '19 Jul, 1:40 pm', opens: 3, played: false, called: false, wa: true, visit: false },
    { id: 'S3', propId: 'sec79', client: 'Harpreet Singh Gill', created: '24 Jul', expires: '27 Jul', status: 'active', loc: 'area', price: 'hidden', audio: false, opened: 'not opened yet', opens: 0, played: false, called: false, wa: false, visit: false },
    { id: 'S4', propId: 'omx', client: 'Baldev Raj Jindal', created: '20 Jul', expires: '23 Jul', status: 'revoked', loc: 'exact', price: 'exact', audio: true, opened: '21 Jul, 11:05 am', opens: 1, played: true, called: true, wa: true, visit: false },
  ];
  streakDays = 5;
  ACTIVITY = [
    { t: '12 min ago', who: 'Simarjeet Kaur', what: 'opened Aerocity · 300 sq yd on your map', icon: 'ph-fill ph-map-pin-area', c: '#a8792a', bg: '#fff3d1' },
    { t: '40 min ago', who: 'Karan Gupta', what: 'explored the Aerotropolis sector map', icon: 'ph-fill ph-map-trifold', c: '#6b3fd4', bg: '#efe8fb' },
    { t: '1 hour ago', who: 'Harpreet Singh Gill', what: 'asked for photos of Sector 79', icon: 'ph-fill ph-images', c: '#186c3c', bg: '#e2f2e6' },
    { t: '2 hours ago', who: 'Baldev Raj Jindal', what: 'spent 6 minutes on the Omaxe villas', icon: 'ph-fill ph-timer', c: '#c2185b', bg: '#ffe1e6' },
    { t: 'Yesterday', who: 'Vikram Ahluwalia', what: 'moved to token stage after the meeting', icon: 'ph-fill ph-seal-check', c: '#c2622a', bg: '#ffe6cf' },
  ];

  inr(v) { v = Math.round(v); if (v >= 1e7) return '₹' + (+(v / 1e7).toFixed(2)) + ' Cr'; if (v >= 1e5) return '₹' + (+(v / 1e5).toFixed(2)) + ' L'; return '₹' + v.toLocaleString('en-IN'); }
  stageMeta(k) { return this.STAGES.find(s => s.key === k) || this.STAGES[0]; }
  DS = {
    negotiating: { l: 'Negotiating', i: 'ph-fill ph-chats-circle', c: '#a8600c', b: '#ffe9a8', r: '#f0cf7a' },
    token: { l: 'Token / Booked', i: 'ph-fill ph-hand-coins', c: '#1a5aa8', b: '#dbeafe', r: '#a9c9f0' },
    registry: { l: 'Registry / Closing', i: 'ph-fill ph-stamp', c: '#5b32c4', b: '#e7defc', r: '#c9b6f2' },
    closed: { l: 'Completed', i: 'ph-fill ph-seal-check', c: '#0a6634', b: '#d3f2e0', r: '#a2ddbc' },
    lost: { l: 'Lost / Cancelled', i: 'ph-fill ph-x-circle', c: '#b02a37', b: '#ffdfe2', r: '#f3bcc2' },
    enquiry: { l: 'Negotiating', i: 'ph-fill ph-chats-circle', c: '#a8600c', b: '#ffe9a8', r: '#f0cf7a' }
  };
  DSORDER = ['negotiating', 'token', 'registry', 'closed'];
  ds(k) { return this.DS[k] || this.DS.negotiating; }
  NEXTKINDS = ['Call buyer', 'Call seller', 'Meet buyer', 'Meet seller', 'Site visit', 'Collect token', 'Collect document', 'Confirm price', 'Registry', 'Payment follow-up', 'Commission follow-up', 'Custom'];
  NEXTICON = { 'Call buyer': 'ph-fill ph-phone', 'Call seller': 'ph-fill ph-phone-outgoing', 'Meet buyer': 'ph-fill ph-users-three', 'Meet seller': 'ph-fill ph-handshake', 'Site visit': 'ph-fill ph-footprints', 'Collect token': 'ph-fill ph-hand-coins', 'Collect document': 'ph-fill ph-file-arrow-down', 'Confirm price': 'ph-fill ph-tag', 'Registry': 'ph-fill ph-stamp', 'Payment follow-up': 'ph-fill ph-currency-inr', 'Commission follow-up': 'ph-fill ph-coins', 'Custom': 'ph-fill ph-note-pencil' };
  REQDOCS = { negotiating: [], token: ['Token receipt'], registry: ['Token receipt', 'Agreement to Sell'], closed: ['Token receipt', 'Agreement to Sell', 'Final registry copy'] };
  dayLabel(n) {
    if (!n) return ''; if (n === this.TODAY) return 'Today'; if (n === this.TODAY + 1) return 'Tomorrow'; if (n === this.TODAY - 1) return 'Yesterday';
    return n < this.TODAY ? ((this.TODAY - n) + ' days ago') : (n + ' Aug');
  }
  dealMoney(d) {
    const pay = d.pay || [];
    const sum = (k) => pay.filter(p => p.k === k).reduce((a, p) => a + p.amt, 0);
    const token = sum('token');
    const side = (mode, pct, fix) => { if (mode === 'none') return 0; if (mode === 'fixed') return Math.round(fix || 0); return Math.round(d.value * (pct || 0) / 100); };
    const cB = side(d.cBMode || (d.cB ? 'pct' : 'none'), d.cB, d.cBFix), cS = side(d.cSMode || (d.cS ? 'pct' : 'none'), d.cS, d.cSFix);
    const expected = cB + cS, gotB = sum('commB'), gotS = sum('commS'), got = gotB + gotS;
    return {
      value: d.value, token, remaining: Math.max(0, d.value - token),
      cB, cS, expected, gotB, gotS, got, due: Math.max(0, expected - got),
      fully: expected > 0 && got >= expected, none: got === 0
    };
  }
  dealFlags(d) {
    if (d.stage === 'lost') return [];
    const out = [], M = this.dealMoney(d), T = this.TODAY;
    const nx = d.next;
    if (nx && nx.day < T) out.push({ t: 'Next action overdue — ' + nx.k.toLowerCase(), i: 'ph-fill ph-warning-circle', c: '#b02a37', b: '#ffdfe2', pri: 1 });
    else if (nx && nx.day === T) out.push({ t: 'Due today — ' + nx.k.toLowerCase(), i: 'ph-fill ph-bell-ringing', c: '#c0490c', b: '#ffe3cf', pri: 2 });
    if (d.registryDay && d.stage !== 'closed' && d.registryDay - T <= 5 && d.registryDay >= T)
      out.push({ t: 'Registry ' + (d.registryDay === T ? 'today' : d.registryDay === T + 1 ? 'tomorrow' : 'on ' + d.registryDay + ' Aug'), i: 'ph-fill ph-stamp', c: '#5b32c4', b: '#e7defc', pri: 1 });
    if (d.stage === 'token' && M.token === 0) out.push({ t: 'Token still to collect', i: 'ph-fill ph-hand-coins', c: '#a8600c', b: '#ffe9a8', pri: 2 });
    if (d.stage === 'closed' && M.due > 0) out.push({ t: this.inr(M.due) + ' commission still unpaid', i: 'ph-fill ph-coins', c: '#0a6634', b: '#d3f2e0', pri: 1 });
    const pr0 = d.propId ? this.properties.find(p => p.id === d.propId) : null;
    if (pr0 && pr0.ps && pr0.ps.availConfirmed === false) out.push({ t: 'Seller confirmation pending', i: 'ph-fill ph-user-focus', c: '#4a2c99', b: '#e7defc', pri: 3, wait: 1 });
    const dayOf = (str) => { const v = String(str || ''); if (/today/i.test(v)) return T; const m = v.match(/(\d+)/); return m ? parseInt(m[1]) : 0; };
    const lastTouch = (d.log && d.log.length) ? dayOf(d.log[0].d) : 0;
    const nextLive = nx && nx.day >= T;
    if (lastTouch && !nextLive && T - lastTouch >= 6 && d.stage !== 'closed')
      out.push({ t: 'No update for ' + (T - lastTouch) + ' days', i: 'ph-fill ph-hourglass', c: '#8a7f6e', b: '#f0ece4', pri: 4, wait: 1 });
    const req = this.REQDOCS[d.stage] || []; const have = (d.docs || []).filter(x => x.have).map(x => x.n);
    const miss = req.filter(r => !have.includes(r));
    if (miss.length) out.push({ t: miss.length === 1 ? (miss[0] + ' missing') : (miss.length + ' deal papers missing'), i: 'ph-fill ph-file-x', c: '#8a3ffc', b: '#ede4ff', pri: 3, wait: 1 });
    const lk = this.clientLinks.find(l => l.clientId === d.clientId && (l.props || []).includes(d.propId));
    if (lk) {
      const ev = (lk.events || []).filter(e => e.k === 'view' && e.p === d.propId && e.m <= 2880);
      if (ev.length >= 2) out.push({ t: 'Buyer opened this property ' + ev.length + ' times again', i: 'ph-fill ph-eye', c: '#1a5aa8', b: '#dbeafe', pri: 2 });
    }
    return out.sort((a, b) => a.pri - b.pri);
  }
  propBooked(pid) { return this.deals.find(d => d.propId === pid && (d.stage === 'token' || d.stage === 'registry')); }
  dealDocs(d) {
    const pr = d.propId ? this.properties.find(p => p.id === d.propId) : null;
    const prop = (pr && pr.docs ? pr.docs : []).map(x => ({ name: x.name || x.kind, kind: 'property', have: true }));
    const req = this.REQDOCS[d.stage] || [];
    const own = (d.docs || []).map(x => ({ name: x.n, kind: 'deal', have: !!x.have, when: x.d || '', required: req.includes(x.n) }));
    req.forEach(r => { if (!own.some(o => o.name === r)) own.push({ name: r, kind: 'deal', have: false, required: true }); });
    return { prop, own };
  }
  dealNext(id, patch) {
    const d = this.deals.find(x => x.id === id); if (!d) return;
    d.next = { ...(d.next || { k: 'Call buyer', note: '', day: this.TODAY }), ...patch }; this.forceUpdate();
  }
  confirmStage() {
    const f = this.state.stgFor; if (!f) return; const d = this.deals.find(x => x.id === f.id);
    const dr = this.state.stgDraft || {};
    if (f.to === 'closed') {
      this.setState({ stgFor: null, stgDraft: null });
      if (d && d.propId) this.openSold(d.propId); else this.completeDeal(f.id); return;
    }
    if (f.to === 'token') { const v = parseFloat(dr.amt); if (v > 0) this.dealPay(f.id, 'token', Math.round(v * 1e5), 'Token taken'); }
    if (f.to === 'registry' && d) { d.next = { k: 'Registry', day: parseInt(dr.date) || this.TODAY, note: 'Registry / closing' }; }
    this.dealStage(f.id, f.to); this.setState({ stgFor: null, stgDraft: null });
  }
  dealStage(id, st) {
    const d = this.deals.find(x => x.id === id); if (!d || d.stage === st) return;
    d.stage = st; (d.hist = d.hist || []).push({ s: st, d: this.TODAY + ' Aug' });
    (d.log = d.log || []).unshift({ d: 'Today', t: 'Stage changed to ' + this.ds(st).l, i: 'ph-fill ph-flag-banner', c: '#1a5aa8' });
    if (st === 'closed') {
      d.closedOn = this.TODAY + ' Aug'; d.closedDay = this.TODAY;
      const pr = d.propId ? this.properties.find(p => p.id === d.propId) : null; if (pr) { pr.status = 'sold'; pr.published = false; pr.dealId = d.id; }
    }
    this.forceUpdate();
  }
  dealPay(id, k, amt, note) {
    const d = this.deals.find(x => x.id === id); if (!d || !amt) return;
    (d.pay = d.pay || []).push({ k, amt: +amt, d: this.TODAY + ' Aug', note: note || '' });
    const L = { token: 'token recorded', buyerPay: 'buyer payment recorded', commB: 'commission received from buyer', commS: 'commission received from seller' };
    (d.log = d.log || []).unshift({ d: 'Today', t: this.inr(+amt) + ' ' + (L[k] || 'payment recorded'), i: k === 'token' ? 'ph-fill ph-coins' : 'ph-fill ph-hand-coins', c: '#0a6634' });
    this.forceUpdate();
  }
  dealDocToggle(id, name) {
    const d = this.deals.find(x => x.id === id); if (!d) return;
    d.docs = d.docs || []; const f = d.docs.find(x => x.n === name);
    if (f) { f.have = !f.have; f.d = f.have ? (this.TODAY + ' Aug') : ''; }
    else d.docs.push({ n: name, have: true, d: this.TODAY + ' Aug' });
    (d.log = d.log || []).unshift({ d: 'Today', t: name + ((f && !f.have) ? ' removed' : ' marked received'), i: 'ph-fill ph-file-text', c: '#4a2c99' });
    this.forceUpdate();
  }
  openUpdate(id) {
    const d = this.deals.find(x => x.id === id); if (!d) return;
    this.setState({
      upFor: id, upDraft: {
        stage: d.stage, price: (d.value / 1e7).toFixed(2),
        token: '', tokenDay: this.TODAY, regDay: d.registryDay || 0,
        nextK: (d.next && d.next.k) || 'Call buyer', nextDay: (d.next && d.next.day) || this.TODAY + 1, note: (d.next && d.next.note) || ''
      }
    });
  }
  setUp(o) { this.setState({ upDraft: { ...(this.state.upDraft || {}), ...o } }); }
  saveUpdate() {
    const s = this.state, u = s.upDraft || {}, d = this.deals.find(x => x.id === s.upFor); if (!d) return;
    const nv = Math.round((parseFloat(u.price) || 0) * 1e7);
    if (nv && nv !== d.value) { (d.log = d.log || []).unshift({ d: 'Today', t: 'Deal price changed ' + this.inr(d.value) + ' → ' + this.inr(nv), i: 'ph-fill ph-pencil-simple', c: '#a3541b' }); d.value = nv; }
    const tk = Math.round((parseFloat(u.token) || 0) * 1e5);
    if (tk > 0) {
      (d.pay = d.pay || []).push({ k: 'token', amt: tk, d: u.tokenDay + ' Aug', note: '' });
      (d.log = d.log || []).unshift({ d: 'Today', t: this.inr(tk) + ' token recorded', i: 'ph-fill ph-coins', c: '#0a6634' });
    }
    if (u.regDay && u.regDay !== d.registryDay) {
      d.registryDay = u.regDay;
      (d.log = d.log || []).unshift({ d: 'Today', t: 'Registry set for ' + u.regDay + ' Aug', i: 'ph-fill ph-stamp', c: '#5b32c4' });
    }
    const oldNext = d.next || {};
    if (oldNext.k !== u.nextK || oldNext.day !== u.nextDay || oldNext.note !== u.note) {
      d.next = { k: u.nextK, day: u.nextDay, note: u.note || '' };
      (d.log = d.log || []).unshift({ d: 'Today', t: 'Next action set — ' + u.nextK + ' ' + this.dayLabel(u.nextDay).toLowerCase(), i: this.NEXTICON[u.nextK] || 'ph-fill ph-note-pencil', c: '#a3541b' });
    }
    if (u.stage && u.stage !== d.stage) this.dealStage(d.id, u.stage);
    this.setState({ upFor: null, upDraft: null });
  }
  dealLost(id, reason) {
    const d = this.deals.find(x => x.id === id); if (!d) return;
    d.lastStage = d.stage; d.stage = 'lost'; d.lostReason = reason; d.lostOn = this.TODAY + ' Aug'; d.lostDay = this.TODAY;
    (d.log = d.log || []).unshift({ d: 'Today', t: 'Deal marked lost — ' + reason.toLowerCase(), i: 'ph-fill ph-x-circle', c: '#b02a37' });
    this.setState({ dealLostFor: null });
  }
  LOSTREASONS = ['Buyer backed out', 'Price not agreed', 'Seller withdrew', 'Property sold elsewhere', 'Finance issue', 'Documentation issue', 'Other'];
  tel(p) { return 'tel:' + (p || '').replace(/[^0-9+]/g, ''); }
  initialsOf(n) { return (n || '').split(' ').map(x => x[0]).slice(0, 2).join(''); }
  matchPlot(c) { const pool = this.properties.filter(p => p.ready && p.status === 'available' && p.want === c.want && p.price <= c.budgetMax * 1.15); pool.sort((a, b) => Math.abs(a.price - c.budgetMax) - Math.abs(b.price - c.budgetMax)); return pool[0] || null; }
  componentDidMount() {
    this.initPublished(); this.initContacts(); this.initLinks(); this.animateCount(); this.applyTheme();
    // Canonical data. Every Desk section is being moved onto the repository
    // boundary one at a time; sellers and inventory are live.
    deskStore.bind(() => this.forceUpdate());
    // Sellers first: the inventory load attaches each property's seller
    // relationship from that directory rather than querying per property.
    // Clients and sellers first: the inventory load resolves each sold
    // property's buyer name and each property's seller relationship from
    // those, instead of a query per property.
    Promise.all([deskStore.loadClients(), deskStore.loadSellers()])
      .then(() => deskStore.loadProperties());
  }
  moneyOn() { const s = this.state; return (s.section === 'properties' && s.invView === 'sold') || (s.section === 'deals' && s.dealView === 'done'); }
  sellerOn() { const s = this.state; return s.section === 'clients' && s.contactMode === 'sellers'; }
  applyTheme() {
    const on = this.moneyOn(), cel = !!this.state.celebrate, el = this._shell;
    const PLUM = 'radial-gradient(62% 50% at -2% -4%,rgba(139,96,232,.5),transparent 62%),radial-gradient(54% 44% at 101% 4%,rgba(56,138,186,.4),transparent 62%),radial-gradient(66% 48% at 46% 108%,rgba(255,190,48,.44),transparent 64%),radial-gradient(40% 34% at 86% 66%,rgba(236,120,168,.22),transparent 68%)';
    const MONEY = 'radial-gradient(66% 54% at 0% -8%,rgba(46,190,116,.5),transparent 64%),radial-gradient(58% 46% at 104% 2%,rgba(96,206,148,.42),transparent 66%),radial-gradient(72% 54% at 44% 112%,rgba(246,214,132,.34),transparent 66%)';
    const SELLERBG = 'radial-gradient(66% 54% at 0% -8%,rgba(139,96,232,.5),transparent 64%),radial-gradient(58% 46% at 104% 2%,rgba(178,146,246,.42),transparent 66%),radial-gradient(72% 54% at 44% 112%,rgba(120,86,206,.3),transparent 66%)';
    const sel = this.sellerOn();
    if (el) { el.style.transition = 'background-color .45s ease'; el.style.backgroundColor = on ? '#e9f8ef' : (sel ? '#f3edff' : '#f2eafb'); el.style.backgroundImage = on ? MONEY : (sel ? SELLERBG : PLUM); }
    const sd = this._aside;
    if (sd) {
      sd.style.transition = 'background-color .45s ease';
      sd.style.background = 'rgba(252,250,255,.82)';
      sd.style.backgroundImage = 'linear-gradient(180deg,rgba(253,251,255,.95),rgba(243,236,255,.76) 55%,rgba(236,227,255,.66))';
      sd.style.borderRight = '1px solid #ddd2f5';
      sd.style.boxShadow = 'inset -1px 0 0 rgba(88,52,168,.14)';
    }
    document.body.style.backgroundColor = cel ? '#effaf2' : (on ? '#e9f8ef' : (sel ? '#f3edff' : '#f2eafb'));
    document.body.style.backgroundImage = cel ? 'none' : (on ? MONEY : (sel ? SELLERBG : PLUM));
  }
  animateCount() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.setState({ p: 1 });
  }
  celebrateSold(id) {
    const pr = this.properties.find(x => x.id === id); if (!pr) return; pr.status = 'sold'; pr.published = false;
    this.setState({ propDetail: null, delPlot: false, cardMenu: null, celebrate: { kind: 'sold', title: pr.type + ' · ' + pr.size, sub: pr.loc, amount: this.inr(pr.price), comm: this.inr(Math.round(pr.price * 0.015)) } });
  }
  completeDeal(id) {
    const d = this.deals.find(x => x.id === id); if (!d) return; d.stage = 'closed';
    const pr = d.propId ? this.properties.find(x => x.id === d.propId) : null; if (pr) { pr.status = 'sold'; pr.published = false; }
    this.setState({ selectedDeal: null, dealEdit: false, delArm: false, celebrate: { kind: 'closed', title: d.name || d.prop, sub: d.client + ' · ' + d.propSub, amount: this.inr(d.value), comm: d.comm ? this.inr(d.comm) : '—' } });
  }
  closeCelebrate() { this.setState({ celebrate: null }); }
  componentDidUpdate() {
    this.applyTheme();
    this.syncEarthMap();
  }
  async syncEarthMap() {
    const el = document.getElementById('dealer-earth-map');
    if (!el) {
      if (this._gMap) {
        this._gMap = null;
        this._gMarker = null;
      }
      return;
    }
    if (el.dataset.mounted === 'true') return;
    el.dataset.mounted = 'true';

    try {
      await loadGoogleMaps();
      const mapsLib = await importMapsLibrary('maps');
      const markerLib = await importMapsLibrary('marker');
      const placesLib = await importMapsLibrary('places');

      const pf = this.state.pform || {};
      // Centre on the dealer's real saved pin when there is one, otherwise on
      // the Tri-City default. A raster sector pin is NOT a coordinate and is
      // never used to seed the satellite map.
      const defLat = Number.isFinite(Number(pf.lat)) && Number(pf.lat) !== 0 ? Number(pf.lat) : 30.7046;
      const defLng = Number.isFinite(Number(pf.lng)) && Number(pf.lng) !== 0 ? Number(pf.lng) : 76.7179;
      const center = { lat: defLat, lng: defLng };

      const MapClass = (mapsLib as any)?.Map || (window as any).google?.maps?.Map;
      const gMap = new MapClass(el, {
        center,
        zoom: 17,
        mapTypeId: 'hybrid',
        tilt: 0,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
        keyboardShortcuts: false,
        mapId: GOOGLE_MAPS_MAP_ID || undefined,
      });
      this._gMap = gMap;

      let marker = null;
      const AdvMarker = (markerLib as any)?.AdvancedMarkerElement || (window as any).google?.maps?.marker?.AdvancedMarkerElement;
      if (AdvMarker && GOOGLE_MAPS_MAP_ID) {
        const pinElement = document.createElement('div');
        pinElement.innerHTML = '<div style="display:grid;place-items:center;cursor:grab"><span style="width:52px;height:52px;border-radius:50%;background:rgba(232,104,28,.38);display:grid;place-items:center;animation:omGlow 2s ease-in-out infinite"><i class="ph-fill ph-map-pin" style="font-size:36px;color:#ff8a3c;filter:drop-shadow(0 4px 8px rgba(0,0,0,.7))"></i></span></div>';
        marker = new AdvMarker({
          map: gMap,
          position: center,
          gmpDraggable: true,
          content: pinElement.firstElementChild,
        });
        marker.addListener('dragend', () => {
          const pos = marker.position;
          if (pos) {
            const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
            const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
            this.state.pform.lat = lat;
            this.state.pform.lng = lng;
            this.state.pform.earth = true;
            this.state.pform.pinSet = true;
          }
        });
      } else {
        const MarkerClass = (window as any).google?.maps?.Marker;
        marker = new MarkerClass({
          map: gMap,
          position: center,
          draggable: true,
          title: 'Property Location',
        });
        marker.addListener('dragend', (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          this.state.pform.lat = lat;
          this.state.pform.lng = lng;
          this.state.pform.earth = true;
          this.state.pform.pinSet = true;
        });
      }
      this._gMarker = marker;

      gMap.addListener('click', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        if (marker) {
          if (marker.setPosition) marker.setPosition({ lat, lng });
          else marker.position = { lat, lng };
        }
        this.state.pform.lat = lat;
        this.state.pform.lng = lng;
        this.state.pform.earth = true;
        this.state.pform.pinSet = true;
      });

      const searchInput = document.getElementById('dealer-earth-search');
      if (searchInput && (window as any).google?.maps?.places?.Autocomplete) {
        const autocomplete = new (window as any).google.maps.places.Autocomplete(searchInput, {
          bounds: new (window as any).google.maps.LatLngBounds(
            new (window as any).google.maps.LatLng(30.55, 76.55),
            new (window as any).google.maps.LatLng(30.90, 76.95)
          ),
          componentRestrictions: { country: 'in' },
          fields: ['geometry', 'name', 'formatted_address']
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place && place.geometry && place.geometry.location) {
            const loc = place.geometry.location;
            const lat = loc.lat();
            const lng = loc.lng();
            gMap.setCenter({ lat, lng });
            gMap.setZoom(17);
            if (marker) {
              if (marker.setPosition) marker.setPosition({ lat, lng });
              else marker.position = { lat, lng };
            }
            this.state.pform.lat = lat;
            this.state.pform.lng = lng;
            this.state.pform.earth = true;
            this.state.pform.pinSet = true;
            this.state.pform.earthQ = searchInput.value;
          }
        });
      }

      window.setTimeout(() => {
        if ((window as any).google?.maps?.event) {
          (window as any).google.maps.event.trigger(gMap, 'resize');
          gMap.setCenter(center);
        }
      }, 80);
    } catch (err) {
      if (el) el.dataset.mounted = '';
      console.warn('Google Maps satellite load error:', err);
    }
  }
  go(k) {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.setState({ section: k, selectedDeal: null, dealEdit: false, selectedClient: null, plotCityOpen: false, p: 1 });
  }
  setS(patch) { this.setState({ sform: { ...this.state.sform, ...patch } }); }
  onSForm(e) { this.setS({ [e.target.name]: e.target.value }); }
  blankL() {
    return { clientId: '', newName: '', newPhone: '', newBusiness: '', plots: [], expiry: '3d', loc: 'area', price: 'hidden', audio: 'none', secs: 0, note: '' };
  }
  blankCF() {
    return { name: '', phone: '', phone2: '', business: '', city: '', types: [], areas: [], budgetFrom: '', budgetTo: '', sizeFrom: '', sizeTo: '', prefs: [], customPref: '', stage: 'Just looking', note: '', areaDraft: '' };
  }
  lNext() { const s = this.state; if (s.lstep < 3) this.setState({ lstep: s.lstep + 1 }); }
  lBack() { const s = this.state; if (s.lstep > 1) this.setState({ lstep: s.lstep - 1 }); }
  setL(patch) { this.setState({ lform: { ...this.state.lform, ...patch } }); }
  onLForm(e) { this.setL({ [e.target.name]: e.target.value }); }
  toggleLPlot(id) { const cur = this.state.lform.plots; const next = cur.includes(id) ? cur.filter(x => x !== id) : (cur.length >= 4 ? cur : [...cur, id]); this.setL({ plots: next }); }
  recL() {
    const f = this.state.lform;
    if (f.audio === 'rec') {
      if (this._lrec) { clearInterval(this._lrec); this._lrec = null; }
      this.setL({ audio: 'done' });
      return;
    }
    if (f.audio === 'done') return;
    if (this._lrec) { clearInterval(this._lrec); this._lrec = null; }
    this.setL({ audio: 'rec', secs: 0 });
    this._lrec = setInterval(() => {
      const g = this.state.lform;
      if (g.audio !== 'rec') {
        if (this._lrec) { clearInterval(this._lrec); this._lrec = null; }
        return;
      }
      if (g.secs >= 120) {
        if (this._lrec) { clearInterval(this._lrec); this._lrec = null; }
        this.setL({ audio: 'done' });
        return;
      }
      this.setL({ secs: g.secs + 1 });
    }, 1000);
  }
  dropL() {
    if (this._lrec) { clearInterval(this._lrec); this._lrec = null; }
    this.setL({ audio: 'none', secs: 0 });
  }
  sendLink() {
    const f = this.state.lform; const c = f.clientId ? this.clients.find(x => x.id === f.clientId) : null;
    const name = c ? c.name : ((f.newName || '').trim() || 'New customer');
    const id = 'L' + (this.clientLinks.length + 1);
    let cid = f.clientId;
    if (!cid && (f.newName || '').trim()) { const nc = this.createClient({ name: (f.newName || '').trim(), phone: (f.newPhone || '').trim(), business: (f.newBusiness || '').trim() }); cid = nc.id; }
    this.clientLinks.unshift({ id, clientId: cid, client: name, props: f.plots.slice(), created: 'today', expires: this.EXPIRY.find(e => e.k === f.expiry).l + ' from now', status: 'active', audio: f.audio === 'done', loc: f.loc, price: f.price, events: [] });
    this.setState({ linkBuild: 'done', lastLink: id });
  }
  revokeLink(id) { const l = this.clientLinks.find(x => x.id === id); if (l) l.status = 'revoked'; this.forceUpdate(); }
  deleteLink(id) { this.clientLinks = this.clientLinks.filter(x => x.id !== id); this.forceUpdate(); }
  savePrice() {
    const pr = this.properties.find(x => x.id === this.state.priceEdit); const v = parseFloat(this.state.priceVal);
    if (pr && !isNaN(v)) pr.price = Math.round(v * 1e7);
    this.setState({ priceEdit: null, priceVal: '' });
  }
  publish(id) { const pr = this.properties.find(x => x.id === id); if (pr) { pr.published = true; pr.ready = true; pr.gap = ''; } this.forceUpdate(); }
  doUnpublish() {
    const id = this.state.unpubFor; const pr = this.properties.find(x => x.id === id);
    if (pr) { pr.published = false; pr.ready = false; pr.gap = (this.state.unpubReason || 'Taken off the map by you'); }
    this.setState({ unpubFor: null, unpubReason: '' });
  }
  openSold(id) {
    const pr = this.properties.find(x => x.id === id); if (!pr) return;
    this.setState({
      soldFor: id, cardMenu: null, propDetail: null,
      soldForm: {
        price: pr.price ? String(pr.price / 1e7) : '', buyerId: '', buyerName: '', buyerPhone: '', buyerNew: false, buyerQ: '',
        comm: pr.price ? String(Math.round(pr.price * 0.015 / 1e5)) : '', date: new Date().toISOString().slice(0, 10)
      }
    });
  }
  fmtSaleDate(d) {
    if (!d) return '—';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  /* Mark Sold. One atomic command marks the property sold, COMPLETES a
     matching open deal (or writes a canonical completed one) and appends to
     the buyer's purchase history — previously three separate in-memory
     writes that could half-apply. Commission may remain due afterwards. */
  async confirmSold() {
    const f = this.state.soldForm;
    const pr = this.properties.find(x => x.id === this.state.soldFor); if (!pr) return;
    if (this.state.savingSold) return;
    const pv = parseFloat(f.price); const cv = parseFloat(f.comm);
    const price = isNaN(pv) ? pr.price : Math.round(pv * 1e7);
    if (!(price > 0)) { this.setState({ soldError: 'Enter the final sold price.' }); return; }
    const buyer = f.buyerId ? this.clients.find(c => c.id === f.buyerId) : null;
    const buyerName = buyer ? buyer.name : (f.buyerName || '').trim();
    if (!f.buyerId && !buyerName) { this.setState({ soldError: 'Choose or add the buyer.' }); return; }

    this.setState({ savingSold: true, soldError: '' });
    const ok = await deskStore.markSold({
      propertyId: pr.id,
      soldPrice: price,
      saleDate: this.isoSaleDate(f.date),
      ...(f.buyerId ? { buyerId: f.buyerId } : { newBuyer: { name: buyerName, phone: (f.buyerPhone || '').trim() } }),
      ...(isNaN(cv) ? {} : { commission: Math.round(cv * 1e5) }),
    });
    if (!ok) { this.setState({ savingSold: false, soldError: deskStore.lastWriteError }); return; }
    const comm = isNaN(cv) ? 0 : Math.round(cv * 1e5);
    this.setState({
      savingSold: false, soldError: '', soldFor: null, propDetail: null,
      celebrate: { kind: 'sold', title: pr.type + ' · ' + pr.size, sub: pr.loc + ' · ' + (buyerName || 'Buyer'), amount: this.inr(price), comm: this.inr(comm) }
    });
  }
  /* The sale command needs a real ISO date; the picker gives a loose value. */
  isoSaleDate(value) {
    const raw = String(value || '').trim();
    if (/^d{4}-d{2}-d{2}$/.test(raw)) return raw;
    const parsed = raw ? Date.parse(raw) : NaN;
    const when = Number.isNaN(parsed) ? new Date() : new Date(parsed);
    return when.toISOString().slice(0, 10);
  }
  /* Delete removes the canonical record. It is refused once the property
     has sold, because the completed deal, the buyer's purchase history and
     the seller's sold history all reference it — those must not be
     orphaned. Take a live property Off Market instead of deleting it. */
  async deletePlot(id) {
    const pr = this.properties.find(x => x.id === id);
    if (pr && pr.status === 'sold') {
      this.setState({ delPlot: false, propError: 'A sold property keeps its deal and buyer history. Take it off the market instead of deleting it.' });
      return;
    }
    const result = await deskStore.deleteProperty(id);
    if (!result) { this.setState({ delPlot: false, propError: deskStore.lastWriteError }); return; }
    this.setState({ propDetail: null, delPlot: false, propError: '' });
  }
  deleteClient(id) {
    const c = this.clients.find(x => x.id === id); this.clients = this.clients.filter(x => x.id !== id);
    if (c) this.clientLinks = this.clientLinks.filter(l => l.client !== c.name);
    this.setState({ selectedClient: null, delClient: false });
  }
  setP(o) {
    if (o.config) { const b = String(o.config).match(/^(\d+)/); if (b) o.beds = b[1]; }
    const curF = this.state.pform || {};
    const nextCity = o.city || curF.city || 'Mohali';
    const nextSec = o.sector !== undefined ? o.sector : (o.area !== undefined ? o.area : (curF.sector || curF.area || ''));
    if (!o.sectorMapId && nextSec) {
      const match = this.findMatchingSectorMap(nextCity, nextSec);
      if (match) {
        o.sectorMapId = match.id;
        o.sectorMapName = match.name;
        o.sectorMapImg = match.image;
      }
    }
    this.setState({ pform: { ...curF, ...o } });
  }
  onPForm(e) {
    const p = { [e.target.name]: e.target.value };
    if (e.target.name === 'price') {
      const sz = this.sizeNum(this.state.pform); const cr = parseFloat(e.target.value);
      p.rate = (sz && cr) ? String(Math.round(cr * 1e7 / sz)) : '';
    }
    this.setP(p);
  }
  sizeNum(f) {
    const v = parseFloat(String(f.size || '').replace(/[^0-9.]/g, '')); if (!v) return 0;
    const u = f.unit || 'sq yd'; if (u === 'marla') return v * 30.25; if (u === 'kanal') return v * 605; return v;
  }
  onPRate(e) {
    const r = parseFloat(e.target.value); const sz = this.sizeNum(this.state.pform);
    this.setP({ rate: e.target.value, price: (r && sz) ? String(+(r * sz / 1e7).toFixed(3)) : this.state.pform.price });
  }
  applyForm(pr, f) {
    const pv = parseFloat(f.price); const g = this.groupOf(f.type);
    pr.type = f.type;
    pr.want = g === 'plot' ? 'Plot' : g === 'comm' ? 'Commercial' : (f.type.includes('Kothi') ? 'Kothi' : f.type.includes('Villa') ? 'Villa' : 'Flat');
    pr.size = f.size ? (f.size + ' ' + f.unit) : (pr.size || '—'); pr.carpet = f.carpet;
    pr.loc = [f.area, f.city].filter(Boolean).join(', ') || f.city || pr.loc;
    pr.city = f.city || pr.city || 'Mohali'; pr.society = f.society; pr.address = f.address;
    pr.facing = g === 'comm' ? '—' : f.facing; pr.road = f.road; pr.plotNo = f.plotNo; pr.showPlotNo = f.showPlotNo !== false;
    pr.corner = !!f.corner; pr.tenure = f.tenure;
    this.DETAILKEYS.forEach(k => { if (f[k] !== undefined) pr[k] = f[k]; });
    pr.beds = f.beds; pr.baths = f.baths; pr.floor = f.floor; pr.totalFloors = f.totalFloors; pr.balconies = f.balconies;
    pr.parking = f.parking; pr.furnishing = f.furnishing; pr.age = f.age; pr.possession = f.possession;
    pr.frontage = f.frontage; pr.use = f.use; pr.mainRoad = !!f.mainRoad;
    pr.pooja = !!f.pooja; pr.store = !!f.store; pr.servant = !!f.servant; pr.lift = !!f.lift; pr.powerBackup = !!f.powerBackup;
    pr.washrooms = f.washrooms; pr.shutters = f.shutters; pr.rate = f.rate;
    if (pr.status !== 'sold') pr.status = f.avail || 'available';
    pr.price = isNaN(pv) ? (pr.price || 0) : Math.round(pv * 1e7);
    pr.photoCount = (f.photos || []).length; pr.video = (f.videos || []).length > 0; pr.videos = (f.videos || []).slice(); pr.docs = (f.docs || []).slice();
    const ap = parseFloat(f.askPrice);
    pr.ps = f.sellerId ? {
      sellerId: f.sellerId, askPrice: isNaN(ap) ? 0 : Math.round(ap * 1e7), relation: f.relation,
      availConfirmed: !!f.availConfirmed, lastConfirmed: f.lastConfirmed, visitNote: f.visitNote, note: f.sellerPropNote, docs: (f.sellerDocs || []).slice()
    } : null;
    pr.highlights = (f.highlights || []).slice(); pr.registry = f.registry; pr.approval = f.approval; pr.notes = f.notes; pr.sellerNote = f.sellerNote;
    pr.earth = !!f.earth;
    if (f.sectorMapId) {
      pr.sectorMapId = f.sectorMapId;
      pr.mapPlacement = f.mapPlacement || { mapId: f.sectorMapId, x: (f.sectorPinX !== undefined ? f.sectorPinX / 100 : 0.5), y: (f.sectorPinY !== undefined ? f.sectorPinY / 100 : 0.5) };
    }
    if (f.sector) this.PROPMAP[pr.id] = f.sector; else delete this.PROPMAP[pr.id];
    const rd = this.readinessOf(pr); pr.draft = false; pr.ready = rd.miss.length === 0;
    pr.gap = rd.miss.length ? rd.miss.map(m => m.label).join(' · ') : '';
    if (pr.published === undefined) pr.published = pr.ready; return pr;
  }
  /* Add / Edit Property. One canonical write through the repository
     boundary — the record survives refresh and re-login, and a property
     that cannot legally go On Sale is kept as a Draft with the dealer told
     exactly what is still missing rather than the save failing silently. */
  async savePlot(closeAfter) {
    const f = this.state.pform; if (!f.city && !f.area) return;
    if (this.state.savingProp && this.state.savingProp !== false) return;
    const editId = this.state.pEditId;
    this.setState({ savingProp: { title: (f.type || 'Property') + (f.size ? ' · ' + f.size + ' ' + (f.unit || '') : ''), loc: [f.area, f.city].filter(Boolean).join(', ') }, propError: '' });
    const result = await deskStore.saveProperty(f, { id: editId || undefined, lifecycle: f.avail === 'onhold' ? 'archived' : 'on-sale' });
    if (result.error) { this.setState({ savingProp: false, propError: result.error }); return; }
    const saved = result.property;
    if (closeAfter === false) {
      this.setState({ savingProp: false, pEditId: saved.id, pSaved: true, propError: '', propMissing: result.missing || [] });
      return;
    }
    this.setState({
      addPlotOpen: false, pstep: 1, pEditId: null, pSaved: false, section: 'properties',
      invView: 'live', plotCity: saved.city || 'Mohali', pform: this.blankP(),
      savingProp: false, propError: '', propMissing: result.missing || [],
      propDetail: saved.id, propShot: 0,
    });
  }
  /* Save as Draft. Incomplete records are allowed — a draft is a real
     persisted property, not a local placeholder. */
  async saveDraft() {
    const f = this.state.pform;
    if (!f.city && !f.area) { this.setState({ addPlotOpen: false, pstep: 1, pEditId: null, pform: this.blankP() }); return; }
    const result = await deskStore.saveProperty(f, { id: this.state.pEditId || undefined, lifecycle: 'draft' });
    if (result.error) { this.setState({ propError: result.error }); return; }
    this.setState({ addPlotOpen: false, pstep: 1, pEditId: null, pSaved: false, section: 'properties', invView: 'live', pform: this.blankP(), propError: '' });
  }
  /* Off market. Non-destructive: media, papers, seller relationship and
     any completed deal all survive. */
  async archiveProp(id) {
    const done = await deskStore.archiveProperty(id);
    this.setState({ propDetail: null, cardMenu: null, delPlot: false, propError: done ? '' : deskStore.lastWriteError });
  }
  async restoreProp(id) {
    const done = await deskStore.restoreProperty(id);
    this.setState({ cardMenu: null, propError: done ? '' : deskStore.lastWriteError });
  }
  blankShare() { return { clientId: '', newName: '', newPhone: '', expiry: '3d', loc: 'area', price: 'hidden', photos: [0, 1, 2, 3], audio: 'none', secs: 0 }; }
  recToggle() {
    const f = this.state.sform; if (f.audio === 'rec') { clearInterval(this._rec); this.setS({ audio: 'done' }); return; }
    if (f.audio === 'done') return; this.setS({ audio: 'rec', secs: 0 }); clearInterval(this._rec);
    this._rec = setInterval(() => { const s = this.state.sform; if (s.audio !== 'rec') { clearInterval(this._rec); return; } if (s.secs >= 120) { clearInterval(this._rec); this.setS({ audio: 'done' }); return; } this.setS({ secs: s.secs + 1 }); }, 1000);
  }
  dropAudio() { clearInterval(this._rec); this.setS({ audio: 'none', secs: 0 }); }
  createShare() {
    const f = this.state.sform; const pid = this.state.shareFor; const c = f.clientId ? this.clients.find(x => x.id === f.clientId) : null;
    const name = c ? c.name : ((f.newName || '').trim() || 'New customer');
    const id = 'S' + (this.shares.length + 1);
    this.shares.unshift({ id, propId: pid, client: name, created: 'today', expires: this.EXPIRY.find(e => e.k === f.expiry).l + ' from now', status: 'active', loc: f.loc, price: f.price, audio: f.audio === 'done', opened: 'not opened yet', played: false, called: false, wa: false, visit: false });
    this.setState({ shareDone: id });
  }
  onWiz(e) { this.setState({ wiz: { ...this.state.wiz, [e.target.name]: e.target.value } }); }
  setWiz(patch) { this.setState({ wiz: { ...this.state.wiz, ...patch } }); }
  pickWizClient(id) { const w = this.state.wiz; this.setWiz({ clientId: w.clientId === id ? '' : id, useNewClient: false }); }
  pickWizProp(id) { const w = this.state.wiz; this.setWiz({ propId: w.propId === id ? '' : id, useManualProp: false }); }
  wizNext() { const w = this.state.wiz; if (w.step >= 3) return; this.setWiz({ step: w.step + 1 }); }
  wizBack() { const w = this.state.wiz; if (w.step <= 1) return; this.setWiz({ step: w.step - 1 }); }
  toggleCPlot(id) { const cur = this.state.cform.plots || []; const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]; this.setState({ cform: { ...this.state.cform, plots: next } }); }
  onCFormInput(e) { this.setState({ cform: { ...this.state.cform, [e.target.name]: e.target.value } }); }
  setDealName(id, v) { const d = this.deals.find(x => x.id === id); if (d) { d.name = v; this.forceUpdate(); } }
  deleteDeal(id) { this.deals = this.deals.filter(d => d.id !== id); this.setState({ selectedDeal: null, delArm: false }); }
  linkProp(id, propId) { const d = this.deals.find(x => x.id === id); if (d) { const pr = this.properties.find(p => p.id === propId); d.propId = propId; if (pr) { d.propSub = pr.loc; } } this.setState({ linkFor: null }); this.forceUpdate(); }
  unlinkProp(id) { const d = this.deals.find(x => x.id === id); if (d) { d.propId = ''; } this.forceUpdate(); }
  submitAdd() {
    const w = this.state.wiz; let clientName = '';
    const pr = w.propId ? this.properties.find(p => p.id === w.propId) : null;
    if (w.useNewClient && (w.ncName || '').trim()) {
      clientName = w.ncName.trim();
      const cid = 'C' + (this.clients.length + 1);
      this.clients.unshift({ id: cid, name: clientName, phone: w.ncPhone || '—', city: pr ? pr.city : 'Mohali', budget: '—', budgetMax: 0, want: pr ? pr.want : 'Plot', status: 'active', seen: 'just now', note: 'Added while recording a deal.', viewed: [], interest: w.propId ? [w.propId] : [] });
      this.newClients = [cid, ...this.newClients];
    } else { const c = this.clients.find(x => x.id === w.clientId); if (c) { clientName = c.name; if (w.propId) { c.interest = Array.from(new Set([...(c.interest || []), w.propId])); } } }
    if (!clientName) { this.setState({ addOpen: false }); return; }
    const id = 'D' + (this.deals.length + 1);
    const propLabel = pr ? (pr.type + ' · ' + pr.size) : ('Property' + (w.mpSize ? ' · ' + w.mpSize : ''));
    const sub = pr ? pr.loc : ((w.mpLoc || '').trim() || '—');
    const val = (parseFloat(w.value) || 0) * 1e7;
    const commRs = (parseFloat(w.comm) || 0) * 1e5;
    const pct = val ? +(commRs / val * 100).toFixed(2) : 1;
    const cid2 = this.clients.find(x => x.name === clientName);
    const when = this.TODAY + ' Aug';
    const d = {
      id, name: (w.name || '').trim() || (clientName + ' · ' + (pr ? pr.loc : ((w.mpLoc || '').trim() || 'deal'))),
      client: clientName, clientId: cid2 ? cid2.id : '',
      prop: propLabel, propSub: sub, area: pr ? pr.city : 'Mohali', propId: w.propId || '', outside: !w.propId,
      value: val, comm: commRs || Math.round(val * 0.02), token: 0, stage: w.stage === 'enquiry' ? 'negotiating' : w.stage,
      created: when, createdDay: this.TODAY, registryDay: 0,
      cB: commRs ? pct : 1, cS: commRs ? 0 : 1,
      next: { k: 'Call buyer', note: 'First follow-up on this deal', day: this.TODAY + 1 },
      pay: [], hist: [{ s: w.stage === 'enquiry' ? 'negotiating' : w.stage, d: when }],
      docs: [{ n: 'Token receipt', have: false }],
      log: [{ d: when, t: 'Deal created', i: 'ph-fill ph-handshake', c: '#6b6156' }],
      seller: { name: w.sellerName || '—', phone: w.sellerPhone || '—' }
    };
    this.deals.unshift(d);
    this.setState({ addOpen: false, section: 'deals', dealView: 'active', selectedDeal: d.id, dealTab: 'overview', delArm: false, wiz: this.blankWiz() });
  }
  submitAddClient() {
    const f = this.state.cform; if (!f.name) { this.setState({ addClientOpen: false }); return; }
    const u = f.unit; const bf = (f.budgetFrom || '').trim(), bt = (f.budgetTo || '').trim();
    const budget = bf && bt ? `₹${bf}–${bt} ${u}` : bf ? `₹${bf} ${u}+` : bt ? `Up to ₹${bt} ${u}` : '—';
    const bMax = (parseFloat(bt || bf) || 0) * (u === 'Cr' ? 1e7 : 1e5);
    const id = 'C' + (this.clients.length + 1);
    const c = { id, name: f.name, phone: f.phone || '—', city: f.city, budget, budgetMax: bMax, want: f.want, status: 'active', seen: 'just now', note: f.note || '', viewed: [], interest: f.plots || [] };
    this.clients.unshift(c); this.newClients = [id, ...this.newClients];
    this.setState({ addClientOpen: false, section: 'clients', selectedClient: id, cform: { name: '', phone: '', want: 'Plot', city: 'Mohali', budgetFrom: '', budgetTo: '', unit: 'Cr', note: '', plots: [] } });
  }

  createClient(o) {
    const id = 'C' + (Math.max(0, ...this.clients.map(c => +String(c.id).slice(1) || 0)) + 1);
    const c = {
      id, name: o.name, phone: o.phone || '—', phone2: o.phone2 || '', business: o.business || '', city: o.city || '',
      budget: o.budget || '—', budgetMax: o.budgetMax || 0, want: (o.types && o.types[0]) ? this.wantOf(o.types[0]) : 'Plot', status: 'active', seen: 'just now',
      note: o.note || '', viewed: [], interest: [], types: o.types || [], areas: o.areas || [], bFrom: o.bFrom || null, bTo: o.bTo || null,
      sizeFrom: o.sizeFrom || '', sizeTo: o.sizeTo || '', prefs: o.prefs || [], stage: o.stage || 'Just looking',
      notes: o.note ? [{ t: 'just now', x: o.note }] : [], archived: false
    };
    this.clients.unshift(c); this.newClients = [id, ...this.newClients]; return c;
  }
  dupClient(phone, skipId) {
    const d = String(phone || '').replace(/[^0-9]/g, '').slice(-10); if (d.length < 10) return null;
    return this.clients.find(c => c.id !== skipId && String(c.phone || '').replace(/[^0-9]/g, '').slice(-10) === d) || null;
  }
  dupSeller(phone, skipId) { return deskStore.findSellerByPhone(phone, skipId); }
  setCF(o) { this.setState({ cf: { ...this.state.cf, ...o } }); }
  onCF(e) { this.setCF({ [e.target.name]: e.target.value }); }
  cfToggle(k, v) { const cur = this.state.cf[k] || []; this.setCF({ [k]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] }); }
  cfAddArea() {
    const v = (this.state.cf.areaDraft || '').trim(); if (!v) return;
    const cur = this.state.cf.areas || []; if (!cur.includes(v)) this.setCF({ areas: [...cur, v], areaDraft: '' }); else this.setCF({ areaDraft: '' });
  }
  cfAddPref() {
    const v = (this.state.cf.customPref || '').trim(); if (!v) return;
    const cur = this.state.cf.prefs || []; if (!cur.includes(v)) this.setCF({ prefs: [...cur, v], customPref: '' }); else this.setCF({ customPref: '' });
  }
  cfFrom(c) {
    return {
      name: c.name, phone: c.phone === '—' ? '' : c.phone, phone2: c.phone2 || '', business: c.business || '', city: c.city || '',
      types: this.typesFor(c).slice(), areas: (c.areas || []).slice(), budgetFrom: c.bFrom ? String(c.bFrom) : '', budgetTo: c.bTo ? String(c.bTo) : '',
      sizeFrom: c.sizeFrom || '', sizeTo: c.sizeTo || '', prefs: (c.prefs || []).slice(), customPref: '', stage: c.stage || 'Just looking', note: '', areaDraft: ''
    };
  }
  cfBudget(f) {
    const a = parseFloat(f.budgetFrom), b = parseFloat(f.budgetTo);
    if (!isNaN(a) && !isNaN(b)) return '₹' + a + '–' + b + ' Cr'; if (!isNaN(a)) return '₹' + a + ' Cr+'; if (!isNaN(b)) return 'Up to ₹' + b + ' Cr'; return '—';
  }
  /* Add Client. Name + phone is the minimum; everything else is optional
     and stays genuinely absent until the dealer records it. An existing
     client with the same number is reused rather than duplicated. */
  async saveNewClient() {
    const f = this.state.cf;
    if (!f.name.trim() || !f.phone.trim()) return;
    if (this.state.savingClient) return;
    const existing = deskStore.findClientByPhone(f.phone);
    if (existing) { this.useExistingClient(existing.id); return; }
    this.setState({ savingClient: true, clientError: '' });
    const id = await deskStore.saveClient(f);
    if (!id) { this.setState({ savingClient: false, clientError: deskStore.lastWriteError }); return; }
    deskStore.loadClientWorkspace(id);
    this.setState({ savingClient: false, clientError: '', addClientBig: false, cf: this.blankCF(), section: 'clients', contactMode: 'clients', selectedClient: id });
  }
  useExistingClient(id) {
    deskStore.loadClientWorkspace(id);
    this.setState({ addClientBig: false, cf: this.blankCF(), section: 'clients', contactMode: 'clients', selectedClient: id });
  }
  /* Update the SAME canonical client — correcting a number never creates
     a second copy of the person. */
  async saveClientEdit() {
    const f = this.state.cf; const id = this.state.selectedClient;
    if (!id || this.state.savingClient) return;
    this.setState({ savingClient: true, clientError: '' });
    const saved = await deskStore.saveClient(f, id);
    if (!saved) { this.setState({ savingClient: false, clientError: deskStore.lastWriteError }); return; }
    this.setState({ savingClient: false, clientError: '', cliEdit: false, cf: this.blankCF() });
  }
  async addNote() {
    const v = (this.state.noteDraft || '').trim(); if (!v) return;
    const id = this.state.selectedClient; if (!id) return;
    const ok = await deskStore.addClientNote(id, v);
    this.setState({ noteDraft: ok ? '' : this.state.noteDraft, clientError: ok ? '' : deskStore.lastWriteError });
  }
  async toggleLike(cid, pid) {
    const c = this.clients.find(x => x.id === cid); if (!c) return;
    const arr = (c.interest || []).slice(); const i = arr.indexOf(pid);
    if (i >= 0) arr.splice(i, 1); else arr.push(pid);
    c.interest = arr; this.forceUpdate();
    await deskStore.setClientInterest(cid, arr);
  }
  /* Archiving is non-destructive — links, deals and purchases survive. */
  async archiveClient(id) {
    const done = await deskStore.archiveClient(id);
    if (!done) { this.setState({ arch: null, clientError: deskStore.lastWriteError }); return; }
    deskStore.closeClientWorkspace();
    this.setState({ selectedClient: null, arch: null, clientError: '' });
  }
  setSF2(o) { this.setState({ sf2: { ...this.state.sf2, ...o } }); }
  onSF2(e) { this.setSF2({ [e.target.name]: e.target.value }); }
  /* Add Seller from Contacts. Creating and editing both land here, so a
     dealer correcting a number updates the same canonical seller rather
     than creating a second one. */
  async saveNewSeller() {
    const f = this.state.sf2; if (!f.name.trim() || !f.phone.trim()) return;
    if (this.state.savingSeller) return;
    this.setState({ savingSeller: true, sellerError: '' });
    const id = await deskStore.saveSeller({
      ...(this.state.sellerEditId ? { id: this.state.sellerEditId } : {}),
      name: f.name, phone: f.phone, phone2: f.phone2,
      business: f.business, kind: f.kind, city: f.city, note: f.note,
    });
    if (!id) { this.setState({ savingSeller: false, sellerError: deskStore.lastWriteError }); return; }
    deskStore.loadSellerWorkspace(id);
    this.setState({
      savingSeller: false, sellerError: '', addSellerOpen: false, sellerEditId: null,
      sf2: this.blankNS(), section: 'clients', contactMode: 'sellers', sellerView: id,
    });
  }
  /* Open an existing seller in the same approved Add/Edit sheet. */
  editSeller(id) {
    const sl = this.sellers.find(x => x.id === id); if (!sl) return;
    this.setState({
      addSellerOpen: true, sellerEditId: id, sellerError: '',
      sf2: { name: sl.name, phone: sl.phone, phone2: sl.phone2 || '', business: sl.business || '', kind: sl.kind, city: sl.city || '', note: sl.note || '' },
    });
  }
  /* Archiving is non-destructive and refused while the seller still holds
     live inventory, so sold history is never orphaned. */
  async archiveSeller(id) {
    this.setState({ sellerError: '' });
    const done = await deskStore.archiveSeller(id, true);
    if (!done) { this.setState({ arch: null, sellerError: deskStore.lastWriteError }); return; }
    deskStore.closeSellerWorkspace();
    this.setState({ sellerView: null, arch: null });
  }
  dealListVM(d) {
    const m = this.stageMeta(d.stage);
    return {
      id: d.id, name: d.name || d.client, client: d.client, propSub: d.propSub,
      valueFmt: this.inr(d.value), commFmt: d.comm ? this.inr(d.comm) : '—', hasComm: !!d.comm,
      stageLabel: m.label, pill: `display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:12.5px;font-weight:800;white-space:nowrap;background:${m.bg};color:${m.color}`, dot: `width:7px;height:7px;border-radius:50%;background:${m.color};flex:none`,
      initials: this.initialsOf(d.client), tileIcon: this.propIcon(d.prop),
      cardStyle: `display:flex;align-items:center;gap:15px;padding:15px 16px;min-width:0;background:${m.card};border:1.5px solid ${m.border};border-radius:18px;cursor:pointer;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 34px -26px rgba(30,28,22,.6);transition:transform .12s`,
      tileStyle: `width:56px;height:56px;border-radius:15px;flex:none;display:grid;place-items:center;background:${m.bg};color:${m.color}`,
      tileStyleSm: `width:46px;height:46px;border-radius:13px;flex:none;display:grid;place-items:center;background:${m.bg};color:${m.color}`,
      open: () => this.setState({ selectedDeal: d.id, dealEdit: false, delArm: false })
    };
  }

  renderVals() {
    this.initContacts(); this.initLinks();

    const s = this.state; const now = new Date(); const h = now.getHours();
    const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const p = s.p || 0; const m = (v) => this.inr(v * p); const n = (v) => Math.round(v * p);

    // Private client share
    const sf = s.sform; const shareProp = s.shareFor ? this.properties.find(pr => pr.id === s.shareFor) : null;
    const sharesOf = (pid) => this.shares.filter(x => x.propId === pid);
    const SSTAT = { active: { l: 'Active', c: '#186c3c', b: '#e2f2e6' }, expired: { l: 'Expired', c: '#8a7a52', b: '#f3eeff' }, revoked: { l: 'Revoked', c: '#c2185b', b: '#ffe1e6' } };
    const pillOf = (on, txt, icon) => ({ txt, icon, style: `display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;${on ? 'background:#e2f2e6;color:#186c3c' : 'background:#f3eeff;color:#a3936a'}` });
    const shareRowsVm = (pid) => sharesOf(pid).map(sh => {
      const st = SSTAT[sh.status];
      return {
        client: sh.client, created: 'Sent ' + sh.created, expires: sh.status === 'active' ? ('Expires ' + sh.expires) : (sh.status === 'expired' ? 'Expired ' + sh.expires : 'Revoked'),
        statusLabel: st.l, statusStyle: `display:inline-flex;font-size:12px;font-weight:800;padding:5px 11px;border-radius:999px;background:${st.b};color:${st.c}`,
        opened: sh.opened, locLabel: this.LOCVIS.find(l => l.k === sh.loc).l, priceLabel: this.PRICEVIS.find(l => l.k === sh.price).l,
        e1style: pillOf(sh.played).style, e2style: pillOf(sh.called).style, e3style: pillOf(sh.wa).style, e4style: pillOf(sh.visit).style,
        audioLabel: sh.audio ? 'Voice note included' : 'No voice note',
        canRevoke: sh.status === 'active', preview: () => this.setState({ mobileFor: sh.propId, mobileShare: sh.id })
      };
    });

    const active = this.deals.filter(d => ['enquiry', 'negotiating', 'token', 'registry'].includes(d.stage));
    const closed = this.deals.filter(d => d.stage === 'closed');
    const pipeline = active.reduce((a, d) => a + d.value, 0), expComm = active.reduce((a, d) => a + d.comm, 0), closedVal = closed.reduce((a, d) => a + d.value, 0);

    const mny = this.moneyOn();
    const navItems = this.NAV.map(nv => {
      const on = s.section === nv.key; const badge = nv.key === 'deals' ? String(active.length) : ''; return {
        label: nv.label, icon: (on ? 'ph-fill ' : 'ph ') + nv.icon, go: () => this.go(nv.key),
        style: `width:100%;display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:13px;text-align:left;transition:background .15s;${on ? 'background:#f8a800;color:#1f1a12;box-shadow:inset 3px 0 0 #f4ae14' : 'background:transparent;color:#6b6156'}`,
        badge, badgeStyle: badge ? `margin-left:auto;background:${on ? '#c2185b' : '#fff2cf'};color:${on ? '#fff' : '#a8792a'};font-size:12.5px;font-weight:800;border-radius:999px;padding:2px 10px` : 'display:none'
      };
    });
    const sm = this.SECMETA[s.section];

    /* Canonical Client.status is 'active' | 'cold' | 'hot'; this map pre-dates
       that and had no 'hot', so an unmapped status threw and took the whole
       render down. Unknown values fall back rather than crash. */
    const CST_FALLBACK = { l: 'Active', c: '#7a7167', b: '#f3eeff' };
    const cstAll = { active: { l: 'Hot', c: '#b5322a', b: '#f6ded9' }, hot: { l: 'Hot', c: '#b5322a', b: '#f6ded9' }, warm: { l: 'Warm', c: '#b06f0c', b: '#fbeecb' }, cold: { l: 'Cold', c: '#7a7167', b: '#f3eeff' }, closed: { l: 'Done', c: '#0b8f45', b: '#d9f5e3' } };
    const cstMeta = new Proxy(cstAll, { get: (t, k) => t[k] || CST_FALLBACK });

    // Home — who to call (auto-matched, no upkeep)
    const callList = this.clients.filter(c => c.status === 'active' || c.status === 'warm')
      .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || b.budgetMax - a.budgetMax)
      .slice(0, 4).map(c => {
        const pl = this.matchPlot(c); const cm = cstMeta[c.status];
        return {
          initials: this.initialsOf(c.name), name: c.name, want: c.want, city: c.city, budget: c.budget, tel: this.tel(c.phone),
          statusLabel: cm.l, statusStyle: `display:inline-flex;padding:2px 9px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;background:${cm.b};color:${cm.c}`,
          matchText: pl ? ('Show: ' + pl.type + ' · ' + this.inr(pl.price)) : 'No stock yet — source one',
          matchIcon: pl ? 'ph-fill ph-map-pin-line' : 'ph ph-warning-circle',
          matchStyle: `display:none;align-items:center;gap:6px;padding:8px 12px;border-radius:11px;font-size:12.5px;font-weight:700;flex:none;max-width:230px;${pl ? 'background:#d9f5e3;color:#0b8f45' : 'background:#f6ded9;color:#b5322a'};@media(min-width:900px){display:inline-flex}`,
          open: () => { deskStore.loadClientWorkspace(c.id); this.setState({ section: 'clients', selectedClient: c.id }); }, stop: (e) => e.stopPropagation()
        };
      });
    // matchStyle can't use media query inline; simplify:
    callList.forEach(c => { c.matchStyle = `display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:11px;font-size:12.5px;font-weight:700;flex:none;max-width:240px;${/No stock/.test(c.matchText) ? 'background:#f6ded9;color:#b5322a' : 'background:#d9f5e3;color:#0b8f45'}`; });

    const maxWant0 = Math.max(1, ...this.WANTS.map(w => this.clients.filter(c => c.want === w).length));
    const wantSnapshot = this.WANTS.map(w => ({ want: w, buyers: this.clients.filter(c => c.want === w).length, stock: this.properties.filter(pr => pr.want === w && pr.status !== 'sold').length }))
      .sort((a, b) => b.buyers - a.buyers).slice(0, 4).map(t => ({
        want: t.want, buyersText: (t.buyers === 1 ? '1 buyer' : t.buyers + ' buyers'), stockText: (t.buyers > t.stock ? ('only ' + t.stock + (t.stock === 1 ? ' in stock' : ' in stock')) : (t.stock + ' in stock')), short: t.buyers > t.stock,
        barStyle: `height:100%;width:${Math.round(t.buyers / maxWant0 * 100)}%;background:${t.buyers > t.stock ? '#d13b2a' : '#d95d1e'};border-radius:999px;transform-origin:left;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both`
      }));

    // Demand rows (shared with home hot-city)
    const maxOpens = Math.max(...Object.values(this.INTEREST));
    const toneMap = { coral: { c: '#b5322a', b: '#f6ded9', bar: '#d13b2a' }, indigo: { c: '#b04a12', b: '#fbe4d3', bar: '#d95d1e' }, azure: { c: '#a86a08', b: '#fbeecb', bar: '#e79a1f' }, mute: { c: '#8a8177', b: '#f3eeff', bar: '#c9c0b0' } };
    const demandRows = this.CITIES.map(city => {
      const opens = this.INTEREST[city] || 0;
      const custs = this.clients.filter(c => c.city === city);
      const stock = this.properties.filter(pr => pr.city === city && pr.status !== 'sold');
      const stockVal = stock.reduce((a, pr) => a + pr.price, 0);
      let tone, label;
      if (custs.length > 0 && stock.length === 0) { tone = 'coral'; label = 'Source stock'; }
      else if (custs.length > 0 && stock.length > 0) { tone = 'indigo'; label = 'Ready to sell'; }
      else if (stock.length > 0) { tone = 'azure'; label = 'You have stock'; }
      else { tone = 'mute'; label = 'Quiet'; }
      const tm = toneMap[tone];
      return {
        city, opens, custCount: custs.length, stockCount: stock.length, stockValFmt: stockVal ? this.inr(stockVal) : '—',
        barStyle: `height:100%;width:${Math.round(opens / maxOpens * 100)}%;background:${tm.bar};border-radius:999px;transform-origin:left;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both`,
        verdict: label, verdictStyle: `display:inline-block;font-size:12px;font-weight:800;color:${tm.c};background:${tm.b};padding:6px 12px;border-radius:999px;white-space:nowrap`,
        go: () => this.setState({ section: 'properties', plotCity: city, plotCityOpen: false })
      };
    }).sort((a, b) => b.opens - a.opens);
    const opp = demandRows.find(r => r.verdict === 'Source stock');
    let demandTopName, demandTopLine, demandTopKicker, demandTopIcon, demandTopBg, demandTopTag, hotCityName, hotCityLine, hotCityGoKey;
    if (opp) {
      demandTopName = opp.city; demandTopKicker = 'Biggest opportunity'; demandTopIcon = 'ph-fill ph-lightbulb-filament';
      demandTopBg = 'background:#f7dde3;border:1px solid #eec3cd'; demandTopTag = 'color:#a3324f';
      demandTopLine = `${opp.city} was opened ${opp.opens} times while you were presenting — but you have nothing to show there yet. Sourcing even one plot could win a deal.`;
    }
    else {
      const t = demandRows[0]; demandTopName = t.city; demandTopKicker = 'Hottest area'; demandTopIcon = 'ph-fill ph-fire';
      demandTopBg = 'background:#fbeecb;border:1px solid #f0dda6'; demandTopTag = 'color:#a8792a';
      demandTopLine = `${t.city} is your most looked-at area with ${t.opens} opens, and you have ${t.stockCount} plots ready. Lead with these.`;
    }
    {
      const t = demandRows[0]; hotCityName = t.city; hotCityGoKey = t.city;
      hotCityLine = `${t.opens} opens while presenting · ${t.stockCount} plots ready to show.`;
    }

    // Demand — few numbers, strong colour
    const dOpens = Object.values(this.INTEREST).reduce((a, v) => a + v, 0);
    const dBuyers = this.clients.filter(c => c.status === 'active' || c.status === 'warm').length;
    const top0 = demandRows[0];
    const dHot = top0.city, dHotSub = `${top0.opens} opens · ${top0.stockCount} plots you can show`;
    const PIEC = ['#f8a800', '#6b3fd4', '#0f7a45', '#e2571f', '#c2185b', '#1f6f6b', '#c9b489'];
    const pieTop = demandRows.slice(0, 6);
    const restOpens = demandRows.slice(6).reduce((a, r) => a + r.opens, 0);
    const pieData = pieTop.map((r, i) => ({ label: r.city, opens: r.opens, color: PIEC[i], verdict: r.verdict, verdictStyle: r.verdictStyle, go: r.go }));
    if (restOpens > 0) pieData.push({ label: 'Other areas', opens: restOpens, color: PIEC[6], verdict: 'Quiet', verdictStyle: 'display:inline-block;font-size:12px;font-weight:800;color:#8a8177;background:#f3eeff;padding:6px 12px;border-radius:999px;white-space:nowrap', go: () => this.setState({ section: 'properties', plotCity: 'all', plotCityOpen: false }) });
    const pieTotal = pieData.reduce((a, d) => a + d.opens, 0) || 1;
    const CIRC = 2 * Math.PI * 45; let cum = 0;
    const CIRC2 = 2 * Math.PI * 70;
    const pieSegs = pieData.map(d => { const pct = d.opens / pieTotal; const seg = { color: d.color, dash: (pct * CIRC).toFixed(2) + ' ' + CIRC.toFixed(2), offset: (-cum * CIRC).toFixed(2), dash2: (pct * CIRC2 - 3).toFixed(2) + ' ' + CIRC2.toFixed(2), offset2: (-cum * CIRC2).toFixed(2) }; cum += pct; return seg; });
    const pieLegend = pieData.map(d => ({
      city: d.label, pct: Math.round(d.opens / pieTotal * 100) + '%', verdict: d.verdict, verdictStyle: d.verdictStyle + ';text-align:center;flex:none;white-space:nowrap', go: d.go,
      rowStyle: 'width:100%;display:flex;align-items:center;gap:13px;padding:9px 11px;border-radius:12px;cursor:pointer;transition:background .12s',
      dotStyle: `width:18px;height:18px;border-radius:6px;flex:none;background:${d.color};box-shadow:0 3px 8px -2px ${d.color}`,
      miniBar: `width:64px;height:9px;border-radius:999px;flex:none;background:linear-gradient(90deg,${d.color} ${Math.round(d.opens / pieTotal * 100)}%,#f2e2b6 ${Math.round(d.opens / pieTotal * 100)}%)`
    }));

    const maxViews = Math.max(1, ...this.properties.map(pr => pr.views || 0));
    const attentionRows = this.properties.filter(pr => pr.status !== 'sold').slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5).map((pr, ri) => {
      const ok = pr.ready;
      return {
        title: pr.type + ' · ' + pr.size, loc: pr.size + ' · ' + pr.loc.split(', ')[0], priceFmt: this.inr(pr.price), views: pr.views || 0, viewsText: (pr.views || 0) + ' opens', icon: this.propIcon(pr.type),
        rank: '#' + (ri + 1),
        rankStyle: 'position:absolute;top:8px;left:8px;display:grid;place-items:center;min-width:26px;height:26px;padding:0 7px;border-radius:9px;background:rgba(255,253,247,.94);color:#241d0c;font-size:12.5px;font-weight:800',
        cardStyle: 'min-width:0;background:#faf7ff;border:1.5px solid #e4dbf7;border-radius:18px;overflow:hidden;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(30,28,22,.03),0 14px 32px -26px rgba(30,28,22,.7);transition:transform .14s',
        photoStyle: `display:block;position:relative;height:112px;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center`,
        dotStyle: `width:11px;height:11px;border-radius:50%;flex:none;background:${ok ? '#12a150' : '#c2185b'}`,
        tileStyle: `width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;${ok ? 'background:#fff3d1;color:#a8792a' : 'background:#ffe1e6;color:#c2185b'}`,
        barStyle: `display:flex;align-items:center;justify-content:flex-end;height:100%;min-width:74px;width:${Math.max(18, Math.round((pr.views || 0) / maxViews * 100))}%;background:#f4ae14;border-radius:8px;padding-right:10px;color:#1f1a12;font-size:12px;font-weight:800;white-space:nowrap;transform-origin:left;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both`,
        chip: ok ? 'Ready' : 'Add photo', chipStyle: `display:inline-block;text-align:center;flex:none;white-space:nowrap;font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;${ok ? 'background:#e2f2e6;color:#1b7a46' : 'background:#ffe1e6;color:#c2185b'}`,
        go: () => this.setState({ section: 'properties', plotCity: pr.city, plotCityOpen: false })
      };
    });

    const wantIcon = { Plot: 'ph-fill ph-map-pin-area', Flat: 'ph-fill ph-buildings', Kothi: 'ph-fill ph-house-line', Villa: 'ph-fill ph-house', Commercial: 'ph-fill ph-storefront' };
    const wantTiles = this.WANTS.map(w => {
      const buyers = this.clients.filter(c => c.want === w).length; const stock = this.properties.filter(pr => pr.want === w && pr.status !== 'sold').length;
      const short = buyers > stock; const quiet = buyers === 0;
      const tone = quiet ? { bg: '#faf7ff', bd: '#e4dbf7', ic: '#a89e8b', num: '#8d8271', cb: '#f3eeff', cc: '#7d7365', ct: 'No demand yet' }
        : short ? { bg: '#f7dde3', bd: '#eec3cd', ic: '#a3324f', num: '#a3324f', cb: '#a3324f', cc: '#fff', ct: 'Short on stock' }
          : { bg: '#d9f5e3', bd: '#a6e3c0', ic: '#0b6f39', num: '#0b8f45', cb: '#0b8f39', cc: '#fff', ct: 'You are covered' };
      return {
        want: w, buyers, stock, icon: wantIcon[w] || 'ph-fill ph-map-pin', iconColor: `color:${tone.ic}`, numColor: `color:${tone.num}`,
        tileStyle: `background:${tone.bg};border:1.5px solid ${tone.bd};border-radius:20px;padding:20px 20px 18px`,
        chip: tone.ct, chipStyle: `display:inline-block;margin-top:12px;font-size:11.5px;font-weight:800;letter-spacing:.03em;padding:4px 10px;border-radius:999px;background:${tone.cb};color:${tone.cc}`
      };
    });


    // Deals
    const q = (s.dealSearch || '').toLowerCase();
    const dmatch = (d) => !q || ((d.name || '') + ' ' + d.client + ' ' + d.prop + ' ' + d.propSub + ' ' + d.area).toLowerCase().includes(q);
    const orderIdx = { enquiry: 0, negotiating: 1, token: 2, registry: 3, closed: 4, lost: 5 };
    const dealsActive = this.deals.filter(d => orderIdx[d.stage] < 4).filter(dmatch).sort((a, b) => (orderIdx[b.stage] - orderIdx[a.stage]) || (b.value - a.value)).map(d => this.dealListVM(d));
    const doneView = s.dealView === 'done';
    const activeRaw = this.deals.filter(d => orderIdx[d.stage] < 4), doneRaw = this.deals.filter(d => orderIdx[d.stage] >= 4);
    const doneVal = doneRaw.filter(d => d.stage === 'closed').reduce((a, d) => a + d.value, 0);
    const doneComm = doneRaw.filter(d => d.stage === 'closed').reduce((a, d) => a + d.comm, 0);
    const dealsDone = this.deals.filter(d => orderIdx[d.stage] >= 4).filter(dmatch).map(d => this.dealListVM(d));
    const bigBtn = (on, tone, dark) => 'display:flex;align-items:center;gap:13px;padding:16px 18px;border-radius:18px;text-align:left;transition:box-shadow .2s;' + (on ? (tone === 'money' ? 'background:#12a150;background-image:linear-gradient(140deg,#2ec474,#0b6f39);color:#f2fff7;box-shadow:0 18px 36px -18px rgba(0,0,0,.55)' : 'background:#241d0c;background-image:linear-gradient(140deg,#3d3115,#1c1608);color:#ffe9ae;box-shadow:0 18px 36px -18px rgba(36,29,12,.75)') : (dark ? 'background:rgba(255,255,255,.12);color:#d7f0e0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.24)' : 'background:rgba(255,255,255,.74);color:#4c463d;box-shadow:inset 0 0 0 1px rgba(120,100,60,.22)'));

    const MONN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const TODAY = 13, CALM = 7, CALY = 2026, calMonth = 'August 2026';
    const evAll = [];
    this.deals.forEach(d => {
      const dd = this.DEALDATES[d.id]; if (!dd) return; const nm = d.name || d.prop;
      if (dd.start) evAll.push({ day: dd.start, kind: 'start', name: nm, note: 'Deal started', amt: '', raw: 0, d });
      if (dd.token) evAll.push({ day: dd.token, kind: 'money', name: nm, note: 'Token received', amt: this.inr(d.token), raw: d.token, d });
      if (dd.close) evAll.push({ day: dd.close, kind: 'close', name: nm, note: 'Registry done · full payment', amt: this.inr(d.value), raw: d.value, d });
      if (dd.due) evAll.push({ day: dd.due, kind: 'due', name: nm, note: 'Registry payment due', amt: this.inr(d.value - (d.token || 0)), raw: 0, d });
    });
    const KIND = {
      close: { c: '#f8a800', bg: 'linear-gradient(160deg,#ffe08c,#f0a91b)', ink: '#4a3305', i: 'ph-fill ph-seal-check', l: 'Deal closed' },
      money: { c: '#37dd8b', bg: 'linear-gradient(160deg,#5cf0a8,#12a150)', ink: '#053a1d', i: 'ph-fill ph-hand-coins', l: 'Money in' },
      due: { c: '#7fb6ff', bg: 'linear-gradient(160deg,#a9d0ff,#3f7fe0)', ink: '#08265c', i: 'ph-fill ph-hourglass-medium', l: 'Payment due' },
      start: { c: '#8fe6b4', bg: 'rgba(255,255,255,.16)', ink: '#eafff2', i: 'ph-fill ph-flag', l: 'Started' }
    };
    const ORDER = { close: 4, money: 3, due: 2, start: 1 };
    const byDay = {}; evAll.forEach(e => { const cur = byDay[e.day]; if (!cur || ORDER[e.kind] > ORDER[cur.kind]) byDay[e.day] = e; });
    const firstDow = 5, dim = 31;
    const calCells = [];
    for (let i = 0; i < firstDow; i++) calCells.push({ day: '', style: 'min-height:62px;border-radius:14px;background:rgba(255,255,255,.03)', dayStyle: 'display:none', hasMark: false, hasAmt: false });
    for (let dnum = 1; dnum <= dim; dnum++) {
      const e = byDay[dnum]; const K = e ? KIND[e.kind] : null; const today = dnum === TODAY;
      calCells.push({
        day: String(dnum),
        style: 'position:relative;min-height:62px;border-radius:14px;padding:7px 8px;display:flex;flex-direction:column;gap:4px;' + (e && (e.kind === 'close' || e.kind === 'money') ? 'background:rgba(255,255,255,.13);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 10px 20px -14px rgba(0,0,0,.6)' : 'background:rgba(255,255,255,.05)') + (today ? ';outline:2px solid #f8a800;outline-offset:0' : ''),
        dayStyle: 'font-size:12.5px;font-weight:800;color:' + (today ? '#f8a800' : (e ? '#eafff2' : '#63a982')),
        hasMark: !!e, markIcon: K ? K.i : '', markStyle: K ? ('width:22px;height:22px;border-radius:8px;display:grid;place-items:center;color:' + K.ink + ';background:' + K.bg) : '',
        hasAmt: !!(e && e.amt), amt: e ? e.amt : '', amtStyle: 'font-size:10.5px;font-weight:800;color:' + (e && e.kind === 'due' ? '#a9d0ff' : '#f8c200') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
      });
    }
    const calLegend = ['close', 'money', 'due', 'start'].map(k => ({
      label: KIND[k].l,
      style: 'display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:800;color:#c9f7dc;background:rgba(255,255,255,.08);border-radius:999px;padding:5px 11px',
      dot: 'width:9px;height:9px;border-radius:50%;background:' + KIND[k].c
    }));
    const paidEv = evAll.filter(e => (e.kind === 'money' || e.kind === 'close') && e.day <= TODAY).sort((a, b) => b.day - a.day);
    const dueEv = evAll.filter(e => e.kind === 'due').sort((a, b) => a.day - b.day);
    const rowOf = (e) => ({
      day: String(e.day), mon: 'Aug', who: (e.d.client || e.name), amt: e.amt,
      note: e.kind === 'close' ? 'Full payment · registry done' : (e.kind === 'money' ? 'Token money' : 'Registry payment left')
    });
    const paidRows = paidEv.slice(0, 4).map(rowOf), dueRows = dueEv.slice(0, 3).map(rowOf);
    const paidSum = paidEv.reduce((a, e) => a + e.raw, 0);
    const dueSum = dueEv.reduce((a, e) => a + (e.d.value - (e.d.token || 0)), 0);
    const paidTotalLine = paidEv.length ? (m(paidSum) + ' in August, from ' + paidEv.length + (paidEv.length === 1 ? ' payment' : ' payments')) : 'No money came in yet this month.';
    const dueTotalLine = dueEv.length ? (m(dueSum) + ' waiting on ' + dueEv.length + (dueEv.length === 1 ? ' deal' : ' deals')) : 'Nothing pending.';
    const stripDays = [];
    for (let dnum = 1; dnum <= dim; dnum++) {
      const e = byDay[dnum]; const gold = !!(e && (e.kind === 'money' || e.kind === 'close')); const today = dnum === TODAY;
      stripDays.push({
        day: String(dnum), hasAmt: gold, amt: gold ? e.amt : '',
        style: 'flex:1;min-width:34px;border-radius:12px;padding:9px 5px;display:flex;flex-direction:column;align-items:center;gap:3px;' + (gold ? 'background:linear-gradient(160deg,#ffe08c,#e0a013);box-shadow:inset 0 1px 0 rgba(255,255,255,.75),0 10px 20px -12px rgba(80,52,0,.7)' : 'background:rgba(255,255,255,.07)') + (today ? ';outline:2px solid #f8c200;outline-offset:1px' : ''),
        numStyle: 'font-size:14px;font-weight:800;color:' + (gold ? '#3c2a05' : (today ? '#f8c200' : '#8d9bbd'))
      });
    }
    const payRows = evAll.filter(e => e.kind !== 'start').sort((a, b) => b.day - a.day).slice(0, 6).map(e => ({
      day: String(e.day), mon: 'Aug', name: e.name, note: e.note, amt: e.amt,
      amtColor: e.kind === 'due' ? '#a9d0ff' : '#f8a800',
      dateStyle: 'width:46px;height:46px;flex:none;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:' + KIND[e.kind].ink + ';background:' + KIND[e.kind].bg,
      tag: e.kind === 'due' ? 'Coming' : 'Received',
      tagStyle: 'font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-top:3px;color:' + (e.kind === 'due' ? '#8fb9f0' : '#8fe6b4')
    }));
    const monthIn = evAll.filter(e => (e.kind === 'money' || e.kind === 'close') && e.day <= TODAY).reduce((a, e) => a + e.raw, 0);
    const nextDue = evAll.filter(e => e.kind === 'due' && e.day >= TODAY).sort((a, b) => a.day - b.day)[0];
    const nextPayTxt = nextDue ? (nextDue.day + ' Aug') : '—';
    const moneyDeals = this.deals.filter(d => d.stage === 'closed').map(d => {
      const dd = this.DEALDATES[d.id] || {};
      const span = (dd.close && dd.start) ? Math.max(1, dd.close - dd.start) : 0;
      return {
        what: 'You sold ' + (d.prop || 'the property'), who: 'to ' + d.client + ' · ' + d.propSub,
        paidTxt: dd.close ? ('Paid in full on ' + dd.close + ' August') : 'Paid in full',
        spanTxt: span ? ('Took ' + span + ' days') : 'Closed fast',
        chip: 'display:inline-flex;align-items:center;gap:7px;font-size:14.5px;font-weight:700;color:#3d4667;background:#f6efdd;border-radius:11px;padding:7px 12px',
        name: d.name || d.prop, client: d.client, valueFmt: this.inr(d.value), commFmt: d.comm ? this.inr(d.comm) : '—',
        stageLabel: 'Closed', stagePill: 'font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#053a1d;background:linear-gradient(160deg,#7ff0b0,#22c46f);border-radius:999px;padding:5px 12px;flex:none',
        badgeIcon: 'ph-fill ph-trophy', badgeStyle: 'width:44px;height:44px;flex:none;border-radius:14px;display:grid;place-items:center;color:#5c3f04;background:radial-gradient(circle at 34% 28%,#fff3c4,#f8a800 46%,#d99a09 80%);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 12px 22px -12px rgba(0,0,0,.6)',
        cardStyle: 'cursor:pointer;border-radius:26px;padding:24px 26px;background:#faf4e6;background-image:linear-gradient(165deg,#fffbf1,#f3e9d3);box-shadow:0 30px 58px -30px rgba(6,12,30,.8),inset 0 2px 0 rgba(255,255,255,.95);transition:transform .18s',
        chip: 'display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#c9f7dc;background:rgba(255,255,255,.09);border-radius:10px;padding:6px 11px',
        startTxt: dd.start ? (dd.start + ' Aug') : '—', closeTxt: dd.close ? ('Closed ' + dd.close + ' Aug') : 'Closed',
        daysTxt: span ? (span + ' days to close') : 'Fast close',
        open: () => this.setState({ selectedDeal: d.id, dealEdit: false, delArm: false })
      };
    });

    const DTODAY = this.TODAY;
    const dsOf = (k) => this.ds(k);
    const dPill = (m) => 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:11px;background:' + m.b + ';color:' + m.c + ';font-size:14.5px;font-weight:800;white-space:nowrap';
    const dFlagPill = (f) => 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:11px;background:' + f.b + ';color:' + f.c + ';font-size:14.5px;font-weight:800;text-wrap:pretty';
    const dealCard = (d, dark) => {
      const M = this.dealMoney(d), st = dsOf(d.stage), fl = this.dealFlags(d);
      const nx = d.next;
      return {
        id: d.id, client: d.client, initials: this.initialsOf(d.client),
        propLine: d.prop + ' · ' + d.propSub,
        stageLabel: st.l, stageIcon: st.i, stagePill: dPill(st),
        flags: fl.slice(0, 2).map(f => ({ text: f.t, icon: f.i, style: dFlagPill(f) })),
        nextLabel: nx ? nx.k : 'Nothing planned', nextIcon: nx ? (this.NEXTICON[nx.k] || 'ph-fill ph-note-pencil') : 'ph-fill ph-plus-circle',
        valueFmt: this.inr(d.value), commFmt: this.inr(M.expected),
        avStyle: 'width:52px;height:52px;border-radius:16px;flex:none;display:grid;place-items:center;font-size:19px;font-weight:800;background:' + st.b + ';color:' + st.c,
        card: (dark
          ? 'flex:1 1 340px;max-width:520px;text-align:left;border-radius:22px;background:#fffdf7;padding:18px 20px 20px;box-shadow:0 0 0 1.5px #ecdcc0,0 18px 38px -26px rgba(40,30,10,.8);transition:transform .15s;cursor:pointer'
          : 'flex:1 1 340px;max-width:560px;text-align:left;border-radius:22px;background:#fffdf7;padding:18px 20px 20px;box-shadow:0 0 0 1.5px #ece3d2,0 16px 34px -30px rgba(40,30,10,.7);transition:transform .15s;cursor:pointer'),
        open: () => this.setState({ selectedDeal: d.id, dealTab: 'overview', delArm: false })
      };
    };

    const dq = (s.dealSearch || '').toLowerCase().trim();
    const dMatch = (d) => !dq || ((d.name || '') + ' ' + d.client + ' ' + d.prop + ' ' + d.propSub + ' ' + d.area + ' ' + (d.seller ? d.seller.name : '')).toLowerCase().includes(dq);
    const dActiveAll = this.deals.filter(d => d.stage !== 'closed' && d.stage !== 'lost');
    const dDoneAll = this.deals.filter(d => d.stage === 'closed');
    const dLostAll = this.deals.filter(d => d.stage === 'lost');
    const dView = s.dealView === 'done' ? 'done' : 'active';
    const stageFilter = s.dealStage || 'all';
    const commExp = dActiveAll.reduce((a, d) => a + this.dealMoney(d).expected, 0);
    const commGotAll = this.deals.reduce((a, d) => a + this.dealMoney(d).got, 0);
    const commDueAll = this.deals.filter(d => d.stage !== 'lost').reduce((a, d) => a + this.dealMoney(d).due, 0);
    const dueToday = dActiveAll.filter(d => d.next && d.next.day <= DTODAY).length;

    const sellerNameOf = (d) => {
      const pr = d.propId ? this.properties.find(p => p.id === d.propId) : null;
      const ps = pr && pr.ps ? pr.ps : null; const sr = ps ? this.sellers.find(x => x.id === ps.sellerId) : null;
      return {
        name: sr ? sr.name : ((d.seller && d.seller.name) || '—'), phone: sr ? sr.phone : ((d.seller && d.seller.phone) || ''),
        ask: ps && ps.askPrice ? ('Asks ' + this.inr(ps.askPrice)) : 'Asking price not noted', pr, ps, sr
      };
    };

    /* ---------- compact summary strip ---------- */
    const stripCell = (last) => 'flex:1 1 180px;min-width:0;padding:15px 20px 16px;' + (last ? '' : 'box-shadow:inset -1.5px 0 0 #eddfc6');
    const dStrip = [
      { title: 'Active deals', value: String(dActiveAll.length), c: '#241f1c' },
      { title: 'Expected commission', value: this.inr(commExp), c: '#a3541b' },
      { title: 'Commission received', value: this.inr(commGotAll), c: '#0a6634' },
      { title: 'Commission still due', value: this.inr(commDueAll), c: '#b02a37' },
      { title: 'Actions due today', value: String(dueToday), c: '#1a5aa8' }]
      .map((k, i, arr) => ({
        title: k.title, value: k.value, cell: stripCell(i === arr.length - 1),
        label: 'font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a7f6e',
        valStyle: "font-family:'Newsreader',serif;font-weight:600;font-size:32px;line-height:1.05;margin-top:5px;color:" + k.c
      }));

    const dvTabs = [
      { k: 'active', l: 'Ongoing', n: dActiveAll.length, i: 'ph-fill ph-handshake', on: 'background:#f8a800;color:#241d0c;box-shadow:0 10px 20px -10px rgba(248,168,0,.9);', off: 'background:transparent;color:#786950;' },
      { k: 'done', l: 'Sold', n: dDoneAll.length, i: 'ph-fill ph-seal-check', on: 'background:#0a6634;color:#eafff2;box-shadow:0 10px 20px -10px rgba(10,102,52,.9);', off: 'background:transparent;color:#786950;' }
    ].map(t => {
      const on = dView === t.k; return {
        label: t.l, count: String(t.n), icon: t.i, go: () => this.setState({ dealView: t.k, dealStage: 'all', ledgerFilter: 'all' }),
        style: 'display:flex;align-items:center;gap:9px;height:52px;padding:0 22px;border-radius:14px;font-size:17px;font-weight:800;white-space:nowrap;transition:all .16s;' + (on ? t.on : t.off),
        num: 'font-size:13.5px;font-weight:800;border-radius:999px;padding:2px 9px;' + (on ? 'background:rgba(0,0,0,.14)' : 'background:rgba(0,0,0,.07)')
      };
    });

    /* ---------- TODAY ---------- */
    const dRowBase = 'display:flex;align-items:center;gap:13px;flex-wrap:wrap;padding:13px 16px;border-radius:15px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #ecdcc0';
    const actBtn = (bg, fg) => 'width:44px;height:44px;border-radius:12px;display:grid;place-items:center;flex:none;text-decoration:none;background:' + bg + ';color:' + fg;
    const mkRow = (d, tag, tagIcon, tagC, tagB, when, whenLate, amt) => {
      const S = sellerNameOf(d);
      const cl = this.clients.find(c => c.id === d.clientId) || {};
      return {
        row: dRowBase, tag, tagIcon,
        tagStyle: 'display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 13px;border-radius:11px;flex:none;background:' + tagB + ';color:' + tagC + ';font-size:14.5px;font-weight:800;white-space:nowrap',
        who: d.client, what: d.prop + ' · ' + d.propSub + (S.name !== '—' ? ('  ·  seller ' + S.name) : ''),
        when: when || '', whenStyle: 'flex:none;min-width:86px;text-align:right;font-size:15px;font-weight:800;' + (whenLate ? 'color:#b02a37' : 'color:#7a6f60'),
        amt: amt || '', amtStyle: amt ? "flex:none;min-width:96px;text-align:right;font-family:'Newsreader',serif;font-weight:600;font-size:24px;color:#0a6634" : 'display:none',
        acts: [{ label: 'Call buyer', icon: 'ph-fill ph-phone', href: this.tel(cl.phone || ''), go: () => { }, style: actBtn('#0f7a45', '#fff') },
        { label: 'WhatsApp', icon: 'ph-fill ph-whatsapp-logo', href: this.waLink(cl.phone || ''), go: () => { }, style: actBtn('#e3f4e9', '#0a6634') }],
        open: () => this.setState({ selectedDeal: d.id, dealTab: 'overview' }),
        update: () => this.openUpdate(d.id)
      };
    };

    const doRows = dActiveAll.filter(d => d.next && d.next.day <= DTODAY)
      .sort((a, b) => a.next.day - b.next.day)
      .map(d => {
        const late = d.next.day < DTODAY;
        return mkRow(d, d.next.k, this.NEXTICON[d.next.k] || 'ph-fill ph-note-pencil', late ? '#b02a37' : '#c0490c', late ? '#ffdfe2' : '#ffe3cf', this.dayLabel(d.next.day), late, '');
      });

    const waitRows = [];
    dActiveAll.forEach(d => {
      const fl = this.dealFlags(d).filter(f => f.wait);
      if (fl.length) waitRows.push(mkRow(d, fl[0].t, fl[0].i, fl[0].c, fl[0].b, '', false, ''));
    });

    const moneyRows = this.deals.filter(d => d.stage !== 'lost' && this.dealMoney(d).due > 0)
      .sort((a, b) => this.dealMoney(b).due - this.dealMoney(a).due)
      .map(d => {
        const M = this.dealMoney(d);
        return mkRow(d, d.stage === 'closed' ? 'Sold · commission due' : 'Commission due at closing', 'ph-fill ph-hand-coins', '#0a6634', '#d3f2e0', d.stage === 'closed' ? ('sold ' + (d.closedOn || '')) : '', false, this.inr(M.due));
      });

    const grpWrap = (bg, ring) => 'padding:20px 22px 22px;border-radius:24px;background:' + bg + ';box-shadow:inset 0 0 0 2px ' + ring;
    const todayGroups = [
      {
        label: 'Do today', sub: doRows.length ? (doRows.length + ' to get through') : '', icon: 'ph-fill ph-phone-call', c: '#c0490c', b: '#ffe3cf', bg: '#fff8f2', ring: '#f7d3b6', rows: doRows,
        emptyMsg: 'Nothing is due today. Set a next action on a deal and it shows up here.'
      },
      {
        label: 'Waiting on', sub: waitRows.length ? (waitRows.length + ' held up') : '', icon: 'ph-fill ph-hourglass', c: '#5b32c4', b: '#e7defc', bg: '#f8f5ff', ring: '#ded2f7', rows: waitRows,
        emptyMsg: 'Nothing is stuck waiting on someone else.'
      },
      {
        label: 'Money to collect', sub: moneyRows.length ? (this.inr(commDueAll) + ' outstanding') : '', icon: 'ph-fill ph-hand-coins', c: '#0a6634', b: '#d3f2e0', bg: '#f2faf5', ring: '#b7e0c8', rows: moneyRows,
        emptyMsg: 'Every rupee of commission is in. Nothing to chase.'
      }]
      .map(g => ({
        label: g.label, sub: g.sub, icon: g.icon, rows: g.rows, empty: g.rows.length === 0, emptyMsg: g.emptyMsg,
        wrap: grpWrap(g.bg, g.ring),
        iconBox: 'width:40px;height:40px;border-radius:13px;flex:none;display:grid;place-items:center;background:' + g.c + ';color:#fff',
        title: 'font-size:20px;font-weight:800;color:#241f1c;letter-spacing:-.005em',
        meta: 'flex:1;min-width:80px;text-align:right;font-size:15px;font-weight:700;color:' + g.c,
        emptyStyle: 'padding:22px 8px;text-align:center;font-size:16.5px;font-weight:700;color:#a89e8b'
      }));

    /* ---------- ACTIVE ---------- */
    const dStageChips = [{ k: 'all', l: 'All' }, { k: 'negotiating', l: 'Negotiating' }, { k: 'token', l: 'Token / Booked' }, { k: 'registry', l: 'Registry / Closing' }]
      .map(c => {
        const on = stageFilter === c.k; const cnt = c.k === 'all' ? dActiveAll.length : dActiveAll.filter(d => d.stage === c.k).length;
        return {
          label: c.l, count: String(cnt), go: () => this.setState({ dealStage: c.k }),
          style: 'display:flex;align-items:center;gap:8px;height:50px;padding:0 18px;border-radius:14px;font-size:16.5px;font-weight:800;white-space:nowrap;flex:none;' + (on ? 'background:#241d0c;color:#f8c200' : 'background:#fffdf7;color:#6b6156;box-shadow:inset 0 0 0 1.5px #e6d6b4'),
          num: 'font-size:13.5px;font-weight:800;border-radius:999px;padding:1px 8px;' + (on ? 'background:rgba(248,194,0,.2)' : 'background:#f3ece0;color:#8a7f6e')
        };
      });

    const activeRows = dActiveAll.filter(d => stageFilter === 'all' || d.stage === stageFilter).filter(dMatch)
      .sort((a, b) => {
        const fa = this.dealFlags(a), fb = this.dealFlags(b);
        return (fa.length ? fa[0].pri : 9) - (fb.length ? fb[0].pri : 9);
      });

    const activeDeals = activeRows.map(d => {
      const M = this.dealMoney(d), st = this.ds(d.stage), S = sellerNameOf(d);
      const cl = this.clients.find(c => c.id === d.clientId) || {};
      const fl = this.dealFlags(d), top = fl[0];
      const nx = d.next;
      return {
        card: 'flex:1 1 520px;max-width:840px;border-radius:24px;background:#fffdf7;padding:19px 21px 20px;box-shadow:0 0 0 1.5px #ece3d2,0 18px 40px -32px rgba(40,30,10,.8)',
        stageLabel: st.l, stageIcon: st.i,
        stagePill: 'display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:12px;background:' + st.b + ';color:' + st.c + ';font-size:15px;font-weight:800;white-space:nowrap',
        hasNote: !!top, noteText: top ? top.t : '', noteIcon: top ? top.i : '',
        noteStyle: top ? ('display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 13px;border-radius:12px;background:' + top.b + ';color:' + top.c + ';font-size:14.5px;font-weight:800;text-wrap:pretty') : 'display:none',
        buyer: d.client, buyerPhone: cl.phone || '—',
        cardStyle: 'border-radius:24px;padding:20px 22px 22px;background:' + st.b + ';background-image:linear-gradient(155deg,rgba(255,255,255,.74),rgba(255,255,255,0) 64%);box-shadow:0 0 0 2px ' + (st.r || st.b) + ',0 20px 40px -28px rgba(40,30,10,.8)',
        moneyStyle: 'display:flex;align-items:flex-end;gap:16px;margin-top:16px;padding:14px 16px;border-radius:17px;background:rgba(255,255,255,.88);box-shadow:0 0 0 1.5px rgba(255,255,255,.95);flex-wrap:wrap',
        propTitle: d.prop, propLoc: d.propSub,
        seller: S.name, sellerAsk: S.ask,
        priceFmt: this.inr(d.value), commFmt: this.inr(M.expected),
        hasDue: M.due > 0, dueFmt: this.inr(M.due),
        nextLabel: nx ? nx.k : 'Set a next action', nextIcon: nx ? (this.NEXTICON[nx.k] || 'ph-fill ph-note-pencil') : 'ph-fill ph-plus-circle',
        nextWhen: nx ? this.dayLabel(nx.day) : '',
        nextWhenStyle: 'display:inline-flex;align-items:center;height:30px;padding:0 10px;border-radius:9px;font-size:14px;font-weight:800;' + (nx && nx.day < DTODAY ? 'background:#ffdfe2;color:#b02a37' : nx && nx.day === DTODAY ? 'background:#f8a800;color:#241d0c' : 'background:#f3ece0;color:#7a6f60'),
        openBuyer: () => { if (cl.id) { deskStore.loadClientWorkspace(cl.id); this.setState({ section: 'clients', contactMode: 'clients', selectedClient: cl.id, cpTab: 'overview' }); } },
        openProp: () => { if (S.pr) this.setState({ section: 'properties', propDetail: S.pr.id, propShot: 0, propTab: 'gallery' }); },
        openSeller: () => { if (S.sr) { deskStore.loadSellerWorkspace(S.sr.id); this.setState({ section: 'clients', contactMode: 'sellers', sellerView: S.sr.id, svTab: 'overview' }); } },
        update: () => this.openUpdate(d.id),
        open: () => this.setState({ selectedDeal: d.id, dealTab: 'overview' })
      };
    });

    /* ---------- COMPLETED ledger ---------- */
    const ledgerFilter = s.ledgerFilter || 'all';
    const ledgerBase = dDoneAll.filter(dMatch);
    const ledgerSrc = ledgerFilter === 'due' ? ledgerBase.filter(d => this.dealMoney(d).due > 0) : ledgerBase;
    const ledgerChips = [{ k: 'all', l: 'All completed', n: ledgerBase.length }, { k: 'due', l: 'Commission pending', n: ledgerBase.filter(d => this.dealMoney(d).due > 0).length }]
      .map(c => {
        const on = ledgerFilter === c.k;
        return {
          label: c.l, count: String(c.n), go: () => this.setState({ ledgerFilter: c.k }),
          style: 'display:flex;align-items:center;gap:8px;height:50px;padding:0 18px;border-radius:14px;font-size:16.5px;font-weight:800;white-space:nowrap;' + (on ? (c.k === 'due' ? 'background:#b02a37;color:#fff' : 'background:#241d0c;color:#f8c200') : 'background:#fffdf7;color:#6b6156;box-shadow:inset 0 0 0 1.5px #e6d6b4'),
          num: 'font-size:13.5px;font-weight:800;border-radius:999px;padding:1px 8px;' + (on ? 'background:rgba(255,255,255,.22)' : 'background:#f3ece0;color:#8a7f6e')
        };
      });

    const ledgerRows = ledgerSrc.map(d => {
      const M = this.dealMoney(d), S = sellerNameOf(d);
      return {
        propTitle: d.prop + ' · ' + d.propSub,
        line: d.client + (S.name !== '—' ? ('  ←  ' + S.name) : '') + '  ·  ' + (d.closedOn || ''),
        soldFmt: this.inr(d.value), commFmt: this.inr(M.expected),
        statusLabel: M.fully ? 'Fully settled' : (M.got > 0 ? 'Part paid' : 'Not paid'),
        statusIcon: M.fully ? 'ph-fill ph-check-circle' : 'ph-fill ph-clock-countdown',
        statusStyle: 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:11px;font-size:14.5px;font-weight:800;' + (M.fully ? 'background:#d3f2e0;color:#0a6634' : 'background:#ffdfe2;color:#b02a37'),
        receivedLine: M.fully ? this.inr(M.got) + ' in hand' : (this.inr(M.due) + ' still due'),
        row: 'display:flex;align-items:center;gap:14px;row-gap:10px;flex-wrap:wrap;padding:16px 20px;box-shadow:inset 0 -1.5px 0 #f0e6d4;' + (M.fully ? 'background:#fffdf7' : 'background:#fff8f4'),
        showCollect: M.due > 0,
        collect: (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          const need = M.due, sideS = M.cS - M.gotS;
          if (sideS > 0) this.dealPay(d.id, 'commS', sideS, 'Seller side settled');
          if (need - Math.max(0, sideS) > 0) this.dealPay(d.id, 'commB', need - Math.max(0, sideS), 'Buyer side settled');
        },
        open: () => this.setState({ selectedDeal: d.id, dealTab: 'money' })
      };
    });

    const lostDeals = dLostAll.filter(dMatch).map(d => ({
      client: d.client, propLine: d.prop + ' · ' + d.propSub,
      reason: d.lostReason || 'Not recorded', when: d.lostOn || '',
      open: () => this.setState({ selectedDeal: d.id, dealTab: 'overview' })
    }));

    /* ---------- update sheet ---------- */
    let upVM = null;
    if (s.upFor) {
      const d = this.deals.find(x => x.id === s.upFor); const u = s.upDraft || {};
      if (d) {
        const M = this.dealMoney(d);
        const pillU = (on, c) => 'display:flex;align-items:center;gap:7px;height:46px;padding:0 15px;border-radius:13px;font-size:15.5px;font-weight:800;white-space:nowrap;' + (on ? 'background:' + (c || '#241d0c') + ';color:#f8c200' : 'background:#fffdf7;color:#6b6156;box-shadow:inset 0 0 0 1.5px #e6d6b4');
        const dayPill = (on) => 'height:42px;padding:0 14px;border-radius:12px;font-size:15px;font-weight:800;white-space:nowrap;' + (on ? 'background:#f8a800;color:#241d0c' : 'background:#fffdf7;color:#6b6156;box-shadow:inset 0 0 0 1.5px #e6d6b4');
        upVM = {
          who: d.client, what: d.prop + ' · ' + d.propSub,
          stages: this.DSORDER.concat(['lost']).map(k => {
            const m = this.ds(k); return {
              label: m.l, icon: m.i, go: () => this.setUp({ stage: k }),
              style: (u.stage === k ? 'display:flex;align-items:center;gap:7px;height:46px;padding:0 15px;border-radius:13px;font-size:15.5px;font-weight:800;white-space:nowrap;background:' + m.c + ';color:#fff' : pillU(false))
            };
          }),
          price: u.price || '', onPrice: (e) => this.setUp({ price: e.target.value }),
          priceNow: this.inr(Math.round((parseFloat(u.price) || 0) * 1e7)),
          needToken: u.stage === 'token' || u.stage === 'registry',
          token: u.token || '', onToken: (e) => this.setUp({ token: e.target.value }),
          tokenNote: M.token ? ('Already recorded: ' + this.inr(M.token)) : 'Nothing recorded yet',
          tokenDays: [{ l: 'Today', v: DTODAY }, { l: 'Yesterday', v: DTODAY - 1 }, { l: 'This week', v: DTODAY - 3 }].map(o => ({ label: o.l, go: () => this.setUp({ tokenDay: o.v }), style: dayPill(u.tokenDay === o.v) })),
          needRegistry: u.stage === 'registry',
          regDays: [{ l: 'This week', v: DTODAY + 3 }, { l: 'Next week', v: DTODAY + 8 }, { l: 'End of month', v: 31 }, { l: 'Not fixed', v: 0 }].map(o => ({ label: o.l, go: () => this.setUp({ regDay: o.v }), style: dayPill(u.regDay === o.v) })),
          nextOpts: ['Call buyer', 'Call seller', 'Meeting', 'Site visit', 'Collect token', 'Collect document', 'Registry', 'Payment follow-up', 'Other'].map(k => ({ label: k, icon: this.NEXTICON[k] || 'ph-fill ph-note-pencil', go: () => this.setUp({ nextK: k }), style: pillU(u.nextK === k) })),
          nextDays: [{ l: 'Today', v: DTODAY }, { l: 'Tomorrow', v: DTODAY + 1 }, { l: 'In 3 days', v: DTODAY + 3 }, { l: 'Next week', v: DTODAY + 7 }].map(o => ({ label: o.l, go: () => this.setUp({ nextDay: o.v }), style: dayPill(u.nextDay === o.v) })),
          note: u.note || '', onNote: (e) => this.setUp({ note: e.target.value }),
          hasDue: M.due > 0, dueLine: this.inr(M.due) + ' of ' + this.inr(M.expected) + ' still to come',
          commBtns: [{ l: 'Buyer side ' + this.inr(M.cB - M.gotB), k: 'commB', v: M.cB - M.gotB }, { l: 'Seller side ' + this.inr(M.cS - M.gotS), k: 'commS', v: M.cS - M.gotS }]
            .filter(x => x.v > 0).map(x => ({
              label: x.l, go: () => this.dealPay(d.id, x.k, x.v, 'Recorded while updating'),
              style: 'display:flex;align-items:center;gap:7px;height:46px;padding:0 15px;border-radius:13px;background:#0a6634;color:#fff;font-size:15.5px;font-weight:800;white-space:nowrap'
            })),
          lost: () => this.setState({ upFor: null, dealLostFor: d.id }),
          save: () => this.saveUpdate()
        };
      }
    }
    let dealDetail = null;
    if (s.selectedDeal) {
      const d = this.deals.find(x => x.id === s.selectedDeal); if (d) {
        const M = this.dealMoney(d), st = dsOf(d.stage), fl = this.dealFlags(d);
        const pr = d.propId ? this.properties.find(p => p.id === d.propId) : null;
        const cl = this.clients.find(c => c.id === d.clientId) || this.clients.find(c => c.name === d.client) || {};
        const ps = pr && pr.ps ? pr.ps : null;
        const sellerRec = ps ? this.sellers.find(x => x.id === ps.sellerId) : null;
        const tab = s.dealTab || 'overview';
        const DTABS = [
          {
            k: 'overview', l: 'Overview', i: 'ph-fill ph-squares-four', n: 0,
            activeStyle: 'background:#ffffff;color:#1d4ed8;box-shadow:0 4px 14px rgba(0,0,0,.25);border:none;',
            inactiveStyle: 'background:transparent;color:#eff6ff;border:none;'
          },
          {
            k: 'money', l: 'Money', i: 'ph-fill ph-coins', n: (this.dealMoney(d).due > 0 ? 1 : 0),
            activeStyle: 'background:#ffffff;color:#1d4ed8;box-shadow:0 4px 14px rgba(0,0,0,.25);border:none;',
            inactiveStyle: 'background:transparent;color:#eff6ff;border:none;'
          },
          {
            k: 'papers', l: 'Papers', i: 'ph-fill ph-folder-open', n: (this.dealDocs(d).own.filter(x => x.required && !x.have).length),
            activeStyle: 'background:#ffffff;color:#1d4ed8;box-shadow:0 4px 14px rgba(0,0,0,.25);border:none;',
            inactiveStyle: 'background:transparent;color:#eff6ff;border:none;'
          }
        ];
        const docs = this.dealDocs(d);
        const stIdx = this.DSORDER.indexOf(d.stage === 'enquiry' ? 'negotiating' : d.stage);
        const nextStage = stIdx >= 0 && stIdx < 3 ? this.DSORDER[stIdx + 1] : null;
        const nx = d.next;
        const lk = this.clientLinks.find(l => l.clientId === d.clientId && (l.props || []).includes(d.propId));
        const lkEv = lk ? (lk.events || []).filter(e => e.p === d.propId || !e.p).slice(0, 4) : [];
        const EVM = { view: { t: 'Opened this property', i: 'ph-fill ph-eye', c: '#1a5aa8', b: '#dbeafe' }, open: { t: 'Opened your link', i: 'ph-fill ph-paper-plane-tilt', c: '#4a2c99', b: '#e7defc' }, earth: { t: 'Opened MAPCO Earth', i: 'ph-fill ph-globe-hemisphere-east', c: '#0a6634', b: '#d3f2e0' }, photos: { t: 'Looked at the photos', i: 'ph-fill ph-images', c: '#a3541b', b: '#fff0d6' }, visit: { t: 'Asked for a site visit', i: 'ph-fill ph-footprints', c: '#b02a37', b: '#ffdfe2' }, wa: { t: 'Tapped WhatsApp', i: 'ph-fill ph-whatsapp-logo', c: '#0a6634', b: '#d3f2e0' }, call: { t: 'Tapped call', i: 'ph-fill ph-phone', c: '#0a6634', b: '#d3f2e0' }, voice: { t: 'Played your voice note', i: 'ph-fill ph-microphone', c: '#5b32c4', b: '#e7defc' } };

        const propDocItems = (docs.prop.length > 0 ? docs.prop : [
          { name: 'Title Deed / Registry Copy', kind: 'Registry' },
          { name: 'Fard / Jamabandi Record', kind: 'Fard' },
          { name: 'GMADA / MC Site Plan', kind: 'Site Plan' },
          { name: 'NOC / Tax Clearance Certificate', kind: 'NOC' }
        ]).map(x => ({
          name: x.name,
          sub: 'Verified · Property Record',
          date: 'Recorded on file',
          badge: 'Verified',
          badgeStyle: 'display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:800;border-radius:6px;padding:2px 7px;background:#dbeafe;color:#1e40af;box-shadow:0 0 0 1px #93c5fd;',
          cardStyle: 'display:flex;flex-direction:column;border-radius:18px;overflow:hidden;border:2px solid #3b82f6;background:#ffffff;box-shadow:0 8px 20px -8px rgba(59,130,246,.35);cursor:pointer;text-align:left;transition:transform .15s;',
          bannerStyle: 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:linear-gradient(135deg, #eff6ff, #dbeafe);border-top:1.5px solid #bfdbfe;',
          nameColor: 'color:#1e3a8a',
          go: () => this.setState({
            viewDoc: {
              name: x.name,
              category: 'Property Paper',
              type: 'Official Land & Property Record',
              date: 'August 2026',
              verified: true,
              property: d.prop + ' · ' + d.propSub,
              dealName: d.client + ' — ' + d.name,
              seal: 'MAPCO TITLE VERIFIED · SUB-REGISTRAR'
            }
          })
        }));

        const dealDocItems = docs.own.map(x => ({
          name: x.name,
          sub: x.have ? ('Received ' + (x.when || '21 Aug')) : (x.required ? 'Needed at this stage' : 'Not taken yet'),
          date: x.have ? 'Verified on deal' : 'Pending',
          badge: x.have ? 'Verified' : (x.required ? 'Required' : 'Optional'),
          badgeStyle: 'display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:800;border-radius:6px;padding:2px 7px;' + (x.have ? 'background:#dcfce7;color:#15803d;box-shadow:0 0 0 1px #86efac;' : (x.required ? 'background:#fee2e2;color:#b91c1c;box-shadow:0 0 0 1px #fca5a5;' : 'background:#fef3c7;color:#b45309;box-shadow:0 0 0 1px #fde68a;')),
          cardStyle: 'display:flex;flex-direction:column;border-radius:18px;overflow:hidden;border:2px solid ' + (x.have ? '#10b981' : (x.required ? '#ef4444' : '#f59e0b')) + ';background:#ffffff;box-shadow:0 8px 20px -8px ' + (x.have ? 'rgba(16,185,129,.35)' : 'rgba(239,68,68,.3)') + ';cursor:pointer;text-align:left;transition:transform .15s;',
          bannerStyle: 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:' + (x.have ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : (x.required ? 'linear-gradient(135deg, #fef2f2, #fee2e2)' : 'linear-gradient(135deg, #fffbeb, #fef3c7)')) + ';border-top:1.5px solid ' + (x.have ? '#bbf7d0' : (x.required ? '#fca5a5' : '#fde68a')) + ';',
          nameColor: x.have ? 'color:#065f46' : (x.required ? 'color:#991b1b' : 'color:#92400e'),
          go: () => this.setState({
            viewDoc: {
              name: x.name,
              category: 'Deal Paper',
              type: 'Transaction Legal Instrument',
              date: x.have ? (x.when || '21 Aug') : 'Pending Execution',
              verified: x.have,
              property: d.prop + ' · ' + d.propSub,
              dealName: d.client + ' — ' + d.name,
              seal: x.have ? 'EXECUTED & NOTARIZED · MAPCO DEAL ROOM' : 'DRAFT READY FOR SIGNATURE'
            }
          })
        }));

        dealDetail = {
          id: d.id, initials: this.initialsOf(d.client),
          title: d.client, sub: d.prop + ' · ' + d.propSub + (d.outside ? '  ·  Outside deal' : ''),
          valueFmt: this.inr(d.value), commFmt: this.inr(M.expected),
          stageLabel: st.l, stageIcon: st.i,
          stagePill: 'display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:12px;background:rgba(255,255,255,.2);color:#ffffff;box-shadow:0 0 0 1.5px rgba(255,255,255,.35);font-size:15.5px;font-weight:800;white-space:nowrap',
          headStyle: 'flex:none;padding:16px 24px 14px;background:linear-gradient(135deg, #1d4ed8, #2563eb 55%, #3b82f6);border-bottom:3px solid #60a5fa;box-shadow:0 12px 28px -10px rgba(29,78,216,.6);color:#fff',
          avStyle: 'width:62px;height:62px;border-radius:19px;flex:none;display:grid;place-items:center;font-size:22px;font-weight:800;background:rgba(255,255,255,.25);color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.4)',
          tel: this.tel(cl.phone || ''), wa: this.waLink(cl.phone || ''),
          notClosed: d.stage !== 'closed' && d.stage !== 'lost',
          advanceLabel: nextStage ? ('Move to ' + dsOf(nextStage).l) : 'Mark completed',
          advance: () => this.dealStage(d.id, nextStage || 'closed'),
          markLost: () => this.setState({ dealLostFor: d.id }),
          update: () => this.openUpdate(d.id),
          tabs: DTABS.map(t => {
            const on = tab === t.k; return {
              label: t.l, icon: t.i, go: () => this.setState({ dealTab: t.k }),
              hasBadge: t.n > 0, count: String(t.n),
              badge: 'font-size:12.5px;font-weight:800;border-radius:999px;padding:2px 7px;background:' + (on ? 'rgba(29,78,216,.2)' : '#ffdfe2') + ';color:' + (on ? '#1d4ed8' : '#b02a37'),
              style: 'display:flex;align-items:center;gap:7px;height:40px;padding:0 17px;border-radius:11px;font-size:15.5px;font-weight:800;white-space:nowrap;flex:none;cursor:pointer;transition:all .14s;' + (on ? t.activeStyle : t.inactiveStyle)
            };
          }),
          isOverview: tab === 'overview', isMoney: tab === 'money', isPeople: tab === 'overview', isPapers: tab === 'papers', isTimeline: false,
          updatedAgo: (() => { const l = (d.log || [])[0]; return l ? ('Updated ' + String(l.d).toLowerCase()) : 'No updates yet'; })(),
          pipeline: (() => {
            const LB = ['Negotiating', 'Token / Booked', 'Registry / Closing', 'Completed'];
            const IC = ['ph-fill ph-chats-circle', 'ph-fill ph-hand-coins', 'ph-fill ph-stamp', 'ph-fill ph-seal-check'];
            const lost = d.stage === 'lost';
            return this.DSORDER.map((k, i) => {
              const hist = (d.hist || []).find(x => x.s === k);
              const closed = d.stage === 'closed';
              const done = closed ? i < 3 : (i < stIdx || !!hist && i < stIdx);
              const now = !closed && !lost && i === stIdx;
              const fin = closed && i === 3;
              const col = lost && now ? '#b02a37' : done ? '#0a6634' : now ? '#a3541b' : '#8a7f6e';
              const bg = lost && now ? '#ffdfe2' : done ? '#d3f2e0' : now ? '#f8a800' : '#fff';
              const ring = lost && now ? '#f3c7cc' : done ? '#b3e2c8' : now ? '#e69a00' : '#e0d8cc';
              return {
                label: LB[i], when: (hist && hist.d ? hist.d : (now ? 'Today' : '—')),
                icon: (done || fin ? 'ph-bold ph-check' : (lost && now ? 'ph-bold ph-x' : IC[i])),
                iconBox: 'width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:' + (done || fin ? '#0a6634' : (now ? '#241d0c' : '#f0ece4')) + ';color:' + (done || fin ? '#eafff2' : (now ? '#f8a800' : '#a89e8b')),
                card: 'flex:1;min-width:140px;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px 14px;border-radius:18px;background:' + bg + ';box-shadow:0 0 0 1.5px ' + ring + (now ? ',0 8px 18px -8px rgba(248,168,0,.55)' : '') + ';transition:all .15s;text-align:left',
                labelStyle: 'font-size:15px;font-weight:800;color:' + (now ? '#241d0c' : '#241f1c') + ';margin-top:4px',
                whenStyle: 'font-size:13px;font-weight:700;color:' + (now ? '#6b4300' : '#8a7f6e'),
                linkStyle: i < 3 ? ('flex:none;width:18px;height:3px;align-self:center;background:' + (done ? '#0a6634' : '#e0d8cc') + ';border-radius:2px') : 'display:none',
                go: () => this.dealStage(d.id, k)
              };
            });
          })(),

          steps: this.DSORDER.map((k, i) => {
            const m = dsOf(k); const hist = (d.hist || []).find(x => x.s === k);
            const done = stIdx > i || d.stage === 'closed' && k !== 'closed' || (!!hist && i <= stIdx); const now = stIdx === i && d.stage !== 'closed';
            const doneReal = !!hist;
            return {
              label: m.l, icon: doneReal ? 'ph-fill ph-check-circle' : (now ? m.i : 'ph-bold ph-circle'),
              when: hist ? hist.d : (now ? 'now' : 'not yet'),
              row: 'display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:15px;' + (now ? 'background:' + m.b + ';color:#000' : (doneReal ? 'background:#f1fbf6;color:#0a6634' : 'background:#f7f4ec;color:#a89e8b')),
              dot: 'width:34px;height:34px;border-radius:11px;flex:none;display:grid;place-items:center;' + (now ? 'background:#f8a800;color:#241d0c' : (doneReal ? 'background:#0a6634;color:#fff' : 'background:#e7dfd0;color:#a89e8b'))
            };
          }),

          nextLabel: nx ? nx.k : 'Nothing planned yet', nextNote: nx ? (nx.note || 'No note') : 'Pick what you will do next so it shows on your morning list.',
          nextIcon: nx ? (this.NEXTICON[nx.k] || 'ph-fill ph-note-pencil') : 'ph-fill ph-plus-circle',
          nextWhen: nx ? this.dayLabel(nx.day) : '—',
          nextWhenStyle: 'display:inline-flex;align-items:center;height:34px;padding:0 13px;border-radius:11px;font-size:14.5px;font-weight:800;flex:none;' + (nx && nx.day < DTODAY ? 'background:#ffdfe2;color:#b02a37' : nx && nx.day === DTODAY ? 'background:#f8a800;color:#241d0c' : 'background:rgba(255,255,255,.14);color:#f4e5c4'),
          nextOpts: ['Call buyer', 'Call seller', 'Site visit', 'Collect token', 'Collect document', 'Registry', 'Commission follow-up'].map(k => ({
            label: k, icon: this.NEXTICON[k], go: () => this.dealNext(d.id, { k }),
            style: 'display:flex;align-items:center;gap:7px;height:42px;padding:0 14px;border-radius:12px;font-size:15px;font-weight:800;white-space:nowrap;' + ((nx && nx.k === k) ? 'background:#f8a800;color:#241d0c' : 'background:rgba(255,255,255,.12);color:#f4e5c4')
          })),
          nextDays: [{ l: 'Today', v: DTODAY }, { l: 'Tomorrow', v: DTODAY + 1 }, { l: 'In 3 days', v: DTODAY + 3 }, { l: 'Next week', v: DTODAY + 7 }].map(o => ({
            label: o.l, go: () => this.dealNext(d.id, { day: o.v }),
            style: 'height:40px;padding:0 14px;border-radius:12px;font-size:14.5px;font-weight:800;white-space:nowrap;' + ((nx && nx.day === o.v) ? 'background:#f8c200;color:#241d0c' : 'background:rgba(255,255,255,.1);color:#c9b48a')
          })),

          hasFlags: fl.length > 0, flags: fl.map(f => ({ text: f.t, icon: f.i, style: dFlagPill(f) })),
          hasLinkAct: lkEv.length > 0,
          linkAct: lkEv.map(e => {
            const m = EVM[e.k] || EVM.open;
            return {
              text: m.t, when: this.relT(e.m), icon: m.i,
              iconStyle: 'width:36px;height:36px;border-radius:11px;flex:none;display:grid;place-items:center;background:' + m.b + ';color:' + m.c
            };
          }),
          isLost: d.stage === 'lost',
          lostReason: d.lostReason || 'Stage marked as dropped/lost',
          lostOn: d.lostOn || 'Recently',
          lastStageLabel: dsOf(d.stageBeforeLost || 'negotiating').l,

          commRows: [
            { label: 'Buyer commission (' + (d.cB || 1) + '%)', value: this.inr(M.cB) },
            { label: 'Seller commission (' + (d.cS || 1) + '%)', value: this.inr(M.cS) },
            { label: 'Already received', value: this.inr(M.got) },
            { label: 'Still due', value: this.inr(M.due) }
          ],
          commState: M.fully ? 'Commission fully received' : (M.due > 0 ? (this.inr(M.due) + ' due on registry') : 'No commission entered yet'),
          commStateIcon: M.fully ? 'ph-fill ph-seal-check' : 'ph-fill ph-hourglass-high',
          commStateStyle: 'display:flex;align-items:center;gap:9px;margin-top:16px;padding:13px 15px;border-radius:14px;font-size:16.5px;font-weight:800;' + (M.fully ? 'background:rgba(255,255,255,.2);color:#eafff2' : 'background:#241d0c;color:#f8c200'),
          txRows: [{ label: 'Agreed deal value', value: this.inr(d.value) },
          { label: 'Token received', value: M.token ? this.inr(M.token) : 'Not yet' },
          { label: 'Balance to pay', value: this.inr(M.remaining) },
          { label: 'Seller\'s asking price', value: ps && ps.askPrice ? this.inr(ps.askPrice) : '—' }],
          payAdd: [{ k: 'token', l: 'Token' }, { k: 'commB', l: 'Buyer commission' }, { k: 'commS', l: 'Seller commission' }].map(a => ({
            label: a.l,
            go: () => {
              const amt = a.k === 'token' ? Math.round(d.value * 0.03) : Math.round(d.value * ((a.k === 'commB' ? d.cB : d.cS) || 0) / 100) - (a.k === 'commB' ? M.gotB : M.gotS);
              if (amt > 0) this.dealPay(d.id, a.k, amt, 'Recorded from the deal room');
            },
            style: 'display:flex;align-items:center;gap:6px;height:42px;padding:0 14px;border-radius:12px;background:#241d0c;color:#f8c200;font-size:14.5px;font-weight:800;white-space:nowrap'
          })),
          payRows: (d.pay || []).filter(p => p.k !== 'token').slice().reverse().map(p => {
            const L = {
              buyerPay: { l: 'Buyer payment', i: 'ph-fill ph-currency-inr', c: '#1a5aa8', b: '#dbeafe' },
              commB: { l: 'Your commission — buyer side', i: 'ph-fill ph-hand-coins', c: '#0a6634', b: '#d3f2e0' },
              commS: { l: 'Your commission — seller side', i: 'ph-fill ph-hand-coins', c: '#0a6634', b: '#d3f2e0' }
            }[p.k] || { l: 'Payment', i: 'ph-fill ph-receipt', c: '#a3541b', b: '#fff0d6' };
            return {
              label: L.l, sub: p.d + (p.note ? (' · ' + p.note) : ''), amt: this.inr(p.amt), icon: L.i,
              iconStyle: 'width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;background:' + L.b + ';color:' + L.c
            };
          }),
          noPay: (d.pay || []).filter(p => p.k !== 'token').length === 0,

          people: [
            {
              role: 'Buyer', name: d.client, icon: 'ph-fill ph-user', card: 'border-radius:20px;background:linear-gradient(135deg, #fff9e6, #ffecb3);box-shadow:0 0 0 2px #f8c950, 0 10px 22px -16px rgba(180,110,0,.35);padding:16px 18px',
              iconBox: 'width:42px;height:42px;border-radius:13px;flex:none;display:grid;place-items:center;background:#f5a300;color:#fff',
              kicker: 'font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a3541b',
              rows: [{ icon: 'ph-fill ph-phone', label: 'Phone', value: cl.phone || '—' }, { icon: 'ph-fill ph-map-pin', label: 'Looking in', value: cl.city || '—' }, { icon: 'ph-fill ph-wallet', label: 'Budget', value: cl.budget || '—' }],
              acts: [{ label: 'Call', icon: 'ph-fill ph-phone', go: () => { if (cl.phone) window.location.href = this.tel(cl.phone); }, style: 'display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:12px;background:#0f7a45;color:#fff;font-size:15px;font-weight:800' },
              { label: 'View client', icon: 'ph-fill ph-arrow-up-right', go: () => this.setState({ selectedDeal: null, section: 'clients', contactMode: 'clients', selectedClient: cl.id, cpTab: 'overview' }), style: 'display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:12px;background:#fff;color:#a3541b;box-shadow:0 0 0 1.5px #e0b040;font-size:15px;font-weight:800' }]
            },
            {
              role: 'Seller', name: (sellerRec ? sellerRec.name : (d.seller ? d.seller.name : '—')), icon: 'ph-fill ph-key', card: 'border-radius:20px;background:linear-gradient(135deg, #f5efff, #e3d2ff);box-shadow:0 0 0 2px #b991fa, 0 10px 22px -16px rgba(90,30,200,.35);padding:16px 18px',
              iconBox: 'width:42px;height:42px;border-radius:13px;flex:none;display:grid;place-items:center;background:#693ecc;color:#fff',
              kicker: 'font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#4a2c99',
              rows: [{ icon: 'ph-fill ph-phone', label: 'Phone', value: (sellerRec ? sellerRec.phone : (d.seller ? d.seller.phone : '—')) },
              { icon: 'ph-fill ph-tag', label: 'He asks', value: ps && ps.askPrice ? this.inr(ps.askPrice) : '—' },
              { icon: 'ph-fill ph-user-check', label: 'Role', value: ps ? ps.relation : '—' },
              { icon: 'ph-fill ph-clock', label: 'Last confirmed', value: ps ? ps.lastConfirmed : '—' }],
              acts: [{ label: 'Call', icon: 'ph-fill ph-phone', go: () => { const p = sellerRec ? sellerRec.phone : (d.seller ? d.seller.phone : ''); if (p && p !== '—') window.location.href = this.tel(p); }, style: 'display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:12px;background:#4a2c99;color:#fff;font-size:15px;font-weight:800' },
              { label: 'View seller', icon: 'ph-fill ph-arrow-up-right', go: () => { if (sellerRec) this.setState({ selectedDeal: null, section: 'clients', contactMode: 'sellers', sellerView: sellerRec.id, svTab: 'overview' }); }, style: 'display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:12px;background:#fff;color:#4a2c99;box-shadow:0 0 0 1.5px #bfa3f7;font-size:15px;font-weight:800' }]
            },
            {
              role: 'Property', name: pr ? (pr.type + ' · ' + pr.size) : (d.prop + ' (outside)'), icon: 'ph-fill ph-buildings', card: 'border-radius:20px;background:linear-gradient(135deg, #e8f5ff, #cbe8ff);box-shadow:0 0 0 2px #75beff, 0 10px 22px -16px rgba(0,100,220,.35);padding:16px 18px',
              iconBox: 'width:42px;height:42px;border-radius:13px;flex:none;display:grid;place-items:center;background:#0077d9;color:#fff',
              kicker: 'font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#005ea6',
              rows: [{ icon: 'ph-fill ph-map-pin', label: 'Where', value: d.propSub },
              { icon: 'ph-fill ph-tag', label: 'On your books', value: pr ? this.inr(pr.price) : '—' },
              { icon: 'ph-fill ph-handshake', label: 'This deal', value: this.inr(d.value) }],
              acts: pr ? [{ label: 'Open property', icon: 'ph-fill ph-arrow-up-right', go: () => this.setState({ selectedDeal: null, section: 'properties', propDetail: pr.id, propShot: 0, propTab: 'gallery' }), style: 'display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:12px;background:#0066b8;color:#fff;font-size:15px;font-weight:800' }]
                : [{ label: 'Not in your inventory', icon: 'ph-fill ph-info', go: () => { }, style: 'display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:12px;background:#fff;color:#0066b8;box-shadow:0 0 0 1.5px #80c2f5;font-size:15px;font-weight:800' }]
            }],

          propDocs: propDocItems,
          noPropDocs: false,
          dealDocs: dealDocItems,
          hasViewDoc: !!s.viewDoc,
          viewDoc: s.viewDoc,
          closeViewDoc: () => this.setState({ viewDoc: null }),

          addPropDoc: () => this.setState({ docPick: 'prop' }),
          addDealDoc: () => this.setState({ docPick: 'deal' }),
          pickerOpen: !!s.docPick && tab === 'papers',
          pickerTitle: s.docPick === 'prop' ? 'Add a property paper' : 'Add a deal paper',
          pickerSub: s.docPick === 'prop' ? 'This saves onto the property, so every future deal sees it too.' : 'This stays with this transaction only.',
          pickerClose: () => this.setState({ docPick: null }),
          pickerOpts: (s.docPick === 'prop'
            ? ['Registry', 'Fard / Jamabandi', 'Mutation', 'NOC', 'Allotment Letter', 'Possession Letter', 'Site Plan', 'Tax Receipt']
            : ['Token receipt', 'Agreement to Sell', 'Payment proof', 'Final registry copy', 'Commission receipt', 'Buyer ID proof', 'Seller ID proof'])
            .map(nm => ({
              label: nm, icon: 'ph-fill ph-file-plus',
              go: () => {
                if (s.docPick === 'prop') {
                  if (pr) {
                    pr.docs = pr.docs || []; if (!pr.docs.some(x => (x.name || x.kind) === nm)) pr.docs.push({ name: nm, kind: nm });
                    (d.log = d.log || []).unshift({ d: 'Today', t: nm + ' added to the property papers', i: 'ph-fill ph-file-text', c: '#1a5aa8' });
                  } this.setState({ docPick: null });
                }
                else { this.dealDocToggle(d.id, nm); this.setState({ docPick: null }); }
              },
              style: 'display:flex;align-items:center;gap:8px;height:48px;padding:0 16px;border-radius:13px;' + (s.docPick === 'prop' ? 'background:#e1ecfb;color:#1a5aa8' : 'background:#ede4ff;color:#5b32c4') + ';font-size:16px;font-weight:800;white-space:nowrap'
            })),
          timeline: (d.log || []).map((e, i, arr) => ({
            when: e.d, text: e.t, icon: e.i,
            dot: 'width:44px;height:44px;border-radius:14px;flex:none;display:grid;place-items:center;background:' + e.c + '22;color:' + e.c,
            line: 'flex:1;width:2px;background:' + (i === arr.length - 1 ? 'transparent' : '#ece3d2')
          }))
        };
      }
    }

    const linkFor = s.linkFor;
    const linkList = linkFor ? this.properties.filter(pr => pr.status !== 'sold').map(pr => ({ title: pr.type + ' · ' + pr.size, loc: pr.loc, priceFmt: this.inr(pr.price), imgId: 'plotimg-' + pr.id, photoStyle: `width:52px;height:52px;border-radius:11px;flex:none;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center`, pick: () => this.linkProp(linkFor, pr.id) })) : [];

    // Plots
    const stM = { available: { l: 'Available', c: '#c85a1a', b: '#fbe4d3' }, onhold: { l: 'On hold', c: '#b06f0c', b: '#fbeecb' }, sold: { l: 'Sold', c: '#ffffff', b: '#0a6634' } };
    const propVM = (pr) => {
      const mm = stM[pr.status]; const shs = sharesOf(pr.id); const act = shs.filter(x => x.status === 'active').length;
      const menuStyle = 'display:flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:11px;background:#f3eeff;color:#4c463d;font-size:14px;font-weight:800';
      return {
        title: pr.type, size: pr.size, loc: pr.loc, facing: pr.facing, priceFmt: this.inr(pr.price), gap: pr.gap || '', imgId: 'plotimg-' + pr.id,
        photoStyle: `position:absolute;inset:0;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center`, photoCount: (pr.photoCount || 0) + ' photos',
        pubText: (pr.published !== false && pr.status !== 'sold') ? 'On presentation' : 'Not published',
        pubIcon: (pr.published !== false && pr.status !== 'sold') ? 'ph-fill ph-eye' : 'ph-fill ph-eye-slash',
        pubStyle: `display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;${(pr.published !== false && pr.status !== 'sold') ? 'background:#c9f0d9;color:#0b6f39' : 'background:#ffe6cf;color:#c2622a'}`,
        pubMenuLabel: (pr.published !== false && pr.status !== 'sold') ? 'Take off the map' : 'Publish',
        pubMenuIcon: (pr.published !== false && pr.status !== 'sold') ? 'ph-fill ph-eye-slash' : 'ph-fill ph-eye',
        togglePub: () => { if (pr.published !== false && pr.status !== 'sold') { this.setState({ unpubFor: pr.id, unpubReason: '', cardMenu: null }); } else { this.publish(pr.id); this.setState({ cardMenu: null }); } },
        markSold: () => this.openSold(pr.id),
        editPrice: () => this.setState({ priceEdit: pr.id, priceVal: pr.price ? String(pr.price / 1e7) : '' }),
        mapTagText: pr.ready ? 'On the map' : 'Not on a map yet', mapTagIcon: pr.ready ? 'ph-fill ph-map-pin' : 'ph-fill ph-map-pin-slash',
        mapTagStyle: `display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;${pr.ready ? 'background:#e2f2e6;color:#186c3c' : 'background:#ffe1e6;color:#c2185b'}`,
        hasShares: act > 0, shareText: act === 1 ? '1 live link' : act + ' live links',
        menuOpen: s.cardMenu === pr.id, openMenu: () => this.setState({ cardMenu: s.cardMenu === pr.id ? null : pr.id }),
        openDetail: () => this.setState({ propDetail: pr.id, propShot: 0, pdTab: 'gallery', pdMedia: 'photos', cardMenu: null }),
        openShare: () => this.setState({ linkBuild: 'new', lstep: 2, lSearchQ: '', lSearchQ2: '', lform: { ...this.blankL(), plots: [pr.id] }, cardMenu: null }),
        menuStyle,
        mnEdit: 'display:flex;align-items:center;gap:8px;height:44px;padding:0 15px;border-radius:13px;background:#e1ecfb;color:#1a5aa8;font-size:15.5px;font-weight:800;white-space:nowrap',
        mnShare: 'display:flex;align-items:center;gap:8px;height:44px;padding:0 15px;border-radius:13px;background:#fdf0d4;color:#9a6a00;font-size:15.5px;font-weight:800;white-space:nowrap',
        mnSold: 'display:flex;align-items:center;gap:8px;height:44px;padding:0 15px;border-radius:13px;background:#d7f0e2;color:#0a6634;font-size:15.5px;font-weight:800;white-space:nowrap',
        mnHold: 'display:flex;align-items:center;gap:8px;height:44px;padding:0 15px;border-radius:13px;background:#fde5d3;color:#c0490c;font-size:15.5px;font-weight:800;white-space:nowrap',
        goShares: () => this.setState({ propDetail: pr.id, propShot: 0, cardMenu: null }), closeMenu: () => this.setState({ cardMenu: null }),
        statusLabel: mm.l, statusStyle: `display:inline-flex;padding:5px 12px;border-radius:999px;font-size:12.5px;font-weight:800;background:${mm.b};color:${mm.c}`,
        photoLabel: 'Add ' + pr.type.split(' ')[0].toLowerCase() + ' photo',
        id: pr.id, city: pr.city, locShort: (pr.loc || '').split(',')[0], sizeText: pr.size,
        showAvail: pr.status !== 'sold',
        avail: pr.status === 'available' ? 'Available' : 'Off market',
        availStyle: `display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:800;padding:6px 12px;border-radius:999px;${pr.status === 'available' ? 'background:#d9f5e3;color:#0a6634' : 'background:#ffe6cf;color:#a3541b'}`,
        hasPhoto: (pr.photoCount || 0) > 0, noPhoto: (pr.photoCount || 0) === 0,
        rdLabel: this.RS[this.readinessOf(pr).state].l, rdIcon: this.RS[this.readinessOf(pr).state].i,
        rdStyle: (() => { const r = this.RS[this.readinessOf(pr).state]; return `display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;padding:7px 13px;border-radius:999px;background:${r.b};color:${r.c};box-shadow:inset 0 0 0 1.5px ${r.bd}`; })(),
        edit: () => this.openEdit(pr.id, 1), archive: () => this.archiveProp(pr.id),
        isSoldCard: pr.status === 'sold', notSoldCard: pr.status !== 'sold',
        saleFmt: pr.sale ? this.inr(pr.sale.price) : this.inr(pr.price),
        saleLine: pr.sale ? (() => {
          const d = pr.sale.date || '';
          const rel = ['Today', 'Yesterday', 'This week', 'Last week'].includes(d);
          return 'Sold ' + (rel ? d.toLowerCase() : ('on ' + d)) + ' to ' + pr.sale.buyerName;
        })() : 'Sold',
        saleComm: pr.sale && pr.sale.comm ? this.inr(pr.sale.comm) : '', hasSaleComm: !!(pr.sale && pr.sale.comm),
        hasDealCard: !!pr.dealId, goDealCard: () => { if (pr.dealId) this.setState({ selectedDeal: pr.dealId, section: 'deals', cardMenu: null }); },
        accent: (() => { const g = this.groupOf(pr.type); return g === 'plot' ? '#e8681c' : g === 'comm' ? '#5b32c4' : '#0a6634'; })(),
        accentBar: (() => { const g = this.groupOf(pr.type); const c = g === 'plot' ? '#e8681c' : g === 'comm' ? '#5b32c4' : '#0a6634'; return `height:5px;background:${c}`; })(),
        cardWrap: (() => {
          return 'background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 0 0 1.5px #eadfc9,0 16px 36px -18px rgba(40,24,6,.14);transition:transform .14s,box-shadow .14s;';
        })()
      };
    };
    const cityHas = this.CITIES.filter(c => this.properties.some(pr => pr.city === c));
    const plotCityGrid = [{ k: 'all', l: 'All cities', all: true }, ...this.CITIES.map(c => ({ k: c, l: c }))].map(ch => {
      const on = s.plotCity === ch.k; const cnt = ch.all ? this.properties.length : this.properties.filter(pr => pr.city === ch.k).length;
      return {
        label: ch.l, count: cnt, icon: ch.all ? 'ph-fill ph-squares-four' : (on ? 'ph-fill ph-map-pin' : 'ph ph-map-pin'), iconColor: `color:${on ? '#d95d1e' : '#6b6156'}`,
        go: () => this.setState({ plotCity: ch.k, plotCityOpen: false }),
        style: `display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:12px;text-align:left;transition:background .12s;${on ? 'background:#f7e7d9' : 'background:transparent'}`,
        countStyle: `font-size:12px;font-weight:800;border-radius:999px;padding:2px 8px;${on ? 'background:#e8681c;color:#fff' : 'background:#f3eeff;color:#7d7365'}`
      };
    });
    const inCity = (pr) => s.plotCity === 'all' || pr.city === s.plotCity;
    const invTitle = 'Properties';
    const invSub = 'Every plot, flat, kothi and shop you have to sell — and what is ready to show a customer.';
    const invAddLabel = 'Add a property';
    const pq = (s.propQ || '').toLowerCase().trim();
    const qmatch = (pr) => !pq || ((pr.type + ' ' + pr.loc + ' ' + pr.city + ' ' + pr.size + ' ' + pr.want + ' ' + (pr.society || '')).toLowerCase().includes(pq));
    const tmatch = (pr) => s.fType === 'all' || pr.want === s.fType;
    const pool = this.properties.filter(inCity).filter(qmatch).filter(tmatch);
    const soldView = s.invView === 'sold';
    const allSold = this.properties.filter(pr => pr.status === 'sold'), allLive = this.properties.filter(pr => pr.status !== 'sold');
    const soldPool = pool.filter(pr => pr.status === 'sold'), livePoolAll = pool.filter(pr => pr.status !== 'sold');
    const stateOf = (pr) => this.readinessOf(pr).state;
    const livePool = s.fState === 'all' ? livePoolAll : livePoolAll.filter(pr => stateOf(pr) === s.fState);
    const soldValue = soldPool.reduce((a, pr) => a + pr.price, 0);
    const soldEarn = Math.round(soldValue * 0.015);
    const portfolio = soldView ? soldValue : livePoolAll.reduce((a, pr) => a + pr.price, 0);
    const readyCount = soldView ? soldPool.length : livePoolAll.filter(pr => stateOf(pr) === 'ready').length;
    const liveLinkCount = this.clientLinks.filter(l => l.status === 'active').length + this.shares.filter(x => x.status === 'active').length;
    const needCount = liveLinkCount;
    const opensOf = (pr) => this.clientLinks.filter(l => l.props.includes(pr.id)).reduce((a, l) => a + (l.opens || 0), 0)
      + this.shares.filter(x => x.propId === pr.id && x.opened !== 'not opened yet').length * 2 + (pr.views || 0);
    const qv = s.quickView || 'all';
    let listPool = soldView ? soldPool.slice() : livePool.slice();
    if (!soldView) {
      if (qv === 'hot') listPool = listPool.filter(pr => opensOf(pr) > 0).sort((a, b) => opensOf(b) - opensOf(a));
      else if (qv === 'price') listPool.sort((a, b) => b.price - a.price);
      else if (qv === 'new') listPool = listPool.slice().reverse();
      else if (qv === 'quiet') listPool = listPool.filter(pr => opensOf(pr) === 0);
      else listPool.sort((a, b) => (stateOf(a) === 'draft' ? 1 : 0) - (stateOf(b) === 'draft' ? 1 : 0));
    } else if (qv === 'price') listPool.sort((a, b) => ((b.sale && b.sale.price) || b.price) - ((a.sale && a.sale.price) || a.price));
    const propsReady = listPool.map(propVM);
    const qvTheme: Record<string, { bgOn: string; bgOff: string; fgOn: string; fgOff: string; bdOn: string; bdOff: string; shadowOn: string; shadowOff: string }> = {
      hot: {
        bgOn: 'linear-gradient(135deg,#f97316,#ea580c)',
        bgOff: '#fff7ed',
        fgOn: '#ffffff',
        fgOff: '#c2410c',
        bdOn: '#ea580c',
        bdOff: '#fed7aa',
        shadowOn: '0 10px 20px -8px rgba(234,88,12,.7)',
        shadowOff: '0 3px 8px -4px rgba(194,65,12,.15)'
      },
      price: {
        bgOn: 'linear-gradient(135deg,#10b981,#059669)',
        bgOff: '#ecfdf5',
        fgOn: '#ffffff',
        fgOff: '#047857',
        bdOn: '#059669',
        bdOff: '#a7f3d0',
        shadowOn: '0 10px 20px -8px rgba(5,150,105,.7)',
        shadowOff: '0 3px 8px -4px rgba(4,120,87,.15)'
      },
      new: {
        bgOn: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
        bgOff: '#f5f3ff',
        fgOn: '#ffffff',
        fgOff: '#6d28d9',
        bdOn: '#7c3aed',
        bdOff: '#ddd6fe',
        shadowOn: '0 10px 20px -8px rgba(124,58,237,.7)',
        shadowOff: '0 3px 8px -4px rgba(109,40,217,.15)'
      },
      quiet: {
        bgOn: 'linear-gradient(135deg,#475569,#334155)',
        bgOff: '#f1f5f9',
        fgOn: '#ffffff',
        fgOff: '#334155',
        bdOn: '#334155',
        bdOff: '#cbd5e1',
        shadowOn: '0 10px 20px -8px rgba(51,65,85,.7)',
        shadowOff: '0 3px 8px -4px rgba(51,65,85,.15)'
      }
    };

    const qvDefs = soldView
      ? [{ k: 'price', l: 'Biggest sales', i: 'ph-fill ph-trend-up' }]
      : [{ k: 'hot', l: 'Hot right now', i: 'ph-fill ph-fire' }, { k: 'price', l: 'Highest price', i: 'ph-fill ph-trend-up' }, { k: 'new', l: 'Newest', i: 'ph-fill ph-sparkle' }];
    const quickViews = qvDefs.map(q => {
      const on = qv === q.k;
      const t = qvTheme[q.k] || qvTheme.price;
      return {
        label: q.l, icon: q.i, go: () => this.setState({ quickView: on ? 'all' : q.k }),
        style: `display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border-radius:12px;font-size:15px;font-weight:800;white-space:nowrap;flex:none;transition:all .15s;background:${on ? t.bgOn : 'transparent'};color:${on ? t.fgOn : '#786950'};box-shadow:${on ? t.shadowOn : 'none'};`
      };
    });
    const propsNeedWork = [];
    const plotCityName = s.plotCity === 'all' ? 'any city' : s.plotCity;
    const plotCityLabel = s.plotCity === 'all' ? 'All cities' : s.plotCity;
    const segBase = 'display:flex;align-items:center;gap:9px;height:52px;padding:0 22px;border-radius:14px;font-size:16.5px;font-weight:800;white-space:nowrap;transition:all .18s';
    const segNum = (on) => `font-size:13.5px;font-weight:800;border-radius:999px;padding:2px 9px;${on ? 'background:rgba(0,0,0,.16)' : 'background:rgba(0,0,0,.07)'}`;
    const fTypeDefs = [{ k: 'all', l: 'All types' }, { k: 'Plot', l: 'Plots' }, { k: 'Flat', l: 'Flats & floors' }, { k: 'Kothi', l: 'Kothis' }, { k: 'Villa', l: 'Villas' }, { k: 'Commercial', l: 'Commercial' }];
    const fStateDefs = [{ k: 'all', l: 'Any state' }, { k: 'ready', l: 'Ready to show' }, { k: 'draft', l: 'Draft' }];
    const chipF = (on) => `display:flex;align-items:center;justify-content:space-between;gap:10px;height:50px;padding:0 16px;border-radius:13px;font-size:15.5px;font-weight:800;text-align:left;transition:all .15s;${on ? 'background:#e8681c;color:#fff' : 'background:#fff;color:#4c463d;box-shadow:inset 0 0 0 1.5px #e8dcc4'}`;
    const invFilterCount = (s.plotCity !== 'all' ? 1 : 0) + (s.fType !== 'all' ? 1 : 0) + (s.fState !== 'all' ? 1 : 0);
    const invFilterChips = [
      ...(s.plotCity !== 'all' ? [{ label: s.plotCity, clear: () => this.setState({ plotCity: 'all' }) }] : []),
      ...(s.fType !== 'all' ? [{ label: (fTypeDefs.find(x => x.k === s.fType) || {}).l, clear: () => this.setState({ fType: 'all' }) }] : []),
      ...(s.fState !== 'all' ? [{ label: (fStateDefs.find(x => x.k === s.fState) || {}).l, clear: () => this.setState({ fState: 'all' }) }] : [])
    ].map(c => ({ ...c, style: 'display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 8px 0 15px;border-radius:999px;background:#fbe4d3;color:#a33417;font-size:14.5px;font-weight:800' }));

    // Clients
    const clientVM = (c) => ({
      id: c.id, name: c.name, firstName: c.name.split(' ')[0], phone: c.phone, tel: this.tel(c.phone), city: c.city, budget: c.budget, want: c.want, seen: c.seen, note: c.note, viewed: c.viewed || [],
      initials: this.initialsOf(c.name), isNew: this.newClients.includes(c.id), photoId: 'client-photo-' + c.id,
      dealCount: this.deals.filter(d => d.client === c.name).length,
      statusLabel: cstMeta[c.status].l, statusStyle: `display:inline-flex;padding:5px 12px;border-radius:999px;font-size:12.5px;font-weight:800;background:${cstMeta[c.status].b};color:${cstMeta[c.status].c}`,
      open: () => { deskStore.loadClientWorkspace(c.id); this.setState({ selectedClient: c.id }); }, stop: (e) => e.stopPropagation()
    });
    const filterDefs = [{ k: 'all', l: 'Everyone' }, { k: 'active', l: 'Hot' }, { k: 'warm', l: 'Warm' }, { k: 'cold', l: 'Cold' }, { k: 'closed', l: 'Done' }];
    const clientFilterChips = filterDefs.map(fd => {
      const on = s.clientFilter === fd.k; const cnt = fd.k === 'all' ? this.clients.length : this.clients.filter(c => c.status === fd.k).length;
      return {
        label: fd.l, count: cnt, go: () => this.setState({ clientFilter: fd.k }),
        style: `display:inline-flex;align-items:center;gap:8px;padding:9px 15px;border-radius:999px;font-size:13.5px;font-weight:700;white-space:nowrap;flex:none;transition:all .15s;${on ? 'background:#f8a800;color:#1f1a12' : 'background:#f3eeff;color:#6b6156'}`,
        countStyle: `font-size:12px;font-weight:800;border-radius:999px;padding:1px 7px;${on ? 'background:rgba(255,255,255,.26);color:#fff' : 'background:#eed9a8;color:#7d7365'}`
      };
    });
    const cq = (s.clientSearch || '').toLowerCase();
    const clientItems = this.clients
      .filter(c => s.clientFilter === 'all' || c.status === s.clientFilter)
      .filter(c => !cq || (c.name + ' ' + c.city + ' ' + c.want + ' ' + c.budget).toLowerCase().includes(cq)).map(clientVM);
    let clientDetail = null;
    if (s.selectedClient) {
      const c = this.clients.find(x => x.id === s.selectedClient); if (c) {
        const vm = clientVM(c);
        vm.chips = (c.viewed || []).map(v => ({ label: v, style: 'font-size:13px;font-weight:600;color:#4c463d;background:#f7e7c6;border:1px solid #e6ded0;border-radius:9px;padding:6px 12px' }));
        vm.hasChips = (c.viewed || []).length > 0;
        const iv = (c.interest || []).map(pid => this.properties.find(pr => pr.id === pid)).filter(Boolean).map(pr => ({ title: pr.type + ' · ' + pr.size, loc: pr.loc, priceFmt: this.inr(pr.price) }));
        vm.interest = iv; vm.hasInterest = iv.length > 0;
        const dl = this.deals.filter(d => d.client === c.name).map(d => { const mt = this.stageMeta(d.stage); return { name: d.name || d.prop, propSub: d.propSub, valueFmt: this.inr(d.value), commFmt: d.comm ? this.inr(d.comm) : '—', docText: this.docsFor(d).length + ' papers', stageLabel: mt.label, pill: `display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:13px;font-weight:700;background:${mt.bg};color:${mt.color}`, dot: `width:7px;height:7px;border-radius:50%;background:${mt.color}`, open: () => this.setState({ selectedClient: null, selectedDeal: d.id, dealEdit: false, section: 'deals', delArm: false }) }; });
        vm.deals = dl; vm.hasDeals = dl.length > 0; vm.noDeals = dl.length === 0;
        vm.dealValue = this.inr(this.deals.filter(d => d.client === c.name).reduce((a, d) => a + d.value, 0));
        vm.wa = this.waLink(c.phone);
        const CK = { audio: { l: 'Played your voice note', i: 'ph-fill ph-waveform' }, called: { l: 'Tapped call', i: 'ph-fill ph-phone-call' }, wa: { l: 'Messaged on WhatsApp', i: 'ph-fill ph-whatsapp-logo' }, visit: { l: 'Asked for a site visit', i: 'ph-fill ph-footprints' } };
        const clickStyle = 'display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#5b32c4;background:#efe8fb;border-radius:9px;padding:5px 10px';
        const linkClicks = (l) => {
          const out = [];
          if (l.audio && l.played) out.push({ label: CK.audio.l, icon: CK.audio.i, style: clickStyle });
          if (l.called) out.push({ label: CK.called.l, icon: CK.called.i, style: clickStyle });
          if (l.wa) out.push({ label: CK.wa.l, icon: CK.wa.i, style: clickStyle });
          if (l.visit) out.push({ label: CK.visit.l, icon: CK.visit.i, style: clickStyle });
          if (!out.length) out.push({ label: 'Opened, tapped nothing yet', icon: 'ph-fill ph-eye', style: 'display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#8d8271;background:#f3eeff;border-radius:9px;padding:5px 10px' });
          return out;
        };
        const ll = this.clientLinks.filter(l => l.client === c.name).map(l => {
          const names = l.props.map(pid => { const pr = this.properties.find(x => x.id === pid); return pr ? pr.type + ' · ' + pr.size : pid; });
          return {
            title: names.length > 1 ? (names.length + ' properties') : (names[0] || '—'),
            meta: (l.status === 'active' ? 'Live · ' : 'Stopped · ') + (l.opens === 1 ? '1 open' : l.opens + ' opens'),
            dotStyle: 'width:10px;height:10px;border-radius:50%;flex:none;background:' + (l.status === 'active' ? '#12a150' : '#c2185b'),
            clicks: linkClicks(l)
          };
        });
        vm.links = ll; vm.hasLinks = ll.length > 0;
        vm.sent = ll.map(l => ({ ...l, plain: l.meta.replace('Live · ', 'You sent it · ').replace('Stopped · ', 'You stopped it · ').replace(' opens', ' times he opened it').replace('1 times he opened it', 'once') }));
        vm.hasSent = ll.length > 0;
        vm.linkCount = ll.length; vm.openCount = this.clientLinks.filter(l => l.client === c.name).reduce((a, l) => a + (l.opens || 0), 0);
        vm.shownCount = (c.interest || []).length;
        vm.pitchLine = (() => {
          const n = (c.interest || []).length; if (!n) return 'You have not shown him any property yet.';
          return 'You have shown him ' + n + (n === 1 ? ' property' : ' properties') + '. Nothing is written down as a deal yet.';
        })();
        vm.startDeal = () => this.setState({ selectedClient: null, addOpen: true, wiz: { ...this.blankWiz(), step: 2, clientId: c.id } });
        vm.sendAll = () => this.setState({ selectedClient: null, linkBuild: 'new', lstep: 1, lSearchQ: '', lSearchQ2: '', lform: { ...this.blankL(), clientId: c.id } });
        const cap = (c.budgetMax || 0) * 1.12;
        const mtch = this.properties.filter(pr => pr.status !== 'sold').filter(pr => !cap || pr.price <= cap)
          .filter(pr => c.want === 'Plot' ? pr.want === 'Plot' : (pr.want === c.want || pr.want === 'Plot'))
          .sort((a, b) => b.price - a.price).slice(0, 4)
          .map(pr => ({
            title: pr.type + ' · ' + pr.size, loc: pr.loc, priceFmt: this.inr(pr.price),
            thumbStyle: "width:56px;height:56px;border-radius:12px;flex:none;background-image:url('" + this.plotPhoto(pr, 0) + "');background-size:cover;background-position:center",
            fit: pr.city === c.city ? 'Their city' : (pr.want === c.want ? 'Their type' : 'In budget'),
            fitStyle: 'font-size:11.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#0b6f39;background:#d9f5e3;border-radius:8px;padding:3px 8px',
            send: () => this.setState({ selectedClient: null, linkBuild: 'new', lstep: 3, lSearchQ: '', lSearchQ2: '', lform: { ...this.blankL(), plots: [pr.id], clientId: c.id } })
          }));
        vm.matches = mtch; vm.hasMatches = mtch.length > 0; vm.noMatches = mtch.length === 0; vm.matchCount = mtch.length + ' from your list';
        vm.delArm = s.delClient; vm.delIdle = !s.delClient; vm.arm = () => this.setState({ delClient: true }); vm.disarm = () => this.setState({ delClient: false }); vm.doDelete = () => this.deleteClient(c.id);
        clientDetail = vm;
      }
    }

    const wantChips = this.WANTS.map(w => ({
      label: w, go: () => this.setState({ cform: { ...s.cform, want: w } }),
      style: `padding:11px 18px;border-radius:12px;font-size:15px;font-weight:700;transition:all .15s;${s.cform.want === w ? 'background:#f8a800;color:#1f1a12' : 'background:#f3eeff;color:#4c463d'}`
    }));
    const unitChips = ['Cr', 'Lakh'].map(u => {
      const uu = u === 'Lakh' ? 'L' : 'Cr'; return {
        label: u, go: () => this.setState({ cform: { ...s.cform, unit: uu } }),
        style: `padding:9px 14px;border-radius:9px;font-size:14px;font-weight:800;transition:all .15s;${s.cform.unit === uu ? 'background:#fff;color:#d95d1e;box-shadow:0 1px 3px rgba(0,0,0,.12)' : 'background:transparent;color:#7d7365'}`
      };
    });
    const propOptions = this.properties.filter(pr => pr.status !== 'sold').map(pr => ({ id: pr.id, label: pr.type + ' · ' + pr.loc + ' · ' + this.inr(pr.price) }));
    // Add-a-deal wizard
    const wz = s.wiz; const wstep = wz.step;
    const STEPNAME = { 1: 'The buyer', 2: 'The property', 3: 'Money & stage' };
    const STEPTITLE = { 1: 'Who is buying?', 2: 'Which property is it?', 3: 'The money side' };
    const selC = wz.clientId ? this.clients.find(c => c.id === wz.clientId) : null;
    const selP = wz.propId ? this.properties.find(pr => pr.id === wz.propId) : null;
    const buyerName = wz.useNewClient ? ((wz.ncName || '').trim() || 'New customer') : (selC ? selC.name : '');
    const propName = wz.useManualProp ? (((wz.mpLoc || '').trim() || 'Typed property') + ((wz.mpSize || '').trim() ? ' · ' + wz.mpSize : '')) : (selP ? selP.type + ' · ' + selP.loc : '');
    const chipBase = 'display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:800;background:rgba(255,255,255,.62);color:#241d0c';
    const wizChips = [];
    if (buyerName) wizChips.push({ label: buyerName, icon: 'ph-fill ph-user', style: chipBase });
    if (propName) wizChips.push({ label: propName, icon: 'ph-fill ph-map-pin-area', style: chipBase });
    const wizBars = [1, 2, 3].map(k => ({ style: `flex:1;height:5px;border-radius:999px;background:${k <= wstep ? '#241d0c' : 'rgba(0,0,0,.13)'}` }));
    const rowBase = (on) => `width:100%;display:flex;align-items:center;gap:13px;padding:13px 15px;border-radius:15px;border:2px solid ${on ? '#6b3fd4' : '#d5c5f2'};background:${on ? '#e2d6ff' : '#f2ecff'};cursor:pointer;transition:border-color .12s`;
    const checkOf = (on) => ({ checkStyle: `width:24px;height:24px;border-radius:8px;flex:none;display:grid;place-items:center;${on ? 'background:#12a150;color:#fff' : 'background:#fff;color:#b3a689'}`, checkIcon: on ? 'ph-bold ph-check' : 'ph-bold ph-plus' });
    const q1 = (wz.q1 || '').toLowerCase();
    const wizClients = this.clients.filter(c => !q1 || (c.name + ' ' + c.city + ' ' + c.want + ' ' + c.budget).toLowerCase().includes(q1)).map(c => {
      const on = !wz.useNewClient && wz.clientId === c.id;
      return {
        name: c.name, initials: this.initialsOf(c.name), city: c.city, want: c.want, budget: c.budget, style: rowBase(on),
        avStyle: `width:42px;height:42px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:14px;font-weight:800;${on ? 'background:#6b3fd4;color:#fff' : 'background:#f0e3c6;color:#a8792a'}`,
        ...checkOf(on), go: () => this.pickWizClient(c.id)
      };
    });
    const q2 = (wz.q2 || '').toLowerCase();
    const wizProps = this.properties.filter(pr => pr.status !== 'sold').filter(pr => !q2 || (pr.type + ' ' + pr.loc + ' ' + pr.size + ' ' + pr.city).toLowerCase().includes(q2)).map(pr => {
      const on = !wz.useManualProp && wz.propId === pr.id;
      return {
        title: pr.type + ' · ' + pr.size, loc: pr.loc, priceFmt: this.inr(pr.price), icon: this.propIcon(pr.type), style: rowBase(on),
        tileStyle: `width:42px;height:42px;border-radius:12px;flex:none;display:grid;place-items:center;${on ? 'background:#6b3fd4;color:#fff' : 'background:#f7ecd4;color:#a8792a'}`,
        ...checkOf(on), go: () => this.pickWizProp(pr.id)
      };
    });
    const s1ok = !!(wz.useNewClient ? (wz.ncName || '').trim() : wz.clientId);
    const s2ok = !!(wz.useManualProp ? (wz.mpLoc || '').trim() : wz.propId);
    const canNext = wstep === 1 ? s1ok : s2ok;
    const wizStageChips = this.STAGES.filter(st => st.key !== 'lost').map(st => ({
      label: st.label, go: () => this.setWiz({ stage: st.key }),
      style: `padding:11px 18px;border-radius:12px;font-size:15px;font-weight:700;transition:all .15s;${wz.stage === st.key ? 'background:#f8a800;color:#241d0c' : 'background:#f3eeff;color:#4c463d'}`
    }));
    const cPicked = s.cform.plots || [];
    const cPlotPicks = this.properties.filter(pr => pr.status !== 'sold').map(pr => {
      const on = cPicked.includes(pr.id);
      return {
        title: pr.type + ' · ' + pr.size, loc: pr.loc, priceFmt: this.inr(pr.price),
        style: `display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:13px;border:1.5px solid ${on ? '#12a150' : '#e4dbf7'};background:${on ? '#d9f5e3' : '#faf7ff'};cursor:pointer;width:100%`,
        checkStyle: `width:22px;height:22px;border-radius:7px;flex:none;display:grid;place-items:center;${on ? 'background:#12a150;color:#fff' : 'background:#f3eeff;color:#b3a689'}`,
        checkIcon: on ? 'ph-bold ph-check' : 'ph-bold ph-plus', go: () => this.toggleCPlot(pr.id)
      };
    });

    // Home — areas shown vs stock
    const showEntries = Object.entries(this.SHOWS).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxShow = showEntries[0][1];
    const GAPC = ['#f4ae14', '#6b3fd4', '#186c3c', '#c2622a', '#c2185b'];
    const gapRows = showEntries.map(([city, shows], i) => {
      const stock = this.properties.filter(pr => pr.city === city && pr.status !== 'sold').length;
      const thin = stock <= 2; const col = GAPC[i];
      return {
        rank: i + 1, city, showsText: (shows === 1 ? '1 presentation' : shows + ' presentations'), stockText: (stock === 1 ? '1 plot in stock' : stock + ' plots in stock'),
        rowStyle: 'width:100%;display:flex;align-items:center;gap:14px;padding:11px 13px;border-radius:15px;background:#fffaf0;border:2px solid #e4dbf7;cursor:pointer;transition:border-color .15s',
        rankStyle: `width:26px;height:26px;border-radius:8px;flex:none;display:grid;place-items:center;font-size:12.5px;font-weight:800;background:${col};color:#fff`,
        barStyle: `display:block;height:100%;width:${Math.max(16, Math.round(shows / maxShow * 100))}%;background:${col};border-radius:8px;transform-origin:left;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both`,
        chip: thin ? 'Source more here' : 'Stock is fine', chipStyle: `display:inline-block;text-align:center;flex:none;white-space:nowrap;font-size:12.5px;font-weight:800;padding:6px 12px;border-radius:999px;${thin ? 'background:#ffe1e6;color:#c2185b' : 'background:#e2f2e6;color:#186c3c'}`,
        go: () => this.setState({ section: 'properties', plotCity: city, plotCityOpen: false })
      };
    });

    // Client Links
    const LST = { active: { l: 'Live', c: '#146c3a', b: '#e2f2e6' }, expired: { l: 'Expired', c: '#8a7a52', b: '#f3eeff' }, revoked: { l: 'Stopped', c: '#c2185b', b: '#ffe1e6' } };
    const linkCards = this.clientLinks.map(l => {
      const st = LST[l.status]; const props = l.props.map(pid => this.properties.find(pr => pr.id === pid)).filter(Boolean);
      const ev = (on) => `display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;padding:5px 11px;border-radius:999px;${on ? 'background:#e2f2e6;color:#146c3a' : 'background:#f3eeff;color:#a3936a'}`;
      return {
        client: l.client, initials: this.initialsOf(l.client), sub: 'Sent ' + l.created + ' · ' + (l.status === 'active' ? ('expires ' + l.expires) : (l.status === 'expired' ? 'expired' : 'stopped by you')),
        statusLabel: st.l, statusStyle: `display:inline-flex;font-size:12.5px;font-weight:800;padding:6px 13px;border-radius:999px;background:${st.b};color:${st.c}`,
        opens: l.opens, opensText: l.opens === 1 ? '1 open' : l.opens + ' opens', lastOpen: l.lastOpen,
        plotsText: props.length === 1 ? props[0].type + ' · ' + props[0].loc : props.length + ' plots in this link',
        chips: props.slice(0, 4).map(pr => ({ label: pr.type.split(' ')[0] + ' · ' + pr.loc.split(', ')[0], style: 'display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#4c463d;background:#fff3d1;border-radius:9px;padding:6px 11px' })),
        audioStyle: ev(l.audio), audioText: l.audio ? 'Voice note attached' : 'No voice note',
        e1: ev(l.played), e2: ev(l.called), e3: ev(l.wa), e4: ev(l.visit),
        canStop: l.status === 'active',
        cardStyle: 'background:#faf7ff;border:1.5px solid #e4dbf7;border-radius:22px;padding:22px 24px;box-shadow:0 1px 2px rgba(30,28,22,.03),0 16px 38px -30px rgba(30,28,22,.7)',
        preview: () => this.setState({ mobileFor: l.props[0], mobileLink: l.id }),
        stop: () => this.revokeLink(l.id), del: () => this.deleteLink(l.id)
      };
    });
    const liveLinks = this.clientLinks.filter(l => l.status === 'active').length;
    const totalOpens = this.clientLinks.reduce((a, l) => a + l.opens, 0);

    // Property detail
    const pd = s.propDetail ? this.properties.find(pr => pr.id === s.propDetail) : null;
    const propDetail = pd ? (() => {
      const shot = s.propShot % 6; const sheet = this.PROPMAP[pd.id];
      const inLinks = this.clientLinks.filter(l => l.props.includes(pd.id));
      const rd = this.readinessOf(pd); const rr = this.RS[rd.state];
      const OV = this.buildPropertyOverview(pd);
      /* `facts` and `hls` are read further down but were never declared —
         the 4-level Overview redesign removed the definitions and left the
         references, so every property detail threw inside renderVals() and
         the try/catch discarded EVERY computed prop for that render. Both
         are rebuilt from recorded values only: a fact the dealer never
         entered is omitted rather than invented. */
      const hls = pd.highlights || [];
      const facts = [
        ...(pd.size ? [{ i: 'ph-fill ph-ruler', l: pd.size }] : []),
        ...(pd.facing && pd.facing !== '—' ? [{ i: 'ph-fill ph-compass', l: pd.facing + ' facing' }] : []),
        ...(pd.road ? [{ i: 'ph-fill ph-road-horizon', l: pd.road + ' ft road' }] : []),
      ];
      const merged = {};
      const bump = (name, o) => {
        const m = merged[name] || (merged[name] = { name, opens: 0, last: '', status: 'expired', audio: false, called: false, wa: false, visit: false, ids: [] });
        m.opens += o.opens || 0; if (o.last && o.last !== 'not opened yet' && !m.last) m.last = o.last;
        if (o.status === 'active') m.status = 'active'; else if (m.status !== 'active' && o.status === 'revoked') m.status = 'revoked';
        m.audio = m.audio || o.audio; m.called = m.called || o.called; m.wa = m.wa || o.wa; m.visit = m.visit || o.visit; if (o.linkId) m.ids.push(o.linkId);
      };
      inLinks.forEach(l => bump(l.client, { opens: l.opens, last: l.lastOpen, status: l.status, audio: l.audio && l.played, called: l.called, wa: l.wa, visit: l.visit, linkId: l.id }));
      this.shares.filter(x => x.propId === pd.id).forEach(sh => bump(sh.client, { opens: sh.opens || 0, last: sh.opened, status: sh.status, audio: sh.audio && sh.played, called: sh.called, wa: sh.wa, visit: sh.visit }));
      const shareRows = Object.values(merged).map(m => {
        const cc = this.clients.find(c => c.name === m.name);
        const tag = (on, l, i) => ({ label: l, icon: i, style: `display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:800;padding:6px 11px;border-radius:999px;${on ? 'background:#e2f2e6;color:#146c3a' : 'background:#f4ecdd;color:#a3936a'}`, show: on });
        const acts = [tag(m.audio, 'Played your voice note', 'ph-fill ph-waveform'), tag(m.called, 'Tapped call', 'ph-fill ph-phone-call'), tag(m.wa, 'Messaged on WhatsApp', 'ph-fill ph-whatsapp-logo'), tag(m.visit, 'Asked for a site visit', 'ph-fill ph-footprints')].filter(t => t.show);
        return {
          name: m.name, initials: this.initialsOf(m.name),
          opensText: m.opens === 0 ? 'Not opened yet' : (m.opens === 1 ? '1 open' : m.opens + ' opens'),
          lastText: m.last ? ('Last opened ' + m.last) : 'No opens recorded',
          isLive: m.status === 'active', liveLabel: m.status === 'active' ? 'Live' : (m.status === 'revoked' ? 'Stopped' : 'Expired'),
          liveStyle: `display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:800;padding:6px 12px;border-radius:999px;${m.status === 'active' ? 'background:#d9f5e3;color:#0a6634' : 'background:#f4ecdd;color:#8a7a52'}`,
          acts, hasActs: acts.length > 0,
          open: () => { if (cc) this.setState({ propDetail: null, selectedClient: cc.id, section: 'clients', delClient: false }); }
        };
      });
      const totalOpens = Object.values(merged).reduce((a, m) => a + m.opens, 0);
      const activeLinks = inLinks.filter(l => l.status === 'active').length + this.shares.filter(x => x.propId === pd.id && x.status === 'active').length;
      const mk = this.MKT[pd.id] || null;
      const mkStatStyle = 'display:flex;flex-direction:column;gap:3px;padding:14px 16px;border-radius:15px;background:rgba(255,255,255,.1)';
      const perfStyle = 'display:flex;flex-direction:column;gap:3px;padding:16px 18px;border-radius:16px;background:#f7efdf';
      const sl = this.sellerOf(pd); const ps = pd.ps || {};
      const sale = pd.sale || null;
      const mkPub = mk ? mk.published : 0;
      const lastAct = (() => { const r = shareRows.find(x => x.lastText && x.lastText !== 'No opens recorded'); return r ? r.lastText.replace('Last opened ', '') + '' : '—'; })();
      const actStyle = 'display:flex;flex-direction:column;gap:3px;padding:14px 16px;border-radius:15px;background:#f6f3ec;box-shadow:inset 0 0 0 1.5px #e2dbcc';
      const recentAct = [];
      shareRows.forEach(r => { if (r.opens === 0) return; });
      Object.values(merged).forEach(m => {
        if (m.opens > 1) recentAct.push({ text: m.name + ' opened this ' + m.opens + ' times', icon: 'ph-fill ph-cursor-click', when: m.last || '' });
        else if (m.opens === 1) recentAct.push({ text: m.name + ' opened this once', icon: 'ph-fill ph-cursor-click', when: m.last || '' });
        if (m.visit) recentAct.push({ text: m.name + ' asked for a site visit', icon: 'ph-fill ph-footprints', when: '' });
        if (m.called) recentAct.push({ text: m.name + ' tapped your number', icon: 'ph-fill ph-phone-call', when: '' });
      });
      const pdTab = s.pdTab || 'gallery';
      const med = s.pdMedia || 'photos';
      const isSold = pd.status === 'sold';
      const PDT = [
        { k: 'gallery', l: 'Gallery', i: 'ph-fill ph-images', c: '#a3541b', b: '#fbeee0', r: '#e8cdae', sub: (pd.photoCount || 0) + ' photos · 2 maps' },
        { k: 'overview', l: 'Overview', i: 'ph-fill ph-info', c: '#9a6a00', b: '#fdf0d4', r: '#f0d493', sub: 'All the details' },
        { k: 'seller', l: 'Seller', i: 'ph-fill ph-user-circle', c: '#4a2c99', b: '#ebe3fa', r: '#d5c5f2', sub: sl ? sl.name.split(' ')[0] + ' · private' : 'Not saved' },
        { k: 'papers', l: 'Documents', i: 'ph-fill ph-folder-open', c: '#0f5f7a', b: '#dff0f6', r: '#c9e2ec', sub: ((pd.docs || []).length || 'No') + ' on file' },
        { k: 'clients', l: 'Site visits', i: 'ph-fill ph-users-three', c: '#1a5aa8', b: '#e1ecfb', r: '#c0d7f4', sub: (shareRows.length || 'No') + ' customers' },
        { k: 'mkt', l: 'Marketing', i: 'ph-fill ph-megaphone', c: '#c0490c', b: '#fde5d3', r: '#f5c9a0', sub: mk ? (mk.published + ' published') : 'Nothing yet' }
      ];
      const pdTabs = PDT.map(t => {
        const on = pdTab === t.k; return {
          label: t.l, icon: t.i, sub: t.sub, go: () => this.setState({ pdTab: t.k, cardMenu: null }),
          style: `display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border-radius:14px;font-size:15.5px;font-weight:800;white-space:nowrap;flex:none;transition:all .16s;${on ? 'background:#241d0c;color:#f8c200;box-shadow:0 8px 18px -8px rgba(36,29,12,.9)' : 'background:transparent;color:#786950;'}`,
          subStyle: `font-size:13.5px;font-weight:700;${on ? 'color:rgba(255,255,255,.82)' : 'opacity:.72'}`
        };
      });
      return {
        title: pd.type, size: pd.size, loc: pd.loc, city: pd.city, facing: pd.facing, priceFmt: this.inr(pd.price),
        id: pd.id,
        tabs: pdTabs, isGallery: pdTab === 'gallery', isOverview: pdTab === 'overview', isSellerTab: pdTab === 'seller', isPapersTab: pdTab === 'papers', isClientsTab: pdTab === 'clients', isMktTab: pdTab === 'mkt',
        locShort: (pd.loc || '').split(',')[0],
        shotLabel: (shot + 1) + ' of 6',
        prevShot: () => this.setState({ propShot: (s.propShot + 5) % 6 }),
        nextShot: () => this.setState({ propShot: (s.propShot + 1) % 6 }),
        mediaIsPhotos: med === 'photos', mediaIsEarth: med === 'earth', mediaIsMap: med === 'map',
        mediaStyle: `position:absolute;inset:0;background-size:cover;background-position:center;background-image:url('${med === 'earth' ? '/assets/earth-sat.png' : med === 'map' ? '/assets/newchandigarh-map.png' : this.plotPhoto(pd, shot)}')`,
        mediaTabs: [{ k: 'photos', l: 'Photos', i: 'ph-fill ph-image' }, { k: 'earth', l: 'Satellite view', i: 'ph-fill ph-globe-hemisphere-east' }, { k: 'map', l: 'Sector map', i: 'ph-fill ph-map-trifold' }]
          .map(m => ({
            label: m.l, icon: m.i, go: () => this.setState({ pdMedia: m.k }),
            style: `width:48px;height:48px;border-radius:12px;display:grid;place-items:center;transition:all .14s;${med === m.k ? 'background:#f8a800;color:#241d0c' : 'background:rgba(255,255,255,.12);color:#f3e6c8'}`
          })),
        missCount: (() => { const k = rd.miss.length; return k === 1 ? '1 thing left' : k + ' things left'; })(),
        moneyFacts: (() => {
          const o = [{ l: 'You are asking', v: this.inr(pd.price), i: 'ph-fill ph-tag' }];
          const sy = parseFloat(String(pd.size || '').replace(/[^0-9.]/g, ''));
          if (sy && pd.price) o.push({ l: 'Rate', v: this.inr(Math.round(pd.price / sy)) + ' per ' + (String(pd.size).includes('ft') ? 'sq ft' : 'sq yd'), i: 'ph-fill ph-ruler' });
          o.push({ l: 'Price', v: pd.negotiable !== false ? 'Negotiable' : 'Fixed', i: 'ph-fill ph-handshake' });
          if (ps.askPrice) o.push({ l: 'Seller wants', v: this.inr(ps.askPrice), i: 'ph-fill ph-user-circle' });
          if (ps.askPrice && pd.price) o.push({ l: 'Your margin', v: this.inr(Math.max(0, pd.price - ps.askPrice)), i: 'ph-fill ph-coins' });
          o.push({ l: 'Title', v: pd.registry || 'Not recorded', i: 'ph-fill ph-seal-check' });
          o.push({ l: 'Approvals', v: pd.approval || 'Not recorded', i: 'ph-fill ph-certificate' });
          o.push({ l: 'Papers on file', v: ((pd.docs || []).length || 'No') + ' documents', i: 'ph-fill ph-folder-open' });
          return o.map(x => ({ label: x.l, value: x.v, icon: x.i }));
        })(),
        mktStats: (mk ? [{ l: 'Made', v: mk.created, i: 'ph-fill ph-sparkle' }, { l: 'Published', v: mk.published, i: 'ph-fill ph-broadcast' }, { l: 'Scheduled', v: mk.scheduled, i: 'ph-fill ph-clock' }, { l: 'Reels', v: mk.reels, i: 'ph-fill ph-video-camera' }] : [])
          .map(x => ({ label: x.l, value: String(x.v), icon: x.i, style: 'padding:16px 18px;border-radius:18px;background:#fff6ee;box-shadow:inset 0 0 0 1.5px #f5d3ba' })),
        perfRows: (() => {
          if (!(mk && mk.perf)) return [];
          const p = mk.perf; const rows = [{ l: 'reach', v: p.reach }, { l: 'impressions', v: p.impr }, { l: 'engagement', v: p.eng }, { l: 'link clicks', v: p.clicks }];
          const mx = Math.max(...rows.map(r => r.v));
          return rows.map(r => ({
            label: r.l, value: r.v.toLocaleString('en-IN'),
            barStyle: `display:block;height:100%;width:${Math.max(8, Math.round(r.v / mx * 100))}%;border-radius:999px;background:linear-gradient(90deg,#f8a800,#f8c200)`
          }));
        })(),
        bigPhoto: `position:relative;background:#4a3f2c;background-image:url('${this.plotPhoto(pd, shot)}');background-size:cover;background-position:center`,
        earthTile: `position:relative;overflow:hidden;background-image:url('/assets/earth-sat.png');background-size:cover;background-position:center;box-shadow:inset -1px -1px 0 rgba(255,255,255,.14)`,
        sheetTile: `position:relative;overflow:hidden;background-image:url('/assets/newchandigarh-map.png');background-size:cover;background-position:center;box-shadow:inset -1px 0 0 rgba(255,255,255,.14)`,
        orangeStat: 'display:flex;flex-direction:column;gap:3px;padding:14px 16px;border-radius:15px;background:#fff6ee;box-shadow:inset 0 0 0 1.5px #f5d3ba',
        mktReels: mk ? String(mk.reels) : '0',
        noRecentAct: recentAct.length === 0,
        sellerTel: sl ? this.tel(sl.phone) : '#',
        sellerFacts: (() => {
          const o = [{ l: 'His asking price', v: ps.askPrice ? this.inr(ps.askPrice) : 'Not recorded', i: 'ph-fill ph-tag' },
          { l: 'Your listed price', v: this.inr(pd.price), i: 'ph-fill ph-currency-inr' },
          { l: 'Relationship', v: ps.relation || 'Owner', i: 'ph-fill ph-user-check' },
          { l: 'Seller type', v: sl ? sl.kind : '—', i: 'ph-fill ph-identification-card' }];
          return o.map(x => ({ label: x.l, value: x.v, icon: x.i }));
        })(),
        headStyle: `position:relative;flex:none;height:186px;background:#4a3f2c;background-image:url('${this.plotPhoto(pd, shot)}');background-size:cover;background-position:center`,
        headline: OV.headline,
        typeIcon: OV.typeIcon,
        typeLabel: OV.typeLabel,
        isNegotiable: OV.isNegotiable,
        isFixedPrice: OV.isFixedPrice,
        highlightChips: OV.highlightChips,
        hasHighlightChips: OV.hasHighlightChips,
        keySpecs: OV.keySpecs,
        detailGroups: OV.detailGroups,
        moreDetailsList: OV.moreDetailsList,
        moreDetailsCount: OV.moreDetailsCount,
        hasMoreDetails: OV.hasMoreDetails,
        hasCustomNotes: OV.hasCustomNotes,
        customNotes: OV.customNotes,
        moreDetailsOpen: !!s.moreDetailsOpen,
        toggleMoreDetails: () => this.setState({ moreDetailsOpen: !s.moreDetailsOpen }),
        moreIcon: s.moreDetailsOpen ? 'ph-caret-up' : 'ph-caret-down',
        moreLabel: s.moreDetailsOpen ? 'Hide secondary details' : ('View all property details (' + OV.moreDetailsCount + ' more facts)'),
        moreAction: s.moreDetailsOpen ? 'Collapse' : 'Expand',
        rdStyle2: `display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 13px;border-radius:11px;font-size:14.5px;font-weight:800;white-space:nowrap;flex:none;background:${rr.b};color:${rr.c}`,
        availStyle2: `display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:11px;font-size:14.5px;font-weight:800;white-space:nowrap;flex:none;${pd.status === 'available' ? 'background:rgba(217,245,227,.94);color:#0a6634' : 'background:rgba(255,230,207,.94);color:#a3541b'}`,
        priceWord: isSold ? 'Sold for' : 'Asking',
        priceHead: isSold && sale ? this.inr(sale.price) : this.inr(pd.price),
        priceWordStyle: `font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:${isSold ? '#4ade80' : 'rgba(255,255,255,.68)'}`,
        priceValStyle: `font-family:'Newsreader',serif;font-weight:600;font-size:30px;line-height:1.05;white-space:nowrap;color:${isSold ? '#4ade80' : '#ffcb45'}`,
        blueStat: 'display:flex;flex-direction:column;gap:3px;padding:14px 16px;border-radius:15px;background:#f3f7fd;box-shadow:inset 0 0 0 1.5px #d3e2f5',
        mktSub: mk ? [mk.created + ' creatives', mk.published + ' published', mk.scheduled + ' scheduled', mk.reels + (mk.reels === 1 ? ' reel' : ' reels')].join(' · ') : 'Nothing made yet',
        showAvail: pd.status !== 'sold',
        availLabel: pd.status === 'available' ? 'Available' : 'Off market',
        availStyle: `display:inline-flex;align-items:center;gap:7px;font-size:14px;font-weight:800;padding:8px 14px;border-radius:999px;${pd.status === 'available' ? 'background:#d9f5e3;color:#0a6634' : pd.status === 'onhold' ? 'background:#ffe6cf;color:#a3541b' : 'background:#0b6f39;color:#eafff2'}`,
        mktLine: mk ? [mk.created + ' creatives', mk.published + ' published', mk.scheduled + ' scheduled', mk.reels + (mk.reels === 1 ? ' reel' : ' reels')].join(' · ') : '',
        perfPill: 'display:inline-flex;align-items:center;height:40px;padding:0 15px;border-radius:999px;background:#fde5d3;color:#a03d09;font-size:15.5px;font-weight:800',
        hasSeller: !!sl, noSeller: !sl,
        sellerName: sl ? sl.name : '', sellerPhone: sl ? sl.phone : '', sellerKind: sl ? sl.kind : '', sellerInitials: sl ? this.initialsOf(sl.name) : '',
        sellerRelation: ps.relation || 'Owner', sellerAsk: ps.askPrice ? this.inr(ps.askPrice) : 'Not recorded',
        sellerConfirmLabel: ps.availConfirmed ? 'Availability confirmed' : 'Not confirmed lately',
        sellerConfirmStyle: `display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;border-radius:999px;font-size:14.5px;font-weight:800;${ps.availConfirmed ? 'background:#d9f5e3;color:#0a6634' : 'background:#ffdccb;color:#a33417'}`,
        sellerConfirmWhen: ps.lastConfirmed || '—',
        sellerVisit: ps.visitNote || 'No instructions saved', hasVisit: !!ps.visitNote,
        sellerNote: ps.note || '', hasSellerNote: !!ps.note,
        sellerDocs: (ps.docs || []).map(d => ({ label: d, style: 'display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:999px;background:#efe8fb;color:#4a2c99;font-size:14.5px;font-weight:800' })),
        hasSellerDocs: (ps.docs || []).length > 0,
        goSeller: () => { if (sl) { deskStore.loadSellerWorkspace(sl.id); this.setState({ sellerView: sl.id }); } },
      openMapcoAi: () => this.openPropertyIntelligence(pd.id),
      mapcoAiReady: !!pd.earth,
        addSellerGo: () => this.openEdit(pd.id, 2),
        docs: (pd.docs || []).map((d, i) => ({
          name: d.name, kind: d.kind,
          thumbStyle: `height:96px;border-radius:13px;background-image:url('/assets/ph-${this.groupOf(pd.type) === 'plot' ? 'plot' : this.groupOf(pd.type) === 'comm' ? 'landmark' : 'project'}-${((d.img || 0) % 3) + 1}.png');background-size:cover;background-position:center;filter:saturate(.3) brightness(.92)`
        })),
        hasDocs: (pd.docs || []).length > 0, noDocs: (pd.docs || []).length === 0,
        docCount: (() => { const n = (pd.docs || []).length; return n === 1 ? '1 document' : n + ' documents'; })(),
        docsOpen: !!s.propDocsOpen,
        openDocs: () => this.setState({ pdTab: 'papers', cardMenu: null }),
        heroStyle2: `height:340px;border-radius:22px;overflow:hidden;position:relative;background:#e7dcc8;background-image:url('${this.plotPhoto(pd, shot)}');background-size:cover;background-position:center`,
        sellerBusiness: sl && sl.business ? sl.business : '', hasSellerBusiness: !!(sl && sl.business),
        earthMini: `position:relative;height:170px;border-radius:18px;overflow:hidden;background-image:url('/assets/earth-sat.png');background-size:cover;background-position:center`,
        sheetMini: `position:relative;height:170px;border-radius:18px;overflow:hidden;background-image:url('/assets/newchandigarh-map.png');background-size:cover;background-position:center`,
        addDocsGo: () => this.openEdit(pd.id, 3),
        actStyle, actOpens: String(pd.views || 0), actLinkOpens: String(totalOpens), actPublished: String(mkPub), actLast: lastAct,
        recentAct: recentAct.slice(0, 4).map(a => ({ ...a, style: 'display:flex;align-items:center;gap:11px;padding:12px 15px;border-radius:14px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #ecdcc0;font-size:16.5px;font-weight:700;color:#2f2a2d' })),
        hasRecentAct: recentAct.length > 0,
        engageLine: [shareRows.length === 1 ? 'Shared with 1 customer' : 'Shared with ' + shareRows.length + ' customers',
        activeLinks === 1 ? '1 live link' : activeLinks + ' live links',
        totalOpens === 1 ? '1 real open' : totalOpens + ' real opens'].join(' · '),
        isSoldView: pd.status === 'sold', notSoldView: pd.status !== 'sold',
        saleFmt: sale ? this.inr(sale.price) : this.inr(pd.price),
        saleComm: sale && sale.comm ? this.inr(sale.comm) : '', hasComm: !!(sale && sale.comm),
        saleDate: sale ? sale.date : '—', saleBuyer: sale ? sale.buyerName : 'Not recorded',
        saleBuyerPhone: sale && sale.buyerPhone ? sale.buyerPhone : '',
        hasBuyer: !!(sale && sale.buyerId),
        goBuyer: () => { if (sale && sale.buyerId) this.setState({ propDetail: null, selectedClient: sale.buyerId, section: 'clients', delClient: false }); },
        hasDeal: !!pd.dealId,
        goDeal: () => { if (pd.dealId) this.setState({ propDetail: null, selectedDeal: pd.dealId, section: 'deals' }); },
        openSold: () => this.openSold(pd.id),
        moreOpen: s.cardMenu === 'detail', toggleMore: () => this.setState({ cardMenu: s.cardMenu === 'detail' ? null : 'detail' }),
        archiveGo: () => this.archiveProp(pd.id),
        negotiable: pd.negotiable !== false ? 'Negotiable' : 'Fixed price',
        rdLabel: rr.l, rdIcon: rr.i,
        rdStyle: `display:inline-flex;align-items:center;gap:9px;height:50px;padding:0 20px;border-radius:15px;font-size:17.5px;font-weight:800;background:${rr.b};color:${rr.c};box-shadow:inset 0 0 0 2px ${rr.bd}`,
        isReady: rd.miss.length === 0, notReady: rd.miss.length > 0,
        missRows: rd.miss.map(mi => ({
          label: mi.label, icon: mi.icon, fix: mi.fix, go: () => this.openEdit(pd.id, mi.step),
          style: 'display:flex;align-items:center;gap:13px;padding:14px 16px;border-radius:15px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #f0d9c6',
          btnStyle: 'display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 18px;border-radius:13px;background:#c1440e;color:#fff;font-size:16px;font-weight:800;flex:none'
        })),
        facts, hls, hasHls: hls.length > 0,
        hasPhotos: (pd.photoCount || 0) > 0, noPhotos: (pd.photoCount || 0) === 0,
        earthOn: !!pd.earth, earthOff: !pd.earth,
        earthLabel: pd.earth ? 'Exact location confirmed' : 'Exact location not set',
        earthStyle: `display:inline-flex;align-items:center;gap:9px;height:48px;padding:0 18px;border-radius:14px;font-size:16.5px;font-weight:800;${pd.earth ? 'background:#d9f5e3;color:#0a6634' : 'background:#ffdccb;color:#a33417'}`,
        setEarth: () => this.openEdit(pd.id, 3),
        setPhotos: () => this.openEdit(pd.id, 2),
        sheetName: sheet || '', hasSheet: !!sheet, noSheet: !sheet,
        sheetAvailable: (this.SECTORMAPS[pd.city] || []).length > 0,
        sheetLabel: sheet ? 'Sector map linked' : ((this.SECTORMAPS[pd.city] || []).length ? 'Sector map not linked' : 'No sector map for this area'),
        sheetStyle: `display:inline-flex;align-items:center;gap:9px;height:48px;padding:0 18px;border-radius:14px;font-size:16.5px;font-weight:800;${sheet ? 'background:#d9f5e3;color:#0a6634' : ((this.SECTORMAPS[pd.city] || []).length ? 'background:#ffdccb;color:#a33417' : 'background:#f4ecdd;color:#8a7a52')}`,
        linkSheet: () => this.openEdit(pd.id, 3),
        shareRows, hasShareRows: shareRows.length > 0, noShareRows: shareRows.length === 0,
        shareCustCount: String(shareRows.length), shareActiveCount: String(activeLinks), shareOpenCount: String(totalOpens),
        hasMkt: !!mk, noMkt: !mk,
        mktCreated: mk ? String(mk.created) : '0', mktApproved: mk ? String(mk.approved) : '0',
        mktPublished: mk ? String(mk.published) : '0', mktScheduled: mk ? String(mk.scheduled) : '0',
        mktReelLine: mk ? (mk.reels === 1 ? '1 reel made for this property' : mk.reels + ' reels made for this property') : '',
        mktStatStyle: mkStatStyle,
        mktAssets: mk ? mk.assets.map(a => ({
          kind: a.kind, date: a.date, plat: a.plat, status: a.status,
          kindIcon: a.kind === 'Reel' ? 'ph-fill ph-video-camera' : 'ph-fill ph-image',
          kindStyle: 'position:absolute;left:10px;bottom:10px;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;background:rgba(20,14,4,.72);color:#f8c200;font-size:13px;font-weight:800',
          thumbStyle: `height:158px;border-radius:0;background-image:url('${a.img}');background-size:cover;background-position:center;position:relative`,
          statusStyle: `position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;${a.status === 'Published' ? 'background:#d9f5e3;color:#0a6634' : a.status === 'Scheduled' ? 'background:#fff3d1;color:#8a6a14' : 'background:#efe8fb;color:#5b32c4'}`
        })) : [],
        hasPerf: !!(mk && mk.perf),
        noPerf: !(mk && mk.perf),
        perfReach: mk && mk.perf ? mk.perf.reach.toLocaleString('en-IN') : '—',
        perfImpr: mk && mk.perf ? mk.perf.impr.toLocaleString('en-IN') : '—',
        perfEng: mk && mk.perf ? mk.perf.eng.toLocaleString('en-IN') : '—',
        perfClicks: mk && mk.perf ? mk.perf.clicks.toLocaleString('en-IN') : '—',
        perfStyle,
        statusAvail: pd.status === 'available', statusHold: pd.status === 'onhold', statusSold: pd.status === 'sold',
        setAvail: () => { pd.status = 'available'; this.forceUpdate(); },
        setHold: () => { pd.status = 'onhold'; pd.published = false; this.forceUpdate(); },
        availStyle: pd.status === 'available' ? 'display:flex;align-items:center;gap:10px;height:60px;padding:0 22px;border-radius:16px;background:#0a6634;color:#eafff2;font-size:17.5px;font-weight:800' : 'display:flex;align-items:center;gap:10px;height:60px;padding:0 22px;border-radius:16px;background:#fffdf7;color:#4c463d;font-size:17.5px;font-weight:800;box-shadow:inset 0 0 0 2px #ecdcc0',
        holdStyle: pd.status === 'onhold' ? 'display:flex;align-items:center;gap:10px;height:60px;padding:0 22px;border-radius:16px;background:#a3541b;color:#fff;font-size:17.5px;font-weight:800' : 'display:flex;align-items:center;gap:10px;height:60px;padding:0 22px;border-radius:16px;background:#fffdf7;color:#4c463d;font-size:17.5px;font-weight:800;box-shadow:inset 0 0 0 2px #ecdcc0',
        editGo: () => this.openEdit(pd.id, 1),
        viewsLine: (pd.views || 0) === 0 ? 'Not opened in a presentation yet' : ((pd.views || 0) === 1 ? 'Opened 1 time while you were presenting' : 'Opened ' + (pd.views || 0) + ' times while you were presenting'),
        heroStyle: `position:absolute;inset:0;background-image:url('${this.plotPhoto(pd, shot)}');background-size:cover;background-position:center;transform:scale(1.04);filter:saturate(1.05)`,
        thumbs: [0, 1, 2, 3, 4, 5].map(i => ({ style: `width:112px;height:76px;flex:none;border-radius:13px;cursor:pointer;background-image:url('${this.plotPhoto(pd, i)}');background-size:cover;background-position:center;box-shadow:0 0 0 ${i === shot ? '3px #f8a800' : '1.5px rgba(255,255,255,.35)'}`, go: () => this.setState({ propShot: i }) })),
        views: pd.views || 0, viewsText: (pd.views || 0) === 1 ? '1 time' : (pd.views || 0) + ' times',
        readyLabel: pd.ready ? 'Ready to show' : 'Needs work', readyStyle: `display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:800;padding:7px 14px;border-radius:999px;${pd.ready ? 'background:#e2f2e6;color:#146c3a' : 'background:#ffe1e6;color:#c2185b'}`,
        sheet: sheet || 'Not linked to a sector map', hasSheet: !!sheet, noSheet: !sheet,
        linkCount: inLinks.length, linkText: inLinks.length === 0 ? 'No private link yet' : (inLinks.length === 1 ? 'In 1 private link' : 'In ' + inLinks.length + ' private links'),
        hasLinkRows: inLinks.length > 0,
        linkRows: inLinks.map(l => {
          const cc = this.clients.find(c => c.name === l.client);
          const cs = 'display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#5b32c4;background:#efe8fb;border-radius:9px;padding:5px 10px';
          const clicks = [];
          if (l.audio && l.played) clicks.push({ label: 'Played your voice note', icon: 'ph-fill ph-waveform', style: cs });
          if (l.called) clicks.push({ label: 'Tapped call', icon: 'ph-fill ph-phone-call', style: cs });
          if (l.wa) clicks.push({ label: 'Messaged on WhatsApp', icon: 'ph-fill ph-whatsapp-logo', style: cs });
          if (l.visit) clicks.push({ label: 'Asked for a site visit', icon: 'ph-fill ph-footprints', style: cs });
          clicks.push({ label: 'Last opened ' + (l.lastOpen || '—'), icon: 'ph-fill ph-clock', style: 'display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:800;color:#8d8271;background:#f3eeff;border-radius:9px;padding:5px 10px' });
          return {
            client: l.client, meta: (l.status === 'active' ? 'Live · ' : 'Stopped · ') + (l.opens === 1 ? '1 open' : l.opens + ' opens'),
            dotStyle: 'width:10px;height:10px;border-radius:50%;flex:none;background:' + (l.status === 'active' ? '#12a150' : '#c2185b'),
            canStop: l.status === 'active', stop: () => this.revokeLink(l.id),
            openClient: () => { if (cc) this.setState({ selectedClient: cc.id, delClient: false }); },
            clicks
          };
        }),
        sendTo: this.clients.filter(c => !inLinks.some(l => l.client === c.name && l.status === 'active')).slice(0, 8).map(c => ({
          name: c.name.split(' ').slice(0, 2).join(' '), initials: this.initialsOf(c.name), meta: c.want + ' · ' + c.budget,
          avStyle: 'width:34px;height:34px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:13px;font-weight:800;background:#efe8fb;color:#5b32c4',
          send: () => this.setState({ propDetail: null, linkBuild: 'new', lstep: 3, lSearchQ: '', lSearchQ2: '', lform: { ...this.blankL(), plots: [pd.id], clientId: c.id } })
        })),
        gap: pd.gap || '', hasGap: !!pd.gap,
        isPublished: pd.published !== false && pd.status !== 'sold', notPublished: pd.published === false || pd.status === 'sold',
        publish: () => this.publish(pd.id), unpublish: () => this.setState({ unpubFor: pd.id, unpubReason: '' }), sold: () => this.setState({ soldFor: pd.id }),
        editPrice: () => this.setState({ priceEdit: pd.id, priceVal: pd.price ? String(pd.price / 1e7) : '' }),
        delArm: s.delPlot, delIdle: !s.delPlot, arm: () => this.setState({ delPlot: true }), disarm: () => this.setState({ delPlot: false }), doDelete: () => this.deletePlot(pd.id),
        share: () => this.setState({ propDetail: null, linkBuild: 'new', lstep: 2, lSearchQ: '', lSearchQ2: '', lform: { ...this.blankL(), plots: [pd.id] } }),
        canSell: pd.status !== 'sold', isSold: pd.status === 'sold', celebrateSold: () => this.celebrateSold(pd.id),
        isBooked: !!this.propBooked(pd.id),
        bookedIn: (() => { const bd = this.propBooked(pd.id); return bd ? ('Booked · ' + bd.client + ' at ' + this.ds(bd.stage).l.toLowerCase()) : ''; })(),
        bookedStyle: 'display:inline-flex;align-items:center;gap:7px;font-size:14.5px;font-weight:800;padding:8px 14px;border-radius:999px;background:#1a5aa8;color:#fff;white-space:nowrap',
        openBookedDeal: () => { const bd = this.propBooked(pd.id); if (bd) this.setState({ propDetail: null, section: 'deals', dealView: 'active', selectedDeal: bd.id, dealTab: 'overview' }); },
        close: () => this.setState({ propDetail: null, delPlot: false })
      };
    })() : null;

    // Add a plot
    const pf = s.pform; const pstep = s.pstep;
    const sheetsFor = pf.city
      ? CANONICAL_SECTOR_MAPS.filter(m => m.city && m.city.toLowerCase() === pf.city.toLowerCase())
      : CANONICAL_SECTOR_MAPS;
    const TYPES = ['Residential Plot', '3 BHK Flat', 'Builder Floor', 'Kothi', 'Villa', 'Commercial SCO', 'Commercial Booth'];
    const FACING = ['East', 'West', 'North', 'South', 'North-East', 'North-West'];
    const pg = this.groupOf(pf.type);
    const pIsEdit = !!s.pEditId;
    const inputBig = 'width:100%;height:62px;padding:0 18px;border-radius:15px;border:none;background:#fff8e6;box-shadow:inset 0 0 0 2px #f0d493;font-size:18px;font-weight:600;color:#241f1c;outline:none';
    const areaBig = 'width:100%;min-height:104px;padding:16px 18px;border-radius:15px;border:none;background:#fff8e6;box-shadow:inset 0 0 0 2px #f0d493;font-size:17px;font-weight:500;color:#241f1c;outline:none;resize:vertical';
    const pill = (on) => `height:56px;padding:0 20px;border-radius:15px;font-size:17px;font-weight:800;transition:all .15s;${on ? 'background:#e8681c;color:#fff;box-shadow:0 12px 22px -14px rgba(232,104,28,.95)' : 'background:#fff3d6;color:#4c463d;box-shadow:inset 0 0 0 2px #f0d493'}`;
    const pSteps = [{ n: 1, l: 'Property', i: 'ph-fill ph-house-line' }, { n: 2, l: 'Seller', i: 'ph-fill ph-user-circle' }, { n: 3, l: 'Photos', i: 'ph-fill ph-images' }, { n: 4, l: 'MAPCO Earth', i: 'ph-fill ph-globe-hemisphere-east' }].map(st => {
      const on = pstep === st.n, done = pstep > st.n;
      return {
        n: String(st.n), label: st.l, icon: st.i, isDone: done, notDone: !done, go: () => this.setState({ pstep: st.n }),
        style: `display:flex;align-items:center;justify-content:center;gap:8px;height:44px;padding:0 12px;border-radius:12px;flex:1 1 0;min-width:0;overflow:hidden;transition:all .18s;${on ? 'background:#241d0c;color:#f8c200' : done ? 'background:#0a6634;color:#eafff2' : 'background:rgba(255,255,255,.6);color:#9a8a68'}`,
        numStyle: `width:24px;height:24px;border-radius:8px;flex:none;display:grid;place-items:center;font-size:13px;font-weight:800;${on ? 'background:#f8a800;color:#241d0c' : done ? 'background:rgba(255,255,255,.25);color:#fff' : 'background:#efe6d3;color:#9a8a68'}`
      };
    });
    const pSizeUnits = ['sq yd', 'sq ft', 'marla', 'kanal'].map(u => ({ label: u, go: () => this.setP({ unit: u }), style: pill(pf.unit === u) }));
    const pFacing = FACING.map(t => ({ label: t, go: () => this.setP({ facing: t }), style: pill(pf.facing === t) }));
    const pBeds = ['1', '2', '3', '4', '5+'].map(t => ({ label: t + ' BHK', go: () => this.setP({ beds: t }), style: pill(pf.beds === t) }));
    const pBaths = ['1', '2', '3', '4+'].map(t => ({ label: t, go: () => this.setP({ baths: t }), style: pill(pf.baths === t) }));
    const pParking = ['0', '1', '2', '3+'].map(t => ({ label: t === '0' ? 'None' : t + ' car', go: () => this.setP({ parking: t }), style: pill(pf.parking === t) }));
    const pFurn = ['Unfurnished', 'Semi furnished', 'Fully furnished'].map(t => ({ label: t, go: () => this.setP({ furnishing: t }), style: pill(pf.furnishing === t) }));
    const pAge = ['New', '1–5 years', '5–10 years', '10+ years'].map(t => ({ label: t, go: () => this.setP({ age: t }), style: pill(pf.age === t) }));
    const pUse = ['Shop', 'Office', 'Showroom', 'Restaurant', 'Clinic', 'Bank'].map(t => ({ label: t, go: () => this.setP({ use: t }), style: pill(pf.use === t) }));
    const pTypeTiles = this.PTYPES.map(t => {
      const on = pf.type === t.k;
      return {
        label: t.k, icon: t.i, go: () => this.setP({ type: t.k }),
        style: `display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:18px 16px;border-radius:18px;text-align:left;transition:all .16s;${on ? 'background:#241d0c;color:#f8c200;box-shadow:0 16px 30px -18px rgba(36,29,12,.9)' : 'background:#fffdf7;color:#4c463d;box-shadow:inset 0 0 0 2px #e6d6b4'}`,
        iconStyle: `width:46px;height:46px;border-radius:14px;display:grid;place-items:center;font-size:24px;${on ? 'background:#f8a800;color:#241d0c' : 'background:#f7efdf;color:#a3541b'}`
      };
    });
    const pkind = pg === 'plot' ? 'plot' : pg === 'comm' ? 'landmark' : 'project';
    const pPhotoSlots = (pf.photos || []).map(i => {
      const isCover = pf.cover === i;
      return {
        isCover, notCover: !isCover,
        style: `position:relative;height:150px;border-radius:16px;overflow:hidden;background-image:url('/assets/ph-${pkind}-${(i % 3) + 1}.png');background-size:cover;background-position:center;box-shadow:0 0 0 ${isCover ? '4px #e8681c' : '2px #e6d6b4'}`,
        remove: () => this.togglePhoto(i), setCover: () => this.setP({ cover: i }),
        left: () => this.movePhoto(i, -1), right: () => this.movePhoto(i, 1)
      };
    });
    const pPhotoCount = (pf.photos || []).length;
    const pVideos = (pf.videos || []).map((v, i) => ({
      label: 'Video ' + (i + 1), remove: () => this.removeVideo(i),
      style: `position:relative;height:150px;border-radius:16px;overflow:hidden;background-image:url('/assets/ph-${pkind}-${(i % 3) + 1}.png');background-size:cover;background-position:center;box-shadow:0 0 0 2px #4a2c99`
    }));
    const pQuickDocs = this.QUICKDOCS.map(q => {
      const have = (pf.docs || []).filter(d => d.kind === q.k);
      const n = have.reduce((a, d) => a + (d.photos || []).length, 0);
      return {
        label: q.l, icon: q.i, count: n ? String(n) : '', hasCount: n > 0,
        go: () => this.addDoc(q.k),
        style: `display:flex;align-items:center;gap:11px;height:66px;padding:0 18px;border-radius:16px;text-align:left;transition:all .15s;${n ? 'background:#4a2c99;color:#efe8fb' : 'background:#fff;color:#3a1f7a;box-shadow:inset 0 0 0 2px #d6c6f2'}`,
        iconStyle: `width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:21px;${n ? 'background:rgba(255,255,255,.2);color:#fff' : 'background:#efe8fb;color:#4a2c99'}`
      };
    });
    const pDocList = this.DOCTYPES.map(k => ({
      label: k, go: () => this.addDoc(k),
      style: 'width:100%;display:flex;align-items:center;gap:11px;padding:15px 17px;border-radius:14px;background:#fff;color:#241f1c;font-size:16.5px;font-weight:700;text-align:left;box-shadow:inset 0 0 0 1.5px #e4dcf5'
    }));
    const pDocs = (pf.docs || []).map((d) => ({
      id: d.id, name: d.name, kind: d.kind,
      photoLine: (d.photos || []).length === 1 ? '1 photo' : ((d.photos || []).length + ' photos'),
      thumbStyle: `height:110px;border-radius:14px;background-image:url('/assets/ph-${pkind}-${(((d.img || 0)) % 3) + 1}.png');background-size:cover;background-position:center;filter:saturate(.3) brightness(.94)`,
      open: () => this.setState({ docOpen: d.id }), remove: () => this.removeDocById(d.id)
    }));
    const docOpenRec = (pf.docs || []).find(d => d.id === s.docOpen) || null;
    const pHl = this.HIGHLIGHTS.map(h => {
      const on = (pf.highlights || []).includes(h);
      return {
        label: h, go: () => this.toggleHl(h), icon: on ? 'ph-fill ph-check-circle' : 'ph ph-plus-circle',
        style: `display:flex;align-items:center;gap:9px;height:56px;padding:0 18px;border-radius:15px;font-size:16.5px;font-weight:800;transition:all .15s;${on ? 'background:#0a6634;color:#eafff2' : 'background:#fffdf7;color:#4c463d;box-shadow:inset 0 0 0 2px #e6d6b4'}`
      };
    });
    const pCustomHls = (pf.highlights || []).filter(h => !this.HIGHLIGHTS.includes(h)).map(h => ({
      label: h, go: () => this.toggleHl(h),
      style: 'display:inline-flex;align-items:center;gap:9px;height:52px;padding:0 8px 0 18px;border-radius:15px;background:#0a6634;color:#eafff2;font-size:16.5px;font-weight:800'
    }));
    const pSheetList = sheetsFor.map(sh => {
      const on = pf.sectorMapId === sh.id || pf.sector === sh.name;
      return {
        label: sh.name, go: () => this.setP({ sector: on ? '' : sh.name, sectorMapId: on ? '' : sh.id, sectorMapName: on ? '' : sh.name, sectorMapImg: on ? '' : sh.image }),
        style: `width:100%;display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:16px;text-align:left;transition:all .15s;${on ? 'background:#0a6634;color:#eafff2' : 'background:#fffdf7;color:#4c463d;box-shadow:inset 0 0 0 2px #e6d6b4'}`,
        iconStyle: `width:44px;height:44px;border-radius:13px;flex:none;display:grid;place-items:center;font-size:22px;${on ? 'background:rgba(255,255,255,.2);color:#fff' : 'background:#f7efdf;color:#a3541b'}`
      };
    });
    const pEarthLine = [pf.address, pf.society, pf.area, pf.city].filter(Boolean).join(', ');
    const pAvail = [{ k: 'available', l: 'Available', i: 'ph-fill ph-storefront' }, { k: 'onhold', l: 'Off market', i: 'ph-fill ph-pause-circle' }, { k: 'sold', l: 'Sold', i: 'ph-fill ph-seal-check' }]
      .map(a => ({
        label: a.l, icon: a.i, go: () => this.setP({ avail: a.k }),
        style: `display:flex;align-items:center;gap:9px;height:56px;padding:0 20px;border-radius:15px;font-size:17px;font-weight:800;transition:all .15s;${pf.avail === a.k ? (a.k === 'available' ? 'background:#0a6634;color:#eafff2' : a.k === 'onhold' ? 'background:#a3541b;color:#fff' : 'background:#12406b;color:#fff') : 'background:#fffdf7;color:#4c463d;box-shadow:inset 0 0 0 2px #e6d6b4'}`
      }));
    const pTenure = ['Freehold', 'Leasehold'].map(t => ({ label: t, go: () => this.setP({ tenure: t }), style: pill(pf.tenure === t) }));
    const pBalc = ['0', '1', '2', '3+'].map(t => ({ label: t === '0' ? 'None' : t, go: () => this.setP({ balconies: t }), style: pill(pf.balconies === t) }));
    const pPoss = ['Ready to move', 'Under construction', 'Within 6 months', 'Within a year'].map(t => ({ label: t, go: () => this.setP({ possession: t }), style: pill(pf.possession === t) }));
    const sq = (s.sellerQ || '').toLowerCase().trim();
    const pSellerList = this.sellers.filter(sl => !sq || (sl.name + ' ' + sl.phone + ' ' + sl.city + ' ' + sl.kind).toLowerCase().includes(sq)).map(sl => {
      const on = pf.sellerId === sl.id; const cnt = this.properties.filter(pr => pr.ps && pr.ps.sellerId === sl.id).length;
      return {
        name: sl.name, phone: sl.phone, kind: sl.kind, city: sl.city || '—', initials: this.initialsOf(sl.name), on,
        propLine: cnt === 1 ? '1 property with you' : cnt + ' properties with you',
        go: () => this.setP({ sellerId: on ? '' : sl.id }),
        style: `width:100%;display:flex;align-items:center;gap:14px;padding:15px 17px;border-radius:17px;text-align:left;transition:all .15s;${on ? 'background:#4a2c99;color:#efe8fb;box-shadow:0 14px 26px -16px rgba(74,44,153,.9)' : 'background:#f2ecff;color:#241f1c;box-shadow:inset 0 0 0 2px #d5c5f2'}`,
        avStyle: `width:52px;height:52px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:18px;font-weight:800;${on ? 'background:rgba(255,255,255,.22);color:#fff' : 'background:#e2d6ff;color:#4a2c99'}`,
        subStyle: on ? 'font-size:15.5px;color:#d5c5f2' : 'font-size:15.5px;color:#6b6156',
        kindStyle: `display:inline-flex;align-items:center;height:32px;padding:0 12px;border-radius:999px;font-size:13.5px;font-weight:800;${on ? 'background:rgba(255,255,255,.2);color:#fff' : 'background:#fff;color:#5b32c4'}`
      };
    });
    const pSellerPicked = this.sellers.find(sl => sl.id === pf.sellerId) || null;
    const pRel = ['Owner', 'Co-owner', 'Builder', 'Authorized Seller'].map(t => ({ label: t, go: () => this.setP({ relation: t }), style: pill(pf.relation === t) }));
    const pConfirmWhen = ['Today', 'This week', '2 weeks ago', 'Over a month ago'].map(t => ({ label: t, go: () => this.setP({ lastConfirmed: t }), style: pill(pf.lastConfirmed === t) }));
    const pSellerDocs = this.DOCKINDS.map(d => {
      const on = (pf.sellerDocs || []).includes(d);
      return {
        label: d, go: () => this.toggleSellerDoc(d), icon: on ? 'ph-fill ph-check-circle' : 'ph ph-plus-circle',
        style: `display:flex;align-items:center;gap:9px;height:52px;padding:0 17px;border-radius:14px;font-size:16px;font-weight:800;transition:all .15s;${on ? 'background:#4a2c99;color:#efe8fb' : 'background:#fffdf7;color:#4c463d;box-shadow:inset 0 0 0 2px #e6d6b4'}`
      };
    });
    const pKinds = this.SELLERKINDS.map(k => ({ label: k, go: () => this.setNS({ kind: k }), style: pill(s.nsform.kind === k) }));


    // Link builder
    const lf = s.lform;
    const lPlots = this.properties.filter(pr => pr.status !== 'sold').map(pr => {
      const on = lf.plots.includes(pr.id);
      return {
        title: pr.type + ' · ' + pr.size, loc: pr.loc,
        style: `display:flex;align-items:center;gap:10px;width:100%;padding:10px;border-radius:14px;border:2px solid ${on ? '#12a150' : '#a9dcc0'};background:${on ? '#d5f2e2' : '#e6f6ec'};cursor:pointer;min-width:0`,
        thumbStyle: `width:52px;height:46px;border-radius:11px;flex:none;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center`,
        checkStyle: `width:24px;height:24px;border-radius:8px;flex:none;display:grid;place-items:center;${on ? 'background:#12a150;color:#fff' : 'background:#f3eeff;color:#c4b183'}`,
        checkIcon: on ? 'ph-bold ph-check' : 'ph-bold ph-plus', go: () => this.toggleLPlot(pr.id)
      };
    });
    const lClients = this.clients.map(c => {
      const on = lf.clientId === c.id;
      return {
        name: c.name, initials: this.initialsOf(c.name), meta: c.want + ' in ' + c.city,
        checkStyle: `width:26px;height:26px;border-radius:9px;flex:none;display:grid;place-items:center;${on ? 'background:#6b3fd4;color:#fff' : 'background:#f3eeff;color:#c4b183'}`, checkIcon: on ? 'ph-bold ph-check' : 'ph-bold ph-plus',
        style: `display:flex;align-items:center;gap:11px;width:100%;padding:13px;border-radius:14px;border:2px solid ${on ? '#6b3fd4' : '#e4dbf7'};background:${on ? '#f4eeff' : '#fffaf0'};cursor:pointer`,
        avStyle: `width:40px;height:40px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:14px;font-weight:800;${on ? 'background:#6b3fd4;color:#fff' : 'background:#efe8fb;color:#6b3fd4'}`,
        go: () => this.setL({ clientId: on ? '' : c.id })
      };
    });
    const lReady = lf.plots.length > 0 && !!(lf.clientId || (lf.newName || '').trim());
    const lName = (lf.clientId ? (this.clients.find(c => c.id === lf.clientId) || {}).name : ((lf.newName || '').trim())) || 'this customer';

    // Mobile client page preview
    const mobLink = s.mobileLink ? this.clientLinks.find(l => l.id === s.mobileLink) : null;
    const mobIds = mobLink ? mobLink.props : (lf.plots.length ? lf.plots : (s.mobileFor ? [s.mobileFor] : []));
    const mobPr = mobIds.length ? this.properties.find(pr => pr.id === (s.mobileFor || mobIds[0])) || this.properties.find(pr => pr.id === mobIds[0]) : null;
    const mobShot = s.propShot % 6;
    const mobName = mobLink ? mobLink.client : lName;
    const mob = mobPr ? {
      title: mobPr.type + ' · ' + mobPr.size, kicker: (mobLink ? mobLink.loc : lf.loc) === 'exact' ? mobPr.loc.toUpperCase() : mobPr.city.toUpperCase(),
      area: (mobLink ? mobLink.loc : lf.loc) === 'exact' ? mobPr.loc : ((mobLink ? mobLink.loc : lf.loc) === 'approx' ? mobPr.loc.split(', ').slice(-1)[0] + ' · approximate zone' : mobPr.city + ' area'),
      heroStyle: `position:absolute;inset:0;background-image:url('${this.plotPhoto(mobPr, mobShot)}');background-size:cover;background-position:center`,
      shotLabel: this.SHOTCAP[mobShot],
      dots: [0, 1, 2, 3, 4, 5].map(i => ({ style: `height:4px;flex:1;border-radius:999px;background:${i === mobShot ? '#f8a800' : 'rgba(255,255,255,.28)'}` })),
      prev: () => this.setState({ propShot: (mobShot + 5) % 6 }), next: () => this.setState({ propShot: (mobShot + 1) % 6 }),
      priceLabel: (mobLink ? mobLink.price : lf.price) === 'exact' ? this.inr(mobPr.price) : ((mobLink ? mobLink.price : lf.price) === 'range' ? ('₹' + (Math.floor(mobPr.price / 1e7 * 10) / 10).toFixed(1) + ' – ₹' + (Math.ceil(mobPr.price / 1e7 * 10 + 4) / 10).toFixed(1) + ' Cr') : 'Ask me the price'),
      dealer: this.ownerName, dealerFirst: this.ownerName.split(' ')[0], biz: this.bizName, initials: this.ownerInitials,
      watermark: 'Shared privately by ' + this.bizName + ' for ' + mobName,
      audio: mobLink ? mobLink.audio : (lf.audio === 'done'),
      audioLen: mobLink ? '0:48' : (Math.floor(lf.secs / 60) + ':' + String(lf.secs % 60).padStart(2, '0')),
      wave: Array.from({ length: 24 }, (_, i) => ({ style: `flex:1;height:${10 + Math.round(24 * Math.abs(Math.sin(i * 1.6)))}%;min-height:6px;border-radius:2px;background:${i < 10 ? '#f8a800' : 'rgba(255,255,255,.3)'}` })),
      facts: [{ i: 'ph-fill ph-ruler', l: mobPr.size }, { i: 'ph-fill ph-compass', l: mobPr.facing + ' facing' }, { i: 'ph-fill ph-road-horizon', l: 'Wide approach road' }],
      benefits: ['Walking distance to the sector market', 'On a 200 ft main road', 'Corner plot with two open sides', 'Schools and hospital within 5 minutes'],
      multi: mobIds.length > 1,
      pager: mobIds.map((id, i) => {
        const pr = this.properties.find(x => x.id === id); const on = pr && pr.id === mobPr.id;
        return {
          label: 'Plot ' + (i + 1), go: () => this.setState({ mobileFor: id, propShot: 0 }),
          style: `flex:1;height:32px;border-radius:9px;font-size:12.5px;font-weight:800;${on ? 'background:#f8a800;color:#241d0c' : 'background:rgba(20,13,32,.55);color:#e9dcff'}`
        };
      }),
      others: mobIds.filter(id => id !== mobPr.id).map(id => {
        const pr = this.properties.find(x => x.id === id); if (!pr) return null;
        return {
          title: pr.type + ' · ' + pr.size, loc: pr.loc,
          thumbStyle: `width:56px;height:50px;border-radius:12px;flex:none;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center`,
          style: 'display:flex;align-items:center;gap:11px;width:100%;padding:9px 11px;border-radius:15px;background:rgba(255,255,255,.08);cursor:pointer',
          go: () => this.setState({ mobileFor: pr.id, propShot: 0 })
        };
      }).filter(Boolean),
    } : null;

    const nextDealId = 'D' + (this.deals.length + 1);
    const nextClientId = 'C' + (this.clients.length + 1);

    return {
      navItems, ownerName: this.ownerName, ownerFirst: this.ownerName.split(' ')[0], ownerInitials: this.ownerInitials, bizName: this.bizName,
      greeting, dateStr, sectionName: sm.name, sectionIcon: sm.icon,
      invLiveGo: () => this.setState({ invView: 'live' }), invSoldGo: () => this.setState({ invView: 'sold' }),
      invMoneyToggle: () => this.setState({ invView: soldView ? 'live' : 'sold' }),
      invMoneyBtnLabel: soldView ? 'Back to on sale' : this.inr(soldEarn) + ' earned',
      invMoneyBtnIcon: soldView ? 'ph-bold ph-arrow-left' : 'ph-fill ph-seal-check',
      invMoneyBtnStyle: 'display:flex;align-items:center;gap:9px;height:46px;padding:0 20px;border-radius:12px;font-size:15px;font-weight:800;transition:transform .12s,box-shadow .2s;' + (soldView
        ? 'background:#f6efdd;color:#111c36;box-shadow:0 5px 0 #b9ac8d,0 16px 30px -14px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.9)'
        : 'background:#1b2b52;background-image:linear-gradient(160deg,#2f477f,#131f3e);color:#f8c200;box-shadow:0 5px 0 #0a1024,0 16px 30px -14px rgba(17,28,54,.55),inset 0 1px 0 rgba(255,255,255,.24)'),
      invLiveStyle: bigBtn(!soldView, 'gold', soldView), invSoldStyle: bigBtn(soldView, 'money', soldView),
      invLiveMeta: livePool.length + ' on your list', invSoldMeta: soldPool.length + ' sold · ' + this.inr(soldEarn) + ' earned',
      invStatLabelA: soldView ? 'Value sold' : 'Value on sale',
      invStatLabelB: soldView ? 'Properties sold' : 'Ready to show',
      invStatLabelC: soldView ? 'Earnings' : 'Live client links',
      invStatIconA: soldView ? 'ph-fill ph-bank' : 'ph-fill ph-buildings',
      invStatIconB: soldView ? 'ph-fill ph-seal-check' : 'ph-fill ph-check-circle',
      invStatIconC: soldView ? 'ph-fill ph-coins' : 'ph-fill ph-paper-plane-tilt',
      invLiveCount: allLive.length, invSoldCount: allSold.length,
      invSegLive: segBase + ';height:60px;padding:0 26px;font-size:18.5px;border-radius:16px;white-space:nowrap;' + (soldView ? 'background:transparent;color:#2f6b4c;opacity:.75' : 'background:#f8a800;color:#241d0c;box-shadow:0 14px 28px -12px rgba(248,168,0,.95),inset 0 0 0 2px #ffce5c;transform:scale(1.02)'),
      invSegSold: segBase + ';height:60px;padding:0 26px;font-size:18.5px;border-radius:16px;white-space:nowrap;' + (soldView ? 'background:#0a6634;color:#eafff2;box-shadow:0 14px 28px -12px rgba(10,102,52,.95),inset 0 0 0 2px #2fd07f;transform:scale(1.02)' : 'background:transparent;color:#6b6156;opacity:.72'),
      invSegLiveN: segNum(!soldView), invSegSoldN: segNum(soldView),
      invSegWrapStyle: 'display:flex;gap:6px;padding:6px;border-radius:20px;' + (soldView ? 'background:#d9f0e4;box-shadow:inset 0 0 0 2px #9fd6ba' : 'background:#fff3d6;box-shadow:inset 0 0 0 1px rgba(120,100,60,.16)'),
      invAddBtnStyle: 'display:flex;align-items:center;gap:10px;height:60px;padding:0 26px;border-radius:16px;font-size:18px;font-weight:800;white-space:nowrap;white-space:nowrap;transition:transform .12s;' + (soldView ? 'background:#f8a800;color:#241d0c' : 'background:#1d7a43;background-image:linear-gradient(140deg,#27a05a,#125c31);color:#eafff2;box-shadow:0 18px 34px -16px rgba(11,111,57,.9)'),
      propQ: s.propQ, propQOn: !!s.propQ,
      onPropQ: (e) => this.setState({ propQ: e.target.value }), clearPropQ: () => this.setState({ propQ: '' }),
      invSearchStyle: 'width:280px;max-width:320px;flex:0 1 280px;display:flex;align-items:center;gap:10px;height:52px;padding:0 16px;border-radius:15px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px ' + (soldView ? '#a9d9bd' : '#e6d6b4') + ',0 4px 12px -8px rgba(40,26,2,.2);',
      invSearchInput: 'border:none;outline:none;background:none;width:100%;font-size:16px;font-weight:600;color:#241f1c',
      filtersOpen: s.filtersOpen, toggleFilters: () => this.setState({ filtersOpen: !s.filtersOpen, plotCityOpen: false }),
      invFilterBtn: 'display:flex;align-items:center;gap:8px;height:52px;padding:0 18px;border-radius:15px;font-size:15.5px;font-weight:800;' + (invFilterCount ? 'background:#e8681c;color:#fff;box-shadow:0 8px 18px -6px rgba(232,104,28,.8);border:2px solid #e8681c;' : 'background:#fffdf7;color:#4c463d;border:1.5px solid #e6d6b4;box-shadow:0 3px 8px -4px rgba(40,26,2,.1);'),
      invFilterCount: invFilterCount ? String(invFilterCount) : '',
      invFilterCountStyle: invFilterCount ? 'font-size:14px;font-weight:800;background:rgba(0,0,0,.2);border-radius:999px;padding:2px 9px' : 'display:none',
      invFilterChips, hasFilterChips: invFilterChips.length > 0, quickViews,
      invQuickSegWrap: 'display:inline-flex;align-items:center;gap:4px;padding:4px;border-radius:16px;background:#fff3d6;box-shadow:inset 0 0 0 1.5px rgba(120,100,60,.16);',
      dealSegWrap: 'display:inline-flex;align-items:center;gap:4px;padding:4px;border-radius:18px;background:#fff3d6;box-shadow:inset 0 0 0 1.5px rgba(120,100,60,.16);',
      fCityRows: [{ k: 'all', l: 'All cities' }, ...this.CITIES.map(c => ({ k: c, l: c }))].map(ch => ({
        label: ch.l, go: () => this.setState({ plotCity: ch.k }), style: chipF(s.plotCity === ch.k),
        count: String(ch.k === 'all' ? this.properties.length : this.properties.filter(pr => pr.city === ch.k).length)
      })),
      fTypeRows: fTypeDefs.map(fd => ({
        label: fd.l, go: () => this.setState({ fType: fd.k }), style: chipF(s.fType === fd.k),
        count: String(fd.k === 'all' ? this.properties.length : this.properties.filter(pr => pr.want === fd.k).length)
      })),
      fStateRows: fStateDefs.map(fd => ({
        label: fd.l, go: () => this.setState({ fState: fd.k }), style: chipF(s.fState === fd.k),
        count: String(fd.k === 'all' ? allLive.length : allLive.filter(pr => stateOf(pr) === fd.k).length)
      })),
      clearFilters: () => this.setState({ plotCity: 'all', fType: 'all', fState: 'all' }),
      closeFilters: () => this.setState({ filtersOpen: false }),
      needCountText: needCount === 1 ? '1 property needs attention' : needCount + ' properties need attention',
      invStatA: soldView ? 'border-radius:24px;padding:26px 30px;color:#78350f;background:#fef3c7;background-image:linear-gradient(135deg,#fffbeb,#fef3c7 60%,#fde68a);box-shadow:0 20px 40px -20px rgba(217,119,6,.45),inset 0 2px 0 rgba(255,255,255,.9);border:2px solid #fcd34d;' : 'border-radius:24px;padding:26px 30px;color:#1c1303;background:#f59e0b;background-image:linear-gradient(135deg,#fbbf24,#f59e0b 60%,#d97706);box-shadow:0 20px 40px -20px rgba(245,158,11,.65),inset 0 2px 0 rgba(255,255,255,.5);border:2px solid #f59e0b;',
      invStatB: soldView ? 'border-radius:24px;padding:26px 30px;color:#ffffff;background:#059669;background-image:linear-gradient(135deg,#10b981,#059669 60%,#047857);box-shadow:0 20px 40px -20px rgba(5,150,105,.6),inset 0 2px 0 rgba(255,255,255,.3);border:2px solid #059669;' : 'border-radius:24px;padding:26px 30px;color:#9a3412;background:#fff7ed;background-image:linear-gradient(135deg,#fff7ed,#ffedd5 60%,#fed7aa);box-shadow:0 20px 40px -20px rgba(234,88,12,.35),inset 0 2px 0 rgba(255,255,255,.9);border:2px solid #fb923c;',
      invStatC: soldView ? 'border-radius:24px;padding:26px 30px;color:#ffffff;background:#d97706;background-image:linear-gradient(135deg,#f59e0b,#d97706 60%,#b45309);box-shadow:0 20px 40px -20px rgba(217,119,6,.6),inset 0 2px 0 rgba(255,255,255,.3);border:2px solid #d97706;' : 'border-radius:24px;padding:26px 30px;color:#5b21b6;background:#f5f3ff;background-image:linear-gradient(135deg,#f5f3ff,#ede9fe 60%,#ddd6fe);box-shadow:0 20px 40px -20px rgba(109,40,217,.35),inset 0 2px 0 rgba(255,255,255,.9);border:2px solid #c4b5fd;',
      invListLabel: soldView ? 'Sold and settled' : 'Your properties',
      invH1Style: "margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:" + (soldView ? '#0a4a26' : '#241f1c'),
      invSecLabelStyle: 'display:none',
      shellRef: (el) => { this._shell = el; }, asideRef: (el) => { this._aside = el; },
      topBarStyle: 'display:flex;align-items:center;gap:14px;padding:16px 40px;backdrop-filter:blur(8px);position:sticky;top:0;z-index:30;transition:background .45s ease;' + (mny ? 'border-bottom:1px solid rgba(217,154,9,.26);background:rgba(12,21,48,.76)' : 'border-bottom:1px solid #ddd2f5;background:rgba(247,243,234,.86)'),
      topIconStyle: 'font-size:21px;color:' + (mny ? '#f8a800' : '#d95d1e'),
      topNameStyle: 'font-size:17px;font-weight:800;letter-spacing:-.01em;color:' + (mny ? '#f6efdd' : '#2f2a2d'),
      topDateStyle: 'display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:600;color:' + (mny ? '#a9b6d6' : '#6b6156'),
      logoTextStyle: "font-family:var(--pm-font-display,'Newsreader',serif);font-weight:600;font-size:26px;letter-spacing:-.02em;color:#1a2f24;line-height:1",
      sideKickerStyle: 'font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:0 4px 9px;color:#9a8f7c',
      ownerNameStyle: 'font-size:14.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1f1a12',
      bizNameStyle: 'font-size:12.5px;font-weight:600;color:#9a8f7c',
      gearStyle: 'font-size:20px;color:#9a8f7c',
      recordBtnStyle: 'display:flex;align-items:center;gap:8px;height:46px;padding:0 18px;border-radius:12px;font-size:15px;font-weight:800;' + (mny ? 'background:rgba(255,255,255,.1);color:#f6efdd;box-shadow:inset 0 0 0 1px rgba(246,239,221,.3)' : 'background:#f3eeff;color:#4c463d;box-shadow:inset 0 0 0 1px #e0d5f7'),
      isDashboard: s.section === 'dashboard', isDeals: s.section === 'deals', isProperties: s.section === 'properties', isInventory: (s.section === 'properties' || s.section === 'plots'), invTitle, invSub, invAddLabel,
      goClients: () => this.go('clients'),
      isClients: s.section === 'clients', isAreas: s.section === 'areas',
      goDeals: () => this.go('deals'), goDemand: () => this.go('areas'), openAdd: () => this.setState({ addOpen: true, wiz: this.blankWiz() }),
      heroPipeline: m(pipeline), activeCount: active.length, heroComm: m(expComm), heroClosed: m(closedVal),
      tSessions: n(this.today.sessions), tAreas: n(this.today.areas), tTopArea: this.today.topArea,
      activity: this.ACTIVITY.map(a => ({
        t: a.t, who: a.who, what: a.what, icon: a.icon,
        rowStyle: 'display:flex;align-items:center;gap:14px;padding:13px 16px;border-radius:15px;background:' + a.bg,
        iconStyle: 'width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;background:#fffdf7;color:' + a.c
      })),
      closedMonthText: (closed.length === 1 ? '1 deal closed this month' : closed.length + ' deals closed this month'),
      streakText: this.streakDays + ' days in a row using MAPCO',
      showText: this.today.sessions + ' buyers shown today',
      callList, wantSnapshot, hotCityName, hotCityLine, hotCityGo: () => this.setState({ section: 'properties', plotCity: hotCityGoKey, plotCityOpen: false }),
      celebrate: (() => {
        const c = s.celebrate; if (!c) return null;
        const G = [[6, 0, 54], [14, .5, 38], [23, 1.1, 64], [32, .3, 44], [41, 1.5, 58], [50, .8, 72], [59, 1.9, 42], [68, .4, 60], [77, 1.3, 50], [86, .9, 66], [94, 1.7, 40], [19, 2.2, 46], [63, 2.5, 54], [38, 2.8, 48]];
        return {
          kind: c.kind, title: c.title, sub: c.sub, amount: c.amount,
          kicker: c.kind === 'sold' ? 'Property sold' : 'Deal completed',
          stamp: c.kind === 'sold' ? 'SOLD' : 'DONE',
          stampStyle: 'display:inline-flex;align-items:center;justify-content:center;padding:16px 42px;border-radius:18px;border:5px solid rgba(11,111,57,.45);color:#0b6f39;font-size:56px;font-weight:800;letter-spacing:.12em;animation:stampIn .7s cubic-bezier(.2,.9,.2,1) both',
          commLine: c.comm + ' is yours',
          doneLabel: 'Done',
          glyphs: G.map((g, i) => ({ style: 'position:absolute;left:' + g[0] + '%;bottom:-12vh;font-family:\'Newsreader\',serif;font-size:' + g[2] + 'px;color:rgba(11,111,57,' + (0.09 + (i % 4) * 0.04) + ');animation:moneyRise ' + (7 + (i % 5)) + 's linear ' + g[1] + 's infinite' })),
          close: () => this.closeCelebrate(),
          goDeals: () => { this.closeCelebrate(); this.go('deals'); }
        };
      })(),
      dealLiveGo: () => this.setState({ dealView: 'live' }), dealDoneGo: () => this.setState({ dealView: 'done' }),
      liveView: !doneView, doneView,
      dealMoneyToggle: () => this.setState({ dealView: doneView ? 'live' : 'done' }),
      dealMoneyBtnLabel: doneView ? 'Back to live deals' : m(doneComm) + ' earned',
      dealMoneyBtnIcon: doneView ? 'ph-bold ph-arrow-left' : 'ph-fill ph-trophy',
      dealMoneyBtnStyle: 'display:flex;align-items:center;gap:9px;height:46px;padding:0 20px;border-radius:12px;font-size:15px;font-weight:800;transition:transform .12s,box-shadow .2s;' + (doneView
        ? 'background:#f6efdd;color:#111c36;box-shadow:0 5px 0 #b9ac8d,0 16px 30px -14px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.9)'
        : 'background:#1b2b52;background-image:linear-gradient(160deg,#2f477f,#131f3e);color:#f8c200;box-shadow:0 5px 0 #0a1024,0 16px 30px -14px rgba(17,28,54,.55),inset 0 1px 0 rgba(255,255,255,.24)'),
      earnLine: (() => { const n = doneRaw.filter(d => d.stage === 'closed').length; return 'You sold ' + m(doneVal) + ' worth of property. This is what stayed with you.'; })(),
      earnCoins: [
        { icon: 'ph-fill ph-trophy', value: String(doneRaw.filter(d => d.stage === 'closed').length), label: 'Deals closed' },
        { icon: 'ph-fill ph-hand-coins', value: m(monthIn), label: 'Landed this month' },
        { icon: 'ph-fill ph-calendar-check', value: nextPayTxt, label: 'Next payment' }
      ].map((c, i) => ({
        icon: c.icon, value: c.value, label: c.label,
        wrapStyle: 'min-width:168px;border-radius:24px;padding:18px 20px 20px;background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.05));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 20px 36px -20px rgba(0,0,0,.6);animation:coinPop .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:' + (0.14 + i * 0.09) + 's',
        coinStyle: 'width:48px;height:48px;border-radius:50%;display:grid;place-items:center;color:#5c3f04;background:radial-gradient(circle at 34% 28%,#fff3c4,#f8a800 46%,#d99a09 78%,#a86f04);animation:coinShimmer 3.2s ease-in-out infinite'
      })),
      calMonth, calHeads: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], calCells, calLegend, payRows, moneyDeals,
      paidRows, dueRows, noDue: dueRows.length === 0, paidTotalLine, dueTotalLine, stripDays,
      doneCount: String(doneRaw.filter(d => d.stage === 'closed').length),
      doneCountWord: doneRaw.filter(d => d.stage === 'closed').length === 1 ? 'deal' : 'deals',
      moneySecLabel: 'font-size:15px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#f8c200;margin:28px 0 14px',
      moneyNotes: [[7, 0, 58], [17, 1.4, 42], [27, .6, 70], [37, 2.1, 48], [47, 1, 62], [57, 2.6, 44], [67, .3, 66], [77, 1.8, 50], [87, 2.3, 58], [95, .9, 46]].map((g, i) => ({
        style: 'position:absolute;left:' + g[0] + '%;bottom:0;font-family:\'Newsreader\',serif;font-size:' + g[2] + 'px;color:rgba(255,201,60,' + (0.1 + (i % 3) * 0.05) + ');animation:noteFloat ' + (9 + (i % 4) * 1.6) + 's linear ' + g[1] + 's infinite'
      })),
      dealLiveStyle: bigBtn(!doneView, 'gold', doneView), dealDoneStyle: bigBtn(doneView, 'money', doneView),
      dealLiveMeta: activeRaw.length + (activeRaw.length === 1 ? ' deal · ' : ' deals · ') + m(pipeline) + ' moving', dealDoneMeta: doneRaw.filter(d => d.stage === 'closed').length + ' closed · ' + m(doneComm) + ' earned',
      dealMoneyLabelA: doneView ? 'Money you closed' : 'Money in progress',
      dealMoneyLabelB: doneView ? 'Commission earned' : 'Your commission coming',
      dealMoneyCardA: doneView ? 'border-radius:20px;padding:24px 26px;color:#eafff2;background:#0b6f39;background-image:linear-gradient(135deg,#1fa85a,#0a5b2e)' : 'border-radius:20px;padding:24px 26px;color:#1f1a12;background:#f8a800;background-image:linear-gradient(135deg,#ffdc7a,#f4ae14)',
      dealMoneyCardB: doneView ? 'border-radius:20px;padding:24px 26px;background:#d9f5e3;border:1px solid #7fd6a4;color:#0b6f39' : 'border-radius:20px;padding:24px 26px;background:#d9f5e3;border:1px solid #a6e3c0;color:#0b6f39',
      dealH1Style: "margin:0;font-family:'Newsreader',serif;font-weight:500;font-size:34px;letter-spacing:-.015em;color:" + (doneView ? '#f6efdd' : '#241f1c'),
      dealSecLabelStyle: 'font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin:24px 0 12px;color:' + (doneView ? '#7ee3a6' : '#8d8271'),
      dealSecLabelStyle2: 'font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin:32px 0 12px;color:' + (doneView ? '#7ee3a6' : '#8d8271'),
      dealListLabel: doneView ? 'Finished — the money you made' : 'Working on now',
      dealDoneLabel: doneView ? 'Every finished deal' : 'Finished',
      dealsPipeline: doneView ? m(doneVal) : m(pipeline), dealsComm: doneView ? m(doneComm) : m(expComm), dealsActive, dealsDone,
      stgOpen: !!s.stgFor,
      stg: (() => {
        const f = s.stgFor; if (!f) return {};
        const d = this.deals.find(x => x.id === f.id) || {}; const dr = s.stgDraft || {};
        const LB = { negotiating: 'Negotiating', token: 'Token / Booked', registry: 'Registry / Closing', closed: 'Completed' };
        const IC = { negotiating: 'ph-fill ph-chats-circle', token: 'ph-fill ph-hand-coins', registry: 'ph-fill ph-stamp', closed: 'ph-fill ph-seal-check' };
        const cur = this.DSORDER.indexOf(d.stage === 'enquiry' ? 'negotiating' : d.stage), to = this.DSORDER.indexOf(f.to);
        const back = to < cur, fin = f.to === 'closed';
        const dayPill = (on) => 'height:46px;padding:0 15px;border-radius:13px;font-size:15.5px;font-weight:800;white-space:nowrap;' + (on ? 'background:#f8a800;color:#241d0c' : 'background:#fffdf7;color:#6b6156;box-shadow:inset 0 0 0 1.5px #e6d6b4');
        const sel = parseInt(dr.date) || this.TODAY;
        return {
          title: back ? ('Move back to ' + LB[f.to] + '?') : (LB[f.to] + '?'),
          kicker: back ? 'Going backward' : (fin ? 'Finish this deal' : 'Move this deal forward'),
          kickerColor: back ? 'color:#b02a37' : 'color:#a3541b',
          icon: IC[f.to], iconBox: 'display:grid;place-items:center;width:52px;height:52px;border-radius:16px;flex:none;' + (fin ? 'background:#0a6634;color:#eafff2' : back ? 'background:#ffdfe2;color:#b02a37' : 'background:#f8a800;color:#241d0c'),
          headStyle: 'padding:22px 24px 18px;background:#ffefd2;border-bottom:2px solid #f0c96a',
          body: fin ? ('This closes the deal for ' + (d.client || 'the buyer') + '. You will confirm the final selling price and buyer next.')
            : back ? ('This puts the deal back at ' + LB[f.to] + '. The earlier record stays in the history.')
              : (f.to === 'token' ? ('Confirm ' + (d.client || 'the buyer') + ' has given a token. The property will show as booked.')
                : ('Confirm the deal has reached ' + LB[f.to] + '.')),
          askAmt: f.to === 'token' && !back, askDate: f.to === 'registry' && !back,
          dateLabel: 'Registry / closing date (optional)',
          amt: dr.amt || '', onAmt: (e) => this.setState({ stgDraft: { ...dr, amt: e.target.value } }),
          dayOpts: [0, 7, 14, 30].map(k => ({
            label: k === 0 ? 'Today' : ('In ' + k + ' days'),
            go: () => this.setState({ stgDraft: { ...dr, date: String(this.TODAY + k) } }),
            style: dayPill(sel === this.TODAY + k)
          })),
          okLabel: fin ? 'Yes, mark it sold' : back ? 'Yes, move it back' : 'Yes, move it',
          okIcon: fin ? 'ph-fill ph-seal-check' : 'ph-bold ph-check',
          okStyle: 'display:flex;align-items:center;justify-content:center;gap:9px;flex:1.3;height:56px;border-radius:15px;font-size:17px;font-weight:800;' + (fin ? 'background:#0a6634;color:#fff' : back ? 'background:#b02a37;color:#fff' : 'background:#f8a800;color:#241d0c'),
          confirm: () => this.confirmStage(), cancel: () => this.setState({ stgFor: null, stgDraft: null })
        };
      })(),
      dealDetail, dd: dealDetail, closeDeal: () => this.setState({ selectedDeal: null, delArm: false, dealEdit: false }),
      dealSearch: s.dealSearch || '', dealSearchOn: !!(s.dealSearch || '').length, onDealSearch: (e) => this.setState({ dealSearch: e.target.value }), clearDealSearch: () => this.setState({ dealSearch: '' }),
      hasActive: !doneView && dealsActive.length > 0, noActive: !doneView && dealsActive.length === 0, hasDone: doneView && dealsDone.length > 0,
      dvTabs, dStrip, dStageChips, todayGroups, activeDeals, ledgerChips, ledgerRows, lostDeals,
      dSumWrap: 'display:flex;flex-wrap:wrap;gap:22px;margin-top:16px;padding:22px 28px;border-radius:22px;color:#eafff2;' + (dView === 'done'
        ? 'background:#06452a;background-image:linear-gradient(140deg,#0d6b3f,#04331e);box-shadow:0 24px 46px -26px rgba(6,60,35,.9)'
        : 'background:#0b6f39;background-image:linear-gradient(140deg,#17a05c,#0a5b2e);box-shadow:0 24px 46px -26px rgba(10,90,50,.85)'),
      dSummary: (() => {
        const lab = () => 'font-size:12.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a8e3c3';
        const val = () => "font-family:'Newsreader',serif;font-weight:600;font-size:40px;line-height:1.05;color:#fff8e8";
        const sub = () => 'font-size:15px;font-weight:700;color:#a8e3c3;margin-top:2px';
        if (dView === 'done') {
          const rec = dDoneAll.reduce((a, d) => a + this.dealMoney(d).got, 0), due = dDoneAll.reduce((a, d) => a + this.dealMoney(d).due, 0);
          return [{ title: 'Sold', value: String(dDoneAll.length), sub: dDoneAll.length === 1 ? 'property closed' : 'properties closed', label: lab('#7a8f82'), valStyle: val('#241f1c'), subStyle: sub('#5c7a68') },
          { title: 'Total value', value: m(doneVal), sub: 'across all sales', label: lab('#7a8f82'), valStyle: val('#241f1c'), subStyle: sub('#5c7a68') },
          { title: 'You earned', value: m(rec), sub: due > 0 ? (m(due) + ' still to come') : 'all commission received', label: lab('#0a6634'), valStyle: val('#0a6634'), subStyle: sub('#0a6634') }];
        }
        return [{ title: 'Ongoing', value: String(dActiveAll.length), sub: dActiveAll.length === 1 ? 'deal in progress' : 'deals in progress', label: lab('#8a7f6e'), valStyle: val('#241f1c'), subStyle: sub('#8a7f6e') },
        { title: 'Money on the table', value: m(pipeline), sub: 'if all of them close', label: lab('#8a7f6e'), valStyle: val('#241f1c'), subStyle: sub('#8a7f6e') },
        { title: 'Your commission', value: m(commExp), sub: 'expected from these deals', label: lab('#0a6634'), valStyle: val('#0a6634'), subStyle: sub('#0a6634') }];
      })(),
      dvToday: false, dvActive: dView === 'active', dvDone: dView === 'done',
      noActiveDeals: activeDeals.length === 0,
      noActiveMsg: (dq || stageFilter !== 'all') ? 'No deal matches this' : 'No deal is open right now. Start one when a buyer gets serious.',
      noLedger: ledgerRows.length === 0,
      noLedgerMsg: ledgerFilter === 'due' ? 'Every completed deal is fully paid.' : 'Nothing closed yet.',
      ledgerMeta: ledgerRows.length ? (this.inr(ledgerSrc.reduce((a, d) => a + d.value, 0)) + ' sold · ' + this.inr(ledgerSrc.reduce((a, d) => a + this.dealMoney(d).expected, 0)) + ' commission') : '',
      hasLost: lostDeals.length > 0,
      upOpen: !!upVM, up: upVM, upClose: () => this.setState({ upFor: null, upDraft: null }),
      dealLostOpen: !!s.dealLostFor, closeLost: () => this.setState({ dealLostFor: null }),
      lostOpts: this.LOSTREASONS.map(r => ({ label: r, go: () => this.dealLost(s.dealLostFor, r) })),
      linkOpen: !!s.linkFor, closeLink: () => this.setState({ linkFor: null }), linkList,
      gapRows,
      shareOpen: !!s.shareFor, shareProp: shareProp ? { title: shareProp.type + ' · ' + shareProp.size, loc: shareProp.loc, photoStyle: `width:56px;height:52px;border-radius:13px;flex:none;background-image:url('${this.plotPhoto(shareProp, 0)}');background-size:cover;background-position:center` } : null,
      closeShare: () => this.setState({ shareFor: null, shareDone: null }),
      sClients: this.clients.map(c => {
        const on = sf.clientId === c.id; return {
          name: c.name, initials: this.initialsOf(c.name), meta: c.want + ' in ' + c.city,
          style: `display:flex;align-items:center;gap:11px;width:100%;padding:11px 13px;border-radius:13px;border:2px solid ${on ? '#6b3fd4' : '#e4dbf7'};background:${on ? '#f4eeff' : '#fffaf0'};cursor:pointer`,
          avStyle: `width:38px;height:38px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:14px;font-weight:800;${on ? 'background:#6b3fd4;color:#fff' : 'background:#efe8fb;color:#6b3fd4'}`,
          checkStyle: `width:22px;height:22px;border-radius:7px;flex:none;display:grid;place-items:center;${on ? 'background:#6b3fd4;color:#fff' : 'background:#f3eeff;color:#c4b183'}`, checkIcon: on ? 'ph-bold ph-check' : 'ph-bold ph-plus',
          go: () => this.setS({ clientId: on ? '' : c.id })
        };
      }),
      sform: sf, onSForm: (e) => this.onSForm(e),
      sExpiry: this.EXPIRY.map(e => ({ label: e.l, go: () => this.setS({ expiry: e.k }), style: `height:44px;padding:0 18px;border-radius:12px;font-size:15px;font-weight:800;${sf.expiry === e.k ? 'background:#f8a800;color:#241d0c' : 'background:#f3eeff;color:#4c463d'}` })),
      sLoc: this.LOCVIS.map(o => {
        const on = sf.loc === o.k; return {
          label: o.l, desc: o.d, icon: o.i, go: () => this.setS({ loc: o.k }),
          style: `flex:1;text-align:left;padding:13px 15px;border-radius:14px;border:2px solid ${on ? '#f4ae14' : '#e4dbf7'};background:${on ? '#fff3d1' : '#fffaf0'};cursor:pointer`,
          iconStyle: `font-size:20px;color:${on ? '#a8792a' : '#c4b183'}`
        };
      }),
      sPrice: this.PRICEVIS.map(o => {
        const on = sf.price === o.k; return {
          label: o.l, desc: o.d, icon: o.i, go: () => this.setS({ price: o.k }),
          style: `flex:1;text-align:left;padding:13px 15px;border-radius:14px;border:2px solid ${on ? '#12a150' : '#e4dbf7'};background:${on ? '#e2f2e6' : '#fffaf0'};cursor:pointer`,
          iconStyle: `font-size:20px;color:${on ? '#186c3c' : '#c4b183'}`
        };
      }),
      sShots: shareProp ? [0, 1, 2, 3, 4, 5].map(i => {
        const on = sf.photos.includes(i); return {
          imgStyle: `display:block;width:100%;height:96px;background-image:url('${this.plotPhoto(shareProp, i)}');background-size:cover;background-position:center`, caption: this.SHOTCAP[i], go: () => this.toggleShot(i),
          style: `position:relative;border-radius:14px;overflow:hidden;cursor:pointer;background:#fffaf0;box-shadow:0 0 0 ${on ? '3px #12a150' : '1.5px #eed9a8'}`,
          badgeStyle: `position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:8px;display:grid;place-items:center;${on ? 'background:#12a150;color:#fff' : 'background:rgba(255,255,255,.85);color:#c4b183'}`,
          badgeIcon: on ? 'ph-bold ph-check' : 'ph-bold ph-plus'
        };
      }) : [],
      sShotCount: sf.photos.length + ' of 6 chosen',
      audioNone: sf.audio === 'none', audioRec: sf.audio === 'rec', audioDone: sf.audio === 'done',
      audioTime: String(Math.floor(sf.secs / 60)).padStart(1, '0') + ':' + String(sf.secs % 60).padStart(2, '0'),
      recToggle: () => this.recToggle(), dropAudio: () => this.dropAudio(),
      recBtnStyle: `display:flex;align-items:center;justify-content:center;gap:10px;height:56px;padding:0 24px;border-radius:14px;font-size:16.5px;font-weight:800;${sf.audio === 'rec' ? 'background:#c2185b;color:#fff' : 'background:#f8a800;color:#241d0c'}`,
      recBtnIcon: sf.audio === 'rec' ? 'ph-fill ph-stop-circle' : 'ph-fill ph-microphone',
      recBtnLabel: sf.audio === 'rec' ? 'Stop recording' : 'Record your message',
      shareDone: !!s.shareDone, shareNotDone: !s.shareDone, doCreateShare: () => this.createShare(),
      mobWave: Array.from({ length: 22 }, (_, i) => ({ style: `flex:1;height:${8 + Math.round(22 * Math.abs(Math.sin(i * 1.7)))}%;min-height:6px;border-radius:2px;background:${i < 9 ? '#6b3fd4' : 'rgba(107,63,212,.32)'}` })),
      shareClientName: (sf.clientId ? (this.clients.find(c => c.id === sf.clientId) || {}).name : ((sf.newName || '').trim())) || 'this customer',
      shareReady: !!(sf.clientId || (sf.newName || '').trim()),
      createBtnStyle: `display:flex;align-items:center;justify-content:center;gap:9px;height:56px;padding:0 26px;border-radius:14px;font-size:17px;font-weight:800;${(sf.clientId || (sf.newName || '').trim()) ? 'background:#12a150;color:#fff;box-shadow:0 14px 28px -14px rgba(18,161,80,.9)' : 'background:#ddd2f5;color:#b3a37a;cursor:not-allowed'}`,
      openMobile: () => this.setState({ mobileFor: s.shareFor || 'P1', mobileShare: null }),
      sharesOpen: !!s.sharesFor, closeShares: () => this.setState({ sharesFor: null }),
      sharesTitle: s.sharesFor ? (this.properties.find(pr => pr.id === s.sharesFor) || {}).type || '' : '',
      shareRows: s.sharesFor ? shareRowsVm(s.sharesFor) : [],
      noShareRows: s.sharesFor ? shareRowsVm(s.sharesFor).length === 0 : false,
      newShareFromList: () => this.setState({ sharesFor: null, linkBuild: 'new', lstep: 2, lSearchQ: '', lSearchQ2: '', lform: { ...this.blankL(), plots: s.sharesFor ? [s.sharesFor] : [] } }),
      mobileOpen: !!s.mobileFor, closeMobile: () => this.setState({ mobileFor: null }),
      mob: (() => {
        const pr = s.mobileFor ? this.properties.find(x => x.id === s.mobileFor) : null; if (!pr) return null;
        const sh = s.mobileShare ? this.shares.find(x => x.id === s.mobileShare) : null;
        const client = sh ? sh.client : ((sf.clientId ? (this.clients.find(c => c.id === sf.clientId) || {}).name : ((sf.newName || '').trim())) || 'your client');
        const priceK = sh ? sh.price : sf.price; const locK = sh ? sh.loc : sf.loc;
        const chosen = (sh ? [0, 1, 2, 3] : sf.photos);
        const band = (p) => { const cr = p / 1e7; return '₹' + (Math.floor(cr * 10) / 10).toFixed(1) + ' – ₹' + (Math.ceil(cr * 10 + 4) / 10).toFixed(1) + ' Cr'; };
        return {
          title: pr.type + ' · ' + pr.size, area: locK === 'exact' ? pr.loc : (locK === 'approx' ? pr.loc.split(', ').slice(-1)[0] + ' · approximate zone' : pr.city + ' area'),
          priceLabel: priceK === 'exact' ? this.inr(pr.price) : (priceK === 'range' ? band(pr.price) : 'Price on call'),
          priceHidden: priceK === 'hidden',
          heroStyle: `position:absolute;inset:0;background-image:url('${this.plotPhoto(pr, chosen[0] || 0)}');background-size:cover;background-position:center`,
          shots: chosen.slice(0, 8).map(i => ({ imgStyle: `height:124px;background-image:url('${this.plotPhoto(pr, i)}');background-size:cover;background-position:center`, caption: this.SHOTCAP[i] })),
          client, dealer: this.ownerName, biz: this.bizName, initials: this.ownerInitials,
          watermark: 'Shared privately by ' + this.bizName + ' for ' + client,
          audio: (sh ? sh.audio : sf.audio === 'done'), audioLen: sh ? '0:48' : (String(Math.floor(sf.secs / 60)) + ':' + String(sf.secs % 60).padStart(2, '0')),
          facts: [{ i: 'ph-fill ph-ruler', l: pr.size }, { i: 'ph-fill ph-compass', l: pr.facing + ' facing' }, { i: 'ph-fill ph-road-horizon', l: 'Wide approach road' }],
          benefits: ['Walking distance to the sector market', 'On a 200 ft main road', 'Corner plot with two open sides', 'Schools and hospital within 5 minutes']
        };
      })(),
      mobOpen: !!mob && !!s.mobileFor || !!mob && !!s.mobileOpen, mob,
      openMobilePreview: () => this.setState({ mobileFor: (lf.plots[0] || 'P1'), mobileLink: null, propShot: 0 }),
      closeMob: () => this.setState({ mobileFor: null, mobileLink: null }),
      goLinks: () => this.setState({ linkBuild: null, section: 'links' }),
      isLinks: s.section === 'links', linkCards, liveLinksText: liveLinks === 1 ? '1 live link' : liveLinks + ' live links', totalOpens: n(totalOpens),
      noLinks: this.clientLinks.length === 0,
      openLinkBuild: () => this.setState({ linkBuild: 'new', lstep: 1, lSearchQ: '', lSearchQ2: '', lform: this.blankL() }),
      linkBuildOpen: !!s.linkBuild, linkBuildNew: s.linkBuild === 'new', linkBuildDone: s.linkBuild === 'done',
      closeLinkBuild: () => this.setState({ linkBuild: null }),
      lform: lf, onLForm: (e) => this.onLForm(e), lPlots, lClients,
      lClientRows: this.clients.slice(0, 5).map(c => {
        const on = lf.clientId === c.id;
        return {
          name: c.name, sub: (c.want || 'Plot') + (c.city ? ' · ' + c.city : ''),
          ini: this.initialsOf(c.name),
          icon: on ? 'ph-fill ph-check-circle' : 'ph ph-circle',
          avStyle: `width:40px;height:40px;border-radius:12px;flex:none;display:grid;place-items:center;font-size:14.5px;font-weight:800;${on ? 'background:#12704a;color:#fff' : 'background:#e8f2eb;color:#12704a'}`,
          style: `display:flex;align-items:center;gap:12px;width:100%;padding:11px 13px;border-radius:14px;transition:all .16s;${on ? 'background:#dcf3e5;border:1px solid #12a150' : 'background:#faf7ff;border:1px solid #e4dbf7'}`,
          go: () => this.setL({ clientId: on ? '' : c.id, newName: '' })
        };
      }),
      lPlotPicks: this.properties.filter(pr => pr.status !== 'sold').slice(0, 8).map(pr => {
        const on = lf.plots.includes(pr.id);
        return {
          label: pr.loc, on,
          imgStyle: `display:block;width:100%;height:70px;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center`,
          style: `position:relative;overflow:hidden;border-radius:14px;transition:all .16s;background:#faf7ff;border:2px solid ${on ? '#12a150' : '#e4dbf7'}`,
          go: () => this.toggleLPlot(pr.id)
        };
      }),
      lRecTime: lf.audio === 'none' ? '' : Math.floor(lf.secs / 60) + ':' + String(lf.secs % 60).padStart(2, '0'),
      lRecToggle: () => this.recL(),
      lFootHint: lf.plots.length ? (lf.plots.length + (lf.plots.length === 1 ? ' property ready' : ' properties ready')) : 'Pick at least one property',
      lDoneSub: lName ? ('Private to ' + lName + ' · ' + lf.plots.length + ' plots') : '',
      lDoneUrl: 'mapco.in/p/' + ((lName || 'client').split(' ')[0].toLowerCase()) + '-' + (this._lslug || (this._lslug = Math.random().toString(36).slice(2, 7))),
      lCopyLabel: s.linkCopied ? 'Copied' : 'Copy link',
      lCopy: () => this.setState({ linkCopied: true }),
      lPickText: lf.plots.length === 0 ? 'Pick up to 4' : (lf.plots.length === 1 ? '1 property chosen' : lf.plots.length + ' properties chosen'),
      lSteps: [{ n: 1, l: 'Property', i: 'ph-fill ph-house-line' }, { n: 2, l: 'Customer', i: 'ph-fill ph-user-circle' }, { n: 3, l: 'Voice note', i: 'ph-fill ph-microphone' }].map(st => {
        const on = s.lstep === st.n, done = s.lstep > st.n;
        return {
          n: String(st.n), label: st.l, icon: st.i, isDone: done, notDone: !done,
          go: () => { if (st.n === 1 || lf.plots.length) this.setState({ lstep: st.n }); },
          style: `display:flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 14px;border-radius:13px;flex:1 1 0;min-width:0;overflow:hidden;transition:all .18s;${on ? 'background:#0e4d2f;color:#eafff2' : done ? 'background:#12a150;color:#fff' : 'background:rgba(255,255,255,.7);color:#7f9a8b'}`,
          numStyle: `width:26px;height:26px;border-radius:9px;flex:none;display:grid;place-items:center;font-size:13px;font-weight:800;${on ? 'background:#f8a800;color:#241d0c' : done ? 'background:rgba(255,255,255,.25);color:#fff' : 'background:#e3efe8;color:#7f9a8b'}`
        };
      }),
      sendLinkTypeChips: ['All Types', 'Plot', 'Flat', 'Commercial SCO', 'Villa', 'Kothi', 'Builder Floor'].map(t => {
        const val = t === 'All Types' ? 'all' : t;
        const on = (s.sendLinkType || 'all') === val;
        return {
          label: t,
          go: () => this.setState({ sendLinkType: val }),
          style: `display:inline-flex;align-items:center;height:38px;padding:0 15px;border-radius:11px;font-size:14.5px;font-weight:800;white-space:nowrap;cursor:pointer;transition:all .15s;${on ? 'background:#0e4d2f;color:#fff;box-shadow:0 4px 12px rgba(14,77,47,.35)' : 'background:#e8f4ec;color:#1e6a45;box-shadow:inset 0 0 0 1px #bce2cb'}`
        };
      }),
      sendLinkCityChips: ['All Cities', 'Mohali', 'Chandigarh', 'Zirakpur', 'New Chandigarh', 'Panchkula', 'Aerocity'].map(c => {
        const val = c === 'All Cities' ? 'all' : c;
        const on = (s.sendLinkCity || 'all') === val;
        return {
          label: c,
          go: () => this.setState({ sendLinkCity: val }),
          style: `display:inline-flex;align-items:center;height:38px;padding:0 15px;border-radius:11px;font-size:14.5px;font-weight:800;white-space:nowrap;cursor:pointer;transition:all .15s;${on ? 'background:#241d0c;color:#f8c200;box-shadow:0 4px 12px rgba(36,29,12,.35)' : 'background:#fff8e6;color:#8a6a1e;box-shadow:inset 0 0 0 1px #fae3aa'}`
        };
      }),
      lSearchQ: s.lSearchQ || '', onLSearch: (e) => this.setState({ lSearchQ: e.target.value }),
      lPropRows: (() => {
        const q = (s.lSearchQ || '').toLowerCase().trim();
        const typeFilter = s.sendLinkType || 'all';
        const cityFilter = s.sendLinkCity || 'all';
        return this.properties.filter(pr => pr.status !== 'sold')
          .filter(pr => {
            if (typeFilter !== 'all') {
              const pt = (pr.type || '').toLowerCase();
              const tf = typeFilter.toLowerCase();
              if (tf === 'plot' && !pt.includes('plot')) return false;
              if (tf === 'flat' && !pt.includes('flat') && !pt.includes('apartment')) return false;
              if (tf.includes('commercial') && !pt.includes('commercial') && !pt.includes('sco') && !pt.includes('booth')) return false;
              if (tf === 'villa' && !pt.includes('villa')) return false;
              if (tf === 'kothi' && !pt.includes('kothi') && !pt.includes('bungalow')) return false;
              if (tf.includes('floor') && !pt.includes('floor')) return false;
            }
            if (cityFilter !== 'all') {
              const pc = (pr.city + ' ' + pr.loc).toLowerCase();
              if (!pc.includes(cityFilter.toLowerCase())) return false;
            }
            if (q) {
              const fullText = (pr.type + ' ' + pr.loc + ' ' + pr.city + ' ' + pr.size).toLowerCase();
              if (!fullText.includes(q)) return false;
            }
            return true;
          })
          .map(pr => {
            const on = lf.plots.includes(pr.id);
            return {
              title: pr.type + ' · ' + pr.size, loc: pr.loc, priceFmt: this.inr(pr.price), on,
              photoStyle: `width:78px;height:64px;border-radius:13px;flex:none;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center`,
              style: `width:100%;display:flex;align-items:center;gap:13px;padding:12px 14px;border-radius:16px;text-align:left;transition:all .15s;${on ? 'background:#0e4d2f;color:#eafff2;box-shadow:0 14px 28px -16px rgba(10,70,40,.9)' : 'background:#e6f6ec;color:#241f1c;box-shadow:inset 0 0 0 2px #a9dcc0'}`,
              subStyle: on ? 'font-size:15.5px;color:#a9dcbf' : 'font-size:15.5px;color:#6b6156',
              priceStyle: on ? 'font-family:\'Newsreader\',serif;font-weight:600;font-size:23px;color:#f8c200' : 'font-family:\'Newsreader\',serif;font-weight:600;font-size:23px;color:#b8460f',
              go: () => this.toggleLPlot(pr.id)
            };
          });
      })(),
      lClientRowsFull: (() => {
        const q = (s.lSearchQ2 || '').toLowerCase().trim();
        return this.clients.filter(c => !q || ((c.name + ' ' + c.phone + ' ' + c.city).toLowerCase().includes(q))).map(c => {
          const on = lf.clientId === c.id;
          return {
            name: c.name, sub: (c.want || 'Plot') + (c.city ? ' · ' + c.city : '') + ' · ' + c.phone, initials: this.initialsOf(c.name), on,
            style: `width:100%;display:flex;align-items:center;gap:13px;padding:13px 15px;border-radius:16px;text-align:left;transition:all .15s;${on ? 'background:#4a2c99;color:#efe8fb;box-shadow:0 14px 28px -16px rgba(50,25,120,.9)' : 'background:#efe8fb;color:#241f1c;box-shadow:inset 0 0 0 2px #d5c5f2'}`,
            avStyle: `width:46px;height:46px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:16px;font-weight:800;${on ? 'background:rgba(255,255,255,.22);color:#fff' : 'background:#efe8fb;color:#5b32c4'}`,
            subStyle: on ? 'font-size:15.5px;color:#cfc0f2' : 'font-size:15.5px;color:#6b6156',
            go: () => this.setL({ clientId: on ? '' : c.id, newName: '' })
          };
        });
      })(),
      lSearchQ2: s.lSearchQ2 || '', onLSearch2: (e) => this.setState({ lSearchQ2: e.target.value }),
      lHeadQ: s.lstep === 2 ? (s.lSearchQ2 || '') : (s.lSearchQ || ''),
      onLHeadQ: (e) => this.setState(s.lstep === 2 ? { lSearchQ2: e.target.value } : { lSearchQ: e.target.value }),
      lHeadPh: s.lstep === 1 ? 'Search your properties by sector, city or size…' : s.lstep === 2 ? 'Search your contacts by name or phone…' : 'Record a voice note before you send',
      lS1: s.lstep === 1, lS2: s.lstep === 2, lS3: s.lstep === 3,
      lNotS1: s.lstep > 1, lNotS3: s.lstep < 3,
      lStepNext: () => {
        const ok = s.lstep === 1 ? lf.plots.length > 0 : !!(lf.clientId || (lf.newName || '').trim());
        if (ok && s.lstep < 3) this.setState({ lstep: s.lstep + 1 });
      },
      lStepBack: () => { if (s.lstep > 1) this.setState({ lstep: s.lstep - 1 }); },
      lStepNextLabel: s.lstep === 1 ? 'Next — customer' : 'Next — voice note',
      lStepNextStyle: `display:flex;align-items:center;gap:10px;height:56px;padding:0 24px;border-radius:15px;font-size:17.5px;font-weight:800;${(s.lstep === 1 ? lf.plots.length > 0 : !!(lf.clientId || (lf.newName || '').trim())) ? 'background:#0e4d2f;color:#eafff2;box-shadow:0 14px 26px -16px rgba(14,77,47,.9)' : 'background:#dbe8e0;color:#9db3a6;cursor:not-allowed'}`,
      lStepHint: { 1: 'Tap the properties this customer should see — up to 4.', 2: 'Pick a saved customer, or type a new name.', 3: 'A voice note makes the link feel personal. It is optional.' }[s.lstep],
      lReady, lName, sendLink: () => { if (lReady) this.sendLink(); },
      lS1: s.lstep === 1, lS2: s.lstep === 2, lS3: s.lstep === 3, lNotLast: s.lstep < 3, lCanBack: s.lstep > 1,
      lBars: [1, 2, 3].map(k => ({ style: `flex:1;height:6px;border-radius:999px;background:${k <= s.lstep ? '#f4ae14' : '#ddd2f5'}` })),
      lNext: () => { const ok = s.lstep === 1 ? !!(lf.clientId || (lf.newName || '').trim()) : lf.plots.length > 0; if (ok) this.lNext(); }, lBack: () => this.lBack(),
      lNextLabel: s.lstep === 1 ? 'Next: pick plots' : 'Next: voice note',
      lNextStyle: `display:flex;align-items:center;gap:9px;height:58px;padding:0 24px;border-radius:14px;font-size:17px;font-weight:800;${(s.lstep === 1 ? !!(lf.clientId || (lf.newName || '').trim()) : lf.plots.length > 0) ? 'background:#241d0c;color:#f8c200' : 'background:#ddd2f5;color:#b3a37a;cursor:not-allowed'}`,
      lHint: s.lstep === 1 ? 'Type a new customer, or tap a saved one' : s.lstep === 2 ? 'Tap up to 4 plots' : '',
      lHeading: { 1: 'Step 1 of 3 · the customer', 2: 'Step 2 of 3 · the plots', 3: 'Step 3 of 3 · your voice' }[s.lstep],
      lSendStyle: `display:flex;align-items:center;justify-content:center;gap:10px;height:56px;padding:0 24px;border-radius:15px;font-size:17.5px;font-weight:800;transition:all .2s;${lReady ? 'background:#12a150;color:#fff;box-shadow:0 14px 26px -16px rgba(18,161,80,.95)' : 'background:#e8f2eb;color:#a5b8ac'}`,
      lAudioNone: lf.audio === 'none', lAudioRec: lf.audio === 'rec', lAudioDone: lf.audio === 'done',
      lAudioTime: Math.floor(lf.secs / 60) + ':' + String(lf.secs % 60).padStart(2, '0'),
      recL: () => this.recL(), dropL: () => this.dropL(),
      lRecStyle: `display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;height:58px;margin-top:14px;padding:0 18px;box-sizing:border-box;border-radius:15px;font-size:16.5px;font-weight:800;border:none;cursor:pointer;${lf.audio === 'rec' ? 'background:#c2185b;color:#fff;' : 'background:#f8a800;color:#241d0c;'}`,
      lRecIcon: lf.audio === 'rec' ? 'ph-fill ph-stop-circle' : 'ph-fill ph-microphone',
      lRecLabel: lf.audio === 'rec' ? 'Stop recording' : 'Record a voice note for them',
      moreOpen: s.more, toggleMore: () => this.setState({ more: !s.more }),
      lExpiry: this.EXPIRY.map(e => ({ label: e.l, go: () => this.setL({ expiry: e.k }), style: `height:44px;padding:0 18px;border-radius:12px;font-size:15px;font-weight:800;${lf.expiry === e.k ? 'background:#f8a800;color:#241d0c' : 'background:#f3eeff;color:#4c463d'}` })),
      lLoc: this.LOCVIS.map(o => ({ label: o.l, go: () => this.setL({ loc: o.k }), style: `height:44px;padding:0 16px;border-radius:12px;font-size:14.5px;font-weight:800;${lf.loc === o.k ? 'background:#f8a800;color:#241d0c' : 'background:#f3eeff;color:#4c463d'}` })),
      lPrice: this.PRICEVIS.map(o => ({ label: o.l, go: () => this.setL({ price: o.k }), style: `height:44px;padding:0 16px;border-radius:12px;font-size:14.5px;font-weight:800;${lf.price === o.k ? 'background:#f8a800;color:#241d0c' : 'background:#f3eeff;color:#4c463d'}` })),
      propDetailOpen: !!propDetail, propDetail,
      sellerViewOpen: !!s.sellerView,
      sellerViewLoading: !!s.sellerView && deskStore.sellerWorkspaceStatus.state === 'loading',
      sellerViewError: deskStore.sellerWorkspaceStatus.state === 'error'
        ? (deskStore.sellerWorkspaceStatus.error || 'Seller could not be loaded') : '',
      sellerView: (() => {
        if (!s.sellerView) return null;
        /* The profile is one canonical round trip: the seller plus every
           property it is attached to, split into active and sold, each with
           its private relationship facts. */
        const ws = deskStore.sellerWorkspace;
        if (!ws || ws.seller.id !== s.sellerView) return null;
        const sl = ws.seller;
        const asRow = (r, sold) => {
          const lifecycle = r.property.lifecycle || (sold ? 'sold' : 'on-sale');
          return {
            ...r.property, ps: r.ps,
            status: sold ? 'sold' : 'available',
            // Truthful readiness: a draft must not read as "Ready to show".
            draft: lifecycle === 'draft',
            photoCount: (r.property.photos || []).length,
            earth: !!r.property.location,
            price: r.property.price, loc: r.property.loc || r.property.area || '',
            type: r.property.type, size: r.property.size,
          };
        };
        const props = [...ws.active.map(r => asRow(r, false)), ...ws.sold.map(r => asRow(r, true))];
        const live = props.filter(pr => pr.status !== 'sold');
        return {
          name: sl.name, phone: sl.phone, phone2: sl.phone2 || '', hasPhone2: !!sl.phone2,
          kind: sl.kind, city: sl.city || '—', note: sl.note || '', hasNote: !!sl.note,
          initials: this.initialsOf(sl.name),
          countLine: props.length === 1 ? '1 property with you' : props.length + ' properties with you',
          propGroups: (() => {
            const mk = (list, sold) => list.map(pr => {
              const ps = pr.ps || {}; const st = this.RS[this.readinessOf(pr).state] || {};
              return {
                title: pr.type + ' · ' + pr.size, loc: pr.loc,
                go: () => this.setState({ sellerProfile: null, propDetail: pr.id, propShot: 0, propTab: 'gallery' }),
                photoStyle: 'width:64px;height:64px;border-radius:15px;flex:none;background:#e7dcc8',
                stLabel: sold ? 'Sold' : (st.l || 'On sale'),
                stStyle: sold ? 'align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:999px;background:#0a6634;color:#eafff2;font-size:13.5px;font-weight:800'
                  : 'align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:999px;background:' + (st.b || '#f0ece4') + ';color:' + (st.c || '#6b6156') + ';font-size:13.5px;font-weight:800',
                priceFmt: this.inr(pr.price), priceCol: sold ? 'color:#0a6634' : 'color:#b8460f',
                askFmt: ps.askPrice ? this.inr(ps.askPrice) : '—',
                rowStyle: sold
                  ? 'width:100%;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;background:#f1fbf6;box-shadow:inset 0 0 0 2px #a9dcc0;text-align:left'
                  : 'width:100%;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;background:#fffdf7;box-shadow:inset 0 0 0 1.5px #ecdcc0;text-align:left'
              };
            });
            const liveP = props.filter(p => p.status !== 'sold'), soldP = props.filter(p => p.status === 'sold');
            const g = [];
            if (liveP.length) g.push({
              title: 'Still on sale', icon: 'ph-fill ph-storefront', items: mk(liveP, false),
              meta: this.inr(liveP.reduce((a, p) => a + p.price, 0)) + ' asking',
              wrap: 'padding:16px 18px;border-radius:20px;background:#fffaf0;box-shadow:inset 0 0 0 1.5px #eddfc6',
              badge: 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:999px;background:#a3541b;color:#fff;font-size:14.5px;font-weight:800',
              metaStyle: 'font-size:14.5px;font-weight:800;color:#a3541b'
            });
            if (soldP.length) g.push({
              title: 'Already sold', icon: 'ph-fill ph-seal-check', items: mk(soldP, true),
              meta: this.inr(soldP.reduce((a, p) => a + p.price, 0)) + ' closed',
              wrap: 'padding:16px 18px;border-radius:20px;background:#e9f7ef;box-shadow:inset 0 0 0 2px #a9dcc0',
              badge: 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:999px;background:#0a6634;color:#eafff2;font-size:14.5px;font-weight:800',
              metaStyle: 'font-size:14.5px;font-weight:800;color:#0a6634'
            });
            return g;
          })(),
          valueLine: this.inr(live.reduce((a, pr) => a + pr.price, 0)),
          tel: this.tel(sl.phone), wa: this.waLink(sl.phone),
          facts: (() => {
            const sold = props.filter(pr => pr.status === 'sold');
            const asks = props.map(pr => (pr.ps || {}).askPrice).filter(Boolean);
            const rels = [...new Set(props.map(pr => (pr.ps || {}).relation).filter(Boolean))];
            const conf = props.map(pr => pr.ps).filter(p => p && p.availConfirmed);
            const stale = props.map(pr => pr.ps).filter(p => p && !p.availConfirmed);
            const out = [{ l: 'Seller type', v: sl.kind || 'Individual', i: 'ph-fill ph-identification-card' },
            { l: 'Phone', v: sl.phone, i: 'ph-fill ph-phone' },
            { l: 'City', v: sl.city || '—', i: 'ph-fill ph-buildings' }];
            if (sl.business) out.push({ l: 'Business / firm', v: sl.business, i: 'ph-fill ph-briefcase' });
            out.push({ l: 'His role', v: rels.length ? rels.join(', ') : 'Owner', i: 'ph-fill ph-user-check' });
            out.push({ l: 'On sale with you', v: live.length + (live.length === 1 ? ' property' : ' properties'), i: 'ph-fill ph-storefront' });
            if (sold.length) out.push({ l: 'Already sold', v: sold.length + (sold.length === 1 ? ' property' : ' properties'), i: 'ph-fill ph-seal-check' });
            if (asks.length) out.push({ l: 'What he asks in total', v: this.inr(asks.reduce((a, b) => a + b, 0)), i: 'ph-fill ph-tag' });
            out.push({ l: 'Availability', v: stale.length ? (stale.length + ' not confirmed lately') : (conf.length ? 'All confirmed' : 'Not recorded'), i: 'ph-fill ph-clock-countdown' });
            return out.map(x => ({ label: x.l, value: x.v, icon: x.i }));
          })(),
          papers: (() => {
            const set = new Set(); props.forEach(pr => ((pr.ps || {}).docs || []).forEach(d => set.add(d)));
            return [...set].map(d => ({ label: d }));
          })(),
          hasPapers: props.some(pr => (((pr.ps || {}).docs) || []).length > 0),
          visitNotes: props.filter(pr => (pr.ps || {}).visitNote).map(pr => ({ prop: pr.type + ' · ' + pr.loc.split(',')[0], text: pr.ps.visitNote })),
          hasVisitNotes: props.some(pr => (pr.ps || {}).visitNote),
          props: props.map(pr => {
            const rd = this.readinessOf(pr); const r = this.RS[rd.state]; const ps = pr.ps || {};
            return {
              title: pr.type + ' · ' + pr.size, loc: pr.loc, priceFmt: this.inr(pr.price),
              askFmt: ps.askPrice ? this.inr(ps.askPrice) : '—',
              stLabel: r.l, stStyle: `display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;padding:6px 12px;border-radius:999px;background:${r.b};color:${r.c}`,
              photoStyle: `width:72px;height:60px;border-radius:13px;flex:none;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center`,
              go: () => this.setState({ sellerView: null, propDetail: pr.id, propShot: 0, section: 'properties' })
            };
          }),
          isOverview: (s.svTab || 'overview') === 'overview', isProps: s.svTab === 'props',
          tabs: [{ k: 'overview', l: 'Overview', i: 'ph-fill ph-identification-card', sub: 'Who he is and what he wants' }, { k: 'props', l: 'Properties', i: 'ph-fill ph-buildings', sub: props.length + (props.length === 1 ? ' property' : ' properties') + ' with you' }]
            .map(t => {
              const on = (s.svTab || 'overview') === t.k; return {
                label: t.l, icon: t.i, sub: t.sub, go: () => this.setState({ svTab: t.k }),
                style: `display:flex;align-items:center;gap:11px;height:58px;padding:0 20px;border-radius:15px;flex:none;transition:all .16s;${on ? 'background:#4a2c99;color:#fff;box-shadow:0 14px 26px -14px rgba(50,26,110,.9)' : 'background:#fff;color:#4a2c99;box-shadow:inset 0 0 0 2px #d5c5f2'}`,
                subStyle: `font-size:13px;font-weight:700;${on ? 'color:rgba(255,255,255,.82)' : 'color:#8a75c0'}`
              };
            }),
          close: () => this.setState({ sellerView: null, svTab: 'overview' })
        };
      })(),
      priceEditOpen: !!s.priceEdit, priceVal: s.priceVal, onPriceVal: (e) => this.setState({ priceVal: e.target.value }),
      priceEditTitle: s.priceEdit ? (this.properties.find(x => x.id === s.priceEdit) || {}).type || '' : '',
      closePriceEdit: () => this.setState({ priceEdit: null, priceVal: '' }), savePrice: () => this.savePrice(),
      unpubOpen: !!s.unpubFor, unpubReason: s.unpubReason, onUnpubReason: (e) => this.setState({ unpubReason: e.target.value }),
      closeUnpub: () => this.setState({ unpubFor: null, unpubReason: '' }), doUnpublish: () => this.doUnpublish(),
      unpubChips: ['Sold out', 'On hold with the owner', 'Price changed', 'Photos not ready', 'Owner not responding'].map(r => ({
        label: r, go: () => this.setState({ unpubReason: r }),
        style: `height:44px;padding:0 16px;border-radius:12px;font-size:15px;font-weight:800;${s.unpubReason === r ? 'background:#f8a800;color:#241d0c' : 'background:#f3eeff;color:#4c463d'}`
      })),
      soldOpen: !!s.soldFor, closeSold: () => this.setState({ soldFor: null }),
      soldTitle: s.soldFor ? (() => { const pr = this.properties.find(x => x.id === s.soldFor) || {}; return (pr.type || '') + ' · ' + (pr.size || ''); })() : '',
      soldLoc: s.soldFor ? (this.properties.find(x => x.id === s.soldFor) || {}).loc || '' : '',
      soldForm: s.soldForm, onSoldForm: (e) => this.onSold(e),
      soldInput: 'width:100%;height:62px;padding:0 18px;border-radius:15px;border:none;background:#fffdf7;box-shadow:inset 0 0 0 2px #e9d3a4;font-size:19px;font-weight:700;color:#241f1c;outline:none',
      soldBuyerList: (() => {
        const q = (s.soldForm.buyerQ || '').toLowerCase().trim();
        return this.clients.filter(c => !q || (c.name + ' ' + c.phone).toLowerCase().includes(q)).slice(0, 6).map(c => {
          const on = s.soldForm.buyerId === c.id;
          return {
            name: c.name, phone: c.phone, initials: this.initialsOf(c.name), on,
            go: () => this.setSold({ buyerId: on ? '' : c.id, buyerNew: false }),
            style: `display:flex;align-items:center;gap:11px;padding:12px 15px;border-radius:14px;text-align:left;transition:all .15s;${on ? 'background:#241d0c;color:#f8c200' : 'background:#fffdf7;color:#241f1c;box-shadow:inset 0 0 0 1.5px #e9d3a4'}`,
            avStyle: `width:42px;height:42px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:15px;font-weight:800;${on ? 'background:rgba(248,168,0,.28);color:#f8c200' : 'background:#fdf0d2;color:#9a6a00'}`,
            subStyle: on ? 'font-size:14.5px;color:#cbb98d' : 'font-size:14.5px;color:#6b6156'
          };
        });
      })(),
      soldBuyerQ: s.soldForm.buyerQ, onSoldBuyerQ: (e) => this.setSold({ buyerQ: e.target.value }),
      soldNewOn: s.soldForm.buyerNew, soldPickOn: !s.soldForm.buyerNew,
      soldNewGo: () => this.setSold({ buyerNew: true, buyerId: '' }), soldPickGo: () => this.setSold({ buyerNew: false }),
      soldNewStyle: `height:52px;padding:0 18px;border-radius:14px;font-size:16.5px;font-weight:800;${s.soldForm.buyerNew ? 'background:#241d0c;color:#f8c200' : 'background:#fffdf7;color:#4c463d;box-shadow:inset 0 0 0 2px #e9d3a4'}`,
      soldPickStyle: `height:52px;padding:0 18px;border-radius:14px;font-size:16.5px;font-weight:800;${!s.soldForm.buyerNew ? 'background:#241d0c;color:#f8c200' : 'background:#fffdf7;color:#4c463d;box-shadow:inset 0 0 0 2px #e9d3a4'}`,
      soldDateVal: (() => {
        const d = s.soldForm.date; if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        return new Date().toISOString().slice(0, 10);
      })(),
      onSoldDate: (e) => this.setSold({ date: e.target.value }),
      soldDateInput: 'width:100%;height:62px;padding:0 18px;border-radius:15px;border:none;background:#fffdf7;box-shadow:inset 0 0 0 2px #e9d3a4;font-size:19px;font-weight:700;color:#241f1c;outline:none',
      soldTodayGo: () => this.setSold({ date: new Date().toISOString().slice(0, 10) }),
      soldConfirm: () => this.confirmSold(),
      // A refused sale must say why rather than closing as if it worked.
      soldError: s.soldError || '', savingSold: !!s.savingSold,
      soldConfirmStyle: `width:100%;display:flex;align-items:center;justify-content:center;gap:11px;height:70px;border-radius:18px;font-size:21px;font-weight:800;${s.soldForm.price ? 'background:#0b6f39;background-image:linear-gradient(140deg,#25b567,#0b6f39 55%,#06552b);color:#eafff2;box-shadow:0 18px 36px -16px rgba(6,70,36,.9)' : 'background:#ece2cd;color:#b3a68a;cursor:not-allowed'}`,
      addPlotOpen: s.addPlotOpen,
      openAddPlot: () => this.setState({ addPlotOpen: true, pstep: 1, pEditId: null, pSaved: false, pform: this.blankP() }),
      closeAddPlot: () => this.saveDraft(),
      pform: pf, onPForm: (e) => this.onPForm(e), pstep, pSteps, pIsEdit, pNotEdit: !pIsEdit,
      pTitle: pIsEdit ? 'Edit this property' : 'Add a property',
      pSub: { 1: 'What it is and where it is.', 2: 'Who is selling it — private to you.', 3: 'Photos, video and documents.', 4: 'Drop the pin on MAPCO Earth.' }[pstep],
      pS1: pstep === 1, pS2: pstep === 2, pS3: pstep === 3, pS4: pstep === 4, pNotS1: pstep > 1, pNotS4: pstep < 4,
      pAvail, pTenure, pBalc, pPoss,
      pSellerList, pSellerPicked: !!pSellerPicked, pSellerNone: !pSellerPicked,
      pSellerName: pSellerPicked ? pSellerPicked.name : '', pSellerPhone: pSellerPicked ? pSellerPicked.phone : '',
      pSellerKind: pSellerPicked ? pSellerPicked.kind : '', pSellerInitials: pSellerPicked ? this.initialsOf(pSellerPicked.name) : '',
      sellerQ: s.sellerQ, onSellerQ: (e) => this.setState({ sellerQ: e.target.value }),
      sellerAdd: s.sellerAdd, sellerPick: !s.sellerAdd,
      openSellerAdd: () => this.setState({ sellerAdd: true }), closeSellerAdd: () => this.setState({ sellerAdd: false }),
      nsform: s.nsform, onNS: (e) => this.onNS(e), pKinds, saveSeller: () => this.addSeller(),
      pSellerBusiness: pSellerPicked && pSellerPicked.business ? pSellerPicked.business : '', pSellerHasBusiness: !!(pSellerPicked && pSellerPicked.business),
      savingProp: !!s.savingProp,
      savingTitle: s.savingProp ? s.savingProp.title : '', savingLoc: s.savingProp ? s.savingProp.loc : '',
      saveSellerStyle: `display:flex;align-items:center;gap:9px;height:60px;padding:0 24px;border-radius:16px;font-size:18px;font-weight:800;${(s.nsform.name.trim() && s.nsform.phone.trim()) ? 'background:#0a6634;color:#eafff2' : 'background:#e6dcc6;color:#a99878'}`,
      pRel, pConfirmWhen, pSellerDocs,
      pAvailYes: () => this.setP({ availConfirmed: true }), pAvailNo: () => this.setP({ availConfirmed: false }),
      pAvailYesStyle: pill(!!pf.availConfirmed), pAvailNoStyle: pill(!pf.availConfirmed),
      pDocs, pHasDocs: pDocs.length > 0, pNoDocs: pDocs.length === 0,
      pInput: inputBig, pArea: areaBig,
      pCityChips: this.CITIES.map(c => ({ label: c, go: () => this.setP({ city: c, sector: '' }), style: pill(pf.city === c) })),
      pTypeTiles, pIsPlot: pg === 'plot', pIsBuilt: pg === 'built', pIsComm: pg === 'comm',
      pSizeUnits, pFacing, pBeds, pBaths, pParking, pFurn, pAge, pUse,
      ...this.typeFields(pf, pill),
      onPRate: (e) => this.onPRate(e),
      pRateUnit: (() => { const u = pf.unit || 'sq yd'; return u === 'sq ft' ? 'sq ft' : (u === 'marla' || u === 'kanal') ? 'sq yd' : 'sq yd'; })(),
      pRateEcho: (() => { const r = parseFloat(pf.rate); return r ? ('₹' + Math.round(r).toLocaleString('en-IN')) : '—'; })(),
      pRateLine: (() => {
        const sz = this.sizeNum(pf); const r = parseFloat(pf.rate); const cr = parseFloat(pf.price);
        if (!sz) return 'Add the size above and this fills in by itself.';
        if (r) return Math.round(sz).toLocaleString('en-IN') + ' × ₹' + Math.round(r).toLocaleString('en-IN') + ' = ' + this.inr(Math.round(r * sz));
        if (cr) return 'Asking ' + this.inr(cr * 1e7) + ' works out to ₹' + Math.round(cr * 1e7 / sz).toLocaleString('en-IN') + ' per sq yd';
        return 'Type a rate, or the asking price on the right.';
      })(),
      pCornerStyle: pill(!!pf.corner), pCornerGo: () => this.setP({ corner: !pf.corner }),
      pPoojaStyle: pill(!!pf.pooja), pPoojaGo: () => this.setP({ pooja: !pf.pooja }),
      pStoreStyle: pill(!!pf.store), pStoreGo: () => this.setP({ store: !pf.store }),
      pServantStyle: pill(!!pf.servant), pServantGo: () => this.setP({ servant: !pf.servant }),
      pLiftStyle: pill(!!pf.lift), pLiftGo: () => this.setP({ lift: !pf.lift }),
      pPowerStyle: pill(!!pf.powerBackup), pPowerGo: () => this.setP({ powerBackup: !pf.powerBackup }),
      pMainRoadStyle: pill(!!pf.mainRoad), pMainRoadGo: () => this.setP({ mainRoad: !pf.mainRoad }),
      pShowPlotStyle: pill(pf.showPlotNo !== false), pShowPlotGo: () => this.setP({ showPlotNo: !(pf.showPlotNo !== false) }),
      pParkStyle: pill(!!pf.parkFacing), pParkGo: () => { this.setP({ parkFacing: !pf.parkFacing }); this.toggleHl('Park Facing'); },
      pPhotoSlots, pPhotoCount: pPhotoCount + (pPhotoCount === 1 ? ' photo added' : ' photos added'),
      pHasPhotos: pPhotoCount > 0, pNoPhotos: pPhotoCount === 0,
      pAddPhoto: () => this.addPhotoSlot(), pAddVideo: () => this.addVideoSlot(),
      pVideos, pVideoCount: (pf.videos || []).length === 1 ? '1 video added' : ((pf.videos || []).length + ' videos added'),
      pQuickDocs, pDocList,
      docPickOpen: s.docPickOpen, openDocPick: () => this.setState({ docPickOpen: true }), closeDocPick: () => this.setState({ docPickOpen: false }),
      docNewOpen: s.docNewOpen, openDocNew: () => this.setState({ docNewOpen: true, docNewName: '' }), closeDocNew: () => this.setState({ docNewOpen: false }),
      docNewName: s.docNewName, onDocNewName: (e) => this.setState({ docNewName: e.target.value }),
      saveDocNew: () => { const n = (s.docNewName || '').trim(); if (!n) return; this.setState({ docNewOpen: false }); this.addDoc(n, n); },
      docNewStyle: `display:flex;align-items:center;gap:9px;height:60px;padding:0 22px;border-radius:15px;font-size:17px;font-weight:800;${(s.docNewName || '').trim() ? 'background:#4a2c99;color:#efe8fb' : 'background:#e4dcf5;color:#a396c4'}`,
      docOpenOpen: !!docOpenRec,
      docOpen: docOpenRec ? {
        name: docOpenRec.name, kind: docOpenRec.kind,
        photos: (docOpenRec.photos || []).map((p, i) => ({
          style: `position:relative;height:190px;border-radius:16px;overflow:hidden;background-image:url('/assets/ph-${pkind}-${(i % 3) + 1}.png');background-size:cover;background-position:center;box-shadow:0 0 0 2px #d6c6f2;filter:saturate(.3) brightness(.95)`,
          remove: () => this.docRemovePhoto(docOpenRec.id, i)
        })),
        countLine: (docOpenRec.photos || []).length === 1 ? '1 photo' : ((docOpenRec.photos || []).length + ' photos'),
        add: () => this.docAddPhoto(docOpenRec.id),
        removeDoc: () => this.removeDocById(docOpenRec.id),
        close: () => this.setState({ docOpen: null })
      } : null,
      pHl, pCustomHls, pHasCustom: pCustomHls.length > 0, pAddHl: () => this.addCustomHl(),
      pSheetList, pNoSheets: pf.city && sheetsFor.length === 0, pHasSheets: sheetsFor.length > 0, pNoCity: !pf.city,
      pEarthOn: !!pf.earth, pEarthOff: !pf.earth, pEarthLine: pEarthLine || 'Fill in the address on step 1 first',
      // "Confirm" only means something when a real coordinate was captured
      // from the satellite map. Without one there is nothing to confirm.
      pEarthConfirm: () => {
        const f = this.state.pform || {};
        const ok = Number.isFinite(Number(f.lat)) && Number.isFinite(Number(f.lng))
          && !(Number(f.lat) === 0 && Number(f.lng) === 0);
        if (!ok) { this.setState({ propError: 'Tap the map to place the property pin first.' }); return; }
        this.setP({ earth: true, pinSet: true });
      },
      pEarthRedo: () => this.setP({ earth: false, lat: undefined, lng: undefined, pinSet: false }),
      pMapClick: (e) => this.mapClick(e),
      pPinSet: pf.pinSet !== false, pPinNotSet: pf.pinSet === false,
      pPinStyle: `position:absolute;left:${pf.pinX === undefined ? 50 : pf.pinX}%;top:${pf.pinY === undefined ? 52 : pf.pinY}%;transform:translate(-50%,-100%);display:grid;place-items:center;pointer-events:none;transition:left .12s,top .12s`,
      pPinGlow: pf.earth ? 'width:86px;height:86px;border-radius:50%;background:rgba(26,155,82,.34);display:grid;place-items:center' : 'width:86px;height:86px;border-radius:50%;background:rgba(232,104,28,.3);display:grid;place-items:center;animation:omGlow 2.2s ease-in-out infinite',
      pPinColor: pf.earth ? 'font-size:52px;color:#3ce07f;filter:drop-shadow(0 6px 12px rgba(0,0,0,.7))' : 'font-size:52px;color:#ff8a3c;filter:drop-shadow(0 6px 12px rgba(0,0,0,.7))',
      pSatOn: s.pinMode !== 'sector' && s.mapSat !== false, pSatOff: s.mapSat === false,
      pPinMode: s.pinMode || 'sat',
      pHasSectorMap: !!(pf.sectorMapId || this.findMatchingSectorMap(pf.city, pf.sector || pf.area)),
      pSectorMapName: (() => {
        const m = pf.sectorMapId ? CANONICAL_SECTOR_MAPS.find(x => x.id === pf.sectorMapId) : this.findMatchingSectorMap(pf.city, pf.sector || pf.area);
        return m ? m.name : 'Sector map';
      })(),
      pSatGo: () => this.setState({ pinMode: 'sat', mapSat: true }),
      pMapGo: () => this.setState({ pinMode: 'earth', mapSat: false }),
      pSectorMapGo: () => {
        const m = pf.sectorMapId ? CANONICAL_SECTOR_MAPS.find(x => x.id === pf.sectorMapId) : this.findMatchingSectorMap(pf.city, pf.sector || pf.area);
        if (m && !pf.sectorMapId) {
          this.setP({ sectorMapId: m.id, sectorMapName: m.name, sectorMapImg: m.image });
        }
        this.setState({ pinMode: 'sector' });
      },
      pMapBg: s.mapSat === false ? "background-image:url('/assets/newchandigarh-map.png');background-size:cover;background-position:center" : "background-image:url('/assets/earth-sat.png');background-size:cover;background-position:center",
      pMapZoom: s.mapZoom || 1,
      pMapZoomStyle: `transform:scale(${s.mapZoom || 1});transform-origin:center center;transition:transform .08s ease-out;width:100%;height:100%;position:absolute;inset:0`,
      pMapZoomIn: () => {
        if (this._gMap && typeof this._gMap.getZoom === 'function') {
          this._gMap.setZoom((this._gMap.getZoom() || 17) + 1);
        } else {
          this.setState({ mapZoom: Math.min(3.5, +((this.state.mapZoom || 1) + 0.25).toFixed(2)) });
        }
      },
      pMapZoomOut: () => {
        if (this._gMap && typeof this._gMap.getZoom === 'function') {
          this._gMap.setZoom((this._gMap.getZoom() || 17) - 1);
        } else {
          this.setState({ mapZoom: Math.max(0.75, +((this.state.mapZoom || 1) - 0.25).toFixed(2)) });
        }
      },
      pMapWheel: (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const delta = (e && e.deltaY < 0) ? 0.2 : -0.2;
        const next = Math.max(0.75, Math.min(3.5, +((this.state.mapZoom || 1) + delta).toFixed(2)));
        this.setState({ mapZoom: next });
      },
      pSatStyle: `height:44px;padding:0 16px;border-radius:12px;font-size:15.5px;font-weight:800;${s.pinMode !== 'sector' && s.mapSat !== false ? 'background:#fffdf7;color:#241f1c' : 'background:rgba(255,253,247,.28);color:#fff'}`,
      pMapStyle: `height:44px;padding:0 16px;border-radius:12px;font-size:15.5px;font-weight:800;${s.pinMode !== 'sector' && s.mapSat === false ? 'background:#fffdf7;color:#241f1c' : 'background:rgba(255,253,247,.28);color:#fff'}`,
      pSectorMapStyle: `height:44px;padding:0 16px;border-radius:12px;font-size:15.5px;font-weight:800;${s.pinMode === 'sector' ? 'background:#ffc21e;color:#1c1503;box-shadow:0 6px 14px -4px rgba(255,194,30,.8)' : 'background:rgba(255,253,247,.28);color:#fff'}`,
      pEarthStatus: pf.earth ? (s.pinMode === 'sector' ? 'Pinned on Sector Map' : 'Exact location confirmed') : (s.pinMode === 'sector' ? 'Sector Map selected' : 'Not confirmed yet'),
      pEarthStatusStyle: pf.earth ? 'display:inline-flex;align-items:center;gap:9px;height:52px;padding:0 20px;border-radius:15px;background:#d9f5e3;color:#0a6634;font-size:17px;font-weight:800' : 'display:inline-flex;align-items:center;gap:9px;height:52px;padding:0 20px;border-radius:15px;background:#ffdccb;color:#a33417;font-size:17px;font-weight:800',
      pSaved: s.pSaved,
      pNext: () => { this.savePlot(false); if (pstep < 4) this.setState({ pstep: pstep + 1 }); },
      pBack: () => { if (pstep > 1) this.setState({ pstep: pstep - 1 }); },
      pCanNext: pstep === 1 ? !!(pf.city && pf.area) : true, pSave: () => this.savePlot(),
      pSaveDraft: () => this.saveDraft(),
      pNextLabel: { 1: 'Next — seller', 2: 'Next — photos', 3: 'Next — MAPCO Earth' }[pstep] || 'Next',
      pLab: 'display:block;font-size:16px;font-weight:800;color:#5c4a2a;margin-bottom:8px',
      pKindWord: (this.groupOf(pf.type) === 'plot' ? 'plot' : this.groupOf(pf.type) === 'comm' ? 'unit' : 'home'),
      pPriceEcho: (() => { const v = parseFloat(pf.price); return isNaN(v) ? '—' : this.inr(v * 1e7); })(),
      pNextStyle: `display:flex;align-items:center;gap:10px;height:54px;padding:0 24px;border-radius:15px;font-size:17.5px;font-weight:800;${(pstep === 1 ? !!(pf.city && pf.area) : true) ? 'background:#241d0c;color:#f8c200;box-shadow:0 14px 26px -16px rgba(36,29,12,.9)' : 'background:#e6dcc6;color:#a99878;cursor:not-allowed'}`,
      pFinishStyle: 'display:flex;align-items:center;gap:10px;height:54px;padding:0 26px;border-radius:15px;font-size:17.5px;font-weight:800;background:#1d7a43;background-image:linear-gradient(140deg,#27a05a,#125c31);color:#eafff2;box-shadow:0 16px 30px -16px rgba(11,111,57,.95)',
      plotsValue: m(portfolio), plotsReady: n(readyCount), plotsNeed: soldView ? m(soldEarn) : n(needCount), propsReady, propsNeedWork,
      hasReady: propsReady.length > 0, noReady: propsReady.length === 0, hasNeedWork: propsNeedWork.length > 0, plotCityName,
      plotScopeLabel: s.plotCity === 'all' ? '' : ' in ' + s.plotCity,
      plotCityOpen: s.plotCityOpen, togglePlotCity: () => this.setState({ plotCityOpen: !s.plotCityOpen }), plotCityGrid, plotCityLabel,
      plotCityBtnStyle: `display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:15px;background:#faf7ff;border:1px solid #e6ddcc;box-shadow:0 1px 2px rgba(30,28,22,.04);transition:border-color .12s`,
      plotCityCaret: s.plotCityOpen ? 'ph-bold ph-caret-up' : 'ph-bold ph-caret-down',
      cTotal: n(this.clients.length), cActive: n(this.clients.filter(c => c.status === 'active').length), cNew: n(this.newClients.length),
      clientItems, clientDetail, clientFilterChips, hasClients: clientItems.length > 0, noClients: clientItems.length === 0,
      onSearch: (e) => this.setState({ clientSearch: e.target.value }), clientSearch: s.clientSearch || '', closeClient: () => this.setState({ selectedClient: null }),
      demandRows, demandTopName, demandTopLine, demandTopKicker, demandTopIcon, demandTopBg, demandTopTag,
      dOpens: n(dOpens), dBuyers: n(dBuyers), dHot, dHotSub,
      dLinkOpens: n(this.clientLinks.reduce((a, l) => a + l.opens, 0)), dLinkSub: (this.clientLinks.filter(l => l.status === 'active').length || 0) + ' links live now', pieSegs, pieLegend, wantTiles, attentionRows,
      pieTop: pieLegend.slice(0, 5), pieTopPct: pieLegend[0] ? pieLegend[0].pct : '', pieTopName: pieLegend[0] ? pieLegend[0].city : '',
      todayTiles: (() => {
        const activeToday = new Set((this.clientLinks || []).filter(l => (l.events || []).some(e => e.m < 1440)).map(l => l.clientId)).size || 5;
        const followUps = (this.clients || []).filter(c => { try { return ['active', 'attention'].includes(this.contactState(c)); } catch (e) { return false; } }).length || 3;
        const stale = (this.properties || []).filter(p => p.status === 'available' && p.ps && p.ps.availConfirmed === false).length || 2;
        const sentIds = new Set([].concat(...(this.clientLinks || []).map(l => l.props || [])));
        const mktReady = (this.properties || []).filter(p => p.status === 'available' && (p.photoCount || 0) >= 6 && !sentIds.has(p.id)).length || 4;
        const T = [
          {
            l: 'Clients active today', s: 'Viewed links or properties', v: activeToday, ic: 'ph-fill ph-eye',
            bg: '#0f7a45', bgi: 'linear-gradient(145deg,#17a05c 0%,#0f7a45 55%,#075c32 100%)', fg: '#eafff2', dim: '#a8e3c3', glow: '#2fd07f', f: 'See who', go: () => this.setState({ tab: 'links', linksTab: 'follow' })
          },
          {
            l: 'Follow-ups', s: 'Real reasons to contact them', v: followUps, ic: 'ph-fill ph-phone-call',
            bg: '#f8a800', bgi: 'linear-gradient(145deg,#ffca4d 0%,#f8a800 55%,#d18800 100%)', fg: '#241d0c', dim: '#7a5300', glow: '#ffd166', f: 'Open follow-ups', go: () => this.setState({ tab: 'links', linksTab: 'follow' })
          },
          {
            l: 'Properties to check', s: 'Seller availability getting old', v: stale, ic: 'ph-fill ph-clock-countdown',
            bg: '#c0490c', bgi: 'linear-gradient(145deg,#e2571f 0%,#c0490c 55%,#963406 100%)', fg: '#fff3ea', dim: '#f3c3a4', glow: '#ff8a4c', f: 'Check these', go: () => this.setState({ tab: 'inventory' })
          },
          {
            l: 'Marketing ready', s: 'Posts and reels ready to go', v: mktReady, ic: 'ph-fill ph-megaphone',
            bg: '#4a2c99', bgi: 'linear-gradient(145deg,#6b3fd4 0%,#4a2c99 55%,#341c73 100%)', fg: '#f1ebff', dim: '#c6b3ee', glow: '#8b6bee', f: 'Make a post', go: () => this.setState({ tab: 'inventory' })
          }];
        return T.map(t => ({
          label: t.l, sub: t.s, count: String(t.v), icon: t.ic, foot: t.f, go: t.go,
          card: `position:relative;overflow:hidden;text-align:left;border-radius:26px;padding:24px 26px 22px;background:${t.bg};background-image:${t.bgi};box-shadow:0 22px 46px -26px ${t.bg};transition:transform .16s,box-shadow .16s;cursor:pointer`,
          glow: `position:absolute;top:-70px;right:-50px;width:190px;height:190px;border-radius:50%;background:${t.glow};opacity:.28;filter:blur(14px);pointer-events:none`,
          iconBox: `width:52px;height:52px;border-radius:17px;flex:none;display:grid;place-items:center;background:rgba(255,255,255,.2);color:${t.fg}`,
          kicker: `font-size:13px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:${t.fg};line-height:1.25`,
          subStyle: `flex:1;min-width:0;font-size:15.5px;font-weight:700;color:${t.dim};text-wrap:pretty`,
          numStyle: `font-family:'Newsreader',serif;font-weight:600;font-size:62px;line-height:.85;color:${t.fg};flex:none`,
          footStyle: `position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:18px;padding-top:14px;border-top:1.5px solid rgba(255,255,255,.22);font-size:15px;font-weight:800;color:${t.fg}`
        }));
      })(),
      vsCols: (() => {
        const rows = demandRows.slice(0, 6);
        const mxO = Math.max(1, ...rows.map(r => r.opens)), mxS = Math.max(1, ...rows.map(r => r.stockCount));
        return rows.map(r => {
          const short = (r.opens / mxO) > (r.stockCount / mxS);
          const hA = Math.max(16, Math.round(r.opens / mxO * 146)), hB = Math.max(16, Math.round(r.stockCount / mxS * 146));
          const bar = (hh, bg) => `width:30px;height:${hh}px;border-radius:9px 9px 4px 4px;background:${bg};display:flex;align-items:flex-start;justify-content:center;padding-top:4px;transform-origin:bottom;animation:barGrow .8s cubic-bezier(.2,.8,.2,1) both`;
          return {
            city: r.city, opens: r.opens, stock: r.stockCount,
            barA: bar(hA, 'linear-gradient(180deg,#8a63e8,#5b32c4)'), labA: 'font-size:12px;font-weight:800;color:#fff',
            barB: bar(hB, 'linear-gradient(180deg,#ffdc7a,#f4ae14)'), labB: 'font-size:12px;font-weight:800;color:#241d0c',
            chip: short ? 'Source more' : 'Covered',
            chipStyle: `font-size:11px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap;${short ? 'background:#ffd3de;color:#c2185b' : 'background:#c9f0d9;color:#0b8f45'}`
          };
        });
      })(),
      wantBars: (() => {
        const rows = this.WANTS.map(w => ({
          want: w,
          opens: this.properties.filter(pr => pr.want === w).reduce((a, pr) => a + (pr.views || 0), 0),
          stock: this.properties.filter(pr => pr.want === w && pr.status !== 'sold').length
        }));
        const mx = Math.max(1, ...rows.map(r => r.opens));
        return rows.sort((a, b) => b.opens - a.opens).map(r => {
          const none = r.opens === 0;
          return {
            want: r.want, opens: r.opens,
            barStyle: `height:100%;width:${Math.max(6, Math.round(r.opens / mx * 100))}%;border-radius:999px;background:${none ? '#c4b183' : '#6b3fd4'};transform-origin:left;animation:barGrow .85s cubic-bezier(.2,.8,.2,1) both`,
            tag: none ? 'never opened yet' : (r.stock + ' in stock'),
            tagStyle: `font-size:12.5px;font-weight:800;padding:4px 10px;border-radius:999px;white-space:nowrap;${none ? 'background:#f3eeff;color:#8a7a52' : 'background:#ded0fa;color:#5b32c4'}`
          };
        });
      })(),
      tableRows: demandRows.map((r, i) => {
        const col = ['#f4ae14', '#6b3fd4', '#146c3a', '#c2622a', '#c2185b', '#0f6f8a', '#a8600c', '#5b32c4', '#8a7a52'][i % 9];
        const thin = r.stockCount <= 2;
        const links = this.clientLinks.filter(l => l.props.some(pid => { const pr = this.properties.find(x => x.id === pid); return pr && pr.city === r.city; })).length;
        return {
          city: r.city, opens: r.opens, links, stock: r.stockCount, go: r.go,
          rowStyle: 'width:100%;display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr 1.2fr;gap:12px;align-items:center;padding:14px 22px;border-bottom:1px solid #f6e8c8;cursor:pointer;text-align:left;transition:background .12s',
          dotStyle: `width:12px;height:12px;border-radius:4px;flex:none;background:${col}`,
          chip: thin ? 'Need more stock' : 'Well covered',
          chipStyle: `display:inline-block;font-size:12px;font-weight:800;padding:6px 12px;border-radius:999px;white-space:nowrap;${thin ? 'background:#ffd3de;color:#c2185b' : 'background:#c9f0d9;color:#0b8f45'}`
        };
      }),
      addOpen: s.addOpen, closeAdd: () => this.setState({ addOpen: false }), doAdd: () => this.submitAdd(), cityOptions: this.CITIES, propOptions,
      wiz: wz, onWizInput: (e) => this.onWiz(e), wizStep: wstep, wizStepName: STEPNAME[wstep], wizTitle: STEPTITLE[wstep], wizBars, wizChips,
      wizS1: wstep === 1, wizS2: wstep === 2, wizS3: wstep === 3, wizNotLast: wstep < 3, wizCanBack: wstep > 1,
      wizBack: () => this.wizBack(), wizNext: () => { if (canNext) this.wizNext(); },
      wizNextLabel: wstep === 1 ? 'Next: the property' : 'Next: the money',
      wizNextStyle: `display:flex;align-items:center;gap:9px;padding:15px 24px;border-radius:13px;font-size:15.5px;font-weight:800;transition:all .15s;${canNext ? 'background:#6b3fd4;color:#fff;box-shadow:0 14px 28px -14px rgba(107,63,212,.7)' : 'background:#ddd2f5;color:#a89e8b;cursor:not-allowed'}`,
      wizHint: wstep === 1 ? (s1ok ? '' : 'Pick a customer, or add a new one') : wstep === 2 ? (s2ok ? '' : 'Pick a plot, or type it in yourself') : 'Rough numbers are fine — you can edit them later.',
      wizClients, wizProps, wizNoClients: wizClients.length === 0, wizNoProps: wizProps.length === 0, wizStageChips,
      wizNamePh: (buyerName || 'This deal') + (propName ? ' · ' + propName.split(' · ').slice(-1)[0] : ''),
      newClientBtnStyle: `width:100%;display:flex;align-items:center;gap:13px;padding:14px 15px;border-radius:15px;border:2px solid ${wz.useNewClient ? '#6b3fd4' : '#f0d493'};background:${wz.useNewClient ? '#f4eeff' : '#fffaf0'};cursor:pointer;margin-top:12px;transition:all .15s`,
      newClientCaret: wz.useNewClient ? 'ph-bold ph-caret-up' : 'ph-bold ph-caret-down',
      toggleNewClient: () => this.setWiz({ useNewClient: !wz.useNewClient, clientId: '' }),
      manualPropBtnStyle: `width:100%;display:flex;align-items:center;gap:13px;padding:14px 15px;border-radius:15px;border:2px solid ${wz.useManualProp ? '#6b3fd4' : '#eed9a8'};background:${wz.useManualProp ? '#f4eeff' : '#fffaf0'};cursor:pointer;margin-top:12px;transition:all .15s`,
      manualPropCaret: wz.useManualProp ? 'ph-bold ph-caret-up' : 'ph-bold ph-caret-down',
      toggleManualProp: () => this.setWiz({ useManualProp: !wz.useManualProp, propId: '' }),
      addClientOpen: s.addClientOpen, openAddClient: () => this.setState({ addClientOpen: true }), closeAddClient: () => this.setState({ addClientOpen: false }),
      cformInitials: this.initialsOf(s.cform.name || '  '), doAddClient: () => this.submitAddClient(), onCForm: (e) => this.onCFormInput(e), cform: s.cform,
      cWantChips: wantChips.map(w => ({
        label: w.label, go: w.go,
        style: `padding:11px 15px;border-radius:12px;font-size:14.5px;font-weight:700;transition:all .16s;${s.cform.want === w.label ? 'background:#6b3fd4;color:#fff;border:1px solid #6b3fd4' : 'background:#faf7ff;color:#6b6156;border:1px solid #ddd0f5'}`
      })),
      cSave: () => { if ((s.cform.name || '').trim()) this.submitAddClient(); },
      cSaveStyle: `padding:15px 26px;border-radius:14px;font-size:15.5px;font-weight:800;transition:all .2s;${(s.cform.name || '').trim() ? 'background:#6b3fd4;color:#fff;box-shadow:0 14px 26px -16px rgba(107,63,212,.95)' : 'background:#e9e1f8;color:#a89cc4'}`,
      cwantChips: wantChips, cunitChips: unitChips, newClientImg: 'client-photo-' + nextClientId,
      ...(() => {
        const R = (m) => this.relT(m), CS = this.CSTATE, EM = this.EVMETA;
        const liveC = this.clients.filter(c => !c.archived), liveS = this.sellers.filter(x => !x.archived);
        const linksOf = (id) => this.clientLinks.filter(l => l.clientId === id);
        const lastActOf = (id) => { const ev = linksOf(id).reduce((a, l) => a.concat(l.events || []), []); return ev.length ? Math.min(...ev.map(e => e.m)) : null; };
        const boughtOf = (c) => this.properties.filter(pr => pr.sale && pr.sale.buyerId === c.id);
        const reqLine = (c) => {
          const t = (c.types || []).join(', '); const a = (c.areas || [])[0] || c.city;
          return [t || 'Type not noted', a ? ('in ' + a) : ''].filter(Boolean).join(' ');
        };
        const pillS = (bg, col) => `display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border-radius:999px;font-size:14px;font-weight:800;background:${bg};color:${col}`;
        const q = (s.cliQ || '').toLowerCase().trim();
        const stCount = (k) => liveC.filter(c => this.contactState(c) === k).length;
        const cliDefs = [{ k: 'attention', l: 'Needs attention', n: stCount('attention') }, { k: 'bought', l: 'Bought', n: stCount('bought') }, { k: 'active', l: 'Hot', n: stCount('active') }]; const cliDefsOld = [{ k: 'all', l: 'Everyone', n: liveC.length }, { k: 'active', l: 'Active', n: stCount('active') }, { k: 'attention', l: 'Needs details', n: stCount('attention') }, { k: 'bought', l: 'Bought', n: stCount('bought') }, { k: 'new', l: 'New', n: stCount('new') }, { k: 'quiet', l: 'Quiet', n: stCount('quiet') }];
        const cliCards = liveC
          .filter(c => s.cliFilter === 'all' || this.contactState(c) === s.cliFilter)
          .filter(c => !q || ((c.name + ' ' + c.phone + ' ' + c.city + ' ' + (c.business || '') + ' ' + (c.types || []).join(' ') + ' ' + (c.areas || []).join(' ') + ' ' + (c.budget || '')).toLowerCase().includes(q)))
          .map(c => {
            const st = this.contactState(c), m = CS[st], la = lastActOf(c.id);
            const live = linksOf(c.id).filter(l => l.status === 'active').length;
            const bought = boughtOf(c);
            return {
              id: c.id, name: c.name, initials: this.initialsOf(c.name), phone: c.phone, tel: this.tel(c.phone), wa: this.waLink(c.phone),
              business: c.business || '', hasBiz: !!c.business,
              stateLabel: m.l, stateIcon: m.i, stateStyle: pillS(m.b, m.c),
              reqLine: reqLine(c), budget: c.budget && c.budget !== '—' ? c.budget : 'Budget not noted',
              stage: c.stage || 'Just looking',
              linkLine: live ? (live === 1 ? '1 live link' : live + ' live links') : 'No live link',
              linkStyle: `display:inline-flex;align-items:center;gap:7px;font-size:14.5px;font-weight:800;${live ? 'color:#4a2c99' : 'color:#9a8f80'}`,
              actLine: la !== null ? ('Last activity ' + R(la)) : 'No link activity yet',
              boughtLine: bought.length ? (bought.length === 1 ? 'Bought 1 property' : 'Bought ' + bought.length + ' properties') : '',
              hasBought: bought.length > 0,
              needsWork: st === 'attention',
              keyOpen: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); deskStore.loadClientWorkspace(c.id); this.setState({ selectedClient: c.id, cpTab: 'overview' }); } },
              sendLink: (e) => {
                if (e && e.stopPropagation) e.stopPropagation();
                this.setState({ selectedClient: null, linkBuild: 'new', lstep: 3, lSearchQ: '', lSearchQ2: '', lform: { ...this.blankL(), clientId: c.id } });
              },
              cardStyle: (st === 'bought'
                ? 'min-width:0;text-align:left;background:#fff4d1;background-image:linear-gradient(150deg,#fff9e4,#ffeeb4);border-radius:22px;padding:20px 22px 20px 24px;border-left:10px solid #9a6a00;box-shadow:0 0 0 2px #f0c95e,0 20px 44px -26px rgba(150,105,0,.8);transition:transform .13s,box-shadow .13s;cursor:pointer'
                : (st === 'attention'
                  ? 'min-width:0;text-align:left;background:#ffe7e1;background-image:linear-gradient(155deg,#fff2ee,#ffdbd2);border-radius:22px;padding:20px 22px 20px 24px;border-left:10px solid #b02a37;box-shadow:0 0 0 2px #f6b6a6,0 18px 40px -28px rgba(150,40,20,.65);transition:transform .13s,box-shadow .13s;cursor:pointer'
                  : 'min-width:0;text-align:left;background:' + m.b + ';background-image:linear-gradient(155deg,rgba(255,255,255,.82),rgba(255,255,255,.14) 66%);border-radius:22px;padding:20px 22px 20px 24px;border-left:10px solid ' + m.c + ';box-shadow:0 0 0 1.5px rgba(60,40,10,.08),0 16px 38px -30px rgba(40,30,10,.7);transition:transform .13s,box-shadow .13s;cursor:pointer')),
              avStyle: `width:54px;height:54px;border-radius:17px;flex:none;display:grid;place-items:center;font-size:19px;font-weight:800;background:${m.b};color:${m.c}`,
              open: () => this.setState({ selectedClient: c.id, cliEdit: false, noteDraft: '', cpTab: 'overview', cpPick: false, cpPickQ: '' }), stop: (e) => e.stopPropagation()
            };
          });
        const sq = (s.sellQ || '').toLowerCase().trim();
        const sellCards = liveS.filter(x => !sq || ((x.name + ' ' + x.phone + ' ' + (x.business || '') + ' ' + x.city + ' ' + x.kind).toLowerCase().includes(sq)))
          .map(sl => {
            /* Counts and availability come from the canonical seller
               directory, computed server-side in one round trip — never
               from a local join against a separate property collection. */
            const props = sl.props || [];
            const live = props.filter(p => !p.sold), sold = props.filter(p => p.sold);
            const cps = live.filter(p => p.lastConfirmed);
            const okPs = cps.find(p => p.availConfirmed), stalePs = cps.find(p => !p.availConfirmed);
            const conf = okPs ? okPs.lastConfirmed : ''; const stale = !okPs && stalePs ? stalePs.lastConfirmed : '';
            return {
              id: sl.id, name: sl.name, initials: this.initialsOf(sl.name), phone: sl.phone, tel: this.tel(sl.phone),
              business: sl.business || '', hasBiz: !!sl.business, kind: sl.kind, city: sl.city || '—',
              kindStyle: pillS('#efe8fb', '#4a2c99'),
              liveN: String(live.length), soldN: String(sold.length),
              liveLabel: live.length === 1 ? 'property' : 'properties',
              confLine: conf ? ('Availability confirmed ' + conf.toLowerCase()) : (stale ? ('Not confirmed since ' + stale.toLowerCase()) : 'Availability never confirmed'),
              confStyle: `font-size:14.5px;font-weight:700;${conf ? 'color:#0a6634' : 'color:#a3541b'}`,
              note: sl.note || '', hasNote: !!sl.note,
              chips: live.slice(0, 3).map(p => ({
                label: (p.loc || 'Property').split(',')[0]
                  + (p.askPrice || p.price ? ' · ' + this.inr(p.askPrice || p.price) : ''),
                style: 'display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;background:#f4eeff;color:#4a2c99;font-size:13.5px;font-weight:800'
              })),
              cardStyle: 'min-width:0;text-align:left;background:#fffdf7;border-radius:22px;padding:20px 22px;box-shadow:0 0 0 1.5px #e2d8ee,0 16px 38px -30px rgba(40,30,10,.7);transition:transform .13s;cursor:pointer',
              avStyle: 'width:54px;height:54px;border-radius:17px;flex:none;display:grid;place-items:center;font-size:19px;font-weight:800;background:#efe8fb;color:#4a2c99',
              open: () => { deskStore.loadSellerWorkspace(sl.id); this.setState({ sellerView: sl.id }); }, stop: (e) => e.stopPropagation()
            };
          });
        const cf = s.cf, cfDupC = this.dupClient(cf.phone, s.cliEdit ? s.selectedClient : null);
        const chip = (on, onBg, onC) => `display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:10px 18px;border-radius:14px;font-size:16px;font-weight:800;line-height:1.2;text-align:left;transition:all .15s;${on ? 'background:' + onBg + ';color:' + onC : 'background:#fff;color:#5c4a2a;box-shadow:inset 0 0 0 1.5px #e3d9c6'}`;
        const cfOK = !!(cf.name || '').trim() && !!(cf.phone || '').trim();
        const sf2 = s.sf2, sfDupS = this.dupSeller(sf2.phone), sfOK = !!(sf2.name || '').trim() && !!(sf2.phone || '').trim();
        /* ----- client profile ----- */
        let cp = null;
        const pc = s.selectedClient ? this.clients.find(x => x.id === s.selectedClient) : null;
        if (pc) {
          const st = this.contactState(pc), m = CS[st]; const myLinks = linksOf(pc.id);
          const relMap = {};
          for (const pid of (pc.interest || [])) { relMap[pid] = relMap[pid] || { pid, shown: true, sent: false, views: 0, lastM: null, visit: false }; }
          for (const l of myLinks) {
            for (const pid of l.props) {
              const a = this.propAct(l, pid);
              const r = relMap[pid] = relMap[pid] || { pid, shown: false, sent: false, views: 0, lastM: null, visit: false };
              r.sent = true; r.views += a.views; r.visit = r.visit || a.visit;
              if (a.lastM !== null && (r.lastM === null || a.lastM < r.lastM)) r.lastM = a.lastM;
            }
          }
          for (const pr of boughtOf(pc)) { const r = relMap[pr.id] = relMap[pr.id] || { pid: pr.id, shown: false, sent: false, views: 0, lastM: null, visit: false }; r.bought = true; }
          const cpGroup = s.cpGroup || 'shortlisted';
          const propRows = Object.values(relMap).map(r => {
            const pr = this.properties.find(x => x.id === r.pid); if (!pr) return null;
            const tags = []; if (r.shown) tags.push({ l: 'You shortlisted this', i: 'ph-fill ph-bookmark-simple', b: '#fff0d6', c: '#a3541b' });
            if (r.sent) tags.push({ l: 'Sent in a link', i: 'ph-fill ph-paper-plane-tilt', b: '#efe8fb', c: '#4a2c99' });
            if (r.views) tags.push({ l: r.views === 1 ? 'Viewed once' : 'Viewed ' + r.views + ' times', i: 'ph-fill ph-eye', b: '#fdf0dd', c: '#8a5a12' });
            if (r.visit) tags.push({ l: 'Asked for a site visit', i: 'ph-fill ph-footprints', b: '#ffdfe2', c: '#b02a37' });
            if (r.bought) tags.push({ l: 'Purchased', i: 'ph-fill ph-seal-check', b: '#d3f2e0', c: '#0a6634' });
            if (r.sent && !r.views) tags.push({ l: 'Not viewed yet', i: 'ph-fill ph-eye-slash', b: '#f0ece4', c: '#6b6156' });
            return {
              title: pr.type + ' · ' + pr.size, loc: pr.loc, priceFmt: this.inr(r.bought && pr.sale ? pr.sale.price : pr.price),
              thumb: `width:82px;height:70px;border-radius:14px;flex:none;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center`,
              lastLine: r.lastM !== null ? ('Last viewed ' + R(r.lastM)) : '',
              hasLast: r.lastM !== null,
              tags: tags.map(t => ({ label: t.l, icon: t.i, style: pillS(t.b, t.c) })),
              isBought: !!r.bought,
              wrapStyle: r.bought
                ? 'display:flex;align-items:flex-start;gap:14px;width:100%;padding:15px 17px;border-radius:18px;background:#f1fbf6;box-shadow:inset 0 0 0 2px #a9dcc0'
                : 'display:flex;align-items:flex-start;gap:14px;width:100%;padding:15px 17px;border-radius:18px;background:#f3f7fd;box-shadow:inset 0 0 0 1.5px #d3e2f5',
              likeLabel: (pc.interest || []).includes(pr.id) ? 'Shortlisted' : 'Shortlist',
              likeIcon: (pc.interest || []).includes(pr.id) ? 'ph-fill ph-bookmark-simple' : 'ph ph-bookmark-simple',
              likeStyle: `display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;border-radius:13px;font-size:15.5px;font-weight:800;white-space:nowrap;${(pc.interest || []).includes(pr.id) ? 'background:#ffe0e6;color:#b02a37' : 'background:#fff;color:#6b6156;box-shadow:inset 0 0 0 1.5px #d3e2f5'}`,
              toggleLike: () => this.toggleLike(pc.id, pr.id),
              go: () => this.setState({ selectedClient: null, section: 'properties', propDetail: pr.id, propShot: 0, pdTab: 'gallery', pdMedia: 'photos' })
            };
          }).filter(Boolean);
          const evAll = myLinks.reduce((a, l) => a.concat((l.events || []).map(e => ({ ...e, lid: l.id }))), []).sort((a, b) => a.m - b.m).slice(0, 14);
          const dls = this.deals.filter(d => d.client === pc.name);
          const bought = boughtOf(pc);
          const cpTab = s.cpTab || 'overview';
          const CPT = [
            { k: 'overview', l: 'Overview', i: 'ph-fill ph-user-focus', sub: 'What you know' },
            { k: 'activity', l: 'Activity', i: 'ph-fill ph-activity', sub: (evAll.length || 'No') + ' events · ' + myLinks.length + (myLinks.length === 1 ? ' link' : ' links') },
            { k: 'props', l: 'Properties', i: 'ph-fill ph-buildings', sub: (propRows.length || 'No') + (propRows.length === 1 ? ' property' : ' properties') },
            { k: 'deals', l: 'Deals', i: 'ph-fill ph-handshake', sub: (dls.length || 'No') + (dls.length === 1 ? ' deal · ' : ' deals · ') + (bought.length || 'no') + ' bought' }
          ];
          const cpTabs = CPT.map(t => {
            const on = cpTab === t.k; return {
              label: t.l, icon: t.i, sub: t.sub, go: () => this.setState({ cpTab: t.k }),
              style: `display:flex;align-items:center;gap:10px;height:48px;padding:0 20px;border-radius:14px;flex:none;transition:all .15s;${on ? 'background:#ffffff;color:#3b1464;box-shadow:0 4px 14px rgba(0,0,0,.35);' : 'background:transparent;color:rgba(255,255,255,.8);'}`,
              subStyle: `font-size:12px;font-weight:700;${on ? 'color:#6d28d9' : 'color:rgba(255,255,255,.65)'}`
            };
          });
          cp = {
            id: pc.id, name: pc.name, initials: this.initialsOf(pc.name), phone: pc.phone, phone2: pc.phone2 || '', hasPhone2: !!pc.phone2,
            tel: this.tel(pc.phone), wa: this.waLink(pc.phone), business: pc.business || '', hasBiz: !!pc.business,
            city: pc.city || '—', stateLabel: m.l, stateIcon: m.i, stateStyle: pillS(m.b, m.c),
            tabs: cpTabs, isOverview: cpTab === 'overview', isActivity: cpTab === 'activity', isProps: cpTab === 'props', isDeals: cpTab === 'deals',
            avStyle: `width:66px;height:66px;border-radius:20px;flex:none;display:grid;place-items:center;font-size:23px;font-weight:800;background:${m.b};color:${m.c}`,
            noLinks: myLinks.length === 0, noDeals: dls.length === 0,
            noteInput: 'flex:1;min-width:240px;height:54px;padding:0 17px;border-radius:14px;border:none;outline:none;background:#fff6f2;box-shadow:inset 0 0 0 1.5px #f6dcd4;font-size:16.5px;font-weight:600;color:#241f1c',
            first: (pc.name || '').split(' ')[0],
            pickOpen: !!s.cpPick, openPick: () => this.setState({ cpPick: true, cpPickQ: '' }), closePick: () => this.setState({ cpPick: false, cpPickQ: '' }),
            pickQ: s.cpPickQ || '', onPickQ: (e) => this.setState({ cpPickQ: e.target.value }),
            pickCount: String((pc.interest || []).length),
            pickList: (() => {
              const q = (s.cpPickQ || '').toLowerCase().trim();
              return this.properties.filter(pr => pr.status !== 'sold')
                .filter(pr => !q || ((pr.type + ' ' + pr.loc + ' ' + pr.city + ' ' + pr.size).toLowerCase().includes(q)))
                .map(pr => {
                  const on = (pc.interest || []).includes(pr.id);
                  return {
                    title: pr.type + ' · ' + pr.size, loc: pr.loc.split(',')[0], priceFmt: this.inr(pr.price),
                    thumb: `width:56px;height:46px;border-radius:11px;flex:none;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center`,
                    style: `display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:14px;width:100%;transition:all .13s;${on ? 'background:#f8a800' : 'background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.14)'}`,
                    titleColor: on ? 'color:#241d0c' : 'color:#fff', subColor: on ? 'color:#5c4405' : 'color:#c9b892',
                    tickIcon: on ? 'ph-fill ph-check-circle' : 'ph ph-plus-circle',
                    tickStyle: `flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;${on ? 'background:rgba(0,0,0,.14);color:#241d0c' : 'background:rgba(255,255,255,.12);color:#f8c200'}`,
                    go: () => this.toggleLike(pc.id, pr.id)
                  };
                });
            })(),
            pickNone: (() => {
              const q = (s.cpPickQ || '').toLowerCase().trim(); if (!q) return false;
              return !this.properties.some(pr => pr.status !== 'sold' && (pr.type + ' ' + pr.loc + ' ' + pr.city + ' ' + pr.size).toLowerCase().includes(q));
            })(),
            stage: pc.stage || 'Just looking',
            types: (pc.types || []).map(t => ({ label: t, style: pillS('#fff0d6', '#a3541b') })), hasTypes: (pc.types || []).length > 0,
            areas: (pc.areas || []).map(t => ({ label: t, style: pillS('#e4f1fa', '#0f5f7a') })), hasAreas: (pc.areas || []).length > 0,
            prefs: (pc.prefs || []).map(t => ({ label: t, style: pillS('#f0ece4', '#5c4a2a') })), hasPrefs: (pc.prefs || []).length > 0,
            budget: pc.budget && pc.budget !== '—' ? pc.budget : 'Not noted',
            size: (pc.sizeFrom || pc.sizeTo) ? [pc.sizeFrom, pc.sizeTo].filter(Boolean).join(' – ') + ' sq yd' : 'Not noted',
            needsAttention: st === 'attention',
            missing: [!(pc.types || []).length && 'what they want', !(pc.areas || []).length && 'preferred area', !pc.bFrom && !pc.budgetMax && 'budget', !(pc.notes || []).length && 'a note'].filter(Boolean).join(', '),
            notes: (pc.notes || []).map(nt => ({ when: nt.t, text: nt.x })), hasNotes: (pc.notes || []).length > 0,
            noteDraft: s.noteDraft || '', onNote: (e) => this.setState({ noteDraft: e.target.value }), addNote: () => this.addNote(),
            propRows: propRows.filter(r => cpGroup === 'sold' ? r.isBought : !r.isBought),
            hasProps: propRows.length > 0,
            groupTabs: [{ k: 'shortlisted', l: 'Shortlisted', i: 'ph-fill ph-bookmark-simple', n: propRows.filter(r => !r.isBought).length, c: '#1a5aa8', b: '#e1ecfb', r: '#c0d7f4' },
            { k: 'sold', l: 'Sold to them', i: 'ph-fill ph-seal-check', n: propRows.filter(r => r.isBought).length, c: '#0a7a42', b: '#d7f0e2', r: '#a9dcc0' }]
              .map(t => {
                const on = cpGroup === t.k; return {
                  label: t.l, icon: t.i, count: String(t.n), go: () => this.setState({ cpGroup: t.k }),
                  style: `display:flex;align-items:center;gap:9px;height:52px;padding:0 20px;border-radius:15px;font-size:16.5px;font-weight:800;white-space:nowrap;flex:none;transition:all .15s;${on ? `background:${t.c};color:#fff` : `background:${t.b};color:${t.c};box-shadow:inset 0 0 0 2px ${t.r}`}`,
                  numStyle: `font-size:13.5px;font-weight:800;border-radius:999px;padding:1px 9px;${on ? 'background:rgba(255,255,255,.24)' : 'background:#fff'}`
                };
              }),
            emptyGroup: cpGroup === 'sold' ? 'They have not bought anything from you yet.' : 'Nothing shortlisted yet. Use “Shortlist properties” to mark the ones you discussed.',
            links: myLinks.map(l => {
              const LS = { active: { l: 'Live', c: '#0a6634', b: '#d3f2e0' }, expired: { l: 'Expired', c: '#8a7a52', b: '#f0ece4' }, revoked: { l: 'Stopped', c: '#b02a37', b: '#ffdfe2' } }[l.status];
              return {
                title: l.props.length === 1 ? ((this.properties.find(p => p.id === l.props[0]) || {}).loc || 'Property') : (l.props.length + ' properties in one link'),
                sub: 'Sent ' + l.created + (l.expires ? (' · expires ' + l.expires) : ''),
                statusLabel: LS.l, statusStyle: pillS(LS.b, LS.c), isLive: l.status === 'active',
                stats: [{ label: 'Real opens', value: l.opens ? (l.opens === 1 ? '1 open' : l.opens + ' opens') : 'Never opened' },
                { label: 'Last activity', value: (l.lastActM !== null && l.lastActM !== undefined) ? R(l.lastActM) : '—' },
                { label: 'Expiry', value: l.expires || 'No expiry set' }],
                props: l.props.map(pid => {
                  const pr = this.properties.find(x => x.id === pid); const a = this.propAct(l, pid);
                  return { label: (pr ? pr.loc.split(',')[0] : 'Property') + ' · ' + (a.views ? (a.views === 1 ? '1 view' : a.views + ' views') : 'no view') };
                }),
                wa: this.waLink(pc.phone),
                preview: () => this.setState({ selectedClient: null, mobileFor: l.props[0], mobileLink: l.id }),
                revoke: () => this.revokeLink(l.id),
                go: () => this.setState({ selectedClient: null, section: 'links', linkView: l.id, linkTab: 'focus' })
              };
            }),
            hasLinks: myLinks.length > 0,
            activity: evAll.map(e => {
              const md = EM[e.k]; const pr = e.p ? this.properties.find(x => x.id === e.p) : null;
              return {
                text: md.l + (pr ? (' — ' + pr.loc.split(',')[0]) : ''), when: R(e.m), icon: md.i,
                iconStyle: `width:42px;height:42px;border-radius:13px;flex:none;display:grid;place-items:center;font-size:20px;background:${md.b};color:${md.c}`
              };
            }),
            hasActivity: evAll.length > 0,
            deals: dls.map(d => {
              const mt = this.stageMeta(d.stage);
              return {
                name: d.name || d.prop, sub: d.propSub, valueFmt: this.inr(d.value), stageLabel: mt.label,
                pill: pillS(mt.bg, mt.color),
                go: () => this.setState({ selectedClient: null, selectedDeal: d.id, section: 'deals', dealEdit: false, delArm: false })
              };
            }),
            hasDeals: dls.length > 0,
            bought: bought.map(pr => ({
              title: pr.type + ' · ' + pr.size, loc: pr.loc, price: this.inr(pr.sale.price), when: pr.sale.date,
              go: () => this.setState({ selectedClient: null, section: 'properties', propDetail: pr.id })
            })),
            hasBought: bought.length > 0,
            editing: !!s.cliEdit, notEditing: !s.cliEdit,
            noTypes: (pc.types || []).length === 0, noAreas: (pc.areas || []).length === 0, noPrefs: (pc.prefs || []).length === 0,
            knowRows: [
              {
                label: 'What they are looking for', icon: 'ph-fill ph-house-line', col: '#a3541b',
                items: (pc.types || []).map(t => ({ label: t, style: pillS('#fff0d6', '#a3541b') })), empty: (pc.types || []).length === 0
              },
              {
                label: 'Preferred cities and sectors', icon: 'ph-fill ph-map-pin', col: '#1a5aa8',
                items: (pc.areas || []).map(t => ({ label: t, style: pillS('#e1ecfb', '#1a5aa8') })), empty: (pc.areas || []).length === 0
              },
              {
                label: 'What matters to them', icon: 'ph-fill ph-check-circle', col: '#0a7a42',
                items: (pc.prefs || []).map(t => ({ label: t, style: pillS('#d7f0e2', '#0a6634') })), empty: (pc.prefs || []).length === 0
              }],
            noNotes: (pc.notes || []).length === 0, noActivity: evAll.length === 0,
            noProps: propRows.filter(r => cpGroup === 'sold' ? r.isBought : !r.isBought).length === 0,
            archIdle: s.arch !== 'c',
            startEdit: () => this.setState({ cliEdit: true, cf: this.cfFrom(pc) }),
            cancelEdit: () => this.setState({ cliEdit: false, cf: this.blankCF() }),
            saveEdit: () => this.saveClientEdit(),
            sendLink: () => this.setState({ selectedClient: null, linkBuild: 'new', lstep: 1, lSearchQ: '', lSearchQ2: '', lform: { ...this.blankL(), clientId: pc.id } }),
            close: () => this.setState({ selectedClient: null, cliEdit: false, arch: null, cpPick: false, cpPickQ: '' }),
            archArm: s.arch === 'c', arm: () => this.setState({ arch: 'c' }), disarm: () => this.setState({ arch: null }),
            doArchive: () => this.archiveClient(pc.id)
          };
        }
        /* ----- client links command centre ----- */
        const allEv = this.clientLinks.reduce((a, l) => a.concat((l.events || []).map(e => ({ ...e, l }))), []).sort((a, b) => a.m - b.m);
        const feed = allEv.map(e => {
          const md = EM[e.k]; const pr = e.p ? this.properties.find(x => x.id === e.p) : null;
          const who = (e.l.client || '').split(' ')[0];
          return {
            text: who + ' ' + md.l.toLowerCase().replace('the link', 'their link') + (pr ? (' — ' + pr.loc.split(',')[0]) : ''), when: R(e.m), icon: md.i,
            iconStyle: `width:44px;height:44px;border-radius:14px;flex:none;display:grid;place-items:center;font-size:21px;background:${md.b};color:${md.c}`,
            cardStyle: `display:flex;align-items:center;gap:13px;width:100%;text-align:left;padding:13px 15px;border-radius:18px;background:linear-gradient(135deg, #f0f9ff, #dff2fd);box-shadow:0 0 0 1.5px #b0e0fa;border-left:8px solid #0284c7;transition:transform .12s;`,
            go: () => this.setState({ linkView: e.l.id, linkTab: 'focus' })
          };
        });
        const liveL = this.clientLinks.filter(l => l.status === 'active');
        const viewedToday = new Set(allEv.filter(e => e.k === 'view' && e.m <= 1440).map(e => e.l.clientId)).size;
        const neverOpened = liveL.filter(l => !l.opens).length;
        const followList = this.clientLinks.filter(l => l.status !== 'revoked').map(l => ({ l, r: this.followReasons(l) })).filter(x => x.r.length);
        const lq = (s.lkQ || '').toLowerCase().trim();
        const LSTAT = { active: { l: 'Live', c: '#0a7a42', b: '#cdf0dd', card: '#f1fbf6', ring: '#b3e2c8' }, expired: { l: 'Expired', c: '#8a7a52', b: '#f0ece4', card: '#faf8f3', ring: '#e4ddd0' }, revoked: { l: 'Stopped', c: '#b02a37', b: '#ffdfe2', card: '#fff4f5', ring: '#f3c7cc' } };
        const linkVM = (l) => {
          const props = l.props.map(pid => this.properties.find(p => p.id === pid)).filter(Boolean);
          const st = LSTAT[l.status] || LSTAT.active;
          return {
            id: l.id, status: l.status, client: l.client || '—', initials: this.initialsOf(l.client || '?'),
            sub: 'Sent ' + l.created + ' · ' + (l.status === 'active' ? ('expires ' + l.expires) : st.l.toLowerCase()),
            statusLabel: st.l, statusStyle: `display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 13px;border-radius:999px;font-size:13px;font-weight:800;background:rgba(255,255,255,.2);color:#ffffff;border:1px solid rgba(255,255,255,.3)`,
            cardStyle: `background:${st.card};border-radius:24px;padding:22px 24px 22px 22px;border-left:10px solid ${st.c};box-shadow:0 0 0 1.5px ${st.ring},0 18px 40px -32px rgba(40,30,10,.8)`,
            avStyle: `width:52px;height:52px;border-radius:17px;flex:none;display:grid;place-items:center;font-size:18px;font-weight:800;background:${st.b};color:${st.c}`,
            opened: l.opens ? ((l.opens === 1 ? 'Opened once' : 'Opened ' + l.opens + ' times') + ' · last ' + l.lastOpen) : 'Not opened yet',
            openedStyle: `font-size:15.5px;font-weight:800;${l.opens ? 'color:#a5f3c8' : 'color:#fcd34d'}`,
            propRows: props.map(pr => {
              const a = this.propAct(l, pr.id);
              const none = a.views === 0;
              return {
                title: pr.type + ' · ' + pr.size, loc: pr.loc,
                thumb: `width:64px;height:56px;border-radius:12px;flex:none;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center;${none ? 'filter:grayscale(.75) opacity(.65)' : ''}`,
                viewLine: none ? 'Not viewed' : (a.views === 1 ? '1 view' : a.views + ' views'),
                viewStyle: `font-family:'Newsreader',serif;font-weight:600;font-size:24px;${none ? 'color:#8a8073' : 'color:#1a5aa8'}`,
                titleColor: none ? 'color:#5c5449' : 'color:#123a6b', subColor: none ? 'color:#8a8073' : 'color:#5b7fab',
                whenLine: a.lastM !== null ? ('Last viewed ' + R(a.lastM)) : '—',
                extra: [a.earth && { l: 'Opened the map', i: 'ph-fill ph-globe-hemisphere-east', b: '#dcf0f7', c: '#0f6f8a' },
                a.photos && { l: 'Photos', i: 'ph-fill ph-images', b: '#ffeec4', c: '#a8600c' },
                a.visit && { l: 'Site visit asked', i: 'ph-fill ph-footprints', b: '#ffdfe2', c: '#b02a37' }].filter(Boolean)
                  .map(t => ({ label: t.l, icon: t.i, style: pillS(t.b, t.c) })),
                rowStyle: `display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:16px;background:${none ? '#f2efe8' : '#eef4fd'};box-shadow:inset 0 0 0 1.5px ${none ? '#ddd4c4' : '#cfe0f5'}`
              };
            }),
            timeline: (l.events || []).slice(0, 12).map(e => {
              const md = EM[e.k]; const pr = e.p ? this.properties.find(x => x.id === e.p) : null;
              return {
                text: md.l + (pr ? (' — ' + pr.loc.split(',')[0]) : ''), when: R(e.m), icon: md.i,
                iconStyle: `width:40px;height:40px;border-radius:13px;flex:none;display:grid;place-items:center;font-size:19px;background:${md.b};color:${md.c}`
              };
            }),
            hasTimeline: (l.events || []).length > 0,
            reasons: this.followReasons(l).map(r => ({ label: r.t, when: r.w, icon: r.i, style: pillS(r.b, r.c) })),
            hasReasons: this.followReasons(l).length > 0,
            id0: l.id,
            propCount: props.length === 1 ? '1 property' : props.length + ' properties',
            isLive: l.status === 'active',
            open: () => this.setState({ linkView: l.id, linkTab: 'focus' }),
            goClient: () => this.setState({ section: 'clients', contactMode: 'clients', selectedClient: l.clientId, linkView: null }),
            preview: () => this.setState({ mobileFor: l.props[0], mobileLink: l.id }),
            revoke: () => this.revokeLink(l.id),
            wa: this.waLink((this.clients.find(c => c.id === l.clientId) || {}).phone)
          };
        };
        const lkCards = this.clientLinks
          .filter(l => s.lkFilter === 'all' || (s.lkFilter === 'live' && l.status === 'active') || (s.lkFilter === 'unopened' && !l.opens) || (s.lkFilter === 'recent' && l.lastActM !== null && l.lastActM <= 1440) || (s.lkFilter === 'closed' && l.status !== 'active'))
          .filter(l => !lq || ((l.client + ' ' + l.props.map(pid => (this.properties.find(p => p.id === pid) || {}).loc || '').join(' ')).toLowerCase().includes(lq)))
          .map(linkVM);
        const attn = (() => {
          const map = {};
          for (const e of allEv) {
            if (e.k !== 'view' || !e.p) continue;
            const r = map[e.p] = map[e.p] || { pid: e.p, views: 0, clients: new Set(), today: 0, todayClients: new Set() };
            r.views++; r.clients.add(e.l.clientId); if (e.m <= 1440) { r.today++; r.todayClients.add(e.l.clientId); }
          }
          return Object.values(map).sort((a, b) => b.views - a.views).slice(0, 5).map(r => {
            const pr = this.properties.find(x => x.id === r.pid); if (!pr) return null;
            return {
              title: pr.type + ' · ' + pr.size, loc: pr.loc,
              photoUrl: this.plotPhoto(pr, 0),
              thumb: `display:block;width:74px;height:64px;border-radius:14px;flex:none;background-image:url('${this.plotPhoto(pr, 0)}');background-size:cover;background-position:center;background-repeat:no-repeat;background-color:#e8ded2;`,
              views: String(r.views), viewWord: r.views === 1 ? 'view' : 'views',
              clientLine: r.clients.size === 1 ? '1 client' : r.clients.size + ' clients',
              todayLine: r.today ? ('Viewed by ' + r.todayClients.size + (r.todayClients.size === 1 ? ' client' : ' clients') + ' today') : 'No views today',
              todayStyle: `font-size:14.5px;font-weight:800;${r.today ? 'color:#0a7a42' : 'color:#9a8f80'}`,
              style: `display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:13px 15px;border-radius:18px;background:linear-gradient(135deg, #f4fbf7, #e8f7ee);box-shadow:0 0 0 1.5px #c9e8d5;border-left:8px solid #52a87a;transition:transform .13s;`,
              go: () => this.setState({ section: 'properties', propDetail: pr.id, propShot: 0 })
            };
          }).filter(Boolean);
        })();
        const never = liveL.filter(l => !l.opens).map(linkVM);
        return {
          ctMode: s.contactMode, ctIsClients: s.contactMode === 'clients', ctIsSellers: s.contactMode === 'sellers',
          ctTabs: [{ k: 'clients', l: 'Clients', i: 'ph-fill ph-users-three', n: liveC.length }, { k: 'sellers', l: 'Sellers', i: 'ph-fill ph-key', n: liveS.length }].map(t => {
            const on = s.contactMode === t.k;
            return {
              label: t.l, icon: t.i, count: String(t.n), go: () => this.setState({ contactMode: t.k }),
              style: `display:flex;align-items:center;gap:10px;height:54px;padding:0 24px;border-radius:14px;font-size:17.5px;font-weight:800;letter-spacing:-.01em;transition:all .18s;${on ? 'background:linear-gradient(135deg, #3b1464, #501d8a);color:#fff;box-shadow:0 10px 24px -10px rgba(59,20,100,.8)' : 'background:transparent;color:#786950;'}`,
              numStyle: `font-size:14px;font-weight:800;border-radius:999px;padding:2px 10px;${on ? 'background:rgba(255,255,255,.2);color:#ffd875' : 'background:rgba(0,0,0,.07);color:#6b5f4c'}`
            };
          }),
          cliQ: s.cliQ || '', onCliQ: (e) => this.setState({ cliQ: e.target.value }),
          sellQ: s.sellQ || '', onSellQ: (e) => this.setState({ sellQ: e.target.value }),
          cliChips: cliDefs.map(d => {
            const on = s.cliFilter === d.k; const cm = CS[d.k] || { c: '#241d0c', b: '#ffe5a0', card: '#fffaea', ring: '#e6d6b4' };
            return {
              label: d.l, count: String(d.n), go: () => this.setState({ cliFilter: on ? 'all' : d.k }),
              style: `display:flex;align-items:center;gap:7px;height:40px;padding:0 16px;border-radius:11px;font-size:14px;font-weight:800;white-space:nowrap;flex:none;transition:all .15s;${on ? `background:${cm.c};color:#fff;box-shadow:0 6px 14px -6px ${cm.c}` : 'background:transparent;color:#6b5f4c'}`,
              numStyle: `font-size:12px;font-weight:800;border-radius:999px;padding:1px 7px;${on ? 'background:rgba(255,255,255,.24)' : 'background:rgba(0,0,0,.08);color:#6b5f4c'}`
            };
          }),
          cliCards, cliEmpty: cliCards.length === 0, cliAny: cliCards.length > 0,
          sellCards, sellAny: sellCards.length > 0,
          /* Truthful states: a screen with no sellers because the request is
             still in flight, or failed, must never read as "no sellers yet". */
          sellLoading: deskStore.sellersStatus.state === 'loading' && sellCards.length === 0,
          sellError: deskStore.sellersStatus.state === 'error'
            ? (deskStore.sellersStatus.error || 'Sellers could not be loaded') : '',
          sellEmpty: deskStore.sellersStatus.state === 'ready' && sellCards.length === 0,
          sellQ: s.sellQ || '',
          sellRetry: () => deskStore.loadSellers(),
          ctAttnN: String(stCount('attention')), ctActiveN: String(stCount('active')),
          addClientBigOpen: !!s.addClientBig,
          openAddClientBig: () => this.setState({ addClientBig: true, cf: this.blankCF() }),
          closeAddClientBig: () => this.setState({ addClientBig: false, cf: this.blankCF() }),
          addSellerOpen: !!s.addSellerOpen,
          openAddSeller: () => this.setState({ addSellerOpen: true, sf2: { name: '', phone: '', phone2: '', business: '', kind: 'Individual', city: '', note: '' } }),
          closeAddSeller: () => this.setState({ addSellerOpen: false }),
          cf, onCF: (e) => this.onCF(e),
          cfInput: 'width:100%;height:56px;padding:0 18px;border-radius:15px;border:none;background:#fff8e6;box-shadow:inset 0 0 0 2px #f0d493;font-size:17px;font-weight:600;color:#241f1c;outline:none',
          cfArea: 'width:100%;margin-top:11px;padding:16px 18px;border-radius:15px;border:none;background:#fff8e6;box-shadow:inset 0 0 0 2px #f0d493;font-size:17px;font-weight:600;color:#241f1c;outline:none;resize:vertical',
          cfLab: 'display:block;font-size:15px;font-weight:800;color:#5c4a2a;margin-bottom:8px',
          cfTypeChips: this.PTYPES.map(t => ({ label: t.k, icon: t.i, go: () => this.cfToggle('types', t.k), style: chip((cf.types || []).includes(t.k), '#241d0c', '#f8c200') })),
          cfPrefChips: this.PREFOPTS.map(p => ({ label: p, go: () => this.cfToggle('prefs', p), style: chip((cf.prefs || []).includes(p), '#0f6f8a', '#eaf7fb') })),
          cfStageChips: this.STAGEOPTS.map(p => ({ label: p, go: () => this.setCF({ stage: p }), style: chip(cf.stage === p, '#4a2c99', '#efe8fb') })),
          cfAreaTags: (cf.areas || []).map(a => ({
            label: a, go: () => this.cfToggle('areas', a),
            style: 'display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 8px 0 16px;border-radius:999px;background:#e4f1fa;color:#0f5f7a;font-size:16px;font-weight:800'
          })),
          hasCfAreas: (cf.areas || []).length > 0,
          cfAddArea: () => this.cfAddArea(), cfAddPref: () => this.cfAddPref(),
          cfSave: () => this.saveNewClient(),
          cfSaveStyle: `display:flex;align-items:center;gap:10px;height:60px;padding:0 30px;border-radius:17px;font-size:18px;font-weight:800;${cfOK ? 'background:#0f7a45;color:#eafff2;box-shadow:0 16px 30px -16px rgba(15,122,69,.95)' : 'background:#e7e0d2;color:#a89e8b;cursor:not-allowed'}`,
          cfDup: !!cfDupC, cfDupName: cfDupC ? cfDupC.name : '', cfDupSub: cfDupC ? (cfDupC.phone + ' · ' + (cfDupC.city || '')) : '',
          cfUseDup: () => { if (cfDupC) this.useExistingClient(cfDupC.id); },
          sf2, onSF2: (e) => this.onSF2(e),
          sfKindChips: this.SELLERKINDS.map(k => ({ label: k, go: () => this.setSF2({ kind: k }), style: chip(sf2.kind === k, '#4a2c99', '#efe8fb') })),
          sfSave: () => this.saveNewSeller(),
          sfSaveStyle: `display:flex;align-items:center;gap:10px;height:60px;padding:0 30px;border-radius:17px;font-size:18px;font-weight:800;${sfOK ? 'background:#4a2c99;color:#efe8fb;box-shadow:0 16px 30px -16px rgba(74,44,153,.95)' : 'background:#e7e0d2;color:#a89e8b;cursor:not-allowed'}`,
          sfDup: !!sfDupS, sfDupName: sfDupS ? sfDupS.name : '', sfDupSub: sfDupS ? (sfDupS.phone + ' · ' + sfDupS.kind) : '',
          sfUseDup: () => { if (sfDupS) { deskStore.loadSellerWorkspace(sfDupS.id); this.setState({ addSellerOpen: false, sellerEditId: null, contactMode: 'sellers', sellerView: sfDupS.id }); } },
          cp, cpOpen: !!cp,
          lkTabs: [{ k: 'follow', l: 'Follow-ups', i: 'ph-fill ph-phone-call', n: followList.length, c: '#c0490c', b: '#ffdcbd', card: '#fff5ec', ring: '#f5c9a0' }, { k: 'links', l: 'All links', i: 'ph-fill ph-paper-plane-tilt', n: this.clientLinks.length, c: '#4a2c99', b: '#e7defc', card: '#f6f2ff', ring: '#d5c5f2' }].map(t => {
            const on = (t.k === 'links') === (s.linksTab === 'links');
            return {
              label: t.l, icon: t.i, count: String(t.n), go: () => this.setState({ linksTab: t.k }),
              style: `display:flex;align-items:center;gap:10px;height:60px;padding:0 24px;border-radius:17px;font-size:18px;font-weight:800;white-space:nowrap;transition:all .16s;${on ? `background:${t.c};color:#fff;box-shadow:0 14px 26px -16px ${t.c}` : `background:${t.card};color:${t.c};box-shadow:inset 0 0 0 2px ${t.ring}`}`,
              numStyle: `font-size:14.5px;font-weight:800;border-radius:999px;padding:2px 10px;${on ? 'background:rgba(255,255,255,.24)' : `background:${t.b}`}`
            };
          }),
          lkIsFollow: s.linksTab !== 'links', lkIsLinks: s.linksTab === 'links', lkIsProps: false,
          fuCards: followList.map(x => {
            const c = this.clients.find(cl => cl.id === x.l.clientId) || {};
            const rs = x.r || []; const R = rs[0] || { t: 'Opened your link', i: 'ph-fill ph-eye', c: '#a3541b', b: '#fff0d6' };
            return {
              client: x.l.client, phone: c.phone || '—', initials: this.initialsOf(x.l.client),
              reason: R.t, reasonIcon: R.i, reasonWhen: R.w || '', go: () => this.setState({ linkView: x.l.id }),
              more: rs.slice(1, 3).map(r => ({
                label: r.t, when: r.w || '',
                style: 'display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:11px;background:' + r.b + ';color:' + r.c + ';font-size:14px;font-weight:800',
                icon: r.i
              })),
              hasMore: rs.length > 1,
              card: 'width:100%;text-align:left;border-radius:20px;background:linear-gradient(135deg, #fff0f3, #ffe3e8);padding:17px 18px 18px;box-shadow:0 0 0 1.5px #ffd1d9,0 16px 34px -22px rgba(90,10,20,.6);transition:transform .15s;cursor:pointer',
              avStyle: 'width:52px;height:52px;border-radius:16px;flex:none;display:grid;place-items:center;font-size:19px;font-weight:800;background:' + R.b + ';color:' + R.c,
              reasonStyle: 'display:flex;align-items:center;gap:9px;margin-top:13px;padding:12px 14px;border-radius:14px;background:' + R.b + ';color:' + R.c + ';font-size:15.5px;font-weight:800;text-wrap:pretty;line-height:1.35'
            };
          }),
          fuNone: followList.length === 0,
          lkQ: s.lkQ || '', onLkQ: (e) => this.setState({ lkQ: e.target.value }),
          lkFilterChips: [{ k: 'all', l: 'All' }, { k: 'live', l: 'Live' }, { k: 'recent', l: 'Active today' }, { k: 'unopened', l: 'Never opened' }, { k: 'closed', l: 'Expired / stopped' }].map(d => {
            const on = s.lkFilter === d.k;
            return {
              label: d.l, go: () => this.setState({ lkFilter: d.k }),
              style: `height:46px;padding:0 18px;border-radius:14px;font-size:15.5px;font-weight:800;white-space:nowrap;flex:none;${on ? 'background:#4a2c99;color:#fff' : 'background:#fffdf7;color:#6b6156;box-shadow:inset 0 0 0 1.5px #e6d6b4'}`
            };
          }),
          lkStats: [{ l: 'Live links', v: String(liveL.length), i: 'ph-fill ph-broadcast', b: '#cdf0dd', c: '#0a7a42', card: '#f1fbf6', ring: '#b3e2c8' },
          { l: 'Clients active today', v: String(viewedToday), i: 'ph-fill ph-eye', b: '#ffe5a0', c: '#9a6a00', card: '#fff8e3', ring: '#f0d493' },
          { l: 'Sent, never opened', v: String(neverOpened), i: 'ph-fill ph-envelope-simple', b: '#ffdcbd', c: '#c0490c', card: '#fff5ec', ring: '#f5c9a0' },
          { l: 'Properties they viewed', v: String(attn.length), i: 'ph-fill ph-chart-bar', b: '#d7e8ff', c: '#1a5aa8', card: '#f3f8ff', ring: '#c0d7f4' }]
            .map(x => ({
              label: x.l, value: x.v, icon: x.i,
              style: `background:${x.card};border-radius:22px;padding:20px 22px;box-shadow:0 0 0 1.5px ${x.ring}`,
              iconStyle: `width:48px;height:48px;border-radius:15px;display:grid;place-items:center;font-size:23px;background:${x.b};color:${x.c}`
            })),
          lkFeed: feed, lkNoFeed: feed.length === 0,
          lkFollowCards: followList.map(x => linkVM(x.l)), lkNoFollow: followList.length === 0,
          lkCards: lkCards.map(l => {
            const isStopped = l.status === 'revoked';
            const isExpired = l.status === 'expired';
            const isLive = l.status === 'active';
            const cardBg = isStopped
              ? 'background:linear-gradient(135deg, #fff1f2, #ffe4e6);box-shadow:0 0 0 2px #fca5a5,0 16px 34px -26px rgba(225,29,72,.45);border-left:8px solid #e11d48;'
              : isExpired
                ? 'background:linear-gradient(135deg, #fffbeb, #fef3c7);box-shadow:0 0 0 2px #fde68a,0 16px 34px -26px rgba(217,119,6,.45);border-left:8px solid #d97706;'
                : 'background:linear-gradient(135deg, #f0fdf4, #dcfce7);box-shadow:0 0 0 2px #86efac,0 16px 34px -26px rgba(22,163,74,.45);border-left:8px solid #16a34a;';
            const openedCol = isStopped ? 'color:#be123c' : (isExpired ? 'color:#b45309' : ((l.opens === 0 || /never|not opened/i.test(l.opened || '')) ? 'color:#c0490c' : 'color:#15803d'));
            const avBg = isStopped ? 'background:#fecdd3;color:#9f1239' : (isExpired ? 'background:#fde68a;color:#92400e' : 'background:#bbf7d0;color:#166534');
            const stBadge = isStopped ? 'display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;background:#fecdd3;color:#9f1239' : (isExpired ? 'display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;background:#fde68a;color:#92400e' : 'display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;background:#bbf7d0;color:#166534');
            return {
              ...l,
              sentShort: l.sub || '', openedShort: l.opened || 'Not opened yet',
              openedColor: openedCol,
              avStyle: `width:52px;height:52px;border-radius:17px;flex:none;display:grid;place-items:center;font-size:18px;font-weight:800;${avBg}`,
              statusStyle: stBadge,
              rowStyle: `flex:1 1 430px;max-width:620px;text-align:left;border-radius:22px;${cardBg}padding:18px 20px;transition:transform .15s;cursor:pointer`,
              open: () => this.setState({ linkView: l.id0, linkTab: 'focus' })
            };
          }),
          lkNoCards: lkCards.length === 0,
          lkAttention: attn, lkNoAttention: attn.length === 0,
          lkNever: never, lkHasNever: never.length > 0,
          ld: s.linkView ? linkVM(this.clientLinks.find(l => l.id === s.linkView) || this.clientLinks[0]) : null,
          ldOpen: !!s.linkView && !!this.clientLinks.find(l => l.id === s.linkView),
          closeLd: () => this.setState({ linkView: null }),
          ldTabFocus: s.linkTab === 'focus', ldTabTime: s.linkTab === 'time',
          ldNoTimeline: !!s.linkView && !((this.clientLinks.find(l => l.id === s.linkView) || {}).events || []).length,
          ldTabs: [{ k: 'focus', l: 'What they looked at' }, { k: 'time', l: 'Full history' }].map(t => {
            const on = s.linkTab === t.k;
            return {
              label: t.l, go: () => this.setState({ linkTab: t.k }),
              style: `height:46px;padding:0 20px;border-radius:13px;font-size:15.5px;font-weight:800;flex:none;transition:all .16s;${on ? 'background:#ffffff;color:#2e1065;box-shadow:0 4px 14px rgba(0,0,0,.3);' : 'background:rgba(255,255,255,.14);color:#ffffff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.2);'}`
            };
          }),
        };
      })(),
      cPlotPicks, cPickCount: cPicked.length ? (cPicked.length + ' selected') : 'none yet',
    };
  }
}
