import {officialDefinition,OFFICIAL_CARD_VERSION} from '../engine/official-cards';
import{test,beforeEach}from'node:test';import assert from'node:assert/strict';import{DatabaseSync}from'node:sqlite';import{readFileSync}from'node:fs';
import{handleApi,type Env,type Database}from'../server/api';import{newProfile,answerQuiz,ownedDeck}from'../server/model';import{chooseAI,applyMove,createBattle,score}from'../engine/engine';import{definition,speciesById}from'../engine/species';
import bank from '../engine/recognition/reference-bank.json';
import negatives from './fixtures/non-animal-features.json';
const features=Buffer.from(new Float32Array(bank.references[0].vector).buffer).toString('base64');
let env:Env;
beforeEach(()=>{const sql=new DatabaseSync(':memory:');const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));for(const migration of journal.entries)sql.exec(readFileSync('drizzle/'+migration.tag+'.sql','utf8'));const db:Database={prepare(query){let args:any[]=[];const s:any={bind(...a:any[]){args=a;return s;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return{results:sql.prepare(query).all(...args)};},async run(){return{meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};return s;},async batch(s){return Promise.all(s.map(s=>s.run()));}};const media=new Map<string,{body:ArrayBuffer|Uint8Array;httpMetadata:any}>();env={DB:db,BUCKET:{async put(key,body,options){media.set(key,{body,httpMetadata:options?.httpMetadata||{}});},async get(key){return media.get(key)||null;},async delete(key){media.delete(key);}}};});
async function call(path:string,identity='alice',body?:any,mode='demo',method=body?'POST':'GET'){const r=await handleApi(new Request('https://earthdex.test/api'+path+(path.includes('?')?'&':'?')+'profile='+mode,{method,headers:body?{'Content-Type':'application/json','Origin':'https://earthdex.test'}:{},body:body?JSON.stringify(body):undefined}),env,identity);return {status:r.status,data:await r.json() as any};}
test('fresh profiles have no cards; demo fixtures are isolated; unauthenticated requests fail',async()=>{assert.equal((await call('/profile','alice',undefined,'real')).data.instances.length,0);const demo=(await call('/profile')).data;assert.equal(demo.instances.length,7);assert.equal(demo.observations.length,7);assert.equal(demo.demo,true);assert.equal((await call('/profile','')).status,401);assert.equal((await call('/profile','bob',undefined,'real')).data.instances.length,0);});
test('invalid and unowned decks rejected and valid deck persists across requests',async()=>{const original=(await call('/profile')).data;assert.equal((await call('/deck','alice',{ids:['fake']})).status,400);const ids=original.instances.slice(0,7).map((c:any)=>c.id);assert.equal((await call('/deck','alice',{ids})).status,200);assert.deepEqual((await call('/profile')).data.deck,ids);assert.equal((await call('/matches','alice',{mode:'ai'},'real')).status,400);});
test('direct grant bypasses are rejected and never mint instances',async()=>{const n=(await call('/profile')).data.instances.length;for(let i=0;i<3;i++)assert.equal((await call('/grant','alice',{observationId:'fake'})).status,409);assert.equal((await call('/profile')).data.instances.length,n);});
test('battle questions rotate after errors and only unlock the dex',()=>{const p=newProfile(true);p.pending.push({speciesId:'cat',attempt:0,matchId:'match',source:'battle'});const before=p.instances.length;let r=answerQuiz(p,'cat',1);assert.equal(r.correct,false);assert.equal(p.pending[0].attempt,1);assert.ok(!p.unlocks.some(u=>u.speciesId==='cat'));r=answerQuiz(p,'cat',0);assert.equal(r.correct,true);assert.equal(p.instances.length,before);assert.ok(p.unlocks.some(u=>u.speciesId==='cat'&&u.method==='battle'));assert.equal(p.pending.length,0);assert.throws(()=>answerQuiz(p,'cat',0));});
test('API never reveals correct quiz choice in GET response',async()=>{await call('/profile');const row=await env.DB.prepare('SELECT data FROM profiles WHERE id=?').bind('alice:demo').first();const p=JSON.parse(row!.data);p.pending=[{speciesId:'cat',matchId:'m',attempt:0,source:'battle'}];await env.DB.prepare('UPDATE profiles SET data=? WHERE id=?').bind(JSON.stringify(p),'alice:demo').run();const q=await call('/quiz?species=cat');assert.equal(q.data.answer,undefined);assert.equal(q.data.options.length,4);const bad=await call('/quiz','alice',{speciesId:'cat',choice:1,attempt:0});assert.equal(bad.data.correct,false);assert.equal((await call('/quiz','alice',{speciesId:'cat',choice:0,attempt:0})).status,409);const good=await call('/quiz','alice',{speciesId:'cat',choice:0,attempt:1});assert.equal(good.data.correct,true);assert.equal(good.data.profile.instances.length,7);});
test('AI match persists; server rejects stale/out-of-turn moves; settlement is idempotent',async()=>{let m=(await call('/matches','alice',{mode:'ai',difficulty:'normal'})).data;assert.ok(m.state);const first=chooseAI(m.state,'easy');const result=await call('/matches/'+m.id+'/move','alice',{...first,revision:m.revision});assert.equal(result.status,200);assert.equal((await call('/matches/'+m.id+'/move','alice',{...first,revision:m.revision})).status,409);m=result.data;while(m.state.status==='playing'){const move=chooseAI(m.state,'easy');const next=await call('/matches/'+m.id+'/move','alice',{cardId:move.cardId,cell:move.cell,revision:m.revision});assert.equal(next.status,200);m=next.data;}assert.ok(m.state.moves.length>=7&&m.state.moves.length<=100);assert.equal((await call('/matches/'+m.id)).data.state.status,'finished');assert.equal((await call('/matches/'+m.id,'bob')).status,403);const a=await call('/matches/'+m.id+'/settle','alice',{});const b=await call('/matches/'+m.id+'/settle','alice',{});assert.equal(a.data.profile.stats.matches,1);assert.equal(b.data.profile.stats.matches,1);assert.equal(b.data.profile.instances.length,7);const replay=await call('/matches/'+m.id+'/replay');assert.deepEqual(replay.data.moves.reduce(applyMove,replay.data.initial),m.state);});
test('two distinct PVP players share exact server state through nine turns and can reconnect',async()=>{let room=(await call('/matches','alice',{mode:'pvp'})).data;assert.equal(room.state,null);assert.equal((await call('/matches/'+room.id+'/join','alice',{})).status,409);const joined=await call('/matches/'+room.id+'/join','bob',{});assert.equal(joined.status,200);assert.equal(joined.data.side,1);assert.equal((await call('/matches/'+room.id+'/join','charlie',{})).status,409);let a=(await call('/matches/'+room.id,'alice')).data;let b=(await call('/matches/'+room.id,'bob')).data;assert.deepEqual(a.state.board,b.state.board);assert.deepEqual(a.state.events,b.state.events);assert.ok(a.state.hands[1].every((c:any)=>c.hidden));assert.ok(b.state.hands[0].every((c:any)=>c.hidden));assert.equal((await call('/matches/'+room.id+'/replay','alice')).status,409);let m=a;while(m.state.status==='playing'){const side=m.state.turn,move=chooseAI(m.state,'normal'),who=side===0?'alice':'bob';const other=side===0?'bob':'alice';assert.equal((await call('/matches/'+room.id+'/move',other,{...move,revision:m.revision})).status,400);const next=await call('/matches/'+room.id+'/move',who,{...move,revision:m.revision});assert.equal(next.status,200);m=next.data;const otherState=(await call('/matches/'+room.id,other)).data.state;assert.deepEqual(otherState.board,m.state.board);assert.deepEqual(otherState.events,m.state.events);assert.deepEqual(otherState.moves,m.state.moves);}assert.ok(score(m.state).reduce((a,b)=>a+b,0)<=9);assert.ok(m.state.moves.length<=100);for(const who of ['alice','bob']){const settled=await call('/matches/'+room.id+'/settle',who,{});assert.equal(settled.data.profile.instances.length,7);assert.equal(settled.data.profile.stats.matches,1);}});
test('cross-origin writes cannot mutate state',async()=>{const r=await handleApi(new Request('https://earthdex.test/api/matches',{method:'POST',headers:{Origin:'https://other.test'},body:JSON.stringify({mode:'ai'})}),env,'alice');assert.equal(r.status,403);});
test('recognized photos await the quiz and remain private and deletable',async()=>{
 const photo=readFileSync('public/media/cat.jpg');
 const req=new Request('https://earthdex.test/api/observations?species=cat&accuracy=25&lat=24.12345&lng=121.12345',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Earthdex-Features':features},body:photo});
 const response=await handleApi(req,env,'alice');assert.equal(response.status,201);const result:any=await response.json();const p=result.profile;const o=p.observations.at(-1);
 assert.equal(o.status,'identified');assert.equal(result.card,null);assert.equal(o.mediaType,'image/jpeg');assert.equal(o.hasPhoto,true);assert.equal(o.hasVideo,false);assert.equal(o.mediaKey,undefined);assert.equal(o.lat,undefined);assert.equal(o.lng,undefined);assert.equal(p.instances.length,7);assert.equal(p.attempts.length,0);
 const own=await handleApi(new Request('https://earthdex.test/api/observations/'+o.id+'/media'),env,'alice');assert.equal(own.status,200);assert.equal(own.headers.get('Content-Type'),'image/jpeg');assert.equal(own.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(Buffer.from(await own.arrayBuffer()),photo);
 assert.equal((await call('/profile')).data.observations.at(-1).hasPhoto,true);assert.equal((await call('/observations/'+o.id+'/media','bob')).status,404);assert.equal((await call('/observations/'+o.id+'/media','alice',undefined,'real')).status,404);assert.equal((await call('/observations/'+o.id+'/video')).status,404);
 const deleted=await call('/observations/'+o.id,'alice',undefined,'demo','DELETE');assert.equal(deleted.status,200);assert.equal(deleted.data.observations.length,7);assert.equal((await call('/observations/'+o.id+'/media')).status,404);
});
test('photo submissions reject videos, active content, mismatched signatures, empty and oversized bodies',async()=>{
 for(const [type,body,length] of [
  ['video/webm',new Uint8Array([1,2,3]),null],['image/svg+xml',new TextEncoder().encode('<svg/>'),null],
  ['image/jpeg',new Uint8Array([1,2,3]),null],['image/png',readFileSync('public/media/cat.jpg'),null],
  ['image/jpeg',new Uint8Array(),null],['image/jpeg',new Uint8Array(10*1024*1024+1),null],
  ['image/jpeg',readFileSync('public/media/cat.jpg'),String(10*1024*1024+1)]
 ] as const){const headers:Record<string,string>={'Content-Type':type,'X-Earthdex-Features':features};if(length)headers['Content-Length']=length;const r=await handleApi(new Request('https://earthdex.test/api/observations?species=cat',{method:'POST',headers,body}),env,'alice');assert.equal(r.status,400);}
 assert.equal((await call('/profile')).data.observations.length,7);
});
test('previously saved videos remain accessible and keep their media type',async()=>{
 await call('/profile');const row=await env.DB.prepare('SELECT data FROM profiles WHERE id=?').bind('alice:demo').first();const p=JSON.parse(row!.data);
 p.observations.push({id:'legacy-video',speciesId:'cat',at:new Date().toISOString(),status:'manual_review',region:'private',accuracy:null,mediaKey:'legacy-key',reason:'legacy recording'});
 await env.BUCKET!.put('legacy-key',new Uint8Array([1,2,3]),{httpMetadata:{contentType:'video/webm'}});await env.DB.prepare('UPDATE profiles SET data=? WHERE id=?').bind(JSON.stringify(p),'alice:demo').run();
 const o=(await call('/profile')).data.observations.at(-1);assert.equal(o.hasVideo,true);assert.equal(o.hasPhoto,false);assert.equal(o.mediaType,'video/webm');
 for(const suffix of ['/video','/media']){const r=await handleApi(new Request('https://earthdex.test/api/observations/legacy-video'+suffix),env,'alice');assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'video/webm');}
 assert.equal((await call('/observations/legacy-video/media','bob')).status,404);
});
test('resigning never creates new quiz eligibility',async()=>{const m=(await call('/matches','alice',{mode:'ai'})).data;assert.equal((await call('/matches/'+m.id+'/resign','alice',{})).data.state.status,'finished');const r=await call('/matches/'+m.id+'/settle','alice',{});assert.equal(r.data.profile.pending.length,0);});

test('photo -> AI highest candidate -> question -> fixed card; wrong answers and retries never grant extra cards',async()=>{
 const bytes=readFileSync('public/media/deer.jpg');
 const request=()=>new Request('https://earthdex.test/api/observations?profile=real',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Earthdex-Features':features},body:bytes});
 const r=await handleApi(request(),env,'alice');assert.equal(r.status,201);const result:any=await r.json();assert.equal(result.recognition.status,'identified');assert.equal(result.recognition.speciesId,result.recognition.candidates[0].speciesId);assert.equal(result.profile.instances.length,0);assert.equal(result.profile.observations[0].status,'identified');assert.equal(result.card,null);assert.equal(result.profile.unlocks.length,0);
 const id=result.observationId;assert.equal((await call('/field-quiz?observation='+id,'alice',undefined,'real')).status,200);
 assert.equal((await call('/collect','alice',{observationId:id},'real')).status,400);
 const duplicateBefore:any=await (await handleApi(request(),env,'alice')).json();assert.equal(duplicateBefore.observationId,id);assert.equal(duplicateBefore.card,null);assert.equal(duplicateBefore.alreadyCollected,false);
 const q=(await call('/field-quiz?observation='+id,'alice',undefined,'real')).data;assert.equal(q.answer,undefined);assert.equal(q.attempt,0);
 const species=speciesById(result.recognition.speciesId);const wrong=(species.questions[0].answer+1)%q.options.length;
 const bad=await call('/collect','alice',{observationId:id,choice:wrong,attempt:0},'real');assert.equal(bad.data.correct,false);assert.equal(bad.data.profile.instances.length,0);assert.equal(bad.data.profile.unlocks.length,0);
 assert.equal((await call('/collect','alice',{observationId:id,choice:species.questions[0].answer,attempt:0},'real')).status,400);
 const next=(await call('/field-quiz?observation='+id,'alice',undefined,'real')).data;assert.equal(next.attempt,1);
 const good=await call('/collect','alice',{observationId:id,choice:species.questions[1%species.questions.length].answer,attempt:1},'real');assert.equal(good.status,200);assert.equal(good.data.correct,true);assert.equal(good.data.profile.instances.length,1);assert.equal(good.data.profile.unlocks[0].method,'field');assert.equal(good.data.profile.observations[0].status,'collected');
 const repeated=await call('/collect','alice',{observationId:id},'real');assert.equal(repeated.data.profile.instances.length,1);assert.deepEqual(repeated.data.card,good.data.card);assert.equal(repeated.data.alreadyCollected,true);
 const duplicate:any=await (await handleApi(request(),env,'alice')).json();assert.equal(duplicate.observationId,id);assert.equal(duplicate.profile.observations.length,1);assert.equal(duplicate.alreadyCollected,true);assert.deepEqual(duplicate.card,good.data.card);
 assert.deepEqual((await call('/profile','alice',undefined,'real')).data.instances[0].definition,good.data.card.definition);
 assert.equal((await call('/collect','bob',{observationId:id,choice:0,attempt:0},'real')).status,400);
});
test('latest AI policy offers low-confidence candidate quiz, requires correct answer and never calls it scientific confirmation',async()=>{
 const vector=Buffer.from(new Float32Array(negatives[0].vector).buffer).toString('base64');
 const r=await handleApi(new Request('https://earthdex.test/api/observations?profile=real',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Earthdex-Features':vector},body:readFileSync('public/media/forest.jpg')}),env,'alice');assert.equal(r.status,201);const result:any=await r.json();assert.equal(result.recognition.status,'uncertain');assert.equal(result.profile.observations[0].status,'identified');assert.equal(result.profile.instances.length,0);
 const id=result.observationId,q=(await call('/field-quiz?observation='+id,'alice',undefined,'real')).data;const species=speciesById(q.speciesId);assert.equal(q.speciesId,result.recognition.candidates[0].speciesId);assert.equal(q.answer,undefined);
 const bad=await call('/collect','alice',{observationId:id,speciesId:'cat',attempt:0,choice:(species.questions[0].answer+1)%4},'real');assert.equal(bad.data.card,null);
 const good=await call('/collect','alice',{observationId:id,speciesId:'cat',attempt:1,choice:species.questions[1%species.questions.length].answer},'real');assert.equal(good.status,200);assert.equal(good.data.card.speciesId,species.id);assert.equal(good.data.card.definition.version,OFFICIAL_CARD_VERSION);assert.equal(good.data.profile.observations[0].verification,undefined);
 const stats=(await call('/observation-map','alice',undefined,'real')).data.stats;assert.equal(stats.verifiedObservations,0);assert.equal(stats.gameCollectedObservations,1);
 assert.equal((await call('/observations/'+id+'/review','alice',{note:''},'real')).status,410);
});
test('previously identified observations require a question and are collected once per owner',async()=>{
 await call('/profile','alice',undefined,'real');const row=await env.DB.prepare('SELECT data FROM profiles WHERE id=?').bind('alice:real').first();const p=JSON.parse(row!.data);
 p.observations.push({id:'older-discovery',speciesId:'sparrow',at:new Date().toISOString(),status:'identified',region:'private',accuracy:null,recognition:{speciesId:'sparrow',similarity:.2,margin:0,modelVersion:'older-model'},reason:'legacy'});await env.DB.prepare('UPDATE profiles SET data=? WHERE id=?').bind(JSON.stringify(p),'alice:real').run();
 assert.equal((await call('/collect','alice',{observationId:'older-discovery'},'real')).status,400);
 const collected=await call('/collect','alice',{observationId:'older-discovery',choice:speciesById('sparrow').questions[0].answer,attempt:0},'real');assert.equal(collected.status,200);assert.equal(collected.data.profile.instances.length,1);assert.equal(collected.data.profile.attempts.length,1);assert.equal(collected.data.profile.observations[0].status,'collected');const retry=await call('/collect','alice',{observationId:'older-discovery'},'real');assert.deepEqual(retry.data.card,collected.data.card);
});
test('legacy acquired snapshots are retained without read-time writes while official abilities are projected',async()=>{
 await call('/profile');const row=await env.DB.prepare('SELECT data FROM profiles WHERE id=?').bind('alice:demo').first();const p=JSON.parse(row!.data);p.instances[0].definition={...definition(p.instances[0].speciesId),skill:'neutral',values:[7,7,7,7]};
 await env.DB.prepare('UPDATE profiles SET data=? WHERE id=?').bind(JSON.stringify(p),'alice:demo').run();
 const before=await env.DB.prepare('SELECT data,revision FROM profiles WHERE id=?').bind('alice:demo').first();const first=(await call('/profile')).data;assert.equal(first.instances[0].definition.version,OFFICIAL_CARD_VERSION);assert.deepEqual(first.instances[0].acquiredDefinition,p.instances[0].definition);
 const second=(await call('/profile')).data;assert.deepEqual(second.instances[0],first.instances[0]);assert.equal(second.revision,first.revision);
 assert.deepEqual(await env.DB.prepare('SELECT data,revision FROM profiles WHERE id=?').bind('alice:demo').first(),before);
});
test('manual species claims, missing feature vectors and forged observation IDs cannot mint a card',async()=>{
 const r=await handleApi(new Request('https://earthdex.test/api/observations?species=cat&profile=real',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:readFileSync('public/media/cat.jpg')}),env,'alice');assert.equal(r.status,400);
 assert.equal((await call('/collect','alice',{observationId:'fake',choice:0,attempt:0},'real')).status,400);assert.equal((await call('/profile','alice',undefined,'real')).data.instances.length,0);
});

test('public visitors get secure isolated demo sessions and cannot enter formal profiles or another match',async()=>{
 const {handleVisitorApi}=await import('../server/visitor');
 const request=(path:string,cookie='',body?:unknown,account='')=>new Request('https://earthdex.test/api'+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(account?{'oai-authenticated-user-id':account}:{}),...(body?{'Content-Type':'application/json',Origin:'https://earthdex.test'}:{})},body:body?JSON.stringify(body):undefined});
 const a=await handleVisitorApi(request('/session'),env),b=await handleVisitorApi(request('/session'),env);
 assert.deepEqual(await a.json(),{authenticated:false,guest:true,userId:null});assert.match(a.headers.get('Set-Cookie')!,/HttpOnly; Secure; SameSite=Lax; Path=\//);assert.equal(a.headers.get('Cache-Control'),'private, no-store');
 const cookieA=a.headers.get('Set-Cookie')!.split(';')[0],cookieB=b.headers.get('Set-Cookie')!.split(';')[0];assert.notEqual(cookieA,cookieB);
 const profileA=await handleVisitorApi(request('/profile?profile=demo',cookieA),env);const p:any=await profileA.json();assert.equal(p.instances.length,7);assert.equal(profileA.headers.get('Set-Cookie'),null);
 assert.equal((await handleVisitorApi(request('/profile?profile=real',cookieA),env)).status,401);
 const changed=await handleVisitorApi(request('/deck?profile=demo',cookieA,{ids:p.instances.slice(0,7).map((c:any)=>c.id)}),env);assert.equal(changed.status,200);
 const profileB:any=await (await handleVisitorApi(request('/profile?profile=demo',cookieB),env)).json();assert.deepEqual(profileB.deck,p.deck);
 const mine:any=await (await handleVisitorApi(request('/matches?profile=demo',cookieA,{mode:'ai'}),env)).json();assert.ok(mine.id);assert.equal((await handleVisitorApi(request('/matches/'+mine.id+'?profile=demo',cookieB),env)).status,403);
 const authenticated=await handleVisitorApi(request('/profile?profile=real',cookieA,undefined,'signed-in-owner'),env);assert.equal(authenticated.status,200);assert.equal((await authenticated.json() as any).instances.length,0);assert.equal(authenticated.headers.get('Set-Cookie'),null);
 const session=await handleVisitorApi(request('/session',cookieA,undefined,'signed-in-owner'),env);assert.deepEqual(await session.json(),{authenticated:true,guest:false,userId:'signed-in-owner'});
 const bad=await handleVisitorApi(request('/session','__Host-earthdex_guest=invalid'),env);assert.match(bad.headers.get('Set-Cookie')!,/__Host-earthdex_guest=[a-f0-9-]{36};/);
});
test('public demonstration photos stay in the visitor namespace and cross-origin writes fail',async()=>{
 const {handleVisitorApi}=await import('../server/visitor');
 const visit=await handleVisitorApi(new Request('https://earthdex.test/api/session'),env),cookie=visit.headers.get('Set-Cookie')!.split(';')[0];
 const photo=await handleVisitorApi(new Request('https://earthdex.test/api/observations?profile=demo',{method:'POST',headers:{Cookie:cookie,'Content-Type':'image/jpeg','X-Earthdex-Features':features,Origin:'https://earthdex.test'},body:readFileSync('public/media/cat.jpg')}),env);assert.equal(photo.status,201);const result:any=await photo.json();
 const url='https://earthdex.test/api/observations/'+result.observationId+'/media?profile=demo';assert.equal((await handleVisitorApi(new Request(url,{headers:{Cookie:cookie}}),env)).status,200);assert.equal((await handleVisitorApi(new Request(url),env)).status,404);assert.equal((await handleVisitorApi(new Request(url,{headers:{'oai-authenticated-user-id':'signed-in-owner'}}),env)).status,404);
 const denied=await handleVisitorApi(new Request('https://earthdex.test/api/deck?profile=demo',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.test','Content-Type':'application/json'},body:JSON.stringify({ids:[]})}),env);assert.equal(denied.status,403);
});

test('archived pending AI observations resume directly without an admin role or rewriting the old review history',async()=>{
 await call('/profile','alice',undefined,'real');const row=await env.DB.prepare('SELECT data FROM profiles WHERE id=?').bind('alice:real').first();const p=JSON.parse(row!.data);
 p.observations.push({id:'pending-old',speciesId:'sparrow',at:new Date().toISOString(),status:'manual_review',region:'unknown',accuracy:null,recognition:{speciesId:'sparrow',similarity:.1,margin:0,modelVersion:'legacy'},reason:'old pending',review:{id:'old-review',status:'pending',note:'archived',history:[]}});await env.DB.prepare('UPDATE profiles SET data=? WHERE id=?').bind(JSON.stringify(p),'alice:real').run();
 assert.equal((await call('/profile','alice',undefined,'real')).data.observations[0].status,'identified');const quiz=(await call('/field-quiz?observation=pending-old','alice',undefined,'real')).data;assert.equal(quiz.speciesId,'sparrow');const good=await call('/collect','alice',{observationId:'pending-old',attempt:0,choice:0},'real');assert.equal(good.status,200);assert.equal(good.data.profile.observations[0].review.id,'old-review');assert.equal(good.data.profile.observations[0].verification,undefined);
 assert.equal((await call('/reviews','alice')).status,404);
});
test('GPS is private, invalid GPS creates no observation, and friend/public projections enforce permissions',async()=>{
 const submit=(location:any)=>handleApi(new Request('https://earthdex.test/api/observations?profile=real',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Earthdex-Features':features,'X-Earthdex-Location':JSON.stringify(location)},body:readFileSync('public/media/bulbul.jpg')}),env,'alice');
 assert.equal((await submit({lat:999,lng:120,accuracy:10,measuredAt:new Date().toISOString()})).status,400);
 assert.equal((await call('/profile','alice',undefined,'real')).data.observations.length,0);
 const response=await submit({lat:24.17912,lng:120.64612,accuracy:10,measuredAt:new Date().toISOString()});assert.equal(response.status,201);const result:any=await response.json();const id=result.observationId;
 assert.equal(result.profile.observations[0].location.lat,24.17912);assert.equal(result.profile.observations[0].privacy.visibility,'private');
 assert.equal((await call('/shared?owner=alice%3Areal','bob')).status,404);
 assert.equal((await call('/observations/'+id+'/privacy','bob',{visibility:'public',shareWith:[]},'real')).status,404);
 assert.equal((await call('/observations/'+id+'/privacy','alice',{visibility:'friends',shareWith:['bob']},'real')).status,200);
 const friends=await call('/shared?owner=alice%3Areal','bob');assert.equal(friends.status,200);assert.ok(!JSON.stringify(friends.data).includes('24.17912'));assert.equal((await call('/shared?owner=alice%3Areal','charlie')).status,404);
 assert.equal((await call('/observations/'+id+'/privacy','alice',{visibility:'public',shareWith:[]},'real')).status,200);
 assert.equal((await call('/shared?owner=alice%3Areal','charlie')).status,200);
 assert.equal((await call('/campus/stats','charlie')).data.verifiedObservations,0);
 assert.equal((await call('/observation-map?region=fcu-vicinity','alice',undefined,'real')).data.observations.length,1);
 assert.equal((await call('/observations/'+id+'/privacy','alice',{visibility:'private',shareWith:[]},'real')).status,200);
 assert.equal((await call('/shared?owner=alice%3Areal','bob')).status,404);
});
test('deleting an observation retains grant identity and its duplicate-photo fingerprint',async()=>{
 const photo=readFileSync('public/media/egret.jpg'),request=()=>new Request('https://earthdex.test/api/observations?profile=real',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Earthdex-Features':features},body:photo});
 const first:any=await (await handleApi(request(),env,'alice')).json();const q=(await call('/field-quiz?observation='+first.observationId,'alice',undefined,'real')).data;
 const species=speciesById(q.speciesId);const collected=await call('/collect','alice',{observationId:first.observationId,attempt:q.attempt,choice:species.questions[q.attempt%species.questions.length].answer},'real');assert.equal(collected.status,200);
 assert.equal((await call('/observations/'+first.observationId,'alice',undefined,'real','DELETE')).status,200);assert.equal((await handleApi(request(),env,'alice')).status,409);assert.equal((await call('/profile','alice',undefined,'real')).data.instances.length,1);
});
test('new AI and PVP battles use a consistent official version, stale waiting rooms cannot mix versions',async()=>{
 const ai=(await call('/matches','alice',{mode:'ai'})).data;assert.equal(ai.state.balanceVersion,OFFICIAL_CARD_VERSION);assert.ok([...ai.state.hands.flat(),...ai.state.board.filter(Boolean)].filter((c:any)=>!c.hidden&&!c.obstacle).every((c:any)=>c.definition.version===OFFICIAL_CARD_VERSION));
 const room=(await call('/matches','alice',{mode:'pvp'})).data;
 const row=await env.DB.prepare('SELECT data FROM matches WHERE id=?').bind(room.id).first();const old=JSON.parse(row!.data);delete old.balanceVersion;await env.DB.prepare('UPDATE matches SET data=? WHERE id=?').bind(JSON.stringify(old),room.id).run();
 assert.equal((await call('/matches/'+room.id+'/join','bob',{})).status,409);
 assert.equal(JSON.parse((await env.DB.prepare('SELECT data FROM matches WHERE id=?').bind(room.id).first())!.data).state,null);
});
test('PVP concealment and Predator authorization apply to response bodies and historical snapshots',async()=>{
 const room=(await call('/matches','alice',{mode:'pvp'})).data;await call('/matches/'+room.id+'/join','bob',{});
 // Seed a trusted server-only fixture; clients cannot supply definitions through the move endpoint.
 const row=await env.DB.prepare('SELECT data,revision FROM matches WHERE id=?').bind(room.id).first();const match=JSON.parse(row!.data);
 const deck=(prefix:string,ids:string[])=>ids.map((id,i)=>({id:prefix+i,definition:officialDefinition(id,'official-2')}));
 match.state=createBattle([deck('p0:',['kingfisher','sparrow','butterfly','gecko','swallow']),deck('p1:',['deer','turtle','magpie','toad','macaque'])],1,0);match.state.hands[1][0].definition.values=[10,10,10,10];match.initial=structuredClone(match.state);
 await env.DB.prepare('UPDATE matches SET data=? WHERE id=?').bind(JSON.stringify(match),room.id).run();
 const initial=(await call('/matches/'+room.id,'alice')).data;assert.ok(initial.state.hands[1].every((c:any)=>c.hidden&&c.definition.speciesId==='hidden'));assert.equal(initial.state.handReveals.length,0);
 assert.equal((await call('/matches/'+room.id+'/replay','alice')).status,409);
 const played=await call('/matches/'+room.id+'/move','alice',{cardId:'p0:0',cell:0,revision:initial.revision});assert.equal(played.status,200);assert.equal(played.data.state.handReveals.length,1);assert.ok(played.data.state.handReveals[0].cards.some((c:any)=>c.hidden));
 const other=(await call('/matches/'+room.id,'bob')).data;assert.equal(other.state.handReveals.length,0);assert.ok(other.state.turnSnapshots.every((snap:any)=>snap.hands[0].every((c:any)=>c.hidden)));assert.equal((await call('/matches/'+room.id,'charlie')).status,403);
 const flipped=await call('/matches/'+room.id+'/move','bob',{cardId:'p1:0',cell:1,revision:other.revision});assert.equal(flipped.status,200);assert.equal(flipped.data.state.board[0].skillDisabled,true);assert.equal((await call('/matches/'+room.id,'alice')).data.state.handReveals.length,0);
});
test('v3 PVP move API validates and persists explicit swap targets while masking historical enemy hands',async()=>{
 const room=(await call('/matches','alice',{mode:'pvp'})).data;await call('/matches/'+room.id+'/join','bob',{});
 const row=await env.DB.prepare('SELECT data FROM matches WHERE id=?').bind(room.id).first();const match=JSON.parse(row!.data);
 const ids=['sparrow','magpie','turtle','gecko','swallow','cat','kingfisher'],deck=(side:number)=>ids.map((id,i)=>({id:`${side}:${i}`,definition:officialDefinition(id)}));
 match.state=createBattle([deck(0),deck(1)],1,0);match.state.board.fill(null);const victim=match.state.hands[1].shift();victim.definition.skill='neutral';victim.definition.values=[1,1,1,1];match.state.board[1]=victim;
 const incoming=match.state.hands[0][0];incoming.definition.skill='swap';incoming.definition.values=[8,8,8,8];match.initial=structuredClone(match.state);
 await env.DB.prepare('UPDATE matches SET data=? WHERE id=?').bind(JSON.stringify(match),room.id).run();const current=(await call('/matches/'+room.id,'alice')).data;
 assert.equal((await call('/matches/'+room.id+'/move','alice',{cardId:incoming.id,cell:4,swapCell:8,revision:current.revision})).status,400);
 assert.equal((await call('/matches/'+room.id,'alice')).data.revision,current.revision);
 const moved=await call('/matches/'+room.id+'/move','alice',{cardId:incoming.id,cell:4,swapCell:1,revision:current.revision,values:[10,10,10,10],skill:'overrun'});assert.equal(moved.status,200);
 assert.equal(moved.data.state.board[1].id,incoming.id);assert.equal(moved.data.state.board[1].definition.skill,'swap');assert.deepEqual(moved.data.state.board[1].definition.values,[8,8,8,8]);assert.equal(moved.data.state.moves[0].swapCell,1);
 const other=(await call('/matches/'+room.id,'bob')).data.state;assert.ok(other.hands[0].every((c:any)=>c.hidden));assert.ok(other.turnSnapshots.every((t:any)=>t.hands[0].every((c:any)=>c.hidden)));assert.equal((await call('/matches/'+room.id+'/replay','alice')).status,409);
});
test('seven-card water-themed AI starts successfully and existing demo five-card selection upgrades without granting cards',async()=>{
 await call('/profile');const row=await env.DB.prepare('SELECT data FROM profiles WHERE id=?').bind('alice:demo').first();const p=JSON.parse(row!.data);p.deck=p.deck.slice(0,5);const before=structuredClone(p.instances);
 await env.DB.prepare('UPDATE profiles SET data=? WHERE id=?').bind(JSON.stringify(p),'alice:demo').run();const loaded=(await call('/profile')).data;assert.equal(loaded.deck.length,7);assert.equal(loaded.instances.length,7);
 const stored=JSON.parse((await env.DB.prepare('SELECT data FROM profiles WHERE id=?').bind('alice:demo').first())!.data);assert.deepEqual(stored.instances,before);assert.equal(stored.deck.length,7);
 const ai=await call('/matches','alice',{mode:'ai',theme:'global',difficulty:'hard'});assert.equal(ai.status,201);assert.equal(ai.data.state.ruleVersion,'tactics-0.3');assert.equal(ai.data.state.balanceVersion,'official-3');
});
