import {createBattle,applyMove,chooseAI,RULE_VERSION,rng} from '../engine/engine';import {officialDefinition,OFFICIAL_CARD_VERSION} from '../engine/official-cards';import {SPECIES} from '../engine/species';
const n=Number(process.argv[2]||100),difficulty=process.argv[3]||'normal',mode=process.argv[4]||'varied';if(!Number.isInteger(n)||n<1||n>10000)throw Error('Sample size must be 1–10000');
const fixed=[['deer','magpie','sparrow','butterfly','egret','gecko','swallow'],['macaque','barbet','kingfisher','bear','cat','turtle','toad']];
let firstWins=0,secondWins=0,draws=0,turnLimit=0,totalTurns=0;const skillCounts:Record<string,number>={};
for(let seed=0;seed<n;seed++){
 const random=rng(seed+12345),shuffled=SPECIES.map(s=>s.id);for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const species=mode==='fixed'?fixed:[shuffled.slice(0,7),shuffled.slice(7,14)];
 for(const swap of [false,true]){const decks=(swap?species.slice().reverse():species).map((ids,p)=>ids.map((id,i)=>({id:`${p}:${i}`,definition:officialDefinition(id)}))) as Parameters<typeof createBattle>[0];for(const c of decks.flat())skillCounts[c.definition.skill]=(skillCounts[c.definition.skill]||0)+1;
  let s=createBattle(decks,seed,0);while(s.status==='playing')s=applyMove(s,chooseAI(s,difficulty));if(s.winner===null)draws++;else if(s.winner===s.first)firstWins++;else secondWins++;if(s.endReason==='turn-limit')turnLimit++;totalTurns+=s.moves.length;
 }
}
const games=n*2,z=1.96,p=firstWins/games,den=1+z*z/games,center=(p+z*z/(2*games))/den,half=z*Math.sqrt((p*(1-p)+z*z/(4*games))/games)/den;
console.log(JSON.stringify({checkedAt:new Date().toISOString(),ruleVersion:RULE_VERSION,balanceVersion:OFFICIAL_CARD_VERSION,seeds:`0..${n-1}`,pairedDeckSwap:true,strategy:difficulty,deckMode:mode,...(mode==='fixed'?{deckSpecies:fixed}:{deckPolicy:'Deterministic catalog shuffle, seven unique species per deck, no rarity weighting'}),opening:'Two second-side plants at cells 1 and 9; directions 3/4; removed on successful attack; score for the second side until removed',games,firstWins,secondWins,draws,turnLimit,meanTurns:totalTurns/games,firstWinRate:p,wilson95:[center-half,center+half],skillCounts,note:'AI self-play with paired deck swap; samples are correlated and the Wilson interval is descriptive. This measures these strategies/decks only and does not establish human or population-wide balance.'},null,2));
