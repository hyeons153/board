import { EYE_COLORS, HAIR_COLORS, PANTS, SHIRTS, SHOES, SKINS } from '../game/data';
import type { Look } from '../game/types';
import type { Point } from './techniques';

type Ctx=CanvasRenderingContext2D;
export type Expression='neutral'|'smile'|'surprise'|'wink'|'sad';
const INK='#29202e',CREAM='#f4e6ce';
const projection=new WeakMap<Ctx,{x:number;scale:number}>();
const rect=(c:Ctx,color:string,x:number,y:number,w:number,h:number)=>{
  const view=projection.get(c);if(view){x=view.x+(x-view.x)*view.scale;w*=view.scale;}
  c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
};
const shades=new Map<string,string>();
function tint(color:string,amount:number){
  const key=color+amount,cached=shades.get(key);if(cached)return cached;
  const target=amount>0?255:0,a=Math.abs(amount);
  const result='#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*(1-a)+target*a).toString(16).padStart(2,'0')).join('');
  shades.set(key,result);return result;
}
function ellipse(c:Ctx,color:string,x:number,y:number,w:number,h:number){
  for(let row=0;row<Math.round(h);row++){
    const dy=(row+.5-h/2)/(h/2),span=Math.max(1,Math.round(Math.sqrt(Math.max(0,1-dy*dy))*w));
    rect(c,color,x+(w-span)/2,y+row,span,1);
  }
}
// Rasterize each layer on the same pixel grid, including diagonal hair locks.
function polygon(c:Ctx,color:string,points:Point[]){
  const min=Math.floor(Math.min(...points.map(p=>p.y))),max=Math.ceil(Math.max(...points.map(p=>p.y)));
  for(let row=min;row<max;row++){
    const y=row+.5,xs:number[]=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))xs.push(a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y));
    }
    xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)rect(c,color,Math.ceil(xs[i]),row,Math.ceil(xs[i+1])-Math.ceil(xs[i]),1);
  }
}
function line(c:Ctx,color:string,a:Point,b:Point,width:number){
  const len=Math.hypot(b.x-a.x,b.y-a.y)||1,dx=-(b.y-a.y)/len*width/2,dy=(b.x-a.x)/len*width/2;
  polygon(c,color,[{x:a.x+dx,y:a.y+dy},{x:b.x+dx,y:b.y+dy},{x:b.x-dx,y:b.y-dy},{x:a.x-dx,y:a.y-dy}]);
  ellipse(c,color,a.x-width/2,a.y-width/2,width,width);ellipse(c,color,b.x-width/2,b.y-width/2,width,width);
}
function joint(a:Point,b:Point,length:number,bend:number):Point{
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),h=Math.sqrt(Math.max(0,length*length-d*d/4))*bend;
  return {x:(a.x+b.x)/2+dy/d*h,y:(a.y+b.y)/2-dx/d*h};
}
const hairColor=(look:Look)=>HAIR_COLORS[look.hairColor??(look.hair<4?look.hair:0)];

export function characterLeg(c:Ctx,look:Look,hip:Point,foot:Point,index:number){
  const knee=joint(hip,{x:foot.x,y:foot.y-5},15,index===0?.1:-.08),bottom=look.bottom??0;
  const cloth=PANTS[look.pants??0],skin=SKINS[look.skin],shoe=SHOES[look.shoes??0],ankle={x:foot.x,y:foot.y-5};
  const exposed=bottom===2||bottom===3;
  for(const [i,[a,b]] of [[hip,knee],[knee,ankle]].entries()){
    const width=exposed?(i===0?10:7):bottom===1?10:12;
    line(c,INK,a,b,width);line(c,exposed?(i===0?skin:'#3b3446'):cloth,a,b,width-3);
    line(c,exposed?(i===0?tint(skin,.16):'#5d5268'):tint(cloth,.17),{x:a.x-2,y:a.y},{x:b.x-2,y:b.y},2);
  }
  if(bottom===0){rect(c,tint(cloth,-.22),knee.x-5,knee.y-4,9,7);rect(c,tint(cloth,.17),knee.x-4,knee.y-4,7,2);rect(c,tint(cloth,-.35),knee.x-4,knee.y+1,7,1);}
  if(bottom===1){rect(c,tint(cloth,-.22),ankle.x-4,ankle.y-4,8,4);rect(c,tint(cloth,.16),ankle.x-3,ankle.y-4,6,1);}
  if(look.equipment?.accessories.includes('knees')){ellipse(c,INK,knee.x-5,knee.y-3,10,7);ellipse(c,'#9bafc0',knee.x-4,knee.y-2,8,5);}
  const high=(look.footwear??0)>0,boot=look.footwear===2;
  if(high){rect(c,INK,foot.x-5,foot.y-10,10,8);rect(c,shoe,foot.x-4,foot.y-9,8,7);rect(c,tint(shoe,-.23),foot.x+2,foot.y-8,2,6);}
  ellipse(c,INK,foot.x-8,foot.y-6,17,7);rect(c,INK,foot.x-7,foot.y-3,15,4);
  ellipse(c,shoe,foot.x-6,foot.y-5,13,5);rect(c,tint(shoe,.25),foot.x-5,foot.y-5,5,2);
  rect(c,boot?'#e3c69e':CREAM,foot.x-6,foot.y-1,13,1);rect(c,tint(shoe,-.3),foot.x+4,foot.y-4,2,3);
  for(const dy of high?[-7,-4]:[-4])rect(c,look.equipment?.accessories.includes('laces')?'#f5d58b':CREAM,foot.x-3,foot.y+dy,5,1);
}

