import type { BattleState, BattleCard, CardDefinition, Move, Side, SkillId, Values } from './types';
export const RULE_VERSION = 'experimental-0.1';
export const SKILLS: Record<SkillId,{name:string; description:string; cost:number; tag?:string; priority:number; stackCap:number; resetOnFlip:boolean; trigger:string; limit:number}> = {
 neutral:{name:'適應',description:'穩定的基礎能力，沒有額外觸發效果。',cost:0,priority:0,stackCap:0,resetOnFlip:false,trigger:'none',limit:0},
 armor:{name:'堅甲',description:'每局抵抗第一次原本成功的翻轉；翻面後不恢復次數。',cost:6,tag:'ARMOR',priority:10,stackCap:1,resetOnFlip:false,trigger:'BeforeFlip',limit:1},
 cooperate:{name:'群聚',description:'比較時，每張相鄰友軍使方向值 +1，最多 +2。',cost:4,tag:'SOCIAL',priority:20,stackCap:2,resetOnFlip:false,trigger:'Compare',limit:99},
 ambush:{name:'伏擊',description:'放在角落時，該次基本攻方比較值 +2。',cost:4,tag:'AMBUSH',priority:20,stackCap:2,resetOnFlip:false,trigger:'CompareAttack',limit:99},
 camouflage:{name:'隱蔽',description:'作為防守方時，該方向比較值 +1。',cost:3,tag:'CAMOUFLAGE',priority:20,stackCap:1,resetOnFlip:false,trigger:'CompareDefense',limit:99},
 ripple:{name:'漣漪',description:'被翻轉後，為新陣營再比較相鄰敵牌。每次放牌最多 3 波。',cost:6,tag:'DEMO_CHAIN',priority:30,stackCap:1,resetOnFlip:false,trigger:'OnFlipped',limit:99}
};
export function hash(s:string):number { let h=2166136261; for(const c of s) {h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }
export function rng(seed:number) { let a=seed>>>0; return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; }
const directionalOptions=new Map<number,Values[]>();
export function randomDirections(budget:number,random:()=>number):Values {
 let options=directionalOptions.get(budget);
 if(!options){options=[];for(let up=1;up<=10;up++)for(let right=1;right<=10;right++)for(let down=1;down<=10;down++){const left=budget-up-right-down;if(left>=1&&left<=10&&Math.max(up,right,down,left)-Math.min(up,right,down,left)>=3)options.push([up,right,down,left]);}directionalOptions.set(budget,options);}
 if(!options.length)throw Error('點數預算無法產生有效方向組合');
 return [...options[Math.min(options.length-1,Math.floor(random()*options.length))]] as Values;
}
export function redistributeDirections(card:CardDefinition,seed:number):CardDefinition{return {...card,version:'capture-0.3',seed,values:randomDirections(28-SKILLS[card.skill].cost,rng(seed))};}
export function generateCard(speciesId:string,tags:string[]=[],version=RULE_VERSION,instanceSeed?:number):CardDefinition {
 const seed=instanceSeed===undefined?hash(`${speciesId}:${version}:traits-1`):instanceSeed>>>0,random=rng(seed);
 const eligible=(Object.keys(SKILLS) as SkillId[]).filter(k=>SKILLS[k].tag&&tags.includes(SKILLS[k].tag!)).sort();
 const pool=instanceSeed===undefined?eligible:[...eligible,'neutral' as SkillId].sort();
 const skill=pool.length?pool[Math.floor(random()*pool.length)]:'neutral';
 const budget=28-SKILLS[skill].cost;
 const values:Values=[1,1,1,1];
 if(version==='capture-0.3'||version==='fixture-0.3'){values.splice(0,4,...randomDirections(budget,random));}
 else if(!pool.length&&instanceSeed===undefined) {values.fill(budget/4);} else for(let n=4;n<budget;n++){const available=[0,1,2,3].filter(i=>values[i]<10);values[available[Math.floor(random()*available.length)]]++;}
 return {speciesId,version,values,skill,seed};
}
export function validateDeck(cards:{speciesId:string;id?:string}[]):string[] {
 const errors:string[]=[];
 if(cards.length!==5) errors.push('每副牌組必須有 5 張卡牌');
 const counts:Record<string,number>={};for(const c of cards) counts[c.speciesId]=(counts[c.speciesId]||0)+1;
 if(Object.values(counts).some(n=>n>2))errors.push('同一物種最多 2 張');
 if(new Set(cards.map(c=>c.speciesId)).size<3)errors.push('至少需要 3 種不同物種');
 const ids=cards.map(c=>c.id).filter(Boolean);if(new Set(ids).size!==ids.length)errors.push('同一卡牌實例不能重複使用');
 return errors;
}
export function createBattle(decks:[{id:string;definition:CardDefinition}[],{id:string;definition:CardDefinition}[]],seed=1,first:Side=(hash(String(seed))%2) as Side):BattleState {
 for(const deck of decks){const e=validateDeck(deck.map(c=>({id:c.id,speciesId:c.definition.speciesId})));if(e.length)throw Error(e.join('；'));}
 for(const {definition:d} of decks.flat())if(!d||d.values.length!==4||!d.values.every(n=>Number.isInteger(n)&&n>=1&&n<=10)||!SKILLS[d.skill])throw Error('卡牌定義無效');
 const versions=new Set(decks.flat().map(c=>c.definition.version));if([...versions].some(v=>v.startsWith('official-'))&&versions.size!==1)throw Error('對戰卡牌平衡版本必須一致');
 if(new Set(decks.flat().map(c=>c.id)).size!==10)throw Error('對局卡牌 ID 必須唯一');
 return {ruleVersion:RULE_VERSION,...(versions.size===1?{balanceVersion:[...versions][0]}:{}),seed,first,turn:first,board:Array(9).fill(null),hands:decks.map((d,i)=>d.map(c=>({...structuredClone(c),originalOwner:i as Side,controller:i as Side,spent:0}))) as [BattleCard[],BattleCard[]],events:[],moves:[],status:'playing',winner:null};
}
export function neighbors(cell:number):[number,number,number][] {
 const a:[number,number,number][]=[];if(cell>=3)a.push([cell-3,0,2]);if(cell%3<2)a.push([cell+1,1,3]);if(cell<6)a.push([cell+3,2,0]);if(cell%3>0)a.push([cell-1,3,1]);return a;
}
export function comparisonModifier(s:BattleState,cell:number,attacking:boolean):number {
 const c=s.board[cell]!;switch(c.definition.skill){case 'cooperate': return Math.min(SKILLS.cooperate.stackCap,neighbors(cell).filter(([i])=>s.board[i]?.controller===c.controller).length);case 'ambush': return attacking&&[0,2,6,8].includes(cell)?SKILLS.ambush.stackCap:0;case 'camouflage':return attacking?0:SKILLS.camouflage.stackCap;default:return 0;}
}
export function applyMove(input:BattleState,move:Move):BattleState {
 if(input.ruleVersion!==RULE_VERSION)throw Error('不支援的戰鬥規則版本');
 if(input.status!=='playing')throw Error('對局已結束');
 if(move.side!==input.turn)throw Error('尚未輪到你');
 if(!Number.isInteger(move.cell)||move.cell<0||move.cell>8||input.board[move.cell])throw Error('請選擇未佔據的格子');
 const hand=input.hands[move.side],index=hand.findIndex(c=>c.id===move.cardId);if(index<0)throw Error('卡牌不在手中');
 const s=structuredClone(input);const [placed]=s.hands[move.side].splice(index,1);s.board[move.cell]=placed;s.moves.push({...move});
 const event=(type:string,cell:number,layer:number,detail:string,from?:number)=>s.events.push({seq:s.events.length+1,type,cell,...(from===undefined?{}:{from}),side:s.board[cell]!.controller,layer,detail});
 event('placed',move.cell,0,'放置卡牌');
 // Every comparison in a wave reads the same snapshot; commits happen afterwards.
 const wave=(sources:number[],layer:number):number[]=>{
  const snapshot=structuredClone(s),targets=new Map<number,number>();
  for(const source of [...new Set(sources)].sort((a,b)=>a-b)){
   const a=snapshot.board[source]!;
   for(const [target,dir,opposite] of neighbors(source)){
    const b=snapshot.board[target];if(!b||a.controller===b.controller)continue;
    const av=a.definition.values[dir]+comparisonModifier(snapshot,source,true),bv=b.definition.values[opposite]+comparisonModifier(snapshot,target,false);
    event('compared',target,layer,`${av} ${av>bv?'>':'≤'} ${bv}`,source);
    if(av>bv)targets.set(target,source);
   }
  }
  const flips:number[]=[];
  for(const [target,source]of [...targets].sort((a,b)=>a[0]-b[0])){
   const card=s.board[target]!;
   if(card.definition.skill==='armor'&&card.spent<SKILLS.armor.limit){card.spent++;event('resisted',target,layer,'堅甲抵抗翻轉',source);}else flips.push(target);
  }
  for(const target of flips){const card=s.board[target]!;card.controller=snapshot.board[targets.get(target)!]!.controller;if(SKILLS[card.definition.skill].resetOnFlip)card.spent=0;event('flipped',target,layer,'控制權轉移',targets.get(target));}
  return flips.filter(i=>s.board[i]!.definition.skill==='ripple');
 };
 let sources=wave([move.cell],0);
 for(let layer=1;layer<=3&&sources.length;layer++)sources=wave(sources,layer);
 if(sources.length)event('chain_capped',sources[0],3,'已達 3 波連鎖上限');
 if(s.board.every(Boolean)){s.status='finished';s.winner=score(s)[0]>score(s)[1]?0:1;event('finished',move.cell,0,'以棋盤控制格數判定勝負');}else s.turn=(1-s.turn) as Side;
 return s;
}
export function score(s:BattleState):[number,number]{return [s.board.filter(c=>c?.controller===0).length,s.board.filter(c=>c?.controller===1).length];}
export function legalMoves(s:BattleState):Move[]{if(s.status!=='playing')return [];return s.hands[s.turn].flatMap(c=>s.board.flatMap((v,i)=>v?[]:[{side:s.turn,cardId:c.id,cell:i}]));}
export function chooseAI(s:BattleState,difficulty='normal'):Move{
 const moves=legalMoves(s);if(!moves.length)throw Error('沒有合法操作');const side=s.turn;
 const random=rng(hash(`${s.seed}:${s.moves.length}:${difficulty}`));
 if(difficulty==='easy')return moves[Math.floor(random()*moves.length)];
 const ranked=moves.map(move=>{const next=applyMove(s,move);let value=score(next)[side]-score(next)[1-side];
  if(difficulty==='hard'&&next.status==='playing'){value=Math.min(...legalMoves(next).map(m=>{const reply=applyMove(next,m);return score(reply)[side]-score(reply)[1-side];}));}
  return {move,value:value+([0,2,6,8].includes(move.cell)?0.06:0)+random()*0.01};});
 ranked.sort((a,b)=>b.value-a.value);return ranked[0].move;
}
export function dexCandidates(s:BattleState,side:Side,known:string[]):string[]{if(s.status!=='finished')return [];return [...new Set(s.board.filter(c=>c?.controller===side&&c.originalOwner!==side&&!known.includes(c.definition.speciesId)).map(c=>c!.definition.speciesId))];}
export function replay(initial:BattleState,moves:Move[]):BattleState{return moves.reduce(applyMove,structuredClone(initial));}
export function distanceKm(a:{lat:number;lng:number},b:{lat:number;lng:number}):number {const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlng=(b.lng-a.lng)*rad;const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
