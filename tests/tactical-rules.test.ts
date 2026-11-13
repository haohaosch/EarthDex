import {test} from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {applyMove,createBattle,legalMoves,score,replay,chooseAI,validateDeck,rng,aiPerception} from '../engine/engine';
import {TACTICAL_SKILLS} from '../engine/tactical-skills';
import {tacticalValue,tacticalModifier} from '../engine/tactical-rules';
import {publicBattleState} from '../server/battle-view';import {activeReveals} from '../engine/ecology-rules';
import {explainComparison} from '../engine/comparison-details';
import {transitionFrames,boardDirectionValues,handDirectionValues} from '../src/battle-presentation';
import {canDropCard} from '../src/battle-drop';import {SwapChoice} from '../src/swap-choice';
import {newProfile,upgradeDemoDeck} from '../server/model';
import type {BattleState,Side,SkillId,Values} from '../engine/types';
const ids=['sparrow','magpie','turtle','gecko','swallow','cat','kingfisher'];
function game(plants=false,first:Side=0){const deck=(side:number)=>ids.map((speciesId,i)=>({id:`${side}:${i}`,definition:{speciesId,version:'tactical-test',skill:'neutral' as SkillId,values:[5,5,5,5] as Values,seed:i}}));const s=createBattle([deck(0),deck(1)],1,first);if(!plants)s.board.fill(null);return s;}
function hand(s:BattleState,side:Side,skill:SkillId='neutral',value=8){const c=s.hands[side][0];c.definition.skill=skill;c.definition.values=[value,value,value,value];return c.id;}
function put(s:BattleState,owner:Side,cell:number,skill:SkillId='neutral',value=5,controller=owner){const c=s.hands[owner].shift()!;c.controller=controller;c.definition.skill=skill;c.definition.values=[value,value,value,value];s.board[cell]=c;return c;}
function conserved(s:BattleState){const cards=[...s.hands.flat(),...s.board.filter(c=>c&&!c.obstacle)];assert.equal(cards.length,14);assert.equal(new Set(cards.map(c=>c!.id)).size,14);assert.ok(s.board.every(c=>!c||c.obstacle||c.definition.values.every((_,d)=>tacticalValue(s,s.board.indexOf(c),d,false)>=1&&tacticalValue(s,s.board.indexOf(c),d,false)<=10)));}
test('seven-card decks and two removable second-side plants start symmetrically for either first player',()=>{
 const p=newProfile(true);assert.deepEqual(validateDeck(p.instances),[]);assert.ok(validateDeck(p.instances.slice(0,5)).length);
 for(const first of [0,1] as Side[]){const s=game(true,first);assert.equal(s.ruleVersion,'tactics-0.3');assert.deepEqual(score(s),first===0?[0,2]:[2,0]);assert.equal(s.board.filter(Boolean).length,2);for(const c of s.board.filter(Boolean)){assert.equal(c!.controller,1-first);assert.equal(c!.obstacle,true);assert.equal(c!.definition.values.reduce((a,b)=>a+b,0),14);}conserved(s);}
 const s=game(true);const n=applyMove(s,{side:0,cardId:hand(s,0),cell:1});assert.equal(n.board[0],null);assert.ok(n.events.some(e=>e.type==='removed'));assert.deepEqual(score(n),[1,1]);conserved(n);
 const frames=transitionFrames(publicBattleState(s,0)!,publicBattleState(n,0)!);assert.ok(frames.some(f=>f.phase==='remove'));assert.deepEqual(frames.at(-1)!.state,publicBattleState(n,0));
});
test('v3 reverse comparisons, shields, original-owner escape and migration retain their rules',()=>{
 for(const value of [3,5,8]){const s=game();put(s,1,1,'antipredator',5);const n=applyMove(s,{side:0,cardId:hand(s,0,'neutral',value),cell:0});assert.equal(n.board[1]!.controller,value<5?0:1);assert.equal(n.board[0]!.controller,value>5?1:0);conserved(n);}
 const s=game();const escape=put(s,0,1,'escape',1,1);let n=applyMove(s,{side:0,cardId:hand(s,0),cell:0});assert.equal(n.board[1],null);assert.ok(n.hands[0].some(c=>c.id===escape.id));conserved(n);
 const m=game();const old=put(m,1,4,'mimicry',5,0);old.spent=1;n=applyMove(m,{side:0,cardId:hand(m,0,'migration'),cell:4});assert.equal(n.hands[1].find(c=>c.id===old.id)!.spent,1);assert.equal(n.moves.length,1);conserved(n);
});
test('v3 collective and turncoat reactions use old colors, apply all neighbors and cap at three',()=>{
 const s=game();put(s,1,1,'collective',1);put(s,1,2,'collective',1);put(s,1,5,'collective',1);put(s,1,8,'collective',1);const n=applyMove(s,{side:0,cardId:hand(s,0),cell:0});assert.equal(n.board[5]!.controller,0);assert.equal(n.board[8]!.controller,0);assert.ok(n.events.every(e=>e.layer<=3));conserved(n);
 const t=game();put(t,1,4,'defensive_aggression',7);for(const cell of [1,5,7])put(t,1,cell,'neutral',1);const r=applyMove(t,{side:0,cardId:hand(t,0),cell:3});assert.ok([1,4,5,7].every(i=>r.board[i]!.controller===0));conserved(r);
});
test('recon sees every current enemy hand, including shields, with private authorized snapshots',()=>{
 const s=game();s.hands[1][0].definition.skill='defense_mechanism';s.hands[1][1].modifiers=[-2,-2,-2,-2];const n=applyMove(s,{side:0,cardId:hand(s,0,'predator',3),cell:4});
 assert.equal(n.hands[1][0].spent,0);assert.equal(activeReveals(n,0)[0].cards.length,7);assert.ok(activeReveals(n,0)[0].cards.every(c=>c.definition));assert.deepEqual(activeReveals(n,0)[0].cards[1].modifiers,[-2,-2,-2,-2]);
 const other=publicBattleState(n,1)!;assert.deepEqual(other.handReveals,[]);assert.ok(other.hands[0].every(c=>c.hidden));assert.ok(other.turnSnapshots!.every(t=>t.hands[0].every(c=>c.hidden)));
 const perception=aiPerception(n,0);assert.deepEqual(perception.hands[1].map(c=>c.definition),n.hands[1].map(c=>c.definition));
 n.turn=1;const flipped=applyMove(n,{side:1,cardId:hand(n,1,'neutral',10),cell:1});assert.equal(flipped.board[4]!.skillDisabled,true);assert.equal(activeReveals(flipped,0).length,0);
});
test('rally and surrounded bonuses follow the current snapshot, have distinct thresholds and clamp at ten',()=>{
 const s=game();put(s,0,1);put(s,0,3);put(s,1,5,'neutral',6);const n=applyMove(s,{side:0,cardId:hand(s,0,'rally',5),cell:4});const e=n.events.find(e=>e.type==='compared')!;assert.equal(e.attackTotal,7);assert.equal(n.board[5]!.controller,0);assert.equal(tacticalModifier(n,4,true),3);assert.equal(boardDirectionValues(n,4)[0].total,8);
 const t=game();put(t,1,1,'neutral',6);put(t,1,3,'neutral',6);let r=applyMove(t,{side:0,cardId:hand(t,0,'surrounded',5),cell:4});assert.ok(r.events.filter(e=>e.type==='compared').every(e=>e.attackTotal===7));assert.equal(tacticalModifier(r,4,false),0);r.board[4]!.modifiers=[20,20,20,20];assert.equal(tacticalValue(r,4,0,true),10);
});
test('gap strike crosses exactly one empty cell, respects friendly and enemy blockers, and explains remote directions',()=>{
 for(const blocker of ['none','friend','enemy'] as const){const s=game();put(s,1,2,'neutral',1);if(blocker!=='none')put(s,blocker==='friend'?0:1,1,'neutral',1);const n=applyMove(s,{side:0,cardId:hand(s,0,'pierce'),cell:0});assert.equal(n.board[2]!.controller,blocker==='none'?0:1);if(blocker==='none'){const e=n.events.find(e=>e.type==='compared')!;assert.equal(e.cell,2);assert.ok(explainComparison(n,e)?.text.includes('右'));}if(blocker==='enemy')assert.equal(n.board[1]!.controller,0);conserved(n);}
 const s=game();put(s,1,3,'neutral',1);const n=applyMove(s,{side:0,cardId:hand(s,0,'pierce'),cell:2});assert.equal(n.board[3]!.controller,1); // no row wrap
});
test('capture relay makes newly converted cards attack in the next layer',()=>{
 const s=game();put(s,1,1,'neutral',7);put(s,1,2,'neutral',1);const n=applyMove(s,{side:0,cardId:hand(s,0,'cascade'),cell:0});assert.equal(n.board[2]!.controller,0);assert.ok(n.events.some(e=>e.type==='skill_triggered'&&e.skill==='cascade'&&e.layer===1));conserved(n);
});
test('switch strike has explicit legal choices, swaps first, then attacks from the new location',()=>{
 const s=game();const target=put(s,1,1,'neutral',1);put(s,1,3,'neutral',1);const id=hand(s,0,'swap');const move={side:0 as Side,cardId:id,cell:4,swapCell:1};assert.ok(legalMoves(s).some(m=>JSON.stringify(m)===JSON.stringify(move)));const before=structuredClone(s),n=applyMove(s,move);
 assert.equal(n.board[1]!.id,id);assert.equal(n.board[4]!.id,target.id);assert.equal(n.board[4]!.controller,0);assert.equal(n.board[3]!.controller,1);assert.equal(n.moves[0].swapCell,1);assert.deepEqual(s,before);
 assert.throws(()=>applyMove(s,{...move,swapCell:3.1}));assert.throws(()=>applyMove(s,{...move,swapCell:8}));
 const frames=transitionFrames(publicBattleState(s,0)!,publicBattleState(n,0)!);assert.ok(frames.some(f=>f.phase==='swap'));assert.deepEqual(frames.at(-1)!.state,publicBattleState(n,0));
 const html=renderToStaticMarkup(React.createElement(SwapChoice,{state:s,cell:4,side:0,onChoose(){},onCancel(){}}));assert.match(html,/第 2 格/);assert.match(html,/略過換位/);assert.match(html,/重新選擇落點/);conserved(n);
});
test('skill shield resists a swap once, while the ordinary placement attack still resolves',()=>{
 const s=game();const c=put(s,1,1,'defense_mechanism',1);const id=hand(s,0,'swap');const n=applyMove(s,{side:0,cardId:id,cell:4,swapCell:1});assert.equal(n.board[4]!.id,id);assert.equal(n.board[1]!.id,c.id);assert.equal(n.board[1]!.spent,1);assert.equal(n.board[1]!.controller,0);assert.ok(!n.events.some(e=>e.type==='swapped'));conserved(n);
});
test('ally retaliation attacks for the former team, but not when the watcher also flips in the same wave',()=>{
 const s=game();put(s,1,1,'neutral',1);put(s,1,2,'vengeance',9);const n=applyMove(s,{side:0,cardId:hand(s,0),cell:0});assert.equal(n.board[1]!.controller,1);assert.ok(n.events.some(e=>e.type==='skill_triggered'&&e.skill==='vengeance'));conserved(n);
 const t=game();put(t,1,1,'vengeance',1);put(t,1,2,'neutral',1);const r=applyMove(t,{side:0,cardId:hand(t,0),cell:4});assert.ok(!r.events.some(e=>e.type==='skill_triggered'&&e.skill==='vengeance'));
});
test('field drain includes itself and plants, floors at one, shields resist once, and modifiers persist through return',()=>{
 const s=game(true);put(s,0,1,'neutral',2);const protectedCard=put(s,1,2,'defense_mechanism',5);const id=hand(s,0,'weaken',4);const before=structuredClone(s);let n=applyMove(s,{side:0,cardId:id,cell:4});assert.deepEqual(n.board[4]!.definition.values,[4,4,4,4]);assert.deepEqual(n.board[4]!.modifiers,[-2,-2,-2,-2]);assert.deepEqual(n.board[1]!.modifiers,[-1,-1,-1,-1]);assert.equal(n.board[2]!.spent,1);assert.equal(n.board[2]!.modifiers,undefined);assert.ok(n.board[0]!.modifiers);assert.deepEqual(s,before);
 n.turn=0;n=applyMove(n,{side:0,cardId:hand(n,0,'migration'),cell:4});const returned=n.hands[0].find(c=>c.id===id)!;assert.deepEqual(handDirectionValues(returned).map(v=>v.total),[2,2,2,2]);assert.equal(protectedCard.id,n.board[2]!.id);conserved(n);
});
test('inspiration boosts other board allies only, caps at ten and displays changed numbers before comparing',()=>{
 const s=game();put(s,0,0,'neutral',10);put(s,0,1,'neutral',5);put(s,1,8,'neutral',5);const n=applyMove(s,{side:0,cardId:hand(s,0,'inspire',5),cell:4});assert.deepEqual(n.board[0]!.modifiers,[0,0,0,0]);assert.deepEqual(n.board[1]!.modifiers,[1,1,1,1]);assert.equal(n.board[4]!.modifiers,undefined);assert.equal(n.board[8]!.modifiers,undefined);assert.equal(n.hands[0][0].modifiers,undefined);
 const frames=transitionFrames(publicBattleState(s,0)!,publicBattleState(n,0)!);const change=frames.find(f=>f.phase==='skill'&&f.triggered?.includes(1));assert.equal(boardDirectionValues(change!.state,1)[0].total,6);conserved(n);
});
test('enemy displacement returns to the current color rather than the original owner, without losing identity or modifiers',()=>{
 const s=game();const victim=put(s,0,4,'neutral',5,1);victim.modifiers=[-2,-2,-2,-2];const id=hand(s,0,'overrun');assert.ok(canDropCard(s,0,id,4));const n=applyMove(s,{side:0,cardId:id,cell:4});assert.equal(n.board[4]!.id,id);assert.ok(n.hands[1].some(c=>c.id===victim.id&&c.originalOwner===0&&c.controller===1));assert.deepEqual(n.hands[1].find(c=>c.id===victim.id)!.modifiers,[-2,-2,-2,-2]);assert.equal(n.moves.length,1);conserved(n);
});
test('displacement blocked by skill shield consumes the move and shield, keeps both cards, and animates without a false placement',()=>{
 const s=game();put(s,1,4,'defense_mechanism');const id=hand(s,0,'overrun');const n=applyMove(s,{side:0,cardId:id,cell:4});assert.equal(n.board[4]!.spent,1);assert.ok(n.hands[0].some(c=>c.id===id));assert.equal(n.turn,1);assert.equal(n.moves.length,1);assert.ok(!n.events.some(e=>e.type==='placed'));const frames=transitionFrames(publicBattleState(s,0)!,publicBattleState(n,0)!);assert.ok(frames.some(f=>f.phase==='resist'));conserved(n);
});
test('demo deck migration fills only existing owned cards; real profiles never gain or auto-select cards',()=>{
 const p=newProfile(true);p.deck=p.deck.slice(0,5);const instances=structuredClone(p.instances);assert.equal(upgradeDemoDeck(p),true);assert.equal(p.deck.length,7);assert.deepEqual(p.instances,instances);assert.equal(upgradeDemoDeck(p),false);p.demo=false;p.deck=p.deck.slice(0,5);assert.equal(upgradeDemoDeck(p),false);
});
test('mixed 17-skill games conserve fourteen owned identities, cap every chain and end within 100 moves with exact replays',()=>{
 for(let seed=1;seed<=40;seed++){const random=rng(seed),initial=game(true,seed%2 as Side);initial.seed=seed;for(const c of initial.hands.flat()){c.definition.skill=TACTICAL_SKILLS[Math.floor(random()*17)];c.definition.values=Array.from({length:4},()=>1+Math.floor(random()*10)) as Values;}
  let s=initial;while(s.status==='playing'){const move=chooseAI(s,'easy');s=applyMove(s,move);conserved(s);assert.ok(s.moves.length<=100);assert.ok(s.events.every(e=>e.layer<=3));}assert.deepEqual(replay(initial,s.moves),s);
 }
});
test('v3 flip shield and skill shield distinguish normal flips from skill attacks, and never reset on return',()=>{
 for(const skill of ['mimicry','defense_mechanism'] as SkillId[]){const s=game();put(s,1,1,skill,1);const n=applyMove(s,{side:0,cardId:hand(s,0,'neutral',9),cell:0});assert.equal(n.board[1]!.controller,skill==='mimicry'?1:0);assert.equal(n.board[1]!.spent,skill==='mimicry'?1:0);conserved(n);}
 const s=game();put(s,1,2,'defense_mechanism',1);const n=applyMove(s,{side:0,cardId:hand(s,0,'pierce',9),cell:0});assert.equal(n.board[2]!.controller,1);assert.equal(n.board[2]!.spent,1);conserved(n);
});
test('v3 recurring relief reaches exactly 100 moves, and empty hands skip automatically',()=>{
 const initial=game();for(const c of initial.hands.flat())c.definition.skill='migration';let s=initial;
 while(s.status==='playing'){const side=s.turn,cell=side===0?0:8;s=applyMove(s,{side,cardId:s.hands[side][0].id,cell});}assert.equal(s.moves.length,100);assert.equal(s.endReason,'turn-limit');assert.equal(s.winner,null);assert.deepEqual(replay(initial,s.moves),s);conserved(s);
 const empty=game();for(const cell of [0,1,2,3,4,5,6])put(empty,1,cell);const next=applyMove(empty,{side:0,cardId:hand(empty,0,'neutral',1),cell:8});assert.equal(next.turn,0);assert.ok(next.events.some(e=>e.type==='turn_skipped'&&e.side===1));conserved(next);
});
