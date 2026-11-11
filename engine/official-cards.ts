import v1 from '../data/card-balance-v1.json';
import v2 from '../data/card-balance-v2.json';
import type {CardDefinition} from './types';
export const OFFICIAL_CARD_VERSION=v2.version;
/** Published immutable manifests; archived instance/battle snapshots are never rewritten. */
export function officialDefinition(speciesId:string,version=OFFICIAL_CARD_VERSION):CardDefinition {
 const manifest=version===v1.version?v1:version===v2.version?v2:null;
 if(!manifest)throw Error('不支援的卡牌平衡版本');
 const card=(manifest.cards as unknown as Record<string,CardDefinition>)[speciesId];if(!card)throw Error('此物種尚無官方卡牌定義');return structuredClone(card);
}
