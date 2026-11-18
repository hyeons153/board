import type { MoveLog, Outcome, Plan, Rider } from '../game/types';
import type { Motion } from './motion';
import { RULES } from '../game/data';

const TAU=Math.PI*2;
export const ACTOR_WIDTH=224, ACTOR_HEIGHT=176, ACTOR_OFFSET=56;
export type Point={x:number;y:number};
export type Technique={id:string;progress?:number;rate?:number;loop?:boolean;outcome?:Outcome;bodyHeading?:number;boardHeading?:number};
export type Pose={
  board:Point&{yaw:number;roll:number;pitch:number};
  hip:Point;bodyYaw:number;lean:number;crouch:number;arms:number;
  feet:[Point,Point];fall:number;cheer:boolean;
};
type Profile={body?:number;board?:number;flip?:number;air?:number;kind:'step'|'cross'|'turn'|'pirouette'|'carve'|'ghost'|'mango'|'wood'|'piglet'|'pivot'|'pop'|'no-comply'};
export const TECHNIQUES:Record<string,Profile>={
  'peter-pan':{kind:'step'},'step-180':{kind:'turn',body:.5},'step-360':{kind:'turn',body:1},
  cross:{kind:'cross'},'back-cross':{kind:'cross'},sidewinder:{kind:'carve'},'v-spin':{kind:'turn',body:1},
  ghost:{kind:'ghost'},piglet:{kind:'piglet'},mango:{kind:'mango'},wood:{kind:'wood'},
  pirouette:{kind:'pirouette',body:1},'mango-pendulum':{kind:'mango'},
  'pirouette-540':{kind:'pirouette',body:1.5},pendulum:{kind:'carve'},'pirouette-720':{kind:'pirouette',body:2},
  pivot:{kind:'pivot',body:.5,board:.5},shuvit:{kind:'pop',board:.5,air:10},
  'no-comply':{kind:'no-comply',air:19},kickflip:{kind:'pop',flip:1,air:23},
  'no-com-big':{kind:'no-comply',body:.5,board:1,air:20},bigspin:{kind:'pop',body:.5,board:1,air:23},
  'front-pop':{kind:'pop',board:-.5,air:21},'pop-shuvit':{kind:'pop',board:.5,air:23},
  heelflip:{kind:'pop',flip:-1,air:23},bigger:{kind:'pop',body:.5,board:1.5,air:25},
  hardflip:{kind:'pop',board:-.5,flip:-1,air:25},treflip:{kind:'pop',board:1,flip:1,air:25},varial:{kind:'pop',board:.5,flip:1,air:23},
};
export const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
const between=(p:number,a:number,b:number)=>smooth((p-a)/(b-a));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const mix=(a:Point,b:Point,t:number):Point=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});
export function boardPoint(board:Pose['board'],u:number,v=0):Point {
  return {x:board.x+u*Math.cos(board.yaw)-v*Math.sin(board.yaw),
    y:board.y+u*Math.sin(board.yaw)*.32+v*(Math.cos(board.yaw)*Math.cos(board.roll)*.6-Math.sin(board.roll))+u*Math.sin(board.pitch)};
}
const base=():Pose=>({board:{x:64,y:102,yaw:0,roll:0,pitch:0},hip:{x:64,y:75},bodyYaw:0,lean:0,crouch:0,arms:0,feet:[{x:48,y:100},{x:80,y:100}],fall:0,cheer:false});

