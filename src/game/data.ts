import type { Family, Meet, Skill, Spot, Action, Stats, Discipline, Division, RoutineStyle, Strategy, Look, Progress } from './types.js';

export const RULES = {
  weekMs:2_000, weeks:52, years:8, runSeconds:60, transition:1, recovery:2.5,
  statCap:200, statHeadroom:136, startStats:{ speed:18, carve:16, link:14, balance:20 } satisfies Stats,
  startMoney:120_000, weeklyAllowance:3_000, hospitalFee:32_000, safetyFund:15_000,
  statGrowth:2.8, secondaryGrowth:0.7, study:37, mastery:13, restEnergy:41,
  energy: { speed:17, carve:17, link:17, balance:15, dance:19, trick:23, rest:0, hospital:0, rehearsal:18 } satisfies Record<Action,number>,
  entryCost:{ dance:20, trick:25, freestyle:30 }, places:[100,75,60,45,35,10], majorMultiplier:1.5,
  prizes:[80_000,55_000,40_000,25_000,18_000,10_000],
  podiumGrowth:[[1,.5],[.7,.3],[.4,.2]],
  scoreWeights: {
    dance:{ execution:40, link:25, carve:20, speed:15 },
    trick:{ execution:75, link:10, combo:15 },
    freestyle:{ execution:55, combo:25, carve:12, speed:8 },
  },
  executionTarget:{ dance:48, trick:51, freestyle:53 },
  success:{ base:.48, mastery:.0048, balance:.0017, energy:.0016, difficulty:.075, min:.07, max:.97 },
  injury:{ base:.024, energy:.0008, difficulty:.017, stability:.00055, minorWeeks:2, majorWeeks:4 },
  practice:{ discovery:.72, difficultyCost:.34, masteryByDifficulty:[1.25,1,.8,.65], targeted:1.17, rehearsalMastery:5, rehearsalLink:1.6, lowEnergy:30, missChance:.24, greatChance:.17 },
  run:{ repeatFloor:.19, repeatPenalty:.29, danceAffinity:.14, mixedAffinity:.09, trickChainSuccess:.055, trickChainLink:.12, masteryLink:.00065 },
  npc:{ initialPractice:1, growthPace:1.85, unlockPace:1.36, specialist:12, allRounder:6, offDiscipline:-5, energy:91, veteranEnergy:99 },
  growth:[
    {stat:1.08,study:1.04,mastery:1},{stat:1,study:1,mastery:1},
    {stat:.91,study:.97,mastery:.98},{stat:.83,study:.93,mastery:.95},
    {stat:.74,study:.90,mastery:.91},{stat:.66,study:.87,mastery:.87},
    {stat:.59,study:.84,mastery:.83},{stat:.54,study:.82,mastery:.80},
  ],
} as const;

export const AUTO_FLOW={choiceMs:1000,resultMs:2000,ceremonyMs:2000,entryMs:5000,exitMs:3000} as const;

