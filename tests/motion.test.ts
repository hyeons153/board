import test,{before} from 'node:test';
import {advanceClock,type AnimationClock} from '../src/scene/playback';
import assert from 'node:assert/strict';

test('playback speed scales the animation clock continuously and pauses without a jump',()=>{
  const clock:AnimationClock={elapsed:0};
  assert.equal(advanceClock(clock,1000,1),0);assert.equal(advanceClock(clock,2000,1),1000);
  assert.equal(advanceClock(clock,3000,2),3000);assert.equal(advanceClock(clock,3500,1),3500);
  assert.equal(advanceClock(clock,5000,0),3500);assert.equal(advanceClock(clock,6000,2),5500);
  assert.equal(advanceClock(clock,5990,2),5500);
});
import { createCanvas,loadImage } from '@napi-rs/canvas';
import { BOARDS, BOTTOMS, DEFAULT_LOOK, FOOTWEAR, HAIR_COLORS, HAIR_STYLES, LOOK_PRESETS, OUTFITS, PANTS, SHIRTS, SHOES, SKILLS, SKINS } from '../src/game/data';
import { lineTerms, RIVALS } from '../src/game/content';
import { paintRider } from '../src/scene/rider';
import { paintSpriteCharacter } from '../src/scene/spriteCharacter';
import { NEW_GEAR } from '../src/game/equipmentCatalog';
import { equippedLook, freshExtras } from '../src/game/economy';
import { ACTOR_HEIGHT, ACTOR_OFFSET, ACTOR_WIDTH, TECHNIQUES, basicPose, boardPoint, headingsBefore, techniquePose, trainingTechnique } from '../src/scene/techniques';
import type { Look, MoveLog } from '../src/game/types';
import {prepareCharacterReview} from '../scripts/character-art';
before(prepareCharacterReview);

const near=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<.00001,`${actual} != ${expected}`);

test('idle artwork retains the supplied sprite body proportions and every opaque source pixel',async()=>{
  const actual=createCanvas(ACTOR_WIDTH*2,ACTOR_HEIGHT*2),expected=createCanvas(ACTOR_WIDTH*2,ACTOR_HEIGHT*2);
  const atlas=await loadImage('public/art/characters/riders-v2.png');
  paintRider(actual.getContext('2d') as unknown as CanvasRenderingContext2D,DEFAULT_LOOK,'ride',0);
  const c=expected.getContext('2d');c.imageSmoothingEnabled=false;
  c.drawImage(atlas,0,0,192,224,(112.3-48)*2,(156-110)*2,192,224);
  const a=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data,b=c.getImageData(0,0,actual.width,actual.height).data;
  let same=0,total=0;
  for(let i=0;i<b.length;i+=4)if(b[i+3]===255){total++;if(a[i]===b[i]&&a[i+1]===b[i+1]&&a[i+2]===b[i+2])same++;}
  assert.ok(total>10000,'The detailed original body must be present');
  assert.ok(same/total>.995,`Original artwork must survive the idle pose: ${same}/${total}`);
});

test('raised hoodie sleeves connect both hands to the body instead of leaving floating hands',()=>{
  const canvas=createCanvas(ACTOR_WIDTH*2,ACTOR_HEIGHT*2),c=canvas.getContext('2d');
  paintRider(c as unknown as CanvasRenderingContext2D,LOOK_PRESETS.female[3],'win',0);
  const {width,height}=canvas,data=c.getImageData(0,0,width,height).data,connected=new Uint8Array(width*height);
  // A floating hand may touch the hair. Exclude the head silhouette so the
  // connection must actually travel through the raised sleeve and shoulder.
  const head=(x:number,y:number)=>y<92*2&&x>=88*2&&x<=142*2;
  const start=107*2*width+113*2,queue=[start];connected[start]=1;
  for(let at=0;at<queue.length;at++){
    const p=queue[at],x=p%width,y=Math.floor(p/width);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=x+dx,ny=y+dy,n=ny*width+nx;
      if(nx<0||nx>=width||ny<0||ny>=height||connected[n]||data[n*4+3]<128||head(nx,ny))continue;
      connected[n]=1;queue.push(n);
    }
  }
  for(const [left,right] of [[68,94],[130,157]]){
    let skin=0,attached=0;
    for(let y=65*2;y<98*2;y++)for(let x=left*2;x<right*2;x++){
      if(head(x,y))continue;
      const p=y*width+x,[r,g,b,a]=data.subarray(p*4,p*4+4);
      if(a>200&&r>200&&g>145&&b>110&&r>g*1.035&&g>b*1.04){skin++;attached+=connected[p];}
    }
    assert.ok(skin>25,'Both raised hands must remain visible');
    assert.ok(attached/skin>.95,`The sleeve must join its hand to the body: ${attached}/${skin}`);
  }
});

