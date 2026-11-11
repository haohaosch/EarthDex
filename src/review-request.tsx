import React,{useEffect,useState} from 'react';
import {api} from './api';import type {PublicProfile} from '../server/model';
export function ReviewRequestForm({observation,mode,setProfile}:{observation:PublicProfile['observations'][number];mode:string;setProfile:(p:PublicProfile)=>void}){
 const[note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[configured,setConfigured]=useState<boolean|null>(null);
 useEffect(()=>{api<{configured:boolean}>('/review-config',{},mode).then(r=>setConfigured(r.configured)).catch(()=>setConfigured(false));},[mode]);
 const submit=async()=>{setBusy(true);setError('');try{setProfile(await api('/observations/'+observation.id+'/review',{method:'POST',body:JSON.stringify({note})},mode));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const refresh=async()=>{try{setProfile(await api('/profile',{},mode));}catch(e){setError((e as Error).message);}};
 return <section className="review-request"><h3>{observation.review?.status==='pending'?'已申請・等待審核者確認':observation.status==='rejected'?'未通過審核，可補充資料覆核':'候選結果，尚未確認'}</h3><p>模型比對分數不是辨識正確率。模糊影像、多個動物、相似種與庫外物種可能無法判定；確認前不發卡。</p>{observation.review?.status==='pending'?<p>申請時間：{observation.review.requestedAt}。稍後重新整理查看結果。<button className="text-link" onClick={refresh}>重新整理確認結果</button></p>:<>{configured===false&&<p role="status">此環境尚未配置審核員，暫不能送出申請。照片會保留在私人觀察；可先體驗既有示範對戰。</p>}<p>申請後，授權審核者可查看這筆照片及私人位置以核對物種與場域。</p><label>補充辨識線索<textarea maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="例如：拍攝環境、畫面中動物的位置"/></label><button className="primary full" disabled={busy||configured!==true} onClick={submit}>申請人工確認</button></>}{error&&<p role="alert">{error}</p>}</section>;
}