export function characterArm(c:Ctx,look:Look,shoulder:Point,hand:Point,bend:number){
  const outfit=look.outfit??0,elbow=joint(shoulder,hand,13,bend),skin=SKINS[look.skin];
  const shirt=SHIRTS[look.shirt],sleeve=outfit===1||outfit===5?CREAM:shirt;
  line(c,INK,shoulder,elbow,11);line(c,sleeve,shoulder,elbow,8);
  line(c,tint(sleeve,.18),{x:shoulder.x-2,y:shoulder.y},{x:elbow.x-2,y:elbow.y},2);
  const end=outfit===3?{x:elbow.x+(hand.x-elbow.x)*.2,y:elbow.y+(hand.y-elbow.y)*.2}:hand;
  line(c,INK,elbow,hand,outfit===3?7:10);line(c,outfit===3?skin:sleeve,elbow,hand,outfit===3?4:7);
  if(outfit!==3){line(c,tint(sleeve,-.23),{x:elbow.x+2,y:elbow.y},{x:hand.x+2,y:hand.y-2},2);line(c,INK,{x:hand.x-3,y:hand.y-4},{x:hand.x+3,y:hand.y-4},3);line(c,outfit===1?shirt:CREAM,{x:hand.x-3,y:hand.y-5},{x:hand.x+3,y:hand.y-5},2);}
  else line(c,tint(shirt,-.2),{x:end.x-2,y:end.y},{x:end.x+2,y:end.y},2);
  ellipse(c,INK,hand.x-4,hand.y-3,8,7);rect(c,skin,hand.x-3,hand.y-2,6,5);rect(c,tint(skin,.2),hand.x-3,hand.y-2,3,2);rect(c,tint(skin,-.12),hand.x+2,hand.y,1,3);
}

