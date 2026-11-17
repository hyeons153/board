import { useEffect, useState } from 'react';
import { moveMotion } from '../scene/motion';
import { equippedLook } from '../game/economy';
import type { Outcome, Rider } from '../game/types';
import Scene from './Scene';

export function TechniquePreview({r,id,outcome='clean'}:{r:Rider;id:string;outcome?:Outcome}){
  const [progress,setProgress]=useState(0);
  useEffect(()=>{
    const start=performance.now();
    const timer=window.setInterval(()=>setProgress((performance.now()-start)%3300/3300),85);
    return ()=>window.clearInterval(timer);
  },[id]);
  return <div className="technique-preview">
    <Scene spot={r.spot} look={equippedLook(r)} motion={moveMotion(id,progress,outcome)} variant="preview"/>
  </div>;
}
