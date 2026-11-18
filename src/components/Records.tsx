import { ArrowLeft, ArrowUpRight, ChevronDown, Flag, Medal, Shield, Star, Trophy, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { meetById, DISCIPLINE_NAMES, DIVISION_NAMES, LOCATIONS, SKILL, SKILLS, STAT_NAMES, STYLE_NAMES } from '../game/data';
import { NAMES, competitor, learned } from '../game/competition';
import { RIVALS, lineTerms } from '../game/content';
import { equippedLook, extras, playerPlace } from '../game/economy';
import { EVENTS } from '../game/events';
import { PixelRider } from './Appearance';
import { divisionFor } from '../game/career';
import { DISCIPLINES, STATS, type Archive, type Rider, type View } from '../game/types';
import { chooseEnding, endingName, honors, summarize } from '../game/legacy';
import type { Publication } from '../game/public';
import { Brand, SectionTitle, Tag } from './Brand';
import { RiderCard, StatCards, type Submit } from './Overview';
import { service } from './Account';

export function Rankings({r}:{r:Rider}){
  const [year,setYear]=useState<number|null>(null);
  const [discipline,setDiscipline]=useState<typeof DISCIPLINES[number]>('dance');
  const history=[...r.seasons,...(r.seasons.some(s=>s.year===r.year)?[]:[r.season])];
  const season=history.find(s=>s.year===(year??r.year))??r.season;
  const scores=season.scores[discipline];
  const board=Object.entries(scores).sort(([a,x],[b,y])=>y-x||a.localeCompare(b));
  return <section className="panel content-panel">
    <SectionTitle code="SEASON STANDINGS" title="시즌 랭킹" detail="부문과 종목별 포인트로 순위를 정합니다. 메이저 대회에서는 1.5배를 받습니다."/>
    <div className="filter-line"><div className="pill-row">{DISCIPLINES.map(d=><button key={d} aria-pressed={d===discipline} className={`pill ${d===discipline?'active':''}`} onClick={()=>setDiscipline(d)}>{DISCIPLINE_NAMES[d]}</button>)}</div><label className="inline-select">시즌<select value={season.year} onChange={e=>setYear(Number(e.target.value))}>{history.map(s=><option value={s.year} key={s.year}>{s.year}년차 · {DIVISION_NAMES[s.division]}</option>)}</select></label></div>
    <div className="inner-card rankings">
      <div className="card-heading"><span><Trophy size={19}/> {DISCIPLINE_NAMES[discipline]} 순위표</span><Tag kind="lime">{DIVISION_NAMES[season.division]}</Tag></div>
      {board.length?<ol className="rank-list">{board.map(([id,points],i)=><li className={id==='player'?'you':''} key={id}><b>{i+1}</b><span>{id==='player'?r.name:NAMES[id]} {id==='player'&&<small>나</small>}</span><strong>{points} P</strong></li>)}</ol>:<p className="empty">아직 집계된 포인트가 없어요. 대회가 열리면 순위표가 채워집니다.</p>}
    </div>
  </section>;
}

export function Profile({r,send,saving,onHall,onNew}:{r:Rider;send:Submit;saving:boolean;onHall:()=>void;onNew:()=>void}){
  const [confirm,setConfirm]=useState(false);
  const awards=honors(r);
  return <div className="stack">
    <section className="panel content-panel">
      <SectionTitle code="RIDER PROFILE" title={r.name} detail={`${r.year}년차 ${r.week}주 · ${DIVISION_NAMES[divisionFor(r.year)]}`}/>
      <div className="profile-avatar"><PixelRider look={equippedLook(r)} label={r.name+' 외형'}/></div>
      <StatCards r={r}/><RiderCard r={r}/>
    </section>
    <CareerLog r={r}/>
    <section className="panel content-panel"><SectionTitle code="RIDER HONORS" title="업적·칭호"/>
      {awards.length?<div className="pill-row">{awards.map(title=><Tag kind="lime" key={title}><Medal size={14}/> {title}</Tag>)}</div>:<p>새 기술을 익히고 대회에 참가하면 첫 업적을 획득할 수 있어요.</p>}
      {r.mentor&&<div className="account-identity"><PixelRider look={r.mentor.look}/><div><strong>이전 회차의 선배 {r.mentor.name}</strong>
        <p>{r.mentor.title} · {r.mentor.wins}승 {r.mentor.skill&&' · '+SKILL[r.mentor.skill]?.name}</p></div></div>}
    </section>
    <section className="panel content-panel">
      <SectionTitle code="THE LOCAL CREW" title="라이벌" detail="연습 스팟과 대회에서 만나며 관계가 바뀝니다."/>
      <div className="rival-grid">{RIVALS.map(n=>{
        const progress=competitor(n,r.year,r.week);
        const met=EVENTS.filter(e=>e.npc===n.id&&r.events[e.id]);
        const newest=met.sort((a,b)=>{
          const choices=extras(r).choices;
          const when=(id:string)=>(choices[id]?.year??0)*52+(choices[id]?.week??0);
          return when(b.id)-when(a.id);
        })[0];
        return <article className="inner-card rival" key={n.id}>
          <PixelRider look={n.look}/><strong>{n.name}</strong><Tag>{n.style} · {STYLE_NAMES[n.tactic]}</Tag>
          <p>{n.personality}</p><p>{n.line}</p>
          <p>{n.spots.map(spot=>LOCATIONS[spot].name).join(' · ')}</p>
          <p>주력 기술 {SKILL[n.signature]?.name} · 습득 {Object.keys(progress.skills).length}개</p>
          <div className="skill-track"><span>관계 · {newest?.kind??'아직 대화 기록 없음'}</span><b>{r.relations[n.id]??0}</b></div>
          <div className="bar"><span style={{width:(r.relations[n.id]??0)+'%',background:n.color}}/></div>
          {newest&&<small>{newest.title}</small>}
        </article>;
      })}</div>
    </section>
    <section className="panel content-panel">
      <SectionTitle code="CAREER ARCHIVE" title={r.phase==='retired'?'커리어 종료':'은퇴'}/>
      <p>{r.phase==='retired'?'이 선수의 커리어가 명예의 전당에 보존되었습니다.':'은퇴한 선수는 훈련에 복귀할 수 없으며 모든 성적은 개인 명예의 전당에 보관됩니다.'}</p>
      {confirm&&r.phase!=='retired'&&<RetirementSummary r={r}/>}
      <div className="bottom-actions">{r.phase==='retired'?<><button className="button secondary" onClick={onHall}><Trophy size={16}/> 명예의 전당</button><button className="button primary" onClick={onNew}>새 선수 만들기 <ArrowUpRight size={16}/></button></>:confirm?<><button className="button quiet" onClick={()=>setConfirm(false)}>계속 육성</button><button className="button danger" onClick={()=>void send({type:'retire'})} disabled={saving}>은퇴하고 기록 보관</button></>:<button className="button quiet" onClick={()=>setConfirm(true)}>조기 은퇴 선택</button>}</div>
    </section>
  </div>;
}
function RetirementSummary({r}:{r:Rider}){
  const stats=summarize(r);
  return <div className="retirement-summary">
    <h3>은퇴 시 보관할 기록</h3>
    <p>{r.year}년차 {r.week}주 · 대회 {stats.meets}회 · {stats.wins}승 · {stats.podiums}회 입상 · 시즌 포인트 {stats.points}</p>
    <div className="pill-row">{DISCIPLINES.map(d=><Tag key={d}>{DISCIPLINE_NAMES[d]} 최고 {stats.best[d].toFixed(1)}점</Tag>)}</div>
    <details className="past-meets"><summary>기술 {stats.learned.length}개와 라이벌 관계</summary>
      <div className="pill-row">{stats.learned.map(s=><Tag key={s.id}>{s.name} {r.skills[s.id].mastery}%</Tag>)}</div>
      <div className="pill-row">{RIVALS.map(n=><Tag key={n.id}>{n.name} 관계 {r.relations[n.id]??0}</Tag>)}</div>
    </details>
  </div>;
}
function CareerLog({r}:{r:Rider}){
  const recent=r.records.filter(meet=>meet.results.length).slice(-5).reverse();
  const timeline=extras(r).timeline;
  return <section className="panel content-panel">
    <SectionTitle code="CAREER LOG" title="경기와 성장 기록"/>
    {!recent.length?<p>출전 기록이 쌓이면 대회별 점수와 순위를 비교할 수 있어요.</p>:
      <div className="record-table"><table>
        <thead><tr><th scope="col">대회</th>{DISCIPLINES.map(d=><th scope="col" key={d}>{DISCIPLINE_NAMES[d]}</th>)}</tr></thead>
        <tbody>{recent.map(meet=><tr key={meet.year+meet.id}><th scope="row">{meet.year}년차 {meetById(meet.id)?.name}</th>
          {DISCIPLINES.map(d=>{
            const result=meet.results.find(x=>x.discipline===d);
            return <td key={d}>{result?`${result.run.score.toFixed(1)}점 · ${playerPlace(result)}위`:'—'}</td>;
          })}</tr>)}</tbody>
      </table></div>}
    {!!timeline.length&&<details className="past-meets"><summary>주요 사건과 보상 <ChevronDown size={16}/></summary><div>
      {timeline.map((item,index)=><div key={item.year+'-'+item.week+'-'+index}><span>{item.year}년차 {item.week}주 · <b>{lineTerms(item.title)}</b></span><span>{lineTerms(item.text)}</span></div>)}
    </div></details>}
  </section>;
}
export function Hall({hall,view,onEnding,onAccount,standalone=false,onBack}:{hall:Archive[];view:View;onEnding:(id:string)=>void;onAccount:()=>void;standalone?:boolean;onBack?:()=>void}){
  const [publications,setPublications]=useState<Publication[]>([]);
  const [pending,setPending]=useState('');
  const [error,setError]=useState('');
  const [available,setAvailable]=useState(false);
  useEffect(()=>{
    if(!view.username||!view.scope) return;
    let active=true;
    service<Publication[]>('public',{type:'mine'},view.scope).then(rows=>{
      if(active){setPublications(rows);setAvailable(true);}
    }).catch(error=>{if(active)setError(error instanceof Error?error.message:'공개 상태를 읽지 못했어요.');});
    return ()=>{active=false;};
  },[view.username,view.scope]);
  const change=async(archiveId:string,active:boolean)=>{
    setPending(archiveId);setError('');
    try{
      const publication=await service<Publication>('public',{type:'publish',archiveId,active},view.scope);
      setPublications(rows=>[...rows.filter(row=>row.archiveId!==archiveId),publication]);
    }catch(error){setError(error instanceof Error?error.message:'공개 상태를 저장하지 못했어요.');}
    finally{setPending('');}
  };
  const content=<section className="panel content-panel hall">
    <SectionTitle code="HALL OF FAME" title="개인 명예의 전당" detail="은퇴 기록은 기본적으로 비공개입니다. 선택한 선수만 온라인에 공개할 수 있습니다."/>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {!hall.length?<div className="hall-empty"><Trophy size={40}/><h3>아직 보관된 선수가 없어요</h3><p>은퇴하면 성장 기록과 대회 성적이 이곳에 남습니다.</p></div>:<div className="stack">{[...hall].reverse().map(a=>{
      const p=publications.find(row=>row.archiveId===a.id);
      return <ArchiveCard key={a.id} archive={a} actions={<>
        <button className="button secondary small" onClick={()=>onEnding(a.id)}>엔딩 보기</button>
        {!view.username?<button className="button quiet small" onClick={onAccount}>계정 연결</button>:
          p?.moderated?<Tag kind="orange">운영 검토로 비공개</Tag>:
          <button className={`button ${p?.active?'quiet':'primary'} small`} disabled={!available||!!pending}
            onClick={()=>void change(a.id,!p?.active)}>{p?.active?'공개 취소':'온라인에 공개'}</button>}
        {p?.active&&!p.moderated&&<a className="text-button" href={'?rider='+p.id}>공개 프로필 보기</a>}
      </>}/>;
    })}</div>}
  </section>;
  return standalone?<div className="start-page hall-page"><header className="start-header"><Brand/><button className="button secondary" onClick={onBack}><ArrowLeft size={17}/> 돌아가기</button></header>{content}</div>:content;
}
function ArchiveCard({archive:a,actions}:{archive:Archive;actions:React.ReactNode}){
  const results=a.records.flatMap(x=>x.results);
  const wins=results.filter(x=>x.standings[0]?.id==='player').length;
  const best=results.reduce((m,x)=>Math.max(m,x.run.score),0);
  return <article className="archive-card">
    <div className="archive-title"><PixelRider look={equippedLook(a)}/><div><h3>{a.name}</h3><span>{a.year}년차 {a.week}주 · 명성 {a.fame}</span></div><Tag kind={a.reason==='complete'?'lime':'muted'}>{endingName(a.ending??chooseEnding(a))}</Tag></div>
    <div className="archive-stats"><span><Trophy size={16}/> <b>{wins}</b> 우승</span><span><Star size={16}/> <b>{best.toFixed(1)}</b> 최고점</span><span><Flag size={16}/> <b>{results.length}</b> 종목 완주</span><span><Shield size={16}/> <b>{SKILLS.filter(s=>learned(a.skills,s.id)).length}</b> 기술 습득</span></div>
    <details className="past-meets"><summary>커리어 상세 보기 <ChevronDown size={16}/></summary><div className="archive-details">
      <div className="pill-row">{(a.honors??honors(a)).map(title=><Tag kind="lilac" key={title}>{title}</Tag>)}</div>
      <div className="pill-row">{STATS.map(s=><Tag key={s}>{STAT_NAMES[s]} {a.stats[s]}</Tag>)}</div>
      <div className="pill-row">{RIVALS.map(n=><Tag key={n.id}>{n.name} 관계 {a.relations[n.id]??0}</Tag>)}</div>
      <div className="pill-row">{SKILLS.filter(s=>learned(a.skills,s.id)).map(s=><Tag key={s.id}>{s.name} {a.skills[s.id].mastery}%</Tag>)}</div>
      {[...a.records].reverse().map(m=><div key={m.year+m.id}><span>{m.year}년차 · {meetById(m.id)?.name}</span><span>{m.results.map(res=>`${DISCIPLINE_NAMES[res.discipline]} ${res.standings.find(s=>s.id==='player')?.place}위 / ${res.run.score}점`).join(' · ')||'불참'}</span></div>)}
    </div></details>
    <div className="bottom-actions">{actions}</div>
  </article>;
}
