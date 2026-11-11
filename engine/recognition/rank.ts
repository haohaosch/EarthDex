export interface Reference {speciesId:string;vector:number[];source:string;license:string;artist:string}
export interface ReferenceBank {version:string;model:{id:string;revision:string;license:string;source:string};dimensions:number;minSimilarity:number;minMargin:number;references:Reference[];textPrototypes?:{speciesId:string;vector:number[]}[];imageWeight?:number;textWeight?:number;textScale?:number;generatedAt:string}
export interface Candidate {speciesId:string;similarity:number}
export interface Recognition {status:'identified'|'uncertain';speciesId:string|null;similarity:number;margin:number;modelVersion:string;candidates:Candidate[];lowConfidence:boolean;selectionPolicy:'highest'}
export function normalizedVector(input:ArrayLike<number>,dimensions=512):number[]{if(input.length!==dimensions)throw Error('影像特徵格式不正確，請重新辨識');const values=Array.from(input);if(values.some(v=>!Number.isFinite(v)))throw Error('影像特徵無效');const norm=Math.hypot(...values);if(norm<0.01)throw Error('影像特徵不足，請重新拍攝');return values.map(v=>v/norm);}
export function rankSpecies(input:ArrayLike<number>,bank:ReferenceBank):Recognition{
 const vector=normalizedVector(input,bank.dimensions),scores=new Map<string,number>();
 for(const ref of bank.references){if(ref.vector.length!==vector.length)continue;let similarity=0;for(let i=0;i<vector.length;i++)similarity+=vector[i]*ref.vector[i];scores.set(ref.speciesId,Math.max(scores.get(ref.speciesId)??-1,similarity));}
 let unsupportedPreferred=false;
 if(bank.textPrototypes){let best=-Infinity,bestId='';for(const text of bank.textPrototypes){let value=0;for(let i=0;i<vector.length;i++)value+=vector[i]*text.vector[i];if(value>best){best=value;bestId=text.speciesId;}}unsupportedPreferred=!!bestId&&!scores.has(bestId);for(const text of bank.textPrototypes){const image=scores.get(text.speciesId);if(image===undefined)continue;let similarity=0;for(let i=0;i<vector.length;i++)similarity+=vector[i]*text.vector[i];scores.set(text.speciesId,(bank.imageWeight??1)*image+(bank.textWeight??0)*(bank.textScale??1)*similarity);}}
 const candidates=[...scores].map(([speciesId,similarity])=>({speciesId,similarity})).sort((a,b)=>b.similarity-a.similarity||a.speciesId.localeCompare(b.speciesId)).slice(0,3);
 if(!candidates.length)throw Error('物種比對資料庫尚無可用候選');
 const similarity=candidates[0].similarity,margin=similarity-(candidates[1]?.similarity||0);
 const lowConfidence=unsupportedPreferred||similarity<bank.minSimilarity||margin<bank.minMargin;
 return {status:lowConfidence?'uncertain':'identified',speciesId:candidates[0].speciesId,similarity,margin,modelVersion:bank.version,candidates,lowConfidence,selectionPolicy:'highest'};
}
