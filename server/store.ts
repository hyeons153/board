import { randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { users,sessions,careers } from './schema.js';
import { blankSave, type Save } from './clock.js';

export const GUEST_SECONDS=365*24*60*60;
export type Row={version:number;snapshot:Save};
export interface Store {
  kind:'local'|'neon';
  authenticate(hash:string):Promise<string|undefined>;
  createGuest(hash:string):Promise<string>;
  get(id:string):Promise<Row>;
  replace(id:string,version:number,snapshot:Save,hash?:string):Promise<Row|undefined>;
}
export function neonStore(url:string):Store{
  const db=drizzle(neon(url));
  return {
    kind:'neon',
    async authenticate(hash){
      const [session]=await db.select({id:sessions.userId}).from(sessions).where(and(eq(sessions.tokenHash,hash),gt(sessions.expiresAt,new Date())));
      return session?.id;
    },
    async createGuest(hash){
      const id=randomUUID();
      await db.batch([
        db.insert(users).values({id}),
        db.insert(sessions).values({userId:id,tokenHash:hash,expiresAt:new Date(Date.now()+GUEST_SECONDS*1000)}),
        db.insert(careers).values({userId:id,snapshot:blankSave()}),
      ]);
      return id;
    },
    async get(id){
      const [row]=await db.select({version:careers.version,snapshot:careers.snapshot}).from(careers).where(eq(careers.userId,id));
      if(!row) throw new Error('Missing career row');
      return row;
    },
    async replace(id,version,snapshot){
      const [row]=await db.update(careers).set({version:version+1,snapshot,updatedAt:new Date()})
        .where(and(eq(careers.userId,id),eq(careers.version,version))).returning({version:careers.version,snapshot:careers.snapshot});
      return row;
    },
  };
}
export function localStore(path:string):Store{
  const accesses = new Map<string,Promise<unknown>>();
  async function withCareer<T>(id:string,operation:()=>Promise<T>):Promise<T>{
    const next=(accesses.get(id)??Promise.resolve()).catch(()=>{}).then(operation);
    accesses.set(id,next);
    try { return await next; }
    finally { if(accesses.get(id)===next) accesses.delete(id); }
  }
  const read = async <T>(file:string):Promise<T>=>JSON.parse(await readFile(join(path,file),'utf8')) as T;
  const put = async (file:string,value:unknown)=>{
    await mkdir(path,{recursive:true});
    const tmp=join(path,`${file}.${randomUUID()}.tmp`);
    await writeFile(tmp,JSON.stringify(value),'utf8');
    await rename(tmp,join(path,file));
  };
  const careerFile=(id:string)=>`${id}.json`;
  const get=(id:string)=>withCareer(id,()=>read<Row>(careerFile(id)));
  return {
    kind:'local',
    async authenticate(hash) {
      try{
        const s=await read<{id:string; expires:number}>(`session-${hash}.json`);
        return s.expires>Date.now()?s.id:undefined;
      }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return; throw e;}
    },
    async createGuest(hash){
      const id=randomUUID();
      await put(careerFile(id),{version:0,snapshot:blankSave()});
      await put(`session-${hash}.json`,{id,expires:Date.now()+GUEST_SECONDS*1000});
      return id;
    },
    get,
    replace(id,version,snapshot){
      return withCareer(id,async()=>{
        const current=await read<Row>(careerFile(id));
        if(current.version!==version) return undefined;
        const row={version:version+1,snapshot};
        await put(careerFile(id),row);
        return row;
      });
    },
  };
}
