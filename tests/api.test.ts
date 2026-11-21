import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { actionSchema, createHandler } from '../server/http';
import { advance, blankSave } from '../server/clock';
import { localStore } from '../server/store';
import { AUTO_FLOW, BOARDS, BOTTOMS, DEFAULT_LOOK, EYE_COLORS, FOOTWEAR, HAIR_COLORS, HAIR_STYLES, OUTFITS, PANTS, SHIRTS, SHOES, SKINS } from '../src/game/data';
import { ECONOMY, playerPlace } from '../src/game/economy';
import { randomSpecialTraining } from '../src/game/training';
import type { View } from '../src/game/types';

test('a cached client submitting the removed lesson flag still starts ordinary practice',()=>{
  assert.deepEqual(actionSchema.parse({
    type:'plan',plan:{action:'dance',spot:'studio',skill:'mango',lesson:true},
  }),{type:'plan',plan:{action:'dance',spot:'studio',skill:'mango'}});
});

test('hidden auto mode follows server deadlines, keeps full competition records and resumes the visible flow',()=>{
  const identity=()=>({id:'background-rider',seed:73}),tab=randomUUID();
  const start=1_000_000,step=(save:ReturnType<typeof blankSave>,action:Parameters<typeof advance>[1],elapsed:number,by=tab)=>advance(save,action,by,start+elapsed,2000,identity);
  const created=step(blankSave(),{type:'create',name:'Background',look:DEFAULT_LOOK},0);
  assert.equal(step(created,{type:'pulse',background:'hidden'},100_000),created);
  const automatic=step(created,{type:'settings',settings:{mode:'auto',strategy:'balanced',entries:['dance']}},0);
  const hidden=step(automatic,{type:'pulse',background:'hidden'},0);
  assert.equal(hidden.clock.background?.at,start+AUTO_FLOW.choiceMs);
  assert.equal(step(hidden,{type:'pulse',background:'hidden'},AUTO_FLOW.choiceMs-1),hidden);
  assert.equal(step(hidden,{type:'pulse',background:'hidden'},AUTO_FLOW.choiceMs,randomUUID()),hidden);
  const running=step(hidden,{type:'pulse',background:'hidden'},AUTO_FLOW.choiceMs);
  assert.equal(running.clock.pendingChoice,undefined);
  assert.equal(running.clock.readyAt,start+AUTO_FLOW.choiceMs+2000);
  const result=step(running,{type:'pulse',background:'hidden'},AUTO_FLOW.choiceMs+2000);
  assert.ok(result.clock.pendingTraining);
  const meet=step(result,{type:'pulse',background:'hidden'},60_000);
  assert.ok(meet.clock.pendingMeet);
  assert.equal(meet.career.rider!.records.length,1);
  assert.ok(meet.career.rider!.records[0].results[0].run.log.length);
  assert.equal(step(meet,{type:'pulse',background:'hidden'},60_000),meet);
  const resumed=step(meet,{type:'pulse',background:'visible'},meet.clock.background!.at-start+8000);
  assert.equal(resumed.clock.background,undefined);
  assert.equal(resumed.clock.pendingMeet,undefined);
  assert.equal(resumed.career.rider!.records.length,1);
  assert.ok(resumed.career.rider!.week>=8);
  const later=step(hidden,{type:'pulse',background:'visible'},600_000);
  assert.ok(later.clock.background&&later.clock.background.at<=start+600_000,'A long sleep is caught up in bounded batches');
  const stopped=step(later,{type:'settings',settings:{mode:'manual',strategy:'balanced',entries:['dance']}},600_000);
  assert.equal(stopped.clock.background,undefined);
  assert.equal(stopped.career.rider!.settings.mode,'manual');
});

