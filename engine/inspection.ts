import type {BattleState,Side} from './types';
export type CardInspection={source:'board'|'hand';id:string};
export function inspectBattleCard(state:BattleState,own:Side,target:CardInspection|null){
 if(!target)return null;
 if(target.source==='hand'){const card=state.hands[own].find(c=>c.id===target.id);return card?{card,location:'你的手牌',inHand:true}:null;}
 const cell=state.board.findIndex(c=>c?.id===target.id);return cell<0?null:{card:state.board[cell]!,location:`戰場第 ${cell+1} 格`,inHand:false};
}