export const STAT_NAMES = { speed:'속도', carve:'카빙', link:'연계', balance:'밸런스' };
export const DISCIPLINE_NAMES: Record<Discipline,string> = { dance:'댄싱', trick:'트릭', freestyle:'프리스타일' };
export const DIVISION_NAMES: Record<Division,string> = { rookie:'뉴비부', regular:'일반부', open:'오픈부', master:'마스터부' };
export const STRATEGY_NAMES: Record<Strategy,string> = { balanced:'밸런스형', dance:'댄싱 중심', trick:'트릭 중심', freestyle:'프리스타일 중심' };
export const STRATEGY_DETAILS:Record<Strategy,string> = {
  balanced:'네 능력치 중 부족한 쪽을 보완합니다. 기술 연마보다 기본 능력치 훈련을 더 자주 선택합니다.',
  dance:'댄싱 기술 연마를 우선하고 카빙·연계·속도를 중점적으로 보완합니다.',
  trick:'트릭 기술 연마를 우선하고 밸런스·연계를 중점적으로 보완합니다.',
  freestyle:'댄싱·트릭 기술을 함께 연마하고 연계·카빙·밸런스를 우선 보완합니다. 밸런스형보다 기술 연마를 더 자주 선택합니다.',
};
export const STYLE_NAMES: Record<RoutineStyle,string> = { stable:'안정형', flow:'연계형', score:'고득점형' };
export const ACTION_NAMES: Record<Action,string> = { speed:'속도 훈련', carve:'카빙 훈련', link:'연계 훈련', balance:'밸런스 훈련', dance:'댄싱 연마', trick:'트릭 연마', rest:'휴식', hospital:'병원 치료', rehearsal:'라인 리허설' };
export const ACTION_STORIES:Record<Action,{start:string;title:string;done:string}>={
  speed:{start:'보드를 힘껏 밀어 보자.',title:'속도를 내며 달렸다',done:'발끝에 힘을 싣고 보드를 길게 밀었다.'},
  carve:{start:'몸을 기울여 코너를 돌아 보자.',title:'카빙 감각을 익혔다',done:'보드가 그리는 곡선을 따라 체중을 옮겼다.'},
  link:{start:'동작을 하나로 이어 보자.',title:'동작을 하나로 이었다',done:'다음 동작이 자연스럽게 나올 때까지 반복했다.'},
  balance:{start:'흔들려도 중심을 잡아 보자.',title:'보드 위에서 중심을 잡았다',done:'보드가 흔들릴 때마다 발의 위치를 조금씩 바꿨다.'},
  dance:{start:'보드 위에서 스텝을 맞춰 보자.',title:'댄싱 연습에 몰두했다',done:'스텝을 반복하다 보니 리듬이 발에 익었다.'},
  trick:{start:'이번엔 착지까지 해 보자.',title:'트릭 연습에 집중했다',done:'몇 번을 넘어져도 보드를 주워 다시 시도했다.'},
  rest:{start:'이번 주는 푹 쉬자.',title:'휴식을 완료했다',done:'보드를 내려놓고 한 주 쉬어 갔다.'},
  hospital:{start:'병원에 들러 치료를 받자.',title:'병원에서 치료를 받았다',done:'치료를 받고 몸을 추슬렀다.'},
  rehearsal:{start:'경기처럼 라인을 달려 보자.',title:'실전처럼 라인을 달렸다',done:'처음부터 끝까지 라인을 맞춰 봤다.'},
};
export const OUTCOME_NAMES = { miss:'실패', rough:'어설픈 성공', clean:'성공', great:'대성공' };
export const KIND_NAMES = { step:'스텝', technique:'테크닉', spin:'회전', pop:'팝', flip:'플립' };
export const DIFFICULTY_NAMES = ['','초급','중급','고급','최고급'];
export const SKINS = ['#e8a877','#f2c59e','#bc825b','#85543d','#f7dcc4','#603f34'];
export const SHIRTS = ['#cafd67','#f88966','#9f9cf5','#54d3cb','#faf4df','#303749','#ed9bc0','#83b8ed','#376b72','#425b46','#a44e3b','#574569','#333e64'];
export const BOARDS = ['#fab66c','#d5faf1','#bc91ec','#f47a87','#232833','#f6f4e9','#82b9ed','#94d79e'];
export const BOARD_COLOR_NAMES = ['살구','민트','라벤더','코랄','검정','흰색','하늘','연두'];
export const HAIR_COLORS = ['#252437','#99513d','#b187c8','#a9c662','#60452f','#e6c983','#eee9dc','#df97ae','#ed814c','#b8c5e0'];
export const PANTS = ['#574b74','#2b5478','#2f7064','#8d5a55','#262d3c','#e7dfcd','#86a8cf','#cc9caf','#4c5b47','#39333e'];
export const SHOES = ['#fff2db','#9aeddc','#fcb58d','#d2c9ff','#2c3342','#f4f4ee','#ed91ae','#8fbced','#956348','#503943'];
export const EYE_COLORS = ['#68443a','#5a467d','#3e5f89','#596747','#34303e','#a36264'];
export const HAIR_STYLES = ['숏컷','사이드 파트','긴 생머리','캡','스파이크','내추럴 웨이브','트윈테일','단발','묶음머리 · 번','사이드 포니테일','하이 포니테일','롱 웨이브','댄디 슬릭'];
export const OUTFITS = ['오버핏 후디','바시티 재킷','집업 재킷','워크 재킷','크롭 후디','세일러 재킷','루즈핏 니트'];
export const BOTTOMS = ['카고 팬츠','조거 팬츠','반바지','플리츠 스커트'];
export const FOOTWEAR = ['스니커즈','하이탑','워커'];
export const DEFAULT_LOOK:Look = {hair:0,hairColor:4,skin:1,shirt:10,pants:9,shoes:8,board:4,gender:'male',outfit:2,bottom:0,footwear:2,eyes:0};