/** A single timeline controls foot contacts, body turns and the independent deck. */
export function techniquePose(id:string,progress:number,outcome:Outcome='clean',bodyHeading=0,boardHeading=0):Pose {
  const p=clamp(progress),profile=TECHNIQUES[id]??TECHNIQUES['peter-pan'],pose=base();
  const q=between(p,.18,.75),wave=Math.sin(Math.PI*q),prepare=Math.sin(Math.PI*clamp(p/.2));
  pose.board.yaw=boardHeading+(profile.board??0)*TAU*q;
  pose.bodyYaw=bodyHeading+(profile.body??0)*TAU*q;
  pose.crouch=prepare*5+Math.sin(Math.PI*between(p,.75,1))*4;
  pose.arms=wave*9;
  const feetOnDeck=()=>{pose.feet=[-16,16].map(u=>({x:pose.board.x+u*Math.cos(pose.bodyYaw),y:pose.board.y-2+u*Math.sin(pose.bodyYaw)*.32})) as [Point,Point];};
  feetOnDeck();
  switch(profile.kind){
    case 'pop':case 'no-comply': {
      const air=Math.sin(Math.PI*between(p,.2,.78));
      pose.board.y-=air*(profile.air??20);
      pose.board.roll=(profile.flip??0)*TAU*between(p,.25,.69);
      pose.board.pitch=-.28*Math.sin(Math.PI*between(p,.13,.34));
      pose.board.y-=Math.max(0,-34*Math.sin(pose.board.pitch));
      pose.hip.y-=air*((profile.air??20)+7);
      pose.crouch=prepare*8+air*4+Math.sin(Math.PI*between(p,.78,1))*7;
      feetOnDeck();
      const open=Math.sin(Math.PI*between(p,.2,.7));
      pose.feet[0].x-=open*8;pose.feet[1].x+=open*8;
      pose.feet.forEach(foot=>foot.y-=open*12);
      if(profile.kind==='no-comply'){
        const plant=between(p,.08,.2)*(1-between(p,.3,.48));
        pose.feet[1]=mix(pose.feet[1],{x:95,y:109},plant);
        pose.hip.x+=plant*5;pose.hip.y=lerp(pose.hip.y,79,plant);
      }
      break;
    }
    case 'pivot': {
      // The nose stays over the same front truck, rather than orbiting the rider.
      const nose=boardPoint({...pose.board,yaw:boardHeading,pitch:0},27);
      pose.board.pitch=.17*wave;
      pose.board.x=nose.x-27*Math.cos(pose.board.yaw);
      pose.board.y=nose.y-27*Math.sin(pose.board.yaw)*.32-27*Math.sin(pose.board.pitch);
      pose.feet=[boardPoint(pose.board,-1),boardPoint(pose.board,27)];
      pose.feet.forEach(foot=>foot.y-=2);
      pose.hip.x=(pose.feet[0].x+pose.feet[1].x)/2;pose.hip.y+=wave*3;
      break;
    }
    case 'pirouette': {
      const pivot=boardPoint(pose.board,10);
      pose.feet[1]={x:pivot.x,y:pivot.y-2};
      const angle=pose.bodyYaw;
      const sweep={x:pivot.x-24*Math.cos(angle),y:pivot.y-7-8*Math.sin(angle)};
      pose.feet[0]=mix(pose.feet[0],sweep,wave);
      pose.hip.x+=between(p,.08,.25)*(1-between(p,.76,1))*6;
      pose.arms=wave*14;
      break;
    }
    case 'step':case 'cross':case 'turn': {
      if(id==='peter-pan'||profile.kind==='cross'||id==='step-180'||id==='step-360'){
        // Gather/lift one foot while the other supports the rider. The board stays level.
        // Rechecked against the supplied mini-game's foot positions and step guide.
        const steps:([number,number,number,number])[]=id==='peter-pan'
          ? [[48,100,80,100],[78,96,80,100],[78,96,52,102],[65,99,52,102],[48,100,80,100]]
          : profile.kind==='cross'
            ? [[45,100,67,103],[74,97,67,103],[74,97,84,102],[88,98,84,102],[48,100,80,100]]
            : id==='step-180'
              ? [[48,100,80,100],[80,96,80,100],[80,96,48,102],[80,100,48,100]]
              : [[48,100,80,100],[80,96,80,100],[80,96,48,102],[48,98,48,102],[48,98,80,100],[48,100,80,100]];
        const at=q*(steps.length-1),index=Math.min(steps.length-2,Math.floor(at)),fraction=at-index,t=smooth(fraction),a=steps[index],b=steps[index+1];
        pose.feet=[0,1].map(i=>{
          const moving=Math.abs(a[i*2]-b[i*2])+Math.abs(a[i*2+1]-b[i*2+1])>1;
          return {x:lerp(a[i*2],b[i*2],t),y:lerp(a[i*2+1],b[i*2+1],t)-(moving?Math.sin(fraction*Math.PI)*6:0)};
        }) as [Point,Point];
        if(id==='back-cross')pose.feet.forEach(foot=>{foot.x=128-foot.x;});
        pose.hip.x+=(pose.feet[0].x+pose.feet[1].x-128)*.17;pose.lean=Math.sin(q*Math.PI*2)*2;
        pose.hip.y-=Math.sin(fraction*Math.PI)*1.8;pose.arms=Math.sin(q*Math.PI)*5;
        break;
      }
      if(id==='v-spin'){pose.bodyYaw=bodyHeading+TAU*between(p,.3,.63);feetOnDeck();pose.arms=wave*4;}
      const direction=id==='back-cross'?-1:1;
      const steps=profile.kind==='turn'?(id==='step-180'?2:4):4;
      const stride=q*steps,part=stride%1,index=Math.min(steps-1,Math.floor(stride));
      const moving=index%2,stepLift=Math.sin(Math.PI*part)*8;
      const crossing=Math.sin(q*Math.PI*2);
      pose.feet[0].x+=crossing*direction*19;pose.feet[1].x-=crossing*direction*19;
      pose.feet[moving].y-=stepLift;
      pose.feet.forEach(foot=>{foot.x=Math.max(38,Math.min(90,foot.x));});
      pose.hip.y-=Math.abs(Math.sin(stride*Math.PI))*2;pose.lean=crossing*2;
      break;
    }
    case 'ghost': {
      const off=between(p,.12,.3)*(1-between(p,.7,.9));
      pose.hip.x+=off*26;pose.hip.y+=off*4;
      const run=Math.sin(q*Math.PI*6);
      pose.feet=[{x:48+off*(27+run*13),y:100+off*(9-Math.max(0,run)*12)},
        {x:80+off*(20-run*13),y:100+off*(9-Math.max(0,-run)*12)}];
      const remount=Math.sin(Math.PI*between(p,.66,.91))*8;
      pose.hip.y-=remount;pose.feet.forEach(foot=>foot.y-=remount);
      pose.lean=off*6;pose.arms=run*off*9;
      break;
    }
    case 'wood': {
      const stretch=between(p,.2,.43)*(1-between(p,.62,.86));
      pose.feet[1]=boardPoint(pose.board,15,3);pose.feet[1].y-=2;
      pose.feet[0]=mix(pose.feet[0],{x:17,y:81},stretch);
      pose.hip.x+=stretch*7;pose.crouch=stretch*5;pose.lean=stretch*9;
      const hop=Math.sin(Math.PI*between(p,.7,.91))*8;
      pose.hip.y-=hop;pose.feet.forEach(foot=>foot.y-=hop);break;
    }
    case 'mango': {
      const sweep=between(p,.24,.65),returning=between(p,.65,.89),weight=Math.sin(Math.PI*sweep)*(1-returning);
      pose.crouch=weight*12;pose.hip.x+=weight*9;pose.lean=-weight*9;
      pose.feet[0]=mix(pose.feet[0],{x:20+28*Math.cos(sweep*Math.PI),y:109},weight);
      pose.feet[1]=boardPoint(pose.board,15);pose.feet[1].y-=2;
      if(p<.28)pose.feet[0].x+=Math.sin(p/.28*Math.PI)*25;
      if(id==='mango-pendulum'){
        pose.board.yaw+=Math.sin(q*Math.PI*2)*.55;
        pose.feet[1]=boardPoint(pose.board,15);pose.feet[1].y-=2;
      }
      const hop=Math.sin(Math.PI*between(p,.69,.9))*7;
      pose.hip.y-=hop;pose.feet.forEach(foot=>foot.y-=hop);break;
    }
    case 'piglet': {
      const plant=between(p,.15,.35)*(1-between(p,.69,.88));
      pose.feet[1]=mix(pose.feet[1],{x:95,y:109},plant);
      pose.board.pitch=-wave*.6;pose.board.y-=Math.sin(wave*.6)*34;
      pose.feet[0]=boardPoint(pose.board,-16);pose.feet[0].y-=2;
      pose.hip.x+=plant*9;pose.crouch=plant*8;break;
    }
    case 'carve': {
      const sway=Math.sin(q*Math.PI*2)*wave;
      pose.board.yaw+=sway*(id==='pendulum'?.7:.38);pose.board.roll=sway*.24;
      pose.hip.x+=sway*10;pose.lean=-sway*9;pose.bodyYaw+=sway*.4;
      feetOnDeck();
      if(id==='sidewinder')pose.feet[0].y-=Math.abs(sway)*7;
      break;
    }
  }
  pose.hip.y+=pose.crouch;
  if(p>.78&&outcome==='rough'){
    const shake=Math.sin((p-.78)*65)*(1-between(p,.9,1));pose.lean+=shake*7;pose.arms=12;pose.hip.x+=shake*3;
  }
  if(outcome==='miss'){
    pose.fall=between(p,.76,.96);pose.board.x-=pose.fall*16;pose.lean+=pose.fall*27;
  }
  pose.cheer=outcome==='great'&&p>.91;
  return pose;
}

