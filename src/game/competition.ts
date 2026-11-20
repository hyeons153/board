import { RULES, SKILL, SKILLS, START_SKILLS } from './data.js';
import { RIVALS, type Rival } from './content.js';
import { ECONOMY, effectiveStats, equippedLook, gearBonuses, legacyBonuses } from './economy.js';
import { RUN_PROOF_VERSION } from './public.js';
import { meetRP } from './rp.js';
import { clamp, round, seeded } from './random.js';
import { competitionConditions, expectedMove, judgeRun, landedPoints, landingChance, landingOutcome, connectionChance, type CompetitionProfile } from './runScoring.js';
import { learned } from './skillTree.js';
import { DISCIPLINES, STATS, type Discipline, type Rider, type RoutineStyle, type Run, type RunRules, type Skill, type Meet, type Result, type Stats, type Outcome, type Standing } from './types.js';

export { learned } from './skillTree.js';
export const CURRENT_RUN_RULES=7 satisfies RunRules;
// A missing prior definition means the skill did not exist under the earlier rules.
const runSkillChanges:Record<string,{since:RunRules;prior?:Pick<Skill,'difficulty'|'risk'>}|undefined>={
  sidewinder:{since:5,prior:{difficulty:2,risk:.12}},
  ollie:{since:5},
  p2p:{since:5},
  bigspin:{since:6,prior:{difficulty:2,risk:.12}},
  bigger:{since:6,prior:{difficulty:3,risk:.18}},
  'ghostride-kickflip':{since:6},
};
export const allowed = (skill:Skill, discipline:Discipline) => discipline==='freestyle' || skill.family===discipline;
export const routineTime = (ids:string[]) => ids.reduce((s,id,i)=>s+(SKILL[id]?.seconds??0)+(i?RULES.transition:0),0);
export function validRoutine(rider:Pick<Rider,'skills'>,discipline:Discipline,ids:string[]) {
  return routineTime(ids)<=RULES.runSeconds && ids.every(id=>{const s=SKILL[id];return !!s&&allowed(s,discipline)&&learned(rider.skills,id);});
}
type Profile = CompetitionProfile;
function legacyChance(profile:Profile,s:Skill,energy:number) {
  const c=RULES.success;
  const equipment = s.family==='trick' ? legacyBonuses(profile).trickLand : 0;
  const injury = profile.injury?.severity==='major' ? .18 : profile.injury ? .08 : 0;
  return clamp(c.base+(profile.skills[s.id]?.mastery??0)*c.mastery+profile.stats.balance*c.balance+energy*c.energy-(s.difficulty-1)*c.difficulty-s.risk-injury+equipment,c.min,c.max);
}
// Competition execution depends on skill and equipment, regardless of current stamina.
function currentChance(profile:Profile,s:Skill,stats=effectiveStats(profile),equipment=gearBonuses(profile)){
  const c=RULES.success;
  const injury=profile.injury?.severity==='major'?.18:profile.injury?.08:0;
  return clamp(c.base+(profile.skills[s.id]?.mastery??0)*c.mastery+stats.balance*c.balance+100*c.energy-(s.difficulty-1)*c.difficulty-s.risk-injury+(s.family==='trick'?equipment.trickLand:0),c.min,c.max);
}
export const chance=(p:Profile,skill:Skill)=>landingChance(competitionConditions(p),skill);
const affinity = (a:Skill,b:Skill) => a.id===b.id ? -.17 : (a.tags.some(t=>b.tags.includes(t)) ? RULES.run.danceAffinity : 0)+(a.family!==b.family ? RULES.run.mixedAffinity : 0);
export function generateRoutine(p:Profile,d:Discipline,style:RoutineStyle,signature?:string):string[] {
  const conditions=competitionConditions(p);
  const pool=SKILLS.filter(s=>allowed(s,d)&&learned(p.skills,s.id));
  const uses:Record<string,number>={};
  const familyLandings={dance:0,trick:0};
  const ids:string[]=[];
  const recoveryWeight=style==='stable'?1:style==='flow'?.65:.40;
  let used=0,recovery=0,previous:Skill|undefined,previousSuccess=1;
  while (used<RULES.runSeconds) {
    let next:{move:Skill;value:number;success:number;time:number}|undefined;
    for(const move of pool){
      const time=move.seconds+(previous?RULES.transition:0);
      if(used+time+recovery*recoveryWeight>RULES.runSeconds)continue;
      const seen=uses[move.id]??0;
      const expected=expectedMove(conditions,move,seen,previous,previousSuccess);
      const mix=d==='freestyle'?Math.max(0,2-familyLandings[move.family]):0;
      const variety=seen===0?expected.success*(1.7+(move.id===signature?2.5:0)):0;
      const alternation=d==='freestyle'&&previous&&previous.family!==move.family?1.2:0;
      const flow=expected.linked*((style==='flow'?3.6:2)*(d==='trick'?.8:1)+alternation);
      const safety=style==='stable'?3.8:style==='flow'?2.4:1.2;
      const cost=time+(1-expected.success)*RULES.recovery*recoveryWeight;
      const value=(expected.points+flow+variety+mix*expected.success+safety*expected.success)/cost;
      if(!next||value>next.value)next={move,value,success:expected.success,time};
    }
    if(!next) break;
    previous=next.move;
    previousSuccess=next.success;
    used+=next.time;
    recovery+=(1-next.success)*RULES.recovery;
    uses[previous.id]=(uses[previous.id]??0)+1;
    familyLandings[previous.family]+=next.success;
    ids.push(previous.id);
  }
  return ids;
}

