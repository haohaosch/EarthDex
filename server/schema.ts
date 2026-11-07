import{sqliteTable,text,integer,index}from'drizzle-orm/sqlite-core';
export const profiles=sqliteTable('profiles',{id:text('id').primaryKey(),revision:integer('revision').notNull().default(0),data:text('data').notNull()});
export const matches=sqliteTable('matches',{id:text('id').primaryKey(),revision:integer('revision').notNull().default(0),p0:text('p0').notNull(),p1:text('p1'),data:text('data').notNull(),updatedAt:text('updated_at').notNull()},table=>[index('matches_players').on(table.p0,table.p1)]);
