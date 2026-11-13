import {canTacticalPlace} from '../engine/tactical-rules';
import type {BattleState,Side} from '../engine/types';
export function canDropCard(state:BattleState|null|undefined,own:Side,cardId:string,cell:number|null):boolean{
 return !!state&&state.status==='playing'&&state.turn===own&&cell!==null&&Number.isInteger(cell)&&cell>=0&&cell<9&&state.hands[own].some(card=>card.id===cardId&&(state.ruleVersion==='tactics-0.3'?canTacticalPlace(state,card,cell):!state.board[cell]||state.ruleVersion==='ecology-0.2'&&card.definition.skill==='migration'&&!card.skillDisabled&&state.board[cell]?.controller===own));
}
export function pointedBattleCell(point:{x:number;y:number}):number|null{
 const element=document.elementFromPoint(point.x,point.y)?.closest<HTMLElement>('[data-battle-cell]');if(!element)return null;
 const cell=Number(element.dataset.battleCell);return Number.isInteger(cell)&&cell>=0&&cell<9?cell:null;
}
