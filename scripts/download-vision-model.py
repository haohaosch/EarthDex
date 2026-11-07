"""Fetch pinned MIT-licensed BioCLIP exports for development. Weights stay out of Git."""
import urllib.request,json,os
files=[('jsteinshouer/trail-bingo-bioclip-onnx','25d50dd481d6a748ce78c8bc513a420bf7d3d279','image_encoder_fp16.onnx','image_encoder_fp16.onnx'),('jsteinshouer/trail-bingo-bioclip-onnx','25d50dd481d6a748ce78c8bc513a420bf7d3d279','text_encoder_fp16.onnx','bioclip-text-fp16.onnx'),('Xenova/clip-vit-base-patch32','6b7c523703ae26e39be4b03774966f8571c7f523','tokenizer.json','tokenizer.json')]
for repo,rev,name,target in files:
 path='.sites-runtime/models/'+target
 if os.path.exists(path):continue
 print('Downloading',repo,name,flush=True)
 with urllib.request.urlopen(f'https://huggingface.co/{repo}/resolve/{rev}/{name}',timeout=120) as response,open(path,'wb') as out:
  while b:=response.read(1024*1024):out.write(b)
 print('Saved',os.path.getsize(path),flush=True)
info={'id':files[0][0],'revision':files[0][1],'file':files[0][2],'license':'MIT','source':'https://huggingface.co/imageomics/bioclip','exportSource':'https://huggingface.co/'+files[0][0],'input':'pixel_values','output':'embeddings','family':'BioCLIP ViT-B/16','format':'fp16-weights-fp32-math','downloadBytes':172899543,'cacheName':'earthdex-bioclip-fp16-v2'}
json.dump(info,open('.sites-runtime/models/model-info.json','w'),indent=2)
