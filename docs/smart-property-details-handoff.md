# Smart property details implementation

Branch: codex/smart-property-details. Local checkpoint only; no production deployment.

## Architecture and persistence

The typed DETAIL_SCHEMAS registry defines controls, groups and conditions for the ten existing canonical kinds. PROPERTY_SPEC_KEYS combines this registry with legacy keys. The form uses the existing flat draft and persists through Property.specs, toCanonicalProperty and persistentPropertyPayload. Supabase already stores the complete property in crm_records.payload; no migration, API, RLS or authentication change is needed.

Known fields belonging only to another type are removed. Unknown scalar legacy keys are retained from the existing record on same-type edits; blank known values remove answers. Text uses the existing 240-character storage bound. Hidden conditional answers remain saved for the same type so toggling a condition back restores them.

Type changes keep per-kind drafts inside the current form session, including size, unit and rate. They are excluded from persistence. Edit mode hydrates every known saved specification, preserves canonical facing and restores the saved area unit. No new automatic unit conversion is performed; the existing rate helper additionally supports acres at 4,840 sq yd. Fixed-area fields explicitly name their units.

## Experience and rules

Essentials stay open; Features, More details, Legal / ownership and Commercial / occupancy expand inline. The completion indicator counts answered visible essential fields, including zero and explicit false. Existing listing requirements remain enforced by the canonical lifecycle; facing and size are marked required to list. Other essentials are recommended and advanced answers are optional.

Neutral cream surfaces, understated inputs, compact exclusive choices, explicit Yes/No/unspecified answers, dropdowns for longer lists, numeric measurements and date controls replace the old large pills. Numeric controls commit on change and reject negative/nonfinite values. Responsive grids use three, two and one columns; reduced-motion preference is respected. No focus timeout, scroll repair or rendering-framework patch was introduced.

## Boundaries and remaining verification

The existing focus/scroll rerender defect remains for the separately assigned rendering work. Browser checks and screenshots were deliberately not performed per the handoff. Laptop/tablet/mobile visual acceptance remains with the user. Live authenticated Supabase save/reopen has not been exercised; the shared canonical persistence boundary and mock repository are tested.

Exact-location disclosure remains controlled by the existing Client Link flow; this questionnaire does not introduce a competing location-visibility switch. Project/location, seller, private notes, photos and Earth coordinates retain their existing canonical ownership. The buyer-note field records intended customer copy but does not change Client Link rendering. Plot number visibility retains the existing field.

## Fields by property type

Size and unit are common to every questionnaire. Units: sq yd, sq ft, marla, kanal, acre. Fields below list their exact persisted keys.

### Plot details (53 fields)

**Essentials**

- Frontage (ft) — `frontage` (number).
- Depth (ft) — `depth` (number).
- Main road width (ft) — `road` (number).
- Facing — `facing` (choice); East, West, North, South, North-East, North-West, South-East, South-West.
- Open sides — `openSides` (choice); One side, Two side, Three side, Four side.
- Plot number — `plotNo` (text).
- Block / pocket — `block` (text).

**Features**

- Corner — `corner` (boolean).
- Park facing — `parkFacing` (boolean).
- Main road facing — `mainRoad` (boolean).
- Green belt behind — `nearGreen` (boolean).
- Green belt facing — `greenFacing` (boolean).
- T-point — `tPoint` (boolean).
- Cul-de-sac / dead end — `deadEnd` (boolean).
- Service lane — `serviceLane` (boolean).
- Corner cut — `cornerCut` (boolean).
- Two-side road — `twoSide` (boolean).
- Second-side road width (ft) — `road2` (number); shown when corner is true.
- Second-side facing — `facing2` (choice); East, West, North, South, North-East, North-West, South-East, South-West; shown when corner is true.

**More details**

- Shape — `shape` (choice); Regular, Irregular, Rectangle, Square, L-shape, Corner cut.
- Front dimension (ft) — `dimFront` (number); shown when shape is Irregular / L-shape / Corner cut.
- Back dimension (ft) — `dimBack` (number); shown when shape is Irregular / L-shape / Corner cut.
- Left dimension (ft) — `dimLeft` (number); shown when shape is Irregular / L-shape / Corner cut.
- Right dimension (ft) — `dimRight` (number); shown when shape is Irregular / L-shape / Corner cut.
- Ground level — `level` (choice); Level with road, Above road, Below road.
- Height difference (ft) — `heightDifference` (number); shown when level is Above road / Below road.
- Boundary wall — `boundary` (boolean).
- Filled / levelled — `levelled` (boolean).
- Vacant — `vacant` (boolean).
- Existing construction — `existingConstruction` (boolean).
- Known encroachment — `encroachment` (boolean).
- Trees / obstructions — `obstructions` (text).
- Electricity available — `electricity` (boolean).
- Water connection — `water` (boolean).
- Sewerage — `sewer` (boolean).
- Storm-water drainage — `drainage` (boolean).
- Street lights — `streetLights` (boolean).
- Paved road — `pavedRoad` (boolean).
- Underground utilities — `underground` (boolean).
- Buyer-visible property note — `buyerNote` (text).

**Legal / ownership**

- Ownership — `tenure` (choice); Freehold, Leasehold, Power of attorney.
- Approving authority — `approvalNote` (choice); GMADA, CHB, PUDA, HUDA / HSVP, Municipal authority, Private developer, Other.
- Authority / approval details — `authorityOther` (text).
- Title details — `title` (text).
- Known dues — `dues` (text).
- Known dispute — `dispute` (text).
- Ownership clear — `ownershipClear` (boolean).
- Registry available — `registryAvailable` (boolean).
- Mutation completed — `mutation` (boolean).
- Possession available — `possessionAvailable` (boolean).
- Bank finance available — `loanable` (boolean).
- CLU / land-use status — `clu` (text).
- Show plot number to customers — `showPlotNo` (boolean).

### Apartment details (113 fields)

**Essentials**

- Configuration — `config` (choice); 1 BHK, 2 BHK, 3 BHK, 4 BHK, 5+ BHK.
- Carpet area (sq ft) — `carpet` (number).
- Built-up area (sq ft) — `builtup` (number).
- Super area (sq ft) — `superArea` (number).
- Floor — `floor` (text).
- Unit number — `plotNo` (text).
- Tower / block — `block` (text).
- Total floors — `totalFloors` (number).
- Facing — `facing` (choice); East, West, North, South, North-East, North-West, South-East, South-West.
- Bedrooms — `beds` (number).
- Bathrooms — `baths` (number).

**Features**

