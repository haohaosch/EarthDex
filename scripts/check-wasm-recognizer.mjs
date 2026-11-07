// Test the SAME WebAssembly execution provider used by the deployed browser app.
// Native onnxruntime inference alone does not establish WASM operator support.
import * as ort from 'onnxruntime-web/wasm';
import{readFileSync,writeFileSync}from'node:fs';
import assert from 'node:assert/strict';
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
 await session.release();
}catch(e){if(process.argv.includes('--expect-unsupported')){console.log(JSON.stringify({status:'reproduced',provider:'onnxruntime-web 1.22.0 / wasm',error:String(e)}));}else{throw e;}}