test('guest snapshots survive reopening storage; concurrent tournament submissions pay exactly once',async()=>{
  const path=await mkdtemp(join(process.cwd(),'.longboard-test-'));
  try{
    const base='http://127.0.0.1/api/game';
    const store=localStore(path);
    const handler=createHandler(store,1000,false);
    const guest=await handler(new Request(base));
    assert.equal(guest.status,200);
    const set=guest.headers.get('set-cookie')!;
    assert.match(set,/HttpOnly; SameSite=Strict/);
    const cookie=set.split(';')[0];
    const tab=randomUUID();
    const post=(action:unknown,version:number,origin='http://127.0.0.1',stateVersion?:number)=>handler(new Request(base,{
      method:'POST',body:JSON.stringify({version,stateVersion,tab,action}),headers:{'Content-Type':'application/json',cookie,origin},
    }));
    assert.equal((await post({type:'create',name:'Tester',look:DEFAULT_LOOK,money:99_000_000},0)).status,400);
    assert.equal((await post({type:'create',name:'Tester',look:DEFAULT_LOOK},0,'https://other.example')).status,403);
    assert.equal((await post({type:'create',name:'Tester',look:{...DEFAULT_LOOK,board:BOARDS.length}},0)).status,400);
    assert.equal((await post({type:'create',name:'Tester',look:{...DEFAULT_LOOK,skin:SKINS.length}},0)).status,400);
    assert.equal((await post({type:'create',name:'Tester',look:{...DEFAULT_LOOK,gender:'invalid'}},0)).status,400);
    for(const [field,choices] of [['hair',HAIR_STYLES],['outfit',OUTFITS],['bottom',BOTTOMS],['footwear',FOOTWEAR],['eyes',EYE_COLORS]] as const)
      assert.equal((await post({type:'create',name:'Tester',look:{...DEFAULT_LOOK,[field]:choices.length}},0)).status,400);
    const appearance={...DEFAULT_LOOK,gender:'female' as const,hair:HAIR_STYLES.length-1,outfit:OUTFITS.length-1,bottom:BOTTOMS.length-1,footwear:FOOTWEAR.length-1,eyes:EYE_COLORS.length-1,board:5,shirt:SHIRTS.length-1,hairColor:HAIR_COLORS.length-1,pants:PANTS.length-1,shoes:SHOES.length-1,skin:SKINS.length-1};
    const create=await post({type:'create',name:'Tester',look:appearance},0);
    assert.equal(create.status,200);
    let save:View=await create.json();
    assert.equal('speed' in save,false);
    assert.equal((await post({type:'speed',speed:8},save.version)).status,400);
    assert.equal((await post({type:'fast-forward',enabled:8},save.version)).status,400);
    const enabled=await post({type:'fast-forward',enabled:true},save.version);
    assert.equal(enabled.status,200);
    save=await enabled.json();
    const restored:View=await (await handler(new Request(base,{headers:{cookie}}))).json();
    assert.deepEqual(restored.career.rider!.look,appearance,'New colors and gender must persist across reload');
    assert.equal(restored.fastForward,false);
    assert.equal(restored.weekMs,1000);
    const rejectedMakeover=await post({type:'makeover',look:{...appearance,gender:'male',board:4}},save.version);
    assert.equal(rejectedMakeover.status,422);
    assert.match((await rejectedMakeover.json()).error,/성별은 바꿀 수 없어요/);
    const afterRejected:View=await (await handler(new Request(base,{headers:{cookie}}))).json();
    assert.deepEqual(afterRejected.career.rider!.look,appearance);
    assert.equal(afterRejected.career.rider!.money,save.career.rider!.money);
    const restyled={...appearance,board:4};
    const makeover=await post({type:'makeover',look:{...restyled,gender:undefined}},save.version);
    assert.equal(makeover.status,200);save=await makeover.json();
    assert.deepEqual(save.career.rider!.look,restyled);
    const heartbeat=await post({type:'pulse'},save.version);
    const heartbeatView:View=await heartbeat.json();
    assert.ok(heartbeatView.version>=save.version);
    assert.equal(heartbeatView.stateVersion,save.stateVersion);
    const planAfterHeartbeat=await post({type:'plan',plan:{action:'speed',spot:'river'}},save.version,'http://127.0.0.1',save.stateVersion);
    assert.equal(planAfterHeartbeat.status,200,'Clock-only saves must not reject the player choice');
    const staleChoice=await post({type:'fast-forward',enabled:false},save.version,'http://127.0.0.1',save.stateVersion);
    assert.equal(staleChoice.status,409,'A competing player choice must still be protected');
    assert.equal((await staleChoice.json()).conflict,true);
    save=await planAfterHeartbeat.json();
    const owner=await store.authenticate(createHash('sha256').update(cookie.split('=')[1]).digest('hex'));
    assert.ok(owner);
    const row=await store.get(owner);
    const rider=row.snapshot.career.rider!;
    assert.equal(save.career.rider!.seed,0);
    assert.equal(save.career.rider!.trainingOffer,randomSpecialTraining(rider)??null);
    assert.equal(rider.trainingOffer,undefined);
    delete rider.extras; // A phase-one snapshot has no career extensions.
    rider.plan=null;delete row.snapshot.clock.readyAt;
    rider.week=7;rider.phase='meet';
    const setup=await store.replace(owner,save.version,row.snapshot);
    assert.ok(setup);
    assert.equal((await post({type:'entry',disciplines:['dance','trick']},setup.version)).status,422);
    assert.equal((await post({type:'settings',settings:{mode:'auto',strategy:'balanced',entries:['dance','trick']}},setup.version)).status,422);
    assert.equal((await post({type:'plan',plan:{action:'rehearsal',spot:'arena'}},setup.version)).status,400);
    const responses=await Promise.all([
      post({type:'entry',disciplines:['dance']},setup.version),
      post({type:'entry',disciplines:['dance']},setup.version),
    ]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
    const reload=createHandler(localStore(path),1000,false);
    const after:View=await (await reload(new Request(base,{headers:{cookie}}))).json();
    const final=after.career.rider!;
    assert.equal(final.records.length,1);
    assert.equal(final.records[0].results.length,1);
    assert.equal(final.week,7);
    assert.equal(final.event,'career-first-score');
    assert.ok(after.pendingMeet);
    const pendingCompact:View=await (await reload(new Request(base,{headers:{cookie,'X-Game-View':'compact'}}))).json();
    assert.equal(pendingCompact.career.rider!.records[0].detail,'full','Unconfirmed competition playback must include every move');
    assert.ok(pendingCompact.career.rider!.records[0].results[0].run.log.length>0);
    assert.equal((await post({type:'event',index:0,eventId:'career-first-score'},after.version)).status,422);
    const meetDone=await post({type:'continue-meet',record:after.pendingMeet},after.version);
    assert.equal(meetDone.status,200);
    const ready:View=await meetDone.json();
    const storyDone=await post({type:'event',index:0,eventId:'career-first-score'},ready.version);
    assert.equal(storyDone.status,200);
    const continued:View=await storyDone.json();
    assert.equal(continued.career.rider?.week,8);
    assert.equal(continued.career.rider?.records.length,1);
    const results=final.records[0].results;
    const reward=ECONOMY.achievements.meet+(results.some(result=>playerPlace(result)===1)?ECONOMY.achievements.win:0);
    assert.equal(final.money,rider.money+results.reduce((sum,r)=>sum+r.prize,0)+reward);
    assert.equal(Object.keys(results[0].opponents??{}).length,6);
    assert.equal(final.season.scores.dance.player,final.records[0].results[0].points);
    assert.equal(final.season.scores.freestyle.player,undefined);
    assert.ok(final.season.scores.freestyle.yu>0);
    const compactResponse=await reload(new Request(base,{headers:{cookie,'X-Game-View':'compact'}}));
    const compactText=await compactResponse.text(),compact:View=JSON.parse(compactText),summary=compact.career.rider!.records[0];
    assert.equal(summary.detail,'summary');assert.deepEqual(summary.results[0].run.log,[]);assert.equal(summary.results[0].opponents,undefined);
    assert.equal(summary.results[0].run.score,results[0].run.score);
    assert.ok(compactText.length<JSON.stringify(after).length/2,'Background requests must avoid full past line payloads');
    const beforeReplay=await store.get(owner);
    const replay=await reload(new Request(base+'?replay=1:regular-1',{headers:{cookie}}));assert.equal(replay.status,200);
    const full=await replay.json();assert.equal(full.detail,'full');assert.deepEqual(full.results,final.records[0].results);
    assert.equal((await store.get(owner)).version,beforeReplay.version,'Replay fetch must not advance or save the career');
    assert.equal((await reload(new Request(base+'?replay=1:regular-1'))).status,401);
    const outsider=await reload(new Request(base)),otherCookie=outsider.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await reload(new Request(base+'?replay=1:regular-1',{headers:{cookie:otherCookie}}))).status,404);
    assert.deepEqual((await (await reload(new Request(base))).json()).career,{rider:null,hall:[]});
  }finally{
    for(const file of await readdir(path)) await unlink(join(path,file));
    await rmdir(path);
  }
});