- Balconies — `balconies` (number).
- Powder rooms — `powderRooms` (number).
- Kitchens — `kitchens` (number).
- Study room — `study` (boolean).
- Store room — `store` (boolean).
- Servant room — `servant` (boolean).
- Utility area — `utility` (boolean).
- Pooja room — `puja` (boolean).
- Dressing room — `dressing` (boolean).
- Dining area — `dining` (boolean).
- Drawing / living room — `living` (boolean).
- Private terrace — `terrace` (boolean).
- Duplex — `duplex` (boolean).
- Penthouse — `penthouse` (boolean).
- Corner unit — `corner` (boolean).
- Lift — `lift` (boolean).
- Power backup — `powerBackup` (boolean).
- Security — `security` (boolean).
- Fire safety — `fireSafety` (boolean).
- Wheelchair access — `wheelchair` (boolean).
- Number of lifts — `liftCount` (number); shown when lift is true.
- Lift type — `liftType` (choice); Passenger, Private, Service; shown when lift is true.
- Service lift — `serviceLift` (boolean); shown when lift is true.
- Parking count — `parking` (number).
- Covered parking — `coveredParking` (boolean).
- Open parking — `openParking` (boolean).
- Basement parking — `basementParking` (boolean).
- Furnishing — `furnishing` (choice); Unfurnished, Semi-furnished, Fully furnished.

**More details**

- Generator backup — `generator` (boolean).
- CCTV — `cctv` (boolean).
- Intercom — `intercom` (boolean).
- Access control — `accessControl` (boolean).
- Dedicated parking number — `parkingNumber` (text).
- Modular kitchen — `modularKitchen` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Wardrobes — `wardrobes` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- ACs — `ac` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Fans — `fans` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Lights — `lights` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Geysers — `geysers` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Beds — `furnitureBeds` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Sofa — `sofa` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Dining table — `diningTable` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Appliances — `appliances` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Curtains / blinds — `curtains` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Other included furniture — `otherFurniture` (text); shown when furnishing is Semi-furnished / Fully furnished / Furnished.
- Condition — `condition` (choice); New, Resale, Recently renovated, Needs renovation.
- Age of construction — `age` (text).
- Last renovation year — `renovationYear` (number).
- Clubhouse — `clubhouse` (boolean).
- Gym — `gym` (boolean).
- Swimming pool — `pool` (boolean).
- Park — `park` (boolean).
- Kids area — `kidsArea` (boolean).
- Sports facilities — `sports` (boolean).
- Community hall — `communityHall` (boolean).
- Visitor parking — `visitorParking` (boolean).
- Grocery — `grocery` (boolean).
- Maintenance office — `maintenanceOffice` (boolean).
- Pet friendly — `petFriendly` (boolean).
- Gated community — `gated` (boolean).
- Park view — `parkView` (boolean).
- Road view — `roadView` (boolean).
- Garden view — `gardenView` (boolean).
- Pool view — `poolView` (boolean).
- Club view — `clubView` (boolean).
- City view — `cityView` (boolean).
- Open view — `openView` (boolean).
- Green view — `greenView` (boolean).
- Sunlight quality — `sunlight` (text).
- Ventilation — `ventilation` (text).
- Floor orientation — `floorOrientation` (text).

**Legal / ownership**

- Occupancy certificate — `oc` (boolean).
- Completion certificate — `cc` (boolean).
- Ownership — `tenure` (choice); Freehold, Leasehold, Power of attorney.
- Approving authority — `approvalNote` (choice); GMADA, CHB, PUDA, HUDA / HSVP, Municipal authority, Private developer, Other.
- Authority / approval details — `authorityOther` (text).
- Title details — `title` (text).
- Known dues — `dues` (text).
- Known dispute — `dispute` (text).
- Ownership clear — `ownershipClear` (boolean).
- Registry available — `registryAvailable` (boolean).
- Mutation completed — `mutation` (boolean).
- Possession available — `possessionAvailable` (boolean).
- Bank finance available — `loanable` (boolean).
- RERA number (if applicable) — `rera` (text).

**Commercial / occupancy**

- Monthly maintenance (₹) — `maintenance` (number).
- Society transfer charges (₹) — `transferCharges` (number).
- Possession — `possession` (choice); Ready to move, Under construction, Within 3 months, Within 6 months.
- Expected possession date — `possessionDate` (date); shown when possession is Under construction.
- Construction stage — `constructionStage` (text); shown when possession is Under construction.
- Occupancy — `occupancy` (choice); Vacant, Owner occupied, Tenant occupied, Rented, Leased.
- Available from — `availableFrom` (date).
- Tenant / tenant type — `tenant` (text); shown when occupancy is Tenant occupied / Rented / Leased.
- Monthly rent (₹) — `monthlyRent` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lock-in (months) — `lockIn` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Annual escalation (%) — `escalation` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Security deposit (₹) — `deposit` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Notice period (months) — `noticePeriod` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease start — `leaseStart` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease end — `leaseEnd` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease transferable — `leaseTransferable` (boolean); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease structure — `leaseStructure` (text); shown when occupancy is Tenant occupied / Rented / Leased.

### Floor details (96 fields)

**Essentials**

- Floor — `floor` (text).
- Unit number — `plotNo` (text).
- Total floors — `totalFloors` (number).
- Plot area (sq yd) — `landArea` (number).
- Built-up area (sq ft) — `builtup` (number).
- Carpet area (sq ft) — `carpet` (number).
- Floor area (sq ft) — `floorArea` (number).
- Facing — `facing` (choice); East, West, North, South, North-East, North-West, South-East, South-West.
- Bedrooms — `beds` (number).
- Bathrooms — `baths` (number).

**Features**

- Balconies — `balconies` (number).
- Powder rooms — `powderRooms` (number).
- Kitchens — `kitchens` (number).
- Study room — `study` (boolean).
- Store room — `store` (boolean).
- Servant room — `servant` (boolean).
- Utility area — `utility` (boolean).
- Pooja room — `puja` (boolean).
- Dressing room — `dressing` (boolean).
- Dining area — `dining` (boolean).
- Drawing / living room — `living` (boolean).
- Private terrace — `terrace` (boolean).
- Terrace rights — `terraceRights` (boolean).
- Roof rights — `roofRights` (boolean).
- Stilt parking — `stilt` (boolean).
- Private lift — `privateLift` (boolean).
- Separate entry — `sepEntry` (boolean).
- Common entry — `commonEntry` (boolean).
- Corner — `corner` (boolean).
- Park facing — `parkFacing` (boolean).
- Parking count — `parking` (number).
- Covered parking — `coveredParking` (boolean).
- Open parking — `openParking` (boolean).
- Basement parking — `basementParking` (boolean).
- Lift — `lift` (boolean).
- Power backup — `powerBackup` (boolean).
- Security — `security` (boolean).
- Fire safety — `fireSafety` (boolean).
- Wheelchair access — `wheelchair` (boolean).
- Number of lifts — `liftCount` (number); shown when lift is true.
- Lift type — `liftType` (choice); Passenger, Private, Service; shown when lift is true.
- Service lift — `serviceLift` (boolean); shown when lift is true.
- Furnishing — `furnishing` (choice); Unfurnished, Semi-furnished, Fully furnished.

**More details**

