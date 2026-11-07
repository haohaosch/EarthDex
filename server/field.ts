import type {Profile,Observation} from './model';
import {mintCard,publicProfile,instanceDefinition} from './model';
import {speciesById,SERIES} from '../engine/species';
export function fieldQuestion(profile:Profile,observationId:string){
 const observation=profile.observations.find(o=>o.id===observationId);
 if(!observation||!observation.recognition||!['identified','collected'].includes(observation.status))throw Error('請先拍照辨識物種');
 const species=speciesById(observation.speciesId),attempt=observation.quizAttempt||0,question=species.questions[attempt%species.questions.length];
 return {observationId,speciesId:species.id,attempt,q:question.q,options:question.options};
}
export function collectObservation(profile:Profile,id:string,choice:number,attempt:number){
 const existing=profile.instances.find(c=>c.observationId===id);
 if(existing)return {correct:true,alreadyCollected:true,card:{...existing,definition:instanceDefinition(existing)},explanation:'這筆觀察已領取卡牌。'};
 const question=fieldQuestion(profile,id),o=profile.observations.find(o=>o.id===id)!;
 if(attempt!==question.attempt)throw Error('題目已更新，請重新載入題目');
 const q=speciesById(o.speciesId).questions[question.attempt%speciesById(o.speciesId).questions.length];
 if(!Number.isInteger(choice)||choice<0||choice>=q.options.length)throw Error('請選擇一個答案');
 const correct=choice===q.answer;profile.attempts.push({speciesId:o.speciesId,question:question.attempt%2,correct,at:new Date().toISOString()});profile.attempts=profile.attempts.slice(-200);
 if(!correct){o.quizAttempt=(o.quizAttempt||0)+1;return {correct:false,alreadyCollected:false,card:null,explanation:q.explanation};}
 const card=mintCard(o.speciesId,o.id);profile.instances.push(card);o.status='collected';
 if(!profile.unlocks.some(u=>u.speciesId===o.speciesId))profile.unlocks.push({speciesId:o.speciesId,method:'field',at:new Date().toISOString()});
 for(const series of SERIES)if(series.ids.every(id=>profile.unlocks.some(u=>u.speciesId===id))&&!profile.badges.includes(series.id))profile.badges.push(series.id);
 return {correct:true,alreadyCollected:false,card:{...card,definition:instanceDefinition(card)},explanation:q.explanation};
}
