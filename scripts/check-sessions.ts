#!/usr/bin/env tsx

import { db, sessions } from '../app/db';
import { desc } from 'drizzle-orm';

async function checkSessions() {
  const allSessions = await db.select().from(sessions).orderBy(desc(sessions.created_at)).execute();
  console.log('Total sessions in database:', allSessions.length);
  console.log('\nSessions:');
  allSessions.forEach(s => {
    console.log(`- ${s.id} | ${s.title || 'Untitled'} | ${s.status} | ${s.created_at}`);
  });
}

checkSessions().catch(console.error);