- Dedicated parking number — `parkingNumber` (text).
- Generator backup — `generator` (boolean).
- CCTV — `cctv` (boolean).
- Intercom — `intercom` (boolean).
- Access control — `accessControl` (boolean).
- Modular kitchen — `modularKitchen` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Wardrobes — `wardrobes` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- ACs — `ac` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Fans — `fans` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Lights — `lights` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Geysers — `geysers` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Beds — `furnitureBeds` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Sofa — `sofa` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Dining table — `diningTable` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Appliances — `appliances` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Curtains / blinds — `curtains` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Other included furniture — `otherFurniture` (text); shown when furnishing is Semi-furnished / Fully furnished / Furnished.
- Condition — `condition` (choice); New, Resale, Recently renovated, Needs renovation.
- Age of construction — `age` (text).
- Last renovation year — `renovationYear` (number).
- Plot facing — `plotFacing` (text).
- Construction quality — `constructionQuality` (text).
- Builder name — `builder` (text).
- Road width (ft) — `road` (number).
- Independent electricity meter — `independentMeter` (boolean).
- Independent water connection — `independentWater` (boolean).

**Legal / ownership**

- Ownership — `tenure` (choice); Freehold, Leasehold, Power of attorney.
- Approving authority — `approvalNote` (choice); GMADA, CHB, PUDA, HUDA / HSVP, Municipal authority, Private developer, Other.
- Authority / approval details — `authorityOther` (text).
- Title details — `title` (text).
- Known dues — `dues` (text).
- Known dispute — `dispute` (text).
- Ownership clear — `ownershipClear` (boolean).
- Registry available — `registryAvailable` (boolean).
- Mutation completed — `mutation` (boolean).
- Possession available — `possessionAvailable` (boolean).
- Bank finance available — `loanable` (boolean).
- RERA number (if applicable) — `rera` (text).

**Commercial / occupancy**

- Possession — `possession` (choice); Ready to move, Under construction, Within 3 months, Within 6 months.
- Expected possession date — `possessionDate` (date); shown when possession is Under construction.
- Construction stage — `constructionStage` (text); shown when possession is Under construction.
- Occupancy — `occupancy` (choice); Vacant, Owner occupied, Tenant occupied, Rented, Leased.
- Available from — `availableFrom` (date).
- Tenant / tenant type — `tenant` (text); shown when occupancy is Tenant occupied / Rented / Leased.
- Monthly rent (₹) — `monthlyRent` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lock-in (months) — `lockIn` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Annual escalation (%) — `escalation` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Security deposit (₹) — `deposit` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Notice period (months) — `noticePeriod` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease start — `leaseStart` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease end — `leaseEnd` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease transferable — `leaseTransferable` (boolean); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease structure — `leaseStructure` (text); shown when occupancy is Tenant occupied / Rented / Leased.

### House details (122 fields)

**Essentials**

- Frontage (ft) — `frontage` (number).
- Depth (ft) — `depth` (number).
- Main road width (ft) — `road` (number).
- Facing — `facing` (choice); East, West, North, South, North-East, North-West, South-East, South-West.
- Open sides — `openSides` (choice); One side, Two side, Three side, Four side.
- Built-up area (sq ft) — `builtup` (number).
- Number of floors — `floorCount` (number).
- Bedrooms — `beds` (number).
- Bathrooms — `baths` (number).

**Features**

- Corner — `corner` (boolean).
- Park facing — `parkFacing` (boolean).
- Main road facing — `mainRoad` (boolean).
- Green belt behind — `nearGreen` (boolean).
- Green belt facing — `greenFacing` (boolean).
- T-point — `tPoint` (boolean).
- Cul-de-sac / dead end — `deadEnd` (boolean).
- Service lane — `serviceLane` (boolean).
- Corner cut — `cornerCut` (boolean).
- Two-side road — `twoSide` (boolean).
- Second-side road width (ft) — `road2` (number); shown when corner is true.
- Second-side facing — `facing2` (choice); East, West, North, South, North-East, North-West, South-East, South-West; shown when corner is true.
- Balconies — `balconies` (number).
- Powder rooms — `powderRooms` (number).
- Kitchens — `kitchens` (number).
- Study room — `study` (boolean).
- Store room — `store` (boolean).
- Servant room — `servant` (boolean).
- Utility area — `utility` (boolean).
- Pooja room — `puja` (boolean).
- Dressing room — `dressing` (boolean).
- Dining area — `dining` (boolean).
- Drawing / living room — `living` (boolean).
- Private terrace — `terrace` (boolean).
- Parking count — `parking` (number).
- Covered parking — `coveredParking` (boolean).
- Open parking — `openParking` (boolean).
- Basement parking — `basementParking` (boolean).
- Basement — `basement` (boolean).
- Lawn / garden — `lawn` (boolean).
- Backyard — `backyard` (boolean).
- Family lounge — `familyLounge` (boolean).
- Servant washroom — `servantBath` (boolean).
- Lift — `lift` (boolean).
- Power backup — `powerBackup` (boolean).
- Security — `security` (boolean).
- Fire safety — `fireSafety` (boolean).
- Wheelchair access — `wheelchair` (boolean).
- Number of lifts — `liftCount` (number); shown when lift is true.
- Lift type — `liftType` (choice); Passenger, Private, Service; shown when lift is true.
- Service lift — `serviceLift` (boolean); shown when lift is true.
- Furnishing — `furnishing` (choice); Unfurnished, Semi-furnished, Fully furnished.

**More details**

- Shape — `shape` (choice); Regular, Irregular, Rectangle, Square, L-shape, Corner cut.
- Front dimension (ft) — `dimFront` (number); shown when shape is Irregular / L-shape / Corner cut.
- Back dimension (ft) — `dimBack` (number); shown when shape is Irregular / L-shape / Corner cut.
- Left dimension (ft) — `dimLeft` (number); shown when shape is Irregular / L-shape / Corner cut.
- Right dimension (ft) — `dimRight` (number); shown when shape is Irregular / L-shape / Corner cut.
- Ground level — `level` (choice); Level with road, Above road, Below road.
- Height difference (ft) — `heightDifference` (number); shown when level is Above road / Below road.
- Dedicated parking number — `parkingNumber` (text).
- Basement area (sq ft) — `basementArea` (number); shown when basement is true.
- Basement access — `basementAccess` (text); shown when basement is true.
- Basement use — `basementUse` (text); shown when basement is true.
- Ground floor area (sq ft) — `groundArea` (number).
- First floor area (sq ft) — `firstArea` (number).
- Second floor area (sq ft) — `secondArea` (number).
- Third floor area (sq ft) — `thirdArea` (number).
- Covered area (sq ft) — `coveredArea` (number).
- Front setback (ft) — `frontSetback` (number).
- Rear setback (ft) — `rearSetback` (number).
- Floor-wise construction — `floorPlan` (text).
- Ground floor built — `groundFloor` (boolean).
- First floor built — `firstFloor` (boolean).
- Second floor built — `secondFloor` (boolean).
- Generator backup — `generator` (boolean).
- CCTV — `cctv` (boolean).
- Intercom — `intercom` (boolean).
- Access control — `accessControl` (boolean).
- Solar panels — `solar` (boolean).
- Water tank — `waterTank` (boolean).
- Borewell — `borewell` (boolean).
- Modular kitchen — `modularKitchen` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Wardrobes — `wardrobes` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- ACs — `ac` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Fans — `fans` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Lights — `lights` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Geysers — `geysers` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Beds — `furnitureBeds` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Sofa — `sofa` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Dining table — `diningTable` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Appliances — `appliances` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Curtains / blinds — `curtains` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Other included furniture — `otherFurniture` (text); shown when furnishing is Semi-furnished / Fully furnished / Furnished.
- Condition — `condition` (choice); New, Resale, Recently renovated, Needs renovation.
- Age of construction — `age` (text).
- Last renovation year — `renovationYear` (number).

