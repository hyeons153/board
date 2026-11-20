import { generateRoutine } from './competition.js';
import { spotUnlocked } from './content.js';
import { calendarFor, DISCIPLINE_NAMES, meetById, RULES, SKILL, SKILLS, STAT_NAMES } from './data.js';
import { extras, freshExtras, milestone, playerPlace } from './economy.js';
import { jointTrainingOffer, type TrainingNpc } from './jointTraining.js';
import { clamp, round, seeded } from './random.js';
import { learned } from './skillTree.js';
import { storyProgress } from './storyState.js';
import { NPC_NAMES, SPOTS, STATS, type Discipline, type Family, type Plan, type Rider, type Stat } from './types.js';

type Target = {kind:'stat';stat:Stat;target:number} | {kind:'mastery';skill:string;target:number}
  | {kind:'joint';npc:TrainingNpc;target:number} | {kind:'practice';target:number}
  | {kind:'skills';family?:Family;difficulty:number;mastery:number;target:number}
  | {kind:'meet';discipline:Discipline;meet?:string;skill?:string;links?:number;rival?:TrainingNpc;score?:number;target:number};
type Step = {target:Target;value:number};
type Goal = {year:number;end:number;steps:Step[];npc?:TrainingNpc;status:'active'|'complete'|'expired'};
type GoalScope = 'short'|'season';
export type ObjectiveAward = {year:number;week:number;scope:GoalScope;money:number;affinity:number;npc?:TrainingNpc};
type Totals = {offered:number;completed:number;money:number;affinity:number};
export type ObjectiveState = {short?:Goal;season?:Goal;lastSettled?:number;awards:ObjectiveAward[];shortTotals:Totals;seasonTotals:Totals};

const emptyTotals=():Totals=>({offered:0,completed:0,money:0,affinity:0});
const date=(year:number,week:number)=>(year-1)*RULES.weeks+week;
const scopeName={short:'단기 목표',season:'시즌 목표'} as const;
const coachResponse:Record<TrainingNpc,string>={
  yu:'유리가 박자를 한 번 더 세어 주고 다음 곡을 틀었다.',jun:'준은 다음 도전도 같이 보자며 손을 내밀었다.',
  sol:'솔이 다음 연습 코스를 고르라며 보온병을 건넸다.',min:'민재가 점검표를 네 쪽으로 밀며 마지막 칸을 비워 뒀다.',
  ha:'하린이 손목시계를 끄고 다음 코너도 같이 돌아보자고 했다.',noa:'노아가 잘된 장면을 같이 볼지 먼저 물었다.',
};
const focusStat={dance:'carve',trick:'balance',freestyle:'link'} as const;
const preferred=(r:Rider):Discipline=>r.settings.strategy==='balanced'?r.settings.entries[0]??'dance':r.settings.strategy;
const participates=(r:Rider)=>r.settings.mode!=='auto'||r.settings.entries.length>0;
const skillCount=(r:Rider,target:Extract<Target,{kind:'skills'}>)=>SKILLS.filter(skill=>
  (!target.family||skill.family===target.family)&&skill.difficulty>=target.difficulty&&learned(r.skills,skill.id)&&r.skills[skill.id].mastery>=target.mastery).length;
const currentValue=(r:Rider,target:Target):number=>{
  switch(target.kind){
    case 'stat':return r.stats[target.stat];
    case 'mastery':return r.skills[target.skill]?.mastery??0;
    case 'skills':return skillCount(r,target);
    default:return 0;
  }
};
const isAbsolute=(target:Target)=>target.kind==='stat'||target.kind==='mastery'||target.kind==='skills';
const goal=(r:Rider,end:number,targets:Target[],npc?:TrainingNpc):Goal=>({year:r.year,end,status:'active',steps:targets.map(target=>({target,value:currentValue(r,target)})),...(npc?{npc}:{})});

function statTarget(r:Rider,stat:Stat,gain:number):Target|undefined{
  const target=round(Math.min(RULES.statCap,r.stats[stat]+gain));
  return target>r.stats[stat]?{kind:'stat',stat,target}:undefined;
}

