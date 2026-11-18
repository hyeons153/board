import { Activity, Aperture, ArrowRight, ArrowUpRight, CalendarDays, CirclePlay, Coffee, Cross, Flag, Footprints, Gauge, HeartPulse, Link2, LockKeyhole, MapPin, MoveDiagonal2, Route, Sparkles, Timer, Wind, Zap } from 'lucide-react';
import { useState } from 'react';
import { ACTION_NAMES, CALENDAR, DISCIPLINE_NAMES, DIVISION_NAMES, INTENSITY_NAMES, LOCATIONS, RULES, SKILL, STAT_NAMES, STRATEGY_NAMES } from '../game/data';
import { divisionFor, currentMeet, nextMeet } from '../game/career';
import { canStudy, eventFor, eventNpc } from '../game/events';
import { RIVAL, SPOT_GATE, spotUnlocked } from '../game/content';
import { ECONOMY, equippedLook, extras } from '../game/economy';
import { SKILLS } from '../game/data';
import { ACTIONS, DISCIPLINES, INTENSITIES, SPOTS, STATS, STRATEGIES, type Action, type Discipline, type GameAction, type Intensity, type Plan, type Rider, type Spot } from '../game/types';
import type { Motion } from '../scene/landscape';
import Scene from './Scene';
import { SectionTitle, Tag } from './Brand';
import { TechniquePreview } from './TechniquePreview';
import { PixelRider } from './Appearance';
import GameStage from './GameStage';
import type { MeetRecord } from '../game/types';

export const money=(n:number)=>'₩'+n.toLocaleString('ko-KR');
export const when=(ms:number)=>{const s=Math.ceil(ms/1000);return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;};
const StatIcon={speed:Wind,carve:Route,link:Link2,balance:MoveDiagonal2};
const ActionIcon={...StatIcon,dance:Footprints,trick:Aperture,rest:Coffee,hospital:Cross,rehearsal:Flag};
const actionDetail={speed:'주행 속도와 페이스 유지',carve:'부드러운 방향 전환',link:'흐름과 콤보 연결',balance:'자세와 착지 안정',dance:'스텝·테크닉 습득',trick:'회전·팝·플립 습득',rest:'체력 회복 및 부상 관리',hospital:'회복 기간 단축 · 치료비 지불',rehearsal:'저장한 루틴의 기술과 연계 연습'};
const actionMotion:Record<Action,Motion>={speed:'accelerate',carve:'carve',link:'spin',balance:'land',dance:'step',trick:'jump',rest:'rest',hospital:'rest',rehearsal:'mount'};
const grades={success:'훈련 성공',great:'높은 훈련 성과',learned:'신규 기술 습득',mastery:'기술 숙련도 상승',miss:'훈련 실패',injury:'부상 발생',recovery:'회복'};
export type Submit=(action:GameAction)=>Promise<boolean>;

