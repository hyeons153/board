import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, FastForward, Flag, HeartPulse, ListChecks, MapPin, Play, Timer, Trophy } from 'lucide-react';
import { CALENDAR, DISCIPLINE_NAMES, DIVISION_NAMES, LOCATIONS, OUTCOME_NAMES, RULES, SKILL } from '../game/data';
import { currentMeet, divisionFor } from '../game/career';
import { eventFor, eventNpc } from '../game/events';
import { RIVAL } from '../game/content';
import { equippedLook, gearBonuses, playerPlace } from '../game/economy';
import { DISCIPLINES, type Discipline, type GameAction, type Look, type MeetRecord, type Rider, type Spot } from '../game/types';
import { moveMotion, type Motion } from '../scene/motion';
import Scene from './Scene';
import { PixelRider } from './Appearance';

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

export default function GameStage({r,send,saving,remaining,weekMs,fastForward,spot,motion,guest,record,onDone}:{
  r:Rider;send:Submit;saving:boolean;remaining:number;weekMs:number;fastForward:boolean;spot:Spot;motion:Motion;guest?:Look;record?:MeetRecord;onDone:()=>void;
}){
  const dialogue=useDialogueFocus(r.id+':'+r.phase+':'+r.event,r.phase==='event'||r.phase==='injury');
  if(record) return <Competition key={r.id+':'+record.year+':'+record.id} record={record} r={r} saving={saving} onDone={onDone}/>;
  const event=r.phase==='event'?eventFor(r,r.event??''):undefined;
  const person=event?eventNpc(event,r):undefined;
  const meet=r.phase==='meet'?currentMeet(r):undefined;
  const overlay=!!event||!!meet||r.phase==='injury';
  const viewSpot=meet?.spot??(event?r.spot:spot);
  return <section className={'spot-stage game-stage '+(overlay?'has-dialogue':'')} aria-label="인게임 화면">
    <Scene spot={viewSpot} look={equippedLook(r)} guest={person?.look??guest} motion={overlay?'rest':motion} variant={meet?'race':event?'event':'dashboard'}/>
    <div className="scene-shade"/>
    <div className="game-hud"><span><MapPin size={13}/> {meet?meet.name:LOCATIONS[viewSpot].en}</span><div className="scene-counter"><Timer size={14}/><span>{when(remaining)}</span>
      {r.phase!=='retired'&&<button type="button" className={'fast-forward '+(fastForward?'is-active':'')} aria-label="2배속" aria-pressed={fastForward} title={fastForward?'2배속 끄기':'2배속 켜기'} disabled={saving} onClick={()=>void send({type:'fast-forward',enabled:!fastForward})}>x2</button>}
    </div></div>
    {event?<div className="game-dialogue" role="region" aria-label="이벤트 선택" key={r.event} ref={dialogue} tabIndex={-1}>
      <div className="game-caption">{event.kind}{person&&<span className="game-speaker"><PixelRider look={person.look}/>{person.name}</span>}</div>
      <h2>{event.title}</h2><p>{event.body}</p>
      <div className="game-choices">{event.choices.map((choice,index)=><button key={choice.label} disabled={saving} onClick={()=>void send({type:'event',index})}><span className="choice-number">{index+1}</span>{choice.label}<ArrowRight size={15}/></button>)}</div>
      {r.settings.mode==='auto'&&<small>선택 후 자동 육성이 이어집니다.</small>}
    </div>:meet?<Entry key={r.year+':'+r.week} r={r} send={send} saving={saving}/>:r.phase==='injury'?<div className="game-dialogue" role="region" aria-label="부상 확인" ref={dialogue} tabIndex={-1}><div className="game-caption"><HeartPulse size={16}/> 컨디션 알림</div><h2>잠깐, 몸 상태를 확인해요.</h2><p>새 부상으로 자동 육성을 멈췄어요. 다음 훈련에서 휴식이나 치료를 선택할 수 있습니다.</p><div className="game-actions"><button disabled={saving} onClick={()=>void send({type:'resume'})}>확인하고 재개 <ArrowRight size={15}/></button></div></div>:<div className="spot-title"><span>{r.year}년차 / {r.week}주</span><h2>{LOCATIONS[viewSpot].name}</h2><p>{LOCATIONS[viewSpot].detail}</p>{guest&&<span className="spot-visitor"><PixelRider look={guest}/> 함께 연습 중</span>}</div>}
    <div className="scene-progress"><span style={{width:(1-Math.min(1,remaining/weekMs))*100+'%'}}/></div>
  </section>;
}
function Entry({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  const dialogue=useDialogueFocus(r.id+':'+r.year+':'+r.week);
  const [entries,setEntries]=useState<Discipline[]>(r.entries??r.settings.entries);
  const meet=currentMeet(r)!;
  const locked=r.injury?.severity==='major'&&!r.injury.treated;
  const fatigue=gearBonuses(r).fatigue;
  const cost=entries.reduce((sum,d)=>sum+RULES.entryCost[d]-fatigue,0);
  return <div className="game-dialogue" role="region" aria-label="대회 출전 선택" ref={dialogue} tabIndex={-1}>
    <div className="game-caption"><Flag size={16}/> {r.year}년차 · {DIVISION_NAMES[divisionFor(r.year)]} · {meet.major?'메이저 대회':'정규 대회'}</div><h2>{meet.name}</h2>
    <p>{locked?'중상 치료 전에는 출전할 수 없어요. 이번 대회는 쉬어 가세요.':'어떤 종목에 출전할까요? 선택한 순서대로 경기하며, 체력 소모가 다음 경기에 이어집니다.'}</p>
    <div className="game-disciplines">{DISCIPLINES.map(d=><button key={d} disabled={saving||locked} aria-pressed={entries.includes(d)} onClick={()=>setEntries(list=>list.includes(d)?list.filter(x=>x!==d):[...list,d])}><span>{DISCIPLINE_NAMES[d]}</span><small>체력 −{RULES.entryCost[d]-fatigue}</small>{entries.includes(d)&&<b>{entries.indexOf(d)+1}</b>}</button>)}</div>
    <p className="game-hint">{entries.map(d=>DISCIPLINE_NAMES[d]).join(' → ')||'종목을 선택해 주세요'} · 체력 {Math.round(r.energy)} / 소모 {cost}</p>
    <div className="game-actions"><button className="game-quiet" disabled={saving} onClick={()=>void send({type:'entry',disciplines:[]})}>이번 대회 쉬기</button><button disabled={saving||locked||!entries.length} onClick={()=>void send({type:'entry',disciplines:entries})}>경기장 입장 <ArrowRight size={15}/></button></div>
  </div>;
}
function Competition({record,r,onDone,saving}:{record:MeetRecord;r:Rider;onDone:()=>void;saving:boolean}){
  const [index,setIndex]=useState(0);
  const meet=CALENDAR.find(m=>m.id===record.id)!;
  const result=record.results[index];
  if(!result)return <section className="spot-stage game-stage has-dialogue" aria-label="인게임 대회 결과"><Scene spot={meet.spot} look={equippedLook(r)} motion="rest" variant="race"/><div className="scene-shade"/><div className="game-hud"><span>{meet.name}</span></div><div className="game-dialogue"><div className="game-caption">COMPETITION</div><h2>이번 대회는 쉬어 갑니다.</h2><p>다음 무대를 준비하며 커리어를 이어 가세요.</p><div className="game-actions"><button disabled={saving} onClick={onDone}>육성 계속 <ArrowRight size={15}/></button></div></div></section>;
  return <Playback key={result.discipline} record={record} index={index} r={r} saving={saving} onNext={()=>index+1<record.results.length?setIndex(index+1):onDone()}/>;
}
function Playback({record,index,r,saving,onNext}:{record:MeetRecord;index:number;r:Rider;saving:boolean;onNext:()=>void}){
  const result=record.results[index];
  const meet=CALENDAR.find(m=>m.id===record.id)!;
  const [athlete,setAthlete]=useState('player');
  const [mode,setMode]=useState<'pick'|'full'|'highlights'|'result'>('pick');
  const [elapsed,setElapsed]=useState(0);
  const dialogue=useDialogueFocus(record.year+':'+record.id+':'+index+':'+mode,mode==='pick'||mode==='result');
  const standing=result.standings.find(row=>row.id===athlete)!;
  const run=athlete==='player'?result.run:result.opponents?.[athlete]??result.run;
  const avatar=athlete==='player'?result.look??equippedLook(r):RIVAL.get(athlete)?.look??r.look;
  const notable=run.log.filter(frame=>frame.outcome==='great'||frame.outcome==='miss'||frame.combo>=3||(SKILL[frame.id]?.difficulty??0)>=3);
  const reels=notable.length?notable:run.log.slice(0,4);
  useEffect(()=>{
    if(mode!=='full'&&mode!=='highlights')return;
    const started=performance.now();
    const end=mode==='full'?68:Math.max(2,reels.length*2.4)+1.8;
    const timer=window.setInterval(()=>{
      const now=(performance.now()-started)/1000;
      setElapsed(Math.min(end,now));
      if(now>=end){window.clearInterval(timer);setMode('result');}
    },85);
    return ()=>window.clearInterval(timer);
  },[mode,reels.length]);
  const seconds=Math.max(0,Math.min(60,elapsed-5));
  const waiting=mode==='full'&&elapsed<5;
  const ending=mode==='full'&&elapsed>=65||mode==='highlights'&&elapsed>=reels.length*2.4;
  const frame=mode==='full'&&!waiting&&!ending?run.log.find(log=>log.at<=seconds&&seconds<log.end+(log.outcome==='miss'?RULES.recovery:0)):mode==='highlights'&&!ending?reels[Math.floor(elapsed/2.4)]:undefined;
  const progress=frame?(mode==='highlights'?elapsed%2.4/2.4:Math.min(1,(seconds-frame.at)/(frame.end-frame.at))):0;
  const motion:Motion=mode==='result'?(standing.place===1?'win':standing.place<=3?'great':'lose'):frame?moveMotion(frame.id,progress,frame.outcome):waiting?'mount':ending?'brake':mode==='pick'?'rest':'ride';
  const play=(next:typeof mode)=>{setElapsed(0);setMode(next);};
  const timer=mode==='result'?60:mode==='highlights'?frame?.at??0:seconds;
  const podium=[2,1,3].map(place=>result.standings.find(row=>row.place===place)!);
  let panel:ReactNode;
  if(mode==='result') panel=<>
    <div className="game-caption"><Trophy size={16}/> {DISCIPLINE_NAMES[result.discipline]} 시상식</div><h2>{r.name} · {playerPlace(result)}위</h2>
    <div className="game-podium">{podium.map(row=><div key={row.id} className={'place-'+row.place}><PixelRider look={row.id==='player'?result.look??equippedLook(r):RIVAL.get(row.id)?.look??r.look}/><strong>{row.name}</strong><small>{row.score.toFixed(1)}점</small><b>{row.place}</b></div>)}</div>
    <p className="game-reward">내 점수 {result.run.score.toFixed(1)} · 시즌 +{result.points}점 · 보상 {money(result.prize)}</p>
    <details className="game-scoreboard"><summary>전체 순위와 채점 보기</summary>
      <ol>{result.standings.map(row=><li key={row.id}><b>{row.place}</b><span>{row.name}</span><strong>{row.score.toFixed(1)}</strong></li>)}</ol>
      <p>{standing.name} · 성공률 {Math.round(run.log.filter(log=>log.outcome!=='miss').length/Math.max(1,run.log.length)*100)}% · 최고 {Math.max(0,...run.log.map(log=>log.combo))}콤보</p>
      <dl className="game-parts">{Object.entries(run.parts).map(([key,value])=><div key={key}><dt>{partNames[key as keyof typeof partNames]}</dt><dd>{value.toFixed(1)}</dd></div>)}</dl>
      <p>내 경기 후 체력 {Math.round(result.energy)} · 명성 +{result.fame}{result.participation?' · 참가 보상 '+money(result.participation):''}{result.sponsorBonus?' · 스폰서 보너스 '+money(result.sponsorBonus):''}</p>
      <details><summary>{standing.name} 기술별 경기 로그</summary><ol>{run.log.map(log=><li key={log.at}><span>{log.at.toFixed(1)}초 · {SKILL[log.id]?.name} · {OUTCOME_NAMES[log.outcome]}{log.linked?' · 연계 성공':''}{log.combo>1?' · '+log.combo+'콤보':''}</span><strong>{log.points}점</strong></li>)}</ol></details>
    </details>
    <div className="game-actions"><button className="game-quiet" onClick={()=>play('pick')}>다시 관람</button><button disabled={saving} onClick={onNext}>{index+1<record.results.length?'다음 종목':'육성 계속'} <ArrowRight size={15}/></button></div>
  </>;
  else if(mode==='pick') panel=<><div className="game-caption">{index+1} / {record.results.length} 종목 · {DIVISION_NAMES[record.division]}</div><h2>{DISCIPLINE_NAMES[result.discipline]} 경기</h2><p>선수 입장부터 점수 발표까지 이 경기장에서 이어집니다.</p><label className="game-athlete">관람할 선수<select value={athlete} onChange={e=>setAthlete(e.target.value)}><option value="player">{r.name} (나)</option>{result.standings.filter(row=>row.id!=='player'&&result.opponents?.[row.id]).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><div className="game-actions"><button onClick={()=>play('full')}><Play size={15}/> 전체 관람</button><button className="game-quiet" onClick={()=>play('highlights')}><FastForward size={15}/> 하이라이트</button><button className="game-quiet" onClick={()=>play('result')}><ListChecks size={15}/> 결과 보기</button></div></>;
  else panel=<><div className="game-caption">{standing.name} · {DISCIPLINE_NAMES[result.discipline]}</div><h2>{frame?SKILL[frame.id]?.name:waiting?'선수 입장':ending?'경기 종료':'기본 주행'}</h2><p>{frame?(progress>.64?OUTCOME_NAMES[frame.outcome]+(frame.combo>1?' · '+frame.combo+'콤보':''):'동작에 들어갑니다.'):waiting?'출발을 준비합니다.':ending?'점수를 집계하고 있습니다.':'다음 동작으로 이어 갑니다.'}</p><div className="game-actions"><button className="game-quiet" onClick={()=>play('result')}>점수 발표로 건너뛰기 <ArrowRight size={15}/></button></div></>;
  return <section className={'spot-stage game-stage has-dialogue competition-stage '+(mode==='result'?'showing-podium':'')} aria-label="인게임 대회">
    <Scene spot={meet.spot} look={avatar} motion={motion} variant="race"/><div className="scene-shade"/>
    <div className="game-hud"><span>{record.year}년차 · {meet.name}</span><div className="scene-counter"><Timer size={14}/><span>{String(Math.floor(timer)).padStart(2,'0')} / 60초</span></div></div>
    {waiting&&elapsed>=2&&<div className="game-countdown" aria-label={Math.ceil(5-elapsed)+'초 뒤 출발'}>{Math.ceil(5-elapsed)}</div>}
    <div className={'game-dialogue '+(mode==='full'||mode==='highlights'?'game-commentary':'')} role="region" aria-label={mode==='result'?'대회 시상식':'경기 진행'} ref={dialogue} tabIndex={-1}>{panel}</div>
  </section>;
}
