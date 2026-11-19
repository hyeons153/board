export const STATS = ['speed', 'carve', 'link', 'balance'] as const;
export const DIVISIONS = ['rookie','regular','open','master'] as const;
export const DISCIPLINES = ['dance','trick','freestyle'] as const;
export const SPOTS = ['river','plaza','park','studio','night','arena','rooftop'] as const;
export const STRATEGIES = ['balanced','dance','trick','freestyle'] as const;
export const STYLES = ['stable','flow','score'] as const;
export const NPC_NAMES={min:'이민재',sol:'윤솔',jun:'강준',ha:'최하린',noa:'정노아',yu:'한유리'} as const;
export const ACTIONS = [...STATS,'dance','trick','rest','hospital'] as const;
export type Stat = typeof STATS[number];
export type Stats = Record<Stat,number>;
export type Division = typeof DIVISIONS[number];
export type Discipline = typeof DISCIPLINES[number];
export type Spot = typeof SPOTS[number];
export type Strategy = typeof STRATEGIES[number];
export type RoutineStyle = typeof STYLES[number];
// Retain the removed action only to finish and read existing saved training.
export type Action = typeof ACTIONS[number]|'rehearsal';
export type Family = 'dance'|'trick';
export type Look = { hair: number; skin: number; shirt: number; board: number; gender?:'male'|'female'; hairColor?:number; pants?:number; shoes?:number; deckDesign?:number; outfit?:number; bottom?:number; footwear?:number; eyes?:number; equipment?:{deck?:{shape:number;color?:number};trucks?:string;wheels?:{color?:string;size:number};accessories:import('./equipmentCatalog.js').Visual[]} };
export type Plan = { action: Action; spot: Spot; skill?: string; lesson?:boolean; discipline?:Discipline };
export type Settings = { mode: 'manual'|'auto'; strategy: Strategy; entries: Discipline[]; pauseStory?:boolean; pauseMeet?:boolean; pauseInjury?:boolean; manualEvents?:boolean; skipMeets?:boolean };
export type Skill = { id:string; name:string; family:Family; kind:'step'|'technique'|'spin'|'pop'|'flip'; difficulty:number; points:number; seconds:number; requires:string[]; risk:number; tags:readonly string[] };
export type Progress = { study:number; mastery:number };
export type RelationshipState = 'undecided'|'friend'|'rival'|'interested'|'partner'|'ended';
export type RelationshipMode = 'private'|'public'|'agreed'|'secret';
export type RelationshipProgress = { state:RelationshipState; flags:string[]; mode?:RelationshipMode; pendingReward?:{title?:string;item?:string} };
export type StoryEntry = { id:string; year:number; week:number; choice?:number; npcs:string[]; dialogue?:string; details:string[] };
export type RelationshipHistory = {
  npcs:Partial<Record<string, RelationshipProgress>>;
  titles:string[];
  representative?:string;
  story?:StoryEntry[];
  couples?:[string,string][];
};
export type Injury = { severity:'minor'|'major'; weeks:number; treated:boolean; taped?:boolean };
export type Meet = { id:string; month:number; week:number; name:string; major:boolean; spot:Spot; international?:boolean; host?:string };
export type Outcome = 'miss'|'rough'|'clean'|'great';
export type MoveLog = { id:string; at:number; end:number; outcome:Outcome; linked:boolean|null; combo:number; points:number };
export type Run = { score:number; parts:Partial<Record<'execution'|'link'|'combo'|'carve'|'speed',number>>; log:MoveLog[]; highlight?:MoveLog };
export type Standing = { id:string; name:string; score:number; place:number };
export type RunProof = { version:number; rules?:1|2|3; seed:number; routine:string[]; stats:Stats; energy:number; injury:Injury|null; skills:Record<string,Progress>; gear?:Pick<CareerExtras,'inventory'|'equipped'|'accessories'|'equipmentVersion'> };
export type Result = { discipline:Discipline; run:Run; standings:Standing[]; points:number; prize:number; fame:number; energy:number; opponents?:Record<string,Run>; sponsorBonus?:number; participation?:number; look?:Look; proof?:RunProof };
export type MeetRecord = { year:number; id:string; division:Division; results:Result[]; detail?:'summary'|'full' };
export type Season = { year:number; division:Division; scores:Record<Discipline,Record<string,number>> };
export type News = { year:number; week:number; type:'training'|'event'|'meet'|'system'; text:string };
export type Rider = {
  id:string; name:string; look:Look; seed:number; year:number; week:number; stats:Stats; energy:number; money:number; fame:number;
  injury:Injury|null; skills:Record<string,Progress>; relations:Record<string,number>; events:Record<string,number>;
  settings:Settings; plan:Plan|null; lastPlan?:Plan; spot:Spot; phase:'plan'|'event'|'meet'|'injury'|'retired'; event:string|null;
  entries:Discipline[]|null; routines:Record<Discipline,string[]>; records:MeetRecord[]; season:Season; seasons:Season[];
  news:News[]; reason:'early'|'complete'|null; extras?:CareerExtras; rankedStart?:number; mentor?:Mentor; calendarVersion?:2;
};
export type Ending = { kind:'legend'|'champion'|'technician'|'veteran'|'early'; discipline?:Discipline; friends:string[] };
export type Mentor = { id:string; name:string; look:Look; skill?:string; title:string; wins:number };
export type Archive = { id:string; name:string; look:Look; year:number; week:number; reason:'early'|'complete'; stats:Stats; skills:Record<string,Progress>; records:MeetRecord[]; seasons:Season[]; relations:Record<string,number>; fame:number; extras?:CareerExtras; events?:Rider['events']; ending?:Ending; honors?:string[]; rankedStart?:number; calendarVersion?:2 };
export type Career = { rider:Rider|null; hall:Archive[]; parked?:Rider[] };
export type EventOutcome = { key:string; eventId:string; title:string; kind:string; choice:string; details:string[]; year:number; week:number; npc?:string; dialogue?:string; participants?:string[]; happening?:boolean; afterMeet?:boolean };
export type TrainingSetup = { gear:Pick<CareerExtras,'inventory'|'equipped'|'accessories'|'equipmentVersion'>; routines:Rider['routines'] };
export type View = { career:Career; version:number; stateVersion:number; remainingMs:number; weekMs:number; fastForward:boolean; pendingMeet?:string; pendingTraining?:string; pendingChoice?:string; pendingEvent?:EventOutcome; backgroundMs?:number; storage:'local'|'neon'; username?:string; scope?:string };
export type GameAction =
  | { type:'pulse'; background?:'hidden'|'visible' }
  | { type:'continue-training'; record:string }
  | { type:'continue-event'; record:string }
  | { type:'start-training'; record:string }
  | { type:'continue-meet'; record:string }
  | { type:'fast-forward'; enabled:boolean }
  | { type:'create'; name:string; look:Look }
  | { type:'plan'; plan:Plan }
  | { type:'spot'; spot:Spot }
  | { type:'settings'; settings:Settings }
  | { type:'entry'; disciplines:Discipline[] }
  | { type:'event'; index:number; eventId?:string }
  | { type:'representative-title'; id:string|null }
  | { type:'routine'; discipline:Discipline; skills:string[] }
  | { type:'trade'; operation:'buy'|'sell'|'equip'; item:string }
  | { type:'claim-gear' }
  | { type:'unequip'; slot:GearSlot|'bearings'; item?:string }
  | { type:'makeover'; look:Look }
  | { type:'sponsor'; id:string }
  | { type:'resume' }
  | { type:'switch-rider'; id:string }
  | { type:'retire' };
import type { CareerExtras, GearSlot } from './economy.js';

