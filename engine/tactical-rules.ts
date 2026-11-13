import type {BattleState,BattleCard,BattleEvent,Move,Side,SkillId,Values} from './types';
import {neighbors,SKILLS,score} from './engine';
import {turnSnapshot} from './ecology-rules';
const enabled=(c:BattleCard,skill:SkillId)=>c.definition.skill===skill&&!c.skillDisabled;
const clamp=(n:number)=>Math.max(1,Math.min(10,n));
export function initialPlants(first:Side):(BattleCard|null)[]{
 const board:(BattleCard|null)[]=Array(9).fill(null),side=(1-first) as Side;
 for(const [i,cell] of [0,8].entries())board[cell]={id:`obstacle:${i}`,definition:{speciesId:'plant-obstacle',version:'obstacle-1',values:i?[4,3,4,3]:[3,4,3,4],skill:'neutral',seed:i},controller:side,originalOwner:side,spent:0,obstacle:true};return board;
}
export function tacticalModifier(s:BattleState,cell:number,attacking:boolean):number{
 const c=s.board[cell];if(!c||c.skillDisabled)return 0;
 const friendly=neighbors(cell).filter(([i])=>s.board[i]?.controller===c.controller).length,enemy=neighbors(cell).filter(([i])=>s.board[i]&&s.board[i]!.controller!==c.controller).length;
 switch(c.definition.skill){case 'rally':return friendly;case 'surrounded':return enemy>=2?2:0;case 'cooperate':return Math.min(2,friendly);case 'ambush':return attacking&&[0,2,6,8].includes(cell)?2:0;case 'camouflage':return attacking?0:1;default:return 0;}
}
export function tacticalValue(s:BattleState,cell:number,dir:number,attacking:boolean):number{const c=s.board[cell]!;return clamp(c.definition.values[dir]+(c.modifiers?.[dir]||0)+tacticalModifier(s,cell,attacking));}
export function canTacticalPlace(s:BattleState,card:BattleCard,cell:number):boolean{
 const target=s.board[cell];return !target||enabled(card,'migration')&&target.controller===card.controller||enabled(card,'overrun')&&target.controller!==card.controller;
}
export function swapTargets(s:BattleState,cell:number,side:Side):number[]{return neighbors(cell).filter(([i])=>s.board[i]&&s.board[i]!.controller!==side).map(([i])=>i);}
export function tacticalLegalMoves(s:BattleState):Move[]{
 if(s.status!=='playing')return [];
 return s.hands[s.turn].flatMap(c=>s.board.flatMap((_,cell)=>canTacticalPlace(s,c,cell)?[{side:s.turn,cardId:c.id,cell},...(enabled(c,'swap')?swapTargets(s,cell,s.turn).map(swapCell=>({side:s.turn,cardId:c.id,cell,swapCell})):[])]:[]));
}
interface Attack {cell:number;skill?:SkillId}
interface Proposal {target:number;source:number;side:Side;skill?:SkillId}
export function applyTacticalMove(input:BattleState,move:Move):BattleState{
 if(input.status!=='playing')throw Error('對局已結束');if(move.side!==input.turn)throw Error('尚未輪到你');
 if(!Number.isInteger(move.cell)||move.cell<0||move.cell>8)throw Error('格位無效');
 const index=input.hands[move.side].findIndex(c=>c.id===move.cardId);if(index<0)throw Error('卡牌不在手中');
 const incoming=input.hands[move.side][index];if(!canTacticalPlace(input,incoming,move.cell))throw Error('此技能不能放置在該格');
 if(move.swapCell!==undefined&&(!Number.isInteger(move.swapCell)||!enabled(incoming,'swap')||!swapTargets(input,move.cell,move.side).includes(move.swapCell)))throw Error('換位目標必須是四鄰敵牌');
 const s=structuredClone(input);s.handReveals??=[];s.turnSnapshots??=[];s.moves.push({...move});
 const emit=(type:string,cell:number|undefined,layer:number,detail:string,extra:Partial<BattleEvent>={})=>{const e:BattleEvent={seq:s.events.length+1,type,...(cell===undefined?{}:{cell}),side:cell===undefined?move.side:s.board[cell]?.controller,layer,detail,...extra};for(const k of Object.keys(e))if((e as any)[k]===undefined)delete (e as any)[k];s.events.push(e);};
 const close=(id:string)=>{for(const r of s.handReveals!)if(r.sourceCardId===id)r.active=false;};
 const resist=(cell:number,source:number,layer:number)=>{const c=s.board[cell]!;if(enabled(c,'defense_mechanism')&&c.spent===0&&cell!==source){c.spent=1;emit('skill_resisted',cell,layer,'技能護盾：抵抗一次技能效果',{from:source,skill:'defense_mechanism',card:structuredClone(c)});return true;}return false;};
 const remove=(cell:number,layer:number,source?:number)=>{const c=s.board[cell]!;s.board[cell]=null;emit('removed',cell,layer,'植物障礙被擊破，騰出空格',{from:source,cardId:c.id,card:structuredClone(c)});};
 const returnCard=(cell:number,layer:number,cause:'escape'|'migration'|'overrun')=>{
  const c=s.board[cell]!;if(c.obstacle){remove(cell,layer);return;}
  close(c.id);s.board[cell]=null;const recipient=cause==='overrun'?c.controller:c.originalOwner;c.controller=recipient;s.hands[recipient].push(c);
  emit('returned',cell,layer,`${SKILLS[cause].name}：退回${cause==='overrun'?'當前顏色玩家':'原持有者'}手牌`,{side:recipient,toHand:recipient,skill:cause,card:structuredClone(c),cardId:c.id});
 };
 const occupied=s.board[move.cell];let blocked=false,placedCell=move.cell;
 if(occupied&&enabled(incoming,'overrun')&&resist(move.cell,-1,0)){blocked=true;emit('placement_blocked',move.cell,0,'強制換防被技能護盾抵抗；本回合已使用，出牌留在手中',{skill:'overrun'});}
 if(!blocked){
  if(occupied)returnCard(move.cell,0,enabled(incoming,'migration')?'migration':'overrun');
  const [placed]=s.hands[move.side].splice(index,1);s.board[move.cell]=placed;
  emit('placed',move.cell,0,'放置卡牌',{card:structuredClone(placed),cardId:placed.id});
  if(move.swapCell!==undefined){
   const target=move.swapCell;
   if(!resist(target,move.cell,0)){const enemy=s.board[target]!;s.board[target]=placed;s.board[move.cell]=enemy;placedCell=target;emit('swapped',target,0,'換位突襲：與相鄰敵牌互換位置',{from:move.cell,skill:'swap',card:structuredClone(placed),otherCard:structuredClone(enemy)});}
  }
  if(enabled(placed,'predator')&&placed.spent===0){placed.spent=1;const opponent=(1-placed.controller) as Side;
   const cards=s.hands[opponent].map(c=>({id:c.id,definition:structuredClone(c.definition),spent:c.spent,...(c.skillDisabled?{skillDisabled:true}:{}),...(c.modifiers?{modifiers:structuredClone(c.modifiers)}:{})}));
   s.handReveals.push({sourceCardId:placed.id,viewer:placed.controller,active:true,atMove:s.moves.length,cards});emit('revealed',placedCell,0,'情報偵察：查看當下對手所有手牌',{skill:'predator',cardId:placed.id,card:structuredClone(placed)});
  }
  if(enabled(placed,'weaken')||enabled(placed,'inspire')){
   const skill=placed.definition.skill,delta=skill==='weaken'?-2:1;
   for(let cell=0;cell<9;cell++){const c=s.board[cell];if(!c||skill==='inspire'&&(c.id===placed.id||c.controller!==placed.controller))continue;
    if(delta<0&&resist(cell,placedCell,0))continue;
    c.modifiers=c.definition.values.map((base,dir)=>clamp(base+(c.modifiers?.[dir]||0)+delta)-base) as Values;
    emit('values_changed',cell,0,`${SKILLS[skill].name}：四向 ${delta>0?'+':''}${delta}，有效值維持1–10`,{from:placedCell,skill,cardId:c.id,card:structuredClone(c)});
   }
  }
  const wave=(attacks:Attack[],collective:Proposal[],layer:number):{attacks:Attack[];collective:Proposal[]}=>{
   const snap=structuredClone(s),proposals=new Map<number,Proposal>();
   for(const p of collective.sort((a,b)=>a.target-b.target||a.source-b.source))if(snap.board[p.target]&&snap.board[p.target]!.controller!==p.side){proposals.set(p.target,p);emit('skill_triggered',p.target,layer,'連鎖倒戈：跟隨原同色鄰牌翻面',{from:p.source,skill:'collective'});}
   const unique=new Map<number,Attack>();for(const a of attacks)if(!unique.has(a.cell))unique.set(a.cell,a);
   for(const attack of [...unique.values()].sort((a,b)=>a.cell-b.cell)){
    const source=attack.cell,a=snap.board[source];if(!a||a.obstacle)continue;
    if(layer>0)emit('skill_triggered',source,layer,`${SKILLS[attack.skill||a.definition.skill].name}：額外攻擊`,{skill:attack.skill||a.definition.skill});
    for(const [near,dir,opposite] of neighbors(source)){
     let target=near,ranged=false;
     if(!snap.board[near]&&enabled(a,'pierce')){const next=neighbors(near).find(([,d])=>d===dir);if(next){target=next[0];ranged=true;}}
     const b=snap.board[target];if(!b||a.controller===b.controller)continue;
     const av=tacticalValue(snap,source,dir,true),bv=tacticalValue(snap,target,opposite,false),reverse=enabled(a,'antipredator')||enabled(b,'antipredator');
     emit('compared',target,layer,`${av} ${reverse?(av<bv?'<':'≥'):(av>bv?'>':'≤')} ${bv}`,{from:source,direction:dir,opposite,reverse,attackTotal:av,defenseTotal:bv,attackCard:structuredClone(a),defenseCard:structuredClone(b)});
     if(reverse&&av>bv&&!proposals.has(source))proposals.set(source,{target:source,source:target,side:b.controller,skill:'antipredator'});
     if(reverse?av<bv:av>bv){const coreA=clamp(a.definition.values[dir]+(a.modifiers?.[dir]||0)),coreB=clamp(b.definition.values[opposite]+(b.modifiers?.[opposite]||0));
      const skill=attack.skill||(ranged?'pierce':reverse?'antipredator':coreA<=coreB?a.definition.skill:undefined);if(!proposals.has(target))proposals.set(target,{target,source,side:a.controller,skill});
     }
    }
   }
   const flips:Proposal[]=[];
   for(const p of [...proposals.values()].sort((a,b)=>a.target-b.target)){
    const c=s.board[p.target];if(!c||c.controller===p.side)continue;
    if(p.skill&&resist(p.target,p.source,layer))continue;
    if((enabled(c,'mimicry')||enabled(c,'armor'))&&c.spent===0){c.spent=1;emit('resisted',p.target,layer,'翻面護盾：抵抗一次翻面',{from:p.source,skill:c.definition.skill,card:structuredClone(c)});continue;}
    if(c.obstacle){remove(p.target,layer,p.source);continue;}
    if(enabled(c,'escape')){returnCard(p.target,layer,'escape');continue;}
    flips.push(p);
   }
   for(const p of flips){const c=s.board[p.target]!;const before=c.controller;c.controller=p.side;if(c.definition.skill==='predator'){c.skillDisabled=true;close(c.id);}
    emit('flipped',p.target,layer,'控制權轉移',{from:p.source,beforeController:before,skill:p.skill,cardId:c.id,card:structuredClone(c)});
   }
   const extra:Attack[]=[],followers=new Map<number,Proposal>();
   for(const p of flips){const c=s.board[p.target]!;
    if(enabled(c,'defensive_aggression')||enabled(c,'ripple'))extra.push({cell:p.target,skill:c.definition.skill});
    const attacker=snap.board[p.source];if(attacker&&enabled(attacker,'cascade'))extra.push({cell:p.target,skill:'cascade'});
    for(const [neighbor] of neighbors(p.target)){
     const before=snap.board[neighbor],now=s.board[neighbor];if(!before||!now||flips.some(f=>f.target===neighbor))continue;
     if(before.controller!==snap.board[p.target]!.controller)continue;
     if(enabled(now,'collective')&&now.controller!==p.side)followers.set(neighbor,{target:neighbor,source:p.target,side:p.side,skill:'collective'});
     if(enabled(now,'vengeance')&&now.controller===before.controller)extra.push({cell:neighbor,skill:'vengeance'});
    }
   }
   return {attacks:extra,collective:[...followers.values()]};
  };
  let queue=wave([{cell:placedCell}],[],0);
  for(let layer=1;layer<=3&&(queue.attacks.length||queue.collective.length);layer++)queue=wave(queue.attacks,queue.collective,layer);
  if(queue.attacks.length||queue.collective.length)emit('chain_capped',queue.attacks[0]?.cell??queue.collective[0].target,3,'已達3層技能連鎖上限');
 }
 const finish=(reason:BattleState['endReason'])=>{s.status='finished';s.endReason=reason;const counts=score(s);s.winner=counts[0]===counts[1]?null:counts[0]>counts[1]?0:1;emit('finished',undefined,0,reason==='turn-limit'?'達100手，以控制格數判定，可平手':reason==='no-moves'?'雙方無合法動作，以控制格數判定，可平手':'九格填滿，以控制格數判定');};
 if(s.board.every(Boolean))finish('board-full');else if(s.moves.length>=100)finish('turn-limit');else{s.turn=(1-move.side) as Side;if(!tacticalLegalMoves(s).length){emit('turn_skipped',undefined,0,'沒有合法動作，自動跳過',{side:s.turn});s.turn=move.side;if(!tacticalLegalMoves(s).length)finish('no-moves');}}
 s.turnSnapshots.push(turnSnapshot(s));return s;
}
