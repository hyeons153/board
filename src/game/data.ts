import type { Family, Meet, Skill, Spot, Action, Stats, Discipline, Division, RoutineStyle, Strategy, Look, Progress } from './types.js';

export const RULES = {
  weekMs:2_000, weeks:52, years:8, runSeconds:60, transition:1, recovery:2.5,
  statCap:200, statHeadroom:136, startStats:{ speed:18, carve:16, link:14, balance:20 } satisfies Stats,
  startMoney:120_000, weeklyAllowance:3_000, hospitalFee:32_000, safetyFund:15_000,
  statGrowth:2.8, secondaryGrowth:0.7, study:37, mastery:13, restEnergy:41,
  energy: { speed:17, carve:17, link:17, balance:15, dance:19, trick:23, rest:0, hospital:0, rehearsal:18 } satisfies Record<Action,number>,
  entryCost:{ dance:20, trick:25, freestyle:30 }, places:[100,75,60,45,35,10], majorMultiplier:1.5,
  prizes:[190_000,130_000,95_000,55_000,40_000,22_000],
  scoreWeights: {
    dance:{ execution:40, link:35, carve:15, speed:10 },
    trick:{ execution:75, link:10, combo:15 },
    freestyle:{ execution:55, combo:25, carve:12, speed:8 },
  },
  executionTarget:{ dance:48, trick:51, freestyle:53 },
  success:{ base:.48, mastery:.0048, balance:.0017, energy:.0016, difficulty:.075, min:.07, max:.97 },
  injury:{ base:.024, energy:.0008, difficulty:.017, stability:.00055, minorWeeks:2, majorWeeks:4 },
  practice:{ discovery:.72, difficultyCost:.34, targeted:1.17, lesson:1.25, rehearsalMastery:5, rehearsalLink:1.6, lowEnergy:30, missChance:.24, greatChance:.17 },
  run:{ repeatFloor:.19, repeatPenalty:.29, danceAffinity:.14, mixedAffinity:.09, trickChainSuccess:.055, trickChainLink:.12, masteryLink:.00065 },
  npc:{ unlockPace:.82, specialist:8, allRounder:2, offDiscipline:-3, energy:91, veteranEnergy:99 },
  growth:[
    {stat:1.08,study:1.04,mastery:1},{stat:1,study:1,mastery:1},
    {stat:.91,study:.97,mastery:.98},{stat:.83,study:.93,mastery:.95},
    {stat:.74,study:.90,mastery:.91},{stat:.66,study:.87,mastery:.87},
    {stat:.59,study:.84,mastery:.83},{stat:.54,study:.82,mastery:.80},
  ],
} as const;

export const STAT_NAMES = { speed:'속도', carve:'카빙', link:'연계', balance:'밸런스' };
export const DISCIPLINE_NAMES: Record<Discipline,string> = { dance:'댄싱', trick:'트릭', freestyle:'프리스타일' };
export const DIVISION_NAMES: Record<Division,string> = { rookie:'뉴비부', regular:'일반부', open:'오픈부', master:'마스터부' };
export const STRATEGY_NAMES: Record<Strategy,string> = { balanced:'밸런스형', dance:'댄싱 중심', trick:'트릭 중심', freestyle:'프리스타일 중심' };
export const STYLE_NAMES: Record<RoutineStyle,string> = { stable:'안정형', flow:'연계형', score:'고득점형' };
export const ACTION_NAMES: Record<Action,string> = { speed:'속도 훈련', carve:'카빙 훈련', link:'연계 훈련', balance:'밸런스 훈련', dance:'댄싱 연마', trick:'트릭 연마', rest:'휴식', hospital:'병원 치료', rehearsal:'라인 리허설' };
export const OUTCOME_NAMES = { miss:'실패', rough:'어설픈 성공', clean:'성공', great:'대성공' };
export const KIND_NAMES = { step:'스텝', technique:'테크닉', spin:'회전', pop:'팝', flip:'플립' };
export const DIFFICULTY_NAMES = ['','초급','중급','고급','최고급'];
export const SKINS = ['#e8a877','#f2c59e','#bc825b','#85543d','#f7dcc4','#603f34'];
export const SHIRTS = ['#cafd67','#f88966','#9f9cf5','#54d3cb','#faf4df','#303749','#ed9bc0','#83b8ed'];
export const BOARDS = ['#fab66c','#d5faf1','#bc91ec','#f47a87','#232833','#f6f4e9','#82b9ed','#94d79e'];
export const BOARD_COLOR_NAMES = ['살구','민트','라벤더','코랄','검정','흰색','하늘','연두'];
export const HAIR_COLORS = ['#252437','#99513d','#b187c8','#a9c662','#60452f','#e6c983','#eee9dc','#df97ae'];
export const PANTS = ['#574b74','#2b5478','#2f7064','#8d5a55','#262d3c','#e7dfcd','#86a8cf','#cc9caf'];
export const SHOES = ['#fff2db','#9aeddc','#fcb58d','#d2c9ff','#2c3342','#f4f4ee','#ed91ae','#8fbced'];
export const DEFAULT_LOOK:Look = {hair:0,skin:0,shirt:0,board:0,gender:'male'};

