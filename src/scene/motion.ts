import { SKILL } from '../game/data';
import type { Outcome } from '../game/types';

export type Motion = 'rest'|'mount'|'ride'|'accelerate'|'brake'|'carve'|'step'|'cross'|'spin'|'double-spin'|'jump'|'shove'|'flip'|'heel'|'land'|'wobble'|'fall'|'success'|'great'|'win'|'lose';

const characterMotion: Record<string,Motion> = {
  'peter-pan':'step','step-180':'spin','step-360':'double-spin',cross:'cross','back-cross':'cross',sidewinder:'carve','v-spin':'double-spin',
  ghost:'mount',piglet:'jump',mango:'shove',wood:'jump',pirouette:'spin','mango-pendulum':'carve',
  'pirouette-540':'double-spin',pendulum:'carve','pirouette-720':'double-spin',
  pivot:'spin',shuvit:'shove','no-comply':'jump',kickflip:'flip','no-com-big':'shove',bigspin:'double-spin',
  'front-pop':'jump','pop-shuvit':'shove',heelflip:'heel',bigger:'double-spin',hardflip:'flip',treflip:'heel',varial:'flip',
};

export function moveMotion(id:string, progress:number, outcome:Outcome='clean'):Motion {
  const action=characterMotion[id]??'ride';
  if(progress<.16) return SKILL[id]?.family==='dance'?'carve':'accelerate';
  if(progress<.64) return action;
  if(outcome==='miss') return progress<.78?'wobble':'fall';
  if(progress<.82) return outcome==='rough'?'wobble':'land';
  if(outcome==='great') return 'great';
  return outcome==='clean'?'success':'brake';
}
