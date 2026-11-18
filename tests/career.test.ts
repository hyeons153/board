import test from 'node:test';
import assert from 'node:assert/strict';
import { CALENDAR, DEFAULT_LOOK, RULES, SKILL, SKILLS } from '../src/game/data';
import { command, GameError, newRider, processWeek } from '../src/game/career';
import { chance, generateRoutine, learned, routineTime, simulateMeet, simulateRun, validRoutine } from '../src/game/competition';
import { ECONOMY, equippedLook, extras, playerPlace, SPONSOR } from '../src/game/economy';
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

test('three disciplines have reproducible bounded runs, and repeats, failed landings, and fatigue matter',()=>{
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
  assert.ok(simulateRun(r,'freestyle',mixed,()=>.72).score>simulateRun({...r,energy:0},'freestyle',mixed,()=>.72).score);
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

test('open pages share one clock; a new page cannot claim elapsed time while all pages were closed',()=>{
  const week=1000;
  let save=advance(blankSave(),{type:'create',name:'Clock',look:DEFAULT_LOOK},'first',5000,week,identity);
  save=advance(save,{type:'settings',settings:{mode:'auto',strategy:'balanced',intensity:'normal',entries:[]}},'first',5000,week,identity);
  save=advance(save,{type:'pulse'},'second',5500,week,identity);
  save=advance(save,{type:'pulse'},'first',5800,week,identity);
  assert.equal(remaining(save,week),200);
  save=advance(save,{type:'pulse'},'second',6000,week,identity);
  save=advance(save,{type:'pulse'},'first',6000,week,identity);
  assert.equal(save.career.rider?.week,2);
  assert.equal(remaining(save,week),1000);
  save=advance(save,{type:'pulse'},'third-new-page',100_000,week,identity);
  assert.equal(save.career.rider?.week,2);
  save=advance(save,{type:'pulse'},'third-new-page',104_500,week,identity);
  assert.equal(save.career.rider?.week,6);
  assert.equal(remaining(save,week),500);
});


test('weeks take 30 seconds in manual and auto mode regardless of a retired speed preference',()=>{
  assert.equal(RULES.weekMs,30000);
  for(const auto of [false,true]){
    let save=advance(blankSave(),{type:'create',name:'Thirty seconds',look:DEFAULT_LOOK},'first',0,RULES.weekMs,identity);
    Object.assign(save.clock,{speed:8});
    save=advance(save,auto
      ?{type:'settings',settings:{mode:'auto',strategy:'balanced',intensity:'safe',entries:[]}}
      :{type:'plan',plan:plan('speed')},'first',0,RULES.weekMs,identity);
    assert.equal('speed' in save.clock,false);
    save=advance(save,{type:'pulse'},'first',29999,RULES.weekMs,identity);
    assert.equal(save.career.rider!.week,1);
    assert.equal(save.career.rider!.phase,'plan');
    assert.equal(remaining(save,RULES.weekMs),1);
    save=advance(save,{type:'pulse'},'first',30000,RULES.weekMs,identity);
    assert.equal(save.career.rider!.phase,auto?'plan':'event');
    assert.equal(save.career.rider!.week,auto?2:1);
    if(!auto){
      const paused=structuredClone(save.career);
      save=advance(save,{type:'pulse'},'first',300000,RULES.weekMs,identity);
      assert.deepEqual(save.career,paused);
    }
  }
});

test('the x2 toggle preserves progress, pauses and normal speed when turned off',()=>{
  for(const auto of [false,true]){
    let save=advance(blankSave(),{type:'create',name:'Toggle',look:DEFAULT_LOOK},'first',0,RULES.weekMs,identity);
    save=advance(save,auto
      ?{type:'settings',settings:{mode:'auto',strategy:'balanced',intensity:'safe',entries:[]}}
      :{type:'plan',plan:plan('speed')},'first',0,RULES.weekMs,identity);
    save=advance(save,{type:'fast-forward',enabled:true},'first',10000,RULES.weekMs,identity);
    assert.equal(remaining(save,RULES.weekMs),10000);
    assert.equal(save.career.rider!.week,1);
    save=advance(save,{type:'fast-forward',enabled:false},'first',15000,RULES.weekMs,identity);
    assert.equal(remaining(save,RULES.weekMs),10000);
    save=advance(save,{type:'fast-forward',enabled:true},'first',15000,RULES.weekMs,identity);
    assert.equal(remaining(save,RULES.weekMs),5000);
    save=advance(save,{type:'pulse'},'first',19999,RULES.weekMs,identity);
    assert.equal(save.career.rider!.phase,'plan');
    save=advance(save,{type:'pulse'},'first',20000,RULES.weekMs,identity);
    assert.equal(save.career.rider!.phase,auto?'plan':'event');
    assert.equal(save.career.rider!.week,auto?2:1);
    if(!auto){
      const paused=structuredClone(save.career);
      save=advance(save,{type:'pulse'},'first',100000,RULES.weekMs,identity);
      assert.deepEqual(save.career,paused);
    }
  }
});

test('a completed meet holds the career until its exact result is acknowledged, without duplicate rewards or catch-up',()=>{
  let save=advance(blankSave(),{type:'create',name:'In game',look:DEFAULT_LOOK},'first',0,RULES.weekMs,identity);
  save.career.rider!.week=7;save.career.rider!.phase='meet';
  save=advance(save,{type:'entry',disciplines:['dance','trick']},'first',1000,RULES.weekMs,identity,true);
  const key=save.clock.pendingMeet!;
  assert.ok(key);
  const completed=structuredClone(save.career);
  assert.equal(remaining(save,RULES.weekMs),0);
  assert.equal(advance(save,{type:'pulse'},'other-tab',600000,RULES.weekMs,identity),save);
  assert.throws(()=>advance(save,{type:'continue-meet',record:'wrong'},'first',600000,RULES.weekMs,identity),GameError);
  assert.throws(()=>advance(save,{type:'entry',disciplines:['dance']},'first',600000,RULES.weekMs,identity),GameError);
  save=advance(JSON.parse(JSON.stringify(save)),{type:'continue-meet',record:key},'new-tab',600000,RULES.weekMs,identity);
  assert.deepEqual(save.career,completed);
  assert.equal(save.clock.pendingMeet,undefined);
  assert.equal(remaining(save,RULES.weekMs),0,'Manual careers wait for the next weekly choice');
  assert.throws(()=>advance(save,{type:'continue-meet',record:key},'new-tab',600001,RULES.weekMs,identity),GameError);
});

test('auto career catch-up stops at the first meet and the final festival remains viewable after retirement',()=>{
  for(const final of [false,true]){
    let save=advance(blankSave(),{type:'create',name:'Auto stage',look:DEFAULT_LOOK},'first',0,RULES.weekMs,identity);
    const r=save.career.rider!;
    r.year=final?8:1;r.week=final?52:7;
    r.settings={mode:'auto',strategy:'balanced',intensity:'safe',entries:['dance']};
    save=advance(save,{type:'pulse'},'first',300000,RULES.weekMs,identity,true);
    assert.ok(save.clock.pendingMeet);
    assert.equal(save.career.rider!.records.length,1);
    assert.equal(save.career.rider!.phase,final?'retired':'plan');
    const paused=structuredClone(save);
    save=advance(save,{type:'pulse'},'first',900000,RULES.weekMs,identity);
    assert.deepEqual(save,paused);
    save=advance(save,{type:'continue-meet',record:save.clock.pendingMeet!},'first',900000,RULES.weekMs,identity);
    assert.equal(save.clock.pendingMeet,undefined);
    assert.equal(save.career.rider!.records.length,1);
  }
});

test('manual weeks start when an action is chosen; idle time cannot complete it and results wait for acknowledgement',()=>{
  let save=advance(blankSave(),{type:'create',name:'Weekly choice',look:DEFAULT_LOOK},'first',0,RULES.weekMs,identity);
  save=advance(save,{type:'pulse'},'first',300000,RULES.weekMs,identity);
  assert.equal(save.career.rider!.week,1);assert.equal(save.clock.credit,0);assert.equal(remaining(save,RULES.weekMs),0);
  save=advance(save,{type:'plan',plan:plan('speed')},'first',360000,RULES.weekMs,identity);
  assert.equal(remaining(save,RULES.weekMs),30000);
  assert.throws(()=>advance(save,{type:'plan',plan:plan('rest')},'first',370000,RULES.weekMs,identity),GameError);
  save=advance(save,{type:'pulse'},'first',389999,RULES.weekMs,identity);
  assert.equal(save.career.rider!.phase,'plan');
  save=advance(save,{type:'pulse'},'first',390000,RULES.weekMs,identity);
  assert.ok(save.clock.pendingTraining);
  const snapshot=structuredClone(save);
  save=advance(save,{type:'pulse'},'first',690000,RULES.weekMs,identity);
  assert.deepEqual(save,snapshot);
  save=advance(save,{type:'continue-training',record:save.clock.pendingTraining!},'first',690000,RULES.weekMs,identity);
  save=advance(save,{type:'event',index:0},'first',690000,RULES.weekMs,identity);
  assert.equal(save.career.rider!.week,2);assert.equal(remaining(save,RULES.weekMs),0);
});

test('automatic play commits each weekly action up front and chooses events and competition entries without manual gates',()=>{
  let save=advance(blankSave(),{type:'create',name:'Fully automatic',look:DEFAULT_LOOK},'first',0,RULES.weekMs,identity);
  const settings={mode:'auto' as const,strategy:'balanced' as const,intensity:'safe' as const,entries:[...DISCIPLINES],pauseStory:true,pauseMeet:true,pauseInjury:true};
  save=advance(save,{type:'settings',settings},'first',0,RULES.weekMs,identity);
  const chosen=structuredClone(save.career.rider!.plan);
  assert.ok(chosen);
  save=advance(save,{type:'settings',settings:{...settings,strategy:'trick',intensity:'focus'}},'first',15000,RULES.weekMs,identity);
  assert.deepEqual(save.career.rider!.plan,chosen);
  save=advance(save,{type:'pulse'},'first',30000,RULES.weekMs,identity);
  assert.deepEqual(save.career.rider!.lastPlan,chosen);
  assert.equal(save.career.rider!.week,2);
  assert.equal(save.clock.pendingTraining,undefined);
  assert.ok(Object.keys(save.career.rider!.events).length>0);
  save=advance(save,{type:'pulse'},'first',300000,RULES.weekMs,identity);
  assert.ok(save.clock.pendingMeet);
  assert.equal(save.career.rider!.records.length,1);
  assert.equal(save.career.rider!.settings.pauseMeet,false);
  save=advance(save,{type:'continue-meet',record:save.clock.pendingMeet!},'first',300000,RULES.weekMs,identity);
  assert.ok(save.career.rider!.plan);
  assert.ok(remaining(save,RULES.weekMs)>0);
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
