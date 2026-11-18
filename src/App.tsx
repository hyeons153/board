import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Flag, Footprints, HeartPulse, ListOrdered, Menu, NotebookText, Settings, ShoppingBag, Trophy, UserRound, X } from 'lucide-react';
import { useGame } from './useGame';
import { ACTION_NAMES, CALENDAR, DEFAULT_LOOK, DIVISION_NAMES, LOCATIONS } from './game/data';
import { divisionFor } from './game/career';
import { lineTerms } from './game/content';
import { equippedLook, extras } from './game/economy';
import { Brand } from './components/Brand';
import { LookFields, PixelRider } from './components/Appearance';
import { NewsCard, TrainingControls } from './components/Overview';
import { Skills, Routines } from './components/Skills';
import { Meets } from './components/Meets';
import { Hall, Profile, Rankings } from './components/Records';
import Workshop from './components/Workshop';
import Account from './components/Account';
import OnlineHall from './components/OnlineHall';
import Ceremony from './components/Ceremony';
import GameStage from './components/GameStage';
import Scene from './components/Scene';
import type { Action, Look, MeetRecord } from './game/types';

type Screen='home'|'training'|'skills'|'routine'|'meets'|'rank'|'workshop'|'profile'|'hall'|'online'|'account'|'menu'|'new'|'ending'|'journal';
const names:Record<Screen,string>={home:'스팟',training:'훈련',skills:'기술 도감',routine:'라인 편집',meets:'대회',rank:'시즌 랭킹',workshop:'장비·스폰서',profile:'선수 정보',hall:'명예의 전당',online:'온라인 명예의 전당',account:'계정',menu:'전체 메뉴',new:'라이더 등록',ending:'커리어 엔딩',journal:'라이더 일지'};
const dock=[['home','스팟',Footprints],['training','훈련',HeartPulse],['skills','기술',BookOpen],['meets','대회',Flag],['workshop','상점',ShoppingBag],['menu','메뉴',Menu]] as const;
const allMenus=[['training',Footprints,'훈련 계획과 자동 육성'],['skills',BookOpen,'댄싱·트릭 설명과 연마'],['routine',ListOrdered,'대회에서 펼칠 기술 순서'],['meets',CalendarDays,'일정과 경기 다시 보기'],['rank',Trophy,'이번 시즌 순위'],['workshop',ShoppingBag,'장비 구매·장착과 계약'],['profile',UserRound,'선수·라이벌·커리어 관리'],['hall',Trophy,'은퇴 선수와 공개 설정'],['online',Trophy,'다른 선수의 공개 기록'],['account',Settings,'로그인과 보유 선수'],['journal',NotebookText,'지난 훈련과 이벤트 기록']] as const;

