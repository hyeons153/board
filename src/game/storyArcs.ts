import { activePartners, change, chosen, elapsed, hasFlag, option, record, romance, scene, storyProgress, type StoryImpact, type StoryNpc } from './storyState.js';
import type { Rider } from './types.js';
import type { EventDef } from './events.js';

const episode=(npc:StoryNpc,part:number,title:string,body:EventDef['body'],when:EventDef['when'],choices:EventDef['choices'],decision=true)=>
  scene('story-'+npc+'-'+part,title,body,when,choices,{npc,kind:'개인 에피소드',decision});
const met=(r:Rider,year:number,old:string[])=>r.year>year||r.year===year&&old.some(id=>r.events[id]);
const after=(npc:StoryNpc,part:number,year:number)=>(r:Rider)=>r.year>=year&&elapsed(r,'story-'+npc+'-'+part)>=(r.year===8?1:3);
const gift=(npc:StoryNpc,state:Parameters<typeof change>[1],flag:string,title:string,item:string):StoryImpact=>
  ({changes:[change(npc,state,flag)],title,item});
const finishRomance=(r:Rider,npc:StoryNpc,mutual:boolean,title:string,item:string):StoryImpact=>
  romance(r,npc,mutual,title,item);
const close=(npc:StoryNpc,flag:string)=>record(npc,flag,'ended');
const wasTogether=(r:Rider,npc:StoryNpc)=>activePartners(r).includes(npc);