export function basicPose(motion:Motion,time:number):Pose {
  const pose=base(),t=time/1000,cycle=Math.sin(t*5);
  pose.feet=[{x:53,y:100},{x:76,y:100}];pose.hip.y=73;pose.bodyYaw=.25;pose.lean=1;
  if(motion==='rest'||motion==='lose'){pose.hip.y+=Math.sin(t*2)*.6+(motion==='lose'?5:0);return pose;}
  if(motion==='fall'){pose.fall=1;return pose;}
  if(['win','great','success'].includes(motion)){pose.cheer=true;pose.arms=motion==='success'?9:23;pose.hip.y-=Math.abs(cycle)*2;return pose;}
  if(motion==='carve'){pose.board.yaw=cycle*.22;pose.hip.x+=cycle*7;pose.lean=-cycle*7;}
  if(motion==='ride'){pose.hip.y+=Math.sin(t*2)*.7;pose.lean=1+Math.sin(t*2)*.6;}
  if(motion==='accelerate'||motion==='mount'){
    const push=Math.max(0,cycle);pose.feet[0]={x:53-push*19,y:100+push*9};pose.lean=push*4;pose.hip.y+=push*2;pose.arms=push*4;
  }
  if(motion==='brake'){pose.feet[0]={x:39,y:109};pose.lean=-4;pose.arms=5;}
  if(motion==='land'){pose.crouch=(cycle+1)*3;pose.hip.y+=pose.crouch;}
  if(motion==='wobble'){pose.lean=cycle*9;pose.arms=13;}
  // Legacy callers retain coherent motion; technique scenes use their full timeline.
  const examples:Partial<Record<Motion,string>>={step:'peter-pan',cross:'cross',spin:'step-180','double-spin':'step-360',jump:'no-comply',shove:'shuvit',flip:'kickflip',heel:'heelflip'};
  return examples[motion]?techniquePose(examples[motion]!,t%3/3):pose;
}

