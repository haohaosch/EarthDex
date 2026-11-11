// Test the SAME WebAssembly execution provider used by the deployed browser app.
// Native onnxruntime inference alone does not establish WASM operator support.
import * as ort from 'onnxruntime-web/wasm';
import{readFileSync,writeFileSync}from'node:fs';
import assert from 'node:assert/strict';
import {collectObservation} from '../server/field.ts';
import {speciesById} from '../engine/species.ts';
import {newProfile} from '../server/model.ts';
import {rankSpecies} from '../engine/recognition/rank.ts';
assert.equal(JSON.parse(readFileSync('node_modules/onnxruntime-web/package.json','utf8')).version,'1.22.0');
ort.env.wasm.numThreads=1;
const config=JSON.parse(readFileSync('public/recognition-config.json','utf8'));
const path=process.argv[2]||'.sites-runtime/models/'+config.file;
try{
 const session=await ort.InferenceSession.create(readFileSync(path),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
 if(!session.inputNames.includes(config.input)||!session.outputNames.includes(config.output))throw Error('Model IO differs from deployed configuration');
 const buffer=readFileSync('.sites-runtime/models/turtle-input.f32');const pixels=new Float32Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/4);
 const output=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',pixels,[1,3,224,224])});
 const embedding=Array.from(output[session.outputNames[0]].data);if(embedding.length!==512||embedding.some(v=>!Number.isFinite(v)))throw Error('Invalid embedding');
 writeFileSync('.sites-runtime/models/wasm-output.json',JSON.stringify({model:path,input:session.inputNames[0],output:session.outputNames[0],vector:embedding}));
 const recognition=rankSpecies(embedding,JSON.parse(readFileSync('engine/recognition/reference-bank.json','utf8')));assert.equal(recognition.status,'identified');assert.equal(recognition.speciesId,'turtle');
 const report={status:'passed',provider:'onnxruntime-web 1.22.0 / wasm',host:'Node.js running the browser WASM provider; not full browser UI',model:config.id,revision:config.revision,file:config.file,dimensions:embedding.length,norm:Math.hypot(...embedding),photo:'public/media/turtle.jpg',recognition};
 writeFileSync('docs/wasm-recognition-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 const scenarios=[];
 for(const scenario of JSON.parse(readFileSync('.sites-runtime/models/scenarios.json','utf8'))){
  const buffer=readFileSync('.sites-runtime/models/'+scenario.file),pixels=new Float32Array(buffer.buffer,buffer.byteOffset,buffer.byteLength/4);
  const output=await session.run({[config.input]:new ort.Tensor('float32',pixels,[1,3,224,224])});
  const recognition=rankSpecies(output[config.output].data,JSON.parse(readFileSync('engine/recognition/reference-bank.json','utf8')));
  const p=newProfile(false);p.observations.push({id:scenario.name,speciesId:recognition.speciesId,at:new Date().toISOString(),status:'identified',region:'unknown',accuracy:null,recognition,reason:'candidate only'});
  const species=speciesById(recognition.speciesId);const wrong=(species.questions[0].answer+1)%species.questions[0].options.length;
  assert.equal(collectObservation(p,scenario.name,wrong,0).card,null);assert.equal(p.instances.length,0);
  const correct=species.questions[1%species.questions.length].answer;assert.ok(collectObservation(p,scenario.name,correct,1).card);assert.equal(p.instances.length,1);assert.equal(p.observations[0].verification,undefined);
  scenarios.push({...scenario,recognition,mintedOnlyAfterCorrectQuiz:true,scientificVerification:false});
 }
 writeFileSync('docs/evidence/recognition-scenarios.json',JSON.stringify({checkedAt:new Date().toISOString(),provider:'onnxruntime-web 1.22.0 / wasm',host:'Node, not actual browser UI',scenarios,note:'Latest user policy: highest AI candidate leads directly to quiz, even when uncertain. Blur/multi-animal/unknown detection is not claimed. These scenarios can yield game cards after a correct answer and are never scientific verification.'},null,2)+'\n');
 await session.release();
}catch(e){if(process.argv.includes('--expect-unsupported')){console.log(JSON.stringify({status:'reproduced',provider:'onnxruntime-web 1.22.0 / wasm',error:String(e)}));}else{throw e;}}
