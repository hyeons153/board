import { BOARDS, HAIR_COLORS, PANTS, SHIRTS, SHOES, SKINS } from '../game/data';
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
function limb(c:Ctx,color:string,a:Point,b:Point,width:number){
  const length=Math.hypot(b.x-a.x,b.y-a.y)||1,dx=-(b.y-a.y)/length*width/2,dy=(b.x-a.x)/length*width/2;
  poly(c,color,[{x:a.x+dx,y:a.y+dy},{x:b.x+dx,y:b.y+dy},{x:b.x-dx,y:b.y-dy},{x:a.x-dx,y:a.y-dy}]);
  oval(c,color,a.x-width/2,a.y-width/2,width,width);oval(c,color,b.x-width/2,b.y-width/2,width,width);
}
function joint(a:Point,b:Point,length:number,bend:number):Point {
  const dx=b.x-a.x,dy=b.y-a.y,distance=Math.max(1,Math.hypot(dx,dy));
  const height=Math.sqrt(Math.max(0,length*length-distance*distance/4))*bend;
  return {x:(a.x+b.x)/2+dy/distance*height,y:(a.y+b.y)/2-dx/distance*height};
}
function deck(c:Ctx,look:Look,b:Pose['board']){
  const underside=Math.cos(b.roll)<0,color=BOARDS[look.board];
  const edge=(u:number,v:number)=>boardPoint(b,u,v);
  const outline=[edge(-34,-3),edge(-30,-6),edge(30,-6),edge(34,-3),edge(34,3),edge(30,6),edge(-30,6),edge(-34,3)];
  const below=outline.map(p=>({...p,y:p.y+3}));poly(c,INK,below);
  // Trucks and wheels change sides when the deck turns upside down.
  const wheelSide=underside?-1:1;
  for(const u of [-25,25]){
    const axle=edge(u,0);box(c,'#a0aab3',axle.x-3,axle.y+3*wheelSide,6,2);
    for(const v of [-5,5]){const p=edge(u,v);box(c,INK,p.x-3,p.y+3*wheelSide,6,5);box(c,'#96a3b4',p.x-1,p.y+4*wheelSide,2,2);}
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
function leg(c:Ctx,look:Look,hip:Point,foot:Point,index:number){
  const knee=joint(hip,{x:foot.x,y:foot.y-4},15,index===0?.1:-.08);
  const jeans=PANTS[look.pants??0],shoe=SHOES[look.shoes??0];
  for(const [a,b] of [[hip,knee],[knee,{x:foot.x,y:foot.y-4}]]){limb(c,INK,a,b,10);limb(c,jeans,a,b,7);}
  box(c,'#ffffff20',knee.x-1,knee.y-2,2,5);
  oval(c,INK,foot.x-7,foot.y-6,15,7);oval(c,shoe,foot.x-6,foot.y-5,12,5);box(c,'#d4d9d4',foot.x-5,foot.y-1,11,1);
}
function arm(c:Ctx,skin:string,shirt:string,shoulder:Point,hand:Point,bend:number){
  const elbow=joint(shoulder,hand,13,bend);
  limb(c,INK,shoulder,elbow,8);limb(c,shirt,shoulder,elbow,6);
  limb(c,INK,elbow,hand,6);limb(c,skin,elbow,hand,4);oval(c,skin,hand.x-3,hand.y-3,6,6);
}
function head(c:Ctx,look:Look,x:number,y:number,yaw:number){
  const skin=SKINS[look.skin],hair=HAIR_COLORS[look.hairColor??look.hair],front=Math.cos(yaw),side=Math.sin(yaw),female=look.gender==='female';
  const face=x+side*2;
  if(look.hair===2){
    oval(c,INK,x-15,y-12,30,28);oval(c,hair,x-13,y-11,26,25);
    for(const offset of [-15,8]){oval(c,INK,x+offset,y-3,7,26);oval(c,hair,x+offset+1,y-3,5,24);}
  }
  oval(c,INK,x-15,y-16,30,31);oval(c,hair,x-13,y-14,26,27);
  box(c,skin,x-3,y+10,6,6);
  if(front<-.2){oval(c,'#ffffff20',x-10,y-11,13,4);box(c,'#ffffff15',x-10,y-5,2,12);}
  else {
    oval(c,skin,face-12,y-10,24,24);
    oval(c,skin,x+(side<-.3?-15:10),y,5,7);
    oval(c,hair,x-13,y-14,26,11);
    box(c,hair,x-12,y-7,4,female&&look.hair===0?13:9);
    box(c,hair,x+9,y-7,4,female&&look.hair===0?12:6);
    box(c,hair,x-5,y-5,5,3);box(c,hair,x+1,y-5,4,2);
    const eyes=front>.5?[-5,4]:[side>0?5:-5];
    for(const eye of eyes){
      box(c,INK,face+eye,y,3,4);box(c,'#fff8e9',face+eye,y,1,1);
      if(female)box(c,INK,face+eye+(eye<0?-1:3),y,1,1);
    }
    oval(c,'#ee8e8a80',face-9,y+5,4,2);oval(c,'#ee8e8a80',face+6,y+5,4,2);
    box(c,'#a56056',face,y+8,3,1);box(c,'#a56056',face-1,y+7,1,1);box(c,'#a56056',face+3,y+7,1,1);box(c,'#ffffff38',face-4,y+10,8,1);
  }
  if(look.hair===1){oval(c,hair,x-12,y-18,20,11);oval(c,'#ffffff22',x-8,y-16,10,2);}
  if(look.hair===3){
    oval(c,INK,x-15,y-17,30,16);oval(c,hair,x-13,y-15,26,13);
    box(c,hair,x+(side<0?-18:2),y-5,17,3);box(c,'#ffffff35',x-8,y-12,12,2);
  }else oval(c,'#ffffff22',x-9,y-12,12,2);
}

export function paintRider(c:Ctx,look:Look,motion:Motion,time:number,technique?:Technique){
  c.clearRect(0,0,ACTOR_WIDTH,ACTOR_HEIGHT);c.imageSmoothingEnabled=false;
  const pose=technique?techniquePose(technique.id,technique.progress??(time%4000/4000),technique.outcome,technique.bodyHeading,technique.boardHeading):basicPose(motion,time);
  // Leave room for nose pivots and airborne techniques. Portraits use a tighter canvas.
  const padding=(c.canvas.width-128)/2;
  pose.hip.x+=padding;pose.board.x+=padding;pose.hip.y+=16;pose.board.y+=16;pose.feet.forEach(foot=>{foot.x+=padding;foot.y+=16;});
  c.globalAlpha=.28;box(c,'#171f30',29+padding,126,70,3);box(c,'#171f30',38+padding,129,51,1);c.globalAlpha=1;
  deck(c,look,pose.board);
  const shirt=SHIRTS[look.shirt],skin=SKINS[look.skin];
  if(pose.fall>.05){
    const f=pose.fall,hip={x:pose.hip.x+f*11,y:pose.hip.y+(116-pose.hip.y)*f};
    leg(c,look,hip,{x:39+padding,y:120},0);leg(c,look,hip,{x:63+padding,y:125},1);
    const shoulder={x:hip.x+f*20,y:hip.y-21*(1-f)};
    limb(c,INK,hip,shoulder,22);limb(c,shirt,hip,shoulder,18);
    arm(c,skin,shirt,shoulder,{x:shoulder.x+9,y:124},.6);
    head(c,look,shoulder.x+f*7,Math.min(104,shoulder.y-15*(1-f)-3),pose.bodyYaw);return;
  }
  const bodyWidth=17+Math.abs(Math.cos(pose.bodyYaw))*4;
  const shoulder={x:pose.hip.x+pose.lean,y:pose.hip.y-21},headY=shoulder.y-14;
  const hips=[{x:pose.hip.x-8*Math.cos(pose.bodyYaw),y:pose.hip.y},{x:pose.hip.x+8*Math.cos(pose.bodyYaw),y:pose.hip.y}];
  // Draw the farther leg first so crossed steps retain readable foot order.
  const order=pose.feet[0].y<pose.feet[1].y?[0,1]:[1,0];
  for(const i of order)leg(c,look,hips[i],pose.feet[i],i);
  const spread=pose.cheer?27:15+Math.max(0,pose.arms)*.9;
  const armY=pose.cheer?shoulder.y-16:shoulder.y+20-Math.max(0,pose.arms)*1.5;
  arm(c,skin,shirt,{x:shoulder.x-bodyWidth/2,y:shoulder.y+1},{x:shoulder.x-spread,y:armY},-.45);
  const torso=[{x:shoulder.x-bodyWidth/2+3,y:shoulder.y-3},{x:shoulder.x+bodyWidth/2-3,y:shoulder.y-3},{x:shoulder.x+bodyWidth/2,y:shoulder.y+1},{x:pose.hip.x+11,y:pose.hip.y-3},{x:pose.hip.x+8,y:pose.hip.y+1},{x:pose.hip.x-8,y:pose.hip.y+1},{x:pose.hip.x-11,y:pose.hip.y-3},{x:shoulder.x-bodyWidth/2,y:shoulder.y+1}];
  poly(c,INK,torso);poly(c,shirt,torso.map(p=>({x:p.x+(p.x<pose.hip.x?2:-2),y:p.y+(p.y<shoulder.y?1:p.y>pose.hip.y-3?-2:0)})));
  box(c,'#ffffff30',shoulder.x-bodyWidth/2+3,shoulder.y,6,2);box(c,'#0000001c',pose.hip.x+6,pose.hip.y-13,3,12);
  if(Math.cos(pose.bodyYaw)>.25)box(c,'#f4e8be',shoulder.x-2,shoulder.y+5,6,3);
  else if(Math.cos(pose.bodyYaw)<-.25)box(c,'#ffffff22',shoulder.x-6,shoulder.y+6,12,2);
  arm(c,skin,shirt,{x:shoulder.x+bodyWidth/2,y:shoulder.y+1},{x:shoulder.x+spread,y:armY+2},.45);
  head(c,look,shoulder.x,headY,pose.bodyYaw);
  if(pose.cheer)for(let i=0;i<8;i++){
    const angle=i/8*Math.PI*2+time/1400;box(c,['#ffe795','#c3ffc5','#ffad91'][i%3],shoulder.x+Math.cos(angle)*31,headY+Math.sin(angle)*21,2,2);
  }
}
