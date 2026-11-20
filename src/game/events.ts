import { calendarFor, RULES, SKILL } from './data.js';
import { RIVAL, rivalCanJoinEvent } from './content.js';
import { equipmentEvents as itemEvents, extras, freshExtras, gearBonuses } from './economy.js';
import { EXTRA_EVENTS } from './extraEvents.js';
import { RELATIONSHIP_EVENTS, relationshipChoiceAvailable, type RelationshipChoice } from './relationships.js';
import { STORY_ARCS } from './storyArcs.js';
import { CREW_STORIES } from './crewStories.js';
import { CAREER_STORIES } from './careerStories.js';
import { NPC_WORKSHOP_EVENTS } from './npcWorkshops.js';
import { elapsed, storyProgress, type StoryChange, type StoryImpact } from './storyState.js';
import { pickHappening, type Happening } from './happenings.js';
import type { Family, Rider, Settings, Stat, Strategy } from './types.js';

type Effect = { energy?:number; money?:number; fame?:number; relation?:number; skill?:string; study?:number; teach?:true; stat?:Stat; gain?:number; item?:string };
type Choice = { label:string; effect:Effect; tags:Strategy[]; dialogue?:string; relationship?:RelationshipChoice; story?:(r:Rider)=>StoryImpact };
export type EventDef = { id:string; kind:string; title:string; body:string|((r:Rider)=>string); npc?:string; cast?:(r:Rider)=>string[]; story?:boolean; chapter?:boolean; anyGender?:true; finale?:boolean; afterMeet?:boolean; important?:boolean; decision?:boolean; requiresChoice?:true; repeat?:boolean; special?:boolean; when:(r:Rider)=>boolean; choices:Choice[] };
const option=(label:string,effect:Effect,...tags:Strategy[]):Choice=>({label,effect,tags});
const crewGuide=(r:Rider)=>[rivalCanJoinEvent(r,'sol')?'sol':'yu'];
export const EVENTS:EventDef[] = [
  {id:'crew-sticker',kind:'장비 선물',npc:'sol',cast:crewGuide,title:'떼어도 남는 응원',body:'선배가 낡은 스티커를 건넸다. 접힌 귀퉁이마다 함께 탄 날의 흔적이 남아 있다.',story:true,when:r=>r.week>=8&&Math.max(0,...Object.values(r.relations))>=15,choices:[
    option('보드에 붙이고 한 바퀴 더 탄다',{item:'acc_021',relation:5},'dance','trick','freestyle'),option('연습 노트에 소중히 붙인다',{item:'acc_021',energy:8},'balanced')]},
  {id:'red-scarf',kind:'라이벌 선물',npc:'yu',title:'다음 바람에게',body:'유리가 빨간 머플러를 풀어 네게 건넨다. “이제 누군가에게 먼저 손을 흔들 차례야.”',story:true,important:true,when:r=>r.year>=4&&(r.relations.yu??0)>=35&&!!r.events['yu-film'],choices:[
    option('다음 라이더를 함께 맞이한다',{item:'acc_024',relation:8,fame:3},'balanced','dance'),option('우리의 다음 라인을 약속한다',{item:'acc_024',relation:8,stat:'link',gain:2},'trick','freestyle')]},
  {id:'duck-blessing',kind:'오리의 가호',npc:'sol',cast:crewGuide,title:'꽥, 하고 먼저 응원',body:'고무오리 키링이 흔들릴 때마다 동료들이 웃는다. 오늘의 코치는 말 대신 꽥을 고집한다.',repeat:true,special:true,when:r=>itemEvents(r).includes('duck-blessing'),choices:[option('오리 코치에게 인사한다',{energy:8,relation:3},'balanced','dance'),option('오리와 출발 박자를 맞춘다',{stat:'link',gain:2},'trick','freestyle')]},
  {id:'cactus-groove',kind:'선인장 잼',title:'박자가 조금 달라도',body:'내 스텝은 엇박인데 선인장은 당당하게 춤춘다. 누구도 음악을 끄지 않았다.',repeat:true,special:true,when:r=>itemEvents(r).includes('cactus-groove'),choices:[option('같이 스텝을 밟는다',{stat:'carve',gain:2,energy:4},'dance','freestyle'),option('작은 무대의 관객이 된다',{energy:10,fame:1},'balanced','trick')]},
  {id:'snail-day',kind:'느긋한 오후',title:'빠르지 않아도 한 바퀴',body:'달팽이는 한 바퀴를 다 돌 때까지 풍경을 놓치지 않았다. 오늘만큼은 기록계도 쉬어 간다.',repeat:true,special:true,when:r=>itemEvents(r).includes('snail-day'),choices:[option('달팽이 속도로 스팟을 돈다',{energy:10},'balanced','dance'),option('가장 좋아하는 코너를 알려 준다',{stat:'carve',gain:2},'trick','freestyle')]},
  {id:'scarf-epilogue',kind:'라이벌 후속 이야기',npc:'yu',title:'빨간 선을 따라',body:'새 라이더가 머플러를 보고 길을 물었다. 유리는 오늘은 네가 먼저 설명해 보라고 눈짓했다.',story:true,important:true,when:r=>r.year>=6&&itemEvents(r).includes('scarf-epilogue'),choices:[option('첫 발부터 함께 연습한다',{relation:10,fame:4},'dance','balanced'),option('서로 다른 라인을 하나로 잇는다',{relation:8,stat:'link',gain:3},'trick','freestyle')]},
  {id:'first',kind:'성장',title:'강바람의 첫인사',body:'유리가 네 보드에 붙은 가격표를 떼 주었다. “첫 연습이지? 넘어지면 강물 탓 하면 돼.”',npc:'yu',story:true,when:r=>r.year===1,choices:[
    option('함께 스텝을 맞춰 본다',{skill:'mango',study:42,energy:-4,relation:8},'dance','freestyle'),
    option('균형 잡는 요령을 묻는다',{stat:'balance',gain:3,relation:4},'balanced','trick'),
    option('다음에도 만나 줄래?',{relation:6})]},
  {id:'first-sol',kind:'성장',title:'첫 푸시와 식어 가는 커피',body:'솔이 난간에 커피를 내려놓았다. “첫날엔 멀리 갈 필요 없어. 저 가로등까지만 같이 가 볼래?”',npc:'sol',story:true,when:r=>r.year===1&&!r.events.first,choices:[
    option('솔의 발 위치를 따라 해 본다',{skill:'mango',study:42,energy:-4,relation:8},'dance','freestyle'),
    option('첫 푸시에서 균형 잡는 법부터 묻는다',{stat:'balance',gain:3,relation:4},'balanced','trick'),
    option('가로등까지 탄 뒤 커피도 마시자고 한다',{relation:6})]},
  {id:'juns-clip',kind:'기술 습득',title:'강준의 3초 영상',body:'준이 착지 장면만 슬로모션으로 반복한다. 화면 밖에서 들리는 비명은 못 들은 척해 주자.',npc:'jun',story:true,when:r=>r.week>=3&&r.spot==='plaza',choices:[
    option('프론팝의 자세를 따라 한다',{skill:'front-pop',teach:true,energy:-7,relation:8},'trick','freestyle'),
    option('링크만 받아 저장한다',{relation:3,stat:'link',gain:2},'balanced','dance')]},
  {id:'registration',kind:'대회',title:'처음 받아 본 번호표',body:'첫 대회 번호표를 쥐니 접수처에서 이름을 세 번 확인하던 일이 떠오른다. 손이 떨리는 건 커피 때문일 거다.',npc:'sol',story:true,when:r=>r.year===1&&r.week>=7,choices:[
    option('솔과 스트레칭을 한다',{energy:14,relation:4},'balanced','dance','freestyle'),
    option('번호표 사진을 올린다',{fame:4,relation:1},'trick')]},
  {id:'overtime',kind:'일상',title:'부장님의 금요일',body:'퇴근 5분 전, “잠깐 회의하자”는 메시지가 왔다. 스팟 단톡에는 벌써 여섯 명이 모였다.',repeat:true,when:r=>r.week>1,choices:[
    option('정시에 나가 스팟으로 간다',{stat:'speed',gain:2,energy:-5},'dance','trick','freestyle'),
    option('야근 수당으로 치료비를 모은다',{money:22_000,energy:-3},'balanced')]},
  {id:'lost-wheel',kind:'일상',title:'굴러간 바퀴의 행방',body:'주머니 속 스페어 휠이 강변 경사로를 따라 달아났다. 산책하던 강아지는 이 상황이 마음에 든 모양이다.',when:r=>r.spot==='river',choices:[
    option('강아지와 함께 달린다',{stat:'speed',gain:3,energy:-8},'trick','dance'),
    option('간식으로 조용히 협상한다',{energy:8,money:-3_000},'balanced','freestyle')]},
  {id:'studio-rain',kind:'관계',title:'지붕 아래 약속',body:'소나기가 쏟아지자 솔이 실내 연습장의 열쇠를 빙글 돌렸다. “이번 한 번은 내가 쏠게.”',npc:'sol',when:r=>r.spot==='studio',choices:[
    option('전환 동작을 같이 찍는다',{stat:'link',gain:3,relation:7,energy:-4},'freestyle','trick'),
    option('따뜻한 커피를 건넨다',{energy:13,relation:9,money:-4_000},'balanced','dance')]},
  {id:'night-jam',kind:'라이벌',title:'막차 전 한 판',body:'준이 내기를 걸었다. 심판은 편의점 앞 고양이다. 아무리 봐도 잠들어 있다.',npc:'jun',when:r=>r.spot==='plaza'&&r.energy>=28,choices:[
    option('세 번 안에 착지해 본다',{stat:'balance',gain:3,money:8_000,energy:-9,relation:5},'trick','freestyle'),
    option('심판 옆에서 야식을 먹는다',{energy:16,relation:3},'balanced','dance')]},
  {id:'mango-lesson',kind:'기술 습득',title:'망고는 과일이 아니야',body:'유리는 네가 챙겨 온 음료를 보고 웃었다. “그 망고도 좋아. 이쪽 망고도 배워 볼래?”',npc:'yu',story:true,important:true,when:r=>(r.relations.yu??0)>=8&&r.week>=11,choices:[
    option('망고 한 바퀴를 익힌다',{skill:'mango',teach:true,relation:6},'dance','freestyle'),
    option('찹더우드부터 배운다',{skill:'wood',teach:true,relation:5},'balanced','trick')]},
  {id:'trophy-table',kind:'라이벌',title:'사진에는 트로피가 잘 나온다',body:'솔이 대회 사진을 넘기다 민망한 착지 장면에서 멈췄다. “우승할 때도 이런 표정인데.”',npc:'sol',story:true,when:r=>r.records.some(m=>m.results.some(x=>x.standings[0]?.id==='player')),choices:[
    option('다음에는 더 높은 점수를 노린다',{stat:'link',gain:4,fame:3,relation:5},'trick','freestyle'),
    option('같은 표정으로 기념사진을 찍는다',{fame:6,energy:10,relation:8},'balanced','dance')]},
  {id:'park-tea',kind:'관계',title:'공원 루프의 보급소',body:'솔이 보온병을 내밀었다. 생각했던 스포츠 음료 대신 생강차가 나왔다. 그런데 꽤 맛있다.',npc:'sol',repeat:true,when:r=>r.spot==='park',choices:[
    option('두 잔 마시고 잠깐 쉰다',{energy:17,relation:5},'balanced','dance'),
    option('한 바퀴 더 돌고 오기로 한다',{stat:'carve',gain:3,relation:4,energy:-6},'trick','freestyle')]},
  ...EXTRA_EVENTS,
  ...RELATIONSHIP_EVENTS,
  ...STORY_ARCS,
  ...CREW_STORIES,
  ...CAREER_STORIES,
  ...NPC_WORKSHOP_EVENTS,
  {id:'crew-neon-warmup',kind:'스팟 이야기',title:'불이 켜지는 순서',npc:'noa',special:true,
    body:'네온 팔찌가 먼저 반짝였다. 노아는 점등이 끝날 때까지 오늘 연습할 동작을 같이 골랐다.',
    when:r=>r.spot==='night'&&itemEvents(r).includes('crew-neon-warmup'),
    choices:[option('조명이 켜질 때까지 몸을 푼다',{energy:5},'balanced'),option('조명이 닿는 경계에서 스텝을 밟는다',{relation:2},'dance','freestyle'),option('착지 위치를 먼저 확인한다',{relation:2},'trick')]},
];
export const EVENT = Object.fromEntries(EVENTS.map(e=>[e.id,e])) as Record<string,EventDef|undefined>;
export const eventNpc=(e:EventDef,r?:Rider)=>{
  const id=r?eventCast(r,e)[0]:e.npc;
  return id==='mentor'?r?.mentor:id?RIVAL.get(id):undefined;
};
export const skipsEventChoices=(settings:Settings)=>settings.skipEvents??!settings.manualEvents;
export function eventPaused(r:Rider){
  if(r.settings.mode==='manual'||!skipsEventChoices(r.settings))return true;
  const event=eventFor(r,r.event??'');
  if(!event)return false;
  if(event.requiresChoice)return true;
  if(!event.decision)return false;
  const choices=event.choices.flatMap((choice,index)=>eventChoiceAvailable(r,event,index)?[{choice,impact:choice.story?.(r)}]:[]);
  const turningPoint=choices.some(({choice,impact})=>{
    if(impact?.romanceAttempt)return true;
    const changes=[...(impact?.changes??[])];
    if(event.npc&&choice.relationship?.state)changes.push({npc:event.npc,state:choice.relationship.state});
    return changes.some(({npc,state})=>{
      const previous=storyProgress(r,npc)?.state;
      return previous!=='ended'&&(state==='ended'||state==='partner'&&previous!=='partner'||previous==='partner'&&!!state&&state!=='partner');
    });
  });
  return turningPoint||!choices.some(({choice,impact})=>keepsRelationship(r,event,choice,impact));
}
export const eventBody=(r:Rider,e:EventDef)=>typeof e.body==='string'?e.body:e.body(r);
export const eventCast=(r:Rider,e:EventDef)=>[...new Set(e.cast?.(r)??(e.npc?[e.npc]:[]))];
export const eventChoiceAvailable=(r:Rider,e:EventDef,index:number)=>
  relationshipChoiceAvailable(r,e.npc,e.choices[index]?.relationship?.state);
