import { Aperture, ArrowRight, Check, Coffee, Cross, Flag, Footprints, Link2, MoveDiagonal2, Route, Settings, Wind, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ACTION_NAMES, DISCIPLINE_NAMES, INTENSITY_NAMES, LOCATIONS, RULES, SKILL, SKILLS, STAT_NAMES, STRATEGY_NAMES } from '../game/data';
import { validatePlan } from '../game/career';
import { spotUnlocked } from '../game/content';
import { canStudy } from '../game/events';
import { previewTraining, type TrainingPreview } from '../game/training';
import { ACTIONS, DISCIPLINES, INTENSITIES, SPOTS, STATS, STRATEGIES, type Action, type Discipline, type Intensity, type Plan, type Rider } from '../game/types';
import type { Submit } from './Overview';

const icons={speed:Wind,carve:Route,link:Link2,balance:MoveDiagonal2,dance:Footprints,trick:Aperture,rest:Coffee,hospital:Cross,rehearsal:Flag};
const details={speed:'속도·연계',carve:'카빙·연계',link:'연계·밸런스',balance:'밸런스·연계',dance:'기술 학습·카빙',trick:'기술 학습·밸런스',rest:'체력 회복',hospital:'부상 치료·체력 회복',rehearsal:'라인 숙련·연계'};
const signed=(n:number)=>(n>0?'+':'')+n.toFixed(1).replace('.0','');
const range=(min:number,max:number)=>min===max?signed(min):signed(min)+' ~ '+signed(max);

export function StatusGauges({r,preview}:{r:Rider;preview?:TrainingPreview}){
  return <div className="console-stats" aria-label="현재 능력치">{STATS.map(stat=>{
    const gain=preview?.gains[stat],rising=!!gain&&gain.max>0;
    return <div key={stat} className={'status-gauge stat-'+stat+(rising?' has-projection':'')}>
      <span>{STAT_NAMES[stat]}</span><b>{r.stats[stat].toFixed(1)}</b>
      <div className="status-track"><meter min={0} max={100} value={r.stats[stat]} aria-label={STAT_NAMES[stat]}/>
        {rising&&<span className="status-projection" style={{left:r.stats[stat]+'%',width:gain.max+'%'}} aria-hidden="true"><i style={{width:gain.min/gain.max*100+'%'}}/></span>}
      </div>
      {rising&&<strong className="status-delta" aria-label={STAT_NAMES[stat]+' 예상 상승'}>{range(gain.min,gain.max)}</strong>}
    </div>;
  })}</div>;
}

export function IntensityHint({intensity}:{intensity:Intensity}){
  const rule=RULES.intensity[intensity];
  return <small className="intensity-hint" role="note">성장 {Math.round(rule.gain*100)}% · 체력 소모 {Math.round(rule.cost*100)}% · 부상 위험 {Math.round(rule.risk*100)}% <span>(균형형 대비{intensity==='focus'?' · 훈련 성공률도 감소':''})</span></small>;
}

