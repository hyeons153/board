import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { connectLocal } from '../server/localDatabase';
import { databaseStore } from '../server/databaseStore';
import { createHandler } from '../server/http';
import { blankSave } from '../server/clock';
import { sessionHash } from '../server/online';
import { publicationFor, verifiedResult } from '../server/ranking';
import { command, newRider, processWeek } from '../src/game/career';
import { simulateRun } from '../src/game/competition';
import { seeded } from '../src/game/random';
import { RULES } from '../src/game/data';
import { calendarFor, DEFAULT_LOOK, SKILLS } from '../src/game/data';
import { freshExtras } from '../src/game/economy';
import { chooseEnding } from '../src/game/legacy';
import { DISCIPLINES, type Career, type GameAction, type View } from '../src/game/types';
import type { Directory, Publication, PublicCard } from '../src/game/public';

const pw='test-account-passphrase-42';
const base='https://longboard.test/api/game';
function browser(handler:ReturnType<typeof createHandler>){
  let cookie='',scope='';
  let view:View;
  const tab=randomUUID();
  const call=async(path='',body?:unknown)=>{
    const headers:Record<string,string>={origin:new URL(base).origin};
    if(cookie) headers.cookie=cookie;
    if(body!==undefined){headers['Content-Type']='application/json';if(scope)headers['X-Game-Scope']=scope;}
    const response=await handler(new Request(base+path,{method:body===undefined?'GET':'POST',headers,
      body:body===undefined?undefined:JSON.stringify(body)}));
    const newCookie=response.headers.get('set-cookie');
    if(newCookie) cookie=newCookie.split(';')[0];
    return response;
  };
  const read=async()=>{
    const response=await call();
    assert.equal(response.status,200,await response.clone().text());
    view=await response.json() as View;
    scope=view.scope??'';
    return view;
  };
  const game=async(action:GameAction,version=view.version)=>{
    const response=await call('',{tab,scope,version,stateVersion:view.stateVersion,action});
    if(response.ok) view=await response.clone().json() as View;
    return response;
  };
  return {call,read,game,token:()=>cookie.split('=')[1],snapshot:()=>view};
}
async function status(response:Promise<Response>,expected:number){
  const value=await response;
  assert.equal(value.status,expected,await value.clone().text());
  return value;
}

test('existing PostgreSQL bearing snapshots upgrade only on mutation and keep currency, base stats and records',async()=>{
  const pg=await connectLocal();
  try{
    const store=databaseStore(pg.db,'neon'),handle=createHandler(store,1000,true,'equipment-test-rate-secret-12345678'),owner=browser(handle);
    await owner.read();await status(owner.game({type:'create',name:'기존 장비 보존',look:DEFAULT_LOOK}),200);
    const actor=(await store.actor(sessionHash(owner.token())))!,before=await store.get(actor.id),r=before.snapshot.career.rider!;
    r.extras={...freshExtras(),equipmentVersion:undefined,accessories:undefined,inventory:['deck-flow','bearings-endurance','unknown-collectible'],equipped:{deck:'deck-flow',bearings:'bearings-endurance'}};
    r.money=48200;const stats=structuredClone(r.stats),records=structuredClone(r.records);
    const raw=await store.replace(actor.id,before.version,before.snapshot);assert.ok(raw);
    const reading=await owner.read();assert.equal(reading.career.rider!.extras!.equipmentVersion,2);
    assert.equal((await store.get(actor.id)).snapshot.career.rider!.extras!.equipmentVersion,undefined,'Reading must not write a migration');
    await status(owner.game({type:'claim-gear'}),200);
    const converted=(await store.get(actor.id)).snapshot.career.rider!;
    assert.equal(converted.extras!.equipmentVersion,2);assert.deepEqual(converted.extras!.accessories,['bearings-endurance']);
    assert.ok(converted.extras!.inventory.includes('unknown-collectible'));assert.equal(converted.money,48200);assert.deepEqual(converted.stats,stats);assert.deepEqual(converted.records,records);
    const inventory=[...converted.extras!.inventory];await status(owner.game({type:'claim-gear'}),200);
    assert.deepEqual((await store.get(actor.id)).snapshot.career.rider!.extras!.inventory,inventory);
  }finally{await pg.close();}
});

