import { calendarFor, meetById, RULES, SKILLS } from '../src/game/data.js';
import { allowed, learned, simulateRun } from '../src/game/competition.js';
import { equippedLook, freshExtras } from '../src/game/economy.js';
import { chooseEnding, endingName, honors, statTotal, summarize } from '../src/game/legacy.js';
import { divisionFor } from '../src/game/career.js';
import { DISCIPLINES, STATS, type Archive, type MeetRecord, type Result } from '../src/game/types.js';
import { HONOR_RULES, METRICS, RANKING_VERSION, RANK_INFO, RUN_PROOF_VERSION, type HonorScore, type MeetHighlight, type Metric, type PublicProfile } from '../src/game/public.js';
import { clamp, round, seeded } from '../src/game/random.js';

export type RankEntry={metric:Metric;score:number};
type RecordedRun={meet:MeetRecord;result:Result;place:number};

function canonical(value:unknown):string {
  if(value===null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  const object=value as Record<string,unknown>;
  return '{'+Object.keys(object).sort().map(key=>JSON.stringify(key)+':'+canonical(object[key])).join(',')+'}';
}
export function verifiedResult(archive:Archive,meet:MeetRecord,result:Result){
  const proof=result.proof;
  if(!proof||proof.version!==RUN_PROOF_VERSION||(proof.rules!==undefined&&proof.rules!==1&&proof.rules!==2&&proof.rules!==3)||!meetById(meet.id)) return false;
  const player=result.standings.find(row=>row.id==='player');
  if(!player||player.name!==archive.name||player.score!==result.run.score) return false;
  const sorted=[...result.standings].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  if(sorted.length!==7||new Set(sorted.map(x=>x.id)).size!==7||sorted.some((row,index)=>row.place!==index+1||!Number.isFinite(row.score))) return false;
  try{
    const gear=proof.gear?{...freshExtras(),...proof.gear}:undefined;
    const {stats,energy,injury,skills}=proof;
    const replay=simulateRun({stats,energy,injury,skills,extras:gear},result.discipline,proof.routine,meetRng(proof.seed,meet.year,meet.id,result.discipline),proof.rules??1);
    const major=meetById(meet.id)!.major;
    const points=Math.round(RULES.places[Math.min(player.place-1,5)]*(major?RULES.majorMultiplier:1));
    return points===result.points&&canonical(replay)===canonical(result.run);
  }catch{
    return false;
  }
}
export const meetRng=(seed:number,year:number,id:string,discipline:Result['discipline'])=>seeded(seed,year,id,discipline,'player');

const toHighlight=({meet,result,place}:RecordedRun):MeetHighlight=>({id:meet.id,year:meet.year,division:meet.division,discipline:result.discipline,score:result.run.score,place});

function validSeries(archive:Archive){
  const seen=new Set<string>();
  return archive.records.every(meet=>{
    const key=meet.year+':'+meet.id;
    const scheduled=calendarFor(meet.year).find(item=>item.id===meet.id)??(archive.calendarVersion!==2&&meet.id==='festival'?meetById(meet.id):undefined);
    if(!scheduled||seen.has(key)||meet.year<1||meet.year>archive.year||meet.year>RULES.years||meet.year===archive.year&&scheduled.week>archive.week)return false;
    seen.add(key);
    const disciplines=new Set(meet.results.map(result=>result.discipline));
    return disciplines.size===meet.results.length&&(!scheduled.international||DISCIPLINES.every(d=>disciplines.has(d)));
  });
}

function competitionValue({meet,result,place}:RecordedRun){
  const {division,major,places,runWeight,levelWeight}=HONOR_RULES;
  const difficulty=division[meet.division]*(meetById(meet.id)?.major?major:1)/(division.master*major);
  const performance=result.run.score/100*runWeight+(places[place-1]??0)*(1-runWeight);
  return performance*(1-levelWeight+levelWeight*difficulty);
}

function honorScore(archive:Archive,metric:Metric,verified:RecordedRun[],summary:ReturnType<typeof summarize>):HonorScore|undefined{
  const runs=metric==='career'?verified:verified.filter(run=>run.result.discipline===metric);
  const ranked=runs.map(run=>({run,quality:competitionValue(run)})).sort((a,b)=>b.quality-a.quality||b.run.result.run.score-a.run.result.run.score||
    a.run.meet.year-b.run.meet.year||a.run.meet.id.localeCompare(b.run.meet.id)||a.run.result.discipline.localeCompare(b.run.result.discipline));
  if(!ranked.length)return;
  // International events can contribute to every discipline, but count as one meet in the overall consistency average.
  const byMeet=new Map<string,number>();
  for(const {run,quality} of ranked){
    const key=run.meet.year+':'+run.meet.id;
    if(!byMeet.has(key))byMeet.set(key,quality);
  }
  const top=[...byMeet.values()].slice(0,HONOR_RULES.meetLimit);
  const competition=top.reduce((sum,value)=>sum+value,0)/top.length*(1-HONOR_RULES.repeatWeight+HONOR_RULES.repeatWeight*top.length/HONOR_RULES.meetLimit);
  const pool=metric==='career'?SKILLS:SKILLS.filter(skill=>allowed(skill,metric));
  const skills=pool.reduce((sum,skill)=>sum+(learned(archive.skills,skill.id)?skill.difficulty*(1-HONOR_RULES.masteryWeight+HONOR_RULES.masteryWeight*clamp(archive.skills[skill.id].mastery)/100):0),0)
    /pool.reduce((sum,skill)=>sum+skill.difficulty,0);
  const completed=archive.seasons.filter(season=>season.year<archive.year||archive.reason==='complete');
  const titleYears=new Set(summary.champions.filter(title=>completed.some(season=>season.year===title.year)&&verified.some(run=>run.meet.year===title.year&&run.result.discipline===title.discipline)).map(title=>title.year));
  const values={competition,personalBest:Math.max(...runs.map(run=>run.result.run.score))/100,skills,
    stats:statTotal(archive.stats)/(STATS.length*RULES.statCap),seasons:titleYears.size/Math.max(1,completed.length)};
  const weights=RANK_INFO[metric].weights;
  const components:HonorScore['components']={};
  for(const [key,weight] of Object.entries(weights)){
    const component=key as keyof typeof values;
    components[component]=round(clamp(values[component],0,1)*weight);
  }
  return {total:round(Object.values(components).reduce((sum,points)=>sum+points,0)),components,
    representative:toHighlight(ranked[0].run),verifiedMeets:byMeet.size};
}

export function publicationFor(archive:Archive):{profile:PublicProfile;entries:RankEntry[]} {
  const summary=summarize(archive);
  const ending=archive.ending??chooseEnding(archive);
  const all=archive.records.flatMap(meet=>meet.results.map(result=>({meet,result,place:result.standings.find(x=>x.id==='player')?.place??8})));
  const verified=all.filter(({meet,result})=>verifiedResult(archive,meet,result));
  const entries:RankEntry[]=[];
  const complete=archive.reason==='complete'&&archive.year===RULES.years&&archive.week===RULES.weeks;
  const honorScores:NonNullable<PublicProfile['honorScores']>={};
  if(verified.length&&verified.length===all.filter(run=>run.result.proof).length&&validSeries(archive)){
    for(const metric of METRICS){
      const score=honorScore(archive,metric,verified,summary);
      if(score){honorScores[metric]=score;entries.push({metric,score:score.total});}
    }
  }
  const routines=Object.fromEntries(DISCIPLINES.flatMap(d=>{
    const best=all.filter(x=>x.result.discipline===d).sort((a,b)=>b.result.run.score-a.result.run.score)[0]?.result;
    return best?[[d,best.proof?.routine??best.run.log.map(frame=>frame.id)]]:[];
  }));
  return {entries,profile:{name:archive.name,look:equippedLook(archive),title:endingName(ending),year:archive.year,week:archive.week,
    complete,division:divisionFor(archive.year),stats:archive.stats,
    skills:summary.learned.map(skill=>({id:skill.id,mastery:archive.skills[skill.id].mastery})),signature:summary.favorite?.id,
    wins:summary.wins,podiums:summary.podiums,meets:summary.meets,best:summary.best,points:summary.points,careerPoints:honorScores.career?.total??null,
    ending,routines,honors:archive.honors??honors(archive),meetHistory:all.map(toHighlight),honorScores,rankingVersion:RANKING_VERSION,
    official:entries.length>0,historic:verified.length!==all.length||archive.rankedStart!==RUN_PROOF_VERSION}};
}
