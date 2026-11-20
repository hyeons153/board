import { ITEM } from './equipmentCatalog.js';
import { RULES } from './data.js';
import type { CareerExtras } from './economy.js';
import type { EventDef } from './events.js';
import { NPC_NAMES, type RelationshipHistory, type RelationshipMode, type RelationshipState, type Rider } from './types.js';

export const STORY_NPCS=['min','sol','jun','ha','noa','yu'] as const;
export type StoryNpc=typeof STORY_NPCS[number];
export const STORY_TITLES:Record<string,string>={
  'min-future':'계획에 없던 사람','min-boundary':'자유로운 라이더','min-goodbye':'체크리스트 탈출자',
  'sol-honest':'농담 없는 오늘','sol-coffee':'커피 두 잔의 거리','sol-farewell':'밀당의 피해자',
  'jun-landing':'일곱 번째 착지','jun-broadcast':'카메라 앞의 연인',
  'ha-late':'1초 늦은 마음','ha-rival':'영원한 맞수','ha-wait':'우연인 척 기다린 사람',
  'noa-neon':'네온 아래의 약속','noa-missed':'읽지 않은 47개의 메시지','noa-friend':'불 꺼진 광장의 친구',
  'yu-wind':'처음의 강바람','yu-finals':'같은 박자 다른 길',
  'crew-exposed':'강변의 카사노바','crew-confession':'고백도 착지 실패','crew-judge':'심사위원과는 구면입니다',
  'crew-contract':'사랑은 끝나도 계약은 남는다','crew-exes':'전 애인 수집가','crew-comeback':'연애보다 롱보드','crew-repair':'화해의 달인',
};
export type StoryChange={npc:string;state?:RelationshipState;flag?:string;mode?:RelationshipMode;pendingReward?:{title?:string;item?:string}};
export type StoryImpact={changes?:StoryChange[];title?:string;item?:string;couple?:[string,string];dialogue?:string;romanceAttempt?:true};
type Progress={extras?:Pick<CareerExtras,'relationships'|'choices'>};
export const name=(npc:string)=>Object.hasOwn(NPC_NAMES,npc)?NPC_NAMES[npc as StoryNpc]:'크루 동료';
export const storyProgress=(r:Progress,npc:string)=>r.extras?.relationships?.npcs[npc];
export const storyLog=(r:Progress)=>r.extras?.relationships?.story??[];
export const activePartners=(r:Progress)=>STORY_NPCS.filter(npc=>storyProgress(r,npc)?.state==='partner');
export const formerPartners=(r:Progress)=>STORY_NPCS.filter(npc=>{
  const item=storyProgress(r,npc);
  return item?.state!=='partner'&&(item?.flags.includes('former-partner')||item?.flags.includes('confession-accepted')&&item.state==='ended');
});
export const hasFlag=(r:Progress,npc:string,flag:string)=>storyProgress(r,npc)?.flags.includes(flag)??false;
export const chosen=(r:Progress,id:string,index:number)=>r.extras?.choices[id]?.index===index;
export const elapsed=(r:Rider,id:string)=>{
  const date=r.extras?.choices[id]??storyLog(r).findLast(entry=>entry.id===id);
  return date?(r.year-date.year)*RULES.weeks+r.week-date.week:-1;
};
export const change=(npc:string,state?:RelationshipState,flag?:string,mode?:RelationshipMode):StoryChange=>({npc,state,flag,mode});
type Option=EventDef['choices'][number];
export const option=(label:string,dialogue:string,impact:StoryImpact|((r:Rider)=>StoryImpact)={},effect:Option['effect']={},tags:Option['tags']=[]):Option=>
  ({label,effect,tags,story:r=>({dialogue,...(typeof impact==='function'?impact(r):impact)})});
export const record=(npc:string,flag:string,state?:RelationshipState):StoryImpact=>({changes:[change(npc,state,flag)]});
export function scene(id:string,title:string,body:EventDef['body'],when:EventDef['when'],choices:Option[],settings:Partial<EventDef>={}):EventDef{
  return {id,title,body,when,choices,kind:'커리어 이야기',story:true,chapter:true,...settings};
}

const affectionSignals:Record<StoryNpc,Record<string,number>>={
  min:{'check-together':1,'agreed-boundaries':2,accountability:3,delegated:-1,overreach:-3,distance:-2},
  sol:{flirt:2,'asked-honestly':3,'checked-facts':3,apology:2,'fake-date':-3,distance:-2},
  jun:{'kept-clip':3,'asked-about-crush':4,'honest-retry':3,privacy:1,'hurt-on-camera':-3},
  ha:{thanked:1,respect:2,noticed:2,reassured:3,'timed':-1},
  noa:{'first-message':1,'clear-boundary':3,heard:3,supported:2,lied:-3,distance:-2},
  yu:{'dream-shared':2,'clear-boundary':1,'long-distance':3,duet:3,'jealous-press':-3,distance:-2},
};

