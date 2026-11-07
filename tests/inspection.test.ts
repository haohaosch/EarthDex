import {test} from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {inspectBattleCard} from '../engine/inspection';import {createBattle,generateCard} from '../engine/engine';
import {newProfile,normalizeFlatCards} from '../server/model';import {BattleSkillDetails} from '../src/battle-skill-details';
const card=(id:string)=>({id,definition:{...generateCard('turtle',[],'capture-0.3',10),skill:'armor' as const}});
function makeBattle(){const ids=['turtle','sparrow','deer','magpie','egret'];return createBattle([ids.map((speciesId,i)=>({...card(i?'own-'+i:'mine'),definition:{...card('x').definition,speciesId}})),ids.map((speciesId,i)=>({...card(i?'enemy-'+i:'theirs'),definition:{...card('x').definition,speciesId}}))],10);}
test('all placed cards and own hand remain inspectable on either turn, never opponents hidden hand',()=>{
 const state=makeBattle();
 const placed=state.hands[0].pop()!,opposed=state.hands[1].pop()!;state.board[0]=placed;state.board[8]=opposed;
 for(const own of [0,1] as const)for(const turn of [0,1] as const){state.turn=turn;assert.equal(inspectBattleCard(state,own,{source:'board',id:placed.id})?.card,placed);assert.equal(inspectBattleCard(state,own,{source:'board',id:opposed.id})?.card,opposed);assert.ok(inspectBattleCard(state,own,{source:'hand',id:state.hands[own][0].id}));assert.equal(inspectBattleCard(state,own,{source:'hand',id:state.hands[1-own][0].id}),null);}
 placed.controller=1;placed.spent=1;const inspected=inspectBattleCard(state,0,{source:'board',id:placed.id})!;assert.equal(inspected.card.controller,1);assert.equal(inspected.card.spent,1);
 const markup=renderToStaticMarkup(React.createElement(BattleSkillDetails,{...inspected,own:0,canSelect:false,onSelect(){}}));assert.match(markup,/堅甲/);assert.match(markup,/對手控制/);assert.match(markup,/剩餘 0 \/ 1 次・已使用/);assert.match(markup,/不會恢復次數/);assert.doesNotMatch(markup,/選為出牌/);
});
test('hand skill inspection shows selection action disabled only when placement is unavailable',()=>{
 const state=makeBattle(),inspected=inspectBattleCard(state,0,{source:'hand',id:'mine'})!;
 const markup=renderToStaticMarkup(React.createElement(BattleSkillDetails,{...inspected,own:0,canSelect:false,onSelect(){}}));assert.match(markup,/選為出牌/);assert.match(markup,/disabled/);assert.match(markup,/堅甲/);
});
test('legacy redistribution preserves identity and skill without mutating ongoing battles',()=>{
 const profile=newProfile(true),instance=profile.instances[0];instance.definition={...instance.definition!,skill:'neutral',values:[7,7,7,7]};const snapshot=structuredClone(instance.definition);
 const decks=[profile.instances.slice(0,5).map(c=>({id:c.id,definition:c.definition!})),profile.instances.slice(0,5).map(c=>({id:'opponent-'+c.id,definition:c.definition!}))] as Parameters<typeof createBattle>[0];const battle=createBattle(decks,12);const before=structuredClone(battle);
 assert.equal(normalizeFlatCards(profile),true);assert.equal(instance.definition.skill,'neutral');assert.deepEqual(instance.balanceHistory,[snapshot]);assert.equal(normalizeFlatCards(profile),false);assert.deepEqual(battle,before);
});
