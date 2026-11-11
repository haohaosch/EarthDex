export type Side = 0 | 1;
export type Values = [number, number, number, number];
export type SkillId = 'neutral' | 'armor' | 'cooperate' | 'ambush' | 'camouflage' | 'ripple' | 'collective' | 'antipredator' | 'defensive_aggression' | 'defense_mechanism' | 'escape' | 'mimicry' | 'migration' | 'predator';
export interface CardDefinition { speciesId: string; version: string; values: Values; skill: SkillId; seed: number }
export interface CardInstance { id: string; speciesId: string; observationId: string; grantId: string; issuedAt: string; definition?: CardDefinition; balanceHistory?: CardDefinition[]; photoHash?:string }
export interface BattleCard { id: string; definition: CardDefinition; originalOwner: Side; controller: Side; spent: number; skillDisabled?:boolean; hidden?:boolean }
export interface BattleEvent { seq: number; type: string; cell?: number; from?: number; side?: Side; layer: number; detail: string; skill?:SkillId; cardId?:string; card?:BattleCard; beforeController?:Side; toHand?:Side; reverse?:boolean; attackTotal?:number; defenseTotal?:number; attackCard?:BattleCard; defenseCard?:BattleCard }
export interface BattleState { ruleVersion: string; balanceVersion?:string; seed: number; first: Side; turn: Side; board: (BattleCard | null)[]; hands: [BattleCard[], BattleCard[]]; events: BattleEvent[]; moves: Move[]; status: 'playing' | 'finished'; winner: Side | null; endReason?:'board-full'|'no-moves'|'turn-limit'; handReveals?:HandReveal[]; turnSnapshots?:TurnSnapshot[] }
export interface Move { side: Side; cardId: string; cell: number }

export interface HandReveal {sourceCardId:string;viewer:Side;active:boolean;atMove:number;cards:{id:string;hidden?:boolean;definition?:CardDefinition;spent?:number;skillDisabled?:boolean}[]}
export interface TurnSnapshot {moveNumber:number;board:(BattleCard|null)[];hands:[BattleCard[],BattleCard[]];turn:Side;status:'playing'|'finished';winner:Side|null;endReason?:BattleState['endReason'];eventCount:number}
