# Step 0 Technology Decisions

**Audience:** Non-technical stakeholders and executive leadership
**Purpose:** Explain what was chosen during the baseline setup phase, why each choice was made, and what it means for the business

---

## What This Document Covers

Before writing a single line of product-specific code, a software project must establish its technical foundation: the programming language, the database, the tools that keep code clean and deployable, and the processes that protect the team from shipping broken software. These choices are called "stack decisions," and they have long-term consequences.

This document records every decision made during Step 0 — the baseline setup — and explains the rationale behind each one in plain terms. Where a decision involves a trade-off, that trade-off is named explicitly.

The decisions are grouped into five areas:

1. [Foundation — Language, runtime, and framework](#1-foundation)
2. [Data layer — Database, cache, and migrations](#2-data-layer)
3. [Developer workflow — How engineers run and share code](#3-developer-workflow)
4. [Quality gates — How broken code is caught before it ships](#4-quality-gates)
5. [Project health — Security, maintenance, and open-source hygiene](#5-project-health)

---

## 1. Foundation

### Language: TypeScript

**What it is:** TypeScript is an extension of JavaScript — the dominant language of the web — that adds a layer of type checking. Before code runs, the tools verify that all the pieces fit together correctly, catching entire categories of bugs at development time rather than in production.

**Why it was chosen:** JavaScript alone is fast to write but notoriously easy to get wrong. TypeScript has become the industry standard for teams who want JavaScript's reach with fewer surprises in production. It also makes large codebases significantly easier to navigate: when a developer opens an unfamiliar file, the type information tells them exactly what each function expects and returns.

**What it means for the business:** Fewer runtime bugs, faster onboarding for new engineers, and a codebase that stays maintainable as the team and product grow. TypeScript is one of the most in-demand skills on the hiring market, so it also broadens the talent pool.

**Trade-off acknowledged:** TypeScript adds a compilation step and requires engineers to be explicit about data shapes. This slightly slows down early prototyping but pays for itself once the codebase grows beyond a handful of files.

---

### Runtime: Node.js v24 LTS

**What it is:** Node.js is the software environment that runs JavaScript/TypeScript on a server (as opposed to in a browser). "LTS" stands for Long-Term Support — a version that its maintainers have committed to keeping stable and secure for several years.

**Why it was chosen:** Node.js is the most widely deployed server-side JavaScript runtime in the world. v24 LTS was selected specifically because LTS versions receive security patches and bug fixes for a defined multi-year window, which means the team is not chasing runtime upgrades constantly and can plan maintenance windows predictably.

**What it means for the business:** Predictable support window, no surprise end-of-life notifications, and access to the latest performance improvements. The version is pinned in the repository (a file called `.nvmrc`), so every developer and every automated build uses exactly the same runtime — eliminating an entire class of "it works on my machine" problems.

**Trade-off acknowledged:** LTS versions are not always the absolute cutting-edge release. That is by design: stability is prioritized over access to experimental features that may change.

---

### Framework: Next.js (App Router)

**What it is:** Next.js is the industry-leading framework for building web applications with React, the dominant UI library. The "App Router" is its current architecture, introduced in 2023, which enables more efficient page rendering and a cleaner code organization model.

**Why it was chosen:** Next.js is maintained by Vercel, has the largest ecosystem of any React framework, and is widely taught and documented. It handles a significant amount of complexity out of the box: routing, server-side rendering, API endpoints, build optimization, and deployment readiness. The App Router specifically enables a pattern where data fetching happens as close to the data as possible, reducing unnecessary round-trips and improving page load performance.

**What it means for the business:** The team can focus on building product features rather than solving infrastructure problems that Next.js already solves well. Engineers familiar with React and Next.js — a very large population — can contribute quickly.

**Trade-off acknowledged:** Next.js is a commercial open-source product primarily driven by Vercel's business interests. It runs on any hosting environment, however, so the project is not locked into any specific cloud provider.

---

## 2. Data Layer

### Database: PostgreSQL

**What it is:** PostgreSQL (often called "Postgres") is a relational database — it stores data in structured tables with defined relationships between them. It is open-source, free to use, and has been in continuous development for over 35 years.

**Why it was chosen:** Postgres is widely regarded as the most capable open-source relational database available. It handles complex queries, large data volumes, and sophisticated data types (including JSON, geospatial data, and full-text search) without requiring additional specialist systems. It is the default recommendation for new projects across the industry.

**What it means for the business:** No licensing costs. Runs on every major cloud provider (AWS, Google Cloud, Azure) with fully managed options, meaning the team is never locked in to a single vendor. An enormous talent pool — almost every backend engineer has worked with Postgres.

**Trade-off acknowledged:** Relational databases require the team to think carefully about data structure upfront. This discipline is a feature, not a bug — it prevents the disorganized data accumulation that plagues projects built on schemaless databases — but it does require some upfront design work.

---

### Cache: Redis

**What it is:** Redis is an in-memory data store — think of it as a very fast notepad that the application can read and write to without touching the main database. It is commonly used for caching (storing the results of expensive operations), session management, and queuing background jobs.

**Why it was chosen:** Redis is included in the baseline because almost every real-world stateful application eventually needs it. Adding it now, before it is strictly required, means the infrastructure is already in place when the first feature that needs it arrives. The cost of including it in the development environment is negligible; the cost of adding it later (retrofitting configuration, updating deployment scripts, retraining developers) is significant.

**What it means for the business:** Faster application response times when caching is implemented. A ready-made foundation for features like rate limiting, session storage, real-time notifications, and background job processing — all common requirements.

**Trade-off acknowledged:** Redis adds one more service to operate. For the development environment this is handled automatically by Docker. For production deployments, managed Redis is available from all major cloud providers.

---

### Migrations: Drizzle ORM + drizzle-kit

**What it is:** A database migration is a versioned, recorded change to the structure of the database (adding a table, changing a column, etc.). Drizzle ORM is a TypeScript library that lets engineers define the database structure in code rather than raw SQL. Drizzle-kit is its companion tool that generates and applies the SQL changes.

**Why it was chosen:** Database changes are one of the highest-risk areas of software development — a badly executed migration can corrupt production data or take a system offline. Drizzle was chosen because it keeps the database schema expressed in TypeScript (consistent with the language decision), generates migration files that can be reviewed and version-controlled, and applies those migrations automatically as part of the startup process. No manual database changes are ever required.

**What it means for the business:** Every database change is tracked, reviewable, and reversible. A new developer setting up the project gets the exact same database state as production, automatically. Rollbacks are possible. The risk of "someone made a manual change to production and now we don't know what the database looks like" — a very common and costly problem — is eliminated.

**Trade-off acknowledged:** Drizzle ORM is younger than some competitors (like Prisma or Sequelize). It was chosen for its performance characteristics and its closeness to standard SQL, which means less "magic" to debug. The project can be migrated to a different ORM if needs change, since the migration SQL files are plain SQL and are not Drizzle-specific.

---

### Mail sink: Mailpit

**What it is:** Mailpit is a fake email server used only in the development environment. Any emails the application sends are captured and displayed in a web interface rather than delivered to real inboxes.

**Why it was chosen:** Applications almost always send emails at some point (account verification, password reset, notifications). Having a local mail capture tool from the start means developers can build and test email functionality without risk of accidentally spamming real users or needing access to production email credentials.

**What it means for the business:** Safe email development from day one. No risk of test emails reaching real customers during development.

**Trade-off acknowledged:** Mailpit is a development-only tool and has no presence in production.

---

## 3. Developer Workflow

### Package manager: pnpm (monorepo workspace)

**What it is:** A package manager handles the thousands of third-party software libraries a modern application depends on — downloading them, keeping them at the right versions, and making them available to the code. This project uses pnpm (short for "performant npm") organized as a monorepo workspace, meaning all the sub-projects (the web app, the configuration package, the database package) live in one repository but are managed as distinct units.

**Why it was chosen:** pnpm is significantly faster and more storage-efficient than the alternatives (npm and Yarn) because it shares library files across projects rather than duplicating them. The monorepo structure was chosen because the web app, configuration, and database packages are closely related and deploy together — keeping them in one repository simplifies coordination, makes cross-package changes atomic, and eliminates the version synchronization problems that arise when related code is split across multiple repositories.

**What it means for the business:** Faster developer setup and CI builds, lower disk usage on development machines and build servers, and a codebase where related code is easy to find and change together.

**Trade-off acknowledged:** A monorepo requires some additional tooling configuration upfront (which was done in Step 0). It also means all developers work from a single repository, which suits teams working on a cohesive product.

---

### Command runner: just

**What it is:** `just` is a task runner — a tool that provides short, memorable commands for common development tasks. A file called `Justfile` lists these commands and what they actually do.

**Why it was chosen:** Without a task runner, developers must remember the exact sequence of commands to start the application, run tests, or reset their environment. A wrong order (running tests before starting the database, for example) causes confusing failures. `just dev` handles the correct sequence automatically: start Docker services → apply database migrations → start the development server. The developer cannot do it wrong.

**What it means for the business:** Dramatically reduced onboarding time. A new developer can get a fully working environment with one command. Fewer support requests between developers about how to get things running.

**Trade-off acknowledged:** `just` must be installed separately (it is not a Node.js package). It is widely available and takes seconds to install, but it is an additional prerequisite. Installation instructions are in `CONTRIBUTING.md`.

---

## 4. Quality Gates

### What quality gates are

A quality gate is an automated check that code must pass before it is accepted. This project enforces four: linting, type-checking, automated tests, and a successful build. A fifth — a "smoke test" — verifies that the running application actually connects to its database and cache correctly.

These gates run automatically on every proposed code change (called a pull request) via GitHub Actions, the CI/CD system. A proposed change that fails any gate cannot be merged into the main codebase.

---

### Linter: ESLint v9

**What it is:** A linter reads code and flags problems — not necessarily bugs, but code that is confusing, inconsistent, or known to cause problems in certain situations. ESLint is the standard linter for JavaScript and TypeScript.

**Why it was chosen:** Linting catches entire categories of problems automatically, without a human having to notice them in code review. The v9 "flat config" format was chosen because it is the current standard, reducing future migration work.

**What it means for the business:** Code review time spent on style and obvious mistakes is nearly eliminated. Reviewers can focus on logic and design rather than formatting.

---

### Formatter: Prettier

**What it is:** A code formatter automatically rewrites code to match a consistent style — indentation, line length, quotation marks, etc.

**Why it was chosen:** Formatting debates (tabs vs. spaces, where to put curly braces) are a notorious time sink in software teams. Prettier ends the debate entirely: it formats code automatically, and everyone's code looks the same. It runs automatically before each commit via Lefthook (see below).

**What it means for the business:** No time lost to style debates. Code is consistently readable across the team regardless of individual preferences.

---

### Pre-commit hooks: Lefthook

**What it is:** A pre-commit hook is a script that runs automatically every time a developer saves code to the version control system (a "commit"). Lefthook manages these hooks.

**Why it was chosen:** It ensures that linting and formatting run on every commit, not just when a developer remembers to run them. Problems are caught on the developer's own machine, before they are ever uploaded, rather than in CI where the feedback loop is slower.

**What it means for the business:** The CI pipeline processes cleaner code, reducing failures and the back-and-forth of "fix the formatting" comments. Developers get faster feedback.

---

### Test runner: Vitest

**What it is:** Vitest is a framework for writing and running automated tests — code that verifies other code behaves as expected.

**Why it was chosen:** Vitest is the leading test runner in the modern TypeScript ecosystem. It is fast, integrates naturally with the existing build toolchain, and has a familiar API for developers coming from other testing backgrounds. A placeholder test was written in Step 0 to establish the pattern; the test suite will grow as features are added.

**What it means for the business:** Automated tests are the primary mechanism for catching regressions — situations where a new change accidentally breaks something that was working. Without tests, the only way to know if something broke is for a user to find it. With tests, the machine finds it first.

---

### CI/CD: GitHub Actions

**What it is:** GitHub Actions is an automation platform that runs scripts in response to code repository events — specifically, every time a developer proposes a change. It runs all four quality gates (lint, typecheck, test, build) plus a smoke test against a real database.

**Why it was chosen:** GitHub Actions is built into GitHub (where the code is hosted), requires no additional infrastructure, and has a large library of pre-built automation components. It is effectively free for the usage levels of a small-to-medium team.

**What it means for the business:** No code that fails quality checks can enter the main codebase, regardless of who wrote it or how experienced they are. This creates a consistent, enforced quality floor. It also means the team can move quickly without fear: if a change breaks something, CI catches it before it reaches production.

---

## 5. Project Health

### Dependency automation: Dependabot

**What it is:** Dependabot is a GitHub tool that automatically scans the project's dependencies (the third-party libraries it uses) and opens pull requests when newer versions are available.

**Why it was chosen:** Software dependencies have a silent security risk: they go out of date. Outdated dependencies may contain known security vulnerabilities. Without automation, keeping dependencies current is a manual task that teams routinely deprioritize — until a vulnerability is discovered. Dependabot makes updates a routine, automated process rather than an emergency response.

**What it means for the business:** Reduced security exposure. Dependencies are reviewed and updated on a weekly cadence rather than ad hoc. Each Dependabot update still goes through the CI quality gates before it can be merged.

**Trade-off acknowledged:** Dependabot generates pull requests that require human review and approval. This is intentional — automated updates should not bypass human judgement. The weekly cadence was chosen as a balance between staying current and avoiding alert fatigue.

---

### Open-source hygiene: CONTRIBUTING.md, SECURITY.md, CODEOWNERS

**What these are:**

- **CONTRIBUTING.md** — A guide for anyone who wants to work on the project: what to install, how to get a development environment running, how to submit changes.
- **SECURITY.md** — Instructions for how to responsibly report a security vulnerability, including a contact address and a commitment to respond within 72 hours.
- **CODEOWNERS** — A file that tells GitHub who must review and approve changes to specific parts of the codebase.

**Why they were included:** These three files are the minimum expected of any professionally maintained software project that may be shared with external contributors or reviewed by external parties (auditors, partners, potential acquirers). Their absence signals immaturity; their presence signals that the team takes professional standards seriously.

**What it means for the business:** A clear process for vulnerability disclosure reduces the risk of a security researcher publicly disclosing a vulnerability without warning (a common and reputationally damaging scenario). CODEOWNERS ensures that no code change can bypass the review of a designated expert. CONTRIBUTING.md reduces onboarding friction for new team members and external contributors alike.

---

## Summary Table

| Decision         | Choice                             | Primary Reason                                                   |
| ---------------- | ---------------------------------- | ---------------------------------------------------------------- |
| Language         | TypeScript                         | Catches bugs before runtime; industry standard                   |
| Runtime          | Node.js v24 LTS                    | Stable, multi-year support window                                |
| Framework        | Next.js (App Router)               | Largest ecosystem; handles routing, rendering, APIs              |
| Database         | PostgreSQL                         | Best-in-class open-source relational database; no vendor lock-in |
| Cache            | Redis                              | Required by almost all stateful apps; cheap to include now       |
| Migrations       | Drizzle ORM + drizzle-kit          | Schema changes tracked, versioned, and applied automatically     |
| Mail (dev)       | Mailpit                            | Safe email testing without risk of reaching real users           |
| Package manager  | pnpm (monorepo)                    | Faster, more efficient; related code in one place                |
| Command runner   | just                               | One command to start everything correctly                        |
| Linter           | ESLint v9                          | Catches code problems automatically                              |
| Formatter        | Prettier                           | Eliminates style debates; enforces consistency                   |
| Pre-commit hooks | Lefthook                           | Runs checks before code is ever uploaded                         |
| Tests            | Vitest                             | Catches regressions before users do                              |
| CI/CD            | GitHub Actions                     | Enforces quality gates on every proposed change                  |
| Dep automation   | Dependabot                         | Keeps dependencies current; reduces security exposure            |
| OSS hygiene      | CONTRIBUTING, SECURITY, CODEOWNERS | Professional baseline; supports responsible disclosure           |

---

_Document owner: Engineering — last updated Step 0 (baseline setup)_
