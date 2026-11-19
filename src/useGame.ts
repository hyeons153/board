import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameAction, MeetRecord, View } from './game/types';

export function useGame(){
  const [view,setView]=useState<View|null>(null);
  const current=useRef<View|null>(null);
  const tab=useRef(crypto.randomUUID());
  const time=useRef(0);
  const inFlight=useRef<Promise<boolean>|null>(null);
  const mutating=useRef(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [syncNote,setSyncNote]=useState('');
  const [now,setNow]=useState(0);
  const initial=useRef(false);
  const hiddenAuto=useRef(false);
  const apply=useCallback((update:View)=>{
    if(current.current&&update.version<current.current.version) return;
    current.current=update; time.current=performance.now(); setNow(time.current); setView(update);
  },[]);
  const load=useCallback(async()=>{
    if(initial.current)return;
    initial.current=true;
    if(inFlight.current) await inFlight.current;
    setError('');setSyncNote('');
    try{
      const response=await fetch('/api/game',{cache:'no-store',headers:{'X-Game-View':'compact'}});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      if(current.current?.scope!==data.scope){
        current.current=null;tab.current=crypto.randomUUID();hiddenAuto.current=false;
      }
      apply(data);
    }catch(e){setError(e instanceof Error?e.message:'저장 기록을 불러오지 못했어요.');}
    finally{initial.current=false;}
  },[apply]);
  const send=useCallback(async(action:GameAction)=>{
    const pulse=action.type==='pulse';
    if(!current.current||initial.current||mutating.current||(pulse&&inFlight.current)) return false;
    if(!pulse){
      mutating.current=true;setSaving(true);
      if(inFlight.current) await inFlight.current;
      setError('');
    }
    const request=(async()=>{
      try{
        const response=await fetch('/api/game',{method:'POST',keepalive:pulse&&!!action.background,headers:{'Content-Type':'application/json','X-Game-View':'compact',...(pulse?{'X-Game-Pulse':'minimal'}:{})},body:JSON.stringify({tab:tab.current,version:current.current!.version,stateVersion:current.current!.stateVersion,scope:current.current!.scope,action})});
        if(response.status===204&&pulse)return true;
        const data=await response.json();
        if(!response.ok){
          if(data.view)apply(data.view);
          if(response.status===409&&data.view){
            if(!pulse)setSyncNote('다른 화면의 변경을 반영했어요. 선택을 다시 확인해 주세요.');
            return false;
          }
          throw new Error(data.error);
        }
        apply(data);
        return true;
      }catch(e){
        setError(e instanceof Error?e.message:'요청을 보내지 못했어요.');
        return false;
      }
    })();
    inFlight.current=request;
    try { return await request; }
    finally {
      if(inFlight.current===request) inFlight.current=null;
      if(!pulse){mutating.current=false;setSaving(false);}
    }
  },[apply]);
  const loadReplay=useCallback(async(record:MeetRecord)=>{
    if(record.detail!=='summary')return record;
    const scope=current.current?.scope,riderId=current.current?.career.rider?.id;
    try{
      const response=await fetch('/api/game?replay='+encodeURIComponent(record.year+':'+record.id),{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      if(current.current?.scope!==scope||current.current?.career.rider?.id!==riderId)return;
      return data as MeetRecord;
    }catch(e){setError(e instanceof Error?e.message:'경기 기록을 불러오지 못했어요.');}
  },[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{if(!syncNote)return;const timer=window.setTimeout(()=>setSyncNote(''),5000);return ()=>window.clearTimeout(timer);},[syncNote]);
  const auto=view?.career.rider?.settings.mode==='auto';
  const active=!!view?.career.rider&&(view.career.rider.phase!=='retired'||!!(view.pendingTraining||view.pendingEvent||view.pendingMeet));
  const training=!!view?.career.rider?.plan;
  useEffect(()=>{
    if(!active)return;
    let stopped=false;
    let timer:number|undefined;
    let ticking=false;
    const schedule=()=>{
      const latest=current.current;
      const running=latest?.career.rider?.plan&&!latest.pendingChoice&&!latest.pendingTraining&&!latest.pendingEvent&&!latest.pendingMeet;
      const elapsed=performance.now()-time.current;
      const delay=hiddenAuto.current?(document.hidden?Math.max(250,Math.min(8000,latest?.backgroundMs===undefined?8000:latest.backgroundMs-elapsed)):250)
        :running?Math.max(100,latest!.remainingMs-elapsed):8000;
      timer=window.setTimeout(tick,delay);
    };
    const tick=async()=>{
      if(stopped||ticking)return;
      window.clearTimeout(timer);
      ticking=true;
      const hidden=document.hidden;
      if(hidden&&auto){
        hiddenAuto.current=true;
        await send({type:'pulse',background:'hidden'});
      }else if(!hidden&&hiddenAuto.current){
        const resumed=await send({type:'pulse',background:'visible'});
        if(resumed&&current.current?.backgroundMs===undefined)hiddenAuto.current=false;
      }else if(!hidden)await send({type:'pulse'});
      ticking=false;
      if(stopped)return;
      if(hidden!==document.hidden)void tick();
      else schedule();
    };
    const wake=()=>void tick();
    const leave=()=>{
      const latest=current.current;
      if(!latest)return;
      if(auto)hiddenAuto.current=true;
      void fetch('/api/game',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','X-Game-View':'compact','X-Game-Pulse':'minimal'},body:JSON.stringify({tab:tab.current,version:latest.version,scope:latest.scope,action:{type:'pulse',...(auto?{background:'hidden'}:{})}})}).catch(()=>{});
    };
    document.addEventListener('visibilitychange',wake);
    window.addEventListener('pagehide',leave);
    const ticker=training?window.setInterval(()=>setNow(performance.now()),100):undefined;
    if(auto&&document.hidden&&view?.backgroundMs===undefined&&!hiddenAuto.current)void tick();
    else schedule();
    return ()=>{stopped=true;window.clearTimeout(timer);window.clearInterval(ticker);document.removeEventListener('visibilitychange',wake);window.removeEventListener('pagehide',leave);};
  },[active,auto,training,view?.remainingMs,view?.pendingTraining,view?.pendingEvent?.key,view?.pendingMeet,view?.pendingChoice,view?.backgroundMs,view?.fastForward,send]);
  const remaining=view?Math.max(0,view.remainingMs-(now-time.current)):0;
  return {view,send,saving:saving||view?.backgroundMs!==undefined,error,syncNote,load,loadReplay,remaining,dismiss:()=>setError('')};
}
