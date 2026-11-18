import { createCanvas } from '@napi-rs/canvas';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HAIR_STYLES, LOOK_PRESETS, OUTFITS } from '../src/game/data';
import { RIVALS } from '../src/game/content';
import type { Look } from '../src/game/types';
import { paintRider } from '../src/scene/rider';
import { ACTOR_HEIGHT, ACTOR_WIDTH } from '../src/scene/techniques';

const folder=resolve('.longboard/animation-review');await mkdir(folder,{recursive:true});
type Sample={look:Look;label:string;heading?:number;technique?:{id:string;progress:number;outcome?:'miss'|'great'};motion?:'rest'|'win'|'wobble'};
async function sheet(name:string,samples:Sample[],columns:number){
  const cellWidth=250,cellHeight=290,canvas=createCanvas(cellWidth*columns,cellHeight*Math.ceil(samples.length/columns)),c=canvas.getContext('2d');
  c.imageSmoothingEnabled=false;
  for(const [i,sample] of samples.entries()){
    const x=i%columns*cellWidth,y=Math.floor(i/columns)*cellHeight,actor=createCanvas(ACTOR_WIDTH,ACTOR_HEIGHT);
    const technique=sample.technique??(sample.heading?{id:'peter-pan',progress:0,bodyHeading:sample.heading,boardHeading:sample.heading}:undefined);
    paintRider(actor.getContext('2d') as unknown as CanvasRenderingContext2D,sample.look,sample.motion??'rest',0,technique);
    c.fillStyle=Math.floor(i/columns)%2?'#e7dedf':'#eeeade';c.fillRect(x,y,cellWidth-2,cellHeight-2);
    c.drawImage(actor,x-99,y-4,ACTOR_WIDTH*2,ACTOR_HEIGHT*2);
    c.fillStyle='#45364b';c.font='bold 14px "Malgun Gothic", sans-serif';c.fillText(sample.label,x+12,y+276);
  }
  const path=resolve(folder,name+'.png');await writeFile(path,canvas.toBuffer('image/png'));console.log(path);
}
const presets=[...LOOK_PRESETS.male,...LOOK_PRESETS.female];
await sheet('character-style',presets.map((look,i)=>({look,label:`${i<5?'M':'F'}${i%5+1} · ${HAIR_STYLES[look.hair]} · ${OUTFITS[look.outfit??0]}`})),5);
await sheet('character-turnaround',LOOK_PRESETS.female.map(look=>[0,Math.PI/4,Math.PI/2,Math.PI,-Math.PI/2].map((heading,i)=>({look,heading,label:`${HAIR_STYLES[look.hair]} · ${['정면','¾','오른쪽','후면','왼쪽'][i]}`}))).flat(),5);
await sheet('character-npcs',RIVALS.map(npc=>({look:npc.look,label:npc.name+' · '+HAIR_STYLES[npc.look.hair]})),3);
await sheet('character-actions',presets.slice(0,1).concat(presets.slice(5,6)).map(look=>[
  {look,label:'크로스스텝',technique:{id:'cross',progress:.4}},
  {look,label:'피루엣 · 후면',technique:{id:'pirouette',progress:.4}},
  {look,label:'킥플립',technique:{id:'kickflip',progress:.4}},
  {look,label:'고스트라이드',technique:{id:'ghost',progress:.45}},
  {look,label:'실패 · 착지',technique:{id:'treflip',progress:.9,outcome:'miss' as const}},
  {look,label:'우승 표정',motion:'win' as const},
]).flat(),6);
