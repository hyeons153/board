import type { EventDef } from './events.js';
import { RULES } from './data.js';
import { NPC_WORKSHOPS, workshopTitle } from './npcWorkshops.js';
import { chosen, hasFlag, hasRomanticInterest, STORY_NPCS, STORY_TITLES } from './storyState.js';
import type { RelationshipState, Rider } from './types.js';

type CareerRelationships = Pick<Rider,'extras'>;
type ArcId = 'yu'|'jun';
type Route = 'friend'|'rival'|'partner';
type Scene = { title:string; body:string; choices:EventDef['choices'] };
type Arc = {
  introductions:string[];
  trust:Scene;
  reunion:string;
  fork:Scene;
  confession:Scene;
  followups:Record<Route,Scene>;
  epilogues:Record<Exclude<RelationshipState,'undecided'>,string>;
};
export type RelationshipReward = { titleId:string; item:string };
export type RelationshipChoice = { state?:RelationshipState; flag:string; reward?:RelationshipReward };

export const RELATIONSHIP_NAMES:Record<RelationshipState,string> = {
  undecided:'관계 미확정',friend:'우정',rival:'경쟁',interested:'관계 미확정',partner:'연인',ended:'관계 종료',
};
export const RELATIONSHIP_REWARDS = {
  yu: {
    friend:{titleId:'yu-friend',title:'한 프레임의 파트너',item:'acc_yu_friend'},
    rival:{titleId:'yu-rival',title:'엇박자의 라이벌',item:'acc_yu_rival'},
    partner:{titleId:'yu-partner',title:'둘만의 템포',item:'acc_yu_partner'},
  },
  jun: {
    friend:{titleId:'jun-friend',title:'실패의 공동 감독',item:'acc_jun_friend'},
    rival:{titleId:'jun-rival',title:'다음 경기의 기준',item:'acc_jun_rival'},
    partner:{titleId:'jun-partner',title:'마지막 컷의 주인공',item:'acc_jun_partner'},
  },
} satisfies Record<ArcId,Record<Route,RelationshipReward&{title:string}>>;
export const RELATIONSHIP_TITLES = new Map(Object.values(RELATIONSHIP_REWARDS).flatMap(routes=>
  Object.values(routes).map(reward=>[reward.titleId,reward.title] as const)).concat(Object.entries(STORY_TITLES),
    STORY_NPCS.map(npc=>[workshopTitle(npc),NPC_WORKSHOPS[npc].title])));

export const relationshipWith = (r:CareerRelationships,npc:string) => r.extras?.relationships?.npcs[npc];
export const representativeTitle = (r:CareerRelationships) => {
  const history=r.extras?.relationships,id=history?.representative;
  return id&&history?.titles.includes(id)?RELATIONSHIP_TITLES.get(id):undefined;
};

export function relationshipChoiceAvailable(r:CareerRelationships,npc:string|undefined,state?:RelationshipState){
  return (state!=='interested'&&state!=='partner')||
    !Object.entries(r.extras?.relationships?.npcs??{}).some(([id,progress])=>
      id!==npc&&(progress?.state==='partner'||progress?.flags.includes('confession-accepted')));
}

