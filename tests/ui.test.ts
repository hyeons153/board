import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rmdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {createHandler} from '../server/http';
import {localStore} from '../server/store';
import {publicationFor} from '../server/ranking';
import type { Publication, PublicCard } from '../src/game/public';
import type { View } from '../src/game/types';

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
  let hallFlow=false,signedIn=false,hallPublication:Publication|undefined,publicCard:PublicCard|undefined;
  let nextRankStatus:Publication['rankStatus']='eligible';
  const hallActions:string[]=[];
  const pendingRequests=new Set<Promise<Response>>();
  const requestActions:string[]=[];
  const mockFetch:typeof fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,'http://127.0.0.1');
    const headers=new Headers(init?.headers);headers.set('origin',url.origin);if(cookie)headers.set('cookie',cookie);
    const body=typeof init?.body==='string'?JSON.parse(init.body):undefined;
    if(hallFlow&&url.searchParams.has('area')){
      const area=url.searchParams.get('area');
      if(area==='account'&&['login','register','logout'].includes(body?.type)){
        hallActions.push(body.type);signedIn=body.type!=='logout';return Response.json({ok:true});
      }
      if(area==='public'){
        if(body?.type==='mine')return Response.json(hallPublication?[hallPublication]:[]);
        if(body?.type==='publish'){
          assert.ok(signedIn);assert.equal(headers.get('x-game-scope'),'test-hall-scope');
          assert.equal(body.archiveId,hallPublication?.archiveId??(await (await handler(new Request(url.origin+'/api/game',{headers}))).json()).career.hall[0].id);
          hallActions.push(body.active?'publish':'withdraw');
          hallPublication={id:publicCard!.id,archiveId:body.archiveId,active:body.active,moderated:false,rankStatus:nextRankStatus};
          return Response.json(hallPublication);
        }
        if(url.searchParams.has('id'))return Response.json(publicCard);
        const mine=hallPublication?.active&&hallPublication.rankStatus==='eligible'?[{...publicCard,rank:17,mine:true}]:[];
        return Response.json({rows:[],page:1,mine,hasMore:false});
      }
    }
    if(body?.action)requestActions.push(body.action.type);
    if(body?.action.type==='plan'&&(injectClock||injectChoice)){
      const action=injectChoice?{type:'fast-forward',enabled:true}:{type:'pulse'};
      injectClock=false;injectChoice=false;clockRaces++;
      await handler(new Request(url,{method:'POST',headers,body:JSON.stringify({...body,tab:randomUUID(),action})}));
    }
    const response=await handler(new Request(url,{...init,headers}));
    const received=response.headers.get('set-cookie');if(received)cookie=received.split(';')[0];
    if(hallFlow&&signedIn&&!body&&response.ok){
      const view:View=await response.json();return Response.json({...view,username:'test_rider',scope:'test-hall-scope'});
    }
    return response;
  };
  globalThis.fetch=((input,init)=>{const request=mockFetch(input,init);pendingRequests.add(request);void request.then(()=>pendingRequests.delete(request),()=>pendingRequests.delete(request));return request;}) as typeof fetch;
  const {act,createElement}=await import('react');
  const {createRoot}=await import('react-dom/client');
  const {default:App}=await import('../src/App');
  const {default:GameStage}=await import('../src/components/GameStage');
  const {WeeklyChoices}=await import('../src/components/WeeklyChoices');
  const {Meets}=await import('../src/components/Meets');
  const {Rivals}=await import('../src/components/Records');
  const {newRider,command}=await import('../src/game/career');
  const {simulateMeet}=await import('../src/game/competition');
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
    await click('나만의 라이더 만들기');
    await click('여성');await click('데크 색상 검정');
    assert.equal(win.document.querySelectorAll('.look-presets button').length,5);
    await click('추천 코디 3');
    assert.equal(win.document.querySelector<HTMLSelectElement>('[aria-label="헤어스타일"]')!.value,'6');
    assert.equal(win.document.querySelector<HTMLSelectElement>('[aria-label="상의 디자인"]')!.value,'1');
    await click('오른쪽');
    assert.equal(win.document.querySelector('.look-views [aria-pressed="true"]')!.textContent,'오른쪽');
    await click('뒤');await click('정면');
    const hairstyle=win.document.querySelector<HTMLSelectElement>('[aria-label="헤어스타일"]')!;
    assert.equal(hairstyle.options.length,13);
    await act(async()=>{hairstyle.value='10';hairstyle.dispatchEvent(new win.Event('change',{bubbles:true}));});
    await settle();assert.equal(hairstyle.value,'10');
    assert.equal(win.document.querySelector('[aria-label="데크 색상 검정"]')!.getAttribute('aria-pressed'),'true');
    await click('데크 색상 흰색');
    assert.equal(win.document.querySelector('[aria-label="데크 색상 흰색"]')!.getAttribute('aria-pressed'),'true');
    assert.equal(win.document.querySelector('.gender-options button[aria-pressed="true"]')!.textContent,'여성');
    const name=win.document.querySelector<HTMLInputElement>('input[aria-label="라이더 이름"]')!;
    await act(async()=>{Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value')!.set!.call(name,'UI test rider');name.dispatchEvent(new win.Event('input',{bubbles:true}));});
    await click('육성 시작');
    const created=await handler(new Request('http://127.0.0.1/api/game',{headers:{cookie}}));
    const createdView=await created.json();assert.equal(createdView.career.rider.look.hair,10);assert.equal(createdView.career.rider.look.outfit,1);assert.equal(createdView.career.rider.look.bottom,3);
    const options=win.document.querySelector('[aria-label="이번 주 행동 선택"]')!;
    assert.equal(options.querySelector('h2')?.textContent,'이번 주엔 무엇을 할까?');
    assert.deepEqual([...options.querySelectorAll('.weekly-action-grid strong')].map(label=>label.textContent),
      ['속도','카빙','연계','밸런스','댄싱','트릭','휴식','병원 치료']);
    assert.equal(win.document.querySelector('[aria-label="라인 리허설 선택"]'),null);
    assert.equal(win.document.querySelectorAll('[aria-label="현재 능력치"] meter').length,4);
    assert.ok([...win.document.querySelectorAll<HTMLMeterElement>('[aria-label="현재 능력치"] meter')].every(meter=>meter.max===200));
    const headerButtons=[...win.document.querySelectorAll('.console-top-actions > button')];
    assert.equal(headerButtons[0].getAttribute('aria-label'),'자동 육성 설정');assert.equal(headerButtons[1].getAttribute('aria-label'),'자동 진행');
    assert.equal(win.document.querySelector('.weekly-settings'),null);
    await click('스팟 지도 열기');
    const map=win.document.querySelector('[aria-label="스팟 지도"]')!;
    assert.equal(map.querySelectorAll('.spot-map-card').length,7);
    assert.match(map.textContent!,/성장 \+|자주 오는 라이더|한유리|강준/);
    const plazaVisitor=map.querySelector('[aria-label="도심 광장 이동"] .spot-map-extra')?.textContent?.replace('이번 주 방문 · ','');
    assert.ok(plazaVisitor);
    assert.equal(map.querySelector<HTMLButtonElement>('[aria-label="야간 광장 이동"]')!.disabled,true);
    assert.equal(map.querySelector<HTMLButtonElement>('[aria-label="노을 옥상 이동"]')!.disabled,true);
    await click('도심 광장 이동');
    assert.equal(win.document.querySelector('[aria-label="스팟 지도"]'),null);
    assert.match(win.document.querySelector('.spot-map-trigger')!.textContent!,/도심 광장/);
    assert.equal(win.document.querySelector('.console-visitor')?.textContent,plazaVisitor);
    assert.equal(win.document.querySelector('.console-rider b')!.textContent,'1년차 · 1월 첫째 주');
    await click('스팟 지도 열기');await click('강변 스팟 이동');
    assert.ok(![...win.document.querySelectorAll('.console-dock button')].some(button=>button.textContent==='훈련'));
    await click('자동 육성 설정');
    assert.doesNotMatch(win.document.querySelector('.auto-settings')!.textContent!,/훈련 강도|안전형|집중형/);
    assert.ok(win.document.querySelector('.console-panel-settings'));
    const optionsChecks=[...win.document.querySelectorAll<HTMLInputElement>('.auto-settings input[type="checkbox"]')];
    assert.deepEqual(optionsChecks.map(node=>node.parentElement?.textContent),['이벤트 선택지 스킵하기','대회 진행 스킵하기']);
    assert.deepEqual(optionsChecks.map(node=>node.checked),[true,false]);
    const beforeApply=requestActions.filter(action=>action==='settings').length;
    await act(async()=>{optionsChecks[0].click();optionsChecks[1].click();});
    const entryRadios=[...win.document.querySelectorAll<HTMLInputElement>('.auto-settings input[type="radio"]')];assert.equal(entryRadios.filter(input=>input.checked).length,1);
    await act(async()=>entryRadios[1].click());await settle();await act(async()=>{await Promise.all([...pendingRequests]);});
    assert.equal(win.document.querySelectorAll('.auto-settings input[type="radio"]:checked').length,1);
    assert.equal(win.document.querySelector<HTMLInputElement>('.auto-settings input[type="radio"]:checked')!.parentElement!.textContent,'트릭');
    const strategy=win.document.querySelector<HTMLSelectElement>('.auto-settings select')!;
    await act(async()=>{strategy.value='freestyle';strategy.dispatchEvent(new win.Event('change',{bubbles:true}));});await settle();await act(async()=>{await Promise.all([...pendingRequests]);});
    assert.match(win.document.querySelector('[aria-label="자동 육성 전략 설명"]')!.textContent!,/댄싱·트릭|연계·카빙·밸런스/);
    assert.equal(requestActions.filter(action=>action==='settings').length,beforeApply,'Edit preferences in the form without saving each input');
    await click('설정 적용');
    assert.equal(win.document.querySelector('.auto-settings'),null);
    const applied=await (await handler(new Request('http://127.0.0.1/api/game',{headers:{cookie}}))).json();
    assert.deepEqual([applied.career.rider.settings.mode,applied.career.rider.settings.entries,applied.career.rider.settings.skipEvents,applied.career.rider.settings.skipMeets],
      ['manual',['trick'],false,true]);
    for(const menu of ['기술','대회','상점','메뉴']){
      await click(menu);assert.equal(win.document.querySelector('.game-console'),frame);assert.ok(win.document.querySelector('.console-panel'));
      if(menu==='기술'){
        assert.equal(win.document.querySelector('.skill-detail'),null);
        assert.doesNotMatch(win.document.querySelector('.skill-library')!.textContent!,/동작 참고|보드를 타보자/);
        await click('피터팬 상세');
        assert.match(win.document.querySelector('.skill-detail')!.textContent!,/선행 기술|대회 성공률/);
        assert.deepEqual([...win.document.querySelectorAll('.skill-detail-actions button')].map(button=>button.textContent?.trim()),['동작 보기']);
        await click('피터팬 미리보기');
        assert.ok(win.document.querySelector('.technique-preview'));
        await click('트릭');
        await click('노즈트릭');
        assert.equal(win.document.querySelectorAll('.skill-entry-summary').length,5);
        await click('테일트릭');
        assert.equal(win.document.querySelectorAll('.skill-entry-summary').length,9);
        await click('알리 상세');
        assert.match(win.document.querySelector('.skill-detail')!.textContent!,/테일트릭.*초급/);
        await click('트래플립 상세');
        assert.match(win.document.querySelector('.skill-detail')!.textContent!,/킥플립.*남은 숙련도.*빅스핀/);
        assert.equal(win.document.querySelector('[role="region"][aria-label="스킬트리"]'),null);
        await click('스킬트리 보기');
        const tree=win.document.querySelector('[role="region"][aria-label="스킬트리"]')!;
        assert.equal(tree.querySelectorAll('.skill-tree-card:not([data-prerequisite])').length,9);
        assert.equal(tree.querySelectorAll('.skill-tree-card[data-prerequisite]').length,4);
        assert.ok(tree.querySelector('svg g path[marker-end]'));
        assert.equal(tree.querySelector('[aria-label="트래플립 상세"]')?.getAttribute('aria-expanded'),'true');
        await click('트래플립 미리보기');
        assert.ok(win.document.querySelector('.skill-detail .technique-preview'));
        await click('목록 보기');
        assert.equal(win.document.querySelector('.skill-entry-summary[aria-label="트래플립 상세"]')?.getAttribute('aria-expanded'),'true');
        assert.ok(win.document.querySelector('.skill-detail .technique-preview'));
      }
      if(menu==='상점'){
        assert.equal(win.document.querySelectorAll('.equipment-choice').length,8);
        assert.equal(win.document.querySelectorAll('.equipment-loadout > div').length,6);
        await click('액세서리');assert.equal(win.document.querySelectorAll('.equipment-choice').length,42);
        await click('튼튼한 헬멧 상세');assert.ok(win.document.querySelector('[aria-label="튼튼한 헬멧 착용 미리보기"]'));
        await click('구매 ₩12,000');await click('장착');
        assert.match(win.document.querySelector('.equipment-panel .workshop-rider')!.textContent!,/액세서리 1\/3/);
        await click('튼튼한 헬멧 해제');
        const rarity=win.document.querySelector<HTMLSelectElement>('[aria-label="희귀도 필터"]')!;
        await act(async()=>{rarity.value='legendary';rarity.dispatchEvent(new win.Event('change',{bubbles:true}));});
        assert.equal(win.document.querySelectorAll('.equipment-choice').length,3);
        await click('외형');
        assert.equal(win.document.querySelector('.makeover-options .gender-options'),null);
        assert.equal(win.document.querySelectorAll('.makeover-options .look-presets button').length,5);
      }
      await click('메뉴 닫기');
    }
    assert.ok(!win.document.querySelector('.console-field-links .console-visitor'));
    const visitorLink=win.document.querySelector('.console-visitor')?.getAttribute('aria-label');
    assert.ok(visitorLink);
    await click(visitorLink);
    assert.equal(win.document.querySelectorAll('.console-panel[aria-label="라이벌"] .rival-grid .rival').length,6);
    await click('메뉴 닫기');
    for(const name of ['선수 정보','라이벌','시즌 랭킹','명예의 전당']){
      await click('메뉴');await click(name);
      const opened=win.document.querySelector('.console-panel[aria-label="'+name+'"]')!;
      assert.ok(opened);
      if(name==='선수 정보')assert.equal(opened.querySelector('.rival-grid'),null);
      if(name==='라이벌')assert.equal(opened.querySelectorAll('.rival-grid .rival').length,6);
      if(name==='명예의 전당'){
        assert.deepEqual([...opened.querySelectorAll('.hall-tabs button')].map(button=>button.textContent),['내 선수','글로벌 랭킹','선수 둘러보기']);
        assert.ok(opened.querySelector('[aria-label="내 선수 기록"]'));
        await click('글로벌 랭킹');
        assert.equal(opened.querySelector('.hall-metrics [aria-pressed="true"]')?.textContent,'종합');
        assert.deepEqual([...opened.querySelectorAll('.hall-metrics button')].map(button=>button.textContent),['종합','댄싱','트릭','프리스타일']);
        await click('선수 둘러보기');
        assert.ok(opened.querySelector('.search-form input'));
        assert.equal(opened.querySelector('input[type="checkbox"]'),null);
      }
      await click('메뉴 닫기');
      assert.equal(win.document.querySelector('.console-panel'),null);
    }
    await click('메뉴');await click('라인 편집');
    assert.match(win.document.querySelector('.console-panel')!.textContent!,/라인 편집/);
    assert.doesNotMatch(win.document.querySelector('.console-panel')!.textContent!,/루틴/);
    assert.ok(win.document.querySelector('.routine-save-actions')!.compareDocumentPosition(win.document.querySelector('.auto-routine')!)&win.Node.DOCUMENT_POSITION_FOLLOWING);
    await click('피터팬 추가');
    await click('메뉴 닫기');
    assert.equal(win.document.querySelector('.console-panel'),null);
    await click('메뉴');await click('라인 편집');
    assert.match(win.document.querySelector('.routine-order')!.parentElement!.textContent!,/피터팬/);
    await click('라인 저장');
    assert.ok([...win.document.querySelectorAll('button')].some(button=>button.textContent?.includes('저장된 구성')&&button.disabled));
    await click('메뉴 닫기');
    const speedGauge=win.document.querySelector('.stat-speed');
    const statusHud=win.document.querySelector('.console-status');
    const hudCard=(metric:string)=>win.document.querySelector<HTMLButtonElement>('[data-hud-metric="'+metric+'"]')!;
    const openHud=(metric:string)=>click(hudCard(metric).getAttribute('aria-label')!);
    const closeHud=async()=>{await act(async()=>{
      win.document.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    });};
    const selectionSlot=win.document.querySelector('.weekly-selection-slot');
    await click('속도 훈련 선택');
    assert.equal(win.document.querySelector('.weekly-selection-slot'),selectionSlot,'Reserve the same preview area for every selection');
    assert.equal(win.document.querySelector('.stat-speed'),speedGauge,'Forecast must update the existing top gauge');
    assert.equal(win.document.querySelector('.hud-popover'),null);
    assert.ok(speedGauge?.classList.contains('has-projection'));
    assert.ok(hudCard('carve').classList.contains('has-projection'));
    await openHud('speed');
    assert.ok(win.document.querySelector('.hud-popover [aria-label="속도 예상 상승"]'));
    await openHud('carve');
    assert.equal(win.document.querySelectorAll('.hud-popover').length,1);
    assert.equal(win.document.querySelector('[aria-label="속도 예상 상승"]'),null);
    assert.ok(win.document.querySelector('.hud-popover [aria-label="카빙 예상 상승"]'));
    assert.equal(win.document.querySelector<HTMLMeterElement>('meter[aria-label="속도"]')!.value,18,'A forecast must not change the saved stat');
    assert.equal(win.document.querySelectorAll('.weekly-action-grid > button').length,8);
    assert.equal(win.document.querySelector('.weekly-preview'),null,'Do not open a second detail panel');
    await openHud('energy');
    assert.match(win.document.querySelector('.hud-popover [aria-label="예상 체력 변화"]')!.textContent!,/100 → 83/);
    await closeHud();
    assert.equal(win.document.querySelector('.hud-popover'),null);
    assert.equal(win.document.querySelector('select[aria-label="훈련 강도"]'),null);
    await click('카빙 훈련 선택');
    assert.equal(win.document.querySelector('[aria-label="속도 예상 상승"]'),null);
    assert.ok(hudCard('carve').classList.contains('has-projection'));
    await click('선택 취소');
    assert.equal(win.document.querySelector('.status-projection'),null);
    assert.equal(win.document.querySelector('[aria-label="예상 체력 변화"]'),null);
    await click('속도 훈련 선택');injectClock=true;
    assert.ok(!win.document.querySelector('.console-panel'));
    const beforePlan=requestActions.length;
    await click('확인');
    assert.deepEqual(requestActions.slice(beforePlan),['plan'],'Confirmation must not trigger a redundant background request before the training deadline');
    assert.equal(clockRaces,1);assert.equal(win.document.querySelector('[role="alert"]'),null);
    assert.ok(!win.document.querySelector('.console-panel'));
    assert.ok(win.document.querySelector('[aria-label="행동 진행"]'));
    assert.equal(win.document.querySelector('.console-status'),statusHud,'HUD stays mounted when training starts');
    assert.equal(win.document.querySelector('.console-training-area')?.classList.contains('is-scene-hud'),false);
    await click('상점');assert.ok(win.document.querySelector('.equipment-panel'));
    await settle(2400);
    assert.ok(win.document.querySelector('.equipment-panel'),'Background completion must not close the equipment menu');
    await click('메뉴 닫기');
    assert.ok(win.document.querySelector('[aria-labelledby="training-outcome-title"]'));
    assert.equal(win.document.querySelector('.console-status'),statusHud,'Training results reuse the same HUD');
    assert.equal(win.document.querySelector('.console-training-area')?.classList.contains('is-scene-hud'),false);
    await click('계속');
    const event=win.document.querySelector('[aria-label="이벤트 선택"]');assert.ok(event);
    const choice=event.querySelector<HTMLButtonElement>('button')!;
    await act(async()=>{choice.click();});await settle();
    await act(async()=>{await Promise.all([...pendingRequests]);});await settle(10);
    assert.ok(win.document.querySelector('[aria-label="이벤트 결과"]'));
    assert.equal(win.document.querySelector('[aria-label="이번 주 행동 선택"]'),null);
    await click('상점');assert.ok(win.document.querySelector('.equipment-panel'));
    assert.equal(win.document.querySelector('.console-flow-notice'),null);
    await click('메뉴 닫기');
    assert.ok(win.document.querySelector('[aria-label="이벤트 결과"]'));
    await click('계속');
    assert.equal(win.document.querySelector('.console-rider b')!.textContent,'1년차 · 1월 둘째 주');
    await click('휴식 선택');
    await openHud('energy');
    assert.ok(win.document.querySelector('.hud-popover [aria-label="예상 체력 변화"]'));
    await closeHud();
    assert.equal(win.document.querySelector('.status-projection'),null,'Rest should preview stamina instead of stat growth');
    await click('선택 취소');await click('속도 훈련 선택');injectChoice=true;
    await click('확인');
    assert.ok(win.document.querySelector('.console-sync-note'));
    assert.equal(win.document.querySelector('[role="alert"]'),null);
    assert.ok(win.document.querySelector('[aria-label="선택한 행동 확인"]'),'A rejected choice must stay selected instead of pretending it saved');
    await click('확인');
    assert.ok(win.document.querySelector('[aria-label="행동 진행"]'));
    assert.equal(win.document.querySelector('.game-console'),frame);
    const rider=newRider('automatic-ui',71,'Auto rider',DEFAULT_LOOK);
    rider.trainingOffer=null;
    rider.energy=0;
    let selected:Parameters<typeof previewTraining>[1]|undefined;
    await act(async()=>root.render(createElement(WeeklyChoices,{r:rider,send:async()=>true,saving:false,onPreview:plan=>{selected=plan;}})));
    await click('속도 훈련 선택');
    assert.match(win.document.querySelector('.weekly-success')!.textContent!,/15%/);
    assert.match(win.document.querySelector('.weekly-success')!.textContent!,/실패 위험/);
    await click('휴식 선택');
    assert.equal(previewTraining(rider,selected!).energyAfter,41);
    rider.week=7;
    await act(async()=>root.render(createElement(WeeklyChoices,{r:{...rider},send:async()=>true,saving:false,onPreview:plan=>{selected=plan;}})));
    await click('불참하고 특별훈련');await click('속도 훈련 선택');
    assert.equal(win.document.querySelectorAll('.weekly-special-card').length,6);
    assert.match(win.document.querySelector('.weekly-special-forecast')!.textContent!,/100% · 체력 소모 0 · 성장 ×2/);
    assert.equal(selected?.meetTraining,true);
    rider.lastPlan={action:'speed',spot:'river',meetTraining:true};
    rider.extras!.lastTraining={grade:'success',special:'meet',year:1,week:7,text:'',changes:['속도 +4.2']};
    await act(async()=>root.render(createElement(GameStage,{r:{...rider},send:async()=>true,saving:false,remaining:0,weekMs:2000,fastForward:false,spot:'river',motion:'rest',pendingTraining:'special-test',onDone:()=>{}})));
    assert.equal(win.document.querySelector('#training-outcome-title')?.textContent,'특별훈련 성공');
    assert.match(win.document.querySelector('.training-special-result')!.textContent!,/속도 \+4\.2.*불참/);
    for(const [action,grade,title] of [
      ['rest','recovery','휴식을 완료했다'],
      ['dance','success','댄싱 연습에 몰두했다'],
      ['trick','miss','연습이 뜻대로 풀리지 않았다'],
      ['carve','injury','연습 중 다쳤다'],
    ] as const){
      rider.lastPlan={action,spot:'river'};
      rider.extras!.lastTraining={grade,year:1,week:1,text:'',changes:['체력 -23']};
      await act(async()=>root.render(createElement(GameStage,{r:rider,send:async()=>true,saving:false,remaining:0,weekMs:2000,fastForward:false,spot:'river',motion:'rest',pendingTraining:'test',onDone:()=>{}})));
      assert.equal(win.document.querySelector('#training-outcome-title')?.textContent,title);
      assert.equal(win.document.querySelector('.game-reward')?.textContent,'체력 -23');
    }
    const story=newRider('story-ui',991,'Story rider',DEFAULT_LOOK);
    story.year=3;story.week=9;story.phase='event';story.event='relationship-yu-fork';story.settings.mode='auto';story.settings.skipEvents=false;
    let submitted:unknown;
    const sendStory=async(action:unknown)=>{submitted=action;return true;};
    const storyProps={r:story,send:sendStory,saving:false,remaining:0,weekMs:2000,fastForward:false,spot:'river' as const,motion:'rest' as const,onDone:()=>{}};
    await act(async()=>root.render(createElement(GameStage,storyProps)));
    assert.match(win.document.querySelector('[aria-label="이벤트 선택"]')!.textContent!,/자동 육성 일시 정지/);
    await settle(900);
    assert.equal(submitted,undefined,'The client must not skip a relationship decision');
    await click('앞으로도 함께 춤추는 친구로 지내자');
    assert.deepEqual(submitted,{type:'event',eventId:'relationship-yu-fork',index:0});
    command({rider:story,hall:[]},{type:'event',eventId:'relationship-yu-fork',index:0},()=>({id:story.id,seed:991}));
    await act(async()=>root.render(createElement(GameStage,{...storyProps,pendingEvent:story.extras?.lastEvent})));
    assert.match(win.document.querySelector('[aria-label="이벤트 결과"]')!.textContent!,/감독은 둘이야/);
    await act(async()=>root.render(createElement(Rivals,{r:story,send:sendStory,saving:false})));
    assert.equal(win.document.querySelectorAll('.rival').length,6);
    assert.match(win.document.querySelector('.relationship-episodes')!.textContent!,/영상에 남지 않은 말|함께 춤추는 친구/);
    story.settings.mode='manual';submitted=undefined;
    await act(async()=>root.render(createElement(GameStage,{...storyProps,pendingEvent:{
      key:'observation-ui',eventId:'happening-yu-1',title:'간식은 여덟 명분',kind:'해프닝',choice:'',details:[],year:3,week:9,npc:'yu',dialogue:'유리가 간식을 건넸다.',happening:true,
    }})));
    assert.equal(win.document.querySelector('[aria-label="짧은 해프닝"]')?.querySelectorAll('button').length,1);
    assert.equal(win.document.querySelector('[aria-label="짧은 해프닝"] button')?.textContent,'닫기');
    await settle(3300);
    assert.deepEqual(submitted,{type:'continue-event',record:'observation-ui'});

    rider.week=7;rider.phase='meet';rider.settings={mode:'auto',strategy:'balanced',entries:['dance','trick']};
    const career={rider,hall:[]};
    assert.throws(()=>command(career,{type:'entry',disciplines:['dance','trick']},()=>({id:'automatic-ui',seed:71})),/1종목/);
    rider.records.push({year:1,id:'regular-1',division:'rookie',results:simulateMeet(rider,(await import('../src/game/data')).CALENDAR[0],['dance','trick']).results});
    const record=structuredClone(rider.records[0]);
    record.results[0].statGains={carve:.7,speed:.3};
    rider.settings.skipMeets=true;
    await act(async()=>root.render(createElement(GameStage,{r:rider,send:async()=>true,saving:false,remaining:0,weekMs:2000,fastForward:false,spot:'river',motion:'ride',record,onDone:()=>{}})));
    assert.ok(win.document.querySelector('[aria-label="대회 시상식"]'));
    assert.match(win.document.querySelector('[aria-label="대회 시상식"]')!.textContent!,/입상 성장 · 속도 \+0\.3 · 카빙 \+0\.7/);
    assert.equal(win.document.querySelector('[aria-label="대회 스킵"]'),null);
    delete rider.settings.skipMeets;
    rider.year=2;rider.week=52;rider.phase='meet';
    let selectedEntry:unknown;
    await act(async()=>root.render(createElement(GameStage,{r:rider,send:async action=>{selectedEntry=action;return true;},saving:false,remaining:0,weekMs:2000,fastForward:false,spot:'river',motion:'ride',onDone:()=>{}})));
    assert.match(win.document.querySelector('[aria-label="대회 출전 선택"]')!.textContent!,/서울|3종목/);
    assert.equal(win.document.querySelectorAll('.game-disciplines button[aria-pressed="true"]:disabled').length,3);
    assert.equal([...win.document.querySelectorAll('button')].some(button=>button.textContent==='출전 취소'),false);
    await click('경기장 입장');assert.deepEqual(selectedEntry,{type:'entry',disciplines:['dance','trick','freestyle']});
    let loadedLogs=0;
    const summary={...record,detail:'summary' as const,results:record.results.map(result=>({...result,run:{...result.run,log:[]}}))};
    await act(async()=>root.render(createElement(Meets,{
      r:{...rider,records:[summary]},onPlay:()=>{},onEntry:()=>{},
      onLoadRecord:async selected=>{assert.equal(selected,summary);loadedLogs++;return record;},
    })));
    assert.equal(win.document.querySelectorAll('.meet-list-row').length,6);
    assert.match(win.document.querySelector('.calendar-list')!.textContent!,/국제대회 · 서울|3종목 필수/);
    assert.match(win.document.querySelector('.calendar-list')!.textContent!,/12월 다섯째 주/);
    await click('최근 성적');
    const history=win.document.querySelector('.meet-detail')!;
    assert.match(history.textContent!,/위|점|상금 ₩|미출전/);
    assert.equal(history.querySelectorAll('.meet-result-grid > div').length,3);
    assert.equal(history.querySelectorAll('.meet-standings li').length,14);
    assert.equal(loadedLogs,0);
    await click('기술별 기록');
    assert.equal(loadedLogs,1);
    assert.equal(history.querySelectorAll('.meet-moves li').length,record.results.reduce((sum,result)=>sum+result.run.log.length,0));
    await click('현재 시즌');
    assert.match(win.document.querySelector('.meet-detail')!.textContent!,/서울|3종목/);
    rider.year=1;rider.week=8;rider.phase='plan';
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
      assert.equal(win.document.querySelector('.scene-counter button'),null);
      assert.equal(win.document.querySelector('.game-actions [aria-label="대회 2배속"]')?.textContent,'2배속');
      await click('대회 2배속');
      assert.equal(win.document.querySelector('[aria-label="대회 2배속"]')!.getAttribute('aria-pressed'),'true');
      for(const move of record.results[0].run.log){
        playbackNow=began+(5000+(move.at+.25)*1000)/2;await settle(120);
        assert.equal(win.document.querySelector('[aria-label="경기 진행"] h2')!.textContent,SKILL[move.id]!.name,'Every move in the complete line must be presented');
      }
      playbackNow=began+34000;await settle(120);
      assert.ok(win.document.querySelector('[aria-label="대회 시상식"]'));
      assert.match(win.document.querySelector('.scene-counter')!.textContent!,/60 \/ 60초/);
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
    await click('나만의 라이더 만들기');
    const autoName=win.document.querySelector<HTMLInputElement>('input[aria-label="라이더 이름"]')!;
    await act(async()=>{Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value')!.set!.call(autoName,'Auto cycle');autoName.dispatchEvent(new win.Event('input',{bubbles:true}));});
    await click('육성 시작');await click('자동 진행');
    for(let cycle=0;cycle<2;cycle++){
      assert.equal(win.document.querySelector('[aria-label="자동 행동 선택"] h2')?.textContent,'이번 주엔 무엇을 할까?');
      assert.equal(win.document.querySelectorAll('.weekly-action-grid > button').length,8);
      assert.equal(win.document.querySelectorAll('.weekly-action-grid > button[aria-pressed="true"]').length,1);
      await settle(2150);
      assert.equal(win.document.querySelector('[aria-label="자동 행동 선택"]'),null);
      assert.ok(win.document.querySelector('[aria-label="행동 진행"]'));
      await settle(2250);
      assert.ok(win.document.querySelector('[aria-labelledby="training-outcome-title"]'));
      await settle(1000);
      assert.ok(win.document.querySelector('[aria-labelledby="training-outcome-title"]'),'Result should remain visible for two seconds');
      await settle(1150);
      if(win.document.querySelector('[aria-label="이벤트 결과"]')){
        await settle(1000);assert.ok(win.document.querySelector('[aria-label="이벤트 결과"]'),'Automatic event result must remain visible');
        await settle(1150);
      }
    }
    assert.equal(win.document.querySelector('.console-rider b')!.textContent,'1년차 · 1월 셋째 주');
    await act(async()=>root.unmount());await Promise.allSettled([...pendingRequests]);
    const store=localStore(directory),owner=await store.authenticate(createHash('sha256').update(cookie.split('=')[1]).digest('hex'));
    assert.ok(owner);const finalRow=await store.get(owner),finalRider=finalRow.snapshot.career.rider!;
    finalRider.year=8;finalRider.week=52;finalRider.phase='meet';finalRider.plan=null;finalRider.settings.mode='manual';
    finalRider.season={year:8,division:'master',scores:{dance:{},trick:{},freestyle:{}}};
    finalRow.snapshot.clock={credit:0,stamp:0,tabs:{},stateVersion:(finalRow.snapshot.clock.stateVersion??0)+1};
    assert.ok(await store.replace(owner,finalRow.version,finalRow.snapshot));
    const endingRoot=createRoot(win.document.getElementById('root')!);
    try{
      await act(async()=>endingRoot.render(createElement(App)));await settle(100);
      await click('경기장 입장');
      for(let discipline=0;discipline<3;discipline++){
        await click('결과 보기');assert.ok(win.document.querySelector('[aria-label="대회 시상식"]'));
        if(discipline<2)await click('다음 종목');
      }
      await click('육성 계속');
      assert.ok(win.document.querySelector('[aria-label="커리어 엔딩"]'),'Final international acknowledgement must open the ending');
      assert.match(win.document.querySelector('.ceremony-stage')!.textContent!,/국제대회 · 로스앤젤레스/);
      await click('성적 바로 보기');
      const persisted=await store.get(owner),archive=persisted.snapshot.career.hall[0];
      assert.equal(archive.records.at(-1)!.results.length,3);
      hallFlow=true;publicCard={id:randomUUID(),profile:publicationFor(archive).profile};
      const button=(label:string)=>[...win.document.querySelectorAll('button')].find(button=>button.textContent?.trim()===label);
      const guide=()=>win.document.querySelector('[aria-label="명예의 전당 등록"]');
      const submitAccount=async()=>{
        const set=Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'value')!.set!;
        const form=win.document.querySelector('form.account-form')!;
        await act(async()=>{
          for(const [input,value] of [...form.querySelectorAll('input')].map((input,i)=>[input,i?'test-pass':'test_rider'] as const)){
            set.call(input,value);input.dispatchEvent(new win.Event('input',{bubbles:true}));
          }
        });
        await act(async()=>form.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true})));
        await settle(75);
      };
      assert.ok(button('명예의 전당 등록')?.classList.contains('primary'));
      await click('명예의 전당 등록');
      assert.match(guide()!.textContent!,/8년간 육성한 선수의 기록.*로그인이 필요/);
      await click('회원가입');
      assert.ok(guide()!.querySelector('[autocomplete="new-password"]'));
      await click('나중에 등록');assert.ok(win.document.querySelector('.ceremony-registration'));
      assert.deepEqual(hallActions,[]);
      await click('명예의 전당 등록');await click('로그인');
      assert.ok(guide()!.querySelector('[autocomplete="current-password"]'));
      await submitAccount();
      assert.deepEqual(hallActions,['login']);
      assert.match(guide()!.textContent!,new RegExp(archive.name+'의 은퇴 기록'));
      await click('명예의 전당 등록');
      const ranking=()=>win.document.querySelector('[aria-label="글로벌 랭킹 기록"]');
      assert.match(ranking()!.textContent!,/등록을 완료했어요/);
      assert.match(ranking()!.textContent!,/종합 17위/);
      await click('공개 프로필 보기');assert.equal(win.document.querySelector('.public-hero h2')?.textContent,archive.name);
      await click('내 선수');
      assert.match(win.document.querySelector('.archive-card')!.textContent!,/글로벌 등록 완료/);
      await click('엔딩 다시 보기');await click('성적 바로 보기');await click('내 글로벌 순위 확인');
      assert.equal(hallActions.filter(action=>action==='publish').length,1);
      await click('내 선수');await click('랭킹 등록 취소');
      assert.match(win.document.querySelector('.archive-card')!.textContent!,/랭킹 등록 취소됨/);
      assert.equal((await store.get(owner)).snapshot.career.hall[0].id,archive.id);

      await click('계정');await click('로그아웃');
      await click('메뉴');await click('명예의 전당');await click('명예의 전당 등록');await click('회원가입');
      await submitAccount();assert.equal(hallActions.at(-1),'register');
      nextRankStatus='unverified';
      await click('명예의 전당 등록');
      assert.match(ranking()!.textContent!,/통산 RP 전체를 검증할 수 없어/);
      assert.doesNotMatch(ranking()!.textContent!,/종합 \d+위/);
      await click('내 선수');assert.match(win.document.querySelector('.archive-card')!.textContent!,/검증 불가/);
    }finally{await act(async()=>endingRoot.unmount());}
  }finally{
    await act(async()=>root.unmount());await Promise.allSettled([...pendingRequests]);globalThis.fetch=originalFetch;dom.window.close();
    for(const file of await readdir(directory))await unlink(join(directory,file));await rmdir(directory);
  }
});
