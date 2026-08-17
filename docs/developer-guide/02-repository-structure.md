# 02. Repository structure and workspace organization

Morshid is an npm workspace monorepo with a full-stack TypeScript codebase. It enforces strict type checks, architectural boundaries, and package isolation.

---

## 1. Monorepo root layout

```
morshid/
├── .github/                    # GitHub Actions workflows
│   └── workflows/ci.yml        # CI pipeline (validation and acceptance jobs)
├── client/                     # TanStack Start and React 19 client workspace
├── server/                     # NestJS server API workspace
├── scripts/                    # Maintenance, seed, verification, and reset scripts
├── tests/                      # Acceptance test suites
│   └── acceptance/             # Playwright browser journeys
├── storage/                    # Local storage for uploaded PDF files
│   └── pdfs/                   # Uploaded course PDFs (<uuid>.pdf)
├── docs/                       # Architecture documentation and ADRs
│   ├── adr/                    # Accepted Architecture Decision Records (0001-0008)
│   └── developer-guide/        # Developer guides
├── dependency-cruiser.config.mjs # Architecture and dependency rules
├── docker-compose.yml          # PostgreSQL, Redis, and server containers
├── eslint.config.mts           # ESLint flat configuration
├── prettier.config.mts         # Prettier configuration
├── playwright.config.ts        # Playwright configuration
├── tsconfig.json               # Root TypeScript configuration
├── package.json                # Root package manifest and scripts
└── AGENTS.md                   # Engineering guidelines and coding standards
```

---

## 2. Workspace configuration

