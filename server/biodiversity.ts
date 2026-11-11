import {SPECIES,speciesById} from '../engine/species';
import media from '../src/media.json';
import type {Bucket} from './api';
export type Provider='gbif'|'inaturalist'|'taicol';
export interface Provenance {provider:Provider;url:string;retrievedAt:string;version:string;stale:boolean}
export interface TaxonMatch {provider:Provider;status:'matched'|'synonym'|'uncertain'|'unavailable';id:string|null;acceptedId:string|null;scientificName:string|null;rank:string|null;classification:Record<string,string>;source:Provenance;reason?:string;englishName?:string;nativeStatus?:{value:string;basis:string}}
export interface LicensedImage {url:string;author:string;license:string;source:string}
export interface SpeciesRecord {id:string;names:{zh:string;en:string|null;scientific:string};kingdom:string;classification:Record<string,string>;distribution:string[];habitat:{text:string;source:string}|null;ecology:{text:string;source:string}[];conservation:null;images:LicensedImage[];externalIds:{gbif:string|null;inaturalist:string|null;taicol:string|null};matches:TaxonMatch[];sources:Provenance[];updatedAt:string;warnings:string[]}
const TTL=86400000,STALE_MAX=30*TTL;
interface Entry {at:number;data:any;url:string}
export class SourceClient {
 private cache=new Map<string,Entry>(); private pending=new Map<string,Promise<{data:any;source:Provenance}>>();
 private tail=Promise.resolve();private next=0;
 constructor(private options:{fetch?:typeof fetch;bucket?:Bucket;now?:()=>number;intervalMs?:number;timeoutMs?:number}={}){}
 async get(provider:Provider,url:string):Promise<{data:any;source:Provenance}>{
  const pending=this.pending.get(url);if(pending)return pending;
  const task=this.request(provider,url);this.pending.set(url,task);try{return await task;}finally{this.pending.delete(url);}
 }
 private async request(provider:Provider,url:string){
  const now=this.options.now||Date.now,key='biodiversity/v1/'+encodeURIComponent(url);let cached=this.cache.get(url);
  if(!cached&&this.options.bucket){try{const r=await this.options.bucket.get(key);if(r){const e=await new Response(r.body).json() as Entry;if(e.url===url&&Number.isFinite(e.at)&&e.at<=now()&&now()-e.at<=STALE_MAX)cached=e;}}catch{}}
  const result=(e:Entry,stale:boolean)=>({data:e.data,source:{provider,url,retrievedAt:new Date(e.at).toISOString(),version:provider==='taicol'?'v2':'v1',stale}});
  if(cached&&now()-cached.at<TTL)return result(cached,false);
  // Serialize and space outbound requests across adapters; never retry-loop on 429.
  const operation=this.tail.then(async()=>{
   const delay=this.next-Date.now();if(delay>0)await new Promise(r=>setTimeout(r,delay));this.next=Date.now()+(this.options.intervalMs??1100);
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.options.timeoutMs??8000);
   try{const response=await (this.options.fetch||fetch)(url,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok){if(response.status===429){const retry=Number(response.headers.get('Retry-After'));this.next=Date.now()+Math.min(60000,Math.max(1100,(Number.isFinite(retry)?retry:60)*1000));}throw Error('上游 HTTP '+response.status);}
    const reader=response.body?.getReader();let size=0;const chunks:Uint8Array[]=[];if(!reader)throw Error('上游回應為空');
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('上游回應過大');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const data=JSON.parse(new TextDecoder().decode(bytes));
    if(data.status?.code&&data.status.code!==200)throw Error('來源回應失敗');
    const entry={at:now(),data,url};this.cache.set(url,entry);if(this.cache.size>300)this.cache.delete(this.cache.keys().next().value!);
    try{await this.options.bucket?.put(key,new TextEncoder().encode(JSON.stringify(entry)),{httpMetadata:{contentType:'application/json'}});}catch{}
    return result(entry,false);
   }finally{clearTimeout(timer);}
  });this.tail=operation.then(()=>{},()=>{});
  try{return await operation;}catch(e){if(cached&&now()-cached.at<=STALE_MAX)return result(cached,true);throw e;}
 }
}
const canonical=(name:unknown)=>typeof name==='string'?name.trim().replace(/\s+/g,' '):'';
const rankOf=(name:string)=>name.split(' ').length===3?'subspecies':'species';
function classification(data:any){return Object.fromEntries(['kingdom','phylum','class','order','family','genus'].filter(k=>typeof data[k]==='string').map(k=>[k,data[k]]));}
export function transformTaxon(provider:Provider,data:any,source:Provenance,name:string):TaxonMatch {
 const base:TaxonMatch={provider,status:'uncertain',id:null,acceptedId:null,scientificName:null,rank:null,classification:{},source,reason:'沒有唯一、同階層的學名匹配；不自動合併'};
 if(provider==='gbif'){
  const exact=data.matchType==='EXACT'&&canonical(data.canonicalName)===name&&String(data.rank).toLowerCase()===rankOf(name)&&data.confidence>=95;
  const accepted=data.status==='ACCEPTED',synonym=data.status==='SYNONYM'&&data.acceptedUsageKey;
  return {...base,status:exact&&(accepted||synonym)?synonym?'synonym':'matched':'uncertain',id:exact?String(data.usageKey):null,acceptedId:exact&&(accepted||synonym)?String(data.acceptedUsageKey||data.usageKey):null,scientificName:data.canonicalName||null,rank:data.rank||null,classification:classification(data),reason:exact&&(accepted||synonym)?undefined:base.reason};
 }
 const rows=provider==='inaturalist'?data.results:data.data;
 if(!Array.isArray(rows))return base;
 const exact=rows.filter((r:any)=>canonical(provider==='taicol'?r.simple_name:r.name)===name&&String(r.rank).toLowerCase()===rankOf(name)&&(provider==='taicol'?r.taxon_status==='accepted':r.is_active===true&&!r.provisional));
 if(exact.length!==1)return base;const r=exact[0],id=String(provider==='taicol'?r.taxon_id:r.id);
 return {...base,status:'matched',id,acceptedId:id,scientificName:name,rank:r.rank,classification:provider==='taicol'?Object.fromEntries((r.higher_taxa||[]).filter((t:any)=>['Kingdom','Phylum','Class','Order','Family','Genus'].includes(t.rank)).map((t:any)=>[t.rank.toLowerCase(),t.simple_name])):classification(r),englishName:provider==='inaturalist'?r.preferred_common_name:undefined,reason:undefined,...(provider==='taicol'&&r.alien_type&&r.alien_status_note?{nativeStatus:{value:r.alien_type,basis:r.alien_status_note}}:{})};
}
export function observationImages(record:any):LicensedImage[]{
 return (record.photos||[]).filter((p:any)=>['cc0','cc-by','cc-by-sa'].includes(p.license_code)&&p.url&&p.attribution).map((p:any)=>({url:p.url,author:p.attribution,license:p.license_code,source:'https://www.inaturalist.org/photos/'+p.id}));
}
export async function integrateSpecies(id:string,client:SourceClient):Promise<SpeciesRecord>{
 const s=speciesById(id),name=s.latin,encoded=encodeURIComponent(name),sources:Provenance[]=[],warnings:string[]=[],matches:TaxonMatch[]=[];
 const urls:Record<Provider,string>={gbif:`https://api.gbif.org/v1/species/match?name=${encoded}&strict=true`,inaturalist:`https://api.inaturalist.org/v1/taxa?q=${encoded}&per_page=30`,taicol:`https://api.taicol.tw/v2/taxon?scientific_name=${encoded}`};
 for(const provider of Object.keys(urls) as Provider[]){try{const {data,source}=await client.get(provider,urls[provider]);sources.push(source);matches.push(transformTaxon(provider,data,source,name));if(source.stale)warnings.push(provider+' 使用離線快取');}catch(e){const source={provider,url:urls[provider],retrievedAt:new Date().toISOString(),version:provider==='taicol'?'v2':'v1',stale:false};matches.push({provider,status:'unavailable',id:null,acceptedId:null,scientificName:null,rank:null,classification:{},source,reason:String(e)});warnings.push(provider+' 暫時無法查詢');}}
 const taxonomies=matches.filter(m=>m.status==='matched');
 const kingdoms=new Set(taxonomies.map(m=>m.classification.kingdom).filter(Boolean));const conflict=kingdoms.size>1;
 if(conflict)warnings.push('來源分類衝突，暫不建立跨平台對照');
 // A synonym needs accepted-name reconciliation rather than silently merging another species.
 if(matches.some(m=>m.status==='synonym'))warnings.push('學名含同物異名，需人工核對接受名後才建立對照');
 const external=(provider:Provider)=>!conflict?matches.find(m=>m.provider===provider&&m.status==='matched')?.id||null:null;
 const evidence=(media as Record<string,any>)[id],source=evidence?.evidence;
 return {id,names:{zh:s.name,en:matches.find(m=>m.provider==='inaturalist'&&m.status==='matched')?.englishName||null,scientific:name},kingdom:conflict?'unknown':[...kingdoms][0]||'unknown',classification:conflict?{}:taxonomies.find(m=>m.provider==='gbif')?.classification||{},distribution:[s.region],habitat:source?{text:s.habitat,source}:null,ecology:source?[{text:s.fact,source}]:[],conservation:null,images:evidence?[{url:evidence.image,author:evidence.artist,license:evidence.license,source:evidence.source}]:[],externalIds:{gbif:external('gbif'),inaturalist:external('inaturalist'),taicol:external('taicol')},matches,sources,updatedAt:new Date().toISOString(),warnings:[...warnings,'未提供的英文名或保育資訊標為未知；本地生態描述沿用原資料來源，尚待專業審訂']};
}
export interface Bounds {south:number;west:number;north:number;east:number}
export function validateBounds(b:Bounds){if(!Object.values(b).every(Number.isFinite)||b.south< -90||b.north>90||b.west< -180||b.east>180||b.south>=b.north||b.west>=b.east||b.north-b.south>1||b.east-b.west>1)throw Error('區域範圍無效或過大');return b;}
export async function externalOccurrences(id:string,bounds:Bounds,client:SourceClient){
 validateBounds(bounds);const record=await integrateSpecies(id,client),{south,west,north,east}=bounds,results:any[]=[],sources:Provenance[]=[],warnings=[...record.warnings];
 if(record.externalIds.inaturalist){try{const url=`https://api.inaturalist.org/v1/observations?taxon_id=${record.externalIds.inaturalist}&quality_grade=research&swlat=${south}&swlng=${west}&nelat=${north}&nelng=${east}&per_page=20`;const {data,source}=await client.get('inaturalist',url);sources.push(source);for(const r of data.results||[])results.push({provider:'inaturalist',id:String(r.id),url:r.uri,at:r.observed_on,quality:r.quality_grade,location:null,locationProtected:!!r.obscured||!!r.geoprivacy||!!r.taxon_geoprivacy,photos:observationImages(r),ownership:'external-public-record'});}catch{warnings.push('iNaturalist 觀察查詢失敗');}}
 if(record.externalIds.gbif){try{const url=`https://api.gbif.org/v1/occurrence/search?taxon_key=${record.externalIds.gbif}&decimalLatitude=${south},${north}&decimalLongitude=${west},${east}&has_coordinate=true&limit=20`;const {data,source}=await client.get('gbif',url);sources.push(source);for(const r of data.results||[])results.push({provider:'gbif',id:String(r.key),url:'https://www.gbif.org/occurrence/'+r.key,at:r.eventDate,quality:r.basisOfRecord,datasetKey:r.datasetKey,location:null,photos:[],ownership:'external-public-record'});}catch{warnings.push('GBIF 出現紀錄查詢失敗');}}
 return {speciesId:id,bounds,records:results,sources,warnings,note:'外部公開紀錄不是 EarthDex 玩家成果；不輸出上游精確或模糊化座標，也不推定為已確認的逢甲校園物種。'};
}
export const localCatalog=()=>SPECIES.map(s=>({id:s.id,scientificName:s.latin,zh:s.name,group:s.group}));
