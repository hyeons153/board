import { BOARDS } from '../game/data';
import { characterArm, characterHairBack, characterHead, characterLeg, characterTorso, type Expression } from './character';
import type { Look } from '../game/types';
import type { Motion } from './motion';
import { ACTOR_HEIGHT, ACTOR_WIDTH, basicPose, boardPoint, techniquePose, type Point, type Pose, type Technique } from './techniques';

type Ctx=CanvasRenderingContext2D;
const INK='#191e2a';
const box=(c:Ctx,color:string,x:number,y:number,w:number,h:number)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
// Scanline ellipses keep the soft silhouette crisp on the pixel canvas.
function oval(c:Ctx,color:string,x:number,y:number,w:number,h:number){
  const height=Math.max(1,Math.round(h));
  for(let row=0;row<height;row++){
    const dy=(row+.5-height/2)/(height/2),span=Math.max(1,Math.round(Math.sqrt(Math.max(0,1-dy*dy))*w));
    box(c,color,x+(w-span)/2,y+row,span,1);
  }
}
function poly(c:Ctx,color:string,points:Point[]){
  c.fillStyle=color;c.beginPath();points.forEach((p,i)=>i?c.lineTo(Math.round(p.x),Math.round(p.y)):c.moveTo(Math.round(p.x),Math.round(p.y)));c.closePath();c.fill();
}
function deck(c:Ctx,look:Look,b:Pose['board']){
  const gear=look.equipment,shape=gear?.deck?.shape??0;
  const underside=Math.cos(b.roll)<0,color=BOARDS[gear?.deck?.color??look.board];
  const edge=(u:number,v:number)=>boardPoint(b,u*([1,1.05,1,.9][shape]??1),v*([1,.9,1.25,1][shape]??1));
  const outline=[edge(-34,-3),edge(-30,-6),edge(30,-6),edge(34,-3),edge(34,3),edge(30,6),edge(-30,6),edge(-34,3)];
  const below=outline.map(p=>({...p,y:p.y+3}));poly(c,INK,below);
  // Trucks and wheels change sides when the deck turns upside down.
  const wheelSide=underside?-1:1;
  for(const u of [-25,25]){
    const axle=edge(u,0);box(c,gear?.trucks??'#a0aab3',axle.x-3,axle.y+7*wheelSide,6,2);
    const size=gear?.wheels?.size??5;
    for(const v of [-5,5]){const p=edge(u,v);box(c,INK,p.x-size/2-1,p.y+3*wheelSide,size+1,size);box(c,gear?.wheels?.color??'#96a3b4',p.x-size/2,p.y+4*wheelSide,size-1,size-2);}
  }
  poly(c,INK,outline);poly(c,color,[edge(-31,-2),edge(-28,-4),edge(28,-4),edge(31,-2),edge(31,2),edge(28,4),edge(-28,4),edge(-31,2)]);
  poly(c,'#fff4d880',[edge(-28,-4),edge(28,-4),edge(28,-3),edge(-28,-3)]);
  const design=look.deckDesign??0,accent=['#fff0cc','#83ffe1','#ff759c','#c2aaff'][design];
  if(underside){
    poly(c,'#765340',[edge(-16,-2),edge(17,-2),edge(17,2),edge(-16,2)]);
    for(const u of [-25,25]){const p=edge(u,0);box(c,'#d6dce0',p.x-2,p.y-2,4,4);}
  }else if(design===1){poly(c,accent,[edge(-25,-1),edge(24,-1),edge(24,1),edge(-25,1)]);}
  else for(const u of design===3?[-17,0,17]:[design===2?0:19]){
    poly(c,accent,[edge(u-3,-3),edge(u+3,-3),edge(u+3,3),edge(u-3,3)]);
  }
  // A permanent nose marker makes half-turns legible even on a plain deck.
  poly(c,'#f5eed3',[edge(27,-3),edge(30,-2),edge(30,2),edge(27,3)]);
}
function decorations(c:Ctx,look:Look,pose:Pose,shoulder:Point,headY:number,time:number,motion:Motion,night:boolean,great=false){
  const visuals=look.equipment?.accessories??[],x=shoulder.x,hatY=Math.max(2,headY-23),celebrate=great||['great','success','win'].includes(motion)||pose.cheer;
  // One helmet layer takes precedence; small face and torso accessories remain independent.
  const helmet=visuals.includes('rainbow')?'rainbow':visuals.includes('crown')?'crown':visuals.includes('helmet')?'helmet':undefined;
  if(helmet){
    oval(c,INK,x-21,hatY,42,19);oval(c,helmet==='crown'?'#edc86e':helmet==='rainbow'?'#f5da77':'#a7c6d6',x-19,hatY+2,38,15);
    box(c,'#fff3ce',x-10,hatY+5,8,2);
    if(helmet==='crown'){for(const dx of [-11,-2,7])box(c,'#f6d779',x+dx,Math.max(2,hatY-3),5,6);box(c,'#e997a6',x-2,hatY+8,4,3);}
    if(helmet==='rainbow'){box(c,INK,x-8,hatY+8,3,3);box(c,INK,x+5,hatY+8,3,3);box(c,'#efa458',x-3,hatY+12,7,3);}
  }
  for(const [index,visual] of visuals.entries()){
    const px=pose.hip.x-9+index*8,py=pose.hip.y-5;
    if(visual==='glasses'){box(c,'#18263c',x-11,headY-1,10,5);box(c,'#18263c',x+2,headY-1,10,5);box(c,'#18263c',x-1,headY,4,1);box(c,'#75d4db',x-9,headY,3,1);}
    else if(visual==='headphones'){oval(c,'#364b5b',x-17,headY-6,7,14);oval(c,'#364b5b',x+11,headY-6,7,14);box(c,'#afd9cb',x-15,headY-2,3,6);box(c,'#afd9cb',x+13,headY-2,3,6);}
    else if(visual==='headband'){box(c,'#eb9eba',x-13,headY-8,26,3);box(c,'#f9e6a4',x+9,headY-9,4,5);}
    else if(visual==='scarf'||visual==='cloth'){box(c,visual==='scarf'?'#e06968':'#f5efd9',x-8,headY+12,16,4);box(c,visual==='scarf'?'#d95460':'#e1e8da',x+7,headY+15,5,10);}
    else if(visual==='sticker'){box(c,'#f5df98',x-2,shoulder.y+8,6,5);box(c,'#669a7d',x,shoulder.y+9,2,2);}
    else if(visual==='camera'){box(c,INK,x-5,shoulder.y+10,11,8);oval(c,'#a9d5d9',x-2,shoulder.y+12,5,5);box(c,'#839aaf',x+3,shoulder.y+11,2,1);}
    else if(visual==='whistle'){box(c,'#e5c477',x-1,shoulder.y+7,2,8);box(c,'#f9db7d',x-3,shoulder.y+14,7,4);}
    else if(visual==='wrists'||visual==='tape'||visual==='led'){
      const spread=pose.cheer?27:15+Math.max(0,pose.arms)*.9,handY=pose.cheer?shoulder.y-16:shoulder.y+20-Math.max(0,pose.arms)*1.5;
      const color=visual==='led'&&night?'#85ffde':visual==='tape'?'#f1e4c6':'#637e98';
      box(c,color,x+spread-3,handY-4,6,3);if(visual==='led'&&night)for(const dx of [-7,7])box(c,'#afffe3',x+spread+dx,handY-3,2,2);
    }
    else if(['helmet','crown','rainbow','knees','laces'].includes(visual))continue;
    else if(visual==='duck'||visual==='chick'){oval(c,'#f4d57b',px-3,py-3,8,8);box(c,'#ef995f',px+3,py-1,4,2);box(c,INK,px+1,py-2,1,1);}
    else if(visual==='cactus'){const sway=Math.round(Math.sin(time/150)*2);box(c,'#76ba88',px-2+sway,py-7,5,12);box(c,'#76ba88',px-5+sway,py-4,3,4);box(c,'#76ba88',px+3+sway,py-6,3,5);box(c,'#b98271',px-3,py+3,8,4);}
    else if(visual==='pinwheel'){box(c,'#c6b490',px,py-8,1,13);const spin=Math.floor(time/160)%2;box(c,'#f3b0af',px-4+spin*3,py-10,5,3);box(c,'#9be2d0',px,py-8,5,3);box(c,'#ebd38b',px-2,py-7,4,3);}
    else if(visual==='snail'){oval(c,'#bda0cc',px-3,py-3,8,7);box(c,'#bad89a',px-3,py+2,11,3);box(c,'#385d4a',px+5,py,1,2);}
    else if(visual==='clover'){for(const [dx,dy] of [[-2,-3],[2,-3],[-2,1],[2,1]])oval(c,'#8bbf86',px+dx,py+dy,4,4);box(c,'#4e805b',px+1,py+3,1,4);}
    else if(visual==='bearing'||visual==='disco'){oval(c,INK,px-4,py-4,9,9);oval(c,visual==='disco'?'#c5a2dc':'#b3c7d2',px-3,py-3,7,7);box(c,'#eaf6e6',px-1,py-1,3,3);}
    else if(visual==='bottle'){box(c,'#96d9e1',px-2,py-4,6,10);box(c,'#edf8e5',px-1,py-6,4,2);box(c,'#c8f4ee',px-1,py-1,2,4);}
    else if(visual==='metronome'){poly(c,'#bda0d8',[{x:px,y:py-7},{x:px+5,y:py+5},{x:px-4,y:py+5}]);box(c,'#f5df9d',px,py-3,1,7);}
    else {box(c,'#263c4b',px-4,py-5,9,11);box(c,visual==='pouch'?'#e9c0a3':visual==='dance-note'?'#bac9ef':visual==='trick-note'?'#e8b4b0':'#eee8c7',px-3,py-4,7,9);box(c,'#7a947b',px-1,py-1,3,2);}
  }
  if(celebrate&&visuals.some(visual=>['headband','disco','crown','rainbow'].includes(visual)))for(let i=0;i<6;i++){
    const angle=i/6*Math.PI*2+time/700;box(c,['#f9dfa1','#9de6d1','#e3ade7'][i%3],x+Math.cos(angle)*24,Math.max(2,headY+Math.sin(angle)*19),2,2);
  }
}
export function paintRider(c:Ctx,look:Look,motion:Motion,time:number,technique?:Technique,night=false){
  c.clearRect(0,0,ACTOR_WIDTH,ACTOR_HEIGHT);c.imageSmoothingEnabled=false;
  const pose=technique?techniquePose(technique.id,technique.progress??(time%4000/4000),technique.outcome,technique.bodyHeading,technique.boardHeading):basicPose(motion,time);
  // Leave room for nose pivots and airborne techniques. Portraits use a tighter canvas.
  const padding=(c.canvas.width-128)/2;
  pose.hip.x+=padding;pose.board.x+=padding;pose.hip.y+=16;pose.board.y+=16;pose.feet.forEach(foot=>{foot.x+=padding;foot.y+=16;});
  c.globalAlpha=.28;box(c,'#171f30',29+padding,126,70,3);box(c,'#171f30',38+padding,129,51,1);c.globalAlpha=1;
  if(look.equipment?.accessories.includes('rainbow')&&pose.fall<.1&&(technique||['ride','accelerate','carve','brake'].includes(motion)))for(const [i,color] of ['#ee92a5','#f0cb81','#c6e99b','#8ed8d1','#bca7de'].entries())box(c,color,pose.board.x-55+i*4,Math.min(ACTOR_HEIGHT-12,pose.board.y+4)+i,42-i*4,2);
  deck(c,look,pose.board);
  const expression:Expression=pose.fall>.05||motion==='lose'?'sad':pose.cheer||['great','win','success'].includes(motion)?'smile':motion==='wobble'?'surprise':'neutral';
  if(pose.fall>.05){
    const f=pose.fall,hip={x:pose.hip.x+f*11,y:pose.hip.y+(116-pose.hip.y)*f};
    const shoulder={x:hip.x+f*20,y:hip.y-20*(1-f)},headY=Math.min(99,shoulder.y-11*(1-f)-3);
    characterHairBack(c,look,shoulder.x+f*7,headY,pose.bodyYaw,time);
    characterLeg(c,look,hip,{x:39+padding,y:120},0);characterLeg(c,look,hip,{x:63+padding,y:125},1);
    characterTorso(c,look,shoulder,hip,pose.bodyYaw);
    characterArm(c,look,shoulder,{x:shoulder.x+9,y:124},.6);
    characterHead(c,look,shoulder.x+f*7,headY,pose.bodyYaw,expression,time);
    decorations(c,look,pose,shoulder,headY,time,motion,night);return;
  }
  const bodyWidth=18+Math.abs(Math.cos(pose.bodyYaw))*9;
  const shoulder={x:pose.hip.x+pose.lean,y:pose.hip.y-20},headY=shoulder.y-11;
  characterHairBack(c,look,shoulder.x,headY,pose.bodyYaw,time);
  const hips=[{x:pose.hip.x-8*Math.cos(pose.bodyYaw),y:pose.hip.y},{x:pose.hip.x+8*Math.cos(pose.bodyYaw),y:pose.hip.y}];
  // Keep the original foot contacts and draw the farther leg before crossed steps.
  const order=pose.feet[0].y<pose.feet[1].y?[0,1]:[1,0];
  for(const i of order)characterLeg(c,look,hips[i],pose.feet[i],i);
  const spread=pose.cheer?27:15+Math.max(0,pose.arms)*.9;
  const armY=pose.cheer?shoulder.y-16:shoulder.y+20-Math.max(0,pose.arms)*1.5;
  characterArm(c,look,{x:shoulder.x-bodyWidth/2,y:shoulder.y+1},{x:shoulder.x-spread,y:armY},-.45);
  characterTorso(c,look,shoulder,pose.hip,pose.bodyYaw);
  characterArm(c,look,{x:shoulder.x+bodyWidth/2,y:shoulder.y+1},{x:shoulder.x+spread,y:armY+2},.45);
  characterHead(c,look,shoulder.x,headY,pose.bodyYaw,expression,time);
  decorations(c,look,pose,shoulder,headY,time,motion,night,technique?.outcome==='great'&&(technique.progress??0)>.65);
  if(pose.cheer)for(let i=0;i<8;i++){
    const angle=i/8*Math.PI*2+time/1400;box(c,['#ffe795','#c3ffc5','#ffad91'][i%3],shoulder.x+Math.cos(angle)*31,headY+Math.sin(angle)*21,2,2);
  }
}
