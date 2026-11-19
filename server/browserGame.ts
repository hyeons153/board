import { z } from 'zod';
import { GameError } from '../src/game/career.js';
import type { Archive, BrowserSaveResponse } from '../src/game/types.js';
import { AccessError, type OnlineStore } from './databaseStore.js';
import { advance, blankSave } from './clock.js';
import { gameView } from './gameView.js';
import { actionSchema, identity, limitedBody, respond, sameOrigin } from './http.js';
import { onlineRequest, rawSession, sessionHash, sessionScope } from './online.js';
import { MAX_SAVE_REQUEST, saveSeal } from './saveSeal.js';
import type { Row } from './store.js';

const replayId=z.string().regex(/^\d{1,2}:[a-z0-9-]{1,60}$/);
const input=z.strictObject({
  tab:z.uuid(),
  checkpoint:z.string().min(1).max(MAX_SAVE_REQUEST-4096).optional(),
  action:actionSchema.optional(),
  replay:replayId.optional(),
}).refine(value=>!(value.action&&value.replay));

export function createBrowserGame(options:{
  secret:string;rateSecret?:string;secure:boolean;weekMs:number;
  hall:()=>Promise<OnlineStore>|OnlineStore;
  legacy?:()=>Promise<OnlineStore>|OnlineStore;
}){
  const {secret,rateSecret,secure,weekMs,hall,legacy}=options;
  const seal=saveSeal(secret);

  function payload(row:Row,archives:Archive[],tab?:string,checkpoint=false){
    const view=gameView(row,weekMs,'browser',undefined,undefined,true,tab);
    const response:BrowserSaveResponse={view:{...view,career:{...view.career,hall:[]}}};
    if(archives.length){
      const summaries=new Map(view.career.hall.map(archive=>[archive.id,archive]));
      response.archives=archives.map(archive=>({
        archive:summaries.get(archive.id)!,
        ticket:seal.encode('archive',{...archive,records:archive.records.map(meet=>({
          ...meet,results:meet.results.map(({opponents,...result})=>result),
        }))}),
      }));
    }
    if(checkpoint){
      // The latest archive summary is sufficient to introduce the next rider's mentor.
      const snapshot={...row.snapshot,career:{...row.snapshot.career,hall:view.career.hall.slice(-1)}};
      response.checkpoint=seal.encode('career',{...row,snapshot});
    }
    const json=JSON.stringify(response);
    if(Buffer.byteLength(json)>MAX_SAVE_REQUEST||response.checkpoint&&response.checkpoint.length>MAX_SAVE_REQUEST-4096)
      return respond({error:'저장 기록이 이번 요청의 용량을 초과했어요. 기존 기록은 그대로 있어요.'},413);
    return new Response(json,{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }

  return async (request:Request):Promise<Response>=>{
    if(!sameOrigin(request))return respond({error:'동일한 사이트에서 요청해 주세요.'},403);
    const area=new URL(request.url).searchParams.get('area');
    if(request.method==='GET'&&!area)return respond({storage:'browser',legacySave:!!legacy});
    try{
      if(area==='legacy-save'){
        if(request.method!=='POST')return respond({error:'지원하지 않는 요청입니다.'},405);
        const token=rawSession(request);
        if(!legacy||!token)return respond({error:'이 브라우저와 연결된 기존 저장 기록이 없어요.'},404);
        const store=await legacy(),actor=await store.actor(sessionHash(token));
        if(!actor)return respond({error:'이 브라우저와 연결된 기존 저장 기록이 없어요.'},404);
        const row=await store.get(actor.id);
        if(!row.snapshot.career.rider&&!row.snapshot.career.hall.length)
          return respond({error:'가져올 선수 기록이 없어요.'},404);
        // Drop the old tab lease so the new browser session can resume autoplay.
        const snapshot={...row.snapshot,clock:{...row.snapshot.clock,tabs:{},background:undefined}};
        return payload({version:row.version+1,snapshot},snapshot.career.hall,undefined,true);
      }
      if(area==='account'||area==='public'){
        if(request.method!=='GET'&&request.method!=='POST')return respond({error:'지원하지 않는 요청입니다.'},405);
        if(request.method==='POST'&&!request.headers.get('content-type')?.startsWith('application/json'))
          return respond({error:'JSON 요청이 필요합니다.'},415);
        const store=await hall(),token=rawSession(request,'lbl_hall');
        const tokenHash=token?sessionHash(token):undefined;
        const actor=tokenHash?await store.actor(tokenHash):undefined;
        if(request.method==='POST'&&actor&&tokenHash&&request.headers.get('x-game-scope')!==sessionScope(tokenHash))
          return respond({error:'로그인 상태가 바뀌었어요. 새로고침해 주세요.'},401);
        const body=request.method==='POST'?await limitedBody(request,area==='public'?MAX_SAVE_REQUEST:4096):null;
        return await onlineRequest(request,store,secure,rateSecret,actor,tokenHash,body,{
          archive:ticket=>seal.decode<Archive>('archive',ticket),
        });
      }
      if(area!=='save')return respond({error:'지원하지 않는 경로입니다.'},404);
      if(request.method!=='POST')return respond({error:'지원하지 않는 요청입니다.'},405);
      if(!request.headers.get('content-type')?.startsWith('application/json'))
        return respond({error:'JSON 요청이 필요합니다.'},415);
      const parsed=input.safeParse(await limitedBody(request,MAX_SAVE_REQUEST));
      if(!parsed.success)return respond({error:'저장 요청을 확인해 주세요.'},400);
      const {action,checkpoint,replay,tab}=parsed.data;
      const row=checkpoint?seal.decode<Row>('career',checkpoint):{version:0,snapshot:blankSave()};
      if(replay){
        const record=row.snapshot.career.rider?.records.find(meet=>meet.year+':'+meet.id===replay);
        if(!record)return respond({error:'이 선수의 경기 기록을 찾지 못했어요.'},404);
        return respond({...record,detail:'full',results:record.results.map(({proof,...result})=>result)});
      }
      if(!action)return payload(row,[],tab);
      const next=advance(row.snapshot,action,tab,Date.now(),weekMs,identity,secure,true);
      if(next===row.snapshot&&action.type==='pulse')return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
      const archives=next.career.hall.filter(archive=>!row.snapshot.career.hall.some(saved=>saved.id===archive.id));
      return payload({version:row.version+1,snapshot:next},archives,tab,true);
    }catch(error){
      if(error instanceof AccessError)return respond({error:error.message},error.status);
      if(error instanceof GameError)return respond({error:error.message},422);
      console.error('Browser game request failed');
      return respond({error:'요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'},503);
    }
  };
}
