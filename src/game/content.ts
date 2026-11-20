import { NPC_NAMES, type Discipline, type Look, type Rider, type RoutineStyle, type Spot, type Stats } from './types.js';

import { rooftopUnlocked } from './relationships.js';
import { seeded } from './random.js';

export type Rival = {
  id:keyof typeof NPC_NAMES; name:string; age:number; style:string; personality:string; line:string; stats:Stats; favorite:Discipline;
  color:string; look:Look; spots:Spot[]; signature:string; tactic:RoutineStyle; growth:Stats; mastery:number;
};
export const RIVALS: Rival[] = [
  {id:'yu',name:NPC_NAMES.yu,age:23,style:'댄싱',personality:'누구보다 먼저 손을 내밀며, 자기 댄싱을 세계 무대에서 보여주고 싶은 안무가',line:'“보드는 타는 게 아니라 춤추는 거야.”',
    stats:{speed:21,carve:27,link:23,balance:23},favorite:'dance',color:'#9765bd',look:{gender:'female',hair:10,hairColor:4,skin:1,shirt:4,pants:9,shoes:8,board:2,deckDesign:1,outfit:4,bottom:1,footwear:2,eyes:0},spots:['river','arena','rooftop'],signature:'pirouette',tactic:'flow',growth:{speed:7,carve:8.5,link:9,balance:6},mastery:8.2},
  {id:'jun',name:NPC_NAMES.jun,age:24,style:'트릭',personality:'실패 영상도 작품으로 만드는 트릭 선수. 기쁨과 질투 모두 얼굴에 드러난다',line:'“착지만 하면 다 계획대로였어.”',
    stats:{speed:19,carve:15,link:22,balance:28},favorite:'trick',color:'#bf6549',look:{gender:'male',hair:4,hairColor:8,skin:2,shirt:8,pants:2,shoes:8,board:0,deckDesign:2,outfit:0,bottom:0,footwear:1,eyes:0},spots:['plaza','night','rooftop'],signature:'hardflip',tactic:'score',growth:{speed:6,carve:5,link:7,balance:9},mastery:8.8},
  {id:'sol',name:NPC_NAMES.sol,age:28,style:'올라운더',personality:'가벼운 농담으로 분위기를 풀고, 끝까지 즐겁게 타고 싶은 올라운더',line:'“연습보다 커피가 먼저야. 진지하게.”',
    stats:{speed:25,carve:23,link:23,balance:25},favorite:'freestyle',color:'#208775',look:{gender:'male',hair:1,hairColor:6,skin:3,shirt:9,pants:8,shoes:4,board:1,deckDesign:3,outfit:2,bottom:1,footwear:0,eyes:3},spots:['park','studio','arena'],signature:'mango-pendulum',tactic:'flow',growth:{speed:8.2,carve:8.6,link:8.7,balance:8.4},mastery:8.3},
  {id:'min',name:NPC_NAMES.min,age:25,style:'안정형',personality:'완벽한 라인으로 이기고 싶은 선수. 걱정이 앞서면 계획부터 짠다',line:'“실전일수록 아는 걸 제대로.”',
    stats:{speed:19,carve:15,link:15,balance:16},favorite:'freestyle',color:'#5669b5',look:{gender:'male',hair:0,hairColor:4,skin:0,shirt:10,pants:9,shoes:8,board:1,deckDesign:0,outfit:1,bottom:0,footwear:2,eyes:0},spots:['park','arena'],signature:'cross',tactic:'stable',growth:{speed:8,carve:7,link:7,balance:9},mastery:9.2},
  {id:'ha',name:NPC_NAMES.ha,age:23,style:'스텝·카빙',personality:'기록으로 모든 라이벌을 이기려는 러닝 크루 출신. 말보다 먼저 장비를 챙긴다',line:'“말하려면 일단 한 바퀴 더!”',
    stats:{speed:17,carve:19,link:17,balance:18},favorite:'dance',color:'#b55c71',look:{gender:'female',hair:6,hairColor:1,skin:1,shirt:9,pants:9,shoes:5,board:3,deckDesign:3,outfit:1,bottom:3,footwear:1,eyes:0},spots:['river','park'],signature:'back-cross',tactic:'flow',growth:{speed:8.9,carve:9.2,link:7.4,balance:6.4},mastery:8.6},
  {id:'noa',name:NPC_NAMES.noa,age:22,style:'하이 리스크 트릭',personality:'아무도 성공하지 못한 트릭을 기록하고 싶은 야간 라이더. 가까워질수록 답을 기다리는 일이 어려워진다',line:'“실패 영상도 모으면 도감이 되겠지.”',
    stats:{speed:15,carve:14,link:16,balance:15},favorite:'trick',color:'#7254a7',look:{gender:'female',hair:9,hairColor:0,skin:2,shirt:11,pants:0,shoes:3,board:2,deckDesign:2,outfit:0,bottom:2,footwear:1,eyes:1},spots:['plaza','night','studio'],signature:'treflip',tactic:'score',growth:{speed:7,carve:6,link:8,balance:10},mastery:9.4},
];
export const RIVAL = new Map<string,Rival>(RIVALS.map(npc => [npc.id, npc]));
export function rivalCanJoinEvent(rider:Pick<Rider,'look'>,npc:string){
  const gender=RIVAL.get(npc)?.look.gender;
  return gender===undefined||gender!==(rider.look.gender??'male');
}

