import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ACTIONS, DISCIPLINES, INTENSITIES, SPOTS, STRATEGIES, type View } from '../src/game/types.js';
import { RULES } from '../src/game/data.js';
import { GEAR_SLOTS } from '../src/game/economy.js';
import { GameError } from '../src/game/career.js';
import { advance, remaining } from './clock.js';
import { GUEST_SECONDS, type Row, type Store } from './store.js';
import { AccessError, type OnlineStore } from './databaseStore.js';
import { onlineRequest, rawSession, sessionCookie, sessionScope } from './online.js';

const color=z.number().int().min(0).max(3);
const look=z.strictObject({hair:color,skin:color,shirt:color,board:color,hairColor:color.optional(),pants:color.optional(),shoes:color.optional(),deckDesign:color.optional()});
const skill=z.string().max(40).regex(/^[a-z0-9-]+$/);
const disciplines=z.array(z.enum(DISCIPLINES)).max(3).refine(ds=>new Set(ds).size===ds.length);
const actionSchema=z.discriminatedUnion('type',[
  z.strictObject({type:z.literal('pulse')}),
  z.strictObject({type:z.literal('fast-forward'),enabled:z.boolean()}),
  z.strictObject({type:z.literal('create'),name:z.string().trim().min(1).max(16).regex(/^[\p{L}\p{N} _.-]+$/u),look}),
  z.strictObject({type:z.literal('plan'),plan:z.strictObject({action:z.enum(ACTIONS),spot:z.enum(SPOTS),intensity:z.enum(INTENSITIES),skill:skill.optional(),lesson:z.boolean().optional(),discipline:z.enum(DISCIPLINES).optional()})}),
  z.strictObject({type:z.literal('settings'),settings:z.strictObject({mode:z.enum(['manual','auto']),strategy:z.enum(STRATEGIES),intensity:z.enum(INTENSITIES),entries:disciplines,pauseStory:z.boolean().optional(),pauseMeet:z.boolean().optional(),pauseInjury:z.boolean().optional()})}),
  z.strictObject({type:z.literal('entry'),disciplines}),
  z.strictObject({type:z.literal('event'),index:z.number().int().min(0).max(5)}),
  z.strictObject({type:z.literal('routine'),discipline:z.enum(DISCIPLINES),skills:z.array(skill).max(16)}),
  z.strictObject({type:z.literal('trade'),operation:z.enum(['buy','sell','equip']),item:skill}),
  z.strictObject({type:z.literal('unequip'),slot:z.enum(GEAR_SLOTS)}),
  z.strictObject({type:z.literal('makeover'),look}),
  z.strictObject({type:z.literal('sponsor'),id:skill}),
  z.strictObject({type:z.literal('resume')}),
  z.strictObject({type:z.literal('switch-rider'),id:z.uuid()}),
  z.strictObject({type:z.literal('retire')}),
]);
const input=z.strictObject({version:z.number().int().nonnegative(),tab:z.uuid(),scope:z.string().regex(/^[a-f0-9]{64}$/).optional(),action:actionSchema});
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
const identity=()=>({id:randomUUID(),seed:randomBytes(4).readUInt32LE()});
const respond=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{}),
}});
export const readWeekMs=(env:string|undefined)=>{
  const n=Number(env);
  return Number.isSafeInteger(n)&&n>=1000&&n<=86_400_000?n:RULES.weekMs;
};
async function limitedBody(request:Request){
  const reader=request.body?.getReader();
  if(!reader) return null;
  const chunks:Uint8Array[]=[];
  let bytes=0;
  for(;;){
    const {done,value}=await reader.read();
    if(done) break;
    bytes+=value.length;
    if(bytes>4096){await reader.cancel(); return null;}
    chunks.push(value);
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return null;}
}

