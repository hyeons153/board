import { ACTION_NAMES, CALENDAR, DISCIPLINE_NAMES, LOCATIONS, RULES, SKILL, SKILLS, START_SKILLS, STAT_NAMES } from './data.js';
import { generateRoutine, learned, simulateMeet, validRoutine } from './competition.js';
import { autoChoice, canStudy, eventFor, eventPaused, pickEvent } from './events.js';
import { chooseEnding, honors, mentorFrom } from './legacy.js';
import { RANKING_VERSION } from './public.js';
import { RIVALS, SPOT_GATE, spotUnlocked } from './content.js';
import { ECONOMY, effectiveStats, eligibleSponsor, equipmentReaction, equipmentUnlocked, extras, freshExtras, gearBonuses, ITEM, maintainedSponsor, milestone, playerPlace, SPONSOR, STARTER_IDS, supply, unlockEquipment, upgradeEquipment } from './economy.js';
import { clamp, round, seeded } from './random.js';
import { statAfter, trainingCost, trainingFactor, trainingStatGains, trainingSuccess } from './training.js';
import { DISCIPLINES, STATS, type Rider, type Career, type GameAction, type Look, type Division, type Season, type Plan, type Discipline, type News, type Family } from './types.js';

export class GameError extends Error {}
export const divisionFor=(year:number):Division=>year<=1?'rookie':year<=3?'regular':year<=5?'open':'master';
export const currentMeet=(r:Rider)=>CALENDAR.find(m=>m.week===r.week);
export const nextMeet=(r:Rider)=>CALENDAR.find(m=>m.week>=r.week);
const makeSeason=(year:number):Season=>({year,division:divisionFor(year),scores:{dance:{},trick:{},freestyle:{}}});
export function newRider(id:string,seed:number,name:string,look:Look):Rider {
  return {
    id,seed,name,look,year:1,week:1,stats:{...RULES.startStats},energy:100,money:RULES.startMoney,fame:0,injury:null,
    skills:structuredClone(START_SKILLS),relations:Object.fromEntries(RIVALS.map(n=>[n.id,0])),events:{},extras:freshExtras(),
    settings:{mode:'manual',strategy:'balanced',entries:['dance']},plan:null,spot:'river',phase:'plan',event:null,
    entries:null,routines:{dance:[],trick:[],freestyle:[]},records:[],season:makeSeason(1),seasons:[],
    news:[{year:1,week:1,type:'system',text:'새 보드, 새 출발. 첫 주의 연습을 정해 보자!'}],reason:null,
  };
}
function note(r:Rider,type:News['type'],text:string) {
  r.news.unshift({year:r.year,week:r.week,type,text});
  r.news=r.news.slice(0,32);
}
function stat(r:Rider,name:typeof STATS[number],gain:number) {
  const current=r.stats[name];
  r.stats[name]=statAfter(current,gain);
}
function trainSkill(r:Rider,id:string,gain:number,mastery:number) {
  const now=r.skills[id]??{study:0,mastery:0};
  const was=now.study>=100;
  now.study=round(clamp(now.study+gain));
  if(now.study>=100) now.mastery=round(clamp(Math.max(was?0:17,now.mastery)+mastery));
  r.skills[id]=now;
  if(!was&&now.study>=100){
    const name=SKILL[id]!.name;
    note(r,'training',`새 기술 습득: ${name}!`);
    milestone(r,'신규 기술 습득',name);
    award(r,'learn','첫 신규 기술');
    if(SKILLS.filter(s=>learned(r.skills,s.id)).length>=15) award(r,'variety','기술 15개 습득');
    return true;
  }
  return false;
}
function award(r:Rider,id:keyof typeof ECONOMY.achievements,label:string){
  const progress=r.extras ??= freshExtras();
  if(progress.achievements.includes(id)) return;
  progress.achievements.push(id);
  r.money+=ECONOMY.achievements[id];
  milestone(r,'업적 달성',label+` · ₩${ECONOMY.achievements[id].toLocaleString('ko-KR')}`);
}
export function validatePlan(r:Rider,p:Plan) {
  if(r.phase!=='plan') throw new GameError('먼저 진행 중인 이벤트나 대회를 마쳐 주세요.');
  if (r.injury?.severity==='major' && !r.injury.treated && p.action!=='rest' && p.action!=='hospital') throw new GameError('중상 치료를 받거나 휴식해 주세요.');
  if (p.action==='hospital'&&!r.injury) throw new GameError('치료가 필요한 부상이 없어요.');
  if(!spotUnlocked(r,p.spot)) throw new GameError(SPOT_GATE[p.spot]!.hint);
  if(p.action==='rehearsal'&&p.spot!=='arena') throw new GameError('대회 연습장에서만 라인 리허설을 할 수 있어요.');
  if(p.discipline&&p.action!=='rehearsal') throw new GameError('종목 선택은 라인 리허설에만 사용해요.');
  if (p.skill && (SKILL[p.skill]?.family!==p.action||!canStudy(r,p.skill))) throw new GameError('아직 연마할 수 없는 기술이에요.');
  if(p.lesson&&(!p.skill||!['studio','night','arena'].includes(p.spot)||r.money<ECONOMY.lesson))
    throw new GameError('레슨은 실내·야간·대회 연습장에서 기술을 지정하고 레슨비를 확보해야 해요.');
}
function train(r:Rider,p:Plan) {
  const rng=seeded(r.seed,r.year,r.week,'training');
  const injuryBefore=r.injury;
  r.spot=p.spot;
  r.lastPlan=p;
  const names:string[]=[];
  const progress=r.extras=upgradeEquipment(r.extras??freshExtras());
  const bonuses=gearBonuses(r);
  const masteryGain=(id:string,amount:number)=>amount*(1+(SKILL[id]?.family==='dance'?bonuses.danceMastery:bonuses.trickMastery));
  let grade: NonNullable<typeof progress.lastTraining>['grade']='success';
  let practiced:string|undefined;
  if(p.action==='rest') {
    grade='recovery';
    r.energy=round(clamp(r.energy+RULES.restEnergy+bonuses.rest));
    names.push('체력을 회복했다.');
  } else if(p.action==='hospital'&&r.injury) {
    grade='recovery';
    const fee=Math.min(r.money,RULES.hospitalFee);
    r.money-=fee;
    r.injury={...r.injury,treated:true,weeks:r.injury.weeks-2};
    if(r.injury.weeks<=0) r.injury=null;
    r.energy=clamp(r.energy+24);
    names.push(fee<RULES.hospitalFee?'연맹 의료 지원으로 치료를 받았다.':`치료비 ₩${fee.toLocaleString('ko-KR')}를 지불했다.`);
  } else {
    const spot=LOCATIONS[p.spot];
    const energyBefore=r.energy;
    const practice=RULES.practice;
    const attempted=SKILL[p.skill??''];
    const form=rng();
    const success=trainingSuccess(r,p);
    const missed=form<1-success;
    const great=form>1-practice.greatChance-bonuses.great&&!r.injury&&energyBefore>=55;
    const factor=trainingFactor(r,p,form,great);
    const late=RULES.growth[Math.min(7,r.year-1)];
    const gains=trainingStatGains(r,p,factor);
    if(p.lesson){
      r.money-=ECONOMY.lesson;
      names.push(`레슨비 ₩${ECONOMY.lesson.toLocaleString('ko-KR')}.`);
    }
    grade=missed?'miss':great?'great':'success';
    r.energy=round(clamp(r.energy-trainingCost(r,p)));
    let difficulty=attempted?.difficulty??1, mastery=attempted?(r.skills[attempted.id]?.mastery??12):60;
    if(missed){
      names.push(`훈련에 실패했다. 훈련 전 체력 ${round(energyBefore)} · 성공률 ${Math.round(success*100)}%. 능력치는 오르지 않았다.`);
    } else if (p.action==='dance'||p.action==='trick') {
      const candidates=SKILLS.filter(s=>s.family===p.action&&canStudy(r,s.id));
      const reachable=candidates.filter(s=>!learned(r.skills,s.id));
      const target=p.skill?attempted:(rng()<practice.discovery+bonuses.discovery&&reachable.length?reachable[Math.floor(rng()*reachable.length)]:undefined);
      if(target){
        difficulty=target.difficulty; mastery=r.skills[target.id]?.mastery??12;
        practiced=target.id;
        const learnedBefore=learned(r.skills,target.id);
        const gain=RULES.study*factor*late.study*(p.skill?practice.targeted:1)/(1+practice.difficultyCost*(difficulty-1));
        if(trainSkill(r,target.id,gain,masteryGain(target.id,RULES.mastery*factor*late.mastery))) grade='learned';
        else if(learnedBefore&&!great) grade='mastery';
        names.push(`${target.name} · ${learned(r.skills,target.id)?'숙련도 '+r.skills[target.id].mastery+'%':'학습 '+r.skills[target.id].study+'%'}.`);
      }
      const ready=candidates.filter(s=>s.id!==target?.id&&learned(r.skills,s.id));
      if(!p.skill && ready.length) {
        const first=Math.floor(rng()*ready.length);
        for(const s of [...ready.slice(first),...ready.slice(0,first)].slice(0,2)) trainSkill(r,s.id,0,masteryGain(s.id,RULES.mastery*factor*late.mastery*.66));
        names.push('배운 기술의 숙련도가 올랐다.');
        if(grade==='success') grade='mastery';
      }

    } else if(p.action==='rehearsal'){
      const discipline=p.discipline??'freestyle';
      const ids=r.routines[discipline].length?r.routines[discipline]:generateRoutine(r,discipline,'flow');
      for(const id of [...new Set(ids)].slice(0,4)) trainSkill(r,id,0,masteryGain(id,practice.rehearsalMastery*factor*late.mastery));

      if(!great) grade='mastery';
      practiced=ids[0];
      names.push(`${DISCIPLINE_NAMES[discipline]} 라인의 연계와 기술 숙련도를 점검했다.`);
    } else if (p.action!=='hospital') {
      names.push(`주 능력치 +${gains[p.action]??0}.`);
    }
    if(!missed)for(const stat of STATS)r.stats[stat]=round(r.stats[stat]+(gains[stat]??0));
    const risk=RULES.injury;
    const pInjury=clamp((risk.base+(100-energyBefore)*risk.energy+(difficulty-1)*risk.difficulty-(effectiveStats(r).balance+mastery*.34)*risk.stability)*spot.risk+(r.injury?.03:0)-bonuses.injury,.004,.38);
    if(rng()<pInjury){
      const major=rng()<clamp(.12+(difficulty-1)*.06+(100-energyBefore)*.002,0,.48) || r.injury?.severity==='major';
      r.injury={severity:major?'major':'minor',weeks:major?risk.majorWeeks:risk.minorWeeks,treated:false};
      names.push(major?'중상을 입었다.':'경상을 입었다.');
      grade='injury';
      milestone(r,'부상',names.at(-1)!);
    }
  }
  if(r.injury===injuryBefore && r.injury){
    r.injury.weeks=Math.max(r.injury.severity==='major'&&!r.injury.treated?1:0,r.injury.weeks-1);
    if(r.injury.weeks<=0){ r.injury=null; names.push('부상이 회복되었다.'); }
  }
  if(r.injury?.severity==='minor'&&!r.injury.taped&&bonuses.minorRecovery){
    r.injury.weeks-=bonuses.minorRecovery;r.injury.taped=true;names.push('테이핑 키트로 경상 회복 1주 단축.');if(r.injury.weeks<=0)r.injury=null;
  }
  r.money=Math.max(RULES.safetyFund,r.money+RULES.weeklyAllowance);
  const text=`${ACTION_NAMES[p.action]} · ${names.join(' ')}`;
  progress.lastTraining={grade,text,skill:practiced,year:r.year,week:r.week,reaction:equipmentReaction(r,grade)};
  note(r,'training',text);
}
function autoPlan(r:Rider):Plan {
  const base:Plan={action:'rest',spot:r.spot};
  if(r.injury?.severity==='major'&&!r.injury.treated) return {...base,action:'hospital'};
  if(r.injury) return {...base};
  const soon=(nextMeet(r)?.week??54)-r.week;
  const need=r.settings.entries.reduce((s,d)=>s+RULES.entryCost[d],0);
  const restAt=45;
  if(r.energy<restAt) return base;
  const rng=seeded(r.seed,r.year,r.week,'auto');
  const strategy=r.settings.strategy;
  if(soon===1&&need>0&&r.energy>=83&&spotUnlocked(r,'arena')&&rng()<(strategy==='freestyle'?.78:.35)){
    const focus=strategy!=='balanced'&&r.settings.entries.includes(strategy)?strategy:r.settings.entries[0];
    return {...base,action:'rehearsal',spot:'arena',discipline:focus};
  }
  const family:Family=rng()<(strategy==='dance'?.86:strategy==='trick'?.16:.51)?'dance':'trick';
  const available=SKILLS.filter(s=>s.family===family&&canStudy(r,s.id));
  const priorities=available.filter(s=>!learned(r.skills,s.id)).sort((a,b)=>(r.skills[b.id]?.study??0)-(r.skills[a.id]?.study??0)||a.difficulty-b.difficulty);
  if(rng()<(strategy==='balanced'?.39:.59)){
    const target=priorities[0] ?? [...available].filter(s=>(r.skills[s.id]?.mastery??0)<94).sort((a,b)=>(r.skills[a.id]?.mastery??0)-(r.skills[b.id]?.mastery??0))[0];
    const spot=target&&target.difficulty>=3&&spotUnlocked(r,'night')?'night':target&&rng()<.37?'studio':family==='dance'?'river':'plaza';
    return {...base,action:family,spot,skill:target?.id};
  }
  const prioritiesByStrategy = {
    balanced:{speed:0,carve:0,link:0,balance:0},
    dance:{speed:5,carve:9,link:10,balance:0},
    trick:{speed:0,carve:0,link:6,balance:10},
    freestyle:{speed:0,carve:5,link:8,balance:5},
  };
  const order=STATS.map(s=>({s,value:r.stats[s]+rng()*16-prioritiesByStrategy[strategy][s]})).sort((a,b)=>a.value-b.value);
  const s=order[0].s;
  return {...base,action:s,spot:s==='speed'?'river':s==='link'?'plaza':'park'};
}
export function prepareWeek(r:Rider|undefined|null){
  if(r?.phase==='plan'&&r.settings.mode==='auto'&&!r.plan){r.plan=autoPlan(r);r.spot=r.plan.spot;}
}
function applyEvent(r:Rider,index:number){
  const e=eventFor(r,r.event??'');
  const choice=e?.choices[index];
  if(!e||!choice) throw new GameError('선택할 수 없는 이벤트예요.');
  const fx=choice.effect;
  const details:string[]=[];
  const energyBefore=r.energy,moneyBefore=r.money;
  r.energy=round(clamp(r.energy+(fx.energy??0)));
  r.money=Math.max(0,r.money+(fx.money??0));
  r.fame+=fx.fame??0;
  if(r.energy!==energyBefore) details.push(`체력 ${round(r.energy-energyBefore)>0?'+':''}${round(r.energy-energyBefore)}`);
  if(r.money!==moneyBefore) details.push(`보유금 ${(r.money-moneyBefore).toLocaleString('ko-KR')}원`);
  if(fx.fame) details.push(`명성 +${fx.fame}`);
  if(fx.stat){
    const before=r.stats[fx.stat];stat(r,fx.stat,fx.gain??0);
    if(r.stats[fx.stat]>before) details.push(`${STAT_NAMES[fx.stat]} +${round(r.stats[fx.stat]-before)}`);
  }
  const relation=(fx.relation??0)+(e.npc&&(fx.relation??0)>0?gearBonuses(r).relation:0);
  if(e.npc) r.relations[e.npc]=clamp((r.relations[e.npc]??0)+relation);
  if(e.npc&&fx.relation) details.push(`관계 +${relation}`);
  if(fx.skill&&canStudy(r,fx.skill)){
    trainSkill(r,fx.skill,fx.study??0,4);
    details.push(`${SKILL[fx.skill]!.name} ${learned(r.skills,fx.skill)?'습련':'학습'}`);
  }
  if(fx.item&&ITEM.has(fx.item)){
    const items=(r.extras??=freshExtras()).inventory;if(!items.includes(fx.item))items.push(fx.item);details.push(ITEM.get(fx.item)!.name+' 획득');
  }
  r.events[e.id]=(r.events[e.id]??0)+1;
  (r.extras ??= freshExtras()).choices[e.id]={index,year:r.year,week:r.week};
  r.event=null;
  const description=`${choice.label}${details.length?' · '+details.join(' / '):''}`;
  note(r,'event',`${e.title} · ${description}`);
  if(e.story||e.npc) milestone(r,e.title,description);
}
function finishWeek(c:Career,r:Rider) {
  if(r.week===RULES.weeks){
    for(const d of DISCIPLINES){
      const rows=Object.entries(r.season.scores[d]).sort(([a,x],[b,y])=>y-x||a.localeCompare(b));
      const place=rows.findIndex(([id])=>id==='player');
      if(place<0||place>=ECONOMY.podiumSeason.length) continue;
      const prize=ECONOMY.podiumSeason[place];
      r.money+=prize;
      milestone(r,'시즌 순위 보상',`${DISCIPLINE_NAMES[d]} ${place+1}위 · ₩${prize.toLocaleString('ko-KR')}`);
    }
    r.seasons.push(r.season);
    if(r.year===RULES.years){ retire(c,r,'complete'); return; }
    const progress=r.extras ??= freshExtras();
    const brand=SPONSOR.get(progress.contract?.id??'');
    const renew=brand&&maintainedSponsor(r,brand);
    progress.contract=null;
    r.year++; r.week=1; r.season=makeSeason(r.year);
    if(brand&&renew){
      supply(r,brand);
      milestone(r,'스폰서 계약 갱신',brand.name);
    } else if(brand) milestone(r,'스폰서 계약 종료',`${brand.name} · 지난 시즌 입상 조건 미달`);
    note(r,'system',`${r.year}년차가 시작됐다. 새 시즌 포인트를 쌓아 보자!`);
  } else r.week++;
  r.phase='plan'; r.plan=null; r.entries=null;
}
function runMeet(c:Career,r:Rider,disciplines:Discipline[],official:boolean) {
  const meet=currentMeet(r);
  if(!meet) throw new GameError('이번 주에 예정된 대회가 없어요.');
  if(r.records.some(m=>m.year===r.year&&m.id===meet.id)) throw new GameError('이미 끝난 대회입니다.');
  const entries=r.injury?.severity==='major'&&!r.injury.treated?[]:disciplines;
  const {results,rankings}=simulateMeet(r,meet,entries,official);
  for(const d of DISCIPLINES){
    const points=r.season.scores[d];
    for(const s of rankings[d]) points[s.id]=(points[s.id]??0)+Math.round(RULES.places[Math.min(s.place-1,5)]*(meet.major?RULES.majorMultiplier:1));
  }
  for(const result of results){
    const contract=extras(r).contract;
    const brand=contract?.year===r.year ? SPONSOR.get(contract.id) : undefined;
    if(brand?.discipline===result.discipline&&playerPlace(result)<=brand.place){
      result.sponsorBonus=brand.podium;
      result.prize+=brand.podium;
      milestone(r,'스폰서 입상 보너스',`${brand.name} · ₩${brand.podium.toLocaleString('ko-KR')}`);
    }
    r.energy=result.energy; r.money+=result.prize; r.fame=round(r.fame+result.fame);
    const landed=new Set(result.run.log.filter(l=>l.outcome!=='miss').map(l=>l.id));
    for(const id of landed) trainSkill(r,id,0,1.4);
  }
  r.records.push({year:r.year,id:meet.id,division:divisionFor(r.year),results});
  if(results.length){
    award(r,'meet','첫 대회 완주');
    if(results.some(result=>playerPlace(result)===1)) award(r,'win','첫 종목 우승');
    milestone(r,meet.name,results.map(result=>`${DISCIPLINE_NAMES[result.discipline]} ${playerPlace(result)}위 · ${result.run.score}점`).join(' / '));
  }
  unlockEquipment(r);
  note(r,'meet',`${meet.name} · ${results.length?results.map(x=>`${DISCIPLINE_NAMES[x.discipline]} ${x.standings.find(s=>s.id==='player')!.place}위`).join(' / '):'불참'}`);
  finishWeek(c,r);
}
function afterTraining(c:Career,r:Rider,official:boolean) {
  if(currentMeet(r)){
    r.phase='meet';
    if(r.settings.mode==='auto'){
      if(!r.settings.pauseMeet) runMeet(c,r,r.entries??r.settings.entries,official);
    } else if(r.entries!==null) runMeet(c,r,r.entries,official);
  } else finishWeek(c,r);
}
export function processWeek(c:Career,official=false) {
  const r=c.rider;
  if(!r||r.phase!=='plan'||(!r.plan&&r.settings.mode==='manual')) return false;
  r.extras=upgradeEquipment(r.extras??freshExtras());
  const plan=r.plan??autoPlan(r);
  validatePlan(r,plan);
  train(r,plan);
  r.plan=null;
  if(r.settings.mode==='auto'&&r.settings.pauseInjury&&r.extras?.lastTraining?.grade==='injury'){
    r.phase='injury';
    return true;
  }
  finishTraining(c,r,official);
  return true;
}
function finishTraining(c:Career,r:Rider,official:boolean){
  const event=pickEvent(r,seeded(r.seed,r.year,r.week,'event'));
  if(event){
    r.phase='event';
    r.event=event.id;
    if(eventPaused(r,event)) return;
    applyEvent(r,autoChoice(r,event));
  }
  afterTraining(c,r,official);
}
function retire(c:Career,r:Rider,reason:'complete'|'early'){
  r.phase='retired'; r.reason=reason; r.plan=null; r.event=null; r.entries=null;
  const seasons=reason==='complete'?r.seasons:[...r.seasons,r.season];
  const {id,name,look,year,week,stats,skills,records,relations,fame,events,rankedStart,extras:progression}=r;
  const archive={id,name,look,year,week,reason,stats,skills,records,seasons,relations,fame,events,rankedStart,extras:progression};
  c.hall.push(structuredClone({...archive,ending:chooseEnding(archive),honors:honors(archive)}));
  note(r,'system',reason==='complete'?'8년의 커리어를 마치고 명예의 전당에 이름을 남겼다.':'선수 생활을 마치고 명예의 전당에 이름을 남겼다.');
}
export function command(c:Career,a:GameAction,identity:()=>{id:string;seed:number},official=false,account=false){
  if(a.type==='pulse') return;
  const r=c.rider;
  if(a.type==='create'){
    if(r&&r.phase!=='retired') throw new GameError('이미 진행 중인 커리어가 있어요.');
    const {id,seed}=identity();
    c.rider=newRider(id,seed,a.name,a.look);
    if(official) c.rider.rankedStart=RANKING_VERSION;
    const previous=c.hall.at(-1);
    if(account&&previous) c.rider.mentor=mentorFrom(previous);
    return;
  }
  if(a.type==='switch-rider'){
    const rider=c.parked?.find(item=>item.id===a.id);
    if(!account||!rider) throw new GameError('전환할 선수가 없어요.');
    c.parked=(c.parked??[]).filter(item=>item.id!==a.id);
    if(r&&r.phase!=='retired') c.parked.push(r);
    c.rider=rider;
    return;
  }
  if(!r||r.phase==='retired') throw new GameError('먼저 새 선수를 만들어 주세요.');
  r.extras=upgradeEquipment(r.extras??freshExtras());
  unlockEquipment(r);
  if(a.type==='spot'){
    if(r.phase!=='plan'||r.plan||r.settings.mode==='auto')throw new GameError('직접 육성의 행동 선택 중에 스팟을 바꿀 수 있어요.');
    if(!spotUnlocked(r,a.spot))throw new GameError(SPOT_GATE[a.spot]!.hint);
    r.spot=a.spot;
  }
  if(a.type==='plan'){
    if(r.plan) throw new GameError('이번 주 행동은 이미 시작했어요. 끝난 뒤 다음 행동을 선택해 주세요.');
    if(r.settings.mode==='auto') throw new GameError('직접 육성으로 전환한 뒤 행동을 선택해 주세요.');
    validatePlan(r,a.plan); r.plan={...a.plan};Reflect.deleteProperty(r.plan,'intensity'); r.spot=a.plan.spot;
  }
  if(a.type==='routine'){
    if(!validRoutine(r,a.discipline,a.skills)) throw new GameError('종목에 맞는 습득 기술로 60초 이하의 라인을 구성해 주세요.');
    r.routines[a.discipline]=a.skills;
  }
  if(a.type==='settings'){
    r.settings={...a.settings};Reflect.deleteProperty(r.settings,'intensity');
    if(r.settings.mode==='auto'){
      if(r.phase==='event'){
        const e=eventFor(r,r.event??'');
        if(e&&eventPaused(r,e)) return;
        if(e) applyEvent(r,autoChoice(r,e));
        afterTraining(c,r,official);
      } else if(r.phase==='meet'&&!r.settings.pauseMeet) runMeet(c,r,r.entries??r.settings.entries,official);
    }
  }
  if(a.type==='resume'){
    if(r.phase!=='injury') throw new GameError('확인할 부상 알림이 없어요.');
    finishTraining(c,r,official);
  }
  if(a.type==='event'){
    if(r.phase!=='event') throw new GameError('응답할 이벤트가 없어요.');
    applyEvent(r,a.index); afterTraining(c,r,official);
  }
  if(a.type==='entry'){
    if(!currentMeet(r)) throw new GameError('대회 주차에만 출전을 신청할 수 있어요.');
    r.entries=a.disciplines;
    if(r.phase==='meet') runMeet(c,r,r.entries,official);
  }
  if(a.type==='trade'||a.type==='unequip'||a.type==='sponsor'||a.type==='makeover'){
    if(r.plan&&(a.type==='trade'||a.type==='unequip'))throw new GameError('이번 주 행동이 끝난 뒤 장비를 바꿔 주세요.');
    const progress=r.extras ??= freshExtras();
    const reserve=r.plan?.lesson?ECONOMY.lesson:0;
    if(a.type==='trade'){
      const item=ITEM.get(a.item);
      if(!item) throw new GameError('없는 장비입니다.');
      const owned=progress.inventory.includes(item.id);
      if(a.operation==='buy'){
        if(item.unlock||STARTER_IDS.includes(item.id))throw new GameError('이 아이템은 해금 또는 기본 지급으로 획득합니다.');
        if(owned||r.money-reserve<item.price) throw new GameError('이미 가진 장비이거나 구매 가능 금액이 부족해요.');
        r.money-=item.price;
        progress.inventory.push(item.id);
        milestone(r,'장비 구매',item.name+' · '+item.price.toLocaleString('ko-KR')+'원');
        note(r,'system',item.name+' 구매 완료');
      } else if(!owned) throw new GameError('보유한 장비만 사용할 수 있어요.');
      else if(a.operation==='equip'){
        if(!equipmentUnlocked(r,item))throw new GameError('해금 조건을 먼저 달성해 주세요.');
        if(item.slot==='accessory'){
          const list=progress.accessories??=[];
          if(list.includes(item.id))return;
          if(list.length>=3)throw new GameError('액세서리는 최대 3개입니다. 한 칸을 해제한 뒤 장착해 주세요.');
          list.push(item.id);milestone(r,'액세서리 장착',item.name);return;
        }
        if(progress.equipped[item.slot]!==item.id){
          progress.equipped[item.slot]=item.id;
          milestone(r,'장비 교체',item.name);
          note(r,'system',item.name+' 장착 완료');
        }
      }
      else {
        if(STARTER_IDS.includes(item.id)||item.unlock)throw new GameError('기본 지급·특별 해금 아이템은 판매할 수 없어요.');
        if(item.slot==='accessory')progress.accessories=progress.accessories?.filter(id=>id!==item.id);
        else if(progress.equipped[item.slot]===item.id)delete progress.equipped[item.slot];
        progress.inventory=progress.inventory.filter(id=>id!==item.id);
        r.money+=Math.floor(item.price*ECONOMY.sellRate);
        milestone(r,'장비 판매',item.name);
        note(r,'system',item.name+' 판매 완료');
      }
    }
    if(a.type==='unequip'){
      if(a.slot==='accessory'&&!a.item)throw new GameError('해제할 액세서리를 선택해 주세요.');
      const id=a.slot==='accessory'?a.item:a.slot==='bearings'?progress.legacyEquipment?.original.bearings:progress.equipped[a.slot];
      const item=ITEM.get(id??'');
      if(a.slot==='accessory'||a.slot==='bearings')progress.accessories=progress.accessories?.filter(candidate=>candidate!==id);
      else delete progress.equipped[a.slot];
      if(item) milestone(r,'장비 해제',item.name);
    }
    if(a.type==='makeover'){
      if(r.money-reserve<ECONOMY.makeover) throw new GameError('외형 변경 비용이 부족해요.');
      r.money-=ECONOMY.makeover;
      r.look=a.look;
    }
    if(a.type==='sponsor'){
      const brand=SPONSOR.get(a.id);
      if(!brand||!eligibleSponsor(r,brand)||progress.signedYear===r.year)
        throw new GameError('계약 조건을 확인해 주세요. 시즌당 한 곳과 계약할 수 있어요.');
      supply(r,brand);
      milestone(r,'스폰서 계약',brand.name);
      note(r,'system',brand.name+' 스폰서 계약');
    }
  }
  if(a.type==='retire') retire(c,r,'early');
}
export const defaultEntries=(r:Rider):Discipline[]=>DISCIPLINES.filter(d=>r.phase!=='retired'&&(r.settings.entries.includes(d)));
