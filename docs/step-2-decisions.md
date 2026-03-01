# Step 2 Technology Decisions

**Audience:** Non-technical stakeholders and executive leadership
**Purpose:** Explain what was chosen during the security hardening and observability phase, why each choice was made, and what it means for the business

---

## What This Document Covers

Step 2 hardened the application's security posture, added structured logging so that what happens inside the application is observable, and introduced a database seed script so that development and testing environments can be populated with consistent, realistic data.

None of these changes affect application features — users do not see them directly. They are the kind of foundational work that separates a prototype from a production-ready system: the difference between an application that works and an application that can be operated, diagnosed, and trusted.

The decisions are grouped into three areas:

1. [Security headers — Protecting users' browsers](#1-security-headers)
2. [Structured logging — Making the application observable](#2-structured-logging)
3. [Seed script — Consistent development data](#3-seed-script)

---

## 1. Security Headers

### HTTP security headers via Next.js configuration

**What it is:** Every time a browser loads a page, the server sends invisible metadata alongside the visible content — these are called HTTP headers. Security headers are a specific category of this metadata that instruct the browser on how to handle the page safely. Step 2 configured the following headers:

- **X-Frame-Options** — Prevents the application from being embedded inside another website (a common attack called "clickjacking," where users think they are clicking on the legitimate app but are actually clicking on an invisible overlay on a malicious site).
- **X-Content-Type-Options** — Prevents browsers from guessing what type of file a response contains. Without this, browsers might execute a file as JavaScript even if the server didn't intend it to be.
- **Referrer-Policy** — Controls how much information about the current URL is sent when users click links to other websites. The chosen policy sends no referrer information to other domains, protecting user privacy.
- **Permissions-Policy** — Restricts which browser features the application can request access to (camera, microphone, geolocation, etc.). The policy disables all of these by default — only enable what the application genuinely needs.
- **Strict-Transport-Security (HSTS)** — Instructs browsers to always connect to the application over an encrypted connection (HTTPS), and to remember this preference for one year. This prevents accidental or malicious downgrade attacks to unencrypted HTTP.
- **Content-Security-Policy (CSP)** — Specifies exactly which sources of scripts, styles, images, and other resources the browser is allowed to load. A strict CSP is one of the most effective defenses against cross-site scripting (XSS) attacks, where an attacker attempts to inject malicious code into a trusted page.

**Why these were chosen:** These headers are the minimum expected by modern security audits and by major compliance frameworks (SOC 2, ISO 27001, PCI-DSS). They are free — there is no cost to setting them, no performance impact on users, and no ongoing maintenance required. Omitting them is an unnecessary risk that would be flagged in any security review.

**What it means for the business:** The application passes the header-check portion of automated security scans and penetration tests. Users are protected from a category of browser-based attacks without any visible change to the application. The CSP provides defense-in-depth against XSS, one of the most common web vulnerabilities.

**Trade-off acknowledged:** The Content-Security-Policy requires ongoing maintenance as the application grows. Adding a new script source, font, or analytics provider requires the policy to be updated. A CSP that is too strict will break functionality; one that is too loose provides incomplete protection. The policy was configured to be strict in production while allowing the slightly more permissive settings that Next.js development mode requires.

---

## 2. Structured Logging

### Logger: pino + pino-pretty

**What it is:** Logging is the practice of recording what the application is doing as it runs — which requests it received, which database queries it ran, which errors it encountered. A "structured" logger records this information as machine-readable data (JSON) rather than free-form text, so that log management systems can search, filter, and alert on specific fields without parsing text.

Pino is the leading structured logger for Node.js, chosen for its exceptional performance — logging is done on a worker thread so it does not slow down request handling. Pino-pretty is a companion tool that formats the JSON output into human-readable text during development, making local debugging practical.

**Why it was chosen:** As soon as an application is running in production and something goes wrong, unstructured logs ("Error occurred at 2:14pm") are nearly useless. Structured logs let operators ask precise questions: "How many requests failed in the last hour?", "Which user triggered this error?", "What was the database query latency before this outage started?" Without structured logging, these questions cannot be answered. Pino was chosen specifically because it adds essentially no performance overhead — log operations do not block request processing.

**What it means for the business:** When something goes wrong in production, the engineering team can find the cause and understand the blast radius quickly rather than guessing. Structured logs integrate directly with cloud log management services (AWS CloudWatch, Google Cloud Logging, Datadog, etc.) without any additional configuration. This reduces both the duration and the cost of incidents.

**Trade-off acknowledged:** Pino requires explicit configuration to work correctly inside Next.js because of how Next.js bundles server code. The logger was placed in the application's external packages list, which tells Next.js to load pino directly rather than bundling it — a one-time configuration step that is already done.

---

## 3. Seed Script

### Database seed script: idempotent, version-controlled

**What it is:** A seed script populates the database with a known set of test data. In this case, the seed creates two example user records — one with a regular `user` role and one with an `admin` role — so that developers can test both access levels immediately after setting up the environment. The script is idempotent, meaning it can be run repeatedly without creating duplicate records or errors.

**Why it was chosen:** Without a seed script, every developer who sets up a fresh environment must manually create test users before they can exercise any part of the application. This is time-consuming, inconsistent (different developers create different test data), and error-prone (developers occasionally test against unexpected account states). A seeded environment is consistent across the entire team.

**What it means for the business:** New developers are productive faster. QA environments are consistent. Automated tests run against predictable data. The `just seed` command makes this a single-step operation.

**Trade-off acknowledged:** The seed script creates data that should never be present in a real production database. It is an operation for development and test environments only. The script does not run automatically — it must be invoked deliberately with `just seed` — so there is no risk of it running against a production database accidentally.

---

## Summary Table

| Decision           | Choice                             | Primary Reason                                                     |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------ |
| Security headers   | Via Next.js config (7 headers)     | Free protection against browser-based attacks; required by audits  |
| Clickjacking       | X-Frame-Options: SAMEORIGIN        | Prevents embedding in malicious sites                              |
| XSS defense        | Content-Security-Policy            | Restricts executable sources; strongest XSS mitigation available   |
| Transport security | HSTS                               | Enforces encrypted connections; remembered by browser for 1 year   |
| Logger             | pino + pino-pretty                 | Structured, machine-readable logs; near-zero performance overhead  |
| Log format         | JSON (prod) / pretty-printed (dev) | Machine-readable in production; human-readable locally             |
| Seed script        | Idempotent; `just seed` command    | Consistent dev environments; both role types available immediately |

---

_Document owner: Engineering — last updated Step 2 (security headers, structured logging, and seed script)_