// Presets only change appearance. Every part remains available to either gender.
export const LOOK_PRESETS:Record<'male'|'female',Look[]> = {
  male:[DEFAULT_LOOK,
    {...DEFAULT_LOOK,hair:12,hairColor:5,shirt:11,pants:0,shoes:3,outfit:1,footwear:0,eyes:0},
    {...DEFAULT_LOOK,hair:4,hairColor:8,shirt:8,pants:2,shoes:2,outfit:0,footwear:1},
    {...DEFAULT_LOOK,hair:5,hairColor:0,shirt:5,pants:9,shoes:3,outfit:0,footwear:0,eyes:0},
    {...DEFAULT_LOOK,hair:1,hairColor:6,shirt:9,pants:9,shoes:1,outfit:3,footwear:1}],
  female:[
    {...DEFAULT_LOOK,gender:'female',hair:7,hairColor:4,shirt:10,pants:9,outfit:2,bottom:0},
    {...DEFAULT_LOOK,gender:'female',hair:10,hairColor:4,shirt:4,pants:9,outfit:4,bottom:1},
    {...DEFAULT_LOOK,gender:'female',hair:6,hairColor:1,shirt:9,pants:9,shoes:5,outfit:1,bottom:3,footwear:0},
    {...DEFAULT_LOOK,gender:'female',hair:2,hairColor:0,shirt:11,pants:5,shoes:3,outfit:0,bottom:3,footwear:0},
    {...DEFAULT_LOOK,gender:'female',hair:11,hairColor:5,shirt:9,pants:9,shoes:1,outfit:1,bottom:2,footwear:1}],
};

export const LOCATIONS = {
  river:{ name:'강변 스팟', en:'RIVERSIDE BANK', detail:'탁 트인 바람과 길게 뻗은 산책로.', boosted:['dance','speed'], boost:1.24, risk:.93 },
  plaza:{ name:'도심 광장', en:'DOWNTOWN PLAZA', detail:'매끄러운 바닥과 내리쬐는 네온.', boosted:['trick','link'], boost:1.25, risk:1.18 },
  park:{ name:'공원 루프', en:'PARK LOOP', detail:'숲을 따라 굽이치는 완만한 코스.', boosted:['carve','balance'], boost:1.26, risk:.82 },
  studio:{ name:'실내 연습장', en:'INDOOR STUDIO', detail:'날씨 걱정 없이 지정 기술을 연습하는 곳.', boosted:['dance','trick'], boost:1.15, risk:.7 },
  night:{ name:'야간 광장', en:'NEON PLAZA', detail:'늦은 밤 조명 아래 고급 댄싱과 트릭을 연습하는 곳.', boosted:['dance','trick'], boost:1.35, risk:1.18 },
  arena:{ name:'대회 연습장', en:'WARM-UP ARENA', detail:'대회 바닥에서 기술 사이의 연계를 집중적으로 점검해요.', boosted:['link'], boost:1.25, risk:.82 },
  rooftop:{ name:'노을 옥상', en:'SUNSET ROOFTOP', detail:'크루가 번갈아 라인을 타는 도심 옥상. 해 질 녘 발소리가 멀리 퍼져요.', boosted:['dance','trick'], boost:1.15, risk:.9 },
} satisfies Record<Spot,{name:string; en:string; detail:string; boosted:Action[]; boost:number; risk:number}>;

