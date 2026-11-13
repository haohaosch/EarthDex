import type {SkillId} from './types';
/** Gameplay names deliberately make no claim about a species' natural behavior. */
export const TACTICAL_SKILLS:SkillId[]=['collective','antipredator','defensive_aggression','defense_mechanism','escape','mimicry','migration','predator','rally','pierce','cascade','swap','vengeance','weaken','overrun','inspire','surrounded'];
export const TACTICAL_COSTS:Record<string,number>=Object.fromEntries(TACTICAL_SKILLS.map((id,i)=>[id,[0,6,6,5,6,7,5,10,6,7,9,7,7,9,8,8,5][i]]));
export const TACTICAL_NAMES:Partial<Record<SkillId,[string,string]>>={collective:['連鎖倒戈','Chain Defection'],antipredator:['逆轉比較','Reverse Comparison'],defensive_aggression:['易幟反擊','Turncoat Counter'],defense_mechanism:['技能護盾','Skill Shield'],escape:['緊急撤離','Emergency Retreat'],mimicry:['翻面護盾','Flip Shield'],migration:['友軍換防','Friendly Relief'],predator:['情報偵察','Hand Recon']};
