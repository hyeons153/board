import { Aperture, Check, Coffee, Cross, Footprints, Link2, MoveDiagonal2, Route, Wind, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ACTION_NAMES, ACTION_STORIES, DISCIPLINE_NAMES, SKILL, SKILLS, STAT_NAMES, STRATEGY_DETAILS, STRATEGY_NAMES } from '../game/data';
import { validatePlan } from '../game/career';
import { skipsEventChoices } from '../game/events';
import { jointEffectLabel, jointTrainingLabel, jointTrainingOffer, type JointTraining } from '../game/jointTraining';
import { canStudy } from '../game/skillTree';
import { isTrainingAction, meetTrainingAvailable, previewTraining, randomSpecialTraining } from '../game/training';
import { ACTIONS, DISCIPLINES, STRATEGIES, type Plan, type Rider } from '../game/types';
import type { Submit } from './Overview';
import { AUTO_FLOW, useAutoAdvance } from '../useAutoAdvance';

const icons={speed:Wind,carve:Route,link:Link2,balance:MoveDiagonal2,dance:Footprints,trick:Aperture,rest:Coffee,hospital:Cross};
const choiceLabels={...STAT_NAMES,dance:DISCIPLINE_NAMES.dance,trick:DISCIPLINE_NAMES.trick,rest:ACTION_NAMES.rest,hospital:ACTION_NAMES.hospital};
const signed=(n:number)=>(n>0?'+':'')+n.toFixed(1).replace('.0','');
const range=(min:number,max:number)=>min===max?signed(min):signed(min)+' ~ '+signed(max);

