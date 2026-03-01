# Step 3 Technology Decisions

**Audience:** Non-technical stakeholders and executive leadership
**Purpose:** Explain what was chosen during the abuse prevention, error tracking, and browser testing phase, why each choice was made, and what it means for the business

---

## What This Document Covers

Step 3 addressed three gaps that stand between a functional application and one that is safe to put in front of real users at scale: protection against automated abuse, visibility into crashes and errors, and a verified test that the application actually works as a whole in its production form.

These capabilities are often deferred until after launch. Deferring them means launching with known blind spots: the team cannot see when the application crashes, cannot prevent automated login attacks, and has no automated proof that the application boots and renders correctly. Step 3 closes these gaps before they become incidents.

The decisions are grouped into three areas:

1. [Rate limiting — Preventing automated abuse](#1-rate-limiting)
2. [Error tracking — Knowing when the application crashes](#2-error-tracking)
3. [End-to-end testing — Proving the app works from a user's perspective](#3-end-to-end-testing)

---

## 1. Rate Limiting

### Rate limiter: `@upstash/ratelimit` with Redis sliding window

**What it is:** A rate limiter counts how many requests a single IP address makes within a time window, and blocks further requests if the count exceeds a threshold. This project enforces a limit of 10 requests per 60 seconds on all authentication endpoints (`/api/auth/**`). A blocked request receives an HTTP 429 ("Too Many Requests") response with a `Retry-After` header indicating when the client may try again.

**Why these endpoints:** Authentication endpoints are the primary target of credential stuffing and brute-force attacks — automated programs that try thousands of username/password combinations or attempt to abuse OAuth flows. Rate limiting these endpoints makes such attacks computationally expensive without affecting legitimate users, who almost never make more than a handful of auth requests per minute.

**Why `@upstash/ratelimit`:** This library implements a sliding-window algorithm — the most accurate rate limiting strategy — and is designed to work with any Redis instance. It does not require a separate Upstash account; it uses the Redis server already in the project's Docker Compose stack. The sliding window approach is more accurate than simpler fixed-window approaches, which can allow double the intended request rate at window boundaries.

**What it means for the business:** Dramatically increased cost and difficulty for attackers attempting automated credential attacks. Rate limiting is one of the first controls auditors look for and a requirement in many compliance frameworks. Legitimate users are entirely unaffected under normal usage.

**Trade-off acknowledged:** The rate limit is applied at the infrastructure level using IP addresses. Sophisticated attackers can rotate IP addresses to circumvent per-IP limits. For an additional layer of defense, application-level limits (per account, per session) can be added per application. The IP-based limit here is the template baseline — it stops the vast majority of automated attacks.

---

### Scope: auth endpoints only

**What it is:** The rate limiter applies only to `/api/auth/**` routes, not to all API routes.

**Why:** Rate limiting every API endpoint involves significantly more complexity — different endpoints have legitimately different usage patterns, and an overly aggressive limit on data-fetching routes would break normal application behavior. The decision to limit only auth endpoints reflects where the actual risk is: auth endpoints are the targets of brute-force attacks; other endpoints are not. Per-application rate limiting on other endpoints can be added when specific needs are identified.

---

## 2. Error Tracking

### Error tracker: Sentry (`@sentry/nextjs`), opt-in via environment variable

**What it is:** Sentry is an error tracking service that automatically captures unhandled exceptions in both the server and browser, records the stack trace, the user's browser and operating system, the URL they were on, and recent breadcrumbs (what the user did before the crash), and sends this information to a dashboard where the engineering team can investigate and track resolution.

**Why it was chosen:** Without error tracking, the only way to learn that a user experienced a crash is if they report it — and most users don't. They simply leave. Error tracking creates an automatic feedback loop: every crash generates a report, the team sees it before users complain about it, and the data needed to diagnose and fix it is already captured.

Sentry is the de facto industry standard for this category. It has first-class support for Next.js via a dedicated SDK that instruments both server-side rendering errors and client-side browser errors automatically.

**Why opt-in:** The integration is entirely opt-in — Sentry is only activated when the `SENTRY_DSN` environment variable is set. If it is absent, the application starts and runs normally with zero Sentry-related code paths executing. This design means the application has no hard dependency on a third-party service, no risk of startup failure if Sentry's service is unreachable, and no inadvertent error reporting from development environments.

**What it means for the business:** The team learns about crashes immediately rather than from user complaints. The data captured makes crashes faster to diagnose and fix. The opt-in design keeps the development environment clean and avoids vendor lock-in — a different error tracking service can be substituted by changing a single environment variable.

**Trade-off acknowledged:** Sentry is a commercial service with a free tier that suits many projects but has costs at higher volumes. Error events may contain user data (stack traces sometimes capture request parameters or session information); the Sentry configuration should be reviewed for data privacy compliance before production use. The `tracesSampleRate` controls what fraction of requests are traced — this can be tuned per application to manage costs.

---

## 3. End-to-End Testing

### E2E framework: Playwright

**What it is:** End-to-end (E2E) tests control a real browser to verify that the application works correctly from a user's perspective. Playwright is an E2E testing framework maintained by Microsoft that supports all major browsers. Step 3 establishes a smoke test: load the home page, verify that the navigation element is present.

**Why Playwright:** Playwright has become the leading E2E testing framework for web applications, surpassing Selenium in both capability and reliability. It has first-class support for Next.js, handles complex asynchronous behavior correctly without flaky timing hacks, and is actively maintained. Its API is clear and its test reports are detailed.

**Why a smoke test first:** A single smoke test — "does the page load and render its primary navigation?" — provides high value for low cost. It proves the application boots, connects to required services, compiles its components, and serves HTML. A smoke test that fails is immediately actionable: something fundamental is broken. The test suite will grow to cover user-facing flows in subsequent steps.

**What it means for the business:** Automated proof that the application works from end to end — not just that individual functions work in isolation, but that everything assembles and serves correctly. This catches a class of failures that unit tests cannot: misconfigured environment variables, broken build outputs, missing assets, and integration failures between components.

**Trade-off acknowledged:** E2E tests are slower than unit tests and require browser binaries to be installed. In CI they run against the production build of the application, which takes additional time. The test suite is deliberately small — a smoke test only — to keep CI fast while establishing the pattern. Application teams will add authenticated and transactional E2E tests as features are developed.

---

### E2E CI target: production build

**What it is:** In CI, Playwright tests run against the same Next.js production server (`next start`) that would run in a real deployment, not the development server.

**Why:** Running tests against the development server can mask production-only failures. The production build performs additional optimizations and code transforms; a component that renders correctly in development might fail in the production build due to stricter bundling or missing environment variables. By testing against the production build in CI, the team knows that what they tested is exactly what will be deployed.

---

## Summary Table

| Decision              | Choice                                | Primary Reason                                                     |
| --------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| Rate limiter library  | `@upstash/ratelimit`                  | Sliding-window accuracy; works with existing Redis; no new infra   |
| Rate limit scope      | `/api/auth/**` only                   | Auth endpoints are the brute-force target; other routes unaffected |
| Rate limit default    | 10 requests / 60 seconds per IP       | Conservative; stops automated attacks; transparent to real users   |
| Error tracking        | Sentry via `@sentry/nextjs`           | Industry standard; captures full crash context automatically       |
| Error tracking opt-in | `SENTRY_DSN` env var gates activation | No hard dependency on third-party service; dev environments clean  |
| E2E framework         | Playwright                            | First-class Next.js support; most capable modern E2E framework     |
| E2E CI target         | Production build (`next start`)       | Tests exactly what ships; avoids dev-mode false positives          |
| Initial E2E scope     | Smoke test (home page nav visible)    | High value, low cost; proves fundamental assembly is correct       |

---

_Document owner: Engineering — last updated Step 3 (rate limiting, error tracking, and E2E scaffolding)_
