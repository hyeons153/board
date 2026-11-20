import { command, newRider, prepareWeek, processWeek } from '../src/game/career';
import { CALENDAR, DEFAULT_LOOK, RULES, SKILLS } from '../src/game/data';
import { chooseEnding, summarize } from '../src/game/legacy';
import { eventFor } from '../src/game/events';
import { seeded } from '../src/game/random';
import { randomSpecialTraining, trainingSuccess } from '../src/game/training';
import { rankingPoints } from '../src/game/rp';
import { DISCIPLINES, STATS, STRATEGIES, type Career } from '../src/game/types';

const count=Number(process.argv[2]??12);
if(!Number.isInteger(count)||count<1||count>100) throw new Error('Choose between 1 and 100 seeds.');
const nonRomance:Record<string,number>={
  'story-jun-2':1,'story-min-4':1,'story-sol-4':1,'story-jun-4':1,'story-ha-4':1,'story-noa-4':1,'story-yu-4':0,
};

const average=(sum:number,samples:number)=>Math.round(sum/Math.max(1,samples)*10)/10;
const spotTrials=1200;
for(const [spot,lesson,special] of [['studio',false,false],['night',false,false],['night',true,false],['night',true,true]] as const){
  let mastery=0,injuries=0;
  for(let seed=1;seed<=spotTrials;seed++){
    const rider=newRider('spot-'+seed,seed,'Spot trial',DEFAULT_LOOK);
    Object.assign(rider,{year:4,week:CALENDAR[0].week,energy:80,fame:12,stats:{...rider.stats,balance:45}});
    rider.skills.hardflip={study:100,mastery:40};
    const career:Career={rider,hall:[]};
    command(career,{type:'plan',plan:{action:'trick',skill:'hardflip',spot,lesson,meetTraining:special?true:undefined}},()=>({id:rider.id,seed}));
    processWeek(career);
    mastery+=rider.skills.hardflip.mastery-40;
    injuries+=Number(!!rider.injury);
  }
  console.log('spot-trial',JSON.stringify({spot,lesson,special,samples:spotTrials,mastery:average(mastery,spotTrials),injuryPercent:average(100*injuries,spotTrials)}));
}

const energyRanges=[[0,19],[20,39],[40,69],[70,79],[80,100]] as const;
const energyCheck=energyRanges.map(([min,max])=>{
  let hits=0,cases=0,expected=0;
  const r=newRider('energy-check',1,'Simulation Rider',DEFAULT_LOOK);
  for(let energy=min;energy<=max;energy++){
    r.energy=energy;
    const chance=trainingSuccess(r,{action:'speed',spot:'river'});
    for(let seed=1;seed<=2000;seed++){
      expected+=chance;
      hits+=Number(seeded(seed+energy*2000,1,1,'training')()>=1-chance);
      cases++;
    }
  }
  return {energy:`${min}–${max}`,expectedPercent:average(expected*100,cases),observedPercent:average(hits*100,cases)};
});
console.log('training-success',JSON.stringify(energyCheck));