export function characterTorso(c:Ctx,look:Look,shoulder:Point,hip:Point,yaw:number){
  const front=Math.cos(yaw),side=Math.sin(yaw),width=18+9*Math.abs(front),shirt=SHIRTS[look.shirt],outfit=look.outfit??0;
  const x=shoulder.x,top=shoulder.y-2,bottom=hip.y,center=x+side*2;
  const shape=[{x:x-width/2+3,y:top-2},{x:x+width/2-3,y:top-2},{x:x+width/2,y:top+3},{x:hip.x+width/2-1,y:bottom},{x:hip.x-width/2+1,y:bottom},{x:x-width/2,y:top+3}];
  polygon(c,INK,shape);polygon(c,shirt,shape.map(p=>({x:p.x+(p.x<hip.x?2:-2),y:p.y+(p.y<top?2:p.y>bottom-2?-2:0)})));
  line(c,tint(shirt,-.22),{x:x+width/2-3,y:top+5},{x:hip.x+width/2-3,y:bottom-3},3);
  rect(c,tint(shirt,.16),x-width/2+4,top+3,4,6);rect(c,tint(shirt,-.3),hip.x-width/2+2,bottom-3,width-4,2);
  if((look.bottom??0)===2){rect(c,INK,hip.x-12,bottom,24,7);rect(c,PANTS[look.pants??0],hip.x-10,bottom+1,20,5);rect(c,INK,hip.x-1,bottom+3,2,4);}
  if(look.bottom===3){polygon(c,INK,[{x:hip.x-10,y:bottom-2},{x:hip.x+10,y:bottom-2},{x:hip.x+15,y:bottom+9},{x:hip.x-15,y:bottom+9}]);polygon(c,PANTS[look.pants??0],[{x:hip.x-9,y:bottom},{x:hip.x+9,y:bottom},{x:hip.x+12,y:bottom+7},{x:hip.x-12,y:bottom+7}]);for(const dx of [-7,-2,3,8])rect(c,tint(PANTS[look.pants??0],-.3),hip.x+dx,bottom+2,2,5);rect(c,CREAM,hip.x-12,bottom+7,25,1);}
  if(front<-.35){
    if([0,2,4].includes(outfit)){ellipse(c,INK,x-10,top-3,20,10);ellipse(c,tint(shirt,.22),x-8,top-2,16,7);rect(c,tint(shirt,-.2),x-6,top+4,12,2);}
    else if(outfit===5){polygon(c,CREAM,[{x:x-10,y:top},{x:x+10,y:top},{x:x+7,y:top+9},{x:x-7,y:top+9}]);rect(c,shirt,x-7,top+2,14,1);}
    else {rect(c,tint(shirt,.25),x-7,top+4,14,2);rect(c,tint(shirt,-.15),x-5,top+8,10,2);}
    return;
  }
  if(outfit===0||outfit===4){
    ellipse(c,INK,center-8,top-3,16,8);ellipse(c,tint(shirt,-.28),center-6,top-2,12,5);
    rect(c,CREAM,center-6,top+2,2,8);rect(c,CREAM,center+5,top+2,2,7);
    rect(c,tint(shirt,-.28),center-7,top+12,15,4);rect(c,tint(shirt,.22),center-5,top+12,11,1);
    if(outfit===4){rect(c,CREAM,hip.x-width/2+3,bottom-6,width-6,4);rect(c,INK,hip.x-width/2+3,bottom-3,width-6,2);}
  }else if(outfit===1||outfit===2){
    rect(c,CREAM,center-4,top+1,8,bottom-top-5);rect(c,'#d0b89e',center-4,bottom-7,8,3);
    line(c,INK,{x:center-5,y:top},{x:center-5,y:bottom-4},2);line(c,INK,{x:center+5,y:top},{x:center+5,y:bottom-4},2);
    rect(c,CREAM,x-width/2+3,bottom-4,width-6,2);
    if(outfit===2){ellipse(c,CREAM,center-8,top-4,16,6);rect(c,INK,center-2,top,4,3);rect(c,'#b99561',center-10,top+7,4,3);rect(c,'#b99561',center+7,top+7,4,3);}
    else {rect(c,CREAM,center-9,top+5,4,5);for(const dy of [5,10,15])rect(c,'#e8c47f',center+5,top+dy,1,1);}
  }else if(outfit===5){
    polygon(c,CREAM,[{x:center-9,y:top-1},{x:center,y:top+8},{x:center+9,y:top-1},{x:center+4,y:top+10},{x:center-4,y:top+10}]);
    rect(c,'#dba27a',center-2,top+7,4,3);polygon(c,'#e4b583',[{x:center,y:top+9},{x:center-4,y:top+15},{x:center+4,y:top+15}]);rect(c,CREAM,hip.x-width/2+3,bottom-4,width-6,2);
  }else if(outfit===6){rect(c,CREAM,center-7,top-1,14,3);for(const dx of [-7,-3,1,5])rect(c,tint(shirt,.14),center+dx,top+6,1,10);}
  else {rect(c,INK,center-6,top-1,12,3);rect(c,CREAM,center-3,top+7,7,3);}
}

