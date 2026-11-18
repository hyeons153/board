import { Aperture, ArrowLeft, ArrowRight, Check, Coffee, Cross, Flag, Footprints, Link2, MoveDiagonal2, Route, Settings, Wind } from 'lucide-react';
import { useState } from 'react';
import { ACTION_NAMES, DISCIPLINE_NAMES, INTENSITY_NAMES, LOCATIONS, SKILL, SKILLS, STAT_NAMES, STRATEGY_NAMES } from '../game/data';
import { validatePlan } from '../game/career';
import { spotUnlocked } from '../game/content';
import { canStudy } from '../game/events';
import { previewTraining } from '../game/training';
import { ACTIONS, DISCIPLINES, INTENSITIES, SPOTS, STATS, STRATEGIES, type Action, type Discipline, type Intensity, type Plan, type Rider } from '../game/types';
import type { Submit } from './Overview';

const icons={speed:Wind,carve:Route,link:Link2,balance:MoveDiagonal2,dance:Footprints,trick:Aperture,rest:Coffee,hospital:Cross,rehearsal:Flag};
const details={speed:'속도·연계',carve:'카빙·연계',link:'연계·밸런스',balance:'밸런스·연계',dance:'기술 학습·카빙',trick:'기술 학습·밸런스',rest:'체력 회복',hospital:'부상 치료·체력 회복',rehearsal:'라인 숙련·연계'};
const signed=(n:number)=>(n>0?'+':'')+n.toFixed(1).replace('.0','');
const range=(min:number,max:number)=>min===max?signed(min):signed(min)+' ~ '+signed(max);