export function StatCards({r}:{r:Rider}){
  return <div className="stat-grid">{STATS.map((s,i)=>{
    const Icon=StatIcon[s];
    return <article className="stat-card" key={s}><div className="stat-label"><Icon size={16}/><span>{STAT_NAMES[s]}</span></div><div className="stat-value">{r.stats[s]}<span> / 100</span></div><div className="bar"><span className={`stat-fill stat-${i}`} style={{width:r.stats[s]+'%'}}/></div></article>;
  })}</div>;
}
export function RiderCard({r}:{r:Rider}){
  return <article className="panel status-card"><div className="card-heading"><span><HeartPulse size={17}/> 선수 컨디션</span><Tag kind={r.injury?'orange':'lime'}>{r.injury?r.injury.severity==='major'?'중상':'경상':'양호'}</Tag></div><div className="energy-label"><span>체력</span><b>{Math.round(r.energy)}<small> / 100</small></b></div><div className="bar energy"><span style={{width:r.energy+'%'}}/></div>{r.injury&&<p className="warning">회복까지 {r.injury.weeks}주{r.injury.treated?' · 치료 완료':' · 휴식 / 치료 가능'}</p>}<div className="card-bottom"><span>보유금 <strong>{money(r.money)}</strong></span><span>명성 <strong>{r.fame}</strong></span></div></article>;
}
export function Upcoming({r,onClick}:{r:Rider;onClick:()=>void}){
  const m=nextMeet(r);
  return <article className="panel upcoming"><div className="card-heading"><span><CalendarDays size={17}/> 다음 대회</span><Tag kind={m?.major?'orange':'muted'}>{m?.major?'MAJOR':'CALENDAR'}</Tag></div>
    {m&&r.phase!=='retired'?<><div className="upcoming-date"><b>{String(m.month).padStart(2,'0')}</b><span>월<br/>{m.week}주차</span></div><h3>{m.name}</h3><p>{m.week===r.week?'이번 주 개최':`${m.week-r.week}주 후`} · {DIVISION_NAMES[divisionFor(r.year)]}</p></>:<p>시즌이 종료되었습니다.</p>}
    <button className="text-button" onClick={onClick}>대회 일정 보기 <ArrowUpRight size={15}/></button></article>;
}
export function NewsCard({r}:{r:Rider}){
  return <article className="panel news"><div className="card-heading"><span><Activity size={16}/> 라이더 일지</span></div><ul>{r.news.slice(0,5).map((n,i)=><li key={`${n.year}-${n.week}-${i}`}><span>{n.year}Y / {String(n.week).padStart(2,'0')}W</span>{n.text}</li>)}</ul></article>;
}
export function Training({r,send,saving,remaining,weekMs,fastForward,target,record,onDone}:{r:Rider;send:Submit;saving:boolean;remaining:number;weekMs:number;fastForward:boolean;target?:string;record?:MeetRecord;onDone:()=>void}){
  const skill=SKILL[target??''];
  const [spot,setSpot]=useState<Spot>(r.plan?.spot??r.spot);
  const [action,setAction]=useState<Action>(skill?.family??r.plan?.action??'speed');
  const [intensity,setIntensity]=useState<Intensity>(r.plan?.intensity??r.settings.intensity);
  const [targetSkill,setTarget]=useState(skill?.id??r.plan?.skill??'');
  const [lesson,setLesson]=useState(!!r.plan?.lesson);
  const [discipline,setDiscipline]=useState<Discipline>(r.plan?.discipline??'freestyle');
  const canLesson=!!targetSkill&&['studio','night','arena'].includes(spot);
  const desired:Plan={action,spot,intensity,...(targetSkill?{skill:targetSkill}:{}),
    ...(lesson&&canLesson?{lesson:true}:{}),...(action==='rehearsal'?{discipline}:{})};
  const queued=r.plan&&r.plan.action===action&&r.plan.spot===spot&&r.plan.intensity===intensity&&r.plan.skill===desired.skill&&!!r.plan.lesson===!!desired.lesson&&r.plan.discipline===desired.discipline;
  const auto=r.settings.mode==='auto';
  const viewSpot=auto?r.spot:spot;
  const viewMotion=actionMotion[auto?(r.lastPlan?.action??'speed'):action];
  const canEdit=!record&&!auto&&r.phase==='plan'&&!saving;
  const choose=(a:Action)=>{setAction(a);setTarget('');setLesson(false);};
  const blocked=(a:Action)=>a==='hospital'&&!r.injury||a==='rehearsal'&&spot!=='arena'||r.injury?.severity==='major'&&!r.injury.treated&&a!=='rest'&&a!=='hospital';
  const visitor=viewSpot==='river'&&r.events['mentor-intro']&&r.mentor?r.mentor:RIVAL.get(LOCATIONS[viewSpot].npc);
  const last=extras(r).lastTraining;
  return <>
    <GameStage r={r} send={send} saving={saving} remaining={remaining} weekMs={weekMs} fastForward={fastForward} spot={viewSpot} motion={viewMotion} guest={visitor?.look} record={record} onDone={onDone}/>
    <div className="spot-picker expanded" aria-label="훈련 스팟">{SPOTS.map(s=>{
      const locked=!spotUnlocked(r,s);
      return <button key={s} className={s===viewSpot?'active':''} aria-pressed={s===viewSpot} disabled={!!record||r.phase!=='plan'||auto||locked} title={locked?SPOT_GATE[s]?.hint:LOCATIONS[s].detail}
        onClick={()=>{setSpot(s);if(s!=='arena'&&action==='rehearsal') choose('link');}}>
        <strong>{locked&&<LockKeyhole size={13}/>} {LOCATIONS[s].name}</strong>
        <small>{locked?SPOT_GATE[s]?.hint:LOCATIONS[s].boosted.map(a=>ACTION_NAMES[a]).join(' · ')}</small>
      </button>;
    })}</div>
    <StatCards r={r}/>
    {last&&<TrainingReport key={last.year+'-'+last.week} r={r} last={last} auto={auto}/>}
    {r.phase!=='retired'&&!record&&<section className="panel training-panel">
      <SectionTitle code="WEEKLY TRAINING" title={auto?'자동 육성 설정':'이번 주 훈련'} detail={auto?'설정한 전략으로 주간 행동과 이벤트 선택을 맡길 수 있어요.':'한 가지 행동을 예약하면 주간 타이머가 끝날 때 실행됩니다.'}/>
      <div className="mode-switch" aria-label="육성 모드">
        <button disabled={saving} aria-pressed={!auto} className={!auto?'active':''} onClick={()=>void send({type:'settings',settings:{...r.settings,mode:'manual'}})}>직접 육성</button>
        <button disabled={saving} aria-pressed={auto} className={auto?'active':''} onClick={()=>void send({type:'settings',settings:{...r.settings,mode:'auto'}})}><Zap size={14}/> 자동 육성</button>
      </div>
      {auto?<div className="auto-controls">
        <label>육성 전략<select value={r.settings.strategy} disabled={saving} onChange={e=>void send({type:'settings',settings:{...r.settings,strategy:e.target.value as Rider['settings']['strategy']}})}>{STRATEGIES.map(s=><option key={s} value={s}>{STRATEGY_NAMES[s]}</option>)}</select></label>
        <label>훈련 강도<select value={r.settings.intensity} disabled={saving} onChange={e=>void send({type:'settings',settings:{...r.settings,intensity:e.target.value as Intensity}})}>{INTENSITIES.map(i=><option key={i} value={i}>{INTENSITY_NAMES[i]}</option>)}</select></label>
        <label className="checkbox-line"><input type="checkbox" checked={!!r.settings.pauseStory} disabled={saving}
          onChange={e=>void send({type:'settings',settings:{...r.settings,pauseStory:e.target.checked}})}/> 중요한 라이벌·기술 이벤트에서 일시 정지</label>
        <label className="checkbox-line"><input type="checkbox" checked={!!r.settings.pauseMeet} disabled={saving}
          onChange={e=>void send({type:'settings',settings:{...r.settings,pauseMeet:e.target.checked}})}/> 대회 출전 전에 일시 정지</label>
        <label className="checkbox-line"><input type="checkbox" checked={!!r.settings.pauseInjury} disabled={saving}
          onChange={e=>void send({type:'settings',settings:{...r.settings,pauseInjury:e.target.checked}})}/> 새 부상 발생 시 일시 정지</label>
        <fieldset><legend>자동 출전 종목 · 선택 해제 시 불참</legend><div className="pill-row">{DISCIPLINES.map(d=><button key={d} disabled={saving} aria-pressed={r.settings.entries.includes(d)} className={`pill ${r.settings.entries.includes(d)?'active':''}`} onClick={()=>void send({type:'settings',settings:{...r.settings,entries:toggleEntry(r.settings.entries,d)}})}>{DISCIPLINE_NAMES[d]}</button>)}</div></fieldset>
      </div>:<>
        <div className="action-grid">{ACTIONS.map(a=>{
          const Icon=ActionIcon[a]; const boost=LOCATIONS[spot].boosted.some(x=>x===a);
          return <button key={a} aria-pressed={a===action} disabled={!canEdit||blocked(a)} className={`action-card ${a===action?'active':''}`} onClick={()=>choose(a)}><Icon size={18}/><strong>{ACTION_NAMES[a]}</strong><small>{actionDetail[a]}</small>{boost&&<i title="스팟 훈련 보너스">+</i>}</button>;
        })}</div>
        <div className="training-footer">
          <label>강도<select value={intensity} disabled={!canEdit} onChange={e=>setIntensity(e.target.value as Intensity)}>{INTENSITIES.map(i=><option key={i} disabled={i==='focus'&&!!r.injury&&action!=='rest'&&action!=='hospital'} value={i}>{INTENSITY_NAMES[i]}</option>)}</select></label>
          {(action==='dance'||action==='trick')&&<label>연마 목표<select value={targetSkill} disabled={!canEdit} onChange={e=>{setTarget(e.target.value);setLesson(false);}}>
            <option value="">자유 연마</option>{SKILLS.filter(s=>s.family===action&&canStudy(r,s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>}
          {action==='rehearsal'&&<label>리허설 종목<select value={discipline} disabled={!canEdit} onChange={e=>setDiscipline(e.target.value as Discipline)}>
            {DISCIPLINES.map(d=><option key={d} value={d}>{DISCIPLINE_NAMES[d]}</option>)}</select></label>}
          {canLesson&&<label className="checkbox-line"><input type="checkbox" checked={lesson} disabled={!canEdit}
            onChange={e=>setLesson(e.target.checked)}/> 집중 레슨 {money(ECONOMY.lesson)}</label>}
          <button className="button primary" disabled={!canEdit||!!blocked(action)||!!queued||!!(desired.lesson&&r.money<ECONOMY.lesson)||(!!r.injury&&intensity==='focus'&&action!=='rest'&&action!=='hospital')} onClick={()=>void send({type:'plan',plan:desired})}>{queued?'예약 완료':r.plan?'예약 변경':'훈련 예약'} <ArrowRight size={16}/></button>
        </div>
        {r.plan&&<p className="subtle"><CirclePlay size={14}/> 예약됨 · {ACTION_NAMES[r.plan.action]} / {LOCATIONS[r.plan.spot].name}</p>}
      </>}
    </section>}
  </>;
}
function TrainingReport({r,last,auto}:{r:Rider;last:NonNullable<NonNullable<Rider['extras']>['lastTraining']>;auto:boolean}){
  const [open,setOpen]=useState(false);
  const bad=last.grade==='injury'||last.grade==='miss';
  const good=last.grade==='learned'||last.grade==='great';
  const motion:Motion=bad?'fall':good?'great':last.grade==='recovery'?'rest':actionMotion[r.lastPlan?.action??'speed'];
  return <section className="panel training-report">
    <div className="card-heading"><span><Activity size={17}/> {last.year}년차 {last.week}주 훈련</span>
      <Tag kind={bad?'orange':good?'lime':'muted'}>{grades[last.grade]}</Tag></div>
    <p>{!auto||open ? last.text : ACTION_NAMES[r.lastPlan?.action??'rest']}</p>
    <button className="text-button" aria-expanded={open} onClick={()=>setOpen(!open)}>
      <CirclePlay size={15}/> {open?'훈련 상세 닫기':'훈련 상세 및 재생'}
    </button>
    {open&&(last.skill?<TechniquePreview r={r} id={last.skill} outcome={bad?'miss':good?'great':'clean'}/>:
      <div className="technique-preview"><Scene spot={r.lastPlan?.spot??r.spot} look={equippedLook(r)} motion={motion} variant="preview"/></div>)}
  </section>;
}
export function toggleEntry(list:Discipline[],d:Discipline){
  return list.includes(d)?list.filter(x=>x!==d):[...list,d];
}
export function SeasonStrip({r}:{r:Rider}){
  return <div className="season-strip panel"><Gauge size={18}/><span>시즌 진행</span><b>{String(r.week).padStart(2,'0')} / {RULES.weeks}주</b><div className="strip-ticks">{CALENDAR.map(m=><i key={m.id} title={m.name} className={m.week<=r.week?'done':''}/>)}</div></div>;
}
