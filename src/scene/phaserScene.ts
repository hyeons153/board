import * as Phaser from 'phaser';
import type { Look, Spot } from '../game/types';
import { HEIGHT, WIDTH, paintLandscape, paintRider, type Motion } from './landscape';

export type Stage = { spot:Spot; look:Look; guest?:Look; motion:Motion; variant:'title'|'dashboard'|'race'|'event'|'preview'; reduce:boolean };
export function createStage(parent:HTMLElement,latest:()=>Stage){
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
    create(){
      this.art=this.textures.createCanvas('pixel-landscape',WIDTH,HEIGHT)!;
      this.rider=this.textures.createCanvas('pixel-rider',64,65)!;
      this.guestArt=this.textures.createCanvas('pixel-guest',64,65)!;
      this.add.image(0,0,'pixel-landscape').setOrigin(0,0);
      this.guestSprite=this.add.image(388,106,'pixel-guest').setOrigin(0,0).setScale(.88);
      this.sprite=this.add.image(0,0,'pixel-rider').setOrigin(0,0).setScale(1.46);
      this.render(0);
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
      if(s.motion!==this.lastMotion){ this.lastMotion=s.motion; this.motionAt=now; }
      const elapsed=now-this.motionAt;
      paintRider(this.rider.getContext(),s.look,s.motion,elapsed);
      this.rider.refresh();
      const anchor=s.variant==='title'?340:competition?259:s.variant==='preview'?194:s.variant==='event'?236:294;
      const moving=['ride','accelerate','brake','mount','carve'].includes(s.motion);
      const lurch=s.motion==='accelerate'?Math.min(32,elapsed*.045):s.motion==='brake'?Math.max(0,18-elapsed*.024):0;
      const drift=moving?Math.sin(now/1350)*(competition?38:15):0;
      this.sprite.setPosition(Math.round(anchor+drift+lurch),77+(s.motion==='land'?2:0));
      this.guestSprite.setVisible(!!s.guest);
      if(s.guest){
        paintRider(this.guestArt.getContext(),s.guest,s.variant==='event'?'rest':'ride',now);
        this.guestArt.refresh();
        this.guestSprite.setPosition(s.variant==='event'?337:392,s.variant==='event'?93:106);
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
