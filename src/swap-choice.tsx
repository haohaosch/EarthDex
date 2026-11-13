import React from 'react';
import type {BattleState,Side} from '../engine/types';
import {swapTargets} from '../engine/tactical-rules';
import {speciesById} from '../engine/species';
export function SwapChoice({state,cell,side,onChoose,onCancel}:{state:BattleState;cell:number;side:Side;onChoose:(target?:number)=>void;onCancel:()=>void}){
 return <div className="swap-choice"><div className="eyebrow">SWITCH STRIKE</div><h2>選擇換位目標</h2><p>從第 {cell+1} 格落牌，與一張四鄰敵牌互換後，再從新位置攻擊。也可以略過換位。對手的技能護盾可能抵抗換位。</p><div className="swap-targets">{swapTargets(state,cell,side).map(i=><button className="outline full" key={i} onClick={()=>onChoose(i)}>第 {i+1} 格 · {state.board[i]!.obstacle?'植物障礙':speciesById(state.board[i]!.definition.speciesId).name}</button>)}</div><button className="primary full" onClick={()=>onChoose()}>原地出牌，略過換位</button><button className="outline full" onClick={onCancel}>取消，重新選擇落點</button></div>;
}
