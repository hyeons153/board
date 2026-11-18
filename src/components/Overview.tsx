import { Activity, ArrowUpRight, CalendarDays, Gauge, HeartPulse, Link2, MoveDiagonal2, Route, Wind } from 'lucide-react';
import { CALENDAR, DIVISION_NAMES, RULES, STAT_NAMES } from '../game/data';
import { divisionFor, nextMeet } from '../game/career';
import { lineTerms } from '../game/content';
import { STATS, type Rider, type GameAction } from '../game/types';
import { Tag } from './Brand';

export const money=(n:number)=>'₩'+n.toLocaleString('ko-KR');
const StatIcon={speed:Wind,carve:Route,link:Link2,balance:MoveDiagonal2};
export type Submit=(action:GameAction)=>Promise<boolean>;

export function StatCards({r}:{r:Rider}){
  return <div className="stat-grid">{STATS.map((s,i)=>{
    const Icon=StatIcon[s];
    return <article className="stat-card" key={s}><div className="stat-label"><Icon size={16}/><span>{STAT_NAMES[s]}</span></div><div className="stat-value">{r.stats[s]}<span> / 100</span></div><div className="bar"><span className={`stat-fill stat-${i}`} style={{width:r.stats[s]+'%'}}/></div></article>;
  })}</div>;
}
export function RiderCard({r}:{r:Rider}){
  return <article className="panel status-card"><div className="card-heading"><span><HeartPulse size={17}/> 선수 컨디션</span><Tag kind={r.injury?'orange':'lime'}>{r.injury?r.injury.severity==='major'?'중상':'경상':'양호'}</Tag></div><div className="energy-label"><span>체력</span><b>{Math.round(r.energy)}<small> / 100</small></b></div><div className="bar energy"><span style={{width:r.energy+'%'}}/></div>{r.injury&&<p className="warning">회복까지 {r.injury.weeks}주{r.injury.treated?' · 치료 완료':' · 휴식 / 치료 가능'}</p>}<div className="card-bottom"><span>보유금 <strong>{money(r.money)}</strong></span><span>명성 <strong>{r.fame}</strong></span></div></article>;
}
export function Upcoming({r,onClick}:{r:Rider;onClick:()=>void}){
  const m=nextMeet(r);
  return <article className="panel upcoming"><div className="card-heading"><span><CalendarDays size={17}/> 다음 대회</span><Tag kind={m?.major?'orange':'muted'}>{m?.major?'MAJOR':'CALENDAR'}</Tag></div>
    {m&&r.phase!=='retired'?<><div className="upcoming-date"><b>{String(m.month).padStart(2,'0')}</b><span>월<br/>{m.week}주차</span></div><h3>{m.name}</h3><p>{m.week===r.week?'이번 주 개최':`${m.week-r.week}주 후`} · {DIVISION_NAMES[divisionFor(r.year)]}</p></>:<p>시즌이 종료되었습니다.</p>}
    <button className="text-button" onClick={onClick}>대회 일정 보기 <ArrowUpRight size={15}/></button></article>;
}
export function NewsCard({r}:{r:Rider}){
  return <article className="panel news"><div className="card-heading"><span><Activity size={16}/> 라이더 일지</span></div><ul>{r.news.slice(0,5).map((n,i)=><li key={`${n.year}-${n.week}-${i}`}><span>{n.year}Y / {String(n.week).padStart(2,'0')}W</span>{lineTerms(n.text)}</li>)}</ul></article>;
}
export function SeasonStrip({r}:{r:Rider}){
  return <div className="season-strip panel"><Gauge size={18}/><span>시즌 진행</span><b>{String(r.week).padStart(2,'0')} / {RULES.weeks}주</b><div className="strip-ticks">{CALENDAR.map(m=><i key={m.id} title={m.name} className={m.week<=r.week?'done':''}/>)}</div></div>;
}
