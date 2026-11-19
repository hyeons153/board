import type { Discipline, Division, Ending, Look, Stats } from './types.js';

export const METRICS=['career','dance','trick','freestyle'] as const;
export type Metric=typeof METRICS[number];
export const RANKING_VERSION=2;
export const RUN_PROOF_VERSION=1;
export const RANK_COMPONENTS={competition:'대회 성적',personalBest:'개인 최고점',skills:'기술 습득·숙련도',stats:'최종 능력치',seasons:'시즌 우승'} as const;
type Component=keyof typeof RANK_COMPONENTS;
export const RANK_INFO={
  career:{label:'종합',weights:{competition:350,personalBest:250,skills:200,stats:150,seasons:50}},
  dance:{label:'댄싱',weights:{competition:600,personalBest:300,skills:100}},
  trick:{label:'트릭',weights:{competition:600,personalBest:300,skills:100}},
  freestyle:{label:'프리스타일',weights:{competition:600,personalBest:300,skills:100}},
} satisfies Record<Metric,{label:string;weights:Partial<Record<Component,number>>}>;
export const HONOR_RULES={
  division:{rookie:1,regular:1.5,open:2.25,master:3},major:1.5,
  places:[1,.72,.52,.32,.23,.16,.10],meetLimit:5,
  runWeight:.6,levelWeight:.2,repeatWeight:.18,masteryWeight:.65,
} as const;

export type MeetHighlight={id:string;year:number;division:Division;discipline:Discipline;score:number;place:number};
export type HonorScore={total:number;components:Partial<Record<Component,number>>;representative:MeetHighlight;verifiedMeets:number};
export type PublicSummary={
  name:string;look:Look;title:string;year:number;week:number;complete:boolean;division:Division;
  wins:number;podiums:number;meets:number;best:Record<Discipline,number>;ending:Ending;official:boolean;historic:boolean;honors?:string[];
};
export type PublicProfile=PublicSummary&{
  stats:Stats;skills:{id:string;mastery:number}[];signature?:string;points:number;careerPoints:number|null;
  routines:Partial<Record<Discipline,string[]>>;meetHistory?:MeetHighlight[];
  honorScores?:Partial<Record<Metric,HonorScore>>;rankingVersion?:number;
};
export type PublicCard<P=PublicProfile>={id:string;profile:P;rank?:number;score?:number;honor?:HonorScore;mine?:boolean};
export type Directory={rows:PublicCard<PublicSummary>[];page:number;hasMore:boolean;mine:PublicCard<PublicSummary>[]};
export type Publication={archiveId:string;id:string;active:boolean;moderated:boolean};
