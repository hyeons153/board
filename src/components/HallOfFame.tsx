import { ArrowLeft, ArrowRight, ChevronRight, Flag, Search, ShieldCheck, Trophy } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DISCIPLINE_NAMES, DIVISION_NAMES, meetById, RULES, SKILL, STAT_NAMES } from '../game/data';
import { ENDINGS } from '../game/legacy';
import { HONOR_RULES, METRICS, RANK_COMPONENTS, RANK_INFO, RANKING_VERSION, type Directory, type HonorScore, type MeetHighlight, type Metric, type PublicCard, type PublicSummary } from '../game/public';
import { DISCIPLINES, DIVISIONS, STATS, type Division, type View } from '../game/types';
import { service } from './Account';
import { PixelRider } from './Appearance';
import { Tag } from './Brand';
import { PrivateHall } from './Records';

const tabs=[['mine','내 선수'],['ranking','글로벌 랭킹'],['directory','선수 둘러보기']] as const;
type Tab=typeof tabs[number][0];
const scoreText=(score:number)=>score.toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1});
const percent=(ratio:number)=>Math.round(ratio*100)+'%';
const meetName=(record:MeetHighlight)=>meetById(record.id)?.name??record.id;
const resultText=(record:MeetHighlight)=>`${DISCIPLINE_NAMES[record.discipline]} ${record.place}위 · ${scoreText(record.score)}점`;

export default function HallOfFame({view,selectedId,onSelect,onEnding,onAccount}:{view:View;selectedId?:string;onSelect:(id?:string)=>void;onEnding:(id:string)=>void;onAccount:()=>void}){
  const [tab,setTab]=useState<Tab>(selectedId?'directory':'mine');
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    root.current?.closest('.console-panel-body')?.scrollTo(0,0);
    if(selectedId)root.current?.querySelector<HTMLButtonElement>('.hall-back')?.focus({preventScroll:true});
  },[tab,selectedId]);
  return <div className="hall-of-fame" ref={root}>
    <nav className="hall-tabs" aria-label="명예의 전당 메뉴">
      {tabs.map(([id,label])=><button className="pill" key={id} aria-pressed={id===tab} onClick={()=>{if(selectedId)onSelect();setTab(id);}}>{label}</button>)}
    </nav>
    {tab==='mine'&&!selectedId?<PrivateHall key={view.scope} hall={view.career.hall} view={view} onEnding={onEnding} onAccount={onAccount} onPublic={onSelect}/>
      :<OnlineRecords view={view} tab={tab} selectedId={selectedId} onSelect={onSelect}/>}
  </div>;
}

