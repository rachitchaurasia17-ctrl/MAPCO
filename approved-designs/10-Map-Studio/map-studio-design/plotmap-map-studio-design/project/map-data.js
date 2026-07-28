// PlotMap — New Chandigarh curated overlay data
// Geometry traced from the official masterplan (uploads/NEW CHANDIGARH MAP SVG.svg).
// Coordinate space: 1414 x 1036, stretched over the original map image.

export const VB = { w: 1414, h: 1036 };

// A/B/C/D are SAVED HIGHLIGHT GROUPS the team curates in Map Studio.
export const GROUPS = {
  A: { name: 'Connectivity', desc: 'Main roads & links', color: '#1E5FA8' },
  B: { name: 'Residential', desc: 'Zones, blocks & plots', color: '#A87F1F' },
  C: { name: 'Commercial & Civic', desc: 'Belts & landmarks', color: '#157A56' },
  D: { name: 'Growth Corridor', desc: 'South & west expansion', color: '#B06A2C' },
};

export const ROADS = [
  {
    id: 'road-pr4', kind: 'road', name: 'PR-4 Arterial', sub: 'East–West arterial · Airport side link', group: 'A',
    d: 'M258.592 474.5L320.592 483.5L363.092 478.5L400.592 474.5L426.592 470H460.092L473.592 474.5L493.092 470L536.092 456.5H560.092L814.592 490L920.092 502H967.092',
    label: [352, 448], rel: ['sec-zone1', 'sec-zone2', 'sec-blockE'],
    rows: [['Type', 'Arterial road'], ['Serves', 'Zone 1 · Zone 2 · E Blocks'], ['Continues to', 'PGI side (east)']],
  },
  {
    id: 'road-spine', kind: 'road', name: 'Main Spine Road', sub: 'North–South spine through Zones 1–3', group: 'A',
    d: 'M612.592 198L597.092 317L593.092 415V464.5V539.5L588.092 626L583.092 682V730L598.592 762.5L625.592 780.5L659.092 784.5L688.592 771.5L713.592 742L723.592 704.5V617.5L729.592 574.5L723.592 556L713.592 539.5L707.592 521V480L713.592 426.5L701.592 394L707.592 351.5',
    label: [618, 236], rel: ['sec-zone1', 'sec-zone2', 'sec-zone3'],
    rows: [['Type', 'Sector spine'], ['Serves', 'Zone 1 · Zone 2 · Zone 3'], ['Character', 'Internal main road']],
  },
  {
    id: 'road-expressway', kind: 'road', name: 'Expressway Link Road', sub: 'Towards GMADA Expressway / Anandpur Sahib', group: 'A',
    d: 'M1412.09 597.5L1224.09 593L1065.59 582H1034.09H1006.59L990.592 591L978.092 603.5L952.592 619L935.592 628L910.092 638.5H767.592L706.092 634.5H645.592H600.592L557.092 619L518.092 610.5L468.092 605L373.092 597.5L274.092 582.5L240.592 575.5L65.5922 527.5L1.59224 506',
    label: [250, 548], rel: ['sec-zone3', 'sec-blockE'],
    rows: [['Type', 'Expressway link'], ['Direction', 'GMADA Expressway (west)'], ['Serves', 'Zone 3 · E Blocks']],
  },
  {
    id: 'road-pgi', kind: 'road', name: 'Chandigarh–PGI Road', sub: 'Direct entry from Chandigarh / PGI side', group: 'A',
    d: 'M167.592 316.5L255.592 282L306.592 300.5L353.592 322L374.592 312.5L395.092 316.5L485.592 305H517.092L598.092 322L690.592 346L898.092 350.5L956.092 346L1025.59 322L1057.09 313L1081.59 322L1108.09 350.5L1144.59 367.5L1226.09 417.5H1412.09',
    label: [990, 318], rel: ['sec-zone1'],
    rows: [['Type', 'City connector'], ['Direction', 'Chandigarh · PGI (east)'], ['Serves', 'Zone 1 · Eco City']],
  },
  {
    id: 'road-kurali', kind: 'road', name: 'Kurali Road', sub: 'Northern exit towards Kurali', group: 'A',
    d: 'M276.092 0V53V84.5L271.092 152L276.092 202V280.5L271.092 323L279.592 342.5L285.092 363L276.092 384L262.092 416.5L251.592 510V529.5L232.092 576L180.092 667.5L139.092 739.5L108.092 779L65.0922 854.5',
    label: [300, 120], rel: ['sec-blockE'],
    rows: [['Type', 'Regional road'], ['Direction', 'Kurali (north)'], ['Serves', 'Western belt · E Blocks']],
  },
  {
    id: 'road-aero', kind: 'road', name: 'Aero City Road', sub: 'Southern belt towards Aero City / Mohali', group: 'D',
    d: 'M585.592 1029.5L659.092 967.5L781.592 879L847.092 837.5L868.092 832.5L1078.09 828L1160.09 832.5L1407.59 837.5',
    label: [980, 868], rel: ['sec-zone3'],
    rows: [['Type', 'Southern belt road'], ['Direction', 'Aero City · Mohali'], ['Serves', 'Zone 3 (south edge)']],
  },
];

