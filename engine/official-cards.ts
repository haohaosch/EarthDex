import manifest from '../data/card-balance-v1.json';
import type {CardDefinition} from './types';
export const OFFICIAL_CARD_VERSION=manifest.version;
/** Published immutable manifest; archived instance/battle snapshots are never rewritten. */
export function officialDefinition(speciesId:string):CardDefinition {
 const card=(manifest.cards as unknown as Record<string,CardDefinition>)[speciesId];if(!card)throw Error('此物種尚無官方卡牌定義');return structuredClone(card);
}