test('PostgreSQL applies the phase-three migration over a populated phase-two snapshot',async()=>{
  const pg=new PGlite();
  try{
    const migrations=readMigrationFiles({migrationsFolder:'./drizzle'});
    for(const sql of migrations[0].sql) if(sql.trim()) await pg.exec(sql);
    const owner=randomUUID(),rid=randomUUID();
    const original=blankSave();
    original.career.rider=newRider(rid,27,'남겨 둘 선수',DEFAULT_LOOK);
    original.career.rider.skills.cross.mastery=78;
    await pg.query('INSERT INTO rider_users (id) VALUES ($1)',[owner]);
    await pg.query('INSERT INTO rider_careers (user_id,snapshot,version) VALUES ($1,$2::jsonb,7)',[owner,JSON.stringify(original)]);
    for(const sql of migrations[1].sql) if(sql.trim()) await pg.exec(sql);
    const [saved]=(await pg.query<{version:number;snapshot:typeof original}>('SELECT version,snapshot FROM rider_careers WHERE user_id=$1',[owner])).rows;
    assert.equal(saved.version,7);
    assert.deepEqual(saved.snapshot,original);
    assert.equal((await pg.query('SELECT * FROM public_riders')).rows.length,0);
  }finally{await pg.close();}
});

test('account migration, scoped mutations, public rankings, reports, withdrawal and deletion share the real SQL repository',async()=>{
  const pg=await connectLocal();
  try{
    const store=databaseStore(pg.db,'neon');
    const handle=createHandler(store,1000,true,'test-rate-key-12345678901234567890');
    const owner=browser(handle), viewer=browser(handle);
    await owner.read();
    await status(owner.game({type:'create',name:'리버 공식 선수',look:{...DEFAULT_LOOK,shirt:2}}),200);
    const ownerRider=owner.snapshot().career.rider!;
    const oldToken=owner.token();
    const register=await status(owner.call('?area=account',{type:'register',username:'river_archive',password:pw}),200);
    assert.match(register.headers.get('set-cookie')??'',/HttpOnly; SameSite=Strict.*Secure/);
    assert.notEqual(owner.token(),oldToken);
    assert.equal(await store.authenticate(sessionHash(oldToken)),undefined);
    const privateView=await owner.read();
    assert.equal(privateView.username,'river_archive');
    assert.equal(privateView.career.rider?.id,ownerRider.id);
    assert.equal(privateView.career.rider?.seed,0);
    const ownerId=(await store.actor(sessionHash(owner.token())))!.id;
    const credentials=await store.credential('river_archive');
    assert.ok(credentials?.passwordHash.startsWith('s1.'));
    assert.ok(!credentials?.passwordHash.includes(pw));

    const before=await store.get(ownerId);
    const rider=before.snapshot.career.rider!;
    rider.week=7;rider.phase='meet';
    await store.replace(ownerId,before.version,before.snapshot);
    await owner.read();
    const version=owner.snapshot().version;
    const first=await Promise.all([owner.game({type:'entry',disciplines:['dance']},version),owner.game({type:'entry',disciplines:['dance']},version)]);
    assert.deepEqual(first.map(response=>response.status).sort(),[200,409]);
    const after=(await store.get(ownerId)).snapshot.career.rider!;
    assert.equal(after.records.length,1);
    assert.ok(after.records[0].results.every(result=>result.proof));
    const visible=await owner.read();
    assert.ok(visible.career.rider?.records[0].results.every(result=>!result.proof));
    assert.ok(visible.pendingMeet);
    const held=await owner.read();
    assert.equal(held.pendingMeet,visible.pendingMeet);
    await status(owner.game({type:'continue-meet',record:visible.pendingMeet!}),200);

    await status(owner.game({type:'retire'}),200);
    await status(owner.game({type:'retire'},owner.snapshot().version),422);
    const archive=owner.snapshot().career.hall[0];
    assert.equal(archive.ending?.kind,'early');
    const browse=await viewer.read();
    assert.equal(browse.career.rider,null);
    await status(viewer.call('?area=public',{type:'publish',archiveId:archive.id,active:true}),401);
    await status(viewer.call('?area=account',{type:'register',username:'another_player',password:pw}),200);
    await viewer.read();
    await status(viewer.call('?area=public',{type:'publish',archiveId:archive.id,active:true}),404);
    assert.equal((await (await status(viewer.call('?area=public'),200)).json() as Directory).rows.length,0);

    await status(owner.call('?area=public',{type:'publish',archiveId:archive.id,active:true,score:1000}),400);
    const publish=await (await status(owner.call('?area=public',{type:'publish',archiveId:archive.id,active:true}),200)).json() as Publication;
    const profile=await (await status(viewer.call('?area=public&id='+publish.id),200)).json() as PublicCard;
    assert.equal(profile.profile.name,archive.name);
    assert.ok(profile.profile.official);
    assert.equal(profile.profile.careerPoints,null);
    assert.equal(profile.mine,false);
    const serialized=JSON.stringify(profile);
    for(const privateValue of [ownerRider.id,ownerId,'river_archive','passwordHash','proof']) assert.ok(!serialized.includes(privateValue));
    const publicList=await (await status(viewer.call('?area=public&search='+encodeURIComponent('리버')),200)).json() as Directory;
    assert.equal(publicList.rows[0]?.id,publish.id);
    const ranked=await (await status(owner.call('?area=public&metric=dance&division=rookie'),200)).json() as Directory;
    assert.equal(ranked.rows[0]?.rank,1);
    assert.equal(ranked.mine[0]?.rank,1);
    assert.equal((await (await status(viewer.call('?area=public&metric=career'),200)).json() as Directory).rows.length,0);
    await status(viewer.call('?area=public',{type:'report',id:publish.id,reason:'name'}),200);
    await status(viewer.call('?area=public',{type:'report',id:publish.id,reason:'other'}),200);
    assert.equal((await pg.db.query('SELECT public_id FROM rider_reports')).length,1);

    await status(owner.call('?area=public',{type:'publish',archiveId:archive.id,active:false}),200);
    await status(viewer.call('?area=public&id='+publish.id),404);
    assert.equal((await pg.db.query('SELECT public_id FROM rider_rankings')).length,0);
    await status(owner.call('?area=public',{type:'publish',archiveId:archive.id,active:true}),200);

    await status(owner.game({type:'create',name:'다음 회차',look:DEFAULT_LOOK}),200);
    assert.equal(owner.snapshot().career.rider?.mentor?.name,'리버 공식 선수');
    await status(owner.call('?area=account',{type:'logout'}),200);
    await owner.read();
    await status(owner.game({type:'create',name:'게스트 선수',look:DEFAULT_LOOK}),200);
    await status(owner.call('?area=account',{type:'login',username:'river_archive',password:'incorrect-long-passphrase'}),401);
    await status(owner.call('?area=account',{type:'login',username:'river_archive',password:pw}),200);
    const merged=await owner.read();
    assert.equal(merged.career.rider?.name,'다음 회차');
    assert.equal(merged.career.parked?.[0].name,'게스트 선수');
    await status(owner.game({type:'switch-rider',id:merged.career.parked![0].id}),200);
    assert.equal(owner.snapshot().career.rider?.name,'게스트 선수');
    assert.equal(owner.snapshot().career.hall.length,1);
    await status(owner.call('?area=account',{type:'delete',username:'river_archive',password:pw}),200);
    await status(viewer.call('?area=public&id='+publish.id),404);
    assert.equal(await store.credential('river_archive'),undefined);
    assert.equal((await pg.db.query('SELECT user_id FROM rider_careers WHERE user_id=$1',[ownerId])).length,0);
    assert.equal((await pg.db.query('SELECT public_id FROM rider_reports')).length,0);
  }finally{await pg.close();}
});

