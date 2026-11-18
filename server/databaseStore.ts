import { randomUUID } from 'node:crypto';
import { blankSave, type Save } from './clock.js';
import type { Database, Query } from './database.js';
import { mergeCareers } from '../src/game/legacy.js';
import { RANKING_VERSION, type Directory, type Metric, type Publication, type PublicCard, type PublicProfile, type Scope } from '../src/game/public.js';
import type { Row, Store } from './store.js';
import { publicationFor } from './ranking.js';

export const ACCOUNT_SECONDS=30*24*60*60;
const GUEST_SECONDS=365*24*60*60;
const PAGE_SIZE=16;
export type Actor={id:string;username:string|null};
export type LoginRecord={id:string;passwordHash:string};
export type DirectoryFilter={page:number;search:string;division:Scope;ending:string;complete:boolean;metric?:Metric};
type LegacyRow={id:string;expires:number;version:number;snapshot:Save};
type LocalLegacy=(hash:string)=>Promise<LegacyRow|undefined>;
export class AccessError extends Error {
  constructor(message:string,readonly status:number=400){super(message);}
}
const normalized=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('ko-KR');
const searchPrefix=(value:string)=>[...normalized(value)].map(char=>['%','_','\\'].includes(char)?'\\'+char:char).join('')+'%';

type PublicRow={id:string;profile:PublicProfile;ownerId:string};
type RankRow=PublicRow&{score:number};
type MineRow=RankRow&{rank:number};

async function actorAt(db:Query,hash:string):Promise<Actor|undefined>{
  const [actor]=await db.query<Actor>(`
    SELECT s.user_id AS id,a.username FROM guest_sessions s
    LEFT JOIN rider_accounts a ON a.user_id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now()`,[hash]);
  return actor;
}
async function setSession(db:Query,id:string,hash:string,seconds:number){
  await db.query('INSERT INTO guest_sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+$3 * interval \'1 second\')',[hash,id,seconds]);
}
async function readCareer(db:Query,id:string,lock=false){
  const [row]=await db.query<Row>('SELECT version,snapshot FROM rider_careers WHERE user_id=$1'+(lock?' FOR UPDATE':''),[id]);
  if(!row) throw new AccessError('저장된 커리어가 없어요. 화면을 다시 열어 주세요.',409);
  return row;
}
async function lockUser(db:Query,id:string){
  await db.query('SELECT id FROM rider_users WHERE id=$1 FOR UPDATE',[id]);
}
async function requireActor(db:Query,expected:Actor,hash:string){
  const actual=await actorAt(db,hash);
  if(actual?.id!==expected.id||actual.username!==expected.username) throw new AccessError('세션이 바뀌었습니다. 다시 연결해 주세요.',401);
}
function assertName(name:string){
  const compact=normalized(name).replace(/[^\p{L}\p{N}]/gu,'');
  if(!compact||/시발|씨발|병신|fuck|nigger/i.test(compact)) throw new AccessError('공개 이름을 정책에 맞게 설정해 주세요.',422);
}