export function simulateRun(p:Profile, discipline:Discipline, ids:string[], rng:()=>number,rules:RunRules=CURRENT_RUN_RULES):Run {
  if(!validRoutine(p,discipline,ids)) throw new Error('유효하지 않은 라인입니다.');
  if(rules>=7){
    const conditions=competitionConditions(p);
    const seen:Record<string,number>={};
    const log:Run['log']=[];
    let at=0,execution=0,combo=0,previous:Skill|undefined;
    for(const id of ids){
      const move=SKILL[id]!;
      const start=at+(log.length?RULES.transition:0),end=start+move.seconds;
      if(end>RULES.runSeconds)break;
      const roll=rng();
      const connected=previous?rng()<connectionChance(conditions,previous,move):null;
      const outcome=landingOutcome(conditions,move,landingChance(conditions,move,previous,!!connected),roll);
      const missed=outcome==='miss';
      const linked=connected===null?null:connected&&!missed;
      const used=seen[id]??0;
      const points=landedPoints(conditions,move,used,outcome);
      combo=missed?0:linked?combo+1:1;
      execution+=points;
      seen[id]=used+1;
      log.push({id,at:start,end,outcome,linked,combo,points:round(points),attempt:used+1});
      at=end+(missed?RULES.recovery:0);
      previous=missed?undefined:move;
    }
    return log.length?judgeRun(conditions,discipline,log,execution):{score:0,parts:{},log};
  }
  let at=0, execution=0, combo=0, comboRaw=0, totalLinks=0, linkedCount=0, previous:Skill|undefined, successes=0;
  const seen=new Map<string,number>(), variety=new Set<string>(), usedFamilies=new Set<string>();
  const bonus=rules<3?legacyBonuses(p):gearBonuses(p),stats=rules<3?p.stats:effectiveStats(p);
  const log:Run['log']=[];
  for (const id of ids) {
    let move=SKILL[id]!;
    const change=runSkillChanges[id];
    if(change&&rules<change.since){
      if(!change.prior)throw new Error('이 경기 규칙에서 사용할 수 없는 기술이에요.');
      move={...move,...change.prior};
    }
    const start=at+(log.length?RULES.transition:0);
    const end=start+move.seconds;
    if (end>RULES.runSeconds) break;
    const remainingEnergy=rules===1?Math.max(0,p.energy-start/RULES.runSeconds*RULES.entryCost[discipline]*.75):100;
    const trickChain=previous?.family==='trick' && move.family==='trick';
    const baseChance=(rules<3?legacyChance(p,move,remainingEnergy):currentChance(p,move,stats,bonus as ReturnType<typeof gearBonuses>))-(trickChain ? RULES.run.trickChainSuccess : 0);
    const value=rng();
    let connection:boolean|null=null;
    if(previous) {
      totalLinks++;
      const mastery=((p.skills[previous.id]?.mastery??0)+(p.skills[move.id]?.mastery??0))/2;
      const equipment=move.family==='dance' ? bonus.danceLink : 0;
      connection=rng()<clamp(.29 + stats.link*.005 + remainingEnergy*.00115 + affinity(previous,move) +
        mastery*RULES.run.masteryLink + equipment - (trickChain ? RULES.run.trickChainLink : 0),.08,.97);
    }
    const assist=rules>=4&&connection ? .07*clamp(stats.link,0,RULES.statCap)/RULES.statCap : 0;
    const probability=Math.min(RULES.success.max,baseChance+assist);
    const outcome:Outcome=value>=probability?'miss':value<probability*.19+(rules>=3?(bonus as ReturnType<typeof gearBonuses>).great:0)?'great':value<probability*.75?'clean':'rough';
    const linked=connection===null?null:connection&&outcome!=='miss';
    if(linked)linkedCount++;
    const count=seen.get(id)??0; seen.set(id,count+1);
    const points = move.points * {miss:0,rough:.8,clean:1,great:1.2}[outcome] * Math.max(RULES.run.repeatFloor,1-count*RULES.run.repeatPenalty);
    if(outcome==='miss') combo=0;
    else {
      successes++; variety.add(id); usedFamilies.add(move.family);
      combo=linked?combo+1:1;
      comboRaw+=combo>1?Math.min(combo-1,3)*(previous?.family!==move.family?1.25:1)*Math.max(.35,1-count*.22):0;
    }
    execution+=points;
    log.push({id,at:start,end,outcome,linked,combo,points:round(points)});
    at=end+(outcome==='miss'?RULES.recovery:0);
    previous=outcome==='miss'?undefined:move;
  }
  if(!log.length) return {score:0,parts:{},log};
  const coverage=Math.min(1,(log.at(-1)?.end??0)/53);
  const distinct=Math.min(1,variety.size/(discipline==='freestyle'?6:5));
  const finish=successes/log.length;
  const comboScore=clamp(comboRaw*9);
  const linkScore=clamp(totalLinks?(linkedCount/totalLinks)*100*coverage*(.65+.35*distinct):0);
  const mixed=discipline!=='freestyle'||usedFamilies.size===2?1:.72;
  const movement=(stat:number,equipment:number)=>rules>=4?30+clamp(stat,0,RULES.statCap)*70/RULES.statCap+equipment:30+stat*.7+equipment;
  const partsAll={
    execution:round(clamp(execution/RULES.executionTarget[discipline]*100*(.66+.34*distinct)*mixed)),
    link:round(linkScore),
    combo:round(discipline==='freestyle'?(linkScore*.47+comboScore*.53)*mixed:comboScore),
    carve:round(clamp(movement(stats.carve,bonus.carve)*coverage*(.35+.65*finish))),
    speed:round(clamp(movement(stats.speed,bonus.speed)*coverage*(.35+.65*finish)*(rules===1?.65+.0035*p.energy:1))),
  };
  const weights=Object.entries(rules<4&&discipline==='dance'
    ?{execution:40,link:35,carve:15,speed:10}
    :RULES.scoreWeights[discipline]) as [keyof typeof partsAll,number][];
  return { score:round(weights.reduce((s,[part,weight])=>s+partsAll[part]*weight/100,0)),parts:Object.fromEntries(weights.map(([part])=>[part,partsAll[part]])),log };
}

