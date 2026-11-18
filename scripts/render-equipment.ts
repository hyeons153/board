import { createCanvas } from '@napi-rs/canvas';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NEW_GEAR, RARITY_NAMES } from '../src/game/equipmentCatalog';
import { freshExtras, equippedLook } from '../src/game/economy';
import { DEFAULT_LOOK } from '../src/game/data';
import { paintRider } from '../src/scene/rider';

const width=192,height=204,columns=8,canvas=createCanvas(columns*width,Math.ceil(NEW_GEAR.length/columns)*height),c=canvas.getContext('2d');
c.imageSmoothingEnabled=false;
for(const [index,item] of NEW_GEAR.entries()){
  const extra=freshExtras();extra.inventory.push(item.id);
  if(item.slot==='accessory')extra.accessories=[item.id];else extra.equipped[item.slot]=item.id;
  const actor=createCanvas(128,136),look=equippedLook({look:{...DEFAULT_LOOK,gender:index%2?'female':'male',hair:index%4},extras:extra});
  paintRider(actor.getContext('2d') as unknown as CanvasRenderingContext2D,look,['crown','disco','headband','rainbow'].includes(item.visual??'')?'win':'ride',400,undefined,true);
  const x=index%columns*width,y=Math.floor(index/columns)*height;
  c.fillStyle=item.slot==='accessory'?'#e8eeda':'#e7edf1';c.fillRect(x,y,width-2,height-2);
  c.drawImage(actor,x+32,y+6);
  c.fillStyle='#36514a';c.font='bold 12px "Malgun Gothic", sans-serif';c.fillText(item.name,x+9,y+160,width-18);
  c.font='11px sans-serif';c.fillStyle='#60736d';c.fillText(item.id+' · '+RARITY_NAMES[item.rarity],x+9,y+180,width-18);
}
const folder=resolve('.longboard/animation-review');await mkdir(folder,{recursive:true});const file=resolve(folder,'equipment.png');await writeFile(file,canvas.toBuffer('image/png'));console.log(file);