export const CALENDAR:Meet[] = [
  {id:'regular-1',month:2,week:7,name:'정기 대회 1차',major:false,spot:'river'},
  {id:'regular-2',month:5,week:20,name:'정기 대회 2차',major:false,spot:'plaza'},
  {id:'major-1',month:6,week:25,name:'롱보드 대회',major:true,spot:'studio'},
  {id:'regular-3',month:8,week:33,name:'정기 대회 3차',major:false,spot:'park'},
  {id:'regular-4',month:11,week:46,name:'정기 대회 4차',major:false,spot:'plaza'},
  {id:'festival',month:12,week:52,name:'롱보드 페스티벌',major:true,spot:'river'},
];

// Keep the original festival ID readable for existing competition records.
export const INTERNATIONAL_MEETS:Meet[] = [
  {id:'international-2',month:12,week:52,name:'롱보드 국제대회 · 서울',major:true,spot:'river',international:true,host:'대한민국 · 서울'},
  {id:'international-4',month:12,week:52,name:'롱보드 국제대회 · 도쿄',major:true,spot:'plaza',international:true,host:'일본 · 도쿄'},
  {id:'international-6',month:12,week:52,name:'롱보드 국제대회 · 바르셀로나',major:true,spot:'park',international:true,host:'스페인 · 바르셀로나'},
  {id:'international-8',month:12,week:52,name:'롱보드 국제대회 · 로스앤젤레스',major:true,spot:'arena',international:true,host:'미국 · 로스앤젤레스'},
];
export const calendarFor=(year:number):Meet[]=>{
  const international=INTERNATIONAL_MEETS.find(meet=>meet.id==='international-'+year);
  return international?CALENDAR.map(meet=>meet.id==='festival'?international:meet):CALENDAR;
};
export const meetById=(id:string|undefined)=>CALENDAR.find(meet=>meet.id===id)??INTERNATIONAL_MEETS.find(meet=>meet.id===id);

const WEEK_LABELS=['첫째 주','둘째 주','셋째 주','넷째 주','다섯째 주'];
export function monthWeek(week:number){
  // Each 13-week quarter has months of four, four and five weeks.
  const weekInQuarter=(week-1)%13;
  const monthInQuarter=Math.min(2,Math.floor(weekInQuarter/4));
  const month=Math.floor((week-1)/13)*3+monthInQuarter+1;
  return {month,weekLabel:WEEK_LABELS[weekInQuarter-monthInQuarter*4]};
}
export function formatMonthWeek(week:number){
  const {month,weekLabel}=monthWeek(week);
  return `${month}월 ${weekLabel}`;
}
export function formatCareerDate({year,week}:{year:number;week:number}){
  return `${year}년차 · ${formatMonthWeek(week)}`;
}

const skill = (id:string,name:string,family:Family,kind:Skill['kind'],difficulty:number,points:number,seconds:number,requires:string[]=[],tags:string[]=[]):Skill =>
  ({id,name,family,kind,difficulty,points,seconds,requires,risk:[0,.07,.12,.18,.23][difficulty],tags});