export function headingsBefore(log:MoveLog[],at:number){
  let bodyHeading=0,boardHeading=0;
  for(const move of log){
    if(move.at>=at)break;
    if(move.outcome==='miss'){bodyHeading=boardHeading=0;continue;}
    const profile=TECHNIQUES[move.id];bodyHeading+=(profile?.body??0)*TAU;boardHeading+=(profile?.board??0)*TAU;
  }
  return {bodyHeading,boardHeading};
}

export function trainingTechnique(r:Pick<Rider,'plan'|'routines'|'skills'>,elapsedSeconds:number,duration=RULES.weekMs/1000):Technique|undefined {
  const plan:Plan|null=r.plan;if(!plan)return;
  let ids:string[]=[];
  if(plan.skill)ids=[plan.skill];
  else if(plan.action==='rehearsal')ids=r.routines[plan.discipline??'freestyle'].length?r.routines[plan.discipline??'freestyle']:['peter-pan','shuvit'];
  else if(plan.action==='dance'||plan.action==='link')ids=['peter-pan','cross','step-180'];
  else if(plan.action==='trick')ids=['no-comply','shuvit'];
  if(!ids.length)return;
  const total=Math.max(.1,duration),cycle=total/ids.length,elapsed=Math.min(total-.00001,Math.max(0,elapsedSeconds)),index=Math.floor(elapsed/cycle);
  return {id:ids[index],progress:(elapsed-index*cycle)/cycle,rate:1/cycle,loop:false};
}
