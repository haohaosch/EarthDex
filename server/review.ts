import type {Observation,Profile} from './model';
import {speciesById} from '../engine/species';
export interface ReviewDecision {at:string;reviewer:string;decision:'approved'|'rejected';speciesId?:string;basis:string;campusConfirmed:boolean;zone?:string}
export interface ReviewRequest {id:string;status:'unrequested'|'pending'|'approved'|'rejected';requestedAt?:string;note?:string;history:ReviewDecision[]}
export function requestReview(o:Observation,note:unknown){
 if(['collected','verified'].includes(o.status)||o.verification)throw Error('此觀察已確認');
 if(o.review?.status==='pending')return;
 if(typeof note!=='string'||note.length>1000)throw Error('審核說明格式不正確');
 o.review={id:crypto.randomUUID(),status:'pending',requestedAt:new Date().toISOString(),note,history:o.review?.history||[]};o.status='manual_review';o.reason='已送出人工確認申請，尚未確認物種，不會發卡。';
}
export function decideReview(profile:Profile,body:any,reviewer:string){
 const o=profile.observations.find(o=>o.id===body.observationId);if(!o||!o.review||o.review.id!==body.reviewId||o.review.status!=='pending')throw Error('申請不存在或已處理');
 if(!['approved','rejected'].includes(body.decision)||typeof body.basis!=='string'||body.basis.trim().length<6||body.basis.length>2000)throw Error('請提供有效審核結論與依據');
 const at=new Date().toISOString();let speciesId:string|undefined;
 if(body.decision==='approved'){speciesId=speciesById(body.speciesId).id;o.speciesId=speciesId;o.status='verified';o.verification={method:'human',at,speciesId,basis:body.basis,campusConfirmed:body.campusConfirmed===true,zone:body.campusConfirmed===true&&['north','south','east','west','unspecified'].includes(body.zone)?body.zone:'unspecified'};o.quizAttempt=0;o.reason='審核者已確認物種；答對知識問答後才可收集。';}
 else{o.status='rejected';o.reason='審核未通過：'+body.basis;}
 o.review.status=body.decision;o.review.history.push({at,reviewer,decision:body.decision,speciesId,basis:body.basis,campusConfirmed:body.campusConfirmed===true,zone:o.verification?.zone});
 return o;
}
export function reviewers(value?:string){return (value||'').split(',').map(v=>v.trim()).filter(Boolean);}
