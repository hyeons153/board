import { BadgeCheck, CircleDollarSign, Package, Settings2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DISCIPLINE_NAMES } from '../game/data';
import { ECONOMY, eligibleSponsor, equippedLook, extras, GEAR, SPONSOR, SPONSORS } from '../game/economy';
import type { Rider } from '../game/types';
import { LookFields, PixelRider } from './Appearance';
import { SectionTitle, Tag } from './Brand';
import { money, type Submit } from './Overview';
import EquipmentPanel from './EquipmentPanel';

export default function Workshop({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  const progress=extras(r);
  const [look,setLook]=useState(r.look);
  const active=SPONSOR.get(progress.contract?.id??'');
  const disabled=saving||r.phase==='retired';
  const available=r.money-(r.plan?.lesson?ECONOMY.lesson:0);
  const changed=JSON.stringify(look)!==JSON.stringify(r.look);
  return <div className="stack workshop">
    <EquipmentPanel r={r} send={send} saving={saving}/>
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
