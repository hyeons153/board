import { command, GameError, processWeek } from '../src/game/career.js';
import type { Career, GameAction } from '../src/game/types.js';

export type Save = { format:1; career:Career; clock:{credit:number; stamp:number; tabs:Record<string,number>; fastForward?:boolean} };
export const blankSave=():Save=>({format:1,career:{rider:null,hall:[]},clock:{credit:0,stamp:0,tabs:{}}});
export const remaining=(save:Save,weekMs:number)=>save.career.rider?.phase==='plan'?Math.max(0,(weekMs-save.clock.credit)/(save.clock.fastForward?2:1)):0;

export function advance(prev:Save,a:GameAction,tab:string,now:number,weekMs:number,identity:()=>{id:string;seed:number},official=false,account=false):Save {
  const next=structuredClone(prev);
  const r=next.career.rider;
  if(a.type==='pulse'&&(!r||r.phase==='retired')) return prev;
  const clock=next.clock;
  // Remove the retired speed preference from older saved clocks.
  Reflect.deleteProperty(clock,'speed');
  // The ID lives in one loaded page. A new page cannot claim time since an earlier page closed.
  const joined=clock.tabs[tab];
  if(r?.phase==='plan'&&joined!==undefined) {
    const elapsed=Math.min(5*60_000,Math.max(0,now-Math.max(clock.stamp,joined)));
    clock.credit=Math.min(clock.credit+elapsed*(prev.clock.fastForward?2:1),(r.settings.mode==='auto'?416:1)*weekMs);
    clock.stamp=Math.max(now,clock.stamp);
  }
  const tabs=Object.entries(clock.tabs).filter(([key,seen])=>key!==tab&&now-seen<=7*24*60*60*1000).sort((a,b)=>b[1]-a[1]).slice(0,15);
  clock.tabs=Object.fromEntries([...tabs,[tab,now]]);
  if(a.type==='create'||a.type==='switch-rider') {
    clock.credit=0; clock.stamp=now; clock.tabs={[tab]:now};
  }
  if(a.type==='fast-forward'){
    if(!r||r.phase==='retired') throw new GameError('진행 중인 커리어에서 배속을 선택해 주세요.');
    clock.fastForward=a.enabled;
  }else command(next.career,a,identity,official,account);
  const rider=next.career.rider;
  for(let batch=0;batch<8&&clock.credit>=weekMs;batch++){
    if(!processWeek(next.career,official)) break;
    clock.credit-=weekMs;
  }
  if(rider?.phase!=='plan') { clock.credit=0; clock.stamp=now; }
  return next;
}