test('changing skin color preserves the entire raised sleeve and hand silhouette',()=>{
  const canvas=createCanvas(ACTOR_WIDTH,ACTOR_HEIGHT),c=canvas.getContext('2d');
  for(const look of [...LOOK_PRESETS.male,...LOOK_PRESETS.female]){
    const alpha=(skin:number)=>{
      paintRider(c as unknown as CanvasRenderingContext2D,{...look,skin},'win',0);
      return c.getImageData(0,0,ACTOR_WIDTH,ACTOR_HEIGHT).data.filter((_,i)=>i%4===3);
    };
    assert.deepEqual(alpha(5),alpha(1),'Skin color must not crop the hands');
  }
});

test('Peter Pan and cross-step gather one foot while the other remains planted',()=>{
  for(const id of ['peter-pan','cross']){
    const start=techniquePose(id,.18),gather=techniquePose(id,.30);
    near(start.feet[1].x,gather.feet[1].x);near(start.feet[1].y,gather.feet[1].y);
    assert.ok(gather.feet[0].y<start.feet[0].y);assert.notEqual(gather.feet[0].x,start.feet[0].x);
    near(gather.board.yaw,0);near(gather.board.roll,0);
  }
});

test('every new equipment appearance renders safely through riding, spinning, jumping and falling',()=>{
  const canvas=createCanvas(ACTOR_WIDTH,ACTOR_HEIGHT),c=canvas.getContext('2d');
  for(const item of NEW_GEAR){
    const extra=freshExtras();extra.inventory.push(item.id);if(item.slot==='accessory')extra.accessories=[item.id];else extra.equipped[item.slot]=item.id;
    const look=equippedLook({look:DEFAULT_LOOK,extras:extra});
    for(const technique of [undefined,{id:'kickflip',progress:.4},{id:'pirouette',progress:.9},{id:'wood',progress:.5},{id:'treflip',progress:.9,outcome:'miss' as const}]){
      paintRider(c as unknown as CanvasRenderingContext2D,look,'ride',320,technique,true);
      const rgba=c.getImageData(0,0,ACTOR_WIDTH,ACTOR_HEIGHT).data;
      for(let y=0;y<ACTOR_HEIGHT;y++)for(let x=0;x<ACTOR_WIDTH;x++)if(rgba[(y*ACTOR_WIDTH+x)*4+3])assert.ok(x>0&&x<ACTOR_WIDTH-1&&y>0&&y<ACTOR_HEIGHT-1,item.id+' clips at '+x+','+y);
    }
  }
});

test('customized riders retain every hairstyle, black/white decks and safe motion bounds',()=>{
  const canvas=createCanvas(ACTOR_WIDTH,ACTOR_HEIGHT),c=canvas.getContext('2d');
  const portrait=(look:Look)=>{paintRider(c as unknown as CanvasRenderingContext2D,look,'rest',0);return canvas.toBuffer('image/png');};
  const legacy={hair:0,skin:0,shirt:0,board:0};
  assert.deepEqual(portrait(legacy),portrait({...legacy,gender:'male'}));
  assert.notDeepEqual(portrait({...legacy,gender:'male'}),portrait({...legacy,gender:'female'}));
  for(const gender of ['male','female'] as const)for(const hair of HAIR_STYLES.keys())for(const board of [4,5]){
    const look:Look={...DEFAULT_LOOK,gender,hair,board,hairColor:7,skin:5,shirt:7,pants:7,shoes:7};
    portrait(look);
    const color=BOARDS[board];
    const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));
    let hasDeck=false;
    const pixels=c.getImageData(0,0,ACTOR_WIDTH,ACTOR_HEIGHT).data;
    for(let i=0;i<pixels.length;i+=4)if(rgb.every((value,n)=>pixels[i+n]===value)&&pixels[i+3])hasDeck=true;
    assert.ok(hasDeck,'Selected deck paint must be visible');
    for(const technique of [{id:'kickflip',progress:.4},{id:'pirouette',progress:.6},{id:'ghost',progress:.5},{id:'wood',progress:.5},{id:'treflip',progress:.9,outcome:'miss' as const}]){
      paintRider(c as unknown as CanvasRenderingContext2D,look,'ride',0,technique);
      const rgba=c.getImageData(0,0,ACTOR_WIDTH,ACTOR_HEIGHT).data;
      for(let y=0;y<ACTOR_HEIGHT;y++)for(let x=0;x<ACTOR_WIDTH;x++)if(rgba[(y*ACTOR_WIDTH+x)*4+3])assert.ok(x>0&&x<ACTOR_WIDTH-1&&y>0&&y<ACTOR_HEIGHT-1,'Appearance must fit the texture during movement');
    }
  }
});

