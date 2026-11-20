import { calendarFor, LOCATIONS, RULES, SKILL } from './data.js';
import { ECONOMY, gearBonuses } from './economy.js';
import { clamp, round, seeded } from './random.js';
import { learned } from './skillTree.js';
import { TRAINING_ACTIONS, type Action, type Plan, type Rider, type Skill, type Stat } from './types.js';

export const SECONDARY_STAT:Record<Stat,Stat>={speed:'carve',carve:'balance',link:'speed',balance:'carve'};

export type SpecialTraining='random'|'meet';
export const isTrainingAction=(action:Action):action is typeof TRAINING_ACTIONS[number]=>TRAINING_ACTIONS.some(training=>training===action);
export function meetTrainingAvailable(r:Rider){
  const meet=calendarFor(r.year).find(event=>event.week===r.week);
  return !!meet&&!meet.international&&!r.records.some(record=>record.year===r.year&&record.id===meet.id);
}
export function randomSpecialTraining(r:Rider){
  if(r.trainingOffer!==undefined)return r.trainingOffer??undefined;
  if(calendarFor(r.year).some(meet=>meet.week===r.week))return;
  const roll=seeded(r.seed,r.id,r.year,r.week,'special-training')();
  const chance=.125;
  if(roll<chance)return TRAINING_ACTIONS[Math.floor(roll/chance*TRAINING_ACTIONS.length)];
}
export function specialTraining(r:Rider,p:Plan):SpecialTraining|undefined{
  if(!isTrainingAction(p.action))return;
  if(p.meetTraining&&meetTrainingAvailable(r))return 'meet';
  if(randomSpecialTraining(r)===p.action)return 'random';
}

// Special previews share a separate roll so predicting their growth never exposes a normal training roll.
export const specialTrainingForm=(r:Rider)=>seeded(0,r.id,r.year,r.week,'special-training-quality')();
export const statAfter=(current:number,gain:number)=>round(clamp(current+gain*clamp((RULES.statCap-current)/RULES.statHeadroom,0,1),0,RULES.statCap));
export const trainingCost=(r:Rider,p:Plan,special?:SpecialTraining)=>special?0:Math.max(0,RULES.energy[p.action]-gearBonuses(r).cost);
const successCurve=[[0,.15],[20,.4],[40,.7],[69,.87],[70,.9],[79,.98],[80,1]] as const;
export function trainingSuccess(r:Rider,p:Plan,special?:SpecialTraining){
  if(special||p.action==='rest'||p.action==='hospital')return 1;
  const energy=clamp(r.energy);
  const index=successCurve.findIndex(([limit])=>limit>energy);
  let chance=1;
  if(index>0){
    const [from,low]=successCurve[index-1], [to,high]=successCurve[index];
    chance=low+(high-low)*(energy-from)/(to-from);
  }
  return clamp(chance-(r.injury?.severity==='major'?.28:r.injury?.12:0),.12,1);
}
export const greatTraining=(r:Rider,form:number)=>!r.injury&&r.energy>=55&&form>1-RULES.practice.greatChance-gearBonuses(r).great;
export function trainingFactor(r:Rider,p:Plan,form:number,great=false,special?:SpecialTraining){
  const spot=LOCATIONS[p.spot],attempted=SKILL[p.skill??''];
  const spotBoost=spot.boosted.some(a=>a===p.action)?spot.boost:1;
  const advanced=p.spot==='night'&&attempted&&attempted.difficulty>=3?1.09:1;
  const health=r.injury?.severity==='major'?.55:r.injury?.78:1;
  const technique=['dance','trick','rehearsal'].includes(p.action);
  const growthBonus=special?2:1+.30*clamp((40-r.energy)/40,0,1);
  return spotBoost*advanced*(.72+.0028*r.energy)*health*(technique?1+gearBonuses(r).practice:1)
    *(p.lesson?RULES.practice.lesson:1)*(great?1.22:.91+form*.19)*growthBonus;
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
export function practiceStudyRate(year:number,skill:Skill,targeted:boolean){
  const late=RULES.growth[Math.min(7,year-1)],practice=RULES.practice;
  return RULES.study*late.study*(targeted?practice.targeted:1)/(1+practice.difficultyCost*(skill.difficulty-1));
}
export function practiceMasteryRate(year:number,skill:Skill,base:number,bonus:ReturnType<typeof gearBonuses>){
  const late=RULES.growth[Math.min(7,year-1)];
  const difficulty=RULES.practice.masteryByDifficulty[skill.difficulty-1]??1;
  const equipment=skill.family==='dance'?bonus.danceMastery:bonus.trickMastery;
  return base*late.mastery*difficulty*(1+equipment);
}
export function previewTraining(r:Rider,p:Plan){
  const special=specialTraining(r,p);
  const recovery=p.action==='rest'||p.action==='hospital',success=trainingSuccess(r,p,special);
  const energyAfter=round(clamp(r.energy+(p.action==='rest'?RULES.restEnergy+gearBonuses(r).rest:p.action==='hospital'?24:-trainingCost(r,p,special))));
  const money=(p.action==='hospital'?-Math.min(r.money,RULES.hospitalFee):p.lesson?-ECONOMY.lesson:0)||0;
  const form=special?specialTrainingForm(r):undefined;
  const minFactor=form===undefined?trainingFactor(r,p,1-success):trainingFactor(r,p,form,greatTraining(r,form),special);
  const maxFactor=special?minFactor:trainingFactor(r,p,1,greatTraining(r,1));
  const low=recovery?{}:trainingStatGains(r,p,minFactor),high=recovery?{}:trainingStatGains(r,p,maxFactor);
  const gains=Object.fromEntries(Object.entries(high).map(([key,max])=>[key,{min:low[key as Stat]??0,max}])) as Partial<Record<Stat,{min:number;max:number}>>;
  const target=SKILL[p.skill??''];
  let skill:undefined|{id:string;label:string;min:number;max:number};
  if(target){
    const known=learned(r.skills,target.id);
    const rate=known?practiceMasteryRate(r.year,target,RULES.mastery,gearBonuses(r)):practiceStudyRate(r.year,target,true);
    const current=known?r.skills[target.id]?.mastery??0:r.skills[target.id]?.study??0;
    const gain=(factor:number)=>round(round(clamp(current+rate*factor))-current);
    skill={id:target.id,label:known?'숙련도':'학습',min:gain(minFactor),max:gain(maxFactor)};
  }
  return {success,energyAfter,energy:round(energyAfter-r.energy),money,gains,skill,recovery,special};
}
export type TrainingPreview=ReturnType<typeof previewTraining>;
