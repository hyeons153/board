import { RIVAL } from '../game/content';
import { RELATIONSHIP_NAMES, relationshipEpilogues } from '../game/relationships';
import type { Archive } from '../game/types';

export function RelationshipEpilogues({archive}:{archive:Archive}){
  const endings=relationshipEpilogues(archive);
  if(!endings.length)return null;
  return <div className="epilogue relationship-epilogue">
    <strong>관계 에필로그</strong>
    {endings.map(({npc,state,text})=><div key={npc}>
      <b>{RIVAL.get(npc)?.name} · {RELATIONSHIP_NAMES[state]}</b><p>{text}</p>
    </div>)}
  </div>;
}
