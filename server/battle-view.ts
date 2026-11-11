import type {BattleCard,BattleState,Side} from '../engine/types';
import {activeReveals} from '../engine/ecology-rules';
/** A concealed hand exposes instance identity/count only, never species, values, skill or seed. */
function conceal(c:BattleCard):BattleCard{return {id:c.id,originalOwner:c.originalOwner,controller:c.controller,spent:0,hidden:true,definition:{speciesId:'hidden',version:'hidden',values:[0,0,0,0],skill:'neutral',seed:0}};}
export function publicBattleState(state:BattleState|null,side:Side):BattleState|null{
 if(!state)return null;const s=structuredClone(state);if(s.status==='finished')return s;
 const opponent=(1-side) as Side;s.hands[opponent]=s.hands[opponent].map(conceal);
 // Historical animation snapshots must not turn into a side channel for concealed cards.
 for(const snap of s.turnSnapshots||[])snap.hands[opponent]=snap.hands[opponent].map(conceal);
 s.handReveals=activeReveals(state,side).map(r=>structuredClone(r));return s;
}
