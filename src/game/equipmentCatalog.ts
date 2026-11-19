import type { Stat } from './types.js';

export const BASIC_SLOTS=['deck','trucks','wheels'] as const;
export const GEAR_SLOTS=[...BASIC_SLOTS,'accessory'] as const;
export type BasicSlot=typeof BASIC_SLOTS[number];
export type GearSlot=typeof GEAR_SLOTS[number];
export const RARITIES=['common','rare','epic','legendary'] as const;
export type Rarity=typeof RARITIES[number];
export const RARITY_NAMES={common:'일반',rare:'희귀',epic:'영웅',legendary:'전설'};
export type Visual='helmet'|'knees'|'wrists'|'pouch'|'bottle'|'tape'|'dance-note'|'trick-note'|'metronome'|'headphones'|'bearing'|'laces'|'glasses'|'headband'|'camera'|'whistle'|'cloth'|'crown'|'clover'|'invitation'|'sticker'|'duck'|'cactus'|'scarf'|'led'|'pinwheel'|'chick'|'disco'|'snail'|'rainbow';
export type Effects={injury:number;cost:number;rest:number;minorRecovery:number;danceMastery:number;trickMastery:number;linkGrowth:number;danceLink:number;discovery:number;great:number;podiumFame:number;fame:number;prize:number;entryEnergy:number;eventChance:number;specialWeight:number;relation:number;trickLand:number;practice:number;fatigue:number;carve:number;speed:number};
export type Gear={id:string;slot:GearSlot;name:string;price:number;rarity:Rarity;description:string;stats:Partial<Record<Stat,number>>;effects:Partial<Effects>;visual?:Visual;event?:string;unlock?:'win'|'rainbow'|'sticker'|'scarf'|'relationship';legacy?:boolean;design?:number;shape?:number;color?:number;partColor?:string;wheelSize?:number};
const basic=(id:string,slot:BasicSlot,name:string,price:number,stats:Gear['stats'],description:string,appearance:Partial<Gear>):Gear=>({id,slot,name,price,stats,description,rarity:price>=200000?'legendary':price>=80000?'epic':price>=26000?'rare':'common',effects:{},...appearance});
const accessory=(id:string,name:string,rarity:Rarity,price:number,effects:Gear['effects'],description:string,visual:Visual,extra:Partial<Gear>={}):Gear=>({id,slot:'accessory',name,rarity,price,stats:{},effects,description,visual,...extra});
export const STARTER_IDS=['deck_001','truck_001','wheel_001'];
const ORIGINAL_GEAR:Gear[]=[
  basic('deck_001','deck','입문용 롱보드 데크',0,{},'첫 푸시부터 마지막 페스티벌까지. 마음껏 흠집 내도 괜찮다.',{shape:0}),
  basic('deck_002','deck','플랫 스텝 데크',16000,{link:2,balance:1},'발을 옮길 자리가 넉넉하다. 다음 발도 벌써 기다리는 중.',{shape:1,design:1,color:1}),
  basic('deck_003','deck','와이드 크루즈 데크',26000,{link:1,balance:3},'느긋하게 넓은 길을 고른다. 발끝까지 여유로운 데크.',{shape:2,design:3,color:6}),
  basic('deck_004','deck','트릭 하이브리드 데크',36000,{link:3,balance:1},'짧은 테일에 큰 꿈을 담았다. 팝 소리부터 씩씩하다.',{shape:3,design:2,color:3}),
  basic('deck_005','deck','탄성 메이플 데크',62000,{link:3,balance:3},'리듬을 누르면 톡 하고 돌아오는 메이플의 대답.',{shape:0,design:1,color:0}),
  basic('deck_006','deck','리듬 플로우 데크',105000,{link:5,balance:2},'기술 사이의 한 걸음까지 춤으로 만드는 보드.',{shape:1,design:1,color:2}),
  basic('deck_007','deck','밸런스 마스터 데크',105000,{link:2,balance:5},'흔들린 날에도 발밑에서 조용히 중심을 받아 준다.',{shape:2,design:3,color:5}),
  basic('deck_008','deck','레전드 시그니처 데크',220000,{link:5,balance:5},'사인은 데크에, 이야기는 바퀴 소리에 남긴다.',{shape:3,design:2,color:4}),
  ...([
    ['truck_001','입문용 트럭',0,0,'#9da9b7'],['truck_002','소프트 턴 트럭',18000,2,'#b7d5bd'],['truck_003','스테이블 트럭',28000,3,'#9aafcc'],['truck_004','스네이크 턴 트럭',48000,4,'#82b5a4'],['truck_005','딥 카브 트럭',80000,5,'#b39ed9'],['truck_006','아크 마스터 트럭',125000,6,'#ecc880'],['truck_007','챔피언 커스텀 트럭',210000,7,'#f0d6a2'],
  ] as const).map(([id,name,price,carve,partColor],i)=>basic(id,'trucks',name,price,carve?{carve}:{},['첫 코너를 함께 도는 든든한 축.','부드러운 코너 끝에서 다시 한 번 돌아보고 싶어진다.','급할수록 안정적으로, 코너의 정석.','구불구불한 길이 오늘의 플레이리스트.','몸을 낮추면 풍경도 조금 더 가까워진다.','곡선을 그리면 뒤에서 감탄사가 따라온다.','우승보다 먼저 코너를 잡는 커스텀 세팅.'][i],{partColor,shape:i%3})),
  ...([
    ['wheel_001','입문용 휠',0,0,'#b9c4cf'],['wheel_002','소프트 롤 휠',16000,2,'#f4b7a0'],['wheel_003','크루즈 휠',28000,3,'#9cdcc8'],['wheel_004','스트리트 휠',48000,4,'#a9c9ee'],['wheel_005','스프린트 휠',85000,5,'#f0bb79'],['wheel_006','플래시 휠',135000,6,'#d5b0eb'],['wheel_007','레이스 마스터 휠',230000,7,'#f4e7be'],
  ] as const).map(([id,name,price,speed,partColor],i)=>basic(id,'wheels',name,price,speed?{speed}:{},['오늘 처음 굴러도 괜찮은 기본 바퀴.','골목의 작은 요철도 부드럽게 넘는다.','산책하러 나왔다가 한 바퀴 더 달리게 된다.','도시의 길 위에 가벼운 박자를 남긴다.','바람에게 먼저 인사하는 휠.','잔상이 이름표보다 먼저 보인다.','결승선 이후의 주행까지 기대하게 한다.'][i],{partColor,wheelSize:i<3?5:i<6?6:7})),
  accessory('acc_001','튼튼한 헬멧','common',8000,{injury:.01},'머리부터 지키자. 멋은 그다음에도 충분하다.','helmet'),
  accessory('acc_002','무릎 보호대','common',8000,{injury:.01},'무릎이 먼저 고맙다고 말하는 작은 쿠션.','knees'),
  accessory('acc_003','손목 보호대','common',8000,{injury:.01},'다음 하이파이브까지 손목을 지켜 준다.','wrists'),
  accessory('acc_004','응급 밴드 파우치','common',12000,{rest:2},'스티커처럼 귀여운 밴드도 치료는 진지하게.','pouch'),
  accessory('acc_005','쿨링 물병','rare',20000,{cost:1},'한 모금 마시면 오늘의 마지막 한 번이 늘어난다.','bottle'),
  accessory('acc_006','스포츠 테이핑 키트','rare',35000,{minorRecovery:1},'경상 한 번에 한 번, 회복까지 한 주를 덜어 준다.','tape'),
  accessory('acc_007','댄싱 연습 노트','common',15000,{danceMastery:.03},'왼발, 오른발, 그리고 자꾸만 늘어나는 낙서.','dance-note'),
  accessory('acc_008','트릭 연습 노트','common',15000,{trickMastery:.03},'착지한 날에는 별표를 아주 크게 그린다.','trick-note'),
  accessory('acc_009','미니 메트로놈','rare',28000,{linkGrowth:.03},'작은 딸깍 소리가 기술 사이를 이어 준다.','metronome'),
  accessory('acc_010','무선 이어폰','rare',35000,{danceLink:.01},'오늘의 첫 곡이 첫 연계와 꼭 맞아떨어졌다.','headphones'),
  accessory('acc_011','행운의 베어링','rare',30000,{discovery:.01},'굴러가는 건 바퀴인데 행운도 같이 굴러온다고?','bearing'),
  accessory('acc_012','전설의 운동화 끈','epic',75000,{great:.005},'이 끈을 묶으면 뭐든 할 수 있을 것 같은 기분.','laces'),
  accessory('acc_013','허세 선글라스','common',18000,{podiumFame:.03},'착용하면 실력보다 자신감이 먼저 올라간다.','glasses'),
  accessory('acc_014','반짝이 헤어밴드','common',12000,{},'환호가 반짝여 보이는 건 기분 탓만은 아니다. 점수 영향 없음.','headband'),
  accessory('acc_015','휴대용 액션캠','rare',45000,{fame:.03},'실패 장면도 추억이 된다. 편집은 미래의 내가 한다.','camera'),
  accessory('acc_016','황금 호루라기','epic',80000,{prize:.03},'불면 부자가 되는 건 아니지만 상금 봉투가 조금 두꺼워진다.','whistle'),
  accessory('acc_017','챔피언 손수건','epic',90000,{entryEnergy:3},'출발 전에 땀을 닦고, 체력도 조금 챙긴다.','cloth'),
  accessory('acc_018','왕관 모양 헬멧','legendary',0,{},'우승 세리머니는 조금 유난스러워도 괜찮다.','crown',{unlock:'win'}),
  accessory('acc_019','네잎클로버 키링','rare',24000,{eventChance:.01},'발견한 건 세 잎인데 접으면 네 잎처럼 보인다.','clover'),
  accessory('acc_020','수상한 초대장','rare',40000,{specialWeight:.2},'장소는 적혀 있는데 시간이 매번 바뀐다.','invitation'),
  accessory('acc_021','선배의 낡은 스티커','rare',0,{relation:1},'떼었다 붙여도 선배의 응원은 잘 떨어지지 않는다.','sticker',{unlock:'sticker'}),
  accessory('acc_022','고무오리 키링','epic',55000,{},'꽥. 이유는 모르겠지만 오늘은 잘될 것 같다.','duck',{event:'duck-blessing'}),
  accessory('acc_023','춤추는 선인장','epic',70000,{},'네가 연계에 실패해도 얘는 계속 춤춘다.','cactus',{event:'cactus-groove'}),
  accessory('acc_024','전설의 빨간 머플러','legendary',0,{},'먼저 달려간 선배가 다음 라이더에게 남긴 빨간 약속.','scarf',{unlock:'scarf',event:'scarf-epilogue'}),
  accessory('acc_025','LED 반짝이 팔찌','common',10000,{},'야간 광장에서 길을 잃어도 손목은 찾기 쉽다.','led'),
  accessory('acc_026','미니 바람개비','common',8000,{},'주행 거리가 아니라 바람의 기분을 기록한다.','pinwheel'),
  accessory('acc_027','삐약이 인형','rare',20000,{},'넘어지는 건 아프지만 소리는 꽤 귀엽다.','chick'),
  accessory('acc_028','디스코볼 키링','rare',28000,{},'대성공한 날에는 혼자서도 작은 파티가 열린다.','disco'),
  accessory('acc_029','달팽이 마스코트','epic',38000,{},'늦은 게 아니라 풍경을 오래 보고 있는 중.','snail',{event:'snail-day'}),
  accessory('acc_030','무지개 오리 헬멧','legendary',0,{},'이걸 쓰고 우승하면 아무도 당신을 잊지 못한다.','rainbow',{unlock:'rainbow'}),
  accessory('acc_yu_friend','합동 촬영 노트','epic',0,{danceMastery:.04},'강변에서 맞춘 동작을 두 사람의 필체로 기록한 노트.','dance-note',{unlock:'relationship'}),
  accessory('acc_yu_rival','듀얼 메트로놈','epic',0,{danceMastery:.04},'서로 다른 두 박자를 기억하는 메트로놈.','metronome',{unlock:'relationship'}),
  accessory('acc_yu_partner','듀엣 키링','epic',0,{danceMastery:.04},'카메라가 꺼진 뒤의 한 바퀴를 기억하는 키링.','disco',{unlock:'relationship'}),
  accessory('acc_jun_friend','노컷 아카이브 핀','epic',0,{trickMastery:.04},'준과 함께 만든 실패 영상 보관함의 작은 표식.','sticker',{unlock:'relationship'}),
  accessory('acc_jun_rival','재대결 마커','epic',0,{trickMastery:.04},'다음 승부의 출발선을 표시하는 마커.','led',{unlock:'relationship'}),
  accessory('acc_jun_partner','필름 스트랩','epic',0,{trickMastery:.04},'준이 처음으로 촬영을 쉬기로 한 날 건네준 스트랩.','camera',{unlock:'relationship'}),
];

