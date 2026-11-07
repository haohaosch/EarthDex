import {test} from 'node:test';import assert from 'node:assert/strict';
import {applyMove,createBattle,generateCard,hash} from '../engine/engine';
import {definition,speciesById} from '../engine/species';
import {comparisonsForCard,explainComparison} from '../engine/comparison-details';
import type {CardDefinition,Move} from '../engine/types';
function reportedGame(){
 const seed=1138332714;
 const own=['magpie','sparrow','egret','magpie','spotted-dove'].map((id,i)=>({id:'own-'+i,definition:i===4?{speciesId:id,version:'capture-0.2',values:[7,4,8,9],skill:'neutral',seed:2029383539} as CardDefinition:definition(id)}));
 const ai=['macaque','barbet','kingfisher','bear','cat'].map((id,i)=>({id:'ai:'+i,definition:generateCard(id,speciesById(id).tags,'capture-0.2',hash(`${seed}:${id}:${i}`))}));
 const moves:Move[]=[{side:0,cardId:'own-1',cell:2},{side:1,cardId:'ai:0',cell:5},{side:0,cardId:'own-2',cell:4},{side:1,cardId:'ai:3',cell:3},{side:0,cardId:'own-3',cell:8},{side:1,cardId:'ai:1',cell:7},{side:0,cardId:'own-4',cell:1},{side:1,cardId:'ai:4',cell:0}];
 return {initial:createBattle([own,ai],seed,0),moves};
}
test('reported magpie attack is 6 versus macaque 5 + two friendly neighbors, and later flips do not rewrite it',()=>{
 const {initial,moves}=reportedGame();const afterAttack=moves.slice(0,5).reduce(applyMove,initial);
 assert.equal(afterAttack.board[5]!.definition.skill,'cooperate');assert.equal(afterAttack.board[4]!.controller,1);assert.equal(afterAttack.board[2]!.controller,1);assert.equal(afterAttack.board[5]!.controller,1);
 const compared=afterAttack.events.find(e=>e.type==='compared'&&e.from===8&&e.cell===5)!;assert.equal(compared.detail,'6 ≤ 7');
 const later=moves.slice(5).reduce(applyMove,afterAttack);assert.equal(later.board[4]!.controller,0);assert.equal(later.board[8]!.controller,1);
 const explanation=explainComparison(later,compared)!;assert.match(explanation.attack,/臺灣藍鵲（上）6 ＝ 6/);assert.match(explanation.defense,/臺灣獼猴（下）5 ＋ 群聚 2 ＝ 7/);assert.equal(explanation.result,'攻方較低，不翻面');assert.ok(comparisonsForCard(later,'ai:0').some(c=>c.seq===compared.seq));
});
test('without defensive group bonus the same magpie 6 flips macaque 5; ties still do not flip',()=>{
 for(const [value,controller] of [[6,0],[5,1]] as const){const {initial,moves}=reportedGame();let state=moves.slice(0,4).reduce(applyMove,initial);state.board[5]!.definition.skill='neutral';state.hands[0].find(c=>c.id==='own-3')!.definition.values[0]=value;state=applyMove(state,moves[4]);assert.equal(state.board[5]!.controller,controller);const event=state.events.find(e=>e.type==='compared'&&e.from===8&&e.cell===5)!;assert.equal(explainComparison(state,event)!.result,value===5?'點數相等，不翻面':'攻方較高，進入翻面判定');}
});
