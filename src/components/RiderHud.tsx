import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { RULES, STAT_NAMES } from '../game/data';
import { effectiveStats, equipmentStats } from '../game/economy';
import type { TrainingPreview } from '../game/training';
import { STATS, type Rider, type Stat } from '../game/types';

type Metric = 'energy'|'money'|'fame'|Stat;
const labels={energy:'체력',money:'보유금',fame:'명성',...STAT_NAMES};
const number=(value:number)=>value.toLocaleString('ko-KR',{maximumFractionDigits:1});
const signed=(value:number)=>(value>0?'+':'')+number(value);

function positionDetail(hud:HTMLElement,card:HTMLElement,popup:HTMLElement) {
  const world=hud.closest('.console-world');
  if(!world)return;
  const bounds=world.getBoundingClientRect();
  const hudRect=hud.getBoundingClientRect();
  const anchor=card.getBoundingClientRect();
  const links=hud.parentElement?.querySelector('.console-field-links:not([hidden])')?.getBoundingClientRect();
  const controls=world.querySelector('.weekly-choices:not([hidden]), .weekly-running, .game-dialogue')?.getBoundingClientRect();
  const gap=8;
  const width=popup.offsetWidth;
  const height=popup.scrollHeight+popup.offsetHeight-popup.clientHeight;
  const frameTop=Math.max(gap,bounds.top+gap);
  const frameBottom=Math.min(window.innerHeight,bounds.bottom)-gap;
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
  let left=clamp(anchor.left+(anchor.width-width)/2,bounds.left+gap,Math.min(window.innerWidth,bounds.right)-width-gap);
  const linksNearHud=links&&links.top-hudRect.bottom<gap*2;
  let top=(linksNearHud?links.bottom:hudRect.bottom)+gap;
  const belowLimit=Math.min(frameBottom,controls?.top??frameBottom,links&&!linksNearHud?links.top:frameBottom)-gap;
  let limit=belowLimit;

  if(top+height>belowLimit) {
    const side=Math.max(hudRect.right,controls?.right??hudRect.right)+gap;
    if(side+width+gap<=bounds.right) {
      left=side;
      top=clamp(anchor.top,frameTop,frameBottom-height);
      limit=frameBottom;
    } else {
      // On short screens, keep the actions reachable and keep the active card visible if possible.
      const aboveCard=anchor.top-gap;
      const belowCard=anchor.bottom+gap;
      if(aboveCard-frameTop>=height || aboveCard-frameTop>belowLimit-belowCard) {
        top=Math.max(frameTop,aboveCard-height);
        limit=aboveCard;
      } else {
        top=belowCard;
      }
    }
  }
  popup.style.left=(left-hudRect.left)+'px';
  popup.style.top=(top-hudRect.top)+'px';
  popup.style.maxHeight=Math.max(0,limit-top)+'px';
}

export function RiderHud({r,preview,interactive}:{r:Rider;preview?:TrainingPreview;interactive:boolean}) {
  const hud=useRef<HTMLDivElement>(null);
  const popup=useRef<HTMLDivElement>(null);
  const id=useId();
  const [hovered,setHovered]=useState<Metric|null>(null);
  const [selected,setSelected]=useState<Metric|null>(null);
  const active=interactive?(selected??hovered):null;
  const total=effectiveStats(r);
  const bonus=equipmentStats(r);
  const money='₩'+r.money.toLocaleString('ko-KR');

  useEffect(()=>{
    if(interactive)return;
    setSelected(null);
    setHovered(null);
  },[interactive]);

  useEffect(()=>{
    if(!active)return;
    const dismiss=()=>{setSelected(null);setHovered(null);};
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
    return ()=>{
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('keydown',escape,true);
    };
  },[active]);

  useLayoutEffect(()=>{
    const root=hud.current,detail=popup.current;
    const card=active&&root?.querySelector<HTMLElement>('[data-hud-metric="'+active+'"]');
    if(!root||!detail||!card)return;
    const reposition=()=>positionDetail(root,card,detail);
    reposition();
    window.addEventListener('resize',reposition);
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(reposition);
    observer?.observe(root);
    const choices=root.parentElement?.querySelector('.weekly-choices');
    if(choices)observer?.observe(choices);
    return ()=>{window.removeEventListener('resize',reposition);observer?.disconnect();};
  },[active,preview,r]);

  const card=(metric:Metric,value:string,className:string,children:ReactNode)=>(
    <button key={metric} type="button" className={'hud-card '+className} data-hud-metric={metric}
      aria-label={labels[metric]+' '+value+' 상세 보기'} aria-expanded={active===metric}
      aria-describedby={active===metric?id:undefined} disabled={!interactive}
      onPointerEnter={event=>{if(event.pointerType==='mouse'&&!selected)setHovered(metric);}}
      onPointerLeave={()=>setHovered(null)}
      onClick={()=>{setHovered(null);setSelected(selected===metric?null:metric);}}>
      {children}
    </button>
  );

  let detail:ReactNode;
  if(active==='energy') {
    detail=<>
      <span>현재 {number(r.energy)} / 100</span>
      {preview&&<strong aria-label="예상 체력 변화">{number(r.energy)} → {number(preview.energyAfter)} ({signed(preview.energy)})</strong>}
    </>;
  } else if(active==='money') {
    detail=<>
      <span>현재 {money}</span>
      {!!preview?.money&&<strong>예상 비용 ₩{(-preview.money).toLocaleString('ko-KR')}</strong>}
    </>;
  } else if(active==='fame') {
    detail=<span>누적 {number(r.fame)}</span>;
  } else if(active) {
    const gain=preview?.gains[active];
    detail=<>
      <span>기본 {number(r.stats[active])} · 장비 {signed(bonus[active])}</span>
      {!!gain?.max&&<strong aria-label={labels[active]+' 예상 상승'}>예상 {signed(gain.min)}{gain.min!==gain.max?' ~ '+signed(gain.max):''}</strong>}
    </>;
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
      return card(stat,total[stat].toFixed(1),'status-gauge stat-'+stat+(rising?' has-projection':''),<>
        <span>{STAT_NAMES[stat]}</span><b>{total[stat].toFixed(1)}</b>
        <span className="status-track"><meter min={0} max={max} value={total[stat]} aria-label={STAT_NAMES[stat]}/>
          {rising&&<span className="status-projection" style={{left:total[stat]/max*100+'%',width:gain.max/max*100+'%'}} aria-hidden="true">
            <i style={{width:gain.min/gain.max*100+'%'}}/>
          </span>}
        </span>
      </>);
    })}</div>
    {active&&<div className={'hud-popover'+(selected?' is-pinned':'')} id={id} role="tooltip" ref={popup}>
      <b>{labels[active]}</b>
      {detail}
    </div>}
  </div>;
}
