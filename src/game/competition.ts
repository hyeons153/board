import { RULES, SKILL, SKILLS, START_SKILLS } from './data.js';
import { RIVALS, type Rival } from './content.js';
import { ECONOMY, equippedLook, gearBonuses } from './economy.js';
import { RANKING_VERSION } from './public.js';
import { clamp, round, seeded } from './random.js';
import { DISCIPLINES, STATS, type Discipline, type Rider, type RoutineStyle, type Run, type Skill, type Meet, type Result, type Stats, type Progress, type Outcome, type Standing } from './types.js';

export const learned = (skills:Record<string,Progress>, id:string) => (skills[id]?.study ?? 0) >= 100;
export const allowed = (skill:Skill, discipline:Discipline) => discipline==='freestyle' || skill.family===discipline;
export const routineTime = (ids:string[]) => ids.reduce((s,id,i)=>s+(SKILL[id]?.seconds??0)+(i?RULES.transition:0),0);
export function validRoutine(rider:Pick<Rider,'skills'>,discipline:Discipline,ids:string[]) {
  return routineTime(ids)<=RULES.runSeconds && ids.every(id=>{const s=SKILL[id];return !!s&&allowed(s,discipline)&&learned(rider.skills,id);});
}
type Profile = Pick<Rider,'stats'|'energy'|'skills'|'injury'|'extras'>;
export function chance(profile:Profile,s:Skill,energy=profile.energy) {
  const c=RULES.success;
  const equipment = s.family==='trick' ? gearBonuses(profile).trickLand : 0;
  const injury = profile.injury?.severity==='major' ? .18 : profile.injury ? .08 : 0;
  return clamp(c.base+(profile.skills[s.id]?.mastery??0)*c.mastery+profile.stats.balance*c.balance+energy*c.energy-(s.difficulty-1)*c.difficulty-s.risk-injury+equipment,c.min,c.max);
}
const affinity = (a:Skill,b:Skill) => a.id===b.id ? -.17 : (a.tags.some(t=>b.tags.includes(t)) ? RULES.run.danceAffinity : 0)+(a.family!==b.family ? RULES.run.mixedAffinity : 0);
export function generateRoutine(p:Profile,d:Discipline,style:RoutineStyle,signature?:string):string[] {
  const pool=SKILLS.filter(s=>allowed(s,d)&&learned(p.skills,s.id));
  const ids:string[]=[];
  let used=0;
  const budget=RULES.runSeconds-(style==='stable'?7:style==='flow'?4:0);
  while (used<budget) {
    const prev=SKILL[ids.at(-1)??''];
    const score=(s:Skill)=>{
      const seen=ids.filter(id=>id===s.id).length;
      const mixed=d==='freestyle'&&prev&&prev.family!==s.family?1.4:0;
      const pSuccess=chance(p,s);
      const base=style==='stable'?pSuccess*12+s.points*.18:style==='flow'?pSuccess*7+s.points*.45+(prev?affinity(prev,s)*17:0):s.points*.78+pSuccess*4;
      const signatureWeight=s.id===signature&&!seen ? 3 : 0;
      return base+mixed+signatureWeight-(seen*(style==='score'?3.5:4.5))-(prev?.id===s.id?3:0);
    };
    const next=pool.filter(s=>used+s.seconds+(ids.length?RULES.transition:0)<=budget).sort((a,b)=>score(b)-score(a))[0];
    if(!next) break;
    used+=next.seconds+(ids.length?RULES.transition:0);
    ids.push(next.id);
  }
  return ids;
}

