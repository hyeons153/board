import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, ChevronRight, CircleAlert, CirclePlay, Flag, LayoutGrid, ListOrdered, Radio, Timer, Trophy, UserRound, X, Zap } from 'lucide-react';
import { divisionFor } from './game/career';
import { CALENDAR, DIVISION_NAMES } from './game/data';
import { useGame } from './useGame';
import Start from './components/Start';
import { Brand, Tag } from './components/Brand';
import { MeetNotice, NewsCard, RiderCard, SeasonStrip, Training, Upcoming, when } from './components/Overview';
import { Skills, Routines } from './components/Skills';
import { Meets, Race } from './components/Meets';
import { Hall, Profile, Rankings } from './components/Records';
import Workshop from './components/Workshop';
import { ShoppingBag } from 'lucide-react';
import { equippedLook } from './game/economy';
import { PixelRider } from './components/Appearance';
import Account from './components/Account';
import OnlineHall from './components/OnlineHall';
import Ceremony from './components/Ceremony';

const routes=[
  {id:'overview',name:'육성 홈',icon:LayoutGrid,label:'CAREER HUB'},
  {id:'skills',name:'기술 도감',icon:BookOpen,label:'TRICK LIBRARY'},
  {id:'routine',name:'루틴 편집',icon:ListOrdered,label:'ROUTINE STUDIO'},
  {id:'meets',name:'대회 일정',icon:CalendarDays,label:'COMPETITIONS'},
  {id:'rank',name:'시즌 랭킹',icon:Flag,label:'SEASON STANDINGS'},
  {id:'workshop',name:'장비·스폰서',icon:ShoppingBag,label:'BOARD SHOP'},
  {id:'profile',name:'선수 정보',icon:UserRound,label:'RIDER PROFILE'},
  {id:'hall',name:'명예의 전당',icon:Trophy,label:'HALL OF FAME'},
  {id:'online',name:'온라인 명예의 전당',icon:Trophy,label:'GLOBAL HALL'},
  {id:'account',name:'계정 관리',icon:UserRound,label:'RIDER ACCOUNT'},
] as const;
type Route=typeof routes[number]['id'];

