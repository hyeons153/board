import { ArrowRight, CalendarDays, ChevronDown, CirclePlay } from 'lucide-react';
import { useRef, useState } from 'react';
import { calendarFor, formatCareerDate, meetById, monthWeek, DISCIPLINE_NAMES, DIVISION_NAMES, LOCATIONS, OUTCOME_NAMES, SKILL } from '../game/data';
import { divisionFor } from '../game/career';
import { playerPlace } from '../game/economy';
import { formatRP, meetRP, rankingPoints, validRP } from '../game/rp';
import { DISCIPLINES, type MeetRecord, type Rider } from '../game/types';
import { Tag } from './Brand';
import { RPDisciplines, RPPayouts } from './RankingPoints';

function Results({record}:{record:MeetRecord}){
  if(!record.results.length)return <p className="meet-absent">이번 대회는 불참했습니다.</p>;
  return <div className="meet-results" aria-label={`${record.year}년차 ${meetById(record.id)?.name} 성적`}>
    <div className="meet-result-grid">{DISCIPLINES.map(d=>{
      const result=record.results.find(item=>item.discipline===d);
      return <div key={d}><span>{DISCIPLINE_NAMES[d]}</span>{result?<><strong>{playerPlace(result)}위 <small>{result.run.score.toFixed(1)}점</small></strong><p>{validRP(result.points)?'+'+formatRP(result.points):'RP 기록 없음'} · 명성 +{result.fame}</p><p>상금 ₩{result.prize.toLocaleString('ko-KR')}</p>{!!result.sponsorBonus&&<p>협찬 보너스 ₩{result.sponsorBonus.toLocaleString('ko-KR')}</p>}</>:<strong className="muted-text">미출전</strong>}</div>;
    })}</div>
    <details className="meet-standings"><summary>종목별 전체 순위 <ChevronDown size={15}/></summary><div>{record.results.map(result=><div key={result.discipline}><h4>{DISCIPLINE_NAMES[result.discipline]}</h4><ol>{result.standings.map(row=><li key={row.id} className={row.id==='player'?'is-player':''}><b>{row.place}위</b><span>{row.name}{row.id==='player'?' (나)':''}</span><strong>{row.score.toFixed(1)}점</strong></li>)}</ol></div>)}</div></details>
  </div>;
}

export type MeetSelection={year:number;id?:string};