const arcs:Record<ArcId,Arc> = {
  yu:{
    introductions:['first','mango-lesson','yu-film'],
    trust:{
      title:'지워지지 않은 한 테이크',
      body:'유리가 편집을 멈췄다. 잘못 밟은 스텝 뒤, 네가 박자를 세어 주고 있었다. “이 부분은 자르려고 했는데. 한 번만 더 들어 볼래?”',
      choices:[
        {label:'발소리가 들리는 원본을 함께 남긴다',effect:{relation:8},tags:['dance','balanced'],relationship:{flag:'shared-cut'},dialogue:'유리가 음량을 올렸다. 화면 밖에서 둘이 동시에 웃었다.'},
        {label:'음악을 얹어 다른 버전도 만들어 본다',effect:{relation:7},tags:['trick','freestyle'],relationship:{flag:'new-cut'},dialogue:'유리가 새 파일 이름을 「두 가지 박자」로 저장했다.'},
      ],
    },
    reunion:'유리가 네가 고른 스텝을 촬영했다. 둘의 박자가 어긋나자 웃음이 터졌다. 유리가 휴대폰을 내밀었다. “그래도 첫 테이크부터 같이 볼래?”',
    fork:{
      title:'영상에 남지 않은 말',
      body:'유리가 재생을 멈추고 휴대폰을 내려놓았다. “요즘에는 너랑 타는 시간이 제일 기다려져. 다음에는 어떤 사이로 만나고 싶어?”',
      choices:[
        {label:'앞으로도 함께 춤추는 친구로 지내자',effect:{relation:8},tags:[],relationship:{state:'friend',flag:'friend-route'},dialogue:'“좋아. 다음 영상도 감독은 둘이야.” 유리가 나란히 설 자리를 비워 줬다.'},
        {label:'이번에는 각자 만든 라인으로 겨뤄 보자',effect:{relation:8},tags:[],relationship:{state:'rival',flag:'rival-route'},dialogue:'유리가 이어폰 한쪽을 건넸다. “곡만 같게 하고, 나머지는 각자.”'},
        {label:'보드 없이도 너를 만나고 싶어',effect:{relation:8},tags:[],relationship:{state:'interested',flag:'romance-route'},dialogue:'“그럼 다음엔 촬영 장비 두고 올게.” 유리가 휴대폰을 주머니에 넣었다.'},
      ],
    },
    confession:{
      title:'카메라가 쉬는 오후',
      body:'유리는 오늘 카메라를 가져오지 않았다. 강이 보이는 난간에 기대어 조용히 말했다. “좋아해. 우리 사귀어 볼래?”',
      choices:[
        {label:'나도 좋아해. 우리 사귀자',effect:{relation:10},tags:[],relationship:{state:'partner',flag:'confession-accepted'},dialogue:'유리가 손을 내밀었다. 둘은 스텝을 세지 않고 천천히 걸었다.'},
        {label:'마음은 고마워. 친구로 함께 타고 싶어',effect:{relation:6},tags:[],relationship:{state:'friend',flag:'confession-declined'},dialogue:'유리는 잠깐 강을 바라보다 고개를 끄덕였다. “친구로 다음 영상을 찍자.”'},
      ],
    },
    followups:{
      friend:{
        title:'두 사람의 크레디트',
        body:'유리와 만든 영상이 작은 크루 상영회에 걸렸다. 둘이 처음으로 호흡을 맞춘 장면에서 객석의 새 라이더들이 박자를 따라 쳤다.',
        choices:[{label:'마지막에 두 사람의 이름을 함께 올린다',effect:{relation:9},tags:[],dialogue:'유리가 합동 촬영 노트를 건넸다. 첫 페이지에 다음 촬영 날짜가 적혀 있었다.'}],
      },
      rival:{
        title:'한 곡, 두 개의 라인',
        body:'유리가 비공식 연습 세션을 열었다. 같은 음악에 둘의 동작이 정반대 방향으로 뻗었다. 곡이 끝나자 유리는 네가 멈춘 곳에 자기 보드를 놓았다.',
        choices:[{label:'다음 승부의 첫 박자를 서로에게 맡긴다',effect:{relation:9},tags:[],dialogue:'“다음에는 네 박자부터.” 유리가 두 템포를 적어 둔 메트로놈을 건넸다.'}],
      },
      partner:{
        title:'둘만 듣는 발소리',
        body:'유리와 약속했던 둘만의 밤 라이딩이다. 유리가 나란히 놓인 보드를 바라봤다. “앞으로도 이런 저녁을 같이 보내고 싶어. 너도 그래?”',
        choices:[
          {label:'다음 계절에도 함께 걷고 싶어',effect:{relation:9},tags:[],dialogue:'유리가 서로의 보드에 달 작은 키링을 꺼냈다. 돌아가는 길에도 발소리가 나란했다.'},
          {label:'좋았던 기억으로 남기고 여기서 헤어지자',effect:{},tags:[],relationship:{state:'ended',flag:'farewell'},dialogue:'유리는 마지막으로 함께 강변을 걸었다. 서로에게 남은 장면은 지우지 않기로 했다.'},
        ],
      },
    },
    epilogues:{
      friend:'은퇴식에서 유리가 두 사람의 이름이 나란히 뜨는 영상을 틀었다. 다음 크루 상영회 자리도 여전히 두 사람 몫이었다.',
      rival:'유리는 은퇴식이 끝나자 이어폰 한쪽을 건넸다. 점수표가 사라진 뒤에도, 같은 곡에 각자의 라인을 탈 약속은 남았다.',
      interested:'함께 보낸 오후는 아직 이름이 없었다. 유리는 영상 끝에 여백을 남겨 두고 언젠가 다시 만나자고 했다.',
      partner:'은퇴식 뒤 유리는 카메라를 두고 왔다. 두 사람은 관객이 떠난 강변을 걸으며 다음 계절의 첫 약속을 잡았다.',
      ended:'유리는 완성한 영상을 조용히 보내 왔다. 두 사람은 같은 장면을 간직한 채 각자의 계절로 걸어갔다.',
    },
  },
  jun:{
    introductions:['juns-clip','night-jam','jun-jam'],
    trust:{
      title:'실패 폴더의 첫 파일',
      body:'준이 넘어지는 장면에서 영상을 멈췄다. “이거 보여 주면 다들 웃는데, 넌 어디부터 다시 해 볼 것 같아?”',
      choices:[
        {label:'넘어지기 직전 발이 놓인 자리를 같이 본다',effect:{relation:8},tags:['trick','freestyle'],relationship:{flag:'reviewed-fall'},dialogue:'준이 실패한 컷에 별표를 붙였다. “좋다. 나중에도 이거 보자.”'},
        {label:'준에게 내 실패 영상도 건넨다',effect:{relation:7},tags:['balanced','dance'],relationship:{flag:'shared-fall'},dialogue:'준이 폴더 이름을 「우리의 첫 착지 전」으로 바꿨다.'},
      ],
    },
    reunion:'준이 늦게 연습을 마친 네게 태블릿을 내밀었다. “예전 파일 없어도 돼. 이거 오늘 내 첫 시도니까 같이 보자.”',
    fork:{
      title:'편집하지 않은 장면',
      body:'관중석이 비자 준이 카메라를 껐다. “네가 먼저 들어올 때마다 이기고 싶었어. 그런데 같이 남는 것도 좋아. 넌 어때?”',
      choices:[
        {label:'승부 뒤에 같이 영상을 보는 친구가 되고 싶어',effect:{relation:8},tags:[],relationship:{state:'friend',flag:'friend-route'},dialogue:'“그럼 넘어지는 장면도 전부 공유다.” 준이 웃으며 새 폴더를 열었다.'},
        {label:'다음 대회에서도 서로의 기록을 넘겨 보자',effect:{relation:8},tags:[],relationship:{state:'rival',flag:'rival-route'},dialogue:'준은 손을 내밀었다. “정했다. 다음에는 내가 먼저 네 점수 보러 갈 거야.”'},
        {label:'대회가 없는 날에도 널 보고 싶어',effect:{relation:8},tags:[],relationship:{state:'interested',flag:'romance-route'},dialogue:'준이 카메라 가방을 닫았다. “토요일은 아무 일정 없는데. 그날 볼까?”'},
      ],
    },
    confession:{
      title:'카메라 없이 온 토요일',
      body:'준은 카메라 대신 편의점 커피 두 잔을 들고 왔다. “준비한 말이 있었는데 자꾸 편집하게 되더라. 그냥 말할게. 나랑 사귀어 볼래?”',
      choices:[
        {label:'좋아. 오늘부터 우리 사귀자',effect:{relation:10},tags:[],relationship:{state:'partner',flag:'confession-accepted'},dialogue:'준이 커피를 내밀다 살짝 쏟았다. 둘 다 웃었고, 이번에는 찍는 사람이 없었다.'},
        {label:'널 아끼는 친구로 남고 싶어',effect:{relation:6},tags:[],relationship:{state:'friend',flag:'confession-declined'},dialogue:'준은 난간에 커피를 놓고 고개를 끄덕였다. “그래. 커피 식기 전에 마시자.”'},
      ],
    },
    followups:{
      friend:{
        title:'우리의 실패 상영회',
        body:'준과 만든 첫 상영회에는 넘어진 장면만 올라갔다. 영상이 끝나자 준이 객석에 앉은 새 라이더에게 자기가 가장 많이 넘어진 자리를 알려 줬다.',
        choices:[{label:'다음 파일은 처음 타는 라이더들과 만든다',effect:{relation:9},tags:[],dialogue:'준이 너와 같은 아카이브 핀을 가방에 달았다. 다음 상영회의 첫 자리를 두 사람 몫으로 비웠다.'}],
      },
      rival:{
        title:'다음 착지선',
        body:'준이 테이프로 두 사람의 연습 착지선을 그었다. 대회가 끝난 뒤부터 둘은 서로가 먼저 성공한 날이면 남아서 축하했다.',
        choices:[{label:'오늘의 표시는 두고 다음 연습을 약속한다',effect:{relation:9},tags:[],dialogue:'준이 같은 테이프를 감은 마커를 건넸다. “언젠가 네가 더 멀리 그어 줘.”'}],
      },
      partner:{
        title:'마지막 컷은 없이',
        body:'준이 카메라를 켜려다 멈췄다. “기록해 두고 싶은 날은 많아. 그래도 오늘 같은 날을 앞으로도 계속 만나고 싶어. 넌 어때?”',
        choices:[
          {label:'촬영이 없는 날도 같이 보내자',effect:{relation:9},tags:[],dialogue:'준이 카메라에서 스트랩을 풀어 건넸다. 돌아갈 때는 가방 대신 네 손을 잡았다.'},
          {label:'고마웠어. 우리 관계는 여기서 마무리하자',effect:{},tags:[],relationship:{state:'ended',flag:'farewell'},dialogue:'준은 가방을 닫고 잠깐 곁에 앉았다. 헤어지는 장면만큼은 남기지 않기로 했다.'},
        ],
      },
    },
    epilogues:{
      friend:'준은 은퇴식이 끝나자 실패 상영회에 새 파일을 올렸다. 처음 도전하는 라이더들에게 둘이 직접 상영회 문을 열었다.',
      rival:'준은 마지막 대회 기록지 뒤에 자기 연습 시간을 적어 줬다. 은퇴 뒤에도 둘의 비공식 재대결은 열린다.',
      interested:'준은 카메라를 내려두고 은퇴식 뒤에 잠시 남았다. 둘은 서두르지 않고 다음 주에 커피를 마시기로 했다.',
      partner:'준은 은퇴식 영상의 마지막 장면을 비워 뒀다. 카메라를 꺼 두고 둘은 다음 주말에 갈 곳을 골랐다.',
      ended:'준은 지난 영상의 사본을 건네고 먼저 인사했다. 남은 기록을 함께 존중하며 둘은 서로의 새 출발을 응원했다.',
    },
  },
};

