import React,{useEffect,useState} from 'react';
import {Lock} from 'lucide-react';
import {SKILLS} from '../engine/engine';
import {possibleCardSkills} from '../engine/skill-options';
import {speciesById} from '../engine/species';
import type {CardDefinition} from '../engine/types';
export function SpeciesCardDetails({speciesId,cards}:{speciesId:string;cards:{id:string;definition:CardDefinition}[]}){
 const [index,setIndex]=useState(0);useEffect(()=>setIndex(0),[speciesId]);
 const card=cards[Math.min(index,cards.length-1)],possible=possibleCardSkills(speciesById(speciesId).tags);
 return <div className="detail-card-stats"><strong>生物卡牌<span>{card?'已持有・能力已揭曉':'未收集・點數未揭曉'}</span></strong>{card?<><div className="stat-pills">{['上','右','下','左'].map((dir,i)=><span key={dir}>{dir}<b>{card.definition.values[i]}</b></span>)}</div><p><b>{SKILLS[card.definition.skill].name}：</b>{SKILLS[card.definition.skill].description}</p>{cards.length>1&&<select aria-label="選擇持有的卡牌" value={index} onChange={e=>setIndex(Number(e.target.value))}>{cards.map((c,i)=><option key={c.id} value={i}>持有卡牌 #{i+1}</option>)}</select>}<small>每張卡牌於收集成功時隨機生成，分數不代表生物學能力。</small></>:<><div className="locked-ability"><Lock size={27}/><p>方向點數會在收集後揭曉。</p><div className="mystery-stats" aria-label="未收集，四方向點數隱藏">{['上','右','下','左'].map(dir=><span key={dir}>{dir}<b>?</b></span>)}</div></div><section className="possible-skills"><h3>可能獲得的技能</h3><p>技能說明可先查看；這張卡的實際技能與點數會在收集時生成。</p>{possible.map(id=><article key={id}><strong>{SKILLS[id].name}</strong><p>{SKILLS[id].description}</p></article>)}</section></>}</div>;
}
