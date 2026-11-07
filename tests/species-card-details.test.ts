import {test} from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {SpeciesCardDetails} from '../src/species-card-details';import {possibleCardSkills} from '../engine/skill-options';
import {SPECIES,speciesById} from '../engine/species';import {generateCard} from '../engine/engine';
test('uncollected species show possible skill descriptions and four hidden direction values',()=>{
 for(const id of ['macaque','cat','egret']){const html=renderToStaticMarkup(React.createElement(SpeciesCardDetails,{speciesId:id,cards:[]}));assert.match(html,/可能獲得的技能/);assert.equal((html.match(/<b>\?<\/b>/g)||[]).length,4);assert.doesNotMatch(html,/class="stat-pills"/);assert.doesNotMatch(html,/持有卡牌 #/);for(const skill of possibleCardSkills(speciesById(id).tags))assert.match(html,new RegExp(skill==='cooperate'?'群聚':skill==='ambush'?'伏擊':skill==='camouflage'?'隱蔽':'適應'));}
});
test('skill previews match the skills actually available to new card generation for every species',()=>{
 for(const s of SPECIES){const preview=possibleCardSkills(s.tags),generated=new Set<string>();for(let seed=0;seed<100;seed++)generated.add(generateCard(s.id,s.tags,'capture-0.3',seed).skill);assert.deepEqual([...generated].sort(),preview);assert.ok(!preview.includes('ripple'));}
});
test('owned cards reveal saved values and their actual skill',()=>{
 const definition=generateCard('macaque',['SOCIAL'],'capture-0.3',12);const html=renderToStaticMarkup(React.createElement(SpeciesCardDetails,{speciesId:'macaque',cards:[{id:'owned',definition}]}));assert.match(html,/class="stat-pills"/);assert.doesNotMatch(html,/<b>\?<\/b>/);assert.doesNotMatch(html,/可能獲得的技能/);
});
