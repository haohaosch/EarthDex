import {createBattle,applyMove,chooseAI} from '../engine/engine';import {definition} from '../engine/species';
const n=Number(process.argv[2]||100),difficulty=process.argv[3]||'normal';if(!Number.isInteger(n)||n<1||n>10000)throw Error('Sample size must be 1–10000');
const decks:[any[],any[]]=[['deer','magpie','sparrow','butterfly','egret'],['macaque','barbet','kingfisher','bear','cat']].map((ids,p)=>ids.map((id,i)=>({id:`${p}:${i}`,definition:definition(id)})))as any;
let firstWins=0;for(let seed=0;seed<n;seed++){let s=createBattle(decks,seed);while(s.status==='playing')s=applyMove(s,chooseAI(s,difficulty));if(s.winner===s.first)firstWins++;}
const z=1.96,p=firstWins/n,den=1+z*z/n,center=(p+z*z/(2*n))/den,half=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/den;
console.log(JSON.stringify({ruleVersion:'experimental-0.1',seeds:`0..${n-1}`,strategy:difficulty,deckSpecies:decks.map(d=>d.map(c=>c.definition.speciesId)),n,firstWins,firstWinRate:p,wilson95:[center-half,center+half],note:'Fixed demo deck matchup only. This is not evidence of population-wide balance.'},null,2));
