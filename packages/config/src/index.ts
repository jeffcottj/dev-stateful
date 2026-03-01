import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.string().url(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),

    AUTH_ENABLED: z
      .string()
      .transform((v) => v === 'true')
      .default('false'),

    NEXTAUTH_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(32),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    ENTRA_CLIENT_ID: z.string().optional(),
    ENTRA_CLIENT_SECRET: z.string().optional(),
    ENTRA_TENANT_ID: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.AUTH_ENABLED) {
      const required = [
        ['GOOGLE_CLIENT_ID', data.GOOGLE_CLIENT_ID],
        ['GOOGLE_CLIENT_SECRET', data.GOOGLE_CLIENT_SECRET],
        ['ENTRA_CLIENT_ID', data.ENTRA_CLIENT_ID],
        ['ENTRA_CLIENT_SECRET', data.ENTRA_CLIENT_SECRET],
        ['ENTRA_TENANT_ID', data.ENTRA_TENANT_ID],
      ] as const;

      for (const [key, val] of required) {
        if (!val) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Required when AUTH_ENABLED=true`,
            path: [key],
          });
        }
      }
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const lines = result.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment variables:\n${lines}`);
}

export const config = result.data;
export type Config = typeof config;

export * from './types';
