import { createCanvas } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_LOOK } from '../src/game/data';
import type { Look } from '../src/game/types';
import { paintRider } from '../src/scene/rider';
import { ACTOR_HEIGHT, ACTOR_WIDTH } from '../src/scene/techniques';

const variants:Look[]=[
  {...DEFAULT_LOOK,gender:'male',board:4},
  {...DEFAULT_LOOK,gender:'female',hair:0,shirt:6,board:5},
  {...DEFAULT_LOOK,gender:'female',hair:2,hairColor:5,shirt:7,pants:5,board:6},
  {...DEFAULT_LOOK,gender:'male',hair:3,hairColor:4,shirt:4,pants:4,shoes:4,board:7},
];
const cellWidth=320,cellHeight=300;
const sheet=createCanvas(cellWidth*4,cellHeight*2),c=sheet.getContext('2d');
c.imageSmoothingEnabled=false;
for(let row=0;row<2;row++)for(const [column,look] of variants.entries()){
  const x=column*cellWidth,y=row*cellHeight,actor=createCanvas(ACTOR_WIDTH,ACTOR_HEIGHT);
  paintRider(actor.getContext('2d') as unknown as CanvasRenderingContext2D,look,'rest',0,row?{id:'kickflip',progress:.4}:undefined);
  c.fillStyle=row?'#304c62':'#e9efdf';c.fillRect(x,y,cellWidth-2,cellHeight-2);
  c.drawImage(actor,x-64,y+10,ACTOR_WIDTH*2,ACTOR_HEIGHT*2);
  c.fillStyle=row?'#eff6dc':'#30454c';c.font='bold 16px "Malgun Gothic", sans-serif';
  const decks:Record<number,string>={4:'검정',5:'흰색',6:'하늘',7:'연두'};
  c.fillText(`${look.gender==='female'?'여성':'남성'} · ${decks[look.board]} 데크 · ${row?'킥플립':'기본 자세'}`,x+18,y+282);
}
const folder=resolve('.longboard/animation-review');await mkdir(folder,{recursive:true});
const path=resolve(folder,'appearance.png');await writeFile(path,sheet.toBuffer('image/png'));console.log(path);