export const LOCATIONS = {
  river:{ name:'강변 스팟', en:'RIVERSIDE BANK', detail:'탁 트인 바람과 길게 뻗은 산책로.', boosted:['dance','speed'], boost:1.24, risk:.93, npc:'yu' },
  plaza:{ name:'도심 광장', en:'DOWNTOWN PLAZA', detail:'매끄러운 바닥과 내리쬐는 네온.', boosted:['trick','link'], boost:1.25, risk:1.18, npc:'jun' },
  park:{ name:'공원 루프', en:'PARK LOOP', detail:'숲을 따라 굽이치는 완만한 코스.', boosted:['carve','balance'], boost:1.26, risk:.82, npc:'sol' },
  studio:{ name:'실내 연습장', en:'INDOOR STUDIO', detail:'날씨 걱정 없이 지정 기술을 연습하는 곳.', boosted:['dance','trick'], boost:1.15, risk:.7, npc:'sol' },
  night:{ name:'야간 광장', en:'NEON PLAZA', detail:'노아와 준의 심야 잼. 고급 댄싱과 트릭을 깊게 파고들 수 있어요.', boosted:['dance','trick'], boost:1.35, risk:1.18, npc:'noa' },
  arena:{ name:'대회 연습장', en:'WARM-UP ARENA', detail:'대회 바닥에서 종목별 라인을 반복하고 연계를 점검해요.', boosted:['link','rehearsal'], boost:1.25, risk:.82, npc:'min' },
} satisfies Record<Spot,{name:string; en:string; detail:string; boosted:Action[]; boost:number; risk:number; npc:string}>;

export const CALENDAR:Meet[] = [
  {id:'regular-1',month:2,week:7,name:'정기 대회 1차',major:false,spot:'river'},
  {id:'regular-2',month:5,week:20,name:'정기 대회 2차',major:false,spot:'plaza'},
  {id:'major-1',month:6,week:25,name:'롱보드 대회',major:true,spot:'studio'},
  {id:'regular-3',month:8,week:33,name:'정기 대회 3차',major:false,spot:'park'},
  {id:'regular-4',month:11,week:46,name:'정기 대회 4차',major:false,spot:'plaza'},
  {id:'festival',month:12,week:52,name:'롱보드 페스티벌',major:true,spot:'river'},
];

const skill = (id:string,name:string,family:Family,kind:Skill['kind'],difficulty:number,points:number,seconds:number,requires:string[]=[],tags:string[]=[]):Skill =>
  ({id,name,family,kind,difficulty,points,seconds,requires,risk:[0,.07,.12,.18,.23][difficulty],tags});
export const SKILLS = [
  skill('peter-pan','피터팬','dance','step',1,6,5,[],['switch','flow']),
  skill('step-180','180','dance','step',1,6,4,[],['switch','spin']),
  skill('step-360','360','dance','step',1,7,5,['step-180'],['spin','flow']),
  skill('cross','크로스스텝','dance','step',1,6,5,[],['flow']),
  skill('back-cross','백워드 크로스스텝','dance','step',2,9,6,['cross'],['switch','flow']),
  skill('sidewinder','사이드와인더','dance','step',2,10,5,['peter-pan'],['flow','spin']),
  skill('v-spin','브이스핀','dance','step',3,13,6,['sidewinder','step-360'],['spin','switch']),
  skill('ghost','고스트라이드','dance','technique',1,7,5,[],['pop','flow']),
  skill('piglet','피글렛','dance','technique',1,7,5,[],['pop','switch']),
  skill('mango','망고','dance','technique',1,7,5,[],['flow','switch']),
  skill('wood','찹더우드','dance','technique',1,8,5,[],['pop','flow']),
  skill('pirouette','피루엣','dance','technique',2,10,5,['step-360'],['spin','flow']),
  skill('mango-pendulum','시계추 망고','dance','technique',2,11,6,['mango','wood'],['switch','flow']),
  skill('pirouette-540','피루엣 540','dance','technique',3,14,6,['pirouette'],['spin','flow']),
  skill('pendulum','시계추','dance','technique',3,13,6,['mango-pendulum'],['switch','flow']),
  skill('pirouette-720','피루엣 720','dance','technique',4,17,7,['pirouette-540'],['spin','flow']),
  skill('pivot','피봇','trick','spin',1,6,4,[],['spin','switch']),
  skill('shuvit','샤빗','trick','spin',1,7,4,[],['spin','pop']),
  skill('no-comply','노컴플라이','trick','pop',1,7,5,[],['pop','flow']),
  skill('kickflip','킥플립','trick','flip',2,11,5,['shuvit'],['flip','pop']),
  skill('no-com-big','노컴 빅스핀','trick','spin',2,11,5,['no-comply','pivot'],['spin','flow']),
  skill('bigspin','빅스핀','trick','spin',2,11,5,['shuvit','pivot'],['spin','switch']),
  skill('front-pop','프론트 팝','trick','pop',2,10,5,['no-comply'],['pop','switch']),
  skill('pop-shuvit','팝샤빗','trick','pop',2,10,5,['shuvit'],['spin','pop']),
  skill('heelflip','힐플립','trick','flip',2,11,5,['pop-shuvit'],['flip','switch']),
  skill('bigger','비거스핀','trick','spin',3,14,6,['bigspin'],['spin','switch']),
  skill('hardflip','하드플립','trick','flip',3,15,6,['kickflip','front-pop'],['flip','pop']),
  skill('treflip','트래플립','trick','flip',3,15,6,['kickflip','bigspin'],['spin','flip']),
  skill('varial','베리얼 킥플립','trick','flip',3,14,6,['kickflip','shuvit'],['spin','flip']),
];
export const SKILL = Object.fromEntries(SKILLS.map(s=>[s.id,s])) as Record<string,Skill|undefined>;
export const START_SKILLS:Record<string,Progress> = Object.fromEntries(
  ([['peter-pan',66],['cross',56],['step-180',49],['pivot',62],['shuvit',46],['no-comply',43]] as const).map(([id,mastery])=>[id,{study:100,mastery}])
);
