import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Package, Volume2, VolumeX } from 'lucide-react';
import { STAT_NAMES } from '../game/data';
import { BASIC_SLOTS, RARITIES, RARITY_NAMES, type Effects, type Gear, type GearSlot } from '../game/equipmentCatalog';
import { effectiveStats, equipmentStats, equipmentUnlocked, extras, GEAR, GEAR_NAMES, GEAR_SLOTS, ITEM, resaleValue, STARTER_IDS, unlockText } from '../game/economy';
import { STATS, type GameAction, type Rider } from '../game/types';
import { PixelRider } from './Appearance';
import { equippedLook } from '../game/economy';
import { setSoundsEnabled, soundsEnabled } from '../sounds';
import { money, type Submit } from './Overview';

const effectNames:Record<keyof Effects,[string,string]>={injury:['부상 확률 감소','%p'],cost:['훈련 체력 소모 감소',''],rest:['휴식 체력 회복',''],minorRecovery:['경상 회복 단축 · 부상당 1회','주'],danceMastery:['댄싱 숙련 경험치','%'],trickMastery:['트릭 숙련 경험치','%'],linkGrowth:['연계 훈련 성장','%'],danceLink:['댄싱 연계 성공률','%p'],discovery:['자유 연마 발견 확률','%p'],great:['대성공 확률','%p'],podiumFame:['입상 명성','%'],fame:['대회 명성','%'],prize:['대회 상금','%'],entryEnergy:['대회 시작 체력',''],eventChance:['일반 이벤트 등장','%p'],specialWeight:['특별 스팟 이벤트 가중치','%'],relation:['NPC 친밀도 보상',''],trickLand:['트릭 착지 성공률','%p'],practice:['기술 연마','%'],fatigue:['종목 체력 소모 감소',''],carve:['옛 카빙 채점 보정',''],speed:['옛 속도 채점 보정','']};
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
  const progress=extras(r),[slot,setSlot]=useState<GearSlot>('deck'),[rarity,setRarity]=useState('all');
  const [ownership,setOwnership]=useState<'all'|'owned'|'equipped'>('all'),[selected,setSelected]=useState<string>();
  const [sound,setSound]=useState(soundsEnabled);
  const [feedback,setFeedback]=useState('');
  const disabled=saving||r.phase==='retired',available=r.money;
  const isEquipped=(id:string)=>Object.values(progress.equipped).includes(id)||(progress.accessories??[]).includes(id);
  const chosenButton=useRef<HTMLButtonElement|null>(null);
  const detail=useRef<HTMLElement|null>(null);
  const selectItem=(id:string,button:HTMLButtonElement)=>{
    chosenButton.current=button;setSelected(id);
    if(matchMedia('(max-width:760px)').matches)window.requestAnimationFrame(()=>{
      detail.current?.focus({preventScroll:true});detail.current?.scrollIntoView({block:'nearest'});
    });
  };
  const closeDetail=()=>{
    setSelected(undefined);const button=chosenButton.current;
    window.requestAnimationFrame(()=>button?.focus());
  };
  const bonus=equipmentStats(r),total=effectiveStats(r);
  const chooseSlot=(next:GearSlot)=>{setSlot(next);setSelected(undefined);};
  const items=GEAR.filter(item=>item.slot===slot&&(!item.legacy||progress.inventory.includes(item.id))&&(rarity==='all'||item.rarity===rarity)&&(ownership==='all'||ownership==='owned'&&progress.inventory.includes(item.id)||ownership==='equipped'&&isEquipped(item.id)));
  const item=items.find(item=>item.id===selected);
  const apply=async (action:GameAction,message:string)=>{
    setFeedback('');
    if(await send(action))setFeedback(message);
  };
  const status=(item:Gear)=>isEquipped(item.id)?'장착 중':progress.inventory.includes(item.id)?'보유':item.unlock?
    equipmentUnlocked(r,item)?'보상 받기':'잠김':available>=item.price?'구매 가능':'보유금 부족';
  return <section className="panel content-panel equipment-panel">
    <div className="workshop-rider"><PixelRider look={equippedLook(r)} label="현재 장비를 장착한 라이더"/><div><h2>내 장비</h2><p>보유금 <strong>{money(available)}</strong> · 액세서리 {(progress.accessories??[]).length}/3</p></div>
      <button className="button quiet small equipment-sound" aria-pressed={sound} onClick={()=>{setSound(!sound);setSoundsEnabled(!sound);}}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>} 효과음 {sound?'켜짐':'꺼짐'}</button>
    </div>
    {r.plan&&<p className="game-section-note">장비 교체는 다음 훈련부터 적용돼요.</p>}
    <div className="equipment-totals" aria-label="장비 적용 능력치">{STATS.map(stat=><div key={stat}><span>{STAT_NAMES[stat]}</span><b>{total[stat].toFixed(1)}</b><small>기본 {r.stats[stat]} + 장비 {bonus[stat]}</small></div>)}</div>
    <div className="equipment-loadout" aria-label="현재 장착 장비">
      {BASIC_SLOTS.map(slot=>{const item=ITEM.get(progress.equipped[slot]??'');return <div key={slot}><small>{GEAR_NAMES[slot]}</small><EquipmentIcon item={item}/><strong>{item?.name??'미장착'}</strong>{item&&<button className="text-button" aria-label={item.name+' 해제'} disabled={disabled} onClick={()=>void send({type:'unequip',slot})}>해제</button>}</div>;})}
      {[0,1,2].map(index=>{const item=ITEM.get(progress.accessories?.[index]??'');return <div key={'acc'+index}><small>액세서리 {index+1}</small><EquipmentIcon item={item}/><strong>{item?.name??'빈 슬롯'}</strong>{item&&<button className="text-button" aria-label={item.name+' 해제'} disabled={disabled} onClick={()=>void send({type:'unequip',slot:'accessory',item:item.id})}>해제</button>}</div>;})}
    </div>
    <div className="equipment-filters">
      <div className="pill-row" role="group" aria-label="보유 상태 필터">
        {([['all','상점'],['owned','보관함'],['equipped','장착 중']] as const).map(([key,label])=><button key={key} className="pill" aria-pressed={ownership===key} onClick={()=>{setOwnership(key);setSelected(undefined);}}>{label}</button>)}
      </div>
      <div className="pill-row" role="group" aria-label="장비 종류">{GEAR_SLOTS.map(key=><button key={key} className="pill" aria-pressed={slot===key} onClick={()=>chooseSlot(key)}>{GEAR_NAMES[key]}</button>)}</div>
      <label>희귀도<select aria-label="희귀도 필터" value={rarity} onChange={e=>{setRarity(e.target.value);setSelected(undefined);}}><option value="all">전체</option>{RARITIES.map(key=><option key={key} value={key}>{RARITY_NAMES[key]}</option>)}</select></label>
    </div>
    <div className="equipment-feedback" role="status">{feedback}</div>
    <div className="equipment-browser"><div className="equipment-items" aria-label="장비 아이템 목록">{items.map(item=><button key={item.id} className={'equipment-choice'+(selected===item.id?' selected':'')} aria-label={item.name+' 상세'} aria-pressed={selected===item.id} onClick={event=>selectItem(item.id,event.currentTarget)}>
      <EquipmentIcon item={item}/>
      <span className="equipment-choice-name"><strong>{item.name}</strong><small>{RARITY_NAMES[item.rarity]}{item.legacy?' · 이전 장비':''}</small></span>
      <span className="equipment-choice-status" data-state={status(item)}>{status(item)}{!item.unlock&&!progress.inventory.includes(item.id)&&<b>{money(item.price)}</b>}</span>
    </button>)}{!items.length&&<p className="game-empty">조건에 맞는 아이템이 없어요.</p>}</div>
    {item&&<aside className="equipment-detail" aria-label="아이템 상세" tabIndex={-1} ref={detail}>
      <ItemDetail item={item} r={r} owned={progress.inventory.includes(item.id)} equipped={isEquipped(item.id)} disabled={disabled}
        available={available} status={status(item)} total={total} apply={apply} onClose={closeDetail}/>
    </aside>}</div>
    {progress.legacyEquipment&&<details className="equipment-legacy"><summary><Package size={14}/> 이전 장비 보존 기록</summary><p>기존 베어링은 같은 이름과 ID로 액세서리에 옮겼습니다. 지난 경기의 채점 입력은 원본을 유지합니다.</p>{progress.legacyEquipment.unmapped.length>0&&<p>호환 정보 보관: {progress.legacyEquipment.unmapped.join(', ')} · 보유 기록을 유지하며 능력치에는 합산하지 않습니다.</p>}{progress.legacyEquipment.overflow.length>0&&<p>슬롯이 가득 차 보관함에 남긴 장비: {progress.legacyEquipment.overflow.join(', ')}</p>}</details>}
  </section>;
}

