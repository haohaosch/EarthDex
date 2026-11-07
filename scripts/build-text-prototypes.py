"""Encode public taxon names once; the browser downloads only the image encoder."""
import json,os
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer
rows=json.load(open('engine/taiwan-data.json'))
initial={'deer':('Formosan sika deer','Cervus nippon'),'magpie':('Taiwan blue magpie','Urocissa caerulea'),'bear':('Formosan black bear','Ursus thibetanus'),'sparrow':('Eurasian tree sparrow','Passer montanus'),'kingfisher':('Common kingfisher','Alcedo atthis'),'butterfly':('great Mormon butterfly','Papilio memnon'),'turtle':('green sea turtle','Chelonia mydas'),'cat':('leopard cat','Prionailurus bengalensis'),'macaque':('Formosan rock macaque','Macaca cyclopis'),'egret':('little egret','Egretta garzetta'),'barbet':('Taiwan barbet','Psilopogon nuchalis')}
subjects=[{'id':k,'wiki':v[0],'latin':v[1]}for k,v in initial.items()]+rows
tok=Tokenizer.from_file('.sites-runtime/models/tokenizer.json');tok.enable_padding(length=77,pad_id=0,pad_token='!');tok.enable_truncation(max_length=77)
options=ort.SessionOptions();options.intra_op_num_threads=2;session=ort.InferenceSession('.sites-runtime/models/bioclip-text-fp16.onnx',sess_options=options,providers=['CPUExecutionProvider'])
result=[]
for i,s in enumerate(subjects):
 texts=[f"a photo of a {s['wiki']}.",f"a wildlife photograph of {s['wiki']}.",f"a close-up photo of {s['latin']}.",f"a photo of the animal {s['wiki']}, {s['latin']}."]
 ids=np.array([t.ids for t in tok.encode_batch(texts)],dtype=np.int64);vectors=session.run(None,{'input_ids':ids})[0];vectors/=np.linalg.norm(vectors,axis=1,keepdims=True);v=vectors.mean(axis=0);v/=np.linalg.norm(v);result.append({'speciesId':s['id'],'vector':np.round(v,7).tolist()})
 if i%15==0:print('Text prototypes',i+1,flush=True)
json.dump(result,open('.sites-runtime/models/text-prototypes.json','w'),separators=(',',':'));print('Encoded',len(result),'taxa')