function OnlineRecords({view,tab,selectedId,onSelect}:{view:View;tab:Tab;selectedId?:string;onSelect:(id?:string)=>void}){
  const ranking=tab==='ranking';
  const [metric,setMetric]=useState<Metric>('career');
  const [division,setDivision]=useState<'all'|Division>('all');
  const [ending,setEnding]=useState('');
  const [search,setSearch]=useState('');
  const [term,setTerm]=useState('');
  const [pages,setPages]=useState({ranking:1,directory:1});
  const list=ranking?'ranking':'directory',page=pages[list];
  const setPage=(next:number)=>setPages(previous=>({...previous,[list]:next}));
  const [data,setData]=useState<Directory>();
  const [detail,setDetail]=useState<PublicCard>();
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setError('');setData(undefined);setDetail(undefined);
    const params=new URLSearchParams();
    if(selectedId)params.set('id',selectedId);
    else{
      params.set('page',String(page));
      if(ranking)params.set('metric',metric);
      else {params.set('search',term);params.set('division',division);params.set('ending',ending);}
    }
    service<Directory|PublicCard>('public',undefined,undefined,params).then(value=>{
      if(!active)return;
      if('rows' in value)setData(value);
      else setDetail(value);
    }).catch(error=>{if(active)setError(error instanceof Error?error.message:'기록을 읽지 못했어요.');});
    return ()=>{active=false;};
  },[selectedId,page,division,ranking,metric,term,ending,view.scope,retry]);

  const failed=error&&<div className="form-error" role="alert"><p>{error}</p><button className="button quiet small" onClick={()=>setRetry(value=>value+1)}>다시 불러오기</button></div>;
  if(selectedId)return <section className="panel content-panel hall-online">
    <button className="button quiet small hall-back" onClick={()=>onSelect()}><ArrowLeft size={16}/> {ranking?'글로벌 랭킹으로':tab==='mine'?'내 선수로':'선수 둘러보기로'} 돌아가기</button>
    {failed||(detail?.id===selectedId?<PublicDetail key={detail.id} card={detail} view={view} metric={ranking?metric:undefined}/>:<p role="status">선수 기록을 읽는 중…</p>)}
  </section>;

  return <section className="panel content-panel hall-online" aria-label={ranking?'글로벌 랭킹 기록':'공개 선수 검색'}>
    {ranking?<>
      <div className="hall-metrics pill-row" role="group" aria-label="랭킹 종목">
        {METRICS.map(id=><button key={id} className="pill" aria-pressed={metric===id} onClick={()=>{setMetric(id);setPage(1);}}>{RANK_INFO[id].label}</button>)}
      </div>
      <RankingRules metric={metric}/>
    </>:<div className="online-controls">
      <form className="search-form" onSubmit={event=>{event.preventDefault();setTerm(search.trim());setPage(1);}}>
        <label>선수 이름<input maxLength={40} value={search} onChange={event=>setSearch(event.target.value)} placeholder="이름 앞부분 검색"/></label>
        <button className="button secondary"><Search size={16}/> 검색</button>
      </form>
      <label>부문<select value={division} onChange={event=>{setDivision(event.target.value as typeof division);setPage(1);}}>
        <option value="all">전체 부문</option>{DIVISIONS.map(id=><option key={id} value={id}>{DIVISION_NAMES[id]}</option>)}
      </select></label>
      <label>엔딩<select value={ending} onChange={event=>{setEnding(event.target.value);setPage(1);}}>
        <option value="">전체 엔딩</option>{Object.entries(ENDINGS).map(([id,item])=><option key={id} value={id}>{item.title}</option>)}
      </select></label>
    </div>}
    {failed||(!data?<p role="status">공개 기록을 읽는 중…</p>:<>
      {ranking&&data.mine.length>0&&<div className="my-ranking"><strong>내 대표 선수</strong>{data.mine.map(row=>
        <button key={row.id} className="pill" onClick={()=>onSelect(row.id)}>{row.rank}위 · {row.profile.name}</button>)}</div>}
      {data.rows.length>0?<div className={ranking?'honor-ranking':'public-grid'}>{data.rows.map(row=>ranking?
        <RankCard key={row.id} row={row} onSelect={()=>onSelect(row.id)}/>:
        <button className="public-card" key={row.id} onClick={()=>onSelect(row.id)}>
          <PixelRider look={row.profile.look}/><div><strong>{row.profile.name}</strong><span>{row.profile.title}</span>
          <small>{DIVISION_NAMES[row.profile.division]} · {row.profile.meets}개 대회 · {row.profile.wins}승</small>
          {!!row.profile.honors?.length&&<small>{row.profile.honors.at(-1)}</small>}</div><ChevronRight size={16} aria-hidden="true"/>
        </button>)}</div>:<div className="hall-empty"><Trophy size={36}/><p>{ranking?'이 랭킹에 등록된 선수가 아직 없어요.':'조건에 맞는 공개 선수가 없어요.'}</p></div>}
      {(page>1||data.hasMore)&&<div className="pagination"><button className="button quiet" disabled={page===1} onClick={()=>setPage(page-1)}><ArrowLeft size={16}/> 이전</button>
        <span>{page} 페이지</span><button className="button quiet" disabled={!data.hasMore||page>=2000} onClick={()=>setPage(page+1)}>다음 <ArrowRight size={16}/></button></div>}
    </>)}
  </section>;
}

