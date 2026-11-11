import {publicBattleState} from './battle-view';
import {officialDefinition,OFFICIAL_CARD_VERSION} from '../engine/official-cards';
import {validateLocation,locationFlags} from '../engine/observation-policy';
import {inCampusView,sharedObservation,setPrivacy,filterObservations,ecologyStats,publicCampusStats} from './observations';
import {SourceClient,integrateSpecies,externalOccurrences} from './biodiversity';
import {applyMove,chooseAI,createBattle,dexCandidates,hash,score,generateCard} from '../engine/engine';
import {definition,SPECIES,speciesById,SERIES} from '../engine/species';
import type {BattleState,Move,Side} from '../engine/types';
import {answerQuiz,newProfile,ownedDeck,publicProfile,type Profile,type Observation} from './model';
import referenceBank from '../engine/recognition/reference-bank.json';
import {rankSpecies,type ReferenceBank} from '../engine/recognition/rank';
import {fieldQuestion,collectObservation} from './field';
export interface Statement {bind(...args:unknown[]):Statement;first<T=any>():Promise<T|null>;all():Promise<any>;run():Promise<any>}
export interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<any>}
export interface Bucket {put(key:string,value:ArrayBuffer|Uint8Array,options?:any):Promise<any>;get(key:string):Promise<any>;delete(key:string):Promise<any>}
export interface Env {DB:Database;BUCKET?:Bucket}
interface Match {mode:'ai'|'pvp';state:BattleState|null;initial:BattleState|null;difficulty:string;theme:string;settled:string[];createdAt:string;finishedBy?:Side}
interface MatchRow {id:string;revision:number;p0:string;p1:string|null;data:string;updated_at:string}
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(msg:string,status=400)=>json({error:msg},status);
const sourceClients=new WeakMap<Database,SourceClient>();
const PHOTO_LIMIT=10*1024*1024;
function isPhoto(bytes:Uint8Array,type:string):boolean {
 if(type==='image/jpeg')return bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==='image/png')return bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(type==='image/webp')return bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 return false;
}
async function readBody(req:Request):Promise<any>{if(Number(req.headers.get('content-length'))>10000)throw Error('請求過大');const text=await req.text();if(text.length>10000)throw Error('請求過大');try{return JSON.parse(text);}catch{throw Error('無效的 JSON');}}
export async function handleApi(req:Request,env:Env,identity:string):Promise<Response>{
 try{
  if(!identity)return error('請先登入',401);
  const url=new URL(req.url),route=url.pathname.slice(4),demo=url.searchParams.get('profile')!=='real',player=identity+(demo?':demo':':real');
  // Reject cross-origin writes. The platform strips/splices authenticated identity headers.
  if(req.method!=='GET'&&req.headers.get('origin')&&req.headers.get('origin')!==url.origin)return error('來源驗證失敗',403);
  if(route.startsWith('/species/')&&req.method==='GET'){
   const m=route.match(/^\/species\/([a-z0-9-]+)(\/occurrences)?$/);if(!m)return error('物種不存在',404);speciesById(m[1]);
   let client=sourceClients.get(env.DB);if(!client){client=new SourceClient({bucket:env.BUCKET});sourceClients.set(env.DB,client);}
   return json(m[2]?await externalOccurrences(m[1],{south:24.174,west:120.64,north:24.185,east:120.653},client):await integrateSpecies(m[1],client));
  }
  if(route==='/campus/stats'&&req.method==='GET'){
   const rows=await env.DB.prepare("SELECT data FROM profiles WHERE json_extract(data,'$.demo')=0").all();return json(publicCampusStats(rows.results.map((r:any)=>JSON.parse(r.data))));
  }
  if(route==='/shared'&&req.method==='GET'){
   const owner=url.searchParams.get('owner');if(!owner)return error('缺少分享檔案',400);const row=await env.DB.prepare('SELECT data FROM profiles WHERE id=?').bind(owner).first<{data:string}>();if(!row)return error('沒有可存取的分享',404);
   const p=JSON.parse(row.data) as Profile;const observations=p.observations.filter(o=>o.privacy?.visibility==='public'||o.privacy?.visibility==='friends'&&o.privacy.shareWith.includes(identity)).map(sharedObservation);if(!observations.length)return error('沒有可存取的分享',404);return json({observations});
  }
  let row=await env.DB.prepare('SELECT data,revision FROM profiles WHERE id=?').bind(player).first<{data:string;revision:number}>();
  if(!row){const p=newProfile(demo);await env.DB.prepare('INSERT OR IGNORE INTO profiles(id,revision,data) VALUES(?,0,?)').bind(player,JSON.stringify(p)).run();row=await env.DB.prepare('SELECT data,revision FROM profiles WHERE id=?').bind(player).first();}
  let profile:Profile=JSON.parse(row!.data);profile.revision=row!.revision;
  const saveProfile=async()=>{const result=await env.DB.prepare('UPDATE profiles SET data=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(profile),player,profile.revision).run();if(!(result.meta?.changes??result.changes))throw Error('資料已更新，請重新載入後再試');profile.revision++;};

  if(route==='/observation-map'&&req.method==='GET'){const observations=filterObservations(profile.observations,url.searchParams);return json({observations,stats:ecologyStats(observations,profile.unlocks.map(u=>u.speciesId),profile.demo),repeatPolicyEnforced:false});}
  if(route==='/profile'&&req.method==='GET')return json(publicProfile(profile,player));
  if(route==='/deck'&&req.method==='POST'){const body=await readBody(req);if(!Array.isArray(body.ids))throw Error('牌組格式錯誤');ownedDeck(profile,body.ids);profile.deck=body.ids;await saveProfile();return json(publicProfile(profile,player));}
  if(route==='/quiz'&&req.method==='GET'){const pending=profile.pending.find(p=>p.speciesId===url.searchParams.get('species'));if(!pending)throw Error('沒有問答資格');const s=speciesById(pending.speciesId),q=s.questions[pending.attempt%s.questions.length];return json({speciesId:s.id,q:q.q,options:q.options,attempt:pending.attempt});}
  if(route==='/quiz'&&req.method==='POST'){const body=await readBody(req);if(body.attempt!==profile.pending.find(q=>q.speciesId===body.speciesId)?.attempt)return error('題目版本已更新，請重新載入',409);const result=answerQuiz(profile,body.speciesId,body.choice);for(const series of SERIES){if(series.ids.every(id=>profile.unlocks.some(u=>u.speciesId===id))&&!profile.badges.includes(series.id))profile.badges.push(series.id);}await saveProfile();const publicData=publicProfile(profile,player);return json({...result,profile:publicData});}
  if(route==='/grant'&&req.method==='POST')return error('請先完成伺服器AI比對，再答對該觀察的物種問答才會收入卡牌。',409);
  if(route==='/field-quiz'&&req.method==='GET')return json(fieldQuestion(profile,url.searchParams.get('observation')||''));
  if(route==='/collect'&&req.method==='POST'){const body=await readBody(req);const result=collectObservation(profile,body.observationId,body.choice,body.attempt);if(!result.alreadyCollected)await saveProfile();const publicData=publicProfile(profile,player);return json({...result,...('card' in result?{card:result.card?publicData.instances.find(c=>c.id===result.card!.id):null}:{}),profile:publicData});}
  if(route==='/observations'&&req.method==='POST'){
   if(!env.BUCKET)return error('照片儲存尚未配置',503);
   const encoded=req.headers.get('x-earthdex-features')||'';let vector:Float32Array;try{const binary=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));if(binary.byteLength!==2048)throw Error();vector=new Float32Array(binary.buffer);}catch{throw Error('影像辨識特徵缺失，請重新辨識');}
   const recognition=rankSpecies(vector,referenceBank as ReferenceBank);
   const speciesId=recognition.speciesId!;speciesById(speciesId);
   const type=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('請使用相機拍攝 JPEG、PNG 或 WebP 照片');
   if(Number(req.headers.get('content-length'))>PHOTO_LIMIT)throw Error('照片不可為空，且須小於 10 MB');
   const bytes=await req.arrayBuffer();if(bytes.byteLength===0||bytes.byteLength>PHOTO_LIMIT)throw Error('照片不可為空，且須小於 10 MB');
   if(!isPhoto(new Uint8Array(bytes),type))throw Error('照片格式不正確，請重新拍攝');
   const imageHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const duplicate=profile.observations.find(o=>o.imageHash===imageHash);
   if(!duplicate&&profile.instances.some(c=>c.photoHash===imageHash))return error('這張照片已領過卡牌；刪除觀察不會重置領取紀錄。',409);
   if(duplicate){const existing=profile.instances.find(c=>c.observationId===duplicate.id);return json({recognition:duplicate.recognition?{...recognition,...duplicate.recognition,speciesId:duplicate.recognition.speciesId}:recognition,profile:publicProfile(profile,player),observationId:duplicate.id,alreadyCollected:!!existing,card:existing?publicProfile(profile,player).instances.find(c=>c.id===existing.id):null});}
   if(profile.observations.length>=100)throw Error('展示版最多保存 100 筆觀察，請先刪除舊紀錄');
   const locationHeader=req.headers.get('x-earthdex-location');if(locationHeader&&locationHeader.length>1000)throw Error('GPS 資料過大');
   const location=locationHeader?validateLocation(JSON.parse(locationHeader)):undefined;const flags=location?locationFlags(location,profile.observations.map(o=>({speciesId:o.speciesId,at:o.at,location:o.location}))):[];
   const id=crypto.randomUUID(),key='observations/'+player+'/'+id;
   await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
   const o:Observation={id,speciesId,at:new Date().toISOString(),status:'identified',region:location?(inCampusView(location)?'fcu-vicinity':'outside-campus'):'unknown',accuracy:location?.accuracy||null,location,locationFlags:flags,privacy:{visibility:'private',shareWith:[]},mediaKey:key,mediaType:type,imageHash,recognition:{speciesId,similarity:recognition.similarity,margin:recognition.margin,modelVersion:recognition.modelVersion,candidates:recognition.candidates,lowConfidence:recognition.lowConfidence},quizAttempt:0,reason:'已採用伺服器AI最高分候選作遊戲辨識；答對物種問答即可收集。結果不是專家確認。'};
   profile.observations.push(o);try{await saveProfile();return json({recognition,profile:publicProfile(profile,player),observationId:id,alreadyCollected:false,card:null},201);}catch(e){await env.BUCKET.delete(key);throw e;}
  }
  const observationRoute=route.match(/^\/observations\/([^/]+)(\/media|\/video|\/appeal|\/review|\/privacy)?$/);
  if(observationRoute){
   const o=profile.observations.find(o=>o.id===observationRoute[1]);if(!o)return error('觀察不存在',404);
   if(req.method==='POST'&&observationRoute[2]==='/privacy'){setPrivacy(o,await readBody(req));await saveProfile();return json(publicProfile(profile,player));}
   if(req.method==='DELETE'&&!observationRoute[2]){const granted=profile.instances.find(c=>c.observationId===o.id);if(granted&&o.imageHash)granted.photoHash=o.imageHash;profile.observations=profile.observations.filter(x=>x.id!==o.id);await saveProfile();if(o.mediaKey&&env.BUCKET)await env.BUCKET.delete(o.mediaKey);return json(publicProfile(profile,player));}
   if(req.method==='GET'&&['/media','/video'].includes(observationRoute[2])){if(!o.mediaKey||!env.BUCKET)return error('此觀察沒有影像',404);if(observationRoute[2]==='/video'&&o.mediaType?.startsWith('image/'))return error('此觀察為照片',404);const media=await env.BUCKET.get(o.mediaKey);if(!media)return error('觀察影像不存在',404);return new Response(media.body,{headers:{'Content-Type':o.mediaType||media.httpMetadata?.contentType||'video/webm','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
   if(req.method==='POST'&&['/review','/appeal'].includes(observationRoute[2]))return error('目前採AI比對後直接問答，不啟用人工審核。',410);
  }
  if(route==='/matches'&&req.method==='POST'){
   const body=await readBody(req);const mode=body.mode==='pvp'?'pvp':'ai',difficulty=['easy','normal','hard'].includes(body.difficulty)?body.difficulty:'normal',theme=body.theme==='global'?'global':'taiwan';const deck=ownedDeck(profile).map(c=>({...c,id:'p0:'+c.id}));
   const seed=crypto.getRandomValues(new Uint32Array(1))[0],aiIds=theme==='global'?['turtle','egret','spotbill','moorhen','mudskipper']:['macaque','barbet','kingfisher','bear','cat'];
   let state=mode==='ai'?createBattle([deck,aiIds.map((id,i)=>({id:'ai:'+i,definition:officialDefinition(id)}))],seed):null;
   while(state?.status==='playing'&&state.turn===1)state=applyMove(state,chooseAI(state,difficulty));
   const match:Match={mode,state,initial:mode==='ai'?createBattle([deck,aiIds.map((id,i)=>({id:'ai:'+i,definition:officialDefinition(id)}))],seed):null,difficulty,theme,settled:[],createdAt:new Date().toISOString()};
   // Waiting rooms retain their validated deck snapshot, not an untrusted client deck.
   const data=mode==='pvp'?{...match,waitingDeck:deck,seed,balanceVersion:OFFICIAL_CARD_VERSION}:match;
   const id=mode==='pvp'?crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase():crypto.randomUUID();
   await env.DB.prepare('INSERT INTO matches(id,revision,p0,p1,data,updated_at) VALUES(?,0,?,?,?,?)').bind(id,player,mode==='ai'?'AI':null,JSON.stringify(data),new Date().toISOString()).run();return json({id,side:0,state:publicBattleState(state,0),mode,revision:0},201);
  }
  const matchRoute=route.match(/^\/matches\/([^/]+)(\/join|\/move|\/resign|\/settle|\/replay)?$/);
  if(matchRoute){
   const id=matchRoute[1].toUpperCase();let mrow=await env.DB.prepare('SELECT * FROM matches WHERE UPPER(id)=?').bind(id).first<MatchRow>();if(!mrow)return error('找不到房間，請檢查代碼',404);
   const match=JSON.parse(mrow.data) as Match & {waitingDeck?:any[];seed?:number;balanceVersion?:string};
   let side:Side=mrow.p0===player?0:1;
   const saveMatch=async(p1=mrow!.p1)=>{const result=await env.DB.prepare('UPDATE matches SET data=?,p1=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(match),p1,new Date().toISOString(),mrow!.id,mrow!.revision).run();if(!(result.meta?.changes??result.changes))throw Error('回合已更新，請重試');mrow!.revision++;};
   if(matchRoute[2]==='/join'&&req.method==='POST'){
    if(match.mode!=='pvp')throw Error('此房間不是 PVP');if(mrow.p0===player)return error('請由另一位玩家加入此房間',409);if(mrow.p1&&mrow.p1!==player)return error('房間已滿',409);
    if(!mrow.p1){if(match.balanceVersion!==OFFICIAL_CARD_VERSION)return error('等待房間的平衡版本已更新，請重新建立房間；舊戰報保留。',409);const deck=ownedDeck(profile).map(c=>({...c,id:'p1:'+c.id}));match.state=createBattle([match.waitingDeck!,deck],match.seed!);match.initial=structuredClone(match.state);delete match.waitingDeck;await saveMatch(player);}return json({id:mrow.id,side:1,state:publicBattleState(match.state,1),mode:match.mode,revision:mrow.revision});
   }
   if(mrow.p0!==player&&mrow.p1!==player)return error('沒有此對局的存取權限',403);
   if(req.method==='GET'&&matchRoute[2]==='/replay'&&match.state?.status!=='finished')return error('對局結束後才開放完整重播，避免揭露對手手牌。',409);
   if(req.method==='GET')return json(matchRoute[2]==='/replay'?{initial:match.initial,moves:match.state?.moves||[],final:match.state}:{id:mrow.id,side,state:publicBattleState(match.state,side),mode:match.mode,revision:mrow.revision});
   if(req.method==='POST'&&matchRoute[2]==='/move'){
    const body=await readBody(req);if(!match.state)throw Error('等待對手加入');if(body.revision!==mrow.revision)return error('回合已更新，請重試',409);
    match.state=applyMove(match.state,{side,cardId:body.cardId,cell:body.cell});
    while(match.mode==='ai'&&match.state.status==='playing'&&match.state.turn===1)match.state=applyMove(match.state,chooseAI(match.state,match.difficulty));
    await saveMatch();return json({id:mrow.id,side,state:publicBattleState(match.state,side),mode:match.mode,revision:mrow.revision});
   }
   if(req.method==='POST'&&matchRoute[2]==='/resign'){if(!match.state||match.state.status!=='playing')throw Error('目前無法投降');match.state.status='finished';match.state.winner=(1-side) as Side;match.finishedBy=side;await saveMatch();return json({id:mrow.id,side,state:publicBattleState(match.state,side),mode:match.mode,revision:mrow.revision});}
   if(req.method==='POST'&&matchRoute[2]==='/settle'){
    if(match.state?.status!=='finished')throw Error('對局尚未結束');
    // Per-player idempotent settlement marker lives in the same CAS-protected profile.
    const marker='settled:'+mrow.id;
    if(!profile.badges.includes(marker)){
     profile.stats.matches++;if(match.state.winner===side)profile.stats.wins++;
     if(match.finishedBy===undefined)for(const speciesId of dexCandidates(match.state,side,profile.unlocks.map(u=>u.speciesId)))if(!profile.pending.some(q=>q.speciesId===speciesId))profile.pending.push({speciesId,matchId:mrow.id,attempt:0,source:'battle'});
     profile.badges.push(marker);await saveProfile();
    }
    return json({profile:publicProfile(profile,player),score:score(match.state)});
   }
  }
  return error('找不到此 API',404);
 }catch(e){return error(e instanceof Error?e.message:'發生錯誤');}
}