export const STORY_ARCS:EventDef[]=[
  episode('min',1,'다섯 번째 체크박스','민재가 훈련 노트를 내밀었다. 무릎 보호대와 대회 점검까지 적혀 있는데 마지막 칸만 비어 있다. “마지막 칸은 네가 무사히 돌아오는 거야.”',
    r=>met(r,2,['min-checklist','min-metronome','injury-kit']),[
      option('매주 같이 점검하자.','민재는 마지막 칸을 비워 두고 둘이 점검하는 날에만 표시하기로 했다.',record('min','check-together'),{},['balanced','trick']),
      option('걱정은 고마운데 내 방식대로 할래.','민재는 노트를 네 쪽으로 밀어 주고 먼저 물어보기로 했다.',record('min','boundary'),{},['dance','freestyle']),
      option('내 스케줄까지 네가 짜 줄래?','민재가 이번 주 일정부터 빼곡히 적었다. 어디까지 맡길지는 아직 정하지 않았다.',record('min','delegated')),
    ],false),
  episode('min',2,'위치 공유가 사랑인가요',r=>hasFlag(r,'min','delegated')?
    '민재가 지난번 부탁을 기억하고 자유시간까지 공유 일정에 적었다. “이제 너 대신 다 기억할 수 있어.”':
    '민재가 공유 일정을 켰다. “편하잖아. 내가 다 기억할 수 있으니까.” 자유시간까지 들어 있는 걸 보고 너는 화면을 내려놓았다.',
    after('min',1,3),[
      option('일정은 같이 정하자. 강요는 싫어.','민재가 공유 설정을 끄고 네가 원하는 시간만 묻기 시작했다.',record('min','agreed-boundaries')),
      option('네가 알아서 해.','일정은 편해졌지만 원래 쉬기로 한 날까지 알림이 울리기 시작했다.',record('min','overreach')),
      option('난 네 프로젝트가 아니야.','민재는 뒤늦게 사과했다. 당분간 연습 약속은 잡지 않기로 했다.',record('min','distance')),
    ]),
  episode('min',3,'누가 내 보드에 손댔어?',r=>hasFlag(r,'min','agreed-boundaries')?
    '민재가 시험용 데크를 손봐 보여 주다가 멈췄다. “네 보드를 바꾸기 전에 묻겠다고 했지. 이 세팅을 어떻게 생각해?”':
    '민재가 네 보드인 줄 알고 연습용 데크를 미리 조정했다. “훨씬 안전할 거야.” 손대기 전에 먼저 물어봤어야 했다.',
    after('min',2,5),[
      option('원래대로 돌려 놓고 먼저 물어봐 줘.','민재는 도구를 내려놓고 자기 행동부터 사과했다.',{changes:[change('min',undefined,'accountability')],title:'crew-repair'}),
      option('당분간 각자 연습하자.','일정 공유를 끄고 다음 만남은 서로 원할 때 정하기로 했다.',record('min','distance')),
      option('이 관계는 여기서 끝내자.','민재는 더 설득하지 않고 공구와 노트를 돌려줬다.',close('min','farewell')),
    ]),
  episode('min',4,'계획에 없던 사람','은퇴를 앞두고 민재가 새 체크리스트를 펼쳤다. “네가 원하는 걸 묻는 칸을 처음부터 만들었어야 했는데.”',
    after('min',3,7),[
      option('서로의 시간을 존중하며 연인으로 함께하고 싶어.','민재가 대답할 때까지 기다렸다.',r=>finishRomance(r,'min',hasFlag(r,'min','accountability')&&hasFlag(r,'min','agreed-boundaries'),'min-future','acc_min_checklist')),
      option('연애 없이 서로 존중하는 라이벌로 남자.','민재는 훈련 시간을 먼저 물었고 날짜는 함께 골랐다.',gift('min','rival','boundaries-kept','min-boundary','acc_min_checklist')),
      option('고마웠어. 앞으로는 각자의 길을 가자.','두 사람은 마지막 장비 점검을 마친 뒤 다른 출구로 나갔다.',gift('min','ended','farewell','min-goodbye','acc_min_checklist')),
    ]),

  episode('sol',1,'커피 두 잔의 이유','솔이 커피 두 잔을 가져왔다. “한 잔은 내 거, 한 잔은 미래의 내 애인 거.” 네가 잔을 받자 솔이 눈을 피했다.',
    r=>met(r,2,['first-sol','park-tea','studio-rain','registration']),[
      option('그럼 네 미래 애인에게 양보할게.','솔은 두 잔을 든 채 자기 농담에 처음으로 당황했다.',record('sol','banter'),{},['trick','freestyle']),
      option('그 애인 나 하면 안 돼?','솔이 답을 고르느라 커피가 다 식었다.',record('sol','flirt','interested')),
      option('커피만 마시고 연습하자.','솔은 보온병을 열고 오늘의 첫 코스를 추천했다.',record('sol','coffee-friend'),{},['balanced','dance']),
    ],false),
  episode('sol',2,'솔의 연애는 매일이 만우절','솔이 크루 앞에서 “우리 사귀어요”라고 말했다가 농담이라고 덧붙였다. 웃음이 가라앉은 뒤에도 솔은 네 쪽을 보고 있었다.',
    after('sol',1,3),[
      option('둘만 남았을 때 진심을 묻는다.','솔은 농담으로 얼버무렸던 말이 있었다고 인정했다.',record('sol','asked-honestly')),
      option('그대로 농담을 돌려준다.','두 사람 다 웃었지만 어느 쪽이 진심인지는 더 헷갈렸다.',record('sol','mixed-signals')),
      option('이런 장난은 싫어.','솔은 사람을 웃기는 일과 사람을 놀라게 하는 일의 차이를 생각하겠다고 했다.',record('sol','apology')),
    ]),
  episode('sol',3,'누구와도 잘 웃는 사람',r=>r.extras?.contract?
    '스폰서 화보에 솔이 다른 모델과 연인처럼 웃는 사진이 올라왔다. 크루 단톡방에서는 촬영 콘셉트를 오래전에 잊은 모양이다.':
    '크루 전시회 사진에서 솔이 다른 사람과 연인처럼 웃고 있다. 사진 아래 농담이 소문으로 변하기 시작했다.',
    after('sol',2,5),[
      option('사실부터 확인한다.','솔은 촬영 콘셉트와 실제 관계를 차분히 구분해 설명했다.',record('sol','checked-facts')),
      option('나도 다른 사람과 데이트하는 척한다.','한 장짜리 장난에 해명을 세 번이나 해야 할 일이 생겼다.',record('sol','fake-date')),
      option('답을 듣기 전까지 거리를 둔다.','솔은 이번에는 웃지 않고 연락을 기다리기로 했다.',record('sol','distance')),
    ]),
  episode('sol',4,'농담 없는 마지막 커피','마지막 시즌 솔이 보온병을 건넸다. “오늘은 장난 안 칠게. 오래전부터 네가 좋았어.”',
    after('sol',3,8),[
      option('진심을 받아들이고 사귀고 싶다고 말한다.','보온병 위로 있는 그대로의 대답이 돌아왔다.',r=>finishRomance(r,'sol',hasFlag(r,'sol','checked-facts')&&(hasFlag(r,'sol','asked-honestly')||hasFlag(r,'sol','apology')),'sol-honest','acc_sol_badge')),
      option('고마워. 지금은 친구로 커피를 마시고 싶어.','솔은 친구라고 또렷하게 답하고 두 잔을 채웠다.',gift('sol','friend','coffee-friend','sol-coffee','acc_sol_badge')),
      option('이번에는 웃어넘길 수 없다고 말한다.','솔은 제때 진심을 표현하지 못한 일을 사과했다.',gift('sol','ended','farewell','sol-farewell','acc_sol_badge')),
    ]),

  episode('jun',1,'3초짜리 고백 영상','준이 착지 영상이라고 보낸 파일에는 네가 웃는 모습만 3초 담겼다. “파일을 잘못 골랐어! 원본은 따로 있다고!”',
    r=>met(r,1,['juns-clip','night-jam']),[
      option('나 찍었어? 다음엔 좀 더 잘 찍어 줘.','준은 웃음이 나오는 장면은 이미 잘 찍혔다고 중얼거렸다.',record('jun','kept-clip'),{},['dance','freestyle']),
      option('나 좋아해?','준은 귀가 빨개진 채 링크를 다시 확인했다.',record('jun','asked-about-crush')),
      option('내 영상은 지우고 착지 영상만 같이 보자.','준은 파일을 지우고 네가 남겨도 좋다고 한 착지 영상만 열었다.',record('jun','clip-deleted'),{},['trick','balanced']),
    ],false),
  episode('jun',2,'고백도 착지 실패',r=>hasFlag(r,'jun','clip-deleted')?
    '준이 카메라 없이 기다리고 있었다. “지난번 삭제해 달라고 한 영상은 없앴어. 이번 얘기는 직접 하고 싶었어.”':
    '준이 오래된 3초 영상을 다시 틀었다가 급히 껐다. “사귀… 아니, 다음 대회에 같이…” 밤새 연습했다던 대사는 한 번 더 착지에 실패했다.',
    after('jun',1,3),[
      option('나도 좋아. 우리 사귈래?','준이 숨을 고르고 대답했다.',r=>romance(r,'jun',hasFlag(r,'jun','kept-clip')||hasFlag(r,'jun','asked-about-crush'))),
      option('고백은 고맙지만 좋은 라이벌로 남자.','준은 대답을 존중하고 다음 경기에서 인사하겠다고 했다.',record('jun','rejected','rival')),
      option('천천히, 말을 끝까지 해 봐.','준은 고백을 끝까지 했고, 지금 답을 내릴 필요는 없다고 덧붙였다.',r=>record('jun','honest-retry',wasTogether(r,'jun')?'partner':'interested')),
    ]),
  episode('jun',3,'라이브를 켜지 말랬잖아',r=>hasFlag(r,'jun','clip-deleted')?
    '연습 중 오디오만 켜진 라이브에서 준이 사적인 별명을 부르고 말았다. 예전에 지운 영상은 어디에도 공개되지 않았다.':
    '준이 라이브를 켠 줄도 모르고 별명을 불렀다. “지금 생방송이에요.” 댓글이 올라오자 준이 삼각대를 쓰러뜨렸다.',
    after('jun',2,5),[
      option('준과 먼저 상의하고 둘 사이를 직접 설명한다.','준은 함께 정한 내용만 전했다. 팬들도 둘의 답을 그대로 들었다.',r=>wasTogether(r,'jun')?{changes:[change('jun',undefined,'broadcast','public')],title:'jun-broadcast'}:record('jun','corrected-live'),{fame:2}),
      option('방송을 끄고 사생활을 지킨다.','준은 먼저 방송을 끈 뒤 카메라를 다시 켜기 전에 꼭 묻겠다고 했다.',record('jun','privacy')),
      option('당황해서 그냥 친구라고 말한다.','준은 허락 없이 방송한 자기 실수를 인정했지만 그 말은 오래 마음에 남았다.',record('jun','hurt-on-camera')),
    ]),
  episode('jun',4,'오늘은 네가 먼저 찍어 줘',r=>hasFlag(r,'jun','clip-deleted')?
    '준이 카메라를 건넨다. 예전에 지운 영상 대신 네가 촬영해도 좋다고 허락한 착지 장면이 저장되어 있다.':
    '준이 휴대폰을 건넨다. “이번엔 내 실패 말고 네 마지막 라이딩을 남겨 줘.” 실패 영상 사이에 첫날의 3초도 남아 있다.',
    after('jun',3,7),[
      option('연인으로 함께할 날을 약속하고 둘의 영상을 찍는다.','준은 녹화 버튼 위에서 네 대답도 확인했다.',r=>finishRomance(r,'jun',hasFlag(r,'jun','honest-retry')&&!hasFlag(r,'jun','hurt-on-camera'),'jun-partner','acc_jun_partner')),
      option('연애 없이 마지막까지 서로의 라이벌로 남자.','준이 각자 한 번씩 탈 수 있도록 카메라를 고정했다.',gift('jun','rival','rival-finale','jun-landing','acc_jun_partner')),
      option('오래된 영상을 함께 보고 친구로 남는다.','카메라 밖에서 웃는 소리가 마지막 클립에 남았다.',gift('jun','friend','friend-finale','jun-friend','acc_jun_friend')),
    ]),

  episode('ha',1,'내가 기다린 건 아니고','하린은 약속보다 40분이나 먼저 나와 있었다. “원래 타려고 했거든. 너랑은 우연히 마주친 거고.”',
    r=>met(r,1,['harin-lap','harin-route','harin-coach']),[
      option('그럼 우연히 같이 한 바퀴 타자.','하린은 우연치고는 나쁘지 않다며 코스를 먼저 골랐다.',record('ha','teased'),{},['dance']),
      option('기다려 줘서 고마워.','하린은 아무렇지 않은 표정으로 늦지 말라고 했다.',record('ha','thanked'),{},['balanced']),
      option('좋아, 그럼 기록으로 겨뤄.','하린은 이미 손목시계의 시작 버튼을 눌러 놓았다.',record('ha','timed','rival'),{},['trick','freestyle']),
    ],false),
  episode('ha',2,'져 줬다는 말, 취소해','크루 연습전에서 한 점 차이로 갈렸다. “컨디션이 안 좋았어.” 그러던 하린이 네 장비가 비에 젖지 않도록 먼저 챙겨 둔 걸 알게 됐다.',
    after('ha',1,3),[
      option('멋진 라인이었어. 네 실력을 인정해.','하린은 자기 기록을 보여 주며 다음 판은 더 재밌겠다고 했다.',record('ha','respect')),
      option('다음에도 이기겠다며 한 번 더 놀린다.','하린은 손목시계에 복수전이라고 적었다.',r=>record('ha','rematch',wasTogether(r,'ha')?'partner':'rival')),
      option('비 오는 날 내 장비를 챙겨 준 이유를 묻는다.','하린은 대답 대신 빗속으로 빠져나가려는 너에게 우산부터 건넸다.',record('ha','noticed')),
    ]),
  episode('ha',3,'내 기록보다 네가 먼저였어',r=>r.injury?
    '부상 소식을 들은 하린이 자기 연습을 마치자마자 달려왔다. “착각하지 마. 네가 없으면 이기는 재미가 없으니까.”':
    '시범 주행 중 네가 미끄러지자 관중석의 하린이 다가왔다. “착각하지 마. 네가 없으면 이기는 재미가 없으니까.”',
    after('ha',2,5),[
      option('네가 와서 안심했어.','하린은 시계를 확인하지 않고 네가 쉴 때까지 옆에 있었다.',record('ha','reassured')),
      option('고마워. 다음엔 네 경기부터 챙겨.','하린이 고개를 끄덕였다. 다음에는 쉴 시간을 함께 정하기로 했다.',record('ha','both-careers')),
      option('다음에 누가 먼저 이길지 내기할까?','하린이 벌써 두 사람의 이름을 연습표에 나란히 적었다.',record('ha','training-bet')),
    ]),
  episode('ha',4,'시계를 두고 온 사람','최종 대회를 앞두고 하린이 시계를 가방에 넣었다. “오늘은 누가 더 빨랐는지 기록 안 할래.”',
    after('ha',3,8),[
      option('좋아한다고 말하고 연인으로 걸어가자고 한다.','하린은 오늘만큼은 시계보다 자기 마음을 먼저 확인했다.',r=>finishRomance(r,'ha',hasFlag(r,'ha','reassured')&&(hasFlag(r,'ha','respect')||hasFlag(r,'ha','noticed')),'ha-late','acc_ha_band')),
      option('연애 없이 은퇴 후에도 한 판 더 겨루자.','하린은 기록할 사람 없는 첫 승부를 약속했다.',gift('ha','rival','rematch','ha-rival','acc_ha_band')),
      option('친구로 강변을 한 바퀴 같이 돈다.','하린은 천천히 달리면서도 먼저 앞서가지 않았다.',gift('ha','friend','waited','ha-wait','acc_ha_band')),
    ]),

  episode('noa',1,'오늘도 같은 조명 아래','노아가 야간 광장 주소를 다시 보냈다. “여기선 실패해도 아무도 얼굴을 못 봐.” 조명 아래 데크가 잠깐 뒤집혀 빛났다.',
    r=>met(r,1,['neon-invite','noa-pop','noa-crew']),[
      option('밤의 스팟에 함께 간다.','둘은 각자 성공한 동작이 나오면 불빛 아래 보드를 세워 두기로 했다.',record('noa','night-invite'),{},['trick','freestyle']),
      option('낮에 함께 연습하자.','노아는 잠깐 생각하다 햇빛에서도 해 볼 수 있는 기술을 골랐다.',record('noa','day-practice'),{},['balanced','dance']),
      option('나만 초대한 거야?','노아는 다들 초대할 수 있지만 오늘은 네게 먼저 보냈다고 했다.',record('noa','first-message')),
    ],false),
  episode('noa',2,'지워진 마지막 접속 시간','노아가 다른 라이더와 연습한 사진을 봤다. “나한테는 바쁘다더니?” 대답을 듣기도 전에 혼자 가장 나쁜 쪽으로 생각한 표정이었다.',
    after('noa',1,3),[
      option('상황을 설명하되 각자의 연락 시간을 존중하자고 한다.','노아는 먼저 답을 기다리겠다고 했다.',record('noa','clear-boundary')),
      option('다른 라이더와 탄 사실을 숨긴다.','노아는 고개를 끄덕였지만 사진을 보관해 둔 채였다.',record('noa','lied')),
      option('계속 의심한다면 거리를 두겠다고 말한다.','노아는 서로가 편해질 때까지 연락을 줄이기로 했다.',record('noa','distance')),
    ]),
  episode('noa',3,'읽지 않은 메시지 47개',r=>hasFlag(r,'noa','lied')||hasFlag(r,'noa','distance')?
    '노아는 명단에 있었지만 답장이 없었다. 지난 다툼 뒤 거리를 두고 싶다는 말을 끝내 보내지 못했다고 한다.':
    hasFlag(r,'noa','night-invite')?'연락이 뜸해진 동안 노아는 아직 성공하지 못한 트릭 촬영에 파묻혀 있었다.':
    '노아가 수리한 휴대폰을 들고 나타났다. 수신번호 한 자리가 틀려서 보낸 연습 일정은 분식집에 도착했다.',
    after('noa',2,5),[
      option('경기가 끝난 뒤 두 사람만 있을 때 이유를 묻는다.','노아는 무엇을 정리하고 싶은지 스스로 말할 시간을 얻었다.',r=>({changes:[change('noa',undefined,hasFlag(r,'noa','lied')?'truth-admitted':'heard')],title:'noa-missed'})),
      option('연락을 멈추고 각자의 대회를 준비한다.','다음 대회 안내는 공식 채널에서만 받기로 했다.',close('noa','no-contact')),
      option('경기 영상을 보며 착지를 응원한다.','노아는 점수표보다 먼저 응원해 준 말을 기억했다.',r=>record('noa',hasFlag(r,'noa','lied')?'still-unanswered':'supported')),
    ]),
  episode('noa',4,'카메라를 끈 밤','노아가 촬영 장비를 끈다. “확인하지 않아도 믿는 연습을 해 봤어. 아직 어렵지만, 쓰고 지우던 말은 이제 직접 할게.”',
    after('noa',3,7),[
      option('각자의 공간을 지키면서 연인으로 함께하고 싶어.','노아도 원하는 관계를 직접 이야기했다.',r=>finishRomance(r,'noa',hasFlag(r,'noa','clear-boundary')&&(hasFlag(r,'noa','heard')||hasFlag(r,'noa','supported')),'noa-neon','acc_noa_neon')),
      option('서로 기다려 줄 수 있는 친구로 남자.','노아는 다음에 연습하고 싶을 때만 연락하자고 했다.',gift('noa','friend','friends-in-neon','noa-friend','acc_noa_neon')),
      option('오늘은 작별하고 각자의 밤으로 돌아간다.','노아는 답장을 약속하는 대신 마지막 인사를 건넸다.',gift('noa','ended','farewell','noa-missed','acc_noa_neon')),
    ]),

  episode('yu',2,'모두의 유리, 나만의 유리는?',r=>chosen(r,'first',2)?
    '첫날 네가 다음에도 보자고 했던 약속을 기억한 유리는 다른 선수의 안무를 봐주다 늦었다. “나도 미리 말했어야 했는데.”':
    '유리가 다른 선수의 안무를 봐주다가 늦었다. 웃으면서도 다른 사람의 긴장부터 이야기하는 게 마음에 걸렸다.',
    r=>r.year>=3,[
      option('힘든 날엔 너도 내게 기대도 돼.','유리는 해외 크루 오디션을 준비하는 이야기를 처음으로 털어놓았다.',record('yu','dream-shared')),
      option('약속을 지키기 어려우면 미리 알려 줘.','유리는 시간을 함께 다시 잡으면서 오디션 날짜도 표시했다.',record('yu','clear-boundary')),
      option('내가 더 중요한 사람인지 증명해 봐.','유리는 우선순위를 증명하기 위해 보드를 타지는 않겠다고 답했다.',record('yu','jealous-press')),
    ]),
  episode('yu',3,'비행기 티켓 두 장','유리가 해외 크루 오디션 합격 통지서를 펼쳤다. “네가 세계 대회를 준비하는데 내가 떠난다고 하면 어떤 표정일지 몰랐어.”',
    after('yu',2,5),[
      option('네 꿈도 세계 무대잖아. 응원할게.','유리는 떠나기 전 서로의 대회를 달력에 적어 주었다.',record('yu','long-distance')),
      option('각자 꿈을 이루면서 같이 도전할 방법을 찾아보자.','두 장소에서 같은 곡으로 찍은 영상을 한 편으로 만들기로 했다.',record('yu','duet')),
      option('미리 말하지 않아 서운해. 잠깐 생각할 시간이 필요해.','유리는 변명보다 먼저 사과하고 서로 생각할 시간을 정했다.',record('yu','distance')),
    ]),
  episode('yu',4,'같은 박자, 다른 결승선','최종 대회장에서 유리가 자기 팀의 이름을 달고 나타났다. “이제 네 스텝만 따라가지는 않을 거야.”',
    after('yu',3,8),[
      option('연애 없이 서로의 최고 라인으로 겨루자.','유리는 서로 다른 라인을 같은 곡의 다른 해석으로 남겼다.',gift('yu','rival','world-rival','yu-finals','acc_yu_rival')),
      option('경기 뒤에도 연인으로 함께할 미래를 약속한다.','유리는 세계 무대 뒤에도 만날 날을 정하고 싶다고 답했다.',r=>finishRomance(r,'yu',hasFlag(r,'yu','long-distance')||hasFlag(r,'yu','duet'),'yu-partner','acc_yu_partner')),
      option('첫 강변을 기억하는 친구로 인사한다.','둘은 첫날의 스텝을 이번에는 웃음을 참지 않고 밟았다.',gift('yu','friend','first-wind','yu-wind','acc_yu_friend')),
    ]),
];
