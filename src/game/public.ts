import type { Discipline, Division, Ending, Look, Stats } from './types.js';
export const METRICS=['career','dance','trick','freestyle','wins','skills'] as const;
export type Metric=typeof METRICS[number];
export type Scope='all'|Division;
export const RANKING_VERSION=1;
export const RANK_INFO:Record<Metric,{label:string;rule:string}> = {
  career:{label:'종합 커리어',rule:'8년 완주. 대회별 점수와 입상 가치에 부문 가중치(1·1.5·2.25)와 메이저 가중치(1.5)를 적용합니다. 시즌 챔피언은 부문별 보너스를 받습니다.'},
  dance:{label:'댄싱',rule:'서버 검증을 통과한 댄싱 경기의 최고점.'},
  trick:{label:'트릭',rule:'서버 검증을 통과한 트릭 경기의 최고점.'},
  freestyle:{label:'프리스타일',rule:'서버 검증을 통과한 프리스타일 경기의 최고점.'},
  wins:{label:'통산 우승',rule:'서버 검증을 통과한 종목별 1위 횟수.'},
  skills:{label:'기술 마스터',rule:'습득 기술당 10점, 숙련도 합계의 10%, 숙련도 82 이상 고급 기술당 15점.'},
};
export type PublicProfile = {
  name:string; look:Look; title:string; year:number; week:number; complete:boolean; division:Division;
  stats:Stats; skills:{id:string;mastery:number}[]; signature?:string; wins:number; podiums:number; meets:number;
  best:Record<Discipline,number>; points:number; careerPoints:number|null; ending:Ending;
  routines:Partial<Record<Discipline,string[]>>; official:boolean; historic:boolean;
};
export type PublicCard = {id:string;profile:PublicProfile;rank?:number;score?:number;mine?:boolean};
export type Directory = {rows:PublicCard[];page:number;hasMore:boolean;mine:PublicCard[]};
export type Publication = {archiveId:string; id:string; active:boolean; moderated:boolean};
