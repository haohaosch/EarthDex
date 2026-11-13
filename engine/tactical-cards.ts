import {hash,rng,randomDirections} from './engine';
import {SPECIES} from './species';
import {TACTICAL_SKILLS,TACTICAL_COSTS} from './tactical-skills';
import type {CardDefinition} from './types';
const ids=SPECIES.map(s=>s.id).sort((a,b)=>hash(a+':tactics-assignment-1')-hash(b+':tactics-assignment-1')||a.localeCompare(b));
/** Round robin after stable hashing spreads all 17 abilities without ecological eligibility. */
export function tacticalDefinition(speciesId:string):CardDefinition{
 const index=ids.indexOf(speciesId);if(index<0)throw Error('未知物種');const skill=TACTICAL_SKILLS[index%TACTICAL_SKILLS.length],seed=hash(speciesId+':official-3:tactics-1');
 return {speciesId,version:'official-3',skill,seed,values:randomDirections(28-TACTICAL_COSTS[skill],rng(seed))};
}
