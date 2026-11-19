import test from 'node:test';
import assert from 'node:assert/strict';
import { CALENDAR, calendarFor, INTERNATIONAL_MEETS, DEFAULT_LOOK, RULES, SKILL, SKILLS } from '../src/game/data';
import { command, divisionFor, GameError, newRider, processWeek } from '../src/game/career';
import { chance, generateRoutine, learned, routineTime, simulateMeet, simulateRun, validRoutine } from '../src/game/competition';
import { ECONOMY, equippedLook, extras, gearBonuses, playerPlace, SPONSOR } from '../src/game/economy';
import { previewTraining, statAfter, trainingSuccess } from '../src/game/training';
import { EVENTS, eventBody, eventChoiceAvailable, eventFor, pickEvent } from '../src/game/events';
import { RIVALS, spotUnlocked } from '../src/game/content';
import { RELATIONSHIP_REWARDS, relationshipEpilogues, relationshipWith, representativeTitle } from '../src/game/relationships';
import { seeded } from '../src/game/random';
import { meetRP, rankingPoints } from '../src/game/rp';
import { advance, blankSave, remaining } from '../server/clock';
import { DISCIPLINES, STATS, type Career, type Plan } from '../src/game/types';

const identity=()=>({id:'rider-1',seed:5411});
const career=():Career=>({rider:newRider(identity().id,identity().seed,'리버',{...DEFAULT_LOOK}),hall:[]});
const plan=(p:Plan['action']):Plan=>({action:p,spot:'river'});
const enterAuto=(c:Career)=>command(c,{type:'settings',settings:{mode:'auto',strategy:'freestyle',entries:['freestyle']}},identity);

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
      const preview=previewTraining(r,p);assert.deepEqual(Object.keys(preview.gains).sort(),[...expected[action]].sort());
      command(c,{type:'plan',plan:p},identity);processWeek(c);if(r.extras!.lastTraining!.grade==='miss')continue;succeeded=true;
      for(const stat of STATS){const gain=r.stats[stat]-before.stats[stat],forecast=preview.gains[stat];if(forecast)assert.ok(gain>=forecast.min-.001&&gain<=forecast.max+.001);else assert.equal(gain,0);}
      if(p.skill)assert.ok(r.skills[p.skill].mastery>before.skills[p.skill].mastery);
      assert.ok(r.extras!.lastTraining!.narration);assert.ok(r.extras!.lastTraining!.changes!.some(change=>change.startsWith('체력')));
    }
    assert.ok(succeeded);
  }
  const c=career();c.rider!.year=4;c.rider!.spot='arena';assert.throws(()=>command(c,{type:'plan',plan:{action:'rehearsal',spot:'arena'}},identity),/종료/);
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
  assert.equal(SKILLS.filter(s=>s.family==='dance').length,16);
  assert.equal(SKILLS.filter(s=>s.family==='trick').length,13);
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
  r.settings={mode:'auto',strategy:'dance',entries:[],pauseStory:true};
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

test('all six relationship routes grant an exclusive gift and a selectable title independent of player gender',()=>{
  assert.equal(RIVALS.filter(rival=>rival.look.gender==='female').length,3);
  assert.equal(RIVALS.filter(rival=>rival.look.gender==='male').length,3);
  assert.ok(RIVALS.every(rival=>rival.age>=19));
  for(const npc of ['yu','jun'] as const){
    for(const [index,route] of (['friend','rival','partner'] as const).entries()){
      const c=career(),r=c.rider!;
      r.year=4;r.week=2;r.look.gender=npc==='yu'?'female':'male';
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
  r.events=Object.fromEntries(EVENTS.filter(e=>!e.id.startsWith('relationship-')&&e.id!=='yu-open-final').map(e=>[e.id,1]));
  const first=pickEvent(r,()=>.99)!;
  assert.equal(first.id,'yu-open-final');
  r.events[first.id]=1;r.week++;
  assert.equal(pickEvent(r,()=>.99)?.id,'relationship-yu-trust');
  r.events['relationship-yu-trust']=1;
  r.extras!.choices['relationship-yu-trust']={index:0,year:6,week:26};
  r.week=28;
  assert.equal(pickEvent(r,()=>.99)?.id,'relationship-jun-trust','The waiting NPC precedes the newly eligible fork');
  r.events['relationship-jun-trust']=1;
  r.settings={mode:'auto',strategy:'freestyle',entries:['trick']};
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