The root [`package.json`](file:///home/mahmoud-ahmed/Projects/Morshid/package.json) defines two npm workspaces:

```json
{
  "name": "morshid",
  "private": true,
  "packageManager": "npm@11.18.0",
  "engines": {
    "node": ">=24.7 <25",
    "npm": ">=11"
  },
  "workspaces": [
    "client",
    "server"
  ]
}
```

### Dependency overrides

The root manifest specifies two dependency overrides:
- `@nestjs/platform-express` pins `multer` to `2.2.0` for memory storage and PDF stream handling.
- `@prisma/dev` pins `@hono/node-server` to `1.19.14`.

---

## 3. Server directory structure (`server/`)

The server follows a capability-first architecture ([ADR 0001](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0001-capability-first-ownership.md)):

```
server/
├── prisma/                     # Multi-file Prisma schema files and migrations
│   ├── schema.prisma           # Datasource and generator configuration
│   ├── identity.prisma         # Users, roles, refresh tokens
│   ├── courses-and-materials.prisma # Courses, memberships, materials, chunks
│   ├── conversations.prisma    # Chat sessions, messages, citations
│   ├── tutoring.prisma         # Topics, topic states, attempts, analyses, decisions, guards
│   ├── reviews.prisma          # Review cases, actions, review inbox items
│   ├── audit.prisma            # Audit log records
│   ├── migrations/             # Baseline migration SQL
│   ├── seed.ts                 # Database seed script
│   └── assert-catalog.mts      # Database catalog semantic hash check
├── src/
│   ├── main.ts                 # Entry point (NestFactory bootstrap)
│   ├── app.setup.ts            # Global filters, interceptors, pipes, and OpenAPI setup
│   ├── app.module.ts           # Root AppModule wiring
│   ├── application/            # Cross-capability presentation adapters and filters
│   ├── common/                 # Shared primitives (HTTP, text, validation)
│   ├── platform/               # Technical infrastructure (database, cache, AI, document storage)
│   ├── modules/                # Capability-first business logic modules
│   │   ├── identity/           # Authentication, authorization, password hashing, user admin
│   │   ├── courses/            # Course creation, access policy, membership management
│   │   ├── materials/          # PDF upload, text extraction, chunking, course evidence
│   │   ├── tutoring/           # Socratic tutoring engine, seven-phase runtime, prompt building
│   │   ├── conversations/      # Chat session persistence, ordered turns, context window
│   │   ├── reviews/            # Review queue, moderation, student inbox
│   │   ├── audit/              # Audit logging service and controller
│   │   └── health/             # Liveness and readiness health checks
│   ├── generated/              # Generated code (Prisma Client)
│   └── seeds/                  # Seed datasets and demo course fixtures
├── test/                       # Server test suites
│   ├── support/                # Disposable database helpers and AI test doubles
│   └── *.e2e-spec.ts           # Integration and E2E test suites
├── tsconfig.json               # TypeScript configuration
└── package.json                # Package manifest and scripts
```

---

## 4. Client directory structure (`client/`)

The client is a single-page application built with Vite, TanStack Router, and TanStack Query ([ADR 0005](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0005-frontend-features-and-workspaces.md)):

```
client/
├── src/
│   ├── app/                    # App composition and root providers
│   │   ├── app-providers.tsx   # Query client, devtools, and toast container
│   │   └── router.tsx          # Router instance creation helper
│   ├── routes/                 # File-based route tree
│   │   ├── __root.tsx          # Root shell and layout
│   │   ├── index.tsx           # Landing page
│   │   ├── login.tsx           # Login page (redirects if authenticated)
│   │   ├── health.tsx          # Health status page
│   │   ├── _student.tsx        # Student layout and role guard
│   │   ├── instructor/         # Instructor routes
│   │   └── admin/              # Admin routes
│   ├── workspaces/             # Role-specific layouts and shells
│   │   ├── _shared/            # Shared navigation and headers
│   │   ├── student/            # Student chat, citations drawer, and review modal
│   │   ├── instructor/         # Instructor course cards, PDF uploader, and review queue
│   │   └── admin/              # Admin user table, audit log explorer, and course manager
│   ├── features/               # Domain features with explicit public interfaces
│   │   ├── auth/               # Auth store, login form, and session management
│   │   ├── chat/               # Chat view, citations, and message list
│   │   ├── courses/            # Course lists, selectors, and readiness status
│   │   ├── materials/          # Upload forms and processing status
│   │   ├── reviews/            # Review queue, resolution views, and student inbox
│   │   ├── user-management/    # User creation, bulk import, and role editing
│   │   ├── audit/              # Audit log viewer table
│   │   ├── system-status/      # AI provider and database status cards
│   │   └── account-settings/   # Password changes and preferences
│   ├── components/             # Shared UI components (buttons, dialogs, inputs)
│   ├── lib/                    # Shared utilities (API client, cn helper)
│   ├── routeTree.gen.ts        # Generated route tree (do not edit directly)
│   └── test/                   # Vitest test setup and test utilities
├── vite.config.ts              # Vite and test configuration
└── package.json                # Client package manifest and dependencies
```

---

## 5. Operational scripts (`scripts/`)

The `scripts/` directory contains database maintenance, verification, and reset scripts:

| Script | Purpose | Command |
|---|---|---|
| [`catalog-semantics.mts`](file:///home/mahmoud-ahmed/Projects/Morshid/scripts/catalog-semantics.mts) | Hashes PostgreSQL catalog constraints with SHA-256 to detect schema regressions. | `npm run db:assert-catalog` |
| [`verify-generated-ownership.mts`](file:///home/mahmoud-ahmed/Projects/Morshid/scripts/verify-generated-ownership.mts) | Regenerates the Prisma client and TanStack route tree, then checks that output matches committed files. | `npm run test:generated-ownership` |
| [`fresh-seed-demo.mts`](file:///home/mahmoud-ahmed/Projects/Morshid/scripts/fresh-seed-demo.mts) | Runs a five-stage pipeline that resets the database, seeds demo data, lints, typechecks, checks architecture rules, and runs E2E tests. | `npm run demo:fresh-seed` |
| [`reset-local-db.mts`](file:///home/mahmoud-ahmed/Projects/Morshid/scripts/reset-local-db.mts) | Drops and recreates local PostgreSQL tables. Requires `MORSHID_RESET_CONFIRM=reset-local`. | `npm run db:reset` |
| [`clear-local-review-data.mts`](file:///home/mahmoud-ahmed/Projects/Morshid/scripts/clear-local-review-data.mts) | Truncates review cases and inbox items without dropping the full schema. Requires `MORSHID_REVIEW_CLEANUP_CONFIRM=clear-local-reviews`. | `npm run reviews:clear-local` |

---

## 6. Generated files policy

> [!IMPORTANT]
> Do not edit generated files by hand:
> - `server/src/generated/prisma/`
> - `client/src/routeTree.gen.ts`

Code generators (`prisma generate` and `@tanstack/router-cli`) own these paths. The CI pipeline runs `npm run test:generated-ownership` to regenerate them and fails if the output differs from the committed files.
