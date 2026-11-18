import { Aperture, ArrowRight, Check, Coffee, Cross, Flag, Footprints, Link2, MoveDiagonal2, Route, Wind, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ACTION_NAMES, DISCIPLINE_NAMES, RULES, SKILL, SKILLS, STAT_NAMES, STRATEGY_NAMES } from '../game/data';
import { validatePlan } from '../game/career';
import { spotUnlocked } from '../game/content';
import { canStudy } from '../game/events';
import { previewTraining, type TrainingPreview } from '../game/training';
import { ACTIONS, DISCIPLINES, STATS, STRATEGIES, type Action, type Discipline, type Plan, type Rider } from '../game/types';
import type { Submit } from './Overview';
import { AUTO_FLOW, useAutoAdvance } from '../useAutoAdvance';

const icons={speed:Wind,carve:Route,link:Link2,balance:MoveDiagonal2,dance:Footprints,trick:Aperture,rest:Coffee,hospital:Cross,rehearsal:Flag};
const details={speed:'속도·연계',carve:'카빙·연계',link:'연계·밸런스',balance:'밸런스·연계',dance:'기술 학습·카빙',trick:'기술 학습·밸런스',rest:'체력 회복',hospital:'부상 치료·체력 회복',rehearsal:'라인 숙련·연계'};
const signed=(n:number)=>(n>0?'+':'')+n.toFixed(1).replace('.0','');
const range=(min:number,max:number)=>min===max?signed(min):signed(min)+' ~ '+signed(max);

export function StatusGauges({r,preview}:{r:Rider;preview?:TrainingPreview}){
  return <div className="console-stats" aria-label="현재 능력치">{STATS.map(stat=>{
    const gain=preview?.gains[stat],rising=!!gain&&gain.max>0;
    return <div key={stat} className={'status-gauge stat-'+stat+(rising?' has-projection':'')}>
      <span>{STAT_NAMES[stat]}</span><b>{r.stats[stat].toFixed(1)}</b>
      <div className="status-track"><meter min={0} max={RULES.statCap} value={r.stats[stat]} aria-label={STAT_NAMES[stat]}/>
        {rising&&<span className="status-projection" style={{left:r.stats[stat]/RULES.statCap*100+'%',width:gain.max/RULES.statCap*100+'%'}} aria-hidden="true"><i style={{width:gain.min/gain.max*100+'%'}}/></span>}
      </div>
      {rising&&<strong className="status-delta" aria-label={STAT_NAMES[stat]+' 예상 상승'}>{range(gain.min,gain.max)}</strong>}
    </div>;
  })}</div>;
}

