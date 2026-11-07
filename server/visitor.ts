import {handleApi,type Env} from './api';
const COOKIE='__Host-earthdex_guest';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
/** Anonymous visitors own isolated demo data; account identity always comes from Sites. */
export async function handleVisitorApi(request:Request,env:Env,authenticatedId=request.headers.get('oai-authenticated-user-id')||''):Promise<Response>{
 const url=new URL(request.url),guest=!authenticatedId;
 const supplied=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 const token=supplied&&UUID.test(supplied)?supplied:crypto.randomUUID();
 const identity=authenticatedId||'guest:'+token;
 let response:Response;
 if(url.pathname==='/api/session')response=new Response(JSON.stringify({authenticated:!guest,guest}),{status:request.method==='GET'?200:405,headers:{'Content-Type':'application/json; charset=utf-8'}});
 else if(guest&&url.searchParams.get('profile')==='real')response=new Response(JSON.stringify({error:'正式檔案需要登入；你可以免登入體驗公開展示版。'}),{status:401,headers:{'Content-Type':'application/json; charset=utf-8'}});
 else response=await handleApi(request,env,identity);
 response.headers.set('Cache-Control','private, no-store');response.headers.set('Vary','Cookie');
 if(guest&&token!==supplied)response.headers.set('Set-Cookie',`${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
 return response;
}