// These IDs and their original effects are immutable inputs to older competition proofs.
export const LEGACY_BONUSES:Record<string,Partial<Effects>>={
  'deck-flow':{danceLink:.03,practice:.03},'deck-pop':{trickLand:.025},'deck-cruise':{carve:2,speed:2},'trucks-carve':{carve:4},'trucks-soft':{danceLink:.02,trickLand:.01},'wheels-grip':{carve:3,practice:.04},'wheels-slide':{trickLand:.02,speed:1},'bearings-quiet':{speed:4},'bearings-endurance':{fatigue:2},
};
const old=(id:string,slot:GearSlot,name:string,price:number,stats:Gear['stats'],effects:Gear['effects'],description:string,design?:number):Gear=>({id,slot,name,price,stats,effects,description,design,rarity:'rare',legacy:true});
const ORIGINAL_LEGACY_GEAR:Gear[]=[
  old('deck-flow','deck','리버 플로우 데크',94000,{link:3,balance:1},{danceLink:.03,practice:.03},'이전 장비 · 연계·밸런스 보정과 연마·댄싱 연계 효과를 보존합니다.',1),
  old('deck-pop','deck','킥테일 팝 데크',98000,{link:1,balance:3},{trickLand:.025},'이전 장비 · 트릭 성공 효과를 보존한 하이브리드 데크.',2),
  old('deck-cruise','deck','선셋 올데이 데크',85000,{link:2,balance:2},{},'이전 장비 · 옛 주행 보정을 데크의 연계·밸런스로 변환했습니다.',3),
  old('trucks-carve','trucks','아크 트럭',75000,{carve:4},{},'이전 장비 · 카빙 보정을 기본 스탯과 분리합니다.'),
  old('trucks-soft','trucks','플로트 트럭',71000,{carve:2},{danceLink:.02,trickLand:.01},'이전 장비 · 연계·착지 특성을 함께 보존합니다.'),
  old('wheels-grip','wheels','코너 그립 휠',68000,{speed:3},{practice:.04},'이전 장비 · 휠의 속도 보정과 연마 효과를 보존합니다.'),
  old('wheels-slide','wheels','스냅 휠',72000,{speed:1},{trickLand:.02},'이전 장비 · 트릭 착지 효과를 보존합니다.'),
  old('bearings-quiet','accessory','새벽 베어링',60000,{}, {speed:4},'이전 베어링 → 액세서리 · 속도 채점 +4 호환 효과. 새 행운의 베어링과 별개입니다.'),
  old('bearings-endurance','accessory','마일 베어링',65000,{}, {fatigue:2},'이전 베어링 → 액세서리 · 종목당 체력 소모 −2 효과를 보존합니다.'),
];
// Keep original purchase values for resale of items owned before this price update.
export const PREVIOUS_PRICES:Record<string,number>=Object.fromEntries([...ORIGINAL_GEAR,...ORIGINAL_LEGACY_GEAR].map(item=>[item.id,item.price]));
const BASIC_PRICES:Record<string,number>={
  deck_002:28000,deck_003:90000,deck_004:160000,deck_005:320000,deck_006:850000,deck_007:850000,deck_008:3200000,
  truck_002:35000,truck_003:90000,truck_004:220000,truck_005:600000,truck_006:1100000,truck_007:2200000,
  wheel_002:28000,wheel_003:85000,wheel_004:210000,wheel_005:620000,wheel_006:1150000,wheel_007:2400000,
};
export const NEW_GEAR:Gear[]=ORIGINAL_GEAR.map(item=>({...item,price:BASIC_PRICES[item.id]??Math.round(item.price*({common:1.5,rare:3,epic:5,legendary:5}[item.rarity])/1000)*1000}));
export const LEGACY_GEAR:Gear[]=ORIGINAL_LEGACY_GEAR.map(item=>({...item,price:item.price*4}));
export const GEAR=[...NEW_GEAR,...LEGACY_GEAR];
export const ITEM=new Map(GEAR.map(item=>[item.id,item]));
