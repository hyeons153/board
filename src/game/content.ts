import type { Discipline, Look, Rider, RoutineStyle, Spot, Stats } from './types';

export type Rival = {
  id:string; name:string; style:string; personality:string; line:string; stats:Stats; favorite:Discipline;
  color:string; look:Look; spots:Spot[]; signature:string; tactic:RoutineStyle; growth:Stats; mastery:number;
};
export const RIVALS: Rival[] = [
  {id:'yu',name:'한유리',style:'댄싱',personality:'스텝을 소리로 기억하는 낙천적인 안무가',line:'“보드는 타는 게 아니라 춤추는 거야.”',
    stats:{speed:21,carve:27,link:23,balance:23},favorite:'dance',color:'#9765bd',look:{hair:2,hairColor:2,skin:1,shirt:2,pants:0,shoes:1,board:2,deckDesign:1},spots:['river','arena'],signature:'pirouette',tactic:'flow',growth:{speed:7,carve:8.5,link:9,balance:6},mastery:8.2},
  {id:'jun',name:'강준',style:'트릭',personality:'넘어진 장면까지 영상으로 남기는 승부사',line:'“착지만 하면 다 계획대로였어.”',
    stats:{speed:19,carve:15,link:22,balance:28},favorite:'trick',color:'#bf6549',look:{hair:3,hairColor:1,skin:2,shirt:1,pants:1,shoes:2,board:0,deckDesign:2},spots:['plaza','night'],signature:'hardflip',tactic:'score',growth:{speed:6,carve:5,link:7,balance:9},mastery:8.8},
  {id:'sol',name:'윤솔',style:'올라운더',personality:'툭 던지는 조언이 정확한 스팟 선배',line:'“연습보다 커피가 먼저야. 진지하게.”',
    stats:{speed:25,carve:23,link:23,balance:25},favorite:'freestyle',color:'#208775',look:{hair:1,hairColor:0,skin:3,shirt:3,pants:2,shoes:1,board:1,deckDesign:3},spots:['park','studio','arena'],signature:'mango-pendulum',tactic:'flow',growth:{speed:8.2,carve:8.6,link:8.7,balance:8.4},mastery:8.3},
  {id:'min',name:'이민재',style:'안정형',personality:'보드 나사까지 체크리스트에 넣는 완벽주의자',line:'“실전일수록 아는 걸 제대로.”',
    stats:{speed:19,carve:15,link:15,balance:16},favorite:'freestyle',color:'#5669b5',look:{hair:0,hairColor:1,skin:0,shirt:2,pants:3,shoes:0,board:1,deckDesign:0},spots:['park','arena'],signature:'cross',tactic:'stable',growth:{speed:8,carve:7,link:7,balance:9},mastery:9.2},
  {id:'ha',name:'최하린',style:'스텝·카빙',personality:'템포를 재는 데 진심인 러닝 크루 출신',line:'“말하려면 일단 한 바퀴 더!”',
    stats:{speed:17,carve:19,link:17,balance:18},favorite:'dance',color:'#b55c71',look:{hair:2,hairColor:3,skin:1,shirt:1,pants:2,shoes:2,board:3,deckDesign:3},spots:['river','park'],signature:'back-cross',tactic:'flow',growth:{speed:8.9,carve:9.2,link:7.4,balance:6.4},mastery:8.6},
  {id:'noa',name:'정노아',style:'하이 리스크 트릭',personality:'새로운 플립에만 눈빛이 바뀌는 야행성 라이더',line:'“실패 영상도 모으면 도감이 되겠지.”',
    stats:{speed:15,carve:14,link:16,balance:15},favorite:'trick',color:'#7254a7',look:{hair:3,hairColor:2,skin:2,shirt:3,pants:0,shoes:3,board:2,deckDesign:2},spots:['plaza','night','studio'],signature:'treflip',tactic:'score',growth:{speed:7,carve:6,link:8,balance:10},mastery:9.4},
];
export const RIVAL = new Map(RIVALS.map(npc => [npc.id, npc]));
export const SPOT_GATE: Partial<Record<Spot,{hint:string; ready:(r:Rider)=>boolean}>> = {
  night:{hint:'명성 12 또는 노아의 초대',ready:r=>r.fame>=12||!!r.events['neon-invite']},
  arena:{hint:'2년차 또는 정규 대회 완주',ready:r=>r.year>=2||r.records.some(meet=>meet.results.length>0)},
};
export const spotUnlocked=(r:Rider, spot:Spot)=>SPOT_GATE[spot]?.ready(r) ?? true;

