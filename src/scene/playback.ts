export type PlaybackRate=1|2;
export type AnimationClock={elapsed:number;stamp?:number};

/** Accumulate elapsed milliseconds so changing speed never rewinds an animation. */
export function advanceClock(clock:AnimationClock,stamp:number,rate:number){
  if(clock.stamp!==undefined)clock.elapsed+=Math.max(0,stamp-clock.stamp)*rate;
  clock.stamp=stamp;
  return clock.elapsed;
}

const preference='longboard-competition-speed';
export function readPlaybackRate():PlaybackRate{
  try{return window.localStorage.getItem(preference)==='2'?2:1;}catch{return 1;}
}
export function savePlaybackRate(rate:PlaybackRate){
  try{window.localStorage.setItem(preference,String(rate));}catch{/* Playback still works if preferences cannot be stored. */}
}
