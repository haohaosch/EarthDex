import React,{useEffect,useState} from 'react';
import {api} from './api';
import type {SpeciesRecord} from '../server/biodiversity';
export function SourceDetails({id,mode}:{id:string;mode:string}){
 const[record,setRecord]=useState<SpeciesRecord|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;setRecord(null);setError('');api<SpeciesRecord>('/species/'+id,{},mode).then(r=>{if(active)setRecord(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id,mode]);
 return <section className="source-details"><h3>物種資料來源</h3>{error?<p role="alert">{error}</p>:!record?<p role="status">正在查詢分類名錄…本地介紹仍可閱讀。</p>:<><p>英文名稱：{record.names.en||'未知'}<br/>正式學名：{record.names.scientific}<br/>分類：{Object.values(record.classification).join(' / ')||'未知'}<br/>保育資訊：未知（尚未完成來源審訂）</p>{record.matches.map(m=><p key={m.provider}><a href={m.source.url} target="_blank" rel="noreferrer">{m.provider} ↗</a> · {m.status==='matched'?'學名符合':m.status==='synonym'?'同物異名待核對':m.status==='unavailable'?'暫時無法取得':'匹配不確定'}{m.id&&` · ${m.id}`}<small> 查詢 {m.source.retrievedAt.slice(0,10)} / {m.source.version}{m.source.stale?'（離線舊快取）':''}</small>{m.nativeStatus&&<small> 臺灣屬性：{m.nativeStatus.value}；依據：{m.nativeStatus.basis}</small>}</p>)}</>}</section>;
}
