import { config } from 'dotenv';
import { productionDatabase } from '../server/database.js';
import { refreshPublicHall } from '../server/hallIndex.js';

config({path:'.env.local',quiet:true});
config({quiet:true});
const url=process.env.DATABASE_DIRECT_URL||process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL;
if(!url)throw new Error('A database connection is required.');
const db=productionDatabase(url);
const apply=process.argv.includes('--apply');
try{
  console.log(JSON.stringify({mode:apply?'apply':'audit',...await refreshPublicHall(db,apply)}));
}catch(error){
  const code=error instanceof Error&&'code' in error?error.code:undefined;
  console.error('Hall refresh failed.',typeof code==='string'&&/^[A-Z0-9]{5}$/.test(code)?code:'');
  process.exitCode=1;
}finally{await db.close();}
