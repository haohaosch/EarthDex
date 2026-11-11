import{test}from'node:test';import assert from'node:assert/strict';
import{rankSpecies,normalizedVector,type ReferenceBank}from'../engine/recognition/rank';
import{generateCard,SKILLS}from'../engine/engine';import{mintCard,instanceDefinition}from'../server/model';import{SPECIES}from'../engine/species';
import realBank from '../engine/recognition/reference-bank.json';import negatives from './fixtures/non-animal-features.json';
const bank:ReferenceBank={version:'test',model:{id:'test',revision:'1',license:'MIT',source:'test'},dimensions:2,minSimilarity:.85,minMargin:.1,references:[{speciesId:'sparrow',vector:[1,0],source:'test',artist:'test',license:'CC0'},{speciesId:'deer',vector:[0,1],source:'test',artist:'test',license:'CC0'}],generatedAt:'test'};
test('highest candidate is reproducible but ties and low scores abstain from confirmation',()=>{assert.equal(rankSpecies([1,0],bank).speciesId,'sparrow');const tied=rankSpecies([1,1],bank);assert.equal(tied.status,'uncertain');assert.equal(tied.speciesId,tied.candidates[0].speciesId);assert.equal(tied.speciesId,'deer');assert.equal(tied.lowConfidence,true);assert.equal(tied.selectionPolicy,'review-required');assert.throws(()=>normalizedVector([0,0],2));assert.throws(()=>normalizedVector([NaN,1],2));assert.throws(()=>normalizedVector([1],2));assert.throws(()=>rankSpecies([1,0],{...bank,references:[]}));});
test('collected instances of one species can vary, remain budgeted, and never reroll on read',()=>{const seeds=Array.from({length:100},(_,i)=>generateCard('sparrow',['SOCIAL'],'capture-0.2',i));assert.ok(new Set(seeds.map(c=>JSON.stringify(c.values))).size>20);for(const c of seeds){assert.equal(c.values.reduce((a,b)=>a+b,0)+SKILLS[c.skill].cost,28);assert.ok(c.values.every(v=>v>=1&&v<=10));}const c=mintCard('sparrow','observation');assert.deepEqual(instanceDefinition(c),c.definition);assert.deepEqual(instanceDefinition(c),instanceDefinition(c));});
test('Taiwan collection covers common introduced and domestic animals, not just endemic taxa',()=>{assert.ok(SPECIES.filter(s=>s.region==='臺灣').length>=80);for(const id of ['dog','domestic-cat','sparrow','pigeon','gecko','toad','slider','snail','guppy'])assert.ok(SPECIES.find(s=>s.id===id));assert.equal(new Set(SPECIES.map(s=>s.id)).size,SPECIES.length);});

test('forest and blank images retain candidate rankings but require confirmation',()=>{for(const item of negatives){const r=rankSpecies(item.vector,realBank as ReferenceBank);assert.equal(r.status,'uncertain',item.label);assert.equal(r.speciesId,r.candidates[0].speciesId);assert.equal(r.lowConfidence,true);}});

test('an unsupported preferred text label does not block the highest supported candidate',()=>{const r=rankSpecies([1,1],{...bank,textPrototypes:[{speciesId:'unsupported',vector:[Math.SQRT1_2,Math.SQRT1_2]}],imageWeight:1,textWeight:0});assert.equal(r.status,'uncertain');assert.equal(r.speciesId,r.candidates[0].speciesId);assert.equal(r.lowConfidence,true);});

test('new directional allocation varies widely while preserving budget, limits and reproducibility',()=>{
 for(const tags of [[],['ARMOR'],['SOCIAL'],['AMBUSH'],['CAMOUFLAGE']]){
 const layouts=new Set<string>();for(let seed=0;seed<1000;seed++){
 const card=generateCard('sparrow',tags,'capture-0.3',seed);layouts.add(card.values.join(','));
 assert.equal(card.values.reduce((a,b)=>a+b,0)+SKILLS[card.skill].cost,28);assert.ok(card.values.every(v=>v>=1&&v<=10));assert.ok(Math.max(...card.values)-Math.min(...card.values)>=3);assert.deepEqual(generateCard('sparrow',tags,'capture-0.3',seed),card);
 }assert.ok(layouts.size>300);
 }
});
