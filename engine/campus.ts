import data from '../data/campus-species.json';
export interface CampusEvidence {url:string;observedAt:string;verifiedBy:string}
export interface CampusCandidate {speciesId:string;status:'candidate'|'confirmed';basis:string;evidence:CampusEvidence[]}
export const CAMPUS={...data,candidates:data.candidates as CampusCandidate[]};
/** Exploration viewport only; not a surveyed campus cadastral boundary. */
export const CAMPUS_VIEW={south:24.174,west:120.64,north:24.185,east:120.653};
export function validateCampus(){const ids=new Set<string>();for(const c of CAMPUS.candidates){if(ids.has(c.speciesId))throw Error('重複候選物種');ids.add(c.speciesId);if(c.status==='confirmed'&&!c.evidence.some(e=>e.url.startsWith('https://')&&e.observedAt&&e.verifiedBy))throw Error('校園確認缺少證據');}return true;}
