import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rmdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {createHandler} from '../server/http';
import {localStore} from '../server/store';

test('one game frame handles menus, weekly choice, result/event flow and silent clock rebasing',async()=>{
  const directory=await mkdtemp(join(process.cwd(),'.longboard-test-'));
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://127.0.0.1/',pretendToBeVisual:true});
  const win=dom.window;
  Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
  Object.assign(globalThis,{window:win,document:win.document,location:win.location,history:win.history,HTMLElement:win.HTMLElement,HTMLInputElement:win.HTMLInputElement,IS_REACT_ACT_ENVIRONMENT:true});
  const media=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  Object.assign(globalThis,{matchMedia:media});Object.assign(win,{matchMedia:media});
  win.HTMLElement.prototype.scrollIntoView=function(){};win.HTMLElement.prototype.scrollTo=function(){};
  win.HTMLCanvasElement.prototype.getContext=(function(){return new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key as keyof typeof target]:()=>{}});}) as unknown as typeof win.HTMLCanvasElement.prototype.getContext;
  const handler=createHandler(localStore(directory),1000,false);
  const originalFetch=globalThis.fetch;
  let cookie='',injectClock=false,injectChoice=false,clockRaces=0;
  const pendingRequests=new Set<Promise<Response>>();
  const mockFetch:typeof fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,'http://127.0.0.1');
    const headers=new Headers(init?.headers);headers.set('origin',url.origin);if(cookie)headers.set('cookie',cookie);
    const body=typeof init?.body==='string'?JSON.parse(init.body):undefined;
    if(body?.action.type==='plan'&&(injectClock||injectChoice)){
      const action=injectChoice?{type:'fast-forward',enabled:true}:{type:'pulse'};
      injectClock=false;injectChoice=false;clockRaces++;
      await handler(new Request(url,{method:'POST',headers,body:JSON.stringify({...body,tab:randomUUID(),action})}));
    }
    const response=await handler(new Request(url,{...init,headers}));
    const received=response.headers.get('set-cookie');if(received)cookie=received.split(';')[0];
    return response;
  };
  globalThis.fetch=((input,init)=>{const request=mockFetch(input,init);pendingRequests.add(request);void request.then(()=>pendingRequests.delete(request),()=>pendingRequests.delete(request));return request;}) as typeof fetch;
  const {act,createElement}=await import('react');
  const {createRoot}=await import('react-dom/client');
  const {default:App}=await import('../src/App');
  const {default:GameStage}=await import('../src/components/GameStage');
  const {newRider,command}=await import('../src/game/career');
  const {DEFAULT_LOOK}=await import('../src/game/data');
  const root=createRoot(win.document.getElementById('root')!);
  const settle=async(ms=40)=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,ms));});};
  const click=async(label:string)=>{
    const button=[...win.document.querySelectorAll('button')].find(button=>(button.getAttribute('aria-label')??button.textContent?.trim())===label);
    assert.ok(button,'Missing button: '+label);
    await act(async()=>{button.click();});await settle();
  };
  try{
    await act(async()=>{root.render(createElement(App));});await settle(80);
    const frame=win.document.querySelector('.game-console');assert.ok(frame);
    await click('새 라이더 등록');
    const name=win.document.querySelector<HTMLInputElement>('input[aria-label="라이더 이름"]')!;
    await act(async()=>{Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value')!.set!.call(name,'UI test rider');name.dispatchEvent(new win.Event('input',{bubbles:true}));});
    await click('등록하고 시작');
    assert.ok(win.document.querySelector('.console-home-actions'));
    for(const menu of ['기술','대회','상점','메뉴']){
      await click(menu);assert.equal(win.document.querySelector('.game-console'),frame);assert.ok(win.document.querySelector('.console-panel'));await click('메뉴 닫기');
    }
    await click('훈련');injectClock=true;
    await click('선택하고 이번 주 시작');
    assert.equal(clockRaces,1);assert.equal(win.document.querySelector('[role="alert"]'),null);
    assert.ok(!win.document.querySelector('.console-panel'));
    await settle(1400);
    assert.ok(win.document.querySelector('[aria-label="이번 주 행동 결과"]'));
    await click('확인하고 계속');
    const event=win.document.querySelector('[aria-label="이벤트 선택"]');assert.ok(event);
    const choice=event.querySelector<HTMLButtonElement>('button')!;
    await act(async()=>{choice.click();});await settle();
    assert.match(win.document.querySelector('.console-rider')!.textContent!,/2주/);
    await click('훈련');injectChoice=true;
    await click('선택하고 이번 주 시작');
    assert.ok(win.document.querySelector('.console-sync-note'));
    assert.equal(win.document.querySelector('[role="alert"]'),null);
    assert.ok(win.document.querySelector('.console-panel'),'A rejected choice must stay open instead of pretending it saved');
    await click('선택하고 이번 주 시작');
    assert.ok(!win.document.querySelector('.console-panel'));
    assert.equal(win.document.querySelector('.game-console'),frame);
    const rider=newRider('automatic-ui',71,'Auto rider',DEFAULT_LOOK);
    rider.week=7;rider.phase='meet';rider.settings={mode:'auto',strategy:'balanced',intensity:'safe',entries:['dance','trick']};
    const career={rider,hall:[]};
    command(career,{type:'entry',disciplines:['dance','trick']},()=>({id:'automatic-ui',seed:71}));
    const record=structuredClone(rider.records[0]);
    for(const result of record.results)result.run.log=result.run.log.slice(0,1);
    let continued=0;
    await act(async()=>root.render(createElement(GameStage,{r:rider,send:async()=>true,saving:false,remaining:0,weekMs:30000,fastForward:false,spot:'river',motion:'ride',record,onDone:()=>{continued++;}})));
    for(let attempt=0;attempt<24&&!continued;attempt++)await settle(650);
    assert.equal(continued,1,'Automatic playback must advance through both ceremonies without any user click');
  }finally{
    await act(async()=>root.unmount());await Promise.allSettled([...pendingRequests]);globalThis.fetch=originalFetch;dom.window.close();
    for(const file of await readdir(directory))await unlink(join(directory,file));await rmdir(directory);
  }
});
