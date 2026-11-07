export type Side = 0 | 1;
export type Values = [number, number, number, number];
export type SkillId = 'neutral' | 'armor' | 'cooperate' | 'ambush' | 'camouflage' | 'ripple';
export interface CardDefinition { speciesId: string; version: string; values: Values; skill: SkillId; seed: number }
export interface CardInstance { id: string; speciesId: string; observationId: string; grantId: string; issuedAt: string }
export interface BattleCard { id: string; definition: CardDefinition; originalOwner: Side; controller: Side; spent: number }
export interface BattleEvent { seq: number; type: string; cell?: number; from?: number; side?: Side; layer: number; detail: string }
export interface BattleState { ruleVersion: string; seed: number; first: Side; turn: Side; board: (BattleCard | null)[]; hands: [BattleCard[], BattleCard[]]; events: BattleEvent[]; moves: Move[]; status: 'playing' | 'finished'; winner: Side | null }
export interface Move { side: Side; cardId: string; cell: number }