export function WeeklyChoices({r,send,saving,onPreview,pendingChoice,active=true,hidden=false}:{r:Rider;send:Submit;saving:boolean;onPreview?:(plan:Plan|undefined)=>void;pendingChoice?:string;active?:boolean;hidden?:boolean}){
  const [action,setAction]=useState<typeof ACTIONS[number]>();
  const spot=r.plan?.spot??r.spot;
  const [skill,setSkill]=useState('');
  const [skipMeet,setSkipMeet]=useState(false);
  const auto=r.settings.mode==='auto';
  const meetChoice=!auto&&meetTrainingAvailable(r);
  const meetTraining=auto?!!r.plan?.meetTraining:meetChoice&&skipMeet;
  const offer=meetTraining?undefined:randomSpecialTraining(r);
  const joint=jointTrainingOffer(r,spot);
  const choose=(next:typeof ACTIONS[number])=>{setAction(current=>current===next?undefined:next);setSkill('');};
  const plan=useMemo<Plan|undefined>(()=>action?{action,spot,...(skill?{skill}:{}),...(meetTraining?{meetTraining:true}:{})}:undefined,[action,spot,skill,meetTraining]);
  const selected=auto?r.plan:plan;
  const preview=selected?previewTraining(r,selected):undefined;
  const recoveryNote=preview?.recovery
    ? action==='hospital'?'치료로 회복 기간 최대 2주 단축':r.injury?'쉬면서 몸을 회복해요.':''
    : '';
  let blocked='';if(plan)try{validatePlan(r,plan);}catch(error){blocked=error instanceof Error?error.message:'이 행동을 선택할 수 없어요.';}
  useEffect(()=>{onPreview?.(auto&&pendingChoice?r.plan??undefined:!blocked&&!auto?plan:undefined);},[plan,blocked,auto,pendingChoice,r.plan,onPreview]);
  useAutoAdvance(pendingChoice??'',active&&auto&&!!pendingChoice&&!saving,AUTO_FLOW.choiceMs,()=>void send({type:'start-training',record:pendingChoice!}));
  useEffect(()=>()=>onPreview?.(undefined),[onPreview]);
  return <section className={'weekly-choices '+(auto?'is-auto ':'')+(action||pendingChoice?'has-preview':'')} aria-label={auto?'자동 행동 선택':'이번 주 행동 선택'} hidden={hidden}>
    <h2>이번 주엔 무엇을 할까?</h2>
    {meetChoice&&<div className="weekly-meet-choice" role="group" aria-label="대회 주간 행동">
      <button type="button" disabled={saving} aria-pressed={!skipMeet} onClick={()=>setSkipMeet(false)}>대회 준비</button>
      <button type="button" disabled={saving} aria-pressed={skipMeet} onClick={()=>setSkipMeet(true)}>불참하고 특별훈련</button>
    </div>}
    <div className="weekly-action-grid">{ACTIONS.map(next=>{
      const Icon=icons[next],special=meetTraining&&isTrainingAction(next)||offer===next;
      const partner=joint?.action===next?joint:undefined;
      const label=partner?jointTrainingLabel({...partner,focus:!special&&partner.focus}):undefined;
      const effect=partner?(special?'친밀도 상승':jointBonus(partner)):undefined;
      return <button key={next} className={special?'weekly-special-card':partner?.focus?'weekly-focus-card':partner?'weekly-joint-card':undefined} aria-label={ACTION_NAMES[next]+' 선택'} aria-description={[special?'특별훈련, 성장량 두 배':undefined,label,effect].filter(Boolean).join(' · ')||undefined} aria-pressed={selected?.action===next} disabled={saving||auto} onClick={()=>choose(next)}>
        <Icon size={16} aria-hidden="true"/><span className="weekly-action-copy"><span className="weekly-action-title"><strong>{choiceLabels[next]}</strong>{special&&<SpecialTrainingBadge/>}</span>{partner&&<small className="weekly-joint-label">{label}{!special&&` +${Math.round((partner.growth-1)*100)}%`}</small>}</span>
      </button>;
    })}</div>
    <div className="weekly-selection-slot">
    {auto?<div className="weekly-auto"><strong>{r.plan?ACTION_STORIES[r.plan.action].start:'이번 주 일정을 고르는 중…'}</strong>{preview?.special&&<SpecialTrainingForecast/>}{preview?.joint&&<span className="weekly-joint-label">{preview.special?'함께 훈련하면 친밀도 상승':jointBonus(preview.joint)}</span>}</div>:<>
        {(action==='dance'||action==='trick')&&<div className="weekly-inline-controls" aria-label="행동 설정">
          <label>연마 목표<select aria-label="연마 목표" value={skill} disabled={saving} onChange={e=>setSkill(e.target.value)}><option value="">자유 연마</option>{SKILLS.filter(s=>s.family===action&&canStudy(r,s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        </div>}
        <footer className="weekly-confirm" aria-label="선택한 행동 확인">
          {plan&&<button className="weekly-cancel" aria-label="선택 취소" disabled={saving} onClick={()=>setAction(undefined)}><X size={15}/></button>}
          <div className="weekly-summary">
            {plan&&preview?<><strong>{ACTION_STORIES[plan.action].start}</strong>
              {preview.special?<SpecialTrainingForecast/>:!preview.recovery&&<span className={'weekly-success '+(preview.success<.7?'is-risky':'')}>성공률 <b>{Math.round(preview.success*100)}%</b>{r.energy<40&&<small>실패 위험 · 성공 시 성장 보너스</small>}</span>}
            </>:<span>행동을 고르면 예상 변화가 표시돼요.</span>}
          </div>
          <button className="weekly-execute" disabled={!plan||saving||!!blocked} onClick={()=>{if(plan)void send({type:'plan',plan});}}>확인 <Check size={16}/></button>
        </footer>
        {blocked?<p className="weekly-blocked" role="status">{blocked}</p>:(recoveryNote||preview?.skill||preview?.joint)&&<p className="weekly-selection-note" role="status">
          {preview?.skill&&<span>{SKILL[preview.skill.id]?.name} {preview.skill.label} {range(preview.skill.min,preview.skill.max)}%</span>}
          {preview?.joint&&<span>{preview.special?'함께 훈련하면 친밀도 상승':jointBonus(preview.joint)}</span>}
          {recoveryNote}
        </p>}
    </>}
    </div>
  </section>;
}

export function SpecialTrainingBadge(){return <span className="weekly-special-badge">SPECIAL ×2</span>;}
function SpecialTrainingForecast(){return <span className="weekly-special-forecast">성공률 100% · 체력 소모 0 · 성장 ×2</span>;}
const jointBonus=(joint:JointTraining)=>`성장 +${Math.round((joint.growth-1)*100)}% · ${jointEffectLabel(joint)}${joint.promised?' · 약속한 연습':''}`;

export function AutoSettings({r,send,saving,onApplied}:{r:Rider;send:Submit;saving:boolean;onApplied:()=>void}){
  const [draft,setDraft]=useState(()=>({
    strategy:r.settings.strategy,entries:r.settings.entries.slice(0,1),
    skipEvents:skipsEventChoices(r.settings),skipMeets:!!r.settings.skipMeets,watchMajor:!!r.settings.watchMajor,
  }));
  return <form className="panel auto-settings" onSubmit={async event=>{
    event.preventDefault();
    if(!saving&&await send({type:'settings',settings:{...r.settings,...draft}}))onApplied();
  }}><h2>자동 육성 설정</h2>
    <label>전략<select value={draft.strategy} aria-describedby="auto-strategy-description" disabled={saving} onChange={e=>setDraft({...draft,strategy:e.target.value as Rider['settings']['strategy']})}>{STRATEGIES.map(id=><option key={id} value={id}>{STRATEGY_NAMES[id]}</option>)}</select></label>
    <p id="auto-strategy-description" aria-label="자동 육성 전략 설명">{STRATEGY_DETAILS[draft.strategy]} 전략은 훈련·이벤트 선택에 적용되며 출전 종목은 아래에서 별도로 정합니다.</p>
    <fieldset><legend>자동 출전 종목 · 1개 선택</legend>{DISCIPLINES.map(id=><label key={id}><input type="radio" name={'auto-entry-'+r.id} checked={draft.entries[0]===id} disabled={saving} onChange={()=>setDraft({...draft,entries:[id]})}/>{DISCIPLINE_NAMES[id]}</label>)}<label><input type="radio" name={'auto-entry-'+r.id} checked={!draft.entries.length} disabled={saving} onChange={()=>setDraft({...draft,entries:[]})}/>일반 대회 불참</label></fieldset>
    <p>일반 대회에 적용합니다. 2·4·6·8년차 국제대회는 설정과 관계없이 3종목 모두 출전합니다.</p>
    <fieldset className="auto-presentation-options"><legend>이벤트와 경기</legend>
      <label><input type="checkbox" checked={draft.skipEvents} disabled={saving} onChange={e=>setDraft({...draft,skipEvents:e.target.checked})}/>이벤트 선택지 스킵하기</label>
      <label><input type="checkbox" checked={draft.skipMeets} disabled={saving} onChange={e=>setDraft({...draft,skipMeets:e.target.checked})}/>대회 진행 스킵하기</label>
      {draft.skipMeets&&<label><input type="checkbox" checked={draft.watchMajor} disabled={saving} onChange={e=>setDraft({...draft,watchMajor:e.target.checked})}/>국제대회와 마스터부 시즌 결승 관람하기</label>}
      <p>관계를 바꾸거나 특별한 기술을 배우는 순간에는 직접 고를 수 있어요.</p>
    </fieldset>
    <button type="submit" className="button primary" disabled={saving}>설정 적용 <Check size={16}/></button>
  </form>;
}