export function WeeklyChoices({r,send,saving,target,onSettings,onPreview}:{r:Rider;send:Submit;saving:boolean;target?:string;onSettings:()=>void;onPreview?:(plan:Plan|undefined)=>void}){
  const initial=SKILL[target??''];
  const [action,setAction]=useState<Action|undefined>(initial?.family);
  const [spot,setSpot]=useState(r.spot),[intensity,setIntensity]=useState<Intensity>(r.settings.intensity);
  const [skill,setSkill]=useState(target??''),[lesson,setLesson]=useState(false),[discipline,setDiscipline]=useState<Discipline>('freestyle');
  const choose=(next:Action)=>{setAction(current=>current===next?undefined:next);setSkill('');setLesson(false);if(next==='rehearsal')setSpot('arena');else if(next==='rest'||next==='hospital')setSpot(r.spot);};
  const plan=useMemo<Plan|undefined>(()=>action?{action,spot,intensity,...(skill?{skill}:{}),...(lesson?{lesson:true}:{}),...(action==='rehearsal'?{discipline}:{})}:undefined,[action,spot,intensity,skill,lesson,discipline]);
  const preview=plan?previewTraining(r,plan):undefined;
  let blocked='';if(plan)try{validatePlan(r,plan);}catch(error){blocked=error instanceof Error?error.message:'이 행동을 선택할 수 없어요.';}
  const auto=r.settings.mode==='auto';
  useEffect(()=>{onPreview?.(!blocked&&!auto?plan:undefined);},[plan,blocked,auto,onPreview]);
  useEffect(()=>()=>onPreview?.(undefined),[onPreview]);
  return <section className={'weekly-choices '+(action?'has-preview':'')} aria-label="이번 주 행동 선택">
    <header><div><span>{r.year}년차 · {r.week}주</span><h2>이번 주에는 무엇을 할까요?</h2></div><button className="weekly-settings" aria-label="자동 육성 설정" onClick={onSettings}><Settings size={17}/></button></header>
    {auto?<div className="weekly-auto"><p>전략에 따라 행동·이벤트·대회를 자동으로 선택합니다.</p><button onClick={()=>void send({type:'settings',settings:{...r.settings,mode:'manual'}})} disabled={saving}>직접 선택으로 전환</button></div>:<>
      <div className="weekly-action-grid">{ACTIONS.map(next=>{
        const Icon=icons[next],unavailable=next==='hospital'&&!r.injury||next==='rehearsal'&&!spotUnlocked(r,'arena');
        return <button key={next} aria-label={ACTION_NAMES[next]+' 선택'} aria-pressed={action===next} disabled={saving} onClick={()=>choose(next)}><Icon size={20}/><strong>{ACTION_NAMES[next]}</strong><small>{unavailable?next==='hospital'?'현재 부상 없음':'대회 연습장 해금 필요':details[next]}</small></button>;
      })}</div>
      {plan&&preview?<>
        <div className="weekly-inline-controls" aria-label="행동 설정">
          {!preview.recovery&&<><label>스팟<select aria-label="훈련 스팟" value={spot} disabled={saving} onChange={e=>{setSpot(e.target.value as typeof spot);setLesson(false);}}>{SPOTS.map(id=><option key={id} value={id} disabled={!spotUnlocked(r,id)}>{LOCATIONS[id].name}{!spotUnlocked(r,id)?' · 잠김':''}</option>)}</select></label><label>강도<select aria-label="훈련 강도" value={intensity} disabled={saving} onChange={e=>setIntensity(e.target.value as Intensity)}>{INTENSITIES.map(id=><option key={id} value={id}>{INTENSITY_NAMES[id]}</option>)}</select></label></>}
          {(action==='dance'||action==='trick')&&<label>연마 목표<select aria-label="연마 목표" value={skill} disabled={saving} onChange={e=>{setSkill(e.target.value);setLesson(false);}}><option value="">자유 연마</option>{SKILLS.filter(s=>s.family===action&&canStudy(r,s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
          {action==='rehearsal'&&<label>종목<select aria-label="리허설 종목" value={discipline} disabled={saving} onChange={e=>setDiscipline(e.target.value as Discipline)}>{DISCIPLINES.map(id=><option key={id} value={id}>{DISCIPLINE_NAMES[id]}</option>)}</select></label>}
          {!!skill&&['studio','night','arena'].includes(spot)&&<label className="weekly-lesson"><input type="checkbox" checked={lesson} disabled={saving} onChange={e=>setLesson(e.target.checked)}/> 집중 레슨</label>}
          {!preview.recovery&&<IntensityHint intensity={intensity}/>}
        </div>
        {blocked?<p className="weekly-blocked" role="status">{blocked}</p>:<p className="weekly-selection-note" role="status">
          {preview.skill&&<span>{SKILL[preview.skill.id]?.name} {preview.skill.label} {range(preview.skill.min,preview.skill.max)}% · </span>}
          {preview.recovery?(action==='rest'?'부상 회복 1주 진행':'치료로 회복 2주 단축 · 이번 주 회복 추가'):'상단 증가량은 성공 시 예상치 · 실패해도 체력 소모 · 부상 가능'}
        </p>}
        <footer className="weekly-confirm" aria-label="선택한 행동 확인">
          <button className="weekly-cancel" aria-label="선택 취소" disabled={saving} onClick={()=>setAction(undefined)}><X size={15}/></button>
          <strong>{ACTION_NAMES[plan.action]}</strong>
          {!preview.recovery&&<span className={'weekly-success '+(preview.success<.7?'is-risky':'')}>성공률 <b>{Math.round(preview.success*100)}%</b>{preview.success<.7&&<small>체력 부족 · 실패 위험 높음</small>}</span>}
          <button className="weekly-execute" disabled={saving||!!blocked} onClick={()=>void send({type:'plan',plan})}>확인하고 수행 <Check size={16}/></button>
        </footer>
      </>:<p className="weekly-hint">행동을 고르면 상단 체력·능력치 게이지에서 예상 변화를 볼 수 있어요.</p>}
    </>}
  </section>;
}

export function AutoSettings({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  return <section className="panel auto-settings"><h2>자동 육성 설정</h2><p>행동·이벤트·대회·결과 확인까지 자동으로 이어집니다. 주간 행동은 약 4초간 수행합니다.</p>
    <label>전략<select value={r.settings.strategy} disabled={saving} onChange={e=>void send({type:'settings',settings:{...r.settings,strategy:e.target.value as Rider['settings']['strategy']}})}>{STRATEGIES.map(id=><option key={id} value={id}>{STRATEGY_NAMES[id]}</option>)}</select></label>
    <label>훈련 강도<select value={r.settings.intensity} disabled={saving} onChange={e=>void send({type:'settings',settings:{...r.settings,intensity:e.target.value as Intensity}})}>{INTENSITIES.map(id=><option key={id} value={id}>{INTENSITY_NAMES[id]}</option>)}</select></label>
    <IntensityHint intensity={r.settings.intensity}/>
    <fieldset><legend>자동 출전 종목</legend>{DISCIPLINES.map(id=><label key={id}><input type="checkbox" checked={r.settings.entries.includes(id)} disabled={saving} onChange={()=>void send({type:'settings',settings:{...r.settings,entries:r.settings.entries.includes(id)?r.settings.entries.filter(d=>d!==id):[...r.settings.entries,id]}})}/>{DISCIPLINE_NAMES[id]}</label>)}</fieldset>
    <button className="button primary" disabled={saving} onClick={()=>void send({type:'settings',settings:{...r.settings,mode:r.settings.mode==='auto'?'manual':'auto',pauseStory:false,pauseMeet:false,pauseInjury:false}})}>{r.settings.mode==='auto'?'자동 육성 끄기':'자동 육성 시작'} <ArrowRight size={16}/></button>
  </section>;
}
