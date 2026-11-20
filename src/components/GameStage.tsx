import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Flag, HeartPulse, ListChecks, MapPin, Play, Timer, Trophy } from 'lucide-react';
import { ACTION_NAMES, ACTION_STORIES, calendarFor, formatCareerDate, meetById, DISCIPLINE_NAMES, DIVISION_NAMES, LOCATIONS, OUTCOME_NAMES, RULES, SKILL, STAT_NAMES } from '../game/data';
import { currentMeet, divisionFor, singleEntry } from '../game/career';
import { eventBody, eventCast, eventChoiceAvailable, eventFor, eventNpc, eventPaused } from '../game/events';
import { happeningDuration } from '../game/happenings';
import { RIVAL, lineTerms } from '../game/content';
import { equippedLook, gearBonuses, playerPlace } from '../game/economy';
import { formatRP, meetRP, validRP } from '../game/rp';
import { specialTraining } from '../game/training';
import { DISCIPLINES, STATS, type Discipline, type EventOutcome, type GameAction, type Look, type MeetRecord, type Rider, type Spot } from '../game/types';
import type { Motion } from '../scene/motion';
import { headingsBefore, trainingTechnique } from '../scene/techniques';
import Scene from './Scene';
import { PixelRider } from './Appearance';
import { SpecialTrainingBadge } from './WeeklyChoices';
import { AUTO_FLOW, useAutoAdvance } from '../useAutoAdvance';
import { advanceClock, readPlaybackRate, savePlaybackRate, type AnimationClock, type PlaybackRate } from '../scene/playback';

type Submit=(action:GameAction)=>Promise<boolean>;
const money=(n:number)=>'₩'+n.toLocaleString('ko-KR');
const partNames={execution:'기술 수행',link:'연계',combo:'콤보',carve:'카빙',speed:'속도'};
const when=(ms:number)=>{const s=Math.ceil(ms/1000);return Math.floor(s/60).toString().padStart(2,'0')+':'+(s%60).toString().padStart(2,'0');};
function useDialogueFocus(key:string,active=true){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!active)return;
    ref.current?.focus({preventScroll:true});
    ref.current?.closest('.game-stage')?.scrollIntoView({block:'nearest',behavior:'instant'});
  },[key,active]);
  return ref;
}

