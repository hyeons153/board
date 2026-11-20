import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_FLOW, CALENDAR, calendarFor, formatCareerDate, formatMonthWeek, INTERNATIONAL_MEETS, monthWeek, DEFAULT_LOOK, RULES, SKILL, SKILLS, START_SKILLS } from '../src/game/data';
import { awardPodiumGrowth, command, divisionFor, GameError, newRider, prepareWeek, processWeek } from '../src/game/career';
import { chance, competitionStandings, generateRoutine, learned, routineTime, simulateMeet, simulateRun, validRoutine } from '../src/game/competition';
import { ECONOMY, equippedLook, extras, gearBonuses, playerPlace, SPONSOR } from '../src/game/economy';
import { previewTraining, randomSpecialTraining, statAfter, trainingFactor, trainingSuccess } from '../src/game/training';
import { EVENTS, eventBody, eventCast, eventChoiceAvailable, eventFor, eventPaused, pickEvent } from '../src/game/events';
import { jointDiscovery, jointInjuryFactor, jointMasteryFactor, jointTrainingOffer, type TrainingNpc } from '../src/game/jointTraining';
import { canStudy, nextSkillTraining } from '../src/game/skillTree';
import { RIVALS, spotRegulars, spotUnlocked, spotVisitor } from '../src/game/content';
import { HAPPENINGS, pickHappening } from '../src/game/happenings';
import { NPC_WORKSHOPS, trainingPromiseActive, workshopId, workshopTitle } from '../src/game/npcWorkshops';
import { ceremonyDuration, eventResultDuration, trainingResultDuration } from '../src/game/autoFlow';
import { closingSkill, featureMatch, matchPresentation } from '../src/game/matchPresentation';
import { currentObjectives, ensureObjectives, objectiveTrainingPlan, settleObjectives } from '../src/game/objectives';
import { CREW_STORIES } from '../src/game/crewStories';
import { STORY_ARCS } from '../src/game/storyArcs';
import { activePartners, formerPartners, hasRomanticInterest, storyLog, STORY_NPCS } from '../src/game/storyState';
import { RELATIONSHIP_REWARDS, relationshipEpilogues, relationshipWith, representativeTitle } from '../src/game/relationships';
import { seeded } from '../src/game/random';
import { meetRP, rankingPoints, seasonPlace } from '../src/game/rp';
import { advance, blankSave, remaining } from '../server/clock';
import { DISCIPLINES, SPOTS, STATS, TRAINING_ACTIONS, type Career, type Plan, type Spot, type MeetRecord, type Result } from '../src/game/types';

const identity=()=>({id:'rider-1',seed:5411});
const career=():Career=>({rider:newRider(identity().id,identity().seed,'리버',{...DEFAULT_LOOK}),hall:[]});
const plan=(p:Plan['action']):Plan=>({action:p,spot:'river'});
const enterAuto=(c:Career)=>command(c,{type:'settings',settings:{mode:'auto',strategy:'freestyle',entries:['freestyle']}},identity);

test('objectives are deterministic for legacy saves and season targets adapt to strategy and past scores',()=>{
  const r=career().rider!;
  r.year=4;r.week=6;r.settings={mode:'auto',strategy:'trick',entries:['trick']};
  const meet=CALENDAR[0];
  const {results}=simulateMeet(r,meet,['trick']);
  results[0].run.score=86;
  r.records.push({id:meet.id,year:3,division:'regular',results});
  const derived=currentObjectives(r);
  assert.equal(r.extras!.objectives,undefined,'A read does not migrate the save or hand out rewards');
  assert.deepEqual(currentObjectives({...r,seed:0}),derived);
  assert.ok(derived.short&&derived.short.end-r.week>=1&&derived.short.end-r.week<=3);
  const meetTarget=derived.season!.steps.find(({target})=>target.kind==='meet')!.target;
  assert.deepEqual(meetTarget,{kind:'meet',discipline:'trick',meet:'international-4',score:86,target:1});
  const state=ensureObjectives(r);
  r.settings.strategy='dance';
  assert.deepEqual(currentObjectives(JSON.parse(JSON.stringify(r))),{short:state.short,season:state.season});
  assert.equal(state.shortTotals.offered,1);assert.equal(state.seasonTotals.offered,1);
  state.short!.steps=[{target:{kind:'mastery',skill:'pivot',target:55},value:20}];
  const base:Plan={action:'trick',spot:'plaza',skill:'shuvit'};
  assert.equal(objectiveTrainingPlan(r,base).skill,'pivot');
  r.energy=60;
  assert.equal(objectiveTrainingPlan(r,base),base);
});

test('joint and competition objectives are paid once and count actual successes without awarding RP',()=>{
  const r=career().rider!;
  r.week=5;r.relations.yu=99.5;
  const state=ensureObjectives(r);
  state.short={year:1,end:8,status:'active',npc:'yu',steps:[{target:{kind:'joint',npc:'yu',target:2},value:0}]};
  state.season={year:1,end:52,status:'active',steps:[{target:{kind:'meet',discipline:'dance',meet:'regular-1',skill:'peter-pan',target:1},value:0}]};
  const initial=r.money;
  r.extras!.lastTraining={year:1,week:5,grade:'miss',text:'',joint:{npc:'yu',focus:false,affinity:0}};
  settleObjectives(r);
  assert.equal(state.short.steps[0].value,0);
  for(const week of [6,7]){
    r.week=week;
    r.extras!.lastTraining={year:1,week,grade:'success',text:'',joint:{npc:'yu',focus:true,affinity:0}};
    if(week===7){
      const {results}=simulateMeet(r,CALENDAR[0],['dance']);
      results[0].run.log=[{id:'peter-pan',at:0,end:5,outcome:'clean',linked:false,combo:1,points:10}];
      r.records.push({year:1,id:'regular-1',division:'rookie',results});
    }
    const rp=rankingPoints(r);
    settleObjectives(r);settleObjectives(r);
    assert.deepEqual(rankingPoints(r),rp);
  }
  assert.equal(state.short.status,'complete');assert.equal(state.season.status,'complete');
  assert.equal(r.money-initial,10200);assert.equal(r.relations.yu,100);
  assert.equal(state.awards.length,2);assert.equal(state.shortTotals.affinity,.5);
});

test('expired objectives let the final season retire on time and preserve the archive',()=>{
  const c=career(),r=c.rider!;
  r.year=8;r.week=51;r.season.year=8;r.season.division='master';
  r.settings={mode:'auto',strategy:'freestyle',entries:[]};
  r.events=Object.fromEntries([...EVENTS,...HAPPENINGS].map(event=>[event.id,1]));
  const state=ensureObjectives(r);
  const unreachable={target:{kind:'stat' as const,stat:'speed' as const,target:RULES.statCap},value:r.stats.speed};
  state.short!.steps=[structuredClone(unreachable)];state.season!.steps=[structuredClone(unreachable)];
  for(const week of [51,52]){
    assert.equal(r.week,week);
    r.plan=plan('rest');
    assert.ok(processWeek(c));
  }
  assert.equal(r.phase,'retired');assert.equal(c.hall[0].reason,'complete');
  const saved=JSON.parse(JSON.stringify(c.hall[0])) as typeof c.hall[number];
  assert.equal(saved.extras!.objectives!.short!.status,'expired');
  assert.equal(saved.extras!.objectives!.season!.status,'expired');
  assert.equal(saved.extras!.objectives!.awards.length,0);
});

test('every season week has a distinct calendar date and existing meets remain in their listed months',()=>{
  const dates=Array.from({length:RULES.weeks},(_,i)=>formatMonthWeek(i+1));
  assert.equal(new Set(dates).size,RULES.weeks);
  assert.deepEqual([dates[0],dates[3],dates[4],dates[12],dates[13],dates[51]],
    ['1월 첫째 주','1월 넷째 주','2월 첫째 주','3월 다섯째 주','4월 첫째 주','12월 다섯째 주']);
  assert.equal(formatCareerDate({year:5,week:50}),'5년차 · 12월 셋째 주');
  for(const meet of [...CALENDAR,...INTERNATIONAL_MEETS])assert.equal(monthWeek(meet.week).month,meet.month,meet.id);
});

test('affinity scenes run without a choice or a relationship transition, then observe the same-NPC cooldown',()=>{
  assert.equal(HAPPENINGS.length,32);
  assert.equal(new Set(HAPPENINGS.map(event=>event.id)).size,32);
  const c=career(),r=c.rider!;
  r.week=4;r.events.first=1;r.relations.yu=15;
  command(c,{type:'plan',plan:{action:'rest',spot:'river'}},identity);
  assert.equal(processWeek(c),true);
  assert.equal(r.extras?.lastEvent?.eventId,'happening-yu-1');
  assert.equal(r.extras?.lastEvent?.happening,true);
  assert.equal(r.phase,'plan');
  assert.equal(r.week,5);
  assert.equal(r.extras?.choices['happening-yu-1'],undefined);
  assert.equal(relationshipWith(r,'yu'),undefined);
  const [seen]=storyLog(JSON.parse(JSON.stringify(r)));
  assert.equal(seen.choice,undefined);
  assert.deepEqual(seen.npcs,['yu']);
  r.relations.yu=35;r.week=10;
  assert.equal(pickHappening(r),undefined);
  r.week=12;
  assert.equal(pickHappening(r)?.id,'happening-yu-2');
  assert.equal(rankingPoints(r).total,0);
});

test('the six stories have their full episode sets and consent changes whether an overlap can be exposed',()=>{
  assert.equal(STORY_ARCS.length+1,24); // 유리의 첫 장면은 기존 first
  assert.equal(CREW_STORIES.filter(event=>event.id.startsWith('cross-')).length,12);
  assert.ok([...STORY_ARCS,...CREW_STORIES].every(event=>event.choices.length===3));
  for(const branch of [0,1,2]){
    const c=career(),r=c.rider!;
    r.year=7;r.week=15;r.relations.yu=55;r.relations.noa=65;
    r.extras!.relationships={titles:[],npcs:{
      yu:{state:'partner',flags:['clear-boundary']},
      noa:{state:'interested',flags:['clear-boundary','overlap-requested'],pendingReward:{title:'noa-neon',item:'acc_noa_neon'}},
    }};
    const overlap=eventFor(r,'crew-overlap')!;
    assert.equal(overlap.when(r),true);
    r.phase='event';r.event=overlap.id;
    command(c,{type:'event',eventId:overlap.id,index:branch},identity);
    assert.equal(activePartners(r).length,branch===2?1:2);
    assert.equal(r.extras?.inventory.includes('acc_noa_neon'),branch!==2);
    r.week=20;
    const confrontation=eventFor(r,'cross-01')!;
    assert.equal(confrontation.when(r),branch===1);
    if(branch===1){
      r.phase='event';r.event=confrontation.id;
      r.settings={...r.settings,mode:'auto',skipEvents:true};
      assert.equal(eventPaused(r),true,'The reveal waits for a choice even when routine events are skipped');
      r.settings.mode='manual';
      command(c,{type:'event',eventId:confrontation.id,index:0},identity);
      assert.equal(activePartners(r).length,0);
      assert.deepEqual(formerPartners(r),['noa','yu']);
      assert.ok(r.extras?.inventory.includes('acc_crew_photo'));
    }
    assert.equal(rankingPoints(r).total,0);
  }
});

