"""Visual comparison aid only. Pixel similarity never decides inclusion."""
import io,json,subprocess,sys
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import numpy as np
root=Path(__file__).resolve().parents[2]; donor=Path(sys.argv[1])
out=root/'docs/maps/inspection/duplicate-review'; out.mkdir(parents=True,exist_ok=True)
rows=json.loads((root/'docs/maps/reconciliation.json').read_text())['decisions']
maps=json.loads((root/'v2/public/maps/index.json').read_text())['maps']
def vector(im): return np.asarray(im.convert('L').resize((48,48)),dtype=np.float32).flatten()/255
base=[]
for m in maps:
    im=Image.open(root/('v2/public'+m['image'])).convert('RGB');base.append((m['id'],im,vector(im)))
vectors=np.stack([v for _,_,v in base]); comparisons=[]
for row in rows:
    if row['status']!='semantic-duplicate': continue
    content=subprocess.check_output(['git','-C',str(donor),'cat-file','blob',row['blob']])
    im=Image.open(io.BytesIO(content)).convert('RGB')
    closest=np.argsort(np.mean((vectors-vector(im))**2,axis=1))[:2]
    comparisons.append((row['path'],im,[base[int(i)] for i in closest]))
for start in range(0,len(comparisons),6):
    sheet=Image.new('RGB',(1800,1800),'white');draw=ImageDraw.Draw(sheet)
    for j,(path,im,best) in enumerate(comparisons[start:start+6]):
        for col,(label,pic) in enumerate([(f'{start+j}: {path}',im)]+[(name,pic) for name,pic,_ in best]):
            x=col*600;y=j*300;sheet.paste(ImageOps.contain(pic,(590,268)),(x,y));draw.text((x+3,y+273),label,fill='black')
    sheet.save(out/f'sheet-{start//6}.jpg')
print(len(comparisons))
