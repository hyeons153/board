import test from 'node:test';
import assert from 'node:assert/strict';
import { command, GameError, newRider, processWeek } from '../src/game/career';
import { DEFAULT_LOOK, SKILL, SKILLS, RULES, CALENDAR } from '../src/game/data';
import { GEAR, ITEM, NEW_GEAR, BASIC_SLOTS, PREVIOUS_PRICES } from '../src/game/equipmentCatalog';
import { ECONOMY, effectiveStats, equipmentStats, extras, freshExtras, gearBonuses, legacyBonuses, resaleValue, upgradeEquipment, equippedLook, type CareerExtras } from '../src/game/economy';
import { previewTraining } from '../src/game/training';
import { simulateMeet, simulateRun } from '../src/game/competition';
import { eventFor, EVENTS, pickEvent } from '../src/game/events';
import { seeded } from '../src/game/random';
import { verifiedResult } from '../server/ranking';
import { STATS, type Career, type GameAction, type Plan } from '../src/game/types';

const identity=()=>({id:'equipment-test',seed:5411});
const career=():Career=>({rider:newRider(identity().id,identity().seed,'Gear rider',DEFAULT_LOOK),hall:[]});
function give(c:Career,ids:string[]){for(const id of ids){const r=c.rider!;r.extras??=freshExtras();if(!r.extras.inventory.includes(id))r.extras.inventory.push(id);}}
function equip(c:Career,id:string){command(c,{type:'trade',operation:'equip',item:id},identity);}
const week=(c:Career,plan:Plan)=>{c.rider!.week=3;c.rider!.phase='plan';command(c,{type:'plan',plan},identity);assert.ok(processWeek(c));};

test('catalog preserves the 22 base items, 30 original accessories and all twelve relationship gifts',()=>{
  assert.equal(NEW_GEAR.filter(item=>item.slot!=='accessory').length,22);
  assert.equal(NEW_GEAR.filter(item=>item.slot==='accessory'&&item.unlock!=='relationship').length,30);
  assert.equal(NEW_GEAR.filter(item=>item.slot==='accessory'&&item.unlock==='relationship').length,12);
  assert.equal(new Set(GEAR.map(item=>item.id)).size,GEAR.length);
  assert.equal(ITEM.get('deck_008')!.price,3200000);assert.equal(ITEM.get('truck_007')!.stats.carve,7);assert.equal(ITEM.get('wheel_007')!.stats.speed,7);
  for(const item of NEW_GEAR){
    const allowed=item.slot==='deck'?['link','balance']:item.slot==='trucks'?['carve']:item.slot==='wheels'?['speed']:[];
    assert.ok(Object.keys(item.stats).every(stat=>allowed.includes(stat)));assert.ok(item.description.length>8);
  }
  const c=career();assert.equal(c.rider!.extras!.inventory.length,3);assert.deepEqual(c.rider!.extras!.accessories,[]);
  assert.deepEqual(upgradeEquipment(freshExtras()),freshExtras());
});

test('legacy bearing migration is pure, idempotent and preserves unknown IDs and full-slot overflow',()=>{
  const old:CareerExtras={...freshExtras(),inventory:['deck-flow','bearings-quiet','bearings-endurance','unknown-prize'],equipped:{deck:'deck-flow',bearings:'bearings-quiet'},equipmentVersion:undefined,accessories:undefined};
  const copy=structuredClone(old),converted=upgradeEquipment(old);
  assert.deepEqual(old,copy);assert.equal(converted.equipmentVersion,2);assert.equal(converted.equipped.deck,'deck-flow');
  assert.equal(converted.equipped.bearings,undefined);assert.deepEqual(converted.accessories,['bearings-quiet']);
  assert.ok(converted.inventory.includes('bearings-endurance'));assert.ok(converted.inventory.includes('unknown-prize'));assert.ok(!converted.inventory.includes('acc_011'));
  assert.deepEqual(upgradeEquipment(converted),converted);assert.equal(new Set(converted.inventory).size,converted.inventory.length);
  assert.equal(legacyBonuses({extras:old}).speed,4);assert.equal(gearBonuses({extras:converted}).speed,4);
  const full=upgradeEquipment({...old,accessories:['acc_001','acc_002','acc_003']});
  assert.equal(full.accessories!.length,3);assert.deepEqual(full.legacyEquipment!.overflow,['bearings-quiet']);
  const unknown=upgradeEquipment({...old,equipped:{bearings:'lost-bearing'}});assert.ok(unknown.inventory.includes('lost-bearing'));assert.ok(unknown.legacyEquipment!.unmapped.includes('lost-bearing'));
});

