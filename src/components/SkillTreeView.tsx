import { useId, type ReactNode } from 'react';
import { DISCIPLINE_NAMES, SKILL, SKILLS } from '../game/data';
import type { Skill } from '../game/types';

const cardWidth=156;
const cardHeight=80;
const columnGap=46;
const rowGap=20;
const padding=14;

// Vertical lanes keep the main chains straight while leaving room for their branches.
const lanes=[
  ['peter-pan','sidewinder','v-spin','pivot','shuvit','no-com-big','bigspin','bigger'],
  ['step-180','step-360','ollie','kickflip','varial','treflip'],
  ['piglet','pirouette','pirouette-540','pirouette-720','pop-shuvit','heelflip','hardflip'],
  ['cross','back-cross','p2p','no-comply','front-pop'],
  ['wood','pendulum','mango-pendulum'],
  ['mango'],
  ['ghost'],
];

const layers=new Map<string,number>();
function layer(skill:Skill):number{
  const existing=layers.get(skill.id);
  if(existing!==undefined)return existing;
  const depth=skill.requires.reduce((max,id)=>Math.max(max,layer(SKILL[id]!)+1),0);
  layers.set(skill.id,depth);
  return depth;
}

const positions=new Map(SKILLS.map(skill=>[skill.id,{
  x:layer(skill)*(cardWidth+columnGap),
  y:lanes.findIndex(lane=>lane.includes(skill.id))*(cardHeight+rowGap),
}]));

function includePrerequisites(ids:Set<string>,skill:Skill){
  if(ids.has(skill.id))return;
  ids.add(skill.id);
  for(const id of skill.requires)includePrerequisites(ids,SKILL[id]!);
}

export function SkillTreeView({skills,node}:{
  skills:Skill[];
  node:(skill:Skill,prerequisite:boolean)=>ReactNode;
}){
  const arrowId=useId();
  const matching=new Set(skills.map(skill=>skill.id));
  const visible=new Set<string>();
  for(const skill of skills)includePrerequisites(visible,skill);

  return <div className="skill-tree-scroll" role="region" aria-label="스킬트리" tabIndex={0}>
    {(['dance','trick'] as const).map(family=>{
      const group=SKILLS.filter(skill=>skill.family===family&&visible.has(skill.id));
      if(!group.length)return null;
      const coordinates=group.map(skill=>positions.get(skill.id)!);
      const left=Math.min(...coordinates.map(point=>point.x));
      const top=Math.min(...coordinates.map(point=>point.y));
      const width=Math.max(...coordinates.map(point=>point.x))-left+cardWidth+padding*2;
      const height=Math.max(...coordinates.map(point=>point.y))-top+cardHeight+padding*2;
      // Give incoming arrows separate vertical lanes so adjacent branches don't merge.
      const incomingByColumn=new Map<number,number>();
      const routedByColumn=new Map<number,number>();
      for(const [index,skill] of group.entries()){
        const column=coordinates[index].x;
        incomingByColumn.set(column,(incomingByColumn.get(column)??0)+skill.requires.length);
      }
      const edges=group.flatMap(skill=>skill.requires.map((id,index)=>{
        const from=positions.get(id)!, to=positions.get(skill.id)!;
        const startX=from.x+cardWidth, endX=to.x-3;
        const startY=from.y+cardHeight/2;
        const endY=to.y+cardHeight/2+(index-(skill.requires.length-1)/2)*12;
        const lane=(routedByColumn.get(to.x)??0)+1;
        routedByColumn.set(to.x,lane);
        const approach=endX-8-(columnGap-24)*lane/((incomingByColumn.get(to.x)??1)+1);
        const detourY=from.y+cardHeight+rowGap/2;
        const path=to.x-from.x>cardWidth+columnGap
          ?`M${startX} ${startY} H${startX+10} V${detourY} H${approach} V${endY} H${endX}`
          :`M${startX} ${startY} H${approach} V${endY} H${endX}`;
        return <path key={id+'-'+skill.id} d={path} markerEnd={`url(#${arrowId}-${family})`}/>;
      }));
      return <section key={family} className="skill-tree-group">
        <h2>{DISCIPLINE_NAMES[family]}</h2>
        <div className="skill-tree-canvas" style={{width,height}}>
          <svg aria-hidden="true" width={width} height={height} viewBox={`${left-padding} ${top-padding} ${width} ${height}`}>
            <defs><marker id={`${arrowId}-${family}`} markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 Z"/>
            </marker></defs>
            <g>{edges}</g>
          </svg>
          {group.map((skill,index)=><div key={skill.id} className="skill-tree-node" style={{
            left:coordinates[index].x-left+padding,top:coordinates[index].y-top+padding,width:cardWidth,height:cardHeight,
          }}>{node(skill,!matching.has(skill.id))}</div>)}
        </div>
      </section>;
    })}
  </div>;
}
