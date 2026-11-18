let context:AudioContext|undefined,armed=false;
export function soundsEnabled(){try{return localStorage.getItem('longboard-sounds')!=='off';}catch{return true;}}
function audio(){
  if(typeof window==='undefined'||!window.AudioContext||!soundsEnabled())return;
  context??=new AudioContext();void context.resume().catch(()=>{});return context;
}
export function armSounds(){
  if(armed||typeof window==='undefined')return;armed=true;
  window.addEventListener('pointerdown',()=>{audio();},{once:true,passive:true});
}
export function setSoundsEnabled(enabled:boolean){try{localStorage.setItem('longboard-sounds',enabled?'on':'off');}catch{}if(enabled)audio();}
export function playFallChirp(){
  if(!soundsEnabled()||context?.state!=='running')return;
  for(const [index,pitch] of [1400,1000].entries()){
    const source=context.createOscillator(),gain=context.createGain(),start=context.currentTime+index*.1;
    source.type='triangle';source.frequency.setValueAtTime(pitch,start);source.frequency.exponentialRampToValueAtTime(pitch*.55,start+.1);
    gain.gain.setValueAtTime(.025,start);gain.gain.exponentialRampToValueAtTime(.001,start+.11);source.connect(gain);gain.connect(context.destination);source.start(start);source.stop(start+.12);
  }
}
