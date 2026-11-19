import { command, currentMeet, divisionFor, GameError, prepareWeek, processWeek, singleEntry, validateAutoEntries } from '../src/game/career.js';
import { extras } from '../src/game/economy.js';
import { AUTO_FLOW, RULES } from '../src/game/data.js';
import { eventFor } from '../src/game/events.js';
import { happeningDuration } from '../src/game/happenings.js';
import type { Career, EventOutcome, GameAction, TrainingSetup } from '../src/game/types.js';

export type Save = { format:1; career:Career; clock:{credit:number; stamp:number; tabs:Record<string,number>; readyAt?:number; fastForward?:boolean; pendingChoice?:string; pendingMeet?:string; pendingTraining?:string; pendingEvent?:EventOutcome; trainingSetup?:TrainingSetup; stateVersion?:number; background?:{tab:string;at:number}} };
export const blankSave=():Save=>({format:1,career:{rider:null,hall:[]},clock:{credit:0,stamp:0,tabs:{}}});
export const remaining=(save:Save,weekMs:number,now=Date.now())=>!save.clock.pendingChoice&&!save.clock.pendingEvent&&!save.clock.pendingMeet&&!save.clock.pendingTraining&&save.career.rider?.phase==='plan'&&!!save.career.rider.plan?Math.max(0,(save.clock.readyAt??now+weekMs)-now):0;
const awaitingDecision=(rider:Save['career']['rider'])=>rider?.phase==='event'&&(rider.settings.manualEvents||eventFor(rider,rider.event??'')?.decision);
const visibleEvent=(clock:Save['clock'])=>clock.pendingMeet&&clock.pendingEvent?.afterMeet?undefined:clock.pendingEvent;

export function advance(prev:Save,a:GameAction,tab:string,now:number,weekMs:number,identity:()=>{id:string;seed:number},official=false,account=false):Save {
  const run=(save:Save,action:GameAction,time:number)=>advanceOne(save,action,tab,time,weekMs,identity,official,account);
  const cursor=prev.clock.background;
  if(a.type!=='pulse'||!a.background||prev.career.rider?.settings.mode!=='auto'){
    const next=run(prev,a,now);
    if(next!==prev)delete next.clock.background;
    return next;
  }
  const visible=a.background==='visible';
  if(visible&&cursor?.tab!==tab)return run(prev,{type:'pulse'},now);
  // Keep one background clock per career. An abandoned tab's lease can be replaced without passing its elapsed time to a new tab.
  if(!visible&&cursor&&cursor.tab!==tab&&cursor.at>now-90_000)return prev;

  let next=prev;
  let at=cursor?.tab===tab?cursor.at:backgroundDeadline(next,now);
  for(let count=0;at!==undefined&&at<=now&&count<24;count++){
    const step=run(next,backgroundAction(next),at);
    if(step===next){at=undefined;break;}
    next=step;
    at=backgroundDeadline(next,at);
  }
  const background=at!==undefined&&(!visible||at<=now)?{tab,at}:undefined;
  if(next===prev&&cursor?.tab===background?.tab&&cursor?.at===background?.at)return prev;
  return {...next,clock:{...next.clock,background}};
}

function backgroundAction({clock}:Save):GameAction{
  if(clock.pendingTraining)return {type:'continue-training',record:clock.pendingTraining};
  const event=visibleEvent(clock);
  if(event)return {type:'continue-event',record:event.key};
  if(clock.pendingMeet)return {type:'continue-meet',record:clock.pendingMeet};
  if(clock.pendingChoice)return {type:'start-training',record:clock.pendingChoice};
  return {type:'pulse'};
}

