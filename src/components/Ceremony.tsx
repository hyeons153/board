import { ArrowLeft, ArrowRight, Flag, Trophy } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { meetById, DISCIPLINE_NAMES, SKILL } from '../game/data';
import { RIVAL } from '../game/content';
import { equippedLook } from '../game/economy';
import { chooseEnding, endingName, ENDINGS, summarize } from '../game/legacy';
import { formatRP, rankingPoints } from '../game/rp';
import { relationshipEpilogues, representativeTitle } from '../game/relationships';
import { DISCIPLINES, type Archive } from '../game/types';
import Scene from './Scene';
import { Tag } from './Brand';
import { RelationshipEpilogues } from './RelationshipEpilogues';
import { PublicationStatus, RegistrationError, type RegistrationActions } from './HallRegistration';

const farewell = {
  partner:'“오늘은 은퇴식이지만, 우리 다음 약속은 그대로야.”',
  friend:'“같이 탔던 시간도 네 기록이야. 다음에 타게 되면 또 보자.”',
  rival:'“네 라인을 보고 나도 더 멀리 갔어. 다음에 만나면 한 판 더 하자.”',
  crew:'“함께 탔던 날들, 오래 기억할게. 수고했어.”',
};
const guestPriority=['partner','friend','rival'] as const;

