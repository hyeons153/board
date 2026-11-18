import { EYE_COLORS, HAIR_COLORS, PANTS, SHIRTS, SHOES, SKINS } from '../game/data';
import type { Look } from '../game/types';
import type { Point, Pose } from './techniques';

type Canvas=HTMLCanvasElement;
type Ctx=CanvasRenderingContext2D;
type Part='head'|'torso'|'arm0'|'arm1'|'thigh0'|'thigh1'|'shin0'|'shin1'|'shoe0'|'shoe1';
type Sleeve={upper:Canvas;lower:Canvas;shoulder:Point;elbow:Point;wrist:Point};
type Anchors={shoulder:Point;headY:number;wrist?:Point};
type Frame={parts:Record<Part,Canvas>;neck:number;hip:number;knee:number;ankle:number;side:boolean;model:number;armArt?:Record<Part,Canvas>;torsoUnderlay?:Canvas;motionArt?:Record<Part,Canvas>;raisedArms?:Sleeve[]};
const parts:Part[]=['head','torso','arm0','arm1','thigh0','thigh1','shin0','shin1','shoe0','shoe1'];
let factory:((width:number,height:number)=>Canvas)|undefined;
const frames=new Map<number,Frame>();
let sourceAtlas:CanvasImageSource|undefined;
let ready:Promise<void>|undefined;
const cache=new Map<string,Frame>();
const SIZE=192,CENTER=SIZE/2,ATLAS_HEIGHT=224,ATLAS_SOLE=220,SCALE=.5;
// A taller working canvas leaves room for hair above the original cell.
const HEADROOM=24,HEIGHT=ATLAS_HEIGHT+HEADROOM,SOLE=ATLAS_SOLE+HEADROOM;
const NECK=100+HEADROOM,HIP=158+HEADROOM,KNEE=186+HEADROOM,ANKLE=202+HEADROOM;
const UPPER_ARM_Y=NECK+9,ELBOW_Y=(NECK+HIP)/2,WRIST_Y=HIP-4;
const UPPER_ARM_X=27,FOREARM_X=29,LEG_X=14;
// Collar rows and eye-to-collar distances on riders-v2 (front/right/back/left).
// Rear views use the face scale of their matching front. Lower landmarks are
// common to the four drawings of each outfit.
const atlasLandmarks=[
  {neck:[100,100,100,100],face:[26,22,26,22],hip:158,knee:186,ankle:202},
  {neck:[100,103,101,103],face:[26,23,26,23],hip:155,knee:186,ankle:202},
  {neck:[99,102,101,102],face:[26,24,26,24],hip:156,knee:186,ankle:202},
  {neck:[100,100,100,100],face:[26,22,26,22],hip:157,knee:186,ankle:202},
  {neck:[98,102,102,102],face:[26,23,26,23],hip:154,knee:186,ankle:202},
  {neck:[92,96,98,96],face:[27,22,27,22],hip:148,knee:183,ankle:202},
  {neck:[102,103,105,103],face:[25,23,25,23],hip:151,knee:183,ankle:202},
  {neck:[92,99,96,99],face:[26,22,26,22],hip:148,knee:181,ankle:200},
  {neck:[92,99,97,99],face:[26,22,26,22],hip:150,knee:182,ankle:201},
  {neck:[98,103,100,103],face:[26,23,26,23],hip:151,knee:184,ankle:201},
  {neck:[99,99,101,99],face:[25,22,25,22],hip:154,knee:184,ankle:201},
  {neck:[100,100,98,100],face:[26,22,26,22],hip:150,knee:184,ankle:201},
  {neck:[98,99,98,99],face:[25,22,25,22],hip:150,knee:184,ankle:201},
  {neck:[109,104,104,104],face:[25,23,25,23],hip:145,knee:184,ankle:202},
  {neck:[99,99,98,99],face:[25,22,25,22],hip:149,knee:184,ankle:201},
] as const;
// Indices describe the artwork's original colors; matching choices preserve it verbatim.
const originals=[
  {hair:4,shirt:10,pants:9,shoes:8},{hair:5,shirt:11,pants:0,shoes:3},
  {hair:8,shirt:8,pants:2,shoes:2},{hair:0,shirt:5,pants:9,shoes:3},{hair:6,shirt:9,pants:9,shoes:1},
  {hair:4,shirt:10,pants:9,shoes:8},{hair:4,shirt:4,pants:9,shoes:8},{hair:1,shirt:9,pants:9,shoes:5},
  {hair:0,shirt:11,pants:9,shoes:3},{hair:5,shirt:9,pants:9,shoes:1},
  {hair:7,shirt:6,pants:9,shoes:8},{hair:5,shirt:12,pants:5,shoes:3},{hair:0,shirt:2,pants:9,shoes:3},
  {hair:4,shirt:4,pants:9,shoes:8},{hair:9,shirt:12,pants:5,shoes:3},
];
const rgba=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const luminance=(rgb:number[])=>rgb[0]*.3+rgb[1]*.59+rgb[2]*.11;
const rgbPalettes={hair:HAIR_COLORS,shirt:SHIRTS,pants:PANTS,shoes:SHOES,skin:SKINS,eyes:EYE_COLORS};
function recolor(data:Uint8ClampedArray,offset:number,target:string,base:string){
  const rgb=[data[offset],data[offset+1],data[offset+2]],max=Math.max(...rgb),min=Math.min(...rgb);
  if(max<55||min>232)return; // Preserve original ink and specular highlights.
  const a=rgba(target),b=rgba(base),ratio=Math.max(.35,Math.min(1.65,luminance(rgb)/Math.max(1,luminance(b))));
  for(let i=0;i<3;i++)data[offset+i]=Math.min(255,Math.round(a[i]*ratio));
}
const skinPixel=(r:number,g:number,b:number)=>r>200&&g>145&&b>110&&r>g*1.035&&g>b*1.04;

