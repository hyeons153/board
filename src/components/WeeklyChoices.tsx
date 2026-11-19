import { Aperture, ArrowRight, Check, Coffee, Cross, Footprints, Link2, MoveDiagonal2, Route, Wind, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ACTION_NAMES, ACTION_STORIES, DISCIPLINE_NAMES, SKILL, SKILLS, STAT_NAMES, STRATEGY_DETAILS, STRATEGY_NAMES } from '../game/data';
import { validatePlan } from '../game/career';
import { canStudy } from '../game/events';
import { previewTraining } from '../game/training';
import { ACTIONS, DISCIPLINES, STRATEGIES, type Plan, type Rider } from '../game/types';
import type { Submit } from './Overview';
import { AUTO_FLOW, useAutoAdvance } from '../useAutoAdvance';

const icons={speed:Wind,carve:Route,link:Link2,balance:MoveDiagonal2,dance:Footprints,trick:Aperture,rest:Coffee,hospital:Cross};
const choiceLabels={...STAT_NAMES,dance:DISCIPLINE_NAMES.dance,trick:DISCIPLINE_NAMES.trick,rest:ACTION_NAMES.rest,hospital:ACTION_NAMES.hospital};
const signed=(n:number)=>(n>0?'+':'')+n.toFixed(1).replace('.0','');
const range=(min:number,max:number)=>min===max?signed(min):signed(min)+' ~ '+signed(max);

