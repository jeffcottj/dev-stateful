import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from './schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required to run the seed script');
  process.exit(1);
}

const client = postgres(databaseUrl);
const db = drizzle(client);

const seeds = [
  { email: 'admin@example.com', name: 'Admin User', role: 'admin' as const },
  { email: 'user@example.com', name: 'Regular User', role: 'user' as const },
];

try {
  const result = await db.insert(users).values(seeds).onConflictDoNothing().returning({
    email: users.email,
    role: users.role,
  });

  if (result.length === 0) {
    console.log('Seed users already exist — nothing inserted.');
  } else {
    console.log(`Seeded ${result.length} user(s):`);
    for (const row of result) {
      console.log(`  ${row.role.padEnd(6)}  ${row.email}`);
    }
  }
} catch (err) {
  console.error('Seed failed:', err);
  process.exit(1);
} finally {
  await client.end();
}
