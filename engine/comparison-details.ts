import {neighbors,SKILLS} from './engine';
import {speciesById} from './species';
import type {BattleEvent,BattleState} from './types';
export interface ComparisonExplanation {seq:number;attack:string;defense:string;result:string;text:string}
const directions=['上','右','下','左'];
/** Use recorded totals: neighboring controllers can have changed since comparison. */
export function explainComparison(state:BattleState,event:BattleEvent):ComparisonExplanation|null{
 if(event.type!=='compared'||event.from===undefined||event.cell===undefined)return null;
 const link=neighbors(event.from).find(([target])=>target===event.cell),a=state.board[event.from],b=state.board[event.cell];
 const totals=event.detail.match(/^(\d+)\s*(?:>|≤)\s*(\d+)$/);
 if(!link||!a||!b||!totals)return null;
 const [,dir,opposite]=link,av=Number(totals[1]),bv=Number(totals[2]);
 const operand=(card:typeof a,direction:number,total:number)=>{const base=card.definition.values[direction],bonus=total-base;return `${speciesById(card.definition.speciesId).name}（${directions[direction]}）${base}${bonus?` ＋ ${SKILLS[card.definition.skill].name} ${bonus}`:''} ＝ ${total}`;};
 const attack=operand(a,dir,av),defense=operand(b,opposite,bv),result=av>bv?'攻方較高，進入翻面判定':av===bv?'點數相等，不翻面':'攻方較低，不翻面';
 return {seq:event.seq,attack,defense,result,text:`${attack}；${defense}。${result}。`};
}
export function comparisonsForCard(state:BattleState,id:string):ComparisonExplanation[]{
 const cell=state.board.findIndex(c=>c?.id===id);if(cell<0)return [];
 return state.events.filter(e=>e.type==='compared'&&(e.cell===cell||e.from===cell)).map(e=>explainComparison(state,e)).filter((x):x is ComparisonExplanation=>!!x).slice(-3).reverse();
}
