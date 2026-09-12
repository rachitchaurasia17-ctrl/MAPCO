"""Read committed donor PDF blobs; render every page for review, without OCR."""
import hashlib, io, json, subprocess, sys
from pathlib import Path
import pypdfium2 as pdfium
from PIL import Image, ImageOps, ImageDraw

root = Path(__file__).resolve().parents[2]
donor = Path(sys.argv[1])
out = root / 'docs/maps/inspection/pdf-review'
out.mkdir(parents=True, exist_ok=True)
inventory = json.loads((root/'docs/maps/donor-inventory.json').read_text())
records, thumbs = [], []
for row in inventory['rows']:
    if not row['path'].lower().endswith('.pdf'): continue
    content = subprocess.check_output(['git','-C',str(donor),'cat-file','blob',row['blob']])
    record = dict(source=row['path'], blob=row['blob'], sha256=hashlib.sha256(content).hexdigest(), pages=[])
    try:
        doc = pdfium.PdfDocument(content)
        for i in range(len(doc)):
            page = doc[i]; w,h = page.get_size()
            im = page.render(scale=min(1800/w,1800/h)).to_pil().convert('RGB')
            name = f'{len(records):02d}-{i+1:02d}.png'
            im.save(out/name)
            record['pages'].append(dict(page=i+1,points=[w,h],render=name))
            thumbs.append((f'{len(records):02d}/{i+1}: {Path(row["path"]).name}',im))
    except Exception as e: record['error'] = str(e)
    records.append(record)
for start in range(0,len(thumbs),12):
    sheet=Image.new('RGB',(1800,1600),'white'); draw=ImageDraw.Draw(sheet)
    for j,(label,im) in enumerate(thumbs[start:start+12]):
        x=j%3*600; y=j//3*400
        sheet.paste(ImageOps.contain(im,(590,360)),(x,y))
        draw.text((x+4,y+365),label,fill='black')
    sheet.save(out/f'sheet-{start//12}.jpg')
(out/'inventory.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps([dict(source=r['source'],pages=len(r['pages']),error=r.get('error')) for r in records],indent=2))
