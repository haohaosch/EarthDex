import {distanceKm} from './engine';
export interface GeoPoint {lat:number;lng:number;accuracy:number;measuredAt:string}
export interface GrantLocation {speciesId:string;at:string;location?:GeoPoint;imageHash?:string}
export interface RepeatPolicy {enabled:boolean;interpretation:'cooldown-last-location'|'cooldown-window'|'window-distance';minKm:number;minDays:number}
export const REPEAT_POLICY:RepeatPolicy={enabled:false,interpretation:'cooldown-window',minKm:1,minDays:7};
export function validateLocation(value:unknown,now=Date.now()):GeoPoint {
 const v=value as GeoPoint;if(!v||typeof v.lat!=='number'||typeof v.lng!=='number'||typeof v.accuracy!=='number'||!Number.isFinite(v.lat)||!Number.isFinite(v.lng)||!Number.isFinite(v.accuracy)||Math.abs(v.lat)>90||Math.abs(v.lng)>180||v.accuracy<=0||v.accuracy>100000||typeof v.measuredAt!=='string'||!Number.isFinite(Date.parse(v.measuredAt))||Date.parse(v.measuredAt)>now+120000||now-Date.parse(v.measuredAt)>1800000)throw Error('GPS 資料無效或已過期，請重新定位或略過定位');
 return {lat:v.lat,lng:v.lng,accuracy:v.accuracy,measuredAt:new Date(v.measuredAt).toISOString()};
}
export function locationFlags(location:GeoPoint,history:GrantLocation[],now=Date.now()):string[]{
 const flags:string[]=[];if(location.accuracy>100)flags.push('low-accuracy');if(now-Date.parse(location.measuredAt)>120000)flags.push('stale-fix');
 const previous=history.filter(o=>o.location&&Date.parse(o.location.measuredAt)<Date.parse(location.measuredAt)).sort((a,b)=>Date.parse(b.location!.measuredAt)-Date.parse(a.location!.measuredAt))[0];
 if(previous){const hours=(Date.parse(location.measuredAt)-Date.parse(previous.location!.measuredAt))/3600000;const km=Math.max(0,distanceKm(location,previous.location!)-(location.accuracy+previous.location!.accuracy)/1000);if(hours>0&&km/hours>300)flags.push('implausible-speed');}
 return flags;
}
export function evaluateRepeat(candidate:GrantLocation,history:GrantLocation[],policy:RepeatPolicy=REPEAT_POLICY){
 if(!Number.isFinite(policy.minKm)||policy.minKm<0||!Number.isFinite(policy.minDays)||policy.minDays<0)throw Error('重複規則參數錯誤');
 const same=history.filter(o=>o.speciesId===candidate.speciesId),time=Date.parse(candidate.at),windowMs=policy.minDays*86400000;
 if(!Number.isFinite(time)||same.some(o=>!Number.isFinite(Date.parse(o.at))))throw Error('觀察時間無效');
 const ordered=same.slice().sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)),last=ordered[0],recent=ordered.filter(o=>time-Date.parse(o.at)<=windowMs&&time>=Date.parse(o.at));
 const reasons:string[]=[];if(candidate.imageHash&&same.some(o=>o.imageHash===candidate.imageHash))reasons.push('duplicate-photo');
 if(same.some(o=>Date.parse(o.at)>time))reasons.push('out-of-order-time');
 if(policy.interpretation!=='window-distance'&&last&&time-Date.parse(last.at)<windowMs)reasons.push('cooldown');
 const distanceHistory=policy.interpretation==='cooldown-last-location'?(last?[last]:[]):recent;
 if(distanceHistory.length&&(!candidate.location||distanceHistory.some(o=>!o.location)))reasons.push('location-unknown');
 else if(candidate.location&&distanceHistory.some(o=>distanceKm(candidate.location!,o.location!)<policy.minKm))reasons.push('distance');
 return {enforced:policy.enabled,eligible:policy.enabled?reasons.length===0:null,reasons,compared:distanceHistory.length,interpretation:policy.interpretation};
}
