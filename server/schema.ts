import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import type { Save } from './clock';
import type { PublicProfile } from '../src/game/public';

export const users = pgTable('rider_users', {
  id:uuid().primaryKey(),
  createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull(),
});
export const sessions = pgTable('guest_sessions', {
  tokenHash:text('token_hash').primaryKey(),
  userId:uuid('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
});
export const careers = pgTable('rider_careers', {
  userId:uuid('user_id').primaryKey().references(()=>users.id,{onDelete:'cascade'}),
  version:integer().default(0).notNull(),
  snapshot:jsonb().$type<Save>().notNull(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).defaultNow().notNull(),
});

export const accounts = pgTable('rider_accounts',{
  userId:uuid('user_id').primaryKey().references(()=>users.id,{onDelete:'cascade'}),
  username:text().notNull().unique(),
  passwordHash:text('password_hash').notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
export const authLimits = pgTable('rider_auth_limits',{
  key:text().primaryKey(), attempts:integer().notNull(),
  expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
},t=>[index().on(t.expiresAt)]);
export const legacyImports = pgTable('rider_legacy_imports',{
  hash:text().primaryKey(),
});
export const publicRiders = pgTable('public_riders',{
  id:uuid().primaryKey(),
  ownerId:uuid('owner_id').notNull().references(()=>accounts.userId,{onDelete:'cascade'}),
  archiveId:uuid('archive_id').notNull(),
  profile:jsonb().$type<PublicProfile>().notNull(),
  searchName:text('search_name').notNull(),
  complete:boolean().notNull(),
  division:text().notNull(),
  ending:text().notNull(),
  active:boolean().notNull().default(true),
  hidden:boolean().notNull().default(false),
  publishedAt:timestamp('published_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[
  unique().on(t.ownerId,t.archiveId),
  index().on(t.active,t.hidden,t.publishedAt.desc(),t.id),
  index().on(t.active,t.hidden,t.searchName.asc().op('text_pattern_ops')),
  index().on(t.division,t.ending,t.complete),
]);
export const rankings = pgTable('rider_rankings',{
  publicId:uuid('public_id').notNull().references(()=>publicRiders.id,{onDelete:'cascade'}),
  metric:text().notNull(),scope:text().notNull(),
  version:integer().notNull(),score:doublePrecision().notNull(),
},t=>[
  primaryKey({columns:[t.publicId,t.metric,t.scope,t.version]}),
  index().on(t.metric,t.scope,t.version,t.score.desc(),t.publicId),
]);
export const reports = pgTable('rider_reports',{
  publicId:uuid('public_id').notNull().references(()=>publicRiders.id,{onDelete:'cascade'}),
  reporterId:uuid('reporter_id').notNull().references(()=>accounts.userId,{onDelete:'cascade'}),
  reason:text().notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[primaryKey({columns:[t.publicId,t.reporterId]}),index().on(t.createdAt)]);
