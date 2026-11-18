import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { GameAction, View } from '../src/game/types';
import type { Directory, Publication, PublicCard } from '../src/game/public';

const base=new URL(process.argv[2]??'http://127.0.0.1:5185');
const deployed=process.argv.includes('--deployed');
const local=['127.0.0.1','localhost','[::1]'].includes(base.hostname);
if(!local&&!(deployed&&base.protocol==='https:'&&base.hostname.endsWith('.vercel.app')))
  throw new Error('Use a local Neon-wired server, or explicitly select a Vercel deployment with --deployed.');
const username='qa_'+randomBytes(7).toString('hex');
const password=randomBytes(30).toString('base64url');
const tab=randomUUID();
let cookie='',view:View|undefined,registered=false;
async function request<T>(params:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T>{
  const response=await fetch(new URL('/api/game'+params,base),{
    method,headers:{origin:base.origin,...(cookie?{cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),
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
  view=await request<View>('',{version:view.version,scope:view.scope,tab,action});
  return view;
}
async function waitForWeek(){
  const deadline=Date.now()+(view?.weekMs??30000)+30000;
  while(Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,Math.min(view?.remainingMs??1000,2000)+120));
    await game({type:'pulse'});
    if(view?.career.rider?.phase==='event') return;
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
  }
  console.log('PASS application page and assets served');
  await load();
  assert.equal(view?.storage,'neon');
  if(deployed) assert.equal(view!.weekMs,30000);
  assert.equal('speed' in view!,false);
  console.log('PASS /api/game -> Neon guest session');
  await game({type:'create',name:'Neon 연결 검증 라이더',look:{hair:1,skin:2,shirt:3,board:1,pants:1,shoes:2}});
  const riderId=view!.career.rider!.id;
  await game({type:'plan',plan:{action:'speed',spot:'river',intensity:'safe'}});
  await waitForWeek();
  await game({type:'event',index:0});
  assert.equal(view!.career.rider!.week,2);
  assert.ok(view!.career.rider!.stats.speed>18);
  await load();
  assert.equal(view!.career.rider!.id,riderId);
  assert.equal(view!.career.rider!.week,2);
  console.log('PASS training -> event -> week 2 -> durable reload');
  await request('?area=account',{type:'register',username,password});
  registered=true;
  await load();
  assert.equal(view!.username,username);
  assert.equal(view!.career.rider!.id,riderId);
  console.log('PASS account creation -> guest record attached -> session rotated');
  await game({type:'trade',operation:'buy',item:'deck-flow'});
  await game({type:'trade',operation:'equip',item:'deck-flow'});
  await load();
  assert.equal(view!.career.rider!.extras!.equipped.deck,'deck-flow');
  console.log('PASS equipment transaction persisted');
  await game({type:'retire'});
  assert.equal(view!.career.hall[0].id,riderId);
  assert.equal(view!.career.hall[0].ending?.kind,'early');
  const published=await request<Publication>('?area=public',{type:'publish',archiveId:riderId,active:true});
  const ownerCookie=cookie;
  cookie='';
  const card=await request<PublicCard>('?area=public&id='+published.id);
  assert.equal(card.profile.name,'Neon 연결 검증 라이더');
  assert.equal(card.profile.official,false);
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

