import type { Discipline, Division, Ending, Look, Stats } from './types.js';
import type { CareerRP } from './rp.js';

export const METRICS=['career','dance','trick','freestyle'] as const;
export type Metric=typeof METRICS[number];
export const RANKING_VERSION=3;
export const RUN_PROOF_VERSION=1;
export const RANK_LABELS:Record<Metric,string>={career:'종합',dance:'댄싱',trick:'트릭',freestyle:'프리스타일'};

export type MeetHighlight={id:string;year:number;division:Division;discipline:Discipline;score:number;place:number;rp?:number};
export type PublicSummary={
  name:string;look:Look;title:string;year:number;week:number;complete:boolean;division:Division;
  representativeTitle?:string|null;
  wins:number;podiums:number;meets:number;best:Record<Discipline,number>;ending:Ending;official:boolean;historic:boolean;honors?:string[];
};
export type PublicProfile=PublicSummary&{
  stats:Stats;skills:{id:string;mastery:number}[];signature?:string;fame?:number;
  routines:Partial<Record<Discipline,string[]>>;meetHistory?:MeetHighlight[];
  rp?:CareerRP;representatives?:Partial<Record<Metric,MeetHighlight>>;rankingVersion?:number;
};
export type PublicCard<P=PublicProfile>={id:string;profile:P;rank?:number;score?:number;representative?:MeetHighlight;mine?:boolean};
export type Directory={rows:PublicCard<PublicSummary>[];page:number;hasMore:boolean;mine:PublicCard<PublicSummary>[]};
export type Publication={archiveId:string;id:string;active:boolean;moderated:boolean};
