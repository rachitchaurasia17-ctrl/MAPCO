# Data model & rules

## Entities

**Property (plot)**
```
id, type ("Residential Plot" | "Flat" | "Floor" | "Kothi" | "Villa" | "Commercial …"),
want (Plot|Flat|Kothi|Villa|Commercial),   // coarse bucket used for matching
city, area, loc (display location), sector,
size, facing (East|West|North|South…), position (corner, park-facing…),
approvals[], landmarks[{name, distance}],
price (number, INR), photos[] (asset refs),
published (bool)  -> "On presentation" / "Not published"
sold (bool),
views (plot opens during presentations)
```

**Client**
```
id, name, phone, city, want, budget (display string), budgetMax (number),
status ('active'|…), seen ("just now"), note,
viewed[propertyId], interest[propertyId]
```

**Deal**
```
id, name, client, prop, propSub, area, propId,
value, comm (≈ 1.5% of value), token,
stage: 'enquiry'|'negotiating'|'token'|'registry'|'closed'
```

**ClientLink (private share)**
```
id, clientId, props[] (max 4), expiry ('3d'|…),
loc: 'area'|'exact'|'hidden', price: 'hidden'|'shown',   // price defaults hidden
audio: 'none'|'done' + secs,
status: 'active'|'revoked',
events: { opens, played, called, wa, visit }
```

**Map**
```
id, kind: 'masterplan'|'sector', city, sector, label,
raster (image, with intrinsic w/h — New Chandigarh is 1302×962),
dims: { original, 3d },
published (bool), hidden (bool),
sets: MarkSet[], linkedProperties[propertyId]
```

**MarkSet** — `{ id:'A'|'B'|'C'|…, name, marks: Mark[] }`
**Mark** — `{ kind:'road'|'block'|'pin'|'text', points:[[x,y],…] | {x,y}, label, propertyId? }`
All coordinates are **normalised 0–1** against the raster's intrinsic box so overlays scale.

## Visibility rules (the product)
1. A property appears in Client Presentation **only** when `published && !sold`.
2. A map appears **only** when `published && !hidden`.
3. On a **masterplan**, each MarkSet becomes one client-facing highlight button (A/B/C).
   On a **sector map**, marks render but **no set buttons are shown to the client**.
4. Client Presentation and the shared link **never show price** unless that specific
   ClientLink has `price:'shown'`.
5. A ClientLink carries at most **4** properties and is private to one client; revoking is
   immediate. Deleting a property removes it from every link (and empty links are dropped).
6. Only three metrics are real: property `views` (presentation opens), link `events.opens`,
   and stock counts. Everything else displayed must be derived from those.
