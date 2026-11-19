import { seeded } from '../game/random';
import type { Spot } from '../game/types';
export type { Motion } from './motion';

export const WIDTH=456, HEIGHT=194;
type Ctx=CanvasRenderingContext2D;
const rect=(c:Ctx,col:string,x:number,y:number,w:number,h:number)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function polygon(c:Ctx,col:string,points:number[][]){
  c.fillStyle=col;c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
  c.closePath();c.fill();
}
const palettes={
  river:{sky:['#312b4b','#644459','#ad6569','#e49478','#f3b284'],sun:'#ffd399',far:'#675065',mid:'#57445a',deep:'#3c384f',water:'#614858',edge:'#2b2d38',road:'#50424b',light:'#ffb175'},
  plaza:{sky:['#478bc2','#7cb7d6','#9acee2','#c4e4df','#fbe0af'],sun:'#fff4bc',far:'#718fb1',mid:'#4d698a',deep:'#31445d',water:'#647990',edge:'#34455a',road:'#5a6b7c',light:'#ffd68e'},
  park:{sky:['#70b7b9','#90cec0','#b8dfb1','#deebac','#fae5a5'],sun:'#fff2bd',far:'#7ba486',mid:'#527f6d',deep:'#36564b',water:'#598e78',edge:'#304b3e',road:'#667c64',light:'#ebd787'},
  studio:{sky:['#2a2538','#3a314a','#564455','#745064','#865968'],sun:'#efaa90',far:'#705970',mid:'#514156',deep:'#3b2f47',water:'#4c3b50',edge:'#292637',road:'#4c4355',light:'#ffac82'},
  night:{sky:['#141936','#262456','#444276','#65396a','#734a77'],sun:'#a0c4f5',far:'#535d8d',mid:'#41406b',deep:'#292946',water:'#33475d',edge:'#222436',road:'#3c4365',light:'#75f2e5'},
  arena:{sky:['#374f81','#66579d','#b478a1','#dc8e91','#ffd2a1'],sun:'#ffdba0',far:'#7d6f99',mid:'#596386',deep:'#35425f',water:'#6c7391',edge:'#353853',road:'#516385',light:'#ffe08e'},
};
export const landscapeEdge=(spot:Spot)=>palettes[spot].edge;
export function paintLandscape(c:Ctx,spot:Spot,competition=false){
  const p=palettes[spot], rng=seeded(938,spot);
  const random=(a:number,b:number)=>Math.floor(a+rng()*(b-a));
  c.imageSmoothingEnabled=false;
  const gradient=c.createLinearGradient(0,0,0,112);
  p.sky.forEach((col,i)=>gradient.addColorStop(i/(p.sky.length-1),col));
  c.fillStyle=gradient;c.fillRect(0,0,WIDTH,HEIGHT);
  const cx=350,cy=64,r=35;
  for(let y=-r;y<r;y++){
    const x=Math.floor(Math.sqrt(r*r-y*y));
    rect(c,p.sun,cx-x,cy+y,x*2,1);
    if(y>5&&y%7===0) rect(c,p.sky[3],cx-x,cy+y,x*2,1);
  }
  for(let i=0;i<25;i++){
    const x=random(-30,455),y=random(11,89),w=random(14,81);
    c.globalAlpha=rng()*.24+.1;
    rect(c,i%2?p.sky[1]:p.sky[4],x,y,w,1);
    rect(c,i%2?p.sky[2]:p.light,x+12,y+1,w*.67,1);
  }
  c.globalAlpha=1;
  if(spot==='studio'){
    rect(c,p.deep,0,0,WIDTH,12);
    rect(c,p.mid,0,13,WIDTH,4);
    for(let x=-10;x<460;x+=57){
      rect(c,p.mid,x,18,49,84);rect(c,p.far,x+2,21,45,71);
      for(let y=23;y<91;y+=8){rect(c,p.sky[3],x+3,y,43,4);rect(c,p.light,x+3,y,43,1);}
      rect(c,p.deep,x+23,20,3,75);
    }
    rect(c,p.deep,0,95,WIDTH,49);rect(c,p.mid,0,100,WIDTH,2);rect(c,p.far,0,110,WIDTH,1);
    for(let x=30;x<456;x+=84){
      rect(c,p.edge,x,6,2,26);rect(c,p.edge,x-9,27,21,6);rect(c,p.light,x-7,33,17,2);
    }
    polygon(c,p.mid,[[0,132],[38,110],[88,110],[110,133]]);
    polygon(c,p.mid,[[406,134],[426,110],[456,110],[456,136]]);
  }else{
    for(let row=0;row<2;row++){
      let x=-8;
      while(x<WIDTH){
        const w=random(4,15),height=random(4,row===0?27:spot==='plaza'||spot==='night'?58:30);
        if(spot==='park'){
          const y=103-height;
          rect(c,row?p.mid:p.far,x+w*.46,y+6,2,height);
          rect(c,row?p.mid:p.far,x+2,y+2,w-4,height*.68);
          rect(c,row?p.mid:p.far,x,y+6,w,height*.53);
        }else{
          const y=105-height;
          rect(c,row?p.mid:p.far,x,y,w,height);
          if(rng()<.4)rect(c,row?p.mid:p.far,x+2,y-3,w*.67,4);
          if(row) for(let yy=y+3;yy<103;yy+=4)for(let xx=x+2;xx<x+w-1;xx+=3)if(rng()<.29)rect(c,rng()<.6?p.sky[4]:p.sky[2],xx,yy,1,1);
        }
        x+=w+random(1,3);
      }
    }
    rect(c,p.water,0,102,WIDTH,48);
    for(let i=0;i<155;i++){
      const y=random(103,143),x=random(-20,456);
      const lit=Math.abs(x-cx)<(y-77)*1.5;
      c.globalAlpha=random(12,57)/100;
      rect(c,lit?p.light:i%2?p.deep:p.far,x,y,random(2,lit?26:38),1);
    }
    c.globalAlpha=1;
    if(spot!=='park'){
      rect(c,p.deep,0,96,242,3);rect(c,p.mid,0,95,242,1);rect(c,p.deep,0,101,242,2);
      for(let x=12;x<239;x+=34){
        rect(c,p.deep,x,99,3,17);
        polygon(c,p.deep,[[x,103],[x+2,99],[x+15,98],[x+15,99],[x+6,102],[x+3,109]]);
        rect(c,p.light,x+8,96,2,1);
      }
      rect(c,p.deep,77,79,5,18);rect(c,p.deep,168,79,5,18);
      for(let x=0;x<244;x++) {
        const local=x<80?x/80:x<170?(170-x)/90:(x-170)/74;
        const by= x<80?96-16*local:x<170?80+14*Math.sin(local*Math.PI):80+16*local;
        rect(c,p.deep,x,by,1,1);
        if(x%8===0)rect(c,p.mid,x,by+1,1,Math.max(1,95-by));
      }
    }
  }
  rect(c,p.edge,0,143,WIDTH,51);
  rect(c,p.road,0,150,WIDTH,43);
  rect(c,p.far,0,149,WIDTH,1);
  rect(c,p.mid,0,163,WIDTH,1);
  rect(c,p.edge,0,184,WIDTH,10);
  rect(c,p.mid,0,184,WIDTH,2);
  for(let i=0;i<107;i++){
    const x=random(0,456),y=random(152,184); c.globalAlpha=rng()*.3;
    rect(c,i%2?p.edge:p.light,x,y,random(1,9),1);
  }
  c.globalAlpha=1;
  for(let x=-20;x<456;x+=52){rect(c,p.far,x,177,25,1);rect(c,p.mid,x,178,25,1);}
  if(spot!=='studio'){
    rect(c,p.edge,0,132,WIDTH,3);rect(c,p.far,0,131,WIDTH,1);
    rect(c,p.deep,0,138,WIDTH,1);
    for(let x=10;x<456;x+=18){rect(c,p.deep,x,133,2,11);rect(c,p.mid,x+2,135,1,8);}
    for(const x of [41,221,424]){
      rect(c,p.deep,x,94,2,50);rect(c,p.deep,x,94,12,2);rect(c,p.mid,x+7,96,7,2);
      rect(c,p.light,x+8,98,5,1);
    }
    for(const [tx,th] of [[12,48],[449,54],[spot==='park'?383:455,62]]){
      if(tx===455) continue;
      rect(c,p.edge,tx-2,136-th*.62,4,th*.7);
      for(let i=0;i<65;i++){
        const ay=random(-22,23),ax=random(-31,31);
        if(ax*ax/33**2+ay*ay/22**2>1)continue;
        rect(c,i%7===0?p.mid:p.deep,tx+ax,135-th+ay,random(3,13),random(2,8));
      }
    }
  }
  if(spot==='night'){
    for(const [x,y,w] of [[42,73,34],[190,55,37],[305,82,28],[390,60,47]]){
      rect(c,'#53447c',x,y,w,13);
      rect(c,'#c475e5',x+2,y+2,w-4,2);
      rect(c,p.light,x+4,y+6,w-8,2);
      rect(c,'#564d79',x+w-2,y+13,2,13);
    }
    for(let i=0;i<21;i++)rect(c,'#acc6eb',random(0,WIDTH),random(4,43),1,1);
  }
  if(competition||spot==='arena'){
    for(const x of [28,135,322,420]){
      rect(c,p.deep,x,21,3,123);
      rect(c,p.deep,x-13,23,30,9);
      rect(c,p.light,x-10,25,24,4);
      for(let b=0;b<26;b+=8)rect(c,'#fff4ce',x-10+b,26,3,2);
    }
    rect(c,p.deep,0,107,WIDTH,31);
    const crowd=['#e2a08e','#eac870','#96baa9','#c4a3dd','#81afcc'];
    for(let row=0;row<(competition?3:1);row++){
      const y=109+row*8;
      for(let x=3;x<WIDTH;x+=6){
        if(rng()<.2) continue;
        const color=crowd[random(0,crowd.length)];
        rect(c,'#b88772',x+1,y+(x%2),2,2);
        rect(c,color,x,y+2+(x%2),4,4);
      }
    }
    for(const [x,c1] of [[55,'#f47779'],[204,'#bfeb8c'],[365,'#75e2d4']] as const){
      rect(c,p.deep,x,70,26,22);
      rect(c,c1,x+1,71,24,13);
      rect(c,p.deep,x+4,75,17,2);
      rect(c,p.deep,x+9,79,10,2);
    }
    rect(c,'#e9d7a4',84,170,6,15);
    rect(c,'#c1dec7',100,174,266,1);
    rect(c,'#e9d7a4',369,170,5,15);
  }
  rect(c,p.edge,0,191,WIDTH,3);
}

export { paintRider } from './rider';
