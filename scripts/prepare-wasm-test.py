"""Prepare a real public turtle portrait tensor for the browser-WASM smoke check."""
from PIL import Image, ImageOps
import numpy as np
from pathlib import Path
root=Path('.sites-runtime/models');root.mkdir(parents=True,exist_ok=True)
im=ImageOps.fit(Image.open('public/media/turtle.jpg').convert('RGB'),(224,224),method=Image.Resampling.BICUBIC)
x=np.asarray(im,dtype=np.float32)/255
x=(x-np.array([.48145466,.4578275,.40821073],dtype=np.float32))/np.array([.26862954,.26130258,.27577711],dtype=np.float32)
x.transpose(2,0,1)[None,...].copy().tofile(root/'turtle-input.f32')
