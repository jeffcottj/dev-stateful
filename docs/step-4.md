# Step 4 — Background Jobs, Transactional Email, and Profile UI

Step 3 added rate limiting, error tracking, and E2E scaffolding. Step 4 adds three
capabilities that nearly every real app needs shortly after launch: a durable job
queue for async work, a transactional email abstraction, and a user profile page.

---

## Decisions

| Concern                    | Decision                           | Rationale                                                                                     |
| -------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Job queue backend          | `pg-boss` (Postgres-backed)        | Zero new infrastructure; jobs survive Redis restarts; transactional with app DB writes        |
| Job queue location         | `packages/jobs` workspace package  | Keeps job definitions and worker logic out of the Next.js app; importable from server code    |
| Email production transport | `nodemailer` (generic SMTP)        | Works with any SMTP provider (SendGrid, SES, Postmark, etc.); swap provider via env vars only |
| Email dev transport        | Mailpit (local SMTP catch-all)     | Already in the Docker Compose stack; no credentials needed in dev                             |
| Email abstraction location | `packages/email` workspace package | Reusable across app and worker; clear separation from Next.js app code                        |
| Profile fields (editable)  | `name`, `image`                    | Controlled by the user; sourced from OAuth on first sign-in                                   |
| Profile fields (read-only) | `email`, `role`                    | Email is the OAuth identity; role is set by admins                                            |

---

## Outcomes

- Long-running work (email sends, webhooks, exports) runs in a background worker, not in HTTP handlers
- A `welcome-email` job fires on first sign-in — demonstrates the full job + email pipeline
- Transactional emails send via Mailpit in dev and any SMTP provider in production
- Users can update their display name and avatar URL from `/app/profile`
- All quality gates (lint, typecheck, test, build, CI) remain green

---

## 4.1 Background jobs (`packages/jobs`)

### Package setup

New workspace package at `packages/jobs/`:

```
packages/jobs/
  package.json        name: @repo/jobs
  tsconfig.json
  src/
    index.ts          exports: getQueue(), defineJob(), startWorker()
    jobs/
      welcome-email.ts
```

Dependencies:

- `pg-boss` (production)
- `@repo/config` (workspace)
- `@repo/db` (workspace — shares the same Postgres connection string)

### API design

```ts
// packages/jobs/src/index.ts

// Returns the pg-boss singleton (creates on first call)
export function getQueue(): Promise<PgBoss>;

// Type-safe job definition helper
export function defineJob<TData>(
  name: string,
  handler: (data: TData) => Promise<void>
): { name: string; handler: (data: TData) => Promise<void> };

// Starts the worker process — registers all handlers, starts pg-boss
export function startWorker(): Promise<void>;
```

### `pg-boss` setup

pg-boss creates its own schema (`pgboss`) in the application database. No migration
file is needed — pg-boss manages its own schema via `boss.start()`.

Connection: use `DATABASE_URL` from config (same DB as the app).

### Sample job — `welcome-email`

```ts
// packages/jobs/src/jobs/welcome-email.ts
import { defineJob } from '../index';
import { sendEmail } from '@repo/email';

export const welcomeEmailJob = defineJob<{ email: string; name: string }>(
  'welcome-email',
  async ({ email, name }) => {
    await sendEmail({
      to: email,
      subject: 'Welcome!',
      html: `<p>Hi ${name}, welcome to the app.</p>`,
    });
  }
);
```

### Triggering the job from Auth.js

In `apps/web/auth.ts`, `signIn` callback — after the user upsert — enqueue the job
only on first sign-in (i.e., when `createdAt === lastSeenAt`):

```ts
const queue = await getQueue();
await queue.send('welcome-email', { email: user.email, name: user.name ?? 'there' });
```

### Worker process

```ts
// packages/jobs/src/worker.ts  (entrypoint)
import { startWorker } from './index';
startWorker().catch(console.error);
```

Add to `packages/jobs/package.json`:

```json
"scripts": {
  "worker": "tsx src/worker.ts"
}
```

Add to `Justfile`:

```just
# Run background job worker
workers:
  pnpm --filter @repo/jobs run worker
```

Checklist:

- [ ] Create `packages/jobs/` package with `pg-boss`, `@repo/config`, `@repo/email` deps
- [ ] Implement `getQueue()` singleton, `defineJob()`, `startWorker()` in `src/index.ts`
- [ ] Create `welcome-email` job in `src/jobs/welcome-email.ts`
- [ ] Wire enqueue call into `apps/web/auth.ts` `signIn` callback
- [ ] Add `worker` script to `packages/jobs/package.json`
- [ ] Add `just workers` to `Justfile`
- [ ] Export `packages/jobs` from root `pnpm-workspace.yaml` packages list

Acceptance:

- [ ] `just workers` starts the worker process without error
- [ ] First sign-in → `welcome-email` job enqueued → worker processes it → email in Mailpit
- [ ] Subsequent sign-ins → no duplicate welcome email
- [ ] `pnpm typecheck` passes across all packages

---

## 4.2 Transactional email (`packages/email`)

### Package setup

New workspace package at `packages/email/`:

```
packages/email/
  package.json        name: @repo/email
  tsconfig.json
  src/
    index.ts          exports: sendEmail()
    transports/
      smtp.ts         nodemailer SMTP transport
```

