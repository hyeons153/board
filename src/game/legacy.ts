import { CALENDAR, DISCIPLINE_NAMES, SKILLS } from './data.js';
import { equippedLook } from './economy.js';
import { DISCIPLINES, STATS, type Archive, type Career, type Discipline, type Ending, type Look, type Mentor, type Rider } from './types.js';

type CareerRecord = Pick<Archive,'name'|'year'|'week'|'stats'|'skills'|'records'|'relations'|'seasons'|'extras'> & { reason?: Rider['reason']; season?: Rider['season']; events?: Rider['events'] };
export const ENDING_RULES = { openWins:24, majors:8, openChampionships:2, seniorChampionships:1, advancedSkillCount:6, mastery:82, friendship:30 } as const;
export const ENDINGS = {
  legend:{ title:'오픈부 레전드', line:'관중이 마지막 바퀴 소리가 멈출 때까지 자리에서 일어나지 않았다.', spot:'arena' },
  champion:{ title:'시즌 챔피언', line:'시즌 내내 가꿔 온 한 종목의 리듬이 마침내 시상대에 닿았다.', spot:'arena' },
  technician:{ title:'보드 위의 테크니션', line:'동료들은 어려운 동작보다 어려운 동작을 배울 때의 네 표정을 더 오래 기억했다.', spot:'studio' },
  veteran:{ title:'강변의 베테랑', line:'처음 보드를 끌고 왔던 길을 오늘은 천천히 굴러 돌아간다.', spot:'river' },
  early:{ title:'다음 길을 향해', line:'시즌은 여기서 멈췄지만 보드는 현관 가까이에 둔다.', spot:'park' },
} as const;

