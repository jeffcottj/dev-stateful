import { NextResponse } from 'next/server';
import { db, appMeta } from '@repo/db';
import { eq } from 'drizzle-orm';
import { createClient } from '@redis/client';
import { config } from '@repo/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const time = new Date().toISOString();
  const version = process.env.npm_package_version ?? 'unknown';

  // Check DB
  let dbOk = false;
  let dbLatencyMs: number | undefined;
  try {
    const start = performance.now();
    const rows = await db.select().from(appMeta).where(eq(appMeta.key, 'template_status'));
    dbLatencyMs = Math.round(performance.now() - start);
    dbOk = rows[0]?.value === 'ok';
  } catch {
    dbOk = false;
  }

  // Check Redis
  let redisOk = false;
  let redisLatencyMs: number | undefined;
  const redisClient = createClient({ url: config.REDIS_URL });
  try {
    await redisClient.connect();
    const start = performance.now();
    const pong = await redisClient.ping();
    redisLatencyMs = Math.round(performance.now() - start);
    redisOk = pong === 'PONG';
  } catch {
    redisOk = false;
  } finally {
    await redisClient.disconnect().catch(() => undefined);
  }

  const status = dbOk && redisOk ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      version,
      db: { ok: dbOk, latencyMs: dbLatencyMs },
      redis: { ok: redisOk, latencyMs: redisLatencyMs },
      time,
    },
    { status: status === 'ok' ? 200 : 503 }
  );
}