const descriptions: Record<string,string> = {
  'peter-pan':'보드 위에서 두 발을 교차하며 진행 방향을 바꿉니다.',
  'step-180':'발을 옮기며 몸을 반 바퀴 돌려 반대 자세로 이어 갑니다.',
  'step-360':'스텝과 함께 몸을 한 바퀴 돌려 처음 자세로 돌아옵니다.',
  cross:'앞발과 뒷발을 번갈아 교차하며 데크 위를 이동합니다.',
  'back-cross':'시선과 중심을 유지하며 뒷방향으로 교차 스텝을 밟습니다.',
  sidewinder:'카빙의 방향을 바꾸는 타이밍에 스텝과 회전을 연결합니다.',
  'v-spin':'스텝에서 체중을 옮기고 빠르게 회전해 자세를 바꿉니다.',
  ghost:'보드 옆으로 한 번 디뎠다가 굴러가는 데크로 돌아옵니다.',
  piglet:'보드 바깥에 발을 디디며 데크를 들어 옮기는 테크닉입니다.',
  mango:'보드에서 한 발을 떼고 데크를 돌려 다시 올라탑니다.',
  wood:'발을 지면에 디디며 데크를 크게 들어 올린 뒤 주행을 잇습니다.',
  pirouette:'움직이는 보드 위에서 한 발을 중심으로 몸을 한 바퀴 돌립니다.',
  'mango-pendulum':'망고에서 보드가 흔들리는 흐름을 이어 다시 붙잡습니다.',
  'pirouette-540':'피루엣을 한 바퀴 반까지 이어 진입과 반대 방향으로 마칩니다.',
  pendulum:'데크가 왕복하듯 방향을 바꾸는 동안 몸의 중심을 옮깁니다.',
  'pirouette-720':'두 바퀴 회전이 끝날 때까지 데크 위에 중심을 유지합니다.',
  pivot:'한쪽 트럭에 무게를 싣고 다른 쪽을 들어 방향을 바꿉니다.',
  shuvit:'발로 데크를 밀어 수평으로 반 바퀴 돌리고 다시 발을 얹습니다.',
  'no-comply':'앞발을 지면에 디디는 순간 뒷발로 보드를 튕겨 올립니다.',
  kickflip:'점프 중 앞발로 데크 모서리를 튕겨 길이축으로 뒤집습니다.',
  'no-com-big':'노컴플라이의 팝을 이용해 몸과 보드가 각기 회전합니다.',
  bigspin:'몸은 반 바퀴, 보드는 한 바퀴 돌아 같은 리듬으로 착지합니다.',
  'front-pop':'보드를 앞쪽으로 튕겨 올린 뒤 공중에서 중심을 맞춥니다.',
  'pop-shuvit':'테일을 튕겨 공중에서 보드를 수평으로 반 바퀴 돌립니다.',
  heelflip:'뒤꿈치로 데크를 밀어 킥플립과 반대 방향으로 뒤집습니다.',
  bigger:'빅스핀보다 데크를 더 오래 돌려 회전 타이밍을 맞춥니다.',
  hardflip:'앞쪽으로 도는 보드에 킥플립을 겹쳐 착지합니다.',
  treflip:'데크의 한 바퀴 수평 회전과 킥플립을 한 번에 수행합니다.',
  varial:'보드의 반 바퀴 수평 회전에 킥플립을 더합니다.',
};
export const skillDescription=(id:string)=>descriptions[id] ?? '';
