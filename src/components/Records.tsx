import { ArrowUpRight, ChevronDown, Flag, Medal, Play, Shield, Star, Trophy, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatCareerDate, formatMonthWeek, meetById, DISCIPLINE_NAMES, DIVISION_NAMES, LOCATIONS, RULES, SKILL, STAT_NAMES, STYLE_NAMES } from '../game/data';
import { NAMES, competitor, learned } from '../game/competition';
import { RIVALS, lineTerms } from '../game/content';
import { equippedLook, extras, ITEM, playerPlace } from '../game/economy';
import { EVENT, EVENTS } from '../game/events';
import { HAPPENING } from '../game/happenings';
import { storyLog } from '../game/storyState';
import { PixelRider } from './Appearance';
import { divisionFor } from '../game/career';
import { DISCIPLINES, STATS, type Archive, type Rider, type View } from '../game/types';
import { chooseEnding, endingName, honors, summarize } from '../game/legacy';
import { formatRP, peakSeasonRP, rankingPoints, validRP } from '../game/rp';
import { RELATIONSHIP_NAMES, RELATIONSHIP_REWARDS, RELATIONSHIP_TITLES, relationshipHint, relationshipWith, representativeTitle } from '../game/relationships';
import { RPDisciplines } from './RankingPoints';
import type { Publication } from '../game/public';
import { SectionTitle, Tag } from './Brand';
import { RiderCard, StatCards, type Submit } from './Overview';
import { service } from './Account';
import { RelationshipEpilogues } from './RelationshipEpilogues';

export function Rankings({r}:{r:Rider}){
  const [year,setYear]=useState<number|null>(null);
  const [discipline,setDiscipline]=useState<typeof DISCIPLINES[number]>('dance');
  const history=[...r.seasons,...(r.seasons.some(s=>s.year===r.year)?[]:[r.season])];
  const season=history.find(s=>s.year===(year??r.year))??r.season;
  const rp=rankingPoints(r);
  const own=rp.seasons.find(item=>item.year===season.year);
  const scores={...season.scores[discipline]};
  if(own&&own.disciplines[discipline]>0)scores.player=own.disciplines[discipline];
  const board=Object.entries(scores).sort(([a,x],[b,y])=>y-x||a.localeCompare(b));
  return <section className="panel content-panel">
    <p className="game-section-note">선택한 연차에 획득한 종목별 RP로 순위를 매깁니다.</p>
    <div className="rp-overview"><strong>통산 {formatRP(rp.total)}</strong><b>{season.year}년차 시즌 {formatRP(own?.total??0)}</b></div>
    <div className="filter-line"><div className="pill-row">{DISCIPLINES.map(d=><button key={d} aria-pressed={d===discipline} className={`pill ${d===discipline?'active':''}`} onClick={()=>setDiscipline(d)}>{DISCIPLINE_NAMES[d]}</button>)}</div><label className="inline-select">시즌<select value={season.year} onChange={e=>setYear(Number(e.target.value))}>{history.map(s=><option value={s.year} key={s.year}>{s.year}년차 · {DIVISION_NAMES[s.division]}</option>)}</select></label></div>
    <div className="inner-card rankings">
      <div className="card-heading"><span><Trophy size={19}/> {DISCIPLINE_NAMES[discipline]} 순위표</span><Tag kind="lime">{DIVISION_NAMES[season.division]}</Tag></div>
      {board.length?<ol className="rank-list">{board.map(([id,points],i)=><li className={id==='player'?'you':''} key={id}><b>{i+1}</b><span>{id==='player'?r.name:NAMES[id]} {id==='player'&&<small>나</small>}</span><strong>{formatRP(points)}</strong></li>)}</ol>:<p className="empty">아직 집계된 RP가 없어요. 대회가 열리면 순위표가 채워집니다.</p>}
    </div>
  </section>;
}

