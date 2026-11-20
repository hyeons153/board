import { spotVisitor } from './content.js';
import { RULES } from './data.js';
import { trainingPromiseActive } from './npcWorkshops.js';
import { clamp, seeded } from './random.js';
import { NPC_NAMES, type Plan, type Rider, type Skill, type Spot, type Stat, type TrainingAction } from './types.js';

export type TrainingNpc = keyof typeof NPC_NAMES;
export type JointTraining = {npc:TrainingNpc; action:TrainingAction; focus:boolean; growth:number; promised?:true};
export type JointTrainingResult = Pick<JointTraining,'npc'|'focus'> & {affinity:number};

const specialties:Record<TrainingNpc,{
  actions:readonly TrainingAction[]; stats?:readonly Stat[]; mastery?:number; effect:string;
}> = {
  yu:{actions:['dance'],stats:['link'],mastery:1,effect:'댄싱 숙련도 · 연계'},
  jun:{actions:['trick'],mastery:1,effect:'트릭 숙련도 · 새 기술 발견'},
  sol:{actions:['link'],stats:['link'],effect:'연계 · 체력 소모 감소'},
  min:{actions:['balance'],stats:['balance'],effect:'밸런스 · 부상 위험 감소'},
  ha:{actions:['speed','carve'],stats:['speed','carve'],effect:'속도 · 카빙'},
  noa:{actions:['trick'],mastery:3,effect:'난이도 3 이상 트릭 숙련도'},
};

export function jointTrainingOffer(r:Rider,spot:Spot):JointTraining|undefined{
  const npc=spotVisitor(r,spot).id;
  const last=r.extras?.lastTraining;
  const week=(r.year-1)*RULES.weeks+r.week;
  if(last?.joint?.npc===npc&&week-(last.year-1)*RULES.weeks-last.week<=1)return;

  const affinity=clamp(r.relations[npc]??0);
  const tier=Math.min(4,Math.floor(affinity/20));
  const rng=seeded(0,r.id,r.year,r.week,spot,'joint-training');
  const promised=trainingPromiseActive(r,npc);
  if(rng()>=.40+tier*.02+(promised ? .12 : 0))return;
  const actions=specialties[npc].actions;
  const action=actions[Math.floor(rng()*actions.length)]!;
  const focus=affinity>=35&&(r.extras?.jointSessions?.[npc]??0)>=3&&rng()<.16+Math.max(0,tier-2)*.025+(promised ? .10 : 0);
  return {npc,action,focus,growth:(105+tier*5+(focus?25:0))/100,...(promised?{promised:true}:{})};
}

export function jointTrainingFor(r:Rider,p:Plan){
  const offer=jointTrainingOffer(r,p.spot);
  return offer?.action===p.action?offer:undefined;
}

export const jointTrainingLabel=(joint:Pick<JointTraining,'npc'|'focus'>)=>`${NPC_NAMES[joint.npc]} · ${joint.focus?'집중훈련':'합동훈련'}`;
export const jointEffectLabel=(joint:JointTraining)=>specialties[joint.npc].effect;
export const jointEnergySaving=(joint:JointTraining|undefined)=>joint?.npc==='sol'?(joint.focus?5:3):0;
export const jointInjuryFactor=(joint:JointTraining|undefined)=>joint?.npc==='min'?(joint.focus ? .45 : .65):1;
export const jointDiscovery=(joint:JointTraining|undefined)=>joint?.npc==='jun'?(joint.focus ? .13 : .08):0;

// Add expertise to the joint multiplier so focused specialty growth stays at or below 1.64×.
const expertise=(joint:JointTraining)=>1+(joint.focus ? .14 : .09)/joint.growth;
export const jointStats=(joint:JointTraining|undefined)=>joint?specialties[joint.npc].stats:undefined;
export const jointStatFactor=(joint:JointTraining|undefined,stat:Stat)=>joint&&jointStats(joint)?.includes(stat)?expertise(joint):1;
export function jointMasteryFactor(joint:JointTraining|undefined,skill:Skill){
  if(!joint||skill.family!==joint.action)return 1;
  const difficulty=specialties[joint.npc].mastery;
  return difficulty!==undefined&&skill.difficulty>=difficulty?expertise(joint):1;
}
