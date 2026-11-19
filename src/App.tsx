import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Flag, Footprints, ListOrdered, Menu, NotebookText, Settings, ShoppingBag, Trophy, UserRound, UsersRound, X } from 'lucide-react';
import { useGame } from './useGame';
import { ACTION_NAMES, DEFAULT_LOOK, DIVISION_NAMES, LOCATIONS } from './game/data';
import { divisionFor, nextMeet } from './game/career';
import { lineTerms, RIVAL } from './game/content';
import { previewTraining } from './game/training';
import { equippedLook, extras } from './game/economy';
import { Brand, ENGLISH_GAME_NAME } from './components/Brand';
import { LookFields, LookPreview } from './components/Appearance';
import { NewsCard } from './components/Overview';
import { Skills, Routines, type LineDraft } from './components/Skills';
import { Meets, type MeetSelection } from './components/Meets';
import { Profile, Rankings, Rivals } from './components/Records';
import Workshop from './components/Workshop';
import Account from './components/Account';
import HallOfFame from './components/HallOfFame';
import Ceremony from './components/Ceremony';
import GameStage from './components/GameStage';
import Scene from './components/Scene';
import { SpotMap } from './components/SpotMap';
import { AutoSettings, WeeklyChoices } from './components/WeeklyChoices';
import { RiderHud } from './components/RiderHud';
import type { Look, MeetRecord, Plan } from './game/types';

type Screen='home'|'training'|'skills'|'routine'|'meets'|'rank'|'workshop'|'profile'|'rivals'|'hall'|'account'|'menu'|'new'|'ending'|'journal';
const names:Record<Screen,string>={home:'육성',training:'자동 육성 설정',skills:'기술 도감',routine:'라인 편집',meets:'대회',rank:'시즌 랭킹',workshop:'장비·스폰서',profile:'선수 정보',rivals:'라이벌',hall:'명예의 전당',account:'계정',menu:'전체 메뉴',new:'라이더 등록',ending:'커리어 엔딩',journal:'라이더 일지'};
const dock=[['home','육성',Footprints],['skills','기술',BookOpen],['meets','대회',Flag],['workshop','상점',ShoppingBag],['menu','메뉴',Menu]] as const;
const menuGroups=[
  {name:'커리어',items:[['routine',ListOrdered],['profile',UserRound],['rivals',UsersRound],['rank',Flag]]},
  {name:'기록',items:[['hall',Trophy]]},
] as const;
const panelStyle:Partial<Record<Screen,string>>={
  journal:'sidebar',account:'sidebar',training:'settings',new:'create',menu:'menu',
  skills:'wide',meets:'wide',workshop:'wide',routine:'wide',ending:'wide',hall:'wide',
};

