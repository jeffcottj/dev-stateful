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
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
    vi.stubEnv('NEXTAUTH_SECRET', 'a-secret-value-that-is-at-least-32-chars-long');
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

  it('throws when AUTH_ENABLED=true but provider vars are missing', async () => {
    vi.stubEnv('AUTH_ENABLED', 'true');
    await expect(import('./index')).rejects.toThrow('Invalid environment variables');
  });

  it('passes when AUTH_ENABLED=true and all provider vars are set', async () => {
    vi.stubEnv('AUTH_ENABLED', 'true');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret');
    vi.stubEnv('ENTRA_CLIENT_ID', 'entra-client-id');
    vi.stubEnv('ENTRA_CLIENT_SECRET', 'entra-client-secret');
    vi.stubEnv('ENTRA_TENANT_ID', 'common');
    const { config } = await import('./index');
    expect(config.AUTH_ENABLED).toBe(true);
    expect(config.GOOGLE_CLIENT_ID).toBe('google-client-id');
    expect(config.ENTRA_TENANT_ID).toBe('common');
  });
});
