import {SourceClient,integrateSpecies,externalOccurrences} from '../server/biodiversity';
import {writeFileSync,mkdirSync} from 'node:fs';
const client=new SourceClient();const record=await integrateSpecies('sparrow',client);
const occurrences=await externalOccurrences('sparrow',{south:24.174,west:120.64,north:24.185,east:120.653},client);
const report={checkedAt:new Date().toISOString(),mock:false,record,occurrences};mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/live-sources.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ids:record.externalIds,matches:record.matches.map(m=>({provider:m.provider,status:m.status})),sources:occurrences.sources,records:occurrences.records.length}));
if(record.matches.some(m=>m.status!=='matched')||occurrences.sources.length!==2)process.exitCode=1;