export const NAMES:Record<string,string> = Object.fromEntries(RIVALS.map(n=>[n.id,n.name]));
export function competitor(n:Rival,year:number,week:number):Profile {
  const development=year-1+(week-1)/RULES.weeks;
  const {initialPractice,growthPace,unlockPace,specialist,allRounder,offDiscipline}=RULES.npc;
  const stats=Object.fromEntries(STATS.map(s=>[s,clamp(n.stats[s]+n.growth[s]*(initialPractice+growthPace*development),0,RULES.statCap)])) as Stats;
  const skills:Profile['skills']={};
  for (const s of SKILLS) {
    if(s.requires.some(id=>!learned(skills,id))) continue;
    const base=s.id==='shuvit'?{mastery:46}:START_SKILLS[s.id];
    const bonus=n.favorite===s.family?specialist:n.favorite==='freestyle'?allRounder:offDiscipline;
    const signature=n.signature===s.id?8:0;
    const unlock=Math.max(0,(s.difficulty-1)*unlockPace+s.requires.length*.46-(bonus+signature)/22);
    if (base||development>=unlock)
      skills[s.id]={study:100,mastery:clamp((base?.mastery??(62-s.difficulty*8))+development*n.mastery+bonus+signature)};
  }
  return {stats,skills,injury:null,energy:n.id==='sol'?RULES.npc.veteranEnergy:RULES.npc.energy};
}
const npcLines=new Map<string,{profile:Profile;routine:string[]}>();
export function opponentPerformance(n:Rival,year:number,meet:Meet,discipline:Discipline,seed:number){
  const key=[n.id,year,meet.week,discipline].join('/');
  let line=npcLines.get(key);
  if(!line){
    const profile=competitor(n,year,meet.week);
    const style=n.favorite===discipline||discipline==='freestyle'?n.tactic:'stable';
    line={profile,routine:generateRoutine(profile,discipline,style,n.signature)};
    npcLines.set(key,line);
  }
  const run=simulateRun(line.profile,discipline,line.routine,seeded(seed,year,meet.id,discipline,n.id));
  return {id:n.id,name:n.name,run};
}

