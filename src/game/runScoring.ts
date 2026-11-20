import { RULES, SKILL } from './data.js';
import { effectiveStats, gearBonuses } from './economy.js';
import { clamp, round } from './random.js';
import type { Discipline, Family, Outcome, Rider, Run, Skill } from './types.js';

export type CompetitionProfile = Pick<Rider,'stats'|'energy'|'skills'|'injury'|'extras'>;
type Conditions = ReturnType<typeof competitionConditions>;
export const competitionConditions = (p:CompetitionProfile) => {
  const stats=effectiveStats(p);
  return {
    stats,gear:gearBonuses(p),balance:clamp(stats.balance/RULES.statCap,0,1),link:clamp(stats.link/RULES.statCap,0,1),
    injury:p.injury?.severity==='major'?.18:p.injury?.08:0,
    mastery:(move:Skill)=>clamp((p.skills[move.id]?.mastery??0)/100,0,1),
  };
};
export const repeatFactor = (used:number) => Math.max(RULES.run.repeatFloor,1-used*RULES.run.repeatPenalty);
const trickChain = (current:Skill,previous?:Skill) => previous?.family==='trick'&&current.family==='trick';
const landingLimits = [.995,.975,.947,.91];
export function landingChance(c:Conditions,move:Skill,previous?:Skill,connected=false){
  const assist=connected?.07*c.link:0;
  const bonus=move.family==='trick'?c.gear.trickLand:0;
  const chain=trickChain(move,previous)?RULES.run.trickChainSuccess:0;
  return clamp(.51+.51*c.mastery(move)+.16*c.balance-(move.difficulty-1)*.052-move.risk*.5-c.injury+bonus+assist-chain,
    .07,landingLimits[move.difficulty-1]);
}

export function connectionChance(c:Conditions,previous:Skill,move:Skill){
  const affinity=previous.id===move.id?-.19:
    (previous.tags.some(tag=>move.tags.includes(tag))?RULES.run.danceAffinity:0)+(previous.family!==move.family?RULES.run.mixedAffinity:0);
  const gear=move.family==='dance'?c.gear.danceLink:0;
  const chain=trickChain(move,previous)?RULES.run.trickChainLink:0;
  const mastery=(c.mastery(previous)+c.mastery(move))/2;
  return clamp(.39+.46*c.link+.13*mastery+affinity+gear-chain, .08, .993);
}

function landingQuality(c:Conditions,move:Skill){
  const great=clamp(.18+.19*c.mastery(move)+.09*c.balance+c.gear.great,0,.60);
  const rough=.27-.17*c.mastery(move)-.06*c.balance;
  return {great,rough};
}
export function landingOutcome(c:Conditions,move:Skill,probability:number,roll:number):Outcome{
  const {great,rough}=landingQuality(c,move);
  return roll>=probability?'miss':roll<probability*great?'great':roll<probability*(1-rough)?'clean':'rough';
}

const outcomeValue={miss:0,rough:.8,clean:1,great:1.2};
export function moveValue(c:Conditions,move:Skill,used:number){
  return move.points*(.78+.22*c.mastery(move))*(1+.045*(move.difficulty-1))*repeatFactor(used);
}
export function landedPoints(c:Conditions,move:Skill,used:number,outcome:Outcome){
  return moveValue(c,move,used)*outcomeValue[outcome];
}
export function expectedMove(c:Conditions,move:Skill,used:number,previous?:Skill,previousSuccess=1){
  const connection=previous?previousSuccess*connectionChance(c,previous,move):0;
  const afterLanding=previous?landingChance(c,move,previous):landingChance(c,move);
  const linked=previous?connection*landingChance(c,move,previous,true):0;
  const success=linked+(previousSuccess-connection)*afterLanding+(1-previousSuccess)*landingChance(c,move);
  const {great,rough}=landingQuality(c,move);
  return {success,linked,points:success*moveValue(c,move,used)*(1+.2*(great-rough))};
}

