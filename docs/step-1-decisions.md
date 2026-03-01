# Step 1 Technology Decisions

**Audience:** Non-technical stakeholders and executive leadership
**Purpose:** Explain what was chosen during the authentication and UI foundation phase, why each choice was made, and what it means for the business

---

## What This Document Covers

Step 1 added the first layer of substance that every real application needs before it can serve real users: a sign-in system, a record of who the user is, a polished visual shell, a consistent contract for how the application communicates with its own frontend, and a production-ready container image.

This document records every decision made during Step 1 and explains the rationale in plain terms. Where a decision involves a trade-off, that trade-off is named explicitly.

The decisions are grouped into five areas:

1. [Authentication — How users prove who they are](#1-authentication)
2. [User data — How the application stores user records](#2-user-data)
3. [UI foundation — What the interface is built with](#3-ui-foundation)
4. [API contract — How the app communicates internally](#4-api-contract)
5. [Deployment artifact — How the app is packaged for production](#5-deployment-artifact)

---

## 1. Authentication

### Auth library: Auth.js v5 (NextAuth)

**What it is:** Auth.js (formerly NextAuth) is a widely used open-source authentication library purpose-built for Next.js. Version 5, the current major release, was designed specifically for the App Router architecture that this project uses.

**Why it was chosen:** Authentication is one of the highest-risk areas of software development — a mistake here can expose user data or allow unauthorized access. Auth.js handles the cryptographic complexity of OAuth flows, session signing, and callback validation correctly and has been battle-tested across thousands of production deployments. Using it means the team is not reinventing a well-understood (but difficult to implement correctly) problem. v5 was chosen over v4 because it is the actively maintained release with first-class support for the App Router.

**What it means for the business:** Secure sign-in without the cost and risk of building authentication from scratch. When security vulnerabilities are discovered in the library, the Auth.js team issues patches that the project can apply with a dependency update.

**Trade-off acknowledged:** The v5 API differs meaningfully from the widely documented v4, which means some online tutorials and StackOverflow answers will reference the older API. The team should consult the v5 documentation directly.

---

### OAuth providers: Google + Microsoft Entra ID

**What it is:** OAuth is an industry-standard protocol that lets users sign in using an account they already have — Google or Microsoft — rather than creating a new password. Microsoft Entra ID (formerly Azure Active Directory) is Microsoft's identity platform used by most enterprise organizations.

**Why it was chosen:** These two providers cover the two dominant sign-in scenarios: consumer users (who overwhelmingly have Google accounts) and enterprise/organizational users (who are typically on Microsoft 365 and therefore have Entra IDs). Supporting both from day one means the application can serve both market segments without retrofitting authentication later, which is significantly more disruptive.

**What it means for the business:** Users sign in with credentials they already know and trust. No passwords to store, no password reset flows to build, no risk of a password database breach. Enterprise sales are not blocked by "we don't support corporate SSO."

**Trade-off acknowledged:** Each OAuth provider requires setup in that provider's developer console — Google Cloud Console for Google, Azure Portal for Entra. These are one-time setup steps, but they require access to those platforms and a small amount of configuration. Instructions are documented in `docs/step-1.md`.

---

### Session strategy: Stateless JWT (no database sessions table)

**What it is:** When a user signs in, the server creates a cryptographically signed token (a JSON Web Token, or JWT) that is stored in the user's browser. On each subsequent request, the browser sends this token, and the server verifies its signature without needing to query a database.

**Why it was chosen:** The alternative — storing session records in a database table and looking them up on every request — adds database overhead to every page load and requires managing session cleanup. JWTs are self-contained: the server can verify them instantly without any database query, which keeps the application fast and the database load low. This is the appropriate default for most applications.

**What it means for the business:** Faster page loads. No session table to maintain or clean up. The application scales horizontally without session-sharing concerns.

**Trade-off acknowledged:** Stateless JWTs cannot be individually revoked before they expire — if a user's account is compromised and their token stolen, that token remains valid until it naturally expires. This is an acceptable risk for most applications. If individual session revocation becomes a requirement, the architecture can be extended to a database-backed session table.

---

## 2. User Data

### User table: Custom `users` table with manual upsert

**What it is:** When a user first signs in, their email, display name, and profile picture are written to a `users` table in the application's own database. On subsequent sign-ins, the record is updated rather than duplicated. This table is defined explicitly in the project's schema, not managed by the authentication library.

**Why it was chosen:** Auth.js has an optional database adapter that can manage a user table automatically, but using it couples the database schema to the library's assumptions. If the library changes its schema, or if the team needs to add custom columns, the coupling creates friction. By managing the table explicitly, the team owns the schema entirely — adding columns, constraints, or indexes is straightforward.

**What it means for the business:** A reliable, queryable record of every user in the system. The user table can be extended with any application-specific fields (subscription status, preferences, etc.) without fighting the authentication library's conventions.

**Trade-off acknowledged:** The upsert logic (insert if new, update if returning) is written in the application rather than delegated to a library. This is a small amount of additional code, but it is simple, explicit, and easy to audit.

---

### Role model: Binary enum (`user` | `admin`)

**What it is:** Every user record has a `role` field that can be either `user` (the default for all new sign-ups) or `admin` (granted manually by directly updating the database record). Middleware enforces that routes under `/admin/**` are accessible only to admins.

**Why it was chosen:** A two-value role model covers the access control patterns needed by the vast majority of applications: a protected area for all authenticated users, and a separate admin area for operators. It avoids the complexity of a fine-grained permission system, which is typically over-engineered at this stage and adds significant maintenance burden.

**What it means for the business:** Administrators can access management functionality; regular users cannot. The model is simple enough to reason about and audit easily.

**Trade-off acknowledged:** A two-value enum is deliberately minimal. Applications that need more granular roles (e.g., `editor`, `viewer`, `billing-admin`) will need to extend this model. The extension path is straightforward — adding values to the enum and updating the middleware — but it is explicitly out of scope for the template layer.

---

## 3. UI Foundation

### UI library: shadcn/ui + Tailwind CSS

**What it is:** shadcn/ui is a collection of accessible, unstyled UI components (buttons, cards, menus, etc.) that are copied directly into the project's source code rather than installed as an opaque library. Tailwind CSS is a utility-first styling system that applies design through class names rather than separate stylesheet files.

**Why it was chosen:** The combination has become the dominant approach for new React/Next.js projects because of how it manages the tension between component convenience and long-term flexibility. Because the shadcn components live in the project's own codebase, they can be modified freely — there is no library version to pin or upgrade, no risk of a third-party breaking change, no licensing restriction on modification. Tailwind ensures that styling is co-located with the markup it applies to, making it easy to understand and change.

**What it means for the business:** A polished, accessible interface from day one. No dependency on a UI vendor's release schedule. The design system can be customized arbitrarily as the product's visual identity evolves.

**Trade-off acknowledged:** shadcn components must be added individually via a CLI command rather than imported from a package. This is intentional — it keeps only the components the project actually uses, rather than shipping an entire component library. It does require developers to know which components exist and how to add them.

---

## 4. API Contract

### API response envelope: `ApiResponse<T>`

**What it is:** Every API route in the application returns a response in one of two shapes: `{ ok: true, data: T }` for success, or `{ ok: false, error: string }` for failure. This shape is defined once in `packages/config/src/types.ts` and used everywhere.

**Why it was chosen:** Without a consistent response shape, client code must handle each API endpoint differently — checking different fields, catching different error patterns. This leads to subtle bugs and inconsistent user experiences (some errors show a toast, some are silent, some crash the page). A uniform envelope means client code is simple and predictable: check `ok`, then access `data` or display `error`.

**What it means for the business:** Consistent error handling across the entire application. When something goes wrong, users see a clear error message. When something succeeds, the success path is uniform. Debugging is easier because there is one shape to inspect.

**Trade-off acknowledged:** Adopting the envelope is a breaking change to any existing API routes. Step 1 updated the health endpoint and the CI smoke test in the same change — these must always be kept in sync.

---

## 5. Deployment Artifact

### Production Dockerfile: Multi-stage build

**What it is:** A Dockerfile is a script that packages the application into a container image — a self-contained, portable unit that can run identically on any machine or cloud environment that supports Docker. A multi-stage build uses several intermediate stages (installing dependencies, compiling TypeScript, building the Next.js app) and produces a final image that contains only what is needed to run the application.

**Why it was chosen:** Container images are the universal currency of modern cloud deployment. Every major cloud provider (AWS, Google Cloud, Azure, Fly.io, Railway, Render) can run a container image without requiring any platform-specific configuration. The multi-stage build approach was chosen because it keeps the final image small — development tools, source code, and build artifacts are not included, only the compiled output needed to serve requests.

**What it means for the business:** The application can be deployed to any cloud provider or self-hosted environment without modification. The container image is a reproducible, versioned artifact that can be tested in staging before being promoted to production.

**Trade-off acknowledged:** Building a Docker image requires Docker to be installed and the build process takes longer than a simple `pnpm build`. This is a one-time cost per release, not a per-developer daily concern.

---

## Summary Table

| Decision          | Choice                      | Primary Reason                                                |
| ----------------- | --------------------------- | ------------------------------------------------------------- |
| Auth library      | Auth.js v5 (NextAuth)       | Battle-tested OAuth; first-class App Router support           |
| OAuth providers   | Google + Microsoft Entra ID | Covers consumer and enterprise sign-in from day one           |
| Session strategy  | Stateless JWT               | Fast; no session table; scales horizontally                   |
| User table        | Custom; manual upsert       | Explicit schema ownership; no coupling to library conventions |
| Role model        | `user \| admin` enum        | Simple, auditable; sufficient for most access control needs   |
| UI library        | shadcn/ui + Tailwind CSS    | Accessible components; fully customizable; no vendor lock-in  |
| API contract      | `ApiResponse<T>` envelope   | Consistent success/error shape across all routes              |
| Deployment format | Multi-stage Dockerfile      | Portable across any cloud; small production image             |

---

_Document owner: Engineering — last updated Step 1 (auth, UI foundation, and deployment baseline)_
