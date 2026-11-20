import { ArrowDown, ArrowUp, Check, ChevronRight, CirclePlay, Clock3, LockKeyhole, Plus, Trash2, WandSparkles, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { DISCIPLINE_NAMES, DIFFICULTY_NAMES, KIND_NAMES, RULES, SKILLS, SKILL, STYLE_NAMES } from '../game/data';
import { allowed, chance, generateRoutine, learned, routineTime } from '../game/competition';
import { canStudy, mastered, missingMastery } from '../game/skillTree';
import { skillDescription } from '../game/content';
import { SkillTreeView } from './SkillTreeView';
import { TechniquePreview } from './TechniquePreview';
import { DISCIPLINES, STYLES, type Discipline, type Rider, type Skill } from '../game/types';
import { Tag } from './Brand';
import type { Submit } from './Overview';

const trickSides=[['all','전체 트릭'],['nose','노즈트릭'],['tail','테일트릭']] as const;
const skillCategory=(skill:Skill)=>skill.id==='ghostride-kickflip'?'댄싱 트릭':
  trickSides.find(([id])=>id===skill.trickSide)?.[1]??DISCIPLINE_NAMES[skill.family];
const prerequisiteStatus=(r:Rider,ids:string[])=>ids.map(id=>{
  const current=learned(r.skills,id)?r.skills[id].mastery:0;
  const remaining=Math.max(0,Math.round((100-current)*10)/10);
  return `${SKILL[id]?.name} ${current}%${remaining?` (남은 숙련도 ${remaining}%p)`:''}`;
}).join(' · ');

function skillProgress(r:Rider,skill:Skill){
  const known=learned(r.skills,skill.id);
  const state=known?(mastered(r.skills,skill.id)?'mastered':'learned'):canStudy(r,skill.id)?'available':'locked';
  const labels={mastered:'마스터',learned:'습득',available:'학습 가능',locked:'잠김'} as const;
  const value=(known?r.skills[skill.id]?.mastery:r.skills[skill.id]?.study)??0;
  return {state,label:labels[state],value,kind:known?'숙련도':'학습도',known};
}

export function Skills({r}:{r:Rider}){
  const [view,setView]=useState<'list'|'tree'>('list');
  const [family,setFamily]=useState<'all'|'dance'|'trick'>('all');
  const [trickSide,setTrickSide]=useState<typeof trickSides[number][0]>('all');
  const [status,setStatus]=useState<'all'|'learned'|'unlearned'>('all');
  const [selected,setSelected]=useState<string>();
  const [preview,setPreview]=useState<string|null>(null);
  const detail=useRef<HTMLElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const ready=SKILLS.filter(s=>learned(r.skills,s.id)).length;
  const list=SKILLS.filter(s=>(family==='all'||family===s.family)&&
    (family!=='trick'||trickSide==='all'||trickSide===s.trickSide)&&
    (status==='all'||learned(r.skills,s.id)===(status==='learned')));
  const skill=SKILL[selected??''];
  const select=(id:string|undefined)=>{
    setSelected(id);
    setPreview(null);
    window.requestAnimationFrame(()=>{
      if(!id){trigger.current?.focus({preventScroll:true});return;}
      detail.current?.focus({preventScroll:true});
      if(matchMedia('(max-width:760px)').matches)detail.current?.scrollIntoView({block:view==='tree'?'nearest':'start'});
    });
  };
  const renderSkill=(s:Skill,prerequisite=false)=>{
    const progress=skillProgress(r,s);
    const open=selected===s.id;
    const tree=view==='tree';
    return <button key={s.id} type="button"
      className={tree?'skill-tree-card':'skill-entry-summary'+(progress.known?' is-known':'')+(progress.state==='locked'?' is-locked':'')}
      data-skill-state={progress.state} data-prerequisite={prerequisite||undefined}
      aria-expanded={open} aria-controls={open?'skill-detail':undefined} aria-label={s.name+' 상세'}
      aria-description={`${skillCategory(s)} · ${progress.label} · ${progress.kind} ${progress.value}%${prerequisite?' · 선행 기술':''}`}
      ref={element=>{if(open&&element)trigger.current=element;}}
      onClick={event=>{trigger.current=event.currentTarget;select(open?undefined:s.id);}}>
      <span className="skill-entry-title"><strong>{s.name}</strong>
        <small>{skillCategory(s)} · {DIFFICULTY_NAMES[s.difficulty]}{prerequisite?' · 선행':''}</small>
      </span>
      <span className="skill-entry-state">{progress.state==='locked'?<LockKeyhole size={13} aria-hidden="true"/>:
        progress.known?<Check size={13} aria-hidden="true"/>:null} {progress.label}</span>
      {!tree&&<ChevronRight size={16} className="skill-chevron" aria-hidden="true"/>}
      {(tree||progress.state!=='locked')&&<span className="skill-entry-progress"><span>{progress.kind}</span>
        <progress max={100} value={progress.value} aria-label={s.name+' '+progress.kind}/><b>{progress.value}%</b>
      </span>}
      {!tree&&progress.state==='locked'&&<span className="skill-entry-prerequisites">{prerequisiteStatus(r,missingMastery(r.skills,s))}</span>}
    </button>;
  };
  return <section className="skill-library">
    <div className="game-toolbar">
      <div className="pill-row" role="group" aria-label="기술 도감 보기 방식">
        {([['list','목록 보기'],['tree','스킬트리 보기']] as const).map(([key,label])=>
          <button key={key} className="pill" aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}
      </div>
      <div className="pill-row" role="group" aria-label="기술 종류">
        {([['all','전체'],['dance','댄싱'],['trick','트릭']] as const).map(([key,label])=><button key={key} className="pill" aria-pressed={family===key} onClick={()=>{setFamily(key);setPreview(null);}}>{label}</button>)}
      </div>
      <label>습득 상태<select value={status} onChange={e=>{setStatus(e.target.value as typeof status);setPreview(null);}}><option value="all">모두 보기</option><option value="learned">습득</option><option value="unlearned">미습득</option></select></label>
      <Tag kind="lime">습득 {ready} / {SKILLS.length}</Tag>
    </div>
    {family==='trick'&&<div className="pill-row skill-trick-filters" role="group" aria-label="트릭 하위 분류">
      {trickSides.map(([id,label])=><button key={id} className="pill" aria-pressed={trickSide===id} onClick={()=>{setTrickSide(id);setPreview(null);}}>{label}</button>)}
    </div>}
    {!list.length&&<p className="game-empty">조건에 맞는 기술이 없어요.</p>}
    <div className={'skill-browser'+(skill?' has-detail':'')+(view==='tree'?' is-tree':'')}>
      {view==='tree'?<SkillTreeView skills={list} node={renderSkill}/>:<div className="skill-list">{list.map(s=>renderSkill(s))}</div>}
      {skill&&<section className="skill-detail" id="skill-detail" key={skill.id} ref={detail} tabIndex={-1} aria-label={skill.name+' 기술 정보'}>
        <SkillDetail r={r} skill={skill} preview={preview===skill.id} onPreview={()=>setPreview(preview===skill.id?null:skill.id)} onClose={()=>select(undefined)}/>
      </section>}
      {view==='tree'&&!skill&&<aside className="skill-detail-placeholder">동작과 해금 조건을 보려면 기술을 선택하세요.</aside>}
    </div>
  </section>;
}

function SkillDetail({r,skill:s,preview,onPreview,onClose}:{r:Rider;skill:Skill;preview:boolean;onPreview:()=>void;onClose:()=>void}){
  const {id}=s;
  const progress=skillProgress(r,s);
  const {known}=progress;
  const estimate=chance(known?r:{...r,skills:{...r.skills,[id]:{study:100,mastery:17}}},s);
  return <>
    <header><h2>{s.name}</h2><button className="icon-button" aria-label="기술 상세 닫기" onClick={onClose}><X size={17}/></button></header>
    <p>{skillDescription(id)}</p>
    <dl className="game-facts">
      <div><dt>분류</dt><dd>{s.trickSide&&DISCIPLINE_NAMES[s.family]+' · '}{skillCategory(s)} · {DIFFICULTY_NAMES[s.difficulty]}</dd></div>
      <div><dt>{progress.kind}</dt><dd>{progress.value}% · {progress.label}</dd></div>
      <div><dt>동작</dt><dd>{KIND_NAMES[s.kind]} · {s.points}점 · {s.seconds}초</dd></div>
      <div><dt>선행 기술</dt><dd>{s.requires.length?prerequisiteStatus(r,s.requires):'없음'}</dd></div>
      <div><dt>{known?'대회 성공률':'습득 직후 예상 성공률'}</dt><dd>약 {Math.round(estimate*100)}%</dd></div>
    </dl>
    <div className="skill-detail-actions">
      <button className="button secondary small" aria-expanded={preview} aria-label={s.name+' 미리보기'} onClick={onPreview}><CirclePlay size={16}/> {preview?'동작 닫기':'동작 보기'}</button>
    </div>
    {preview&&<TechniquePreview r={r} id={id}/>}
  </>;
}

export type LineDraft={discipline:Discipline;skills:Partial<Record<Discipline,string[]>>};

export function Routines({r,send,saving,draft,onDraft}:{r:Rider;send:Submit;saving:boolean;draft?:LineDraft;onDraft:(value:LineDraft)=>void}){
  const discipline=draft?.discipline??'dance';
  const skills=draft?.skills??{};
  return <section className="panel content-panel">
    <p className="game-section-note">기술을 실행할 순서대로 넣으세요. 기술 사이 전환은 1초입니다.</p>
    <div className="pill-row routine-tabs">{DISCIPLINES.map(d=><button className="pill" key={d} disabled={saving} aria-pressed={d===discipline} onClick={()=>onDraft({discipline:d,skills})}>{DISCIPLINE_NAMES[d]}</button>)}</div>
    <RoutineEditor discipline={discipline} r={r} send={send} saving={saving} ids={skills[discipline]??r.routines[discipline]}
      edit={ids=>onDraft({discipline,skills:{...skills,[discipline]:ids}})}/>
  </section>;
}
function RoutineEditor({discipline,r,send,saving,ids,edit}:{discipline:Discipline;r:Rider;send:Submit;saving:boolean;ids:string[];edit:(ids:string[]|undefined)=>void}){
  const setIds=(update:string[]|((previous:string[])=>string[]))=>edit(typeof update==='function'?update(ids):update);
  const total=routineTime(ids);
  const pool=SKILLS.filter(s=>allowed(s,discipline)&&learned(r.skills,s.id));
  const disabled=saving||r.phase==='retired';
  const unchanged=ids.join(',')===r.routines[discipline].join(',');
  const move=(i:number,d:number)=>setIds(previous=>{
    const next=[...previous];[next[i],next[i+d]]=[next[i+d],next[i]];return next;
  });
  return <>
    <div className="bottom-actions routine-save-actions"><button className="button quiet" disabled={disabled||!ids.length} onClick={()=>setIds([])}><Trash2 size={15}/> 구성 비우기</button><button className="button primary" disabled={disabled||unchanged||total>RULES.runSeconds} onClick={async()=>{if(await send({type:'routine',discipline,skills:ids}))edit(undefined);}}>{unchanged?'저장된 구성':'라인 저장'} <Check size={16}/></button></div>
    <div className="auto-routine"><span><WandSparkles size={16}/> 자동 생성</span><div className="pill-row">{STYLES.map(s=><button className="pill" disabled={disabled} key={s} onClick={()=>setIds(generateRoutine(r,discipline,s))}>{STYLE_NAMES[s]}</button>)}</div></div>
    <div className="routine-grid"><div className="inner-card"><h3>습득 기술 <Tag>{pool.length}</Tag></h3><ul className="routine-pool">{pool.map(s=><li key={s.id}><span><b>{s.name}</b><small>{s.seconds}초 · 대회 성공률 약 {Math.round(chance(r,s)*100)}%</small></span><button className="icon-button" aria-label={s.name+' 추가'} disabled={disabled||total+s.seconds+(ids.length?1:0)>RULES.runSeconds} onClick={()=>setIds(old=>[...old,s.id])}><Plus size={16}/></button></li>)}</ul></div>
    <div className="inner-card"><h3>실행 순서 <Tag kind="lime"><Clock3 size={13}/> {total} / 60초</Tag></h3><div className="bar"><span style={{width:`${total/60*100}%`}}/></div>
      {ids.length===0?<p className="empty">저장한 라인이 없으면 대회에서 연계형 라인을 사용해요.</p>:<ol className="routine-pool">{ids.map((id,i)=><li key={id+'-'+i}><span><b><small>{String(i+1).padStart(2,'0')}.</small> {SKILL[id]?.name}</b></span><div className="routine-order"><button className="icon-button" disabled={disabled||i===0} aria-label={`${i+1}번째 기술 위로`} onClick={()=>move(i,-1)}><ArrowUp size={14}/></button><button className="icon-button" disabled={disabled||i===ids.length-1} aria-label={`${i+1}번째 기술 아래로`} onClick={()=>move(i,1)}><ArrowDown size={14}/></button><button className="icon-button" disabled={disabled} aria-label={`${i+1}번째 기술 삭제`} onClick={()=>setIds(old=>old.filter((_,j)=>j!==i))}><X size={15}/></button></div></li>)}</ol>}
    </div></div>
  </>;
}
