import { SKILL } from './data.js';
import type { EventDef } from './events.js';
import { chosen, elapsed, option, scene, storyProgress, type StoryNpc } from './storyState.js';
import type { Rider } from './types.js';

export const NPC_WORKSHOPS={
  yu:{title:'바람의 파트너',skill:'pirouette-540',affinity:48,chapters:['story-yu-2','relationship-yu-trust'],
    scene:'박자가 모자란 한 바퀴',body:'유리는 음악을 끈 뒤 발소리만으로 한 바퀴 반을 돌았다. “마지막 반 박자는 네 식으로 밟아 봐. 다음 연습에서도 그 박자로 맞춰 보자.”',
    learned:'음악을 다시 켜자 둘은 서로 다른 박자에서 시작해 같은 소리로 착지했다.'},
  jun:{title:'일곱 번의 도전',skill:'hardflip',affinity:54,chapters:['story-jun-1','relationship-jun-trust'],
    scene:'실패 영상은 여섯 개',body:'준이 실패 영상 여섯 개를 순서대로 틀었다. “일곱 번째는 카메라 안 켤게. 발목이 먼저 무슨 짓을 하는지 같이 보자.”',
    learned:'마지막 시도는 녹화하지 않았다. 준은 다음엔 착지 소리만 듣고 맞히겠다고 했다.'},
  sol:{title:'자유로운 라인',skill:'mango-pendulum',affinity:46,chapters:['story-sol-1'],
    scene:'커피가 식기 전에 돌아오기',body:'솔은 난간에 커피를 올려 두고 망고 스텝과 시계추를 한 코스로 이었다. “한 동작씩 세지 말고 커피가 식기 전에 돌아오면 돼.”',
    learned:'두 코스가 하나의 라인으로 이어졌다. 솔은 다음에도 각자 고른 전환을 한 번씩 섞어 보자고 했다.'},
  min:{title:'완벽한 호흡',skill:'p2p',affinity:52,chapters:['story-min-1'],
    scene:'점검표 뒤에 그린 발자국',body:'민재가 점검표를 뒤집어 피글렛에서 피루엣으로 이어지는 발 위치를 그렸다. “네가 편한 위치가 다르면 먼저 표시해 줘.”',
    learned:'민재는 발자국을 하나 더 그려 두었다. 다음 점검표에는 서로 고른 발 위치가 나란히 들어갔다.'},
  ha:{title:'같은 박자의 질주',skill:'v-spin',affinity:48,chapters:['story-ha-1','harin-route'],
    scene:'결승선 앞에서 발을 바꾸면',body:'하린은 카빙을 풀자마자 발을 바꿔 회전해 보였다. “빠르기만 해서는 이 각도가 안 나와. 쫓아올 수 있으면 따라와.”',
    learned:'같은 박자에 코너를 빠져나오자 하린이 손목시계를 멈췄다. “다음엔 반대 방향.”'},
  noa:{title:'네온의 동행자',skill:'treflip',affinity:56,chapters:['story-noa-1'],
    scene:'두 회전이 만나는 프레임',body:'노아는 트래플립 영상을 보드가 뒤집히기 직전에 멈췄다. “여기서 두 방향이 만나. 너라면 발을 언제 뗄지 보고 싶어.”',
    learned:'보드가 조명 아래에서 두 방향으로 돌았다. 노아는 먼저 물었다. “다음 연습 때는 같이 영상 봐도 돼?”'},
} satisfies Record<StoryNpc,{title:string;skill:string;affinity:number;chapters:readonly string[];scene:string;body:string;learned:string}>;

export const workshopId=(npc:StoryNpc)=>`npc-workshop-${npc}`;
export const workshopTitle=(npc:StoryNpc)=>`workshop-title-${npc}`;

export const NPC_WORKSHOP_EVENTS:EventDef[]=Object.entries(NPC_WORKSHOPS).map(([id,data])=>{
  const npc=id as StoryNpc;
  return scene(workshopId(npc),data.scene,data.body,r=>
    (r.relations[npc]??0)>=data.affinity&&data.chapters.some(chapter=>r.events[chapter])&&
    storyProgress(r,npc)?.state!=='ended'&&!r.extras?.relationships?.titles.includes(workshopTitle(npc)),[
      option(`${SKILL[data.skill]!.name} 전수를 받아 함께 연습한다.`,data.learned,{title:workshopTitle(npc)},{skill:data.skill,teach:true},['balanced','dance','trick','freestyle']),
      option('전수는 사양하고 오늘의 라인을 지켜본다.','두 사람은 각자의 연습을 마친 뒤 마지막 주행에 서로 박수쳤다.'),
    ],{npc,kind:'기술 전수',decision:true,requiresChoice:true});
});

export function trainingPromiseActive(r:Rider,npc:StoryNpc){
  const events=npc==='min'?[[workshopId(npc),0],['story-min-1',0]] as const:[[workshopId(npc),0]] as const;
  return storyProgress(r,npc)?.state!=='ended'&&events.some(([id,index])=>{
    const weeks=elapsed(r,id);
    return weeks>=1&&weeks<=8&&chosen(r,id,index);
  });
}
