import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { GameAction, MeetRecord, View } from '../src/game/types';
import type { Directory, Publication, PublicCard } from '../src/game/public';
import { BOARDS, HAIR_COLORS, PANTS, SHIRTS, SHOES, SKINS } from '../src/game/data';

const base=new URL(process.argv[2]??'http://127.0.0.1:5185');
const deployed=process.argv.includes('--deployed');
const competition=process.argv.includes('--competition');
const local=['127.0.0.1','localhost','[::1]'].includes(base.hostname);
if(!local&&!(deployed&&base.protocol==='https:'&&base.hostname.endsWith('.vercel.app')))
  throw new Error('Use a local Neon-wired server, or explicitly select a Vercel deployment with --deployed.');
const username='qa_'+randomBytes(7).toString('hex');
const password=randomBytes(30).toString('base64url');
const tab=randomUUID();
let cookie='',view:View|undefined,registered=false;
async function request<T>(params:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
  const response=await fetch(new URL('/api/game'+params,base),{
    method,headers:{origin:base.origin,'X-Game-View':'compact',...(cookie?{cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),
      ...(view?.scope?{'X-Game-Scope':view.scope}:{})},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000),
  });
  const received=response.headers.get('set-cookie');
  if(received) cookie=received.split(';')[0];
  const payload=await response.json();
  assert.equal(response.ok,true,'API status '+response.status+' '+(payload.error??''));
  return payload as T;
}
async function load(){view=await request<View>('');return view;}
async function game(action:GameAction){
  assert.ok(view);
  view=await request<View>('',{version:view.version,stateVersion:view.stateVersion,scope:view.scope,tab,action});
  return view;
}
async function waitForWeek(){
  const deadline=Date.now()+(view?.weekMs??2000)+30000;
  while(Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,Math.min(view?.remainingMs??1000,2000)+120));
    await game({type:'pulse'});
    if(view?.pendingTraining) return;
  }
  throw new Error('The training event did not arrive in the expected window.');
}
async function run(){
  const page=await fetch(base,{signal:AbortSignal.timeout(25000)});
  assert.equal(page.status,200,'Application page must load');
  const html=await page.text();
  assert.ok(html.includes('<div id="root">'),'React application entry must be served');
  if(deployed){
    const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match=>match[1]);
    assert.ok(assets.some(asset=>asset.endsWith('.js')),'Built application script must be linked');
    for(const asset of assets){
      const response=await fetch(new URL(asset,base),{signal:AbortSignal.timeout(25000)});
      assert.equal(response.status,200,'Built application assets must load');
      await response.body?.cancel();
    }
    const art=await fetch(new URL('/art/characters/riders-v2.png',base),{signal:AbortSignal.timeout(25000)});
    assert.equal(art.status,200,'The full-body character atlas must be deployed');
    const bytes=Buffer.from(await art.arrayBuffer());
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(bytes.readUInt32BE(16),960);assert.equal(bytes.readUInt32BE(20),2688);
    console.log('PASS detailed full-body character atlas -> 60 directional views served');
  }
  console.log('PASS application page and assets served');
  await load();
  assert.equal(view?.storage,'neon');
  if(deployed) assert.equal(view!.weekMs,2000);
  assert.equal('speed' in view!,false);
  console.log('PASS /api/game -> Neon guest session');
  const appearance={gender:'female' as const,hair:10,outfit:5,bottom:3,footwear:1,eyes:2,skin:SKINS.length-1,shirt:SHIRTS.length-1,board:5,pants:PANTS.length-1,shoes:SHOES.length-1,hairColor:HAIR_COLORS.length-1};
  assert.equal(BOARDS.length,8);
  await game({type:'create',name:'Neon 연결 검증 라이더',look:appearance});await load();
  assert.deepEqual(view!.career.rider!.look,appearance);
  await game({type:'makeover',look:{...appearance,board:4}});await load();assert.equal(view!.career.rider!.look.board,4);
  console.log('PASS customized hair, outfit, bottoms, footwear, eyes and colors -> white/black deck makeover -> durable Neon reload');
  await game({type:'routine',discipline:'dance',skills:['peter-pan']});
  await load();assert.deepEqual(view!.career.rider!.routines.dance,['peter-pan']);
  console.log('PASS saved line -> durable reload');
  const riderId=view!.career.rider!.id;
  const energyBeforeMove=view!.career.rider!.energy;
  await game({type:'spot',spot:'plaza'});await load();
  assert.equal(view!.career.rider!.spot,'plaza');assert.equal(view!.career.rider!.week,1);assert.equal(view!.career.rider!.energy,energyBeforeMove);
  await game({type:'spot',spot:'river'});
  console.log('PASS main map movement -> no stamina/week cost -> durable reload');
  await game({type:'plan',plan:{action:'speed',spot:'river'}});
  assert.ok(view!.remainingMs>0&&view!.remainingMs<=view!.weekMs);
  await waitForWeek();
  assert.ok(view!.pendingTraining);
  assert.equal(view!.career.rider!.lastPlan?.action,'speed');
  assert.ok(view!.career.rider!.energy<100);
  await game({type:'continue-training',record:view!.pendingTraining!});
  await game({type:'event',index:0});
  assert.ok(view!.pendingEvent?.details.length,'An event must return a visible outcome');
  const outcome=view!.pendingEvent!;
  await game({type:'trade',operation:'buy',item:'acc_005'});
  await game({type:'trade',operation:'equip',item:'acc_005'});await load();
  assert.equal(view!.pendingEvent?.key,outcome.key,'Equipment management must preserve the event result');
  await game({type:'unequip',slot:'accessory',item:'acc_005'});
  await game({type:'continue-event',record:outcome.key});
  console.log('PASS event outcome -> equipment purchase/equip during result -> durable outcome hold -> acknowledgement');
  assert.equal(view!.career.rider!.week,2);
  assert.ok(view!.career.rider!.stats.speed>=18);
  await load();
  assert.equal(view!.career.rider!.id,riderId);
  assert.equal(view!.career.rider!.week,2);
  console.log('PASS two-second action -> result -> event -> week 2 -> durable reload');
  await request('?area=account',{type:'register',username,password});
  registered=true;
  await load();
  assert.equal(view!.username,username);
  assert.equal(view!.career.rider!.id,riderId);
  console.log('PASS account creation -> guest record attached -> session rotated');
  await game({type:'trade',operation:'buy',item:'deck_002'});
  await game({type:'trade',operation:'equip',item:'deck_002'});
  await game({type:'trade',operation:'buy',item:'acc_001'});
  await game({type:'trade',operation:'equip',item:'acc_001'});
  await load();
  assert.equal(view!.career.rider!.extras!.equipped.deck,'deck_002');
  assert.deepEqual(view!.career.rider!.extras!.accessories,['acc_001']);
  assert.equal(view!.career.rider!.extras!.equipmentVersion,2);
  console.log('PASS new equipment + accessory purchase and equip -> Neon version-2 inventory persisted');
  if(competition){
    await game({type:'settings',settings:{mode:'auto',strategy:'balanced',entries:['dance','trick'],pauseMeet:true,pauseStory:false,pauseInjury:false}});
    const deadline=Date.now()+(view!.weekMs+4000)*8+30000;
    while(Date.now()<deadline&&!view!.pendingMeet){
      if(view!.pendingTraining)await game({type:'continue-training',record:view!.pendingTraining!});
    if(view!.pendingEvent)await game({type:'continue-event',record:view!.pendingEvent.key});
      if(view!.pendingMeet)break;
      if(view!.pendingChoice){
        await new Promise(resolve=>setTimeout(resolve,2000));
        await game({type:'start-training',record:view!.pendingChoice!});
      }
      await new Promise(resolve=>setTimeout(resolve,Math.min(2100,(view!.remainingMs||1000)+120)));
      await game({type:'pulse'});
    }
    assert.ok(view!.pendingMeet);
    if(view!.pendingTraining)await game({type:'continue-training',record:view!.pendingTraining!});
      if(view!.pendingEvent)await game({type:'continue-event',record:view!.pendingEvent.key});
    const key=view!.pendingMeet;
    assert.ok(key);
    const saved=JSON.stringify(view!.career);
    await load();
    assert.equal(view!.pendingMeet,key);
    await game({type:'pulse'});
    assert.equal(JSON.stringify(view!.career),saved);
    assert.equal(view!.remainingMs,0);
    await game({type:'continue-meet',record:key});
    assert.equal(view!.pendingMeet,undefined);
    assert.ok(view!.pendingChoice);
    assert.equal(view!.career.rider!.records[0].results.length,2);
    const summary=view!.career.rider!.records[0];assert.equal(summary.detail,'summary');
    assert.deepEqual(summary.results[0].run.log,[]);assert.equal(summary.results[0].opponents,undefined);
    const replay=await request<MeetRecord>('?replay='+encodeURIComponent(summary.year+':'+summary.id));
    assert.equal(replay.detail,'full');assert.ok(replay.results[0].run.log.length>0);assert.equal(Object.keys(replay.results[0].opponents??{}).length,6);
    assert.equal(replay.results[0].run.score,summary.results[0].run.score);assert.equal(replay.results[0].proof,undefined);
    console.log('PASS compact past results -> on-demand complete player/NPC line -> no proof disclosure');
    console.log('PASS competition -> two disciplines -> durable result hold -> one acknowledgement -> fresh week');
    await game({type:'settings',settings:{...view!.career.rider!.settings,mode:'manual'}});
  }
  await game({type:'retire'});
  assert.equal(view!.career.hall[0].id,riderId);
  assert.equal(view!.fastForward,false);
  assert.equal(view!.career.hall[0].ending?.kind,'early');
  const published=await request<Publication>('?area=public',{type:'publish',archiveId:riderId,active:true});
  const ownerCookie=cookie;
  cookie='';
  const card=await request<PublicCard>('?area=public&id='+published.id);
  assert.equal(card.profile.name,'Neon 연결 검증 라이더');
  assert.equal(card.profile.official,deployed&&competition);
  const found=await request<Directory>('?area=public&search='+encodeURIComponent('Neon 연결 검증'));
  assert.ok(found.rows.some(row=>row.id===published.id));
  cookie=ownerCookie;
  console.log('PASS retirement -> publication -> anonymous profile query');
  await request('?area=public',{type:'publish',archiveId:riderId,active:false});
  const listings=await request<Publication[]>('?area=public',{type:'mine'});
  assert.equal(listings.find(row=>row.archiveId===riderId)?.active,false);
  console.log('PASS publication withdrawal persisted');
  await request('?area=account',{type:'logout'});
  await load();
  assert.equal(view!.career.rider,null);
  await request('?area=account',{type:'login',username,password});
  await load();
  assert.equal(view!.career.hall[0].id,riderId);
  await game({type:'create',name:'Neon 다음 회차 검증',look:{hair:0,skin:0,shirt:0,board:0}});
  assert.equal(view!.career.rider!.mentor?.id,riderId);
  console.log('PASS logout -> login -> archive restored -> next-career mentor');
}
try{
  await run();
  console.log('Neon application end-to-end verification passed.');
}catch(error){
  console.error('Neon verification failed: '+(error instanceof Error?error.message:'unknown failure'));
  process.exitCode=1;
}finally{
  if(registered){
    try{
      if(!view?.username){
        await request('?area=account',{type:'login',username,password});
        await load();
      }
      await request('?area=account',{type:'delete',username,password});
      registered=false;
      console.log('PASS verification account and associated records cleaned up');
    }catch{
      console.error('Verification account cleanup needs attention: '+username);
      process.exitCode=1;
    }
  }
}

