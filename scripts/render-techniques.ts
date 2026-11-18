import { createCanvas } from '@napi-rs/canvas';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_LOOK, SKILLS } from '../src/game/data';
import { paintRider } from '../src/scene/rider';
import { ACTOR_WIDTH, ACTOR_HEIGHT } from '../src/scene/techniques';
import { HEIGHT, WIDTH, paintLandscape } from '../src/scene/landscape';
import {prepareCharacterReview} from './character-art';
await prepareCharacterReview();

const folder=resolve('.longboard/animation-review');await mkdir(folder,{recursive:true});
const frames=[.07,.26,.4,.53,.67,.86,1],scale=1.3,cellWidth=ACTOR_WIDTH*scale,cellHeight=ACTOR_HEIGHT*scale+28;
for(let page=0;page<3;page++){
  const skills=SKILLS.slice(page*10,page*10+10);
  const sheet=createCanvas(Math.ceil(cellWidth*frames.length),Math.ceil(cellHeight*skills.length)),c=sheet.getContext('2d');
  c.imageSmoothingEnabled=false;c.fillStyle='#253e52';c.fillRect(0,0,sheet.width,sheet.height);
  skills.forEach((skill,row)=>frames.forEach((progress,column)=>{
    const actor=createCanvas(ACTOR_WIDTH,ACTOR_HEIGHT);
    paintRider(actor.getContext('2d') as unknown as CanvasRenderingContext2D,DEFAULT_LOOK,'ride',0,{id:skill.id,progress});
    c.fillStyle=row%2?'#37536a':'#304c62';c.fillRect(column*cellWidth,row*cellHeight,cellWidth,cellHeight-2);
    c.fillStyle='#eff6de';c.font='13px sans-serif';c.fillText(`${skill.id} ${Math.round(progress*100)}%`,column*cellWidth+6,row*cellHeight+19);
    c.drawImage(actor,column*cellWidth,row*cellHeight+25,cellWidth,ACTOR_HEIGHT*scale);
  }));
  const path=resolve(folder,`techniques-${page+1}.png`);await writeFile(path,sheet.toBuffer('image/png'));console.log(path);
}
const scene=createCanvas(WIDTH*3,HEIGHT*3),world=createCanvas(WIDTH,HEIGHT),actor=createCanvas(ACTOR_WIDTH,ACTOR_HEIGHT);
paintLandscape(world.getContext('2d') as unknown as CanvasRenderingContext2D,'river',true);
paintRider(actor.getContext('2d') as unknown as CanvasRenderingContext2D,DEFAULT_LOOK,'ride',0,{id:'kickflip',progress:.48});
world.getContext('2d').drawImage(actor,203,16,ACTOR_WIDTH*.9,ACTOR_HEIGHT*.9);
scene.getContext('2d').imageSmoothingEnabled=false;scene.getContext('2d').drawImage(world,0,0,scene.width,scene.height);
const path=resolve(folder,'scene.png');await writeFile(path,scene.toBuffer('image/png'));console.log(path);
const stance=createCanvas(WIDTH*3,HEIGHT*3),stanceWorld=createCanvas(WIDTH,HEIGHT);
paintLandscape(stanceWorld.getContext('2d') as unknown as CanvasRenderingContext2D,'plaza');
paintRider(actor.getContext('2d') as unknown as CanvasRenderingContext2D,DEFAULT_LOOK,'ride',0);
stanceWorld.getContext('2d').drawImage(actor,236,16,ACTOR_WIDTH*.9,ACTOR_HEIGHT*.9);
stance.getContext('2d').imageSmoothingEnabled=false;stance.getContext('2d').drawImage(stanceWorld,0,0,stance.width,stance.height);
const stancePath=resolve(folder,'stance.png');await writeFile(stancePath,stance.toBuffer('image/png'));console.log(stancePath);
