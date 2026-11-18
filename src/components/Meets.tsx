import { ArrowRight, CalendarDays, ChevronDown, CirclePlay } from 'lucide-react';
import { calendarFor, meetById, DISCIPLINE_NAMES, DIVISION_NAMES, LOCATIONS } from '../game/data';
import { currentMeet, divisionFor } from '../game/career';
import { playerPlace } from '../game/economy';
import { DISCIPLINES, type MeetRecord, type Rider } from '../game/types';
import { SectionTitle, Tag } from './Brand';

function Results({record}:{record:MeetRecord}){
  if(!record.results.length)return <p className="meet-absent">이번 대회는 불참했습니다.</p>;
  return <div className="meet-results" aria-label={`${record.year}년차 ${meetById(record.id)?.name} 성적`}>
    <div className="meet-result-grid">{DISCIPLINES.map(d=>{
      const result=record.results.find(item=>item.discipline===d);
      return <div key={d}><span>{DISCIPLINE_NAMES[d]}</span>{result?<><strong>{playerPlace(result)}위 <small>{result.run.score.toFixed(1)}점</small></strong><p>시즌 +{result.points}점 · 명성 +{result.fame}</p><p>상금 ₩{result.prize.toLocaleString('ko-KR')}</p></>:<strong className="muted-text">미출전</strong>}</div>;
    })}</div>
    <details className="meet-standings"><summary>종목별 전체 순위 <ChevronDown size={15}/></summary><div>{record.results.map(result=><div key={result.discipline}><h4>{DISCIPLINE_NAMES[result.discipline]}</h4><ol>{result.standings.map(row=><li key={row.id} className={row.id==='player'?'is-player':''}><b>{row.place}위</b><span>{row.name}{row.id==='player'?' (나)':''}</span><strong>{row.score.toFixed(1)}점</strong></li>)}</ol></div>)}</div></details>
  </div>;
}

export function Meets({r,onPlay,onEntry}:{r:Rider;onPlay:(record:MeetRecord)=>void;onEntry:()=>void}){
  const current=currentMeet(r);
  return <section className="panel content-panel">
    <SectionTitle code="COMPETITION CALENDAR" title="대회 일정" detail={r.year+'년차 · '+DIVISION_NAMES[divisionFor(r.year)]+' · 1시즌 6개 대회'}/>
    <p className="meet-career-guide">1~2년차 뉴비부 · 3~4년차 일반부 · 5~6년차 오픈부 · 7~8년차 마스터부</p>
    <p className="meet-career-guide">일반 대회는 1~3종목 선택 출전. 홀수 해 연말에는 롱페, 2·4·6·8년차 연말에는 개최 도시가 바뀌는 국제대회에 3종목 모두 출전합니다. 8년차 마지막 국제대회 후 은퇴와 명예의 전당 등록으로 이어집니다.</p>
    {current&&r.phase!=='retired'&&<p className="calendar-game-link">출전과 경기는 게임 화면에서 이어집니다. <button className="text-button" onClick={onEntry}>게임으로 돌아가기 <ArrowRight size={14}/></button></p>}
    <div className="calendar-list">{calendarFor(r.year).map(m=>{
      const record=r.records.find(x=>x.year===r.year&&x.id===m.id);
      return <article key={m.id} className="meet-calendar-card">
        <div className={'calendar-row '+(r.week===m.week&&r.phase!=='retired'?'now':'')}>
          <div className="date-block"><b>{String(m.month).padStart(2,'0')}</b><span>월</span></div><div className="calendar-info"><div>{m.major&&<Tag kind="orange">{m.international?'INTERNATIONAL':'MAJOR'}</Tag>}{r.week===m.week&&r.phase!=='retired'&&<Tag kind="lime">이번 주</Tag>}</div><h3>{m.name}</h3><p>{m.week}주차 · {m.host??LOCATIONS[m.spot].name}{m.international?' · 3종목 필수':''}</p></div>
          {record?.results.length?<button className="button secondary small" onClick={()=>onPlay(record)}><CirclePlay size={16}/> 경기 다시 보기</button>:record?<Tag>불참</Tag>:<CalendarDays size={18} className="muted-text"/>}
        </div>
        {record&&<Results record={record}/>}
      </article>;
    })}</div>
    {!!r.records.length&&<details className="past-meets" open><summary>전체 대회 기록 ({r.records.length}) <ChevronDown size={17}/></summary><div className="meet-history">{[...r.records].reverse().map(m=><article className="meet-history-card" key={m.year+m.id}><header><div><h3>{m.year}년차 · {meetById(m.id)?.name??m.id}</h3><p>{DIVISION_NAMES[m.division]}{meetById(m.id)?.host?' · '+meetById(m.id)!.host:''}</p></div>{!!m.results.length&&<button className="text-button" onClick={()=>onPlay(m)}><CirclePlay size={16}/> 경기 다시 보기</button>}</header><Results record={m}/></article>)}</div></details>}
  </section>;
}
