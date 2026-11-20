import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Flag, Footprints, ListOrdered, Menu, NotebookText, Settings, ShoppingBag, Trophy, UserRound, UsersRound, X } from 'lucide-react';
import { useGame } from './useGame';
import { ACTION_NAMES, DEFAULT_LOOK, DIVISION_NAMES, formatCareerDate } from './game/data';
import { divisionFor, nextMeet } from './game/career';
import { lineTerms, spotVisitor } from './game/content';
import { previewTraining } from './game/training';
import { equippedLook, extras } from './game/economy';
import { Brand, ENGLISH_GAME_NAME } from './components/Brand';
import { LookFields, LookPreview } from './components/Appearance';
import { NewsCard } from './components/Overview';
import { Skills, Routines, type LineDraft } from './components/Skills';
import { Meets, type MeetSelection } from './components/Meets';
import { Profile, Rankings, Rivals } from './components/Records';
import Workshop from './components/Workshop';
import Account, { service, type AccountMode } from './components/Account';
import HallOfFame, { type HallTarget } from './components/HallOfFame';
import { PublicationStatus, RegistrationError, useHallPublications, type RegistrationActions } from './components/HallRegistration';
import Ceremony from './components/Ceremony';
import GameStage from './components/GameStage';
import Scene from './components/Scene';
import { SpotMap } from './components/SpotMap';
import { AutoSettings, WeeklyChoices } from './components/WeeklyChoices';
import { RiderHud } from './components/RiderHud';
import type { Publication } from './game/public';
import type { Archive, Look, MeetRecord, Plan, View } from './game/types';