export const SHAPES = [
  {
    id: 'sec-zone1', kind: 'sector', name: 'Zone 1', sub: 'Eco City belt', group: 'B',
    paths: ['M501.092 300L467.592 308L491.092 379V415.5L501.092 452V472L542.592 458.5H589.092L645.592 466.5L710.092 472L716.592 432L701.092 393.5L710.092 349.5H684.092L600.092 323.5L501.092 300Z'],
    label: [590, 390], rel: ['road-pr4', 'road-pgi', 'road-spine'],
    rows: [['Zone', 'Zone 1 · Eco City'], ['Blocks inside', 'Eco City · DLF Hyde Park'], ['Nearest roads', 'PGI Road · PR-4'], ['Proof', 'Official masterplan available']],
  },
  {
    id: 'sec-zone2', kind: 'sector', name: 'Zone 2', sub: 'Omaxe · Altus belt', group: 'B',
    paths: ['M537.592 458L499.092 471.5V497L483.592 528L474.092 609L531.092 613L574.092 624L605.092 636.5H656.092L723.092 630.5L727.592 568L709.592 528L705.592 477.5L676.592 471.5L609.092 463L537.592 458Z'],
    label: [600, 545], rel: ['road-pr4', 'road-spine'],
    rows: [['Zone', 'Zone 2'], ['Blocks inside', 'Omaxe Ph-3 · Altus · Saini Majra'], ['Nearest roads', 'PR-4 · Main Spine'], ['Proof', 'Official masterplan available']],
  },
  {
    id: 'sec-zone3', kind: 'sector', name: 'Zone 3', sub: 'Southern development ring', group: 'D',
    paths: ['M696.092 634H725.092V691.5L714.592 729.5L758.092 761.5L701.092 843L653.092 859L579.092 843L519.592 799L502.592 766L472.092 673V627C470.492 624.2 474.759 610.833 477.092 604.5L515.592 610.5C535.759 612.167 578.292 617.8 587.092 627C595.892 636.2 628.426 635.5 643.592 634H696.092Z'],
    label: [598, 735], rel: ['road-spine', 'road-expressway', 'road-aero'],
    rows: [['Zone', 'Zone 3'], ['Character', 'Southern ring · growth side'], ['Nearest roads', 'Main Spine · Expressway Link'], ['Proof', 'Official masterplan available']],
  },
  {
    id: 'sec-blockE', kind: 'sector', name: 'E Blocks', sub: 'Western belt · Kansalpur / Karsal side', group: 'D',
    paths: [
      'M416.092 405.5C417.692 412.3 369.092 410.667 344.592 409L337.092 477L455.092 473.5C457.892 438.7 430.259 413.667 416.092 405.5Z',
      'M454.092 474.5L334.592 478C334.592 483.5 335.292 494.9 338.092 496.5C340.892 498.1 336.926 513.833 334.592 521.5L325.092 597.5H362.092L374.592 568C386.592 533 390.592 551 426.592 524.5C455.392 503.3 456.926 482.333 454.092 474.5Z',
      'M338.592 478L256.592 471.5L252.592 525L233.092 571.5L324.592 590.5L331.592 546.5L335.592 520L341.092 501.5C336.926 492.5 330.592 475.2 338.592 478Z',
    ],
    label: [345, 530], rel: ['road-pr4', 'road-kurali', 'road-expressway'],
    rows: [['Zone', 'E Blocks (western belt)'], ['Villages', 'Kansalpur · Karsal · Boothgarh'], ['Nearest roads', 'PR-4 · Kurali Road'], ['Proof', 'Official masterplan available']],
  },
  {
    id: 'blk-omaxe3', kind: 'block', name: 'Omaxe Phase 3', sub: 'Block · Zone 2', group: 'B',
    paths: ['M687.592 539.5L707.092 535L724.092 556L727.092 576L724.092 595.5L720.092 632H649.092L653.092 543H667.092L687.592 539.5Z'],
    label: [688, 585], parent: 'sec-zone2', rel: ['road-spine'],
    rows: [['Block', 'Omaxe Phase 3'], ['Sector', 'Zone 2'], ['Faces', 'Main Spine Road'], ['Proof', 'Sector proof available']],
  },
  {
    id: 'blk-altus', kind: 'block', name: 'Altus', sub: 'Block · Zone 2', group: 'B',
    paths: ['M649.092 587L591.092 584L585.592 624.5L612.092 634L649.092 630V587Z'],
    label: [618, 608], parent: 'sec-zone2', rel: ['road-spine'],
    rows: [['Block', 'Altus'], ['Sector', 'Zone 2'], ['Faces', 'Main Spine Road'], ['Proof', 'Sector proof available']],
  },
  {
    id: 'blk-hydepark', kind: 'block', name: 'DLF Hyde Park', sub: 'Block · Zone 1', group: 'B',
    paths: ['M655.092 470.5L592.592 462V434L625.092 437.5L643.092 443H658.092L655.092 470.5Z'],
    label: [625, 452], parent: 'sec-zone1', rel: ['road-pr4'],
    rows: [['Block', 'DLF Hyde Park'], ['Sector', 'Zone 1 · Eco City'], ['Nearest road', 'PR-4'], ['Proof', 'Sector proof available']],
  },
  {
    id: 'blk-block5', kind: 'block', name: 'Block 5', sub: 'Block · Zone 2', group: 'B',
    paths: ['M549.092 528.5L552.592 491.5V471.5L557.092 458M557.092 458H531.592L501.092 467V495.5L487.092 528.5L517.092 522.5L549.092 528.5L592.592 535V463L557.092 458Z'],
    label: [540, 498], parent: 'sec-zone2', rel: ['road-pr4'],
    rows: [['Block', 'Block 5'], ['Sector', 'Zone 2'], ['Nearest road', 'PR-4'], ['Proof', 'Sector proof available']],
  },
  {
    id: 'blk-saini', kind: 'block', name: 'Saini Majra', sub: 'Block · Zone 2', group: 'B',
    paths: ['M547.592 530.5L592.092 535.5L586.092 628L535.092 613.5V599.5L538.592 583.5L543.592 558L547.592 530.5Z'],
    label: [563, 578], parent: 'sec-zone2', rel: ['road-spine'],
    rows: [['Block', 'Saini Majra'], ['Sector', 'Zone 2'], ['Nearest road', 'Main Spine Road'], ['Proof', 'Sector proof available']],
  },
  {
    id: 'com-ecocity', kind: 'commercial', name: 'Eco City Commercial Belt', sub: 'Retail & office frontage', group: 'C',
    paths: ['M510.092 332L600.092 350L684.092 352L708.092 349L705.092 372L655.092 368L590.092 353L512.092 341Z'],
    label: [600, 340], rel: ['road-pgi', 'sec-zone1'],
    rows: [['Type', 'Commercial belt'], ['Why it matters', 'Shops, offices, daily needs'], ['Frontage', 'Chandigarh–PGI Road'], ['Proof', 'Location proof available']],
  },
  {
    id: 'grn-belt', kind: 'green', name: 'Central Green Belt', sub: 'Park & open space', group: 'C',
    paths: ['M325.092 597L362.092 597L360.092 645L300.092 662L300.092 612Z'],
    label: [330, 625], rel: ['sec-blockE'],
    rows: [['Type', 'Green belt / park'], ['Why it matters', 'Open space, walking, cleaner air'], ['Near', 'E Blocks'], ['Proof', 'Location proof available']],
  },
  {
    id: 'lmk-pca', kind: 'landmark', name: 'PCA Cricket Stadium', sub: 'Sports landmark · east of Zone 2', group: 'C',
    paths: ['M838.092 590L768.592 561L776.592 575L798.592 601V634.5H838.092V590Z'],
    label: [805, 560], rel: ['road-expressway'],
    rows: [['Type', 'Sports landmark'], ['Why it matters', 'Signature address · pulls visitors'], ['Nearby', 'Zone 2 · Expressway Link'], ['Proof', 'Location proof available']],
  },
];

