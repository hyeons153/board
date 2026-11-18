import { CALENDAR } from './data.js';
import { extras, playerPlace, STARTER_IDS } from './economy.js';
import type { Rider } from './types.js';
import type { EventDef } from './events.js';

const at = (spot:Rider['spot']) => (r:Rider) => r.spot===spot;
const chosen = (r:Rider,id:string,index:number) => extras(r).choices[id]?.index===index;
const placed = (r:Rider) => r.records.some(m=>m.results.length);
const weekOfMeet = (r:Rider) => CALENDAR.some(m=>m.week===r.week);
const choice = (label:EventDef['choices'][number]['label'],effect:EventDef['choices'][number]['effect'],...tags:EventDef['choices'][number]['tags']):EventDef['choices'][number] => ({label,effect,tags});

export const EXTRA_EVENTS: EventDef[] = [
  {id:'yu-open-final',kind:'라이벌 결말',npc:'yu',title:'바퀴 소리로 남은 박자',body:'유리가 예전 합동 영상의 소리를 재생했다. 오픈부 관중석 뒤에서도 둘은 같은 타이밍에 웃었다.',
    story:true,important:true,when:r=>r.year>=6&&r.week===25&&!!r.events['yu-rematch'],choices:[
      choice('마지막 연계를 함께 맞춘다',{relation:12,stat:'link',gain:2},'dance','freestyle'),
      choice('각자의 라인으로 답한다',{relation:9,fame:6},'balanced','trick')]},
  {id:'jun-open-final',kind:'라이벌 결말',npc:'jun',title:'편집 없이 남긴 영상',body:'준이 오늘 영상은 앞뒤를 하나도 자르지 않겠다고 했다. 그동안의 실패가 없었다면 첫 장면도 없었다고.',
    story:true,important:true,when:r=>r.year>=7&&r.week===46&&!!r.events['jun-jam'],choices:[
      choice('다음 세대에게 영상부터 건넨다',{relation:13,fame:5},'trick','freestyle'),
      choice('카메라를 내려놓고 함께 탄다',{relation:9,energy:14},'balanced','dance')]},
  {id:'harin-lap',kind:'첫 만남',npc:'ha',title:'강변의 메트로놈',body:'하린은 보이지 않는 박자에 발을 맞춘다. 손목시계에서는 러닝 알림이 울린다.',when:r=>r.week>=3&&r.spot==='river',choices:[
    choice('박자에 맞춰 따라간다',{relation:9,stat:'carve',gain:2,energy:-4},'dance','freestyle'),
    choice('함께 강변을 한 바퀴 돈다',{relation:5,stat:'speed',gain:2},'balanced','trick')]},
  {id:'harin-route',kind:'합동 훈련',npc:'ha',title:'돌아오는 발걸음',body:'하린이 같은 스텝을 뒤로 밟아 보자고 한다. 손목시계는 재촉하지 않기로 했다.',story:true,important:true,when:r=>r.week>=14&&r.spot==='river'&&chosen(r,'harin-lap',0)&&(r.relations.ha??0)>=9,choices:[
    choice('백워드 크로스스텝을 배운다',{skill:'back-cross',study:100,energy:-6,relation:8},'dance','freestyle'),
    choice('코스의 곡선을 먼저 익힌다',{stat:'carve',gain:3,relation:6},'balanced','trick')]},
  {id:'harin-coach',kind:'관계',npc:'ha',title:'시계 없이 달리기',body:'오늘 하린은 시계를 두고 나왔다. 속도를 기록하는 대신, 언제 풍경이 달라지는지 말해 달라고 한다.',when:r=>r.spot==='park'&&chosen(r,'harin-lap',1),choices:[
    choice('오르막 전에 호흡을 맞춘다',{stat:'speed',gain:3,relation:8},'balanced','trick'),
    choice('나무 그림자에서 쉰다',{energy:16,relation:6},'dance','freestyle')]},
  {id:'min-checklist',kind:'첫 만남',npc:'min',title:'볼트 여덟 개, 체크 아홉 개',body:'민재의 점검표에는 미소 짓기까지 적혀 있다. 마지막 칸만 비어 있다.',when:at('park'),choices:[
    choice('점검을 같이 해 본다',{stat:'balance',gain:2,relation:9},'balanced','trick'),
    choice('마지막 칸을 체크해 준다',{energy:10,relation:7},'dance','freestyle')]},
  {id:'min-metronome',kind:'집중 훈련',npc:'min',title:'한 번 더보다 한 번 제대로',body:'민재가 대회장에서 쓰던 메트로놈을 가져왔다. 가장 어려운 기술부터 해 보라던 지난주의 말을 오늘은 거둔다.',when:r=>r.spot==='arena'&&!!r.events['min-checklist'],choices:[
    choice('안정적으로 첫 연계를 맞춘다',{stat:'link',gain:3,relation:9},'balanced','dance'),
    choice('중간 전환을 새로 설계한다',{stat:'balance',gain:2,relation:6},'freestyle','trick')]},
  {id:'min-race',kind:'라이벌',npc:'min',title:'첫 승부, 악수 먼저',body:'민재가 지난 대회의 기록지를 들고 왔다. 근소한 차이가 재미있었던 건 처음이라고 한다.',story:true,important:true,when:r=>r.week>=21&&placed(r)&&!!r.events['min-metronome'],choices:[
    choice('다음 대회를 기약하며 내기한다',{relation:13,fame:3,stat:'link',gain:2},'trick','freestyle'),
    choice('서로의 라인을 함께 본다',{relation:10,energy:11},'dance','balanced')]},
  {id:'neon-invite',kind:'스팟 해금',npc:'noa',title:'광장 불이 꺼진 뒤',body:'노아가 밤에 파란 조명이 들어오는 광장의 위치를 알려 준다. “11시 이후라면 실패도 전부 내 편이야.”',story:true,when:r=>r.week>=10&&r.spot==='plaza',choices:[
    choice('야간 잼에 같이 간다',{relation:10,stat:'balance',gain:2},'trick','freestyle'),
    choice('다음에 갈 위치를 기록한다',{relation:6,energy:8},'balanced','dance')]},
  {id:'noa-pop',kind:'기술 습득',npc:'noa',title:'조명 아래서 도는 데크',body:'실패 영상을 스무 번 본 노아가 발끝 위치 한 곳에 빨간 점을 찍었다.',story:true,important:true,when:r=>r.spot==='night'&&r.week>=15&&chosen(r,'neon-invite',0),choices:[
    choice('팝샤빗을 프레임 단위로 배운다',{skill:'pop-shuvit',study:100,energy:-7,relation:9},'trick','freestyle'),
    choice('착지만 느리게 반복한다',{stat:'balance',gain:3,relation:7},'balanced','dance')]},
  {id:'noa-crew',kind:'라이벌',npc:'noa',title:'카메라를 끄고 한 번만',body:'노아가 카메라 배터리를 뺐다. 오늘만큼은 기록할 사람 대신 함께 탈 사람이 필요하다.',when:r=>r.spot==='night'&&!!r.events['noa-pop'],choices:[
    choice('번갈아 시그니처를 시도한다',{relation:11,energy:-7,fame:3},'trick','freestyle'),
    choice('실패한 뒤의 동작을 분석한다',{stat:'link',gain:2,relation:8},'balanced','dance')]},
  {id:'yu-film',kind:'라이벌',npc:'yu',title:'박자가 다른 두 사람',body:'유리는 안무를 맞췄지만 네가 고른 박자를 다시 듣고 싶어 한다.',story:true,important:true,when:r=>r.week>=17&&!!r.events['mango-lesson']&&r.spot==='river',choices:[
    choice('다른 템포로 대결하자고 한다',{relation:11,fame:4,stat:'link',gain:2},'dance','freestyle'),
    choice('두 가지 버전으로 합동 영상을 찍는다',{relation:8,money:18_000},'balanced','trick')]},
  {id:'yu-rematch',kind:'대회 재회',npc:'yu',title:'그때와 다른 박자',body:'유리는 예전의 대결 영상을 휴대폰에 남겨 두었다. 다음 시합에서는 네 템포에 먼저 맞춰 보겠다고 한다.',story:true,important:true,when:r=>r.year>=2&&weekOfMeet(r)&&chosen(r,'yu-film',0),choices:[
    choice('같은 스텝으로 결승에서 만난다',{relation:14,fame:6},'dance','freestyle'),
    choice('서로 다른 첫 기술을 약속한다',{relation:9,energy:15},'balanced','trick')]},
  {id:'jun-jam',kind:'라이벌 선언',npc:'jun',title:'일곱 번째 착지',body:'준은 폴더 이름을 실패에서 라이벌전으로 바꿨다. 다음 파일은 네가 먼저 찍어 달라고 한다.',story:true,important:true,when:r=>r.week>=16&&r.spot==='night'&&!!r.events['juns-clip'],choices:[
    choice('트릭으로 정식 대결을 신청한다',{relation:12,fame:4},'trick','freestyle'),
    choice('오늘은 카메라 뒤에 선다',{relation:7,stat:'link',gain:3},'balanced','dance')]},
  {id:'jun-quiet',kind:'관계',npc:'jun',title:'큰 소리 없이 착지하는 법',body:'준이 한동안 슬로모션 편집을 쉬었다. 화면 밖의 바퀴 소리도 이제는 꽤 마음에 든다고 한다.',when:r=>r.spot==='plaza'&&chosen(r,'jun-jam',1),choices:[
    choice('노컴플라이를 조용히 반복한다',{skill:'no-comply',study:20,relation:9},'trick','freestyle'),
    choice('발을 얹는 리듬부터 맞춘다',{stat:'link',gain:3,relation:8},'balanced','dance')]},
  {id:'sol-arena',kind:'대회 전',npc:'sol',title:'결승까지 남은 60초',body:'솔이 시작선을 턱으로 가리킨다. 오늘은 네가 라인의 첫 기술을 고를 차례다.',when:r=>r.spot==='arena'&&placed(r),choices:[
    choice('첫 기술 이후 전환을 연습한다',{stat:'link',gain:4,energy:-4,relation:8},'freestyle','dance'),
    choice('호흡부터 고르고 출발한다',{energy:15,relation:5},'balanced','trick')]},
  {id:'sol-veteran',kind:'경력',npc:'sol',title:'새 번호표, 낡은 보드',body:'솔은 새 선수 이름을 네게 먼저 물어본다. 이제 네가 그들을 처음 맞이할 차례인지도 모른다.',story:true,when:r=>r.year>=3&&r.week<=3,choices:[
    choice('처음 타는 선수와 연습한다',{relation:9,fame:5,stat:'balance',gain:2},'balanced','dance'),
    choice('오픈부 라인을 보여 준다',{relation:7,fame:7,energy:-4},'freestyle','trick')]},
  {id:'snack-run',kind:'일상',title:'편의점 봉지의 무게',body:'두 손 가득 간식을 샀더니 보드를 잡을 손이 사라졌다. 보드보다 새우깡이 먼저 출발한다.',when:r=>r.spot==='plaza'||r.spot==='night',choices:[
    choice('간식을 크루에 나눈다',{energy:15,money:-3_000},'balanced','dance'),
    choice('편의점 앞에서 밸런스를 잡는다',{stat:'balance',gain:2},'trick','freestyle')]},
  {id:'packed-studio',kind:'스팟',npc:'noa',title:'거울에 비친 다섯 번째 라이더',body:'연습장의 거울이 워낙 깨끗해 서로 부딪칠 뻔했다. 노아가 거울 속 라이더에게 먼저 사과했다.',when:at('studio'),choices:[
    choice('거울을 보며 발끝을 맞춘다',{stat:'balance',gain:3,relation:5},'trick','balanced'),
    choice('거울 없이 한 번 더 탄다',{stat:'link',gain:3,relation:5},'freestyle','dance')]},
  {id:'board-tune',kind:'장비',npc:'min',title:'딸깍, 휘파람, 침묵',body:'새 장비에서 나던 소리를 민재가 잡아냈다. 원인은 베어링이 아니라 바지 지퍼였다.',when:r=>extras(r).inventory.some(id=>!STARTER_IDS.includes(id)),choices:[
    choice('장비도 함께 점검한다',{stat:'balance',gain:2,relation:7},'trick','freestyle'),
    choice('지퍼를 고치고 쉰다',{energy:16,relation:4},'balanced','dance')]},
  {id:'brand-photos',kind:'스폰서',title:'브랜드 화보에 없는 포즈',body:'첫 촬영에서 넘어지기 직전의 표정이 제일 자연스럽다는 피드백을 받았다.',story:true,when:r=>!!extras(r).contract,choices:[
    choice('보드를 타면서 촬영한다',{money:19_000,fame:3,energy:-5},'dance','freestyle'),
    choice('장비 세팅을 직접 소개한다',{money:13_000,fame:2,stat:'balance',gain:1},'balanced','trick')]},
  {id:'injury-kit',kind:'부상·회복',npc:'min',title:'파란 테이프가 남긴 자리',body:'민재가 테이프를 건네며 오늘은 영상 한 편만 보자고 한다. 연습복 대신 담요도 가져왔다.',story:true,when:r=>!!r.injury,choices:[
    choice('얼음찜질을 하면서 라인을 본다',{energy:18,relation:7},'balanced','dance'),
    choice('앉아서 전환 동작을 적어 둔다',{energy:8,stat:'link',gain:2,relation:6},'trick','freestyle')]},
  {id:'back-on-board',kind:'부상·회복',npc:'sol',title:'처음 푸시하던 날처럼',body:'솔은 복귀 첫날에 어려운 동작 대신 한 번만 밀어 보라고 했다. 바퀴를 굴리는 소리가 유난히 크게 들린다.',when:r=>!r.injury&&!!r.events['injury-kit'],choices:[
    choice('편한 속도로 끝까지 탄다',{stat:'speed',gain:2,relation:6},'balanced','dance'),
    choice('넘어진 지점에 테이프를 붙인다',{stat:'balance',gain:2,relation:6},'freestyle','trick')]},
  {id:'first-board-photo',kind:'대회 후',npc:'ha',title:'첫 결과표에 접힌 모서리',body:'하린이 첫 대회 결과표를 펴서 손바닥으로 모서리를 문지른다.',when:placed,choices:[
    choice('다음 대회 목표를 뒤에 적는다',{fame:2,relation:6,stat:'carve',gain:1},'dance','freestyle'),
    choice('결과표 사이에 참가 핀을 끼운다',{energy:12,relation:5},'balanced','trick')]},
  {id:'podium-crew',kind:'성장',npc:'sol',title:'셋이 들어가야 하는 사진',body:'상을 받은 다음 날인데도 단체 사진에는 아무도 카메라를 보고 있지 않다. 다시 찍는데 한참 걸렸다.',when:r=>r.records.some(m=>m.results.some(res=>playerPlace(res)<=3)),choices:[
    choice('다음 대회엔 세 종목에 도전한다',{fame:4,relation:6},'freestyle','trick'),
    choice('크루에 고맙다고 말한다',{energy:14,relation:9},'balanced','dance')]},
  {id:'last-light',kind:'일상',title:'가로등이 켜지고 나면',body:'한 주의 마지막 푸시를 할 때, 강변 가로등이 차례로 불을 켰다. 내일 할 일은 일단 내일의 네게 맡겨 두었다.',repeat:true,when:r=>r.spot==='river'&&r.week>=6,choices:[
    choice('짧게 한 바퀴 돌고 간다',{stat:'speed',gain:2,energy:-3},'trick','freestyle'),
    choice('조명 아래 스트레칭한다',{energy:13},'balanced','dance')]},
];
