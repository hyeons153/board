import { createHandler } from '../server/http';
import { databaseStore } from '../server/databaseStore';
import { productionDatabase } from '../server/database';
import { RULES } from '../src/game/data';

let handler:ReturnType<typeof createHandler>|undefined;
export default {
  async fetch(request:Request) {
    const url=process.env.DATABASE_URL;
    if(!url) return Response.json({error:'서버에 Neon DATABASE_URL이 설정되지 않았어요.'},{status:503,headers:{'Cache-Control':'no-store'}});
    const rateSecret=process.env.AUTH_RATE_SECRET;
    handler??=createHandler(databaseStore(productionDatabase(url,true),'neon'),RULES.weekMs,true,rateSecret&&rateSecret.length>=32?rateSecret:undefined);
    return handler(request);
  },
};