export function simulateRun(p:Profile, discipline:Discipline, ids:string[], rng:()=>number):Run {
  if(!validRoutine(p,discipline,ids)) throw new Error('유효하지 않은 루틴입니다.');
  let at=0, execution=0, combo=0, comboRaw=0, totalLinks=0, linkedCount=0, previous:Skill|undefined, successes=0;
  const seen=new Map<string,number>(), variety=new Set<string>(), usedFamilies=new Set<string>();
  const bonus=gearBonuses(p);
  const log:Run['log']=[];
  for (const id of ids) {
    const move=SKILL[id]!;
    const start=at+(log.length?RULES.transition:0);
    const end=start+move.seconds;
    if (end>RULES.runSeconds) break;
    const remainingEnergy=Math.max(0,p.energy-start/RULES.runSeconds*RULES.entryCost[discipline]*.75);
    const trickChain=previous?.family==='trick' && move.family==='trick';
    const probability=chance(p,move,remainingEnergy)-(trickChain ? RULES.run.trickChainSuccess : 0);
    const value=rng();
    const outcome:Outcome=value>=probability?'miss':value<probability*.19?'great':value<probability*.75?'clean':'rough';
    let linked:boolean|null=null;
    if(previous) {
      totalLinks++;
      const mastery=((p.skills[previous.id]?.mastery??0)+(p.skills[move.id]?.mastery??0))/2;
      const equipment=move.family==='dance' ? bonus.danceLink : 0;
      linked=rng()<clamp(.29 + p.stats.link*.005 + remainingEnergy*.00115 + affinity(previous,move) +
        mastery*RULES.run.masteryLink + equipment - (trickChain ? RULES.run.trickChainLink : 0),.08,.97) && outcome!=='miss';
      if(linked) linkedCount++;
    }
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
  const partsAll={
    execution:round(clamp(execution/RULES.executionTarget[discipline]*100*(.66+.34*distinct)*mixed)),
    link:round(linkScore),
    combo:round(discipline==='freestyle'?(linkScore*.47+comboScore*.53)*mixed:comboScore),
    carve:round(clamp((30+p.stats.carve*.7+bonus.carve)*coverage*(.35+.65*finish))),
    speed:round(clamp((30+p.stats.speed*.7+bonus.speed)*coverage*(.35+.65*finish)*(.65+.0035*p.energy))),
  };
  const weights=Object.entries(RULES.scoreWeights[discipline]) as [keyof typeof partsAll,number][];
  return { score:round(weights.reduce((s,[part,weight])=>s+partsAll[part]*weight/100,0)),parts:Object.fromEntries(weights.map(([part])=>[part,partsAll[part]])),log };
}

export const NAMES:Record<string,string> = Object.fromEntries(RIVALS.map(n=>[n.id,n.name]));
export function competitor(n:Rival,year:number,week:number):Profile {
  const development=year-1+(week-1)/52;
  const stats=Object.fromEntries(STATS.map(s=>[s,clamp(n.stats[s]+development*n.growth[s])])) as Stats;
  const skills:Profile['skills']={};
  for (const s of SKILLS) {
    if(s.requires.some(id=>!learned(skills,id))) continue;
    const base=START_SKILLS[s.id];
    const bonus=n.favorite===s.family ? RULES.npc.specialist : n.favorite==='freestyle' ? RULES.npc.allRounder : RULES.npc.offDiscipline;
    const signature=n.signature===s.id ? 6 : 0;
    if (base || development>=s.difficulty*RULES.npc.unlockPace-(bonus+signature)/25)
      skills[s.id]={study:100,mastery:clamp((base?.mastery??(37-s.difficulty*4))+development*n.mastery+bonus+signature)};
  }
  return {stats,skills,injury:null,energy:n.id==='sol'?RULES.npc.veteranEnergy:RULES.npc.energy};
}
export function simulateMeet(rider:Rider,meet:Meet,entries:Discipline[],official=false):{results:Result[];rankings:Record<Discipline,Standing[]>} {
  let energy=rider.energy;
  const npcEnergy:Record<string,number>={};
  const order=[...entries,...DISCIPLINES.filter(d=>!entries.includes(d))];
  const rankings={} as Record<Discipline,Standing[]>;
  const results:Result[]=[];
  const look=equippedLook(rider);
  const fatigue=gearBonuses(rider).fatigue;
  for(const d of order){
    const p={...rider,energy};
    const routine=entries.includes(d)?(rider.routines[d].length?rider.routines[d]:generateRoutine(p,d,'flow')):null;
    const run=routine?simulateRun(p,d,routine,seeded(rider.seed,rider.year,meet.id,d,'player')):null;
    const opponents:Record<string,Run> = {};
    const standings=[
      ...(run?[{id:'player',name:rider.name,score:run.score}]:[]),
      ...RIVALS.map(n=>{
        const npc=competitor(n,rider.year,rider.week);
        npc.energy=npcEnergy[n.id]??npc.energy;
        const style=n.favorite===d || d==='freestyle' ? n.tactic : 'stable';
        const r=simulateRun(npc,d,generateRoutine(npc,d,style,n.signature),seeded(rider.seed,rider.year,meet.id,d,n.id));
        if(run) opponents[n.id]=r;
        npcEnergy[n.id]=Math.max(0,npc.energy-RULES.entryCost[d]);
        return {id:n.id,name:n.name,score:r.score};
      }),
    ].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).map((e,i)=>({...e,place:i+1}));
    rankings[d]=standings;
    if(!run) continue;
    const place=standings.find(x=>x.id==='player')!.place;
    energy=Math.max(0,energy-RULES.entryCost[d]+fatigue);
    const prize=Math.round(RULES.prizes[Math.min(place-1,5)]*(meet.major?RULES.majorMultiplier:1));
    const proof=official&&routine?structuredClone({version:RANKING_VERSION,seed:rider.seed,routine,stats:p.stats,energy:p.energy,
      injury:p.injury,skills:p.skills,gear:p.extras?{inventory:p.extras.inventory,equipped:p.extras.equipped}:undefined}):undefined;
    results.push({
      discipline:d,run,standings,points:Math.round(RULES.places[Math.min(place-1,5)]*(meet.major?RULES.majorMultiplier:1)),
      prize:prize+ECONOMY.participation,participation:ECONOMY.participation,fame:Math.max(1,8-place)*(meet.major?2:1),energy,opponents,look,proof,
    });
  }
  return {results,rankings};
}
