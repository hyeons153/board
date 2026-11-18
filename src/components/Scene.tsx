import { useEffect, useRef, useState } from 'react';
import type { Look, Spot } from '../game/types';
import type { Stage } from '../scene/phaserScene';
import { armSounds, playFallChirp } from '../sounds';

type Props = { spot:Spot; look:Look; guest?:Look; motion?:Stage['motion']; technique?:Stage['technique']; variant?:Stage['variant'] };
export default function Scene({spot,look,guest,motion='ride',technique,variant='dashboard'}:Props){
  const host=useRef<HTMLDivElement>(null);
  const latest=useRef<Stage>({spot,look,guest,motion,technique,variant,reduce:false});
  const [failed,setFailed]=useState(false);
  const chick=look.equipment?.accessories.includes('chick');
  const wasFalling=useRef(false);
  useEffect(()=>{
    armSounds();const falling=motion==='fall'||technique?.outcome==='miss'&&(technique.progress??0)>.7;
    if(chick&&falling&&!wasFalling.current)playFallChirp();wasFalling.current=falling;
  },[chick,motion,technique?.id,technique?.outcome,technique?.progress]);
  useEffect(()=>{Object.assign(latest.current,{spot,look,guest,motion,technique,variant});},[spot,look,guest,motion,technique,variant]);
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
