import type {BattleState,BattleCard,BattleEvent,Move,Side,SkillId,TurnSnapshot} from './types';
import {neighbors,comparisonModifier,SKILLS} from './engine';
export {RULE_VERSION as ECOLOGY_RULE_VERSION} from './versions';
export const MAX_TURNS=100;
export const ECOLOGY_SKILLS:SkillId[]=['collective','antipredator','defensive_aggression','defense_mechanism','escape','mimicry','migration','predator'];
const enabled=(card:BattleCard,skill:SkillId)=>card.definition.skill===skill&&!card.skillDisabled;
interface Proposal {target:number;source:number;side:Side;skill?:SkillId}
export function ecologyLegalMoves(s:BattleState):Move[]{
 if(s.status!=='playing')return [];
 return s.hands[s.turn].flatMap(c=>s.board.flatMap((v,i)=>!v||enabled(c,'migration')&&v.controller===s.turn?[{side:s.turn,cardId:c.id,cell:i}]:[]));
}
export function activeReveals(s:BattleState,side:Side){return (s.handReveals||[]).filter(r=>r.viewer===side&&r.active&&s.board.some(c=>c?.id===r.sourceCardId&&c.controller===side&&!c.skillDisabled));}
export function turnSnapshot(s:BattleState):TurnSnapshot{return structuredClone({moveNumber:s.moves.length,board:s.board,hands:s.hands,turn:s.turn,status:s.status,winner:s.winner,...(s.endReason?{endReason:s.endReason}:{}),eventCount:s.events.length});}
export function applyEcologyMove(input:BattleState,move:Move):BattleState{
 if(input.status!=='playing')throw Error('對局已結束');if(move.side!==input.turn)throw Error('尚未輪到你');
 if(!Number.isInteger(move.cell)||move.cell<0||move.cell>8)throw Error('格位無效');
 const index=input.hands[move.side].findIndex(c=>c.id===move.cardId);if(index<0)throw Error('卡牌不在手中');
 const incoming=input.hands[move.side][index],occupied=input.board[move.cell];
 if(occupied&&(!enabled(incoming,'migration')||occupied.controller!==move.side))throw Error('只有遷徙可替換我方控制的卡牌');
 const s=structuredClone(input);s.handReveals??=[];s.turnSnapshots??=[];
 const emit=(type:string,cell:number|undefined,layer:number,detail:string,extra:Partial<BattleEvent>={})=>{const event:BattleEvent={seq:s.events.length+1,type,...(cell===undefined?{}:{cell}),side:cell===undefined?move.side:s.board[cell]?.controller,layer,detail,...extra};for(const key of Object.keys(event))if((event as any)[key]===undefined)delete (event as any)[key];s.events.push(event);};
 const closeReveals=(id:string)=>{for(const r of s.handReveals!)if(r.sourceCardId===id)r.active=false;};
 const returnCard=(cell:number,layer:number,cause:'escape'|'migration')=>{
  const c=s.board[cell]!;closeReveals(c.id);s.board[cell]=null;c.controller=c.originalOwner;s.hands[c.originalOwner].push(c);
  emit('returned',cell,layer,cause==='escape'?'逃避行為：退回原持有者手牌':'遷徙：原場上卡牌退回原持有者手牌',{side:c.originalOwner,toHand:c.originalOwner,skill:cause,card:structuredClone(c),cardId:c.id});
 };
 const [placed]=s.hands[move.side].splice(index,1);
 if(occupied)returnCard(move.cell,0,'migration');s.board[move.cell]=placed;s.moves.push({...move});
 emit('placed',move.cell,0,'放置卡牌',{card:structuredClone(placed),cardId:placed.id});
 if(enabled(placed,'predator')&&placed.spent===0){
  placed.spent=1;const viewer=placed.controller,opponent=(1-viewer) as Side;
  const cards=s.hands[opponent].map(c=>{
   if(enabled(c,'defense_mechanism')&&c.spent===0){c.spent=1;emit('hand_resisted',undefined,0,'對手一張手牌以防禦機制抵抗查看',{side:opponent,skill:'defense_mechanism'});return {id:c.id,hidden:true as const};}
   return {id:c.id,definition:structuredClone(c.definition),spent:c.spent,...(c.skillDisabled?{skillDisabled:true}:{})};
  });
  s.handReveals.push({sourceCardId:placed.id,viewer,active:true,atMove:s.moves.length,cards});
  emit('revealed',move.cell,0,'掠食者：取得當下對手手牌情報',{skill:'predator',cardId:placed.id,card:structuredClone(placed)});
 }
 const wave=(sources:number[],collective:Proposal[],layer:number):{sources:number[];collective:Proposal[]}=>{
  const snapshot=structuredClone(s),proposals=new Map<number,Proposal>();
  for(const p of collective.sort((a,b)=>a.target-b.target||a.source-b.source))if(snapshot.board[p.target]&&snapshot.board[p.target]!.controller!==p.side){proposals.set(p.target,p);emit('skill_triggered',p.target,layer,'集體行為：跟隨原同色鄰牌翻面',{from:p.source,skill:'collective'});}
  for(const source of [...new Set(sources)].sort((a,b)=>a-b)){
   const a=snapshot.board[source];if(!a)continue;
   if(layer>0)emit('skill_triggered',source,layer,`${SKILLS[a.definition.skill].name}：額外比較相鄰敵牌`,{skill:a.definition.skill});
   for(const [target,dir,opposite] of neighbors(source)){
    const b=snapshot.board[target];if(!b||a.controller===b.controller)continue;
    const av=a.definition.values[dir]+comparisonModifier(snapshot,source,true),bv=b.definition.values[opposite]+comparisonModifier(snapshot,target,false);
    const reverse=enabled(a,'antipredator')||enabled(b,'antipredator'),wins=reverse?av<bv:av>bv;
    emit('compared',target,layer,`${av} ${reverse?(av<bv?'<':'≥'):(av>bv?'>':'≤')} ${bv}`,{from:source,reverse,attackTotal:av,defenseTotal:bv,attackCard:structuredClone(a),defenseCard:structuredClone(b)});
    if(reverse&&av>bv&&!proposals.has(source))proposals.set(source,{target:source,source:target,side:b.controller,skill:'antipredator'});
    if(wins){const skill=layer>0?a.definition.skill:reverse?'antipredator':a.definition.values[dir]<=b.definition.values[opposite]&&av>a.definition.values[dir]?a.definition.skill:undefined;
     const p={target,source,side:a.controller,skill};if(!proposals.has(target))proposals.set(target,p);
    }
   }
  }
  const flips:Proposal[]=[];
  for(const p of [...proposals.values()].sort((a,b)=>a.target-b.target)){
   const c=s.board[p.target];if(!c||c.controller===p.side)continue;
   if(p.skill&&enabled(c,'defense_mechanism')&&c.spent===0){c.spent=1;emit('skill_resisted',p.target,layer,'防禦機制：抵抗一次指向本卡的技能效果',{from:p.source,skill:'defense_mechanism'});continue;}
   if((enabled(c,'mimicry')||enabled(c,'armor'))&&c.spent===0){c.spent=1;emit('resisted',p.target,layer,`${SKILLS[c.definition.skill].name}：抵抗一次翻面`,{from:p.source,skill:c.definition.skill});continue;}
   if(enabled(c,'escape')){returnCard(p.target,layer,'escape');continue;}
   flips.push(p);
  }
  for(const p of flips){const c=s.board[p.target]!;const before=c.controller;c.controller=p.side;if(SKILLS[c.definition.skill].resetOnFlip)c.spent=0;
   if(c.definition.skill==='predator'){c.skillDisabled=true;closeReveals(c.id);}
   emit('flipped',p.target,layer,'控制權轉移',{from:p.source,beforeController:before,skill:p.skill,card:structuredClone(c),cardId:c.id});
  }
  const extra:number[]=[],followers=new Map<number,Proposal>();
  for(const p of flips){const c=s.board[p.target]!;
   if(enabled(c,'defensive_aggression')||enabled(c,'ripple'))extra.push(p.target);
   for(const [neighbor] of neighbors(p.target)){
    const before=snapshot.board[neighbor],now=s.board[neighbor];if(!before||!now||!enabled(now,'collective')||flips.some(f=>f.target===neighbor))continue;
    if(before.controller===snapshot.board[p.target]!.controller&&now.controller!==p.side)followers.set(neighbor,{target:neighbor,source:p.target,side:p.side,skill:'collective'});
   }
  }
  return {sources:extra,collective:[...followers.values()]};
 };
 let queue=wave([move.cell],[],0);
 for(let layer=1;layer<=3&&(queue.sources.length||queue.collective.length);layer++)queue=wave(queue.sources,queue.collective,layer);
 if(queue.sources.length||queue.collective.length)emit('chain_capped',queue.sources[0]??queue.collective[0].target,3,'已達3層技能連鎖上限');
 const finish=(reason:BattleState['endReason'])=>{s.status='finished';s.endReason=reason;const counts=[0,0];for(const c of s.board)if(c)counts[c.controller]++;s.winner=counts[0]===counts[1]?null:counts[0]>counts[1]?0:1;emit('finished',undefined,0,reason==='turn-limit'?'達100手，以控制格數判定，可平手':reason==='no-moves'?'雙方無合法動作，以控制格數判定，可平手':'九格填滿，以控制格數判定');};
 if(s.board.every(Boolean))finish('board-full');else if(s.moves.length>=MAX_TURNS)finish('turn-limit');else{
  s.turn=(1-move.side) as Side;
  if(!ecologyLegalMoves(s).length){emit('turn_skipped',undefined,0,'沒有合法動作，自動跳過',{side:s.turn});s.turn=move.side;if(!ecologyLegalMoves(s).length)finish('no-moves');}
 }
 s.turnSnapshots.push(turnSnapshot(s));return s;
}