function RankCard({row,onSelect}:{row:PublicCard<PublicSummary>;onSelect:()=>void}){
  const p=row.profile,record=row.honor?.representative;
  return <article className="honor-rank-card" data-podium={row.rank&&row.rank<=3?row.rank:undefined}>
    <b className="honor-place">{row.rank}<small>위</small></b>
    <PixelRider look={p.look}/>
    <div className="honor-rider"><strong>{p.name}{row.mine&&<small> 내 선수</small>}</strong><span>{p.title}</span></div>
    <div className="honor-record">{record&&<><strong>{record.year}년차 · {meetName(record)}</strong><span>{DIVISION_NAMES[record.division]} · {resultText(record)}</span></>}
      <small>{p.wins}승 · {p.podiums}회 입상{p.honors?.length?' · '+p.honors.at(-1):''}</small></div>
    <div className="honor-score"><strong>{scoreText(row.score??0)}</strong><small>명예 점수</small></div>
    <button className="button secondary small honor-view" aria-label={p.name+' 상세 보기'} onClick={onSelect}>상세 보기 <ChevronRight size={15}/></button>
  </article>;
}

function ScoreWeights({metric,score}:{metric:Metric;score?:HonorScore}){
  return <dl className="honor-weights">{Object.entries(RANK_INFO[metric].weights).map(([key,max])=>{
    const component=key as keyof typeof RANK_COMPONENTS;
    return <div key={key}><dt>{RANK_COMPONENTS[component]}</dt><dd>{score?`${scoreText(score.components[component]??0)} / `:''}{max}점</dd></div>;
  })}</dl>;
}

function RankingRules({metric}:{metric:Metric}){
  const r=HONOR_RULES;
  return <details className="past-meets honor-rules"><summary>명예 점수 산정 기준 · 1,000점 만점</summary>
    <ScoreWeights metric={metric}/>
    <ul>
      <li>서버가 재현해 확인한 경기를 반영합니다. 조기 은퇴와 8년 완주에 같은 점수표를 적용합니다.</li>
      <li>경기 점수 {percent(r.runWeight)}와 순위 {percent(1-r.runWeight)}를 합칩니다. 1~7위 순위 환산율은 {r.places.map(percent).join('·')}입니다.</li>
      <li>경기별 수준 보정은 80% + 20% × (부문 가중치 × 대회 가중치 ÷ 4.5)입니다. 부문 가중치는 뉴비 1, 일반 1.5, 오픈 2.25, 마스터 3입니다. 정기 대회는 1, 메이저와 국제대회는 {r.major}입니다.</li>
      <li>서로 다른 상위 {r.meetLimit}개 대회를 평균냅니다. 대회 수 보정은 82% + 18% × (반영 대회 수 ÷ {r.meetLimit})입니다. 종합에서는 한 대회의 가장 좋은 종목을 반영합니다.</li>
      <li>개인 최고점은 검증 경기 중 최고 점수입니다. 기술 점수는 난이도로 가중하며 습득 {percent(1-r.masteryWeight)}와 숙련도 {percent(r.masteryWeight)}를 반영합니다. 댄싱·트릭은 해당 기술만 평가합니다.</li>
      {metric==='career'&&<li>최종 능력치는 4개 기본 능력치 평균을 {RULES.statCap}으로 나눕니다. 시즌 우승은 종료한 시즌 중 검증 경기 출전 종목에서 시즌 포인트 1위를 차지한 시즌의 비율입니다.</li>}
      <li>각 항목을 소수 첫째 자리까지 계산해 합산합니다. 동점은 공동 순위이며 공개 ID 순으로 표시합니다. 각 계정의 최고 점수 선수 한 명이 랭킹마다 대표로 올라갑니다.</li>
    </ul>
    <small>명예 점수 규칙 v{RANKING_VERSION}</small>
  </details>;
}

