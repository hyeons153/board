import pg, { type Pool, type PoolClient, type QueryResultRow } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
export type Query = { query<T>(statement:string,values?:unknown[]):Promise<T[]> };
export type Database = Query & { transaction<T>(run:(db:Query)=>Promise<T>):Promise<T> };

function adapter(client:Pick<Pool|PoolClient,'query'>):Query {
  return {
    async query<T>(statement:string,values:unknown[]=[]){
      const {rows}=await client.query<QueryResultRow>(statement,values);
      return rows as T[];
    },
  };
}
export function productionDatabase(url:string,fluid=false):Database & {close:()=>Promise<void>} {
  const connection=new URL(url);
  const sslMode=connection.searchParams.get('sslmode');
  if(sslMode==='require'||sslMode==='verify-ca') connection.searchParams.set('sslmode','verify-full');
  const pool=new pg.Pool({connectionString:connection.toString(),max:4,idleTimeoutMillis:5000,connectionTimeoutMillis:8000});
  pool.on('error',()=>console.error('An idle PostgreSQL connection closed.'));
  if(fluid) attachDatabasePool(pool);
  return {
    ...adapter(pool),
    close:()=>pool.end(),
    async transaction(run){
      const client=await pool.connect();
      let damaged=false;
      try{
        await client.query('BEGIN');
        const result=await run(adapter(client));
        await client.query('COMMIT');
        return result;
      }catch(error){
        try {await client.query('ROLLBACK');}
        catch {damaged=true;}
        throw error;
      }finally{client.release(damaged);}
    },
  };
}
