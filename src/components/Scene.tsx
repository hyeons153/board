import { useEffect, useRef, useState } from 'react';
import type { Look, Spot } from '../game/types';
import type { Stage } from '../scene/phaserScene';

type Props = { spot:Spot; look:Look; guest?:Look; motion?:Stage['motion']; variant?:Stage['variant'] };
export default function Scene({spot,look,guest,motion='ride',variant='dashboard'}:Props){
  const host=useRef<HTMLDivElement>(null);
  const latest=useRef<Stage>({spot,look,guest,motion,variant,reduce:false});
  const [failed,setFailed]=useState(false);
  useEffect(()=>{Object.assign(latest.current,{spot,look,guest,motion,variant});},[spot,look,guest,motion,variant]);
  useEffect(()=>{
    let cancelled=false;
    let game:ReturnType<typeof import('../scene/phaserScene')['createStage']>|undefined;
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>{latest.current.reduce=media.matches;};
    sync();
    media.addEventListener('change',sync);
    import('../scene/phaserScene').then(({createStage})=>{
      if(!cancelled&&host.current) game=createStage(host.current,()=>latest.current);
    }).catch(()=>{if(!cancelled)setFailed(true);});
    return ()=>{cancelled=true;media.removeEventListener('change',sync);game?.destroy(true);};
  },[]);
  return <div className="scene-media" ref={host} aria-hidden="true">{failed&&<span className="scene-unavailable">스팟 미리보기 준비 중</span>}</div>;
}
