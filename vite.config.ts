import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHandler, readWeekMs } from './server/http';
import { databaseStore } from './server/databaseStore';
import { productionDatabase } from './server/database';

export default defineConfig(({mode,command})=>{
  const env=command==='serve'?loadEnv(mode,process.cwd(),['DATABASE_URL','WEEK_MS']):{};
  const register:NonNullable<Plugin['configureServer']>=(server)=>{
    const url=process.env.DATABASE_URL||env.DATABASE_URL;
    // Local development and tests use the same PostgreSQL DDL without requiring credentials.
    const weekMs=readWeekMs(process.env.WEEK_MS||env.WEEK_MS);
    let handler:Promise<ReturnType<typeof createHandler>>|undefined;
    const start=async()=>{
      const localName=process.env.LONGBOARD_LOCAL_PROFILE??'';
      if(url&&!localName){
        const db=productionDatabase(url);
        server.httpServer?.once('close',()=>void db.close().catch(()=>{}));
        return createHandler(databaseStore(db,'neon'),weekMs,false);
      }
      const {localOnlineStore}=await import('./server/localDatabase');
      const local=await localOnlineStore(resolve('.longboard',/^[a-z0-9-]+$/.test(localName)?localName:''));
      server.httpServer?.once('close',()=>void local.close().catch(()=>{}));
      return createHandler(local.store,weekMs,false);
    };
    server.middlewares.use('/api/game',async(req,res)=>{
      try {
        const method=req.method??'GET';
        const hdr:Record<string,string>={};
        for (const [k,v] of Object.entries(req.headers)) if(v) hdr[k]=Array.isArray(v)?v.join(', '):v;
        const query=req.url?.includes('?')?req.url.slice(req.url.indexOf('?')):'';
        const reqUrl=new URL('/api/game'+query,`http://${req.headers.host??'127.0.0.1:5173'}`);
        const extras=method==='POST'?{body:Readable.toWeb(req) as ReadableStream,duplex:'half'}:{};
        const handle=await (handler??=start().catch(error=>{handler=undefined;throw error;}));
        const response=await handle(new Request(reqUrl,{method,headers:hdr,...extras}));
        res.writeHead(response.status,Object.fromEntries(response.headers));
        res.end(await response.text());
      } catch{
        res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
        res.end(JSON.stringify({error:'로컬 서버 요청을 처리하지 못했어요.'}));
      }
    });
  };
  return {
    plugins:[react(),{name:'longboard-api',configureServer:register,configurePreviewServer:register as Plugin['configurePreviewServer']}],
    server:{fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.longboard/**','**/server/**','**/drizzle/**']}},
    build:{chunkSizeWarningLimit:1600},
  };
});