const atArc = (npc:ArcId,episode:string) => 'relationship-'+npc+'-'+episode;
const time = ({year,week}:Pick<Rider,'year'|'week'>) => (year-1)*RULES.weeks+week;
function after(r:Rider,id:string,weeks:number){
  const choice=r.extras?.choices[id];
  return !!choice&&(time(r)-time(choice)>=weeks||(r.year===RULES.years&&time(r)>time(choice)));
}

function storyFor(npc:ArcId,arc:Arc):EventDef[]{
  const id=(episode:string)=>atArc(npc,episode);
  const scene=(episode:string,content:Pick<EventDef,'title'|'body'|'choices'>,when:EventDef['when'],decision=false):EventDef=>
    ({...content,id:id(episode),npc,kind:decision?'관계 선택':'개인 에피소드',story:true,anyGender:true,decision,when,
      ...(episode==='fork'||episode==='confession'?{requiresChoice:true}:{})});
  const established=(r:Rider)=>arc.introductions.some(event=>r.events[event]);
  const trust={...arc.trust,body:(r:Rider)=>established(r)?arc.trust.body:arc.reunion};
  const fork={...arc.fork,body:(r:Rider)=>{
    const flags=relationshipWith(r,npc)?.flags??[];
    const context=flags.includes('new-cut')?'유리는 같이 만든 두 버전을 모두 보관해 두었다. '
      :flags.includes('shared-fall')?'준은 네가 건넨 실패 영상도 자기 파일 옆에 두었다. ':'';
    return context+arc.fork.body;
  }};
  const followups=(['friend','rival','partner'] as const).map(route=>{
    const content=arc.followups[route],finish='finished-'+route;
    return scene(route,{...content,choices:content.choices.map(choice=>
      choice.relationship?choice:{...choice,relationship:{flag:finish,reward:RELATIONSHIP_REWARDS[npc][route]}})},
    r=>relationshipWith(r,npc)?.state===route&&after(r,id(route==='partner'?'confession':'fork'),2),route==='partner');
  });
  return [
    scene('trust',trust,r=>r.year>=3||r.year>=2&&established(r)),
    scene('fork',fork,r=>r.year>=3&&(relationshipWith(r,npc)?.state??'undecided')==='undecided'&&after(r,id('trust'),2),true),
    scene('confession',arc.confession,r=>relationshipWith(r,npc)?.state==='interested'&&hasRomanticInterest(r,npc)&&after(r,id('fork'),2),true),
    ...followups,
  ];
}
export const RELATIONSHIP_EVENTS:EventDef[] = [
  ...storyFor('yu',arcs.yu),...storyFor('jun',arcs.jun),
  {id:'rooftop-jam',title:'지붕 위의 첫 잼',kind:'스팟 이야기',story:true,when:r=>r.spot==='rooftop'&&rooftopUnlocked(r),
    body:'해 질 무렵 옥상에 사람들이 모였다. 각자 아는 동작 하나씩을 돌아가며 보여 주자, 처음 만난 라이더들도 자연스럽게 라인에 들어왔다.',
    choices:[{label:'첫 동작을 보여 주고 다음 사람에게 자리를 내어 준다',effect:{fame:3},tags:['dance','trick','freestyle']},
      {label:'난간 옆에서 오늘의 주행을 지켜본다',effect:{energy:12},tags:['balanced']}]},
];