function isLongHair(model:number,direction:number,distance:number,below:number){
  // Front-facing hair stops above the sleeves. A long rear silhouette must not
  // turn the front sleeves into part of the stationary head layer.
  if(direction===0){
    if(model===6||model===14)return below<10&&distance>25;
    if(model===7||model===11)return below<20&&distance>32;
    if(model===8)return below<18&&distance>24;
    if(model===9||model===10)return below<38&&distance>33;
    return false;
  }
  if(model===6||model===14)return below<30&&(direction===2?distance<22:distance>25);
  if(model===7||model===11)return below<35&&distance>29;
  if(model===8)return below<46&&(direction===2?distance<35:distance>22);
  if(model===9||model===10)return below<43&&(direction===2?distance<44:distance>26);
  return false;
}

export function installCharacterSprites(atlas:CanvasImageSource,createCanvas:(width:number,height:number)=>Canvas){
  factory=createCanvas;sourceAtlas=atlas;frames.clear();cache.clear();
}
function soleCenter(pixels:Uint8ClampedArray){
  let left=SIZE,right=-1;
  for(let y=ATLAS_SOLE-16;y<ATLAS_SOLE;y++)for(let x=0;x<SIZE;x++){
    if(pixels[(y*SIZE+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);}
  }
  const middle=(left+right+1)/2;
  // Leave nominally centered art on its original pixel grid.
  return Math.abs(middle-CENTER)<2?CENTER:Math.round(middle);
}
function rawFrame(model:number,direction:number):Frame{
  const index=model*4+direction,existing=frames.get(index);if(existing)return existing;
  const cell=factory!(SIZE,ATLAS_HEIGHT),c=cell.getContext('2d')!;
  // The ponytail drawing placed in the right-facing row actually faces left.
  c.save();
  if(model===6&&direction===1){c.translate(SIZE,0);c.scale(-1,1);}
  c.drawImage(sourceAtlas!,(model%5)*SIZE,(Math.floor(model/5)*4+direction)*ATLAS_HEIGHT,SIZE,ATLAS_HEIGHT,0,0,SIZE,ATLAS_HEIGHT);
  c.restore();
  const source=c.getImageData(0,0,SIZE,ATLAS_HEIGHT),side=direction===1||direction===3;
  const landmarks=atlasLandmarks[model],neck=landmarks.neck[direction],{hip,knee,ankle}=landmarks;
  const center=soleCenter(source.data);
  const buffers=Object.fromEntries(parts.map(part=>[part,c.createImageData(SIZE,ATLAS_HEIGHT)])) as Record<Part,ImageData>;
  for(let y=0;y<ATLAS_HEIGHT;y++)for(let x=0;x<SIZE;x++){
    const offset=(y*SIZE+x)*4;if(!source.data[offset+3])continue;
    const distance=Math.abs(x-center);
    let part:Part;
    if(y<neck||isLongHair(model,direction,distance,y-neck))part='head';
    else if(y<hip||y<hip+9&&distance>28){
      part=y<neck+8?'torso':side?(distance<13?'arm1':'torso'):x<center-22?'arm0':x>center+22?'arm1':'torso';
    }else{
      const leg=x<center?0:1;
      part=(y<knee?'thigh':y<ankle?'shin':'shoe')+leg as Part;
    }
    buffers[part].data.set(source.data.subarray(offset,offset+4),offset);
  }
  // Scale the face around its collar using the eye line, independent of hair
  // height. Register clothing at the joints while preserving silhouette width.
  const faceScale=(side?22:26)/landmarks.face[direction];
  const upper={from:neck,to:NECK,scale:(HIP-NECK)/(hip-neck)};
  const thigh={from:hip,to:HIP,scale:(KNEE-HIP)/(knee-hip)};
  const shin={from:knee,to:KNEE,scale:(ANKLE-KNEE)/(ankle-knee)};
  const shoe={from:ankle,to:ANKLE,scale:(SOLE-ANKLE)/(ATLAS_SOLE-ankle)};
  const head={from:neck,to:NECK,scale:faceScale};
  const images={} as Record<Part,Canvas>;
  for(const part of parts){
    const placement=part==='head'?head:part.startsWith('thigh')?thigh:part.startsWith('shin')?shin:part.startsWith('shoe')?shoe:upper;
    const widthScale=part==='head'?faceScale:1;
    const out=factory!(SIZE,HEIGHT),context=out.getContext('2d')!;
    context.imageSmoothingEnabled=false;
    c.putImageData(buffers[part],0,0);
    context.drawImage(cell,CENTER-center*widthScale,placement.to-placement.from*placement.scale,SIZE*widthScale,ATLAS_HEIGHT*placement.scale);
    images[part]=out;
  }
  const frame={parts:images,neck:NECK,hip:HIP,knee:KNEE,ankle:ANKLE,side,model};frames.set(index,frame);
  if(frames.size>16)frames.delete(frames.keys().next().value!);
  return frame;
}
export function loadCharacterSprites(){
  if(sourceAtlas)return Promise.resolve();
  if(!ready)ready=new Promise<void>((resolve,reject)=>{
    const ImageClass=globalThis.Image??globalThis.window?.Image;
    const image=new ImageClass();image.onload=()=>{installCharacterSprites(image,(width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;});resolve();};
    image.onerror=()=>{ready=undefined;reject(new Error('Character sprite atlas could not load'));};image.src='/art/characters/riders-v2.png';
  });
  return ready;
}
export const characterSpritesReady=()=>!!sourceAtlas;

function sourceModels(look:Look){
  const female=look.gender==='female';
  const head=({0:0,1:4,2:8,3:0,4:2,5:3,6:7,7:5,8:13,9:14,10:6,11:9,12:1} as Record<number,number>)[look.hair]??0;
  const body=!female&&(look.outfit??0)===0&&look.shirt===8?2:(female?[8,7,5,9,6,look.hair===9?14:11,13]:[3,1,0,4,6,11,13])[look.outfit??0]??0;
  const bottom=female&&look.bottom===3&&(look.outfit??0)===0?8:(female?[5,6,9,7]:[0,3,4,7])[look.bottom??0]??0;
  const shoe=(female?[7,9,5]:[3,2,0])[look.footwear??0]??0;
  return {head,body,bottom,shoe};
}
function styledFrame(look:Look,direction:number):Frame{
  const key=JSON.stringify([look.gender,look.hair,look.hairColor,look.skin,look.shirt,look.pants,look.shoes,look.eyes,look.outfit,look.bottom,look.footwear,direction]);
  const existing=cache.get(key);if(existing)return existing;
  const models=sourceModels(look),bodyFrame=rawFrame(models.body,direction);
  const images={} as Record<Part,Canvas>;
  for(const part of parts){
    const model=part==='head'?models.head:part==='torso'||part.startsWith('arm')?models.body:part.startsWith('shoe')?models.shoe:models.bottom;
    const frame=rawFrame(model,direction),image=factory!(SIZE,HEIGHT),c=image.getContext('2d')!;
    c.drawImage(frame.parts[part],0,0);
    const pixels=c.getImageData(0,0,SIZE,HEIGHT),data=pixels.data,base=originals[model];
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<SIZE;x++){
      const offset=(y*SIZE+x)*4;if(!data[offset+3])continue;
      const r=data[offset],g=data[offset+1],b=data[offset+2];
      const aboveCollar=frame.neck-y;
      const isSkin=skinPixel(r,g,b)&&(part==='head'?direction!==2&&aboveCollar>0&&aboveCollar<30&&Math.abs(x-CENTER)<23:part.startsWith('arm')?y>frame.hip-13:part==='torso'?y<frame.neck+7:model===9&&y>frame.hip+8&&y<frame.knee);
      if(isSkin){if(look.skin!==1)recolor(data,offset,SKINS[look.skin],SKINS[1]);continue;}
      const role=part==='head'?'hair':part==='torso'||part.startsWith('arm')?'shirt':part.startsWith('shoe')?'shoes':'pants';
      const picked=role==='hair'?look.hairColor??(look.hair<4?look.hair:base.hair):look[role];
      // Cream trim, laces and white eye pixels remain part of the source clothing.
      const cream=Math.min(r,g,b)>160&&Math.max(r,g,b)-Math.min(r,g,b)<65;
      const leggings=look.bottom===3&&role==='pants'&&y>frame.hip+17;
      if(!leggings&&picked!==undefined&&picked!==base[role]&&(!cream||role==='hair'||base[role]===4&&role==='shirt'))recolor(data,offset,rgbPalettes[role][picked],rgbPalettes[role][base[role]]);
      if(part==='head'&&direction!==2&&look.eyes!==undefined&&look.eyes!==0&&aboveCollar<28&&aboveCollar>11&&Math.abs(x-CENTER)>6&&Math.abs(x-CENTER)<23&&r<160&&g<135&&b<145&&Math.max(r,g,b)>60)recolor(data,offset,EYE_COLORS[look.eyes],EYE_COLORS[0]);
    }
    c.putImageData(pixels,0,0);images[part]=image;
  }
  const front=direction!==0?styledFrame(look,0):undefined;
  const result={...bodyFrame,parts:images,armArt:front?.parts??images,torsoUnderlay:bodyFrame.side?front!.parts.torso:undefined};cache.set(key,result);
  if(cache.size>16)cache.delete(cache.keys().next().value!);
  return result;
}
function piece(c:Ctx,image:Canvas,anchor:Point,target:Point,rotation=0,scaleX=SCALE,scaleY=SCALE){
  c.save();c.translate(target.x,target.y);c.rotate(rotation);c.scale(scaleX,scaleY);c.drawImage(image,-anchor.x,-anchor.y);c.restore();
}
function segment(c:Ctx,image:Canvas,a:Point,b:Point,toA:Point,toB:Point,maxScale=.72){
  const rotation=Math.atan2(toB.y-toA.y,toB.x-toA.x)-Math.atan2(b.y-a.y,b.x-a.x);
  piece(c,image,a,toA,rotation,SCALE,Math.min(maxScale,Math.hypot(toB.x-toA.x,toB.y-toA.y)/Math.hypot(b.x-a.x,b.y-a.y)));
}
function jointOverlap(image:Canvas,top:number,bottom?:number){
  const out=factory!(SIZE,HEIGHT),c=out.getContext('2d')!;
  const overlap=7;
  c.imageSmoothingEnabled=false;
  c.drawImage(image,0,0);
  // Extend the actual cloth pixels across a hinge only during animation.
  // The extra strip stays below the neighboring layer at rest.
  for(const [joint,start] of bottom===undefined?[[top,top]]:[[top,top],[bottom,bottom-overlap]]){
    c.save();
    c.translate(0,joint*2);
    c.scale(1,-1);
    c.drawImage(image,0,start,SIZE,overlap,0,start,SIZE,overlap);
    c.restore();
  }
  return out;
}
function movingParts(frame:Frame){
  if(frame.motionArt)return frame.motionArt;
  const art={...frame.parts},arms=frame.armArt??frame.parts;
  for(const side of [0,1] as const){
    const arm=`arm${side}` as const,thigh=`thigh${side}` as const,shin=`shin${side}` as const,shoe=`shoe${side}` as const;
    art[arm]=jointOverlap(arms[arm],NECK+8);
    art[thigh]=jointOverlap(art[thigh],HIP,KNEE);
    art[shin]=jointOverlap(art[shin],KNEE,ANKLE);
    art[shoe]=jointOverlap(art[shoe],ANKLE);
  }
  return frame.motionArt=art;
}
function sleeveParts(frame:Frame){
  return frame.raisedArms??=([0,1].map(i=>{
    const sign=i===0?-1:1,center=CENTER+sign*FOREARM_X,split=ELBOW_Y;
    const upper=factory!(SIZE,HEIGHT),lower=factory!(SIZE,HEIGHT),image=movingParts(frame)[`arm${i}` as Part];
    // Locate the hand on the unmodified artwork so darker custom skin colors
    // cannot accidentally shorten a sleeve or remove its hand.
    const pixels=rawFrame(frame.model,0).parts[`arm${i}` as Part].getContext('2d')!.getImageData(0,0,SIZE,HEIGHT).data;
    let end=frame.hip-4;
    for(let y=frame.hip-16;y<frame.hip+12;y++)for(let x=0;x<SIZE;x++){
      const offset=(y*SIZE+x)*4;
      if((x-CENTER)*sign>28&&pixels[offset+3]&&skinPixel(pixels[offset],pixels[offset+1],pixels[offset+2]))end=Math.max(end,y+3);
    }
    const overlap=5;
    upper.getContext('2d')!.drawImage(image,0,0,SIZE,split+overlap,0,0,SIZE,split+overlap);
    lower.getContext('2d')!.drawImage(image,0,split-overlap,SIZE,end-split+overlap,0,split-overlap,SIZE,end-split+overlap);
    return {upper,lower,shoulder:{x:CENTER+sign*UPPER_ARM_X,y:UPPER_ARM_Y},elbow:{x:center,y:split},wrist:{x:center,y:WRIST_Y}};
  }));
}
function kneeAt(hip:Point,foot:Point){
  const dx=foot.x-hip.x,dy=foot.y-hip.y,d=Math.hypot(dx,dy),bend=Math.sqrt(Math.max(0,18*18-d*d/4));
  return {x:(hip.x+foot.x)/2+Math.sign(dx||1)*bend*.36,y:(hip.y+foot.y)/2};
}
function legAccessories(c:Ctx,look:Look,knee:Point,foot:Point){
  if(look.equipment?.accessories.includes('knees')){c.fillStyle='#24212e';c.fillRect(knee.x-4,knee.y-3,8,6);c.fillStyle='#94a5b8';c.fillRect(knee.x-3,knee.y-2,6,4);}
  if(look.equipment?.accessories.includes('laces')){c.fillStyle='#f1d68a';c.fillRect(foot.x-3,foot.y-4,6,1);c.fillRect(foot.x-1,foot.y-5,2,3);}
}
function headwear(c:Ctx,look:Look,neck:Point){
  if(look.hair!==3)return;
  const color=HAIR_COLORS[look.hairColor??0];
  for(let row=0;row<23;row++){
    const span=Math.round(Math.sqrt(Math.max(0,1-((row-15)/17)**2))*48);
    c.fillStyle='#29202e';c.fillRect(Math.round(neck.x-span/2),Math.round(neck.y-51+row),span,1);
    if(span>6){c.fillStyle=color;c.fillRect(Math.round(neck.x-span/2+2),Math.round(neck.y-50+row),span-4,1);}
  }
  c.fillStyle='#29202e';c.fillRect(neck.x-19,neck.y-29,43,4);c.fillStyle='#f4e6ce';c.fillRect(neck.x-9,neck.y-42,7,3);
}