export function characterHairBack(c:Ctx,look:Look,x:number,y:number,yaw:number,time:number){
  projection.set(c,{x,scale:.78+.22*Math.abs(Math.cos(yaw))});
  const style=look.hair,hair=hairColor(look),sway=Math.round(Math.sin(time/240)*1.5),side=Math.sin(yaw);
  const lock=(dx:number,dy:number,w:number,h:number)=>{ellipse(c,INK,x+dx,y+dy,w,h);ellipse(c,tint(hair,-.14),x+dx+2,y+dy+2,w-4,h-4);rect(c,tint(hair,.14),x+dx+3,y+dy+5,2,h-10);};
  if(style===2||style===11){lock(-19,0,38,34);if(style===11){lock(-23+sway,6,12,27);lock(11+sway,6,12,27);}}
  if(style===6)for(const sign of [-1,1]){lock(sign<0?-27+sway:15-sway,-9,13,38);rect(c,CREAM,x+(sign<0?-22:17),y-8,6,4);rect(c,INK,x+(sign<0?-22:17),y-4,6,1);}
  if(style===9||style===10){const dx=style===10?(side>0?-28:13):14,top=style===10?-23:-18;lock(dx+sway,top,18,style===10?48:43);rect(c,CREAM,x+dx+2,y+top+3,10,3);}
  if(style===8){lock(-9,-27,19,16);ellipse(c,tint(hair,.18),x-5,y-24,9,5);rect(c,CREAM,x+2,y-17,6,2);}
  if(style===7){lock(-19,-7,38,28);rect(c,tint(hair,.2),x-15,y+13,29,2);}
  projection.delete(c);
}

