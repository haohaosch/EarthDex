"""Build an image-retrieval species classifier from attributed public reference images.
Frozen CLIP encoder (not trained from scratch); species prototypes/retrieval bank are
EarthDex-specific. Evaluation holds out the final reference of every multi-image taxon.
"""
import json,os,time,io,collections,urllib.parse,re
import numpy as np
import onnxruntime as ort
from PIL import Image,ImageOps
root='.sites-runtime/references';raw=json.load(open(root+'/manifest.json'));manifest=[];seen=set()
for row in raw:
 name=urllib.parse.unquote(row['source'].split('File:')[-1]).replace('_',' ').lower()
 if any(word in name for word in ['iucn',' area.','dentition','dental','diagram','skeleton','distribution','range map','locations',' range.']):continue
 if name in seen:continue
 seen.add(name);manifest.append(row)
texts=json.load(open('.sites-runtime/models/text-prototypes.json'));textmap={r['speciesId']:np.array(r['vector']) for r in texts}
imageweight=.55;textweight=.45;textscale=2.0
options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
session=ort.InferenceSession('.sites-runtime/models/image_encoder_fp16.onnx',sess_options=options,providers=['CPUExecutionProvider'])
mean=np.array([.48145466,.4578275,.40821073],dtype=np.float32);std=np.array([.26862954,.26130258,.27577711],dtype=np.float32)
def extract(path):
 im=ImageOps.exif_transpose(Image.open(path)).convert('RGB');w,h=im.size;scale=224/min(w,h);im=im.resize((int(w*scale),int(h*scale)),Image.Resampling.BICUBIC);w,h=im.size;im=im.crop(((w-224)//2,(h-224)//2,(w+224)//2,(h+224)//2));x=np.asarray(im,dtype=np.float32)/255;x=((x-mean)/std).transpose(2,0,1)[None,...];v=session.run(None,{'pixel_values':x})[0][0];return v/np.linalg.norm(v)
features=[];start=time.time()
for i,row in enumerate(manifest):
 cache=row['path']+'.bioclip-fp16.npy'
 if os.path.exists(cache):v=np.load(cache)
 else:v=extract(row['path']);np.save(cache,v)
 features.append({**row,'vector':np.round(v,7).tolist()})
 if i%15==0:print('Embedded',i+1,'/',len(manifest),round(time.time()-start,1),'sec',flush=True)
# Honest small held-out check: the last of each taxon's >=2 images is omitted from training.
grouped=collections.defaultdict(list)
for ref in features:grouped[ref['speciesId']].append(ref)
train=[];holdout=[]
for refs in grouped.values():
 if len(refs)>1:train.extend(refs[:-1]);holdout.append(refs[-1])
 else:train.extend(refs)
matrix=np.array([r['vector']for r in train]);results=[]
for ref in holdout:
 values=matrix@np.array(ref['vector']);scores={}
 for r,value in zip(train,values):scores[r['speciesId']]=max(scores.get(r['speciesId'],-1),float(value))
 scores={sid:imageweight*sim+textweight*textscale*float(np.dot(np.array(ref['vector']),textmap[sid])) for sid,sim in scores.items()};ranking=sorted(scores.items(),key=lambda x:-x[1]);results.append({'actual':ref['speciesId'],'predicted':ranking[0][0],'similarity':ranking[0][1],'margin':ranking[0][1]-ranking[1][1],'correct':ranking[0][0]==ref['speciesId'],'unsupportedPreferred':max(textmap,key=lambda sid:float(np.dot(np.array(ref['vector']),textmap[sid]))) not in grouped})
# Test bank excludes held-out photos. Thresholds are deliberately conservative and
# are reported rather than represented as calibrated species probabilities.
threshold=.65;margin=.035
accepted=[r for r in results if r['similarity']>=threshold and r['margin']>=margin and not r['unsupportedPreferred']]
report={'model':'BioCLIP ViT-B/16 fp16 weights / fp32 math reference retrieval + taxon-name prototypes','referenceImages':len(features),'taxa':len(grouped),'heldOutImages':len(results),'heldOutTop1Correct':sum(r['correct']for r in results),'heldOutAccepted':len(accepted),'heldOutAcceptedCorrect':sum(r['correct']for r in accepted),'minSimilarity':threshold,'minMargin':margin,'method':'Last reference per multi-image taxon held out; no user photographs. Small Wikimedia calibration set, not a field accuracy estimate. Thresholds selected using this set; no independent field test.','results':results}
json.dump(report,open('docs/recognition-evaluation.json','w'),indent=2)
# Production bank may use all licensed reference images. Metrics above are explicitly
# based on a disjoint split, not self-matches of the production bank.
public=[{k:r[k]for k in ['speciesId','vector','source','artist','license']}for r in features]
info=json.load(open('.sites-runtime/models/model-info.json'))
bank={'version':'earthdex-taiwan-bioclip-fp16-2','model':info,'dimensions':512,'minSimilarity':threshold,'minMargin':margin,'references':public,'textPrototypes':texts,'imageWeight':imageweight,'textWeight':textweight,'textScale':textscale,'generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
os.makedirs('engine/recognition',exist_ok=True);json.dump(bank,open('engine/recognition/reference-bank.json','w'),ensure_ascii=False,separators=(',',':'));json.dump({**info,'taxa':len(grouped),'referenceImages':len(features)},open('public/recognition-config.json','w'),indent=2);json.dump({'taxa':len(grouped),'referenceImages':len(features),'version':bank['version'],'downloadMiB':round(info.get('downloadBytes',0)/1048576)},open('src/recognition-meta.json','w'),indent=2)
print(json.dumps({k:v for k,v in report.items()if k!='results'},indent=2),flush=True)