**Legal / ownership**

- Ownership — `tenure` (choice); Freehold, Leasehold, Power of attorney.
- Approving authority — `approvalNote` (choice); GMADA, CHB, PUDA, HUDA / HSVP, Municipal authority, Private developer, Other.
- Authority / approval details — `authorityOther` (text).
- Title details — `title` (text).
- Known dues — `dues` (text).
- Known dispute — `dispute` (text).
- Ownership clear — `ownershipClear` (boolean).
- Registry available — `registryAvailable` (boolean).
- Mutation completed — `mutation` (boolean).
- Possession available — `possessionAvailable` (boolean).
- Bank finance available — `loanable` (boolean).
- RERA number (if applicable) — `rera` (text).

**Commercial / occupancy**

- Possession — `possession` (choice); Ready to move, Under construction, Within 3 months, Within 6 months.
- Expected possession date — `possessionDate` (date); shown when possession is Under construction.
- Construction stage — `constructionStage` (text); shown when possession is Under construction.
- Occupancy — `occupancy` (choice); Vacant, Owner occupied, Tenant occupied, Rented, Leased.
- Available from — `availableFrom` (date).
- Tenant / tenant type — `tenant` (text); shown when occupancy is Tenant occupied / Rented / Leased.
- Monthly rent (₹) — `monthlyRent` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lock-in (months) — `lockIn` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Annual escalation (%) — `escalation` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Security deposit (₹) — `deposit` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Notice period (months) — `noticePeriod` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease start — `leaseStart` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease end — `leaseEnd` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease transferable — `leaseTransferable` (boolean); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease structure — `leaseStructure` (text); shown when occupancy is Tenant occupied / Rented / Leased.

### Villa details (140 fields)

**Essentials**

- Frontage (ft) — `frontage` (number).
- Depth (ft) — `depth` (number).
- Main road width (ft) — `road` (number).
- Facing — `facing` (choice); East, West, North, South, North-East, North-West, South-East, South-West.
- Open sides — `openSides` (choice); One side, Two side, Three side, Four side.
- Built-up area (sq ft) — `builtup` (number).
- Number of floors — `floorCount` (number).
- Bedrooms — `beds` (number).
- Bathrooms — `baths` (number).
- Villa type — `villaType` (text).
- Configuration — `config` (choice); 2 BHK, 3 BHK, 4 BHK, 5+ BHK.

**Features**

- Corner — `corner` (boolean).
- Park facing — `parkFacing` (boolean).
- Main road facing — `mainRoad` (boolean).
- Green belt behind — `nearGreen` (boolean).
- Green belt facing — `greenFacing` (boolean).
- T-point — `tPoint` (boolean).
- Cul-de-sac / dead end — `deadEnd` (boolean).
- Service lane — `serviceLane` (boolean).
- Corner cut — `cornerCut` (boolean).
- Two-side road — `twoSide` (boolean).
- Second-side road width (ft) — `road2` (number); shown when corner is true.
- Second-side facing — `facing2` (choice); East, West, North, South, North-East, North-West, South-East, South-West; shown when corner is true.
- Balconies — `balconies` (number).
- Powder rooms — `powderRooms` (number).
- Kitchens — `kitchens` (number).
- Study room — `study` (boolean).
- Store room — `store` (boolean).
- Servant room — `servant` (boolean).
- Utility area — `utility` (boolean).
- Pooja room — `puja` (boolean).
- Dressing room — `dressing` (boolean).
- Dining area — `dining` (boolean).
- Drawing / living room — `living` (boolean).
- Private terrace — `terrace` (boolean).
- Parking count — `parking` (number).
- Covered parking — `coveredParking` (boolean).
- Open parking — `openParking` (boolean).
- Basement parking — `basementParking` (boolean).
- Basement — `basement` (boolean).
- Lawn / garden — `lawn` (boolean).
- Backyard — `backyard` (boolean).
- Family lounge — `familyLounge` (boolean).
- Servant washroom — `servantBath` (boolean).
- Lift — `lift` (boolean).
- Power backup — `powerBackup` (boolean).
- Security — `security` (boolean).
- Fire safety — `fireSafety` (boolean).
- Wheelchair access — `wheelchair` (boolean).
- Number of lifts — `liftCount` (number); shown when lift is true.
- Lift type — `liftType` (choice); Passenger, Private, Service; shown when lift is true.
- Service lift — `serviceLift` (boolean); shown when lift is true.
- Furnishing — `furnishing` (choice); Unfurnished, Semi-furnished, Fully furnished.
- Private pool — `privatePool` (boolean).

**More details**

- Shape — `shape` (choice); Regular, Irregular, Rectangle, Square, L-shape, Corner cut.
- Front dimension (ft) — `dimFront` (number); shown when shape is Irregular / L-shape / Corner cut.
- Back dimension (ft) — `dimBack` (number); shown when shape is Irregular / L-shape / Corner cut.
- Left dimension (ft) — `dimLeft` (number); shown when shape is Irregular / L-shape / Corner cut.
- Right dimension (ft) — `dimRight` (number); shown when shape is Irregular / L-shape / Corner cut.
- Ground level — `level` (choice); Level with road, Above road, Below road.
- Height difference (ft) — `heightDifference` (number); shown when level is Above road / Below road.
- Dedicated parking number — `parkingNumber` (text).
- Basement area (sq ft) — `basementArea` (number); shown when basement is true.
- Basement access — `basementAccess` (text); shown when basement is true.
- Basement use — `basementUse` (text); shown when basement is true.
- Ground floor area (sq ft) — `groundArea` (number).
- First floor area (sq ft) — `firstArea` (number).
- Second floor area (sq ft) — `secondArea` (number).
- Third floor area (sq ft) — `thirdArea` (number).
- Covered area (sq ft) — `coveredArea` (number).
- Front setback (ft) — `frontSetback` (number).
- Rear setback (ft) — `rearSetback` (number).
- Floor-wise construction — `floorPlan` (text).
- Ground floor built — `groundFloor` (boolean).
- First floor built — `firstFloor` (boolean).
- Second floor built — `secondFloor` (boolean).
- Generator backup — `generator` (boolean).
- CCTV — `cctv` (boolean).
- Intercom — `intercom` (boolean).
- Access control — `accessControl` (boolean).
- Solar panels — `solar` (boolean).
- Water tank — `waterTank` (boolean).
- Borewell — `borewell` (boolean).
- Modular kitchen — `modularKitchen` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Wardrobes — `wardrobes` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- ACs — `ac` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Fans — `fans` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Lights — `lights` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Geysers — `geysers` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Beds — `furnitureBeds` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Sofa — `sofa` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Dining table — `diningTable` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Appliances — `appliances` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Curtains / blinds — `curtains` (boolean); shown when furnishing is Semi-furnished / Fully furnished / Furnished / Semi furnished / Fully furnished.
- Other included furniture — `otherFurniture` (text); shown when furnishing is Semi-furnished / Fully furnished / Furnished.
- Condition — `condition` (choice); New, Resale, Recently renovated, Needs renovation.
- Age of construction — `age` (text).
- Last renovation year — `renovationYear` (number).
- Clubhouse — `clubhouse` (boolean).
- Gym — `gym` (boolean).
- Swimming pool — `pool` (boolean).
- Park — `park` (boolean).
- Kids area — `kidsArea` (boolean).
- Sports facilities — `sports` (boolean).
- Community hall — `communityHall` (boolean).
- Visitor parking — `visitorParking` (boolean).
- Grocery — `grocery` (boolean).
- Maintenance office — `maintenanceOffice` (boolean).
- Pet friendly — `petFriendly` (boolean).
- Gated community — `gated` (boolean).
- Developer — `developer` (text).
- Community facilities — `communityFacilities` (text).

