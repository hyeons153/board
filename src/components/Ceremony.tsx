import { ArrowRight, Flag, Medal, Trophy } from 'lucide-react';
import { useState } from 'react';
import { CALENDAR, DISCIPLINE_NAMES, SKILL } from '../game/data';
import { RIVAL } from '../game/content';
import { equippedLook } from '../game/economy';
import { chooseEnding, endingName, ENDINGS, summarize } from '../game/legacy';
import { moveMotion } from '../scene/motion';
import { DISCIPLINES, type Archive } from '../game/types';
import Scene from './Scene';
import { Tag } from './Brand';

export default function Ceremony({archive,onHall,onNew}:{archive:Archive;onHall:()=>void;onNew:()=>void}){
  const [step,setStep]=useState(0);
  const ending=archive.ending??chooseEnding(archive);
  const summary=summarize(archive);
  const latest=archive.records.at(-1);
  const highlights=[...archive.records].flatMap(meet=>meet.results.map(result=>({meet,result}))).sort((a,b)=>b.result.run.score-a.result.run.score);
  const best=highlights[0];
  const moment=best?.result.run.log.find(move=>move.outcome==='great')??best?.result.run.log.find(move=>move.outcome==='clean');
  const rival=ending.friends.length?RIVAL.get(ending.friends[0]):RIVAL.get('sol');
  const descriptor=ENDINGS[ending.kind];
  const motion=step===0?'brake':step===1?ending.kind==='legend'?'win':'great':step===2&&moment?moveMotion(moment.id,.44,moment.outcome):'rest';
  const title=['마지막 주행','은퇴식','커리어 하이라이트',endingName(ending)][step];
  const story=[
    archive.reason==='complete'?'12월 롱보드 페스티벌이 끝났다. 마지막 시즌의 성적과 보상이 확정됐다.':'보드를 내려놓기 전, 지나온 시즌을 돌아본다.',
    descriptor.line,
    best?`${best.meet.year}년차 ${CALENDAR.find(m=>m.id===best.meet.id)?.name} · ${DISCIPLINE_NAMES[best.result.discipline]} ${best.result.run.score.toFixed(1)}점`:'첫 푸시와 그때 만난 사람들이 선수 기록에 남았다.',
    '개인 명예의 전당에 기록을 보관했습니다. 계정에서 공개 여부를 선택할 수 있습니다.',
  ][step];
  return <section className={'panel ceremony ceremony-'+ending.kind}>
    <div className="ceremony-stage">
      <Scene spot={step===0?(CALENDAR.find(m=>m.id===latest?.id)?.spot??descriptor.spot):descriptor.spot}
        variant={step===2?'race':'event'} look={equippedLook(archive)} guest={step===1?rival?.look:undefined} motion={motion}/>
      <div className="scene-shade"/><div className="spot-title"><span><Medal size={15}/> {archive.name} · {archive.year}년차</span><h2>{title}</h2><p>{story}</p></div>
    </div>
    <div className="ceremony-content">
      {step===1&&rival&&<blockquote><strong>{rival.name}</strong><p>{ending.friends.length?'“우리가 같이 탔던 시간도 네 기록이야. 다음에 타게 되면, 또 강변에서 보자.”':'“어디까지 가든 그 첫 한 바퀴는 네 거야. 오늘 네가 탄 길을 잊지 마.”'}</p></blockquote>}
      {step===2&&moment&&<p><Flag size={16}/> 대표 장면 · {SKILL[moment.id]?.name}</p>}
      {step===3&&<>
        <div className="archive-stats"><span><Trophy size={17}/> {summary.wins}승 · {summary.podiums}회 입상</span><span>{summary.meets}개 대회 · 시즌 포인트 {summary.points}</span><span>기술 {summary.learned.length}개</span></div>
        <div className="pill-row">{DISCIPLINES.map(d=><Tag key={d}>{DISCIPLINE_NAMES[d]} {summary.best[d].toFixed(1)}점</Tag>)}</div>
        {!!ending.friends.length&&<div className="epilogue"><strong>우정·라이벌 에필로그</strong>
          {ending.friends.map(id=><p key={id}>{RIVAL.get(id)?.name}와 함께한 스팟과 대회 이야기는 은퇴식 뒤에도 이어졌다.</p>)}</div>}
        <div className="bottom-actions"><button className="button secondary" onClick={onHall}>개인 명예의 전당</button><button className="button primary" onClick={onNew}>새 선수 육성 <ArrowRight size={17}/></button></div>
      </>}
      {step<3&&<div className="bottom-actions"><button className="button quiet" onClick={()=>setStep(3)}>성적 바로 보기</button>
        <button className="button primary" onClick={()=>setStep(step+1)}>계속 <ArrowRight size={17}/></button></div>}
    </div>
  </section>;
}
