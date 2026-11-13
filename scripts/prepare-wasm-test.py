"""Prepare reproducible real/synthetic scenario tensors, preserving source metadata."""
from PIL import Image, ImageOps, ImageFilter
import numpy as np
from pathlib import Path
import json, urllib.request
root=Path('.sites-runtime/models');root.mkdir(parents=True,exist_ok=True)
def tensor(image,path):
 im=ImageOps.fit(image.convert('RGB'),(224,224),method=Image.Resampling.BICUBIC)
 x=np.asarray(im,dtype=np.float32)/255
 x=(x-np.array([.48145466,.4578275,.40821073],dtype=np.float32))/np.array([.26862954,.26130258,.27577711],dtype=np.float32)
 x.transpose(2,0,1)[None,...].copy().tofile(path)
turtle=Image.open('public/media/turtle.jpg');tensor(turtle,root/'turtle-input.f32')
source=json.load(open('docs/evidence/recognition-unknown-source.json'))
unknown=root/'unknown-elephant.jpg'
if not unknown.exists():
 with urllib.request.urlopen(urllib.request.Request(source['downloadUrl'],headers={'User-Agent':'EarthDex/0.3 educational recognition test'}),timeout=30) as response:unknown.write_bytes(response.read())
collage=Image.new('RGB',(448,224));collage.paste(ImageOps.fit(turtle,(224,224)),(0,0));collage.paste(ImageOps.fit(Image.open('public/media/sparrow.jpg'),(224,224)),(224,0))
scenarios=[('non-animal-forest',Image.open('public/media/forest.jpg'),'real licensed forest portrait'),('blank',Image.new('RGB',(224,224),(128,128,128)),'synthetic gray image'),('blurred-turtle',turtle.filter(ImageFilter.GaussianBlur(24)),'synthetic Gaussian blur radius 24'),('multiple-animals',collage,'synthetic collage: turtle and sparrow'),('unknown-elephant',Image.open(unknown),'real licensed elephant outside supported taxa')]
metadata=[]
for name,image,description in scenarios:
 file=name+'.f32';tensor(image,root/file);metadata.append({'name':name,'file':file,'description':description,'synthetic':name in ['blank','blurred-turtle','multiple-animals']})
json.dump(metadata,open(root/'scenarios.json','w'),indent=2)
