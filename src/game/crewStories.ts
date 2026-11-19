import { activePartners, change, chosen, elapsed, formerPartners, hasFlag, name, option, record, scene, STORY_NPCS, storyProgress, type StoryNpc } from './storyState.js';
import type { Rider } from './types.js';
import type { EventDef } from './events.js';

const cross=(number:number,title:string,body:EventDef['body'],when:EventDef['when'],cast:NonNullable<EventDef['cast']>,choices:EventDef['choices'],decision=true)=>
  scene('cross-'+String(number).padStart(2,'0'),title,body,when,choices,{cast,decision,kind:'크루 이야기',finale:number===12});
const pending=(r:Rider)=>STORY_NPCS.find(npc=>storyProgress(r,npc)?.state==='interested'&&hasFlag(r,npc,'overlap-requested'));
const hidden=(r:Rider)=>activePartners(r).some(npc=>storyProgress(r,npc)?.mode==='secret');
const lead=(r:Rider)=>activePartners(r)[0]??'yu';
const known=(r:Rider)=>STORY_NPCS.filter(npc=>r.relations[npc]>=8||storyProgress(r,npc));
const rivalry=(r:Rider)=>STORY_NPCS.find(npc=>storyProgress(r,npc)?.state==='rival');
const rejected=(r:Rider)=>STORY_NPCS.find(npc=>hasFlag(r,npc,'rejected'));
const outOfTouch=(r:Rider)=>activePartners(r).find(npc=>npc!=='noa'&&(hasFlag(r,npc,'distance')||hasFlag(r,npc,'hurt-on-camera')));
const booking=(r:Rider)=>formerPartners(r).find(npc=>hasFlag(r,npc,'photo-booked'));
const paired=(r:Rider)=>r.extras?.relationships?.couples?.find(pair=>pair.some(npc=>formerPartners(r).some(ex=>ex===npc)));
const peers:Record<StoryNpc,StoryNpc>={yu:'ha',ha:'yu',jun:'noa',noa:'jun',sol:'min',min:'sol'};
const newPair=(r:Rider)=>formerPartners(r).map(npc=>[npc,peers[npc]] as [StoryNpc,StoryNpc])
  .find(pair=>!pair.some(npc=>activePartners(r).includes(npc)||r.extras?.relationships?.couples?.some(couple=>couple.includes(npc))));
const linkedTeacher=(r:Rider)=>paired(r)?.find(npc=>!formerPartners(r).some(ex=>ex===npc));
const reviewLead=(r:Rider)=>activePartners(r)[0]??rivalry(r);
const finalCast=(r:Rider)=>[...new Set([...activePartners(r),...formerPartners(r),...known(r)])].slice(0,6);

