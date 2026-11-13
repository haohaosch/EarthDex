import {useEffect,useRef,useState} from 'react';
import type {BattleState} from '../engine/types';
import {BattlePresenter,type Presentation} from './battle-presentation';
export function useBattlePresentation(key:string,state:BattleState|null){
 const[view,setView]=useState<Presentation>({key,state,frame:null,animating:false});
 const[reducedMotion,setReducedMotion]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 const presenter=useRef<BattlePresenter|null>(null);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReducedMotion(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{const instance=new BattlePresenter(setView);presenter.current=instance;return()=>{instance.dispose();presenter.current=null;};},[]);
 useEffect(()=>{presenter.current?.update(key,state,reducedMotion);},[key,state,reducedMotion]);
 if(view.key!==key||state&&!view.state)return {key,state,frame:null,animating:false};
 const behind=!!state&&!!view.state&&state.moves.length>view.state.moves.length;
 return {...view,animating:!reducedMotion&&(view.animating||behind)};
}
