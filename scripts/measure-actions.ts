import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { GameAction, View } from '../src/game/types.js';

const base=new URL(process.argv[2]??'http://127.0.0.1:5188');
if(!['localhost','127.0.0.1'].includes(base.hostname)&&!(process.argv.includes('--deployed')&&base.protocol==='https:'&&base.hostname.endsWith('.vercel.app')))throw new Error('Select an explicit local or Vercel test target.');
const label=process.argv.includes('--after')?'after':'before';
const username='qa_'+randomBytes(7).toString('hex'),password=randomBytes(30).toString('base64url'),tab=randomUUID();
let cookie='',view:View,registered=false;
const measurements:{action:string;ms:number;bytes:number;serverTiming:string|null;region:string|null}[]=[];
async function request(params:string,body?:unknown,action='load'){
  const started=performance.now();
  const response=await fetch(new URL('/api/game'+params,base),{method:body?'POST':'GET',headers:{origin:base.origin,cookie,'X-Game-View':'compact',...(body?{'Content-Type':'application/json'}:{}),...(view?.scope?{'X-Game-Scope':view.scope}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  const received=response.headers.get('set-cookie');if(received)cookie=received.split(';')[0];
  const text=await response.text();assert.ok(response.ok,'API '+response.status);
  measurements.push({action,ms:Math.round(performance.now()-started),bytes:Buffer.byteLength(text),serverTiming:response.headers.get('server-timing'),region:response.headers.get('x-vercel-id')});
  return text?JSON.parse(text):undefined;
}
async function game(action:GameAction){view=await request('',{version:view.version,stateVersion:view.stateVersion,scope:view.scope,tab,action},action.type);}
try{
  view=await request('');
  await request('?area=account',{type:'register',username,password},'register');registered=true;
  view=await request('');
  await game({type:'create',name:'응답 속도 검증',look:{hair:0,skin:0,shirt:0,board:0}});
  for(let week=0;week<3;week++){
    await game({type:'plan',plan:{action:week===0?'speed':'rest',spot:'river'}});
    await new Promise(resolve=>setTimeout(resolve,2100));await game({type:'pulse'});
    assert.ok(view.pendingTraining);await game({type:'continue-training',record:view.pendingTraining});
    if(view.career.rider?.phase==='event')await game({type:'event',index:0});
    if(view.pendingEvent)await game({type:'continue-event',record:view.pendingEvent.key});
  }
  const actions=measurements.filter(x=>['plan','pulse','continue-training','event','continue-event'].includes(x.action));
  const sorted=actions.map(x=>x.ms).sort((a,b)=>a-b);
  const report={target:base.origin,label,medianMs:sorted[Math.floor(sorted.length/2)],maxMs:sorted.at(-1),measurements};
  await mkdir('.longboard',{recursive:true});await writeFile('.longboard/performance-'+label+'.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{
  if(registered){await request('?area=account',{type:'delete',username,password},'cleanup');console.log('PASS test account and records removed');}
}
