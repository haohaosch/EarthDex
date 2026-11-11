import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {SPECIES} from '../engine/species';import {generateCard} from '../engine/engine';
import traits1 from '../data/trait-evidence.json';import traits2 from '../data/trait-evidence-v2.json';
const version=process.argv[2]||'official-2',traits=version==='official-1'?traits1:version==='official-2'?traits2:null;
if(!traits)throw Error('新增平衡版本前請明確提供對應的來源與版本設定');
const cards=Object.fromEntries(SPECIES.map(s=>[s.id,generateCard(s.id,traits.traits.filter(t=>t.speciesId===s.id).map(t=>t.tag),version)]));
const output=JSON.stringify({version,fixedSeed:'traits-1',traitVersion:traits.version,budget:28,cards},null,2)+'\n',file=version==='official-1'?'data/card-balance-v1.json':'data/card-balance-v2.json';
if(existsSync(file)&&readFileSync(file,'utf8')!==output)throw Error('已發布能力不可原地改寫；請建立新的平衡版本');
if(!existsSync(file))writeFileSync(file,output);console.log('Verified '+file);
