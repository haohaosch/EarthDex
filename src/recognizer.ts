// BioCLIP runs on-device. Photos are never sent to an external inference provider.
const RUNTIME='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.wasm.min.mjs';
let ready:Promise<{ort:any;session:any;config:any}>|null=null;
async function modelBytes(url:string,onProgress:(label:string,progress:number|null)=>void):Promise<Uint8Array>{
 const cacheName='earthdex-bioclip-v1';let cache:Cache|undefined;
 try{cache=await caches.open(cacheName);const stored=await cache.match(url);if(stored)return new Uint8Array(await stored.arrayBuffer());}catch{}
 const response=await fetch(url);if(!response.ok)throw Error('視覺模型下載失敗，請檢查網路後重試');
 const length=Number(response.headers.get('content-length')),reader=response.body?.getReader();
 if(!reader){const body=new Uint8Array(await response.arrayBuffer());return body;}
 const chunks:Uint8Array[]=[];let loaded=0;while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;onProgress(`首次下載生物視覺模型：${(loaded/1048576).toFixed(1)} MB`,length>0?Math.min(100,loaded/length*100):null);}
 const bytes=new Uint8Array(loaded);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 try{await cache?.put(url,new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}));}catch{}
 return bytes;
}
export async function imageFeatures(photo:Blob,onProgress:(label:string,progress:number|null)=>void):Promise<Float32Array>{
 if(!ready)ready=(async()=>{
  onProgress('正在啟動生物視覺辨識模型…',null);
  const ort=await import(/* @vite-ignore */ RUNTIME);
  ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
  const config=await fetch('/recognition-config.json').then(r=>{if(!r.ok)throw Error('辨識模型設定載入失敗');return r.json();});
  const bytes=await modelBytes(`https://huggingface.co/${config.id}/resolve/${config.revision}/${config.file}`,onProgress);
  onProgress('正在準備模型，首次啟動需要一些時間…',null);
  const session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});return{ort,session,config};
 })().catch(e=>{ready=null;throw e;});
 const {ort,session,config}=await ready;onProgress('正在分析生物特徵與比對物種…',null);
 const url=URL.createObjectURL(photo);
 try{
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('照片無法解碼，請重新拍攝'));i.src=url;});
  // Match the encoder's resize-shortest-edge / center-crop / CLIP normalization.
  const scale=224/Math.min(image.naturalWidth,image.naturalHeight),width=Math.floor(image.naturalWidth*scale),height=Math.floor(image.naturalHeight*scale);
  const resized=document.createElement('canvas');resized.width=width;resized.height=height;
  const resize=resized.getContext('2d');if(!resize)throw Error('無法處理照片');resize.imageSmoothingEnabled=true;resize.imageSmoothingQuality='high';resize.drawImage(image,0,0,width,height);
  const canvas=document.createElement('canvas');canvas.width=224;canvas.height=224;const ctx=canvas.getContext('2d');if(!ctx)throw Error('無法處理照片');ctx.drawImage(resized,Math.floor((width-224)/2),Math.floor((height-224)/2),224,224,0,0,224,224);
  const rgba=ctx.getImageData(0,0,224,224).data,pixels=new Float32Array(3*224*224),mean=[.48145466,.4578275,.40821073],std=[.26862954,.26130258,.27577711];
  for(let p=0;p<224*224;p++)for(let c=0;c<3;c++)pixels[c*224*224+p]=(rgba[p*4+c]/255-mean[c])/std[c];
  const outputs=await session.run({[config.input]:new ort.Tensor('float32',pixels,[1,3,224,224])});return new Float32Array(outputs[config.output].data);
 }finally{URL.revokeObjectURL(url);}
}
export function encodeFeatures(vector:Float32Array):string{const bytes=new Uint8Array(vector.buffer,vector.byteOffset,vector.byteLength);let str='';for(const b of bytes)str+=String.fromCharCode(b);return btoa(str);}
