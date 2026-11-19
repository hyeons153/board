import { ArrowRight, Flag, Medal, Trophy } from 'lucide-react';
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

export default function Ceremony({archive,step,onStep,onHall,onNew,registration}:{archive:Archive;step:number;onStep:(step:number)=>void;onHall:()=>void;onNew:()=>void;registration:RegistrationActions}){
  const publication=registration.rows.find(row=>row.archiveId===archive.id);
  const ending=archive.ending??chooseEnding(archive);
  const summary=summarize(archive);
  const latest=archive.records.at(-1);
  const highlights=[...archive.records].flatMap(meet=>meet.results.map(result=>({meet,result}))).sort((a,b)=>b.result.run.score-a.result.run.score);
  const best=highlights[0];
  const moment=best?.result.run.highlight??best?.result.run.log.find(move=>move.outcome==='great')??best?.result.run.log.find(move=>move.outcome==='clean');
  const relations=relationshipEpilogues(archive);
  const partner=relations.find(relation=>relation.state==='partner');
  const rival=RIVAL.get(partner?.npc??ending.friends[0]??'sol');
  const legacyFriends=ending.friends.filter(id=>!relations.some(relation=>relation.npc===id));
  const titleInUse=representativeTitle(archive);
  const descriptor=ENDINGS[ending.kind];
  const motion=step===0?'brake':step===1?ending.kind==='legend'?'win':'great':'rest';
  const title=['마지막 주행','은퇴식','커리어 하이라이트',endingName(ending)][step];
  const story=[
    archive.reason==='complete'?`${meetById(latest?.id)?.name??'마지막 대회'}가 끝났다. 마지막 시즌의 성적과 보상이 확정됐다.`:'보드를 내려놓기 전, 지나온 시즌을 돌아본다.',
    descriptor.line,
    best?`${best.meet.year}년차 ${meetById(best.meet.id)?.name} · ${DISCIPLINE_NAMES[best.result.discipline]} ${best.result.run.score.toFixed(1)}점`:'첫 푸시와 그때 만난 사람들이 선수 기록에 남았다.',
    '은퇴 기록을 개인 명예의 전당에 보관했어요.',
  ][step];
  return <section className={'panel ceremony ceremony-'+ending.kind}>
    <div className="ceremony-stage">
      <Scene spot={step===0?(meetById(latest?.id)?.spot??descriptor.spot):descriptor.spot}
        variant={step===2?'race':'event'} look={equippedLook(archive)} guest={step===1?rival?.look:undefined} motion={motion} technique={step===2&&moment?{id:moment.id,outcome:moment.outcome}:undefined}/>
      <div className="scene-shade"/><div className="spot-title"><span><Medal size={15}/> {archive.name} · {archive.year}년차</span><h2>{title}</h2><p>{story}</p></div>
    </div>
    <div className="ceremony-content">
      {step===1&&rival&&<blockquote><strong>{rival.name}</strong><p>{partner?'“오늘은 은퇴식이지만, 우리 다음 약속은 그대로야.”':ending.friends.length?'“우리가 같이 탔던 시간도 네 기록이야. 다음에 타게 되면, 또 강변에서 보자.”':'“어디까지 가든 그 첫 한 바퀴는 네 거야. 오늘 네가 탄 길을 잊지 마.”'}</p></blockquote>}
      {step===2&&moment&&<p><Flag size={16}/> 대표 장면 · {SKILL[moment.id]?.name}</p>}
      {step===3&&<>
        <div className="archive-stats"><span><Trophy size={17}/> {summary.wins}승 · {summary.podiums}회 입상</span><span>{summary.meets}개 대회 · 통산 {formatRP(rankingPoints(archive).total)}</span><span>명성 {archive.fame} · 기술 {summary.learned.length}개</span></div>
        <div className="pill-row">{titleInUse&&<Tag kind="lime">{titleInUse}</Tag>}{DISCIPLINES.map(d=><Tag key={d}>{DISCIPLINE_NAMES[d]} {summary.best[d].toFixed(1)}점</Tag>)}</div>
        <RelationshipEpilogues archive={archive}/>
        {!!legacyFriends.length&&<div className="epilogue"><strong>우정·라이벌 에필로그</strong>
          {legacyFriends.map(id=><p key={id}>{RIVAL.get(id)?.name}와 함께한 스팟과 대회 이야기는 은퇴식 뒤에도 이어졌다.</p>)}</div>}
        <div className="ceremony-registration">
          <PublicationStatus publication={publication}/>
          <RegistrationError registration={registration} archiveId={archive.id}/>
          <div className="bottom-actions hall-registration-actions">
            {!publication?.moderated&&<button className="button primary" disabled={!registration.ready||!!registration.working}
              onClick={()=>publication?.active?registration.onRank(archive,publication):registration.onRegister(archive)}><Trophy size={17}/>
              {registration.working===archive.id?'등록 중…':publication?.active?'내 글로벌 순위 확인':'명예의 전당 등록'}</button>}
            <button className="button secondary" onClick={onHall}>개인 기록 보기</button>
            <button className="button quiet" onClick={onNew}>새 선수 육성 <ArrowRight size={17}/></button>
          </div>
        </div>
      </>}
      {step<3&&<div className="bottom-actions"><button className="button quiet" onClick={()=>onStep(3)}>성적 바로 보기</button>
        <button className="button primary" onClick={()=>onStep(step+1)}>계속 <ArrowRight size={17}/></button></div>}
    </div>
  </section>;
}
