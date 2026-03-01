import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '@repo/config';
import * as schema from './schema';

// Singleton pattern to avoid exhausting connections during hot reload in dev
const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
};

const pgClient = globalForDb.pgClient ?? postgres(config.DATABASE_URL);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgClient = pgClient;
}

export const db = drizzle(pgClient, { schema });

export * from './schema';