**Legal / ownership**

- Ownership — `tenure` (choice); Freehold, Leasehold, Power of attorney.
- Approving authority — `approvalNote` (choice); GMADA, CHB, PUDA, HUDA / HSVP, Municipal authority, Private developer, Other.
- Authority / approval details — `authorityOther` (text).
- Title details — `title` (text).
- Known dues — `dues` (text).
- Known dispute — `dispute` (text).
- Ownership clear — `ownershipClear` (boolean).
- Registry available — `registryAvailable` (boolean).
- Mutation completed — `mutation` (boolean).
- Possession available — `possessionAvailable` (boolean).
- Bank finance available — `loanable` (boolean).
- RERA number (if applicable) — `rera` (text).

**Commercial / occupancy**

- Possession — `possession` (choice); Ready to move, Under construction, Within 3 months, Within 6 months.
- Expected possession date — `possessionDate` (date); shown when possession is Under construction.
- Construction stage — `constructionStage` (text); shown when possession is Under construction.
- Occupancy — `occupancy` (choice); Vacant, Owner occupied, Tenant occupied, Rented, Leased.
- Available from — `availableFrom` (date).
- Tenant / tenant type — `tenant` (text); shown when occupancy is Tenant occupied / Rented / Leased.
- Monthly rent (₹) — `monthlyRent` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lock-in (months) — `lockIn` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Annual escalation (%) — `escalation` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Security deposit (₹) — `deposit` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Notice period (months) — `noticePeriod` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease start — `leaseStart` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease end — `leaseEnd` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease transferable — `leaseTransferable` (boolean); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease structure — `leaseStructure` (text); shown when occupancy is Tenant occupied / Rented / Leased.
- Monthly maintenance (₹) — `maintenance` (number).

### SCO details (87 fields)

**Essentials**

- SCO number — `plotNo` (text).
- Frontage (ft) — `frontage` (number).
- Depth (ft) — `depth` (number).
- Number of floors — `floorCount` (number).
- Road width (ft) — `road` (number).
- Facing — `facing` (choice); East, West, North, South, North-East, North-West, South-East, South-West.

**Features**

- Basement — `basement` (boolean).
- Visibility — `visibility` (text).
- Pedestrian footfall — `footfall` (text).
- Vehicle traffic — `vehicleTraffic` (text).
- Main road facing — `mainRoad` (boolean).
- Corner — `corner` (boolean).
- Loading / unloading access — `loadingAccess` (boolean).
- Rear access — `rearAccess` (boolean).
- Service lane — `serviceLane` (boolean).
- Showroom suitable — `showroomSuitable` (boolean).
- Office suitable — `officeSuitable` (boolean).
- Restaurant suitable — `restaurantSuitable` (boolean).
- Retail suitable — `retailSuitable` (boolean).
- Bank suitable — `bankSuitable` (boolean).
- Clinic suitable — `clinicSuitable` (boolean).
- Public parking — `publicParking` (boolean).
- Roadside parking — `roadsideParking` (boolean).
- Parking count — `parking` (number).
- Covered parking — `coveredParking` (boolean).
- Open parking — `openParking` (boolean).
- Basement parking — `basementParking` (boolean).
- Lift — `lift` (boolean).
- Power backup — `powerBackup` (boolean).
- Security — `security` (boolean).
- Fire safety — `fireSafety` (boolean).
- Wheelchair access — `wheelchair` (boolean).
- Number of lifts — `liftCount` (number); shown when lift is true.
- Lift type — `liftType` (choice); Passenger, Private, Service; shown when lift is true.
- Service lift — `serviceLift` (boolean); shown when lift is true.
- Washrooms — `washrooms` (number).

**More details**

- Ground floor area (sq ft) — `groundArea` (number).
- First floor area (sq ft) — `firstArea` (number).
- Second floor area (sq ft) — `secondArea` (number).
- Third floor area (sq ft) — `thirdArea` (number).
- Basement area (sq ft) — `basementArea` (number); shown when basement is true.
- Basement access — `basementAccess` (text); shown when basement is true.
- Basement use — `basementUse` (text); shown when basement is true.
- Signage width (ft) — `signage` (number).
- Dedicated parking number — `parkingNumber` (text).
- Generator backup — `generator` (boolean).
- CCTV — `cctv` (boolean).
- Intercom — `intercom` (boolean).
- Access control — `accessControl` (boolean).
- Current use — `currentUse` (text).
- Permitted use — `use` (text).
- Sanctioned power load (kW) — `powerLoad` (number).
- Three-phase electricity — `threePhase` (boolean).
- Water — `water` (boolean).
- Sewerage — `sewer` (boolean).
- HVAC — `centralAc` (boolean).
- Air conditioning — `ac` (boolean).
- Pantry — `pantry` (boolean).

**Legal / ownership**

- Ownership — `tenure` (choice); Freehold, Leasehold, Power of attorney.
- Approving authority — `approvalNote` (choice); GMADA, CHB, PUDA, HUDA / HSVP, Municipal authority, Private developer, Other.
- Authority / approval details — `authorityOther` (text).
- Title details — `title` (text).
- Known dues — `dues` (text).
- Known dispute — `dispute` (text).
- Ownership clear — `ownershipClear` (boolean).
- Registry available — `registryAvailable` (boolean).
- Mutation completed — `mutation` (boolean).
- Possession available — `possessionAvailable` (boolean).
- Bank finance available — `loanable` (boolean).
- RERA number (if applicable) — `rera` (text).
- Commercial approval — `commercialApproval` (boolean).
- Fire NOC — `fireNoc` (boolean).

**Commercial / occupancy**

