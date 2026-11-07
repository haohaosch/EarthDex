import React,{useEffect,useRef} from 'react';import {createPortal} from 'react-dom';
import type {HandPoint} from './hand-gesture';
export interface CardDrag extends HandPoint {cardId:string;matchId:string;revision:number;cell:number|null}
export function CardDragLayer({drag,renderCard,onScroll}:{drag:CardDrag;renderCard:()=>React.ReactNode;onScroll:(point:HandPoint)=>void}){
 const latest=useRef({drag,onScroll});latest.current={drag,onScroll};
 useEffect(()=>{let frame=0;const tick=()=>{const {drag,onScroll}=latest.current,edge=90,bottom=window.innerHeight-120;const speed=drag.y<edge?-Math.min(14,(edge-drag.y)/4):drag.y>bottom?Math.min(12,(drag.y-bottom)/4):0;if(speed){const before=window.scrollY;window.scrollBy(0,speed);if(window.scrollY!==before)onScroll({x:drag.x,y:drag.y});}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[]);
 return createPortal(<div className={`card-drag-layer ${drag.cell!==null?'valid-drop':''}`} aria-hidden="true" style={{left:drag.x,top:drag.y}}>{renderCard()}<span>{drag.cell!==null?'放開即可出牌':'拖到空格・放開取消'}</span></div>,document.body);
}
