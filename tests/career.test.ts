import test from 'node:test';
import assert from 'node:assert/strict';
import { CALENDAR, DEFAULT_LOOK, RULES, SKILL, SKILLS } from '../src/game/data';
import { command, GameError, newRider, processWeek } from '../src/game/career';
import { chance, generateRoutine, learned, routineTime, simulateMeet, simulateRun, validRoutine } from '../src/game/competition';
import { ECONOMY, equippedLook, extras, playerPlace, SPONSOR } from '../src/game/economy';
import { previewTraining, trainingSuccess } from '../src/game/training';
import { pickEvent } from '../src/game/events';
import { seeded } from '../src/game/random';
import { advance, blankSave, remaining } from '../server/clock';
import { DISCIPLINES, STATS, type Career, type Plan } from '../src/game/types';

const identity=()=>({id:'rider-1',seed:5411});
const career=():Career=>({rider:newRider(identity().id,identity().seed,'리버',{...DEFAULT_LOOK}),hall:[]});
const plan=(p:Plan['action']):Plan=>({action:p,spot:'river',intensity:'safe'});
const enterAuto=(c:Career)=>command(c,{type:'settings',settings:{mode:'auto',strategy:'freestyle',intensity:'normal',entries:[...DISCIPLINES]}},identity);

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
    if(i===51){
      assert.equal(r.year,2);assert.equal(r.week,1);assert.equal(r.season.division,'regular');
      assert.deepEqual(r.records.map(m=>m.id),CALENDAR.map(m=>m.id));
      assert.deepEqual(r.season.scores.dance,{});
      assert.ok(r.seasons[0].scores.dance.player>0);
    }
    if(i===52*3-1)assert.equal(r.season.division,'open');
  }
  assert.equal(r.phase,'retired');
  assert.equal(c.hall.length,1);
  assert.equal(c.hall[0].reason,'complete');
  assert.equal(c.hall[0].seasons.length,8);
  assert.equal(c.hall[0].records.length,48);
  assert.equal(new Set(r.records.map(m=>m.year+'-'+m.id)).size,48);
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
  const c=career(),r=c.rider!;
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
  command(c,{type:'plan',plan:{action:'dance',intensity:'normal',spot:'studio',skill:'mango',lesson:true}},identity);
  assert.equal(r.money,before);
  processWeek(c);
  assert.equal(r.money,before-ECONOMY.lesson+RULES.weeklyAllowance);
  assert.ok(r.skills.mango.study>0);
});

test('specific story choices pause auto mode and unlock follow-up dialogue',()=>{
  const c=career(),r=c.rider!;
  r.week=11;
  r.relations.yu=8;
  r.settings={mode:'auto',strategy:'dance',intensity:'normal',entries:[],pauseStory:true};
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

test('sponsors pay once per season, award equipment and pay a recorded podium bonus',()=>{
  const c=career(),r=c.rider!;
  const brand=SPONSOR.get('daybreak')!;
  assert.throws(()=>command(c,{type:'sponsor',id:brand.id},identity),GameError);
  r.year=2;r.season={year:2,division:'regular',scores:{dance:{},trick:{},freestyle:{}}};r.week=7;r.fame=30;
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
  assert.equal(r.year,3);
  assert.equal(extras(r).contract?.year,3);
  assert.equal(r.money,after+brand.support+ECONOMY.podiumSeason[0]);
  assert.ok(extras(r).timeline.some(item=>item.title==='시즌 순위 보상'));
  assert.equal(extras(r).inventory.filter(item=>item===brand.gift).length,1);
});

test('each confirmed action takes four seconds, survives reload and awards one result before any event',()=>{
  const week=RULES.weekMs;assert.equal(week,4000);
  let save=advance(blankSave(),{type:'create',name:'Four seconds',look:DEFAULT_LOOK},'first',0,week,identity);
  save=advance(save,{type:'pulse'},'first',300000,week,identity);
  assert.equal(save.career.rider!.week,1);assert.equal(remaining(save,week,300000),0);
  save=advance(save,{type:'plan',plan:plan('speed')},'first',300000,week,identity);
  assert.equal(remaining(save,week,300000),4000);
  save=advance(save,{type:'fast-forward',enabled:true},'other',301000,week,identity);
  assert.equal(remaining(save,week,301000),3000);
  save=advance(save,{type:'pulse'},'other',303999,week,identity);
  assert.equal(save.career.rider!.stats.speed,18);
  assert.throws(()=>advance(save,{type:'plan',plan:plan('rest')},'other',303999,week,identity),GameError);
  save=advance(JSON.parse(JSON.stringify(save)),{type:'pulse'},'reopened',304000,week,identity);
  assert.ok(save.clock.pendingTraining);assert.ok(save.career.rider!.stats.speed>18);
  const snapshot=structuredClone(save);
  assert.deepEqual(advance(save,{type:'pulse'},'reopened',900000,week,identity),snapshot);
  const key=save.clock.pendingTraining!;
  save=advance(save,{type:'continue-training',record:key},'first',900000,week,identity);
  assert.throws(()=>advance(save,{type:'continue-training',record:key},'first',900001,week,identity),GameError);
  save=advance(save,{type:'event',index:0},'first',900001,week,identity);
  assert.equal(save.career.rider!.week,2);assert.equal(remaining(save,week,900001),0);
});

test('automatic play performs one action at a time and waits for its result and tournament before the next week',()=>{
  const week=RULES.weekMs;
  for(const final of [false,true]){
    let save=advance(blankSave(),{type:'create',name:'Automatic',look:DEFAULT_LOOK},'first',0,week,identity);
    save.career.rider!.week=final?52:7;save.career.rider!.year=final?8:1;
    save=advance(save,{type:'settings',settings:{mode:'auto',strategy:'balanced',intensity:'safe',entries:['dance','trick']}},'first',0,week,identity);
    const selected=structuredClone(save.career.rider!.plan);assert.ok(selected);
    save=advance(save,{type:'settings',settings:{...save.career.rider!.settings,strategy:'trick'}},'first',1000,week,identity);
    assert.deepEqual(save.career.rider!.plan,selected);
    save=advance(save,{type:'pulse'},'first',100000,week,identity,true);
    assert.equal(save.career.rider!.records.length,1);assert.ok(save.clock.pendingTraining);assert.ok(save.clock.pendingMeet);
    assert.equal(save.career.rider!.phase,final?'retired':'plan');
    const snapshot=structuredClone(save);assert.deepEqual(advance(save,{type:'pulse'},'other',1000000,week,identity),snapshot);
    save=advance(save,{type:'continue-training',record:save.clock.pendingTraining!},'first',1000000,week,identity);
    assert.ok(save.clock.pendingMeet);assert.equal(save.career.rider!.plan,null);
    save=advance(save,{type:'continue-meet',record:save.clock.pendingMeet!},'first',1000000,week,identity);
    assert.equal(save.clock.pendingMeet,undefined);
    assert.equal(remaining(save,week,1000000),final?0:4000);
  }
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
  const c:Career={rider:exhausted,hall:[]};exhausted.week=7;exhausted.phase='meet';
  command(c,{type:'entry',disciplines:[...DISCIPLINES]},identity);assert.equal(exhausted.records[0].results.length,3);
});

test('training previews match recovery and successful stat gains while low stamina meaningfully increases failure',()=>{
  const p:Plan={action:'speed',spot:'river',intensity:'normal'};
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