test('manual event preference pauses a regular auto choice and skip shortens only competition playback in background',()=>{
  const start=1_000_000, tab='options';
  const step=(prev:ReturnType<typeof blankSave>,action:Parameters<typeof advance>[1],elapsed:number)=>
    advance(prev,action,tab,start+elapsed,RULES.weekMs,identity);
  const seed=blankSave(),r=career().rider!;
  seed.career.rider=r;
  r.week=10;r.phase='event';r.event='park-tea';
  const held=step(seed,{type:'settings',settings:{...r.settings,mode:'auto',manualEvents:true,skipMeets:true}},0);
  assert.equal(held.career.rider?.event,'park-tea');
  assert.equal(step(held,{type:'pulse',background:'hidden'},15_000),held);
  const released=step(held,{type:'settings',settings:{...held.career.rider!.settings,skipEvents:true}},16_000);
  assert.equal(released.clock.pendingEvent?.eventId,'park-tea');
  assert.equal(released.career.rider?.settings.skipMeets,true);

  const meet=blankSave(),competitor=career().rider!;
  competitor.settings={mode:'auto',strategy:'balanced',entries:['dance'],skipMeets:true};
  competitor.week=8;
  const result=simulateMeet(competitor,CALENDAR[0],['dance']).results;
  competitor.records.push({year:1,id:CALENDAR[0].id,division:'rookie',results:result});
  meet.career.rider=competitor;
  meet.clock.pendingMeet=competitor.id+':1:'+CALENDAR[0].id;
  const skipped=step(meet,{type:'pulse',background:'hidden'},0);
  assert.equal(skipped.clock.background?.at,start+2000);
  const resumed=step(skipped,{type:'pulse',background:'hidden'},2000);
  assert.equal(resumed.clock.pendingMeet,undefined);
  assert.deepEqual(resumed.career.rider?.records[0].results,result);
});

test('relationship turning points and advanced workshops wait for the player despite event skip',()=>{
  for(const action of [{type:'pulse'},{type:'pulse',background:'hidden'}] as const){
    for(const eventId of ['relationship-yu-fork','relationship-yu-confession','relationship-yu-partner','career-first-season',workshopId('ha')]){
      const save=blankSave(),r=career().rider!;
      Object.assign(r,{year:6,week:11,phase:'event',event:eventId,energy:20});
      r.settings={mode:'auto',strategy:'dance',entries:['dance'],skipEvents:true};
      if(eventId.endsWith('-partner'))r.extras!.relationships={npcs:{yu:{state:'partner',flags:['confession-accepted']}},titles:[]};
      save.career.rider=r;
      assert.equal(advance(save,action,'tab',2000,RULES.weekMs,identity),save);
      assert.equal(r.events[eventId],undefined);
      if(eventId.endsWith('-partner')){
        const answered=advance(save,{type:'event',eventId,index:1},'tab',2100,RULES.weekMs,identity);
        assert.equal(relationshipWith(answered.career.rider!,'yu')?.state,'ended');
        assert.equal(answered.clock.pendingEvent?.eventId,eventId);
        assert.equal(answered.career.rider?.settings.mode,'auto');
        assert.throws(()=>advance(answered,{type:'event',eventId,index:1},'tab',2200,RULES.weekMs,identity),GameError);
      }
    }
  }
});

test('match presentation uses saved scores, ranks, prior meetings and the last difficult move',()=>{
  const r=career().rider!;
  r.relations.jun=57;
  const result=(score:number,opponent:number,place:number,opponentPlace:number):Result=>({
    discipline:'trick',run:{score,parts:{},log:[]},standings:[
      {id:'jun',name:'강준',score:opponent,place:opponentPlace},
      {id:'player',name:r.name,score,place},
      {id:'yu',name:'한유리',score:81,place:3},
    ],points:100,energy:50,prize:0,fame:0,
  });
  const earlier:MeetRecord={id:'regular-1',year:3,division:'regular',results:[result(87,88,2,1)]};
  const now=result(92.1,91.4,1,2);
  now.run.log=[
    {id:'hardflip',at:12,end:14,outcome:'great',combo:2,linked:true,points:19},
    {id:'hardflip',at:38,end:41,outcome:'miss',combo:0,linked:null,points:0},
    {id:'mango',at:42,end:44,outcome:'clean',combo:1,linked:null,points:10},
  ];
  const match:MeetRecord={...earlier,id:'major-1',results:[now]};
  const after:MeetRecord={...earlier,year:4,results:[result(99,90,1,2)]};
  r.records=[after,earlier,match];
  const snapshot=structuredClone(r);
  const story=matchPresentation(r,match,now,true)!;
  assert.equal(story.title,'역전 우승!');
  assert.equal(story.gap,.7);
  assert.equal(story.leader?.id,'jun');
  assert.equal(story.rematch?.id,'jun');
  assert.equal(story.personalBest,87);
  assert.equal(story.reaction?.name,'강준');
  assert.equal(closingSkill(now.run)?.outcome,'miss');
  assert.equal(matchPresentation(r,match,now,false)?.reaction,undefined);
  assert.equal(matchPresentation(r,match,result(91.4,92.1,2,1),true)?.title,'아쉬운 접전');
  assert.equal(matchPresentation(r,match,result(92.1,92.1,1,1),true)?.title,'공동 1위');
  assert.equal(matchPresentation(r,match,result(92.1,92.1,2,1),true)?.title,'2위로 마쳤다');
  assert.equal(matchPresentation(r,match,result(87,85,1,2),true)?.personalBest,undefined);
  assert.deepEqual(r,snapshot);
});

test('background auto mode shortens routine results and can watch just featured competitions',()=>{
  const save=blankSave(),r=career().rider!;
  const step=(prev:typeof save,elapsed:number)=>advance(prev,{type:'pulse',background:'hidden'},'feature',1_000_000+elapsed,RULES.weekMs,identity);
  r.settings={mode:'auto',strategy:'balanced',entries:['dance'],skipMeets:true,watchMajor:true};
  const international=INTERNATIONAL_MEETS[0];
  const record:MeetRecord={id:international.id,year:2,division:'rookie',results:simulateMeet(r,international,['dance']).results};
  save.career.rider=r;
  r.records.push(record);
  save.clock.pendingMeet=r.id+':2:'+record.id;
  const duration=AUTO_FLOW.entryMs+RULES.runSeconds*1000+AUTO_FLOW.exitMs+ceremonyDuration(record,true);
  const watched=step(save,0);
  assert.equal(featureMatch(record),'국제대회');
  assert.equal(featureMatch({id:'festival',division:'master'}),'마스터부 시즌 결승');
  assert.equal(watched.clock.background?.at,1_000_000+duration);
  assert.equal(step(watched,AUTO_FLOW.ceremonyMs),watched);
  assert.equal(step(watched,duration).clock.pendingMeet,undefined);
  const routine={grade:'success',text:'',year:1,week:1} as const;
  assert.ok(trainingResultDuration(routine)<AUTO_FLOW.resultMs);
  assert.equal(trainingResultDuration({...routine,special:'random'}),AUTO_FLOW.resultMs);
  assert.equal(eventResultDuration({key:'casual',eventId:'park-tea',title:'',kind:'',choice:'',details:[],year:1,week:1}),1000);
});

test('RP comes from competition, accumulates after a new season, and restores exact saved season totals without duplication',()=>{
  assert.deepEqual([1,2,3,4,5,6,7].map(place=>meetRP(place,false)),[100,75,60,45,35,10,10]);
  assert.deepEqual([1,2,3,4,5,6,7].map(place=>meetRP(place,true)),[150,113,90,68,53,15,15]);
  const c=career(),r=c.rider!;
  // A scouting event adds reputation and leaves the RP ledger empty.
  r.week=7;r.phase='event';r.event='registration';
  const oldFame=r.fame;
  command(c,{type:'event',index:1},identity);
  assert.ok(r.fame>oldFame);
  assert.equal(rankingPoints(r).total,0);

  r.week=52;r.phase='meet';
  command(c,{type:'entry',disciplines:['dance']},identity,true);
  const medal=r.records[0].results[0];
  const after=rankingPoints(r);
  assert.equal(r.year,2);
  assert.equal(after.total,medal.points);
  assert.equal(after.seasons.find(season=>season.year===2)?.total,0);
  const duplicate={...r,records:[...r.records,...structuredClone(r.records)]};
  assert.deepEqual(rankingPoints(duplicate),after);
  duplicate.records[1].results[0].points+=100;
  assert.deepEqual(rankingPoints(duplicate),after,'Conflicting duplicate records defer to the saved season total');
  assert.equal(rankingPoints({...duplicate,seasons:[]}).partial,true);
  assert.deepEqual(rankingPoints({...r,records:[]}),after,'A preserved season table recovers the exact RP');
  const missing=structuredClone(r);
  missing.records[0].results[0].points=Number.NaN;
  assert.deepEqual(rankingPoints(missing),after);
  missing.seasons=[];
  assert.equal(rankingPoints(missing).total,0);
  assert.equal(rankingPoints(missing).partial,true);
});

test('career divisions follow the four age groups and stats grow above 100 up to 200',()=>{
  assert.deepEqual(Array.from({length:9},(_,year)=>divisionFor(year)),['rookie','rookie','rookie','regular','regular','open','open','master','master']);
  assert.equal(RULES.statCap,200);
  assert.equal(statAfter(199.9,1000),200);
  assert.equal(statAfter(200,10),200);
  let successes=0;
  for(let seed=1;seed<=12;seed++){
    const c:Career={rider:newRider('uncapped-'+seed,seed,'Master',DEFAULT_LOOK),hall:[]},r=c.rider!;
    r.year=6;r.week=3;r.stats={speed:150,carve:200,link:180,balance:200};
    const preview=previewTraining(r,plan('speed')),before=r.stats.speed;
    assert.ok(preview.gains.speed!.min>0);
    command(c,{type:'plan',plan:plan('speed')},identity);processWeek(c);
    if(r.stats.speed>before){successes++;assert.ok(r.stats.speed-before<=preview.gains.speed!.max+.00001);}
    assert.ok(STATS.every(stat=>r.stats[stat]>=0&&r.stats[stat]<=200));
    assert.ok(r.energy<=100);assert.ok(Object.values(r.skills).every(skill=>skill.study<=100&&skill.mastery<=100));
  }
  assert.ok(successes>=10);
});

test('main map movement persists freely and exposes the actual spot growth bonus',()=>{
  let save=advance(blankSave(),{type:'create',name:'Map rider',look:DEFAULT_LOOK},'first',0,RULES.weekMs,identity);
  const before=structuredClone(save.career.rider!);
  save=advance(save,{type:'spot',spot:'plaza'},'first',0,RULES.weekMs,identity);
  const r=save.career.rider!;
  assert.equal(r.spot,'plaza');assert.equal(r.week,before.week);assert.equal(r.energy,before.energy);assert.equal(r.plan,null);
  const boosted=previewTraining(r,{action:'trick',spot:'plaza'}),neutral=previewTraining(r,{action:'trick',spot:'river'});
  assert.ok(boosted.gains.balance!.max>neutral.gains.balance!.max);
  assert.throws(()=>advance(save,{type:'spot',spot:'night'},'first',0,RULES.weekMs,identity),GameError);
  save=advance(JSON.parse(JSON.stringify(save)),{type:'plan',plan:{action:'trick',spot:'plaza'}},'first',0,RULES.weekMs,identity);
  assert.equal(save.career.rider!.plan!.spot,'plaza');
  assert.throws(()=>advance(save,{type:'spot',spot:'river'},'first',1,RULES.weekMs,identity),GameError);
});