export function rooftopUnlocked(r:CareerRelationships){
  return r.extras?.relationships?.titles.some(id=>!id.startsWith('crew-'))??false;
}

export function relationshipHint(r:Rider,npc:string){
  const progress=relationshipWith(r,npc);
  if(r.phase==='event'&&(r.event?.startsWith('relationship-'+npc+'-')||r.event?.startsWith('story-'+npc+'-')))
    return '육성 화면에서 다음 이야기를 확인할 수 있어요.';
  if(progress?.state==='interested'&&hasFlag(r,npc,'overlap-requested')&&!r.events['crew-overlap'])
    return '기존 교제에 대해 두 사람과 이야기할 장면이 남았어요.';
  const hasSeen=(part:number)=>Boolean(r.events['story-'+npc+'-'+part]);
  if(hasSeen(4))return '지금까지 고른 관계는 은퇴 기록에 남아요.';
  if(hasSeen(3))return [`jun`,`min`,`noa`].includes(npc)?'7년차부터 마지막 인사를 나눠요.':'8년차 마지막 시즌에 답을 나눠요.';
  if(hasSeen(2))return '5년차부터 지난 약속과 선택이 다시 이야기로 이어져요.';
  if(hasSeen(1)||npc==='yu')return '3년차부터 개인 이야기가 깊어져요.';
  return '초반 시즌에 스팟에서 만나면 첫 장면이 열려요. 시즌을 이어가면 다시 만날 기회가 생겨요.';
}