export function WeeklyChoices({r,send,saving,target,onPreview,pendingChoice}:{r:Rider;send:Submit;saving:boolean;target?:string;onPreview?:(plan:Plan|undefined)=>void;pendingChoice?:string}){
  const initial=SKILL[target??''];
  const [action,setAction]=useState<Action|undefined>(initial?.family);
  const spot=r.spot;
  const [skill,setSkill]=useState(target??''),[lesson,setLesson]=useState(false),[discipline,setDiscipline]=useState<Discipline>('freestyle');
  useEffect(()=>setLesson(false),[spot]);
  const choose=(next:Action)=>{setAction(current=>current===next?undefined:next);setSkill('');setLesson(false);};
  const plan=useMemo<Plan|undefined>(()=>action?{action,spot,...(skill?{skill}:{}),...(lesson?{lesson:true}:{}),...(action==='rehearsal'?{discipline}:{})}:undefined,[action,spot,skill,lesson,discipline]);
  const preview=plan?previewTraining(r,plan):undefined;
  let blocked='';if(plan)try{validatePlan(r,plan);}catch(error){blocked=error instanceof Error?error.message:'이 행동을 선택할 수 없어요.';}
  const auto=r.settings.mode==='auto';
  useEffect(()=>{onPreview?.(auto&&pendingChoice?r.plan??undefined:!blocked&&!auto?plan:undefined);},[plan,blocked,auto,pendingChoice,r.plan,onPreview]);
  useAutoAdvance(pendingChoice??'',auto&&!!pendingChoice&&!saving,AUTO_FLOW.choiceMs,()=>void send({type:'start-training',record:pendingChoice!}));
  useEffect(()=>()=>onPreview?.(undefined),[onPreview]);
  return <section className={'weekly-choices '+(auto?'is-auto ':'')+(action||pendingChoice?'has-preview':'')} aria-label={auto?'자동 행동 선택':'이번 주 행동 선택'}>
    <header><div><span>{r.year}년차 · {r.week}주</span><h2>{auto?'이번 주 행동을 선택합니다.':'이번 주에는 무엇을 할까요?'}</h2></div></header>
      <div className="weekly-action-grid">{ACTIONS.map(next=>{
        const Icon=icons[next],unavailable=next==='hospital'&&!r.injury||next==='rehearsal'&&!spotUnlocked(r,'arena');
        return <button key={next} aria-label={ACTION_NAMES[next]+' 선택'} aria-pressed={(auto?r.plan?.action:action)===next} disabled={saving||auto} onClick={()=>choose(next)}><Icon size={20}/><strong>{ACTION_NAMES[next]}</strong><small>{unavailable?next==='hospital'?'현재 부상 없음':'대회 연습장 해금 필요':details[next]}</small></button>;
      })}</div>
    <div className="weekly-selection-slot">
    {auto?<div className="weekly-auto"><div><strong>{r.plan?ACTION_NAMES[r.plan.action]:'행동 선택 중'}</strong><p>선택 장면 2초 → 수행 2초 → 결과 2초</p></div><button onClick={()=>void send({type:'settings',settings:{...r.settings,mode:'manual'}})} disabled={saving}>직접 선택으로 전환</button></div>:<>
      {plan&&preview?<>
        <div className="weekly-inline-controls" aria-label="행동 설정">
          {(action==='dance'||action==='trick')&&<label>연마 목표<select aria-label="연마 목표" value={skill} disabled={saving} onChange={e=>{setSkill(e.target.value);setLesson(false);}}><option value="">자유 연마</option>{SKILLS.filter(s=>s.family===action&&canStudy(r,s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
          {action==='rehearsal'&&<label>종목<select aria-label="리허설 종목" value={discipline} disabled={saving} onChange={e=>setDiscipline(e.target.value as Discipline)}>{DISCIPLINES.map(id=><option key={id} value={id}>{DISCIPLINE_NAMES[id]}</option>)}</select></label>}
          {!!skill&&['studio','night','arena'].includes(spot)&&<label className="weekly-lesson"><input type="checkbox" checked={lesson} disabled={saving} onChange={e=>setLesson(e.target.checked)}/> 개인 레슨</label>}
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
      </>:<><p className="weekly-hint">행동을 고르면 상단 체력·능력치 게이지에서 예상 변화를 볼 수 있어요.</p><footer className="weekly-confirm"><span>행동을 선택해 주세요.</span><button className="weekly-execute" disabled>확인하고 수행 <Check size={16}/></button></footer></>}
    </>}
    </div>
  </section>;
}

export function AutoSettings({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  return <section className="panel auto-settings"><h2>자동 육성 설정</h2><p>행동·이벤트·대회·결과 확인까지 자동으로 이어집니다. 선택 장면 2초 → 수행 2초 → 결과 2초 순서로 진행합니다.</p>
    <label>전략<select value={r.settings.strategy} disabled={saving} onChange={e=>void send({type:'settings',settings:{...r.settings,strategy:e.target.value as Rider['settings']['strategy']}})}>{STRATEGIES.map(id=><option key={id} value={id}>{STRATEGY_NAMES[id]}</option>)}</select></label>
    <fieldset><legend>자동 출전 종목</legend>{DISCIPLINES.map(id=><label key={id}><input type="checkbox" checked={r.settings.entries.includes(id)} disabled={saving} onChange={()=>void send({type:'settings',settings:{...r.settings,entries:r.settings.entries.includes(id)?r.settings.entries.filter(d=>d!==id):[...r.settings.entries,id]}})}/>{DISCIPLINE_NAMES[id]}</label>)}</fieldset>
    <button className="button primary" disabled={saving} onClick={()=>void send({type:'settings',settings:{...r.settings,mode:r.settings.mode==='auto'?'manual':'auto',pauseStory:false,pauseMeet:false,pauseInjury:false}})}>{r.settings.mode==='auto'?'자동 육성 끄기':'자동 육성 시작'} <ArrowRight size={16}/></button>
  </section>;
}