export default function GameStage({r,send,saving,remaining,weekMs,fastForward,spot,motion,guest,record,pendingTraining,pendingEvent,active=true,autoChoosing=false,replaying=false,onDone,onSpotMenu}:{
  r:Rider;send:Submit;saving:boolean;remaining:number;weekMs:number;fastForward:boolean;spot:Spot;motion:Motion;guest?:Look;record?:MeetRecord;pendingTraining?:string;pendingEvent?:EventOutcome;active?:boolean;autoChoosing?:boolean;replaying?:boolean;onDone:()=>void;onSpotMenu?:()=>void;
}){
  const [playbackRate,setPlaybackRate]=useState<PlaybackRate>(readPlaybackRate);
  useEffect(()=>savePlaybackRate(playbackRate),[playbackRate]);
  const event=r.phase==='event'?eventFor(r,r.event??''):undefined;
  const waitsForChoice=r.phase==='event'&&eventPaused(r);
  const dialogue=useDialogueFocus(r.id+':'+r.phase+':'+r.event,active&&(r.phase==='event'||r.phase==='injury'));
  useEffect(()=>{
    if(!active||waitsForChoice||pendingEvent||pendingTraining||record||saving||r.settings.mode!=='auto'||!['event','meet','injury'].includes(r.phase))return;
    const timer=window.setTimeout(()=>{if(!document.hidden)void send(r.phase==='injury'?{type:'resume'}:{type:'settings',settings:{...r.settings,pauseStory:false,pauseMeet:false,pauseInjury:false}});},800);
    return ()=>window.clearTimeout(timer);
  },[r.phase,r.settings.mode,waitsForChoice,pendingTraining,pendingEvent?.key,record?.id,saving,send,active]);
  if(pendingTraining)return <TrainingOutcome r={r} saving={saving||!active} active={active} onDone={()=>void send({type:'continue-training',record:pendingTraining})}/>;
  if(pendingEvent&&(!record||!pendingEvent.afterMeet)){
    const props={r,result:pendingEvent,active,saving:saving||!active,onDone:()=>void send({type:'continue-event',record:pendingEvent.key})};
    return pendingEvent.happening?<HappeningScene {...props}/>:<EventResult {...props}/>;
  }
  if(record) return <Competition key={r.id+':'+record.year+':'+record.id+':'+replaying} record={record} r={r} saving={saving||!active} active={active} playbackRate={playbackRate} onSpeed={()=>setPlaybackRate(rate=>rate===1?2:1)} replaying={replaying} onDone={onDone}/>;
  const person=event?eventNpc(event,r):undefined;
  const meet=r.phase==='meet'?currentMeet(r):undefined;
  const overlay=!!event||!!meet||r.phase==='injury';
  const viewSpot=meet?.spot??(event?r.spot:spot);
  const technique=overlay||autoChoosing?undefined:trainingTechnique(r,Math.max(0,weekMs-remaining)/1000,weekMs/1000);
  const actionMotion:Partial<Record<NonNullable<Rider['plan']>['action'],Motion>>={speed:'accelerate',carve:'carve',balance:'land',rest:'rest',hospital:'rest'};
  return <section className={'spot-stage game-stage '+(overlay?'has-dialogue':'')} aria-label="인게임 화면">
    <Scene spot={viewSpot} look={equippedLook(r)} guest={person?.look??guest} motion={overlay||autoChoosing?'rest':r.plan?actionMotion[r.plan.action]??'ride':motion} technique={technique} variant={meet?'race':event?'event':'dashboard'}/>
    <div className="scene-shade"/>
    <div className="game-hud">{!overlay&&onSpotMenu?<button className="spot-map-trigger" aria-label="스팟 지도 열기" disabled={saving||!!r.plan||r.settings.mode==='auto'||r.phase!=='plan'} onClick={onSpotMenu}><MapPin size={13}/>{LOCATIONS[viewSpot].name} · 지도</button>:<span><MapPin size={13}/> {meet?meet.name:LOCATIONS[viewSpot].en}</span>}<div className="scene-counter"><Timer size={14}/><span>{meet?'출전 준비':event?'스팟 이야기':autoChoosing?'자동 육성 중':r.plan?when(remaining)+' 남음':'훈련 준비'}</span>
    </div></div>
    {event?<div className="game-dialogue" role="region" aria-label="이벤트 선택" key={r.event} ref={dialogue} tabIndex={-1}>
      <div className="game-caption">{event.kind}{person&&<span className="game-speaker"><PixelRider look={person.look}/>{eventCast(r,event).map(id=>id==='mentor'?person.name:RIVAL.get(id)?.name).filter(Boolean).join(' · ')||person.name}</span>}</div>
      <h2>{event.title}</h2><p>{eventBody(r,event)}</p>
      {waitsForChoice&&r.settings.mode==='auto'&&<p className="game-reward">자동 육성 일시 정지 · 직접 선택해 주세요.</p>}
      {waitsForChoice&&<div className="game-choices">{event.choices.map((choice,index)=>{
        const available=eventChoiceAvailable(r,event,index);
        return <button key={choice.label} disabled={saving||!available} onClick={()=>void send({type:'event',index,eventId:event.id})}>
          <span>{choice.label}{!available&&<small className="relationship-choice-lock">이 커리어에서 이미 연애 상대를 선택했어요.</small>}</span><ArrowRight size={15}/>
        </button>;
      })}</div>}
    </div>:meet?<Entry key={r.year+':'+r.week} r={r} send={send} saving={saving} active={active}/>:r.phase==='injury'?<div className="game-dialogue" role="region" aria-label="부상 확인" ref={dialogue} tabIndex={-1}><div className="game-caption"><HeartPulse size={16}/> 컨디션 알림</div><h2>잠깐, 몸 상태를 확인해요.</h2><p>새 부상으로 자동 육성을 멈췄어요. 다음 훈련에서 휴식이나 치료를 선택할 수 있습니다.</p><div className="game-actions"><button disabled={saving} onClick={()=>void send({type:'resume'})}>확인하고 재개 <ArrowRight size={15}/></button></div></div>:!r.plan&&<div className="spot-title"><span>{formatCareerDate(r)}</span><h2>{LOCATIONS[viewSpot].name}</h2><p>{LOCATIONS[viewSpot].detail}</p>{guest&&<span className="spot-visitor"><PixelRider look={guest}/> 함께 연습 중</span>}</div>}
    {r.plan&&!overlay&&!autoChoosing&&<div className="weekly-running" role="status">{specialTraining(r,r.plan)&&<SpecialTrainingBadge/>}<strong>{ACTION_STORIES[r.plan.action].start}{r.plan.skill?' · '+SKILL[r.plan.skill]?.name:''}</strong><progress max={weekMs} value={Math.max(0,weekMs-remaining)} aria-label="행동 진행"/></div>}
  </section>;
}
function Entry({r,send,saving,active}:{r:Rider;send:Submit;saving:boolean;active:boolean}){
  const dialogue=useDialogueFocus(r.id+':'+r.year+':'+r.week,active);
  const meet=currentMeet(r)!;
  const [entries,setEntries]=useState<Discipline[]>(meet.international?[...DISCIPLINES]:singleEntry(r.entries??r.settings.entries));
  const locked=!meet.international&&r.injury?.severity==='major'&&!r.injury.treated;
  const fatigue=gearBonuses(r).fatigue;
  const cost=entries.reduce((sum,d)=>sum+RULES.entryCost[d]-fatigue,0);
  return <div className="game-dialogue" role="region" aria-label="대회 출전 선택" ref={dialogue} tabIndex={-1}>
    <div className="game-caption"><Flag size={16}/> {r.year}년차 · {DIVISION_NAMES[divisionFor(r.year)]} · {meet.international?'국제대회':meet.major?'메이저 대회':'정규 대회'}</div><h2>{meet.name}</h2>
    <p>{meet.international?`${meet.host} · 부문 졸업 무대입니다. 댄싱·트릭·프리스타일 모두 출전합니다.`:'댄싱·트릭·프리스타일 중 1종목만 골라 출전하세요.'}</p>
    <p>{locked?'출전하려면 먼저 중상을 치료해야 해요.':'체력 0에서도 출전할 수 있어요. 기술 성공률과 점수는 체력과 관계없어요.'}</p>
    <div className={'game-disciplines'+(meet.international?' is-required':'')}>{DISCIPLINES.map(d=><button key={d} disabled={saving||locked||meet.international} aria-pressed={entries.includes(d)} onClick={()=>setEntries([d])}><span>{DISCIPLINE_NAMES[d]}</span><small>체력 −{RULES.entryCost[d]-fatigue}</small>{entries.includes(d)&&<b>{meet.international?entries.indexOf(d)+1:'선택'}</b>}</button>)}</div>
    <p className="game-hint">{entries.map(d=>DISCIPLINE_NAMES[d]).join(' → ')||'종목을 선택해 주세요'} · 체력 {Math.round(r.energy)} / 소모 {cost} · 종목별 1위 {formatRP(meetRP(1,meet.major))}</p>
    <div className="game-actions">{!meet.international&&<button className="game-quiet" disabled={saving} onClick={()=>void send({type:'entry',disciplines:[]})}>출전 취소</button>}<button disabled={saving||locked||!entries.length} onClick={()=>void send({type:'entry',disciplines:entries})}>경기장 입장 <ArrowRight size={15}/></button></div>
  </div>;
}
function Competition({record,r,onDone,saving,active,playbackRate,onSpeed,replaying}:{record:MeetRecord;r:Rider;onDone:()=>void;saving:boolean;active:boolean;playbackRate:PlaybackRate;onSpeed:()=>void;replaying:boolean}){
  const [index,setIndex]=useState(0);
  const meet=meetById(record.id)!;
  const result=record.results[index];
  useAutoAdvance(record.year+':'+record.id,!result&&r.settings.mode==='auto'&&!saving,AUTO_FLOW.resultMs,onDone);
  if(!result)return <section className="spot-stage game-stage has-dialogue" aria-label="인게임 대회 결과"><Scene spot={meet.spot} look={equippedLook(r)} motion="rest" variant="race"/><div className="scene-shade"/><div className="game-hud"><span>{meet.name}</span></div><div className="game-dialogue"><div className="game-caption">COMPETITION</div><h2>이번 대회는 쉬어 갑니다.</h2><p>다음 무대를 준비하며 커리어를 이어 가세요.</p><div className="game-actions"><button disabled={saving} onClick={onDone}>육성 계속 <ArrowRight size={15}/></button></div></div></section>;
  return <Playback key={result.discipline} record={record} index={index} r={r} saving={saving} active={active} autoSkip={!replaying&&r.settings.mode==='auto'&&!!r.settings.skipMeets} playbackRate={playbackRate} onSpeed={onSpeed} onNext={()=>index+1<record.results.length?setIndex(index+1):onDone()} doneLabel={replaying?'대회 일정으로':'육성 계속'}/>;
}
function Playback({record,index,r,saving,active,autoSkip,playbackRate,onSpeed,onNext,doneLabel}:{record:MeetRecord;index:number;r:Rider;saving:boolean;active:boolean;autoSkip:boolean;playbackRate:PlaybackRate;onSpeed:()=>void;onNext:()=>void;doneLabel:string}){
  const result=record.results[index];
  const meet=meetById(record.id)!;
  const [athlete,setAthlete]=useState('player');
  const [mode,setMode]=useState<'pick'|'full'|'result'>(autoSkip?'result':r.settings.mode==='auto'?'full':'pick');
  const [elapsed,setElapsed]=useState(0);
  const clock=useRef<AnimationClock>({elapsed:0});
  useEffect(()=>{if(autoSkip)setMode('result');},[autoSkip]);
  useEffect(()=>{if(!autoSkip&&r.settings.mode==='auto'&&mode==='pick')setMode('full');},[r.settings.mode,mode,autoSkip]);
  const dialogue=useDialogueFocus(record.year+':'+record.id+':'+index+':'+mode,active&&(mode==='pick'||mode==='result'));
  useAutoAdvance(record.year+':'+record.id+':'+index,mode==='result'&&r.settings.mode==='auto'&&!saving,AUTO_FLOW.ceremonyMs/playbackRate,onNext);
  const standing=result.standings.find(row=>row.id===athlete)!;
  const run=athlete==='player'?result.run:result.opponents?.[athlete]??result.run;
  const avatar=athlete==='player'?result.look??equippedLook(r):RIVAL.get(athlete)?.look??r.look;
  useEffect(()=>{
    if(mode!=='full'||!active)return;
    clock.current.stamp=performance.now();
    const end=RULES.runSeconds+(AUTO_FLOW.entryMs+AUTO_FLOW.exitMs)/1000;
    const timer=window.setInterval(()=>{
      const now=advanceClock(clock.current,performance.now(),playbackRate)/1000;
      setElapsed(Math.min(end,now));
      if(now>=end){window.clearInterval(timer);setMode('result');}
    },85);
    return ()=>{window.clearInterval(timer);advanceClock(clock.current,performance.now(),playbackRate);};
  },[mode,active,playbackRate]);
  const entrySeconds=AUTO_FLOW.entryMs/1000;
  const seconds=Math.max(0,Math.min(RULES.runSeconds,elapsed-entrySeconds));
  const waiting=mode==='full'&&elapsed<entrySeconds;
  const ending=mode==='full'&&elapsed>=entrySeconds+RULES.runSeconds;
  const frame=mode==='full'&&!waiting&&!ending?run.log.find(log=>log.at<=seconds&&seconds<log.end+(log.outcome==='miss'?RULES.recovery:0)):undefined;
  const progress=frame?Math.min(1,(seconds-frame.at)/(frame.end-frame.at)):0;
  const motion:Motion=mode==='result'?(standing.place===1?'win':standing.place<=3?'great':'lose'):waiting?'mount':ending?'brake':mode==='pick'?'rest':'ride';
  const previous=mode==='full'&&!waiting&&!ending?run.log.findLast(log=>log.end<=seconds):undefined;
  const activeFrame=frame??(previous?.outcome!=='miss'?previous:undefined);
  const technique=activeFrame&&mode==='full'&&!ending?{id:activeFrame.id,progress:frame?progress:1,rate:frame?1/(frame.end-frame.at):0,outcome:activeFrame.outcome,...headingsBefore(run.log,activeFrame.at)}:undefined;
  const play=(next:typeof mode)=>{clock.current={elapsed:0};setElapsed(0);setMode(next);};
  const timer=mode==='result'?60:seconds;
  const speedButton=<button className="game-quiet competition-speed" aria-label="대회 2배속" aria-pressed={playbackRate===2} onClick={onSpeed}>2배속</button>;
  const podium=[2,1,3].map(place=>result.standings.find(row=>row.place===place)!);
  const gains=result.statGains;
  let panel:ReactNode;
  if(mode==='result') panel=<>
    <div className="game-caption"><Trophy size={16}/> {DISCIPLINE_NAMES[result.discipline]} 시상식</div><h2>{r.name} · {playerPlace(result)}위</h2>
    <div className="game-podium">{podium.map(row=><div key={row.id} className={'place-'+row.place}><PixelRider look={row.id==='player'?result.look??equippedLook(r):RIVAL.get(row.id)?.look??r.look}/><strong>{row.name}</strong><small>{row.score.toFixed(1)}점</small><b>{row.place}</b></div>)}</div>
    <p className="game-reward">내 점수 {result.run.score.toFixed(1)} · {validRP(result.points)?'획득 +'+formatRP(result.points):'RP 기록 없음'} · 보상 {money(result.prize)}</p>
    {gains&&<p className="game-reward">입상 성장 · {STATS.filter(stat=>gains[stat]).map(stat=>`${STAT_NAMES[stat]} +${gains[stat]}`).join(' · ')}</p>}
    <details className="game-scoreboard"><summary>전체 순위와 채점 보기</summary>
      <ol>{result.standings.map(row=><li key={row.id}><b>{row.place}</b><span>{row.name}</span><strong>{row.score.toFixed(1)}</strong></li>)}</ol>
      <p>{standing.name} · 성공률 {Math.round(run.log.filter(log=>log.outcome!=='miss').length/Math.max(1,run.log.length)*100)}% · 최고 {Math.max(0,...run.log.map(log=>log.combo))}콤보</p>
      <dl className="game-parts">{Object.entries(run.parts).map(([key,value])=><div key={key}><dt>{partNames[key as keyof typeof partNames]}</dt><dd>{value.toFixed(1)}</dd></div>)}</dl>
      <p>내 경기 후 체력 {Math.round(result.energy)} · 명성 +{result.fame}{result.participation?' · 참가 보상 '+money(result.participation):''}{result.sponsorBonus?' · 스폰서 보너스 '+money(result.sponsorBonus):''}</p>
      <details><summary>{standing.name} 기술별 경기 로그</summary><ol>{run.log.map(log=><li key={log.at}><span>{log.at.toFixed(1)}초 · {SKILL[log.id]?.name} · {OUTCOME_NAMES[log.outcome]}{log.linked?' · 연계 성공':''}{log.combo>1?' · '+log.combo+'콤보':''}</span><strong>{log.points}점</strong></li>)}</ol></details>
    </details>
    <div className="game-actions">{speedButton}<button className="game-quiet" onClick={()=>play('full')}>다시 관람</button><button disabled={saving} onClick={onNext}>{index+1<record.results.length?'다음 종목':doneLabel} <ArrowRight size={15}/></button></div>
  </>;
  else if(mode==='pick') panel=<><div className="game-caption">{index+1} / {record.results.length} 종목 · {DIVISION_NAMES[record.division]}</div><h2>{DISCIPLINE_NAMES[result.discipline]} 경기</h2><label className="game-athlete">관람할 선수<select value={athlete} onChange={e=>setAthlete(e.target.value)}><option value="player">{r.name} (나)</option>{result.standings.filter(row=>row.id!=='player'&&result.opponents?.[row.id]).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><div className="game-actions">{speedButton}<button onClick={()=>play('full')}><Play size={15}/> 전체 관람</button><button className="game-quiet" onClick={()=>play('result')}><ListChecks size={15}/> 결과 보기</button></div></>;
  else panel=<><div className="game-caption">{standing.name} · {DISCIPLINE_NAMES[result.discipline]}</div><h2>{frame?SKILL[frame.id]?.name:waiting?'선수 입장':ending?'경기 종료':'기본 주행'}</h2><p>{frame?(progress>.64?OUTCOME_NAMES[frame.outcome]+(frame.combo>1?' · '+frame.combo+'콤보':''):'동작에 들어갑니다.'):waiting?'출발을 준비합니다.':ending?'점수를 집계하고 있습니다.':'다음 동작으로 이어 갑니다.'}</p><div className="game-actions">{speedButton}<button className="game-quiet" onClick={()=>play('result')} aria-label="대회 스킵">스킵 · 결과 보기 <ArrowRight size={15}/></button></div></>;
  return <section className={'spot-stage game-stage has-dialogue competition-stage '+(mode==='result'?'showing-podium':'')} aria-label="인게임 대회">
    <Scene spot={meet.spot} look={avatar} motion={motion} technique={technique} variant="race" playbackRate={active?playbackRate:0}/><div className="scene-shade"/>
    <div className="game-hud"><span>{record.year}년차 · {meet.name}</span><div className="scene-counter"><Timer size={14}/><span>{String(Math.floor(timer)).padStart(2,'0')} / 60초</span></div></div>
    {waiting&&elapsed>=2&&<div className="game-countdown" aria-label={Math.ceil(entrySeconds-elapsed)+'초 뒤 출발'}>{Math.ceil(entrySeconds-elapsed)}</div>}
    <div className={'game-dialogue '+(mode==='full'?'game-commentary':'')} role="region" aria-label={mode==='result'?'대회 시상식':'경기 진행'} ref={dialogue} tabIndex={-1}>{panel}</div>
  </section>;
}

function TrainingOutcome({r,saving,active,onDone}:{r:Rider;saving:boolean;active:boolean;onDone:()=>void}){
  const result=r.extras?.lastTraining;
  const title=result?.special?'특별훈련 성공':result?.grade==='injury'?'연습 중 다쳤다':result?.grade==='miss'?'연습이 뜻대로 풀리지 않았다'
    :r.lastPlan?ACTION_STORIES[r.lastPlan.action].title:'한 주를 마쳤다';
  const narration=result?.narration??result?.text;
  const skippedMeet=result?.special==='meet'?calendarFor(result.year).find(meet=>meet.week===result.week):undefined;
  const dialogue=useDialogueFocus(r.id+':training:'+result?.year+':'+result?.week,active);
  useAutoAdvance(r.id+':'+result?.year+':'+result?.week,r.settings.mode==='auto'&&!saving,AUTO_FLOW.resultMs,onDone);
  return <section className="spot-stage game-stage has-dialogue training-outcome-stage">
    <Scene spot={r.spot} look={equippedLook(r)} motion={result?.grade==='injury'?'fall':result?.grade==='miss'?'lose':result?.grade==='recovery'?'rest':result?.grade==='great'||result?.grade==='learned'?'great':'success'} variant="event"/>
    <div className="scene-shade"/>
    <div className={'game-dialogue'+(result?.special?' training-special-result':'')} role="region" aria-labelledby="training-outcome-title" tabIndex={-1} ref={dialogue}>
      {result&&<div className="game-caption">{formatCareerDate(result)}{result.special&&<SpecialTrainingBadge/>}</div>}
      <h2 id="training-outcome-title">{title}</h2>
      {narration&&<p>{lineTerms(narration)}</p>}
      {!!result?.changes?.length&&<p className="game-reward">{result.changes.join(' · ')}</p>}
      {skippedMeet&&<p>{skippedMeet.name} 불참</p>}
      {result?.reaction&&<p className="equipment-reaction">{result.reaction}</p>}
      <p>체력 {Math.round(r.energy)} · 보유금 {money(r.money)}</p>
      <div className="game-actions"><button disabled={saving} onClick={onDone}>계속 <ArrowRight size={15}/></button></div>
    </div>
  </section>;
}

type EventSceneProps={r:Rider;result:EventOutcome;saving:boolean;active:boolean;onDone:()=>void};

function HappeningScene({r,result,saving,active,onDone}:EventSceneProps){
  const text=result.dialogue??'';
  const person=result.npc?RIVAL.get(result.npc):undefined;
  useAutoAdvance(result.key,active&&!saving,happeningDuration(text),onDone);
  return <section className="spot-stage game-stage has-dialogue" aria-label="짧은 해프닝">
    <Scene spot={r.spot} look={equippedLook(r)} guest={person?.look} motion="rest" variant="event"/>
    <div className="scene-shade"/>
    <aside className="game-dialogue happening-card" aria-live="polite">
      <div className="game-caption">{result.participants?.map(id=>RIVAL.get(id)?.name).filter(Boolean).join(' · ')||'크루'}</div>
      <h2>{result.title}</h2><p>{text}</p>
      <button className="game-quiet" disabled={saving} onClick={onDone}>닫기</button>
    </aside>
  </section>;
}

function EventResult({r,result,saving,active,onDone}:EventSceneProps){
  const dialogue=useDialogueFocus(result.key,active);
  useAutoAdvance(result.key,r.settings.mode==='auto'&&!saving,AUTO_FLOW.resultMs,onDone);
  const person=result.npc==='mentor'?r.mentor:result.npc?RIVAL.get(result.npc):undefined;
  return <section className="spot-stage game-stage has-dialogue" aria-label="인게임 이벤트 결과"><Scene spot={r.spot} look={equippedLook(r)} guest={person?.look} motion="success" variant="event"/><div className="scene-shade"/><div className="game-dialogue" role="region" aria-label="이벤트 결과" ref={dialogue} tabIndex={-1}><div className="game-caption">{formatCareerDate(result)} · {result.kind}{person&&<span className="game-speaker"><PixelRider look={person.look}/>{person.name}</span>}</div><h2>{result.title}</h2><p>{lineTerms(result.choice)}</p>{result.dialogue&&<p>{result.dialogue}</p>}{result.details.length>0&&<p className="game-reward">{result.details.slice(0,3).join(' / ')}</p>}<div className="game-actions"><button disabled={saving} onClick={onDone}>계속 <ArrowRight size={15}/></button></div></div></section>;
}