test('the API keeps a claimed special plan across reloads and rejects a conflicting entry',async()=>{
  const path=await mkdtemp(join(process.cwd(),'.longboard-test-'));
  try{
    const base='http://127.0.0.1/api/game';
    const store=localStore(path),tab=randomUUID();
    const handle=createHandler(store,2000,false);
    const guest=await handle(new Request(base));
    const cookie=guest.headers.get('set-cookie')!.split(';')[0];
    const send=(handler:typeof handle,version:number,action:unknown)=>handler(new Request(base,{
      method:'POST',headers:{cookie,origin:'http://127.0.0.1','Content-Type':'application/json'},body:JSON.stringify({version,tab,action}),
    }));
    const started:View=await (await send(handle,0,{type:'create',name:'Special',look:DEFAULT_LOOK})).json();
    const owner=await store.authenticate(createHash('sha256').update(cookie.split('=')[1]).digest('hex'));
    assert.ok(owner);
    const row=await store.get(owner);
    const rider=row.snapshot.career.rider!;
    rider.week=7;rider.energy=12;rider.events.first=1;
    const ready=await store.replace(owner,started.version,row.snapshot);
    assert.ok(ready);
    const plan={action:'speed',spot:'river',meetTraining:true};
    const submitted=await send(handle,ready.version,{type:'plan',plan});
    assert.equal(submitted.status,200);
    const accepted:View=await submitted.json();
    const reload=createHandler(localStore(path),2000,false);
    const view:View=await (await reload(new Request(base,{headers:{cookie,'X-Game-View':'compact'}}))).json();
    assert.deepEqual(view.career.rider!.plan,plan);
    assert.equal(view.career.rider!.trainingOffer,null);
    assert.equal((await send(reload,accepted.version,{type:'entry',disciplines:['dance']})).status,422);
  }finally{
    for(const file of await readdir(path))await unlink(join(path,file));
    await rmdir(path);
  }
});


