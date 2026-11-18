import { ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, BookOpen, Check, CirclePlay, Clock3, LockKeyhole, Plus, Trash2, WandSparkles, X } from 'lucide-react';
import { useState } from 'react';
import { DISCIPLINE_NAMES, DIFFICULTY_NAMES, KIND_NAMES, RULES, SKILLS, SKILL, STYLE_NAMES } from '../game/data';
import { allowed, chance, generateRoutine, learned, routineTime } from '../game/competition';
import { canStudy } from '../game/events';
import { skillDescription, TECHNIQUE_REFERENCE } from '../game/content';
import { TechniquePreview } from './TechniquePreview';
import { DISCIPLINES, STYLES, type Discipline, type Rider } from '../game/types';
import { SectionTitle, Tag } from './Brand';
import type { Submit } from './Overview';

export function Skills({r,onTrain}:{r:Rider;onTrain:(id:string)=>void}){
  const [filter,setFilter]=useState<'all'|'dance'|'trick'|'learned'>('all');
  const [preview,setPreview]=useState<string|null>(null);
  const ready=SKILLS.filter(s=>learned(r.skills,s.id)).length;
  const list=SKILLS.filter(s=>filter==='all'||filter===s.family||filter==='learned'&&learned(r.skills,s.id));
  return <section className="panel content-panel">
    <SectionTitle code="TRICK LIBRARY" title="기술 도감" detail="선행 기술을 익히면 다음 기술이 열립니다. 숙련도를 높여 대회에서 안정적으로 성공하세요."/>
    <p className="technique-source">공통 기술 동작 참고: <a href={TECHNIQUE_REFERENCE} target="_blank" rel="noreferrer">보드를 타보자! 기술 도감</a> · 점수와 성장 규칙은 이 게임의 기준입니다.</p>
    <div className="filter-line"><div className="pill-row">{([['all','전체'],['dance','댄싱'],['trick','트릭'],['learned','습득']] as const).map(([k,n])=><button key={k} aria-pressed={k===filter} className={`pill ${k===filter?'active':''}`} onClick={()=>{setFilter(k);setPreview(null);}}>{n}</button>)}</div><Tag kind="lime"><BookOpen size={13}/> {ready} / {SKILLS.length} 습득</Tag></div>
    <div className="skill-grid">{list.map(s=>{
      const progress=r.skills[s.id];
      const known=learned(r.skills,s.id);
      const available=canStudy(r,s.id);
      const estimate=known ? chance(r,s) : chance({...r,skills:{...r.skills,[s.id]:{study:100,mastery:17}}},s);
      return <article key={s.id} className={`skill-card ${!available?'locked':''}`}>
        <div className="skill-meta"><Tag kind={s.family==='dance'?'lilac':'orange'}>{DISCIPLINE_NAMES[s.family]} / {KIND_NAMES[s.kind]}</Tag>{known?<Check size={17}/>:!available?<LockKeyhole size={15}/>:<ArrowDownRight size={16}/>}</div>
        <h3>{s.name}</h3><p>{DIFFICULTY_NAMES[s.difficulty]} · {s.points}점 · {s.seconds}초</p>
        <p className="skill-description">{skillDescription(s.id)}</p>
        <div className="skill-track"><span>{known?'숙련도':available?'학습 진척도':'선행 기술 필요'}</span><b>{available?Math.floor(known?progress?.mastery??0:progress?.study??0)+'%':'—'}</b></div>
        <div className="bar"><span style={{width:`${known?progress?.mastery??0:progress?.study??0}%`}}/></div>
        <p className="skill-conditions">선행 기술 {s.requires.length ? s.requires.map(id=>SKILL[id]?.name).join(' + ') : '없음'}</p>
        <p className="skill-conditions">{known?'현재':'습득 직후'} 예상 성공률 약 {Math.round(estimate*100)}%</p>
        <div className="skill-bottom">
          <button className="text-button" aria-expanded={preview===s.id} aria-label={s.name+' 미리보기'} onClick={()=>setPreview(preview===s.id?null:s.id)}><CirclePlay size={14}/> 미리보기</button>
          {available&&r.phase!=='retired'&&r.settings.mode==='manual'&&<button className="text-button" onClick={()=>onTrain(s.id)}>연마 <ArrowUpRight size={13}/></button>}
        </div>
        {preview===s.id&&<TechniquePreview r={r} id={s.id}/>}
      </article>;
    })}</div>
  </section>;
}