export const spotRegulars=(spot:Spot)=>RIVALS.filter(npc=>npc.spots.includes(spot));

export function spotVisitor(rider:Pick<Rider,'id'|'year'|'week'|'spot'>,spot=rider.spot){
  const rng=seeded(0,rider.id,rider.year,rider.week,spot,'visitor');
  const candidates=rng()<.8?spotRegulars(spot):RIVALS.filter(npc=>!npc.spots.includes(spot));
  return candidates[Math.floor(rng()*candidates.length)]!;
}

export const SPOT_GATE: Partial<Record<Spot,{hint:string; ready:(r:Rider)=>boolean}>> = {
  rooftop:{hint:'라이벌의 개인 에피소드 칭호 획득',ready:rooftopUnlocked},
  night:{hint:'명성 12 또는 노아의 초대',ready:r=>r.fame>=12||!!r.events['neon-invite']},
  arena:{hint:'2년차 또는 정규 대회 완주',ready:r=>r.year>=2||r.records.some(meet=>meet.results.length>0)},
};
export const spotUnlocked=(r:Rider, spot:Spot)=>SPOT_GATE[spot]?.ready(r) ?? true;

// Common techniques cross-checked against the supplied mini-game's public technique guide.
export const TECHNIQUE_REFERENCE='https://minilongboard.vercel.app/';
const descriptions: Record<string,string> = {
  'peter-pan':"앞쪽 중심을 잡고 양발을 데크 양옆으로 교차해 옮긴 뒤 주행 자세로 모으는 스텝입니다.",
  'step-180':"굴러가는 데크의 방향을 유지하며 양발을 차례로 옮겨 몸을 180도 돌립니다.",
  'step-360':"180 스텝에서 발을 다시 모아 회전을 이어 가며 몸을 한 바퀴 돌립니다.",
  cross:"두 발을 교대로 엇갈려 디디며 테일 쪽에서 노즈 쪽으로 이동하는 기본 스텝입니다.",
  'back-cross':'시선과 중심을 유지하며 뒷방향으로 교차 스텝을 밟습니다.',
  sidewinder:'카빙의 방향을 바꾸는 타이밍에 스텝과 회전을 연결합니다.',
  'v-spin':'스텝에서 체중을 옮기고 빠르게 회전해 자세를 바꿉니다.',
  ghost:"굴러가는 보드에서 내려 옆으로 함께 달린 뒤 데크 위로 다시 뛰어오릅니다.",
  'ghostride-kickflip':'고스트라이드 중 보드 옆에서 0.8초 넘게 달린 뒤, 데크를 킥플립시켜 양발로 받아 탑니다.',
  piglet:'보드 바깥에 발을 디디며 데크를 들어 옮기는 테크닉입니다.',
  mango:"피터팬처럼 발을 교차한 뒤 중심 다리를 굽히고, 반대발을 지면 바깥으로 크게 쓸며 낮은 홉으로 주행을 잇습니다.",
  wood:"앞발을 힐사이드에 고정하고 뒷다리를 테일 바깥 공중으로 뻗습니다. 다리를 회수하며 짧게 뛰어 두 발로 착지합니다.",
  pirouette:"앞발을 진행 방향으로 맞춘 뒤 데크 위의 축을 유지하며 몸을 360도 회전합니다.",
  p2p:'피글렛으로 데크를 들어 옮겨 다시 올라탄 뒤, 데크 위에서 피루엣으로 이어 몸을 360도 돌립니다.',
  'mango-pendulum':'시계추의 방향 전환을 망고 스텝과 연결해 낮게 뛰어 주행을 이어 갑니다.',
  'pirouette-540':'피루엣을 한 바퀴 반까지 이어 진입과 반대 방향으로 마칩니다.',
  pendulum:'데크가 왕복하듯 방향을 바꾸는 동안 몸의 중심을 옮깁니다.',
  'pirouette-720':'두 바퀴 회전이 끝날 때까지 데크 위에 중심을 유지합니다.',
  pivot:"앞발을 노즈, 뒷발을 데크 중앙에 둡니다. 노즈 쪽 바퀴를 축으로 보드를 180도 돌려 반대 자세로 이어 갑니다.",
  shuvit:"몸의 방향은 유지한 채 가볍게 뛰어 데크만 발밑에서 수평으로 180도 회전시킵니다.",
  'no-comply':"앞발을 지면에 지지하고 뒷발로 테일을 튕긴 뒤, 떠오른 데크에 다시 올라탑니다.",
  ollie:'테일에 팝을 줘 보드를 지면에서 띄우고, 앞발로 데크를 수평으로 만든 뒤 양발로 착지합니다.',
  kickflip:"테일을 팝해 뛰면서 발끝 쪽으로 데크를 한 바퀴 뒤집고 양발로 받아 착지합니다.",
  'no-com-big':"노컴플라이의 지지와 팝을 이용해 데크는 360도, 몸은 180도 회전하며 다시 올라탑니다.",
  bigspin:"데크는 수평으로 360도, 몸은 같은 방향으로 180도 돌아 데크를 받아 탑니다.",
  'front-pop':"테일을 튕겨 도약하며 팝샤빗과 반대 방향으로 데크만 180도 수평 회전시킵니다.",
  'pop-shuvit':"테일을 팝해 데크를 띄우고, 몸의 방향을 유지한 채 데크만 수평으로 180도 돌려 착지합니다.",
  heelflip:"테일을 튕긴 뒤 뒤꿈치 쪽으로 데크를 한 바퀴 뒤집습니다. 킥플립과 반대 방향의 플립입니다.",
  bigger:"몸은 180도 회전하고 데크는 수평으로 540도 돌립니다. 빅스핀보다 데크가 반 바퀴 더 회전합니다.",
  hardflip:"프론트 방향의 180도 보드 회전에 힐플립 방향의 360도 플립을 결합합니다. 프론팝을 연습하면 회전 감각을 익히는 데 도움이 됩니다.",
  treflip:'데크의 한 바퀴 수평 회전과 킥플립을 한 번에 수행합니다.',
  varial:"몸의 방향을 유지하며 데크의 180도 수평 회전과 한 바퀴 킥플립을 결합합니다. 팝샤빗을 연습하면 수평 회전 감각을 익히는 데 도움이 됩니다.",
};
export const skillDescription=(id:string)=>descriptions[id] ?? '';
// Keep historical journals readable with the current longboard terminology.
export const lineTerms=(text:string)=>text.replaceAll('루틴','라인');
export const affinityTerms=(text:string)=>text.replace(/^관계 (?=[+-]\d)/,'친밀도 ');
