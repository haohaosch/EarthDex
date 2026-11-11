import {neighbors,SKILLS} from './engine';
import {speciesById} from './species';
import type {BattleEvent,BattleState,SkillId} from './types';
export interface ComparisonExplanation {seq:number;attack:string;defense:string;result:string;text:string}
const directions=['上','右','下','左'];
export interface ComparisonOperand {cell:number;direction:number;base:number;total:number;bonus:number;skill:SkillId;role:'attack'|'defense'}
/** Historical totals come from the server event, never current neighboring controllers. */
export function comparisonOperands(state:BattleState,event:BattleEvent):{attack:ComparisonOperand;defense:ComparisonOperand}|null{
 if(event.type!=='compared'||event.from===undefined||event.cell===undefined)return null;
 const link=neighbors(event.from).find(([target])=>target===event.cell),a=event.attackCard||state.board[event.from],b=event.defenseCard||state.board[event.cell];
 const totals=event.detail.match(/^(\d+)\s*(?:>|≤|<|≥)\s*(\d+)$/);
 if(!link||!a||!b||!totals)return null;
 const [,dir,opposite]=link,av=Number(totals[1]),bv=Number(totals[2]);
 return {attack:{cell:event.from,direction:dir,base:a.definition.values[dir],total:av,bonus:av-a.definition.values[dir],skill:a.definition.skill,role:'attack'},defense:{cell:event.cell,direction:opposite,base:b.definition.values[opposite],total:bv,bonus:bv-b.definition.values[opposite],skill:b.definition.skill,role:'defense'}};
}
export function explainComparison(state:BattleState,event:BattleEvent):ComparisonExplanation|null{
 const operands=comparisonOperands(state,event);if(!operands)return null;
 const {attack:avalue,defense:bvalue}=operands,a=(event.attackCard||state.board[avalue.cell])!,b=(event.defenseCard||state.board[bvalue.cell])!,dir=avalue.direction,opposite=bvalue.direction,av=avalue.total,bv=bvalue.total;
 const operand=(card:typeof a,direction:number,total:number)=>{const base=card.definition.values[direction],bonus=total-base;return `${speciesById(card.definition.speciesId).name}（${directions[direction]}）${base}${bonus?` ＋ ${SKILLS[card.definition.skill].name} ${bonus}`:''} ＝ ${total}`;};
 const attack=operand(a,dir,av),defense=operand(b,opposite,bv),result=event.reverse?(av<bv?'反捕食者防禦：攻方較小，進入翻面判定':av===bv?'點數相等，不翻面':'反捕食者防禦：防守方較小，反翻攻方'):(av>bv?'攻方較高，進入翻面判定':av===bv?'點數相等，不翻面':'攻方較低，不翻面');
 return {seq:event.seq,attack,defense,result,text:`${attack}；${defense}。${result}。`};
}
export function comparisonsForCard(state:BattleState,id:string):ComparisonExplanation[]{
 const cell=state.board.findIndex(c=>c?.id===id);if(cell<0)return [];
 return state.events.filter(e=>e.type==='compared'&&(e.cell===cell||e.from===cell)).map(e=>explainComparison(state,e)).filter((x):x is ComparisonExplanation=>!!x).slice(-3).reverse();
}
