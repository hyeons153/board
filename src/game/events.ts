import { SKILL } from './data';
import { RIVAL } from './content';
import { extras } from './economy';
import { EXTRA_EVENTS } from './extraEvents';
import type { Family, Rider, Stat, Strategy } from './types';

type Effect = { energy?:number; money?:number; fame?:number; relation?:number; skill?:string; study?:number; stat?:Stat; gain?:number };
type Choice = { label:string; effect:Effect; tags:Strategy[] };
export type EventDef = { id:string; kind:string; title:string; body:string; npc?:string; story?:boolean; important?:boolean; repeat?:boolean; when:(r:Rider)=>boolean; choices:Choice[] };
const option=(label:string,effect:Effect,...tags:Strategy[]):Choice=>({label,effect,tags});
export const EVENTS:EventDef[] = [
  {id:'first',kind:'성장',title:'강바람의 첫인사',body:'유리가 네 보드에 붙은 가격표를 떼 주었다. “첫 연습이지? 넘어지면 강물 탓 하면 돼.”',npc:'yu',story:true,when:r=>r.year===1&&r.week===1,choices:[
    option('함께 스텝을 맞춰 본다',{skill:'mango',study:42,energy:-4,relation:8},'dance','freestyle'),
    option('균형 잡는 요령을 묻는다',{stat:'balance',gain:3,relation:4},'balanced','trick')]},
  {id:'juns-clip',kind:'기술 습득',title:'강준의 3초 영상',body:'준이 착지 장면만 슬로모션으로 반복한다. 화면 밖에서 들리는 비명은 못 들은 척해 주자.',npc:'jun',story:true,when:r=>r.week>=3&&r.spot==='plaza',choices:[
    option('프론트 팝의 자세를 따라 한다',{skill:'front-pop',study:100,energy:-7,relation:8},'trick','freestyle'),
    option('링크만 받아 저장한다',{relation:3,stat:'link',gain:2},'balanced','dance')]},
  {id:'registration',kind:'대회',title:'처음 받아 본 번호표',body:'첫 대회 접수처에서 담당자가 이름을 세 번 확인했다. 손이 떨리는 건 커피 때문일 거다.',npc:'sol',story:true,when:r=>r.year===1&&r.week===7,choices:[
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
    option('망고 한 바퀴를 익힌다',{skill:'mango',study:100,relation:6},'dance','freestyle'),
    option('찹더우드부터 배운다',{skill:'wood',study:100,relation:5},'balanced','trick')]},
  {id:'trophy-table',kind:'라이벌',title:'사진에는 트로피가 잘 나온다',body:'솔이 대회 사진을 넘기다 민망한 착지 장면에서 멈췄다. “우승할 때도 이런 표정인데.”',npc:'sol',story:true,when:r=>r.records.some(m=>m.results.some(x=>x.standings[0]?.id==='player')),choices:[
    option('다음에는 더 높은 점수를 노린다',{stat:'link',gain:4,fame:3,relation:5},'trick','freestyle'),
    option('같은 표정으로 기념사진을 찍는다',{fame:6,energy:10,relation:8},'balanced','dance')]},
  {id:'park-tea',kind:'관계',title:'공원 루프의 보급소',body:'솔이 보온병을 내밀었다. 생각했던 스포츠 음료 대신 생강차가 나왔다. 그런데 꽤 맛있다.',npc:'sol',repeat:true,when:r=>r.spot==='park',choices:[
    option('두 잔 마시고 잠깐 쉰다',{energy:17,relation:5},'balanced','dance'),
    option('한 바퀴 더 돌고 오기로 한다',{stat:'carve',gain:3,relation:4,energy:-6},'trick','freestyle')]},
  ...EXTRA_EVENTS,
];
export const EVENT = Object.fromEntries(EVENTS.map(e=>[e.id,e])) as Record<string,EventDef|undefined>;
export const canStudy=(r:Rider,id:string)=>SKILL[id]?.requires.every(pre=>(r.skills[pre]?.study??0)>=100)??false;
export const eventNpc=(e:EventDef,r?:Rider)=>e.npc==='mentor'?r?.mentor:e.npc?RIVAL.get(e.npc):undefined;
export const eventPaused=(r:Rider,e:EventDef)=>r.settings.mode==='manual'||!!(r.settings.pauseStory&&e.important);
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
        option('선배의 동작을 함께 연습한다',{relation:12,skill:mentor.skill,study:42,stat:'link',gain:2},'dance','trick','freestyle'),
        option('두 사람의 루틴을 찍어 둔다',{relation:9,energy:13},'balanced')]},
    {id:'mentor-cheer',kind:'다회차 · 대회 응원',npc:'mentor',title:'관객석의 첫 번째 박수',body:`${mentor.name}이 관객석 맨 앞에 서 있었다. “내 기록은 지난 시즌 얘기야. 오늘 네 기록은 네가 써.”`,
      story:true,when:r=>r.week>=25&&!!r.events['mentor-practice'],choices:[
        option('출발선에서 손을 흔든다',{relation:10,energy:12},'balanced','dance','freestyle'),
        option('마지막 동작을 약속한다',{relation:8,fame:4},'trick')]},
  ];
}
export const eventFor=(r:Rider,id:string)=>EVENT[id]??mentorEvents(r).find(e=>e.id===id);
export function pickEvent(r:Rider,rng:()=>number) {
  const choices=extras(r).choices;
  const eligible=[...EVENTS,...mentorEvents(r)].filter(e=>{
    const last=choices[e.id];
    const cooldown=last ? (r.year-last.year)*52+r.week-last.week : Infinity;
    return (!r.events[e.id]||(e.repeat&&cooldown>=8))&&e.when(r);
  });
  const story=eligible.find(e=>e.story);
  if(story) return story;
  const fresh=eligible.filter(e=>!r.events[e.id]);
  const pool=fresh.length?fresh:eligible;
  return pool.length&&rng()<.35 ? pool[Math.floor(rng()*pool.length)] : undefined;
}
export function autoChoice(r:Rider,e:EventDef) {
  if(r.energy<35 || r.injury) return e.choices.reduce((best,c,i)=> (c.effect.energy??0)>(e.choices[best].effect.energy??0)?i:best,0);
  const primary:Family|null = r.settings.strategy==='dance'||r.settings.strategy==='trick'?r.settings.strategy:null;
  const index=e.choices.findIndex(c=>c.tags.includes(r.settings.strategy) || (primary&&c.effect.skill&&SKILL[c.effect.skill]?.family===primary));
  return index<0?0:index;
}
