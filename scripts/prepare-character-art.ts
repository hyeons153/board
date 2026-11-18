import {createCanvas,loadImage} from '@napi-rs/canvas';
import {writeFile} from 'node:fs/promises';

// Sprite extraction only: keep the generated cutout's colors and interior artwork.
const inputs=await Promise.all(['source-v2','male-turnaround-v2','female-turnaround-v2','school-turnaround-v2'].map(name=>loadImage('art/characters/'+name+'.png')));
const regions=[
  {xs:[40,320,620,920,1210,1500],ys:[0,480,1024]},
  {xs:[130,400,670,940,1220,1490],ys:[0,310,625,960]},
  {xs:[60,300,555,840,1100,1360],ys:[0,280,540,800,1080]},
  {xs:[90,350,640,925,1200,1480],ys:[0,335,665,1024]},
];
const atlas=createCanvas(960,2688),ctx=atlas.getContext('2d');
const sourceFront=[3,1,2,0,4]; // Brown, blond, orange, purple, silver.
for(let model=0;model<15;model++)for(let direction=0;direction<4;direction++){
  const female=model>=5,index=model%5,input=model>=10?3:direction===0?0:female?2:1;
  const col=input===0?(female?index:sourceFront[index]):index;
  const row=input===0?(female?1:0):input===3?(direction===0?0:direction===2?2:1):direction===1?1:direction===2?2:female?3:1;
  const {xs,ys}=regions[input],image=inputs[input],scratch=createCanvas(xs[col+1]-xs[col],ys[row+1]-ys[row]),c=scratch.getContext('2d');
  c.drawImage(image,-xs[col],-ys[row]);
  const pixels=c.getImageData(0,0,scratch.width,scratch.height),data=pixels.data;
  const seen=new Uint8Array(scratch.width*scratch.height);let largest:number[]=[];
  for(let start=0;start<seen.length;start++)if(!seen[start]&&data[start*4+3]>=210){
    const group=[start];seen[start]=1;
    for(let n=0;n<group.length;n++){
      const at=group[n],x=at%scratch.width,y=Math.floor(at/scratch.width);
      for(const next of [x>0?at-1:-1,x<scratch.width-1?at+1:-1,y>0?at-scratch.width:-1,y<scratch.height-1?at+scratch.width:-1])if(next>=0&&!seen[next]&&data[next*4+3]>=210){seen[next]=1;group.push(next);}
    }
    if(group.length>largest.length)largest=group;
  }
  const subject=new Uint8Array(seen.length);for(const index of largest)subject[index]=1;
  let left=scratch.width,top=scratch.height,right=0,bottom=0;
  for(let y=0;y<scratch.height;y++)for(let x=0;x<scratch.width;x++){
    const offset=(y*scratch.width+x)*4;
    // Discard only stray translucent cutout halos; leave all opaque pixel detail.
    if(!subject[y*scratch.width+x]){data[offset+3]=0;continue;}
    data[offset+3]=255;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  c.putImageData(pixels,0,0);
  const width=right-left+1,height=bottom-top+1,scale=216/height;
  const x=(model%5)*192+(192-width*scale)/2,y=(Math.floor(model/5)*4+direction)*224+4;
  ctx.imageSmoothingEnabled=false;
  if(!female&&direction===1||input===3&&direction===3){ctx.save();ctx.translate(x+width*scale,y);ctx.scale(-1,1);ctx.drawImage(scratch,left,top,width,height,0,0,width*scale,216);ctx.restore();}
  else ctx.drawImage(scratch,left,top,width,height,x,y,width*scale,216);
}
await writeFile('public/art/characters/riders-v2.png',atlas.toBuffer('image/png'));
console.log('Prepared 60 faithful character views: public/art/characters/riders-v2.png');
