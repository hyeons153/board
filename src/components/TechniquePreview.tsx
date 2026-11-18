import { equippedLook } from '../game/economy';
import type { Outcome, Rider } from '../game/types';
import Scene from './Scene';

export function TechniquePreview({r,id,outcome='clean'}:{r:Rider;id:string;outcome?:Outcome}){
  return <div className="technique-preview">
    <Scene spot={r.spot} look={equippedLook(r)} technique={{id,outcome}} variant="preview"/>
  </div>;
}