export const PINS = [
  {
    id: 'pin-plot214', kind: 'pin', name: 'Plot 214', sub: 'Residential plot · Block 5', group: 'B',
    at: [572, 500], parent: 'blk-block5', nearRoad: 'road-pr4',
    rows: [['Area', 'New Chandigarh'], ['Sector', 'Zone 2'], ['Block', 'Block 5'], ['Size', '250 sq yd'], ['Facing', 'North-East'], ['Road width', '60 ft']],
  },
  {
    id: 'poi-tradetower', kind: 'landmark', name: 'Omaxe Int’l Trade Tower', sub: 'Commercial landmark', group: 'C',
    at: [544, 324], parent: 'sec-zone1', nearRoad: 'road-pgi',
    rows: [['Type', 'Commercial tower'], ['Belt', 'Eco City commercial'], ['Nearest road', 'PGI Road']],
  },
  {
    id: 'poi-medcity', kind: 'landmark', name: 'Medcity Hospital', sub: 'Healthcare landmark', group: 'C',
    at: [593, 271], parent: null, nearRoad: 'road-spine',
    rows: [['Type', 'Healthcare'], ['Nearest road', 'Main Spine Road']],
  },
  {
    id: 'poi-school', kind: 'landmark', name: 'Strawberry Fields School', sub: 'Education landmark', group: 'C',
    at: [654, 345], parent: 'sec-zone1', nearRoad: 'road-pgi',
    rows: [['Type', 'School'], ['Sector', 'Zone 1 · Eco City'], ['Nearest road', 'PGI Road']],
  },
];

// Clean always-on text annotations (client-safe). Created with the Add Label tool.
export const LABELS = [
  { id: 'lbl-belt', kind: 'label', text: 'Commercial Belt', at: [598, 315], group: 'C', big: false },
  { id: 'lbl-growth', kind: 'label', text: 'Growth Corridor', at: [600, 700], group: 'D', big: true },
];

export const KIND_LABEL = { road: 'Road', sector: 'Sector', block: 'Block', landmark: 'Landmark', pin: 'Property', commercial: 'Commercial', green: 'Green Belt', label: 'Label', plot: 'Plot', boundary: 'Boundary' };
export const KIND_COLOR = { road: '#1E5FA8', sector: '#A87F1F', block: '#A87F1F', pin: '#A87F1F', landmark: '#157A56', commercial: '#B06A2C', green: '#3E7D3A', label: '#23201A', plot: '#A87F1F', boundary: '#1E5FA8' };
