import { calendarFor, meetById } from './data.js';
import { activePartners, elapsed, formerPartners, hasFlag, name, STORY_NPCS, storyLog, storyProgress, type StoryNpc } from './storyState.js';
import type { Rider } from './types.js';

export type Happening = {
  id:string; happening:true; title:string; text:string|((r:Rider)=>string);
  cast:(r:Rider)=>string[]; when:(r:Rider)=>boolean;
  relation?:{npc:string;points:number}; energy?:number;
};
type Text=Happening['text'];
type Gate=Happening['when'];
const rank=(level:number)=>[15,35,60,80][level-1];
function personal(npc:StoryNpc,level:number,title:string,text:Text,when:Gate=()=>true,points=0,energy=0):Happening{
  return {id:'happening-'+npc+'-'+level,happening:true,title,text,cast:()=>[npc],
    when:r=>(r.relations[npc]??0)>=rank(level)&&when(r),relation:points?{npc,points}:undefined,energy};
}
const crew=(id:number,title:string,text:Text,when:Gate,cast:Happening['cast'],relation?:Happening['relation']):Happening=>
  ({id:'happening-crew-'+id,happening:true,title,text,when,cast,relation});
const at=(spot:Rider['spot']):Gate=>r=>r.spot===spot;
const close=(r:Rider,npc:string)=>['friend','partner'].includes(storyProgress(r,npc)?.state??'');
const friendly=(r:Rider,affinity:number)=>STORY_NPCS.filter(npc=>(r.relations[npc]??0)>=affinity);
const quietEx=(r:Rider)=>formerPartners(r).find(npc=>!hasFlag(r,npc,'exposed-lie')&&!hasFlag(r,npc,'betrayed'));
const privatePartner=(r:Rider)=>activePartners(r).find(npc=>storyProgress(r,npc)?.mode!=='public');
const latestMeet=(r:Rider)=>r.records.findLast(meet=>meet.year===r.year&&meet.results.length);
const recentMeet=(r:Rider)=>r.week-(meetById(latestMeet(r)?.id)?.week??-100)<=2;