export function WeeklyChoices({r,send,saving,onPreview,pendingChoice,active=true,hidden=false}:{r:Rider;send:Submit;saving:boolean;onPreview?:(plan:Plan|undefined)=>void;pendingChoice?:string;active?:boolean;hidden?:boolean}){
  const [action,setAction]=useState<typeof ACTIONS[number]>();
  const spot=r.spot;
  const [skill,setSkill]=useState(''),[lesson,setLesson]=useState(false);
  useEffect(()=>setLesson(false),[spot]);
  const choose=(next:typeof ACTIONS[number])=>{setAction(current=>current===next?undefined:next);setSkill('');setLesson(false);};
  const plan=useMemo<Plan|undefined>(()=>action?{action,spot,...(skill?{skill}:{}),...(lesson?{lesson:true}:{})}:undefined,[action,spot,skill,lesson]);
  const preview=plan?previewTraining(r,plan):undefined;
  const recoveryNote=preview?.recovery
    ? action==='hospital'?'치료로 회복 기간 최대 2주 단축':r.injury?'쉬면서 몸을 회복해요.':''
    : '';
  let blocked='';if(plan)try{validatePlan(r,plan);}catch(error){blocked=error instanceof Error?error.message:'이 행동을 선택할 수 없어요.';}
  const auto=r.settings.mode==='auto';
  useEffect(()=>{onPreview?.(auto&&pendingChoice?r.plan??undefined:!blocked&&!auto?plan:undefined);},[plan,blocked,auto,pendingChoice,r.plan,onPreview]);
  useAutoAdvance(pendingChoice??'',active&&auto&&!!pendingChoice&&!saving,AUTO_FLOW.choiceMs,()=>void send({type:'start-training',record:pendingChoice!}));
  useEffect(()=>()=>onPreview?.(undefined),[onPreview]);
  return <section className={'weekly-choices '+(auto?'is-auto ':'')+(action||pendingChoice?'has-preview':'')} aria-label={auto?'자동 행동 선택':'이번 주 행동 선택'} hidden={hidden}>
    <h2>이번 주엔 무엇을 할까?</h2>
    <div className="weekly-action-grid">{ACTIONS.map(next=>{
      const Icon=icons[next];
      return <button key={next} aria-label={ACTION_NAMES[next]+' 선택'} aria-pressed={(auto?r.plan?.action:action)===next} disabled={saving||auto} onClick={()=>choose(next)}><Icon size={16} aria-hidden="true"/><strong>{choiceLabels[next]}</strong></button>;
    })}</div>
    <div className="weekly-selection-slot">
    {auto?<div className="weekly-auto"><strong>{r.plan?ACTION_STORIES[r.plan.action].start:'이번 주 일정을 고르는 중…'}</strong><button onClick={()=>void send({type:'settings',settings:{...r.settings,mode:'manual'}})} disabled={saving}>직접 고르기</button></div>:<>
        {(action==='dance'||action==='trick')&&<div className="weekly-inline-controls" aria-label="행동 설정">
          <label>연마 목표<select aria-label="연마 목표" value={skill} disabled={saving} onChange={e=>{setSkill(e.target.value);setLesson(false);}}><option value="">자유 연마</option>{SKILLS.filter(s=>s.family===action&&canStudy(r,s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          {!!skill&&['studio','night','arena'].includes(spot)&&<label className="weekly-lesson"><input type="checkbox" checked={lesson} disabled={saving} onChange={e=>setLesson(e.target.checked)}/> 개인 레슨</label>}
        </div>}
        <footer className="weekly-confirm" aria-label="선택한 행동 확인">
          {plan&&<button className="weekly-cancel" aria-label="선택 취소" disabled={saving} onClick={()=>setAction(undefined)}><X size={15}/></button>}
          <div className="weekly-summary">
            {plan&&preview?<><strong>{ACTION_STORIES[plan.action].start}</strong>
              {!preview.recovery&&<span className={'weekly-success '+(preview.success<.7?'is-risky':'')}>성공률 <b>{Math.round(preview.success*100)}%</b>{preview.success<.7&&<small>체력 부족 · 실패 위험 높음</small>}</span>}
            </>:<span>행동을 고르면 예상 변화가 표시돼요.</span>}
          </div>
          <button className="weekly-execute" disabled={!plan||saving||!!blocked} onClick={()=>{if(plan)void send({type:'plan',plan});}}>확인 <Check size={16}/></button>
        </footer>
        {blocked?<p className="weekly-blocked" role="status">{blocked}</p>:(recoveryNote||preview?.skill)&&<p className="weekly-selection-note" role="status">
          {preview?.skill&&<span>{SKILL[preview.skill.id]?.name} {preview.skill.label} {range(preview.skill.min,preview.skill.max)}%</span>}
          {recoveryNote}
        </p>}
    </>}
    </div>
  </section>;
}

export function AutoSettings({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  return <section className="panel auto-settings"><h2>자동 육성 설정</h2>
    <label>전략<select value={r.settings.strategy} aria-describedby="auto-strategy-description" disabled={saving} onChange={e=>void send({type:'settings',settings:{...r.settings,strategy:e.target.value as Rider['settings']['strategy'],entries:r.settings.entries.slice(0,1)}})}>{STRATEGIES.map(id=><option key={id} value={id}>{STRATEGY_NAMES[id]}</option>)}</select></label>
    <p id="auto-strategy-description" aria-label="자동 육성 전략 설명">{STRATEGY_DETAILS[r.settings.strategy]} 전략은 훈련·이벤트 선택에 적용되며 출전 종목은 아래에서 별도로 정합니다.</p>
    <fieldset><legend>자동 출전 종목 · 1개 선택</legend>{DISCIPLINES.map(id=><label key={id}><input type="radio" name={'auto-entry-'+r.id} checked={r.settings.entries[0]===id} disabled={saving} onChange={()=>void send({type:'settings',settings:{...r.settings,entries:[id]}})}/>{DISCIPLINE_NAMES[id]}</label>)}<label><input type="radio" name={'auto-entry-'+r.id} checked={!r.settings.entries.length} disabled={saving} onChange={()=>void send({type:'settings',settings:{...r.settings,entries:[]}})}/>일반 대회 불참</label></fieldset>
    <p>일반 대회에 적용합니다. 2·4·6·8년차 국제대회는 설정과 관계없이 3종목 모두 출전합니다.</p>
    <fieldset className="auto-presentation-options"><legend>이벤트와 경기</legend>
      <label><input type="checkbox" checked={!!r.settings.manualEvents} disabled={saving} onChange={e=>void send({type:'settings',settings:{...r.settings,manualEvents:e.target.checked}})}/>이벤트 선택지 직접 고르기</label>
      <label><input type="checkbox" checked={!!r.settings.skipMeets} disabled={saving} onChange={e=>void send({type:'settings',settings:{...r.settings,skipMeets:e.target.checked}})}/>대회 진행 건너뛰고 결과 보기</label>
    </fieldset>
    <button className="button primary" disabled={saving} onClick={()=>void send({type:'settings',settings:{...r.settings,entries:r.settings.entries.slice(0,1),mode:r.settings.mode==='auto'?'manual':'auto',pauseStory:false,pauseMeet:false,pauseInjury:false}})}>{r.settings.mode==='auto'?'자동 육성 끄기':'자동 육성 시작'} <ArrowRight size={16}/></button>
  </section>;
}
