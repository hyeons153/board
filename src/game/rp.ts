import { RULES } from './data.js';
import { DISCIPLINES, type Discipline, type MeetRecord, type Season } from './types.js';

type DisciplineRP=Record<Discipline,number>;
export type SeasonRP={year:number;total:number;disciplines:DisciplineRP};
export type CareerRP={total:number;disciplines:DisciplineRP;seasons:SeasonRP[];partial:boolean};
const empty=():DisciplineRP=>({dance:0,trick:0,freestyle:0});
const total=(points:DisciplineRP)=>DISCIPLINES.reduce((sum,discipline)=>sum+points[discipline],0);
export const validRP=(points:unknown):points is number=>typeof points==='number'&&Number.isSafeInteger(points)&&points>=0;
export const formatRP=(points:number)=>points.toLocaleString('ko-KR')+' RP';

export function meetRP(place:number,major:boolean){
  const base=RULES.places[Math.min(place-1,RULES.places.length-1)]??0;
  return Math.round(base*(major?RULES.majorMultiplier:1));
}

export function rankingPoints({records,seasons,season}: {records:readonly MeetRecord[];seasons:readonly Season[];season?:Season}):CareerRP{
  const years=new Map<number,{points:DisciplineRP;unresolved:Set<Discipline>}>();
  const yearAt=(year:number)=>{
    const saved=years.get(year);
    if(saved)return saved;
    const entry={points:empty(),unresolved:new Set<Discipline>()};
    years.set(year,entry);
    return entry;
  };
  const seen=new Map<string,number|null>();
  for(const meet of records){
    const {points,unresolved}=yearAt(meet.year);
    for(const result of meet.results){
      const key=`${meet.year}:${meet.id}:${result.discipline}`;
      if(!validRP(result.points)){unresolved.add(result.discipline);continue;}
      const existing=seen.get(key);
      if(existing===undefined){seen.set(key,result.points);points[result.discipline]+=result.points;}
      else if(existing!==null&&existing!==result.points){
        points[result.discipline]-=existing;
        seen.set(key,null);
        unresolved.add(result.discipline);
      }
    }
  }

  // The existing season table is an exact fallback for records that were not retained individually.
  const savedSeasons=new Map(seasons.map(value=>[value.year,value]));
  if(season&&!savedSeasons.has(season.year))savedSeasons.set(season.year,season);
  for(const [year,saved] of savedSeasons){
    const {points,unresolved}=yearAt(year);
    for(const discipline of DISCIPLINES){
      const stored=saved.scores[discipline]?.player;
      if(stored===undefined)continue;
      if(validRP(stored)&&stored>=points[discipline]){
        points[discipline]=stored;
        unresolved.delete(discipline);
      }else unresolved.add(discipline);
    }
  }

  const disciplines=empty();
  const ledger=[...years].sort(([left],[right])=>left-right).map(([year,{points}])=>{
    for(const discipline of DISCIPLINES)disciplines[discipline]+=points[discipline];
    return {year,total:total(points),disciplines:points};
  });
  return {total:total(disciplines),disciplines,seasons:ledger,partial:[...years.values()].some(value=>value.unresolved.size>0)};
}

export const peakSeasonRP=(rp:CareerRP)=>rp.seasons.reduce<SeasonRP|undefined>((best,season)=>!best||season.total>best.total?season:best,undefined);
