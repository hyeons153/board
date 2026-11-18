import { CALENDAR, RULES } from '../src/game/data.js';
import { simulateRun } from '../src/game/competition.js';
import { equippedLook, freshExtras } from '../src/game/economy.js';
import { chooseEnding, endingName, summarize } from '../src/game/legacy.js';
import { DISCIPLINES, DIVISIONS, type Archive, type MeetRecord, type Result } from '../src/game/types.js';
import { RANKING_VERSION, type Metric, type PublicProfile, type Scope } from '../src/game/public.js';

export type RankEntry={metric:Metric;scope:Scope;score:number};
const divisionWeight={rookie:1,regular:1.5,open:2.25};
const allowedPlace=[1,.72,.52,.32,.23,.16,.10];

function canonical(value:unknown):string {
  if(value===null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  const object=value as Record<string,unknown>;
  return '{'+Object.keys(object).sort().map(key=>JSON.stringify(key)+':'+canonical(object[key])).join(',')+'}';
}
export function verifiedResult(archive:Archive,meet:MeetRecord,result:Result){
  const proof=result.proof;
  if(!proof||proof.version!==RANKING_VERSION||!CALENDAR.some(item=>item.id===meet.id)) return false;
  const player=result.standings.find(row=>row.id==='player');
  if(!player||player.name!==archive.name||player.score!==result.run.score) return false;
  const sorted=[...result.standings].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  if(sorted.length!==7||new Set(sorted.map(x=>x.id)).size!==7||sorted.some((row,index)=>row.place!==index+1||!Number.isFinite(row.score))) return false;
  try{
    const gear=proof.gear?{...freshExtras(),...proof.gear}:undefined;
    const {stats,energy,injury,skills}=proof;
    const replay=simulateRun({stats,energy,injury,skills,extras:gear},result.discipline,proof.routine,meetRng(proof.seed,meet.year,meet.id,result.discipline));
    const major=CALENDAR.find(item=>item.id===meet.id)!.major;
    const points=Math.round(RULES.places[Math.min(player.place-1,5)]*(major?RULES.majorMultiplier:1));
    return points===result.points&&canonical(replay)===canonical(result.run);
  }catch{
    return false;
  }
}
import { seeded } from '../src/game/random.js';
export const meetRng=(seed:number,year:number,id:string,discipline:Result['discipline'])=>seeded(seed,year,id,discipline,'player');

export function publicationFor(archive:Archive):{profile:PublicProfile;entries:RankEntry[]} {
  const summary=summarize(archive);
  const ending=archive.ending??chooseEnding(archive);
  const all=archive.records.flatMap(meet=>meet.results.map(result=>({meet,result,place:result.standings.find(x=>x.id==='player')?.place??8})));
  const verified=all.filter(({meet,result})=>verifiedResult(archive,meet,result));
  const entries:RankEntry[]=[];
  const complete=archive.reason==='complete'&&archive.year===RULES.years&&archive.week===RULES.weeks;
  const chronological=archive.records.length===RULES.years*CALENDAR.length&&
    new Set(archive.records.map(meet=>meet.year+':'+meet.id)).size===RULES.years*CALENDAR.length;
  const full=complete&&chronological&&archive.rankedStart===RANKING_VERSION&&verified.length>0&&verified.length===all.length;
  let careerPoints:number|null=null;
  if(full){
    const contest=verified.reduce((total,{meet,result,place})=>{
      const major=CALENDAR.find(item=>item.id===meet.id)?.major?1.5:1;
      return total+(result.run.score*.6+40*(allowedPlace[place-1]??0))*divisionWeight[meet.division]*major;
    },0);
    careerPoints=Math.round((contest+summary.champions.reduce((sum,c)=>sum+45*divisionWeight[c.division],0))*10)/10;
    entries.push({metric:'career',scope:'all',score:careerPoints});
  }
  for(const scope of ['all',...DIVISIONS] as const){
    const valid=verified.filter(x=>scope==='all'||x.meet.division===scope);
    for(const metric of DISCIPLINES){
      const runs=valid.filter(x=>x.result.discipline===metric);
      if(runs.length) entries.push({metric,scope,score:Math.max(...runs.map(x=>x.result.run.score))});
    }
    if(valid.length) entries.push({metric:'wins',scope,score:valid.filter(x=>x.place===1).length});
  }
  if(archive.rankedStart===RANKING_VERSION&&verified.length){
    const score=summary.learned.length*10+summary.learned.reduce((sum,skill)=>sum+archive.skills[skill.id].mastery*.1,0)+summary.advanced.length*15;
    entries.push({metric:'skills',scope:'all',score:Math.round(score*10)/10});
  }
  const routines=Object.fromEntries(DISCIPLINES.flatMap(d=>{
    const best=all.filter(x=>x.result.discipline===d).sort((a,b)=>b.result.run.score-a.result.run.score)[0]?.result;
    return best?[[d,best.proof?.routine??best.run.log.map(frame=>frame.id)]]:[];
  }));
  return {entries,profile:{name:archive.name,look:equippedLook(archive),title:endingName(ending),year:archive.year,week:archive.week,
    complete,division:archive.year>=4?'open':archive.year>=2?'regular':'rookie',stats:archive.stats,
    skills:summary.learned.map(skill=>({id:skill.id,mastery:archive.skills[skill.id].mastery})),signature:summary.favorite?.id,
    wins:summary.wins,podiums:summary.podiums,meets:summary.meets,best:summary.best,points:summary.points,careerPoints,
    ending, routines, official:entries.length>0,historic:verified.length!==all.length||archive.rankedStart!==RANKING_VERSION}};
}
