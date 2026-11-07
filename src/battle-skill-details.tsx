import React from 'react';
import {SKILLS} from '../engine/engine';
import {speciesById} from '../engine/species';
import type {ComparisonExplanation} from '../engine/comparison-details';
import type {BattleCard,Side} from '../engine/types';
const triggers:Record<string,string>={none:'無額外觸發',BeforeFlip:'即將被翻轉時',Compare:'比較方向值時',CompareAttack:'落牌進攻比較時',CompareDefense:'防守比較時',OnFlipped:'控制權被翻轉後'};
export function BattleSkillDetails({card,own,location,inHand,canSelect,onSelect,comparisons=[]}:{card:BattleCard;own:Side;location:string;inHand:boolean;canSelect:boolean;onSelect:()=>void;comparisons?:ComparisonExplanation[]}){
 const skill=SKILLS[card.definition.skill],species=speciesById(card.definition.speciesId);
 return <div className="battle-skill-details"><span className="eyebrow">CARD INTELLIGENCE</span><h2>{species.name}</h2><p className="skill-location">{location} · {inHand?'你的手牌':card.controller===own?'我方控制':'對手控制'}</p><div className="skill-values">{card.definition.values.map((v,i)=><span key={i}>{['上','右','下','左'][i]}<b>{v}</b></span>)}</div><section className="skill-description"><span>卡牌技能</span><h3>{skill.name}</h3><p>{skill.description}</p></section><dl><dt>觸發時機</dt><dd>{triggers[skill.trigger]||skill.trigger}</dd><dt>目前狀態</dt><dd>{skill.limit===0?'無額外效果':skill.limit===1?`剩餘 ${Math.max(0,skill.limit-card.spent)} / ${skill.limit} 次${card.spent>=skill.limit?'・已使用':''}`:'符合條件時生效'}</dd>{skill.limit===1&&<><dt>翻轉後重置</dt><dd>{skill.resetOnFlip?'會重置':'不會恢復次數'}</dd></>}</dl>{!!comparisons.length&&<section className="comparison-history"><h3>最近的比點紀錄</h3><p>以下是結算當下的數值，後續翻面不會改寫當時的加成。</p>{comparisons.map(c=><article key={c.seq}><p>{c.attack}</p><p>{c.defense}</p><strong>{c.result}</strong></article>)}</section>}<p className="skill-passive-note">技能會在符合條件時自動觸發。</p>{inHand&&<><button className="primary full" disabled={!canSelect} onClick={onSelect}>選為出牌</button>{!canSelect&&<small>輪到你且對局進行中時，即可選為出牌。</small>}</>}</div>;
}