Dependencies:

- `nodemailer` (production)
- `@types/nodemailer` (devDependency)
- `@repo/config` (workspace)

### Env vars

Add to `packages/config/src/index.ts`:

```ts
SMTP_HOST:     z.string().default('localhost'),
SMTP_PORT:     z.coerce.number().int().default(1025),
SMTP_USER:     z.string().optional(),
SMTP_PASS:     z.string().optional(),
SMTP_SECURE:   z.string().transform(v => v === 'true').default('false'),
EMAIL_FROM:    z.string().email().default('noreply@example.com'),
```

Add to `.env.example`:

```
# Email (dev: Mailpit on port 1025; prod: real SMTP provider)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
EMAIL_FROM=noreply@example.com
```

### `sendEmail()` API

```ts
export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string; // auto-generated from html if omitted
  from?: string; // defaults to EMAIL_FROM from config
}

export async function sendEmail(msg: EmailMessage): Promise<void>;
```

### Mailpit in Docker Compose

Add Mailpit service to `infra/docker/compose.override.yml` (dev only):

```yaml
mailpit:
  image: axllent/mailpit:latest
  ports:
    - '1025:1025' # SMTP
    - '8025:8025' # Web UI at http://localhost:8025
```

### Dev vs prod transport selection

The same `sendEmail()` function works in both environments — `SMTP_HOST=localhost` +
`SMTP_PORT=1025` routes to Mailpit in dev; real provider credentials route to the real
SMTP server in production. No conditional branching in the abstraction.

Checklist:

- [ ] Create `packages/email/` with `nodemailer` dep
- [ ] Add SMTP env vars to config schema and `.env.example`
- [ ] Implement `sendEmail()` using nodemailer transporter
- [ ] Add Mailpit to `compose.override.yml` with both ports
- [ ] Verify emails appear in Mailpit UI at `http://localhost:8025` in dev
- [ ] Export `packages/email` from root `pnpm-workspace.yaml` packages list

Acceptance:

- [ ] `sendEmail({ to, subject, html })` delivers to Mailpit in dev
- [ ] Mailpit Web UI at `http://localhost:8025` shows the received email
- [ ] `pnpm typecheck` passes

---

## 4.3 Profile management UI

### API route — `GET /api/user/me` and `PATCH /api/user/me`

New file: `apps/web/app/api/user/me/route.ts`

```ts
// GET — returns current user from DB
// PATCH — updates name and/or image; validates with Zod; returns updated user
// Both return ApiResponse<User>; 401 if no session
```

Zod schema for PATCH body:

```ts
z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().max(500).optional(),
});
```

At least one of `name` or `image` must be present (use `.refine()`).

### Profile page — `apps/web/app/app/profile/page.tsx`

Server Component. Reads session via `auth()`, fetches the user row from DB, passes
data to a `<ProfileForm>` Client Component.

Fields rendered:

| Field     | Editable | Component                                                |
| --------- | -------- | -------------------------------------------------------- |
| Email     | No       | `<Input disabled>` or plain text                         |
| Role      | No       | shadcn `<Badge>` (`user` = default, `admin` = secondary) |
| Name      | Yes      | `<Input>`                                                |
| Image URL | Yes      | `<Input>` + `<Avatar>` preview                           |

Form submission: `fetch('/api/user/me', { method: 'PATCH', body: JSON.stringify(data) })`;
on success show `toast('Profile updated')` via sonner; on error show `toast.error(...)`.

### Nav link

Add "Profile" link to the authenticated dropdown in `apps/web/components/user-menu.tsx`
pointing to `/app/profile`.

Checklist:

- [ ] Create `apps/web/app/api/user/me/route.ts` with GET + PATCH handlers
- [ ] Create `apps/web/app/app/profile/page.tsx` (Server Component)
- [ ] Create `apps/web/app/app/profile/profile-form.tsx` (Client Component)
- [ ] Add "Profile" to the user dropdown in `user-menu.tsx`
- [ ] PATCH validates with Zod; returns `ApiResponse<User>`
- [ ] GET returns `ApiResponse<User>`; 401 if no session
- [ ] Toast on success and error (sonner, already installed)

Acceptance:

- [ ] Signed-in user visits `/app/profile` → sees current name, avatar, role badge, email
- [ ] Updates name → saved → reflected in nav on next page load
- [ ] Unauthenticated → `GET /api/user/me` → `401` with `ApiResponse` error shape
- [ ] Invalid PATCH body → `400` with validation error message
- [ ] `pnpm typecheck` passes

---

## Definition of Done

- [ ] `just workers` → worker starts, processes `welcome-email` job on first sign-in
- [ ] Email appears in Mailpit at `http://localhost:8025`
- [ ] `/app/profile` renders correctly; name update persists
- [ ] `just test` green (lint + typecheck + unit tests + build)
- [ ] CI passes

---

## Non-goals for Step 4

- No job scheduling (cron) — pg-boss supports it but the pattern is app-specific
- No job UI / admin dashboard for queue inspection
- No email templates (React Email, MJML) — raw HTML is enough for the template layer
- No avatar upload — image URL field only; file upload is Tier 3 (S3-specific)
- No email verification flow — OAuth identity is already verified
- No role management UI — admins are promoted directly in the DB; per-app concern
