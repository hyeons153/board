import { PGlite } from '@electric-sql/pglite';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Database, Query } from './database';
import { databaseStore } from './databaseStore';
import type { Row } from './store';

export async function connectLocal(path?:string){
  if(path) await mkdir(path,{recursive:true});
  const pg=new PGlite(path);
  const client=(executor:Pick<PGlite,'query'>):Query=>({
    async query<T>(statement:string,values?:unknown[]){ return (await executor.query<T>(statement,values)).rows; },
  });
  const db:Database={...client(pg),transaction:run=>pg.transaction(tx=>run(client(tx)))};
  await pg.exec('CREATE TABLE IF NOT EXISTS local_schema_migrations(hash text primary key)');
  for(const migration of readMigrationFiles({migrationsFolder:'./drizzle'})){
    await pg.transaction(async tx=>{
      if((await tx.query('SELECT 1 FROM local_schema_migrations WHERE hash=$1',[migration.hash])).rows.length) return;
      for(const sql of migration.sql) if(sql.trim()) await tx.exec(sql);
      await tx.query('INSERT INTO local_schema_migrations(hash) VALUES($1)',[migration.hash]);
    });
  }
  return {db,close:()=>pg.close()};
}

export async function localOnlineStore(root:string){
  const {db,close}=await connectLocal(join(root,'postgres'));
  const store=databaseStore(db,'local',async hash=>{
    if(!/^[0-9a-f]{64}$/.test(hash)) return;
    try{
      const session=JSON.parse(await readFile(join(root,'session-'+hash+'.json'),'utf8')) as {id:string;expires:number};
      if(!/^[a-f0-9-]{36}$/.test(session.id)) return;
      const row=JSON.parse(await readFile(join(root,session.id+'.json'),'utf8')) as Row;
      return {...row,...session};
    }catch(error){
      if((error as NodeJS.ErrnoException).code==='ENOENT') return;
      throw error;
    }
  });
  return {store,close};
}
