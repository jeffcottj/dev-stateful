export const dynamic = 'force-dynamic';

import { db, appMeta } from '@repo/db';
import { eq } from 'drizzle-orm';
import { createClient } from '@redis/client';
import { config } from '@repo/config';

async function getStatus() {
  let dbOk = false;
  let redisOk = false;

  try {
    const rows = await db.select().from(appMeta).where(eq(appMeta.key, 'template_status'));
    dbOk = rows[0]?.value === 'ok';
  } catch {
    dbOk = false;
  }

  const redisClient = createClient({ url: config.REDIS_URL });
  try {
    await redisClient.connect();
    const pong = await redisClient.ping();
    redisOk = pong === 'PONG';
  } catch {
    redisOk = false;
  } finally {
    await redisClient.disconnect().catch(() => undefined);
  }

  return { dbOk, redisOk };
}

export default async function HomePage() {
  const { dbOk, redisOk } = await getStatus();

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem' }}>
      <h1>Template running</h1>
      <table>
        <tbody>
          <tr>
            <td>Environment</td>
            <td>{process.env.NODE_ENV}</td>
          </tr>
          <tr>
            <td>Database</td>
            <td>{dbOk ? 'ok' : 'degraded'}</td>
          </tr>
          <tr>
            <td>Redis</td>
            <td>{redisOk ? 'ok' : 'degraded'}</td>
          </tr>
        </tbody>
      </table>
      <p>
        <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
