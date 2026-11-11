import type {Profile} from './model';
import {mintCard,instanceDefinition} from './model';
import {speciesById,SERIES} from '../engine/species';
export function fieldQuestion(profile:Profile,observationId:string){
 const observation=profile.observations.find(o=>o.id===observationId);
 if(!observation?.verification||observation.verification.speciesId!==observation.speciesId||!['verified','collected'].includes(observation.status))throw Error('物種尚未經審核確認，請先申請人工確認');
 const species=speciesById(observation.speciesId),attempt=observation.quizAttempt||0,question=species.questions[attempt%species.questions.length];
 return {observationId,speciesId:species.id,attempt,q:question.q,options:question.options};
}
export function collectObservation(profile:Profile,id:string,choice:unknown,attempt:unknown){
 const existing=profile.instances.find(c=>c.observationId===id);
 if(existing)return {correct:true,alreadyCollected:true,card:{...existing,definition:instanceDefinition(existing)},explanation:'這筆觀察已收入卡牌。'};
 const question=fieldQuestion(profile,id),observation=profile.observations.find(o=>o.id===id)!;
 if(attempt!==question.attempt)throw Error('題目已更新，請重新載入題目');
 const species=speciesById(observation.speciesId),q=species.questions[question.attempt%species.questions.length];
 if(typeof choice!=='number'||!Number.isInteger(choice)||choice<0||choice>=q.options.length)throw Error('請先選擇一個答案');
 const correct=choice===q.answer;profile.attempts.push({speciesId:species.id,question:question.attempt%species.questions.length,correct,at:new Date().toISOString()});profile.attempts=profile.attempts.slice(-200);
 if(!correct){observation.quizAttempt=question.attempt+1;return {correct:false,alreadyCollected:false,card:null,explanation:q.explanation};}
 const card=mintCard(observation.speciesId,observation.id);card.photoHash=observation.imageHash;profile.instances.push(card);observation.status='collected';observation.reason='物種已經審核確認，並通過知識問答收入卡牌。';
 if(!profile.unlocks.some(u=>u.speciesId===species.id))profile.unlocks.push({speciesId:species.id,method:'field',at:new Date().toISOString()});
 for(const series of SERIES)if(series.ids.every(id=>profile.unlocks.some(u=>u.speciesId===id))&&!profile.badges.includes(series.id))profile.badges.push(series.id);
 return {correct:true,alreadyCollected:false,card:{...card,definition:instanceDefinition(card)},explanation:q.explanation};
}
