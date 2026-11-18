import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { GameAction, View } from '../src/game/types';
const base=new URL(process.argv[2]??'http://127.0.0.1:5188');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw new Error('This equipment verification is restricted to the isolated local preview.');
let cookie='',view:View;
const tab=randomUUID();
async function read(){const response=await fetch(new URL('/api/game',base),{headers:cookie?{cookie}:{}});assert.ok(response.ok);cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;view=await response.json() as View;return view;}
async function post(action:GameAction){return fetch(new URL('/api/game',base),{method:'POST',headers:{cookie,origin:base.origin,'Content-Type':'application/json'},body:JSON.stringify({tab,version:view.version,stateVersion:view.stateVersion,scope:view.scope,action})});}
async function send(action:GameAction){const response=await post(action);const data=await response.json();assert.ok(response.ok,data.error);view=data;return view;}
await read();assert.equal(view!.storage,'local');
await send({type:'create',name:'장비 개편 검증',look:{hair:0,skin:0,shirt:0,board:4,gender:'female'}});
assert.equal(view!.career.rider!.extras!.inventory.length,3);
for(const id of ['deck_002','truck_002','wheel_002']){await send({type:'trade',operation:'buy',item:id});await send({type:'trade',operation:'equip',item:id});}
const purchases=await Promise.all([post({type:'trade',operation:'buy',item:'acc_001'}),post({type:'trade',operation:'buy',item:'acc_001'})]);
assert.deepEqual(purchases.map(response=>response.status).sort(),[200,409]);await read();assert.equal(view!.career.rider!.extras!.inventory.filter(id=>id==='acc_001').length,1);
for(const id of ['acc_005','acc_009','acc_004'])await send({type:'trade',operation:'buy',item:id});
for(const id of ['acc_001','acc_005','acc_009'])await send({type:'trade',operation:'equip',item:id});
assert.equal((await post({type:'trade',operation:'equip',item:'acc_004'})).ok,false);
await send({type:'unequip',slot:'accessory',item:'acc_001'});await send({type:'trade',operation:'equip',item:'acc_004'});
const equipment=structuredClone(view!.career.rider!.extras!.equipped),accessories=[...view!.career.rider!.extras!.accessories!];
await read();assert.deepEqual(view!.career.rider!.extras!.equipped,equipment);assert.deepEqual(view!.career.rider!.extras!.accessories,accessories);
console.log('PASS starter seed, underscored IDs, concurrent purchase paid once, three accessory slots, unequip and durable reload');
await send({type:'plan',plan:{action:'link',spot:'plaza'}});await new Promise(resolve=>setTimeout(resolve,2200));await send({type:'pulse'});
assert.ok(view!.pendingTraining);assert.equal(view!.career.rider!.energy,84);assert.ok(view!.career.rider!.stats.link>=14);
await send({type:'continue-training',record:view!.pendingTraining!});if(view!.career.rider!.phase==='event')await send({type:'event',index:0});
if(view!.pendingEvent)await send({type:'continue-event',record:view!.pendingEvent.key});
console.log('PASS equipped training cost and permanent stat gain through HTTP + PostgreSQL');
await send({type:'settings',settings:{mode:'auto',strategy:'balanced',entries:['dance']}});
const deadline=Date.now()+50000;
while(!view!.pendingMeet&&Date.now()<deadline){
  if(view!.pendingTraining)await send({type:'continue-training',record:view!.pendingTraining!});
  if(view!.pendingEvent)await send({type:'continue-event',record:view!.pendingEvent.key});
  if(view!.pendingMeet)break;
  if(view!.pendingChoice)await send({type:'start-training',record:view!.pendingChoice!});
  await new Promise(resolve=>setTimeout(resolve,2200));await send({type:'pulse'});
}
assert.ok(view!.pendingMeet);assert.equal(view!.career.rider!.records[0].results.length,1);
assert.deepEqual(view!.career.rider!.extras!.equipped,equipment);assert.deepEqual(view!.career.rider!.extras!.accessories,accessories);
if(view!.pendingTraining)await send({type:'continue-training',record:view!.pendingTraining!});
  if(view!.pendingEvent)await send({type:'continue-event',record:view!.pendingEvent.key});
await send({type:'continue-meet',record:view!.pendingMeet!});
await send({type:'settings',settings:{...view!.career.rider!.settings,mode:'manual'}});
await send({type:'trade',operation:'sell',item:'acc_001'});await read();assert.ok(!view!.career.rider!.extras!.inventory.includes('acc_001'));
console.log('PASS automatic tournament keeps the loadout, records one result, then selling persists');
console.log('Equipment application end-to-end verification passed.');
