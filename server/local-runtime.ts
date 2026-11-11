import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync,existsSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Database,Bucket} from './api';
import {handleVisitorApi} from './visitor';
const runtimePath=resolve('.sites-runtime');mkdirSync(runtimePath,{recursive:true});
const sql=new DatabaseSync(resolve(runtimePath,'earthdex.sqlite'));
sql.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY)');
if(!sql.prepare('SELECT name FROM schema_migrations WHERE name=?').get('0000')){const journal=JSON.parse(readFileSync(resolve('drizzle/meta/_journal.json'),'utf8'));for(const migration of journal.entries)sql.exec(readFileSync(resolve('drizzle/'+migration.tag+'.sql'),'utf8'));sql.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run('0000');}
const db:Database={prepare(query:string){let args:unknown[]=[];const stmt:any={bind(...values:unknown[]){args=values;return stmt;},async first(){return sql.prepare(query).get(...args as any[])||null;},async all(){return {results:sql.prepare(query).all(...args as any[])};},async run(){const r=sql.prepare(query).run(...args as any[]);return {meta:{changes:Number(r.changes)}};}};return stmt;},async batch(statements){sql.exec('BEGIN');try{const r=await Promise.all(statements.map(s=>s.run()));sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const bucket:Bucket={async put(key,body,options){const name=Buffer.from(key).toString('hex');writeFileSync(resolve(runtimePath,name),Buffer.from(body instanceof ArrayBuffer ? new Uint8Array(body) : body));writeFileSync(resolve(runtimePath,name+'.json'),JSON.stringify(options?.httpMetadata||{}));},async get(key){const name=Buffer.from(key).toString('hex'),path=resolve(runtimePath,name);if(!existsSync(path))return null;return {body:readFileSync(path),httpMetadata:JSON.parse(readFileSync(path+'.json','utf8'))};},async delete(key){const p=resolve(runtimePath,Buffer.from(key).toString('hex'));if(existsSync(p))unlinkSync(p);if(existsSync(p+'.json'))unlinkSync(p+'.json');}};
export async function localApi(req:Request){
 const cookie=req.headers.get('cookie')||'';let identity=cookie.match(/earthdex_session=([a-f0-9-]{36})/)?.[1];let setCookie='';
 if(!identity){identity=crypto.randomUUID();setCookie=`earthdex_session=${identity}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`;}
 const r=await handleVisitorApi(req,{DB:db,BUCKET:bucket,REVIEWER_IDS:process.env.EARTHDEX_REVIEWER_IDS},'local:'+identity);if(setCookie)r.headers.set('Set-Cookie',setCookie);return r;
}