- Possession — `possession` (choice); Ready to move, Under construction, Within 3 months, Within 6 months.
- Expected possession date — `possessionDate` (date); shown when possession is Under construction.
- Construction stage — `constructionStage` (text); shown when possession is Under construction.
- Occupancy — `occupancy` (choice); Vacant, Owner occupied, Tenant occupied, Rented, Leased.
- Available from — `availableFrom` (date).
- Tenant / tenant type — `tenant` (text); shown when occupancy is Tenant occupied / Rented / Leased.
- Monthly rent (₹) — `monthlyRent` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lock-in (months) — `lockIn` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Annual escalation (%) — `escalation` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Security deposit (₹) — `deposit` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Notice period (months) — `noticePeriod` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease start — `leaseStart` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease end — `leaseEnd` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease transferable — `leaseTransferable` (boolean); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease structure — `leaseStructure` (text); shown when occupancy is Tenant occupied / Rented / Leased.

### Booth details (75 fields)

**Essentials**

- Booth number — `plotNo` (text).
- Floor — `floor` (text).
- Frontage (ft) — `frontage` (number).
- Depth (ft) — `depth` (number).
- Facing — `facing` (choice); East, West, North, South, North-East, North-West, South-East, South-West.

**Features**

- Market location — `marketLocation` (choice); Main market, Inner market, Road facing, Pedestrian zone.
- Visibility — `visibility` (text).
- Pedestrian footfall — `footfall` (text).
- Vehicle traffic — `vehicleTraffic` (text).
- Main road facing — `mainRoad` (boolean).
- Corner — `corner` (boolean).
- Loading / unloading access — `loadingAccess` (boolean).
- Rear access — `rearAccess` (boolean).
- Service lane — `serviceLane` (boolean).
- Storage — `store` (boolean).
- Mezzanine — `mezzanine` (boolean).
- Parking count — `parking` (number).
- Covered parking — `coveredParking` (boolean).
- Open parking — `openParking` (boolean).
- Basement parking — `basementParking` (boolean).
- Lift — `lift` (boolean).
- Power backup — `powerBackup` (boolean).
- Security — `security` (boolean).
- Fire safety — `fireSafety` (boolean).
- Wheelchair access — `wheelchair` (boolean).
- Number of lifts — `liftCount` (number); shown when lift is true.
- Lift type — `liftType` (choice); Passenger, Private, Service; shown when lift is true.
- Service lift — `serviceLift` (boolean); shown when lift is true.
- Washrooms — `washrooms` (number).

**More details**

- Signage width (ft) — `signage` (number).
- Ceiling height (ft) — `ceiling` (number).
- Shutter width (ft) — `shutter` (number).
- Dedicated parking number — `parkingNumber` (text).
- Generator backup — `generator` (boolean).
- CCTV — `cctv` (boolean).
- Intercom — `intercom` (boolean).
- Access control — `accessControl` (boolean).
- Current use — `currentUse` (text).
- Permitted use — `use` (text).
- Sanctioned power load (kW) — `powerLoad` (number).
- Three-phase electricity — `threePhase` (boolean).
- Water — `water` (boolean).
- Sewerage — `sewer` (boolean).
- HVAC — `centralAc` (boolean).
- Air conditioning — `ac` (boolean).
- Pantry — `pantry` (boolean).

**Legal / ownership**

- Ownership — `tenure` (choice); Freehold, Leasehold, Power of attorney.
- Approving authority — `approvalNote` (choice); GMADA, CHB, PUDA, HUDA / HSVP, Municipal authority, Private developer, Other.
- Authority / approval details — `authorityOther` (text).
- Title details — `title` (text).
- Known dues — `dues` (text).
- Known dispute — `dispute` (text).
- Ownership clear — `ownershipClear` (boolean).
- Registry available — `registryAvailable` (boolean).
- Mutation completed — `mutation` (boolean).
- Possession available — `possessionAvailable` (boolean).
- Bank finance available — `loanable` (boolean).
- RERA number (if applicable) — `rera` (text).
- Commercial approval — `commercialApproval` (boolean).
- Fire NOC — `fireNoc` (boolean).

**Commercial / occupancy**

- Possession — `possession` (choice); Ready to move, Under construction, Within 3 months, Within 6 months.
- Expected possession date — `possessionDate` (date); shown when possession is Under construction.
- Construction stage — `constructionStage` (text); shown when possession is Under construction.
- Occupancy — `occupancy` (choice); Vacant, Owner occupied, Tenant occupied, Rented, Leased.
- Available from — `availableFrom` (date).
- Tenant / tenant type — `tenant` (text); shown when occupancy is Tenant occupied / Rented / Leased.
- Monthly rent (₹) — `monthlyRent` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lock-in (months) — `lockIn` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Annual escalation (%) — `escalation` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Security deposit (₹) — `deposit` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Notice period (months) — `noticePeriod` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease start — `leaseStart` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease end — `leaseEnd` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease transferable — `leaseTransferable` (boolean); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease structure — `leaseStructure` (text); shown when occupancy is Tenant occupied / Rented / Leased.

### Office details (82 fields)

**Essentials**

- Carpet area (sq ft) — `carpet` (number).
- Built-up area (sq ft) — `builtup` (number).
- Super area (sq ft) — `superArea` (number).
- Total floors — `totalFloors` (number).
- Floor — `floor` (text).

**Features**

- Workstation capacity — `seats` (number).
- Cabins — `cabins` (number).
- Conference rooms — `conference` (number).
- Meeting rooms — `meetingRooms` (number).
- Open workstations — `openWorkstations` (boolean).
- Reception — `reception` (boolean).
- Server room — `serverRoom` (boolean).
- Store room — `store` (boolean).
- Breakout area — `breakout` (boolean).
- Fit-out — `fitout` (choice); Bare shell, Warm shell, Semi-furnished, Fully furnished, Plug-and-play.
- Parking count — `parking` (number).
- Covered parking — `coveredParking` (boolean).
- Open parking — `openParking` (boolean).
- Basement parking — `basementParking` (boolean).
- Lift — `lift` (boolean).
- Power backup — `powerBackup` (boolean).
- Security — `security` (boolean).
- Fire safety — `fireSafety` (boolean).
- Wheelchair access — `wheelchair` (boolean).
- Number of lifts — `liftCount` (number); shown when lift is true.
- Lift type — `liftType` (choice); Passenger, Private, Service; shown when lift is true.
- Service lift — `serviceLift` (boolean); shown when lift is true.
- Washrooms — `washrooms` (number).

**More details**

