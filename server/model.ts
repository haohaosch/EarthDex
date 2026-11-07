import type {CardInstance} from '../engine/types';
import {definition,SPECIES,speciesById} from '../engine/species';
import {validateDeck,generateCard,hash} from '../engine/engine';
import type {CardDefinition} from '../engine/types';
export type ObservationStatus='submitted'|'manual_review'|'verified'|'rejected'|'appealed'|'identified'|'collected'|'saved';
export interface Observation {id:string;speciesId:string;at:string;status:ObservationStatus;region:string;accuracy:number|null;mediaKey?:string;mediaType?:string;reason:string;challenge?:string;imageHash?:string;recognition?:{speciesId:string;similarity:number;margin:number;modelVersion:string};quizAttempt?:number}
export interface Unlock {speciesId:string;method:'field'|'battle';at:string}
export interface PendingQuiz {speciesId:string;matchId:string;attempt:number;source:'battle'}
export interface Profile {demo:boolean;instances:CardInstance[];unlocks:Unlock[];observations:Observation[];deck:string[];pending:PendingQuiz[];attempts:{speciesId:string;question:number;correct:boolean;at:string}[];badges:string[];stats:{matches:number;wins:number}; revision:number}
export function instanceDefinition(c:CardInstance):CardDefinition {return c.definition||definition(c.speciesId);}
export function mintCard(speciesId:string,observationId:string):CardInstance {const id=crypto.randomUUID(),seed=crypto.getRandomValues(new Uint32Array(1))[0];return {id,speciesId,observationId,grantId:crypto.randomUUID(),issuedAt:new Date().toISOString(),definition:generateCard(speciesId,speciesById(speciesId).tags,'capture-0.2',seed)};}
export function newProfile(demo:boolean):Profile{
 const profile:Profile={demo,instances:[],unlocks:[],observations:[],deck:[],pending:[],attempts:[],badges:[],stats:{matches:0,wins:0},revision:0};
 if(demo){
  const ids=['deer','magpie','sparrow','butterfly','egret','magpie','deer'];
  ids.forEach((speciesId,i)=>{const at=new Date(Date.UTC(2026,9,1+i)).toISOString(),observationId='fixture-observation-'+i;profile.observations.push({id:observationId,speciesId,at,status:'verified',region:i<3?'臺灣・低海拔地區':'臺灣・平原地區',accuracy:18,reason:'展示資料：預先建立的觀察與獲卡紀錄，非真實驗證結果'});profile.instances.push({id:'fixture-card-'+i,speciesId,observationId,grantId:'fixture-grant-'+i,issuedAt:at,definition:generateCard(speciesId,speciesById(speciesId).tags,'fixture-0.2',hash('fixture-card-'+i))});});
  profile.deck=profile.instances.slice(0,5).map(c=>c.id);profile.unlocks=[...new Set(ids)].map(speciesId=>({speciesId,method:'field',at:'2026-10-01T00:00:00.000Z'}));
 }
 return profile;
}
export function ownedDeck(p:Profile,ids:string[]=p.deck){const cards=ids.map(id=>{const c=p.instances.find(c=>c.id===id);if(!c)throw Error('卡牌不屬於目前玩家');return c;});const errors=validateDeck(cards);if(errors.length)throw Error(errors.join('；'));return cards.map(c=>({id:c.id,definition:instanceDefinition(c)}));}
export function answerQuiz(p:Profile,speciesId:string,choice:number){
 const pending=p.pending.find(q=>q.speciesId===speciesId);if(!pending)throw Error('沒有此物種的問答資格');
 const species=speciesById(speciesId),index=pending.attempt%species.questions.length,q=species.questions[index];if(!Number.isInteger(choice)||choice<0||choice>=q.options.length)throw Error('答案格式不正確');
 const correct=choice===q.answer;p.attempts.push({speciesId,question:index,correct,at:new Date().toISOString()});p.attempts=p.attempts.slice(-200);
 if(correct){if(!p.unlocks.some(u=>u.speciesId===speciesId))p.unlocks.push({speciesId,method:'battle',at:new Date().toISOString()});p.pending=p.pending.filter(q=>q.speciesId!==speciesId);}else pending.attempt++;
 // Answering battle questions can never mint owned card instances.
 return {correct,explanation:q.explanation};
}
export function publicProfile(p:Profile){return {...p,instances:p.instances.map(c=>({...c,definition:instanceDefinition(c)})),observations:p.observations.map(({mediaKey,...o})=>{const mediaType=mediaKey?(o.mediaType||'video/webm'):undefined;return {...o,...(['manual_review','appealed'].includes(o.status)?{status:'saved' as const,reason:'舊版觀察紀錄；可重新拍照進行即時辨識與收集。'}:{}),mediaType,hasPhoto:!!mediaKey&&mediaType!.startsWith('image/'),hasVideo:!!mediaKey&&mediaType!.startsWith('video/')};})};}
export type PublicProfile=ReturnType<typeof publicProfile>;
export function safeCatalog(){return SPECIES.map(s=>({...s,questions:undefined}));}
