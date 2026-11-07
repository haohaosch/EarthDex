import type {BattleState,Side} from '../engine/types';
export function canDropCard(state:BattleState|null|undefined,own:Side,cardId:string,cell:number|null):boolean{
 return !!state&&state.status==='playing'&&state.turn===own&&cell!==null&&Number.isInteger(cell)&&cell>=0&&cell<9&&!state.board[cell]&&state.hands[own].some(card=>card.id===cardId);
}
export function pointedBattleCell(point:{x:number;y:number}):number|null{
 const element=document.elementFromPoint(point.x,point.y)?.closest<HTMLElement>('[data-battle-cell]');if(!element)return null;
 const cell=Number(element.dataset.battleCell);return Number.isInteger(cell)&&cell>=0&&cell<9?cell:null;
}
