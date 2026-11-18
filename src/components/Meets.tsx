import { ArrowRight, CalendarDays, ChevronDown, CirclePlay } from 'lucide-react';
import { CALENDAR, DIVISION_NAMES, LOCATIONS } from '../game/data';
import { currentMeet, divisionFor } from '../game/career';
import type { MeetRecord, Rider } from '../game/types';
import { SectionTitle, Tag } from './Brand';

export function Meets({r,onPlay,onEntry}:{r:Rider;onPlay:(record:MeetRecord)=>void;onEntry:()=>void}){
  const current=currentMeet(r);
  return <section className="panel content-panel">
    <SectionTitle code="COMPETITION CALENDAR" title="대회 일정" detail={r.year+'년차 · '+DIVISION_NAMES[divisionFor(r.year)]+' · 1시즌 6개 대회'}/>
    {current&&r.phase!=='retired'&&<p className="calendar-game-link">출전과 경기는 게임 화면에서 이어집니다. <button className="text-button" onClick={onEntry}>게임으로 돌아가기 <ArrowRight size={14}/></button></p>}
    <div className="calendar-list">{CALENDAR.map(m=>{
      const record=r.records.find(x=>x.year===r.year&&x.id===m.id);
      return <article key={m.id} className={'calendar-row '+(r.week===m.week&&r.phase!=='retired'?'now':'')}>
        <div className="date-block"><b>{String(m.month).padStart(2,'0')}</b><span>월</span></div><div className="calendar-info"><div>{m.major&&<Tag kind="orange">MAJOR</Tag>}{r.week===m.week&&r.phase!=='retired'&&<Tag kind="lime">이번 주</Tag>}</div><h3>{m.name}</h3><p>{m.week}주차 · {LOCATIONS[m.spot].name}</p></div>
        {record?.results.length?<button className="button secondary small" onClick={()=>onPlay(record)}><CirclePlay size={16}/> 게임에서 다시 보기</button>:record?<Tag>불참</Tag>:<CalendarDays size={18} className="muted-text"/>}
      </article>;
    })}</div>
    {!!r.records.length&&<details className="past-meets"><summary>전체 대회 기록 ({r.records.length}) <ChevronDown size={17}/></summary><div>{[...r.records].reverse().map(m=><div key={m.year+m.id}><span>{m.year}년차 · {CALENDAR.find(c=>c.id===m.id)?.name}</span>{m.results.length?<button className="text-button" onClick={()=>onPlay(m)}>게임에서 다시 보기 <ArrowRight size={14}/></button>:<Tag>불참</Tag>}</div>)}</div></details>}
  </section>;
}