export default function App(){
  const game=useGame();
  const [screen,setScreen]=useState<Screen>(()=>new URLSearchParams(location.search).has('rider')?'hall':'home');
  const [trail,setTrail]=useState<Screen[]>([]);
  const [lineDraft,setLineDraft]=useState<{rider:string;value:LineDraft}>();
  const [meetSelection,setMeetSelection]=useState<{rider:string;value:MeetSelection}>();
  const [lookDraft,setLookDraft]=useState<{rider:string;value?:Look}>();
  const [replayFrom,setReplayFrom]=useState<Screen>('home');
  const [draft,setDraft]=useState<Plan>();
  const [spotMap,setSpotMap]=useState(false);
  const [publicId,setPublicId]=useState(()=>new URLSearchParams(location.search).get('rider')??undefined);
  const [endingId,setEndingId]=useState<string>();
  const [replay,setReplay]=useState<MeetRecord>();
  const [replayLoading,setReplayLoading]=useState(false);
  const replayRequest=useRef(0);
  const previous=useRef<{id:string;phase:string}|undefined>(undefined);
  const panel=useRef<HTMLDivElement>(null);
  const view=game.view,r=view?.career.rider;
  const weekKey=r?r.id+':'+r.year+':'+r.week:'';
  const pending=view?.pendingMeet;
  const trainingResult=view?.pendingTraining;
  const eventResult=view?.pendingEvent;
  useEffect(()=>{if(r?.plan)setSpotMap(false);},[r?.plan]);
  const autoChoice=view?.pendingChoice;
  useEffect(()=>{
    if(r&&previous.current&&previous.current.id!==r.id){
      replayRequest.current++;setReplayLoading(false);setScreen('home');setTrail([]);setReplay(undefined);
      setLineDraft(undefined);setMeetSelection(undefined);setLookDraft(undefined);
    }
    if(r?.phase==='retired'&&!pending&&!trainingResult&&!eventResult&&previous.current?.id===r.id&&previous.current.phase!=='retired'){
      setEndingId(r.id);setTrail([]);setScreen('ending');
    }
    previous.current=r?{id:r.id,phase:r.phase}:undefined;
  },[r?.id,r?.phase,pending,trainingResult,eventResult?.key,autoChoice]);
  useEffect(()=>{
    if(screen==='home')return;
    panel.current?.focus({preventScroll:true});
    panel.current?.scrollTo(0,0);
  },[screen]);
  const selectPublic=(id?:string)=>{
    setPublicId(id);const url=new URL(location.href);
    if(id)url.searchParams.set('rider',id);else url.searchParams.delete('rider');
    history.replaceState(null,'',url);
  };
  const go=(next:Screen,child=false)=>{
    if(next===screen&&!replay&&!replayLoading&&!spotMap)return;
    if(screen==='hall'&&next!=='hall'&&publicId)selectPublic(undefined);
    replayRequest.current++;setReplayLoading(false);setReplay(undefined);setSpotMap(false);
    setTrail(history=>child&&screen!=='home'?[...history,screen]:[]);
    setScreen(next);
  };
  const back=()=>{
    if(spotMap){setSpotMap(false);return;}
    if(replay||replayLoading){
      replayRequest.current++;setReplay(undefined);setReplayLoading(false);setScreen(replayFrom);return;
    }
    if(screen==='hall'&&publicId)selectPublic(undefined);
    setScreen(trail.at(-1)??'home');
    setTrail(trail.slice(0,-1));
  };
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')back();};
    window.addEventListener('keydown',escape);
    return ()=>window.removeEventListener('keydown',escape);
  },[trail,spotMap,replay,replayLoading,replayFrom,screen,publicId]);
  if(!view)return <main className="boot"><Brand/><p role="status">{game.error||'라이더 기록을 불러오는 중…'}</p>{game.error&&<button className="button primary" onClick={()=>void game.load()}>다시 연결</button>}</main>;
  const stageRecord=replay??r?.records.find(m=>r.id+':'+m.year+':'+m.id===pending);
  const busyFlow=!!r&&(!!pending||!!trainingResult||!!eventResult||['event','meet','injury'].includes(r.phase));
  const preview=r&&draft&&screen==='home'&&!busyFlow&&!replay&&(autoChoice||!r.plan&&r.settings.mode==='manual')?previewTraining(r,draft):undefined;
  const active=!!r&&r.phase!=='retired';
  const showTraining=active&&!busyFlow&&!replay&&!replayLoading&&(!r!.plan||!!autoChoice);
  const trainingScene=!!r&&!pending&&!replay&&!replayLoading&&(!!trainingResult||!eventResult&&r.phase==='plan');
  const trainingVisible=screen==='home'&&!spotMap;
  const upcoming=active?nextMeet(r!):undefined;
  const visitor=r?RIVAL.get(LOCATIONS[r.spot].npc):undefined;
  const dockPage=replay||replayLoading?replayFrom:
    dock.some(([id])=>id===screen)?screen:trail.findLast(route=>dock.some(([id])=>id===route));
  const archive=view.career.hall.find(a=>a.id===endingId);
  const finishMeet=async()=>{
    if(replay){back();return;}
    if(pending){if(await game.send({type:'continue-meet',record:pending})){if(r?.phase==='retired'){setEndingId(r.id);setScreen('ending');}}}
    else setReplay(undefined);
  };
  const openReplay=async(record:MeetRecord)=>{
    setReplayFrom(screen);setScreen('home');setSpotMap(false);
    const request=++replayRequest.current;setReplayLoading(true);
    const full=await game.loadReplay(record);
    if(request!==replayRequest.current)return;
    setReplayLoading(false);if(full)setReplay(full);else setScreen(screen);
  };
  const playHome=()=>{go('home');};
  const status=r&&<RiderHud r={r} preview={preview} recentTraining={!!trainingResult&&!replay} interactive={screen==='home'&&!spotMap&&!replayLoading}/>;
  let content:ReactNode;
  if(screen==='new')content=<NewRider saving={game.saving} onCreate={async(name,look)=>{const ok=await game.send({type:'create',name,look});if(ok)go('home');return ok;}}/>;
  else if(screen==='account')content=<Account key={view.scope} view={view} send={game.send} onSwitch={playHome} onSessionChange={game.load}/>;
  else if(screen==='hall')content=<HallOfFame view={view} selectedId={publicId} onSelect={selectPublic}
    onEnding={id=>{setEndingId(id);go('ending',true);}} onAccount={()=>go('account',true)}/>;
  else if(screen==='ending'&&archive)content=<Ceremony key={archive.id} archive={archive} onHall={()=>go('hall')} onNew={()=>go('new')}/>;
  else if(screen==='menu')content=<div className="console-menu">
    {menuGroups.filter(group=>r||group.name==='기록').map(group=><section key={group.name}>
      <h2>{group.name}</h2>
      {group.items.map(([id,Icon])=><button key={id} onClick={()=>go(id)}><Icon size={18}/><span>{names[id]}</span><ArrowRight size={16}/></button>)}
    </section>)}
  </div>;
  else if(r){
    if(screen==='training')content=<AutoSettings r={r} send={game.send} saving={game.saving}/>;
    else if(screen==='skills')content=<Skills r={r}/>;
    else if(screen==='routine')content=<Routines r={r} send={game.send} saving={game.saving}
      draft={lineDraft?.rider===r.id?lineDraft.value:undefined} onDraft={value=>setLineDraft({rider:r.id,value})}/>;
    else if(screen==='meets')content=<Meets r={r} onPlay={openReplay} onEntry={playHome} onLine={()=>go('routine',true)} onLoadRecord={game.loadReplay}
      selection={meetSelection?.rider===r.id?meetSelection.value:undefined} onSelection={value=>setMeetSelection({rider:r.id,value})}/>;
    else if(screen==='rank')content=<Rankings r={r}/>;
    else if(screen==='workshop')content=<Workshop r={r} send={game.send} saving={game.saving}
      lookDraft={lookDraft?.rider===r.id?lookDraft.value:undefined} onLookDraft={value=>setLookDraft({rider:r.id,value})}/>;
    else if(screen==='profile')content=<Profile r={r} send={game.send} saving={game.saving||busyFlow} onNew={()=>go('new',true)} onHall={()=>go('hall',true)}/>;
    else if(screen==='rivals')content=<Rivals r={r}/>;
    else if(screen==='journal')content=<div className="console-journal"><NewsCard r={{...r,news:r.news.slice(0,100)}}/>{r.news.slice(5).map((note,i)=><p key={i}><b>{note.year}년차 {note.week}주</b> {lineTerms(note.text)}</p>)}</div>;
  }
  return <div className="console-page"><main className="game-console" aria-label="롱보더 키우기">
    <header className="console-top"><button className="console-brand" onClick={playHome} aria-label="게임 홈"><Brand/></button>
      {r?<div className="console-rider"><span>{r.name}</span><b>{r.year}년차 {r.week}주</b><small>{DIVISION_NAMES[divisionFor(r.year)]}</small></div>:<span className="console-motto">나만의 롱보드 커리어</span>}
      <div className="console-top-actions">{active&&<button aria-label="자동 육성 설정" title="자동 육성 설정" onClick={()=>go('training')}><Settings size={18}/></button>}{active&&<button className={'console-auto '+(r!.settings.mode==='auto'?'is-on':'')} aria-label="자동 진행" aria-pressed={r!.settings.mode==='auto'} disabled={game.saving} onClick={async()=>{if(await game.send({type:'settings',settings:{...r!.settings,mode:r!.settings.mode==='auto'?'manual':'auto',pauseStory:false,pauseMeet:false,pauseInjury:false}}))playHome();}}>{r!.settings.mode==='auto'?'AUTO ON':'AUTO OFF'}</button>}<span className="console-save" role="status">{game.saving?'저장 중':view.storage==='neon'?'저장됨':'로컬 저장'}</span><button aria-label="라이더 일지" onClick={()=>go(r?'journal':'menu')}><NotebookText size={18}/></button><button aria-label="계정" onClick={()=>go('account')}><UserRound size={18}/></button></div>
    </header>
    <div className={'console-world'+(showTraining&&trainingVisible?' has-weekly-choices':'')}>
      <div className="console-field">
      <div className="console-stage" inert={screen!=='home'||replayLoading||spotMap}>{r?<GameStage r={r} send={game.send} saving={game.saving} remaining={game.remaining} weekMs={view.weekMs} fastForward={view.fastForward} spot={r.plan?.spot??r.spot} motion={r.plan?.action==='rest'||r.plan?.action==='hospital'?'rest':'ride'} record={stageRecord} pendingTraining={replay?undefined:trainingResult} pendingEvent={replay?undefined:eventResult} active={screen==='home'&&!replayLoading&&!spotMap} autoChoosing={!!autoChoice} replaying={!!replay} guest={visitor?.look} onSpotMenu={()=>setSpotMap(true)} onDone={()=>void finishMeet()}/>:<><Scene spot="river" look={DEFAULT_LOOK} variant="title"/><div className="console-title-shade"/></>}</div>
      {replayLoading&&screen==='home'&&<div className="console-replay-loading" role="status">경기 기록을 불러오는 중…</div>}
      {r&&<div className={'console-training-area'+(trainingScene?'':' is-scene-hud')}>
        {status}
        {showTraining&&<>
          {trainingVisible&&<div className="console-scene-space" aria-hidden="true"/>}
          {upcoming&&<div className="console-field-links" hidden={!trainingVisible}>
            <button className="console-next-meet" onClick={()=>{setMeetSelection({rider:r.id,value:{year:r.year,id:upcoming.id}});go('meets');}}><CalendarDays size={17}/><span>{upcoming.name}</span><b>{upcoming.week===r.week?'이번 주':upcoming.week-r.week+'주 후'}</b><ArrowRight size={15}/></button>
          </div>}
          {trainingVisible&&visitor&&<button className="console-visitor" aria-label={visitor.name+' · 라이벌 보기'} onClick={()=>go('rivals')}><UsersRound size={16}/>{visitor.name}</button>}
          <WeeklyChoices key={weekKey+':'+r.settings.mode} r={r} send={game.send} saving={game.saving} onPreview={setDraft} pendingChoice={autoChoice} active={trainingVisible} hidden={!trainingVisible}/>
        </>}
      </div>}
      </div>
      {screen==='home'&&!busyFlow&&!replay&&!replayLoading&&(r?<>
        {r.phase==='retired'&&<div className="console-home-actions"><button className="console-primary" onClick={()=>{setEndingId(r.id);go('ending');}}>은퇴식 보기 <Trophy size={18}/></button><button onClick={()=>go('new')}>새 선수 육성</button></div>}
      </>:<div className="console-welcome"><span>{ENGLISH_GAME_NAME}</span><h1>롱보더 <br/><em>키우기</em></h1><p>강변의 첫 푸시부터 마지막 국제대회까지.<br/>나만의 8년 커리어를 시작하세요.</p><button className="console-primary" onClick={()=>go('new')}>새 라이더 등록 <ArrowRight size={20}/></button></div>)}
      {spotMap&&r&&screen==='home'&&!busyFlow&&!r.plan&&<SpotMap r={r} send={game.send} saving={game.saving} onClose={()=>setSpotMap(false)}/>}
      {content&&screen!=='home'&&<section className={'console-panel console-panel-'+(panelStyle[screen]??'standard')} aria-label={names[screen]}>
        <header><h1>{names[screen]}</h1><button onClick={back} aria-label={trail.length?'뒤로 가기':'메뉴 닫기'} title={trail.length?'뒤로 가기':'닫기'}>{trail.length?<ArrowLeft size={18}/>:<X size={18}/>}</button></header>
        <div className="console-panel-body" ref={panel} tabIndex={-1} key={screen}>{content}</div>
      </section>}
      {game.syncNote&&<div className="console-sync-note" role="status">{game.syncNote}</div>}
      {game.error&&<div className="console-error" role="alert"><span>{game.error}</span><button onClick={()=>void game.load()}>다시 연결</button><button onClick={game.dismiss} aria-label="오류 닫기"><X size={16}/></button></div>}
    </div>
    <nav className="console-dock" aria-label="인게임 메뉴">{dock.map(([id,label,Icon])=><button key={id} disabled={!r&&['skills','meets','workshop'].includes(id)} aria-current={dockPage===id?'page':undefined} onClick={()=>go(id)}><Icon size={23}/><span>{label}</span>{dockPage===id&&<i/>}</button>)}</nav>
  </main></div>;
}
function NewRider({saving,onCreate}:{saving:boolean;onCreate:(name:string,look:Look)=>Promise<boolean>}){
  const [name,setName]=useState('');
  const [look,setLook]=useState<Look>(DEFAULT_LOOK);
  const submit=(event:FormEvent)=>{event.preventDefault();void onCreate(name.trim(),look);};
  return <form className="console-create" onSubmit={submit}>
    <div className="console-create-preview"><LookPreview look={look} label="새 라이더 외형"/></div>
    <div className="console-create-options">
      <LookFields look={look} onChange={setLook}>
        <label className="console-create-name">라이더 이름
          <input aria-label="라이더 이름" value={name} onChange={e=>setName(e.target.value)} required minLength={1} maxLength={16} autoComplete="off"/>
        </label>
      </LookFields>
    </div>
    <button type="submit" className="button primary" disabled={saving||!name.trim()}>등록하고 시작 <ArrowRight size={17}/></button>
  </form>;
}
