import {writeFileSync} from 'node:fs';
import {SPECIES} from '../engine/species';import {generateCard} from '../engine/engine';import traits from '../data/trait-evidence.json';
const version='official-1';
const cards=Object.fromEntries(SPECIES.map(s=>[s.id,generateCard(s.id,traits.traits.filter(t=>t.speciesId===s.id).map(t=>t.tag),version)]));
writeFileSync('data/card-balance-v1.json',JSON.stringify({version,fixedSeed:'traits-1',traitVersion:traits.version,budget:28,cards},null,2)+'\n');