function seasonGoal(r:Rider):Goal{
  const discipline=preferred(r),remaining=RULES.weeks-r.week+1;
  const family=discipline==='freestyle'||r.settings.strategy==='balanced'?undefined:discipline;
  const difficulty=r.year<=2?1:r.year<=4?2:3;
  const mastery=r.year===1?0:r.year===2?30:r.year<=4?45:r.year<=6?60:75;
  const training:Extract<Target,{kind:'skills'}>={kind:'skills',difficulty,mastery,target:0,...(family?{family}:{})};
  const count=skillCount(r,training);
  const ceiling=SKILLS.filter(skill=>(!family||skill.family===family)&&skill.difficulty>=difficulty).length;
  training.target=Math.min(ceiling,count+(r.year===1&&remaining>=20?2:1));
  const practice:Target={kind:'practice',target:Math.min(8,Math.max(1,Math.ceil(remaining/4)))};
  const growth=training.target>count&&remaining>=8?training:statTarget(r,focusStat[discipline],Math.min(6,remaining*.5))??practice;
  const previous=r.records.filter(record=>record.year<r.year).flatMap(record=>record.results.filter(result=>result.discipline===discipline));
  const previousBest=Math.max(0,...previous.map(result=>result.run.score));
  const international=r.year%2===0?`international-${r.year}`:undefined;
  if(!international&&!participates(r))return goal(r,RULES.weeks,[growth]);
  const available=calendarFor(r.year).filter(meet=>meet.week>=r.week&&!r.records.some(record=>record.year===r.year&&record.id===meet.id));
  if(!available.length)return goal(r,RULES.weeks,[growth]);
  const meet:Target={kind:'meet',discipline,target:r.year>=5&&!international&&available.length>=3?2:1,
    ...(international?{meet:international}:{}),
    ...(r.year>=3?{score:Math.min(98,Math.max(45,Math.floor(previousBest)+(r.year>=7?2:0)))}:{})};
  return goal(r,RULES.weeks,r.year===8?[meet,growth]:[growth,meet]);
}

function recentCoach(r:Rider):TrainingNpc|undefined{
  const {lastTraining,lastEvent}=extras(r);
  const trained=lastTraining?.joint&&lastTraining.grade!=='miss'&&lastTraining.grade!=='injury'&&date(r.year,r.week)-date(lastTraining.year,lastTraining.week)===1?lastTraining.joint.npc:undefined;
  const eventNpc=lastEvent?.npc&&/^(story-|relationship-|npc-workshop-|juns-clip|night-jam|harin-route|studio-rain|yu-film)/.test(lastEvent.eventId)
    &&date(r.year,r.week)-date(lastEvent.year,lastEvent.week)<=3?lastEvent.npc:undefined;
  const npc=trained??eventNpc;
  return npc&&Object.hasOwn(NPC_NAMES,npc)&&storyProgress(r,npc)?.state!=='ended'?npc as TrainingNpc:undefined;
}

