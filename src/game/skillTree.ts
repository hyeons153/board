import { SKILL, SKILLS } from './data.js';
import type { Family, Progress, Rider, Skill } from './types.js';

export const learned=(skills:Record<string,Progress>,id:string)=>(skills[id]?.study??0)>=100;
export const mastered=(skills:Record<string,Progress>,id:string)=>learned(skills,id)&&(skills[id]?.mastery??0)>=100;
export const missingMastery=(skills:Record<string,Progress>,skill:Skill)=>skill.requires.filter(id=>!mastered(skills,id));
export function canStudy(r:Pick<Rider,'skills'>,id:string){
  const skill=SKILL[id];
  return !!skill&&(learned(r.skills,id)||missingMastery(r.skills,skill).length===0);
}

const trainingGoals:Record<Family,string[]>={
  dance:['sidewinder','step-360','back-cross','pirouette-720','v-spin','mango-pendulum','p2p'],
  trick:['kickflip','front-pop','bigger','varial','hardflip','treflip'],
};

export function nextSkillTraining(r:Pick<Rider,'skills'>,family:Family):Skill|undefined{
  const goal=trainingGoals[family].find(id=>!mastered(r.skills,id))??
    SKILLS.find(skill=>skill.family===family&&!mastered(r.skills,skill.id))?.id;
  let target=SKILL[goal??''];
  while(target&&!learned(r.skills,target.id)){
    const prerequisite=missingMastery(r.skills,target)[0];
    if(!prerequisite)break;
    target=SKILL[prerequisite];
  }
  return target;
}
