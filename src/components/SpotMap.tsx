import { Check, LockKeyhole, MapPin, X } from 'lucide-react';
import { ACTION_NAMES, LOCATIONS } from '../game/data';
import { SPOT_GATE, spotRegulars, spotUnlocked, spotVisitor } from '../game/content';
import { SPOTS, type Rider } from '../game/types';
import type { Submit } from './Overview';

export function SpotMap({r,send,saving,onClose}:{r:Rider;send:Submit;saving:boolean;onClose:()=>void}){
  return <section className="spot-map" aria-label="스팟 지도">
    <header><div><span>SPOT MAP</span><h2><MapPin size={18}/> 오늘 어디에서 탈까요?</h2></div><button onClick={onClose} aria-label="스팟 지도 닫기"><X size={18}/></button></header>
    <p className="spot-map-guide">스팟을 선택하면 배경과 훈련 보너스가 바뀝니다. 이동만으로 주차나 체력이 소모되지는 않아요.</p>
    <div className="spot-map-grid">{SPOTS.map(id=>{
      const spot=LOCATIONS[id],locked=!spotUnlocked(r,id),regulars=spotRegulars(id),bonus=Math.round((spot.boost-1)*100);
      return <button className={'spot-map-card spot-map-'+id+(r.spot===id?' is-current':'')} key={id} aria-label={spot.name+' 이동'} aria-pressed={r.spot===id} disabled={saving||locked} onClick={async()=>{if(r.spot===id||await send({type:'spot',spot:id}))onClose();}}>
        <div className="spot-map-scene" aria-hidden="true"><i/><span>{spot.en}</span>{r.spot===id&&<Check size={17}/>}</div>
        <strong>{locked&&<LockKeyhole size={13}/>} {spot.name}</strong><small>{spot.detail}</small>
        <span className="spot-map-bonus">{spot.boosted.map(action=>ACTION_NAMES[action]).join(' · ')} 성장 +{bonus}%</span>
        <span className="spot-map-visitor">자주 오는 라이더 · {regulars.map(npc=>npc.name).join(' · ')}</span>
        {!locked&&<span className="spot-map-extra">이번 주 방문 · {spotVisitor(r,id).name}</span>}
        {id==='night'&&<span className="spot-map-extra">고급 지정 기술 연마 추가 +9%</span>}
        {['studio','night','arena'].includes(id)&&<span className="spot-map-extra">지정 기술 개인 레슨 가능</span>}
        {locked&&<span className="spot-map-lock">{SPOT_GATE[id]?.hint}</span>}
      </button>;
    })}</div>
  </section>;
}
