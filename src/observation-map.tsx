import React,{useEffect,useRef} from 'react';
import L from 'leaflet';import 'leaflet/dist/leaflet.css';
import {CAMPUS_VIEW} from '../engine/campus';import {speciesById} from '../engine/species';
import type {Observation} from '../server/model';
export function ObservationMap({observations}:{observations:Observation[]}){
 const container=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),markers=useRef<L.LayerGroup|null>(null);
 useEffect(()=>{if(!container.current)return;const m=L.map(container.current).fitBounds([[CAMPUS_VIEW.south,CAMPUS_VIEW.west],[CAMPUS_VIEW.north,CAMPUS_VIEW.east]]);map.current=m;
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(m);markers.current=L.layerGroup().addTo(m);
 const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(container.current);return()=>{observer.disconnect();m.remove();map.current=null;markers.current=null;};},[]);
 useEffect(()=>{const group=markers.current;if(!group)return;group.clearLayers();const points:L.LatLngTuple[]=[];
 for(const o of observations){if(!o.location)continue;const {lat,lng,accuracy}=o.location;points.push([lat,lng]);const label=document.createElement('div');label.textContent=`${speciesById(o.speciesId).name} · ${new Date(o.at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})} · ±${Math.round(accuracy)}m${o.locationFlags?.length?' · 位置待核對':''}`;L.circleMarker([lat,lng],{radius:7,color:o.verification?'#226749':'#a87a1f',fillOpacity:.7}).bindPopup(label).addTo(group);L.circle([lat,lng],{radius:Math.min(accuracy,500),weight:1,opacity:.25,fillOpacity:.03}).addTo(group);}
 if(points.length)map.current?.fitBounds(L.latLngBounds(points).pad(.2),{maxZoom:17});},[observations]);
 return <div ref={container} className="observation-map" role="region" aria-label="私人觀察地圖"/>;
}
