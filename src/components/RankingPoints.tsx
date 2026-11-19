import { DISCIPLINE_NAMES, RULES } from '../game/data';
import { formatRP, meetRP, type SeasonRP } from '../game/rp';
import { DISCIPLINES } from '../game/types';

export function RPDisciplines({points}:{points:SeasonRP['disciplines']}){
  return <dl className="rp-breakdown" aria-label="종목별 RP">{DISCIPLINES.map(discipline=>
    <div key={discipline}><dt>{DISCIPLINE_NAMES[discipline]}</dt><dd>{formatRP(points[discipline])}</dd></div>)}</dl>;
}

export function RPPayouts(){
  return <div className="rp-payouts">
    <p>정기 대회 1~7위는 {Array.from({length:7},(_,index)=>meetRP(index+1,false)).join(' · ')} RP를 받습니다.</p>
    <p>메이저·국제대회는 종목당 {RULES.majorMultiplier}배를 적용하고 반올림합니다. 1위는 {formatRP(meetRP(1,true))}입니다.</p>
  </div>;
}