test('eight official seasons replay from inputs, while edited and unverifiable runs stay outside the complete ranking',()=>{
  const c:Career={rider:null,hall:[]};
  command(c,{type:'create',name:'Finalist',look:DEFAULT_LOOK},()=>({id:randomUUID(),seed:981}),true,true);
  const rider=c.rider!;
  rider.settings={mode:'auto',strategy:'freestyle',entries:['freestyle']};
  for(let weeks=0;weeks<416;weeks++) assert.ok(processWeek(c,true));
  const archive=c.hall[0];
  assert.equal(archive.records.length,48);
  assert.equal(archive.records.at(-1)?.id,'international-8');
  assert.ok(archive.honors?.includes('8년 커리어 완주'));
  const publication=publicationFor(archive);
  assert.ok(publication.entries.some(item=>item.metric==='career'));
  assert.equal(publication.profile.division,'master');
  assert.ok(publication.entries.some(item=>item.scope==='master'&&item.metric==='dance'));
  const incomplete=structuredClone(archive);
  incomplete.records.find(meet=>meet.id==='international-2')!.results.pop();
  assert.equal(publicationFor(incomplete).entries.some(item=>item.metric==='career'),false,'Graduation requires every international discipline');
  assert.ok(archive.honors?.includes('마스터부 진입'));
  const first=archive.records.find(record=>record.results.length)!;
  assert.ok(verifiedResult(archive,first,first.results[0]));
  const forged=structuredClone(archive);
  const changed=forged.records.find(record=>record.results.length)!;
  changed.results[0].run.score+=.1;
  assert.equal(verifiedResult(forged,changed,changed.results[0]),false);
  assert.equal(publicationFor(forged).entries.some(item=>item.metric==='career'),false);
  const historical=structuredClone(archive);
  delete historical.rankedStart;
  for(const meet of historical.records) for(const result of meet.results) delete result.proof;
  assert.equal(publicationFor(historical).entries.length,0);
  assert.equal(publicationFor(historical).profile.wins,publicationFor(archive).profile.wins);
});