for(const enterOrdinary of [true,false])for(const strategy of STRATEGIES){
  const endings:Record<string,number>={};
  const totals={rankedMeets:0,wins:0,maxed:0,statTotal:0,scoreSum:0,runs:0,rp:0,money:0,decisions:0,personal:0,crew:0,happenings:0,chapters:0,casual:0};
  const training={weeks:0,regularWeeks:0,rest:0,hospital:0,attempts:0,injuries:0,recovered:0,recoveryWeeks:0,opportunities:0,randomUsed:0,meetUsed:0};
  const years=Array.from({length:RULES.years},()=>({stats:0,learned:0,mastery:0,mastered:0,intermediate:0,advanced:0,expert:0}));
  const byDiscipline=Object.fromEntries(DISCIPLINES.map(d=>[d,{score:0,runs:0}])) as Record<typeof DISCIPLINES[number],{score:number;runs:number}>;
  let podiumGrowth=0,podiumAwards=0;
  for(let seed=1;seed<=count;seed++){
    const rider=newRider('internal-'+seed,seed,'Simulation Rider',DEFAULT_LOOK);
    const career:Career={rider,hall:[]};
    rider.settings={mode:'auto',strategy,entries:enterOrdinary?[strategy==='balanced'?'dance':strategy]:[]};
    let injuredSince:number|undefined;
    for(let week=0;week<RULES.weeks*RULES.years;week++){
      prepareWeek(rider);
      const action=rider.plan?.action;
      const year=rider.year;
      training.opportunities+=Number(!!randomSpecialTraining(rider));
      if(!processWeek(career)) throw new Error('Automatic progression stalled on seed '+seed);
      if(rider.phase==='event'&&rider.event){
        totals.decisions++;
        command(career,{type:'event',eventId:rider.event,index:nonRomance[rider.event]??0},()=>({id:rider.id,seed}));
      }
      const result=rider.extras?.lastTraining;
      training.weeks++;
      training.rest+=Number(action==='rest');
      training.hospital+=Number(action==='hospital');
      training.attempts+=Number(action!=='rest'&&action!=='hospital');
      if(result?.grade==='injury'){training.injuries++;injuredSince??=week;}
      if(injuredSince!==undefined&&!rider.injury){
        training.recovered++;
        training.recoveryWeeks+=week-injuredSince;
        injuredSince=undefined;
      }
      training.randomUsed+=Number(result?.special==='random');
      training.meetUsed+=Number(result?.special==='meet');
      if((week+1)%RULES.weeks===0){
        const season=years[year-1],skills=Object.values(rider.skills).filter(skill=>skill.study>=100);
        season.stats+=STATS.reduce((sum,stat)=>sum+rider.stats[stat],0)/STATS.length;
        season.learned+=skills.length;
        season.mastery+=skills.reduce((sum,skill)=>sum+skill.mastery,0)/Math.max(1,skills.length);
        season.mastered+=skills.filter(skill=>skill.mastery>=100).length;
        const learnedSkills=SKILLS.filter(skill=>(rider.skills[skill.id]?.study??0)>=100);
        season.intermediate+=Number(learnedSkills.some(skill=>skill.difficulty>=2));
        season.advanced+=Number(learnedSkills.some(skill=>skill.difficulty>=3));
        season.expert+=Number(learnedSkills.some(skill=>skill.difficulty>=4));
      }
    }
    const [archive]=career.hall;
    if(!archive||archive.records.length!==48||!archive.records.every(meet=>meet.id.startsWith('international-')?meet.results.length===3:meet.results.length<=1)) throw new Error('Incomplete retirement ledger');
    const outcome=chooseEnding(archive).kind;
    endings[outcome]=(endings[outcome]??0)+1;
    const summary=summarize(archive);
    const ids=Object.keys(archive.events??{});
    totals.personal+=ids.filter(id=>id.startsWith('story-')).length+Number(ids.includes('first'));
    totals.crew+=ids.filter(id=>id.startsWith('cross-')||id==='crew-npc-pair').length;
    totals.happenings+=ids.filter(id=>id.startsWith('happening-')).length;
    totals.chapters+=ids.filter(id=>id.startsWith('career-')).length;
    totals.casual+=Object.entries(archive.events??{}).filter(([id])=>!eventFor(rider,id)?.story&&!id.startsWith('happening-')).reduce((n,[,seen])=>n+seen,0);
    totals.rankedMeets+=summary.meets;
    totals.wins+=summary.wins;
    training.regularWeeks+=RULES.weeks*RULES.years-archive.records.length;
    totals.rp+=rankingPoints(archive).total;
    totals.money+=rider.money;
    totals.maxed+=STATS.filter(stat=>archive.stats[stat]===RULES.statCap).length;
    totals.statTotal+=STATS.reduce((sum,stat)=>sum+archive.stats[stat],0);
    for(const meet of archive.records) for(const result of meet.results){
      if(!Number.isFinite(result.run.score)||result.run.score<0||result.run.score>100) throw new Error('Out-of-bounds score');
      totals.scoreSum+=result.run.score;
      totals.runs++;
      byDiscipline[result.discipline].score+=result.run.score;
      byDiscipline[result.discipline].runs++;
      if(result.statGains){
        podiumAwards++;
        podiumGrowth+=Object.values(result.statGains).reduce((sum,gain)=>sum+gain,0);
      }
    }
  }
  console.log(enterOrdinary?'enter':'skip',strategy,JSON.stringify({
    complete:count,endings,averageMeets:Math.round(totals.rankedMeets/count*10)/10,
    averageWins:Math.round(totals.wins/count*10)/10,averageStat:Math.round(totals.statTotal/count/4*10)/10,
    cappedStats:totals.maxed,averageScore:Math.round(totals.scoreSum/totals.runs*10)/10,
    averageRP:average(totals.rp,count),averageMoney:average(totals.money,count),
    disciplineScores:Object.fromEntries(DISCIPLINES.map(d=>[d,byDiscipline[d].runs?average(byDiscipline[d].score,byDiscipline[d].runs):null])),
    podiumGrowth:average(podiumGrowth,count),podiumAwards:average(podiumAwards,count),
    training:{restPercent:average(training.rest*100,training.weeks),hospitalPercent:average(training.hospital*100,training.weeks),
      injuryPercent:average(training.injuries*100,training.attempts),averageRecoveryWeeks:average(training.recoveryWeeks,training.recovered),
      specialOfferPercent:average(training.opportunities*100,training.regularWeeks),
      specialUsePercent:average(training.randomUsed*100,training.opportunities),
      randomUses:average(training.randomUsed,count),meetUses:average(training.meetUsed,count)},
    years:years.map(season=>({stat:average(season.stats,count),learned:average(season.learned,count),mastery:average(season.mastery,count),
      mastered:average(season.mastered,count),intermediate:average(100*season.intermediate,count),advanced:average(100*season.advanced,count),expert:average(100*season.expert,count)})),
    eventsPerCareer:Object.fromEntries((['decisions','personal','crew','happenings','chapters','casual'] as const).map(key=>[key,Math.round(totals[key]/count*10)/10])),
  }));
}
