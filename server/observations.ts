import type {Observation,Profile} from './model';
import {SPECIES,speciesById} from '../engine/species';
import {CAMPUS,CAMPUS_VIEW} from '../engine/campus';
import type {GeoPoint} from '../engine/observation-policy';
export interface ObservationPrivacy {visibility:'private'|'public'|'friends';shareWith:string[]}
export function inCampusView(point:GeoPoint){return point.lat>=CAMPUS_VIEW.south&&point.lat<=CAMPUS_VIEW.north&&point.lng>=CAMPUS_VIEW.west&&point.lng<=CAMPUS_VIEW.east;}
export function sharedObservation(o:Observation){const sensitive=speciesById(o.speciesId).sensitive;return {id:o.id,speciesId:o.speciesId,at:o.at,status:o.status,region:o.verification?.campusConfirmed?'fcu':o.region,location:!sensitive&&o.location?{lat:Math.round(o.location.lat*1000)/1000,lng:Math.round(o.location.lng*1000)/1000,precision:'approximate-100m'}:null,sensitive,verified:!!o.verification,source:'EarthDex player observation'};}
export function setPrivacy(o:Observation,body:any){
 if(!['private','public','friends'].includes(body.visibility)||!Array.isArray(body.shareWith)||body.shareWith.length>20||body.shareWith.some((s:any)=>typeof s!=='string'||s.length>200||!s.trim()))throw Error('分享權限格式錯誤');
 o.privacy={visibility:body.visibility,shareWith:body.visibility==='friends'?[...new Set<string>(body.shareWith)]:[]};
}
export function filterObservations(observations:Observation[],params:URLSearchParams){
 const from=params.get('from'),to=params.get('to');for(const d of [from,to])if(d&&(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d))throw Error('日期格式錯誤');if(from&&to&&from>to)throw Error('開始日期不得晚於結束日期');
 return observations.filter(o=>(!params.get('species')||o.speciesId===params.get('species'))&&(!params.get('region')||params.get('region')===(o.verification?.campusConfirmed?'fcu':o.region))&&(!from||new Date(o.at).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})>=from)&&(!to||new Date(o.at).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})<=to));
}
export function ecologyStats(observations:Observation[],unlocks:string[]=[],demo=false){
 const verified=observations.filter(o=>o.verification&&['verified','collected'].includes(o.status));const campus=verified.filter(o=>o.verification?.campusConfirmed);
 const counts=(rows:Observation[],key:(o:Observation)=>string)=>Object.fromEntries([...new Set(rows.map(key))].sort().map(k=>[k,rows.filter(o=>key(o)===k).length]));
 const ids=new Set(unlocks),completed=CAMPUS.candidates.filter(c=>ids.has(c.speciesId)).length;
 const gameCollected=observations.filter(o=>o.status==='collected');
 return {demo,gameCollectedObservations:gameCollected.length,gameGroups:counts(gameCollected,o=>speciesById(o.speciesId).group),gameDates:counts(gameCollected,o=>new Date(o.at).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})),gameMonths:counts(gameCollected,o=>new Date(o.at).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}).slice(0,7)),observations:observations.length,verifiedObservations:verified.length,confirmedSpecies:new Set(verified.map(o=>o.speciesId)).size,campusObservations:campus.length,campusConfirmedSpecies:new Set(campus.map(o=>o.speciesId)).size,groups:counts(verified,o=>speciesById(o.speciesId).group),regions:counts(verified,o=>o.verification?.campusConfirmed?'fcu':o.region),zones:counts(campus,o=>o.verification?.zone||'unspecified'),dates:counts(verified,o=>new Date(o.at).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})),months:counts(verified,o=>new Date(o.at).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}).slice(0,7)),completion:{completed,total:CAMPUS.candidates.length,ratio:completed/CAMPUS.candidates.length},note:'觀察紀錄不等於動物個體數或族群數量；僅統計有來源確認的紀錄。'};
}
export function publicCampusStats(profiles:Profile[]){
 const observations=profiles.filter(p=>!p.demo).flatMap(p=>p.observations.filter(o=>o.privacy?.visibility==='public'&&o.verification?.campusConfirmed&&['verified','collected'].includes(o.status)));
 const stats=ecologyStats(observations);return {...stats,confirmedSpeciesIds:[...new Set(observations.map(o=>o.speciesId))],completion:undefined,note:'只計入玩家主動公開且有來源證據確認在校內的正式觀察；私人/好友/示範資料不計入。紀錄數不代表族群數量。'};
}
