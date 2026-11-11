import {test} from 'node:test';import assert from 'node:assert/strict';
import {applyMove,createBattle,replay,legalMoves,LEGACY_RULE_VERSION} from '../engine/engine';
import {activeReveals,MAX_TURNS,ECOLOGY_SKILLS} from '../engine/ecology-rules';
import {publicBattleState} from '../server/battle-view';
import {transitionFrames} from '../src/battle-presentation';
import {explainComparison} from '../engine/comparison-details';
import {officialDefinition} from '../engine/official-cards';
import type {BattleState,BattleCard,Side,SkillId,Values} from '../engine/types';
function base(){const deck=(side:number,ids:string[])=>ids.map((speciesId,i)=>({id:`${side}:${i}`,definition:{speciesId,version:'skill-test',values:[5,5,5,5] as Values,skill:'neutral' as SkillId,seed:i}}));return createBattle([deck(0,['sparrow','magpie','turtle','kingfisher','butterfly']),deck(1,['macaque','gecko','toad','swallow','cat'])],1,0);}
function put(s:BattleState,owner:Side,cell:number,skill:SkillId='neutral',values:Values=[5,5,5,5],controller:Side=owner){const c=s.hands[owner].shift()!;c.definition.skill=skill;c.definition.values=values;c.controller=controller;s.board[cell]=c;return c;}
function setHand(s:BattleState,side:Side,skill:SkillId,values:Values=[10,10,10,10]){const c=s.hands[side][0];c.definition.skill=skill;c.definition.values=values;return c.id;}
function conserved(s:BattleState){const cards=[...s.hands.flat(),...s.board.filter((c):c is BattleCard=>!!c)];assert.equal(cards.length,10);assert.equal(new Set(cards.map(c=>c.id)).size,10);}
test('collective behavior follows former same-color orthogonal neighbors and stops at layer three',()=>{
 const s=base();put(s,1,1);for(const i of [2,5,8,7])put(s,1,i,'collective');const id=setHand(s,0,'neutral');const n=applyMove(s,{side:0,cardId:id,cell:0});
 for(const i of [1,2,5,8])assert.equal(n.board[i]!.controller,0);assert.equal(n.board[7]!.controller,1);assert.ok(n.events.some(e=>e.type==='chain_capped'));assert.ok(n.events.every(e=>e.layer<=3));conserved(n);
 const different=base();put(different,1,1);put(different,1,2,'collective',[5,5,5,5],0);const a=applyMove(different,{side:0,cardId:setHand(different,0,'neutral'),cell:0});assert.ok(!a.events.some(e=>e.type==='skill_triggered'&&e.cell===2));
});
test('antipredator reverses comparison when on either side; equality never flips',()=>{
 for(const skillSide of [0,1])for(const [attack,defense,expected] of [[4,6,0],[6,4,1],[5,5,1]]){
  const s=base();put(s,1,1,skillSide===1?'antipredator':'neutral',[defense,defense,defense,defense]);const id=setHand(s,0,skillSide===0?'antipredator':'neutral',[attack,attack,attack,attack]);const n=applyMove(s,{side:0,cardId:id,cell:0});assert.equal(n.board[1]!.controller,expected);const event=n.events.find(e=>e.type==='compared')!;assert.equal(event.reverse,true);assert.ok(explainComparison(n,event));
 }
});
test('defensive aggression attacks every neighboring enemy for its new controller in one wave',()=>{
 const s=base();put(s,1,1,'defensive_aggression',[1,10,10,1]);put(s,1,2);put(s,1,4);const n=applyMove(s,{side:0,cardId:setHand(s,0,'neutral'),cell:0});
 assert.deepEqual(n.events.filter(e=>e.type==='flipped'&&e.layer===1).map(e=>e.cell),[2,4]);for(const i of [1,2,4])assert.equal(n.board[i]!.controller,0);conserved(n);
});
test('defense mechanism blocks one skill-caused flip but does not block an ordinary successful comparison',()=>{
 const s=base();put(s,1,1,'defense_mechanism',[6,6,6,6]);let n=applyMove(s,{side:0,cardId:setHand(s,0,'antipredator',[4,4,4,4]),cell:0});assert.equal(n.board[1]!.controller,1);assert.equal(n.board[1]!.spent,1);assert.ok(n.events.some(e=>e.type==='skill_resisted'));
 n.turn=0;n=applyMove(n,{side:0,cardId:setHand(n,0,'neutral'),cell:2});assert.equal(n.board[1]!.controller,0);assert.equal(n.board[1]!.spent,1);
 const normal=base();put(normal,1,1,'defense_mechanism');const direct=applyMove(normal,{side:0,cardId:setHand(normal,0,'neutral'),cell:0});assert.equal(direct.board[1]!.controller,0);assert.equal(direct.board[1]!.spent,0);
});
test('escape returns to the original owner even when the opposing player controlled it; no flip is emitted',()=>{
 const s=base(),escaping=put(s,0,1,'escape',[5,5,5,5],1);const n=applyMove(s,{side:0,cardId:setHand(s,0,'neutral'),cell:0});assert.equal(n.board[1],null);assert.ok(n.hands[0].some(c=>c.id===escaping.id&&c.controller===0));assert.ok(!n.events.some(e=>e.type==='flipped'&&e.cell===1));assert.match(explainComparison(n,n.events.find(e=>e.type==='compared')!)!.defense,/集體|麻雀/);conserved(n);
});
test('mimicry resists once, then stays consumed after a flip and migration back to its owner',()=>{
 const s=base();const target=put(s,1,1,'mimicry');let n=applyMove(s,{side:0,cardId:setHand(s,0,'neutral'),cell:0});assert.equal(n.board[1]!.spent,1);assert.equal(n.board[1]!.controller,1);
 n.turn=0;n=applyMove(n,{side:0,cardId:setHand(n,0,'neutral'),cell:2});assert.equal(n.board[1]!.controller,0);assert.equal(n.board[1]!.spent,1);
 n.turn=0;n=applyMove(n,{side:0,cardId:setHand(n,0,'migration'),cell:1});assert.equal(n.hands[1].find(c=>c.id===target.id)!.spent,1);conserved(n);
});
test('migration replaces a currently friendly card, returns its original ownership and performs new comparisons',()=>{
 const s=base(),old=put(s,1,4,'neutral',[5,5,5,5],0);put(s,1,5);const before=structuredClone(s),id=setHand(s,0,'migration');const n=applyMove(s,{side:0,cardId:id,cell:4});assert.equal(n.board[4]!.id,id);assert.equal(n.board[5]!.controller,0);assert.ok(n.hands[1].some(c=>c.id===old.id));assert.equal(n.moves.length,1);assert.equal(s.moves.length,0);conserved(n);
 const hostile=base();put(hostile,1,4);assert.throws(()=>applyMove(hostile,{side:0,cardId:setHand(hostile,0,'migration'),cell:4}),/我方/);assert.throws(()=>applyMove(before,{side:0,cardId:before.hands[0][0].id,cell:4}));
});
test('predator reveals a snapshot once, defense mechanism hides only its protected card, and flipping disables the source permanently',()=>{
 const s=base();s.hands[1][1].definition.skill='defense_mechanism';const predator=setHand(s,0,'predator',[5,5,5,5]);let n=applyMove(s,{side:0,cardId:predator,cell:0});assert.equal(activeReveals(n,0).length,1);assert.equal(activeReveals(n,1).length,0);assert.equal(n.handReveals![0].cards.filter(c=>c.hidden).length,1);assert.equal(n.hands[1][1].spent,1);
 const attacker=setHand(n,1,'neutral');n=applyMove(n,{side:1,cardId:attacker,cell:1});assert.equal(n.board[0]!.skillDisabled,true);assert.equal(activeReveals(n,0).length,0);
 n.turn=1;const replacement=setHand(n,1,'migration');n=applyMove(n,{side:1,cardId:replacement,cell:0});assert.ok(n.hands[0].some(c=>c.id===predator&&c.skillDisabled));
 n=applyMove(n,{side:0,cardId:predator,cell:8});assert.equal(n.handReveals!.length,1);assert.equal(activeReveals(n,0).length,0);conserved(n);
});
test('server views hide all opponent hand definitions, private reveal snapshots, and historical hand snapshots',()=>{
 const s=base();const n=applyMove(s,{side:0,cardId:setHand(s,0,'predator'),cell:0}),saved=structuredClone(n);const own=publicBattleState(n,0)!,other=publicBattleState(n,1)!;
 assert.ok(own.hands[1].every(c=>c.hidden&&c.definition.speciesId==='hidden'));assert.equal(own.handReveals!.length,1);assert.equal(other.handReveals!.length,0);for(const snap of other.turnSnapshots!)assert.ok(snap.hands[0].every(c=>c.hidden));assert.deepEqual(n,saved);
 const initial=publicBattleState(s,0)!;const frames=transitionFrames(initial,own);assert.ok(frames.length);assert.deepEqual(frames.at(-1)!.state,own);
});
test('100 migration turns finish in a draw with exact replay, preserved identities, and no extra turn',()=>{
 const initial=base();for(const c of initial.hands.flat())c.definition.skill='migration';let s=initial;
 while(s.status==='playing'){const side=s.turn,cell=side===0?0:8,card=s.hands[side][0];assert.ok(legalMoves(s).some(m=>m.cardId===card.id&&m.cell===cell));s=applyMove(s,{side,cardId:card.id,cell});conserved(s);}
 assert.equal(s.moves.length,MAX_TURNS);assert.equal(s.endReason,'turn-limit');assert.equal(s.winner,null);assert.deepEqual(replay(initial,s.moves),s);assert.throws(()=>applyMove(s,s.moves[0]));
});
test('an empty opponent hand is automatically skipped while a legal player can continue',()=>{
 const s=base();for(const cell of [0,1,2,3,4])put(s,1,cell);const n=applyMove(s,{side:0,cardId:setHand(s,0,'neutral',[1,1,1,1]),cell:8});assert.equal(n.status,'playing');assert.equal(n.turn,0);assert.ok(n.events.some(e=>e.type==='turn_skipped'&&e.side===1));conserved(n);
});
test('all eight skills have sourced official species; old rule snapshots retain the legacy engine',()=>{
 const species=['sparrow','toad','magpie','turtle','gecko','butterfly','swallow','kingfisher'];assert.deepEqual(new Set(species.map(id=>officialDefinition(id).skill)),new Set(ECOLOGY_SKILLS));
 const s=base();s.ruleVersion=LEGACY_RULE_VERSION;delete s.handReveals;delete s.turnSnapshots;const n=applyMove(s,{side:0,cardId:s.hands[0][0].id,cell:0});assert.equal(n.ruleVersion,LEGACY_RULE_VERSION);assert.equal(n.turnSnapshots,undefined);assert.deepEqual(replay(s,n.moves),n);
});
test('all skill mixtures conserve ten identities and terminate within 100 turns with legal AI moves',async()=>{
 const {chooseAI,rng}=await import('../engine/engine');for(let seed=1;seed<=24;seed++){const random=rng(seed),initial=base();initial.seed=seed;for(const c of initial.hands.flat()){c.definition.skill=ECOLOGY_SKILLS[Math.floor(random()*ECOLOGY_SKILLS.length)];c.definition.values=Array.from({length:4},()=>1+Math.floor(random()*10)) as Values;}
 let state=initial;while(state.status==='playing'){const move=chooseAI(state,'easy');assert.ok(legalMoves(state).some(m=>m.cardId===move.cardId&&m.cell===move.cell));state=applyMove(state,move);conserved(state);assert.ok(state.moves.length<=100);}assert.deepEqual(replay(initial,state.moves),state);}
});
test('hard AI cannot use an unrevealed opponent hand, but can use an active authorized snapshot',async()=>{
 const {aiPerception,chooseAI}=await import('../engine/engine');const a=base(),b=structuredClone(a);
 for(const c of b.hands[1]){c.definition.skill='escape';c.definition.values=[1,10,1,10];}
 assert.deepEqual(aiPerception(a,0).hands[1],aiPerception(b,0).hands[1]);assert.deepEqual(chooseAI(a,'hard'),chooseAI(b,'hard'));
 const revealed=applyMove(a,{side:0,cardId:setHand(a,0,'predator'),cell:0});assert.deepEqual(aiPerception(revealed,0).hands[1].map(c=>c.definition),revealed.hands[1].map(c=>c.definition));
});
test('new snapshot replays support return/replacement without recalculating or losing battle flags',async()=>{
 const {replayAt}=await import('../engine/replay-view');const initial=base();const target=put(initial,1,1,'escape');const id=setHand(initial,0,'neutral'),after=applyMove(initial,{side:0,cardId:id,cell:0});
 const shown=replayAt(initial,after.moves,1,after);assert.equal(shown.board[1],null);assert.ok(shown.hands[1].some(c=>c.id===target.id));assert.equal(replayAt(initial,after.moves,0,after),initial);
 const frames=transitionFrames(publicBattleState(initial,0)!,publicBattleState(after,0)!);assert.ok(frames.some(f=>f.phase==='return'));assert.deepEqual(frames.at(-1)!.state,publicBattleState(after,0));
});
test('a smaller antipredator defender flips the attacking card while other comparisons still commit from one snapshot',()=>{
 const s=base();put(s,1,1,'antipredator',[3,3,3,3]);put(s,1,3,'neutral',[2,2,2,2]);const id=setHand(s,0,'neutral',[8,8,8,8]);const n=applyMove(s,{side:0,cardId:id,cell:0});
 assert.equal(n.board[0]!.controller,1);assert.equal(n.board[1]!.controller,1);assert.equal(n.board[3]!.controller,0);
 const flips=n.events.filter(e=>e.type==='flipped'&&e.layer===0);assert.deepEqual(flips.map(e=>e.cell),[0,3]);assert.ok(n.events.filter(e=>e.type==='compared'&&e.layer===0).every(e=>e.seq<flips[0].seq));
 assert.match(explainComparison(n,n.events.find(e=>e.type==='compared'&&e.cell===1)!)!.result,/防守方較小，反翻攻方/);conserved(n);
});
test('antipredator counter-flips can be resisted or escaped and can trigger defensive aggression for the new side',()=>{
 for(const skill of ['mimicry','defense_mechanism','escape'] as SkillId[]){const s=base();put(s,1,1,'antipredator',[3,3,3,3]);const id=setHand(s,0,skill,[8,8,8,8]);const n=applyMove(s,{side:0,cardId:id,cell:0});if(skill==='escape'){assert.equal(n.board[0],null);assert.ok(n.hands[0].some(c=>c.id===id));}else{assert.equal(n.board[0]!.controller,0);assert.equal(n.board[0]!.spent,1);}conserved(n);}
 const s=base();put(s,1,1,'antipredator',[3,3,3,3]);put(s,1,3,'neutral',[2,2,2,2]);const n=applyMove(s,{side:0,cardId:setHand(s,0,'defensive_aggression',[8,8,8,8]),cell:0});assert.equal(n.board[0]!.controller,1);assert.equal(n.board[3]!.controller,1);assert.ok(n.events.some(e=>e.type==='compared'&&e.from===0&&e.layer===1));
});
test('authorized Predator snapshots preserve already-consumed and disabled skill flags',async()=>{
 const s=base();s.hands[1][0].definition.skill='mimicry';s.hands[1][0].spent=1;s.hands[1][1].definition.skill='predator';s.hands[1][1].spent=1;s.hands[1][1].skillDisabled=true;
 const n=applyMove(s,{side:0,cardId:setHand(s,0,'predator'),cell:0}),reveal=publicBattleState(n,0)!.handReveals![0];assert.equal(reveal.cards[0].spent,1);assert.equal(reveal.cards[1].skillDisabled,true);
 const {aiPerception}=await import('../engine/engine');assert.equal(aiPerception(n,0).hands[1][0].spent,1);assert.equal(aiPerception(n,0).hands[1][1].skillDisabled,true);
});
