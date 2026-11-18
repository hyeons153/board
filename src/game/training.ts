import { LOCATIONS, RULES, SKILL } from './data.js';
import { ECONOMY, gearBonuses } from './economy.js';
import { clamp, round } from './random.js';
import type { Plan, Rider, Stat } from './types.js';

export const SECONDARY_STAT:Record<Stat,Stat>={speed:'carve',carve:'balance',link:'speed',balance:'carve'};

export const statAfter=(current:number,gain:number)=>round(clamp(current+gain*clamp((RULES.statCap-current)/RULES.statHeadroom,0,1),0,RULES.statCap));
export const trainingCost=(r:Rider,p:Plan)=>Math.max(0,RULES.energy[p.action]-(['rest','hospital'].includes(p.action)?0:gearBonuses(r).cost));
export function trainingSuccess(r:Rider,p:Plan){
  if(p.action==='rest'||p.action==='hospital')return 1;
  const shortage=Math.max(0,trainingCost(r,p)-r.energy);
  return clamp(.98-Math.max(0,45-r.energy)*.015-shortage*.012-(r.injury?.severity==='major'?.28:r.injury?.12:0)
    -Math.max(0,(SKILL[p.skill??'']?.difficulty??1)-1)*.015,.12,.99);
}
export function trainingFactor(r:Rider,p:Plan,form:number,great=false){
  const spot=LOCATIONS[p.spot],attempted=SKILL[p.skill??''];
  const spotBoost=spot.boosted.some(a=>a===p.action)?spot.boost:1;
  const advanced=p.spot==='night'&&attempted&&attempted.difficulty>=3?1.09:1;
  const health=r.injury?.severity==='major'?.55:r.injury?.78:1;
  const technique=['dance','trick','rehearsal'].includes(p.action);
  return spotBoost*advanced*(.72+.0028*r.energy)*health*(technique?1+gearBonuses(r).practice:1)
    *(p.lesson?RULES.practice.lesson:1)*(great?1.22:.91+form*.19);
}
export function trainingStatGains(r:Rider,p:Plan,factor:number):Partial<Record<Stat,number>>{
  const late=RULES.growth[Math.min(7,r.year-1)],gains:Partial<Record<Stat,number>>={};
  const add=(stat:Stat,raw:number)=>{gains[stat]=round(statAfter(r.stats[stat],raw)-r.stats[stat]);};
  if(p.action==='dance'||p.action==='trick'){
    for(const stat of p.action==='dance'?['speed','carve'] as const:['link','balance'] as const)add(stat,RULES.secondaryGrowth*factor*late.stat);
  }
  else if(p.action==='rehearsal')add('link',RULES.practice.rehearsalLink*factor*late.stat);
  else if(p.action!=='rest'&&p.action!=='hospital'){
    add(p.action,RULES.statGrowth*factor*late.stat*(1-r.stats[p.action]/RULES.statCap*.7)*(p.action==='link'?1+gearBonuses(r).linkGrowth:1));
    add(SECONDARY_STAT[p.action],RULES.secondaryGrowth*factor*late.stat);
  }
  return gains;
}
export function previewTraining(r:Rider,p:Plan){
  const recovery=p.action==='rest'||p.action==='hospital',success=trainingSuccess(r,p);
  const energyAfter=round(clamp(r.energy+(p.action==='rest'?RULES.restEnergy+gearBonuses(r).rest:p.action==='hospital'?24:-trainingCost(r,p))));
  const money=(p.action==='hospital'?-Math.min(r.money,RULES.hospitalFee):p.lesson?-ECONOMY.lesson:0)||0;
  const minFactor=trainingFactor(r,p,1-success),maxFactor=trainingFactor(r,p,1,!r.injury&&r.energy>=55);
  const low=recovery?{}:trainingStatGains(r,p,minFactor),high=recovery?{}:trainingStatGains(r,p,maxFactor);
  const gains=Object.fromEntries(Object.entries(high).map(([key,max])=>[key,{min:low[key as Stat]??0,max}])) as Partial<Record<Stat,{min:number;max:number}>>;
  const target=SKILL[p.skill??''];
  let skill:undefined|{id:string;label:string;min:number;max:number};
  if(target){
    const learned=(r.skills[target.id]?.study??0)>=100,late=RULES.growth[Math.min(7,r.year-1)];
    const bonus=gearBonuses(r);
    const rate=learned?RULES.mastery*late.mastery*(1+(target.family==='dance'?bonus.danceMastery:bonus.trickMastery)):RULES.study*late.study*RULES.practice.targeted/(1+RULES.practice.difficultyCost*(target.difficulty-1));
    const current=learned?r.skills[target.id]?.mastery??0:r.skills[target.id]?.study??0;
    skill={id:target.id,label:learned?'숙련도':'학습',min:round(Math.min(100-current,rate*minFactor)),max:round(Math.min(100-current,rate*maxFactor))};
  }
  return {success,energyAfter,energy:round(energyAfter-r.energy),money,gains,skill,recovery};
}
export type TrainingPreview=ReturnType<typeof previewTraining>;