export function paintSpriteCharacter(c:Ctx,look:Look,pose:Pose,still:boolean,time:number):Anchors|undefined{
  if(!characterSpritesReady())return;
  const angle=(pose.bodyYaw%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
  const direction=angle<Math.PI*.25||angle>Math.PI*1.75?0:angle<Math.PI*.75?1:angle<Math.PI*1.25?2:3;
  const frame=styledFrame(look,direction);
  const hip={x:pose.hip.x+pose.lean*.25,y:pose.hip.y-7};
  const shoulder={x:hip.x+pose.lean*.5,y:hip.y-(frame.hip-frame.neck)*SCALE};
  const headY=shoulder.y-12;
  const falling=pose.fall>.05;
  if(still&&!falling){
    const base={x:pose.hip.x+pose.lean*.3,y:Math.max(...pose.feet.map(foot=>foot.y))};
    const origin={x:CENTER,y:SOLE};
    if(frame.torsoUnderlay)piece(c,frame.torsoUnderlay,origin,base,0,SCALE*.55);
    for(const part of ['thigh0','thigh1','shin0','shin1','shoe0','shoe1','arm0','torso','arm1','head'] as Part[])piece(c,frame.parts[part],origin,base);
    for(const dx of [-7,7])legAccessories(c,look,{x:base.x+dx,y:base.y-19},{x:base.x+dx,y:base.y});
    const neck={x:base.x,y:base.y-(SOLE-frame.neck)*SCALE};headwear(c,look,neck);
    return {shoulder:neck,headY:neck.y-12};
  }
  if(falling){
    const f=pose.fall,base={x:Math.min(pose.hip.x+f*17,176),y:130-f*9};
    c.save();c.translate(base.x,base.y);c.rotate(f*.9);c.translate(-base.x,-base.y);
    for(const part of parts)piece(c,frame.parts[part],{x:CENTER,y:frame.hip},{x:base.x,y:base.y-5});c.restore();
    return {shoulder:{x:base.x+10,y:base.y-18},headY:base.y-35};
  }
  const art=movingParts(frame);
  const frontWidth=direction===0||direction===2?1:.42;
  const order=pose.feet[0].y<pose.feet[1].y?[0,1]:[1,0];
  for(const i of order){
    const sign=i===0?-1:1,sourceX=CENTER+sign*LEG_X;
    const foot=pose.feet[i],socket={x:hip.x+sign*LEG_X*SCALE*frontWidth,y:hip.y},ankle={x:foot.x,y:foot.y-(SOLE-frame.ankle)*SCALE},knee=kneeAt(socket,ankle);
    segment(c,art[`thigh${i}` as Part],{x:sourceX,y:frame.hip},{x:sourceX,y:frame.knee},socket,knee);
    segment(c,art[`shin${i}` as Part],{x:sourceX,y:frame.knee},{x:sourceX,y:frame.ankle},knee,ankle);
    piece(c,art[`shoe${i}` as Part],{x:sourceX,y:SOLE},foot);
    legAccessories(c,look,knee,foot);
  }
  const spread=16+Math.max(0,pose.arms)*.8,handY=shoulder.y+28-Math.max(0,pose.arms)*1.5;
  let wrist:Point|undefined;
  const drawArm=(i:number)=>{
    if(frame.side&&i!==1)return;
    const arm=frame.side&&direction===3?0:i,sign=arm===0?-1:1;
    const source={x:CENTER+sign*UPPER_ARM_X,y:UPPER_ARM_Y},target={x:shoulder.x+sign*12*frontWidth,y:shoulder.y+3};
    if(pose.cheer){
      const sleeve=sleeveParts(frame)[arm];
      // Lift the upper sleeve out from the shoulder, then bend the cuff upward.
      // Keeping the elbow outside the hair silhouette makes the clothed arm visible.
      const elbow={x:shoulder.x+sign*27,y:shoulder.y+4},hand={x:shoulder.x+sign*32,y:shoulder.y-14};
      segment(c,sleeve.upper,sleeve.shoulder,sleeve.elbow,target,elbow,.85);
      segment(c,sleeve.lower,sleeve.elbow,sleeve.wrist,elbow,hand,.85);
      wrist=hand;
      return;
    }
    const rotation=Math.atan2(handY-target.y,shoulder.x+sign*spread-target.x)-Math.PI/2;
    piece(c,art[`arm${arm}` as Part],source,target,rotation);
    wrist={x:shoulder.x+sign*spread,y:handY};
  };
  drawArm(0);
  // The resting side view hides the torso behind its sleeve. Reuse the actual
  // shirt artwork underneath the moving sleeve instead of a flat color patch.
  if(frame.torsoUnderlay)piece(c,frame.torsoUnderlay,{x:CENTER,y:frame.hip},hip,pose.lean*.008,SCALE*.55);
  piece(c,frame.parts.torso,{x:CENTER,y:frame.hip},hip,pose.lean*.008);drawArm(1);
  // Neck and collar meet at their original source anchor, never at the chest.
  piece(c,frame.parts.head,{x:CENTER,y:frame.neck},shoulder,pose.lean*.004);
  headwear(c,look,shoulder);
  return {shoulder,headY,wrist};
}
