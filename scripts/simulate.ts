import { newRider, processWeek } from '../src/game/career';
import { DEFAULT_LOOK, RULES } from '../src/game/data';
import { chooseEnding, summarize } from '../src/game/legacy';
import { DISCIPLINES, STATS, STRATEGIES, type Career } from '../src/game/types';

const count=Number(process.argv[2]??12);
if(!Number.isInteger(count)||count<1||count>100) throw new Error('Choose between 1 and 100 seeds.');

for(const strategy of STRATEGIES){
  const endings:Record<string,number>={};
  const totals={rankedMeets:0,wins:0,maxed:0,statTotal:0,scoreSum:0,runs:0};
  for(let seed=1;seed<=count;seed++){
    const rider=newRider('internal-'+seed,seed,'Simulation Rider',DEFAULT_LOOK);
    const career:Career={rider,hall:[]};
    rider.settings={mode:'auto',strategy,entries:[...DISCIPLINES]};
    for(let week=0;week<RULES.weeks*RULES.years;week++){
      if(!processWeek(career)) throw new Error('Automatic progression stalled on seed '+seed);
    }
    const [archive]=career.hall;
    if(!archive||archive.records.length!==48||!archive.records.every(meet=>meet.results.length<=DISCIPLINES.length)) throw new Error('Incomplete retirement ledger');
    const outcome=chooseEnding(archive).kind;
    endings[outcome]=(endings[outcome]??0)+1;
    const summary=summarize(archive);
    totals.rankedMeets+=summary.meets;
    totals.wins+=summary.wins;
    totals.maxed+=STATS.filter(stat=>archive.stats[stat]===RULES.statCap).length;
    totals.statTotal+=STATS.reduce((sum,stat)=>sum+archive.stats[stat],0);
    for(const meet of archive.records) for(const result of meet.results){
      if(!Number.isFinite(result.run.score)||result.run.score<0||result.run.score>100) throw new Error('Out-of-bounds score');
      totals.scoreSum+=result.run.score;
      totals.runs++;
    }
  }
  console.log(strategy,JSON.stringify({
    complete:count,endings,averageMeets:Math.round(totals.rankedMeets/count*10)/10,
    averageWins:Math.round(totals.wins/count*10)/10,averageStat:Math.round(totals.statTotal/count/4*10)/10,
    cappedStats:totals.maxed,averageScore:Math.round(totals.scoreSum/totals.runs*10)/10,
  }));
}
