import React from 'react';
import {SKILLS} from '../engine/engine';
import {speciesById} from '../engine/species';
import type {Side} from '../engine/types';
import type {BattleFrame} from './battle-presentation';
export function phaseLabel(frame:BattleFrame|null,own:Side){
 if(!frame)return '戰場技能即時顯示';
 const card=frame.placed===undefined?null:frame.state.board[frame.placed];
 return frame.phase==='place'?`${frame.side===own?'我方':'對手'}出牌 · ${card?speciesById(card.definition.speciesId).name:''}`:frame.phase==='resist'?'堅甲發動 · 抵抗翻轉':frame.phase==='flip-out'||frame.phase==='flip-in'?'控制權翻轉':frame.phase==='compare'?(frame.layer?`技能連鎖 · 第 ${frame.layer} 層`:'方向比點與技能加成'):'上一手結算';
}
export function BattleResolution({frame,own,animating}:{frame:BattleFrame|null;own:Side;animating:boolean}){
 if(!frame)return <div className="battle-resolution"><strong>戰場技能即時顯示</strong><p>綠色數字包含技能加成；小標「+」是加成量。點卡牌可查看技能與比點紀錄。</p></div>;
 const title=phaseLabel(frame,own);
 const skills=[...new Set(Object.values(frame.effects).flatMap(d=>Object.values(d).filter(v=>v.bonus>0).map(v=>`${SKILLS[v.skill as keyof typeof SKILLS].name} +${v.bonus}${v.skill==='camouflage'?'（防守）':''}`)))];
 return <div className={`battle-resolution phase-${frame.phase}`} aria-busy={animating}><div className="resolution-heading"><strong>{title}</strong><span>{animating?'結算中':'已同步'}</span></div>{skills.length>0&&<div className="resolution-skills">{skills.map(s=><span key={s}>{s}</span>)}</div>}{frame.comparisons.length>0?<details className="resolution-comparisons"><summary>查看本次比點（{frame.comparisons.length}）</summary>{frame.comparisons.map((line,i)=><p key={i}>{line}</p>)}</details>:<p>出牌後先比較相鄰方向，再同時處理翻面。</p>}{frame.phase==='resist'&&<p className="resolution-shield">原本成功的比點被堅甲擋下，這次不會翻面。</p>}</div>;
}
