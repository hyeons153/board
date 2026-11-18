import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHandler } from '../server/http';
import { localStore } from '../server/store';
import { DEFAULT_LOOK } from '../src/game/data';
import { ECONOMY, playerPlace } from '../src/game/economy';
import type { View } from '../src/game/types';

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
    const create=await post({type:'create',name:'Tester',look:DEFAULT_LOOK},0);
    assert.equal(create.status,200);
    let save:View=await create.json();
    assert.equal('speed' in save,false);
    assert.equal((await post({type:'speed',speed:8},save.version)).status,400);
    assert.equal((await post({type:'fast-forward',enabled:8},save.version)).status,400);
    const enabled=await post({type:'fast-forward',enabled:true},save.version);
    assert.equal(enabled.status,200);
    save=await enabled.json();
    const restored:View=await (await handler(new Request(base,{headers:{cookie}}))).json();
    assert.equal(restored.fastForward,false);
    assert.equal(restored.weekMs,1000);
    const heartbeat=await post({type:'pulse'},save.version);
    const heartbeatView:View=await heartbeat.json();
    assert.ok(heartbeatView.version>=save.version);
    assert.equal(heartbeatView.stateVersion,save.stateVersion);
    const planAfterHeartbeat=await post({type:'plan',plan:{action:'speed',intensity:'safe',spot:'river'}},save.version,'http://127.0.0.1',save.stateVersion);
    assert.equal(planAfterHeartbeat.status,200,'Clock-only saves must not reject the player choice');
    const staleChoice=await post({type:'fast-forward',enabled:false},save.version,'http://127.0.0.1',save.stateVersion);
    assert.equal(staleChoice.status,409,'A competing player choice must still be protected');
    assert.equal((await staleChoice.json()).conflict,true);
    save=await planAfterHeartbeat.json();
    const owner=await store.authenticate(createHash('sha256').update(cookie.split('=')[1]).digest('hex'));
    assert.ok(owner);
    const row=await store.get(owner);
    const rider=row.snapshot.career.rider!;
    delete rider.extras; // A phase-one snapshot has no career extensions.
    rider.plan=null;delete row.snapshot.clock.readyAt;
    rider.week=7;rider.phase='meet';
    const setup=await store.replace(owner,save.version,row.snapshot);
    assert.ok(setup);
    const responses=await Promise.all([
      post({type:'entry',disciplines:['dance','trick']},setup.version),
      post({type:'entry',disciplines:['dance','trick']},setup.version),
    ]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
    const reload=createHandler(localStore(path),1000,false);
    const after:View=await (await reload(new Request(base,{headers:{cookie}}))).json();
    const final=after.career.rider!;
    assert.equal(final.records.length,1);
    assert.equal(final.records[0].results.length,2);
    assert.equal(final.week,8);
    const results=final.records[0].results;
    const reward=ECONOMY.achievements.meet+(results.some(result=>playerPlace(result)===1)?ECONOMY.achievements.win:0);
    assert.equal(final.money,rider.money+results.reduce((sum,r)=>sum+r.prize,0)+reward);
    assert.equal(Object.keys(results[0].opponents??{}).length,6);
    assert.equal(final.season.scores.dance.player,final.records[0].results[0].points);
    assert.equal(final.season.scores.freestyle.player,undefined);
    assert.ok(final.season.scores.freestyle.yu>0);
    assert.deepEqual((await (await reload(new Request(base))).json()).career,{rider:null,hall:[]});
  }finally{
    for(const file of await readdir(path)) await unlink(join(path,file));
    await rmdir(path);
  }
});
