import {applyMove} from './engine';import type {BattleState,Move} from './types';
/** New battles use recorded turn snapshots; old replays retain the original deterministic path. */
export function replayAt(initial:BattleState,moves:Move[],index:number,final?:BattleState){
 if(!Number.isInteger(index)||index<0||index>moves.length)throw Error('重播步數無效');if(index===0)return initial;
 const snap=final?.turnSnapshots?.find(t=>t.moveNumber===index);
 if(snap&&final){const {moveNumber,eventCount,...fields}=snap;return {...final,...fields,moves:moves.slice(0,index),events:final.events.slice(0,eventCount),turnSnapshots:final.turnSnapshots!.filter(t=>t.moveNumber<=index)} as BattleState;}
 return moves.slice(0,index).reduce(applyMove,initial);
}
