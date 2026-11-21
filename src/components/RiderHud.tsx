import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { RULES, STAT_NAMES } from '../game/data';
import { effectiveStats, equipmentStats } from '../game/economy';
import type { TrainingPreview } from '../game/training';
import { STATS, type Rider, type Stat } from '../game/types';

type Metric = 'energy'|'money'|'fame'|Stat;
type Placement = 'below'|'above'|'right'|'left';
type OpenDetail = {metric:Metric;pinned:boolean};
const labels={energy:'체력',money:'보유금',fame:'명성',...STAT_NAMES};
const number=(value:number)=>value.toLocaleString('ko-KR',{maximumFractionDigits:1});
const signed=(value:number)=>(value>0?'+':'')+number(value);
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const overlap=(a:DOMRect,b:DOMRect)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))
  *Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));

function positionDetail(hud:HTMLElement,card:HTMLElement,popup:HTMLElement) {
  const world=hud.closest('.console-world');
  if(!world)return;
  const bounds=world.getBoundingClientRect();
  const hudRect=hud.getBoundingClientRect();
  const anchor=card.getBoundingClientRect();
  const body=popup.firstElementChild as HTMLElement;
  const gap=7;
  const minX=Math.max(0,bounds.left)+gap,maxX=Math.min(window.innerWidth,bounds.right)-gap;
  const minY=Math.max(0,bounds.top)+gap,maxY=Math.min(window.innerHeight,bounds.bottom)-gap;
  popup.style.maxWidth=Math.max(0,maxX-minX)+'px';
  const width=popup.offsetWidth;
  const height=body.scrollHeight+2;
  const centerX=anchor.left+anchor.width/2,centerY=anchor.top+anchor.height/2;
  const cards=Array.from(hud.querySelectorAll('.hud-card, .console-injury'),el=>el.getBoundingClientRect());
  const controls=Array.from(world.querySelectorAll('.console-field-links:not([hidden]), .console-visitor, .game-hud > span, .game-hud button, .game-hud .scene-counter, .weekly-choices:not([hidden]), .weekly-running, .game-dialogue'),el=>el.getBoundingClientRect());
  const positions:Placement[]=['below','above','right','left'];
  const candidates=positions.flatMap((placement,index)=>{
    const vertical=placement==='below'||placement==='above';
    const room=placement==='below'?maxY-anchor.bottom-gap:placement==='above'?anchor.top-gap-minY:maxY-minY;
    const fittedHeight=Math.min(height,room);
    const main=placement==='below'?anchor.bottom+gap:placement==='above'?anchor.top-fittedHeight-gap
      :placement==='right'?anchor.right+gap:anchor.left-width-gap;
    if(fittedHeight<Math.min(height,42)||!vertical&&(main<minX||main+width>maxX+0.5))return [];
    const center=vertical?centerX:centerY, size=vertical?width:fittedHeight;
    const start=vertical?anchor.left:anchor.top,end=vertical?anchor.right:anchor.bottom;
    const min=Math.max(vertical?minX:minY,start+10-size),max=Math.min((vertical?maxX:maxY)-size,end-10);
    const preferred=center-size/2;
    // Slide along the edge to clear nearby controls while the pointer still touches the card.
    const offsets=[preferred,...controls.flatMap(rect=>vertical?[rect.left-size-4,rect.right+4]:[rect.top-size-4,rect.bottom+4])];
    return [...new Set(offsets.map(value=>clamp(value,min,max)))].map(offset=>{
      const rect=new window.DOMRect(vertical?offset:main,vertical?main:offset,width,fittedHeight);
      const blocked=controls.reduce((area,control)=>area+overlap(rect,control),0);
      const covered=cards.reduce((area,other)=>area+overlap(rect,other),0);
      const score=blocked*12+covered+(height-fittedHeight)*width*4+Math.abs(offset-preferred)*8+index*32;
      return {placement,rect,blocked,score,pointer:clamp(center-offset,10,size-10)};
    });
  });
  const best=candidates.sort((a,b)=>Number(a.blocked>0)-Number(b.blocked>0)||a.score-b.score)[0];
  if(!best){popup.style.visibility='hidden';return;}
  popup.dataset.placement=best.placement;
  popup.style.left=(best.rect.left-hudRect.left)+'px';
  popup.style.top=(best.rect.top-hudRect.top)+'px';
  popup.style.setProperty('--hud-pointer',best.pointer+'px');
  body.style.maxHeight=(best.rect.height-2)+'px';
  popup.style.visibility='visible';
}

