export const dynamic = 'force-dynamic';

import { db, appMeta } from '@repo/db';
import { eq } from 'drizzle-orm';
import { createClient } from '@redis/client';
import { config } from '@repo/config';
import { Nav } from '@/components/nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    <>
      <Nav />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-6">Template running</h1>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Environment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{process.env.NODE_ENV}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Database</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={dbOk ? 'default' : 'destructive'}>{dbOk ? 'ok' : 'degraded'}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Redis</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={redisOk ? 'default' : 'destructive'}>
                {redisOk ? 'ok' : 'degraded'}
              </Badge>
            </CardContent>
          </Card>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          <a href="/api/health" className="underline hover:text-foreground">
            /api/health
          </a>
        </p>
      </main>
    </>
  );
}