export function competitionStandings(rows:{id:string;name:string;run:Run}[]):Standing[]{
  const compare=(a:Run,b:Run)=>{
    const x=a.judging,y=b.judging;
    return (y?.score??b.score)-(x?.score??a.score)||
      (y?.execution??0)-(x?.execution??0)||(y?.difficulty??0)-(x?.difficulty??0)||
      (y?.variety??0)-(x?.variety??0)||(y?.flow??0)-(x?.flow??0);
  };
  const sorted=[...rows].sort((a,b)=>compare(a.run,b.run)||a.name.localeCompare(b.name,'ko'));
  let place=1;
  return sorted.map(({id,name,run},index)=>{
    if(index&&compare(sorted[index-1].run,run))place=index+1;
    return {id,name,score:run.score,place};
  });
}
export function simulateMeet(rider:Rider,meet:Meet,entries:Discipline[],official=false):{results:Result[];rankings:Record<Discipline,Standing[]>} {
  const effects=gearBonuses(rider);
  let energy=Math.min(100,rider.energy+effects.entryEnergy);
  const order=[...entries,...DISCIPLINES.filter(d=>!entries.includes(d))];
  const rankings={} as Record<Discipline,Standing[]>;
  const results:Result[]=[];
  const look=equippedLook(rider);
  const fatigue=gearBonuses(rider).fatigue;
  for(const d of order){
    const p={...rider,energy};
    const routine=entries.includes(d)?(rider.routines[d].length?rider.routines[d]:generateRoutine(p,d,'flow')):null;
    const run=routine?simulateRun(p,d,routine,seeded(rider.seed,rider.year,meet.id,d,'player')):null;
    const rivals=RIVALS.map(n=>opponentPerformance(n,rider.year,meet,d,rider.seed));
    const standings=competitionStandings(run?[{id:'player',name:rider.name,run},...rivals]:rivals);
    rankings[d]=standings;
    if(!run) continue;
    const opponents=Object.fromEntries(rivals.map(({id,run})=>[id,run]));
    const place=standings.find(x=>x.id==='player')!.place;
    energy=Math.max(0,energy-RULES.entryCost[d]+fatigue);
    const prize=Math.round(RULES.prizes[Math.min(place-1,5)]*(meet.international?2:meet.major?RULES.majorMultiplier:1));
    const proof:Result['proof']=official&&routine?structuredClone({version:RUN_PROOF_VERSION,rules:CURRENT_RUN_RULES,seed:rider.seed,routine,stats:p.stats,energy:p.energy,
      injury:p.injury,skills:p.skills,gear:p.extras?{inventory:p.extras.inventory,equipped:p.extras.equipped,accessories:p.extras.accessories,equipmentVersion:p.extras.equipmentVersion}:undefined}):undefined;
    results.push({
      discipline:d,run,standings,points:meetRP(place,meet.major),
      prize:Math.round(prize*(1+effects.prize))+ECONOMY.participation,participation:ECONOMY.participation,fame:round(Math.max(1,8-place)*(meet.major?2:1)*(1+Math.min(.06,effects.fame+(place<=3?effects.podiumFame:0)))),energy,opponents,look,proof,
    });
  }
  return {results,rankings};
}
