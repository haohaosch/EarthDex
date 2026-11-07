import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {SKILLS} from '../engine/engine';import {speciesById} from '../engine/species';
import type {BattleCard} from '../engine/types';import {HandGesture} from './hand-gesture';
export function HandCard({card,selected,canSelect,onSelect,onInspect,renderCard}:{card:BattleCard;selected:boolean;canSelect:boolean;onSelect:()=>void;onInspect:()=>void;renderCard:(props:React.ButtonHTMLAttributes<HTMLButtonElement>)=>React.ReactNode}){
 const latest=useRef({canSelect,onSelect,onInspect});latest.current={canSelect,onSelect,onInspect};
 const gesture=useRef<HandGesture|null>(null);if(!gesture.current)gesture.current=new HandGesture({inspect:()=>latest.current.onInspect(),select:()=>{if(latest.current.canSelect)latest.current.onSelect();}});
 const [preview,setPreview]=useState<{left:number;top:number;width:number}|null>(null),tooltipId=useId();
 useEffect(()=>()=>gesture.current?.dispose(),[]);
 useEffect(()=>{if(!preview)return;const hide=()=>setPreview(null);window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);return()=>{window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);};},[preview]);
 const show=(button:HTMLButtonElement)=>{const box=button.getBoundingClientRect(),width=Math.min(300,window.innerWidth-24);setPreview({left:Math.max(12,Math.min(window.innerWidth-width-12,box.left+box.width/2-width/2)),top:box.top-12,width});};
 const skill=SKILLS[card.definition.skill],species=speciesById(card.definition.speciesId);
 const props:React.ButtonHTMLAttributes<HTMLButtonElement>={
  'aria-pressed':selected,'aria-describedby':preview?tooltipId:undefined,
  onPointerEnter:e=>{if(e.pointerType==='mouse')show(e.currentTarget);},
  onPointerLeave:e=>{setPreview(null);if(e.pointerType!=='mouse')gesture.current?.cancel();},
  onFocus:e=>{if(e.currentTarget.matches(':focus-visible'))show(e.currentTarget);},onBlur:()=>setPreview(null),
  onPointerDown:e=>{if(e.button!==0)return;if(e.pointerType!=='mouse')setPreview(null);gesture.current?.start({x:e.clientX,y:e.clientY},e.pointerType);},
  onPointerMove:e=>gesture.current?.move({x:e.clientX,y:e.clientY}),onPointerUp:()=>gesture.current?.release(),onPointerCancel:()=>gesture.current?.cancel(),
  onClick:e=>{if(!gesture.current?.click(e.detail===0)){e.preventDefault();e.stopPropagation();}},
  onContextMenu:e=>e.preventDefault(),onKeyDown:e=>{if(e.key==='Escape')setPreview(null);},
 };
 return <div className="hand-card-slot">{renderCard(props)}{preview&&createPortal(<div id={tooltipId} className="hand-skill-tooltip" role="tooltip" style={{left:preview.left,top:preview.top,width:preview.width}}><span>{species.name}</span><strong>{skill.name}</strong><p>{skill.description}</p><small>{canSelect?(selected?'已選擇，點戰場空格即可出牌':'點一下選牌，再點戰場空格出牌'):'輪到對手時也能查看技能'}</small></div>,document.body)}</div>;
}