test('every spot favors its regulars while all six rivals can visit',()=>{
  const r=career().rider!;
  for(const spot of SPOTS){
    const regularIds=new Set(spotRegulars(spot).map(npc=>npc.id));
    const visitors=new Set<string>();
    let regularWeeks=0;
    for(let year=1;year<=RULES.years;year++)for(let week=1;week<=RULES.weeks;week++){
      const rider={...r,year,week,spot};
      const visitor=spotVisitor(rider).id;
      assert.equal(spotVisitor({...rider}).id,visitor);
      visitors.add(visitor);
      if(regularIds.has(visitor))regularWeeks++;
    }
    assert.equal(visitors.size,RIVALS.length,spot);
    const regularShare=regularWeeks/(RULES.years*RULES.weeks);
    assert.ok(regularShare>=.7&&regularShare<=.9,`${spot}: ${regularShare}`);
  }
});

test('international graduation meets require all disciplines in manual and automatic play, including at zero energy',()=>{
  for(const year of [2,4,6,8]){
    const c=career(),r=c.rider!;r.year=year;r.week=52;r.phase='meet';r.energy=0;
    r.injury={severity:'major',weeks:2,treated:false};
    r.season={year,division:divisionFor(year),scores:{dance:{},trick:{},freestyle:{}}};
    assert.throws(()=>command(c,{type:'entry',disciplines:[]},identity),/3종목/);
    assert.throws(()=>command(c,{type:'entry',disciplines:['dance','trick']},identity),/3종목/);
    command(c,{type:'entry',disciplines:[...DISCIPLINES]},identity);
    const record=r.records.at(-1)!;
    assert.equal(record.id,'international-'+year);assert.equal(record.division,divisionFor(year));assert.deepEqual(record.results.map(result=>result.discipline),[...DISCIPLINES]);
    assert.equal(r.energy,0);assert.equal(r.phase,year===8?'retired':'plan');
    if(year===8){assert.equal(c.hall[0].records.at(-1)!.id,'international-8');assert.equal(c.hall[0].calendarVersion,2);}
  }
  const c=career(),r=c.rider!;r.year=2;r.week=52;r.phase='meet';
  command(c,{type:'settings',settings:{mode:'auto',strategy:'dance',entries:[]}},identity);
  assert.equal(r.records[0].results.length,3,'International entry overrides ordinary auto entry preferences');
});

test('ordinary competitions accept one discipline and legacy auto selections never create multiple entries',()=>{
  const c=career(),r=c.rider!;r.week=7;r.phase='meet';
  assert.throws(()=>command(c,{type:'entry',disciplines:['dance','trick']},identity),/1종목/);
  assert.throws(()=>command(c,{type:'settings',settings:{mode:'auto',strategy:'balanced',entries:['dance','trick']}},identity),/1종목/);
  assert.equal(r.records.length,0);command(c,{type:'entry',disciplines:['trick']},identity);
  assert.deepEqual(r.records[0].results.map(result=>result.discipline),['trick']);
  const old=career();old.rider!.week=7;old.rider!.settings={mode:'auto',strategy:'freestyle',entries:['trick','dance','freestyle']};
  processWeek(old);assert.deepEqual(old.rider!.records[0].results.map(result=>result.discipline),['trick']);
});

test('training previews and results use the requested primary, secondary and technique stats',()=>{
  const expected={speed:['speed','carve'],carve:['carve','balance'],link:['link','speed'],balance:['balance','carve'],dance:['speed','carve'],trick:['link','balance']} as const;
  for(const action of Object.keys(expected) as (keyof typeof expected)[]){
    let succeeded=false;
    for(let seed=1;seed<=5;seed++){
      const c:Career={rider:newRider('training-'+seed,seed,'Training',DEFAULT_LOOK),hall:[]},r=c.rider!;r.week=3;
      const before=structuredClone(r),p:Plan={action,spot:'river',...(['dance','trick'].includes(action)?{skill:action==='dance'?'peter-pan':'pivot'}:{})};
      const preview=previewTraining(r,p);if(preview.joint&&!preview.special)continue;
      assert.deepEqual(Object.keys(preview.gains).sort(),[...expected[action]].sort());
      command(c,{type:'plan',plan:p},identity);processWeek(c);if(r.extras!.lastTraining!.grade==='miss')continue;succeeded=true;
      for(const stat of STATS){const gain=r.stats[stat]-before.stats[stat],forecast=preview.gains[stat];if(forecast)assert.ok(gain>=forecast.min-.001&&gain<=forecast.max+.001);else assert.equal(gain,0);}
      if(p.skill)assert.ok(r.skills[p.skill].mastery>before.skills[p.skill].mastery);
      assert.ok(r.extras!.lastTraining!.narration);
      assert.equal(r.extras!.lastTraining!.changes!.some(change=>change.startsWith('체력')),preview.energy<0);
    }
    assert.ok(succeeded);
  }
  const c=career();c.rider!.year=4;c.rider!.spot='arena';assert.throws(()=>command(c,{type:'plan',plan:{action:'rehearsal',spot:'arena'}},identity),/종료/);
});

function jointFixture(npc:TrainingNpc,spot:Spot,focus=false){
  for(let seed=1;seed<=500;seed++){
    const r=newRider(`joint-${npc}-${seed}`,seed,'Joint training',DEFAULT_LOOK);
    Object.assign(r,{spot,week:2,trainingOffer:null});
    if(focus){r.relations[npc]=35;r.extras!.jointSessions={[npc]:3};}
    const offer=jointTrainingOffer(r,spot);
    if(offer?.npc===npc&&offer.focus===focus)return {r,offer};
  }
  throw new Error(`Missing joint training fixture for ${npc}`);
}

test('joint offers follow the weekly visitor, survive reloads and use each NPC specialty',()=>{
  for(const [npc,spot,actions] of [['yu','river',['dance']],['jun','plaza',['trick']],['sol','park',['link']],['min','park',['balance']],['ha','river',['speed','carve']],['noa','night',['trick']]] as const){
    const {r,offer}=jointFixture(npc,spot);
    const p:Plan={action:offer.action,spot};
    assert.ok(actions.some(action=>action===offer.action));
    assert.equal(spotVisitor(r,spot).id,npc);
    assert.deepEqual(jointTrainingOffer({...structuredClone(r),seed:0},spot),offer);
    assert.deepEqual([0,20,40,60,80,100].map(points=>jointTrainingOffer({...r,relations:{...r.relations,[npc]:points}},spot)?.growth),[1.05,1.10,1.15,1.20,1.25,1.25]);
    const preview=previewTraining(r,p);
    if(npc==='yu')assert.ok(preview.gains.link!.min>0);
    if(npc==='jun')assert.ok(jointDiscovery(offer)>0&&jointMasteryFactor(offer,SKILL.pivot!)>1);
    if(npc==='sol')assert.equal(preview.energy,-(RULES.energy.link-gearBonuses(r).cost-3));
    if(npc==='min')assert.ok(jointInjuryFactor(offer)<1);
    if(npc==='ha')assert.ok(preview.gains.speed!.min>0&&preview.gains.carve!.min>0);
    if(npc==='noa'){
      assert.equal(jointMasteryFactor(offer,SKILL.pivot!),1);
      assert.ok(jointMasteryFactor(offer,SKILL.hardflip!)>1);
    }
  }
});

test('focus requires joint experience, works without romance, and yields to fixed special training bonuses',()=>{
  const {r,offer}=jointFixture('sol','park',true);
  const p:Plan={action:offer.action,spot:r.spot};
  assert.equal(relationshipWith(r,'sol'),undefined);
  assert.equal(offer.growth,1.35);
  assert.equal(jointTrainingOffer({...r,extras:{...r.extras!,jointSessions:{sol:2}}},r.spot)?.focus,false);
  assert.equal(jointTrainingOffer({...r,relations:{...r.relations,sol:34}},r.spot)?.focus,false);
  assert.equal(previewTraining(r,p).energy,-(RULES.energy.link-gearBonuses(r).cost-5));
  r.trainingOffer=offer.action;
  const {joint,...combined}=previewTraining(r,p);
  const previous={...r,extras:{...r.extras!,lastTraining:{grade:'success' as const,year:1,week:1,text:'',joint:{npc:'sol' as const,focus:false,affinity:2}}}};
  assert.equal(jointTrainingOffer(previous,r.spot),undefined);
  const {joint:solo,...special}=previewTraining(previous,p);
  assert.ok(joint?.focus&&!solo);
  assert.deepEqual(combined,special);
  assert.equal(combined.success,1);
  assert.equal(combined.energy,0);
});

test('joint affinity is saved once through the weekly timer, and an automatic plan can prefer focus',()=>{
  const {r,offer}=jointFixture('yu','river');
  const p:Plan={action:offer.action,spot:r.spot};
  r.trainingOffer=offer.action;
  const save=blankSave();save.career.rider=r;
  const planned=advance(save,{type:'plan',plan:p},'tab',100,2000,identity);
  const finished=advance(JSON.parse(JSON.stringify(planned)),{type:'pulse'},'tab',2100,2000,identity);
  const result=finished.career.rider!.extras!;
  assert.equal(result.lastTraining!.special,'random');
  assert.deepEqual(result.lastTraining!.joint,{npc:'yu',focus:false,affinity:2});
  assert.equal(result.jointSessions!.yu,1);
  assert.ok(result.lastTraining!.changes!.includes('한유리 친밀도 +2'));
  assert.equal(advance(finished,{type:'pulse'},'tab',2200,2000,identity),finished);

  let chosen=false;
  for(let seed=1;seed<=150&&!chosen;seed++){
    const rider=newRider('auto-joint-'+seed,seed,'Automatic training',DEFAULT_LOOK);
    rider.trainingOffer=null;rider.week=2;
    rider.settings.mode='auto';
    const soloRider=structuredClone(rider);prepareWeek(soloRider);
    for(const npc of RIVALS){rider.relations[npc.id]=80;}
    rider.extras!.jointSessions={yu:3,jun:3,sol:3,min:3,ha:3,noa:3};
    prepareWeek(rider);
    const forecast=previewTraining(rider,rider.plan!);
    if(rider.plan?.action===soloRider.plan?.action||!forecast.joint?.focus)continue;
    const c:Career={rider,hall:[]};processWeek(c);
    assert.equal(rider.extras!.lastTraining!.joint?.focus,true);
    chosen=true;
  }
  assert.ok(chosen);
});

test('direct training spends energy, pauses for an event and awards progress only once',()=>{
  const c=career(),r=c.rider!;
  assert.equal(processWeek(c),false);
  command(c,{type:'plan',plan:plan('speed')},identity);
  assert.ok(processWeek(c));
  assert.equal(r.phase,'event');
  assert.ok(r.stats.speed>RULES.startStats.speed);
  assert.ok(r.energy<100);
  assert.equal(processWeek(c),false);
  command(c,{type:'event',index:0},identity);
  assert.equal(r.skills.mango.study,42);
  assert.equal(r.relations.yu,8);
  assert.equal(r.week,2);
  assert.throws(()=>command(c,{type:'event',index:0},identity),GameError);
  for(let i=0;i<3;i++){
    command(c,{type:'plan',plan:{...plan('dance'),spot:'studio',skill:'mango'}},identity);
    processWeek(c);
    if(r.phase==='event') command(c,{type:'event',index:0},identity);
  }
  assert.ok(learned(r.skills,'mango'));
  assert.ok(r.skills.mango.mastery>0);
});

