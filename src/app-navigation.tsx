import React from 'react';
import {Compass,BookOpen,Camera,Layers,Swords} from 'lucide-react';
export const APP_NAV=[{id:'home',label:'探索總覽',icon:Compass},{id:'dex',label:'生物圖鑑',icon:BookOpen},{id:'explore',label:'野外探索',icon:Camera},{id:'cards',label:'卡牌收藏',icon:Layers},{id:'battle',label:'生態對戰',icon:Swords}];
export function AppNavigation({page,onNavigate}:{page:string;onNavigate:(page:string)=>void}){
 return <nav className="app-bottom-nav" aria-label="主要導覽">{APP_NAV.map(({id,label,icon:Icon})=><button key={id} className={`${page===id?'active ':''}${id==='explore'?'explore-action':''}`} aria-current={page===id?'page':undefined} onClick={()=>onNavigate(id)}><span className="nav-icon"><Icon size={22} aria-hidden="true"/></span><span>{label}</span></button>)}</nav>;
}
