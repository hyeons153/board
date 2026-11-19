import { createBrowserGame } from '../server/browserGame.js';
import { AccessError, databaseStore } from '../server/databaseStore.js';
import { productionDatabase } from '../server/database.js';
import { RULES } from '../src/game/data.js';

let handler:ReturnType<typeof createBrowserGame>|undefined;
export default {
  async fetch(request:Request) {
    const rateSecret=process.env.AUTH_RATE_SECRET;
    const secret=process.env.GAME_SAVE_SECRET||rateSecret;
    if(!secret||secret.length<32) return Response.json({error:'브라우저 저장 설정을 준비하고 있어요.'},{status:503,headers:{'Cache-Control':'no-store'}});
    if(!handler){
      let hall:ReturnType<typeof databaseStore>|undefined,legacy:ReturnType<typeof databaseStore>|undefined;
      const hallUrl=process.env.HALL_DATABASE_URL,legacyUrl=process.env.LEGACY_SAVE_DATABASE_URL;
      handler=createBrowserGame({
        secret,secure:true,weekMs:RULES.weekMs,rateSecret:rateSecret&&rateSecret.length>=32?rateSecret:secret,
        hall:()=>{
          if(!hallUrl)throw new AccessError('명예의 전당 서버 연결을 준비하고 있어요.',503);
          return hall??=databaseStore(productionDatabase(hallUrl,true),'neon');
        },
        legacy:legacyUrl&&legacyUrl!==hallUrl?()=>legacy??=databaseStore(productionDatabase(legacyUrl,true),'neon'):undefined,
      });
    }
    const started=performance.now();
    const response=await handler(request);
    response.headers.set('Server-Timing','app;dur='+(performance.now()-started).toFixed(1));
    return response;
  },
};
