import type { Archive } from '../src/game/types.js';
import { RANKING_VERSION } from '../src/game/public.js';
import type { Database, Query } from './database.js';
import { publicationFor, type RankEntry } from './ranking.js';

export async function saveHonorEntries(db:Query,id:string,entries:RankEntry[]){
  await db.query('DELETE FROM rider_rankings WHERE public_id=$1 AND version=$2',[id,RANKING_VERSION]);
  if(!entries.length)return;
  await db.query(`INSERT INTO rider_rankings(public_id,metric,scope,version,score)
    SELECT $1,entry.metric,'all',$2,entry.score
    FROM jsonb_to_recordset($3::jsonb) AS entry(metric text,score double precision)`,[id,RANKING_VERSION,JSON.stringify(entries)]);
}

export async function refreshPublicHall(db:Database,apply:boolean){
  const counts={checked:0,ranked:0,missing:0,updated:0};
  let after:string|null=null;
  const load=(tx:Query,id:string,lock:boolean)=>tx.query<{archive:Archive|null}>(`
    SELECT saved.archive FROM public_riders p JOIN rider_careers c ON c.user_id=p.owner_id
    LEFT JOIN LATERAL (
      SELECT item AS archive FROM jsonb_array_elements(c.snapshot#>'{career,hall}') AS item
      WHERE item->>'id'=p.archive_id::text LIMIT 1
    ) saved ON true
    WHERE p.id=$1 AND p.active AND NOT p.hidden AND p.profile->>'rankingVersion' IS DISTINCT FROM $2
    ${lock?'FOR UPDATE OF p':''}`,[id,String(RANKING_VERSION)]);

  for(;;){
    const batch:{id:string;ownerId:string}[]=await db.query(`SELECT id,owner_id AS "ownerId" FROM public_riders
      WHERE active AND NOT hidden AND profile->>'rankingVersion' IS DISTINCT FROM $1
      AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT 32`,[String(RANKING_VERSION),after]);
    if(!batch.length)return counts;
    for(const row of batch){
      const refresh=async(tx:Query)=>{
        // The account lock is also acquired by publishing, withdrawing, and deleting.
        if(apply)await tx.query('SELECT id FROM rider_users WHERE id=$1 FOR UPDATE',[row.ownerId]);
        const [source]=await load(tx,row.id,apply);
        if(!source)return;
        if(!source.archive)return {ranked:false,missing:true,updated:false};
        const {profile,entries}=publicationFor(source.archive);
        if(apply){
          await tx.query('UPDATE public_riders SET profile=$2::jsonb WHERE id=$1',[row.id,JSON.stringify(profile)]);
          await saveHonorEntries(tx,row.id,entries);
        }
        return {ranked:entries.length>0,missing:false,updated:apply};
      };
      const result=apply?await db.transaction(refresh):await refresh(db);
      if(result){
        counts.checked++;counts.ranked+=Number(result.ranked);counts.missing+=Number(result.missing);counts.updated+=Number(result.updated);
      }
    }
    after=batch.at(-1)!.id;
  }
}
