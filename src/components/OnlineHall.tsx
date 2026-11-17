import { ArrowLeft, ArrowRight, Flag, Search, ShieldCheck, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DISCIPLINE_NAMES, DIVISION_NAMES, SKILL, STAT_NAMES } from '../game/data';
import { ENDINGS, endingName } from '../game/legacy';
import { METRICS, RANK_INFO, RANKING_VERSION, type Directory, type Metric, type PublicCard, type Scope } from '../game/public';
import { DISCIPLINES, DIVISIONS, STATS, type View } from '../game/types';
import { service } from './Account';
import { PixelRider } from './Appearance';
import { SectionTitle, Tag } from './Brand';

export default function OnlineHall({view,initialId,onSelect}:{view:View;initialId?:string;onSelect:(id?:string)=>void}){
  const [tab,setTab]=useState<'directory'|'ranking'>('directory');
  const [metric,setMetric]=useState<Metric>('career');
  const [division,setDivision]=useState<Scope>('all');
  const [ending,setEnding]=useState('');
  const [search,setSearch]=useState('');
  const [term,setTerm]=useState('');
  const [complete,setComplete]=useState(false);
  const [page,setPage]=useState(1);
  const [data,setData]=useState<Directory>();
  const [detail,setDetail]=useState<PublicCard>();
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    setError('');setData(undefined);setDetail(undefined);
    const params=new URLSearchParams();
    if(initialId) params.set('id',initialId);
    else{
      params.set('page',String(page));
      params.set('division',division);
      params.set('complete',complete?'1':'0');
      if(tab==='ranking') params.set('metric',metric);
      else {params.set('search',term);params.set('ending',ending);}
    }
    service<Directory|PublicCard>('public',undefined,undefined,params).then(value=>{
      if(!active) return;
      if('rows' in value) setData(value);
      else setDetail(value);
    }).catch(error=>{if(active)setError(error instanceof Error?error.message:'기록을 읽지 못했어요.');});
    return ()=>{active=false;};
  },[initialId,page,division,complete,tab,metric,term,ending]);
  if(initialId) return <section className="panel content-panel">
    <button className="text-button" onClick={()=>onSelect(undefined)}><ArrowLeft size={16}/> 공개 선수 목록</button>
    {error?<p role="alert" className="form-error">{error}</p>:detail?<PublicDetail card={detail} view={view}/>:<p role="status">선수 기록을 읽는 중…</p>}
  </section>;
  return <section className="panel content-panel">
    <SectionTitle code="GLOBAL HALL" title={tab==='ranking'?'글로벌 랭킹':'온라인 명예의 전당'}
      detail={tab==='ranking'?'은퇴 후 공개한 선수의 서버 검증 기록을 비교합니다.':'다른 라이더가 공개한 은퇴 선수와 대표 루틴을 만나보세요.'}/>
    <div className="pill-row">
      <button className={'pill'+(tab==='directory'?' active':'')} onClick={()=>{setTab('directory');setPage(1);}} aria-pressed={tab==='directory'}>공개 선수</button>
      <button className={'pill'+(tab==='ranking'?' active':'')} onClick={()=>{setTab('ranking');setPage(1);if(metric==='career'||metric==='skills')setDivision('all');}} aria-pressed={tab==='ranking'}>글로벌 랭킹</button>
    </div>
    <div className="online-controls">
      {tab==='directory'?<form className="search-form" onSubmit={e=>{e.preventDefault();setTerm(search.trim());setPage(1);}}>
        <label>선수 이름<input maxLength={40} value={search} onChange={e=>setSearch(e.target.value)} placeholder="이름 앞부분 검색"/></label>
        <button className="button secondary"><Search size={16}/> 검색</button>
      </form>:<label>순위 기준<select value={metric} onChange={e=>{
        const next=e.target.value as Metric;setMetric(next);if(next==='career'||next==='skills')setDivision('all');setPage(1);
      }}>{METRICS.map(id=><option key={id} value={id}>{RANK_INFO[id].label}</option>)}</select></label>}
      <label>부문<select value={division} disabled={tab==='ranking'&&(metric==='career'||metric==='skills')}
        onChange={e=>{setDivision(e.target.value as Scope);setPage(1);}}>
        <option value="all">전체 부문</option>{DIVISIONS.map(d=><option key={d} value={d}>{DIVISION_NAMES[d]}</option>)}</select></label>
      {tab==='directory'&&<label>엔딩<select value={ending} onChange={e=>{setEnding(e.target.value);setPage(1);}}>
        <option value="">전체 엔딩</option>{Object.entries(ENDINGS).map(([id,item])=><option key={id} value={id}>{item.title}</option>)}
      </select></label>}
      <label className="checkbox-line"><input type="checkbox" checked={complete} onChange={e=>{setComplete(e.target.checked);setPage(1);}}/> 8년 완주만 보기</label>
    </div>
    {tab==='ranking'&&<p className="rules-note">{RANK_INFO[metric].rule} 같은 점수는 공개 기록 ID 순으로 순위를 정합니다. 공식 규칙 v{RANKING_VERSION}.</p>}
    {tab==='ranking'&&view.storage==='local'&&<p className="rules-note">로컬에서 플레이한 기록은 공식 순위에 포함되지 않습니다.</p>}
    {error?<p role="alert" className="form-error">{error}</p>:!data?<p role="status">공개 기록을 읽는 중…</p>:<>
      {tab==='ranking'&&view.username&&<div className="my-ranking">
        <strong>내 선수 순위</strong>{data.mine.length?<div className="pill-row">{data.mine.map(row=>
          <button key={row.id} className="pill" onClick={()=>onSelect(row.id)}>{row.rank}위 · {row.profile.name}</button>
        )}</div>:<p>이 조건에서 순위에 등록된 내 선수가 없어요.</p>}
      </div>}
      {data.rows.length?<div className="public-grid">{data.rows.map(row=><button className="public-card" key={row.id} onClick={()=>onSelect(row.id)}>
        <PixelRider look={row.profile.look}/>
        <div><strong>{row.profile.name}{row.mine&&<small> 나</small>}</strong><span>{row.profile.title}</span>
        <small>{row.profile.year}년차 · {row.profile.wins}승</small></div>
        {row.rank!==undefined?<Tag kind="lime">{row.rank}위 · {row.score?.toLocaleString('ko-KR')}</Tag>:<Tag kind={row.profile.official?'lime':'muted'}>{row.profile.official?'공식 기록':'공개 프로필'}</Tag>}
      </button>)}</div>:<div className="hall-empty"><Trophy size={36}/><p>조건에 맞는 공개 기록이 아직 없어요.</p></div>}
      <div className="pagination"><button className="button quiet" disabled={page===1} onClick={()=>setPage(page-1)}><ArrowLeft size={16}/> 이전</button>
        <span>{page} 페이지</span><button className="button quiet" disabled={!data.hasMore||page>=2000} onClick={()=>setPage(page+1)}>다음 <ArrowRight size={16}/></button></div>
    </>}
  </section>;
}

