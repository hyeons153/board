import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AccessError, ACCOUNT_SECONDS, type Actor, type OnlineStore } from './databaseStore.js';
import { METRICS } from '../src/game/public.js';
import { DIVISIONS } from '../src/game/types.js';

const username=z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,23}$/);
const password=z.string().min(12).max(96).refine(value=>Buffer.byteLength(value,'utf8')<=256);
const authAction=z.discriminatedUnion('type',[
  z.strictObject({type:z.literal('register'),username,password}),
  z.strictObject({type:z.literal('login'),username,password}),
  z.strictObject({type:z.literal('logout')}),
  z.strictObject({type:z.literal('delete'),username,password}),
]);
const publicAction=z.discriminatedUnion('type',[
  z.strictObject({type:z.literal('publish'),archiveId:z.uuid(),active:z.boolean()}),
  z.strictObject({type:z.literal('report'),id:z.uuid(),reason:z.enum(['name','impersonation','other'])}),
]);
const list=z.object({
  page:z.coerce.number().int().min(1).max(2000).default(1),
  search:z.string().trim().max(40).default(''),
  division:z.enum(['all',...DIVISIONS]).default('all'),
  ending:z.enum(['','legend','champion','technician','veteran','early']).default(''),
  complete:z.enum(['0','1']).default('0').transform(value=>value==='1'),
  metric:z.enum(METRICS).optional(),
});
const matchUuid=z.uuid();
const options={N:65536,r:8,p:2,maxmem:80*1024*1024};
const derive=(password:string,salt:Buffer)=>new Promise<Buffer>((resolve,reject)=>{
  scrypt(password,salt,32,options,(error,key)=>error?reject(error):resolve(key));
});
const dummy='s1.'+Buffer.alloc(16).toString('base64url')+'.'+Buffer.alloc(32).toString('base64url');
async function makePassword(password:string){
  const salt=randomBytes(16);
  return 's1.'+salt.toString('base64url')+'.'+(await derive(password,salt)).toString('base64url');
}
async function verifyPassword(password:string,hash=dummy){
  const [version,salt,key]=hash.split('.');
  if(version!=='s1'||!salt||!key) return false;
  const expected=Buffer.from(key,'base64url');
  const computed=await derive(password,Buffer.from(salt,'base64url'));
  return expected.length===computed.length&&timingSafeEqual(expected,computed);
}
export const sessionHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export const sessionScope=(hash:string)=>sessionHash('browser-scope:'+hash);
export const sessionCookie=(value:string,seconds:number,secure:boolean)=>
  'lbl_guest='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+seconds+(secure?'; Secure':'');
export const rawSession=(request:Request)=>request.headers.get('cookie')?.match(/(?:^|;\s*)lbl_guest=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];

const json=(payload:unknown,status=200,cookie?:string)=>Response.json(payload,{status,headers:{
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{}),
}});
const needsAccount=(actor:Actor|undefined,hash:string|undefined):{actor:Actor;hash:string}=>{
  if(!actor?.username||!hash) throw new AccessError('계정에 로그인해 주세요.',401);
  return {actor,hash};
};
function passwordKey(request:Request,secure:boolean,secret:string|undefined){
  if(secure&&!secret) throw new AccessError('서버의 계정 설정이 준비되지 않았어요.',503);
  const address=secure ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()??'unknown' : 'local';
  return createHmac('sha256',secret??'local-longboard-rate-limit').update(address).digest('hex');
}

export async function onlineRequest(request:Request,store:OnlineStore,secure:boolean,secret:string|undefined,actor:Actor|undefined,hash:string|undefined,body:unknown){
  const params=new URL(request.url).searchParams;
  const area=params.get('area');
  if(area==='account'){
    if(request.method!=='POST') throw new AccessError('지원하지 않는 요청입니다.',405);
    const parsed=authAction.safeParse(body);
    if(!parsed.success) throw new AccessError('아이디는 영문·숫자 등 3~24자, 비밀번호는 12자 이상으로 입력해 주세요.');
    const action=parsed.data;
    if(action.type==='logout'){
      const logged=needsAccount(actor,hash);
      await store.logout(logged.actor,logged.hash);
      return json({ok:true},200,sessionCookie('',0,secure));
    }
    const client=passwordKey(request,secure,secret);
    const accepted=await store.rate('ip:'+client,40,600);
    if(!accepted||!await store.rate('login:'+sessionHash(action.username),12,600)) throw new AccessError('요청이 많아요. 10분 뒤 다시 시도해 주세요.',429);
    if(action.type==='delete'){
      const logged=needsAccount(actor,hash);
      const record=await store.credential(action.username);
      if(logged.actor.username!==action.username||!record||record.id!==logged.actor.id||!await verifyPassword(action.password,record.passwordHash))
        throw new AccessError('계정과 비밀번호를 확인해 주세요.',403);
      await store.erase(logged.actor,logged.hash);
      return json({ok:true},200,sessionCookie('',0,secure));
    }
    const token=randomBytes(32).toString('base64url');
    const next=sessionHash(token);
    if(action.type==='register'){
      if(!actor||!hash) throw new AccessError('게임 화면을 새로 열고 다시 시도해 주세요.',401);
      if(actor.username) throw new AccessError('이미 로그인되어 있어요.',409);
      try{
        await store.register(actor,hash,next,action.username,await makePassword(action.password));
      }catch(error){
        if((error as {code?:string}).code==='23505') throw new AccessError('사용할 수 없는 아이디예요.',409);
        throw error;
      }
    }else{
      if(actor?.username) throw new AccessError('먼저 로그아웃해 주세요.',409);
      const account=await store.credential(action.username);
      const matches=await verifyPassword(action.password,account?.passwordHash);
      if(!account||!matches) throw new AccessError('아이디 또는 비밀번호를 확인해 주세요.',401);
      await store.login(account.id,actor,hash,next);
    }
    return json({ok:true},200,sessionCookie(token,ACCOUNT_SECONDS,secure));
  }
  if(area==='public'){
    if(request.method==='GET'){
      const id=params.get('id');
      if(id!==null){
        if(!matchUuid.safeParse(id).success) throw new AccessError('공개 선수를 찾을 수 없어요.',404);
        const profile=await store.profile(id,actor?.id);
        if(!profile) throw new AccessError('공개 선수를 찾을 수 없어요.',404);
        return json(profile);
      }
      const parsed=list.safeParse(Object.fromEntries(params));
      if(!parsed.success) throw new AccessError('검색이나 페이지 조건을 확인해 주세요.');
      return json(await store.directory(parsed.data,actor?.username?actor.id:undefined));
    }
    const logged=needsAccount(actor,hash);
    if((body as {type?:string}|null)?.type==='mine') return json(await store.publications(logged.actor.id));
    const parsed=publicAction.safeParse(body);
    if(!parsed.success) throw new AccessError('공개 요청을 확인해 주세요.');
    const action=parsed.data;
    if(action.type==='publish') return json(await store.publish(logged.actor,logged.hash,action.archiveId,action.active));
    if(!await store.rate('report:'+logged.actor.id,20,3600)) throw new AccessError('신고 요청이 많아요. 잠시 뒤 다시 시도해 주세요.',429);
    await store.report(logged.actor,logged.hash,action.id,action.reason);
    return json({ok:true});
  }
  throw new AccessError('지원하지 않는 경로입니다.',404);
}
