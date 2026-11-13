import {test} from 'node:test';import assert from 'node:assert/strict';
import {applyMove,createBattle} from '../engine/engine';
import type {BattleState,CardDefinition,SkillId,Values} from '../engine/types';
import {BattlePresenter,boardDirectionValues,moveFrames,transitionFrames,type Presentation} from '../src/battle-presentation';
function game(){
 const deck=(prefix:string,ids:string[])=>ids.map((speciesId,i)=>({id:prefix+i,definition:{speciesId,version:'animation-fixture',values:[5,5,5,5] as Values,skill:'neutral' as SkillId,seed:i}}));
 return createBattle([deck('own-',['kingfisher','sparrow','egret','magpie','turtle']),deck('enemy-',['macaque','barbet','bear','cat','deer'])],1,0);
}
function withGroupAttack(){let s=game();s.hands[0][1].definition.skill='cooperate';s=applyMove(s,{side:0,cardId:'own-0',cell:1});s=applyMove(s,{side:1,cardId:'enemy-0',cell:5});return {before:s,after:applyMove(s,{side:0,cardId:'own-1',cell:4})};}
function setup(){const seen:Presentation[]=[],jobs=new Map<number,()=>void>();let id=0;const presenter=new BattlePresenter(v=>seen.push(v),fn=>{jobs.set(++id,fn);return id;},key=>{jobs.delete(key as number);});return {presenter,seen,jobs,flush(){let i=0;while(jobs.size){assert.ok(i++<200);const [key,fn]=jobs.entries().next().value!;jobs.delete(key);fn();}}};}
test('recorded comparison bonuses remain distinct from passive values after a flip changes neighbors',()=>{
 const {before,after}=withGroupAttack(),original=structuredClone(before),frames=moveFrames(before,after);
 const compare=frames.find(f=>f.phase==='compare')!,values=boardDirectionValues(compare.state,4,compare.effects);
 assert.equal(values[1].base,5);assert.equal(values[1].bonus,1);assert.equal(values[1].total,6);assert.equal(values[1].recorded,true);
 assert.match(compare.comparisons[0],/群聚 1 ＝ 6/);
 assert.equal(compare.state.board[5]!.controller,1); // no premature flip
 assert.equal(frames.find(f=>f.phase==='flip-out')!.state.board[5]!.controller,1);
 assert.equal(frames.find(f=>f.phase==='flip-in')!.state.board[5]!.controller,0);
 assert.equal(boardDirectionValues(after,4)[1].total,7); // now two friends, capped at +2
 assert.deepEqual(before,original);assert.deepEqual(frames.at(-1)!.state,after);
});
test('defense-only and placement-only modifiers are labeled and applied in the correct context',()=>{
 let s=game();const enemy=s.hands[1].shift()!;enemy.definition.skill='camouflage';s.board[1]=enemy;s.hands[0][0].definition.skill='ambush';
 const passive=boardDirectionValues(s,1);assert.equal(passive[0].total,6);assert.equal(passive[0].role,'defense');
 const after=applyMove(s,{side:0,cardId:'own-0',cell:0}),compare=moveFrames(s,after).find(f=>f.phase==='compare')!;
 assert.equal(compare.effects[0][1].total,7);assert.equal(compare.effects[0][1].bonus,2);assert.equal(compare.effects[0][1].role,'attack');
 assert.equal(compare.effects[1][3].total,6);assert.equal(compare.effects[1][3].role,'defense');
 assert.equal(boardDirectionValues(after,0)[1].bonus,0); // ambush does not remain as a passive buff
});
test('ordinary simultaneous flips animate together and armor resists without a flip animation',()=>{
 const s=game();s.hands[0][0].definition.values=[10,10,10,10];
 const armored=s.hands[1].shift()!;armored.definition.skill='armor';s.board[1]=armored;
 const other=s.hands[1].shift()!;s.board[3]=other;
 const after=applyMove(s,{side:0,cardId:'own-0',cell:4}),frames=moveFrames(s,after),resist=frames.find(f=>f.phase==='resist')!;
 assert.deepEqual(resist.resisted,[1]);assert.equal(resist.state.board[1]!.controller,1);assert.equal(resist.state.board[1]!.spent,1);
 assert.ok(resist.comparisons.some(s=>s.includes('抵抗生效，本次未翻面')));
 assert.deepEqual(frames.find(f=>f.phase==='flip-in')!.flips,[3]);assert.ok(!frames.some(f=>f.flips.includes(1)));
 const noArmor=structuredClone(s);noArmor.board[1]!.definition.skill='neutral';const both=moveFrames(noArmor,applyMove(noArmor,{side:0,cardId:'own-0',cell:4}));assert.deepEqual(both.find(f=>f.phase==='flip-in')!.flips,[1,3]);
});
test('skill-chain visuals follow recorded layers and do not extend beyond three waves',()=>{
 const s=game();s.hands[0][0].definition.values=[10,10,10,10];
 for(const [cell,values,skill] of [[1,[1,10,1,1],'ripple'],[2,[1,1,10,1],'ripple'],[5,[1,1,10,1],'ripple'],[8,[1,1,1,10],'ripple'],[7,[1,1,1,1],'neutral']] as [number,Values,SkillId][]){const c=s.hands[1].shift()!;c.definition.values=values;c.definition.skill=skill;s.board[cell]=c;}
 const after=applyMove(s,{side:0,cardId:'own-0',cell:0}),frames=moveFrames(s,after);
 assert.deepEqual(frames.filter(f=>f.phase==='flip-in').map(f=>f.layer),[0,1,2,3]);assert.equal(after.board[7]!.controller,1);assert.ok(frames.every(f=>f.layer<=3));assert.deepEqual(frames.at(-1)!.state,after);
});
test('one server response containing local and AI moves is played in order without changing authoritative state',()=>{
 const before=game(),one=applyMove(before,{side:0,cardId:'own-0',cell:0}),two=applyMove(one,{side:1,cardId:'enemy-0',cell:8}),saved=structuredClone(two);
 const frames=transitionFrames(before,two);assert.deepEqual(frames.filter(f=>f.phase==='place').map(f=>[f.placed,f.side]),[[0,0],[8,1]]);assert.deepEqual(two,saved);
 const t=setup();t.presenter.update('game',before);t.presenter.update('game',two);assert.equal(t.seen.at(-1)!.animating,true);t.flush();assert.equal(t.seen.at(-1)!.animating,false);assert.deepEqual(t.seen.at(-1)!.state,two);
});
test('PVP updates queue behind the current turn; reconnection and stale polling never replay old cards',()=>{
 const before=game(),one=applyMove(before,{side:0,cardId:'own-0',cell:0}),two=applyMove(one,{side:1,cardId:'enemy-0',cell:8}),t=setup();
 t.presenter.update('game',before);t.presenter.update('game',one);t.presenter.update('game',two);t.presenter.update('game',before);t.flush();
 assert.deepEqual(t.seen.filter(v=>v.frame?.phase==='place').map(v=>v.frame!.placed),[0,8]);assert.deepEqual(t.seen.at(-1)!.state,two);
 const reconnect=setup();reconnect.presenter.update('game',two);assert.equal(reconnect.jobs.size,0);assert.equal(reconnect.seen.at(-1)!.animating,false);
});
test('reduced motion, match changes, and disposal stop timers and leave no stale animated board',()=>{
 const before=game(),after=applyMove(before,{side:0,cardId:'own-0',cell:0}),t=setup();t.presenter.update('a',before);t.presenter.update('a',after,true);assert.equal(t.jobs.size,0);assert.deepEqual(t.seen.at(-1)!.state,after);
 t.presenter.update('b',before);t.presenter.update('b',after);assert.ok(t.jobs.size);t.presenter.update('c',before);assert.equal(t.jobs.size,0);assert.equal(t.seen.at(-1)!.key,'c');
 t.presenter.update('c',after);const n=t.seen.length;t.presenter.dispose();t.flush();t.presenter.update('c',before);assert.equal(t.seen.length,n);
});
test('corrections and resignations resync without guessing unsupported events',()=>{
 const before=game(),after=applyMove(before,{side:0,cardId:'own-0',cell:0}),corrected=structuredClone(after);corrected.board[0]!.spent=1;
 assert.deepEqual(transitionFrames(before,corrected),[]);const t=setup();t.presenter.update('a',before);t.presenter.update('a',corrected);assert.equal(t.jobs.size,0);assert.deepEqual(t.seen.at(-1)!.state,corrected);
 const resigned:BattleState={...corrected,status:'finished',winner:1};t.presenter.update('a',resigned);assert.equal(t.seen.at(-1)!.state!.status,'finished');
});
test('large reconnect catch-up skips motion instead of allocating a long blocked animation queue',()=>{const before=game();let after=before;for(let i=0;i<7;i++){const side=after.turn,card=after.hands[side][0];after=applyMove(after,{side,cardId:card.id,cell:i});}assert.deepEqual(transitionFrames(before,after),[]);const t=setup();t.presenter.update('a',before);t.presenter.update('a',after);assert.equal(t.jobs.size,0);assert.deepEqual(t.seen.at(-1)!.state,after);});
