import { useRef, useState } from 'react';
import { ArrowRight, Package, ShoppingBag } from 'lucide-react';
import { STAT_NAMES } from '../game/data';
import { BASIC_SLOTS, RARITIES, RARITY_NAMES, type Effects, type Gear, type GearSlot } from '../game/equipmentCatalog';
import { ECONOMY, effectiveStats, equipmentStats, equipmentUnlocked, extras, GEAR, GEAR_NAMES, GEAR_SLOTS, ITEM, STARTER_IDS, unlockText } from '../game/economy';
import { STATS, type Rider } from '../game/types';
import { PixelRider } from './Appearance';
import { equippedLook } from '../game/economy';
import { setSoundsEnabled, soundsEnabled } from '../sounds';
import { money, type Submit } from './Overview';

const effectNames:Record<keyof Effects,[string,string]>={injury:['부상 확률 감소','%p'],cost:['훈련 체력 소모 감소',''],rest:['휴식 체력 회복',''],minorRecovery:['경상 회복 단축 · 부상당 1회','주'],danceMastery:['댄싱 숙련 경험치','%'],trickMastery:['트릭 숙련 경험치','%'],linkGrowth:['연계 훈련 성장','%'],danceLink:['댄싱 연계 성공률','%p'],discovery:['자유 연마 발견 확률','%p'],great:['대성공 확률','%p'],podiumFame:['입상 명성','%'],fame:['대회 명성','%'],prize:['대회 상금','%'],entryEnergy:['대회 시작 체력',''],eventChance:['일반 이벤트 등장','%p'],specialWeight:['특별 스팟 이벤트 가중치','%'],relation:['NPC 관계도 보상',''],trickLand:['트릭 착지 성공률','%p'],practice:['기술 연마','%'],fatigue:['종목 체력 소모 감소',''],carve:['옛 카빙 채점 보정',''],speed:['옛 속도 채점 보정','']};
export function effectsText(item:Gear){
  const lines=STATS.flatMap(stat=>item.stats[stat]?[STAT_NAMES[stat]+' +'+item.stats[stat]]:[]);
  for(const [key,value] of Object.entries(item.effects)){
    const [label,unit]=effectNames[key as keyof Effects],amount=unit.startsWith('%')?Math.round(value*10000)/100:value;
    lines.push(label+' '+(key==='injury'||key==='cost'||key==='fatigue'?'-':'+')+amount+unit);
  }
  if(item.visual&&!Object.keys(item.effects).length)lines.push('외형·전용 연출 · 점수 영향 없음');
  if(item.event)lines.push('장착 시 전용 이야기 등장');
  return lines.length?lines:['기본 장비 · 추가 능력치 없음'];
}
export function EquipmentIcon({item}:{item?:Gear}){
  const color=item?.partColor??(item?.rarity==='legendary'?'#f1c975':item?.slot==='accessory'?'#b9d68d':'#91b7d2');
  return <svg className="equipment-icon" viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges">
    {item?.slot==='deck'?<><path fill="#263545" d="M3 10h18v5H3zM1 11h22v3H1zM5 15h3v3H5zM16 15h3v3h-3z"/><path fill={color} d="M3 11h18v2H3z"/><path fill="#f4efda" d="M8 11h2v2H8zM17 11h2v2h-2z"/></>:item?.slot==='trucks'?<><path fill={color} d="M5 7h14v3H5zM10 10h4v7h-4zM3 16h18v3H3z"/><path fill="#263545" d="M2 14h3v7H2zM19 14h3v7h-3z"/></>:item?.slot==='wheels'?<><path fill={color} d="M5 4h14v16H5zM3 7h18v10H3z"/><path fill="#f6efda" d="M8 8h8v8H8z"/><path fill="#35495b" d="M10 10h4v4h-4z"/></>:<><path fill={color} d="M7 4h10v3h3v11h-3v3H7v-3H4V7h3z"/><path fill="#f6efda" d="M8 10h2v3H8zM14 10h2v3h-2zM10 15h4v2h-4z"/><path fill="#536d66" d="M9 2h6v3H9z"/></>}
  </svg>;
}

