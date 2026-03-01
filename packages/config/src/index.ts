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

    OIDC_ISSUER: z.string().optional(),
    OIDC_CLIENT_ID: z.string().optional(),
    OIDC_CLIENT_SECRET: z.string().optional(),
    OIDC_CALLBACK_URL: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.AUTH_ENABLED) {
      const required = [
        ['OIDC_ISSUER', data.OIDC_ISSUER],
        ['OIDC_CLIENT_ID', data.OIDC_CLIENT_ID],
        ['OIDC_CLIENT_SECRET', data.OIDC_CLIENT_SECRET],
        ['OIDC_CALLBACK_URL', data.OIDC_CALLBACK_URL],
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
