import { calendarFor, meetById, RULES } from '../src/game/data.js';
import { CURRENT_RUN_RULES, simulateRun } from '../src/game/competition.js';
import { equippedLook, freshExtras } from '../src/game/economy.js';
import { chooseEnding, endingName, honors, summarize } from '../src/game/legacy.js';
import { representativeTitle } from '../src/game/relationships.js';
import { divisionFor } from '../src/game/career.js';
import { DISCIPLINES, type Archive, type MeetRecord, type Result } from '../src/game/types.js';
import { METRICS, RANKING_VERSION, RUN_PROOF_VERSION, type MeetHighlight, type Metric, type PublicProfile } from '../src/game/public.js';
import { seeded } from '../src/game/random.js';
import { meetRP, rankingPoints, validRP } from '../src/game/rp.js';

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
  if(!proof||proof.version!==RUN_PROOF_VERSION||
    (proof.rules!==undefined&&(!Number.isInteger(proof.rules)||proof.rules<1||proof.rules>CURRENT_RUN_RULES))||!meetById(meet.id)) return false;
  const player=result.standings.find(row=>row.id==='player');
  if(!player||player.name!==archive.name||player.score!==result.run.score) return false;
  const sorted=[...result.standings].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  if(sorted.length!==7||new Set(sorted.map(x=>x.id)).size!==7||sorted.some((row,index)=>row.place!==index+1||!Number.isFinite(row.score))) return false;
  try{
    const gear=proof.gear?{...freshExtras(),...proof.gear}:undefined;
    const {stats,energy,injury,skills}=proof;
    const replay=simulateRun({stats,energy,injury,skills,extras:gear},result.discipline,proof.routine,meetRng(proof.seed,meet.year,meet.id,result.discipline),proof.rules??1);
    const major=meetById(meet.id)!.major;
    const points=meetRP(player.place,major);
    return points===result.points&&canonical(replay)===canonical(result.run);
  }catch{
    return false;
  }
}
export const meetRng=(seed:number,year:number,id:string,discipline:Result['discipline'])=>seeded(seed,year,id,discipline,'player');

const toHighlight=({meet,result,place}:RecordedRun):MeetHighlight=>({id:meet.id,year:meet.year,division:meet.division,
  discipline:result.discipline,score:result.run.score,place,rp:validRP(result.points)?result.points:undefined});
const byScore=(a:RecordedRun,b:RecordedRun)=>b.result.run.score-a.result.run.score||a.place-b.place||
  a.meet.year-b.meet.year||a.meet.id.localeCompare(b.meet.id)||a.result.discipline.localeCompare(b.result.discipline);

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

export function publicationFor(archive:Archive):{profile:PublicProfile;entries:RankEntry[]} {
  const summary=summarize(archive);
  const ending=archive.ending??chooseEnding(archive);
  const all=archive.records.flatMap(meet=>meet.results.map(result=>({meet,result,place:result.standings.find(x=>x.id==='player')?.place??8})));
  const verified=all.filter(({meet,result})=>verifiedResult(archive,meet,result));
  const rp=rankingPoints(archive);
  const scores=[...all].sort(byScore);
  const entries:RankEntry[]=[];
  const complete=archive.reason==='complete'&&archive.year===RULES.years&&archive.week===RULES.weeks;
  const verifiedTotal=verified.reduce((sum,run)=>sum+run.result.points,0);
  const rankable=rp.total>0&&!rp.partial&&verified.length===all.length&&verifiedTotal===rp.total&&validSeries(archive);
  const representatives:NonNullable<PublicProfile['representatives']>={};
  for(const metric of METRICS){
    const best=scores.find(run=>metric==='career'||run.result.discipline===metric);
    if(best)representatives[metric]=toHighlight(best);
    const score=metric==='career'?rp.total:rp.disciplines[metric];
    if(rankable&&score>0)entries.push({metric,score});
  }
  const routines=Object.fromEntries(DISCIPLINES.flatMap(d=>{
    const best=scores.find(x=>x.result.discipline===d)?.result;
    return best?[[d,best.proof?.routine??best.run.log.map(frame=>frame.id)]]:[];
  }));
  return {entries,profile:{name:archive.name,look:equippedLook(archive),title:endingName(ending),representativeTitle:representativeTitle(archive)??null,year:archive.year,week:archive.week,
    complete,division:divisionFor(archive.year),stats:archive.stats,
    skills:summary.learned.map(skill=>({id:skill.id,mastery:archive.skills[skill.id].mastery})),signature:summary.favorite?.id,
    wins:summary.wins,podiums:summary.podiums,meets:summary.meets,best:summary.best,fame:archive.fame,
    ending,routines,honors:archive.honors??honors(archive),meetHistory:all.map(toHighlight),rp,representatives,rankingVersion:RANKING_VERSION,
    official:entries.length>0,historic:rp.total>0&&!rankable}};
}
