import {officialDefinition} from '../engine/official-cards';
import {test} from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {SpeciesCardDetails} from '../src/species-card-details';import {possibleCardSkills} from '../engine/skill-options';
import {SPECIES,speciesById} from '../engine/species';import {generateCard,SKILLS} from '../engine/engine';
test('uncollected species show possible skill descriptions and four hidden direction values',()=>{
 for(const id of ['macaque','cat','egret']){const html=renderToStaticMarkup(React.createElement(SpeciesCardDetails,{speciesId:id,cards:[]}));assert.match(html,/官方物種技能/);assert.equal((html.match(/<b>\?<\/b>/g)||[]).length,4);assert.doesNotMatch(html,/class="stat-pills"/);assert.doesNotMatch(html,/持有卡牌 #/);for(const skill of [officialDefinition(id).skill])assert.match(html,new RegExp(SKILLS[skill].name));}
});
test('official skill previews agree with the published definition for every species',()=>{
 for(const s of SPECIES){const html=renderToStaticMarkup(React.createElement(SpeciesCardDetails,{speciesId:s.id,cards:[]}));const skill=officialDefinition(s.id).skill;assert.match(html,new RegExp(SKILLS[skill].name));}
});
test('owned cards reveal saved values and their actual skill',()=>{
 const definition=generateCard('macaque',['SOCIAL'],'capture-0.3',12);const html=renderToStaticMarkup(React.createElement(SpeciesCardDetails,{speciesId:'macaque',cards:[{id:'owned',definition}]}));assert.match(html,/class="stat-pills"/);assert.doesNotMatch(html,/<b>\?<\/b>/);assert.doesNotMatch(html,/官方物種技能/);
});