test('severe injury restricts training and remains treatable even with no money',()=>{
  const c=career(),r=c.rider!;
  r.injury={severity:'major',weeks:1,treated:false};r.energy=21;r.money=0;r.week=3;
  assert.throws(()=>command(c,{type:'plan',plan:plan('speed')},identity),GameError);
  enterAuto(c);
  assert.ok(processWeek(c));
  assert.equal(r.injury,null);
  assert.equal(r.lastPlan?.action,'hospital');
  assert.ok(r.money>=RULES.safetyFund);
  assert.ok(r.energy>21);
});

test('three disciplines have reproducible bounded runs, and repeats, failed landings matter without stamina penalties',()=>{
  const r=career().rider!;
  assert.equal(SKILLS.filter(s=>s.family==='dance').length,18);
  assert.equal(SKILLS.filter(s=>s.family==='trick').length,14);
  for(const d of DISCIPLINES){
    const ids=generateRoutine(r,d,'flow');
    assert.ok(validRoutine(r,d,ids));
    assert.ok(routineTime(ids)<=60);
    const run=simulateRun(r,d,ids,seeded(52,d));
    assert.deepEqual(run,simulateRun(r,d,ids,seeded(52,d)));
    assert.ok(run.score>=0&&run.score<=100);
    assert.ok(run.log.every((l,i)=>l.end<=60&&(i===0||l.at>=run.log[i-1].end+RULES.transition+(run.log[i-1].outcome==='miss'?RULES.recovery:0))));
  }
  const mixed=generateRoutine(r,'freestyle','score');
  const repeat=Array<string>(10).fill('peter-pan');
  assert.ok(simulateRun(r,'freestyle',mixed,()=>.02).score>simulateRun(r,'freestyle',repeat,()=>.02).score);
  assert.equal(simulateRun(r,'freestyle',mixed,()=>.99).score<15,true);
  assert.throws(()=>simulateRun(r,'dance',['shuvit'],()=>0));
  assert.throws(()=>simulateRun(r,'dance',Array<string>(16).fill('peter-pan'),()=>0));
  assert.deepEqual(simulateRun(r,'freestyle',mixed,()=>.72),simulateRun({...r,energy:0},'freestyle',mixed,()=>.72));
});

test('the documented tech tree is reachable and requires every prerequisite to be mastered',()=>{
  const r=career().rider!;
  assert.deepEqual(Object.keys(START_SKILLS),['peter-pan','cross','step-180','pivot','no-comply']);
  assert.equal(SKILL.pirouette?.name,'피루엣');
  assert.equal(SKILL.sidewinder?.difficulty,1);
  for(const [id,requires] of Object.entries({
    pendulum:['wood'],'mango-pendulum':['pendulum','mango'],
    sidewinder:[],'v-spin':['peter-pan','sidewinder','step-360'],'ghostride-kickflip':['ghost'],
    pirouette:['piglet'],'pirouette-540':['pirouette'],'pirouette-720':['pirouette-540'],p2p:['pirouette'],
    'no-com-big':['no-comply','shuvit'],bigspin:['shuvit'],bigger:['bigspin'],
    kickflip:['ollie'],heelflip:['ollie'],ollie:[],'pop-shuvit':[],'front-pop':['pop-shuvit'],
    varial:['kickflip'],hardflip:['heelflip'],treflip:['kickflip','bigspin'],
  }))assert.deepEqual(SKILL[id]?.requires,requires,id);
  assert.deepEqual(SKILLS.filter(s=>s.trickSide==='nose').map(s=>s.id),['pivot','shuvit','no-com-big','bigspin','bigger']);
  assert.equal(SKILLS.filter(s=>s.trickSide==='tail').length,9);
  const reached=new Set<string>();
  for(const skill of SKILLS){
    assert.equal(new Set(skill.requires).size,skill.requires.length,skill.id);
    assert.ok(skill.requires.every(id=>reached.has(id)),`Invalid, cyclic, or out-of-order prerequisite for ${skill.id}`);
    reached.add(skill.id);
  }
  assert.equal(reached.size,32);
  assert.ok(canStudy(r,'sidewinder'));
  assert.equal(nextSkillTraining(r,'trick')?.id,'ollie');
  assert.ok(canStudy(r,'pop-shuvit'));
  assert.equal(canStudy(r,'kickflip'),false);
  r.skills.ollie={study:100,mastery:99.9};
  assert.equal(canStudy(r,'kickflip'),false);
  r.skills.ollie.mastery=100;
  assert.ok(canStudy(r,'kickflip'));
  assert.ok(canStudy(r,'heelflip'));
  assert.equal(canStudy(r,'shuvit'),false);
  r.skills.pivot.mastery=100;
  assert.ok(canStudy(r,'shuvit'));
  r.skills.kickflip={study:100,mastery:100};
  assert.ok(canStudy(r,'varial'));
  assert.equal(canStudy(r,'front-pop'),false);
  r.skills['pop-shuvit']={study:100,mastery:99.9};
  assert.equal(canStudy(r,'front-pop'),false);
  r.skills['pop-shuvit'].mastery=100;
  assert.ok(canStudy(r,'front-pop'));
  assert.equal(canStudy(r,'no-com-big'),false);
  r.skills.shuvit={study:100,mastery:100};
  assert.ok(canStudy(r,'bigspin'));
  assert.equal(canStudy(r,'no-com-big'),false);
  r.skills['no-comply'].mastery=100;
  assert.ok(canStudy(r,'no-com-big'));
  assert.equal(canStudy(r,'treflip'),false);
  r.skills.bigspin={study:100,mastery:100};
  assert.ok(canStudy(r,'treflip'));
});

test('ghostride kickflip unlocks via self-training and auto tracks its single prerequisite',()=>{
  const c=career(),r=c.rider!,id='ghostride-kickflip';
  const p={action:'dance',skill:id,spot:'river'} as const;
  assert.throws(()=>command(c,{type:'plan',plan:p},identity),GameError);
  for(const mastered of ['sidewinder','step-360','back-cross'])r.skills[mastered]={study:100,mastery:100};
  r.skills.ghost={study:100,mastery:99.9};
  assert.equal(nextSkillTraining(r,'dance')?.id,'ghost');
  assert.equal(canStudy(r,id),false);
  r.skills.ghost.mastery=100;
  assert.equal(nextSkillTraining(r,'dance')?.id,id);
  r.skills[id]={study:97,mastery:0};r.energy=100;
  command(c,{type:'plan',plan:p},identity);
  assert.ok(processWeek(c));
  assert.ok(learned(r.skills,id));
  assert.equal(r.skills.kickflip,undefined);
  assert.ok(validRoutine(r,'dance',[id]));
  assert.ok(validRoutine(r,'freestyle',[id]));
  assert.equal(validRoutine(r,'trick',[id]),false);
});

test('technique practice previews match actual gains and harder moves build mastery more slowly',()=>{
  let previousStudy=Infinity,previousMastery=Infinity;
  for(const id of ['sidewinder','pirouette','p2p','pirouette-720']){
    const c=career(),r=c.rider!;
    const p={action:'dance',skill:id,spot:'river'} as const;
    r.energy=100;
    r.trainingOffer=null;
    const study=previewTraining(r,p).skill!;
    assert.ok(study.max<previousStudy,id);
    previousStudy=study.max;
    r.skills[id]={study:100,mastery:30};
    r.trainingOffer='dance';
    const mastery=previewTraining(r,p).skill!;
    assert.ok(mastery.max<previousMastery,id);
    assert.equal(mastery.min,mastery.max);
    previousMastery=mastery.max;
    command(c,{type:'plan',plan:p},identity);
    assert.ok(processWeek(c));
    assert.equal(Number((r.skills[id].mastery-30).toFixed(1)),mastery.max,id);
  }
});

test('run replays retain recorded skill difficulty and only admit skills available in those rules',()=>{
  const r=career().rider!;
  r.skills.sidewinder={study:100,mastery:35};
  const landing=.74;
  assert.equal(simulateRun(r,'dance',['sidewinder'],()=>landing,4).log[0].outcome,'miss');
  assert.equal(simulateRun(r,'dance',['sidewinder'],()=>landing,6).log[0].outcome,'rough');
  for(const id of ['p2p','ollie']){
    r.skills[id]={study:100,mastery:35};
    assert.throws(()=>simulateRun(r,'freestyle',[id],()=>0,4));
    assert.equal(simulateRun(r,'freestyle',[id],()=>0).log[0].outcome,'great');
  }
  for(const id of ['bigspin','bigger']){
    r.skills[id]={study:100,mastery:70};
    const roll=id==='bigspin'?.72:.62;
    assert.equal(simulateRun(r,'trick',[id],()=>roll,5).log[0].outcome,'rough');
    assert.equal(simulateRun(r,'trick',[id],()=>roll,6).log[0].outcome,'miss');
  }
  r.skills['ghostride-kickflip']={study:100,mastery:40};
  assert.throws(()=>simulateRun(r,'dance',['ghostride-kickflip'],()=>0,5));
  assert.equal(simulateRun(r,'dance',['ghostride-kickflip'],()=>0).log[0].end,6);
});

test('NPC instruction grants a skill once, and it stays available in lessons, auto training and lines',()=>{
  const c=career(),r=c.rider!;
  r.week=3;r.phase='event';r.event='juns-clip';r.spot='plaza';
  assert.equal(canStudy(r,'front-pop'),false);
  command(c,{type:'event',index:0},identity);
  const progress=r.skills['front-pop'];
  assert.equal(progress.study,100);
  assert.equal(r.skills['pop-shuvit'],undefined);
  assert.equal(canStudy(r,'front-pop'),true);
  assert.equal(canStudy(r,'heelflip'),false);
  assert.ok(validRoutine(r,'trick',['front-pop']));
  r.phase='event';r.event='juns-clip';
  const before={...progress};
  command(c,{type:'event',index:0},identity);
  assert.deepEqual(r.skills['front-pop'],before);
  r.energy=100;
  command(c,{type:'plan',plan:{action:'trick',spot:'studio',skill:'front-pop',lesson:true}},identity);
  assert.ok(processWeek(c));
  assert.ok(progress.mastery>before.mastery);
  const focus=career().rider!;
  focus.skills['front-pop']={study:100,mastery:99};
  focus.skills.kickflip={study:100,mastery:100};
  assert.equal(nextSkillTraining(focus,'trick')?.id,'front-pop');
});