function shortGoal(r:Rider):Goal|undefined{
  if(r.week===RULES.weeks)return;
  const end=Math.min(RULES.weeks,r.week+3);
  const discipline=preferred(r),npc=recentCoach(r);
  const rng=seeded(0,r.id,r.year,r.week,'objective');
  const nextMeet=calendarFor(r.year).find(meet=>meet.week>r.week&&meet.week<=end);
  if(nextMeet&&(nextMeet.international||participates(r))&&(npc==='jun'||npc==='sol'||rng()<.5)){
    const eventDiscipline=nextMeet.international?discipline:r.settings.entries[0]??discipline;
    const line=r.routines[eventDiscipline].length?r.routines[eventDiscipline]:generateRoutine(r,eventDiscipline,'flow');
    const skill=line.flatMap(id=>{const move=SKILL[id];return move&&move.difficulty>=2&&(r.skills[id]?.mastery??0)>=38?[move]:[];}).sort((a,b)=>b.difficulty-a.difficulty)[0];
    if(npc==='sol'&&line.length>=4)return goal(r,nextMeet.week,[{kind:'meet',discipline:eventDiscipline,meet:nextMeet.id,links:2,target:1}],npc);
    if(skill)return goal(r,nextMeet.week,[{kind:'meet',discipline:eventDiscipline,meet:nextMeet.id,skill:skill.id,target:1}],npc==='jun'?npc:undefined);
    if(npc==='jun')return goal(r,nextMeet.week,[{kind:'meet',discipline:eventDiscipline,meet:nextMeet.id,rival:npc,target:1}],npc);
  }
  if(npc&&!['ha','yu'].includes(npc)){
    const spots=SPOTS.filter(spot=>spotUnlocked(r,spot));
    const opportunities=Array.from({length:end-r.week+1},(_,i)=>r.week+i).filter(week=>
      spots.some(spot=>jointTrainingOffer({...r,week},spot)?.npc===npc));
    if(opportunities.length>=2&&opportunities.at(-1)!-opportunities[0]>=2)return goal(r,end,[{kind:'joint',npc,target:2}],npc);
  }
  const candidates=SKILLS.filter(skill=>learned(r.skills,skill.id)&&r.skills[skill.id].mastery<92&&
    (npc==='yu'?skill.family==='dance':discipline==='freestyle'||r.settings.strategy==='balanced'||skill.family===discipline));
  const skill=candidates[Math.floor(rng()*candidates.length)];
  if(skill&&(npc==='yu'||npc!=='ha'&&rng()<.45)){
    const value=r.skills[skill.id].mastery;
    return goal(r,end,[{kind:'mastery',skill:skill.id,target:Math.min(100,Math.ceil(value+(r.year<=4?9:6)))}],npc==='yu'?npc:undefined);
  }
  const weakest=STATS.reduce((a,b)=>r.stats[a]<=r.stats[b]?a:b);
  const candidate=npc==='ha'?'carve':r.settings.strategy==='balanced'?weakest:rng()<.55?focusStat[discipline]:STATS[Math.floor(rng()*STATS.length)];
  const headroom=clamp((RULES.statCap-r.stats[candidate])/RULES.statHeadroom,0,1);
  const trainingGain=RULES.statGrowth*RULES.growth[r.year-1].stat*headroom*(1-r.stats[candidate]/RULES.statCap*.7);
  const target=statTarget(r,candidate,Math.max(.2,trainingGain*.94))??{kind:'practice',target:2};
  return goal(r,end,[target],npc==='ha'?npc:undefined);
}

export function currentObjectives(r:Rider){
  const saved=r.extras?.objectives;
  if(r.phase==='retired')return {short:saved?.short,season:saved?.season};
  const short=saved?.short;
  return {short:short?.year===r.year&&short.end>=r.week?short:shortGoal(r),season:saved?.season?.year===r.year?saved.season:seasonGoal(r)};
}

export function ensureObjectives(r:Rider){
  const next=currentObjectives(r);
  const state=(r.extras??=freshExtras()).objectives??={awards:[],shortTotals:emptyTotals(),seasonTotals:emptyTotals()};
  if(next.short!==state.short&&next.short)state.shortTotals.offered++;
  if(next.season!==state.season&&next.season)state.seasonTotals.offered++;
  Object.assign(state,next);
  return state;
}

export function settleObjectives(r:Rider){
  const state=r.extras?.objectives;
  const now=date(r.year,r.week);
  // An old snapshot may resume after training or during a meet, before it had any offered goals.
  if(!state||now<=(state.lastSettled??0))return;
  state.lastSettled=now;
  const training=r.extras?.lastTraining;
  const trained=training?.year===r.year&&training.week===r.week&&['success','great','learned','mastery'].includes(training.grade);
  const meet=calendarFor(r.year).find(event=>event.week===r.week);
  const results=meet?r.records.find(record=>record.year===r.year&&record.id===meet.id)?.results??[]:[];
  for(const scope of ['short','season'] as const){
    const objective=state[scope];
    if(objective?.status!=='active'||objective.year!==r.year)continue;
    for(const step of objective.steps){
      const target=step.target;
      if(step.value>=target.target)continue;
      if(isAbsolute(target))step.value=currentValue(r,target);
      else if(target.kind==='practice'&&trained)step.value++;
      else if(target.kind==='joint'&&trained&&training.joint?.npc===target.npc)step.value++;
      else if(target.kind==='meet'&&(!target.meet||target.meet===meet?.id)&&results.some(result=>
        result.discipline===target.discipline&&(!target.skill||result.run.log.some(move=>move.id===target.skill&&(move.outcome==='clean'||move.outcome==='great')))&&
        (!target.links||result.run.log.filter(move=>move.linked&&move.outcome!=='miss').length>=target.links)&&
        (!target.rival||playerPlace(result)<(result.standings.find(row=>row.id===target.rival)?.place??0))&&
        (!target.score||result.run.score>=target.score||playerPlace(result)<=3)))step.value++;
    }
    if(objective.steps.every(step=>step.value>=step.target.target)){
      objective.status='complete';
      const npc=objective.npc;
      const rapport=npc?r.relations[npc]??0:0;
      const affinity=npc&&storyProgress(r,npc)?.state!=='ended'?round(Math.max(0,Math.min(1,100-rapport))):0;
      const money=scope==='short'?1200:8000+r.year*1000;
      if(npc&&affinity>0)r.relations[npc]=round(rapport+affinity);
      r.money+=money;
      const totals=scope==='short'?state.shortTotals:state.seasonTotals;
      totals.completed++;totals.money+=money;totals.affinity+=affinity;
      const award={year:r.year,week:r.week,scope,money,affinity,...(npc?{npc}:{})};
      state.awards=[...state.awards.slice(-3),award];
      milestone(r,scopeName[scope]+' 달성',objectiveAwardText(award));
    }else if(r.week>=objective.end)objective.status='expired';
  }
}

