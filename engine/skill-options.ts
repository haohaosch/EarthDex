import {SKILLS} from './engine';
import type {SkillId} from './types';
/** Actual per-card selection happens only when the observation is collected. */
export function possibleCardSkills(tags:string[]):SkillId[]{
 return (Object.keys(SKILLS) as SkillId[]).filter(id=>id==='neutral'||!!SKILLS[id].tag&&tags.includes(SKILLS[id].tag!)).sort();
}