test('run scoring keeps speed and carve useful at 200 and awards a bounded landing assist on successful links',()=>{
  const r=career().rider!;
  const ids=['peter-pan','cross','step-180','peter-pan','cross','step-180','peter-pan','cross','step-180','peter-pan'];
  const lower={...r,stats:{...r.stats,speed:110,carve:110}},upper={...r,stats:{...r.stats,speed:200,carve:200}};
  const base=simulateRun(lower,'dance',ids,()=>0);
  const improved=simulateRun(upper,'dance',ids,()=>0);
  assert.ok(improved.parts.speed!>base.parts.speed!&&improved.parts.carve!>base.parts.carve!);
  assert.ok(Math.abs(improved.score-(improved.parts.execution!*.4+improved.parts.link!*.25+improved.parts.carve!*.2+improved.parts.speed!*.15))<.1);
  assert.equal(simulateRun(lower,'dance',ids,()=>0,3).score,simulateRun(upper,'dance',ids,()=>0,3).score);
  r.stats={...r.stats,link:200,balance:20};
  r.skills.hardflip={study:100,mastery:10};
  const landing=chance(r,SKILL.hardflip!)-RULES.run.trickChainSuccess;
  const run=(values:number[])=>simulateRun(r,'trick',['pivot','hardflip'],()=>values.shift()!);
  assert.equal(run([0,landing+.05,0]).log[1].linked,true);
  assert.equal(run([0,landing+.05,.99]).log[1].outcome,'miss');
  assert.equal(run([0,landing+.08,0]).log[1].linked,false);
  assert.equal(run([.99,landing+.05]).log[1].linked,null);
});

test('difficulty and mastery affect landing and execution throughout the scale; diverse lines outscore repeats',()=>{
  const r=career().rider!;
  for(const skill of SKILLS)r.skills[skill.id]={study:100,mastery:100};
  r.stats={speed:200,carve:200,link:200,balance:200};
  const hardest=SKILL.bigger!;
  assert.ok(chance(r,hardest)>.8&&chance(r,hardest)<chance(r,SKILL.ollie!));
  const practiced={...r,skills:{...r.skills,bigger:{study:100,mastery:55}}};
  assert.ok(chance(r,hardest)>chance(practiced,hardest)+.15);
  assert.ok(simulateRun(r,'trick',['bigger'],()=>0).parts.execution!>simulateRun(practiced,'trick',['bigger'],()=>0).parts.execution!);
  const repeats=simulateRun(r,'trick',Array<string>(8).fill('bigger'),()=>0);
  assert.deepEqual(repeats.log.slice(0,5).map(frame=>frame.attempt),[1,2,3,4,5]);
  assert.deepEqual(repeats.log.slice(0,5).map(frame=>Math.round(100*frame.points/repeats.log[0].points)),[100,71,42,19,19]);
  const routine=generateRoutine(r,'trick','flow');
  assert.ok(routineTime(routine)<=60&&new Set(routine).size>=7);
  assert.ok(simulateRun(r,'trick',routine,()=>0).score>repeats.score);
  const perfect=['pop-shuvit','no-com-big','bigger','no-comply','heelflip','varial','kickflip','front-pop','shuvit','ollie'];
  assert.equal(simulateRun(r,'trick',perfect,()=>0).score,100);
  assert.ok(simulateRun(r,'trick',perfect,()=>.92).score<100);
});

test('placements use precise scores and performance, then share ranks and RP for identical runs',()=>{
  const base={score:89.7,parts:{},log:[],judging:{score:89.7,execution:91,difficulty:14,variety:8,flow:87}};
  const rows=[
    {id:'a',name:'제',run:{...base,judging:{...base.judging,execution:90}}},
    {id:'z',name:'가',run:base},
    {id:'x',name:'나',run:base},
    {id:'b',name:'라',run:{...base,judging:{...base.judging,score:89.71,execution:89}}},
  ];
  const standings=competitionStandings(rows);
  assert.deepEqual(standings.map(row=>[row.id,row.place]),[['b',1],['z',2],['x',2],['a',4]]);
  assert.deepEqual(standings,competitionStandings([...rows].reverse()));
  assert.equal(meetRP(standings[1].place,true),meetRP(standings[2].place,true));
  assert.equal(seasonPlace({jun:400,player:400,noa:320},'player'),1);
  assert.equal(seasonPlace({jun:400,player:400,noa:320},'noa'),3);
});

test('podium growth uses the actual clamped increase and awards the best international finish once',()=>{
  const r=career().rider!;
  const make=(places:number[])=>simulateMeet(r,CALENDAR[0],[...DISCIPLINES]).results.map((result,i)=>({
    ...result,standings:[{id:'player',name:r.name,place:places[i],score:0}],
  })).reverse();
  for(const [places,winner,gains] of [
    [[1,3,3],'dance',{carve:1,speed:.5}],
    [[2,2,2],'dance',{carve:.7,speed:.3}],
    [[5,3,3],'trick',{balance:.4,link:.2}],
    [[2,3,1],'freestyle',{link:1,carve:.5}],
    [[4,5,6],undefined,undefined],
  ] as const){
    const results=make([...places]);
    const before={...r.stats};
    awardPodiumGrowth(r,results,true);
    assert.deepEqual(results.filter(result=>result.statGains).map(result=>[result.discipline,result.statGains]),winner?[[winner,gains]]:[]);
    for(const stat of STATS)assert.equal(r.stats[stat],before[stat]+((gains as Partial<typeof r.stats>|undefined)?.[stat]??0));
  }
  r.stats.carve=199.9;r.stats.speed=200;
  const [dance]=make([1,4,4]).filter(result=>result.discipline==='dance');
  awardPodiumGrowth(r,[dance],false);
  assert.equal(r.stats.carve,statAfter(199.9,1));
  assert.equal(r.stats.speed,200);
  assert.equal(dance.statGains,undefined);
});

test('an official international meet resolves every run before changing stats and cannot pay twice',()=>{
  const c=career(),r=c.rider!;
  r.year=2;r.week=52;r.phase='meet';
  r.season={year:2,division:'rookie',scores:{dance:{},trick:{},freestyle:{}}};
  r.stats={speed:145,carve:147,link:148,balance:146};
  for(const skill of SKILLS)r.skills[skill.id]={study:100,mastery:100};
  const before={...r.stats};
  command(c,{type:'entry',disciplines:[...DISCIPLINES]},identity,true);
  const [meet]=r.records;
  assert.equal(meet.results.length,3);
  assert.equal(meet.results.filter(result=>result.statGains).length,1);
  assert.ok(meet.results.every(result=>result.proof&&result.points>0&&result.prize>0&&result.fame>0));
  for(const result of meet.results)assert.deepEqual(result.proof?.stats,before);
  const after={...r.stats};
  assert.throws(()=>command(c,{type:'entry',disciplines:[...DISCIPLINES]},identity,true),GameError);
  assert.deepEqual(r.stats,after);
});

test('eight consecutive seasons yield 48 distinct meets, promotion, resets, and one immutable archive',()=>{
  const c=career(),r=c.rider!;
  enterAuto(c);
  for(let i=0;i<52*8;i++){
    assert.equal(processWeek(c),true);
    if(r.phase==='event'&&r.event)command(c,{type:'event',eventId:r.event,index:0},identity);
    if(i===51){
      assert.equal(r.year,2);assert.equal(r.week,1);assert.equal(r.season.division,'rookie');
      assert.deepEqual(r.records.map(m=>m.id),CALENDAR.map(m=>m.id));
      assert.deepEqual(r.season.scores.dance,{});
      assert.ok(r.seasons[0].scores.freestyle.player>0);
    }
    if(i===52*4-1)assert.equal(r.season.division,'open');
    if(i===52*6-1)assert.equal(r.season.division,'master');
  }
  assert.equal(r.phase,'retired');
  assert.equal(c.hall.length,1);
  assert.equal(c.hall[0].reason,'complete');
  assert.equal(r.year,8);assert.equal(r.week,52);
  assert.equal(r.records.at(-1)!.division,'master');
  assert.equal(r.records.at(-1)!.id,'international-8');
  assert.deepEqual(r.seasons.map(season=>season.division),['rookie','rookie','regular','regular','open','open','master','master']);
  assert.equal(c.hall[0].seasons.length,8);
  assert.equal(c.hall[0].records.length,48);
  assert.equal(new Set(r.records.map(m=>m.year+'-'+m.id)).size,48);
  assert.deepEqual(r.records.filter(m=>m.id.startsWith('international-')).map(m=>m.year),[2,4,6,8]);
  assert.ok(r.records.filter(m=>m.id.startsWith('international-')).every(m=>m.results.length===3));
  assert.equal(new Set(INTERNATIONAL_MEETS.map(m=>m.host)).size,4);
  for(let year=1;year<=8;year++)assert.deepEqual(r.records.filter(m=>m.year===year).map(m=>m.id),calendarFor(year).map(m=>m.id));
  assert.ok(r.records.some(m=>m.results.length===3&&m.results[2].energy<m.results[0].energy));
  assert.ok(r.money>RULES.startMoney);
  assert.equal(processWeek(c),false);
  assert.throws(()=>command(c,{type:'retire'},identity),GameError);
  command(c,{type:'create',name:'새 라이더',look:DEFAULT_LOOK},()=>({id:'new-rider',seed:71}));
  assert.equal(c.hall[0].name,'리버');
  command(c,{type:'retire'},identity);
  assert.equal(c.hall[1].reason,'early');
});

test('equipment, lesson fees, and locked spots are enforced by the career command',()=>{
  const c=career(),r=c.rider!;r.money=1_000_000;
  assert.throws(()=>command(c,{type:'plan',plan:{...plan('trick'),spot:'night'}},identity),GameError);
  assert.throws(()=>command(c,{type:'plan',plan:{...plan('rehearsal'),spot:'arena'}},identity),GameError);
  const initial=chance(r,SKILL.pivot!);
  command(c,{type:'trade',item:'deck-pop',operation:'buy'},identity);
  assert.throws(()=>command(c,{type:'trade',item:'deck-pop',operation:'buy'},identity),GameError);
  command(c,{type:'trade',item:'deck-pop',operation:'equip'},identity);
  assert.ok(chance(r,SKILL.pivot!)>initial);
  assert.equal(equippedLook(r).deckDesign,2);
  command(c,{type:'trade',item:'deck-pop',operation:'sell'},identity);
  assert.equal(extras(r).equipped.deck,undefined);
  assert.equal(chance(r,SKILL.pivot!),initial);
  command(c,{type:'makeover',look:{...r.look,shoes:3,deckDesign:1}},identity);
  assert.equal(equippedLook(r).shoes,3);
  assert.equal(equippedLook(r).deckDesign,1);
  const before=r.money;
  command(c,{type:'plan',plan:{action:'dance',spot:'studio',skill:'mango',lesson:true}},identity);
  assert.equal(r.money,before);
  processWeek(c);
  assert.equal(r.money,before-ECONOMY.lesson+RULES.weeklyAllowance);
  assert.ok(r.skills.mango.study>0);
});

test('specific story choices pause auto mode and unlock follow-up dialogue',()=>{
  const c=career(),r=c.rider!;
  r.week=11;
  r.events.first=1;r.events.registration=1;
  r.relations.yu=8;
  r.settings={mode:'auto',strategy:'dance',entries:[],skipEvents:false};
  assert.ok(processWeek(c));
  assert.equal(r.event,'mango-lesson');
  assert.equal(r.phase,'event');
  assert.equal(processWeek(c),false);
  command(c,{type:'settings',settings:{...r.settings,strategy:'freestyle'}},identity);
  assert.equal(r.event,'mango-lesson');
  command(c,{type:'event',index:0},identity);
  assert.equal(extras(r).choices['mango-lesson'].index,0);
  assert.ok(learned(r.skills,'mango'));
  assert.equal(r.week,12);
  assert.throws(()=>command(c,{type:'event',index:0},identity),GameError);
  r.spot='river';r.week=17;
  assert.equal(pickEvent(r,()=>.99)?.id,'yu-film');
});

