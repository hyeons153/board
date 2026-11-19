import type { Discipline, Look, RelationshipHistory, Result, Rider } from './types.js';

import { BASIC_SLOTS, GEAR, GEAR_SLOTS, ITEM, LEGACY_BONUSES, PREVIOUS_PRICES, STARTER_IDS, type Effects, type Gear, type GearSlot } from './equipmentCatalog.js';
import { STATS, type Stats } from './types.js';
import { round } from './random.js';
export { GEAR, ITEM, GEAR_SLOTS, BASIC_SLOTS, STARTER_IDS } from './equipmentCatalog.js';
export type { GearSlot, Gear, Effects } from './equipmentCatalog.js';
export type Bonus = { danceLink?: number; trickLand?: number; carve?: number; speed?: number; practice?: number; fatigue?: number };
export const GEAR_NAMES: Record<GearSlot,string> = { deck:'데크', trucks:'트럭', wheels:'휠', accessory:'액세서리' };
export const ECONOMY = {
  lesson:18_000, makeover:12_000, sellRate:.55, participation:4_000, podiumSeason:[60_000,40_000,25_000],
  achievements:{ learn:35_000, meet:25_000, win:80_000, variety:65_000 },
} as const;

type Sponsor = {
  id:string; name:string; discipline:Discipline; fame:number; year:number; support:number; podium:number; gift:string; place:number;
};
export const SPONSORS: Sponsor[] = [
  { id:'daybreak', name:'데이브레이크 스텝', discipline:'dance', fame:8, year:1, support:85_000, podium:34_000, gift:'deck-flow', place:3 },
  { id:'tailwind', name:'테일윈드 랩', discipline:'trick', fame:12, year:1, support:95_000, podium:40_000, gift:'deck-pop', place:3 },
  { id:'orbit', name:'오르빗 보드웍스', discipline:'freestyle', fame:20, year:2, support:120_000, podium:48_000, gift:'bearings-endurance', place:3 },
];
export const SPONSOR = new Map(SPONSORS.map(brand => [brand.id, brand]));
export type CareerExtras = {
  inventory: string[];
  purchasePrices?:Record<string,number>;
  equipped: Partial<Record<'deck'|'trucks'|'wheels'|'bearings',string>>;
  accessories?:string[];
  equipmentVersion?:2;
  legacyEquipment?:{original:Record<string,string>;unmapped:string[];overflow:string[]};
  contract: { id:string; year:number } | null;
  signedYear: number;
  achievements: string[];
  choices: Record<string, { index:number; year:number; week:number; npc?:string }>;
  relationships?:RelationshipHistory;
  storyReadyAt?:Partial<Record<string,number>>;
  timeline: { year:number; week:number; title:string; text:string }[];
  lastEvent?:import('./types.js').EventOutcome;
  lastTraining?: { reaction?:string; special?:import('./training.js').SpecialTraining; grade:'success'|'great'|'learned'|'mastery'|'miss'|'injury'|'recovery'; text:string; narration?:string; changes?:string[]; skill?:string; year:number; week:number };
};
export function freshExtras(): CareerExtras {
  return { inventory:[...STARTER_IDS], equipped:{deck:'deck_001',trucks:'truck_001',wheels:'wheel_001'},accessories:[],equipmentVersion:2,contract:null,signedYear:0,achievements:[],choices:{},timeline:[] };
}
/** Pure and idempotent: no old ID, unknown item, archive or proof is deleted. */
export function upgradeEquipment(original:CareerExtras):CareerExtras {
  if(original.equipmentVersion===2)return original;
  const result=structuredClone(original),old={...result.equipped};
  result.inventory=[...new Set([...result.inventory,...STARTER_IDS])];
  for(const id of Object.values(old))if(!result.inventory.includes(id))result.inventory.push(id);
  const accessories=[...new Set(result.accessories??[])],unmapped:string[]=[];
  if(old.bearings){
    if(!result.inventory.includes(old.bearings))result.inventory.push(old.bearings);
    if(ITEM.get(old.bearings)?.slot==='accessory')accessories.push(old.bearings);else unmapped.push(old.bearings);
  }
  for(const [slot,id] of Object.entries(old))if(!ITEM.has(id)){
    if(!result.inventory.includes(id))result.inventory.push(id);unmapped.push(id);
  }
  const unique=[...new Set(accessories)],overflow=unique.slice(3);
  result.accessories=unique.slice(0,3);
  result.equipped={};
  for(const [index,slot] of BASIC_SLOTS.entries()){
    const candidate=old[slot];result.equipped[slot]=candidate&&ITEM.get(candidate)?.slot===slot&&result.inventory.includes(candidate)?candidate:STARTER_IDS[index];
  }
  result.legacyEquipment={original:old,unmapped:[...new Set(unmapped)],overflow};
  result.equipmentVersion=2;
  return result;
}
export function extras(rider: Pick<Rider,'extras'>): CareerExtras { return rider.extras?upgradeEquipment(rider.extras):freshExtras(); }
export function equippedItems(rider:Pick<Rider,'extras'>):Gear[]{
  const progress=extras(rider),ids=[...BASIC_SLOTS.flatMap(slot=>{const id=progress.equipped[slot];return id&&ITEM.get(id)?.slot===slot?[id]:[];}),...[...new Set(progress.accessories??[])].filter(id=>ITEM.get(id)?.slot==='accessory').slice(0,3)];
  return [...new Set(ids)].flatMap(id=>{const item=ITEM.get(id);return item&&progress.inventory.includes(id)?[item]:[];});
}
const emptyEffects=():Effects=>({injury:0,cost:0,rest:0,minorRecovery:0,danceMastery:0,trickMastery:0,linkGrowth:0,danceLink:0,discovery:0,great:0,podiumFame:0,fame:0,prize:0,entryEnergy:0,eventChance:0,specialWeight:0,relation:0,trickLand:0,practice:0,fatigue:0,carve:0,speed:0});
export function gearBonuses(rider:Pick<Rider,'extras'>):Effects {
  const total=emptyEffects();
  if(!rider.extras)return total;
  for(const item of equippedItems(rider))for(const [key,value] of Object.entries(item.effects))total[key as keyof Effects]+=value;
  const caps:Partial<Effects>={injury:.02,great:.01,danceMastery:.06,trickMastery:.06,linkGrowth:.06,prize:.06,fame:.06,podiumFame:.06,practice:.06,danceLink:.06,trickLand:.06,eventChance:.03,discovery:.03,relation:1,minorRecovery:1};
  for(const [key,value] of Object.entries(caps))total[key as keyof Effects]=Math.min(total[key as keyof Effects],value);
  return total;
}
export function legacyBonuses(rider:Pick<Rider,'extras'>):Required<Bonus>{
  const total={danceLink:0,trickLand:0,carve:0,speed:0,practice:0,fatigue:0};
  for(const id of Object.values(rider.extras?.equipped??{})){
    if(!rider.extras?.inventory.includes(id))continue;
    for(const key of Object.keys(total) as (keyof Bonus)[])total[key]+=LEGACY_BONUSES[id]?.[key]??0;
  }
  return total;
}
export function equipmentStats(rider:Pick<Rider,'extras'>):Stats{
  const result:Stats={speed:0,carve:0,link:0,balance:0};
  if(!rider.extras)return result;
  for(const item of equippedItems(rider).filter(item=>item.slot!=='accessory'))for(const stat of STATS)result[stat]+=item.stats[stat]??0;
  return result;
}
export function effectiveStats(rider:Pick<Rider,'stats'|'extras'>):Stats{
  const bonus=equipmentStats(rider);return Object.fromEntries(STATS.map(stat=>[stat,round(rider.stats[stat]+bonus[stat])])) as Stats;
}
export function equipmentUnlocked(rider:Rider,item:Gear):boolean{
  if(item.unlock==='relationship')return extras(rider).inventory.includes(item.id);
  const wins=rider.records.flatMap(meet=>meet.results).filter(result=>playerPlace(result)===1).length;
  if(!item.unlock)return true;
  if(item.unlock==='win')return wins>=1;
  if(item.unlock==='rainbow')return rider.year>=4&&wins>=6;
  return !!rider.events[item.unlock==='sticker'?'crew-sticker':'red-scarf'];
}
export const unlockText=(item:Gear)=>item.unlock==='win'?'첫 우승 달성':item.unlock==='rainbow'?'4년차 이상 · 통산 6승':item.unlock==='sticker'?'선배 스티커 이벤트':item.unlock==='scarf'?'빨간 머플러 이벤트':item.unlock==='relationship'?'라이벌 개인 에피소드 보상':'구매 가능';
export function unlockEquipment(rider:Rider){
  const progress=rider.extras??=freshExtras();
  for(const item of GEAR.filter(item=>item.unlock==='win'||item.unlock==='rainbow'))if(equipmentUnlocked(rider,item)&&!progress.inventory.includes(item.id)){
    progress.inventory.push(item.id);milestone(rider,'특별 장비 해금',item.name+' · 인벤토리에 지급했습니다.');
  }
}
export function equippedLook(rider:Pick<Rider,'look'|'extras'>):Look {
  const progress=extras(rider),deck=ITEM.get(progress.equipped.deck??''),trucks=ITEM.get(progress.equipped.trucks??''),wheels=ITEM.get(progress.equipped.wheels??'');
  return {...rider.look,...(deck?.design!==undefined?{deckDesign:deck.design}:{}),equipment:{
    deck:deck?{shape:deck.shape??0,color:deck.color}:undefined,
    trucks:trucks?.partColor,wheels:wheels?{color:wheels.partColor,size:wheels.wheelSize??5}:undefined,
    accessories:equippedItems(rider).flatMap(item=>item.visual?[item.visual]:[]),
  }};
}
export const equipmentEvents=(rider:Pick<Rider,'extras'>)=>equippedItems(rider).flatMap(item=>item.event?[item.event]:[]);
export function equipmentReaction(rider:Pick<Rider,'extras'>,grade:string){
  const visuals=equippedItems(rider).map(item=>item.visual);
  if((grade==='injury'||grade==='miss')&&visuals.includes('chick'))return '삐약! 인형이 먼저 비명을 질렀다. 괜찮아, 다음 착지는 같이 하자.';
  if((grade==='great'||grade==='learned')&&visuals.includes('disco'))return '키링이 반짝! 오늘 스팟은 작은 디스코 무대다.';
  if(visuals.includes('cactus'))return '발이 잠깐 꼬여도 선인장은 끝까지 춤춘다.';
  if(visuals.includes('snail'))return '달팽이의 한마디: 천천히 가도, 오늘은 앞으로 갔다.';
  if(visuals.includes('duck'))return '꽥. 오리도 오늘의 주행에 한 표를 보냈다.';
  return undefined;
}
export const playerPlace = (result: Result) => result.standings.find(row => row.id === 'player')?.place ?? Infinity;
export const resaleValue=(rider:Pick<Rider,'extras'>,item:Gear)=>Math.floor(Math.min(item.price,extras(rider).purchasePrices?.[item.id]??PREVIOUS_PRICES[item.id]??item.price)*ECONOMY.sellRate);
export function eligibleSponsor(rider: Rider, brand: Sponsor) {
  return rider.fame >= brand.fame && rider.year >= brand.year &&
    rider.records.some(meet => meet.results.some(result => result.discipline === brand.discipline && playerPlace(result) <= brand.place));
}
export function maintainedSponsor(rider: Rider, brand: Sponsor) {
  return rider.records.some(meet => meet.year === rider.year &&
    meet.results.some(result => result.discipline === brand.discipline && playerPlace(result) <= brand.place));
}
export function supply(rider: Rider, brand: Sponsor) {
  const progression = rider.extras ??= freshExtras();
  progression.contract = { id:brand.id, year:rider.year };
  progression.signedYear = rider.year;
  rider.money += brand.support;
  if (!progression.inventory.includes(brand.gift)) progression.inventory.push(brand.gift);
}
export function milestone(rider: Rider, title:string, text:string) {
  const progression = rider.extras ??= freshExtras();
  progression.timeline.unshift({year:rider.year,week:rider.week,title,text});
  progression.timeline = progression.timeline.slice(0,100);
}