test('new prices retain early gear affordability and resale uses the real purchase basis without altering existing money',()=>{
  const c=career(),r=c.rider!,deck=ITEM.get('deck_008')!;
  assert.ok(ITEM.get('deck_002')!.price+ITEM.get('acc_001')!.price<RULES.startMoney);
  r.money=10_000_000;give(c,[deck.id]);const before=r.money,records=structuredClone(r.records);
  command(c,{type:'trade',operation:'equip',item:deck.id},identity);assert.equal(r.money,before);assert.deepEqual(r.records,records);
  assert.equal(resaleValue(r,deck),Math.floor(PREVIOUS_PRICES[deck.id]*ECONOMY.sellRate));
  command(c,{type:'trade',operation:'sell',item:deck.id},identity);assert.equal(r.money,before+121000);
  command(c,{type:'trade',operation:'buy',item:deck.id},identity);assert.equal(r.extras!.purchasePrices![deck.id],deck.price);
  const paid=r.money;command(c,{type:'trade',operation:'sell',item:deck.id},identity);
  assert.equal(r.money,paid+Math.floor(deck.price*ECONOMY.sellRate));assert.equal(r.extras!.purchasePrices![deck.id],undefined);
});

test('buy/equip/sell enforce ownership, three unique accessories and free-item protection without changing base stats',()=>{
  const c=career(),r=c.rider!;r.money=3000000;const base={...r.stats};
  for(const id of ['deck_006','truck_005','wheel_005','acc_001','acc_002','acc_003','acc_004'])command(c,{type:'trade',operation:'buy',item:id},identity);
  for(const id of ['deck_006','truck_005','wheel_005','acc_001','acc_002','acc_003'])equip(c,id);
  assert.deepEqual(r.stats,base);assert.deepEqual(equipmentStats(r),{speed:5,carve:5,link:5,balance:2});
  assert.equal(effectiveStats(r).link,base.link+5);
  equip(c,'acc_001');assert.equal(r.extras!.accessories!.length,3);
  assert.throws(()=>equip(c,'acc_004'),GameError);assert.throws(()=>equip(c,'acc_030'),GameError);
  assert.equal(gearBonuses(r).injury,.02);
  const money=r.money;assert.throws(()=>command(c,{type:'trade',operation:'buy',item:'acc_001'},identity),GameError);assert.equal(r.money,money);
  command(c,{type:'trade',operation:'sell',item:'acc_002'},identity);assert.ok(!r.extras!.accessories!.includes('acc_002'));assert.ok(!r.extras!.inventory.includes('acc_002'));
  command(c,{type:'unequip',slot:'accessory',item:'acc_001'},identity);assert.deepEqual(r.extras!.accessories,['acc_003']);
  command(c,{type:'unequip',slot:'deck'},identity);assert.equal(equipmentStats(r).link,0);
  assert.throws(()=>command(c,{type:'trade',operation:'sell',item:'deck_001'},identity),GameError);
  assert.throws(()=>command(c,{type:'trade',operation:'buy',item:'acc_018'},identity),GameError);
  assert.deepEqual(r.stats,base);
  r.extras!.equipped.trucks='deck_008';r.extras!.accessories=['deck_008'];give(c,['deck_008']);assert.equal(equipmentStats(r).balance,0,'Wrong slots must not stack another deck');
});

test('training previews and real actions share cost, growth, mastery, recovery and once-per-injury tape rules',()=>{
  const c=career(),r=c.rider!;give(c,['acc_004','acc_005','acc_006','acc_007','acc_009']);equip(c,'acc_004');equip(c,'acc_005');equip(c,'acc_006');
  r.energy=30;r.injury={severity:'minor',weeks:5,treated:false};
  const rest={action:'rest' as const,spot:'river' as const},forecast=previewTraining(r,rest);assert.equal(forecast.energy,43);
  week(c,rest);assert.equal(r.energy,forecast.energyAfter);assert.equal(r.injury!.weeks,3);assert.equal(r.injury!.taped,true);
  r.plan=null;r.phase='plan';command(c,{type:'unequip',slot:'accessory',item:'acc_006'},identity);equip(c,'acc_006');week(c,rest);assert.equal(r.injury!.weeks,2,'Re-equipping tape must not shorten the same injury twice');
  r.injury=null;r.plan=null;r.phase='plan';command(c,{type:'unequip',slot:'accessory',item:'acc_004'},identity);equip(c,'acc_009');
  const p:Plan={action:'link',spot:'plaza'};const before=r.stats.link,preview=previewTraining(r,p);assert.equal(preview.energy,-16);
  week(c,p);assert.equal(r.energy,preview.energyAfter);assert.ok(r.stats.link===before||r.stats.link-before>=preview.gains.link!.min-.0001);
  const m=career(),mr=m.rider!;give(m,['acc_007']);equip(m,'acc_007');mr.skills.cross={study:100,mastery:20};
  const target:Plan={action:'dance',spot:'studio',skill:'cross'},estimate=previewTraining(mr,target);week(m,target);
  assert.ok(mr.skills.cross.mastery-20>=estimate.skill!.min-.0001);assert.ok(mr.skills.cross.mastery-20<=estimate.skill!.max+.0001);
});