- Workstations — `workstations` (boolean); shown when fitout is Semi-furnished / Fully furnished / Plug-and-play.
- Chairs — `chairs` (boolean); shown when fitout is Semi-furnished / Fully furnished / Plug-and-play.
- Fitted cabins — `fittedCabins` (boolean); shown when fitout is Semi-furnished / Fully furnished / Plug-and-play.
- Conference table — `conferenceTable` (boolean); shown when fitout is Semi-furnished / Fully furnished / Plug-and-play.
- Networking — `networking` (boolean); shown when fitout is Semi-furnished / Fully furnished / Plug-and-play.
- UPS — `ups` (boolean); shown when fitout is Semi-furnished / Fully furnished / Plug-and-play.
- Server rack — `serverRack` (boolean); shown when fitout is Semi-furnished / Fully furnished / Plug-and-play.
- Dedicated parking number — `parkingNumber` (text).
- Generator backup — `generator` (boolean).
- CCTV — `cctv` (boolean).
- Intercom — `intercom` (boolean).
- Access control — `accessControl` (boolean).
- Current use — `currentUse` (text).
- Permitted use — `use` (text).
- Sanctioned power load (kW) — `powerLoad` (number).
- Three-phase electricity — `threePhase` (boolean).
- Water — `water` (boolean).
- Sewerage — `sewer` (boolean).
- HVAC — `centralAc` (boolean).
- Air conditioning — `ac` (boolean).
- Pantry — `pantry` (boolean).

**Legal / ownership**

- Approved office use — `officeApproved` (boolean).
- Ownership — `tenure` (choice); Freehold, Leasehold, Power of attorney.
- Approving authority — `approvalNote` (choice); GMADA, CHB, PUDA, HUDA / HSVP, Municipal authority, Private developer, Other.
- Authority / approval details — `authorityOther` (text).
- Title details — `title` (text).
- Known dues — `dues` (text).
- Known dispute — `dispute` (text).
- Ownership clear — `ownershipClear` (boolean).
- Registry available — `registryAvailable` (boolean).
- Mutation completed — `mutation` (boolean).
- Possession available — `possessionAvailable` (boolean).
- Bank finance available — `loanable` (boolean).
- RERA number (if applicable) — `rera` (text).
- Commercial approval — `commercialApproval` (boolean).
- Fire NOC — `fireNoc` (boolean).

**Commercial / occupancy**

- Monthly maintenance (₹) — `maintenance` (number).
- Monthly CAM (₹) — `cam` (number).
- Electricity tariff (₹/kWh) — `electricityTariff` (number).
- Possession — `possession` (choice); Ready to move, Under construction, Within 3 months, Within 6 months.
- Expected possession date — `possessionDate` (date); shown when possession is Under construction.
- Construction stage — `constructionStage` (text); shown when possession is Under construction.
- Occupancy — `occupancy` (choice); Vacant, Owner occupied, Tenant occupied, Rented, Leased.
- Available from — `availableFrom` (date).
- Tenant / tenant type — `tenant` (text); shown when occupancy is Tenant occupied / Rented / Leased.
- Monthly rent (₹) — `monthlyRent` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lock-in (months) — `lockIn` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Annual escalation (%) — `escalation` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Security deposit (₹) — `deposit` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Notice period (months) — `noticePeriod` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease start — `leaseStart` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease end — `leaseEnd` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease transferable — `leaseTransferable` (boolean); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease structure — `leaseStructure` (text); shown when occupancy is Tenant occupied / Rented / Leased.

### Showroom details (83 fields)

**Essentials**

- Carpet area (sq ft) — `carpet` (number).
- Frontage (ft) — `frontage` (number).
- Showroom width (ft) — `showroomWidth` (number).
- Depth (ft) — `depth` (number).
- Ceiling height (ft) — `ceiling` (number).
- Road width (ft) — `road` (number).
- Floor — `floor` (text).

**Features**

- Visibility — `visibility` (text).
- Pedestrian footfall — `footfall` (text).
- Vehicle traffic — `vehicleTraffic` (text).
- Main road facing — `mainRoad` (boolean).
- Corner — `corner` (boolean).
- Loading / unloading access — `loadingAccess` (boolean).
- Rear access — `rearAccess` (boolean).
- Service lane — `serviceLane` (boolean).
- Double-height ceiling — `doubleHeight` (boolean).
- Glass frontage — `glassFront` (boolean).
- Valet possible — `valet` (boolean).
- Storage — `store` (boolean).
- Mezzanine — `mezzanine` (boolean).
- Basement — `basement` (boolean).
- Parking count — `parking` (number).
- Covered parking — `coveredParking` (boolean).
- Open parking — `openParking` (boolean).
- Basement parking — `basementParking` (boolean).
- Lift — `lift` (boolean).
- Power backup — `powerBackup` (boolean).
- Security — `security` (boolean).
- Fire safety — `fireSafety` (boolean).
- Wheelchair access — `wheelchair` (boolean).
- Number of lifts — `liftCount` (number); shown when lift is true.
- Lift type — `liftType` (choice); Passenger, Private, Service; shown when lift is true.
- Service lift — `serviceLift` (boolean); shown when lift is true.
- Washrooms — `washrooms` (number).

**More details**

- Signage width (ft) — `signage` (number).
- Number of entrances — `entrances` (number).
- Shutter width (ft) — `shutter` (number).
- Basement area (sq ft) — `basementArea` (number); shown when basement is true.
- Basement access — `basementAccess` (text); shown when basement is true.
- Basement use — `basementUse` (text); shown when basement is true.
- Dedicated parking number — `parkingNumber` (text).
- Generator backup — `generator` (boolean).
- CCTV — `cctv` (boolean).
- Intercom — `intercom` (boolean).
- Access control — `accessControl` (boolean).
- Current use — `currentUse` (text).
- Permitted use — `use` (text).
- Sanctioned power load (kW) — `powerLoad` (number).
- Three-phase electricity — `threePhase` (boolean).
- Water — `water` (boolean).
- Sewerage — `sewer` (boolean).
- HVAC — `centralAc` (boolean).
- Air conditioning — `ac` (boolean).
- Pantry — `pantry` (boolean).

**Legal / ownership**

- Ownership — `tenure` (choice); Freehold, Leasehold, Power of attorney.
- Approving authority — `approvalNote` (choice); GMADA, CHB, PUDA, HUDA / HSVP, Municipal authority, Private developer, Other.
- Authority / approval details — `authorityOther` (text).
- Title details — `title` (text).
- Known dues — `dues` (text).
- Known dispute — `dispute` (text).
- Ownership clear — `ownershipClear` (boolean).
- Registry available — `registryAvailable` (boolean).
- Mutation completed — `mutation` (boolean).
- Possession available — `possessionAvailable` (boolean).
- Bank finance available — `loanable` (boolean).
- RERA number (if applicable) — `rera` (text).
- Commercial approval — `commercialApproval` (boolean).
- Fire NOC — `fireNoc` (boolean).

**Commercial / occupancy**

- Possession — `possession` (choice); Ready to move, Under construction, Within 3 months, Within 6 months.
- Expected possession date — `possessionDate` (date); shown when possession is Under construction.
- Construction stage — `constructionStage` (text); shown when possession is Under construction.
- Occupancy — `occupancy` (choice); Vacant, Owner occupied, Tenant occupied, Rented, Leased.
- Available from — `availableFrom` (date).
- Tenant / tenant type — `tenant` (text); shown when occupancy is Tenant occupied / Rented / Leased.
- Monthly rent (₹) — `monthlyRent` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lock-in (months) — `lockIn` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Annual escalation (%) — `escalation` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Security deposit (₹) — `deposit` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Notice period (months) — `noticePeriod` (number); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease start — `leaseStart` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease end — `leaseEnd` (date); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease transferable — `leaseTransferable` (boolean); shown when occupancy is Tenant occupied / Rented / Leased.
- Lease structure — `leaseStructure` (text); shown when occupancy is Tenant occupied / Rented / Leased.

