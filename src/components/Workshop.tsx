import { BadgeCheck, CircleDollarSign, Package, Settings2, ShoppingBag, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DISCIPLINE_NAMES } from '../game/data';
import { ECONOMY, eligibleSponsor, equippedLook, extras, GEAR, GEAR_NAMES, GEAR_SLOTS, SPONSOR, SPONSORS } from '../game/economy';
import type { Rider } from '../game/types';
import { LookFields, PixelRider } from './Appearance';
import { SectionTitle, Tag } from './Brand';
import { money, type Submit } from './Overview';

export default function Workshop({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  const progress=extras(r);
  const [slot,setSlot]=useState<typeof GEAR_SLOTS[number]>('deck');
  const [look,setLook]=useState(r.look);
  const active=SPONSOR.get(progress.contract?.id??'');
  const disabled=saving||r.phase==='retired';
  const available=r.money-(r.plan?.lesson?ECONOMY.lesson:0);
  const changed=JSON.stringify(look)!==JSON.stringify(r.look);
  return <div className="stack workshop">
    <section className="panel content-panel">
      <SectionTitle code="BOARD SHOP" title="장비 세팅"/>
      <div className="workshop-rider">
        <PixelRider look={equippedLook(r)} label="현재 장비를 장착한 라이더"/>
        <div><h3>{r.name}</h3><p>구매 가능 금액 <strong>{money(available)}</strong></p></div>
        <Tag kind="lime"><ShoppingBag size={14}/> 장비 {progress.inventory.length}개</Tag>
      </div>
      <div className="gear-loadout">{GEAR_SLOTS.map(key=>{
        const item=GEAR.find(item=>item.id===progress.equipped[key]);
        return <div key={key}>
          <small>{GEAR_NAMES[key]}</small><strong>{item?.name??'기본 장비'}</strong>
          {item&&<button className="text-button" disabled={disabled} onClick={()=>void send({type:'unequip',slot:key})}>해제</button>}
        </div>;
      })}</div>
      <div className="pill-row routine-tabs" aria-label="장비 종류">{GEAR_SLOTS.map(key=>
        <button className={'pill'+(slot===key?' active':'')} aria-pressed={slot===key} key={key} onClick={()=>setSlot(key)}>{GEAR_NAMES[key]}</button>
      )}</div>
      <div className="gear-grid">{GEAR.filter(item=>item.slot===slot).map(item=>{
        const owned=progress.inventory.includes(item.id);
        const equipped=progress.equipped[slot]===item.id;
        const refund=money(Math.floor(item.price*ECONOMY.sellRate));
        return <article key={item.id} className="inner-card gear-item">
          <div className="gear-badge"><Package size={24}/><Tag kind={equipped?'lime':'muted'}>{equipped?'장착 중':owned?'보유':'판매 중'}</Tag></div>
          <h3>{item.name}</h3><p>{item.description}</p>
          <div className="bottom-actions">{owned?<><button className="button quiet small" disabled={disabled} onClick={()=>void send({type:'trade',operation:'sell',item:item.id})}>판매 {refund}</button>
            <button className="button secondary small" disabled={disabled||equipped} onClick={()=>void send({type:'trade',operation:'equip',item:item.id})}>장착</button></>:
            <button className="button primary small" disabled={disabled||available<item.price} onClick={()=>void send({type:'trade',operation:'buy',item:item.id})}>구매 {money(item.price)}</button>}</div>
        </article>;
      })}</div>
    </section>
    <section className="panel content-panel">
      <SectionTitle code="SPONSOR CLUB" title="스폰서 계약" detail="시즌마다 한 곳과 계약할 수 있습니다. 해당 시즌에 협찬 종목으로 대회에서 한 번이라도 입상하면 계약을 갱신합니다."/>
      <div className="gear-grid">{SPONSORS.map(brand=>{
        const current=active?.id===brand.id;
        const qualified=eligibleSponsor(r,brand);
        return <article key={brand.id} className={'inner-card sponsor-card'+(current?' signed':'')}>
          <div className="gear-badge"><BadgeCheck size={24}/><Tag kind={current?'lime':'lilac'}>{DISCIPLINE_NAMES[brand.discipline]}</Tag></div>
          <h3>{brand.name}</h3>
          <p>{brand.year}년차부터 · 명성 {brand.fame} · {DISCIPLINE_NAMES[brand.discipline]} 3위 이내 기록 필요</p>
          <p><CircleDollarSign size={15}/> 시즌 지원 {money(brand.support)} · 입상 {money(brand.podium)}</p>
          <p><Package size={15}/> {GEAR.find(item=>item.id===brand.gift)?.name} 지급</p>
          <div className="bottom-actions"><button className="button secondary small" disabled={disabled||!qualified||progress.signedYear===r.year}
            onClick={()=>void send({type:'sponsor',id:brand.id})}>{current?'계약 중':qualified?'계약하기':'조건 미달'}</button></div>
        </article>;
      })}</div>
    </section>
    <section className="panel content-panel">
      <SectionTitle code="RIDER STYLE" title="외형 변경"/>
      <div className="makeover-grid">
        <div className="makeover-rider"><PixelRider look={equippedLook({...r,look})} label="외형 변경 미리보기"/></div>
        <LookFields look={look} onChange={setLook}/>
      </div>
      {progress.equipped.deck&&<p className="subtle"><Settings2 size={14}/> 장착한 데크의 디자인이 기본 데크 디자인보다 먼저 표시됩니다.</p>}
      <div className="bottom-actions"><button className="button primary" disabled={disabled||!changed||available<ECONOMY.makeover}
        onClick={()=>void send({type:'makeover',look})}><Sparkles size={15}/> 적용 {money(ECONOMY.makeover)}</button></div>
    </section>
  </div>;
}