const EXPANDED_ENDINGS:Partial<Record<string,Partial<Record<RelationshipState,string>>>>={
  min:{partner:'마지막 점검표의 일정은 둘이 정했다. 민재가 마지막 칸에는 네가 직접 쓰라며 연필을 건넸다.',
    rival:'민재는 은퇴식에서 새 기록 대신 각자 타고 싶은 시간을 물었다. 둘의 마지막 장비 점검은 여전히 완벽했다.',
    ended:'체크리스트를 돌려주며 민재가 마지막으로 물었다. “이제 다 돌려받았어?” 대답을 들은 뒤 그는 먼저 길을 비켜 줬다.'},
  sol:{partner:'솔은 은퇴식 뒤 커피를 두 잔 따랐다. 한 잔을 건네며 좋다는 말을 이번에도 농담 없이 했다.',
    friend:'두 사람은 좋은 친구라고 소개한 날처럼 따뜻한 커피부터 마셨다. 그날 솔의 농담은 대회 이야기뿐이었다.',
    ended:'솔은 사과를 농담으로 덮지 않았다. 두 사람은 마지막 커피를 각자의 자리에서 마셨다.'},
  jun:{partner:'준은 마지막 영상의 이름을 정하기 전에 물었다. 이번에는 둘이 기억하고 싶은 장면만 남겼다.',
    rival:'은퇴복을 본 준이 웃었다. “이제 점수표 없어도 한 판 할 수 있지? 네 경기는 아직 내 최애야.”',
    friend:'두 사람은 옛 영상을 정리하며 같이 웃었다. 카메라 밖에서 남은 인사가 가장 길었다.'},
  ha:{partner:'하린은 시계를 집에 두고 왔다. 둘은 누가 먼저 도착했는지 세지 않고 강변 끝까지 걸었다.',
    rival:'은퇴식이 끝나자 하린이 손목시계를 들었다. “그럼 이제 한 판 더 할 시간은 있지?”',
    friend:'하린은 먼저 가라고 해 놓고 네가 보드를 챙길 때까지 기다렸다. 그날 둘 다 제일 느린 속도로 강변을 탔다.'},
  noa:{partner:'네온 불이 꺼지자 노아는 화면을 확인하는 대신 앞으로 원하는 연락 간격을 먼저 물었다. 둘은 다음에 탈 날을 잡았다.',
    friend:'조명이 꺼진 뒤에도 노아는 편하게 인사했다. 문자가 오지 않아도 다음 연습은 각자 잘 해낼 걸 알았다.',
    ended:'마지막 메시지는 지울 필요가 없었다. 서로의 공간을 남겨 둔 채 각자 다른 출구로 걸어갔다.'},
  yu:{partner:'마지막 박자가 끝나자 첫 강변에서 만난 유리가 손을 내밀었다. 다음 스텝은 한 사람씩 정하기로 했다.',
    rival:'유리가 자신과 다른 라인에 제일 먼저 박수쳤다. 두 사람의 박자는 달라도 마지막 결승의 관중은 함께 일어섰다.',
    friend:'유리와 처음 탄 강변 장면을 다시 보고 웃었다. 누가 먼저 웃기 시작했는지 아직도 정확히는 몰랐다.'},
};
export function relationshipEpilogues(r:CareerRelationships){
  return STORY_NPCS.flatMap(npc=>{
    const state=relationshipWith(r,npc)?.state;
    if(!state||state==='undecided')return [];
    const old=npc==='yu'||npc==='jun'?arcs[npc].epilogues[state]:undefined;
    const expanded=r.extras?.relationships?.story?.some(entry=>entry.npcs.includes(npc));
    const text=(expanded?EXPANDED_ENDINGS[npc]?.[state]:undefined)??old
      ??(state==='ended'?'마지막 인사는 짧았다. 함께 탔던 기억을 간직하고 서로의 다음 시즌을 존중했다.':'함께 연습하던 길과 대회장에서 건넨 인사가 그해의 기록에 남았다.');
    return [{npc,state,text}];
  });
}

export function crewEpilogue(r:CareerRelationships){
  if(chosen(r,'cross-12',2))return '함께 탔던 이들에게 마지막으로 인사를 건넸다. 대회 결과와 더불어, 돌아온 박수와 고갯짓이 그 날의 기억에 남았다.';
  if(chosen(r,'cross-12',1))return '경기가 끝난 뒤 미뤄 둔 말을 전했다. 답을 원하지 않는 사람에게는 다시 묻지 않기로 했다.';
  if(chosen(r,'cross-12',0))return '마지막 날 기억에 남은 건 무대 소음보다 첫 스텝이었다. 보드에 남은 흠집 하나하나가 네 편이었다.';
  if(r.extras?.choices['cross-01'])return '크루 단체 사진은 결국 따로 찍었다. 사과를 받은 사람들은 각자의 속도로 다음 인사를 준비했다.';
  return undefined;
}