### Industrial property details (79 fields)

**Essentials**

- Frontage (ft) — `frontage` (number).
- Depth (ft) — `depth` (number).
- Main road width (ft) — `road` (number).
- Facing — `facing` (choice); East, West, North, South, North-East, North-West, South-East, South-West.
- Open sides — `openSides` (choice); One side, Two side, Three side, Four side.
- Plot number — `plotNo` (text).
- Industrial zone — `industrialZone` (text).
- Sector / estate — `estate` (text).

**Features**

- Corner — `corner` (boolean).
- Park facing — `parkFacing` (boolean).
- Main road facing — `mainRoad` (boolean).
- Green belt behind — `nearGreen` (boolean).
- Green belt facing — `greenFacing` (boolean).
- T-point — `tPoint` (boolean).
- Cul-de-sac / dead end — `deadEnd` (boolean).
- Service lane — `serviceLane` (boolean).
- Corner cut — `cornerCut` (boolean).
- Two-side road — `twoSide` (boolean).
- Second-side road width (ft) — `road2` (number); shown when corner is true.
- Second-side facing — `facing2` (choice); East, West, North, South, North-East, North-West, South-East, South-West; shown when corner is true.
- Highway distance (km) — `highwayDistance` (number).
- Main road distance (km) — `mainRoadDistance` (number).
- Truck access — `truckAccess` (boolean).
- Trailer access — `trailerAccess` (boolean).
- Trailer turning suitability — `turningRadius` (boolean).
- Loading access — `loadingAccess` (boolean).
- Multiple gates — `multipleGates` (boolean).
- Built structure exists — `built` (boolean).

**More details**

- Shape — `shape` (choice); Regular, Irregular, Rectangle, Square, L-shape, Corner cut.
- Front dimension (ft) — `dimFront` (number); shown when shape is Irregular / L-shape / Corner cut.
- Back dimension (ft) — `dimBack` (number); shown when shape is Irregular / L-shape / Corner cut.
- Left dimension (ft) — `dimLeft` (number); shown when shape is Irregular / L-shape / Corner cut.
- Right dimension (ft) — `dimRight` (number); shown when shape is Irregular / L-shape / Corner cut.
- Ground level — `level` (choice); Level with road, Above road, Below road.
- Height difference (ft) — `heightDifference` (number); shown when level is Above road / Below road.
- Sanctioned power load (kW) — `powerLoad` (number).
- Connected load (kW) — `connectedLoad` (number).
- Three-phase electricity — `threePhase` (boolean).
- Transformer — `transformer` (boolean).
- DG backup — `generator` (boolean).
- Borewell — `borewell` (boolean).
- Sewerage — `sewer` (boolean).
- Drainage — `drainage` (boolean).
- Gas pipeline — `gas` (boolean).
- Telecom / fibre — `fibre` (boolean).
- Water source — `waterSource` (text).
- Shed area (sq ft) — `shedArea` (number); shown when built is true.
- RCC area (sq ft) — `rccArea` (number); shown when built is true.
- Office area (sq ft) — `officeArea` (number); shown when built is true.
- Warehouse area (sq ft) — `warehouseArea` (number); shown when built is true.
- Production area (sq ft) — `productionArea` (number); shown when built is true.
- Clear height (ft) — `ceiling` (number); shown when built is true.
- Eave height (ft) — `eaveHeight` (number); shown when built is true.
- Floor load (kg/sq m) — `floorLoad` (number); shown when built is true.
- Number of shutters — `shutterCount` (number); shown when built is true.
- Shutter height (ft) — `shutterHeight` (number); shown when built is true.
- Crane provision — `crane` (boolean); shown when built is true.
- EOT crane — `eotCrane` (boolean); shown when built is true.
- Loading dock — `loadingBay` (boolean); shown when built is true.
- Labour rooms — `labourQtr` (boolean); shown when built is true.
- Guard room — `guardRoom` (boolean); shown when built is true.
- Office block — `officeBlock` (boolean); shown when built is true.

**Legal / ownership**

- Ownership — `tenure` (choice); Freehold, Leasehold, Power of attorney.
- Approving authority — `approvalNote` (choice); GMADA, CHB, PUDA, HUDA / HSVP, Municipal authority, Private developer, Other.
- Authority / approval details — `authorityOther` (text).
- Title details — `title` (text).
- Known dues — `dues` (text).
- Known dispute — `dispute` (text).
- Ownership clear — `ownershipClear` (boolean).
- Registry available — `registryAvailable` (boolean).
- Mutation completed — `mutation` (boolean).
- Possession available — `possessionAvailable` (boolean).
- Bank finance available — `loanable` (boolean).
- Industrial use approved — `industrialApproved` (boolean).
- Environmental clearance — `environmentClearance` (boolean).
- Pollution board consent — `pollutionConsent` (boolean).
- Fire NOC — `fireNoc` (boolean).
- Factory licence — `factoryLicence` (boolean).
- CLU status — `clu` (text).

## Files changed

- v2/src/packages/data/property-details-schema.ts: typed registry and completion/visibility helpers.
- v2/src/packages/data/property-specs.ts: schema-derived storage keys and legacy preservation.
- v2/src/apps/dealer/property-details.ts: draft switching and escaped view model.
- v2/src/apps/dealer/logic.ts: form integration, edit hydration and acre rate handling.
- v2/src/apps/dealer/template.ts: responsive Section 3 renderer.
- v2/src/apps/dealer/desk-store.ts: safe same-type merge and explicit clearing.
- v2/tests/smart-property-details.test.ts: schema, conditional, rendering, draft and persistence tests.

## Validation

Validation results are recorded below after the final runs.

- Typecheck and production build passed. Vite reports the existing large-bundle advisory.
- The full suite loaded 55 files and passed 849 tests at the initial full run. Six additional suites cannot load because the base commit lacks dealer pages/home, pages/customers, pages/deals, pages/links and shell modules.
- The final focused run passed 84 tests across smart-property-details, property-specs, property-location and add-property-telemetry. The questionnaire file contains 27 tests, including five actual Section 3 markup renders and repository save/fetch/edit coverage.
- The six unloadable files are ai-foundation.test.ts, customers-page-boundary.test.ts, dealer-operations.test.ts, dealer-shell-startup.test.ts, deals-page-boundary.test.ts and security-phase1-interactions.test.ts. No tests were deleted or disabled in repository configuration.
- Internal notes use the existing canonical privateNotes field and can be cleared explicitly.

- Final runnable-suite verification: 855 passed, 0 failed across 55 test files, excluding only the six existing unloadable suites via command-line flags.