export function Meets({r,onPlay,onEntry,onLine,onLoadRecord,selection,onSelection}:{
  r:Rider;onPlay:(record:MeetRecord)=>void;onEntry:()=>void;onLine?:()=>void;
  onLoadRecord?:(record:MeetRecord)=>Promise<MeetRecord|undefined>;
  selection?:MeetSelection;onSelection?:(value:MeetSelection)=>void;
}){
  const [local,setLocal]=useState<MeetSelection>();
  const detail=useRef<HTMLElement>(null);
  const choice=selection??local;
  const years=[...new Set([r.year,...r.seasons.map(season=>season.year),...r.records.map(record=>record.year)])].sort((a,b)=>b-a);
  const year=choice&&years.includes(choice.year)?choice.year:r.year;
  const rp=rankingPoints(r);
  const seasonRP=rp.seasons.find(item=>item.year===year);
  const setChoice=onSelection??setLocal;
  const showDetail=(value:MeetSelection)=>{
    setChoice(value);
    if(matchMedia('(max-width:760px)').matches)window.requestAnimationFrame(()=>{
      detail.current?.focus({preventScroll:true});detail.current?.scrollIntoView({block:'nearest'});
    });
  };
  const latest=r.records.findLast(record=>record.results.length);
  const records=r.records.filter(record=>record.year===year);
  const calendar=calendarFor(year);
  const rows=calendar.map(meet=>({id:meet.id,meet,record:records.find(record=>record.id===meet.id)}));
  for(const record of records){
    if(!rows.some(row=>row.id===record.id)){
      const meet=meetById(record.id);
      if(meet)rows.push({id:record.id,meet,record});
    }
  }
  const selected=rows.find(row=>row.id===choice?.id)
    ??(year===r.year&&r.phase!=='retired'?rows.find(row=>row.meet.week>=r.week&&!row.record):undefined)
    ??rows.findLast(row=>row.record)??rows[0];
  const {meet,record}=selected;
  const canEnter=year===r.year&&meet.week===r.week&&r.phase==='meet'&&!record;
  const stateFor=(row:typeof selected)=>{
    if(row.record)return row.record.results.length?'완료':'불참';
    if(year!==r.year||r.phase==='retired'||row.meet.week<r.week)return '기록 없음';
    if(row.meet.week===r.week)return r.phase==='meet'?'출전 가능':'이번 주';
    return '예정';
  };

  return <section className="meet-browser">
    <div className="game-toolbar">
      <label>시즌<select value={year} onChange={event=>setChoice({year:Number(event.target.value)})}>
        {years.map(value=><option key={value} value={value}>{value}년차{value===r.year?' (현재)':''}</option>)}
      </select></label>
      <Tag kind="lime">{DIVISION_NAMES[divisionFor(year)]}</Tag>
      {year!==r.year&&<button className="button secondary small" onClick={()=>setChoice({year:r.year})}>현재 시즌</button>}
      {latest&&<button className="button secondary small" onClick={()=>showDetail({year:latest.year,id:latest.id})}>최근 성적</button>}
      {onLine&&<button className="button secondary small game-toolbar-end" onClick={onLine}>라인 편집 <ArrowRight size={15}/></button>}
    </div>
    <div className="rp-overview"><strong>통산 {formatRP(rp.total)}</strong><b>{year}년차 시즌 {formatRP(seasonRP?.total??0)}</b>
      {seasonRP&&<RPDisciplines points={seasonRP.disciplines}/>}{rp.partial&&<small>확인된 RP만 집계했습니다.</small>}
    </div>
    <div className="meet-browser-grid">
      <div className="calendar-list" aria-label={year+'년차 대회 일정'}>
        {rows.map(row=>{
          const state=stateFor(row);
          const {month,weekLabel}=monthWeek(row.meet.week);
          return <button className="meet-list-row" aria-pressed={row.id===selected.id} key={row.id}
            onClick={()=>showDetail({year,id:row.id})}>
            <span className="date-block"><b>{month}월</b>{' '}<span>{weekLabel}</span></span>
            <span className="meet-list-name"><strong>{row.meet.name}</strong><small>{row.meet.host??LOCATIONS[row.meet.spot].name}</small>
              {row.record?.results.length?<span className="meet-results-inline">{row.record.results.map(result=>DISCIPLINE_NAMES[result.discipline]+' '+playerPlace(result)+'위').join(' · ')}</span>:row.meet.international?<small>3종목 필수</small>:null}
            </span>
            <Tag kind={state==='출전 가능'?'lime':state==='완료'?'lilac':'muted'}>{state}</Tag>
          </button>;
        })}
      </div>
      <article key={year+':'+meet.id} className="meet-detail" aria-label="선택한 대회 상세" ref={detail} tabIndex={-1}>
        <header>
          <div><CalendarDays size={16}/> {formatCareerDate({year,week:meet.week})}</div>
          <Tag kind={canEnter?'lime':'muted'}>{stateFor(selected)}</Tag>
          <h2>{meet.name}</h2>
          <p>{meet.host??LOCATIONS[meet.spot].name} · {meet.international?'국제대회':meet.major?'메이저 대회':'정기 대회'}</p>
        </header>
        {record?<Results record={record}/>:<>
          <p className="game-section-note">종목별 1위 {formatRP(meetRP(1,meet.major))}</p>
          <p className="game-section-note">{meet.international?'댄싱·트릭·프리스타일 모두 출전':'댄싱·트릭·프리스타일 중 1종목 선택'}</p>
          {canEnter?<button className="button primary" onClick={onEntry}>출전 선택 <ArrowRight size={16}/></button>:
            selected.meet.week>r.week&&year===r.year&&r.phase!=='retired'&&<p className="meet-countdown">{meet.week-r.week}주 후 개최</p>}
        </>}
        {!!record?.results.length&&<MeetActions record={record} onPlay={onPlay} onLoad={onLoadRecord}/>}
      </article>
    </div>
    <details className="game-rule-note"><summary>RP 보상과 출전 규칙</summary><RPPayouts/><p>한 시즌에 6개 대회가 열려요. 1~2년차는 뉴비부, 3~4년차는 일반부, 5~6년차는 오픈부, 7~8년차는 마스터부입니다.</p><p>홀수 해 마지막 대회는 롱보드 페스티벌, 2·4·6·8년차 마지막 대회는 국제대회예요. 국제대회에는 3종목 모두 출전하고 8년차 마지막 경기 후 은퇴합니다.</p></details>
  </section>;
}

function MeetActions({record,onPlay,onLoad}:{
  record:MeetRecord;onPlay:(record:MeetRecord)=>void;onLoad?:(record:MeetRecord)=>Promise<MeetRecord|undefined>;
}){
  const [full,setFull]=useState<MeetRecord>();
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);
  const showLog=async()=>{
    if(show){setShow(false);return;}
    if(full||record.detail!=='summary'){setShow(true);return;}
    setLoading(true);
    try{
      const loaded=await onLoad?.(record);
      if(loaded){setFull(loaded);setShow(true);}
    }finally{setLoading(false);}
  };
  return <>
    <div className="meet-detail-actions">
      <button className="button primary" onClick={()=>onPlay(full??record)}><CirclePlay size={17}/> 경기 다시 보기</button>
      <button className="button secondary" disabled={loading} aria-expanded={show} onClick={()=>void showLog()}>
        {loading?'기록 불러오는 중…':show?'기술별 기록 닫기':'기술별 기록'}
      </button>
    </div>
    {show&&<div className="meet-moves" aria-label="기술별 경기 기록">{(full??record).results.map(result=>
      <details key={result.discipline} className="game-rule-note">
        <summary>{DISCIPLINE_NAMES[result.discipline]} · {result.run.score.toFixed(1)}점</summary>
        <ol>{result.run.log.map(move=><li key={move.at}>
          <time>{move.at.toFixed(1)}초</time><span>{SKILL[move.id]?.name??move.id} · {OUTCOME_NAMES[move.outcome]}</span><b>{move.points}점</b>
        </li>)}</ol>
      </details>)}</div>}
  </>;
}
