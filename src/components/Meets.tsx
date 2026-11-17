import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, CirclePlay, FastForward, Flag, ListChecks, Play, Timer, Trophy } from 'lucide-react';
import { CALENDAR, DISCIPLINE_NAMES, DIVISION_NAMES, LOCATIONS, OUTCOME_NAMES, RULES, SKILL } from '../game/data';
import { currentMeet, divisionFor } from '../game/career';
import { DISCIPLINES, type MeetRecord, type Result, type Rider, type Run, type Standing } from '../game/types';
import type { Motion } from '../scene/landscape';
import { moveMotion } from '../scene/motion';
import { RIVAL } from '../game/content';
import { equippedLook, gearBonuses, playerPlace } from '../game/economy';
import { PixelRider } from './Appearance';
import Scene from './Scene';
import { SectionTitle, Tag } from './Brand';
import { money, toggleEntry, type Submit } from './Overview';

const partNames={execution:'기술 수행',link:'연계',combo:'콤보 / 연계',carve:'카빙',speed:'속도'};
export function Meets({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  const [selected,setSelected]=useState<MeetRecord|null>(null);
  const current=currentMeet(r);
  if(selected)return <Race record={selected} r={r} onBack={()=>setSelected(null)}/>;
  return <section className="panel content-panel">
    <SectionTitle code="COMPETITION CALENDAR" title="대회 일정" detail={`${r.year}년차 · ${DIVISION_NAMES[divisionFor(r.year)]} · 1시즌 6개 대회`}/>
    {current&&r.phase!=='retired'&&<Entry key={`${r.year}-${r.week}-${r.phase}`} r={r} send={send} saving={saving}/>}
    <div className="calendar-list">{CALENDAR.map(m=>{
      const record=r.records.find(x=>x.year===r.year&&x.id===m.id);
      return <article key={m.id} className={`calendar-row ${r.week===m.week&&r.phase!=='retired'?'now':''}`}>
        <div className="date-block"><b>{String(m.month).padStart(2,'0')}</b><span>월</span></div><div className="calendar-info"><div>{m.major&&<Tag kind="orange">MAJOR</Tag>}{r.week===m.week&&r.phase!=='retired'&&<Tag kind="lime">이번 주</Tag>}</div><h3>{m.name}</h3><p>{m.week}주차 · {LOCATIONS[m.spot].name}</p></div>
        {record?.results.length?<button className="button secondary small" onClick={()=>setSelected(record)}><CirclePlay size={16}/> 결과 보기</button>:record?<Tag>불참</Tag>:<CalendarDays size={18} className="muted-text"/>}
      </article>;
    })}</div>
    {!!r.records.length&&<details className="past-meets"><summary>전체 대회 기록 ({r.records.length}) <ChevronDown size={17}/></summary><div>{[...r.records].reverse().map(m=><div key={m.year+m.id}><span>{m.year}년차 · {CALENDAR.find(c=>c.id===m.id)?.name}</span>{m.results.length?<button className="text-button" onClick={()=>setSelected(m)}>결과 보기 <ArrowRight size={14}/></button>:<Tag>불참</Tag>}</div>)}</div></details>}
  </section>;
}
function Entry({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  const [entries,setEntries]=useState(r.entries??r.settings.entries);
  const locked=r.injury?.severity==='major'&&!r.injury.treated;
  const needsChoice=r.phase==='meet';
  const fatigue=gearBonuses(r).fatigue;
  const cost=entries.reduce((sum,d)=>sum+RULES.entryCost[d]-fatigue,0);
  return <div className="entry-card">
    <div className="card-heading"><span><Flag size={18}/> {needsChoice?'지금 출전할 종목 선택':'이번 주 출전 신청'}</span><Tag kind="lime">ENTRY</Tag></div>
    <p>{locked?'중상 치료를 마쳐야 출전할 수 있어요.':needsChoice?'선택한 순서로 경기가 열립니다. 앞 경기에서 쓴 체력은 뒤 경기에 영향을 줍니다.':'지금 신청하면 이번 주 훈련과 이벤트가 끝난 뒤 경기가 진행됩니다.'}</p>
    <div className="pill-row">{DISCIPLINES.map(d=><button className={`pill ${entries.includes(d)?'active':''}`} key={d} disabled={locked} aria-pressed={entries.includes(d)} onClick={()=>setEntries(list=>toggleEntry(list,d))}>{DISCIPLINE_NAMES[d]} <small>−{RULES.entryCost[d]-fatigue}</small></button>)}</div>
    <p className="subtle">출전 순서: {entries.map(d=>DISCIPLINE_NAMES[d]).join(' → ')||'불참'} · 체력 소모 {cost}</p>
    <div className="bottom-actions"><button className="button quiet" disabled={saving} onClick={()=>void send({type:'entry',disciplines:[]})}>{needsChoice?'불참하고 다음 주':'불참 예약'}</button><button className="button primary" disabled={saving||locked||!entries.length} onClick={()=>void send({type:'entry',disciplines:entries})}>{needsChoice?'경기 시작':'출전 신청 저장'} <ArrowRight size={16}/></button></div>
  </div>;
}
export function Race({record,r,onBack}:{record:MeetRecord;r:Rider;onBack:()=>void}){
  const [index,setIndex]=useState(0);
  const meet=CALENDAR.find(m=>m.id===record.id)!;
  const result=record.results[index];
  return <section className="panel content-panel">
    <button className="text-button back" onClick={onBack}><ArrowLeft size={16}/> 대회 일정</button>
    <SectionTitle code="COMPETITION REPLAY" title={meet.name} detail={`${record.year}년차 · ${DIVISION_NAMES[record.division]} · ${LOCATIONS[meet.spot].name}`}/>
    <div className="pill-row routine-tabs">{record.results.map((s,i)=><button key={s.discipline} aria-pressed={i===index} className={`pill ${i===index?'active':''}`} onClick={()=>setIndex(i)}>{DISCIPLINE_NAMES[s.discipline]}</button>)}</div>
    {result&&<Playback key={result.discipline} result={result} r={r} spot={meet.spot}/>}
  </section>;
}
const PLAYBACK = { entry:2, count:3, run:60, finish:1.8, highlight:2.4 } as const;

function Playback({result,r,spot}:{result:Result;r:Rider;spot:Rider['spot']}){
  const [athlete,setAthlete]=useState('player');
  const [mode,setMode]=useState<'pick'|'full'|'highlights'|'result'>('pick');
  const [elapsed,setElapsed]=useState(0);
  const standing=result.standings.find(row=>row.id===athlete) ?? result.standings[0];
  const run=result.opponents?.[athlete] ?? result.run;
  const avatar=athlete==='player' ? result.look??equippedLook(r) : RIVAL.get(athlete)?.look??r.look;
  const notable=run.log.filter(frame=>frame.outcome==='great'||frame.outcome==='miss'||frame.combo>=3||(SKILL[frame.id]?.difficulty??0)>=3);
  const reels=notable.length?notable:run.log.slice(0,4);
  const raceStart=PLAYBACK.entry+PLAYBACK.count;
  const raceEnd=raceStart+PLAYBACK.run;
  useEffect(()=>{
    if(mode!=='full'&&mode!=='highlights') return;
    const started=performance.now();
    const end=mode==='full'?raceEnd+PLAYBACK.finish+1.2:Math.max(2,reels.length*PLAYBACK.highlight)+PLAYBACK.finish;
    const timer=window.setInterval(()=>{
      const now=(performance.now()-started)/1000;
      setElapsed(Math.min(end,now));
      if(now>=end){window.clearInterval(timer);setMode('result');}
    },85);
    return ()=>window.clearInterval(timer);
  },[mode,raceEnd,reels.length]);
  const waiting=mode==='full'&&elapsed<raceStart;
  const ending=mode==='full'&&elapsed>=raceEnd||mode==='highlights'&&elapsed>=reels.length*PLAYBACK.highlight;
  const showingScore=mode==='result'||mode==='full'&&elapsed>=raceEnd+PLAYBACK.finish;
  const seconds=Math.max(0,Math.min(PLAYBACK.run,elapsed-raceStart));
  const frame=mode==='full'&&!waiting&&!ending
    ? run.log.find(log=>log.at<=seconds&&seconds<log.end+(log.outcome==='miss'?RULES.recovery:0))
    : mode==='highlights'&&!ending?reels[Math.floor(elapsed/PLAYBACK.highlight)]:undefined;
  const progress=frame?(mode==='highlights'?(elapsed%PLAYBACK.highlight)/PLAYBACK.highlight:Math.min(1,(seconds-frame.at)/(frame.end-frame.at))):0;
  const move=SKILL[frame?.id??''];
  const count=waiting&&elapsed>=PLAYBACK.entry?Math.ceil(raceStart-elapsed):null;
  const motion:Motion=showingScore?(standing.place===1?'win':standing.place<=3?'great':'lose'):
    frame?moveMotion(frame.id,progress,frame.outcome):waiting?'mount':ending?'brake':mode==='pick'?'rest':'ride';
  const reaction=progress>=.64;
  const bigHit=!!frame&&reaction&&(frame.outcome==='great'||(move?.difficulty??0)>=3&&frame.outcome==='clean');
  const play=(target:typeof mode)=>{setElapsed(0);setMode(target);};
  const title=frame&&move?move.name:showingScore?'점수 발표':count?'시작 준비':waiting?'선수 입장':ending?'경기 종료':mode==='pick'?DISCIPLINE_NAMES[result.discipline]:'기본 주행';
  const commentary=showingScore?`${standing.name} · ${run.score.toFixed(1)}점 · ${standing.place}위`:
    frame?(reaction?(frame.outcome==='miss'?'균형을 잃었습니다. 자세를 되찾습니다.':bigHit?'관객석에서 함성이 터집니다!':`${OUTCOME_NAMES[frame.outcome]}${frame.linked?' · 매끄러운 연계':''}`):'동작에 들어갑니다.'):
    waiting?`${standing.name} 선수가 출발선에 섰습니다.`:ending?'마지막 바퀴가 멈췄습니다.':mode==='pick'?'선수와 관람 방식을 선택하세요.':'다음 동작으로 이어 갑니다.';
  const timer=mode==='highlights'?(frame?.at??0):showingScore?60:seconds;
  return <>
    <label className="replay-select">재생할 선수<select value={athlete} onChange={e=>{setAthlete(e.target.value);play('pick');}}>
      <option value="player">{r.name} (나)</option>
      {result.standings.filter(s=>s.id!=='player'&&result.opponents?.[s.id]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
    </select></label>
    <div className={`spot-stage replay-stage ${bigHit?'crowd-cheer':''}`}>
      <Scene spot={spot} look={avatar} variant="race" motion={motion}/><div className="scene-shade"/>
      <div className="spot-title">
        <span><Timer size={14}/> {mode==='highlights'?'하이라이트':standing.name}</span>
        <h2>{title}</h2><p>{commentary}</p>
      </div>
      {count!==null&&<div className="start-count" aria-label={count+'초 뒤 출발'}>{count}</div>}
      <div className="scene-counter"><Timer size={14}/><span>{String(Math.floor(timer)).padStart(2,'0')} / 60초</span></div>
      {frame&&reaction&&<div className="race-combo">
        <Tag kind={frame.outcome==='miss'?'orange':bigHit?'lime':'lilac'}>{OUTCOME_NAMES[frame.outcome]}</Tag>
        {frame.combo>1&&<strong>{frame.combo} 콤보</strong>}
      </div>}
    </div>
    <div className="replay-buttons">
      <button className="button secondary" onClick={()=>play('full')} disabled={mode==='full'}><Play size={16}/> 전체 관람</button>
      <button className="button secondary" onClick={()=>play('highlights')} disabled={mode==='highlights'}><FastForward size={16}/> 하이라이트</button>
      <button className="button primary" onClick={()=>play('result')} disabled={mode==='result'}><ListChecks size={16}/> 즉시 결과</button>
    </div>
    {mode==='result'&&<ReplayResults result={result} run={run} standing={standing} r={r}/>}
  </>;
}
function ReplayResults({result,run,standing,r}:{result:Result;run:Run;standing:Standing;r:Rider}){
  const landed=run.log.filter(frame=>frame.outcome!=='miss').length;
  const success=run.log.length?Math.round(landed/run.log.length*100):0;
  const combo=Math.max(0,...run.log.map(frame=>frame.combo));
  const linked=run.log.filter(frame=>frame.linked).length;
  const place=playerPlace(result);
  return <>
    <section className="podium" aria-label="시상대">
      <h3><Trophy size={19}/> 시상식</h3>
      <div className="podium-riders">{[2,1,3].map(rank=>{
        const row=result.standings.find(item=>item.place===rank);
        if(!row) return null;
        const look=row.id==='player'? result.look??equippedLook(r) : RIVAL.get(row.id)?.look??r.look;
        return <div key={rank} className={`podium-place place-${rank}`}>
          <PixelRider look={look}/><strong>{row.name}</strong><small>{row.score.toFixed(1)}점</small><b>{rank}</b>
        </div>;
      })}</div>
    </section>
    <div className="result-summary"><div><Trophy size={19}/><span>내 순위</span><b>{place}위</b></div><div><Flag size={19}/><span>시즌 포인트</span><b>+{result.points}</b></div><div><ListChecks size={19}/><span>내 대회 보상</span><b>{money(result.prize)}</b></div></div>
    {!!result.participation&&<p className="subtle">참가 보상 {money(result.participation)}{result.sponsorBonus?' · 스폰서 보너스 '+money(result.sponsorBonus):''} 포함</p>}
    <div className="routine-grid">
      <div className="inner-card"><h3>최종 순위</h3><ol className="rank-list">{result.standings.map(s=><li className={s.id==='player'?'you':''} key={s.id}><b>{s.place}</b><span>{s.name}</span><strong>{s.score.toFixed(1)}</strong></li>)}</ol></div>
      <div className="inner-card"><h3>{standing.name} 채점</h3>
        <div className="pill-row"><Tag kind="lime">성공률 {success}%</Tag><Tag>최고 {combo} 콤보</Tag><Tag>연계 {linked}회</Tag></div>
        <dl className="score-parts">{Object.entries(run.parts).map(([key,v])=><div key={key}><dt>{partNames[key as keyof typeof partNames]}</dt><dd>{v.toFixed(1)}</dd></div>)}</dl>
        {standing.id==='player'&&<p className="subtle">경기 후 체력 {Math.round(result.energy)} · 명성 +{result.fame}</p>}
      </div>
    </div>
    <details className="past-meets"><summary>{standing.name} 기술별 경기 로그 <ChevronDown size={17}/></summary>
      <div>{run.log.map(l=><div key={l.at}><span>{l.at.toFixed(1)}초 · {SKILL[l.id]?.name}</span>
        <Tag kind={l.outcome==='miss'?'orange':l.outcome==='great'?'lime':'muted'}>{OUTCOME_NAMES[l.outcome]} · {l.linked===null?'—':l.linked?'연계 성공':'연계 실패'} · {l.points}점</Tag>
      </div>)}</div>
    </details>
  </>;
}
