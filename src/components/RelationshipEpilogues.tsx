import { RIVAL } from '../game/content';
import { crewEpilogue, RELATIONSHIP_NAMES, relationshipEpilogues } from '../game/relationships';
import type { Archive } from '../game/types';

export function RelationshipEpilogues({archive,collapsed=false,legacyFriends=[]}:{archive:Archive;collapsed?:boolean;legacyFriends?:string[]}){
  const endings=relationshipEpilogues(archive).map(({npc,state,text})=>({npc,name:RIVAL.get(npc)?.name,state:RELATIONSHIP_NAMES[state],text}));
  const legacy=legacyFriends.map(npc=>({
    npc,name:RIVAL.get(npc)?.name,state:'동료',text:`${RIVAL.get(npc)?.name}와 함께한 스팟과 대회 이야기는 은퇴식 뒤에도 이어졌다.`,
  }));
  const entries=[...endings,...legacy];
  const crew=crewEpilogue(archive);
  if(!entries.length&&!crew)return null;
  const stories=<>
    {crew&&<p>{crew}</p>}
    {entries.map(({npc,name,state,text})=><div key={npc}>
      <b>{name} · {state}</b><p>{text}</p>
    </div>)}
  </>;
  if(!collapsed)return <div className="epilogue relationship-epilogue"><strong>관계 에필로그</strong>{stories}</div>;
  const summary=entries.map(({name,state})=>`${name} ${state}`);
  if(crew)summary.push('크루 이야기');
  return <details className="epilogue relationship-epilogue">
    <summary><strong>관계 에필로그</strong><span>{summary.join(' · ')}</span></summary>
    <div className="epilogue-stories">{stories}</div>
  </details>;
}
