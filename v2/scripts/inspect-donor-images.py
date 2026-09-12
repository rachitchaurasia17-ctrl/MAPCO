import json, sys
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
root=Path(__file__).resolve().parents[2]
donor=Path(sys.argv[1])
r=json.loads((root/'docs/maps/donor-inventory.json').read_text())
seen=set(); images=[]; decoded=[]
for row in r['rows']:
    if not row['candidate'] or row['currentAsset'] or row['blob'] in seen: continue
    seen.add(row['blob'])
    try:
        im=Image.open(donor/row['path']); im.load()
        decoded.append(dict(path=row['path'],width=im.width,height=im.height,format=im.format))
        if row['path'].startswith('new_map_files/'): continue
        images.append((row['path'],im.copy().convert('RGB')))
    except Exception as e: decoded.append(dict(path=row['path'],error=str(e)))
out=root/'docs/maps/inspection'; out.mkdir(exist_ok=True)
(out/'decoded.json').write_text(json.dumps(decoded,indent=2))
for start in range(0,len(images),24):
    page=Image.new('RGB',(1600,1500),'white'); draw=ImageDraw.Draw(page)
    for j,(name,im) in enumerate(images[start:start+24]):
        x=(j%4)*400; y=(j//4)*250
        thumb=ImageOps.contain(im,(390,218))
        page.paste(thumb,(x,y)); draw.text((x+3,y+219),f'{start+j}: {name}',fill='black')
    page.save(out/f'sheet-{start//24}.jpg')
print(len(images), 'unique unmatched raster sheets',len(decoded),'decoded candidates')