// Choice flags already persist in old saves. Affection can be rebuilt without exposing or migrating a meter.
export function hasRomanticInterest(r:Progress,npc:StoryNpc){
  const current=storyProgress(r,npc);
  if(current?.state==='partner')return true;
  if(current?.state==='ended'||current?.flags.some(flag=>['former-partner','confession-declined','rejected','overlap-declined'].includes(flag)))return false;
  const confirmed=hasFlag(r,npc,'romance-route')||chosen(r,`relationship-${npc}-fork`,2);
  const early=npc==='yu'&&chosen(r,'first',2)||npc==='sol'&&chosen(r,'first-sol',2);
  const signals=Object.entries(affectionSignals[npc]).reduce((total,[flag,points])=>total+(hasFlag(r,npc,flag)?points:0),0);
  return (confirmed?4:0)+(early?1:0)+signals>=3;
}

export function romance(r:Rider,npc:StoryNpc,mutual:boolean,title?:string,item?:string):StoryImpact{
  return {...romanticAnswer(r,npc,mutual,title,item),romanceAttempt:true};
}

function romanticAnswer(r:Rider,npc:StoryNpc,mutual:boolean,title?:string,item?:string):StoryImpact{
  const current=activePartners(r);
  const already=current.includes(npc);
  const previous=storyProgress(r,npc);
  if(previous?.state==='ended'||formerPartners(r).includes(npc))
    return {dialogue:name(npc)+'는 지난 이야기를 다시 열기보다 서로 정해 둔 거리를 지키고 싶다고 답했다.'};
  if(!already&&r.extras?.relationships?.couples?.some(pair=>pair.includes(npc)))
    return {changes:[change(npc,undefined,'rejected')],dialogue:name(npc)+'는 지금 맺고 있는 약속을 소중하게 지키고 싶다고 말했다.'};
  if(!already&&(!mutual||!hasRomanticInterest(r,npc)))
    return {changes:[change(npc,previous?.state==='rival'?'rival':'friend','rejected')],dialogue:name(npc)+'는 마음을 전해 준 데 고마워하면서도 지금의 관계를 이어가고 싶다고 답했다.'};
  if(!already&&current.length&&(current.length>=2||r.events['crew-overlap']))
    return {changes:[change(npc,'friend','rejected')],dialogue:'두 사람은 이미 맺은 약속을 존중하며 친구로 남기로 했다.'};
  if(!already&&current.length)return {changes:[{...change(npc,'interested','overlap-requested'),pendingReward:{title,item}}],dialogue:'마음은 서로 같았다. 다만 교제를 시작하기 전에 기존 관계를 어떻게 이야기할지 정해야 한다.'};
  return {changes:[change(npc,'partner','mutual',already?undefined:'private')],title,item,dialogue:name(npc)+'도 같은 마음이라고 답했다. 두 사람은 앞으로의 약속을 함께 정했다.'};
}

export function applyStoryImpact(history:RelationshipHistory,impact:StoryImpact,inventory:string[],titles:ReadonlyMap<string,string>,details:string[]){
  for(const {npc,state,flag,mode,pendingReward} of impact.changes??[]){
    const progress=history.npcs[npc]??={state:'undecided',flags:[]};
    const add=(flag:string)=>{if(!progress.flags.includes(flag))progress.flags.push(flag);};
    if(state&&state!==progress.state){
      if(progress.state==='partner'&&state!=='partner'){
        add('former-partner');
        delete progress.mode;
      }
      progress.state=state;
      if(state!=='interested')delete progress.pendingReward;
      if(state==='partner')add('mutual');
    }
    if(flag)add(flag);
    if(pendingReward)progress.pendingReward=pendingReward;
    if(mode&&progress.state==='partner'&&(progress.mode!=='secret'||mode==='agreed'))progress.mode=mode;
  }
  if(impact.couple){
    const couples=history.couples??=[];
    if(!couples.some(pair=>pair.every(npc=>impact.couple!.includes(npc))))couples.push(impact.couple);
  }
  const earned=[impact.title,formerPartners({extras:{relationships:history,choices:{}}}).length>=3?'crew-exes':undefined];
  for(const id of earned)if(id&&titles.has(id)&&!history.titles.includes(id)){
    history.titles.push(id);
    details.push('칭호 획득 · '+titles.get(id));
  }
  const item=impact.item&&ITEM.get(impact.item);
  if(item&&!inventory.includes(item.id)){
    inventory.push(item.id);
    details.push('선물 획득 · '+item.name);
  }
}

const strained=new Set(['delegated','overreach','distance','fake-date','hurt-on-camera','lied','no-contact','jealous-press','rejected','rumor-distance']);
export function storyAffinity(impact:StoryImpact|undefined,npc:string){
  const update=impact?.changes?.find(change=>change.npc===npc);
  return update&&update.state!=='ended'&&!strained.has(update.flag??'')?8:0;
}