export function createHandler(store:Store,weekMs:number,secure:boolean,rateSecret?:string){
  const online='actor' in store ? store as OnlineStore : undefined;
  const view=(row:Row,username?:string,scope?:string):View=>{
    const career=row.snapshot.career;
    const records=(meets:typeof career.hall[number]['records'],opponents:boolean)=>meets.map(meet=>({
      ...meet,results:meet.results.map(({proof,opponents:replays,...result})=>opponents?{...result,opponents:replays}:result),
    }));
    const hall=career.hall.map(archive=>({...archive,records:records(archive.records,false)}));
    const rider=career.rider?{...career.rider,seed:0,records:records(career.rider.records,true)}:null;
    const parked=career.parked?.map(item=>({...item,seed:0,records:records(item.records,false)}));
    const fastForward=row.snapshot.clock.fastForward===true;
    return {career:{rider,hall,...(parked?.length?{parked}:{})},version:row.version,remainingMs:remaining(row.snapshot,weekMs),weekMs:weekMs/(fastForward?2:1),fastForward,storage:store.kind,username,scope};
  };
  return async (request:Request):Promise<Response>=>{
    try{
      if(request.method!=='GET'&&request.method!=='POST') return respond({error:'지원하지 않는 요청입니다.'},405);
      const fetchSite=request.headers.get('sec-fetch-site');
      const origin=request.headers.get('origin');
      if(fetchSite==='cross-site'||(origin&&origin!==new URL(request.url).origin)) return respond({error:'동일한 사이트에서 요청해 주세요.'},403);
      const raw=rawSession(request);
      let tokenHash=raw?hash(raw):undefined;
      const actor=tokenHash&&online?await online.actor(tokenHash):undefined;
      let id=online?actor?.id:tokenHash?await store.authenticate(tokenHash):undefined;
      const username=actor?.username??undefined;
      const scope=()=>online&&tokenHash?sessionScope(tokenHash):undefined;
      if(request.method==='POST'&&!request.headers.get('content-type')?.startsWith('application/json'))
        return respond({error:'JSON 요청이 필요합니다.'},415);
      if(new URL(request.url).searchParams.has('area')){
        if(!online) return respond({error:'온라인 기능을 사용할 수 없어요.'},503);
        if(request.method==='POST'&&actor&&request.headers.get('x-game-scope')!==scope())
          return respond({error:'로그인 상태가 바뀌었어요. 새로고침해 주세요.'},401);
        return await onlineRequest(request,online,secure,rateSecret,actor,tokenHash,request.method==='POST'?await limitedBody(request):null);
      }
      if(request.method==='GET'){
        let cookie:string|undefined;
        if(!id){
          const token=randomBytes(32).toString('base64url');
          tokenHash=hash(token);
          id=await store.createGuest(tokenHash);
          cookie=sessionCookie(token,GUEST_SECONDS,secure);
        }
        return respond(view(await store.get(id),username,scope()),200,cookie);
      }
      if(!id) return respond({error:'게스트 세션이 만료됐어요. 새로고침해 주세요.'},401);
      const parsed=input.safeParse(await limitedBody(request));
      if(!parsed.success) return respond({error:'입력값을 확인해 주세요. 이름은 한글, 영문, 숫자 등 16자까지 사용할 수 있어요.'},400);
      const {action,tab,version}=parsed.data;
      if(online&&parsed.data.scope!==scope()) return respond({error:'다른 탭에서 로그인 상태가 바뀌었어요. 새로고침해 주세요.'},401);
      for(let attempt=0;attempt<4;attempt++){
        const row=await store.get(id);
        if(action.type!=='pulse'&&version!==row.version) return respond({error:'다른 요청이 먼저 저장됐어요. 최신 기록을 불러왔습니다.',view:view(row,username,scope())},409);
        const versionedWeek=secure?RULES.weekMs:weekMs;
        const next=advance(row.snapshot,action,tab,Date.now(),versionedWeek,identity,secure&&store.kind==='neon',!!username);
        if(next===row.snapshot) return respond(view(row,username,scope()));
        const saved=await store.replace(id,row.version,next,tokenHash);
        if(saved) return respond(view(saved,username,scope()));
        if(online&&tokenHash&&!(await online.actor(tokenHash))) return respond({error:'세션이 만료됐어요. 다시 연결해 주세요.'},401);
      }
      return respond({error:'저장 요청이 겹쳤어요. 잠시 후 다시 시도해 주세요.',view:view(await store.get(id),username,scope())},409);
    } catch(e){
      if(e instanceof AccessError) return respond({error:e.message},e.status);
      if(e instanceof GameError) return respond({error:e.message},422);
      // The database driver can include connection information in its error.
      console.error('Game storage request failed');
      return respond({error:'저장소에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'},503);
    }
  };
}