export default function EquipmentPanel({r,send,saving}:{r:Rider;send:Submit;saving:boolean}){
  const progress=extras(r),[slot,setSlot]=useState<GearSlot>('deck'),[rarity,setRarity]=useState('all'),[ownership,setOwnership]=useState('all'),[selected,setSelected]=useState('deck_001');
  const [sound,setSound]=useState(soundsEnabled);
  const disabled=saving||r.phase==='retired'||!!r.plan,available=r.money-(r.plan?.lesson?ECONOMY.lesson:0);
  const isEquipped=(id:string)=>Object.values(progress.equipped).includes(id)||(progress.accessories??[]).includes(id);
  const item=ITEM.get(selected)??GEAR.find(item=>item.slot===slot)!;
  const owned=progress.inventory.includes(item.id),equipped=isEquipped(item.id),unlocked=equipmentUnlocked(r,item);
  const current=item.slot==='accessory'?undefined:ITEM.get(progress.equipped[item.slot]??'');
  const detail=useRef<HTMLElement>(null);
  const previewExtras={...progress,inventory:[...new Set([...progress.inventory,item.id])],equipped:{...progress.equipped},accessories:[...(progress.accessories??[])]};
  if(item.slot==='accessory')previewExtras.accessories=[item.id];else previewExtras.equipped[item.slot]=item.id;
  const selectItem=(id:string)=>{setSelected(id);if(matchMedia('(max-width:650px)').matches)detail.current?.scrollIntoView({block:'start',behavior:'smooth'});};
  const bonus=equipmentStats(r),total=effectiveStats(r);
  const chooseSlot=(next:GearSlot)=>{setSlot(next);setSelected(GEAR.find(item=>item.slot===next)!.id);};
  const items=GEAR.filter(item=>item.slot===slot&&(!item.legacy||progress.inventory.includes(item.id))&&(rarity==='all'||item.rarity===rarity)&&(ownership==='all'||ownership==='owned'&&progress.inventory.includes(item.id)||ownership==='equipped'&&isEquipped(item.id)));
  return <section className="panel content-panel equipment-panel">
    <div className="workshop-rider"><PixelRider look={equippedLook(r)} label="현재 장비를 장착한 라이더"/><div><h2>장비와 액세서리</h2><p>보유금 <strong>{money(available)}</strong> · 액세서리 {(progress.accessories??[]).length}/3</p></div><ShoppingBag size={24}/></div>
    <button className="text-button equipment-sound" aria-pressed={sound} onClick={()=>{setSound(!sound);setSoundsEnabled(!sound);}}>효과음 {sound?'켜짐':'꺼짐'}</button>
    <div className="equipment-totals" aria-label="장비 적용 능력치">{STATS.map(stat=><div key={stat}><span>{STAT_NAMES[stat]}</span><b>{total[stat].toFixed(1)}</b><small>기본 {r.stats[stat]} + 장비 {bonus[stat]}</small></div>)}</div>
    <div className="equipment-loadout" aria-label="현재 장착 장비">
      {BASIC_SLOTS.map(slot=>{const item=ITEM.get(progress.equipped[slot]??'');return <div key={slot}><small>{GEAR_NAMES[slot]}</small><EquipmentIcon item={item}/><strong>{item?.name??'미장착'}</strong>{item&&<button className="text-button" aria-label={item.name+' 해제'} disabled={disabled} onClick={()=>void send({type:'unequip',slot})}>해제</button>}</div>;})}
      {[0,1,2].map(index=>{const item=ITEM.get(progress.accessories?.[index]??'');return <div key={'acc'+index}><small>액세서리 {index+1}</small><EquipmentIcon item={item}/><strong>{item?.name??'빈 슬롯'}</strong>{item&&<button className="text-button" aria-label={item.name+' 해제'} disabled={disabled} onClick={()=>void send({type:'unequip',slot:'accessory',item:item.id})}>해제</button>}</div>;})}
    </div>
    <div className="equipment-filters"><div className="pill-row" aria-label="장비 종류">{GEAR_SLOTS.map(key=><button key={key} className={'pill'+(slot===key?' active':'')} aria-pressed={slot===key} onClick={()=>chooseSlot(key)}>{GEAR_NAMES[key]}</button>)}</div>
      <label>목록<select aria-label="보유 상태 필터" value={ownership} onChange={e=>setOwnership(e.target.value)}><option value="all">상점과 보관함</option><option value="owned">보유 아이템</option><option value="equipped">장착 아이템</option></select></label>
      <label>희귀도<select aria-label="희귀도 필터" value={rarity} onChange={e=>setRarity(e.target.value)}><option value="all">전체 희귀도</option>{RARITIES.map(key=><option key={key} value={key}>{RARITY_NAMES[key]}</option>)}</select></label>
    </div>
    <div className="equipment-browser"><div className="equipment-items" aria-label="장비 아이템 목록">{items.map(item=><button key={item.id} className={'equipment-choice'+(selected===item.id?' selected':'')} aria-label={item.name+' 상세'} aria-pressed={selected===item.id} onClick={()=>selectItem(item.id)}>
      <EquipmentIcon item={item}/><span className={'equipment-rarity rarity-'+item.rarity}>{RARITY_NAMES[item.rarity]}</span><strong>{item.name}</strong><small>{effectsText(item).join(' · ')}</small><span>{isEquipped(item.id)?'장착 중':progress.inventory.includes(item.id)?'보유':item.unlock?unlockText(item):money(item.price)}{item.legacy?' · 이전 장비':''}</span>
    </button>)}{!items.length&&<p>조건에 맞는 아이템이 없습니다.</p>}</div>
    <aside className="equipment-detail" aria-label="아이템 상세" ref={detail}><div className="equipment-detail-title"><EquipmentIcon item={item}/><span className={'equipment-rarity rarity-'+item.rarity}>{RARITY_NAMES[item.rarity]}</span><h3>{item.name}</h3></div>
      <PixelRider look={equippedLook({look:r.look,extras:previewExtras})} label={item.name+' 착용 미리보기'}/>
      <p>{item.description}</p><ul>{effectsText(item).map(line=><li key={line}>{line}</li>)}</ul>
      {item.slot!=='accessory'&&<div className="equipment-comparison" aria-label="장비 교체 비교"><strong>{current?.name??'미장착'} <ArrowRight size={14}/> {item.name}</strong>{STATS.filter(stat=>item.stats[stat]||current?.stats[stat]).map(stat=>{const difference=(item.stats[stat]??0)-(current?.stats[stat]??0);return <p key={stat}>{STAT_NAMES[stat]} 장비 {current?.stats[stat]??0} → {item.stats[stat]??0} <b className={difference<0?'is-loss':''}>({difference>=0?'+':''}{difference})</b></p>;})}<small>기본 능력치는 유지됩니다.</small></div>}
      {item.slot==='accessory'&&<p className="equipment-slot-note">최대 3개 장착 · 같은 아이템 중복 장착 불가</p>}
      <p className="equipment-unlock">{item.unlock?unlockText(item):STARTER_IDS.includes(item.id)?'처음부터 지급되는 기본 장비':owned?'보관함에 보유 중':'가격 '+money(item.price)}</p>
      <div className="equipment-actions">{owned?<><button className="button primary small" disabled={disabled||equipped||(item.slot==='accessory'&&(progress.accessories??[]).length>=3)} onClick={()=>void send({type:'trade',operation:'equip',item:item.id})}>{equipped?'장착 중':'장착'}</button>
        {!STARTER_IDS.includes(item.id)&&!item.unlock&&<button className="button quiet small" disabled={disabled} onClick={()=>void send({type:'trade',operation:'sell',item:item.id})}>판매 {money(Math.floor(item.price*ECONOMY.sellRate))}</button>}</>:item.unlock?<button className="button primary small" disabled={disabled||!unlocked} onClick={()=>void send({type:'claim-gear'})}>{unlocked?'해금 보상 받기':'해금 대기'}</button>:<button className="button primary small" disabled={disabled||available<item.price} onClick={()=>void send({type:'trade',operation:'buy',item:item.id})}>구매 {money(item.price)}</button>}</div>
    </aside></div>
    {progress.legacyEquipment&&<details className="equipment-legacy"><summary><Package size={14}/> 이전 장비 보존 기록</summary><p>기존 베어링은 같은 이름과 ID로 액세서리에 옮겼습니다. 지난 경기의 채점 입력은 원본을 유지합니다.</p>{progress.legacyEquipment.unmapped.length>0&&<p>호환 정보 보관: {progress.legacyEquipment.unmapped.join(', ')} · 보유 기록을 유지하며 능력치에는 합산하지 않습니다.</p>}{progress.legacyEquipment.overflow.length>0&&<p>슬롯이 가득 차 보관함에 남긴 장비: {progress.legacyEquipment.overflow.join(', ')}</p>}</details>}
  </section>;
}
