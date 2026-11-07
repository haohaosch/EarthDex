"""Exercise the real encoder on non-animal images; not a field accuracy benchmark."""
import json,numpy as np,onnxruntime as ort
from PIL import Image,ImageOps
options=ort.SessionOptions();options.intra_op_num_threads=2
s=ort.InferenceSession('.sites-runtime/models/image_encoder_fp16.onnx',sess_options=options,providers=['CPUExecutionProvider'])
result=[]
for name,im in [('forest',Image.open('public/media/forest.jpg')),('blank',Image.new('RGB',(640,480),(180,180,180)))]:
 im=ImageOps.fit(im.convert('RGB'),(224,224),method=Image.Resampling.BICUBIC);x=np.asarray(im,dtype=np.float32)/255;x=(x-np.array([.48145466,.4578275,.40821073],dtype=np.float32))/np.array([.26862954,.26130258,.27577711],dtype=np.float32);v=s.run(None,{'pixel_values':x.transpose(2,0,1)[None,...]})[0][0];v/=np.linalg.norm(v);result.append({'label':name,'vector':np.round(v,7).tolist()})
json.dump(result,open('tests/fixtures/non-animal-features.json','w'),separators=(',',':'))
