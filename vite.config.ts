import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHandler, readWeekMs } from './server/http';
import { createBrowserGame } from './server/browserGame';
import { databaseStore } from './server/databaseStore';
import { productionDatabase } from './server/database';

export default defineConfig(({mode,command})=>{
  const env=command==='serve'?loadEnv(mode,process.cwd(),['HALL_DATABASE_URL','GAME_SAVE_SECRET','LEGACY_SAVE_DATABASE_URL','WEEK_MS']):{};
  const register:NonNullable<Plugin['configureServer']>=(server)=>{
    const weekMs=readWeekMs(process.env.WEEK_MS||env.WEEK_MS);
    const localName=process.env.LONGBOARD_LOCAL_PROFILE??'';
    let hall:Promise<ReturnType<typeof databaseStore>>|undefined;
    const openHall=async()=>{
      const hallUrl=process.env.HALL_DATABASE_URL||env.HALL_DATABASE_URL;
      if(hallUrl){
        const db=productionDatabase(hallUrl);
        server.httpServer?.once('close',()=>void db.close().catch(()=>{}));
        return databaseStore(db,'neon');
      }
      const {connectLocal}=await import('./server/localDatabase');
      const local=await connectLocal(resolve('.longboard','hall','postgres'));
      server.httpServer?.once('close',()=>void local.close());
      return databaseStore(local.db,'local');
    };
    const legacyUrl=process.env.LEGACY_SAVE_DATABASE_URL||env.LEGACY_SAVE_DATABASE_URL;
    let legacy:ReturnType<typeof databaseStore>|undefined;
    const browser=createBrowserGame({
      secret:process.env.GAME_SAVE_SECRET||env.GAME_SAVE_SECRET||'longboard-development-save-key',
      secure:false,weekMs,hall:()=>hall??=openHall().catch(error=>{hall=undefined;throw error;}),
      legacy:legacyUrl?()=>{
        if(legacy)return legacy;
        const db=productionDatabase(legacyUrl);
        server.httpServer?.once('close',()=>void db.close().catch(()=>{}));
        return legacy=databaseStore(db,'neon');
      }:undefined,
    });
    // Existing fixtures explicitly select their legacy storage profile.
    let fixture:Promise<ReturnType<typeof createHandler>>|undefined;
    const openFixture=async()=>{
      const {localOnlineStore}=await import('./server/localDatabase');
      const local=await localOnlineStore(resolve('.longboard',localName));
      server.httpServer?.once('close',()=>void local.close());
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
        const handle=/^[a-z0-9-]+$/.test(localName)
          ?await (fixture??=openFixture().catch(error=>{fixture=undefined;throw error;})):browser;
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
