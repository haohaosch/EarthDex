import {applyMove,comparisonModifier,SKILLS} from '../engine/engine';
import {comparisonOperands,explainComparison,type ComparisonOperand} from '../engine/comparison-details';
import type {BattleState,Side,SkillId} from '../engine/types';
export type Phase='idle'|'place'|'compare'|'resist'|'flip-out'|'flip-in'|'settle';
export interface DirectionValue {base:number;total:number;bonus:number;skill:SkillId;role:'attack'|'defense';recorded:boolean}
export interface BattleFrame {
 state:BattleState;phase:Phase;duration:number;placed?:number;side?:Side;layer:number;
 effects:Record<number,Record<number,DirectionValue>>;flips:number[];resisted:number[];comparisons:string[];
}
export interface Presentation {key:string;state:BattleState|null;frame:BattleFrame|null;animating:boolean}
const fresh=(state:BattleState,phase:Phase,duration:number,placed?:number,side?:Side):BattleFrame=>({state,phase,duration,placed,side,layer:0,effects:{},flips:[],resisted:[],comparisons:[]});
export function boardDirectionValues(state:BattleState,cell:number,effects:BattleFrame['effects']={}):DirectionValue[]{
 const card=state.board[cell];if(!card)return [];
 const bonus=comparisonModifier(state,cell,false);
 return card.definition.values.map((base,direction)=>effects[cell]?.[direction]||{base,total:base+bonus,bonus,skill:card.definition.skill,role:'defense',recorded:false});
}
function addOperand(effects:BattleFrame['effects'],o:ComparisonOperand){
 (effects[o.cell]??={})[o.direction]={base:o.base,total:o.total,bonus:o.bonus,skill:o.skill,role:o.role,recorded:true};
}
/** Visual frames use authoritative moves/events. Ordinary and skill flips remain simultaneous per wave. */
export function moveFrames(before:BattleState,after:BattleState):BattleFrame[]{
 const move=after.moves.at(-1)!;const newEvents=after.events.slice(before.events.length),frames:BattleFrame[]=[];
 let visual=structuredClone(before);
 const index=visual.hands[move.side].findIndex(c=>c.id===move.cardId);
 if(index<0)throw Error('動畫起點缺少手牌');
 const [placed]=visual.hands[move.side].splice(index,1);visual.board[move.cell]=placed;visual.moves.push(move);
 visual.events.push(...newEvents.filter(e=>e.type==='placed'));
 frames.push(fresh(structuredClone(visual),'place',300,move.cell,move.side));
 for(const layer of [0,1,2,3]){
  const events=newEvents.filter(e=>e.layer===layer&&e.type!=='placed'),compared=events.filter(e=>e.type==='compared');
  if(!compared.length)continue;
  const effects:BattleFrame['effects']={};
  for(const event of compared){const operands=comparisonOperands(after,event);if(operands){addOperand(effects,operands.attack);addOperand(effects,operands.defense);}}
  const comparisons=compared.map(e=>explainComparison(after,e)?.text||e.detail);
  visual.events.push(...compared);
  const context={placed:move.cell,side:move.side,layer,effects,comparisons};
  const hasBonus=Object.values(effects).some(d=>Object.values(d).some(v=>v.bonus>0));
  frames.push({...fresh(structuredClone(visual),'compare',hasBonus?700:380),...context});
  const resisted=events.filter(e=>e.type==='resisted');
  if(resisted.length){
   for(const e of resisted)visual.board[e.cell!]!.spent++;
   visual.events.push(...resisted);
   context.comparisons=compared.map(e=>(explainComparison(after,e)?.text||e.detail)+(resisted.some(r=>r.cell===e.cell)?' 堅甲抵抗，本次未翻面。':''));
   frames.push({...fresh(structuredClone(visual),'resist',500),...context,resisted:resisted.map(e=>e.cell!)});
  }
  const flips=events.filter(e=>e.type==='flipped');
  if(flips.length){
   frames.push({...fresh(structuredClone(visual),'flip-out',160),...context,flips:flips.map(e=>e.cell!)});
   for(const e of flips){const card=visual.board[e.cell!]!;card.controller=e.side!;if(SKILLS[card.definition.skill].resetOnFlip)card.spent=0;}
   visual.events.push(...flips);
   frames.push({...fresh(structuredClone(visual),'flip-in',260),...context,flips:flips.map(e=>e.cell!)});
  }
 }
 const last=frames.at(-1)!;
 frames.push({...fresh(after,'settle',160,move.cell,move.side),comparisons:last.comparisons,layer:last.layer});
 return frames;
}
function sameMoves(a:BattleState,b:BattleState){return a.moves.every((m,i)=>{const n=b.moves[i];return !!n&&m.side===n.side&&m.cardId===n.cardId&&m.cell===n.cell;});}
export function transitionFrames(before:BattleState,after:BattleState):BattleFrame[]{
 if(!sameMoves(before,after))return [];
 const frames:BattleFrame[]=[];let current=before;
 try{for(const move of after.moves.slice(before.moves.length)){const next=applyMove(current,move);frames.push(...moveFrames(current,next));current=next;}}
 catch{return [];}
 // A correction, resignation or unsupported snapshot must never be animated as a guessed result.
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