test('the first meeting keeps its existing cast and all six personal stories and happenings are accessible',()=>{
  const openings=['relationship-yu-trust','relationship-jun-trust','story-noa-1','story-min-1','story-ha-1','story-sol-1'];
  for(const [gender,happening] of [['male','happening-sol-2'],['female','happening-yu-2']] as const){
    const r=newRider('rider-'+gender,5411,'리버',{...DEFAULT_LOOK,gender});
    const firstEvent=pickEvent(r,()=>.99);
    assert.ok(firstEvent&&!('happening' in firstEvent));
    assert.deepEqual(eventCast(r,firstEvent),[gender==='male'?'yu':'sol']);
    r.year=4;r.week=10;
    r.events=Object.fromEntries(EVENTS.filter(event=>!openings.includes(event.id)).map(event=>[event.id,1]));
    const participants=[];
    for(let i=0;i<6;i++){
      const event=pickEvent(r,()=>.99);
      assert.ok(event&&!('happening' in event));
      participants.push(...eventCast(r,event));
      r.events[event.id]=1;
    }
    assert.deepEqual(participants.sort(),[...STORY_NPCS].sort());
    assert.equal(pickEvent(r,()=>.99),undefined);
    for(const scene of HAPPENINGS)if(scene.id!==happening)r.events[scene.id]=1;
    r.relations.yu=35;r.relations.sol=35;
    assert.equal(pickHappening(r)?.id,happening);
  }
});

test('old personal choices restore romance interest for all six NPCs, but affinity alone cannot',()=>{
  for(const [npc,part,choice,flags] of [
    ['min',4,0,['agreed-boundaries','accountability']],['sol',4,0,['asked-honestly','checked-facts']],
    ['jun',2,0,['asked-about-crush']],['ha',4,0,['respect','reassured']],
    ['noa',4,0,['clear-boundary','supported']],['yu',4,1,['duet']],
  ] as const){
    const c=career(),r=c.rider!;
    r.look.gender=RIVALS.find(rival=>rival.id===npc)!.look.gender;
    r.year=8;r.week=22;r.relations[npc]=100;
    const eventId=`story-${npc}-${part}`;
    r.events=Object.fromEntries(EVENTS.filter(e=>e.id!==eventId).map(e=>[e.id,1]));
    r.extras!.choices[`story-${npc}-${part-1}`]={year:7,week:36,index:0};
    assert.equal(hasRomanticInterest(r,npc),false);
    assert.equal(eventFor(r,eventId)!.choices[choice].story!(r).changes?.[0].state,'friend');
    r.extras!.relationships={titles:[],npcs:{[npc]:{state:'undecided',flags:[...flags]}}};
    c.rider=JSON.parse(JSON.stringify(r));
    const restored=c.rider!;
    assert.equal(hasRomanticInterest(restored,npc),true);
    assert.deepEqual(activePartners(restored),[]);
    assert.equal(pickEvent(restored,()=>.99)?.id,eventId);
    restored.phase='event';restored.event=eventId;
    restored.settings={...restored.settings,mode:'auto',skipEvents:true};
    assert.ok(eventPaused(restored),'A possible mutual relationship requires an answer from the player');
    restored.settings.mode='manual';
    restored.relations[npc]=0;
    command(c,{type:'event',eventId,index:choice},identity);
    assert.deepEqual(activePartners(restored),[npc]);
    assert.equal(rankingPoints(restored).total,0);
  }
});

test('a prior rejection or breakup survives a later positive scene without re-opening the relationship',()=>{
  const c=career(),r=c.rider!,eventId='story-jun-4';
  r.year=7;r.week=15;r.relations.jun=100;
  r.extras!.relationships={titles:[],npcs:{jun:{state:'ended',flags:['former-partner','honest-retry','kept-clip'],mode:'private'}}};
  const scene=eventFor(r,eventId)!;
  assert.equal(hasRomanticInterest(r,'jun'),false);
  assert.equal(scene.choices[0].story!(r).changes,undefined);
  r.phase='event';r.event=eventId;
  command(c,{type:'event',eventId,index:1},identity);
  assert.equal(relationshipWith(r,'jun')?.state,'ended');
  assert.deepEqual(formerPartners(r),['jun']);
  assert.equal(relationshipEpilogues(r)[0].state,'ended');
  const refusal=career().rider!;
  refusal.extras!.relationships={titles:[],npcs:{jun:{state:'rival',flags:['rejected','kept-clip','honest-retry']}}};
  assert.equal(scene.choices[0].story!(refusal).changes?.[0].state,'rival');
});

test('every workshop offers one technique and one title through a voluntary choice in a non-romantic route',()=>{
  for(const npc of STORY_NPCS){
    const c=career(),r=c.rider!,data=NPC_WORKSHOPS[npc],id=workshopId(npc),title=workshopTitle(npc),event=eventFor(r,id)!;
    r.look.gender=RIVALS.find(rival=>rival.id===npc)!.look.gender;
    r.year=4;r.week=3;
    r.relations[npc]=data.affinity;
    r.extras!.relationships={titles:[],npcs:{[npc]:{state:'rival',flags:[]}}};
    assert.equal(event.when(r),false,'Affinity alone cannot award a workshop');
    r.events=Object.fromEntries(EVENTS.filter(e=>e.id!==id).map(e=>[e.id,1]));
    assert.equal(pickEvent(r,()=>.99)?.id,id);
    assert.ok(!canStudy(r,data.skill));
    const skills=structuredClone(r.skills);
    const decline=structuredClone(c),d=decline.rider!;
    d.phase='event';d.event=id;
    d.settings={...d.settings,mode:'auto',skipEvents:true};
    assert.equal(eventPaused(d),true,'The player chooses even while the season runs on auto');
    command(decline,{type:'event',eventId:id,index:1},identity);
    assert.deepEqual(d.skills,skills);
    assert.deepEqual(d.extras!.relationships!.titles,[]);
    const previouslyLearned=structuredClone(c),v=previouslyLearned.rider!;
    v.skills[data.skill]={study:100,mastery:57};v.phase='event';v.event=id;
    command(previouslyLearned,{type:'event',eventId:id,index:0},identity);
    assert.deepEqual(v.skills[data.skill],{study:100,mastery:57});
    assert.deepEqual(v.extras!.relationships!.titles,[title]);
    r.phase='event';r.event=id;
    command(c,{type:'event',eventId:id,index:0},identity);
    assert.equal(r.skills[data.skill].study,100);
    for(const prerequisite of SKILL[data.skill]!.requires)assert.deepEqual(r.skills[prerequisite],skills[prerequisite]);
    assert.ok(canStudy(r,data.skill));
    assert.equal(event.when(r),false);
    assert.equal(relationshipWith(r,npc)?.state,'rival');
    assert.deepEqual(r.extras!.relationships!.titles,[title]);
    assert.ok(trainingPromiseActive(r,npc));
    r.week+=8;
    assert.equal(trainingPromiseActive(r,npc),false);
    command(c,{type:'representative-title',id:title},identity);
    assert.equal(representativeTitle(r),data.title);
    assert.equal(rankingPoints(r).total,0);
    command(c,{type:'retire'},identity);
    assert.equal(representativeTitle(JSON.parse(JSON.stringify(c.hall[0]))),data.title);
  }
});

test('유리 and 준’s relationship routes grant an exclusive gift and a selectable title',()=>{
  assert.equal(RIVALS.filter(rival=>rival.look.gender==='female').length,3);
  assert.equal(RIVALS.filter(rival=>rival.look.gender==='male').length,3);
  assert.ok(RIVALS.every(rival=>rival.age>=19));
  for(const npc of ['yu','jun'] as const){
    for(const [index,route] of (['friend','rival','partner'] as const).entries()){
      const c=career(),r=c.rider!;
      r.year=4;r.week=2;r.look.gender=npc==='yu'?'male':'female';
      r.relations[npc]=100;
      assert.equal(relationshipWith(r,npc),undefined,'Legacy affinity does not choose a route');
      assert.equal(spotUnlocked(r,'rooftop'),false);
      const choose=(episode:string,index:number)=>{
        const eventId='relationship-'+npc+'-'+episode;
        assert.ok(eventFor(r,eventId)?.when(r),eventId);
        r.phase='event';r.event=eventId;
        command(c,{type:'event',eventId,index},identity);
      };
      const trust=eventFor(r,'relationship-'+npc+'-trust')!;
      assert.match(eventBody(r,trust),npc==='yu'?/고른 스텝/:/오늘 내 첫 시도/);
      choose('trust',1);
      r.week=4;choose('fork',index);
      if(route==='partner'){
        assert.equal(relationshipWith(r,npc)?.state,'interested');
        r.week=6;choose('confession',0);
      }
      r.week=10;choose(route,0);
      assert.equal(relationshipWith(r,npc)?.state,route);
      assert.ok(relationshipWith(r,npc)?.flags.includes('finished-'+route));
      const reward=RELATIONSHIP_REWARDS[npc][route];
      assert.deepEqual(extras(r).relationships?.titles,[reward.titleId]);
      assert.deepEqual(extras(r).inventory.filter(id=>id===reward.item),[reward.item]);
      assert.throws(()=>command(c,{type:'event',eventId:'relationship-'+npc+'-'+route,index:0},identity),GameError);
      assert.throws(()=>command(c,{type:'representative-title',id:'unearned'},identity),GameError);
      command(c,{type:'representative-title',id:reward.titleId},identity);
      assert.equal(representativeTitle(r),reward.title);
      command(c,{type:'trade',operation:'equip',item:reward.item},identity);
      assert.equal(gearBonuses(r)[npc==='yu'?'danceMastery':'trickMastery'],.04);
      assert.equal(spotUnlocked(r,'rooftop'),true);
      command(c,{type:'spot',spot:'rooftop'},identity);
      assert.ok(eventFor(r,'rooftop-jam')?.when(r));
      assert.equal(rankingPoints(r).total,0);
      command(c,{type:'retire'},identity);
      const saved=JSON.parse(JSON.stringify(c.hall[0])) as typeof c.hall[number];
      assert.equal(relationshipEpilogues(saved)[0].state,route);
      assert.equal(representativeTitle(saved),reward.title);
    }
  }
});

test('one confirmed romance per career, explicit rejection leads to friendship, and breakup has its own ending',()=>{
  const c=career(),r=c.rider!;
  r.year=4;r.week=11;
  const history=r.extras!.relationships={npcs:{yu:{state:'partner',flags:['confession-accepted']},jun:{state:'interested',flags:['romance-route']}},titles:[]};
  r.extras!.choices['relationship-jun-fork']={index:2,year:4,week:4};
  r.extras!.choices['relationship-yu-confession']={index:0,year:4,week:8};
  const confession=eventFor(r,'relationship-jun-confession')!;
  assert.equal(confession.when(r),true);
  assert.equal(eventChoiceAvailable(r,confession,0),false);
  r.phase='event';r.event=confession.id;
  assert.throws(()=>command(c,{type:'event',eventId:confession.id,index:0},identity),/이미 연애 상대/);
  assert.equal(relationshipWith(r,'jun')?.state,'interested');
  command(c,{type:'event',eventId:confession.id,index:1},identity);
  assert.equal(relationshipWith(r,'jun')?.state,'friend');
  assert.equal(eventFor(r,'relationship-jun-friend')?.when(r),true);

  r.phase='event';r.event='relationship-yu-partner';
  command(c,{type:'event',eventId:r.event,index:1},identity);
  assert.equal(relationshipWith(r,'yu')?.state,'ended');
  assert.equal(eventChoiceAvailable(r,confession,0),false);
  assert.ok(relationshipEpilogues(r).some(ending=>ending.state==='ended'));
  assert.deepEqual(history.titles,[]);
});

