import { command, GameError, prepareWeek, processWeek } from '../src/game/career.js';
import type { Career, GameAction } from '../src/game/types.js';

export type Save = { format:1; career:Career; clock:{credit:number; stamp:number; tabs:Record<string,number>; readyAt?:number; fastForward?:boolean; pendingMeet?:string; pendingTraining?:string; stateVersion?:number} };
export const blankSave=():Save=>({format:1,career:{rider:null,hall:[]},clock:{credit:0,stamp:0,tabs:{}}});
export const remaining=(save:Save,weekMs:number,now=Date.now())=>!save.clock.pendingMeet&&!save.clock.pendingTraining&&save.career.rider?.phase==='plan'&&!!save.career.rider.plan?Math.max(0,(save.clock.readyAt??now+weekMs)-now):0;

export function advance(prev:Save,a:GameAction,tab:string,now:number,weekMs:number,identity:()=>{id:string;seed:number},official=false,account=false):Save {
  const next=structuredClone(prev),r=next.career.rider,clock=next.clock;
  const revise=()=>{clock.stateVersion=(prev.clock.stateVersion??0)+1;clock.credit=0;clock.stamp=now;clock.tabs={[tab]:now};return next;};
  Reflect.deleteProperty(clock,'speed');
  if((clock.pendingTraining||clock.pendingMeet)&&a.type==='settings'&&r){
    r.settings={...a.settings,pauseStory:false,pauseMeet:false,pauseInjury:false};return revise();
  }
  if(clock.pendingTraining){
    if(a.type==='pulse')return prev;
    if(a.type!=='continue-training'||a.record!==clock.pendingTraining)throw new GameError('이번 주 행동 결과를 먼저 확인해 주세요.');
    delete clock.pendingTraining;if(!clock.pendingMeet){prepareWeek(r);if(r?.plan)clock.readyAt=now+weekMs;}return revise();
  }
  if(a.type==='continue-training')throw new GameError('이미 확인한 행동 결과입니다.');
  if(clock.pendingMeet){
    if(a.type==='pulse')return prev;
    if(a.type!=='continue-meet'||a.record!==clock.pendingMeet)throw new GameError('게임 화면에서 대회 결과를 확인하고 계속해 주세요.');
    delete clock.pendingMeet;prepareWeek(r);if(r?.plan)clock.readyAt=now+weekMs;return revise();
  }
  if(a.type==='continue-meet')throw new GameError('이미 확인한 대회 결과입니다.');
  const count=r?.records.length??0;
  const holdMeet=()=>{const rider=next.career.rider;if(rider?.id===r?.id&&rider&&rider.records.length>count){const record=rider.records.at(-1)!;clock.pendingMeet=rider.id+':'+record.year+':'+record.id;return true;}return false;};
  if(a.type==='fast-forward'){
    if(!r||r.phase==='retired')throw new GameError('진행 중인 커리어에서 선택해 주세요.');
    clock.fastForward=a.enabled;
  }else command(next.career,a,identity,official,account);
  const rider=next.career.rider;
  if(rider?.settings.mode==='auto'){
    Object.assign(rider.settings,{pauseStory:false,pauseMeet:false,pauseInjury:false});
    if(rider.phase==='injury')command(next.career,{type:'resume'},identity,official,account);
    else if(rider.phase==='event'||rider.phase==='meet')command(next.career,{type:'settings',settings:rider.settings},identity,official,account);
  }
  const newMeet=holdMeet();
  if(a.type==='create'||a.type==='switch-rider'||newMeet)delete clock.readyAt;
  if(!newMeet&&rider?.phase==='plan'&&(rider.plan||rider.settings.mode==='auto')){
    prepareWeek(rider);
    if(clock.readyAt===undefined){clock.readyAt=now+weekMs;return revise();}
    if(a.type==='pulse'&&now>=clock.readyAt&&processWeek(next.career,official)){
      delete clock.readyAt;
      const result=rider.extras?.lastTraining;
      if(result)clock.pendingTraining=rider.id+':'+result.year+':'+result.week;
      holdMeet();
      return revise();
    }
  }
  if(rider?.phase!=='plan')delete clock.readyAt;
  if(a.type==='pulse'&&!newMeet)return prev;
  return revise();
}