function mentorEvents(r:Rider):EventDef[]{
  const mentor=r.mentor;
  if(!mentor) return [];
  return [
    {id:'mentor-intro',kind:'다회차 · 선배',npc:'mentor',title:'한 번 더, 강변에서',body:`${mentor.name}이 지난 커리어 때 타던 보드를 들고 왔다. “처음 푸시가 제일 어렵더라. 오늘은 내가 옆에 있을게.”`,
      story:true,when:r=>r.week>=3,choices:[
        option('같은 길을 한 바퀴 돈다',{relation:8,stat:'carve',gain:2},'dance','freestyle'),
        option('지난 시즌의 이야기를 듣는다',{relation:6,energy:11},'balanced','trick')]},
    {id:'mentor-practice',kind:'다회차 · 합동 훈련',npc:'mentor',title:'보드 위에 남은 습관',body:`${mentor.name}이 ${SKILL[mentor.skill??'']?.name??'첫 발 위치'}를 시범으로 보여 주었다. “이 동작을 처음 성공한 날은 아직도 기억나.”`,
      story:true,important:true,when:r=>r.week>=15&&!!r.events['mentor-intro'],choices:[
        option('선배에게 동작을 배운다',{relation:12,skill:mentor.skill,teach:true,stat:'link',gain:2},'dance','trick','freestyle'),
        option('두 사람의 라인을 찍어 둔다',{relation:9,energy:13},'balanced')]},
    {id:'mentor-cheer',kind:'다회차 · 대회 응원',npc:'mentor',title:'관객석의 첫 번째 박수',body:`${mentor.name}이 관객석 맨 앞에 서 있었다. “내 기록은 지난 시즌 얘기야. 오늘 네 기록은 네가 써.”`,
      story:true,when:r=>r.week>=25&&!!r.events['mentor-practice'],choices:[
        option('출발선에서 손을 흔든다',{relation:10,energy:12},'balanced','dance','freestyle'),
        option('마지막 동작을 약속한다',{relation:8,fame:4},'trick')]},
  ];
}
export const eventFor=(r:Rider,id:string)=>EVENT[id]??mentorEvents(r).find(e=>e.id===id);
export function pickEvent(r:Rider,rng:()=>number,afterMeet=false):EventDef|Happening|undefined {
  const choices=extras(r).choices;
  const meetWeek=calendarFor(r.year).some(meet=>meet.week===r.week);
  const eligible=[...EVENTS,...mentorEvents(r)].filter(e=>{
    const last=choices[e.id];
    const cooldown=last ? (r.year-last.year)*RULES.weeks+r.week-last.week : Infinity;
    return (afterMeet?e.afterMeet:!e.afterMeet||!meetWeek)&&(!r.events[e.id]||(e.repeat&&cooldown>=8))&&e.when(r)&&
      (e.chapter||e.anyGender||eventCast(r,e).every(npc=>rivalCanJoinEvent(r,npc)));
  });
  const stories=eligible.filter(e=>e.story);
  if(stories.length){
    const progress=r.extras??=freshExtras();
    const ready=progress.storyReadyAt??={};
    const now=(r.year-1)*RULES.weeks+r.week;
    for(const story of stories)ready[story.id]??=now;
    const recent=progress.lastEvent?.npc;
    const lastChapter=progress.relationships?.story?.findLast(entry=>entry.choice!==undefined);
    const gap=lastChapter?elapsed(r,lastChapter.id):Infinity;
    const finale=stories.find(story=>story.finale&&r.year===RULES.years&&r.week>=50);
    if(finale)return finale;
    const available=stories.filter(story=>!story.chapter||gap>=3||r.year===RULES.years&&r.week>=47);
    if(available.length)return available.sort((a,b)=>ready[a.id]!-ready[b.id]!||Number(!!recent&&eventCast(r,a)[0]===recent)-Number(!!recent&&eventCast(r,b)[0]===recent))[0];
  }
  const happening=pickHappening(r,afterMeet);
  if(happening)return happening;
  const casual=eligible.filter(event=>!event.story);
  const fresh=casual.filter(e=>!r.events[e.id]);
  const recentCasual=Object.keys(choices).some(id=>EVENT[id]&&!EVENT[id]?.story&&elapsed(r,id)<21);
  const pool=fresh.length?fresh:recentCasual?[]:casual;
  const effects=gearBonuses(r);
  if(!pool.length||rng()>=.35+effects.eventChance)return;
  const weights=pool.map(event=>event.special||event.kind==='스팟'?1+effects.specialWeight:1);
  let roll=rng()*weights.reduce((sum,weight)=>sum+weight,0);
  return pool.find((_,index)=>(roll-=weights[index])<0)??pool.at(-1);
}
function keepsRelationship(r:Rider,e:EventDef,choice:Choice,impact:StoryImpact|undefined){
  if(impact?.romanceAttempt)return false;
  const changes:StoryChange[]=[...(impact?.changes??[])];
  if(e.npc&&choice.relationship?.state)changes.push({npc:e.npc,state:choice.relationship.state});
  return changes.every(({npc,state,mode})=>{
    const current=storyProgress(r,npc);
    if(mode&&mode!==(current?.mode??'private'))return false;
    if(!state||state===current?.state)return true;
    return current?.state!=='partner'&&current?.state!=='ended'&&state!=='partner'&&state!=='interested'&&state!=='ended';
  });
}
export function autoChoice(r:Rider,e:EventDef) {
  const available=e.choices.map((choice,index)=>({choice,index})).filter(({index})=>eventChoiceAvailable(r,e,index));
  const unchanged=e.decision?available.filter(({choice})=>keepsRelationship(r,e,choice,choice.story?.(r))):[];
  const options=unchanged.length?unchanged:available;
  if(!options.length)return -1;
  if(r.energy<35||r.injury)return options.reduce((best,item)=>(item.choice.effect.energy??0)>(best.choice.effect.energy??0)?item:best).index;
  const primary:Family|null = r.settings.strategy==='dance'||r.settings.strategy==='trick'?r.settings.strategy:null;
  return (options.find(({choice})=>choice.tags.includes(r.settings.strategy)||
    (primary&&choice.effect.skill&&SKILL[choice.effect.skill]?.family===primary))??options[0]).index;
}