test('overlapping story opportunities survive to the next week and auto stops at a saved decision in background',()=>{
  const r=career().rider!;
  r.year=6;r.week=25;
  r.events=Object.fromEntries(EVENTS.filter(e=>!['relationship-yu-trust','relationship-yu-fork','yu-open-final','story-ha-1'].includes(e.id)).map(e=>[e.id,1]));
  const first=pickEvent(r,()=>.99)!;
  assert.equal(first.id,'yu-open-final');
  r.events[first.id]=1;r.week++;
  assert.equal(pickEvent(r,()=>.99)?.id,'relationship-yu-trust');
  r.events['relationship-yu-trust']=1;
  r.extras!.choices['relationship-yu-trust']={index:0,year:6,week:26};
  r.week=28;
  assert.equal(pickEvent(r,()=>.99)?.id,'story-ha-1','The waiting NPC precedes the newly eligible fork');
  r.events['story-ha-1']=1;
  r.settings={mode:'auto',strategy:'freestyle',entries:['trick'],skipEvents:false};
  const start=1_000_000,tab='relationship-tab';
  const save=blankSave();save.career.rider=r;
  const step=(prev:typeof save,action:Parameters<typeof advance>[1],ms:number)=>advance(prev,action,tab,start+ms,2000,identity);
  const started=step(save,{type:'pulse',background:'hidden'},0);
  const auto=step(started,{type:'pulse',background:'hidden'},30_000);
  assert.equal(auto.career.rider?.event,'relationship-yu-fork');
  assert.equal(auto.career.rider?.week,28);
  assert.equal(auto.clock.pendingTraining,undefined);
  assert.equal(auto.clock.background,undefined);
  const loaded=JSON.parse(JSON.stringify(auto)) as typeof save;
  assert.equal(step(loaded,{type:'pulse',background:'visible'},120_000),loaded);
  const settings=step(loaded,{type:'settings',settings:{...r.settings,strategy:'dance'}},120_001);
  assert.equal(settings.career.rider?.event,'relationship-yu-fork');
  assert.throws(()=>step(settings,{type:'event',eventId:first.id,index:0},120_002),/이미 넘어간/);
  const chosen=step(settings,{type:'event',eventId:'relationship-yu-fork',index:1},120_002);
  assert.equal(chosen.clock.pendingEvent?.eventId,'relationship-yu-fork');
  assert.match(chosen.clock.pendingEvent?.dialogue??'',/곡만 같게/);
  assert.equal(relationshipWith(chosen.career.rider!,'yu')?.state,'rival');
});

test('sponsors pay once per season, award equipment and pay a recorded podium bonus',()=>{
  const c=career(),r=c.rider!;
  const brand=SPONSOR.get('daybreak')!;
  assert.throws(()=>command(c,{type:'sponsor',id:brand.id},identity),GameError);
  r.year=3;r.season={year:3,division:'regular',scores:{dance:{},trick:{},freestyle:{}}};r.week=7;r.fame=30;
  for(const key of STATS) r.stats[key]=100;
  for(const skill of SKILLS) r.skills[skill.id]={study:100,mastery:100};
  const fixture=simulateMeet(r,CALENDAR[0],['dance']).results[0];
  const prior={...fixture,standings:fixture.standings.map(row=>({...row,place:row.id==='player'?1:row.place+1}))};
  r.records.push({year:1,id:CALENDAR[0].id,division:'rookie',results:[prior]});
  const before=r.money;
  command(c,{type:'sponsor',id:brand.id},identity);
  assert.equal(r.money,before+brand.support);
  assert.ok(extras(r).inventory.includes(brand.gift));
  assert.throws(()=>command(c,{type:'sponsor',id:brand.id},identity),GameError);
  r.phase='meet';
  command(c,{type:'entry',disciplines:['dance']},identity);
  const result=r.records.at(-1)!.results[0];
  assert.ok(playerPlace(result)<=3);
  assert.equal(result.sponsorBonus,brand.podium);
  r.season.scores.dance.player=500;
  const after=r.money;
  r.week=52;r.phase='meet';
  command(c,{type:'entry',disciplines:[]},identity);
  assert.equal(r.year,4);
  assert.equal(extras(r).contract?.year,4);
  assert.equal(r.money,after+brand.support+ECONOMY.podiumSeason[0]);
  assert.ok(extras(r).timeline.some(item=>item.title==='시즌 순위 보상'));
  assert.equal(extras(r).inventory.filter(item=>item===brand.gift).length,1);
});

test('each confirmed action takes two seconds, survives reload and awards one result before any event',()=>{
  const week=RULES.weekMs;assert.equal(week,2000);
  let save=advance(blankSave(),{type:'create',name:'Two seconds',look:DEFAULT_LOOK},'first',0,week,identity);
  save=advance(save,{type:'pulse'},'first',300000,week,identity);
  assert.equal(save.career.rider!.week,1);assert.equal(remaining(save,week,300000),0);
  save=advance(save,{type:'plan',plan:plan('speed')},'first',300000,week,identity);
  assert.equal(remaining(save,week,300000),2000);
  save=advance(save,{type:'fast-forward',enabled:true},'other',301000,week,identity);
  assert.equal(remaining(save,week,301000),1000);
  save=advance(save,{type:'pulse'},'other',301999,week,identity);
  assert.equal(save.career.rider!.stats.speed,18);
  assert.throws(()=>advance(save,{type:'plan',plan:plan('rest')},'other',301999,week,identity),GameError);
  save=advance(JSON.parse(JSON.stringify(save)),{type:'pulse'},'reopened',302000,week,identity);
  assert.ok(save.clock.pendingTraining);assert.ok(save.career.rider!.stats.speed>18);
  const snapshot=structuredClone(save);
  assert.deepEqual(advance(save,{type:'pulse'},'reopened',900000,week,identity),snapshot);
  const key=save.clock.pendingTraining!;
  save=advance(save,{type:'continue-training',record:key},'first',900000,week,identity);
  assert.throws(()=>advance(save,{type:'continue-training',record:key},'first',900001,week,identity),GameError);
  save=advance(save,{type:'event',index:0},'first',900001,week,identity);
  assert.equal(save.career.rider!.week,2);assert.equal(remaining(save,week,900001),0);
  assert.ok(save.clock.pendingEvent);
  assert.throws(()=>advance(save,{type:'plan',plan:plan('speed')},'first',900002,week,identity),GameError);
  const resultKey=save.clock.pendingEvent.key;
  save=advance(JSON.parse(JSON.stringify(save)),{type:'continue-event',record:resultKey},'reopened',900003,week,identity);
  assert.equal(save.clock.pendingEvent,undefined);
  assert.throws(()=>advance(save,{type:'continue-event',record:resultKey},'first',900004,week,identity),GameError);
});

test('automatic play performs one action at a time and waits for its result and tournament before the next week',()=>{
  const week=RULES.weekMs;
  for(const final of [false,true]){
    let save=advance(blankSave(),{type:'create',name:'Automatic',look:DEFAULT_LOOK},'first',0,week,identity);
    save.career.rider!.week=final?52:7;save.career.rider!.year=final?8:1;
    save=advance(save,{type:'settings',settings:{mode:'auto',strategy:'balanced',entries:['dance']}},'first',0,week,identity);
    const selected=structuredClone(save.career.rider!.plan);assert.ok(selected);
    const choice=save.clock.pendingChoice!;assert.ok(choice);
    assert.equal(remaining(save,week,0),0);
    assert.deepEqual(advance(save,{type:'pulse'},'other',100000,week,identity),save,'No unseen training before the selection scene is acknowledged');
    assert.throws(()=>advance(save,{type:'start-training',record:'wrong'},'first',2000,week,identity),GameError);
    save=advance(save,{type:'settings',settings:{...save.career.rider!.settings,strategy:'trick'}},'first',1000,week,identity);
    assert.deepEqual(save.career.rider!.plan,selected);
    save=advance(JSON.parse(JSON.stringify(save)),{type:'start-training',record:choice},'first',2000,week,identity);
    assert.equal(remaining(save,week,2000),2000);assert.equal(save.clock.pendingChoice,undefined);
    assert.throws(()=>advance(save,{type:'start-training',record:choice},'first',2001,week,identity),GameError);
    save=advance(save,{type:'pulse'},'first',100000,week,identity,true);
    assert.equal(save.career.rider!.records.length,1);assert.ok(save.clock.pendingTraining);assert.ok(save.clock.pendingMeet);
    assert.equal(save.career.rider!.phase,final?'retired':'plan');
    const snapshot=structuredClone(save);assert.deepEqual(advance(save,{type:'pulse'},'other',1000000,week,identity),snapshot);
    save=advance(save,{type:'continue-training',record:save.clock.pendingTraining!},'first',1000000,week,identity);
    assert.ok(save.clock.pendingMeet);assert.equal(save.career.rider!.plan,null);
    if(save.clock.pendingEvent)save=advance(save,{type:'continue-event',record:save.clock.pendingEvent.key},'first',1000000,week,identity);
    save=advance(save,{type:'continue-meet',record:save.clock.pendingMeet!},'first',1000000,week,identity);
    assert.equal(save.clock.pendingMeet,undefined);
    assert.equal(remaining(save,week,1000000),0);
    assert.equal(!!save.clock.pendingChoice,!final);
  }
});

test('retired training intensity has no effect and automatic choice can be cancelled without consuming a week',()=>{
  const variants=['safe','normal','focus'].map(intensity=>{
    const c=career();const p=Object.assign(plan('speed'),{intensity});
    command(c,{type:'plan',plan:p},identity);processWeek(c);return c;
  });
  assert.deepEqual(variants[0],variants[1]);assert.deepEqual(variants[1],variants[2]);
  assert.equal('intensity' in variants[0].rider!.lastPlan!,false);
  let save=advance(blankSave(),{type:'create',name:'Cancel auto',look:DEFAULT_LOOK},'first',0,RULES.weekMs,identity);
  save=advance(save,{type:'settings',settings:{mode:'auto',strategy:'balanced',entries:[]}},'first',0,RULES.weekMs,identity);
  assert.ok(save.clock.pendingChoice);
  save=advance(save,{type:'settings',settings:{...save.career.rider!.settings,mode:'manual'}},'first',1000,RULES.weekMs,identity);
  assert.equal(save.career.rider!.plan,null);assert.equal(save.clock.pendingChoice,undefined);assert.equal(save.career.rider!.week,1);
});

test('zero stamina permits all competition entries without changing execution, links, score or automatic line choice',()=>{
  const healthy=career().rider!,exhausted={...structuredClone(healthy),energy:0};
  const full=simulateMeet(healthy,CALENDAR[0],[...DISCIPLINES]),empty=simulateMeet(exhausted,CALENDAR[0],[...DISCIPLINES]);
  assert.equal(empty.results.length,3);
  for(let i=0;i<3;i++){
    assert.deepEqual(empty.results[i].run,full.results[i].run);
    assert.deepEqual(empty.results[i].standings,full.results[i].standings);
    assert.equal(empty.results[i].energy,0);
  }
  assert.ok(full.results[2].energy<full.results[0].energy);
  const c:Career={rider:exhausted,hall:[]};exhausted.year=2;exhausted.week=52;exhausted.phase='meet';
  command(c,{type:'entry',disciplines:[...DISCIPLINES]},identity);assert.equal(exhausted.records[0].results.length,3);
});