function PublicDetail({card,view}:{card:PublicCard;view:View}){
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
  return <>
    <div className="public-hero"><PixelRider look={p.look} label={p.name+' 도트 캐릭터'}/><div><h2>{p.name}</h2><p>{p.title}</p><div className="pill-row">
      <Tag>{p.year}년차 {p.week}주 · {DIVISION_NAMES[p.division]}</Tag><Tag kind="lilac">{endingName(p.ending)}</Tag>
      {p.official&&<Tag kind="lime"><ShieldCheck size={14}/> 공식 검증 경기</Tag>}
    </div></div></div>
    {p.historic&&<p className="rules-note">공식 규칙 도입 전 기록은 공개 프로필에 표시되며 공식 순위 점수에는 합산되지 않습니다.</p>}
    <div className="archive-stats"><span><Trophy size={16}/> {p.wins}승 · {p.podiums}회 입상</span><span><Flag size={16}/> {p.meets}개 대회 · 시즌 포인트 {p.points.toLocaleString('ko-KR')}</span>
      {p.careerPoints!==null&&<span>종합 커리어 {p.careerPoints.toLocaleString('ko-KR')}점</span>}</div>
    <div className="pill-row">{STATS.map(s=><Tag key={s}>{STAT_NAMES[s]} {p.stats[s]}</Tag>)}</div>
    <h3 className="public-subhead">종목별 최고점과 대표 루틴</h3>
    {DISCIPLINES.map(d=><details key={d} className="past-meets"><summary>{DISCIPLINE_NAMES[d]} · {p.best[d].toFixed(1)}점</summary>
      <ol className="public-routine">{(p.routines[d]??[]).map((id,index)=><li key={id+index}>{SKILL[id]?.name??id}</li>)}</ol>
      {!p.routines[d]?.length&&<p>출전 기록 없음</p>}</details>)}
    <h3 className="public-subhead">습득 기술 {p.skills.length}개</h3>
    {p.signature&&<p>대표 기술 {SKILL[p.signature]?.name}</p>}
    <div className="pill-row">{p.skills.map(s=><Tag key={s.id}>{SKILL[s.id]?.name??s.id} {s.mastery}%</Tag>)}</div>
    {view.username&&!card.mine&&<div className="bottom-actions">
      {report?<><label>신고 사유<select value={reason} onChange={e=>setReason(e.target.value)}><option value="name">부적절한 이름</option><option value="impersonation">사칭</option><option value="other">기타</option></select></label>
        <button className="button secondary" disabled={busy} onClick={()=>void sendReport()}>신고 제출</button>
        <button className="button quiet" onClick={()=>setReport(false)}>취소</button></>:<button className="button quiet" onClick={()=>setReport(true)}>신고</button>}
    </div>}
    {message&&<p role="status">{message}</p>}
  </>;
}
