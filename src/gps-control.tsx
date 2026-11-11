import React,{useRef,useState} from 'react';
import type {GeoPoint} from '../engine/observation-policy';
export function GpsControl({onChange,disabled}:{onChange:(location:GeoPoint|null)=>void;disabled:boolean}){
 const[status,setStatus]=useState('尚未定位；可略過，照片仍會保存。'),[busy,setBusy]=useState(false);const generation=useRef(0);
 const locate=()=>{if(!navigator.geolocation){setStatus('此瀏覽器不支援定位，可略過。');return;}setBusy(true);setStatus('正在取得定位…');const version=++generation.current;
 navigator.geolocation.getCurrentPosition(p=>{if(version!==generation.current)return;setBusy(false);const location={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,measuredAt:new Date(p.timestamp).toISOString()};onChange(location);setStatus(`定位精度 ±${Math.round(location.accuracy)} m${location.accuracy>100?'，精度不足，位置將標記待核對':''}；只保存在私人觀察。`);},e=>{if(version!==generation.current)return;setBusy(false);onChange(null);setStatus(e.code===1?'未授權定位；可以繼續拍照，不會建立假座標。':e.code===3?'定位逾時，請到開闊處重試，或略過。':'無法取得位置，請重試或略過。');},{enableHighAccuracy:true,timeout:10000,maximumAge:0});};
 return <div className="gps-control"><strong>觀察位置（選用）</strong><p role="status">{status}</p><button className="outline small" disabled={disabled||busy} onClick={locate}>授權並取得目前位置</button><button className="text-link" disabled={disabled} onClick={()=>{generation.current++;setBusy(false);onChange(null);setStatus('已略過定位，不保存座標。');}}>略過／移除定位</button></div>;
}
