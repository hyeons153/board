import { command, GameError, prepareWeek, processWeek } from '../src/game/career.js';
import type { Career, GameAction } from '../src/game/types.js';

export type Save = { format:1; career:Career; clock:{credit:number; stamp:number; tabs:Record<string,number>; fastForward?:boolean; pendingMeet?:string; pendingTraining?:string; stateVersion?:number} };
export const blankSave=():Save=>({format:1,career:{rider:null,hall:[]},clock:{credit:0,stamp:0,tabs:{}}});
export const remaining=(save:Save,weekMs:number)=>!save.clock.pendingMeet&&!save.clock.pendingTraining&&save.career.rider?.phase==='plan'&&(save.career.rider.plan||save.career.rider.settings.mode==='auto')?Math.max(0,(weekMs-save.clock.credit)/(save.clock.fastForward?2:1)):0;

export function advance(prev:Save,a:GameAction,tab:string,now:number,weekMs:number,identity:()=>{id:string;seed:number},official=false,account=false):Save {
  const next=structuredClone(prev);
  const r=next.career.rider;
  if((prev.clock.pendingTraining||prev.clock.pendingMeet)&&a.type==='settings'&&r){
    r.settings={...a.settings,pauseStory:false,pauseMeet:false,pauseInjury:false};
    next.clock.stateVersion=(prev.clock.stateVersion??0)+1;
    return next;
  }
  if(prev.clock.pendingTraining){
    if(a.type==='pulse')return prev;
    if(a.type!=='continue-training'||a.record!==prev.clock.pendingTraining)throw new GameError('이번 주 행동 결과를 먼저 확인해 주세요.');
    delete next.clock.pendingTraining;
    next.clock.credit=0;next.clock.stamp=now;next.clock.tabs={[tab]:now};
    next.clock.stateVersion=(prev.clock.stateVersion??0)+1;
    if(!next.clock.pendingMeet)prepareWeek(r);
    return next;
  }
  if(a.type==='continue-training')throw new GameError('이미 확인한 행동 결과입니다.');
  if(prev.clock.pendingMeet){
    if(a.type==='pulse') return prev;
    if(a.type!=='continue-meet'||a.record!==prev.clock.pendingMeet) throw new GameError('게임 화면에서 대회 결과를 확인하고 계속해 주세요.');
    delete next.clock.pendingMeet;
    next.clock.stateVersion=(prev.clock.stateVersion??0)+1;
    next.clock.credit=0;next.clock.stamp=now;next.clock.tabs={[tab]:now};
    prepareWeek(next.career.rider);
    return next;
  }
  if(a.type==='continue-meet') throw new GameError('이미 확인한 대회 결과입니다.');
  if(a.type==='pulse'&&(!r||r.phase==='retired')) return prev;
  const clock=next.clock;
  if(r?.settings.mode==='auto')Object.assign(r.settings,{pauseStory:false,pauseMeet:false,pauseInjury:false});
  const recordCount=r?.records.length??0;
  const holdMeet=()=>{
    const rider=next.career.rider;
    if(rider&&rider.id===r?.id&&rider.records.length>recordCount){
      const record=rider.records.at(-1)!;
      clock.pendingMeet=`${rider.id}:${record.year}:${record.id}`;
      clock.credit=0;clock.stamp=now;
      return true;
    }
    return false;
  };
  // Remove the retired speed preference from older saved clocks.
  Reflect.deleteProperty(clock,'speed');
  // The ID lives in one loaded page. A new page cannot claim time since an earlier page closed.
  const joined=clock.tabs[tab];
  if(r?.phase==='plan'&&(r.plan||r.settings.mode==='auto')&&joined!==undefined) {
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
  if(rider?.settings.mode==='auto'){
    Object.assign(rider.settings,{pauseStory:false,pauseMeet:false,pauseInjury:false});
    if(rider.phase==='injury')command(next.career,{type:'resume'},identity,official,account);
    else if(rider.phase==='event'||rider.phase==='meet')command(next.career,{type:'settings',settings:rider.settings},identity,official,account);
  }
  if(a.type==='plan'||(a.type==='settings'&&rider?.settings.mode==='auto'&&!prev.career.rider?.plan&&prev.career.rider?.settings.mode!=='auto')){
    clock.credit=0;clock.stamp=now;clock.tabs={[tab]:now};
  }
  prepareWeek(rider);
  for(let batch=0;!holdMeet()&&batch<8&&clock.credit>=weekMs;batch++){
    if(!processWeek(next.career,official)) break;
    clock.credit-=weekMs;
    if(next.career.rider?.settings.mode==='manual'){
      const result=next.career.rider.extras?.lastTraining;
      if(result){clock.pendingTraining=next.career.rider.id+':'+result.year+':'+result.week;clock.credit=0;clock.stamp=now;holdMeet();break;}
    }
    if(!holdMeet())prepareWeek(next.career.rider);
  }
  holdMeet();
  if(rider?.phase!=='plan') { clock.credit=0; clock.stamp=now; }
  // Heartbeats change storage versions, but only game changes invalidate a player's selection.
  const phase=(save:Save)=>{
    const rider=save.career.rider;
    return [rider?.id,rider?.year,rider?.week,rider?.phase,rider?.event,rider?.plan?.action,rider?.records.length,save.clock.pendingMeet,save.clock.pendingTraining].join(':');
  };
  if(a.type!=='pulse'||phase(next)!==phase(prev)) clock.stateVersion=(prev.clock.stateVersion??0)+1;
  return next;
}
