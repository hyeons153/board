import { useEffect, useRef } from 'react';

export { AUTO_FLOW } from './game/data';

/** Presentation timers follow the scene identity, not the parent's render cadence. */
export function useAutoAdvance(key:string,active:boolean,delay:number,onAdvance:()=>void){
  const latest=useRef(onAdvance);
  useEffect(()=>{latest.current=onAdvance;},[onAdvance]);
  useEffect(()=>{
    if(!active)return;
    let timer:number|undefined;
    const sync=()=>{
      window.clearTimeout(timer);
      if(!document.hidden)timer=window.setTimeout(()=>{if(!document.hidden)latest.current();},delay);
    };
    sync();
    document.addEventListener('visibilitychange',sync);
    return ()=>{window.clearTimeout(timer);document.removeEventListener('visibilitychange',sync);};
  },[key,active,delay]);
}
