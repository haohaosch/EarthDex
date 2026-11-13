import {tacticalValue} from '../engine/tactical-rules';
import {applyMove,comparisonModifier,SKILLS} from '../engine/engine';
import {comparisonOperands,explainComparison,type ComparisonOperand} from '../engine/comparison-details';
import type {BattleState,BattleCard,Side,SkillId} from '../engine/types';
export type Phase='idle'|'place'|'compare'|'resist'|'flip-out'|'flip-in'|'settle'|'return'|'skill'|'remove'|'swap';
export interface DirectionValue {base:number;total:number;bonus:number;skill:SkillId;role:'attack'|'defense';recorded:boolean}
export interface BattleFrame {
 state:BattleState;phase:Phase;duration:number;placed?:number;side?:Side;layer:number;
 effects:Record<number,Record<number,DirectionValue>>;flips:number[];resisted:number[];comparisons:string[];returned?:number[];notices?:string[];triggered?:number[];reversed?:boolean;removed?:number[];swapped?:number[];
}
export interface Presentation {key:string;state:BattleState|null;frame:BattleFrame|null;animating:boolean}
const fresh=(state:BattleState,phase:Phase,duration:number,placed?:number,side?:Side):BattleFrame=>({state,phase,duration,placed,side,layer:0,effects:{},flips:[],resisted:[],comparisons:[]});
export function boardDirectionValues(state:BattleState,cell:number,effects:BattleFrame['effects']={}):DirectionValue[]{
 const card=state.board[cell];if(!card)return [];
 const bonus=comparisonModifier(state,cell,false);
 return card.definition.values.map((base,direction)=>effects[cell]?.[direction]||{base,total:state.ruleVersion==='tactics-0.3'?tacticalValue(state,cell,direction,false):base+bonus,bonus:state.ruleVersion==='tactics-0.3'?tacticalValue(state,cell,direction,false)-base:bonus,skill:card.definition.skill,role:'defense',recorded:false});
}
export function handDirectionValues(card:Pick<BattleCard,'definition'|'modifiers'>):DirectionValue[]{return card.definition.values.map((base,i)=>{const total=Math.max(1,Math.min(10,base+(card.modifiers?.[i]||0)));return {base,total,bonus:total-base,skill:card.definition.skill,role:'defense',recorded:false};});}
function addOperand(effects:BattleFrame['effects'],o:ComparisonOperand){
 (effects[o.cell]??={})[o.direction]={base:o.base,total:o.total,bonus:o.bonus,skill:o.skill,role:o.role,recorded:true};
}
/** Visual frames use authoritative moves/events. Ordinary and skill flips remain simultaneous per wave. */
export function moveFrames(before:BattleState,after:BattleState):BattleFrame[]{
 const move=after.moves.at(-1)!;const newEvents=after.events.slice(before.events.length),frames:BattleFrame[]=[];
 let visual=structuredClone(before);const placedEvent=newEvents.find(e=>e.type==='placed');
 const applyReturn=(event:typeof newEvents[number])=>{const c=event.card||visual.board[event.cell!]!;visual.board[event.cell!]=null;visual.hands[event.toHand??c.originalOwner].push(structuredClone(c));visual.events.push(event);};
 if(!placedEvent&&after.ruleVersion==='tactics-0.3')return [{...fresh(after,'resist',650,move.cell,move.side),resisted:newEvents.filter(e=>e.type==='skill_resisted').map(e=>e.cell!),notices:newEvents.map(e=>e.detail)},fresh(after,'settle',160)];
 const migration=newEvents.filter(e=>e.type==='returned'&&e.seq<(placedEvent?.seq||0));
 if(migration.length){frames.push({...fresh(structuredClone(visual),'return',350,move.cell,move.side),returned:migration.map(e=>e.cell!),notices:migration.map(e=>e.detail)});for(const e of migration)applyReturn(e);}
 const earlyRemoved=newEvents.filter(e=>e.type==='removed'&&e.seq<(placedEvent?.seq||0));if(earlyRemoved.length){frames.push({...fresh(structuredClone(visual),'remove',350),removed:earlyRemoved.map(e=>e.cell!),notices:earlyRemoved.map(e=>e.detail)});for(const e of earlyRemoved){visual.board[e.cell!]=null;visual.events.push(e);}}
 const index=visual.hands[move.side].findIndex(c=>c.id===move.cardId);if(index<0)throw Error('動畫起點缺少手牌');
 const [fromHand]=visual.hands[move.side].splice(index,1),placed=placedEvent?.card||fromHand;visual.board[move.cell]=structuredClone(placed);visual.moves.push(move);
 visual.events.push(...newEvents.filter(e=>e.type==='placed'));
 frames.push(fresh(structuredClone(visual),'place',300,move.cell,move.side));
 for(const e of newEvents.filter(e=>e.type==='swapped')){visual.board[e.cell!]=structuredClone(e.card!);visual.board[e.from!]=structuredClone(e.otherCard!);visual.events.push(e);frames.push({...fresh(structuredClone(visual),'swap',500,move.cell,move.side),swapped:[e.cell!,e.from!],notices:[e.detail]});}
 const changes=newEvents.filter(e=>e.type==='values_changed');if(changes.length){for(const e of changes){visual.board[e.cell!]=structuredClone(e.card!);visual.events.push(e);}frames.push({...fresh(structuredClone(visual),'skill',650,move.cell,move.side),triggered:changes.map(e=>e.cell!),notices:changes.map(e=>e.detail)});}
 const reveals=newEvents.filter(e=>e.type==='revealed'||e.type==='hand_resisted');
 if(reveals.length){for(const e of reveals){if(e.card&&e.cell!==undefined)visual.board[e.cell]=structuredClone(e.card);visual.events.push(e);}frames.push({...fresh(structuredClone(visual),'skill',500,move.cell,move.side),notices:reveals.map(e=>e.detail),triggered:reveals.filter(e=>e.cell!==undefined).map(e=>e.cell!)});}
 for(const layer of [0,1,2,3]){
  const events=newEvents.filter(e=>e.layer===layer&&e.seq>(placedEvent?.seq||0)),compared=events.filter(e=>e.type==='compared'),triggered=events.filter(e=>e.type==='skill_triggered');
  const effects:BattleFrame['effects']={};for(const event of compared){const operands=comparisonOperands(after,event);if(operands){addOperand(effects,operands.attack);addOperand(effects,operands.defense);}}
  const comparisons=compared.map(e=>explainComparison(after,e)?.text||e.detail);
  const context={placed:move.cell,side:move.side,layer,effects,comparisons,notices:[...triggered.map(e=>e.detail),...(compared.some(e=>e.reverse)?['逆轉比較：本次改用較小點數勝出']:[])],triggered:triggered.map(e=>e.cell!),reversed:compared.some(e=>e.reverse)};
  if(triggered.length){visual.events.push(...triggered);frames.push({...fresh(structuredClone(visual),'skill',450),...context});}
  if(compared.length){visual.events.push(...compared);const hasBonus=Object.values(effects).some(d=>Object.values(d).some(v=>v.bonus>0));frames.push({...fresh(structuredClone(visual),'compare',hasBonus||compared.some(e=>e.reverse)?700:380),...context});}
  const resisted=events.filter(e=>e.type==='resisted'||e.type==='skill_resisted');
  if(resisted.length){for(const e of resisted)if(visual.board[e.cell!]){if(e.card)visual.board[e.cell!]=structuredClone(e.card);else visual.board[e.cell!]!.spent++;}visual.events.push(...resisted);
   context.comparisons=compared.map(e=>(explainComparison(after,e)?.text||e.detail)+(resisted.some(r=>r.cell===e.cell&&r.from===e.from||e.reverse&&r.cell===e.from&&r.from===e.cell)?' 抵抗生效，本次未翻面。':''));
   frames.push({...fresh(structuredClone(visual),'resist',500),...context,resisted:resisted.map(e=>e.cell!),notices:resisted.map(e=>e.detail)});
  }
  const returns=events.filter(e=>e.type==='returned'&&e.skill==='escape');
  if(returns.length){frames.push({...fresh(structuredClone(visual),'return',400),...context,returned:returns.map(e=>e.cell!),notices:returns.map(e=>e.detail)});for(const e of returns)applyReturn(e);}
  const removed=events.filter(e=>e.type==='removed');if(removed.length){frames.push({...fresh(structuredClone(visual),'remove',400),...context,removed:removed.map(e=>e.cell!),notices:removed.map(e=>e.detail)});for(const e of removed){visual.board[e.cell!]=null;visual.events.push(e);}}
  const flips=events.filter(e=>e.type==='flipped');
  if(flips.length){frames.push({...fresh(structuredClone(visual),'flip-out',160),...context,flips:flips.map(e=>e.cell!)});
   for(const e of flips){const card=visual.board[e.cell!]!;if(e.card)visual.board[e.cell!]=structuredClone(e.card);else{card.controller=e.side!;if(SKILLS[card.definition.skill].resetOnFlip)card.spent=0;}}
   visual.events.push(...flips);frames.push({...fresh(structuredClone(visual),'flip-in',260),...context,flips:flips.map(e=>e.cell!)});
  }
 }
 const last=frames.at(-1)!;frames.push({...fresh(after,'settle',160,move.cell,move.side),comparisons:last.comparisons,layer:last.layer,notices:last.notices});return frames;
}
function sameMoves(a:BattleState,b:BattleState){return a.moves.every((m,i)=>{const n=b.moves[i];return !!n&&m.side===n.side&&m.cardId===n.cardId&&m.cell===n.cell&&m.swapCell===n.swapCell;});}
export function transitionFrames(before:BattleState,after:BattleState):BattleFrame[]{
 if(!sameMoves(before,after)||after.moves.length-before.moves.length>6)return [];
 const frames:BattleFrame[]=[];let current=before;
 try{
  if((after.ruleVersion==='ecology-0.2'||after.ruleVersion==='tactics-0.3')&&after.turnSnapshots){
   for(let n=before.moves.length+1;n<=after.moves.length;n++){
    const snap=after.turnSnapshots.find(t=>t.moveNumber===n);if(!snap)return [];
    const {moveNumber,eventCount,...fields}=snap;
    const next:BattleState={...after,...structuredClone(fields),moves:after.moves.slice(0,n),events:after.events.slice(0,eventCount),turnSnapshots:after.turnSnapshots.filter(t=>t.moveNumber<=n)};
    frames.push(...moveFrames(current,next));current=next;
   }
  }else{
   // Old battles have no snapshot journal. Restore only already-public played cards for animation.
   current=structuredClone(before);
   for(const move of after.moves.slice(before.moves.length)){const hand=current.hands[move.side].find(c=>c.id===move.cardId);if(hand?.hidden){const known=after.board.find(c=>c?.id===move.cardId);if(!known)return [];hand.definition=structuredClone(known.definition);delete hand.hidden;}
    const next=applyMove(current,move);frames.push(...moveFrames(current,next));current=next;
   }
  }
 }catch{return [];}
 if(JSON.stringify(current)!==JSON.stringify(after))return [];
 return frames;
}
/** Queue both local+AI turns and PVP polling updates; reconnects do not replay old turns. */
export class BattlePresenter {
 private key='';private settled:BattleState|null=null;private target:BattleState|null=null;
 private active=false;private timer:unknown=null;private disposed=false;
 constructor(private emit:(view:Presentation)=>void,private schedule:(fn:()=>void,ms:number)=>unknown=(fn,ms)=>setTimeout(fn,ms),private cancel:(timer:unknown)=>void=timer=>clearTimeout(timer as ReturnType<typeof setTimeout>)){}
 private stop(){if(this.timer!==null)this.cancel(this.timer);this.timer=null;this.active=false;}
 private reset(key:string,state:BattleState|null){this.stop();this.key=key;this.settled=state;this.target=state;this.emit({key,state,frame:null,animating:false});}
 update(key:string,state:BattleState|null,reducedMotion=false){
  if(this.disposed)return;
  if(key!==this.key||!state||!this.settled||!this.target){this.reset(key,state);return;}
  if(state.moves.length<this.target.moves.length)return;
  if(reducedMotion||!sameMoves(this.settled,state)){this.reset(key,state);return;}
  this.target=state;if(!this.active)this.pump();
 }
 private pump(){
  const target=this.target,settled=this.settled;if(!target||!settled||this.disposed)return;
  const frames=transitionFrames(settled,target);
  if(!frames.length){this.reset(this.key,target);return;}
  this.active=true;let index=0;
  const next=()=>{
   this.timer=null;
   if(this.disposed)return;
   const frame=frames[index++];
   if(!frame){this.settled=target;this.active=false;
    if(this.target!==target){this.pump();return;}
    this.emit({key:this.key,state:target,frame:{...frames.at(-1)!,phase:'idle',duration:0},animating:false});return;
   }
   this.emit({key:this.key,state:frame.state,frame,animating:true});this.timer=this.schedule(next,frame.duration);
  };next();
 }
 dispose(){this.disposed=true;this.stop();}
}
