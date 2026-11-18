import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameAction, View } from './game/types';

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
      const response=await fetch('/api/game',{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error);
      if(current.current?.scope!==data.scope){
        current.current=null;tab.current=crypto.randomUUID();
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
        const response=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tab:tab.current,version:current.current!.version,stateVersion:current.current!.stateVersion,scope:current.current!.scope,action})});
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
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{if(!syncNote)return;const timer=window.setTimeout(()=>setSyncNote(''),5000);return ()=>window.clearTimeout(timer);},[syncNote]);
  const active=!!view?.career.rider&&view.career.rider.phase!=='retired';
  const training=!!view?.career.rider?.plan;
  useEffect(()=>{
    if(!active)return;
    let stopped=false;
    let timer:number|undefined;
    let ticking=false;
    const tick=async()=>{
      if(ticking)return;
      ticking=true;
      await send({type:'pulse'});
      ticking=false;
      if(stopped)return;
      const latest=current.current;
      const remaining=latest?.remainingMs??0;
      timer=window.setTimeout(tick,remaining>0?Math.min(8000,Math.max(350,remaining)):8000);
    };
    const wake=()=>{
      if(document.hidden)return;
      window.clearTimeout(timer);void tick();
    };
    const leave=()=>{
      const latest=current.current;
      if(!latest)return;
      void fetch('/api/game',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({tab:tab.current,version:latest.version,scope:latest.scope,action:{type:'pulse'}})}).catch(()=>{});
    };
    document.addEventListener('visibilitychange',wake);
    window.addEventListener('pagehide',leave);
    const ticker=window.setInterval(()=>setNow(performance.now()),100);
    void tick();
    return ()=>{stopped=true;window.clearTimeout(timer);window.clearInterval(ticker);document.removeEventListener('visibilitychange',wake);window.removeEventListener('pagehide',leave);};
  },[active,training,view?.pendingTraining,view?.pendingMeet,view?.pendingChoice,view?.fastForward,send]);
  const remaining=view?Math.max(0,view.remainingMs-(now-time.current)):0;
  return {view,send,saving,error,syncNote,load,remaining,dismiss:()=>setError('')};
}