test('training previews match recovery and successful stat gains while low stamina meaningfully increases failure',()=>{
  const p:Plan={action:'speed',spot:'river'};
  const r=career().rider!;
  assert.ok(trainingSuccess({...r,energy:0},p)<.2);assert.ok(trainingSuccess({...r,energy:100},p)>.9);
  let misses=0,successes=0;
  for(let seed=1;seed<=80;seed++){
    const c:Career={rider:newRider('preview-'+seed,seed,'Preview',DEFAULT_LOOK),hall:[]};
    const rider=c.rider!;rider.week=3;rider.energy=seed<=40?0:100;
    const preview=previewTraining(rider,p),before=rider.stats.speed;
    command(c,{type:'plan',plan:p},identity);processWeek(c);
    assert.equal(rider.energy,preview.energyAfter);
    const gain=rider.stats.speed-before,estimate=preview.gains.speed!;
    if(gain===0)misses++;else{successes++;assert.ok(gain>=estimate.min-.00001&&gain<=estimate.max+.00001);}
    if(seed===40)assert.ok(misses>=25,'Most zero-stamina attempts must fail');
  }
  assert.ok(successes>=35);
  const rest=previewTraining({...r,energy:80},{...p,action:'rest'});assert.equal(rest.energy,20);assert.equal(rest.energyAfter,100);
  const hospital=previewTraining({...r,money:0,energy:0,injury:{severity:'major',weeks:3,treated:false}},{...p,action:'hospital'});
  assert.equal(hospital.energy,24);assert.equal(hospital.money,0);
});

test('ordinary training follows the energy curve and the low-energy bonus leaves rest worthwhile',()=>{
  const r=career().rider!,p={action:'trick',spot:'river',skill:'hardflip'} as const;
  const curve=Array.from({length:101},(_,energy)=>trainingSuccess({...r,energy},p));
  for(const [from,to,min,max] of [[0,19,.15,.39],[20,39,.4,.69],[40,69,.7,.87],[70,79,.9,.98],[80,100,1,1]]){
    assert.ok(curve.slice(from,to+1).every(chance=>chance>=min-1e-9&&chance<=max+1e-9));
  }
  assert.ok(curve.every((chance,energy)=>!energy||chance>=curve[energy-1]&&chance-curve[energy-1]<=.031));
  assert.equal(trainingSuccess({...r,energy:100,injury:{severity:'minor',weeks:2,treated:false}},p),.88);
  const exhausted={...r,energy:0},afterRest={...r,energy:RULES.restEnergy};
  const gainAt=(rider:typeof r)=>trainingFactor(rider,p,.5)/(.72+.0028*rider.energy);
  assert.ok(Math.abs(gainAt(exhausted)/gainAt(afterRest)-1.30)<1e-9);
  assert.ok(2*curve[0]*trainingFactor(exhausted,p,.5)<curve[RULES.restEnergy]*trainingFactor(afterRest,p,.5));
});

test('one deterministic random special is visible in the client view and yields the exact forecast',()=>{
  const c=career(),r=c.rider!;
  const offers=TRAINING_ACTIONS.map(action=>{
    let seed=0;
    while(randomSpecialTraining({...r,seed})!==action)seed++;
    return seed;
  });
  for(const [index,seed] of offers.entries()){
    const c=career(),r=c.rider!;
    r.energy=12;r.seed=seed;
    const action=TRAINING_ACTIONS[index];
    const projected={...r,seed:0,trainingOffer:randomSpecialTraining(r)??null};
    assert.equal(randomSpecialTraining(JSON.parse(JSON.stringify(projected))),action);
    const p:Plan={action,spot:'river',skill:action==='dance'?'peter-pan':action==='trick'?'pivot':undefined};
    const forecast=previewTraining(projected,p);
    assert.deepEqual(forecast,previewTraining(r,p));
    assert.deepEqual([forecast.special,forecast.success,forecast.energy],['random',1,0]);
    assert.ok(TRAINING_ACTIONS.filter(other=>previewTraining(projected,plan(other)).special).length===1);
    const before=structuredClone(r);
    command(c,{type:'plan',plan:p},identity);assert.ok(processWeek(c));
    assert.equal(r.energy,before.energy);assert.equal(r.injury,null);
    assert.equal(r.extras!.lastTraining!.special,'random');
    for(const stat of STATS)assert.ok(Math.abs(r.stats[stat]-before.stats[stat]-(forecast.gains[stat]?.max??0))<1e-8);
    if(p.skill)assert.ok(Math.abs(r.skills[p.skill].mastery-before.skills[p.skill].mastery-forecast.skill!.max)<1e-8);
  }
});

test('special training replaces a booked ordinary meet once and cannot replace an international meet',()=>{
  const p:Plan={...plan('speed'),meetTraining:true};
  for(const week of [CALENDAR[0].week,CALENDAR.find(meet=>meet.major)!.week]){
    const state=blankSave(),r=state.career.rider=career().rider!;
    r.week=week;r.energy=14;r.events.first=1;
    const step=(save:typeof state,action:Parameters<typeof advance>[1],now:number)=>advance(save,action,'tab',now,2000,identity);
    const queued=step(state,{type:'plan',plan:p},0);
    assert.throws(()=>step(queued,{type:'entry',disciplines:['dance']},1),/출전 대신 훈련/);
    const restored:typeof state=JSON.parse(JSON.stringify(queued));
    let resolved=step(restored,{type:'pulse'},2000);
    assert.equal(resolved.career.rider!.extras!.lastTraining!.special,'meet');
    assert.equal(resolved.career.rider!.energy,r.energy);
    assert.equal(resolved.career.rider!.money,r.money+RULES.weeklyAllowance);
    assert.equal(step(resolved,{type:'pulse'},2100),resolved);
    resolved=step(resolved,{type:'continue-training',record:resolved.clock.pendingTraining!},2200);
    const pending=resolved.career.rider!;
    if(pending.phase==='event')resolved=step(resolved,{type:'event',eventId:pending.event!,index:0},2300);
    const trained=resolved.career.rider!;
    assert.equal(trained.records.length,1);
    assert.deepEqual(trained.records[0].results,[]);
    assert.equal(rankingPoints(trained).total,0);
  }
  const c=career(),r=c.rider!;
  assert.throws(()=>command(c,{type:'plan',plan:p},identity),/정규·메이저/);
  r.settings={mode:'auto',strategy:'dance',entries:[]};r.energy=0;r.week=CALENDAR[0].week;
  prepareWeek(r);
  assert.equal(r.plan?.meetTraining,true);assert.ok(processWeek(c));
  assert.equal(r.extras!.lastTraining!.special,'meet');assert.equal(r.records[0].results.length,0);
  const international=career();
  international.rider!.year=2;international.rider!.week=52;
  assert.throws(()=>command(international,{type:'plan',plan:p},identity),/정규·메이저/);
});


test('management stays available through story, training and result holds without consuming or duplicating outcomes',()=>{
 const week=2000;let save=advance(blankSave(),{type:'create',name:'Independent menus',look:DEFAULT_LOOK},'tab',0,week,identity);
 save=advance(save,{type:'plan',plan:{action:'speed',spot:'river'}},'tab',0,week,identity);
 const control=advance(structuredClone(save),{type:'pulse'},'tab',2000,week,identity);
 const began=save.clock.readyAt;
 save=advance(save,{type:'trade',operation:'buy',item:'acc_005'},'tab',500,week,identity);
 save=advance(save,{type:'trade',operation:'equip',item:'acc_005'},'tab',700,week,identity);
 assert.equal(save.clock.readyAt,began);
 save=advance(save,{type:'pulse'},'tab',2000,week,identity);
 assert.equal(save.career.rider!.energy,control.career.rider!.energy,'Current training keeps its original equipment costs');
 assert.deepEqual(save.career.rider!.stats,control.career.rider!.stats);
 const training=save.clock.pendingTraining;assert.ok(training);
 save=advance(save,{type:'unequip',slot:'accessory',item:'acc_005'},'tab',2100,week,identity);
 assert.equal(save.clock.pendingTraining,training);
 save=advance(save,{type:'continue-training',record:training!},'tab',2200,week,identity);
 assert.equal(save.career.rider!.phase,'event');
 save=advance(save,{type:'trade',operation:'equip',item:'acc_005'},'tab',2300,week,identity);
 assert.equal(save.career.rider!.event,'first');
 save=advance(save,{type:'event',index:1},'tab',2400,week,identity);
 const result=structuredClone(save.clock.pendingEvent);assert.ok(result);assert.match(result.choice,/균형/);assert.ok(result.details.includes('밸런스 +3'));
 const balance=save.career.rider!.stats.balance;
 save=advance(save,{type:'unequip',slot:'accessory',item:'acc_005'},'tab',2500,week,identity);
 assert.deepEqual(save.clock.pendingEvent,result);assert.equal(save.career.rider!.week,2);
 assert.equal(advance(save,{type:'pulse'},'tab',100000,week,identity),save,'A held result has no repeated work');
 assert.throws(()=>advance(save,{type:'event',index:1},'tab',2600,week,identity),GameError);
 save=advance(JSON.parse(JSON.stringify(save)),{type:'continue-event',record:result.key},'other-tab',2700,week,identity);
 assert.equal(save.clock.pendingEvent,undefined);assert.equal(save.career.rider!.stats.balance,balance);
 save=advance(save,{type:'plan',plan:{action:'speed',spot:'river'}},'tab',2800,week,identity);
 assert.ok(save.clock.trainingSetup);
});

test('automatic event results hold the next action and management preserves the queued selection',()=>{
 const week=2000;let save=advance(blankSave(),{type:'create',name:'Auto outcome',look:DEFAULT_LOOK},'tab',0,week,identity);
 save=advance(save,{type:'settings',settings:{mode:'auto',strategy:'balanced',entries:[]}},'tab',0,week,identity);
 const choice=save.clock.pendingChoice!;
 save=advance(save,{type:'trade',operation:'buy',item:'acc_005'},'tab',100,week,identity);assert.equal(save.clock.pendingChoice,choice);
 save=advance(save,{type:'start-training',record:choice},'tab',2000,week,identity);
 save=advance(save,{type:'pulse'},'tab',4000,week,identity);assert.ok(save.clock.pendingEvent);assert.ok(save.clock.pendingTraining);
 save=advance(save,{type:'continue-training',record:save.clock.pendingTraining!},'tab',6000,week,identity);
 assert.equal(save.clock.pendingChoice,undefined);assert.ok(save.clock.pendingEvent);
 const result=save.clock.pendingEvent!;
 save=advance(save,{type:'trade',operation:'equip',item:'acc_005'},'tab',6100,week,identity);
 assert.equal(save.clock.pendingEvent?.key,result.key);assert.equal(save.clock.pendingChoice,undefined);
 save=advance(save,{type:'continue-event',record:result.key},'tab',8000,week,identity);assert.ok(save.clock.pendingChoice);
});