function ItemDetail({item,r,owned,equipped,disabled,available,status,total,apply,onClose}:{
  item:Gear;r:Rider;owned:boolean;equipped:boolean;disabled:boolean;available:number;status:string;
  total:ReturnType<typeof effectiveStats>;apply:(action:GameAction,message:string)=>Promise<void>;onClose:()=>void;
}){
  const {slot}=item;
  const progress=extras(r),accessory=slot==='accessory',slots=progress.accessories??[];
  const full=accessory&&slots.length>=3;
  const current=accessory?undefined:ITEM.get(progress.equipped[slot]??'');
  const previewExtras={...progress,inventory:[...new Set([...progress.inventory,item.id])],equipped:{...progress.equipped},accessories:[...slots]};
  if(accessory&&!equipped)previewExtras.accessories=[...slots.slice(0,2),item.id];
  if(!accessory)previewExtras.equipped[slot]=item.id;
  const after=effectiveStats({...r,extras:previewExtras});
  const differenceStats=STATS.filter(stat=>after[stat]!==total[stat]);
  const unlocked=equipmentUnlocked(r,item);
  return <>
    <button className="text-button equipment-back" onClick={onClose}><ArrowLeft size={15}/> 아이템 목록</button>
    <div className="equipment-detail-title"><EquipmentIcon item={item}/><span className={'equipment-rarity rarity-'+item.rarity}>{RARITY_NAMES[item.rarity]} · {status}</span><h3>{item.name}</h3></div>
    <div className="equipment-detail-overview">
      <PixelRider look={equippedLook({look:r.look,extras:previewExtras})} label={item.name+' 착용 미리보기'}/>
      <div><p>{item.description}</p><ul>{effectsText(item).map(line=><li key={line}>{line}</li>)}</ul></div>
    </div>
    {!accessory&&<div className="equipment-comparison" aria-label="장비 교체 비교">
      <strong>{current?.name??'미장착'} <ArrowRight size={14}/> {item.name}</strong>
      {differenceStats.length?<dl className="game-facts">{differenceStats.map(stat=>{
        const diff=after[stat]-total[stat];
        return <div key={stat}><dt>{STAT_NAMES[stat]}</dt><dd>{total[stat].toFixed(1)} → {after[stat].toFixed(1)} <b className={diff<0?'is-loss':''}>({diff>0?'+':''}{Number(diff.toFixed(1))})</b></dd></div>;
      })}</dl>:<p>능력치 변화 없음</p>}
    </div>}
    {full&&!equipped&&<p className="game-section-note">장착하려면 액세서리 한 개를 먼저 해제하세요.</p>}
    {item.unlock&&<p className="equipment-unlock">{unlockText(item)}</p>}
    <div className="equipment-actions">{owned?<><button className="button primary" disabled={disabled||equipped||full} onClick={()=>void apply({type:'trade',operation:'equip',item:item.id},item.name+' 장착 완료')}>{equipped?'장착 중':'장착'}</button>
      {!STARTER_IDS.includes(item.id)&&!item.unlock&&<button className="button quiet" disabled={disabled} onClick={()=>void apply({type:'trade',operation:'sell',item:item.id},item.name+' 판매 완료')}>판매 {money(resaleValue(r,item))}</button>}</>:item.unlock?<button className="button primary" disabled={disabled||!unlocked} onClick={()=>void apply({type:'claim-gear'},'해금 장비를 보관함에 넣었어요.')}>{unlocked?'해금 보상 받기':'해금 대기'}</button>:<button className="button primary" disabled={disabled||available<item.price} onClick={()=>void apply({type:'trade',operation:'buy',item:item.id},item.name+' 구매 완료')}>구매 {money(item.price)}</button>}</div>
  </>;
}
