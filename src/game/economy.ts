import type { Discipline, Look, Result, Rider } from './types';

export const GEAR_SLOTS = ['deck', 'trucks', 'wheels', 'bearings'] as const;
export type GearSlot = typeof GEAR_SLOTS[number];
export type Bonus = { danceLink?: number; trickLand?: number; carve?: number; speed?: number; practice?: number; fatigue?: number };
type Gear = { id: string; slot: GearSlot; name: string; price: number; description: string; bonus: Bonus; design?: number };
export const GEAR: Gear[] = [
  { id:'deck-flow', slot:'deck', name:'리버 플로우 데크', price:94_000, description:'댄싱 연계 +3%p · 댄싱/트릭 연마 +3%', bonus:{ danceLink:.03, practice:.03 }, design:1 },
  { id:'deck-pop', slot:'deck', name:'킥테일 팝 데크', price:98_000, description:'트릭 성공률 +2.5%p', bonus:{ trickLand:.025 }, design:2 },
  { id:'deck-cruise', slot:'deck', name:'선셋 올데이 데크', price:85_000, description:'카빙·속도 점수 +2', bonus:{ carve:2, speed:2 }, design:3 },
  { id:'trucks-carve', slot:'trucks', name:'아크 트럭', price:75_000, description:'카빙 점수 +4', bonus:{ carve:4 } },
  { id:'trucks-soft', slot:'trucks', name:'플로트 트럭', price:71_000, description:'댄싱 연계 +2%p · 트릭 성공률 +1%p', bonus:{ danceLink:.02, trickLand:.01 } },
  { id:'wheels-grip', slot:'wheels', name:'코너 그립 휠', price:68_000, description:'카빙 점수 +3 · 기술 연마 +4%', bonus:{ carve:3, practice:.04 } },
  { id:'wheels-slide', slot:'wheels', name:'스냅 휠', price:72_000, description:'트릭 성공률 +2%p · 속도 점수 +1', bonus:{ trickLand:.02, speed:1 } },
  { id:'bearings-quiet', slot:'bearings', name:'새벽 베어링', price:60_000, description:'속도 점수 +4', bonus:{ speed:4 } },
  { id:'bearings-endurance', slot:'bearings', name:'마일 베어링', price:65_000, description:'종목당 체력 소모 −2', bonus:{ fatigue:2 } },
];
export const ITEM = new Map(GEAR.map(item => [item.id, item]));
export const GEAR_NAMES: Record<GearSlot,string> = { deck:'데크', trucks:'트럭', wheels:'휠', bearings:'베어링' };
export const ECONOMY = {
  lesson:18_000, makeover:12_000, sellRate:.55, participation:8_000, podiumSeason:[95_000,65_000,40_000],
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
  equipped: Partial<Record<GearSlot,string>>;
  contract: { id:string; year:number } | null;
  signedYear: number;
  achievements: string[];
  choices: Record<string, { index:number; year:number; week:number }>;
  timeline: { year:number; week:number; title:string; text:string }[];
  lastTraining?: { grade:'success'|'great'|'learned'|'mastery'|'miss'|'injury'|'recovery'; text:string; skill?:string; year:number; week:number };
};
export function freshExtras(): CareerExtras {
  return { inventory:[], equipped:{}, contract:null, signedYear:0, achievements:[], choices:{}, timeline:[] };
}
export function extras(rider: Pick<Rider,'extras'>): CareerExtras { return rider.extras ?? freshExtras(); }
export function gearBonuses(rider: Pick<Rider,'extras'>): Required<Bonus> {
  const total = { danceLink:0, trickLand:0, carve:0, speed:0, practice:0, fatigue:0 };
  if(!rider.extras) return total;
  for (const id of Object.values(rider.extras.equipped)) {
    const item = ITEM.get(id);
    if (!item || !rider.extras.inventory.includes(id)) continue;
    for (const key of Object.keys(total) as (keyof Bonus)[]) total[key] += item.bonus[key] ?? 0;
  }
  return total;
}
export function equippedLook(rider: Pick<Rider,'look'|'extras'>): Look {
  const deck = ITEM.get(extras(rider).equipped.deck ?? '');
  return deck?.design === undefined ? rider.look : { ...rider.look, deckDesign:deck.design };
}
export const playerPlace = (result: Result) => result.standings.find(row => row.id === 'player')?.place ?? Infinity;
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
