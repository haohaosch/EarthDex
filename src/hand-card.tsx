import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {SKILLS} from '../engine/engine';import {speciesById} from '../engine/species';
import type {BattleCard} from '../engine/types';import {HandGesture,type HandPoint} from './hand-gesture';
export function HandCard({card,selected,canSelect,onSelect,onInspect,onDragStart,onDragMove,onDrop,onDragCancel,dragging=false,renderCard}:{card:BattleCard;selected:boolean;canSelect:boolean;onSelect:()=>void;onInspect:()=>void;onDragStart?:(point:HandPoint)=>void;onDragMove?:(point:HandPoint)=>void;onDrop?:(point:HandPoint)=>void;onDragCancel?:()=>void;dragging?:boolean;renderCard:(props:React.ButtonHTMLAttributes<HTMLButtonElement>)=>React.ReactNode}){
 const latest=useRef({canSelect,onSelect,onInspect,onDragStart,onDragMove,onDrop,onDragCancel});latest.current={canSelect,onSelect,onInspect,onDragStart,onDragMove,onDrop,onDragCancel};
 const pointerId=useRef<number|null>(null);
 const gesture=useRef<HandGesture|null>(null);if(!gesture.current)gesture.current=new HandGesture({inspect:()=>latest.current.onInspect(),select:()=>{if(latest.current.canSelect)latest.current.onSelect();},canDrag:()=>latest.current.canSelect&&!!latest.current.onDragStart,dragStart:p=>{setPreview(null);latest.current.onDragStart?.(p);},dragMove:p=>latest.current.onDragMove?.(p),drop:p=>latest.current.onDrop?.(p),dragCancel:()=>latest.current.onDragCancel?.()});
 const [preview,setPreview]=useState<{left:number;top:number;width:number}|null>(null),tooltipId=useId();
 useEffect(()=>{const cancel=()=>gesture.current?.cancel();window.addEventListener('blur',cancel);return()=>{window.removeEventListener('blur',cancel);gesture.current?.dispose();};},[]);
 useEffect(()=>{if(!canSelect&&gesture.current?.isDragging)gesture.current.cancel();},[canSelect]);
 useEffect(()=>{if(!preview)return;const hide=()=>setPreview(null);window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);return()=>{window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide);};},[preview]);
 const show=(button:HTMLButtonElement)=>{const box=button.getBoundingClientRect(),width=Math.min(300,window.innerWidth-24);setPreview({left:Math.max(12,Math.min(window.innerWidth-width-12,box.left+box.width/2-width/2)),top:box.top-12,width});};
 const skill=SKILLS[card.definition.skill],species=speciesById(card.definition.speciesId);
 const props:React.ButtonHTMLAttributes<HTMLButtonElement>={
  'aria-pressed':selected,'aria-describedby':preview?tooltipId:undefined,
  onPointerEnter:e=>{if(e.pointerType==='mouse')show(e.currentTarget);},
  onPointerLeave:e=>{setPreview(null);if(e.pointerType!=='mouse'&&!e.currentTarget.hasPointerCapture(e.pointerId))gesture.current?.cancel();},
  onFocus:e=>{if(e.currentTarget.matches(':focus-visible'))show(e.currentTarget);},onBlur:()=>setPreview(null),
  onPointerDown:e=>{if(e.button!==0||!e.isPrimary)return;pointerId.current=e.pointerId;if(e.pointerType!=='mouse')setPreview(null);e.currentTarget.setPointerCapture(e.pointerId);gesture.current?.start({x:e.clientX,y:e.clientY},e.pointerType);},
  onPointerMove:e=>{if(pointerId.current===e.pointerId)gesture.current?.move({x:e.clientX,y:e.clientY});},
  onPointerUp:e=>{if(pointerId.current!==e.pointerId)return;pointerId.current=null;gesture.current?.release({x:e.clientX,y:e.clientY});},
  onPointerCancel:()=>{pointerId.current=null;gesture.current?.cancel();},onLostPointerCapture:e=>{if(pointerId.current===e.pointerId){pointerId.current=null;gesture.current?.cancel();}},
  onClick:e=>{if(!gesture.current?.click(e.detail===0)){e.preventDefault();e.stopPropagation();}},
  onContextMenu:e=>e.preventDefault(),onKeyDown:e=>{if(e.key==='Escape'){setPreview(null);gesture.current?.cancel();}},
 };
 return <div className={`hand-card-slot ${dragging?'is-dragging':''}`}>{renderCard(props)}{preview&&createPortal(<div id={tooltipId} className="hand-skill-tooltip" role="tooltip" style={{left:preview.left,top:preview.top,width:preview.width}}><span>{species.name}</span><strong>{skill.name}</strong><p>{skill.description}</p><small>{canSelect?(selected?'已選擇，點戰場空格即可出牌':'點選出牌，或直接拖到戰場空格'):'輪到對手時也能查看技能'}</small></div>,document.body)}</div>;
}