export function RiderHud({r,preview,interactive,recentTraining}:{r:Rider;preview?:TrainingPreview;interactive:boolean;recentTraining:boolean}) {
  const hud=useRef<HTMLDivElement>(null);
  const popup=useRef<HTMLDivElement>(null);
  const closeDelay=useRef<number|undefined>(undefined);
  const id=useId();
  const [open,setOpen]=useState<OpenDetail>();
  const active=interactive?open?.metric:undefined;
  const total=effectiveStats(r);
  const bonus=equipmentStats(r);
  const money='₩'+r.money.toLocaleString('ko-KR');

  useEffect(()=>{
    setOpen(undefined);
    return ()=>window.clearTimeout(closeDelay.current);
  },[interactive,r.id,r.year,r.week]);

  const cancelClose=()=>window.clearTimeout(closeDelay.current);
  const leave=()=>{
    cancelClose();
    closeDelay.current=window.setTimeout(()=>setOpen(current=>current?.pinned?current:undefined),260);
  };

  useEffect(()=>{
    if(!active||!open)return;
    const dismiss=()=>{window.clearTimeout(closeDelay.current);setOpen(undefined);};
    const outside=(event:PointerEvent)=>{
      if(event.target instanceof window.Node&&!hud.current?.contains(event.target))dismiss();
    };
    const escape=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      event.stopPropagation();
      dismiss();
    };
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape,true);
    const world=hud.current?.closest('.console-world');
    world?.addEventListener('scroll',dismiss,{passive:true});
    const expire=window.setTimeout(dismiss,10000);
    return ()=>{
      window.clearTimeout(expire);
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('keydown',escape,true);
      world?.removeEventListener('scroll',dismiss);
    };
  },[active,open]);

  useLayoutEffect(()=>{
    const root=hud.current,detail=popup.current;
    const card=active&&root?.querySelector<HTMLElement>('[data-hud-metric="'+active+'"]');
    if(!root||!detail||!card)return;
    const reposition=()=>positionDetail(root,card,detail);
    reposition();
    window.addEventListener('resize',reposition);
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(reposition);
    observer?.observe(root);
    const world=root.closest('.console-world');
    if(world)observer?.observe(world);
    world?.querySelectorAll('.weekly-choices, .console-field-links, .game-dialogue').forEach(control=>observer?.observe(control));
    return ()=>{window.removeEventListener('resize',reposition);observer?.disconnect();};
  },[active,preview,r]);

  const card=(metric:Metric,value:string,className:string,children:ReactNode)=>(
    <button key={metric} type="button" className={'hud-card '+className} data-hud-metric={metric}
      aria-label={labels[metric]+' '+value+' 상세 보기'} aria-expanded={active===metric}
      aria-describedby={active===metric?id:undefined} disabled={!interactive}
      onPointerEnter={event=>{if(event.pointerType==='mouse'){cancelClose();setOpen(current=>current?.pinned||current?.metric===metric?current:{metric,pinned:false});}}}
      onPointerLeave={event=>{if(event.pointerType==='mouse')leave();}}
      onClick={()=>{cancelClose();setOpen(current=>current?.pinned&&current.metric===metric?undefined:{metric,pinned:true});}}>
      {children}
    </button>
  );

  let detail:ReactNode;
  if(active==='energy') {
    detail=preview?<dl><div><dt>훈련 예상</dt><dd className="hud-estimate" aria-label="예상 체력 변화">{number(r.energy)} → {number(preview.energyAfter)} ({signed(preview.energy)})</dd></div></dl>
      :<dl><div><dt>최대 체력</dt><dd>100</dd></div></dl>;
  } else if(active==='money') {
    detail=preview?.money?<dl><div><dt>예상 비용</dt><dd className="hud-estimate">₩{(-preview.money).toLocaleString('ko-KR')}</dd></div></dl>
      :<p>장비 구매와 외형 변경에 사용해요.</p>;
  } else if(active==='fame') {
    detail=<p>대회와 이야기에서 쌓는 인지도예요. 스폰서 계약과 야간 광장 해금에 쓰여요.</p>;
  } else if(active) {
    const gain=preview?.gains[active];
    detail=<dl>
      <div><dt>기본값</dt><dd>{number(r.stats[active])}</dd></div>
      <div><dt>장비 보정</dt><dd>{signed(bonus[active])}</dd></div>
      {!!gain?.max&&<div><dt>훈련 예상</dt><dd className="hud-estimate" aria-label={labels[active]+' 예상 상승'}>{signed(gain.min)}{gain.min!==gain.max?' ~ '+signed(gain.max):''}</dd></div>}
    </dl>;
  }

  return <div className="console-status" ref={hud}>
    <div className="console-vitals" role="group" aria-label="선수 상태">
      {card('energy',number(r.energy),'console-energy'+(preview?.energy?' has-projection':''),<>
        <span className="console-energy-label">체력 <b>{Math.round(r.energy)}</b></span>
        <i><em style={{width:r.energy+'%'}}/>
          {!!preview?.energy&&<span className={'energy-projection '+(preview.energy<0?'is-cost':'')}
            style={{left:Math.min(r.energy,preview.energyAfter)+'%',width:Math.abs(preview.energy)+'%'}} aria-hidden="true"/>}
        </i>
      </>)}
      {card('money',money,'console-money'+(preview?.money?' has-projection':''),<b>{money}</b>)}
      {card('fame',number(r.fame),'console-fame',<>명성 <b>{r.fame}</b></>)}
      {r.injury&&<span className="console-injury">{r.injury.severity==='major'?'중상':'경상'} · {r.injury.weeks}주</span>}
    </div>
    <div className="console-stats" role="group" aria-label="현재 능력치">{STATS.map(stat=>{
      const gain=preview?.gains[stat],max=RULES.statCap+bonus[stat];
      const rising=!!gain&&gain.max>0;
      const grew=recentTraining&&r.extras?.lastTraining?.changes?.some(change=>change.startsWith(STAT_NAMES[stat]+' +'));
      return card(stat,total[stat].toFixed(1),'status-gauge stat-'+stat+(rising?' has-projection':'')+(grew?' has-recent-gain':''),<>
        <span>{STAT_NAMES[stat]}</span><b>{total[stat].toFixed(1)}</b>
        <span className="status-track"><meter min={0} max={max} value={total[stat]} aria-label={STAT_NAMES[stat]}/>
          {rising&&<span className="status-projection" style={{left:total[stat]/max*100+'%',width:gain.max/max*100+'%'}} aria-hidden="true">
            <i style={{width:gain.min/gain.max*100+'%'}}/>
          </span>}
        </span>
      </>);
    })}</div>
    {active&&<div className="hud-popover" id={id} role="tooltip" ref={popup} onPointerEnter={cancelClose} onPointerLeave={leave}>
      <div className="hud-popover-body"><b>{labels[active]}</b>{detail}</div>
    </div>}
  </div>;
}