export function characterHead(c:Ctx,look:Look,x:number,y:number,yaw:number,expression:Expression='neutral',time=0){
  const hair=hairColor(look),skin=SKINS[look.skin],eye=EYE_COLORS[look.eyes??0],front=Math.cos(yaw),side=Math.sin(yaw),back=front<-.32;
  const style=look.hair,profile=Math.abs(front)<.35,face=x+side*4;
  if(back)characterHairBack(c,look,x,y,yaw,time);
  projection.set(c,{x,scale:.78+.22*Math.abs(front)});
  const local=(color:string,coords:number[][])=>polygon(c,color,coords.map(([dx,dy])=>({x:x+dx,y:y+dy})));
  const contour=[[-16,-10],[-20,-12],[-17,-17],[-10,-20],[-7,-23],[1,-22],[0,-27],[7,-26],[10,-22],[10,-19],[17,-17],[20,-11],[23,-10],[19,-5],[21,1],[17,7],[13,12],[-12,12],[-18,7],[-20,1]];
  // The front, profile and rear silhouettes share the same skull anchor.
  if([2,6,7,8,9,10,11].includes(style))ellipse(c,INK,x-20,y-23,40,38);else local(INK,contour);
  ellipse(c,tint(hair,-.22),x-18,y-21,37,35);ellipse(c,hair,x-16,y-20,32,27);
  if(!back){
    ellipse(c,INK,face-15,y-9,30,27);ellipse(c,tint(skin,-.16),face-13,y-8,26,25);ellipse(c,skin,face-12,y-8,24,22);
    ellipse(c,tint(skin,.12),face-9,y-5,18,19);
    for(const sign of profile?[side>0?-1:1]:[-1,1]){ellipse(c,INK,face+sign*13-3,y+2,6,8);ellipse(c,skin,face+sign*13-2,y+3,4,5);rect(c,tint(skin,-.18),face+sign*13,y+4,1,2);}
    rect(c,tint(skin,-.2),x-4,y+14,8,4);rect(c,skin,x-3,y+14,6,3);
    const eyes=profile?[side>0?5:-9]:[-10,4];
    for(const [i,dx] of eyes.entries()){
      const ex=face+dx,closed=(expression==='wink'&&i===1)||(time>0&&Math.floor(time/130)%29===28);
      if(expression==='smile'||closed){rect(c,INK,ex,y+3,6,2);rect(c,INK,ex+1,y+2,4,1);}
      else {rect(c,INK,ex-1,y+1,8,3);rect(c,'#fff4e5',ex,y+4,6,6);rect(c,tint(eye,-.25),ex+2,y+4,4,4);rect(c,eye,ex+2,y+7,4,3);rect(c,tint(eye,.3),ex+2,y+9,4,1);rect(c,'#fff9ed',ex+2,y+4,2,2);if(look.gender==='female')rect(c,INK,ex-2,y+1,2,1);}
    }
    rect(c,'#e99c8b',face-12,y+11,4,2);rect(c,'#e99c8b',face+8,y+11,4,2);
    if(expression==='surprise')ellipse(c,'#b86d63',face-1,y+12,3,4);
    else if(expression==='smile'){ellipse(c,'#bc6b62',face-3,y+12,7,4);rect(c,'#fff0d8',face-2,y+12,5,1);}
    else {rect(c,'#c78370',face-1,y+14,3,1);if(expression==='sad')rect(c,'#c78370',face,y+13,1,1);}
  }
  // Layered locks leave the eyes clear while giving every hairstyle its own outline.
  local(hair,[[-17,-12],[-11,-19],[-3,-21],[4,-20],[12,-17],[18,-10],[16,-3],[13,2],[9,-4],[6,-11],[2,-4],[-2,3],[-5,5],[-6,-4],[-12,1],[-14,5],[-16,1]]);
  if(back){
    ellipse(c,hair,x-17,y-17,34,30);ellipse(c,tint(hair,-.12),x-13,y+3,27,12);
    for(const dx of [-11,-5,2,8])local(tint(hair,-.23),[[dx,-1],[dx+2,4],[dx+1,11],[dx-2,8]]);
  }else {
    if(style===1)local(tint(hair,.08),[[-17,-12],[-8,-19],[7,-20],[14,-14],[5,-11],[-2,-1],[-6,5],[-6,-4],[-12,1]]);
    if(style===4){local(INK,[[-17,-9],[-25,-11],[-19,-16],[-19,-21],[-11,-18],[-3,-24],[3,-24],[12,-19],[18,-19],[18,-13],[24,-10],[18,-6]]);local(hair,[[-17,-11],[-21,-12],[-16,-15],[-17,-19],[-10,-16],[-2,-22],[3,-22],[12,-17],[16,-17],[16,-12],[21,-10],[15,-7]]);}
    if(style===7){ellipse(c,hair,x-17,y-16,34,12);rect(c,tint(hair,-.18),x-18,y-6,4,17);rect(c,tint(hair,-.18),x+15,y-5,4,17);}
    if(style===5||style===11){local(tint(hair,-.2),[[-17,-7],[-20,-4],[-17,4],[-13,8],[-14,0],[-9,-5]]);local(tint(hair,-.16),[[12,-9],[19,-4],[21,2],[17,1],[18,8],[13,5],[12,-1]]);}
    if(profile){const nose=side>0?15:-16;rect(c,skin,face+nose,y+8,3,3);rect(c,hair,x+(side>0?-16:11),y-5,6,14);}
  }
  // Warm highlights and broken clusters read as strands instead of a flat helmet.
  local(tint(hair,.28),[[-13,-15],[-8,-18],[-2,-18],[-4,-15],[-9,-14],[-11,-11],[-14,-10]]);
  rect(c,tint(hair,.34),x-7,y-16,3,2);rect(c,tint(hair,.21),x+5,y-14,4,2);rect(c,tint(hair,.26),x+11,y-11,3,2);
  local(tint(hair,-.22),[[0,-14],[3,-17],[6,-14],[4,-9],[0,-3],[-2,-2]]);
  if(![2,6,7,8,9,10].includes(style))local(hair,[[1,-23],[2,-25],[6,-24],[8,-21],[6,-18],[5,-21]]);
  if(profile&&!back){
    // The visible eye belongs to the face plane, in front of the far-side fringe.
    const sign=side>0?1:-1,ex=x+(sign>0?10:-16);
    local(skin,[[sign*11,-1],[sign*17,4],[sign*20,8],[sign*17,14],[sign*7,13],[sign*7,5]]);
    rect(c,INK,ex,y+2,7,2);rect(c,'#fff4e5',ex+1,y+4,5,6);rect(c,tint(eye,-.2),ex+(sign>0?3:1),y+4,3,4);rect(c,eye,ex+(sign>0?3:1),y+7,3,3);rect(c,'#fff9ed',ex+(sign>0?3:1),y+4,1,2);
    rect(c,'#c78370',x+sign*16,y+13,2,1);rect(c,'#e99c8b',x+(sign>0?7:-10),y+11,3,2);
  }
  if(style===8){ellipse(c,INK,x+2,y-28,17,14);ellipse(c,hair,x+4,y-26,13,10);ellipse(c,tint(hair,.22),x+6,y-25,7,3);rect(c,CREAM,x+5,y-16,10,2);}
  if(style===3){ellipse(c,INK,x-19,y-21,38,18);ellipse(c,tint(hair,.18),x-17,y-19,34,14);rect(c,INK,x+(side<0?-24:3),y-7,22,4);rect(c,hair,x+(side<0?-22:4),y-7,19,2);rect(c,CREAM,x-8,y-16,9,3);}
  projection.delete(c);
}
