# Step 4 Technology Decisions

**Audience:** Non-technical stakeholders and executive leadership
**Purpose:** Explain what was chosen during the background jobs, transactional email, and profile management phase, why each choice was made, and what it means for the business

---

## What This Document Covers

Step 4 added three capabilities that nearly every production application needs shortly after launch: a system for running work in the background without making users wait, a way to send transactional emails reliably, and a page where users can view and update their own profile.

These additions represent the transition from "the application is working" to "the application can serve users and communicate with them." They also introduce important architectural patterns — separating slow work from request handling, abstracting external communication behind testable interfaces — that will be reused as the application grows.

The decisions are grouped into three areas:

1. [Background jobs — Running work outside of the request cycle](#1-background-jobs)
2. [Transactional email — Communicating with users via email](#2-transactional-email)
3. [Profile management — Letting users control their own data](#3-profile-management)

---

## 1. Background Jobs

### Job queue backend: `pg-boss` (Postgres-backed)

**What it is:** A job queue is a mechanism for scheduling work to happen later or asynchronously. Rather than making a user wait while the server sends an email, processes a file, or calls an external API, the server schedules that work as a "job" and returns a response immediately. A separate background worker process picks up the job and executes it.

`pg-boss` is a job queue that stores its job records inside the same PostgreSQL database the application already uses. No additional infrastructure is required.

**Why `pg-boss`:** The most common alternative is a Redis-based job queue (Bull, BullMQ). Redis is already in the stack, so this seems natural — but Redis is an in-memory store, which means jobs are lost if Redis restarts before they are processed. `pg-boss` stores jobs in PostgreSQL, which writes data durably to disk. Jobs survive Redis restarts, server restarts, and deployment events. This durability guarantee is especially important for jobs that trigger real-world side effects, like sending an email — a lost job means a user never receives their welcome message and there is no record that it was ever scheduled.

**What it means for the business:** Long-running operations (sending emails, processing uploads, calling external APIs, generating reports) happen in the background, so users see fast responses. Jobs are not silently lost if a server restarts — they are retried. The queue is visible in the application database, so administrators can inspect job history and failure rates using standard database tools.

**Trade-off acknowledged:** `pg-boss` adds a `pgboss` schema to the application database. This schema is managed entirely by `pg-boss` itself — no manual migration is needed — but it does mean the database contains tables the team did not write directly. At very high job volumes (millions of jobs per day), a dedicated Redis-based queue would outperform a Postgres-backed one. This is not a concern at template scale.

---

### Job queue location: `packages/jobs` workspace package

**What it is:** The job queue configuration, job definitions, and worker process all live in a dedicated workspace package (`packages/jobs`), separate from the Next.js application.

**Why:** Keeping job logic inside the Next.js application creates coupling: the web server and the background worker share the same process, making it impossible to scale or restart them independently. A separate package allows the worker to be run as its own process (`just workers`) that can be scaled, restarted, and deployed independently from the web server. Job definitions can also be imported by server-side code in the Next.js app (to enqueue jobs without re-implementing the queue connection logic).

**What it means for the business:** The web server and background worker can be operated independently. If the worker crashes, the web server continues serving users. If job processing falls behind, the worker can be scaled up without touching the web server.

---

## 2. Transactional Email

### Email transport: `nodemailer` (generic SMTP)

**What it is:** Nodemailer is the most widely used email-sending library for Node.js. It connects to any SMTP server — the standard protocol used by all email providers — using credentials from environment variables. In development, it connects to Mailpit (the local email capture tool). In production, it connects to whichever provider the team chooses (SendGrid, Amazon SES, Postmark, Mailgun, or any standard SMTP host).

**Why nodemailer over a provider-specific SDK:** Provider-specific SDKs (SendGrid's SDK, Postmark's SDK) lock the application to that vendor's API. Switching providers requires rewriting code. Nodemailer speaks standard SMTP, which every transactional email provider supports — switching providers is a matter of updating four environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`), not rewriting code.

**What it means for the business:** No vendor lock-in for email delivery. Competitive pricing leverage — the team can switch providers if costs increase or service quality degrades, without a code change or redeploy. The same abstraction works in every environment from local development to production.

**Trade-off acknowledged:** Nodemailer is a lower-level abstraction than some provider SDKs. Features that are specific to a particular provider (e.g., SendGrid's template management or Postmark's bounce webhooks) must be implemented separately. These features are per-application concerns, not template concerns.

---

### Email abstraction location: `packages/email` workspace package

**What it is:** Email sending logic lives in a dedicated workspace package (`packages/email`) that exports a single `sendEmail()` function. Any part of the application — the web server, the background worker — can import this function to send email.

**Why:** If email sending were wired directly into the Next.js app routes, it would be impossible for the background worker to send emails without importing application-layer code. The shared package creates a clean boundary: both the web server and the worker depend on `packages/email`, but neither depends on the other.

---

### Dev email: Mailpit (local SMTP catch-all)

**What it is:** Mailpit is a fake email server that runs in the development Docker Compose stack. Any emails the application sends are captured and displayed in a web interface at `http://localhost:8025` rather than delivered to real email addresses.

**Why:** Developers must be able to test email-sending code without risk of accidentally emailing real users or requiring access to production email credentials. Mailpit captures all outgoing email locally. The same `sendEmail()` function and the same SMTP configuration are used in development and production — the only difference is the SMTP host (`localhost` vs. a real provider).

**What it means for the business:** Safe email development. No risk of test emails reaching real customers during development or testing. Developers can inspect the full content and headers of sent emails without a real email account.

---

## 3. Profile Management

### Editable profile fields: `name` and `image`

**What it is:** Users can update their display name and avatar image URL from a profile page at `/app/profile`. Email address and role are displayed but cannot be changed by the user.

**Why these fields:** The display name and avatar were initially set from the user's OAuth profile (Google or Microsoft), but users may want to use a different name or image within the application. These fields are genuinely under the user's control. Email address, by contrast, is the OAuth identity — changing it would break the login linkage. Role is controlled by administrators, not users, to prevent privilege escalation.

**What it means for the business:** Users can personalize their experience without requiring administrator intervention. The constraint against users changing their own role prevents a trivial privilege escalation attack.

**Trade-off acknowledged:** The profile page allows users to enter arbitrary image URLs, not to upload image files. File upload requires object storage (S3 or equivalent), which is infrastructure beyond the scope of the template layer. Applications that need avatar upload can add it per-application.

---

### Profile API: standard `ApiResponse<T>` envelope

**What it is:** The profile API (`GET /api/user/me` and `PATCH /api/user/me`) follows the same `ApiResponse<T>` envelope established in Step 1. All input is validated with Zod before any database operation.

**Why:** Consistent API design reduces cognitive overhead for developers working across multiple endpoints. Input validation with Zod at the API boundary ensures that malformed data never reaches the database layer — invalid names, non-URL image values, or oversized inputs are rejected before any write operation occurs.

---

## Summary Table

| Decision                | Choice                       | Primary Reason                                                    |
| ----------------------- | ---------------------------- | ----------------------------------------------------------------- |
| Job queue backend       | `pg-boss` (Postgres-backed)  | Durable job storage; no new infrastructure; jobs survive restarts |
| Job queue location      | `packages/jobs`              | Worker runs as independent process; separately scalable           |
| Email transport         | `nodemailer` (generic SMTP)  | No provider lock-in; swap providers via env vars only             |
| Email dev capture       | Mailpit                      | Already in Compose stack; safe local email testing                |
| Email abstraction       | `packages/email`             | Shared by web and worker; clean boundary between packages         |
| Profile editable fields | `name` and `image` only      | User-controlled; email/role changes carry security implications   |
| Profile image input     | URL field (no upload)        | File upload requires S3; deferred to per-app implementation       |
| Profile API design      | `ApiResponse<T>` + Zod input | Consistent envelope; validated input before any DB write          |

---

_Document owner: Engineering — last updated Step 4 (background jobs, transactional email, and profile management)_