function backgroundDeadline(save:Save,now:number){
  const {clock,career:{rider}}=save;
  if(clock.pendingTraining)return now+AUTO_FLOW.resultMs;
  const event=visibleEvent(clock);
  if(event)return now+(event.happening?happeningDuration(event.dialogue??''):AUTO_FLOW.resultMs);
  if(clock.pendingMeet){
    const runs=rider?.records.findLast(record=>rider.id+':'+record.year+':'+record.id===clock.pendingMeet)?.results.length??0;
    const runMs=rider?.settings.skipMeets?AUTO_FLOW.ceremonyMs:AUTO_FLOW.entryMs+RULES.runSeconds*1000+AUTO_FLOW.exitMs+AUTO_FLOW.ceremonyMs;
    return now+(runs?runs*runMs:AUTO_FLOW.resultMs);
  }
  if(!rider||rider.phase==='retired'||awaitingDecision(rider))return undefined;
  if(clock.pendingChoice)return now+AUTO_FLOW.choiceMs;
  return Math.max(now,clock.readyAt??now);
}

function advanceOne(prev:Save,a:GameAction,tab:string,now:number,weekMs:number,identity:()=>{id:string;seed:number},official:boolean,account:boolean):Save {
  if(a.type==='settings')validateAutoEntries(a.settings);
  if(a.type==='pulse'&&awaitingDecision(prev.career.rider))return prev;
  if(a.type==='pulse'&&(prev.clock.pendingTraining||prev.clock.pendingEvent||prev.clock.pendingMeet||prev.clock.pendingChoice||prev.career.rider?.phase==='retired'||(prev.clock.readyAt!==undefined&&prev.clock.readyAt>now)||(prev.career.rider?.phase==='plan'&&!prev.career.rider.plan&&prev.career.rider.settings.mode==='manual')))return prev;
  const next=structuredClone(prev),r=next.career.rider,clock=next.clock;
  if(r){r.settings.entries=singleEntry(r.settings.entries);if(r.entries&&!currentMeet(r)?.international)r.entries=singleEntry(r.entries);}
  const revise=()=>{clock.stateVersion=(prev.clock.stateVersion??0)+1;clock.credit=0;clock.stamp=now;clock.tabs={[tab]:now};return next;};
  Reflect.deleteProperty(clock,'speed');
  if(r)for(const item of [r.settings,r.plan,r.lastPlan])if(item)Reflect.deleteProperty(item,'intensity');
  if(r)r.season.division=divisionFor(r.year);
  const snapshotTraining=()=>{const rider=next.career.rider;if(rider){const gear=extras(rider);clock.trainingSetup=structuredClone({gear:{inventory:gear.inventory,equipped:gear.equipped,accessories:gear.accessories,equipmentVersion:gear.equipmentVersion},routines:rider.routines});}};
  const queueAction=()=>{
    const rider=next.career.rider;prepareWeek(rider);
    if(!rider?.plan)return;
    if(rider.settings.mode==='auto'){
      clock.pendingChoice=rider.id+':'+rider.year+':'+rider.week;
      delete clock.readyAt;
    }else {clock.readyAt=now+weekMs;snapshotTraining();}
  };
  // Management updates do not acknowledge a story or advance the weekly clock.
  if(['trade','unequip','sponsor','makeover','claim-gear','routine','representative-title'].includes(a.type)){
    if(r?.plan&&!clock.pendingChoice&&!clock.trainingSetup)snapshotTraining();
    command(next.career,a,identity,official,account);return revise();
  }
  if((clock.pendingTraining||clock.pendingEvent||clock.pendingMeet)&&a.type==='settings'&&r){
    r.settings={...a.settings,pauseStory:false,pauseMeet:false,pauseInjury:false};return revise();
  }
  if(clock.pendingTraining){
    if(a.type==='pulse')return prev;
    if(a.type!=='continue-training'||a.record!==clock.pendingTraining)throw new GameError('이번 주 행동 결과를 먼저 확인해 주세요.');
    delete clock.pendingTraining;if(!clock.pendingEvent&&!clock.pendingMeet)queueAction();return revise();
  }
  if(a.type==='continue-training')throw new GameError('이미 확인한 행동 결과입니다.');
  if(visibleEvent(clock)){
    if(a.type==='pulse')return prev;
    if(a.type!=='continue-event'||a.record!==clock.pendingEvent?.key)throw new GameError('이벤트 결과를 먼저 확인해 주세요.');
    delete clock.pendingEvent;if(!clock.pendingMeet)queueAction();return revise();
  }
  if(a.type==='continue-event')throw new GameError('이미 확인한 이벤트 결과입니다.');
  if(clock.pendingMeet){
    if(a.type==='pulse')return prev;
    if(a.type!=='continue-meet'||a.record!==clock.pendingMeet)throw new GameError('게임 화면에서 대회 결과를 확인하고 계속해 주세요.');
    delete clock.pendingMeet;if(!clock.pendingEvent)queueAction();return revise();
  }
  if(a.type==='continue-meet')throw new GameError('이미 확인한 대회 결과입니다.');
  if(clock.pendingChoice&&r){
    if(a.type==='pulse')return prev;
    if(a.type==='settings'){
      r.settings={...a.settings,pauseStory:false,pauseMeet:false,pauseInjury:false};
      if(r.settings.mode==='manual'){r.plan=null;delete clock.pendingChoice;delete clock.readyAt;}
      return revise();
    }
    if(a.type!=='start-training'||a.record!==clock.pendingChoice)throw new GameError('자동 행동을 선택하고 있어요. 잠시 기다려 주세요.');
    delete clock.pendingChoice;clock.readyAt=now+weekMs;snapshotTraining();return revise();
  }
  if(a.type==='start-training')throw new GameError('이미 시작했거나 변경된 행동입니다.');
  const count=r?.records.length??0;
  const eventKey=r?.extras?.lastEvent?.key;
  const holdEvent=()=>{const result=next.career.rider?.extras?.lastEvent;if(next.career.rider?.id===r?.id&&result&&result.key!==eventKey)clock.pendingEvent=structuredClone(result);};
  const holdMeet=()=>{const rider=next.career.rider;if(rider?.id===r?.id&&rider&&rider.records.length>count){const record=rider.records.at(-1)!;clock.pendingMeet=rider.id+':'+record.year+':'+record.id;return true;}return false;};
  if(a.type==='fast-forward'){
    if(!r||r.phase==='retired')throw new GameError('진행 중인 커리어에서 선택해 주세요.');
    clock.fastForward=a.enabled;
  }else command(next.career,a,identity,official,account);
  const rider=next.career.rider;
  if(rider?.settings.mode==='auto'){
    Object.assign(rider.settings,{pauseStory:false,pauseMeet:false,pauseInjury:false});
    if(rider.phase==='injury')command(next.career,{type:'resume'},identity,official,account);
    else if(rider.phase==='event'&&!awaitingDecision(rider)||rider.phase==='meet')command(next.career,{type:'settings',settings:rider.settings},identity,official,account);
  }
  const newMeet=holdMeet();holdEvent();
  if(clock.pendingEvent){delete clock.readyAt;return revise();}
  if(a.type==='create'||a.type==='switch-rider'||newMeet){delete clock.readyAt;delete clock.pendingChoice;}
  if(!newMeet&&rider?.phase==='plan'&&(rider.plan||rider.settings.mode==='auto')){
    if(clock.readyAt===undefined){queueAction();return revise();}
    if(a.type==='pulse'&&now>=clock.readyAt&&processWeek(next.career,official,clock.trainingSetup)){
      delete clock.readyAt;delete clock.trainingSetup;
      const result=rider.extras?.lastTraining;
      if(result)clock.pendingTraining=rider.id+':'+result.year+':'+result.week;
      holdMeet();holdEvent();return revise();
    }
  }
  if(rider?.phase!=='plan')delete clock.readyAt;
  if(a.type==='pulse'&&!newMeet)return prev;
  return revise();
}