function executionScore(points:number,discipline?:Discipline):number{
  // Keep most of the scale responsive, then reserve the last few points for exceptional lines.
  if(discipline==='freestyle'&&points<76){
    const steadier=executionScore(76)*(points/76)**.42;
    return .34*executionScore(points)+.66*steadier;
  }
  const middle=Math.min(points,60);
  const tail=Math.max(0,points-60);
  return clamp(1.91*middle-.0087*middle*middle+.40*Math.min(tail,22)+.19*Math.max(0,tail-22));
}
const executionScale:Record<Discipline,number>={dance:1.06,trick:1,freestyle:1};

export function judgeRun(c:Conditions,discipline:Discipline,log:Run['log'],execution:number):Run {
  const distinct=new Set<string>(),edges=new Set<string>();
  const families:Record<Family,number>={dance:0,trick:0};
  let landed=0,links=0,flowPoints=0,difficulty=0,alternations=0,activeTime=0,attempted=0;
  log.forEach((frame,index)=>{
    activeTime+=frame.end-frame.at+(index?RULES.transition:0);
    const move=SKILL[frame.id]!;
    const attempt=frame.attempt??1;
    if(discipline==='freestyle')attempted+=moveValue(c,move,attempt-1);
    if(frame.outcome==='miss')return;
    distinct.add(move.id);
    families[move.family]+=repeatFactor(attempt-1);
    landed++;
    difficulty+=(move.difficulty-1)*outcomeValue[frame.outcome]*repeatFactor(attempt-1);
    if(!frame.linked)return;
    const previous=SKILL[log[index-1].id]!;
    const edge=previous.id+'>'+move.id;
    const newEdge=!edges.has(edge)&&previous.id!==move.id;
    edges.add(edge);
    const mixed=previous.family!==move.family;
    alternations+=Number(mixed);
    links+=(newEdge?1:.65)*repeatFactor(attempt-1)**.35;
    flowPoints+=(.75+.10*Math.min(3,frame.combo-2)+(mixed?.16:0))*(newEdge?1:.76);
  });
  const mix=Math.min(families.dance,families.trick);
  const freestyle=discipline==='freestyle';
  // In freestyle, recovering the line is part of its flow. Takeoffs earn limited
  // composition credit once the rider has landed enough of the planned routine.
  const recoveryTime=(log.at(-1)?.end??0)-activeTime;
  const coverage=clamp((activeTime+(freestyle?.75*recoveryTime:0))/54,0,1);
  const technique=freestyle?.68*execution+.32*attempted*Math.min(1,landed/4):execution;
  const finish=landed/log.length;
  const variety=clamp(distinct.size/(discipline==='freestyle'?8:7),0,1);
  const flow=clamp(flowPoints*12.7);
  const continuity=clamp(links/Math.max(4,log.length-1),0,1);
  const link=clamp(100*(.56*continuity+.44*c.link)*coverage*(.87+.13*variety));
  const control=100*finish*coverage*(.83+.17*variety);
  const combo=discipline==='freestyle'
    ?(.48*flow+.32*link+.20*control)*(.95+.05*Math.min(1,mix/2))*(.94+.06*Math.min(1,alternations/6))
    :clamp((.76*flow+.24*link)*(.89+.11*variety));
  const movement=(stat:number,bonus:number)=>{
    const ability=clamp(stat/RULES.statCap,0,1);
    const reliability=discipline==='freestyle'?.18:.31;
    return clamp((37+63*ability*(1.3-.3*ability)+bonus)*coverage*(1-reliability*(1-finish)));
  };
  const partsAll={
    execution:executionScore(technique*executionScale[discipline],discipline)*(.91+.09*variety)*(freestyle?.92+.08*Math.min(1,mix/2):1),
    link,combo,carve:movement(c.stats.carve,c.gear.carve),speed:movement(c.stats.speed,c.gear.speed),
  };
  const weights=Object.entries(RULES.scoreWeights[discipline]) as [keyof typeof partsAll,number][];
  const precision=weights.reduce((total,[key,weight])=>total+weight*partsAll[key]/100,0);
  const precise=(value:number)=>Math.round(value*1e6)/1e6;
  return {
    score:round(precision),parts:Object.fromEntries(weights.map(([key])=>[key,round(partsAll[key])])),log,
    judging:{score:precise(precision),execution:precise(partsAll.execution),difficulty:precise(difficulty),variety:distinct.size,flow:precise((link+combo)/2)},
  };
}
