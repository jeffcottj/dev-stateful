import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('@repo/config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    vi.stubEnv('LOG_LEVEL', 'info');
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/app');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('AUTH_ENABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports config when required env vars are provided', async () => {
    const { config } = await import('./index');
    expect(config).toBeDefined();
    expect(config.NODE_ENV).toBe('test');
    expect(config.DATABASE_URL).toBe('postgresql://postgres:postgres@localhost:5432/app');
    expect(config.REDIS_URL).toBe('redis://localhost:6379');
    expect(config.AUTH_ENABLED).toBe(false);
  });

  it('throws when required vars are missing', async () => {
    vi.stubEnv('DATABASE_URL', '');
    await expect(import('./index')).rejects.toThrow('Invalid environment variables');
  });
});