export function Routines({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  const [discipline,setDiscipline]=useState<Discipline>('dance');
  return <section className="panel content-panel">
    <SectionTitle code="LINE STUDIO" title="라인 편집" detail="대회에서 사용할 기술의 순서를 정하세요. 기술 사이 전환은 1초가 걸립니다."/>
    <div className="pill-row routine-tabs">{DISCIPLINES.map(d=><button className={`pill ${d===discipline?'active':''}`} key={d} aria-pressed={d===discipline} onClick={()=>setDiscipline(d)}>{DISCIPLINE_NAMES[d]}</button>)}</div>
    <RoutineEditor key={discipline} discipline={discipline} r={r} send={send} saving={saving}/>
  </section>;
}
function RoutineEditor({discipline,r,send,saving}:{discipline:Discipline;r:Rider;send:Submit;saving:boolean}){
  const [ids,setIds]=useState(()=>r.routines[discipline]);
  const total=routineTime(ids);
  const pool=SKILLS.filter(s=>allowed(s,discipline)&&learned(r.skills,s.id));
  const disabled=saving||r.phase==='retired';
  const unchanged=ids.join(',')===r.routines[discipline].join(',');
  const move=(i:number,d:number)=>setIds(previous=>{
    const next=[...previous];[next[i],next[i+d]]=[next[i+d],next[i]];return next;
  });
  return <>
    <div className="auto-routine"><span><WandSparkles size={16}/> 자동 생성</span><div className="pill-row">{STYLES.map(s=><button className="pill" disabled={disabled} key={s} onClick={()=>setIds(generateRoutine(r,discipline,s))}>{STYLE_NAMES[s]}</button>)}</div></div>
    <div className="routine-grid"><div className="inner-card"><h3>습득 기술 <Tag>{pool.length}</Tag></h3><ul className="routine-pool">{pool.map(s=><li key={s.id}><span><b>{s.name}</b><small>{s.seconds}초 · 현재 성공률 약 {Math.round(chance(r,s)*100)}%</small></span><button className="icon-button" aria-label={s.name+' 추가'} disabled={disabled||total+s.seconds+(ids.length?1:0)>RULES.runSeconds} onClick={()=>setIds(old=>[...old,s.id])}><Plus size={16}/></button></li>)}</ul></div>
    <div className="inner-card"><h3>실행 순서 <Tag kind="lime"><Clock3 size={13}/> {total} / 60초</Tag></h3><div className="bar"><span style={{width:`${total/60*100}%`}}/></div>
      {ids.length===0?<p className="empty">저장한 라인이 없으면 대회에서 연계형 라인을 사용해요.</p>:<ol className="routine-pool">{ids.map((id,i)=><li key={id+'-'+i}><span><b><small>{String(i+1).padStart(2,'0')}.</small> {SKILL[id]?.name}</b></span><div className="routine-order"><button className="icon-button" disabled={disabled||i===0} aria-label={`${i+1}번째 기술 위로`} onClick={()=>move(i,-1)}><ArrowUp size={14}/></button><button className="icon-button" disabled={disabled||i===ids.length-1} aria-label={`${i+1}번째 기술 아래로`} onClick={()=>move(i,1)}><ArrowDown size={14}/></button><button className="icon-button" disabled={disabled} aria-label={`${i+1}번째 기술 삭제`} onClick={()=>setIds(old=>old.filter((_,j)=>j!==i))}><X size={15}/></button></div></li>)}</ol>}
    </div></div>
    <div className="bottom-actions"><button className="button quiet" disabled={disabled||!ids.length} onClick={()=>setIds([])}><Trash2 size={15}/> 구성 비우기</button><button className="button primary" disabled={disabled||unchanged||total>60} onClick={()=>void send({type:'routine',discipline,skills:ids})}>{unchanged?'저장된 구성':'라인 저장'} <Check size={16}/></button></div>
  </>;
}