export const HAPPENINGS:Happening[]=[
  personal('min',1,'같은 볼트, 다른 이유','민재가 오른쪽 볼트가 지난주보다 느슨해졌다고 말한다. 공구를 꺼냈지만 먼저 물었다. “봐줘도 돼?”',at('park'),1),
  personal('min',2,'체크리스트의 낙서','빽빽한 훈련 노트 귀퉁이에 네 웃는 얼굴이 그려져 있다. 민재는 집중력 측정용이라고 말하며 급히 페이지를 넘겼다.',r=>!activePartners(r).includes('min'),1),
  personal('min',3,'계획표의 빈칸','민재가 계획표를 보여 줬다. 그날에는 처음으로 ‘네가 원하는 대로’라고 적힌 빈칸이 있었다.',r=>close(r,'min')&&hasFlag(r,'min','agreed-boundaries'),2),
  personal('min',4,'수정테이프 자국','지운 글씨가 옛 체크리스트에 남았다. “예전엔 네 대신 답을 써 놨더라. 이제 묻는 연습을 하는 중이야.”',r=>hasFlag(r,'min','accountability')&&hasFlag(r,'min','agreed-boundaries')),
  personal('sol',1,'커피 두 잔의 미스터리','솔이 두 잔을 내밀었다. “하나는 내 거고, 하나는 내 최애 라이더 거.” 네가 손을 뻗자 묻지도 않는다며 웃었다.',at('park'),1),
  personal('sol',2,'진짜 웃긴 사람','솔이 보드에서 떨어지는 시늉을 했다. 네가 웃자 “아, 저 표정 보려고 그랬구나”라고 혼잣말하다 들켰다.',undefined,1),
  personal('sol',3,'잠든 선배의 본심','잠깐 졸던 솔이 다치지 말라고 중얼거렸다. 깨어나서는 네가 들은 건 코 고는 소리 아니냐고 능청을 떨었다.',at('studio'),2),
  personal('sol',4,'두 번째 커피의 이름',r=>activePartners(r).includes('sol')?
    '직원이 늘 같이 오는 분의 주문을 묻자 솔이 농담 없이 답했다. “네, 제 연인이 좋아하는 걸로요.”':
    '직원이 늘 같이 오는 분의 주문을 묻자 솔이 웃으며 답했다. “네, 제 친구가 좋아하는 걸로요.”',r=>close(r,'sol')),
  personal('jun',1,'봤지? 봤지?','준이 착지에 성공하고 보드보다 먼저 달려왔다. “봤지? 이번엔 제대로 했지?” 대답을 듣기 전부터 신이 났다.',r=>r.spot==='plaza'||r.spot==='night',1),
  personal('jun',2,'꼬리 없는 강아지','네가 다른 라이더와 이야기하자 준이 스팟을 세 바퀴 돌았다. “질투? 내가?” 휴대폰은 거꾸로 든 채였다.',undefined,1),
  personal('jun',3,'영상 제목을 바꿨다','영상 폴더 이름이 ‘오늘 내가 제일 잘함’에서 ‘우리 오늘 제일 잘함’으로 바뀌었다. 준은 협업 영상이라서 그렇다고 얼른 덧붙였다.',undefined,2),
  personal('jun',4,'비밀로 하기로 했잖아','준이 크루 앞에서 도시락을 자랑하다 말을 멈췄다. “이거 우리 애인이…” 준은 아무도 눈치채지 못한 것처럼 다른 반찬을 가리켰다.',r=>activePartners(r).includes('jun')&&storyProgress(r,'jun')?.mode!=='public'),
  personal('ha',1,'남는 물병이라서','하린이 새 물병을 툭 건넸다. “하나 더 샀거든. 너 주려고 산 건 아니고.” 병 옆에 네 이름이 적혀 있었다.',at('river'),0,4),
  personal('ha',2,'우연히 같은 신발','하린은 같은 신발을 고른 건 우연이라고 했다. 상자 안쪽에는 ‘같이 타면 좋을까?’라고 적힌 메모가 붙어 있었다.',undefined,1),
  personal('ha',3,'응원은 아니라니까','하린이 관중석 끝에서 가장 크게 손뼉을 쳤다. 눈이 마주치자 원래 박수를 크게 치는 편이라며 팔짱을 꼈다.',recentMeet,2),
  personal('ha',4,'시계 없는 한 바퀴','하린은 오늘은 네 속도에 맞추겠다며 시계를 가방에 넣었다. 그러고는 한 바퀴도 지나기 전에 추월했다.',at('park')),
  personal('noa',1,'카메라에 담기지 않은 컷','노아의 카메라에는 실패하고 웃는 모습이 더 많이 담겨 있었다. “그때 표정이 좋았어.” 노아는 영상을 보관해도 되는지 물었다.',at('night'),1),
  personal('noa',2,'마지막 접속 시간','노아는 메시지 창을 열었다 닫았다. 여러 번 고쳐 쓰다가 결국 “오늘도 타?” 한 문장만 보냈다.',undefined,1),
  personal('noa',3,'사진에서 나만 없어?','사진을 보던 노아가 자기는 왜 옆에 없냐고 묻다가 잠깐 멈췄다. “미안, 괜히 신경이 쓰였어.” 이번에는 자리를 바꿔 달라고 하지는 않았다.',r=>friendly(r,15).length>=3,1),
  personal('noa',4,'네온 아래 한 칸','노아가 화면을 끄고 말했다. “모든 걸 바로 확인하지 않아도 괜찮다는 걸 조금씩 배우고 있어.” 둘은 조용히 동시에 보드를 밀었다.',r=>hasFlag(r,'noa','clear-boundary')&&(hasFlag(r,'noa','heard')||hasFlag(r,'noa','supported'))),
  personal('yu',1,'간식은 여덟 명분','유리는 한 명 더 온다며 여덟 명분의 간식을 가져왔다. 온 사람이 일곱인 걸 알자 운동하면 배가 고프니까 괜찮다고 웃었다.',at('river'),0,4),
  personal('yu',2,'같은 박자에 웃었다','같은 스텝을 밟다 동시에 넘어질 뻔했다. “괜찮아?” 두 사람은 인사까지 박자가 같아서 또 웃었다.',undefined,1),
  personal('yu',3,'웃지 않아도 괜찮아','경기가 잘 풀리지 않은 날 유리는 말없이 강물을 봤다. “다들 내가 웃으면 괜찮은 줄 알아.” 오늘은 처음으로 힘든 점도 말해 줬다.',r=>recentMeet(r)&&(latestMeet(r)?.results.every(result=>(result.standings.find(row=>row.id==='player')?.place??0)>3)??false),2),
  personal('yu',4,'먼저 손 흔드는 사람',r=>activePartners(r).includes('yu')?
    '멀리서 유리가 먼저 손을 흔들었다. “오늘은 내가 제일 먼저 찾았지?” 가까워져서는 다음에도 계속 찾아도 되냐고 물었다.':
    '멀리서 유리가 먼저 손을 흔들었다. “오늘은 내가 제일 먼저 찾았지?” 크루가 모이자 두 사람은 첫 곡을 틀었다.',r=>r.year>=6),
  crew(1,'단톡방의 오타','준이 오늘 ‘훈련’을 ‘혼란’으로 잘못 적었다. 솔은 아무것도 수정하지 말라며 오늘 일정이 맞다고 답했다.',r=>friendly(r,15).length>=2,()=>['jun','sol']),
  crew(2,'셋이 한 프레임에','유리가 셋이 같이 찍자며 휴대폰을 세웠다. 사진에는 안 찍겠다고 하던 하린이 가장 앞에 서 있었다.',r=>r.relations.yu>=35&&r.relations.ha>=35,()=>['yu','ha'],{npc:'ha',points:1}),
  crew(3,'무지개 비상대책','소나기가 쏟아지자 민재는 우비를, 솔은 커피를 챙겼다. 준이 가장 끝에서 빗속에 있던 고양이도 데리고 들어왔다.',r=>r.spot==='studio'&&friendly(r,15).length>=2,()=>['min','sol','jun']),
  crew(4,'귓속말은 비밀이 아니다','유리와 솔이 한참 네 얘기를 하다가 눈이 마주쳤다. 둘 다 아무 일도 없었던 것처럼 지나치게 밝게 인사했다.',r=>friendly(r,28).length>=3,()=>['yu','sol']),
  crew(5,'우리 사이에 무슨 일?',r=>name(quietEx(r)!)+'와 같은 스팟에서 마주쳤다. 둘 다 먼저 양보하겠다며 서로 다른 방향을 가리켰고, 잠시 뒤 그냥 웃고 지나갔다.',r=>!!quietEx(r),r=>[quietEx(r)!]),
  crew(6,'비밀 연애인데 티가 난다',r=>name(privatePartner(r)!)+'가 자연스럽게 네 컵에 빨대를 꽂아 줬다. 크루는 잠깐 고개를 들었다가 각자 주문한 음료를 마셨다.',r=>!!privatePartner(r),r=>[privatePartner(r)!]),
  crew(7,'이상하게 조용한 날','누군가 단톡방이 조용하다고 말하자 테이블에 있던 사람들이 동시에 휴대폰을 뒤집었다. 솔이 아무렇지 않은 척 두 번째 커피를 주문했다.',r=>activePartners(r).length>1||storyLog(r).some(entry=>entry.id==='cross-01'),r=>[...activePartners(r),'sol']),
  crew(8,'마지막 연습 사진',r=>formerPartners(r).length?
    '마지막 연습에서 각자 편한 자리에 섰다. 예전에 같이 타던 사람들과도 무리 없이 같은 풍경을 한 장 남겼다.':
    '마지막 연습에서 각자 다른 포즈를 골랐다. 사진에는 보드보다 웃음을 참느라 실패한 얼굴이 더 많았다.',r=>r.year>=7&&!!r.events['career-masters-start'],r=>friendly(r,15).slice(0,4)),
];

export const HAPPENING=new Map(HAPPENINGS.map(event=>[event.id,event]));
export const happeningDuration=(text:string)=>Math.max(3200,Math.min(5600,text.length*46));
export function pickHappening(r:Rider,afterMeet=false){
  if(!afterMeet&&calendarFor(r.year).some(meet=>meet.week===r.week))return undefined;
  const seen=storyLog(r).filter(entry=>HAPPENING.has(entry.id));
  if(seen.length&&elapsed(r,seen.at(-1)!.id)<5)return undefined;
  const candidates=HAPPENINGS.filter(event=>!r.events[event.id]&&event.when(r)&&
    event.cast(r).every(npc=>!seen.some(entry=>entry.npcs.includes(npc)&&elapsed(r,entry.id)<8)));
  const count=(event:Happening)=>event.cast(r).reduce((n,npc)=>n+seen.filter(entry=>entry.npcs.includes(npc)).length,0);
  return candidates.sort((a,b)=>count(a)-count(b))[0];
}