export default function App(){
  const game=useGame();
  const [route,setRoute]=useState<Route>(()=>new URLSearchParams(location.search).has('rider')?'online':'overview');
  const [target,setTarget]=useState<string>();
  const [title,setTitle]=useState<'new'|'hall'|'account'|'online'|null>(()=>new URLSearchParams(location.search).has('rider')?'online':null);
  const [publicId,setPublicId]=useState(()=>new URLSearchParams(location.search).get('rider')??undefined);
  const [endingId,setEndingId]=useState<string>();
  const previous=useRef<{id:string;phase:string}|undefined>(undefined);
  const [showReplay,setShowReplay]=useState(false);
  const view=game.view;
  const r=view?.career.rider;
  const lastPhase=r?.phase;
  const activeId=r?.id;
  useEffect(()=>{
    if(activeId&&lastPhase==='retired'&&previous.current?.id===activeId&&previous.current.phase!=='retired') setEndingId(activeId);
    if(activeId&&lastPhase) previous.current={id:activeId,phase:lastPhase};
  },[activeId,lastPhase]);
  const selectPublic=(id?:string)=>{
    setPublicId(id);
    const url=new URL(location.href);
    if(id) url.searchParams.set('rider',id);else url.searchParams.delete('rider');
    history.replaceState(null,'',url);
  };
  const go=(next:Route)=>{
    setRoute(next);setTarget(undefined);setShowReplay(false);setEndingId(undefined);window.scrollTo({top:0,behavior:'instant'});
    if(next!=='online'&&publicId) selectPublic(undefined);
  };
  const notice=game.error&&<div className="toast" role="alert"><CircleAlert size={18}/><span>{game.error}</span>
    {/세션|로그인 상태/.test(game.error)&&<button className="button secondary small" onClick={()=>location.reload()}>다시 연결</button>}
    <button className="icon-button" aria-label="오류 닫기" onClick={game.dismiss}><X size={17}/></button></div>;
  if(!view)return <main className="boot"><Brand/>{game.error?<><p>{game.error}</p><button className="button primary" onClick={()=>void game.load()}>다시 연결 <ArrowRight size={17}/></button></>:<p role="status">라이더 기록을 불러오는 중…</p>}</main>;
  const archive=view.career.hall.find(item=>item.id===endingId);
  if(archive)return <div className="start-page hall-page"><header className="start-header"><Brand/><button className="button quiet" onClick={()=>setEndingId(undefined)}>돌아가기</button></header>
    <Ceremony key={archive.id} archive={archive} onHall={()=>{setEndingId(undefined);if(r&&title!=='new'){setTitle(null);go('hall');}else setTitle('hall');}}
      onNew={()=>{setEndingId(undefined);setTitle(r?.phase==='retired'||!r?'new':null);go('overview');}}/>
  </div>;
  if(title==='hall')return <Hall hall={view.career.hall} view={view} standalone onEnding={setEndingId} onAccount={()=>setTitle('account')} onBack={()=>setTitle(r?'new':null)}/>;
  if((!r||title==='new')&&(title==='account'||title==='online'||route==='online')){
    const online=title==='online'||route==='online'&&title!=='account';
    return <div className="start-page hall-page"><header className="start-header"><Brand/><button className="button quiet" onClick={()=>{setTitle(r?'new':null);go('overview');}}>돌아가기</button></header>
      {online?<OnlineHall view={view} initialId={publicId} onSelect={selectPublic}/>:<Account view={view} send={game.send} onSwitch={()=>{setTitle(null);go('overview');}}/>}
    </div>;
  }
  if(!r||title==='new')return <>{notice}<Start hasHall={!!view.career.hall.length} username={view.username} saving={game.saving}
    onHall={()=>setTitle('hall')} onOnline={()=>{setTitle('online');go('online');}} onAccount={()=>{setTitle('account');go('account');}} onCreate={async(name,look)=>{
    const ok=await game.send({type:'create',name,look});
    if(ok){setTitle(null);go('overview');}return ok;
  }}/></>;
  const screen=title==='account'?'account':route;
  const active=routes.find(t=>t.id===screen)!;
  const last=r.records.findLast(m=>m.results.length);
  const latestMeetLabel=last&&CALENDAR.find(m=>m.id===last.id)?.name;
  const auto=r.settings.mode==='auto';
  return <div className="shell">
    <a className="skip" href="#main">본문 바로가기</a>
    <aside className="sidebar">
      <button className="home-button" onClick={()=>{setTitle(null);go('overview');}} aria-label="LONGBOARD LIFE 홈"><Brand/></button>
      <nav aria-label="커리어 메뉴">{routes.filter(item=>item.id!=='account').map(item=><button key={item.id} className={screen===item.id?'active':''} aria-label={item.name} title={item.name} aria-current={screen===item.id?'page':undefined} onClick={()=>{setTitle(null);go(item.id);}}><item.icon size={18}/><span>{item.name}</span>{screen===item.id&&<ChevronRight size={14} className="nav-arrow"/>}</button>)}</nav>
      <div className="side-foot"><div className="mini-rider"><PixelRider look={equippedLook(r)}/></div><div><b>{r.name}</b><small>{DIVISION_NAMES[divisionFor(r.year)]} / {r.year}년차</small></div><span className="dot"/></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumbs"><span>LONGBOARD LIFE</span><ChevronRight size={13}/><b>{active.label}</b></div><div className="top-status"><span className="store-state"><span className="dot"/>{view.storage==='neon'?'NEON 저장':'로컬 저장'}</span><Tag kind={auto?'lime':'muted'}>{auto?<Zap size={13}/>:<Radio size={13}/>} {r.phase==='retired'?'은퇴':auto?'자동 육성':'직접 육성'}</Tag>
        <button className="button quiet small" onClick={()=>{setTitle(null);go('account');}}><UserRound size={14}/> {view.username??'계정·로그인'}</button></div></header>
      <main className="workspace-main" id="main">
        <header className="page-header"><div><div className="eyebrow">SEASON {String(r.year).padStart(2,'0')} <span className="text-lime">/</span> WEEK {String(r.week).padStart(2,'0')}</div><h1>{route==='overview'?'라이더 라운지':active.name}</h1><p>{route==='overview'?`${r.name} 라이더, 오늘은 어디에서 타볼까요?`:`${r.name} · ${r.year}년차 ${r.week}주 · ${DIVISION_NAMES[divisionFor(r.year)]}`}</p></div>
          {r.phase!=='retired'&&<div className="week-chip"><Timer size={18}/><span><small>{r.phase==='event'?'이벤트 선택 대기':r.phase==='meet'?'출전 선택 대기':r.phase==='injury'?'부상 확인 대기':game.remaining===0&&!r.plan&&!auto?'훈련 예약 대기':'다음 주 판정까지'}</small><b>{r.phase==='plan'?when(game.remaining):'—'}</b></span></div>}</header>
        {route!=='overview'&&(r.phase==='event'||r.phase==='meet')&&<div className="meet-notice panel"><CircleAlert size={19}/><div><b>{r.phase==='event'?'응답할 이벤트가 있어요.':'대회 출전을 선택해 주세요.'}</b><span>선택을 마치면 커리어가 이어집니다.</span></div><button className="button secondary small" onClick={()=>go(r.phase==='event'?'overview':'meets')}>바로 가기 <ArrowRight size={15}/></button></div>}
        {route==='overview'&&<div className="overview-grid">
          <div className="stack">
            {r.phase==='retired'&&<div className="meet-notice panel"><Trophy size={22}/><div><b>커리어 종료</b><span>명예의 전당에 {r.name} 선수의 기록이 남았습니다.</span></div><button className="button secondary small" onClick={()=>setEndingId(r.id)}>엔딩 보기</button><button className="button primary small" onClick={()=>setTitle('new')}>새 선수</button></div>}
            <MeetNotice r={r} onClick={()=>go('meets')}/>
            <Training key={r.id+'-'+(target??'weekly')} r={r} send={game.send} saving={game.saving} remaining={game.remaining} weekMs={view.weekMs} target={target}/>
          </div>
          <aside className="stack overview-aside"><RiderCard r={r}/><Upcoming r={r} onClick={()=>go('meets')}/><SeasonStrip r={r}/>
            {last&&<div className="panel quick-replay"><CirclePlay size={20}/><div><span>최근 경기</span><b>{latestMeetLabel}</b></div><button className="icon-button" aria-label="최근 경기 재생" onClick={()=>{go('meets');setShowReplay(true);}}><ArrowRight size={17}/></button></div>}
            <NewsCard r={r}/>
          </aside>
        </div>}
        {route==='skills'&&<Skills r={r} onTrain={id=>{go('overview');setTarget(id);}}/>}
        {route==='routine'&&<Routines r={r} send={game.send} saving={game.saving}/>}
        {route==='meets'&&(showReplay&&last?<Race record={last} r={r} onBack={()=>setShowReplay(false)}/>:<Meets r={r} send={game.send} saving={game.saving}/>)}
        {route==='rank'&&<Rankings r={r}/>}
        {route==='workshop'&&<Workshop key={r.id} r={r} send={game.send} saving={game.saving}/>}
        {route==='profile'&&<Profile r={r} send={game.send} saving={game.saving} onNew={()=>setTitle('new')} onHall={()=>go('hall')}/>}
        {screen==='hall'&&<Hall hall={view.career.hall} view={view} onEnding={setEndingId} onAccount={()=>go('account')}/>}
        {screen==='online'&&<OnlineHall view={view} initialId={publicId} onSelect={selectPublic}/>}
        {screen==='account'&&<Account view={view} send={game.send} onSwitch={()=>{setTitle(null);go('overview');}}/>}
        <footer className="workspace-footer"><span>LONGBOARD LIFE · CAREER SIM</span><span>{Math.round(view.weekMs/1000)}초 / 게임 내 1주</span></footer>
      </main>
    </div>
    {notice}
  </div>;
}
