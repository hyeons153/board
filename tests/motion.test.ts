import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { DEFAULT_LOOK, SKILLS } from '../src/game/data';
import { lineTerms } from '../src/game/content';
import { paintRider } from '../src/scene/rider';
import { ACTOR_HEIGHT, ACTOR_WIDTH, TECHNIQUES, boardPoint, headingsBefore, techniquePose, trainingTechnique } from '../src/scene/techniques';
import type { MoveLog } from '../src/game/types';

const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<.00001,`${actual} != ${expected}`);
test('step turns, shuvits, flips and compound spins keep their prescribed independent rotations',()=>{
  const rotations:Record<string,[number,number,number]>={
    'step-180':[180,0,0],'step-360':[360,0,0],pirouette:[360,0,0],'pirouette-540':[540,0,0],'pirouette-720':[720,0,0],
    pivot:[180,180,0],shuvit:[0,180,0],'pop-shuvit':[0,180,0],'front-pop':[0,-180,0],
    kickflip:[0,0,360],heelflip:[0,0,-360],bigspin:[180,360,0],bigger:[180,540,0],
    'no-com-big':[180,360,0],hardflip:[0,-180,360],treflip:[0,360,360],varial:[0,180,360],
  };
  for(const [id,[body,board,flip]] of Object.entries(rotations)){
    const pose=techniquePose(id,1);near(pose.bodyYaw,body*Math.PI/180);near(pose.board.yaw,board*Math.PI/180);near(pose.board.roll,flip*Math.PI/180);
  }
  const kick=techniquePose('kickflip',.4),heel=techniquePose('heelflip',.4);
  assert.ok(kick.board.roll>0&&heel.board.roll<0);assert.ok(kick.hip.y<kick.board.y-25);
});
test('support feet and deck contacts distinguish pivots, pirouettes, ghost, wood and no-comply',()=>{
  for(const p of [.2,.35,.5,.65,.8,1]){
    const pivot=techniquePose('pivot',p),nose=boardPoint(pivot.board,27);near(nose.x,91);near(nose.y,102);
    const spin=techniquePose('pirouette',p);near(spin.board.y,102);near(spin.board.yaw,0);near(spin.feet[1].x,74);near(spin.feet[1].y,100);
  }
  const ghost=techniquePose('ghost',.45);assert.ok(ghost.hip.x>85);near(Math.max(...ghost.feet.map(foot=>foot.y)),109);
  const noComply=techniquePose('no-comply',.26);near(noComply.feet[1].y,109);assert.ok(noComply.board.y<102);
  const wood=techniquePose('wood',.5);assert.ok(wood.feet[0].x<25&&wood.feet[0].y<90);near(wood.board.y,102);
});
test('every technique and outcome renders inside the actor texture, including reversed nose pivots',()=>{
  assert.deepEqual(Object.keys(TECHNIQUES).sort(),SKILLS.map(skill=>skill.id).sort());
  const canvas=createCanvas(ACTOR_WIDTH,ACTOR_HEIGHT),c=canvas.getContext('2d');
  for(const skill of SKILLS)for(const outcome of ['clean','rough','miss','great'] as const)for(const progress of [0,.2,.4,.5,.6,.8,1]){
    const pose=techniquePose(skill.id,progress,outcome);
    for(const point of [pose.hip,pose.board,...pose.feet])assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
    paintRider(c as unknown as CanvasRenderingContext2D,DEFAULT_LOOK,'ride',0,{id:skill.id,progress,outcome,bodyHeading:Math.PI,boardHeading:Math.PI});
    const rgba=c.getImageData(0,0,ACTOR_WIDTH,ACTOR_HEIGHT).data;
    let count=0;
    for(let y=0;y<ACTOR_HEIGHT;y++)for(let x=0;x<ACTOR_WIDTH;x++){
      if(!rgba[(y*ACTOR_WIDTH+x)*4+3])continue;count++;
      assert.ok(x>0&&x<ACTOR_WIDTH-1&&y>0&&y<ACTOR_HEIGHT-1,`${skill.id} ${outcome} ${progress} clips at ${x},${y}`);
    }
    assert.ok(count>350,skill.id+' is empty');
  }
});
test('replay preserves stance between moves and training follows the selected target or saved line',()=>{
  const log:MoveLog[]=[{id:'step-180',at:0,end:4,outcome:'clean',linked:null,combo:1,points:2},{id:'shuvit',at:5,end:9,outcome:'clean',linked:true,combo:2,points:3}];
  const heading=headingsBefore(log,5);near(heading.bodyHeading,Math.PI);near(heading.boardHeading,0);
  near(techniquePose('shuvit',0,'clean',heading.bodyHeading,heading.boardHeading).bodyYaw,Math.PI);
  log[1].outcome='miss';assert.deepEqual(headingsBefore(log,10),{bodyHeading:0,boardHeading:0});
  const r={plan:{action:'trick' as const,skill:'heelflip',spot:'plaza' as const},routines:{dance:[],trick:[],freestyle:[]},skills:{}};
  assert.equal(trainingTechnique(r,2)?.id,'heelflip');
  const rehearsal={...r,plan:{...r.plan,action:'rehearsal' as const,skill:undefined,discipline:'trick' as const},routines:{...r.routines,trick:['shuvit','kickflip']}};
  assert.equal(trainingTechnique(rehearsal,.25)?.id,'shuvit');assert.equal(trainingTechnique(rehearsal,1.25)?.id,'kickflip');
  assert.equal(trainingTechnique(rehearsal,2)?.id,'kickflip');
  assert.equal(trainingTechnique({...r,plan:null},1),undefined);
  assert.equal(lineTerms('저장한 루틴 · 루틴 리허설'),'저장한 라인 · 라인 리허설');
});