export const CREW_STORIES:EventDef[]=[
  scene('crew-overlap','두 사람에게 할 말','새로 가까워진 사람과는 서로 마음을 확인했다. 이미 맺은 약속에 대해 어떻게 말할지 두 사람을 만나기 전에 정해야 한다.',
    r=>r.year>=3&&activePartners(r).length===1&&!!pending(r),[
      option('두 사람에게 먼저 알리고 각자의 대답을 기다린다.','가까워진 두 사람 모두 자기 뜻을 말할 시간을 가졌다.',r=>{
        const next=pending(r)!,current=lead(r);
        const accepts=STORY_NPCS.filter(npc=>hasFlag(r,npc,'clear-boundary')||hasFlag(r,npc,'agreed-boundaries')||hasFlag(r,npc,'privacy')||hasFlag(r,npc,'respect')||hasFlag(r,npc,'checked-facts'));
        if(![current,next].every(npc=>accepts.includes(npc)&&r.relations[npc]>=12))
          return {changes:[change(next,'friend','overlap-declined')],dialogue:'두 사람 중 한 명이 여러 관계에는 동의할 수 없다고 답했다. 새 교제는 시작하지 않았다.'};
        return {...storyProgress(r,next)?.pendingReward,changes:[change(current,'partner','shared-agreement','agreed'),change(next,'partner','shared-agreement','agreed')],dialogue:'두 사람 모두 각자의 조건을 말한 뒤에 동의했다. 누구든 합의를 다시 이야기할 수 있기로 했다.'};
      }),
      option('기존 연인과의 관계를 숨긴 채 새 교제를 시작한다.','새 연인은 네가 다른 교제 약속이 없다고 한 말을 믿었다.',r=>({ ...storyProgress(r,pending(r)!)?.pendingReward,changes:[change(pending(r)!,'partner','concealed-overlap','secret')]})),
      option('새 교제는 시작하지 않고 각자의 관계를 존중한다.','새로 가까워진 사람은 마음을 솔직히 말해 준 데 고마워했다.',r=>record(pending(r)!,'overlap-declined','friend')),
    ],{kind:'관계 선택',decision:true,cast:r=>[...activePartners(r),...(pending(r)?[pending(r)!]:[])]}),
  scene('crew-photo-booking','브랜드에서 온 촬영 제안','브랜드가 둘이 보드를 타는 사진을 커플 화보로 쓰고 싶다고 한다. 당사자끼리 먼저 상의할 수 있다.',
    r=>r.year>=4&&!!r.extras?.contract&&activePartners(r).length===1,[
      option('연인과 상의한 뒤 둘이 동의한 화보를 예약한다.','브랜드는 두 사람에게 촬영 일정을 보냈다.',r=>record(lead(r),'photo-booked')),
      option('커플 촬영은 거절하고 선수 개인 화보를 찍는다.','모델 대신 오늘 배운 기술이 브랜드 사진에 남았다.',{}, {fame:2}),
      option('크루 전체가 참여하는 연습 영상으로 바꾼다.','크루의 첫 단체 영상은 보드 소리로 가득했다.',{}, {fame:1}),
    ],{kind:'스폰서 이야기',decision:true,cast:activePartners}),
  scene('crew-npc-pair','같은 팀에서 만난 두 사람',r=>{
    const [a,b]=newPair(r)!;return name(a)+'와 '+name(b)+'는 한동안 합동 라인을 짜다가 교제하게 됐다고 직접 알렸다. 새 관계는 두 사람이 먼저 정한 일이다.';
  },r=>r.year>=5&&!!newPair(r),[
    option('직접 알려 줘서 고맙다고 하고 축하한다.','두 사람은 예전 일과 새 관계를 서로 존중하겠다고 말했다.',r=>({couple:newPair(r)})),
    option('두 사람이 편하도록 당분간 거리를 둔다.','그날 연습은 각자 했고 대회에서는 평소처럼 인사했다.',r=>({couple:newPair(r)})),
    option('셋이 어색하지 않게 기술 이야기부터 한다.','보드 세팅 얘기를 시작하자 긴 침묵이 깨졌다.',r=>({couple:newPair(r)})),
  ],{kind:'크루 이야기',decision:true,cast:r=>newPair(r)??[]}),

  cross(1,'강변의 삼자대면',r=>{
    const [a,b]=activePartners(r);return name(a)+'와 '+name(b)+'가 같은 강변 약속에 나왔다. 각자 둘만 만나기로 한 줄 알았다. 둘은 휴대폰을 내려놓고 네 말을 기다렸다.';
  },r=>activePartners(r).length===2&&hidden(r)&&elapsed(r,'crew-overlap')>=3,
  activePartners,[
    option('두 사람에게 사실을 인정하고 사과한다.','두 사람은 사실을 듣고 각자 시간을 갖기로 했다.',r=>({title:'crew-exposed',item:'acc_crew_photo',changes:activePartners(r).map(npc=>change(npc,'ended','betrayed'))})),
    option('우연히 겹친 약속이라며 둘러댄다.','말이 달라진 사실까지 드러났다. 두 사람은 자신들의 뜻으로 관계를 끝냈다.',r=>({title:'crew-exposed',item:'acc_crew_photo',changes:activePartners(r).map(npc=>change(npc,'ended','exposed-lie'))}),{fame:2}),
    option('두 관계를 모두 정리하고 답할 시간을 준다.','누구도 답장을 재촉하지 않았다. 다음 크루 모임은 별도로 열렸다.',r=>({title:'crew-exposed',item:'acc_crew_photo',changes:activePartners(r).map(npc=>change(npc,'ended','apology-offered'))})),
  ]),
  cross(2,'고백도 기술인가요?',r=>name(rejected(r)??rivalry(r)??'jun')+'와 인터뷰 도중 사회자가 두 사람의 관계를 물었다. 예전의 어색한 고백을 알아차린 듯하다. 마이크는 켜져 있다.',
  r=>r.year>=4&&!!rejected(r)&&r.records.some(meet=>meet.results.some(result=>result.standings[0]?.id==='player')),
  r=>[rejected(r)!],[
    option('그때의 진심을 인정하고 상대의 답을 존중한다.','상대는 지나간 일을 공개적으로 설명할 필요는 없다고 편을 들어 줬다.',r=>({title:'crew-confession',...record(rejected(r)!,'answer-respected')})),
    option('당황해서 전부 장난이었다고 말한다.','민망함은 줄었지만 상대는 나중에 왜 그렇게 말했는지 물었다.',r=>({title:'crew-confession',...record(rejected(r)!,'public-misread')})),
    option('다음 경기에서 좋은 라인을 보여 주겠다고 말한다.','상대는 악수를 청하며 자기 라인도 기대하라고 했다.',r=>({title:'crew-confession',...record(rejected(r)!,'public-rival')})),
  ]),
  cross(3,'읽지 않은 메시지 47개',r=>name(outOfTouch(r)??'noa')+'와 연락이 끊겼지만 다음 대회 출전 명단에는 이름이 있었다. 지난번 이야기에 이어 답을 기다릴지 결정해야 한다.',
  r=>r.year>=5&&!!outOfTouch(r),r=>[outOfTouch(r)!],[
    option('경기 뒤 따로 만나 이유를 묻는다.','차분히 이야기할 장소를 정하고 서로 답을 기다리기로 했다.',r=>({title:'noa-missed',...record(outOfTouch(r)!,'asked-after')})),
    option('나도 연락을 멈추고 관계를 마무리한다.','두 사람은 대회장에서 인사할 수 있도록 이별의 뜻을 분명히 했다.',r=>({title:'noa-missed',...record(outOfTouch(r)!,'contact-ended','ended')})),
    option('공통 친구에게 안부만 확인한다.','친구는 상대가 무사하다는 사실만 전했다. 다른 사정은 본인에게 맡겼다.',r=>record(outOfTouch(r)!,'checked-welfare')),
  ]),
  cross(4,'심사위원석의 전 애인',r=>'스폰서의 비공식 초청 시범전 객원 심사위원은 '+name(formerPartners(r)[0])+'였다. 진행자가 두 사람이 아는 사이인지 물었다.',
  r=>r.year>=5&&!!r.extras?.contract&&formerPartners(r).length>0,r=>[formerPartners(r)[0]],[
    option('이해관계를 알리고 심사위원 교체를 요청한다.','순서가 바뀌었고 새 심사위원 앞에서 시범 라인을 탔다.',{title:'crew-judge'}),
    option('함께 연습했던 장면을 떠올리고 시범에 집중한다.','끝나고 서로 고개를 끄덕였다. 공식 대회 점수표와는 별개의 무대였다.',{title:'crew-judge'}),
    option('오늘은 내 라인만 봐 달라고 말한다.','진행자가 분위기를 풀었다. 경기 조건은 참가자 모두에게 같았다.',{title:'crew-judge'},{fame:1}),
  ]),
  cross(5,'헤어진 다음 날 커플 화보',r=>name(booking(r)??'sol')+'와 예약해 둔 화보는 아직 취소되지 않았다. 사진작가의 “조금 더 가까이”에 둘 다 한 발 물러섰다.',
  r=>!!booking(r),r=>[booking(r)!],[
    option('서로 괜찮은 거리에서 예정한 촬영을 마친다.','계약서에는 사진이 남고 둘은 서투른 인사를 나눴다.',{title:'crew-contract',item:'acc_crew_contract'},{money:12_000}),
    option('커플 화보를 라이벌 콘셉트로 바꾼다.','브랜드는 서로 다른 라인이 담긴 시안을 채택했다.',{title:'crew-contract',item:'acc_crew_contract'},{fame:2}),
    option('촬영을 취소하고 개인 화보로 대체한다.','브랜드는 개인 주행 사진을 받았고 두 사람은 부담을 덜었다.',{title:'crew-contract',item:'acc_crew_contract'}),
  ]),
  cross(6,'환승 중 추돌 사고',r=>{
    const pair=paired(r);return '크루방의 데이트 사진에 '+pair!.map(name).join('와 ')+'의 이름이 붙었다. 현재 연인도 같은 장소에 있었다는 말이 도는 바람에 네 이야기가 되어 버렸다.';
  },r=>r.year>=5&&activePartners(r).length>0&&!!paired(r),r=>[...(paired(r)??[]),lead(r),'min'],[
    option('당사자에게 어떤 만남이었는지 확인한다.','사진에는 두 사람의 데이트와 별개의 단체 연습이 뒤섞여 있었다.',r=>record(lead(r),'rumor-cleared')),
    option('지금은 머리를 식히고 나중에 설명을 듣기로 한다.','크루는 사진을 더 공유하지 않고 네가 준비될 때까지 기다렸다.',r=>record(lead(r),'rumor-distance')),
    option('화이트보드에 사진별 날짜와 인원을 적는다.','민재가 화살표 세 개를 지우자 전혀 다른 두 일정이 나왔다.',r=>record(lead(r),'timeline-board')),
  ]),
  cross(7,'전 연인의 현 애인이 내 트릭 선생님',r=>name(linkedTeacher(r)??'jun')+'가 시범 도중 “이거 그 사람이 잘했는데”라고 했다. 어느 사람인지는 굳이 확인할 필요도 없었다.',
  r=>!!linkedTeacher(r)&&!!r.lastPlan?.lesson&&!!r.lastPlan.skill,r=>paired(r)??[],[
    option('기술에 집중하고 동작을 다시 보여 달라고 한다.','발을 옮길 타이밍부터 다시 짚었다. 이번에는 제대로 보였다.'),
    option('레슨 중에는 사적인 이야기를 하지 말아 달라고 한다.','레슨은 착지 각도 이야기로 돌아갔고 예전 관계는 더 나오지 않았다.'),
    option('수업이 끝나면 같은 동작으로 연습전을 하자고 한다.','선생님도 한 번씩 시도해 보자고 했다. 점수표 대신 영상을 남겼다.'),
  ],false),
  cross(8,'크루 단톡방 잘못 보냄',r=>activePartners(r).length?
    '한 사람에게 보내려던 메시지가 크루 전체에 올라갔다. 민재가 제일 먼저 “수신인 확인 부탁드립니다”라고 답했다.':
    '준에게만 보내려던 연습 영상 초안이 전체 방에 올라갔다. 민재가 “이 분도 오늘 훈련 오는 건가요?”라고 묻자 자막 속 회전 화살표만 무한 반복됐다.',
  r=>r.year>=3&&(activePartners(r).length===1&&storyProgress(r,lead(r))?.mode!=='public'||!activePartners(r).length&&known(r).length>=4),
  r=>[lead(r),'min','jun'],[
    option('당황했지만 메시지를 잘못 보냈다고 인정한다.','크루방 공지는 며칠간 수신인을 먼저 확인하라는 문구로 바뀌었다.',r=>activePartners(r).length?record(lead(r),'rumor'):{}),
    option('모두를 향한 응원이었다고 말한다.','다음 연습부터 다들 같은 문장을 출발 인사로 쓰기 시작했다.',r=>activePartners(r).length?record(lead(r),'rumor'):{},{fame:2}),
    option('당사자에게 먼저 확인하고 합의한 범위에서 공개한다.','두 사람이 함께 짧은 메시지를 보냈다.',r=>activePartners(r).length?{changes:[change(lead(r),undefined,'rumor','public')]}:{dialogue:'준은 첫 시도만 올리자고 했다. 크루방에는 동의를 얻은 연습 영상이 올라왔다.'}),
  ]),
  cross(9,'연애 리얼리티 출연 제안','스폰서가 “롱보더의 러브라인”을 만들자고 한다. 제안서에는 당사자와 상의하지 않은 내용까지 적혀 있다.',
  r=>r.year>=4&&r.fame>=35&&!!r.extras?.contract&&STORY_NPCS.some(npc=>hasFlag(r,npc,'rumor')||hasFlag(r,npc,'broadcast')||hasFlag(r,npc,'fake-date')),
  r=>[...activePartners(r),'sol'],[
    option('당사자와 먼저 상의하고 모두 동의할 때만 검토한다.','브랜드는 동의받은 사람의 경기 장면을 중심으로 제안서를 수정했다.'),
    option('예능 대신 훈련과 대회 준비를 담자고 제안한다.','촬영팀은 연습실로 와서 첫 라인이 만들어지는 모습을 찍었다.',{},{fame:2}),
    option('몰래 내 이름으로 출연 신청서를 낸다.','촬영비를 받았지만 브랜드는 사전 동의 문제로 크루 단체 촬영을 보류했다.',r=>activePartners(r).length?record(lead(r),'sponsor-distance'):{},{money:20_000}),
  ]),
  cross(10,'애인의 비밀 계정',r=>name(reviewLead(r)??'jun')+'가 운영한 기술 리뷰에는 “들어갈 때는 급하고, 끝에서는 버틴다 ★☆☆☆☆”라고 적혀 있었다.',
  r=>r.year>=5&&!!reviewLead(r)&&r.relations[reviewLead(r)!]>=12,r=>[reviewLead(r)!],[
    option('왜 그렇게 평가했는지 직접 묻는다.','상대는 의견을 숨긴 일을 사과하고 실제 영상을 함께 봤다.',{title:'crew-repair'}),
    option('별점은 접어두고 첫 진입만 다듬는다.','다음 연습에는 첫 발을 내딛기 전 한 번 숨을 골랐다.'),
    option('맞리뷰를 써서 서로 앞에서 읽어 본다.','두 사람은 별점 대신 서로에게 남기고 싶은 조언으로 다시 썼다.'),
  ],false),
  cross(11,'전 애인들의 합동 공연',r=>formerPartners(r).length>=2?
    '너와 헤어진 라이더 둘이 합동 라인에 「그 사람만 빼고」라는 이름을 붙였다. 진행자가 누가 빠졌는지 물었다.':
    '유리와 하린이 댄싱 크루 갈등을 재치 있게 풀어낸 「그 사람만 빼고」를 공개했다. 진행자는 라인 제목인지 단톡방 공지인지 헷갈렸다.',
  r=>r.year>=6&&(formerPartners(r).length>=2||hasFlag(r,'yu','jealous-press')||chosen(r,'story-ha-2',1)||!!r.events['story-yu-3']&&!!r.events['story-ha-3']&&!!rivalry(r)),
  r=>formerPartners(r).length>=2?formerPartners(r).slice(0,2):['yu','ha'],[
    option('공연에 박수를 보내고 두 사람이 만든 라인을 응원한다.','애매했던 공기도 새 스텝 앞에서는 잠깐 가라앉았다.'),
    option('나도 내 방식으로 새 라인을 만들어 답한다.','관객은 두 라인을 연달아 보고 각각 다른 박자에 박수를 쳤다.'),
    option('무대 뒤에서 사과해도 괜찮을지 먼저 묻는다.','들어 줄 준비가 된 사람과만 이야기를 나누었다.',{title:'crew-repair'}),
  ]),
  cross(12,'세계 결승, 마지막 인사',r=>{
    const current=activePartners(r),past=formerPartners(r);
    if(!past.length&&!current.length)return '마지막 국제대회를 앞두고 라이벌들이 연습장에 모였다. 첫 번호표 때부터 본 얼굴들이 이번에는 네 출발을 기다린다.';
    return '마지막 국제대회를 앞두고 '+[...current.map(npc=>name(npc)+'의 응원'),...past.map(npc=>name(npc)+'와 나눈 짧은 인사')].join(', ')+'가 남았다. 출발선이 열리기 전에 오늘을 어떻게 기억할지 정했다.';
  },r=>r.year===8&&r.week>=50&&r.records.length>0,finalCast,[
    option('마지막 결승 라인에 집중한다.','출발 전에는 신발 끈과 첫 스텝만 생각하기로 했다.'),
    option('경기가 끝나면 마음에 남은 말부터 정리한다.','들어 주는 사람에게만 솔직하게 말할 준비를 했다.'),
    option('각자 자리에서 함께 타 준 사람들에게 감사한다.','누군가는 박수를 치고, 누군가는 조용히 고개를 끄덕였다.'),
  ]),
  scene('crew-chat-fallout','크루 단톡방에서 나만 없다','삼자대면 뒤 새 단톡방이 생겼다. 크루는 당분간 공식 대회와 필수 연습 안내만 기존 채널로 보내기로 했다.',
    r=>elapsed(r,'cross-01')>=2,[
      option('공식 안내를 확인하고 나머지는 각자의 시간을 지킨다.','누가 먼저 답할지 재촉하지 않기로 했다.'),
      option('크루 운영에 필요한 일만 돕겠다고 전한다.','다음 연습에는 맡은 장비만 챙겨 두었다.'),
      option('연습 약속을 잠시 줄이고 나만의 라인을 준비한다.','다음에 함께 탔으면 좋겠다는 말은 아직 보내지 않았다.'),
    ],{kind:'크루 이야기',cast:formerPartners}),
  scene('crew-brand-call','스폰서 담당자의 전화','브랜드 담당자가 소문에 대한 입장을 물었다. 사진 속 라이더의 사생활을 캠페인에 담을지부터 다시 확인하자고 한다.',
    r=>elapsed(r,'crew-chat-fallout')>=2&&!!r.extras?.contract,[
      option('내 이름으로만 답하고 다른 사람의 말은 본인에게 맡긴다.','브랜드는 개인 주행 장면만 남기고 공동 홍보 제안은 거뒀다.'),
      option('예정된 광고를 연습 장면으로 수정한다.','촬영팀은 연습 영상만 쓰기로 했다.'),
      option('사적인 이야기는 보도하지 말아 달라고 요청한다.','담당자는 계약 담당자와 촬영팀에 같은 요청을 전했다.'),
    ],{kind:'스폰서 이야기',decision:true,cast:formerPartners}),
  scene('crew-ex-stage','전 애인들이 같은 팀으로 나왔다',r=>'시범 공연 명단의 같은 줄에 '+formerPartners(r).slice(0,2).map(name).join('와 ')+'의 이름이 있었다. 둘이 정한 팀 이름은 너와 무관한 첫 스텝에서 왔다.',
    r=>elapsed(r,'crew-chat-fallout')>=5&&formerPartners(r).length>=2,[
      option('두 사람의 무대를 객석에서 응원한다.','두 사람은 무대를 마치고 각자 자기 팀에 인사했다.'),
      option('겹치지 않는 시간에 내 라인을 연습한다.','조명이 한 번 바뀌고 다음 참가자를 불렀다.'),
      option('인사할 의사가 있는 사람에게만 응원을 전한다.','답을 받지 않아도 공연을 본 사실만 기억하기로 했다.'),
    ],{kind:'크루 이야기',cast:r=>formerPartners(r).slice(0,2)}),
];
