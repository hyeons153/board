import * as Phaser from 'phaser';
import type { Look, Spot } from '../game/types';
import { HEIGHT, WIDTH, landscapeEdge, paintLandscape, paintRider, type Motion } from './landscape';
import { ACTOR_HEIGHT, ACTOR_WIDTH, type Technique } from './techniques';
import {loadCharacterSprites} from './spriteCharacter';
import {advanceClock, type AnimationClock} from './playback';

export type Stage = { spot:Spot; look:Look; guest?:Look; motion:Motion; technique?:Technique; variant:'title'|'dashboard'|'race'|'event'|'preview'; reduce:boolean; playbackRate?:number };

function mobileActors(parent:HTMLElement,world:HTMLElement,field:HTMLElement){
  const view=parent.getBoundingClientRect();
  if(!view.width||!view.height||parent.closest('.has-dialogue'))return;
  const band=field.querySelector('.console-scene-space')?.getBoundingClientRect();
  const hud=field.querySelector('.console-status')?.getBoundingClientRect();
  const running=field.querySelector('.weekly-running')?.getBoundingClientRect();
  const retired=parent.closest('.is-retired');
  const retirementTitle=retired?.querySelector('.spot-title')?.getBoundingClientRect();
  const retirementActions=retired?world.querySelector('.console-home-actions')?.getBoundingClientRect():undefined;
  const top=(band?.top??hud?.bottom??retirementTitle?.bottom??view.top)+6;
  const below=(band?.bottom??running?.top??retirementActions?.top??view.bottom)-8;

  // Keep the actor textures in screen coordinates. Only the background uses the cover crop.
  const zoom=Math.max(view.width/WIDTH,view.height/HEIGHT);
  const offsetY=(view.height-HEIGHT*zoom)/2;
  const referenceHeight=Math.min(world.clientHeight,Math.max(window.innerHeight*.52,world.clientHeight-245));
  const size=Math.min(referenceHeight/HEIGHT*.9,Math.max(0,below-top)/126);
  if(!size)return;
  const guestSize=size*.62;
  const guestX=Math.min(view.width*.76,view.width-12-guestSize*40);
  const floor=below-view.top;
  const fit=(center:number,scale:number)=>({
    x:center-ACTOR_WIDTH/2*scale,
    y:floor-170*scale,
    width:ACTOR_WIDTH*scale,
    height:ACTOR_HEIGHT*scale,
  });
  return {rider:fit(view.width*.39,size),guest:fit(guestX,guestSize),zoom,
    landscapeY:Math.min(0,Math.round((floor-offsetY)/zoom-167))};
}

export async function createStage(parent:HTMLElement,latest:()=>Stage){
  await loadCharacterSprites();
  class SpotScene extends Phaser.Scene {
    private art!: Phaser.Textures.CanvasTexture;
    private landscape!: Phaser.GameObjects.Image;
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
    private animationClock:AnimationClock={elapsed:0};
    private mobile?:ReturnType<typeof mobileActors>;
    private actorLayer?:HTMLDivElement;
    create(){
      this.art=this.textures.createCanvas('pixel-landscape',WIDTH,HEIGHT)!;
      const makeActor=(key:string)=>{
        const canvas=document.createElement('canvas');
        canvas.width=ACTOR_WIDTH*2;canvas.height=ACTOR_HEIGHT*2;
        return this.textures.addCanvas(key,canvas)!;
      };
      this.rider=makeActor('pixel-rider');
      this.guestArt=makeActor('pixel-guest');
      this.landscape=this.add.image(0,0,'pixel-landscape').setOrigin(0,0);
      this.guestSprite=this.add.image(370,84,'pixel-guest').setOrigin(0,0).setScale(.28);
      this.sprite=this.add.image(0,0,'pixel-rider').setOrigin(0,0).setScale(.45);
      const world=parent.closest<HTMLElement>('.console-world'),field=parent.closest<HTMLElement>('.console-field');
      if(world&&field&&latest().variant==='dashboard'){
        const media=matchMedia('(max-width:760px)');
        const layer=document.createElement('div'),rider=this.rider.getCanvas(),guest=this.guestArt.getCanvas();
        layer.className='scene-actors';
        layer.hidden=true;
        layer.append(guest,rider);
        parent.append(layer);
        this.actorLayer=layer;
        const fit=()=>{
          this.mobile=media.matches?mobileActors(parent,world,field):undefined;
          if(!this.mobile)return;
          const place=(canvas:HTMLCanvasElement,box:NonNullable<typeof this.mobile>['rider'])=>{
            canvas.style.width=box.width+'px';
            canvas.style.height=box.height+'px';
            canvas.style.left=box.x+'px';
            canvas.style.top=box.y+'px';
          };
          place(rider,this.mobile.rider);
          place(guest,this.mobile.guest);
        };
        const observer=new ResizeObserver(fit);
        observer.observe(parent);observer.observe(world);
        const trainingArea=field.querySelector('.console-training-area');
        if(trainingArea)observer.observe(trainingArea);
        if(parent.closest('.is-retired')){
          const actions=world.querySelector('.console-home-actions');
          if(actions)observer.observe(actions);
        }
        media.addEventListener('change',fit);
        this.events.once('shutdown',()=>{observer.disconnect();media.removeEventListener('change',fit);layer.remove();});
        fit();
      }
      this.render(performance.now());
    }
    update(time:number){ if(this.sprite) this.render(time); }
    private render(time:number){
      const s=latest();
      const competition=s.variant==='race';
      if(this.spot!==s.spot||this.competition!==competition){
        paintLandscape(this.art.getContext(),s.spot,competition);
        this.art.refresh();
        this.cameras.main.setBackgroundColor(landscapeEdge(s.spot));
        this.spot=s.spot;
        this.competition=competition;
      }
      const now=advanceClock(this.animationClock,time,s.reduce?0:s.playbackRate??1);
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
      const frame=s.variant==='dashboard'?this.mobile:undefined;
      this.landscape.setY(frame?.landscapeY??0);
      if(this.actorLayer)this.actorLayer.hidden=!frame;
      this.sprite.setVisible(!frame);
      if(frame){
        const shift=Math.round((drift*.32+lurch*.18)*frame.zoom);
        this.rider.getCanvas().style.transform=`translateX(${shift}px)`;
        this.guestArt.getCanvas().hidden=!s.guest;
      }else this.sprite.setPosition(Math.round(anchor+drift+lurch),16);
      this.guestSprite.setVisible(!!s.guest&&!frame);
      if(s.guest){
        paintRider(this.guestArt.getContext(),s.guest,s.variant==='event'?'rest':'ride',now);
        this.guestArt.refresh();
        if(!frame)this.guestSprite.setPosition(s.variant==='event'?298:348,s.variant==='event'?73:79);
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