export default function Ceremony({archive,step,onStep,onHall,onNew,registration}:{archive:Archive;step:number;onStep:(step:number)=>void;onHall:()=>void;onNew:()=>void;registration:RegistrationActions}){
  const scroll=useRef<HTMLDivElement>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  const notice=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    scroll.current?.scrollTo(0,0);
    heading.current?.focus({preventScroll:true});
  },[archive.id,step]);
  const failure=registration.failure?.archiveId===archive.id?registration.failure.message:undefined;
  useEffect(()=>{
    if(step===3&&(failure||registration.loadError))notice.current?.scrollIntoView({block:'nearest'});
  },[step,failure,registration.loadError]);

  const publication=registration.rows.find(row=>row.archiveId===archive.id);
  const ending=archive.ending??chooseEnding(archive);
  const finalTitle=endingName(ending);
  const summary=summarize(archive);
  const latest=meetById(archive.records.at(-1)?.id);
  const highlights=archive.records.flatMap(meet=>meet.results.map(result=>({meet,result}))).sort((a,b)=>b.result.run.score-a.result.run.score);
  const best=highlights[0];
  const bestMeet=meetById(best?.meet.id);
  const tied=best&&highlights[1]?.result.run.score===best.result.run.score;
  const log=best?.result.run.log.filter(move=>SKILL[move.id]);
  const highlighted=best?.result.run.highlight;
  const moment=highlighted&&SKILL[highlighted.id]?highlighted:
    log?.find(move=>move.outcome==='great')??log?.find(move=>move.outcome==='clean')??log?.find(move=>move.outcome==='rough');
  const relations=relationshipEpilogues(archive);
  const legacyFriends=ending.friends.filter(id=>RIVAL.has(id)&&!relations.some(relation=>relation.npc===id));
  const guestState=guestPriority.find(state=>relations.some(relation=>relation.state===state&&RIVAL.has(relation.npc)));
  const guestId=guestState?relations.find(relation=>relation.state===guestState&&RIVAL.has(relation.npc))?.npc:legacyFriends[0];
  const guest=guestId?RIVAL.get(guestId):undefined;
  const titleInUse=representativeTitle(archive);
  const descriptor=ENDINGS[ending.kind];
  const motion=step===0?'brake':step===1?ending.kind==='legend'?'win':'great':'rest';
  const title=['마지막 주행','은퇴식',best?'커리어 최고의 순간':'첫 푸시의 기억',finalTitle][step];
  const lastRide=archive.reason==='complete'
    ?`${latest?.name??'마지막 대회'}를 마치고, 한 번 더 보드에 올랐다.`
    :'선수 생활을 여기서 마치고, 천천히 마지막 한 바퀴를 돈다.';
  const spot=step===0?latest?.spot:step===2?bestMeet?.spot:undefined;
  const disciplines=DISCIPLINES.filter(d=>highlights.some(({result})=>result.discipline===d));
  const rp=rankingPoints(archive);
  return <section className={'panel ceremony ceremony-'+ending.kind} data-step={step+1}>
    <div className="ceremony-scroll" ref={scroll}>
      <div className="ceremony-stage">
        <div className="ceremony-scene">
          <Scene spot={spot??descriptor.spot} variant={step===2&&best?'race':'event'} look={equippedLook(archive)}
            guest={step===1?guest?.look:undefined} motion={motion} technique={step===2&&moment?{id:moment.id,outcome:moment.outcome}:undefined}/>
          <div className="scene-shade"/>
        </div>
        <div className="ceremony-heading" key={step}>
          {step!==2&&<span>{archive.name} · {archive.year}년차</span>}
          <h2 tabIndex={-1} ref={heading}>{title}</h2>
          {step===0&&<p>{lastRide}</p>}
          {step===1&&<p>{guest?descriptor.line:'보드를 내려놓고, 그동안 달려온 길에 마지막 인사를 건넸다.'}</p>}
          {step===2&&(best?<div className="ceremony-highlight">
            <p>{best.meet.year}년차 · {bestMeet?.name??'대회 기록'}</p>
            <p>{DISCIPLINE_NAMES[best.result.discipline]} 개인 최고 기록 <strong>{best.result.run.score.toFixed(1)}점</strong>{tied&&<small>공동 최고</small>}</p>
            {moment&&<p><Flag size={14}/> 대표 기술 · {SKILL[moment.id]?.name}</p>}
          </div>:<p>처음 보드에 올랐던 순간을 마지막으로 돌아본다.</p>)}
          {step===3&&<p>{archive.reason==='complete'?'8년 커리어 완주':'조기 은퇴'} · 개인 명예의 전당에 보관했어요.</p>}
        </div>
      </div>
      {step===1&&guest&&<div className="ceremony-content"><blockquote><strong>{guest.name}</strong><p>{farewell[guestState??'crew']}</p></blockquote></div>}
      {step===3&&<div className="ceremony-content">
        <dl className="ceremony-totals">
          <div><dt>{rp.partial?'확인된 통산 RP':'통산 RP'}</dt><dd>{formatRP(rp.total)}</dd></div>
          <div><dt>종목 우승</dt><dd>{summary.wins}회</dd></div>
          <div><dt>종목 입상</dt><dd>{summary.podiums}회</dd></div>
          <div><dt>출전 대회</dt><dd>{summary.meets}개</dd></div>
          <div><dt>습득 기술</dt><dd>{summary.learned.length}개</dd></div>
        </dl>
        {(titleInUse||disciplines.length>0)&&<div className="pill-row ceremony-best">
          {titleInUse&&titleInUse!==finalTitle&&<Tag kind="lime">{titleInUse}</Tag>}
          {disciplines.length>0&&<span>종목별 최고</span>}
          {disciplines.map(d=><Tag key={d}>{DISCIPLINE_NAMES[d]} {summary.best[d].toFixed(1)}점</Tag>)}
        </div>}
        <div ref={notice} className="ceremony-registration-notice">
          <PublicationStatus publication={publication}/>
          <RegistrationError registration={registration} archiveId={archive.id}/>
        </div>
        <RelationshipEpilogues archive={archive} collapsed legacyFriends={legacyFriends}/>
      </div>}
    </div>
    <footer className="ceremony-footer">
      <span className="ceremony-progress" aria-label={`엔딩 ${step+1}단계, 전체 4단계`}>{step+1} / 4</span>
      {step===3?<div className="ceremony-registration">
          <div className="bottom-actions hall-registration-actions">
            {!publication?.moderated&&<button className="button primary" disabled={!registration.ready||!!registration.working}
              onClick={()=>publication?.active?registration.onRank(archive,publication):registration.onRegister(archive)}><Trophy size={17}/>
              {registration.working===archive.id?'등록 중…':publication?.active?'내 글로벌 순위 확인':'명예의 전당 등록'}</button>}
            <button className="button secondary" onClick={onHall}>개인 기록 보기</button>
            <button className="button quiet" onClick={onNew}>새 선수 육성 <ArrowRight size={17}/></button>
            <button className="button quiet ceremony-back" onClick={()=>onStep(step-1)}><ArrowLeft size={16}/> 이전</button>
          </div>
        </div>:<div className="bottom-actions ceremony-navigation">
          {step>0&&<button className="button quiet" onClick={()=>onStep(step-1)}><ArrowLeft size={16}/> 이전</button>}
          <button className="button quiet" onClick={()=>onStep(3)}>성적 바로 보기</button>
          <button className="button primary" onClick={()=>onStep(step+1)}>계속 <ArrowRight size={17}/></button>
        </div>}
    </footer>
  </section>;
}
