import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rmdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {createHandler} from '../server/http';
import {localStore} from '../server/store';

test('one game frame previews choices on the existing HUD before confirmation, then handles results and automatic competition',{timeout:60000},async()=>{
  const directory=await mkdtemp(join(process.cwd(),'.longboard-test-'));
  const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://127.0.0.1/',pretendToBeVisual:true});
  const win=dom.window;
  Object.defineProperty(globalThis,'navigator',{value:win.navigator,configurable:true});
  Object.assign(globalThis,{window:win,document:win.document,location:win.location,history:win.history,HTMLElement:win.HTMLElement,HTMLInputElement:win.HTMLInputElement,IS_REACT_ACT_ENVIRONMENT:true});
  const media=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  Object.assign(globalThis,{matchMedia:media});Object.assign(win,{matchMedia:media});
  win.HTMLElement.prototype.scrollIntoView=function(){};win.HTMLElement.prototype.scrollTo=function(){};
  win.HTMLCanvasElement.prototype.getContext=(function(){return new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key as keyof typeof target]:()=>{}});}) as unknown as typeof win.HTMLCanvasElement.prototype.getContext;
  const handler=createHandler(localStore(directory),2000,false);
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
  const {WeeklyChoices}=await import('../src/components/WeeklyChoices');
  const {newRider,command}=await import('../src/game/career');
  const {DEFAULT_LOOK,SKILL}=await import('../src/game/data');
  const {previewTraining}=await import('../src/game/training');
  const root=createRoot(win.document.getElementById('root')!);
  const settle=async(ms=40)=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,ms));});};
  const click=async(label:string)=>{
    const find=()=>[...win.document.querySelectorAll('button')].find(button=>(button.getAttribute('aria-label')??button.textContent?.trim())===label);
    let button=find();
    for(let attempt=0;!button&&attempt<80;attempt++){await settle(25);button=find();}
    assert.ok(button,'Missing button: '+label);
    for(let attempt=0;button.disabled&&attempt<30;attempt++)await settle(20);
    assert.equal(button.disabled,false,label+' is still disabled');
    await act(async()=>{button.click();});await settle();
    await act(async()=>{await Promise.all([...pendingRequests]);});await settle(10);
  };
  try{
    await act(async()=>{root.render(createElement(App));});
    for(let attempt=0;!win.document.querySelector('.game-console')&&attempt<80;attempt++)await settle(25);
    const frame=win.document.querySelector('.game-console');assert.ok(frame);
    await click('새 라이더 등록');
    await click('여성');await click('데크 색상 검정');
    assert.equal(win.document.querySelector('[aria-label="데크 색상 검정"]')!.getAttribute('aria-pressed'),'true');
    await click('데크 색상 흰색');
    assert.equal(win.document.querySelector('[aria-label="데크 색상 흰색"]')!.getAttribute('aria-pressed'),'true');
    assert.equal(win.document.querySelector('.gender-options button[aria-pressed="true"]')!.textContent,'여성');
    const name=win.document.querySelector<HTMLInputElement>('input[aria-label="라이더 이름"]')!;
    await act(async()=>{Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value')!.set!.call(name,'UI test rider');name.dispatchEvent(new win.Event('input',{bubbles:true}));});
    await click('등록하고 시작');
    assert.ok(win.document.querySelector('[aria-label="이번 주 행동 선택"]'));
    assert.equal(win.document.querySelectorAll('.weekly-action-grid > button').length,9);
    assert.equal(win.document.querySelectorAll('[aria-label="현재 능력치"] meter').length,4);
    assert.ok([...win.document.querySelectorAll<HTMLMeterElement>('[aria-label="현재 능력치"] meter')].every(meter=>meter.max===200));
    const headerButtons=[...win.document.querySelectorAll('.console-top-actions > button')];
    assert.equal(headerButtons[0].getAttribute('aria-label'),'자동 육성 설정');assert.equal(headerButtons[1].getAttribute('aria-label'),'자동 진행');
    assert.equal(win.document.querySelector('.weekly-settings'),null);
    await click('스팟 지도 열기');
    const map=win.document.querySelector('[aria-label="스팟 지도"]')!;
    assert.equal(map.querySelectorAll('.spot-map-card').length,6);
    assert.match(map.textContent!,/성장 \+|자주 오는 라이더|한유리|강준/);
    assert.equal(map.querySelector<HTMLButtonElement>('[aria-label="야간 광장 이동"]')!.disabled,true);
    await click('도심 광장 이동');
    assert.equal(win.document.querySelector('[aria-label="스팟 지도"]'),null);
    assert.match(win.document.querySelector('.spot-map-trigger')!.textContent!,/도심 광장/);
    assert.match(win.document.querySelector('.console-rider')!.textContent!,/1주/);
    await click('스팟 지도 열기');await click('강변 스팟 이동');
    assert.ok(![...win.document.querySelectorAll('.console-dock button')].some(button=>button.textContent==='훈련'));
    await click('자동 육성 설정');
    assert.doesNotMatch(win.document.querySelector('.auto-settings')!.textContent!,/훈련 강도|안전형|집중형/);
    await click('메뉴 닫기');
    for(const menu of ['기술','대회','상점','메뉴']){
      await click(menu);assert.equal(win.document.querySelector('.game-console'),frame);assert.ok(win.document.querySelector('.console-panel'));
      if(menu==='상점'){
        assert.equal(win.document.querySelectorAll('.equipment-choice').length,8);
        assert.equal(win.document.querySelectorAll('.equipment-loadout > div').length,6);
        await click('액세서리');assert.equal(win.document.querySelectorAll('.equipment-choice').length,30);
        await click('튼튼한 헬멧 상세');assert.ok(win.document.querySelector('[aria-label="튼튼한 헬멧 착용 미리보기"]'));
        await click('구매 ₩8,000');await click('장착');
        assert.match(win.document.querySelector('.equipment-panel .workshop-rider')!.textContent!,/액세서리 1\/3/);
        await click('튼튼한 헬멧 해제');
        const rarity=win.document.querySelector<HTMLSelectElement>('[aria-label="희귀도 필터"]')!;
        await act(async()=>{rarity.value='legendary';rarity.dispatchEvent(new win.Event('change',{bubbles:true}));});
        assert.equal(win.document.querySelectorAll('.equipment-choice').length,3);
      }
      await click('메뉴 닫기');
    }
    await click('라인');
    assert.match(win.document.querySelector('.console-panel')!.textContent!,/라인 편집/);
    assert.doesNotMatch(win.document.querySelector('.console-panel')!.textContent!,/루틴/);
    await click('피터팬 추가');await click('라인 저장');
    assert.ok([...win.document.querySelectorAll('button')].some(button=>button.textContent?.includes('저장된 구성')&&button.disabled));
    await click('메뉴 닫기');
    const speedGauge=win.document.querySelector('.stat-speed');
    const selectionSlot=win.document.querySelector('.weekly-selection-slot');
    await click('속도 훈련 선택');
    assert.equal(win.document.querySelector('.weekly-selection-slot'),selectionSlot,'Reserve the same preview area for every selection');
    assert.equal(win.document.querySelector('.stat-speed'),speedGauge,'Forecast must update the existing top gauge');
    assert.ok(win.document.querySelector('[aria-label="속도 예상 상승"]'));
    assert.ok(win.document.querySelector('[aria-label="연계 예상 상승"]'));
    assert.equal(win.document.querySelector<HTMLMeterElement>('meter[aria-label="속도"]')!.value,18,'A forecast must not change the saved stat');
    assert.equal(win.document.querySelectorAll('.weekly-action-grid > button').length,9);
    assert.equal(win.document.querySelector('.weekly-preview'),null,'Do not open a second detail panel');
    assert.match(win.document.querySelector('[aria-label="예상 체력 변화"]')!.textContent!,/100 → 83/);
    assert.equal(win.document.querySelector('select[aria-label="훈련 강도"]'),null);
    await click('카빙 훈련 선택');
    assert.equal(win.document.querySelector('[aria-label="속도 예상 상승"]'),null);
    assert.ok(win.document.querySelector('[aria-label="카빙 예상 상승"]'));
    await click('선택 취소');
    assert.equal(win.document.querySelector('.status-projection'),null);
    assert.equal(win.document.querySelector('[aria-label="예상 체력 변화"]'),null);
    await click('속도 훈련 선택');injectClock=true;
    assert.ok(!win.document.querySelector('.console-panel'));
    await click('확인하고 수행');
    assert.equal(clockRaces,1);assert.equal(win.document.querySelector('[role="alert"]'),null);
    assert.ok(!win.document.querySelector('.console-panel'));
    assert.ok(win.document.querySelector('[aria-label="행동 진행"]'));
    await settle(2400);
    assert.ok(win.document.querySelector('[aria-label="이번 주 행동 결과"]'));
    await click('확인하고 계속');
    const event=win.document.querySelector('[aria-label="이벤트 선택"]');assert.ok(event);
    const choice=event.querySelector<HTMLButtonElement>('button')!;
    await act(async()=>{choice.click();});await settle();
    await act(async()=>{await Promise.all([...pendingRequests]);});await settle(10);
    assert.match(win.document.querySelector('.console-rider')!.textContent!,/2주/);
    await click('휴식 선택');
    assert.ok(win.document.querySelector('[aria-label="예상 체력 변화"]'));
    assert.equal(win.document.querySelector('.status-projection'),null,'Rest should preview stamina instead of stat growth');
    await click('선택 취소');await click('속도 훈련 선택');injectChoice=true;
    await click('확인하고 수행');
    assert.ok(win.document.querySelector('.console-sync-note'));
    assert.equal(win.document.querySelector('[role="alert"]'),null);
    assert.ok(win.document.querySelector('[aria-label="선택한 행동 확인"]'),'A rejected choice must stay selected instead of pretending it saved');
    await click('확인하고 수행');
    assert.ok(win.document.querySelector('[aria-label="행동 진행"]'));
    assert.equal(win.document.querySelector('.game-console'),frame);
    const rider=newRider('automatic-ui',71,'Auto rider',DEFAULT_LOOK);
    rider.energy=0;
    let selected:Parameters<typeof previewTraining>[1]|undefined;
    await act(async()=>root.render(createElement(WeeklyChoices,{r:rider,send:async()=>true,saving:false,onPreview:plan=>{selected=plan;}})));
    await click('속도 훈련 선택');
    assert.match(win.document.querySelector('.weekly-success')!.textContent!,/12%/);
    assert.match(win.document.querySelector('.weekly-success')!.textContent!,/실패 위험/);
    await click('휴식 선택');
    assert.equal(previewTraining(rider,selected!).energyAfter,41);
    rider.week=7;rider.phase='meet';rider.settings={mode:'auto',strategy:'balanced',entries:['dance','trick']};
    const career={rider,hall:[]};
    command(career,{type:'entry',disciplines:['dance','trick']},()=>({id:'automatic-ui',seed:71}));
    const record=structuredClone(rider.records[0]);
    let continued=0;
    const realNow=Object.getOwnPropertyDescriptor(performance,'now');
    let playbackNow=performance.now();
    Object.defineProperty(performance,'now',{configurable:true,value:()=>playbackNow});
    const stage=()=>createElement(GameStage,{r:rider,send:async()=>true,saving:false,remaining:0,weekMs:2000,fastForward:false,spot:'river',motion:'ride',record,onDone:()=>{continued++;}});
    try{
      const began=playbackNow;
      await act(async()=>root.render(stage()));
      assert.equal(win.document.querySelector('[aria-label="대회 스킵"]')?.textContent?.includes('스킵'),true);
      assert.doesNotMatch(win.document.querySelector('[aria-label="인게임 대회"]')!.textContent!,/하이라이트/);
      assert.ok(record.results[0].run.log.length>3);
      for(const move of record.results[0].run.log){
        playbackNow=began+5000+(move.at+.25)*1000;await settle(120);
        assert.equal(win.document.querySelector('[aria-label="경기 진행"] h2')!.textContent,SKILL[move.id]!.name,'Every move in the complete line must be presented');
      }
      playbackNow=began+68000;await settle(120);
      assert.ok(win.document.querySelector('[aria-label="대회 시상식"]'));
      for(let n=0;n<23;n++){await act(async()=>root.render(stage()));await settle(100);}
      assert.ok(win.document.querySelector('[aria-label="대회 스킵"]'),'The next discipline must start despite fresh callbacks every 100ms');
      await click('대회 스킵');
      assert.ok(win.document.querySelector('[aria-label="대회 시상식"]'));
      for(let n=0;n<23;n++){await act(async()=>root.render(stage()));await settle(100);}
      assert.equal(continued,1,'Full playback and skipping must each advance through their ceremony once');
    }finally{
      if(realNow)Object.defineProperty(performance,'now',realNow);else Reflect.deleteProperty(performance,'now');
    }
    await act(async()=>{await Promise.all([...pendingRequests]);});cookie='';
    await act(async()=>root.render(createElement(App,{key:'automatic-cycle'})));await settle(100);
    await click('새 라이더 등록');
    const autoName=win.document.querySelector<HTMLInputElement>('input[aria-label="라이더 이름"]')!;
    await act(async()=>{Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value')!.set!.call(autoName,'Auto cycle');autoName.dispatchEvent(new win.Event('input',{bubbles:true}));});
    await click('등록하고 시작');await click('자동 진행');
    for(let cycle=0;cycle<2;cycle++){
      assert.ok(win.document.querySelector('[aria-label="자동 행동 선택"]'));
      assert.equal(win.document.querySelectorAll('.weekly-action-grid > button').length,9);
      assert.equal(win.document.querySelectorAll('.weekly-action-grid > button[aria-pressed="true"]').length,1);
      await settle(2150);
      assert.equal(win.document.querySelector('[aria-label="자동 행동 선택"]'),null);
      assert.ok(win.document.querySelector('[aria-label="행동 진행"]'));
      await settle(2250);
      assert.ok(win.document.querySelector('[aria-label="이번 주 행동 결과"]'));
      await settle(1000);
      assert.ok(win.document.querySelector('[aria-label="이번 주 행동 결과"]'),'Result should remain visible for two seconds');
      await settle(1150);
    }
    assert.match(win.document.querySelector('.console-rider')!.textContent!,/3주/);
  }finally{
    await act(async()=>root.unmount());await Promise.allSettled([...pendingRequests]);globalThis.fetch=originalFetch;dom.window.close();
    for(const file of await readdir(directory))await unlink(join(directory,file));await rmdir(directory);
  }
});