test('mixed hair, clothing and shoes share rider anchors in every direction and major move',()=>{
  const canvas=createCanvas(ACTOR_WIDTH,ACTOR_HEIGHT),context=canvas.getContext('2d');
  const c=context as unknown as CanvasRenderingContext2D;
  c.imageSmoothingEnabled=false;
  const offsetX=(ACTOR_WIDTH-128)/2;
  const place=({x,y}:{x:number;y:number})=>({x:x+offsetX,y:y+ACTOR_OFFSET});
  const techniques=['cross','peter-pan','shuvit','kickflip','ghost'];
  for(const direction of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const stand=basicPose('rest',0),ride=basicPose('ride',0),push=basicPose('accelerate',200),jump=basicPose('jump',230);
    const poses=[
      {...stand,bodyYaw:direction},{...ride,bodyYaw:direction},
      {...push,bodyYaw:direction},{...jump,bodyYaw:direction},
      ...techniques.map(move=>techniquePose(move,.42,'clean',direction,direction)),
    ];
    const samples=poses.map((pose,index)=>{
      const placed={...pose,hip:place(pose.hip),feet:[place(pose.feet[0]),place(pose.feet[1])] as typeof pose.feet};
      const still=index<2;
      const expected=paintSpriteCharacter(c,DEFAULT_LOOK,placed,still,0);
      assert.ok(expected);
      return {placed,still,expected};
    });
    for(const gender of ['male','female'] as const)for(const hair of HAIR_STYLES.keys()){
      const look:Look={
        ...DEFAULT_LOOK,gender,hair,outfit:hair%OUTFITS.length,bottom:(hair+1)%BOTTOMS.length,footwear:(hair+2)%FOOTWEAR.length,
        skin:hair%SKINS.length,hairColor:hair%HAIR_COLORS.length,shirt:hair%SHIRTS.length,pants:hair%PANTS.length,shoes:hair%SHOES.length,
      };
      for(const {placed,still,expected} of samples){
        c.clearRect(0,0,canvas.width,canvas.height);
        assert.deepEqual(paintSpriteCharacter(c,look,placed,still,0),expected);
        if(!still)continue;
        const {data}=c.getImageData(0,0,canvas.width,canvas.height);
        let sole=0;
        for(let y=Math.floor(expected.shoulder.y);y<canvas.height;y++){
          for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>200){sole=y;break;}
        }
        const ground=Math.max(...placed.feet.map(foot=>foot.y));
        assert.ok(ground-sole>0&&ground-sole<=1.5,JSON.stringify({look,direction,sole,ground}));
      }
    }
  }
});

test('all streetwear combinations and NPCs have distinct front/profile/rear views and unclipped action layers',()=>{
  const canvas=createCanvas(ACTOR_WIDTH,ACTOR_HEIGHT),c=canvas.getContext('2d');
  const looks=[...LOOK_PRESETS.male,...LOOK_PRESETS.female,...RIVALS.map(npc=>npc.look),...OUTFITS.map((_,outfit)=>({...DEFAULT_LOOK,outfit,bottom:outfit%4,footwear:outfit%3}))];
  for(const look of looks){
    const views:string[]=[];
    for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
      paintRider(c as unknown as CanvasRenderingContext2D,look,'rest',0,{id:'peter-pan',progress:0,bodyHeading:heading,boardHeading:heading});
      views.push(canvas.toBuffer('image/png').toString('base64'));
      for(const technique of [{id:'kickflip',progress:.4},{id:'cross',progress:.4},{id:'wood',progress:.5},{id:'treflip',progress:.9,outcome:'miss' as const},{id:'peter-pan',progress:.96,outcome:'great' as const}]){
        paintRider(c as unknown as CanvasRenderingContext2D,look,'ride',0,{...technique,bodyHeading:heading,boardHeading:heading});
        const rgba=c.getImageData(0,0,ACTOR_WIDTH,ACTOR_HEIGHT).data;
        for(let y=0;y<ACTOR_HEIGHT;y++)for(let x=0;x<ACTOR_WIDTH;x++)if(rgba[(y*ACTOR_WIDTH+x)*4+3])assert.ok(x>0&&x<ACTOR_WIDTH-1&&y>0&&y<ACTOR_HEIGHT-1,JSON.stringify(look)+' clips at '+x+','+y);
      }
    }
    assert.equal(new Set(views).size,4,'Every direction must show a different view');
  }
});
test('step turns, shuvits, flips and compound spins keep their prescribed independent rotations',()=>{
  const rotations:Record<string,[number,number,number]>={
    'step-180':[180,0,0],'step-360':[360,0,0],pirouette:[360,0,0],'pirouette-540':[540,0,0],'pirouette-720':[720,0,0],
    pivot:[180,180,0],shuvit:[0,180,0],'pop-shuvit':[0,180,0],'front-pop':[0,-180,0],
    kickflip:[0,0,360],heelflip:[0,0,-360],bigspin:[180,360,0],bigger:[180,540,0],
    'no-com-big':[180,360,0],hardflip:[0,-180,-360],treflip:[0,360,360],varial:[0,180,360],
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