test('ending precedence and auto pre-meet pause keep retirement and rewards separate',()=>{
  const rider=newRider(randomUUID(),527,'Ending',DEFAULT_LOOK);
  const c:Career={rider,hall:[]};
  rider.year=8;rider.week=52;
  rider.season={year:8,division:'master',scores:{dance:{},trick:{},freestyle:{}}};
  rider.settings={mode:'auto',strategy:'balanced',entries:['dance'],pauseMeet:true};
  assert.ok(processWeek(c));
  assert.equal(rider.phase,'meet');
  assert.equal(c.hall.length,0);
  assert.throws(()=>command(c,{type:'entry',disciplines:['dance']},()=>({id:randomUUID(),seed:1})),/3종목/);
  command(c,{type:'entry',disciplines:[...DISCIPLINES]},()=>({id:randomUUID(),seed:1}));
  assert.equal(c.hall.length,1);
  assert.equal(c.hall[0].records.at(-1)?.id,calendarFor(8).at(-1)?.id);
  assert.equal(rider.phase,'retired');
  assert.equal(chooseEnding({...c.hall[0],reason:'early'}).kind,'early');
  const archive={...c.hall[0],seasons:[],records:[]};
  assert.equal(chooseEnding(archive).kind,'veteran');
  for(const skill of SKILLS) archive.skills[skill.id]={study:100,mastery:95};
  assert.equal(chooseEnding(archive).kind,'technician');
});

test('previous competition proofs replay under their original stamina rules',()=>{
  const rider=newRider(randomUUID(),517,'Legacy',DEFAULT_LOOK),career:Career={rider,hall:[]};
  rider.week=7;rider.phase='meet';rider.energy=0;
  command(career,{type:'entry',disciplines:['dance']},()=>({id:randomUUID(),seed:517}),true);
  command(career,{type:'retire'},()=>({id:randomUUID(),seed:517}),true);
  const archive=career.hall[0],meet=archive.records[0],result=meet.results[0],proof=result.proof!;
  assert.equal(proof.rules,3);assert.ok(verifiedResult(archive,meet,result));
  delete proof.rules;
  result.run=simulateRun({stats:proof.stats,energy:proof.energy,injury:proof.injury,skills:proof.skills},'dance',proof.routine,seeded(proof.seed,meet.year,meet.id,'dance','player'),1);
  result.standings.find(row=>row.id==='player')!.score=result.run.score;
  result.standings.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).forEach((row,i)=>{row.place=i+1;});
  const place=result.standings.find(row=>row.id==='player')!.place;
  result.points=RULES.places[Math.min(place-1,5)];
  assert.ok(verifiedResult(archive,meet,result),'Old records must remain verifiable');
  proof.rules=2;assert.equal(verifiedResult(archive,meet,result),false);
});
