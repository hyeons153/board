import { divisionFor, singleEntry } from '../src/game/career.js';
import { extras } from '../src/game/economy.js';
import { randomSpecialTraining } from '../src/game/training.js';
import type { View } from '../src/game/types.js';
import { remaining } from './clock.js';
import type { Row } from './store.js';

export const gameView=(row:Row,weekMs:number,storage:View['storage'],username?:string,scope?:string,compact=false,tab?:string):View=>{
    const career=row.snapshot.career;
    const records=(meets:typeof career.hall[number]['records'],opponents:boolean)=>meets.map(meet=>{
      const summary=compact&&(!opponents||career.rider?.id+':'+meet.year+':'+meet.id!==row.snapshot.clock.pendingMeet);
      return {...meet,...(compact?{detail:summary?'summary' as const:'full' as const}:{}),results:meet.results.map(({proof,opponents:replays,...result})=>summary?{...result,run:{...result.run,log:[],highlight:result.run.log.find(move=>move.outcome==='great')??result.run.log.find(move=>move.outcome==='clean')}}:opponents?{...result,opponents:replays}:result)};
    });
    const hall=career.hall.map(archive=>({...archive,records:records(archive.records,false)}));
    const active=career.rider;
    const rider=active?{...active,settings:{...active.settings,entries:singleEntry(active.settings.entries)},extras:extras(active),seed:0,
      trainingOffer:active.phase==='plan'?randomSpecialTraining(active)??null:null,
      season:{...active.season,division:divisionFor(active.year)},records:records(active.records,true)}:null;
    const parked=career.parked?.map(item=>({...item,seed:0,records:records(item.records,false)}));
    const background=row.snapshot.clock.background;
    const backgroundMs=background&&background.tab===tab?Math.max(0,background.at-Date.now()):undefined;
    return {career:{rider,hall,...(parked?.length?{parked}:{})},version:row.version,stateVersion:row.snapshot.clock.stateVersion??0,remainingMs:remaining(row.snapshot,weekMs),weekMs,fastForward:false,pendingMeet:row.snapshot.clock.pendingMeet,pendingTraining:row.snapshot.clock.pendingTraining,pendingChoice:row.snapshot.clock.pendingChoice,pendingEvent:row.snapshot.clock.pendingEvent,backgroundMs,storage,username,scope};
  };
