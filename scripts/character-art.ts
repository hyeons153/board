import {createCanvas,loadImage} from '@napi-rs/canvas';
import {installCharacterSprites} from '../src/scene/spriteCharacter';
export async function prepareCharacterReview(){
  const image=await loadImage('public/art/characters/riders-v2.png');
  installCharacterSprites(image as unknown as CanvasImageSource,(width,height)=>createCanvas(width,height) as unknown as HTMLCanvasElement);
}