test('competition scores use stat gear once and ignore cosmetic and relationship mastery accessories',()=>{
  const c=career(),r=c.rider!;for(const skill of SKILLS)r.skills[skill.id]={study:100,mastery:55};
  const ids=['peter-pan','cross','step-180','peter-pan','cross','step-180'];
  const original=simulateRun(r,'dance',ids,()=>.1);
  give(c,['acc_014']);equip(c,'acc_014');assert.deepEqual(simulateRun(r,'dance',ids,()=>.1),original);
  give(c,['acc_yu_friend','acc_jun_rival']);equip(c,'acc_yu_friend');equip(c,'acc_jun_rival');
  assert.deepEqual(simulateRun(r,'dance',ids,()=>.1),original);
  give(c,['truck_007','wheel_007','deck_008']);equip(c,'truck_007');equip(c,'wheel_007');equip(c,'deck_008');
  const improved=simulateRun(r,'dance',ids,()=>.1);assert.ok(improved.parts.carve!>original.parts.carve!);assert.ok(improved.parts.speed!>original.parts.speed!);
  const meet=simulateMeet(r,CALENDAR[0],['dance'],true).results[0];assert.equal(meet.proof!.rules,4);assert.deepEqual(meet.proof!.stats,r.stats);
  r.week=7;r.phase='meet';command(c,{type:'entry',disciplines:['dance']},identity,true);command(c,{type:'retire'},identity,true);
  assert.ok(verifiedResult(c.hall[0],c.hall[0].records[0],c.hall[0].records[0].results[0]));
});

test('competition reward/entry effects apply, while low stamina still does not reduce performance',()=>{
  const c=career(),r=c.rider!;const baseline=simulateMeet(r,CALENDAR[0],['dance'],true).results[0];
  give(c,['acc_015','acc_016','acc_017']);equip(c,'acc_015');equip(c,'acc_016');equip(c,'acc_017');
  const enhanced=simulateMeet(r,CALENDAR[0],['dance'],true).results[0];assert.deepEqual(enhanced.run,baseline.run);
  assert.equal(enhanced.prize,Math.round((baseline.prize-baseline.participation!)*1.03)+baseline.participation!);assert.ok(enhanced.fame>=baseline.fame);
  r.energy=0;const exhausted=simulateMeet(r,CALENDAR[0],['dance'],true).results[0];assert.deepEqual(exhausted.run,enhanced.run);assert.equal(exhausted.energy,0);
});

test('story gifts and item-specific events are reachable, grant once and increase NPC relations consistently',()=>{
  const c=career(),r=c.rider!;r.phase='event';r.event='crew-sticker';command(c,{type:'event',index:0},identity);
  assert.ok(r.extras!.inventory.includes('acc_021'));r.phase='plan';equip(c,'acc_021');
  r.phase='event';r.event='harin-lap';command(c,{type:'event',index:0},identity);assert.equal(r.relations.ha,10);
  r.phase='event';r.event='crew-sticker';command(c,{type:'event',index:0},identity);assert.equal(r.extras!.inventory.filter(id=>id==='acc_021').length,1);
  r.phase='plan';give(c,['acc_022','acc_023','acc_029']);equip(c,'acc_022');
  for(const event of EVENTS){r.events[event.id]=1;r.extras!.choices[event.id]={index:0,year:r.year,week:r.week};}
  delete r.events['duck-blessing'];delete r.extras!.choices['duck-blessing'];assert.ok(eventFor(r,'duck-blessing')!.when(r));assert.equal(pickEvent(r,()=>0)?.id,'duck-blessing');
});

test('automatic play keeps the exact loadout and inventory; no purchases or swaps occur',()=>{
  const c=career(),r=c.rider!;give(c,['acc_005','acc_007']);equip(c,'acc_005');equip(c,'acc_007');
  const equipped=structuredClone(r.extras!.equipped),accessories=[...r.extras!.accessories!],inventory=[...r.extras!.inventory];
  r.settings={mode:'auto',strategy:'dance',entries:[]};for(let i=0;i<5;i++)assert.ok(processWeek(c));
  assert.deepEqual(r.extras!.equipped,equipped);assert.deepEqual(r.extras!.accessories,accessories);assert.deepEqual(r.extras!.inventory,inventory);
});