export function Profile({r,send,saving,onHall,onNew}:{r:Rider;send:Submit;saving:boolean;onHall:()=>void;onNew:()=>void}){
  const [confirm,setConfirm]=useState(false);
  const awards=honors(r);
  return <div className="stack">
    <section className="panel content-panel">
      <SectionTitle code="RIDER PROFILE" title={r.name} detail={`${formatCareerDate(r)} · ${DIVISION_NAMES[divisionFor(r.year)]}`}/>
      {representativeTitle(r)&&<Tag kind="lime"><Medal size={14}/> {representativeTitle(r)}</Tag>}
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
      <SectionTitle code="CAREER ARCHIVE" title={r.phase==='retired'?'커리어 종료':'은퇴'}/>
      <p>{r.phase==='retired'?'이 선수의 커리어가 명예의 전당에 보존되었습니다.':'은퇴한 선수는 훈련에 복귀할 수 없으며 모든 성적은 개인 명예의 전당에 보관됩니다.'}</p>
      {confirm&&r.phase!=='retired'&&<RetirementSummary r={r}/>}
      <div className="bottom-actions">{r.phase==='retired'?<><button className="button secondary" onClick={onHall}><Trophy size={16}/> 명예의 전당</button><button className="button primary" onClick={onNew}>새 선수 만들기 <ArrowUpRight size={16}/></button></>:confirm?<><button className="button quiet" onClick={()=>setConfirm(false)}>계속 육성</button><button className="button danger" onClick={()=>void send({type:'retire'})} disabled={saving}>은퇴하고 기록 보관</button></>:<button className="button quiet" onClick={()=>setConfirm(true)}>조기 은퇴 선택</button>}</div>
    </section>
  </div>;
}
export function Rivals({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  const {choices,relationships}=extras(r);
  const log=storyLog(r);
  const crewLog=log.filter(entry=>entry.npcs.length>1||entry.id.startsWith('cross-')||entry.id.startsWith('crew-')||entry.id.startsWith('happening-crew-'));
  const when=(id:string)=>(choices[id]?.year??0)*RULES.weeks+(choices[id]?.week??0);
  return <section className="panel content-panel">
    {!!relationships?.titles.length&&<label className="relationship-title">
      대표 칭호
      <select value={relationships.representative??''} disabled={saving||r.phase==='retired'} onChange={e=>void send({type:'representative-title',id:e.currentTarget.value||null})}>
        <option value="">선택 안 함</option>
        {relationships.titles.map(id=><option key={id} value={id}>{RELATIONSHIP_TITLES.get(id)}</option>)}
      </select>
    </label>}
    {!!crewLog.length&&<details className="past-meets relationship-episodes">
      <summary>크루 사건과 해프닝 {crewLog.length}개 <ChevronDown size={14}/></summary>
      <ul className="hall-history">{crewLog.toReversed().map(entry=><StoryLogItem key={entry.id+':'+entry.year+':'+entry.week} entry={entry}/>)}</ul>
    </details>}
    <div className="rival-grid">{RIVALS.map(n=>{
      const progress=competitor(n,r.year,r.week);
      const here=log.filter(entry=>entry.npcs.includes(n.id)).toReversed();
      const episodes=EVENTS.filter(e=>e.npc===n.id&&(r.events[e.id]||choices[e.id])&&!here.some(entry=>entry.id===e.id)).sort((a,b)=>when(b.id)-when(a.id));
      const rewards=(n.id==='yu'||n.id==='jun'?Object.values(RELATIONSHIP_REWARDS[n.id]):[]).filter(reward=>relationships?.titles.includes(reward.titleId));
      const relation=r.relations[n.id]??0;
      const phase=relationshipWith(r,n.id)?.state??'undecided';
      const hint=r.phase!=='retired'&&relationshipHint(r,n.id);
      return <article className="inner-card rival" key={n.id}>
        <PixelRider look={n.look}/><strong>{n.name} <small>· {n.age}세</small></strong><Tag>{n.style} · {STYLE_NAMES[n.tactic]}</Tag>
        <p>{n.personality}</p><p>{n.line}</p>
        <p>{n.spots.map(spot=>LOCATIONS[spot].name).join(' · ')}</p>
        <p>주력 기술 {SKILL[n.signature]?.name} · 습득 {Object.keys(progress.skills).length}개</p>
        <div className="skill-track"><span>{RELATIONSHIP_NAMES[phase]}</span><b>관계도 {relation}</b></div>
        <div className="bar"><span style={{width:relation+'%',background:n.color}}/></div>
        {hint&&<p className="relationship-hint">{hint}</p>}
        {rewards.map(reward=><div className="relationship-reward" key={reward.titleId}>
          <Tag kind="lime"><Medal size={13}/> {reward.title}</Tag><small>{ITEM.get(reward.item)?.name}</small>
        </div>)}
        {!!(episodes.length+here.length)&&<details className="past-meets relationship-episodes">
          <summary>에피소드와 해프닝 {episodes.length+here.length}개 <ChevronDown size={14}/></summary>
          <ul className="hall-history">{here.map(entry=><StoryLogItem key={entry.id+':'+entry.year+':'+entry.week} entry={entry}/>)}{episodes.map(episode=>{
            const choice=choices[episode.id],outcome=choice&&episode.choices[choice.index];
            return <li key={episode.id}>
              <b>{choice&&<>{formatCareerDate(choice)} · </>}{episode.title}</b>
              {outcome&&<span>{outcome.label}</span>}{outcome?.dialogue&&<span>{outcome.dialogue}</span>}
            </li>;
          })}</ul>
        </details>}
      </article>;
    })}</div>
  </section>;
}
function StoryLogItem({entry}:{entry:ReturnType<typeof storyLog>[number]}){
  const event=EVENT[entry.id];
  return <li>
    <b>{formatCareerDate(entry)} · {event?.title??HAPPENING.get(entry.id)?.title}</b>
    {event&&entry.choice!==undefined&&<span>{event.choices[entry.choice]?.label}</span>}
    {entry.dialogue&&<span>{entry.dialogue}</span>}
    {entry.choice!==undefined&&!!entry.details.length&&<small>{entry.details.join(' · ')}</small>}
  </li>;
}
function RetirementSummary({r}:{r:Rider}){
  const stats=summarize(r);
  return <div className="retirement-summary">
    <h3>은퇴 시 보관할 기록</h3>
    <p>{formatCareerDate(r)} · 대회 {stats.meets}회 · {stats.wins}승 · {stats.podiums}회 입상 · 통산 {formatRP(rankingPoints(r).total)}</p>
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
          return <td key={d}>{result?`${result.run.score.toFixed(1)}점 · ${playerPlace(result)}위${validRP(result.points)?' · +'+formatRP(result.points):''}`:'—'}</td>;
          })}</tr>)}</tbody>
      </table></div>}
    {!!timeline.length&&<details className="past-meets"><summary>주요 사건과 보상 <ChevronDown size={16}/></summary><div>
      {timeline.map((item,index)=><div key={item.year+'-'+item.week+'-'+index}><span>{formatCareerDate(item)} · <b>{lineTerms(item.title)}</b></span><span>{lineTerms(item.text)}</span></div>)}
    </div></details>}
  </section>;
}
export function PrivateHall({hall,view,onEnding,onAccount,onPublic}:{hall:Archive[];view:View;onEnding:(id:string)=>void;onAccount:()=>void;onPublic:(id:string)=>void}){
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
  return <section className="panel content-panel hall" aria-label="내 선수 기록">
    {error&&<p className="form-error" role="alert">{error}</p>}
    {!hall.length?<div className="hall-empty"><Trophy size={40}/><h3>아직 보관된 선수가 없어요</h3><p>은퇴하면 성장 기록과 대회 성적이 이곳에 남습니다.</p></div>:<div className="stack">{[...hall].reverse().map(a=>{
      const p=publications.find(row=>row.archiveId===a.id);
      return <ArchiveCard key={a.id} archive={a} actions={<>
        <button className="button secondary small" onClick={()=>onEnding(a.id)}><Play size={15}/> 엔딩 다시 보기</button>
        {!view.username?<button className="button quiet small" onClick={onAccount}>계정 연결</button>:
          p?.moderated?<Tag kind="orange">운영 검토로 비공개</Tag>:
          <button className={`button ${p?.active?'quiet':'primary'} small`} disabled={!available||!!pending}
            onClick={()=>void change(a.id,!p?.active)}>{p?.active?'공개 취소':'온라인에 공개'}</button>}
        {p?.active&&!p.moderated&&<a className="button quiet small" href={'?rider='+p.id} onClick={event=>{
          if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
          event.preventDefault();onPublic(p.id);
        }}>공개 프로필 보기 <ArrowUpRight size={14}/></a>}
      </>}/>;
    })}</div>}
  </section>;
}
function ArchiveCard({archive:a,actions}:{archive:Archive;actions:React.ReactNode}){
  const summary=summarize(a);
  const rp=rankingPoints(a);
  const peak=peakSeasonRP(rp);
  const earned=a.honors??honors(a);
  const ending=a.ending??chooseEnding(a);
  const title=representativeTitle(a);
  const time=(a.year-1)*RULES.weeks+a.week;
  const history=a.extras?.timeline??[];
  const choices=EVENTS.flatMap(event=>{
    const choice=a.extras?.choices[event.id];
    if(!choice)return [];
    return [{year:choice.year,week:choice.week,title:event.title,text:event.choices[choice.index]?.label??''}];
  });
  const timeline=[...history,...choices.filter(choice=>!history.some(item=>item.year===choice.year&&item.week===choice.week&&item.title===choice.title))];
  const years=[...new Set([...a.seasons,...a.records,...timeline].map(item=>item.year))].sort((x,y)=>x-y);
  const relationships=RIVALS.filter(rival=>a.relations[rival.id]||ending.friends?.includes(rival.id));
  const achievements=[[Trophy,summary.wins+'회','우승'],[Star,summary.meets?Math.max(...Object.values(summary.best)).toFixed(1)+'점':'—','개인 최고점'],
    [Flag,summary.meets+'개','출전 대회'],[Shield,summary.learned.length+'개','습득 기술']] as const;
  return <article className="archive-card">
    <div className="archive-cover">
      <PixelRider look={equippedLook(a)} label={a.name+' 은퇴 당시 외형'}/>
      <div><Tag kind={a.reason==='complete'?'lime':'muted'}>{a.reason==='complete'?'8년 완주':'조기 은퇴'}</Tag><h3>{a.name}</h3><p>{endingName(ending)}{title&&' · '+title}</p>
      <small>{formatCareerDate(a)} 은퇴 · 활동 {time}주 · 명성 {a.fame.toLocaleString('ko-KR')}</small></div>
    </div>
    <div className="archive-achievements">
      {achievements.map(([Icon,value,label])=><div key={label}>
        <Icon size={16} aria-hidden="true"/><strong>{value}</strong><small>{label}</small>
      </div>)}
    </div>
    <div className="rp-overview"><strong>통산 {formatRP(rp.total)}</strong>
      {!!peak?.total&&<b>최고 시즌 · {peak.year}년차 {formatRP(peak.total)}</b>}{rp.partial&&<small>확인된 RP만 집계했습니다.</small>}
    </div>
    {!!earned.length&&<div className="pill-row archive-honors">{earned.slice(-3).reverse().map(title=><Tag key={title} kind="lime"><Medal size={14}/> {title}</Tag>)}</div>}
    <details className="past-meets"><summary>커리어 상세 보기 <ChevronDown size={16}/></summary><div className="archive-details">
      <h4>최종 능력치</h4>
      <div className="archive-final-stats">{STATS.map(stat=><div key={stat}><b>{STAT_NAMES[stat]}</b><span>{a.stats[stat]} / {RULES.statCap}</span>
        <meter min={0} max={RULES.statCap} value={a.stats[stat]} aria-label={STAT_NAMES[stat]}/></div>)}</div>
      {!!earned.length&&<><h4>업적·칭호</h4><div className="pill-row">{earned.map(title=><Tag kind="lilac" key={title}>{title}</Tag>)}</div></>}
      <h4>기술과 숙련도</h4>
      <div className="pill-row">{summary.learned.map(skill=><Tag key={skill.id}>{skill.name} {a.skills[skill.id].mastery}%</Tag>)}</div>
      {relationships.length>0&&<><h4>라이벌</h4><div className="pill-row">{relationships.map(rival=><Tag key={rival.id}>{rival.name} 관계 {a.relations[rival.id]??0}</Tag>)}</div></>}
      <RelationshipEpilogues archive={a}/>
      {storyLog(a).length>0&&<details className="past-meets relationship-episodes">
        <summary>커리어 이야기와 해프닝 <ChevronDown size={14}/></summary>
        <ul className="hall-history">{storyLog(a).toReversed().map(entry=><StoryLogItem key={entry.id+':'+entry.year+':'+entry.week} entry={entry}/>)}</ul>
      </details>}
      {!!a.extras?.relationships?.titles.length&&<><h4>관계 칭호</h4><div className="pill-row">{a.extras.relationships.titles.map(id=><Tag key={id}>{RELATIONSHIP_TITLES.get(id)}</Tag>)}</div></>}
      <h4>통산 종목별 RP</h4><RPDisciplines points={rp.disciplines}/>
      {years.length>0&&<><h4>연차별 성장과 대회</h4>{years.map(year=>{
        const season=a.seasons.find(item=>item.year===year);
        const matches=a.records.filter(item=>item.year===year);
        const events=timeline.filter(item=>item.year===year).sort((left,right)=>left.week-right.week);
        const division=season?.division??matches[0]?.division;
        const seasonRP=rp.seasons.find(item=>item.year===year);
        return <details className="past-meets archive-year" key={year}><summary>{year}년차{division?' · '+DIVISION_NAMES[division]:''}{seasonRP?' · '+formatRP(seasonRP.total):''}</summary>
          {seasonRP&&<RPDisciplines points={seasonRP.disciplines}/>}
          <ul className="hall-history">{matches.map(meet=><li key={meet.id}><b>{meetById(meet.id)?.name??meet.id}</b><span>{meet.results.map(result=>`${DISCIPLINE_NAMES[result.discipline]} ${playerPlace(result)}위 · ${result.run.score.toFixed(1)}점${validRP(result.points)?' · +'+formatRP(result.points):''}`).join(' / ')||'불참'}</span></li>)}</ul>
          <ul className="hall-history">{events.map((event,i)=><li key={`${event.week}:${event.title}:${i}`}><b>{formatMonthWeek(event.week)} · {lineTerms(event.title)}</b><span>{lineTerms(event.text)}</span></li>)}</ul>
        </details>;
      })}</>}
    </div></details>
    <div className="bottom-actions">{actions}</div>
  </article>;
}