test('event outcomes survive reload, allow equipment management and require one acknowledgement before the next action',async()=>{
 const path=await mkdtemp(join(process.cwd(),'.longboard-test-'));
 try{
  const store=localStore(path),handler=createHandler(store,2000,false),base='http://127.0.0.1/api/game';
  const guest=await handler(new Request(base)),cookie=guest.headers.get('set-cookie')!.split(';')[0],tab=randomUUID();
  let view:View=await guest.json();
  const post=(action:unknown,minimal=false)=>handler(new Request(base,{method:'POST',headers:{'Content-Type':'application/json',cookie,origin:'http://127.0.0.1',...(minimal?{'X-Game-Pulse':'minimal'}:{})},body:JSON.stringify({version:view.version,stateVersion:view.stateVersion,tab,action})}));
  let response=await post({type:'create',name:'Outcome API',look:DEFAULT_LOOK});assert.equal(response.status,200);view=await response.json();
  const owner=(await store.authenticate(createHash('sha256').update(cookie.split('=')[1]).digest('hex')))!;
  const row=await store.get(owner);row.snapshot.career.rider!.phase='event';row.snapshot.career.rider!.event='first';
  const setup=await store.replace(owner,row.version,row.snapshot);assert.ok(setup);
  view=await (await handler(new Request(base,{headers:{cookie}}))).json();
  response=await post({type:'event',index:1});assert.equal(response.status,200);view=await response.json();
  const result=view.pendingEvent!;assert.ok(result);assert.match(result.choice,/균형/);
  const balance=view.career.rider!.stats.balance;
  const reload:View=await (await handler(new Request(base,{headers:{cookie}}))).json();assert.deepEqual(reload.pendingEvent,result);
  response=await post({type:'trade',operation:'buy',item:'acc_005'});assert.equal(response.status,200);view=await response.json();assert.deepEqual(view.pendingEvent,result);
  response=await post({type:'trade',operation:'equip',item:'acc_005'});assert.equal(response.status,200);view=await response.json();assert.equal(view.pendingEvent!.key,result.key);
  assert.equal((await post({type:'plan',plan:{action:'speed',spot:'river'}})).status,422);
  const revision=view.version;
  response=await post({type:'pulse'},true);assert.equal(response.status,204);assert.equal(await response.text(),'');assert.equal((await store.get(owner)).version,revision,'No-op status check must not write the snapshot');
  response=await post({type:'pulse'});assert.equal(response.status,200,'Older clients still receive a JSON view');
  const confirmed=await Promise.all([post({type:'continue-event',record:result.key}),post({type:'continue-event',record:result.key})]);
  assert.deepEqual(confirmed.map(item=>item.status).sort(),[200,409]);view=await confirmed.find(item=>item.status===200)!.json();
  assert.equal(view.pendingEvent,undefined);assert.equal(view.career.rider!.stats.balance,balance);
  assert.equal((await post({type:'continue-event',record:result.key})).status,422);
  response=await post({type:'plan',plan:{action:'speed',spot:'river'}});assert.equal(response.status,200);
 }finally{for(const file of await readdir(path))await unlink(join(path,file));await rmdir(path);}
});
