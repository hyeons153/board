import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

config({path:'.env.local',quiet:true});
config({quiet:true});
const url=process.env.DATABASE_DIRECT_URL||process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL;
if(!url) throw new Error('DATABASE_URL or DATABASE_DIRECT_URL is required.');
try {
  await migrate(drizzle(neon(url)),{migrationsFolder:'./drizzle'});
  console.log('Database migrations applied.');
} catch {
  console.error('Migration failed. Confirm the connection URL, database branch, and migration privileges.');
  process.exitCode=1;
}