export function databaseStore(db:Database,kind:Store['kind'],legacy?:LocalLegacy){
  async function actor(hash:string):Promise<Actor|undefined>{
    const existing=await actorAt(db,hash);
    if(existing||!legacy) return existing;
    if((await db.query('SELECT 1 FROM rider_legacy_imports WHERE hash=$1',[hash])).length) return;
    const source=await legacy(hash);
    if(!source||source.expires<=Date.now()) return;
    await db.transaction(async tx=>{
      const claimed=await tx.query('INSERT INTO rider_legacy_imports(hash) VALUES($1) ON CONFLICT DO NOTHING RETURNING hash',[hash]);
      if(!claimed.length) return;
      await tx.query('INSERT INTO rider_users(id) VALUES($1) ON CONFLICT DO NOTHING',[source.id]);
      await tx.query('INSERT INTO rider_careers(user_id,version,snapshot) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING',
        [source.id,source.version,JSON.stringify(source.snapshot)]);
      await tx.query('INSERT INTO guest_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [hash,source.id,new Date(source.expires).toISOString()]);
    });
    return actorAt(db,hash);
  }

  return {
    kind, actor,
    async authenticate(hash:string){ return (await actor(hash))?.id; },
    async createGuest(hash:string){
      const id=randomUUID();
      await db.transaction(async tx=>{
        await tx.query('INSERT INTO rider_users(id) VALUES($1)',[id]);
        await tx.query('INSERT INTO rider_careers(user_id,snapshot) VALUES($1,$2::jsonb)',[id,JSON.stringify(blankSave())]);
        await setSession(tx,id,hash,GUEST_SECONDS);
      });
      return id;
    },
    get:(id:string)=>readCareer(db,id),
    async replace(id:string,version:number,snapshot:Save,hash?:string){
      const [row]=await db.query<Row>(`
        UPDATE rider_careers c SET version=version+1,snapshot=$3::jsonb,updated_at=now()
        WHERE user_id=$1 AND version=$2
          AND ($4::text IS NULL OR EXISTS(SELECT 1 FROM guest_sessions s WHERE s.user_id=c.user_id AND s.token_hash=$4 AND s.expires_at>now()))
        RETURNING version,snapshot`,[id,version,JSON.stringify(snapshot),hash??null]);
      return row;
    },
    async rate(key:string,max:number,seconds:number){
      const [result]=await db.query<{attempts:number}>(`
        INSERT INTO rider_auth_limits AS limits(key,attempts,expires_at) VALUES($1,1,now()+$2 * interval '1 second')
        ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN limits.expires_at<=now() THEN 1 ELSE LEAST(limits.attempts+1,100000) END,
          expires_at=CASE WHEN limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE limits.expires_at END RETURNING attempts`,
        [key,seconds]);
      if(Math.random()<.04) await db.query('DELETE FROM rider_auth_limits WHERE expires_at<now()');
      return result.attempts<=max;
    },
    async credential(username:string){
      return (await db.query<LoginRecord>('SELECT user_id AS id,password_hash AS "passwordHash" FROM rider_accounts WHERE username=$1',[username]))[0];
    },
    async register(owner:Actor,oldHash:string,newHash:string,username:string,passwordHash:string){
      await db.transaction(async tx=>{
        await lockUser(tx,owner.id);
        await requireActor(tx,owner,oldHash);
        if(owner.username) throw new AccessError('이미 로그인되어 있어요.',409);
        await tx.query('INSERT INTO rider_accounts(user_id,username,password_hash) VALUES($1,$2,$3)',[owner.id,username,passwordHash]);
        await tx.query('DELETE FROM guest_sessions WHERE user_id=$1',[owner.id]);
        await setSession(tx,owner.id,newHash,ACCOUNT_SECONDS);
      });
    },
    async login(target:string,guest:Actor|undefined,oldHash:string|undefined,newHash:string){
      await db.transaction(async tx=>{
        const ids=guest&&guest.id!==target?[guest.id,target].sort():[target];
        for(const id of ids) await lockUser(tx,id);
        const [account]=await tx.query('SELECT 1 FROM rider_accounts WHERE user_id=$1',[target]);
        if(!account) throw new AccessError('계정을 찾을 수 없어요.',401);
        if(guest&&oldHash){
          await requireActor(tx,guest,oldHash);
          if(guest.username) throw new AccessError('먼저 로그아웃해 주세요.',409);
          if(guest.id!==target){
            const current=await readCareer(tx,target,true);
            const source=await readCareer(tx,guest.id,true);
            const career=mergeCareers(current.snapshot.career,source.snapshot.career);
            const credit=career.rider?.id===current.snapshot.career.rider?.id
              ? current.snapshot.clock.credit : source.snapshot.clock.credit;
            const combined={format:1,career,clock:{credit,stamp:0,tabs:{}}};
            await tx.query('UPDATE rider_careers SET snapshot=$2::jsonb,version=version+1,updated_at=now() WHERE user_id=$1',
              [target,JSON.stringify(combined)]);
            await tx.query('DELETE FROM rider_users WHERE id=$1',[guest.id]);
          }
        }
        await setSession(tx,target,newHash,ACCOUNT_SECONDS);
      });
    },
    async logout(owner:Actor,hash:string){
      await db.transaction(async tx=>{
        await lockUser(tx,owner.id);
        await requireActor(tx,owner,hash);
        await tx.query('DELETE FROM guest_sessions WHERE token_hash=$1',[hash]);
      });
    },
    async erase(owner:Actor,hash:string){
      await db.transaction(async tx=>{
        await lockUser(tx,owner.id);
        await requireActor(tx,owner,hash);
        await tx.query('DELETE FROM rider_users WHERE id=$1',[owner.id]);
      });
    },
    publications:(owner:string)=>db.query<Publication>(`SELECT archive_id AS "archiveId",id,active,hidden AS moderated
      FROM public_riders WHERE owner_id=$1`,[owner]),
    async publish(owner:Actor,hash:string,archiveId:string,active:boolean):Promise<Publication>{
      return db.transaction(async tx=>{
        await lockUser(tx,owner.id);
        await requireActor(tx,owner,hash);
        const saved=await readCareer(tx,owner.id,true);
        const archive=saved.snapshot.career.hall.find(item=>item.id===archiveId);
        if(!archive) throw new AccessError('이 계정에 보관된 은퇴 선수가 아니에요.',404);
        const [existing]=await tx.query<Publication>(`SELECT archive_id AS "archiveId",id,active,hidden AS moderated
          FROM public_riders WHERE owner_id=$1 AND archive_id=$2`,[owner.id,archiveId]);
        if(!active){
          if(!existing) throw new AccessError('공개 기록이 없어요.',404);
          await tx.query('UPDATE public_riders SET active=false WHERE id=$1',[existing.id]);
          await tx.query('DELETE FROM rider_rankings WHERE public_id=$1',[existing.id]);
          return {...existing,active:false};
        }
        if(existing?.moderated) throw new AccessError('운영 검토로 비공개 처리된 기록이에요.',409);
        if(existing?.active) return existing;
        assertName(archive.name);
        const {profile,entries}=publicationFor(archive);
        const id=existing?.id??randomUUID();
        await tx.query(`
          INSERT INTO public_riders (id,owner_id,archive_id,profile,search_name,complete,division,ending)
          VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
          ON CONFLICT(owner_id,archive_id) DO UPDATE SET active=true`,
          [id,owner.id,archiveId,JSON.stringify(profile),normalized(profile.name),profile.complete,profile.division,profile.ending.kind]);
        if(entries.length){
          await tx.query(`INSERT INTO rider_rankings(public_id,metric,scope,version,score)
            SELECT $1,entry.metric,entry.scope,$2,entry.score
            FROM jsonb_to_recordset($3::jsonb) AS entry(metric text,scope text,score double precision)
            ON CONFLICT DO NOTHING`,[id,RANKING_VERSION,JSON.stringify(entries)]);
        }
        return {id,archiveId,active:true,moderated:false};
      });
    },
    async report(owner:Actor,hash:string,id:string,reason:string){
      await db.transaction(async tx=>{
        await lockUser(tx,owner.id);
        await requireActor(tx,owner,hash);
        const [found]=await tx.query('SELECT 1 FROM public_riders WHERE id=$1 AND owner_id<>$2 AND active AND NOT hidden',[id,owner.id]);
        if(!found) throw new AccessError('신고할 공개 선수가 없어요.',404);
        await tx.query('INSERT INTO rider_reports(public_id,reporter_id,reason) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,owner.id,reason]);
      });
    },
    async profile(id:string,owner?:string):Promise<PublicCard|undefined>{
      const [row]=await db.query<PublicRow>(`SELECT id,profile,owner_id AS "ownerId" FROM public_riders
        WHERE id=$1 AND active AND NOT hidden`,[id]);
      return row?{id:row.id,profile:row.profile,mine:row.ownerId===owner}:undefined;
    },
    async directory(filter:DirectoryFilter,owner?:string):Promise<Directory>{
      const offset=(filter.page-1)*PAGE_SIZE;
      const visibility='p.active AND NOT p.hidden';
      const toCard=(row:PublicRow)=>({id:row.id,profile:row.profile,mine:row.ownerId===owner});
      if(!filter.metric){
        const conditions=[visibility];
        const values:unknown[]=[];
        if(filter.search){ values.push(searchPrefix(filter.search)); conditions.push(`p.search_name LIKE $${values.length}`); }
        if(filter.division!=='all'){ values.push(filter.division); conditions.push(`p.division=$${values.length}`); }
        if(filter.ending){ values.push(filter.ending); conditions.push(`p.ending=$${values.length}`); }
        if(filter.complete) conditions.push('p.complete');
        const rows=await db.query<PublicRow>(`SELECT p.id,p.profile,p.owner_id AS "ownerId" FROM public_riders p
          WHERE ${conditions.join(' AND ')} ORDER BY p.published_at DESC,p.id LIMIT $${values.length+1} OFFSET $${values.length+2}`,
          [...values,PAGE_SIZE+1,offset]);
        return {rows:rows.slice(0,PAGE_SIZE).map(toCard),page:filter.page,hasMore:rows.length>PAGE_SIZE,mine:[]};
      }
      const completeOnly=filter.complete?' AND p.complete':'';
      const keys=[filter.metric,filter.division,RANKING_VERSION];
      const rows=await db.query<RankRow>(`SELECT p.id,p.profile,p.owner_id AS "ownerId",r.score
        FROM rider_rankings r JOIN public_riders p ON p.id=r.public_id
        WHERE r.metric=$1 AND r.scope=$2 AND r.version=$3 AND ${visibility}${completeOnly}
        ORDER BY r.score DESC,r.public_id LIMIT $4 OFFSET $5`,[...keys,PAGE_SIZE+1,offset]);
      const myRows=owner?await db.query<MineRow>(`SELECT p.id,p.profile,p.owner_id AS "ownerId",r.score,1+(
          SELECT count(*)::int FROM rider_rankings ranked JOIN public_riders other ON ranked.public_id=other.id
          WHERE ranked.metric=$1 AND ranked.scope=$2 AND ranked.version=$3 AND other.active AND NOT other.hidden
            ${filter.complete?' AND other.complete':''}
            AND (ranked.score>r.score OR (ranked.score=r.score AND ranked.public_id<r.public_id))
        ) AS rank FROM rider_rankings r JOIN public_riders p ON p.id=r.public_id
        WHERE r.metric=$1 AND r.scope=$2 AND r.version=$3 AND ${visibility}${completeOnly} AND p.owner_id=$4
        ORDER BY rank LIMIT 50`,[...keys,owner]):[];
      return {
        rows:rows.slice(0,PAGE_SIZE).map((row,index)=>({...toCard(row),score:row.score,rank:offset+index+1})),
        page:filter.page,hasMore:rows.length>PAGE_SIZE,mine:myRows.map(row=>({...toCard(row),rank:row.rank,score:row.score})),
      };
    },
  };
}
export type OnlineStore=ReturnType<typeof databaseStore>;
