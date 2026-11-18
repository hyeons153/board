import * as Phaser from 'phaser';
import type { Look, Spot } from '../game/types';
import { HEIGHT, WIDTH, paintLandscape, paintRider, type Motion } from './landscape';
import { ACTOR_HEIGHT, ACTOR_WIDTH, type Technique } from './techniques';
import {loadCharacterSprites} from './spriteCharacter';

export type Stage = { spot:Spot; look:Look; guest?:Look; motion:Motion; technique?:Technique; variant:'title'|'dashboard'|'race'|'event'|'preview'; reduce:boolean };
export async function createStage(parent:HTMLElement,latest:()=>Stage){
  await loadCharacterSprites();
  class SpotScene extends Phaser.Scene {
    private art!: Phaser.Textures.CanvasTexture;
    private rider!: Phaser.Textures.CanvasTexture;
    private sprite!: Phaser.GameObjects.Image;
    private guestArt!: Phaser.Textures.CanvasTexture;
    private guestSprite!: Phaser.GameObjects.Image;
    private spot?:Spot;
    private competition=false;
    private lastMotion?:Motion;
    private motionAt=0;
    private lastTechnique?:string;
    private progress?:number;
    private progressAt=0;
    create(){
      this.art=this.textures.createCanvas('pixel-landscape',WIDTH,HEIGHT)!;
      this.rider=this.textures.createCanvas('pixel-rider',ACTOR_WIDTH*2,ACTOR_HEIGHT*2)!;
      this.guestArt=this.textures.createCanvas('pixel-guest',ACTOR_WIDTH*2,ACTOR_HEIGHT*2)!;
      this.add.image(0,0,'pixel-landscape').setOrigin(0,0);
      this.guestSprite=this.add.image(370,84,'pixel-guest').setOrigin(0,0).setScale(.28);
      this.sprite=this.add.image(0,0,'pixel-rider').setOrigin(0,0).setScale(.45);
      this.render(performance.now());
    }
    update(time:number){ if(this.sprite) this.render(time); }
    private render(time:number){
      const s=latest();
      const competition=s.variant==='race';
      if(this.spot!==s.spot||this.competition!==competition){
        paintLandscape(this.art.getContext(),s.spot,competition);
        this.art.refresh();
        this.spot=s.spot;
        this.competition=competition;
      }
      const now=s.reduce?0:time;
      if(s.motion!==this.lastMotion||s.technique?.id!==this.lastTechnique){ this.lastMotion=s.motion; this.lastTechnique=s.technique?.id; this.motionAt=now;this.progress=undefined; }
      const elapsed=now-this.motionAt;
      if(s.technique?.progress!==this.progress){this.progress=s.technique?.progress;this.progressAt=now;}
      let technique=s.technique;
      if(technique){
        const sampled=technique.progress===undefined?elapsed%4000/4000:technique.progress+(now-this.progressAt)/1000*(technique.rate??0);
        technique={...technique,progress:s.reduce ? .1 : technique.loop ? sampled%1 : Math.min(1,sampled)};
      }
      paintRider(this.rider.getContext(),s.look,s.motion,elapsed,technique,s.spot==='night');
      this.rider.refresh();
      const anchor=s.variant==='title'?280:competition?203:s.variant==='preview'?126:s.variant==='event'?179:236;
      const moving=!s.technique&&['ride','accelerate','brake','mount','carve'].includes(s.motion);
      const lurch=s.motion==='accelerate'?Math.min(32,elapsed*.045):s.motion==='brake'?Math.max(0,18-elapsed*.024):0;
      const drift=moving?Math.sin(now/1350)*(competition?38:15):0;
      this.sprite.setPosition(Math.round(anchor+drift+lurch),16);
      this.guestSprite.setVisible(!!s.guest);
      if(s.guest){
        paintRider(this.guestArt.getContext(),s.guest,s.variant==='event'?'rest':'ride',now);
        this.guestArt.refresh();
        this.guestSprite.setPosition(s.variant==='event'?298:348,s.variant==='event'?73:79);
      }
    }
  }
  return new Phaser.Game({
    type:Phaser.CANVAS,width:WIDTH,height:HEIGHT,parent,scene:[SpotScene],transparent:false,
    backgroundColor:'#302942',pixelArt:true,
    scale:{mode:Phaser.Scale.NONE},
    fps:{target:30,forceSetTimeOut:true}, banner:false,
    audio:{noAudio:true},
  });
}