function PublicDetail({card,view,metric}:{card:PublicCard;view:View;metric?:Metric}){
  const p=card.profile;
  const [report,setReport]=useState(false);
  const [reason,setReason]=useState('name');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const sendReport=async()=>{
    setBusy(true);
    try{await service('public',{type:'report',id:card.id,reason},view.scope);setReport(false);setMessage('신고를 접수했습니다.');}
    catch(error){setMessage(error instanceof Error?error.message:'신고를 접수하지 못했어요.');}
    finally{setBusy(false);}
  };
  const seasons=[...new Set(p.meetHistory?.map(meet=>meet.year))].sort((a,b)=>a-b);
  return <>
    <div className="public-hero"><PixelRider look={p.look} label={p.name+' 도트 캐릭터'}/><div><h2>{p.name}</h2><p>{p.title}</p><div className="pill-row">
      <Tag>{p.year}년차 {p.week}주 은퇴 · {DIVISION_NAMES[p.division]}</Tag>{p.official&&<Tag kind="lime"><ShieldCheck size={14}/> 검증 경기 보유</Tag>}
    </div></div></div>
    <div className="archive-stats"><span><Trophy size={16}/> {p.wins}승 · {p.podiums}회 입상</span><span><Flag size={16}/> {p.meets}개 대회 · 시즌 포인트 {p.points.toLocaleString('ko-KR')}</span></div>
    {!!p.honors?.length&&<div className="pill-row">{p.honors.map(label=><Tag key={label} kind="lime">{label}</Tag>)}</div>}
    <h3 className="public-subhead">최종 능력치</h3>
    <div className="pill-row">{STATS.map(s=><Tag key={s}>{STAT_NAMES[s]} {p.stats[s]}</Tag>)}</div>
    {p.official&&p.honorScores&&<><h3 className="public-subhead">명예 점수 내역</h3>{METRICS.map(id=>{
      const honor=p.honorScores?.[id];
      return honor&&<details key={id} className="past-meets honor-rules" open={id===(metric??'career')}>
        <summary>{RANK_INFO[id].label} · {scoreText(honor.total)}점</summary><ScoreWeights metric={id} score={honor}/>
        <p>검증 대회 {honor.verifiedMeets}개 · {meetName(honor.representative)} · {resultText(honor.representative)}</p>
      </details>;
    })}</>}
    {p.historic&&<p className="rules-note">공식 검증 자료가 없는 경기는 커리어 기록에서 열람할 수 있어요.</p>}
    <h3 className="public-subhead">종목별 최고점과 대표 라인</h3>
    {DISCIPLINES.map(d=><details key={d} className="past-meets"><summary>{DISCIPLINE_NAMES[d]} · {p.routines[d]?.length?scoreText(p.best[d])+'점':'출전 기록 없음'}</summary>
      {!!p.routines[d]?.length&&<ol className="public-routine">{p.routines[d].map((id,index)=><li key={id+index}>{SKILL[id]?.name??id}</li>)}</ol>}</details>)}
    {seasons.length>0&&<><h3 className="public-subhead">연차별 대회 기록</h3>{seasons.map(year=><details key={year} className="past-meets"><summary>{year}년차</summary>
      <ul className="hall-history">{p.meetHistory?.filter(meet=>meet.year===year).map(meet=><li key={meet.id+':'+meet.discipline}><b>{meetName(meet)}</b><span>{resultText(meet)}</span></li>)}</ul>
    </details>)}</>}
    <h3 className="public-subhead">습득 기술 {p.skills.length}개</h3>
    {p.signature&&<p>대표 기술 {SKILL[p.signature]?.name}</p>}
    <div className="pill-row">{p.skills.map(s=><Tag key={s.id}>{SKILL[s.id]?.name??s.id} {s.mastery}%</Tag>)}</div>
    {view.username&&!card.mine&&<div className="bottom-actions">
      {report?<><label>신고 사유<select value={reason} onChange={event=>setReason(event.target.value)}><option value="name">부적절한 이름</option><option value="impersonation">사칭</option><option value="other">기타</option></select></label>
        <button className="button secondary" disabled={busy} onClick={()=>void sendReport()}>신고 제출</button>
        <button className="button quiet" onClick={()=>setReport(false)}>취소</button></>:<button className="button quiet" onClick={()=>setReport(true)}>신고</button>}
    </div>}
    {message&&<p role="status">{message}</p>}
  </>;
}