export function StatusGauges({r}:{r:Rider}){
  return <div className="console-stats" aria-label="현재 능력치">{STATS.map(stat=><div key={stat} className={'status-gauge stat-'+stat}><span>{STAT_NAMES[stat]}</span><b>{r.stats[stat].toFixed(1)}</b><meter min={0} max={100} value={r.stats[stat]} aria-label={STAT_NAMES[stat]}/></div>)}</div>;
}
export function WeeklyChoices({r,send,saving,target,onSettings}:{r:Rider;send:Submit;saving:boolean;target?:string;onSettings:()=>void}){
  const initial=SKILL[target??''];
  const [action,setAction]=useState<Action|undefined>(initial?.family);
  const [spot,setSpot]=useState(r.spot),[intensity,setIntensity]=useState<Intensity>(r.settings.intensity);
  const [skill,setSkill]=useState(target??''),[lesson,setLesson]=useState(false),[discipline,setDiscipline]=useState<Discipline>('freestyle');
  const choose=(next:Action)=>{setAction(next);setSkill('');setLesson(false);if(next==='rehearsal')setSpot('arena');else if(next==='rest'||next==='hospital')setSpot(r.spot);};
  const plan:Plan={action:action??'rest',spot,intensity,...(skill?{skill}:{}),...(lesson?{lesson:true}:{}),...(action==='rehearsal'?{discipline}:{})};
  const preview=previewTraining(r,plan);
  let blocked='';try{validatePlan(r,plan);}catch(error){blocked=error instanceof Error?error.message:'이 행동을 선택할 수 없어요.';}
  const auto=r.settings.mode==='auto';
  return <section className={'weekly-choices '+(action?'has-preview':'')} aria-label="이번 주 행동 선택">
    <header><div><span>{r.year}년차 · {r.week}주</span><h2>{action?ACTION_NAMES[action]+' 미리보기':'이번 주에는 무엇을 할까요?'}</h2></div><button className="weekly-settings" aria-label="자동 육성 설정" onClick={onSettings}><Settings size={17}/></button></header>
    {auto?<div className="weekly-auto"><p>전략에 따라 행동·이벤트·대회를 자동으로 선택합니다.</p><button onClick={()=>void send({type:'settings',settings:{...r.settings,mode:'manual'}})} disabled={saving}>직접 선택으로 전환</button></div>:<>
      <div className="weekly-action-grid">{ACTIONS.map(next=>{
        const Icon=icons[next],unavailable=next==='hospital'&&!r.injury||next==='rehearsal'&&!spotUnlocked(r,'arena');
        return <button key={next} aria-label={ACTION_NAMES[next]+' 선택'} aria-pressed={action===next} disabled={saving} onClick={()=>choose(next)}><Icon size={20}/><strong>{ACTION_NAMES[next]}</strong><small>{unavailable?next==='hospital'?'현재 부상 없음':'대회 연습장 해금 필요':details[next]}</small></button>;
      })}</div>
      {action&&<div className="weekly-preview" aria-label="행동 미리보기">
        <div className="weekly-preview-controls">
          {!preview.recovery&&<><label>스팟<select aria-label="훈련 스팟" value={spot} disabled={saving} onChange={e=>{setSpot(e.target.value as typeof spot);setLesson(false);}}>{SPOTS.map(id=><option key={id} value={id} disabled={!spotUnlocked(r,id)}>{LOCATIONS[id].name}{!spotUnlocked(r,id)?' · 잠김':''}</option>)}</select></label><label>강도<select aria-label="훈련 강도" value={intensity} disabled={saving} onChange={e=>setIntensity(e.target.value as Intensity)}>{INTENSITIES.map(id=><option key={id} value={id}>{INTENSITY_NAMES[id]}</option>)}</select></label></>}
          {(action==='dance'||action==='trick')&&<label>연마 목표<select aria-label="연마 목표" value={skill} disabled={saving} onChange={e=>{setSkill(e.target.value);setLesson(false);}}><option value="">자유 연마</option>{SKILLS.filter(s=>s.family===action&&canStudy(r,s.id)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
          {action==='rehearsal'&&<label>종목<select aria-label="리허설 종목" value={discipline} disabled={saving} onChange={e=>setDiscipline(e.target.value as Discipline)}>{DISCIPLINES.map(id=><option key={id} value={id}>{DISCIPLINE_NAMES[id]}</option>)}</select></label>}
          {!!skill&&['studio','night','arena'].includes(spot)&&<label className="weekly-lesson"><input type="checkbox" checked={lesson} disabled={saving} onChange={e=>setLesson(e.target.checked)}/> 집중 레슨</label>}
        </div>
        <div className="weekly-preview-values"><div className="preview-energy"><span>체력</span><strong>{Math.round(r.energy)} → {preview.energyAfter.toFixed(1).replace('.0','')}</strong><b>{signed(preview.energy)}</b><meter min={0} max={100} value={preview.energyAfter} aria-label="예상 체력"/></div>
          {!preview.recovery&&<div className={'preview-success '+(preview.success<.7?'is-risky':'')}><span>훈련 성공률</span><strong>{Math.round(preview.success*100)}%</strong><small>{preview.success<.7?'낮은 체력으로 실패 위험이 높아요.':'컨디션·강도·목표 기술을 반영했어요.'}</small></div>}
          {preview.recovery&&<div className="preview-success"><span>{action==='rest'?'휴식':'병원 치료'}</span><strong>회복</strong><small>{action==='rest'?'체력 회복 · 부상 회복 1주 진행':'치료 2주 단축 · 이번 주 회복 추가'}</small></div>}
        </div>
        {!preview.recovery&&<div className="preview-gains"><span>성공 시 예상 상승</span>{Object.entries(preview.gains).map(([stat,gain])=><div key={stat}><b>{STAT_NAMES[stat as keyof typeof STAT_NAMES]}</b><strong>{range(gain!.min,gain!.max)}</strong></div>)}{preview.skill&&<div><b>{SKILL[preview.skill.id]?.name} {preview.skill.label}</b><strong>{range(preview.skill.min,preview.skill.max)}%</strong></div>}{!skill&&(action==='dance'||action==='trick')&&<small>선행 조건에 맞는 기술을 학습하거나 배운 기술의 숙련도를 높입니다.</small>}{action==='rehearsal'&&<small>선택 종목의 라인 기술 숙련도도 상승합니다.</small>}<small>실패 시 능력치·숙련도 상승 없음 · 체력은 소모됩니다. 훈련 중 부상이 발생할 수 있어요.</small></div>}
        {!!preview.money&&<p className="preview-fee">예상 비용 ₩{(-preview.money).toLocaleString('ko-KR')}{action==='hospital'&&r.money<32000?' · 부족한 치료비는 연맹 지원':''}</p>}
        {blocked&&<p className="weekly-blocked" role="status">{blocked}</p>}
        <footer><button className="preview-back" disabled={saving} onClick={()=>setAction(undefined)}><ArrowLeft size={15}/> 선택지로</button><span>확인 후 약 4초간 수행합니다.</span><button className="preview-confirm" disabled={saving||!!blocked} onClick={()=>void send({type:'plan',plan})}>확인하고 수행 <Check size={16}/></button></footer>
      </div>}
      {!action&&<p className="weekly-hint">행동을 누르면 체력·능력치 변화와 성공률을 먼저 확인할 수 있어요.</p>}
    </>}
  </section>;
}

export function AutoSettings({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  return <section className="panel auto-settings"><h2>자동 육성 설정</h2><p>행동·이벤트·대회·결과 확인까지 자동으로 이어집니다. 주간 행동은 약 4초간 수행합니다.</p>
    <label>전략<select value={r.settings.strategy} disabled={saving} onChange={e=>void send({type:'settings',settings:{...r.settings,strategy:e.target.value as Rider['settings']['strategy']}})}>{STRATEGIES.map(id=><option key={id} value={id}>{STRATEGY_NAMES[id]}</option>)}</select></label>
    <label>훈련 강도<select value={r.settings.intensity} disabled={saving} onChange={e=>void send({type:'settings',settings:{...r.settings,intensity:e.target.value as Intensity}})}>{INTENSITIES.map(id=><option key={id} value={id}>{INTENSITY_NAMES[id]}</option>)}</select></label>
    <fieldset><legend>자동 출전 종목</legend>{DISCIPLINES.map(id=><label key={id}><input type="checkbox" checked={r.settings.entries.includes(id)} disabled={saving} onChange={()=>void send({type:'settings',settings:{...r.settings,entries:r.settings.entries.includes(id)?r.settings.entries.filter(d=>d!==id):[...r.settings.entries,id]}})}/>{DISCIPLINE_NAMES[id]}</label>)}</fieldset>
    <button className="button primary" disabled={saving} onClick={()=>void send({type:'settings',settings:{...r.settings,mode:r.settings.mode==='auto'?'manual':'auto',pauseStory:false,pauseMeet:false,pauseInjury:false}})}>{r.settings.mode==='auto'?'자동 육성 끄기':'자동 육성 시작'} <ArrowRight size={16}/></button>
  </section>;
}