export default function App(){
  const game=useGame();
  const [screen,setScreen]=useState<Screen>(()=>new URLSearchParams(location.search).has('rider')?'online':'home');
  const [target,setTarget]=useState<string>();
  const [initialAction,setInitialAction]=useState<Action>();
  const [publicId,setPublicId]=useState(()=>new URLSearchParams(location.search).get('rider')??undefined);
  const [endingId,setEndingId]=useState<string>();
  const [replay,setReplay]=useState<MeetRecord>();
  const previous=useRef<{id:string;phase:string}|undefined>(undefined);
  const panel=useRef<HTMLDivElement>(null);
  const view=game.view,r=view?.career.rider;
  const pending=view?.pendingMeet;
  const trainingResult=view?.pendingTraining;
  useEffect(()=>{
    if(r&&(r.phase==='event'||r.phase==='meet'||r.phase==='injury'||pending||trainingResult)){
      setScreen('home');setTarget(undefined);setReplay(undefined);
    }
    if(r?.phase==='retired'&&!pending&&!trainingResult&&previous.current?.id===r.id&&previous.current.phase!=='retired'){
      setEndingId(r.id);setScreen('ending');
    }
    previous.current=r?{id:r.id,phase:r.phase}:undefined;
  },[r?.id,r?.phase,pending,trainingResult]);
  useEffect(()=>{if(screen!=='home'){panel.current?.focus({preventScroll:true});panel.current?.scrollTo(0,0);}},[screen]);
  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setScreen('home');setReplay(undefined);}};window.addEventListener('keydown',escape);return ()=>window.removeEventListener('keydown',escape);},[]);
  const go=(next:Screen)=>{setScreen(next);setTarget(undefined);setInitialAction(undefined);setReplay(undefined);};
  const selectPublic=(id?:string)=>{
    setPublicId(id);const url=new URL(location.href);
    if(id)url.searchParams.set('rider',id);else url.searchParams.delete('rider');
    history.replaceState(null,'',url);
  };
  if(!view)return <main className="boot"><Brand/><p role="status">{game.error||'라이더 기록을 불러오는 중…'}</p>{game.error&&<button className="button primary" onClick={()=>void game.load()}>다시 연결</button>}</main>;
  const stageRecord=r?.records.find(m=>r.id+':'+m.year+':'+m.id===pending)??replay;
  const busyFlow=!!r&&(!!pending||!!trainingResult||['event','meet','injury'].includes(r.phase));
  const active=!!r&&r.phase!=='retired';
  const last=r?.records.findLast(record=>record.results.length);
  const archive=view.career.hall.find(a=>a.id===endingId);
  const finishMeet=async()=>{
    if(pending){if(await game.send({type:'continue-meet',record:pending})){if(r?.phase==='retired'){setEndingId(r.id);setScreen('ending');}}}
    else setReplay(undefined);
  };
  const openReplay=(record:MeetRecord)=>{go('home');setReplay(record);};
  const playHome=()=>{go('home');};
  let content:ReactNode;
  if(screen==='new')content=<NewRider saving={game.saving} onCreate={async(name,look)=>{const ok=await game.send({type:'create',name,look});if(ok)go('home');return ok;}}/>;
  else if(screen==='account')content=<Account key={view.scope} view={view} send={game.send} onSwitch={playHome} onSessionChange={game.load}/>;
  else if(screen==='online')content=<OnlineHall view={view} initialId={publicId} onSelect={selectPublic}/>;
  else if(screen==='hall')content=<Hall hall={view.career.hall} view={view} onEnding={id=>{setEndingId(id);setScreen('ending');}} onAccount={()=>go('account')}/>;
  else if(screen==='ending'&&archive)content=<Ceremony key={archive.id} archive={archive} onHall={()=>go('hall')} onNew={()=>go('new')}/>;
  else if(screen==='menu')content=<div className="console-menu-grid">{allMenus.filter(([id])=>r||['hall','online','account'].includes(id)).map(([id,Icon,detail])=><button key={id} onClick={()=>go(id)}><Icon size={24}/><span><strong>{names[id]}</strong><small>{detail}</small></span><ArrowRight size={16}/></button>)}</div>;
  else if(r){
    if(screen==='training')content=busyFlow?<FlowNotice onReturn={playHome}/>:<TrainingControls key={r.id+':'+(target??'weekly')} r={r} send={game.send} saving={game.saving} target={target} initialAction={initialAction} onScheduled={playHome}/>;
    else if(screen==='skills')content=<Skills r={r} onTrain={id=>{go('training');setTarget(id);}}/>;
    else if(screen==='routine')content=<Routines r={r} send={game.send} saving={game.saving||busyFlow}/>;
    else if(screen==='meets')content=<Meets r={r} onPlay={openReplay} onEntry={playHome}/>;
    else if(screen==='rank')content=<Rankings r={r}/>;
    else if(screen==='workshop')content=busyFlow?<FlowNotice onReturn={playHome}/>:<Workshop r={r} send={game.send} saving={game.saving}/>;
    else if(screen==='profile')content=<Profile r={r} send={game.send} saving={game.saving||busyFlow} onNew={()=>go('new')} onHall={()=>go('hall')}/>;
    else if(screen==='journal')content=<div className="console-journal"><NewsCard r={{...r,news:r.news.slice(0,100)}}/>{r.news.slice(5).map((note,i)=><p key={i}><b>{note.year}년차 {note.week}주</b> {lineTerms(note.text)}</p>)}</div>;
  }
  return <div className="console-page"><main className="game-console" aria-label="LONGBOARD LIFE 게임">
    <header className="console-top"><button className="console-brand" onClick={playHome} aria-label="게임 홈"><Brand/></button>
      {r?<div className="console-rider"><span>{r.name}</span><b>{r.year}년차 {r.week}주</b><small>{DIVISION_NAMES[divisionFor(r.year)]}</small></div>:<span className="console-motto">나만의 롱보드 커리어</span>}
      <div className="console-top-actions">{active&&<button className={'console-auto '+(r!.settings.mode==='auto'?'is-on':'')} aria-label="자동 진행" aria-pressed={r!.settings.mode==='auto'} disabled={game.saving} onClick={async()=>{if(await game.send({type:'settings',settings:{...r!.settings,mode:r!.settings.mode==='auto'?'manual':'auto',pauseStory:false,pauseMeet:false,pauseInjury:false}}))playHome();}}>{r!.settings.mode==='auto'?'AUTO ON':'AUTO OFF'}</button>}<span className="console-save" role="status">{game.saving?'저장 중':view.storage==='neon'?'저장됨':'로컬 저장'}</span><button aria-label="라이더 일지" onClick={()=>go(r?'journal':'menu')}><NotebookText size={18}/></button><button aria-label="계정" onClick={()=>go('account')}><UserRound size={18}/></button></div>
    </header>
    <div className="console-world">
      <div className="console-stage" inert={screen!=='home'}>{r?<GameStage r={r} send={game.send} saving={game.saving} remaining={game.remaining} weekMs={view.weekMs} fastForward={view.fastForward} spot={r.plan?.spot??r.spot} motion={r.plan?.action==='rest'||r.plan?.action==='hospital'?'rest':'ride'} record={stageRecord} pendingTraining={trainingResult} onDone={()=>void finishMeet()}/>:<><Scene spot="river" look={DEFAULT_LOOK} variant="title"/><div className="console-title-shade"/></>}</div>
      {r&&<div className="console-vitals" aria-label="선수 상태"><span>체력 <b>{Math.round(r.energy)}</b><i><em style={{width:r.energy+'%'}}/></i></span><span>₩{r.money.toLocaleString('ko-KR')}</span><span>명성 {r.fame}</span>{r.injury&&<span className="console-injury">{r.injury.severity==='major'?'중상':'경상'} · {r.injury.weeks}주</span>}</div>}
      {screen==='home'&&!busyFlow&&!replay&&(r?<div className="console-home-actions">
        {r.phase==='retired'?<><button className="console-primary" onClick={()=>{setEndingId(r.id);go('ending');}}>은퇴식 보기 <Trophy size={18}/></button><button onClick={()=>go('new')}>새 선수 육성</button></>:<><button className="console-primary" onClick={()=>go('training')}><Footprints size={22}/><span><strong>{r.settings.mode==='auto'?'자동 육성 설정':r.plan?'이번 주 수행 중':'이번 주 행동 선택'}</strong><small>{r.settings.mode==='auto'?'설정한 전략으로 진행 중':r.plan?ACTION_NAMES[r.plan.action]+' 수행 중':'훈련·휴식·치료 선택 후 주차 시작'}</small></span><ArrowRight size={18}/></button>{r.settings.mode==='manual'&&!r.plan&&<><button onClick={()=>{go('training');setInitialAction('rest');}}>휴식</button><button disabled={!r.injury} onClick={()=>{go('training');setInitialAction('hospital');}}>치료</button></>}<button onClick={()=>go('routine')}><ListOrdered size={18}/> 라인</button><button onClick={()=>go('profile')}><UserRound size={18}/> 선수</button></>}
        {last&&<button onClick={()=>openReplay(last)}>최근 경기 <PlayIcon/></button>}
        {extras(r).lastTraining&&<p className="console-last-training">{lineTerms(extras(r).lastTraining!.text)}</p>}
      </div>:<div className="console-welcome"><span>THE LONGBOARD CAREER SIM</span><h1>LONGBOARD<br/><em>LIFE.</em></h1><p>강변의 첫 푸시부터 마지막 페스티벌까지.<br/>나만의 8년 커리어를 시작하세요.</p><button className="console-primary" onClick={()=>go('new')}>새 라이더 등록 <ArrowRight size={20}/></button><small>게임 내 1주 = 30초 · x2로 15초</small></div>)}
      {content&&screen!=='home'&&<section className={'console-panel '+(screen==='journal'?'console-panel-journal':'')} aria-label={names[screen]}>
        <header><button onClick={playHome} aria-label="게임 화면으로 돌아가기"><ArrowLeft size={18}/></button><h1>{names[screen]}</h1><button onClick={playHome} aria-label="메뉴 닫기"><X size={18}/></button></header>
        <div className="console-panel-body" ref={panel} tabIndex={-1} key={screen}>{content}</div>
      </section>}
      {game.syncNote&&<div className="console-sync-note" role="status">{game.syncNote}</div>}
      {game.error&&<div className="console-error" role="alert"><span>{game.error}</span><button onClick={()=>void game.load()}>다시 연결</button><button onClick={game.dismiss} aria-label="오류 닫기"><X size={16}/></button></div>}
    </div>
    <nav className="console-dock" aria-label="인게임 메뉴">{dock.map(([id,label,Icon])=><button key={id} disabled={!r&&['training','skills','meets','workshop'].includes(id)} aria-current={screen===id?'page':undefined} onClick={()=>go(id)}><Icon size={23}/><span>{label}</span>{screen===id&&<i/>}</button>)}</nav>
  </main></div>;
}
function PlayIcon(){return <ArrowRight size={16}/>;}
function FlowNotice({onReturn}:{onReturn:()=>void}){return <div className="console-flow-notice"><Flag size={32}/><h2>지금 진행 중인 이야기가 있어요.</h2><p>게임 화면에서 선택이나 대회 결과를 확인하면 계속할 수 있어요.</p><button className="button primary" onClick={onReturn}>게임으로 돌아가기 <ArrowRight size={16}/></button></div>;}
function NewRider({saving,onCreate}:{saving:boolean;onCreate:(name:string,look:Look)=>Promise<boolean>}){
  const [name,setName]=useState('');const [look,setLook]=useState<Look>(DEFAULT_LOOK);
  const submit=(event:FormEvent)=>{event.preventDefault();void onCreate(name.trim(),look);};
  return <form className="console-create" onSubmit={submit}><div className="console-create-preview"><PixelRider look={look} label="새 라이더 외형"/><p>강변에서 시작할 새 얼굴</p></div><label>라이더 이름<input aria-label="라이더 이름" value={name} onChange={e=>setName(e.target.value)} required minLength={1} maxLength={16} autoComplete="off"/></label><LookFields look={look} onChange={setLook}/><button className="button primary" disabled={saving||!name.trim()}>등록하고 시작 <ArrowRight size={17}/></button></form>;
}