export const SKILLS:Skill[] = [
  skill('peter-pan','피터팬','dance','step',1,6,5,[],['switch','flow']),
  skill('step-180','180','dance','step',1,6,4,[],['switch','spin']),
  skill('step-360','360','dance','step',1,7,5,['step-180'],['spin','flow']),
  skill('cross','크로스스텝','dance','step',1,6,5,[],['flow']),
  skill('back-cross','백워드 크로스스텝','dance','step',2,9,6,['cross'],['switch','flow']),
  skill('sidewinder','사이드와인더','dance','step',1,10,5,[],['flow','spin']),
  skill('v-spin','브이스핀','dance','step',3,13,6,['peter-pan','sidewinder','step-360'],['spin','switch']),
  skill('ghost','고스트라이드','dance','technique',1,7,5,[],['pop','flow']),
  skill('ghostride-kickflip','고스트라이드 킥플립','dance','technique',2,11,6,['ghost'],['flow','flip']),
  skill('piglet','피글렛','dance','technique',1,7,5,[],['pop','switch']),
  skill('mango','망고','dance','technique',1,7,5,[],['flow','switch']),
  skill('wood','찹더우드','dance','technique',1,8,5,[],['pop','flow']),
  skill('pirouette','피루엣','dance','technique',2,10,5,['piglet'],['spin','flow']),
  skill('p2p','피투피','dance','technique',3,13,7,['pirouette'],['pop','switch','spin']),
  skill('pirouette-540','피루엣 540','dance','technique',3,14,6,['pirouette'],['spin','flow']),
  skill('pirouette-720','피루엣 720','dance','technique',4,17,7,['pirouette-540'],['spin','flow']),
  skill('pendulum','시계추','dance','technique',3,13,6,['wood'],['switch','flow']),
  skill('mango-pendulum','시계추 망고','dance','technique',2,11,6,['pendulum','mango'],['switch','flow']),
  {...skill('pivot','180 피봇','trick','spin',1,6,4,[],['spin','switch']),trickSide:'nose'},
  {...skill('shuvit','샤빗','trick','spin',1,7,4,['pivot'],['spin','pop']),trickSide:'nose'},
  {...skill('no-comply','노컴플라이','trick','pop',1,7,5,[],['pop','flow']),trickSide:'tail'},
  {...skill('ollie','알리','trick','pop',1,8,4,[],['pop']),trickSide:'tail'},
  {...skill('kickflip','킥플립','trick','flip',2,11,5,['ollie'],['flip','pop']),trickSide:'tail'},
  {...skill('no-com-big','노컴 빅스핀','trick','spin',2,11,5,['no-comply','shuvit'],['spin','flow']),trickSide:'nose'},
  {...skill('bigspin','빅스핀','trick','spin',3,11,5,['shuvit'],['spin','switch']),trickSide:'nose'},
  {...skill('pop-shuvit','팝샤빗','trick','pop',2,10,5,[],['spin','pop']),trickSide:'tail'},
  {...skill('front-pop','프론팝','trick','pop',2,10,5,['pop-shuvit'],['pop','switch']),trickSide:'tail'},
  {...skill('heelflip','힐플립','trick','flip',2,11,5,['ollie'],['flip','switch']),trickSide:'tail'},
  {...skill('bigger','비거스핀','trick','spin',4,14,6,['bigspin'],['spin','switch']),trickSide:'nose'},
  {...skill('hardflip','하드플립','trick','flip',3,15,6,['heelflip'],['flip','pop']),trickSide:'tail'},
  {...skill('treflip','트래플립','trick','flip',3,15,6,['kickflip','bigspin'],['spin','flip']),trickSide:'tail'},
  {...skill('varial','베리얼 킥플립','trick','flip',3,14,6,['kickflip'],['spin','flip']),trickSide:'tail'},
];
export const SKILL = Object.fromEntries(SKILLS.map(s=>[s.id,s])) as Record<string,Skill|undefined>;
export const START_SKILLS:Record<string,Progress> = Object.fromEntries(
  ([['peter-pan',66],['cross',56],['step-180',49],['pivot',62],['no-comply',43]] as const).map(([id,mastery])=>[id,{study:100,mastery}])
);