type Screen='home'|'training'|'skills'|'routine'|'meets'|'rank'|'workshop'|'profile'|'rivals'|'hall'|'hall-registration'|'account'|'menu'|'new'|'ending'|'journal';
const names:Record<Screen,string>={home:'육성',training:'자동 육성 설정',skills:'기술 도감',routine:'라인 편집',meets:'대회',rank:'시즌 랭킹',workshop:'장비·스폰서',profile:'선수 정보',rivals:'라이벌',hall:'명예의 전당','hall-registration':'명예의 전당 등록',account:'계정',menu:'전체 메뉴',new:'라이더 등록',ending:'커리어 엔딩',journal:'라이더 일지'};
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
  const [endingStep,setEndingStep]=useState(0);
  const [hallTarget,setHallTarget]=useState<HallTarget>();
  const [registrationTarget,setRegistrationTarget]=useState<{archiveId:string;form?:AccountMode}>();
  const navigation=useRef(0);
  const [replay,setReplay]=useState<MeetRecord>();
  const [replayLoading,setReplayLoading]=useState(false);
  const replayRequest=useRef(0);
  const previous=useRef<{id:string;phase:string;held:boolean}|undefined>(undefined);
  const panel=useRef<HTMLDivElement>(null);
  const view=game.view,r=view?.career.rider;
  const [hallSession,setHallSession]=useState<Pick<View,'username'|'scope'>>();
  const [hallSessionError,setHallSessionError]=useState('');
  const sessionRequest=useRef(0);
  const loadHallSession=useCallback(async()=>{
    const id=++sessionRequest.current;
    try{
      const session=await service<Pick<View,'username'|'scope'>>('account');
      if(id===sessionRequest.current){setHallSession(session);setHallSessionError('');}
    }catch(error){
      if(id===sessionRequest.current){setHallSession(undefined);setHallSessionError(error instanceof Error?error.message:'로그인 상태를 확인하지 못했어요.');}
      throw error;
    }
  },[]);
  const publicationScreen=screen==='hall'||screen==='ending'||screen==='hall-registration'?screen:undefined;
  const hallOpen=view?.storage==='browser'&&(!!publicationScreen||screen==='account');
  useEffect(()=>{
    if(hallOpen)void loadHallSession().catch(()=>{});
  },[hallOpen,screen,loadHallSession]);
  const account=view?.storage==='browser'?hallSession:view;
  const publications=useHallPublications(account?.username?account.scope:undefined,publicationScreen);
  const weekKey=r?r.id+':'+r.year+':'+r.week:'';
  const pending=view?.pendingMeet;
  const trainingResult=view?.pendingTraining;
  const eventResult=view?.pendingEvent;
  useEffect(()=>{if(r?.plan)setSpotMap(false);},[r?.plan]);
  const autoChoice=view?.pendingChoice;
  useEffect(()=>{
    const held=!!(pending||trainingResult||eventResult);
    if(r&&previous.current&&previous.current.id!==r.id){
      replayRequest.current++;setReplayLoading(false);setReplay(undefined);
      if(screen!=='hall-registration'){navigation.current++;setScreen('home');setTrail([]);}
      setLineDraft(undefined);setMeetSelection(undefined);setLookDraft(undefined);
    }
    if(r?.phase==='retired'&&!held&&previous.current?.id===r.id&&(previous.current.phase!=='retired'||previous.current.held)){
      navigation.current++;setEndingId(r.id);setEndingStep(0);setTrail([]);setScreen('ending');
    }
    previous.current=r?{id:r.id,phase:r.phase,held}:undefined;
  },[r?.id,r?.phase,pending,trainingResult,eventResult?.key,autoChoice,screen]);
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
    navigation.current++;
    if(next==='hall')setHallTarget(undefined);
    if(screen==='hall-registration')setRegistrationTarget(undefined);
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
    navigation.current++;
    if(screen==='hall'&&publicId)selectPublic(undefined);
    if(screen==='hall-registration')setRegistrationTarget(undefined);
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
  const visitor=r?spotVisitor(r,r.plan?.spot??r.spot):undefined;
  const dockPage=replay||replayLoading?replayFrom:
    dock.some(([id])=>id===screen)?screen:trail.findLast(route=>dock.some(([id])=>id===route));
  const archive=view.career.hall.find(a=>a.id===endingId);
  const archiveToRegister=view.career.hall.find(a=>a.id===registrationTarget?.archiveId);
  const pendingPublication=publications.rows.find(row=>row.archiveId===archiveToRegister?.id);
  const finishMeet=async()=>{
    if(replay){back();return;}
    if(pending)await game.send({type:'continue-meet',record:pending});
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
  const hallView=view.storage==='browser'?{...view,...hallSession}:view;
  const changeSession=view.storage==='browser'?loadHallSession:game.load;
  const showRanking=(rider:Archive,publication:Publication,registered=false)=>{
    selectPublic(undefined);
    go('hall');
    setHallTarget({archiveId:rider.id,publicId:publication.id,name:rider.name,registered});
  };
  const registerRider=(rider:Archive)=>{
    if(!hallView.username){
      if(screen==='hall')setHallTarget({archiveId:rider.id});
      setRegistrationTarget({archiveId:rider.id});
      go('hall-registration',true);
      return;
    }
    const current=publications.rows.find(row=>row.archiveId===rider.id);
    if(current?.active&&!current.moderated){showRanking(rider,current);return;}
    const origin=navigation.current;
    void publications.change(rider.id,true,view.storage).then(publication=>{
      if(publication?.active&&!publication.moderated&&origin===navigation.current)showRanking(rider,publication,true);
    });
  };
  const registration:RegistrationActions={rows:publications.rows,
    ready:!!account&&(!hallView.username||publications.ready),working:publications.working,
    loadError:hallSessionError||publications.error,failure:publications.failure,
    retry:()=>hallSessionError?void changeSession().catch(()=>{}):void publications.refresh(),
    onRegister:registerRider,onRank:showRanking,onWithdraw:rider=>void publications.change(rider.id,false,view.storage),
  };
  const status=r&&<RiderHud r={r} preview={preview} recentTraining={!!trainingResult&&!replay} interactive={screen==='home'&&!spotMap&&!replayLoading}/>;
  let content:ReactNode;
  if(screen==='new')content=<NewRider saving={game.saving} onCreate={async(name,look)=>{const ok=await game.send({type:'create',name,look});if(ok)go('home');return ok;}}/>;
  else if(screen==='account')content=<Account key={hallView.scope} view={hallView} send={game.send} onSwitch={playHome}
    onSessionChange={changeSession} onRestore={game.restoreLegacy}/>;
  else if(screen==='hall')content=<HallOfFame view={hallView} selectedId={publicId} onSelect={selectPublic} target={hallTarget} registration={registration}
    onEnding={id=>{setEndingId(id);setEndingStep(0);go('ending',true);}}/>;
  else if(screen==='ending'&&archive)content=<Ceremony archive={archive} step={endingStep} onStep={setEndingStep} registration={registration}
    onHall={()=>{go('hall',true);setHallTarget({archiveId:archive.id});}} onNew={()=>go('new')}/>;
  else if(screen==='hall-registration'&&archiveToRegister)content=<div className="stack hall-registration">
    <section className="panel content-panel">
      <h2>{archiveToRegister.name}의 은퇴 기록</h2>
      {hallView.username?<>
        <p>등록하면 다른 라이더가 선수의 프로필을 볼 수 있어요. 글로벌 순위는 서버가 경기 기록을 검증한 뒤 표시됩니다.</p>
        <PublicationStatus publication={pendingPublication}/>
      </>:<>
        <p>{archiveToRegister.reason==='complete'?'8년간 육성한 선수의 기록':'은퇴한 선수의 기록'}을 글로벌 랭킹에 등록하려면 로그인이 필요합니다.</p>
        <p>로그인하지 않아도 개인 선수 기록은 보관됩니다.</p>
      </>}
      <RegistrationError registration={registration} archiveId={archiveToRegister.id}/>
      <div className="bottom-actions hall-registration-actions">
        {hallView.username?!pendingPublication?.moderated&&<button className="button primary" disabled={!registration.ready||!!registration.working}
          onClick={()=>registerRider(archiveToRegister)}>{registration.working?'등록 중…':pendingPublication?.active?'내 글로벌 순위 확인':'명예의 전당 등록'}</button>:
          !registrationTarget?.form&&<>
            <button className="button primary" onClick={()=>setRegistrationTarget({archiveId:archiveToRegister.id,form:'login'})}>로그인</button>
            <button className="button secondary" onClick={()=>setRegistrationTarget({archiveId:archiveToRegister.id,form:'register'})}>회원가입</button>
          </>}
        <button className="button quiet" onClick={back}>나중에 등록</button>
      </div>
    </section>
    {!hallView.username&&registrationTarget?.form&&<Account key={registrationTarget.form} view={hallView} send={game.send} onSwitch={playHome}
      registrationMode={registrationTarget.form} onSessionChange={changeSession}/>}
  </div>;
  else if(screen==='menu')content=<div className="console-menu">
    {menuGroups.filter(group=>r||group.name==='기록').map(group=><section key={group.name}>
      <h2>{group.name}</h2>
      {group.items.map(([id,Icon])=><button key={id} onClick={()=>go(id)}><Icon size={18}/><span>{names[id]}</span><ArrowRight size={16}/></button>)}
    </section>)}
  </div>;
  else if(r){
    if(screen==='training')content=<AutoSettings key={r.id} r={r} send={game.send} saving={game.saving} onApplied={playHome}/>;
    else if(screen==='skills')content=<Skills r={r}/>;
    else if(screen==='routine')content=<Routines r={r} send={game.send} saving={game.saving}
      draft={lineDraft?.rider===r.id?lineDraft.value:undefined} onDraft={value=>setLineDraft({rider:r.id,value})}/>;
    else if(screen==='meets')content=<Meets r={r} onPlay={openReplay} onEntry={playHome} onLine={()=>go('routine',true)} onLoadRecord={game.loadReplay}
      selection={meetSelection?.rider===r.id?meetSelection.value:undefined} onSelection={value=>setMeetSelection({rider:r.id,value})}/>;
    else if(screen==='rank')content=<Rankings r={r}/>;
    else if(screen==='workshop')content=<Workshop r={r} send={game.send} saving={game.saving}
      lookDraft={lookDraft?.rider===r.id?lookDraft.value:undefined} onLookDraft={value=>setLookDraft({rider:r.id,value})}/>;
    else if(screen==='profile')content=<Profile r={r} send={game.send} saving={game.saving||busyFlow} onNew={()=>go('new',true)} onHall={()=>go('hall',true)}/>;
    else if(screen==='rivals')content=<Rivals r={r} send={game.send} saving={game.saving}/>;
    else if(screen==='journal')content=<div className="console-journal"><NewsCard r={{...r,news:r.news.slice(0,100)}}/>{r.news.slice(5).map((note,i)=><p key={i}><b>{formatCareerDate(note)}</b> {lineTerms(note.text)}</p>)}</div>;
  }
  return <div className="console-page"><main className="game-console" aria-label="롱보더 키우기">
    <header className="console-top"><button className="console-brand" onClick={playHome} aria-label="게임 홈"><Brand/></button>
      {r?<div className="console-rider"><span>{r.name}</span><b>{formatCareerDate(r)}</b><small>{DIVISION_NAMES[divisionFor(r.year)]}</small></div>:<span className="console-motto">나만의 롱보드 커리어</span>}
      <div className="console-top-actions">{active&&<button aria-label="자동 육성 설정" title="자동 육성 설정" onClick={()=>go('training')}><Settings size={18}/></button>}{active&&<button className={'console-auto '+(r!.settings.mode==='auto'?'is-on':'')} aria-label="자동 진행" aria-pressed={r!.settings.mode==='auto'} disabled={game.saving} onClick={async()=>{if(await game.send({type:'settings',settings:{...r!.settings,mode:r!.settings.mode==='auto'?'manual':'auto',pauseStory:false,pauseMeet:false,pauseInjury:false}}))playHome();}}>{r!.settings.mode==='auto'?'AUTO ON':'AUTO OFF'}</button>}{(game.saving||view.storage==='neon')&&<span className="console-save" role="status">{game.saving?'저장 중':'저장됨'}</span>}<button aria-label="라이더 일지" onClick={()=>go(r?'journal':'menu')}><NotebookText size={18}/></button><button aria-label="계정" onClick={()=>go('account')}><UserRound size={18}/></button></div>
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
        {r.phase==='retired'&&<div className="console-home-actions"><button className="console-primary" onClick={()=>{setEndingId(r.id);setEndingStep(0);go('ending');}}>은퇴식 보기 <Trophy size={18}/></button><button onClick={()=>go('new')}>새 선수 육성</button></div>}
      </>:<div className="console-welcome"><span>{ENGLISH_GAME_NAME}</span><h1>롱보더 <br/><em>키우기</em></h1><p>강변의 첫 푸시부터 마지막 국제대회까지.<br/>나만의 8년 커리어를 시작하세요.</p><button className="console-primary" onClick={()=>go('new')}>나만의 라이더 만들기 <ArrowRight size={20}/></button></div>)}
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
      <LookFields look={look} onChange={setLook} chooseGender>
        <label className="console-create-name">라이더 이름
          <input aria-label="라이더 이름" value={name} onChange={e=>setName(e.target.value)} required minLength={1} maxLength={16} autoComplete="off"/>
        </label>
      </LookFields>
    </div>
    <button type="submit" className="button primary" disabled={saving||!name.trim()}>육성 시작 <ArrowRight size={17}/></button>
  </form>;
}
