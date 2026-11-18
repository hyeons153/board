import { useEffect, useRef } from 'react';

export const AUTO_FLOW={choiceMs:2000,resultMs:2000,ceremonyMs:2000} as const;

/** Presentation timers follow the scene identity, not the parent's render cadence. */
export function useAutoAdvance(key:string,active:boolean,delay:number,onAdvance:()=>void){
  const latest=useRef(onAdvance);
  useEffect(()=>{latest.current=onAdvance;},[onAdvance]);
  useEffect(()=>{
    if(!active)return;
    const timer=window.setTimeout(()=>latest.current(),delay);
    return ()=>window.clearTimeout(timer);
  },[key,active,delay]);
}
