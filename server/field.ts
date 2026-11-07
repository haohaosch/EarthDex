import type {Profile} from './model';
import {mintCard,instanceDefinition} from './model';
import {speciesById,SERIES} from '../engine/species';
// Collection is immediate and idempotent. Field questions are no longer required.
export function collectObservation(profile:Profile,id:string){
 const existing=profile.instances.find(c=>c.observationId===id);
 if(existing)return {correct:true,alreadyCollected:true,card:{...existing,definition:instanceDefinition(existing)},explanation:'這筆觀察已收入卡牌。'};
 const observation=profile.observations.find(o=>o.id===id);
 if(!observation?.recognition||!['identified','collected'].includes(observation.status))throw Error('請先拍照完成物種辨識');
 speciesById(observation.speciesId);
 const card=mintCard(observation.speciesId,observation.id);profile.instances.push(card);observation.status='collected';observation.reason='採用模型比對分數最高的物種，已自動收入卡牌。';
 if(!profile.unlocks.some(u=>u.speciesId===observation.speciesId))profile.unlocks.push({speciesId:observation.speciesId,method:'field',at:new Date().toISOString()});
 for(const series of SERIES)if(series.ids.every(id=>profile.unlocks.some(u=>u.speciesId===id))&&!profile.badges.includes(series.id))profile.badges.push(series.id);
 return {correct:true,alreadyCollected:false,card:{...card,definition:instanceDefinition(card)},explanation:'已依最高分物種自動收錄。'};
}