export function summarize(record:CareerRecord){
  const meets=record.records.filter(meet=>meet.results.length);
  const results=meets.flatMap(meet=>meet.results);
  const place=(result:typeof results[number])=>result.standings.find(row=>row.id==='player')?.place??Infinity;
  const best=Object.fromEntries(DISCIPLINES.map(d=>[d,Math.max(0,...results.filter(result=>result.discipline===d).map(result=>result.run.score))])) as Record<Discipline,number>;
  const champions=record.seasons.flatMap(season=>DISCIPLINES.flatMap(d=>{
    const points=season.scores[d];
    const top=Object.entries(points).sort(([a,x],[b,y])=>y-x||a.localeCompare(b))[0];
    return top?.[0]==='player'?[{year:season.year,discipline:d,division:season.division}]:[];
  }));
  const learned=SKILLS.filter(skill=>(record.skills[skill.id]?.study??0)>=100);
  const advanced=learned.filter(skill=>skill.difficulty>=3&&(record.skills[skill.id]?.mastery??0)>=ENDING_RULES.mastery);
  const favorite=[...learned].sort((a,b)=>(record.skills[b.id]?.mastery??0)-(record.skills[a.id]?.mastery??0)||b.difficulty-a.difficulty)[0];
  return {meets:meets.length,wins:results.filter(x=>place(x)===1).length,podiums:results.filter(x=>place(x)<=3).length,best,
    points:results.reduce((total,result)=>total+result.points,0),champions,learned,advanced,favorite,
    openWins:meets.filter(meet=>meet.division==='open').flatMap(meet=>meet.results).filter(x=>place(x)===1).length,
    majorWins:meets.filter(meet=>meet.division==='open'&&CALENDAR.find(item=>item.id===meet.id)?.major).flatMap(meet=>meet.results).filter(x=>place(x)===1).length,
    triple:meets.some(meet=>meet.results.length===3&&meet.results.every(x=>place(x)===1))};
}
function storyFriends(record:CareerRecord){
  const completed:Record<string,string[]>={yu:['yu-rematch','yu-open-final','yu-film'],jun:['jun-jam','jun-quiet','jun-open-final'],min:['min-race'],ha:['harin-route'],noa:['noa-crew'],sol:['sol-veteran','trophy-table']};
  return Object.entries(completed).filter(([id,arcs])=>(record.relations[id]??0)>=ENDING_RULES.friendship&&
    arcs.some(arc=>record.events?.[arc]||record.extras?.choices[arc])).map(([id])=>id);
}
export function chooseEnding(record:CareerRecord):Ending {
  const stats=summarize(record);
  const friends=storyFriends(record);
  if(record.reason==='early') return {kind:'early',friends};
  if(stats.openWins>=ENDING_RULES.openWins&&stats.majorWins>=ENDING_RULES.majors&&stats.champions.filter(x=>x.division==='open').length>=ENDING_RULES.openChampionships)
    return {kind:'legend',friends};
  const champion=[...DISCIPLINES].sort((a,b)=>stats.champions.filter(x=>x.discipline===b).length-stats.champions.filter(x=>x.discipline===a).length||stats.best[b]-stats.best[a])
    .find(d=>stats.champions.filter(x=>x.discipline===d).length>=ENDING_RULES.seniorChampionships);
  if(champion) return {kind:'champion',discipline:champion,friends};
  if(stats.advanced.length>=ENDING_RULES.advancedSkillCount) return {kind:'technician',friends};
  return {kind:'veteran',friends};
}
export function endingName(ending:Ending){
  return ending.kind==='champion'&&ending.discipline ? DISCIPLINE_NAMES[ending.discipline]+' 챔피언' : ENDINGS[ending.kind].title;
}
export function honors(record:CareerRecord):string[]{
  const s=summarize(record);
  const achieved=[
    [s.learned.length>6,'첫 기술 습득'],[s.learned.some(x=>x.difficulty>=3),'고급 기술 첫 습득'],[s.learned.length>=10,'기술 10개 습득'],
    [s.learned.filter(x=>x.family==='dance').length===16,'모든 댄싱 기술'],[s.learned.filter(x=>x.family==='trick').length===13,'모든 트릭 기술'],
    [s.learned.length===29&&s.learned.every(skill=>record.skills[skill.id].mastery>=90),'전체 기술 마스터'],
    [s.meets>0,'첫 대회 참가'],[s.podiums>0,'첫 입상'],[s.wins>0,'첫 우승'],
    [s.champions.some(x=>x.division==='rookie'),'뉴비부 챔피언'],[s.champions.some(x=>x.division==='regular'),'일반부 챔피언'],
    [s.champions.some(x=>x.division==='open'),'오픈부 챔피언'],[s.triple,'한 대회 3종목 우승'],
    [record.year>=4,'오픈부 진입'],[record.reason==='complete','8년 커리어 완주'],[storyFriends(record).length>0,'라이벌 에필로그'],
    [new Set(s.champions.map(x=>x.discipline)).size===3,'전 종목 시즌 챔피언'],
    [record.reason==='complete'&&chooseEnding(record).kind==='legend','레전드 엔딩'],
    [record.stats.carve>=85,'카빙의 달인'],[s.learned.filter(x=>x.family==='dance'&&record.skills[x.id].mastery>=85).length>=8,'스텝 마스터'],
    [s.learned.filter(x=>x.family==='trick'&&record.skills[x.id].mastery>=85).length>=7,'트릭 스페셜리스트'],
  ] as const;
  return achieved.filter(([met])=>met).map(([,label])=>label);
}
export function mentorFrom(archive:Archive):Mentor {
  const stats=summarize(archive);
  return {id:archive.id,name:archive.name,look:equippedLook(archive),skill:stats.favorite?.id,title:endingName(archive.ending??chooseEnding(archive)),wins:stats.wins};
}
export function mergeCareers(destination:Career,guest:Career):Career {
  const incoming=guest.rider?.phase!=='retired'?guest.rider:null;
  const current=destination.rider?.phase==='retired'&&incoming?null:destination.rider;
  const keep=current??incoming??destination.rider??guest.rider;
  const parked=[...(destination.parked??[]),...(guest.parked??[]),...(incoming&&keep?.id!==incoming.id?[incoming]:[])];
  const halls=new Map([...destination.hall,...guest.hall].map(archive=>[archive.id,archive]));
  return {rider:keep,hall:[...halls.values()],parked:[...new Map(parked.filter(r=>r.id!==keep?.id).map(r=>[r.id,r])).values()]};
}
export const statTotal=(stats:Rider['stats'])=>STATS.reduce((sum,stat)=>sum+stats[stat],0);