export const objectiveAwardText=(award:ObjectiveAward)=>`${scopeName[award.scope]} 달성 · 훈련 지원금 ₩${award.money.toLocaleString('ko-KR')}${award.npc&&award.affinity?` · ${NPC_NAMES[award.npc]} 친밀도 +${award.affinity}`:''}`;
export const objectiveAwardDialogue=(r:Rider,award:ObjectiveAward)=>award.npc&&storyProgress(r,award.npc)?.state!=='ended'?coachResponse[award.npc]:undefined;
export const recentObjectiveAwards=(r:Rider)=>r.extras?.objectives?.awards.filter(award=>date(r.year,r.week)-date(award.year,award.week)===1)??[];

export function objectiveText(target:Target){
  switch(target.kind){
    case 'stat':return `${STAT_NAMES[target.stat]} ${target.target} 도달`;
    case 'mastery':return `${SKILL[target.skill]?.name} 숙련도 ${target.target}% 달성`;
    case 'joint':return `${NPC_NAMES[target.npc]}와 합동훈련 ${target.target}회 성공`;
    case 'practice':return `훈련 ${target.target}회 성공`;
    case 'skills':return `${target.family?DISCIPLINE_NAMES[target.family]+' ':''}${target.difficulty>1?`난도 ${target.difficulty}+ `:''}기술 ${target.mastery?`숙련 ${target.mastery}% `:'습득 '}${target.target}개`;
    case 'meet':{
      const stage=target.meet?meetById(target.meet)?.name??'대회':'대회';
      const feat=target.skill?`${SKILL[target.skill]?.name} 깔끔한 착지`:target.rival?`${NPC_NAMES[target.rival]}보다 높은 순위`:target.links?`연계 ${target.links}회 성공`:target.score?`${target.score}점 또는 입상`:'완주';
      return `${stage} · ${DISCIPLINE_NAMES[target.discipline]} ${feat}${target.target>1?` ${target.target}회`:''}`;
    }
  }
}

export function objectiveTrainingPlan(r:Rider,base:Plan):Plan{
  if(r.energy<72)return base;
  const {short,season}=currentObjectives(r);
  for(const active of [short,season]){
    if(active?.status!=='active')continue;
    for(const {target,value} of active.steps){
      if(value>=target.target)continue;
      if(target.kind==='mastery'&&SKILL[target.skill]?.family===base.action)return {...base,skill:target.skill};
      if(target.kind==='skills'&&base.skill&&r.skills[base.skill]?.mastery>=target.mastery){
        const skill=SKILLS.find(skill=>skill.family===base.action&&(!target.family||skill.family===target.family)&&skill.difficulty>=target.difficulty&&learned(r.skills,skill.id)&&r.skills[skill.id].mastery<target.mastery);
        if(skill)return {...base,skill:skill.id};
      }
      // Switch actions occasionally without replacing the selected technique family or a recovery plan.
      if(target.kind==='stat'&&r.week%3===0&&r.energy>=80&&STATS.some(stat=>stat===base.action))return {...base,action:target.stat};
      if(target.kind==='joint'&&r.energy>=80){
        for(const spot of [base.spot,...SPOTS.filter(spot=>spot!==base.spot&&spotUnlocked(r,spot))]){
          const offer=jointTrainingOffer(r,spot);
          if(offer?.npc!==target.npc)continue;
          if(offer.action===base.action)return {...base,spot};
          if(r.week%3===0&&STATS.some(stat=>stat===base.action)&&STATS.some(stat=>stat===offer.action))return {action:offer.action,spot};
        }
      }
    }
  }
  return base;
}
